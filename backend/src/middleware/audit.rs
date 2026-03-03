// =============================================================================
// backend/src/middleware/audit.rs
// Round-3 integration fixes
// Fixed Issues 18-20 (compiler errors in audit middleware):
//   18. `AuditMiddleware<S>` now stores the inner service as `Rc<S>` to allow
//       the future to be `'static`.
//   19. `call()` clones the `Rc<S>` before moving into the async block so the
//       borrow-checker is satisfied.
//   20. Response body is consumed correctly: `body.try_into_bytes()` with
//       `.await` replaced by the correct `to_bytes()` helper from
//       `actix_web::body::to_bytes`.
// =============================================================================

use std::future::{ready, Ready, Future};
use std::pin::Pin;
use std::rc::Rc;
use std::task::{Context, Poll};
use std::time::Instant;

use actix_web::{
    body::to_bytes,
    dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform},
    Error,
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

pub struct AuditMiddlewareFactory;

impl<S, B> Transform<S, ServiceRequest> for AuditMiddlewareFactory
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: actix_web::body::MessageBody + 'static,
{
    type Response = ServiceResponse<actix_web::body::BoxBody>;
    type Error = Error;
    type Transform = AuditMiddleware<S>;
    type InitError = ();
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuditMiddleware {
            service: Rc::new(service), // Fix 18: wrap in Rc
        }))
    }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

pub struct AuditMiddleware<S> {
    service: Rc<S>, // Fix 18
}

impl<S, B> Service<ServiceRequest> for AuditMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    B: actix_web::body::MessageBody + 'static,
{
    type Response = ServiceResponse<actix_web::body::BoxBody>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let svc = self.service.clone(); // Fix 19: clone Rc before move
        let start = Instant::now();
        let method = req.method().to_string();
        let path = req.path().to_string();

        Box::pin(async move {
            let res = svc.call(req).await?;
            let elapsed = start.elapsed().as_millis();
            let status = res.status().as_u16();

            // Fix 20: consume body into bytes using actix helper, then re-box
            let (req_parts, body) = res.into_parts();
            let bytes = to_bytes(body).await.map_err(|e| {
                actix_web::error::ErrorInternalServerError(e)
            })?;

            log::info!(
                "AUDIT {} {} → {} ({}ms) [{} bytes]",
                method, path, status, elapsed, bytes.len()
            );

            let boxed = actix_web::body::BoxBody::new(bytes);
            Ok(ServiceResponse::new(req_parts, boxed))
        })
    }
}
