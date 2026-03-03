// backend/src/middleware/audit.rs
// Audit middleware: logs every incoming request with method, path, status, and duration.
// Fixed Issue 25: Middleware now correctly implements actix_web::dev::Transform
// and uses a proper ServiceRequest wrapper without double-polling.

use std::future::{ready, Future, Ready};
use std::pin::Pin;
use std::time::Instant;

use actix_web::dev::{forward_ready, Service, ServiceRequest, ServiceResponse, Transform};
use actix_web::Error;

pub struct AuditMiddleware;

impl<S, B> Transform<S, ServiceRequest> for AuditMiddleware
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type InitError = ();
    type Transform = AuditMiddlewareService<S>;
    type Future = Ready<Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ready(Ok(AuditMiddlewareService { service }))
    }
}

pub struct AuditMiddlewareService<S> {
    service: S,
}

impl<S, B> Service<ServiceRequest> for AuditMiddlewareService<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<B>;
    type Error = Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>;

    forward_ready!(service);

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let method = req.method().to_string();
        let path = req.path().to_string();
        let start = Instant::now();

        let fut = self.service.call(req);

        Box::pin(async move {
            let res = fut.await?;
            let duration = start.elapsed();
            let status = res.status().as_u16();
            log::info!(
                "AUDIT {} {} -> {} ({:.2}ms)",
                method,
                path,
                status,
                duration.as_secs_f64() * 1000.0
            );
            Ok(res)
        })
    }
}
