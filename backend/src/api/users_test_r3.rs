// backend/src/api/users_test_r3.rs
// Round-3 regression tests for the users API.

#[cfg(test)]
mod tests {
    use actix_web::{test, web, App};
    use sqlx::PgPool;

    use crate::api::users::configure;

    async fn get_test_pool() -> PgPool {
        let database_url =
            std::env::var("DATABASE_URL").expect("DATABASE_URL must be set for integration tests");
        PgPool::connect(&database_url)
            .await
            .expect("Failed to connect to test database")
    }

    #[actix_web::test]
    async fn test_list_users_returns_200() {
        let pool = get_test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(configure),
        )
        .await;

        let req = test::TestRequest::get().uri("/api/users").to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);
    }

    #[actix_web::test]
    async fn test_get_nonexistent_user_returns_404() {
        let pool = get_test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(configure),
        )
        .await;

        let req = test::TestRequest::get()
            .uri("/api/users/00000000-0000-0000-0000-000000000000")
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }
}
