// middleware/audit_test_r3.rs — Round-3 unit tests for the audit middleware.
//
// Tests cover:
//   • AuditMiddlewareFactory implements Transform and produces AuditMiddleware
//   • AuditMiddleware wraps a simple handler and passes the request through
//   • Response body is preserved after the middleware consumes + re-boxes it
//   • Status code is forwarded unchanged
//   • Large body round-trip

#[cfg(test)]
mod tests {
    use actix_web::{body::to_bytes, dev::Service, http::StatusCode, test, web, App, HttpResponse};

    use crate::middleware::audit::AuditMiddlewareFactory;

    // ------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------

    async fn simple_handler() -> HttpResponse {
        HttpResponse::Ok().body("hello audit")
    }

    async fn json_handler() -> HttpResponse {
        HttpResponse::Ok().json(serde_json::json!({"ok": true}))
    }

    async fn empty_handler() -> HttpResponse {
        HttpResponse::NoContent().finish()
    }

    async fn large_handler() -> HttpResponse {
        let body = "x".repeat(64 * 1024); // 64 KiB
        HttpResponse::Ok().body(body)
    }

    // ------------------------------------------------------------------
    // tests
    // ------------------------------------------------------------------

    #[actix_web::test]
    async fn test_middleware_passes_status() {
        let app = test::init_service(
            App::new()
                .wrap(AuditMiddlewareFactory)
                .route("/", web::get().to(simple_handler)),
        )
        .await;

        let req = test::TestRequest::get().uri("/").to_request();
        let resp = app.call(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[actix_web::test]
    async fn test_middleware_preserves_body() {
        let app = test::init_service(
            App::new()
                .wrap(AuditMiddlewareFactory)
                .route("/", web::get().to(simple_handler)),
        )
        .await;

        let req = test::TestRequest::get().uri("/").to_request();
        let resp = app.call(req).await.unwrap();
        let body = to_bytes(resp.into_body()).await.unwrap();
        assert_eq!(body.as_ref(), b"hello audit");
    }

    #[actix_web::test]
    async fn test_middleware_json_body() {
        let app = test::init_service(
            App::new()
                .wrap(AuditMiddlewareFactory)
                .route("/", web::get().to(json_handler)),
        )
        .await;

        let req = test::TestRequest::get().uri("/").to_request();
        let resp = app.call(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = to_bytes(resp.into_body()).await.unwrap();
        let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["ok"], true);
    }

    #[actix_web::test]
    async fn test_middleware_empty_body() {
        let app = test::init_service(
            App::new()
                .wrap(AuditMiddlewareFactory)
                .route("/", web::get().to(empty_handler)),
        )
        .await;

        let req = test::TestRequest::get().uri("/").to_request();
        let resp = app.call(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::NO_CONTENT);
    }

    #[actix_web::test]
    async fn test_middleware_large_body_round_trip() {
        let app = test::init_service(
            App::new()
                .wrap(AuditMiddlewareFactory)
                .route("/", web::get().to(large_handler)),
        )
        .await;

        let req = test::TestRequest::get().uri("/").to_request();
        let resp = app.call(req).await.unwrap();
        let body = to_bytes(resp.into_body()).await.unwrap();
        assert_eq!(body.len(), 64 * 1024);
    }
}
