// backend/src/auth/middleware.rs
// ============================================================
// F20 · Actix-web authentication middleware
// ============================================================
//
// Extracts the JWT from the `Authorization: Bearer <token>` header,
// validates it, and inserts an `AuthenticatedUser` into the request
// extensions.  Skips authentication for configurable public routes
// (e.g. login, register, health).

use actix_web::{
    body::EitherBody,
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error, HttpMessage, HttpResponse,
};
use futures_util::future::{ok, LocalBoxFuture, Ready};
use std::rc::Rc;

use super::{decode_token, AuthConfig, AuthenticatedUser, TokenType};

// ── Public-route list ────────────────────────────────────────

/// Routes that do NOT require a valid JWT.
const PUBLIC_ROUTES: &[&str] = &[
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/refresh",
    "/health",
    "/api/health",
];

fn is_public(path: &str) -> bool {
    PUBLIC_ROUTES.iter().any(|r| path == *r)
}

// ── Transform (factory) ─────────────────────────────────────

/// Middleware factory — add to your `App` with `.wrap(AuthMiddleware::new(config))`.
#[derive(Clone)]
pub struct AuthMiddleware {
    config: AuthConfig,
}

impl AuthMiddleware {
    pub fn new(config: AuthConfig) -> Self {
        Self { config }
    }
}

impl<S, B> Transform<S, ServiceRequest> for AuthMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Transform = AuthMiddlewareService<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(AuthMiddlewareService {
            service: Rc::new(service),
            config: self.config.clone(),
        })
    }
}

// ── Service ──────────────────────────────────────────────────

pub struct AuthMiddlewareService<S> {
    service: Rc<S>,
    config: AuthConfig,
}

impl<S, B> Service<ServiceRequest> for AuthMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, Result<Self::Response, Self::Error>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let service = Rc::clone(&self.service);
        let secret = self.config.jwt_secret.clone();

        Box::pin(async move {
            // ── Skip auth for public routes ─────────────
            if is_public(req.path()) {
                let res = service.call(req).await?;
                return Ok(res.map_into_left_body());
            }

            // ── Extract Bearer token ────────────────────
            let auth_header = req
                .headers()
                .get("Authorization")
                .and_then(|v| v.to_str().ok())
                .map(|s| s.to_string());

            let token = match auth_header {
                Some(ref header) if header.starts_with("Bearer ") => &header[7..],
                _ => {
                    let resp = HttpResponse::Unauthorized().json(serde_json::json!({
                        "error": "Missing or malformed Authorization header",
                        "status": 401,
                    }));
                    return Ok(req.into_response(resp).map_into_right_body());
                }
            };

            // ── Validate token ──────────────────────────
            match decode_token(token, &secret) {
                Ok(token_data) => {
                    let claims = token_data.claims;

                    // Only access tokens are valid for API requests
                    if claims.token_type != TokenType::Access {
                        let resp = HttpResponse::Unauthorized().json(serde_json::json!({
                            "error": "Invalid token type: expected access token",
                            "status": 401,
                        }));
                        return Ok(req.into_response(resp).map_into_right_body());
                    }

                    let user = AuthenticatedUser::from_claims(&claims);
                    req.extensions_mut().insert(user);

                    let res = service.call(req).await?;
                    Ok(res.map_into_left_body())
                }
                Err(_) => {
                    let resp = HttpResponse::Unauthorized().json(serde_json::json!({
                        "error": "Invalid or expired token",
                        "status": 401,
                    }));
                    Ok(req.into_response(resp).map_into_right_body())
                }
            }
        })
    }
}
