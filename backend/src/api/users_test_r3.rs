// backend/src/api/users_test_r3.rs
// Round 3 integration tests for the users API.
// Uses sqlx::test with a real Postgres test database.

#[cfg(test)]
mod tests {
    use actix_web::{test, web, App};
    use sqlx::PgPool;
    use uuid::Uuid;

    use crate::api::users::{configure, UserResponse};

    async fn setup_test_user(pool: &PgPool) -> Uuid {
        let id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO users (id, email, name, password_hash, role) VALUES ($1, $2, $3, $4, $5)"
        )
        .bind(id)
        .bind(format!("test+{}@example.com", id))
        .bind("Test User")
        .bind("$2b$12$placeholder_hash")
        .bind("operator")
        .execute(pool)
        .await
        .expect("Failed to insert test user");
        id
    }

    #[sqlx::test]
    async fn test_list_users_empty(pool: PgPool) {
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(configure),
        )
        .await;

        let req = test::TestRequest::get().uri("/users").to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: Vec<UserResponse> = test::read_body_json(resp).await;
        assert!(body.is_empty());
    }

    #[sqlx::test]
    async fn test_get_user_not_found(pool: PgPool) {
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(configure),
        )
        .await;

        let id = Uuid::new_v4();
        let req = test::TestRequest::get()
            .uri(&format!("/users/{}", id))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }

    #[sqlx::test]
    async fn test_create_and_get_user(pool: PgPool) {
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(configure),
        )
        .await;

        let body = serde_json::json!({
            "email": "newuser@example.com",
            "name": "New User",
            "password": "securepassword123"
        });

        let req = test::TestRequest::post()
            .uri("/users")
            .set_json(&body)
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 201);

        let created: UserResponse = test::read_body_json(resp).await;
        assert_eq!(created.email, "newuser@example.com");

        // Now fetch by id
        let req2 = test::TestRequest::get()
            .uri(&format!("/users/{}", created.id))
            .to_request();
        let resp2 = test::call_service(&app, req2).await;
        assert_eq!(resp2.status(), 200);
    }

    #[sqlx::test]
    async fn test_delete_user(pool: PgPool) {
        let id = setup_test_user(&pool).await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(configure),
        )
        .await;

        let req = test::TestRequest::delete()
            .uri(&format!("/users/{}", id))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 204);

        // Confirm it's gone
        let req2 = test::TestRequest::get()
            .uri(&format!("/users/{}", id))
            .to_request();
        let resp2 = test::call_service(&app, req2).await;
        assert_eq!(resp2.status(), 404);
    }
}
