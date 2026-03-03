use axum::{
    body::Body,
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::AuthenticatedUser;

pub async fn audit_middleware(
    State(pool): State<PgPool>,
    request: Request,
    next: Next,
) -> Response {
    let method = request.method().clone();
    let path = request.uri().path().to_owned();
    let user_id = request
        .extensions()
        .get::<AuthenticatedUser>()
        .map(|u| u.user_id);

    let response = next.run(request).await;
    let status = response.status().as_u16() as i32;

    if matches!(method.as_str(), "POST" | "PUT" | "PATCH" | "DELETE") {
        let pool_clone = pool.clone();
        let path_clone = path.clone();
        let method_str = method.to_string();

        tokio::spawn(async move {
            let result = sqlx::query!(
                "INSERT INTO audit_logs (id, user_id, action, resource_path, status_code, created_at) \
                 VALUES ($1, $2, $3, $4, $5, $6)",
                Uuid::new_v4(),
                user_id.map(|u| u),
                method_str,
                path_clone,
                status,
                Utc::now()
            )
            .execute(&pool_clone)
            .await;

            if let Err(e) = result {
                tracing::warn!("Audit log insert failed: {}", e);
            }
        });
    }

    response
}

#[derive(Clone)]
pub struct AuditMiddlewareLayer {
    pool: PgPool,
}

impl AuditMiddlewareLayer {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

impl<S> tower::Layer<S> for AuditMiddlewareLayer {
    type Service = AuditMiddlewareService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        AuditMiddlewareService {
            inner,
            pool: self.pool.clone(),
        }
    }
}

#[derive(Clone)]
pub struct AuditMiddlewareService<S> {
    inner: S,
    pool: PgPool,
}

impl<S> tower::Service<Request<Body>> for AuditMiddlewareService<S>
where
    S: tower::Service<Request<Body>, Response = Response> + Clone + Send + 'static,
    S::Future: Send + 'static,
{
    type Response = Response;
    type Error = S::Error;
    type Future = std::pin::Pin<Box<dyn std::future::Future<Output = Result<Response, S::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut std::task::Context<'_>) -> std::task::Poll<Result<(), S::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, request: Request<Body>) -> Self::Future {
        let pool = self.pool.clone();
        let mut inner = self.inner.clone();

        Box::pin(async move {
            let method = request.method().clone();
            let path = request.uri().path().to_owned();
            let user_id = request
                .extensions()
                .get::<AuthenticatedUser>()
                .map(|u| u.user_id);

            let response = inner.call(request).await?;
            let status = response.status().as_u16() as i32;

            if matches!(method.as_str(), "POST" | "PUT" | "PATCH" | "DELETE") {
                let pool_clone = pool.clone();
                let method_str = method.to_string();

                tokio::spawn(async move {
                    let result = sqlx::query!(
                        "INSERT INTO audit_logs (id, user_id, action, resource_path, status_code, created_at) \
                         VALUES ($1, $2, $3, $4, $5, $6)",
                        Uuid::new_v4(),
                        user_id.map(|u| u),
                        method_str,
                        path,
                        status,
                        Utc::now()
                    )
                    .execute(&pool_clone)
                    .await;

                    if let Err(e) = result {
                        tracing::warn!("Audit log insert failed: {}", e);
                    }
                });
            }

            Ok(response)
        })
    }
}
