// =============================================================================
// backend/src/middleware/audit.rs — Audit logging middleware
// F21: Backend Compilation Fixes
//
// Captures every mutating API call (POST / PUT / PATCH / DELETE) and writes an
// entry to the `audit_logs` table with the authenticated user, the HTTP action,
// the target entity type + id, and the request IP.
//
// Non-mutating methods (GET, HEAD, OPTIONS) are silently passed through.
// =============================================================================

use actix_web::dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform};
use actix_web::{web, Error, HttpMessage};
use futures::future::{ok, LocalBoxFuture, Ready};
use sqlx::PgPool;
use std::rc::Rc;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Public types re-used by the rest of the crate
// ---------------------------------------------------------------------------

/// The user id extracted from the JWT and stored in request extensions.
#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub user_id: Uuid,
}

/// Represents a single row in `audit_logs`.
#[derive(Debug, Clone)]
pub struct AuditEntry {
    pub user_id: Option<Uuid>,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Option<Uuid>,
    pub old_value: Option<serde_json::Value>,
    pub new_value: Option<serde_json::Value>,
    pub ip_address: Option<String>,
}

// ---------------------------------------------------------------------------
// Persistence helper
// ---------------------------------------------------------------------------

/// Insert a row into `audit_logs`.
pub async fn insert_audit_log(pool: &PgPool, entry: &AuditEntry) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7::inet)
        "#,
    )
    .bind(entry.user_id)
    .bind(&entry.action)
    .bind(&entry.entity_type)
    .bind(entry.entity_id)
    .bind(&entry.old_value)
    .bind(&entry.new_value)
    .bind(&entry.ip_address)
    .execute(pool)
    .await?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Route-parsing helpers
// ---------------------------------------------------------------------------

/// Derive `entity_type` from the request path.
/// E.g. `/api/jobs/abc-123` → `"jobs"`, `/api/parts` → `"parts"`.
fn entity_type_from_path(path: &str) -> String {
    let segments: Vec<&str> = path
        .trim_start_matches('/')
        .split('/')
        .filter(|s| !s.is_empty())
        .collect();

    // Expect paths like /api/<entity>[/<id>][/<sub>]
    if segments.len() >= 2 {
        segments[1].to_string()
    } else if !segments.is_empty() {
        segments[0].to_string()
    } else {
        "unknown".to_string()
    }
}

/// Try to extract a UUID entity id from the request path.
/// Looks for the first path segment that parses as a UUID.
fn entity_id_from_path(path: &str) -> Option<Uuid> {
    path.split('/')
        .find_map(|seg| Uuid::parse_str(seg).ok())
}

/// Map an HTTP method to an audit action verb.
fn action_from_method(method: &actix_web::http::Method) -> &'static str {
    match *method {
        actix_web::http::Method::POST => "create",
        actix_web::http::Method::PUT => "update",
        actix_web::http::Method::PATCH => "patch",
        actix_web::http::Method::DELETE => "delete",
        _ => "unknown",
    }
}

/// Returns `true` for methods that mutate state and should be audited.
fn is_mutating(method: &actix_web::http::Method) -> bool {
    matches!(
        *method,
        actix_web::http::Method::POST
            | actix_web::http::Method::PUT
            | actix_web::http::Method::PATCH
            | actix_web::http::Method::DELETE
    )
}

// ---------------------------------------------------------------------------
// Middleware factory (Transform)
// ---------------------------------------------------------------------------

/// Actix middleware factory that wraps services with audit logging.
///
/// Usage in `App::new()`:
/// ```rust,ignore
/// App::new()
///     .wrap(AuditMiddleware)
///     // ...
/// ```
pub struct AuditMiddleware;

impl<S, B> Transform<S, ServiceRequest> for AuditMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Transform = AuditMiddlewareService<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(AuditMiddlewareService {
            service: Rc::new(service),
        })
    }
}

// ---------------------------------------------------------------------------
// Middleware service (per-request logic)
// ---------------------------------------------------------------------------

pub struct AuditMiddlewareService<S> {
    service: Rc<S>,
}

impl<S, B> Service<ServiceRequest> for AuditMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let svc = Rc::clone(&self.service);

        Box::pin(async move {
            // Capture request metadata *before* the inner handler runs.
            let method = req.method().clone();
            let path = req.path().to_owned();
            let should_audit = is_mutating(&method);

            // Extract user id from request extensions (set by auth middleware).
            let user_id = req
                .extensions()
                .get::<AuthenticatedUser>()
                .map(|u| u.user_id);

            // Extract client IP from connection info.
            let ip_address = req
                .connection_info()
                .peer_addr()
                .map(|s| s.to_string());

            // Grab a handle to the DB pool (added via app_data).
            let pool = req.app_data::<web::Data<PgPool>>().cloned();

            // Call the inner service.
            let response = svc.call(req).await?;

            // After the response, log mutating calls that succeeded (2xx/3xx).
            if should_audit {
                let status = response.status();
                if status.is_success() || status.is_redirection() {
                    if let Some(pool) = pool {
                        let entry = AuditEntry {
                            user_id,
                            action: action_from_method(&method).to_string(),
                            entity_type: entity_type_from_path(&path),
                            entity_id: entity_id_from_path(&path),
                            old_value: None, // Populated by handlers that do read-before-write
                            new_value: None,
                            ip_address,
                        };

                        // Fire-and-forget — don't block the response on audit persistence.
                        let pool = pool.into_inner();
                        tokio::spawn(async move {
                            if let Err(e) = insert_audit_log(&pool, &entry).await {
                                log::error!("Failed to write audit log: {e}");
                            }
                        });
                    }
                }
            }

            Ok(response)
        })
    }
}

// ---------------------------------------------------------------------------
// Convenience: module-level middleware registration helper
// ---------------------------------------------------------------------------

pub mod middleware_mod {
    //! Re-export the middleware module declaration for `backend/src/middleware/mod.rs`.
    //!
    //! Create `backend/src/middleware/mod.rs` with:
    //! ```rust,ignore
    //! pub mod audit;
    //! pub use audit::AuditMiddleware;
    //! ```
    //!
    //! And add `pub mod middleware;` to `backend/src/lib.rs`.
}
