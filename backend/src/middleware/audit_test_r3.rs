// backend/src/middleware/audit_test_r3.rs
// Round 3 integration tests for the audit middleware.

#[cfg(test)]
mod tests {
    use actix_web::{get, test, web, App, HttpResponse};
    use crate::middleware::audit::AuditMiddleware;

    #[get("/ping")]
    async fn ping() -> HttpResponse {
        HttpResponse::Ok().body("pong")
    }

    #[actix_web::test]
    async fn test_audit_middleware_passes_request() {
        let app = test::init_service(
            App::new()
                .wrap(AuditMiddleware)
                .service(ping),
        )
        .await;

        let req = test::TestRequest::get().uri("/ping").to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);
    }

    #[actix_web::test]
    async fn test_audit_middleware_on_not_found() {
        let app = test::init_service(
            App::new()
                .wrap(AuditMiddleware)
                .service(ping),
        )
        .await;

        let req = test::TestRequest::get().uri("/nonexistent").to_request();
        let resp = test::call_service(&app, req).await;
        // 404 still passes through middleware
        assert_eq!(resp.status(), 404);
    }
}
