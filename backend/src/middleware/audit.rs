use std::future::{ready, Future, Ready};
use std::pin::Pin;
use std::rc::Rc;
use std::time::Instant;

use actix_web::{
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
            service: Rc::new(service),
        }))
    }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

pub struct AuditMiddleware<S> {
    service: Rc<S>,
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
        let svc = self.service.clone();
        let start = Instant::now();
        let method = req.method().to_string();
        let path = req.path().to_string();

        Box::pin(async move {
            let res = svc.call(req).await?;
            let elapsed = start.elapsed().as_millis();
            let status = res.status().as_u16();

            log::info!("AUDIT {} {} → {} ({}ms)", method, path, status, elapsed);

            Ok(res.map_into_boxed_body())
        })
    }
}
