//! Integration tests for CRUD handler batch 1.
//!
//! Each test module mirrors one API module and exercises all five operations:
//! list (empty + with data), get (found + not found), create (success + bad
//! input), update (success + not found), and delete (success + not found).
//!
//! # Running
//! ```
//! cargo test --test api_crud_tests_batch1
//! ```
//!
//! # Database
//! Tests require a running PostgreSQL instance.  Set the `DATABASE_URL`
//! environment variable (or a `.env` file) before running.
//! Each test function creates its own transaction that is rolled back on
//! completion so tests are fully isolated.

use actix_web::{test, web, App};
use serde_json::{json, Value};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/// Acquire a connection pool from the environment.
async fn test_pool() -> PgPool {
    let url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set for integration tests");
    PgPool::connect(&url)
        .await
        .expect("Failed to connect to test database")
}

/// Begin a transaction that is rolled back when dropped, providing test
/// isolation without permanent data mutation.
async fn begin_tx(pool: &PgPool) -> Transaction<'_, Postgres> {
    pool.begin().await.expect("Failed to begin transaction")
}

// ---------------------------------------------------------------------------
// ── jobs ────────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

#[cfg(test)]
mod jobs_tests {
    use super::*;
    use crate::api::jobs;

    fn build_app(pool: PgPool) -> impl actix_web::dev::ServiceFactory<
        actix_web::dev::ServiceRequest,
        Config = (),
        Response = actix_web::dev::ServiceResponse,
        Error = actix_web::Error,
        InitError = (),
    > {
        App::new()
            .app_data(web::Data::new(pool))
            .configure(jobs::configure)
    }

    // 1. List jobs — empty result set
    #[actix_web::test]
    async fn test_list_jobs_empty() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;

        // Ensure table is empty inside this transaction
        sqlx::query!("DELETE FROM jobs").execute(&mut *tx).await.unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(jobs::configure),
        )
        .await;

        let req = test::TestRequest::get().uri("/jobs").to_request();
        let resp: Value = test::call_and_read_body_json(&app, req).await;

        assert!(resp.as_array().unwrap().is_empty());
        tx.rollback().await.unwrap();
    }

    // 2. List jobs — returns inserted rows
    #[actix_web::test]
    async fn test_list_jobs_with_data() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;

        sqlx::query!(
            "INSERT INTO jobs (id, name, client_name, status, created_at, updated_at)
             VALUES (gen_random_uuid(), 'Kitchen Reno', 'Alice', 'draft', NOW(), NOW()),
                    (gen_random_uuid(), 'Bath Reno',   'Bob',   'draft', NOW(), NOW())"
        )
        .execute(&mut *tx)
        .await
        .unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(jobs::configure),
        )
        .await;

        let req = test::TestRequest::get().uri("/jobs").to_request();
        let resp: Value = test::call_and_read_body_json(&app, req).await;

        assert!(resp.as_array().unwrap().len() >= 2);
        tx.rollback().await.unwrap();
    }

    // 3. Get job — found
    #[actix_web::test]
    async fn test_get_job_found() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO jobs (id, name, client_name, status, created_at, updated_at)
             VALUES ($1, 'Test Job', 'Client A', 'draft', NOW(), NOW())",
            id
        )
        .execute(&mut *tx)
        .await
        .unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(jobs::configure),
        )
        .await;

        let req = test::TestRequest::get()
            .uri(&format!("/jobs/{id}"))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["id"].as_str().unwrap(), id.to_string());
        assert_eq!(body["name"].as_str().unwrap(), "Test Job");

        tx.rollback().await.unwrap();
    }

    // 4. Get job — not found
    #[actix_web::test]
    async fn test_get_job_not_found() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(jobs::configure),
        )
        .await;

        let req = test::TestRequest::get()
            .uri(&format!("/jobs/{}", Uuid::new_v4()))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }

    // 5. Create job — success
    #[actix_web::test]
    async fn test_create_job_success() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(jobs::configure),
        )
        .await;

        let payload = json!({
            "name": "New Kitchen",
            "client_name": "Carol"
        });

        let req = test::TestRequest::post()
            .uri("/jobs")
            .set_json(&payload)
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 201);

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["name"].as_str().unwrap(), "New Kitchen");
        assert_eq!(body["status"].as_str().unwrap(), "draft");
        assert!(body["id"].as_str().is_some());

        tx.rollback().await.unwrap();
    }

    // 6. Create job — missing required field returns 400 (actix json extractor)
    #[actix_web::test]
    async fn test_create_job_missing_name() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(
                    web::JsonConfig::default()
                        .error_handler(|err, _req| {
                            actix_web::error::InternalError::from_response(
                                err,
                                HttpResponse::BadRequest().finish(),
                            )
                            .into()
                        }),
                )
                .app_data(web::Data::new(pool))
                .configure(jobs::configure),
        )
        .await;

        let req = test::TestRequest::post()
            .uri("/jobs")
            .set_json(json!({ "client_name": "Dave" }))  // missing `name`
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_client_error());
    }

    // 7. List jobs — status filter
    #[actix_web::test]
    async fn test_list_jobs_status_filter() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;

        sqlx::query!(
            "INSERT INTO jobs (id, name, client_name, status, created_at, updated_at)
             VALUES (gen_random_uuid(), 'Draft Job',    'E', 'draft',    NOW(), NOW()),
                    (gen_random_uuid(), 'Active Job',   'F', 'active',   NOW(), NOW()),
                    (gen_random_uuid(), 'Complete Job', 'G', 'complete', NOW(), NOW())"
        )
        .execute(&mut *tx)
        .await
        .unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(jobs::configure),
        )
        .await;

        let req = test::TestRequest::get()
            .uri("/jobs?status=active")
            .to_request();
        let resp: Value = test::call_and_read_body_json(&app, req).await;
        let items = resp.as_array().unwrap();
        assert!(items.iter().all(|j| j["status"].as_str() == Some("active")));

        tx.rollback().await.unwrap();
    }

    // 8. Update job — success
    #[actix_web::test]
    async fn test_update_job_success() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO jobs (id, name, client_name, status, created_at, updated_at)
             VALUES ($1, 'Old Name', 'H', 'draft', NOW(), NOW())",
            id
        )
        .execute(&mut *tx)
        .await
        .unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(jobs::configure),
        )
        .await;

        let req = test::TestRequest::put()
            .uri(&format!("/jobs/{id}"))
            .set_json(json!({ "name": "New Name", "status": "active" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["name"].as_str().unwrap(), "New Name");
        assert_eq!(body["status"].as_str().unwrap(), "active");

        tx.rollback().await.unwrap();
    }

    // 9. Update job — not found
    #[actix_web::test]
    async fn test_update_job_not_found() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(jobs::configure),
        )
        .await;

        let req = test::TestRequest::put()
            .uri(&format!("/jobs/{}", Uuid::new_v4()))
            .set_json(json!({ "name": "Ghost" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }

    // 10. Delete job — success
    #[actix_web::test]
    async fn test_delete_job_success() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO jobs (id, name, client_name, status, created_at, updated_at)
             VALUES ($1, 'Doomed Job', 'I', 'draft', NOW(), NOW())",
            id
        )
        .execute(&mut *tx)
        .await
        .unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(jobs::configure),
        )
        .await;

        let req = test::TestRequest::delete()
            .uri(&format!("/jobs/{id}"))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 204);

        tx.rollback().await.unwrap();
    }

    // 11. Delete job — not found
    #[actix_web::test]
    async fn test_delete_job_not_found() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(jobs::configure),
        )
        .await;

        let req = test::TestRequest::delete()
            .uri(&format!("/jobs/{}", Uuid::new_v4()))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }
}

// ---------------------------------------------------------------------------
// ── rooms ───────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

#[cfg(test)]
mod rooms_tests {
    use super::*;
    use crate::api::rooms;

    /// Insert a seed job and return its UUID.
    async fn seed_job(pool: &PgPool) -> Uuid {
        let id = Uuid::new_v4();
        sqlx::query!(
            "INSERT INTO jobs (id, name, client_name, status, created_at, updated_at)
             VALUES ($1, 'Seed Job', 'Test', 'draft', NOW(), NOW())",
            id
        )
        .execute(pool)
        .await
        .unwrap();
        id
    }

    // 1. List rooms — empty
    #[actix_web::test]
    async fn test_list_rooms_empty() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let job_id = seed_job(&pool).await;

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(rooms::configure),
        )
        .await;

        let req = test::TestRequest::get()
            .uri(&format!("/jobs/{job_id}/rooms"))
            .to_request();
        let resp: Value = test::call_and_read_body_json(&app, req).await;
        assert!(resp.as_array().unwrap().is_empty());

        tx.rollback().await.unwrap();
    }

    // 2. List rooms — with data
    #[actix_web::test]
    async fn test_list_rooms_with_data() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let job_id = seed_job(&pool).await;

        sqlx::query!(
            "INSERT INTO rooms (id, job_id, name, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, 'Kitchen', NOW(), NOW()),
                    (gen_random_uuid(), $1, 'Bathroom', NOW(), NOW())",
            job_id
        )
        .execute(&mut *tx)
        .await
        .unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(rooms::configure),
        )
        .await;

        let req = test::TestRequest::get()
            .uri(&format!("/jobs/{job_id}/rooms"))
            .to_request();
        let resp: Value = test::call_and_read_body_json(&app, req).await;
        assert!(resp.as_array().unwrap().len() >= 2);

        tx.rollback().await.unwrap();
    }

    // 3. Get room — found
    #[actix_web::test]
    async fn test_get_room_found() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let job_id = seed_job(&pool).await;
        let room_id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO rooms (id, job_id, name, created_at, updated_at)
             VALUES ($1, $2, 'Living Room', NOW(), NOW())",
            room_id,
            job_id
        )
        .execute(&mut *tx)
        .await
        .unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(rooms::configure),
        )
        .await;

        let req = test::TestRequest::get()
            .uri(&format!("/jobs/{job_id}/rooms/{room_id}"))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["name"].as_str().unwrap(), "Living Room");

        tx.rollback().await.unwrap();
    }

    // 4. Get room — not found
    #[actix_web::test]
    async fn test_get_room_not_found() {
        let pool = test_pool().await;
        let job_id = Uuid::new_v4(); // non-existent job
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(rooms::configure),
        )
        .await;

        let req = test::TestRequest::get()
            .uri(&format!("/jobs/{job_id}/rooms/{}", Uuid::new_v4()))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }

    // 5. Create room — success
    #[actix_web::test]
    async fn test_create_room_success() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let job_id = seed_job(&pool).await;

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(rooms::configure),
        )
        .await;

        let req = test::TestRequest::post()
            .uri(&format!("/jobs/{job_id}/rooms"))
            .set_json(json!({
                "name": "Pantry",
                "width": 2400.0,
                "height": 2400.0,
                "depth": 600.0
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 201);

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["name"].as_str().unwrap(), "Pantry");
        assert_eq!(body["job_id"].as_str().unwrap(), job_id.to_string());

        tx.rollback().await.unwrap();
    }

    // 6. Create room — missing required field
    #[actix_web::test]
    async fn test_create_room_missing_name() {
        let pool = test_pool().await;
        let job_id = Uuid::new_v4();
        let app = test::init_service(
            App::new()
                .app_data(
                    web::JsonConfig::default().error_handler(|err, _req| {
                        actix_web::error::InternalError::from_response(
                            err,
                            HttpResponse::BadRequest().finish(),
                        )
                        .into()
                    }),
                )
                .app_data(web::Data::new(pool))
                .configure(rooms::configure),
        )
        .await;

        let req = test::TestRequest::post()
            .uri(&format!("/jobs/{job_id}/rooms"))
            .set_json(json!({ "width": 1200.0 }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_client_error());
    }

    // 7. Update room — success
    #[actix_web::test]
    async fn test_update_room_success() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let job_id = seed_job(&pool).await;
        let room_id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO rooms (id, job_id, name, created_at, updated_at)
             VALUES ($1, $2, 'Old Name', NOW(), NOW())",
            room_id,
            job_id
        )
        .execute(&mut *tx)
        .await
        .unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(rooms::configure),
        )
        .await;

        let req = test::TestRequest::put()
            .uri(&format!("/jobs/{job_id}/rooms/{room_id}"))
            .set_json(json!({ "name": "New Name", "width": 3000.0 }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["name"].as_str().unwrap(), "New Name");

        tx.rollback().await.unwrap();
    }

    // 8. Update room — not found
    #[actix_web::test]
    async fn test_update_room_not_found() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(rooms::configure),
        )
        .await;

        let req = test::TestRequest::put()
            .uri(&format!("/jobs/{}/rooms/{}", Uuid::new_v4(), Uuid::new_v4()))
            .set_json(json!({ "name": "Ghost Room" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }

    // 9. Delete room — success
    #[actix_web::test]
    async fn test_delete_room_success() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let job_id = seed_job(&pool).await;
        let room_id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO rooms (id, job_id, name, created_at, updated_at)
             VALUES ($1, $2, 'Doomed Room', NOW(), NOW())",
            room_id,
            job_id
        )
        .execute(&mut *tx)
        .await
        .unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(rooms::configure),
        )
        .await;

        let req = test::TestRequest::delete()
            .uri(&format!("/jobs/{job_id}/rooms/{room_id}"))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 204);

        tx.rollback().await.unwrap();
    }

    // 10. Delete room — not found
    #[actix_web::test]
    async fn test_delete_room_not_found() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(rooms::configure),
        )
        .await;

        let req = test::TestRequest::delete()
            .uri(&format!("/jobs/{}/rooms/{}", Uuid::new_v4(), Uuid::new_v4()))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }
}

// ---------------------------------------------------------------------------
// ── products ────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

#[cfg(test)]
mod products_tests {
    use super::*;
    use crate::api::products;

    async fn seed_room(pool: &PgPool) -> (Uuid, Uuid) {
        let job_id = Uuid::new_v4();
        let room_id = Uuid::new_v4();
        sqlx::query!(
            "INSERT INTO jobs (id, name, client_name, status, created_at, updated_at)
             VALUES ($1, 'J', 'C', 'draft', NOW(), NOW())",
            job_id
        )
        .execute(pool)
        .await
        .unwrap();
        sqlx::query!(
            "INSERT INTO rooms (id, job_id, name, created_at, updated_at)
             VALUES ($1, $2, 'R', NOW(), NOW())",
            room_id,
            job_id
        )
        .execute(pool)
        .await
        .unwrap();
        (job_id, room_id)
    }

    // 1. List products — empty
    #[actix_web::test]
    async fn test_list_products_empty() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let (_, room_id) = seed_room(&pool).await;

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(products::configure),
        )
        .await;

        let req = test::TestRequest::get()
            .uri(&format!("/rooms/{room_id}/products"))
            .to_request();
        let resp: Value = test::call_and_read_body_json(&app, req).await;
        assert!(resp.as_array().unwrap().is_empty());

        tx.rollback().await.unwrap();
    }

    // 2. List products — with data
    #[actix_web::test]
    async fn test_list_products_with_data() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let (_, room_id) = seed_room(&pool).await;

        sqlx::query!(
            r#"INSERT INTO products (id, room_id, name, product_type, created_at, updated_at)
               VALUES (gen_random_uuid(), $1, 'Cabinet A', 'base'::product_type, NOW(), NOW()),
                      (gen_random_uuid(), $1, 'Cabinet B', 'wall'::product_type, NOW(), NOW())"#,
            room_id
        )
        .execute(&mut *tx)
        .await
        .unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(products::configure),
        )
        .await;

        let req = test::TestRequest::get()
            .uri(&format!("/rooms/{room_id}/products"))
            .to_request();
        let resp: Value = test::call_and_read_body_json(&app, req).await;
        assert!(resp.as_array().unwrap().len() >= 2);

        tx.rollback().await.unwrap();
    }

    // 3. Get product — found
    #[actix_web::test]
    async fn test_get_product_found() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let (_, room_id) = seed_room(&pool).await;
        let product_id = Uuid::new_v4();

        sqlx::query!(
            r#"INSERT INTO products (id, room_id, name, product_type, created_at, updated_at)
               VALUES ($1, $2, 'Corner Base', 'base'::product_type, NOW(), NOW())"#,
            product_id,
            room_id
        )
        .execute(&mut *tx)
        .await
        .unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(products::configure),
        )
        .await;

        let req = test::TestRequest::get()
            .uri(&format!("/rooms/{room_id}/products/{product_id}"))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["name"].as_str().unwrap(), "Corner Base");

        tx.rollback().await.unwrap();
    }

    // 4. Get product — not found
    #[actix_web::test]
    async fn test_get_product_not_found() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(products::configure),
        )
        .await;

        let req = test::TestRequest::get()
            .uri(&format!("/rooms/{}/products/{}", Uuid::new_v4(), Uuid::new_v4()))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }

    // 5. Create product — success
    #[actix_web::test]
    async fn test_create_product_success() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let (_, room_id) = seed_room(&pool).await;

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(products::configure),
        )
        .await;

        let req = test::TestRequest::post()
            .uri(&format!("/rooms/{room_id}/products"))
            .set_json(json!({
                "name": "Upper Cabinet",
                "product_type": "wall",
                "width": 600.0,
                "height": 720.0,
                "depth": 320.0
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 201);

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["name"].as_str().unwrap(), "Upper Cabinet");

        tx.rollback().await.unwrap();
    }

    // 6. Create product — bad payload
    #[actix_web::test]
    async fn test_create_product_bad_payload() {
        let pool = test_pool().await;
        let room_id = Uuid::new_v4();
        let app = test::init_service(
            App::new()
                .app_data(
                    web::JsonConfig::default().error_handler(|err, _req| {
                        actix_web::error::InternalError::from_response(
                            err,
                            HttpResponse::BadRequest().finish(),
                        )
                        .into()
                    }),
                )
                .app_data(web::Data::new(pool))
                .configure(products::configure),
        )
        .await;

        let req = test::TestRequest::post()
            .uri(&format!("/rooms/{room_id}/products"))
            .set_json(json!({ "width": 600.0 })) // missing name + product_type
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_client_error());
    }

    // 7. Update product — success
    #[actix_web::test]
    async fn test_update_product_success() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let (_, room_id) = seed_room(&pool).await;
        let product_id = Uuid::new_v4();

        sqlx::query!(
            r#"INSERT INTO products (id, room_id, name, product_type, created_at, updated_at)
               VALUES ($1, $2, 'Old Cabinet', 'base'::product_type, NOW(), NOW())"#,
            product_id,
            room_id
        )
        .execute(&mut *tx)
        .await
        .unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(products::configure),
        )
        .await;

        let req = test::TestRequest::put()
            .uri(&format!("/rooms/{room_id}/products/{product_id}"))
            .set_json(json!({ "name": "Renamed Cabinet", "width": 900.0 }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["name"].as_str().unwrap(), "Renamed Cabinet");

        tx.rollback().await.unwrap();
    }

    // 8. Update product — not found
    #[actix_web::test]
    async fn test_update_product_not_found() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(products::configure),
        )
        .await;

        let req = test::TestRequest::put()
            .uri(&format!("/rooms/{}/products/{}", Uuid::new_v4(), Uuid::new_v4()))
            .set_json(json!({ "name": "Ghost" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }

    // 9. Delete product — success
    #[actix_web::test]
    async fn test_delete_product_success() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let (_, room_id) = seed_room(&pool).await;
        let product_id = Uuid::new_v4();

        sqlx::query!(
            r#"INSERT INTO products (id, room_id, name, product_type, created_at, updated_at)
               VALUES ($1, $2, 'Doomed Cabinet', 'base'::product_type, NOW(), NOW())"#,
            product_id,
            room_id
        )
        .execute(&mut *tx)
        .await
        .unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(products::configure),
        )
        .await;

        let req = test::TestRequest::delete()
            .uri(&format!("/rooms/{room_id}/products/{product_id}"))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 204);

        tx.rollback().await.unwrap();
    }

    // 10. Delete product — not found
    #[actix_web::test]
    async fn test_delete_product_not_found() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(products::configure),
        )
        .await;

        let req = test::TestRequest::delete()
            .uri(&format!("/rooms/{}/products/{}", Uuid::new_v4(), Uuid::new_v4()))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }
}

// ---------------------------------------------------------------------------
// ── parts ───────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

#[cfg(test)]
mod parts_tests {
    use super::*;
    use crate::api::parts;

    async fn seed_product(pool: &PgPool) -> Uuid {
        let job_id = Uuid::new_v4();
        let room_id = Uuid::new_v4();
        let product_id = Uuid::new_v4();
        sqlx::query!(
            "INSERT INTO jobs (id, name, client_name, status, created_at, updated_at)
             VALUES ($1, 'J', 'C', 'draft', NOW(), NOW())",
            job_id
        )
        .execute(pool).await.unwrap();
        sqlx::query!(
            "INSERT INTO rooms (id, job_id, name, created_at, updated_at)
             VALUES ($1, $2, 'R', NOW(), NOW())",
            room_id, job_id
        )
        .execute(pool).await.unwrap();
        sqlx::query!(
            r#"INSERT INTO products (id, room_id, name, product_type, created_at, updated_at)
               VALUES ($1, $2, 'P', 'base'::product_type, NOW(), NOW())"#,
            product_id, room_id
        )
        .execute(pool).await.unwrap();
        product_id
    }

    // 1. List parts — empty
    #[actix_web::test]
    async fn test_list_parts_empty() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let product_id = seed_product(&pool).await;

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(parts::configure),
        )
        .await;

        let req = test::TestRequest::get()
            .uri(&format!("/products/{product_id}/parts"))
            .to_request();
        let resp: Value = test::call_and_read_body_json(&app, req).await;
        assert!(resp.as_array().unwrap().is_empty());

        tx.rollback().await.unwrap();
    }

    // 2. List parts — with data
    #[actix_web::test]
    async fn test_list_parts_with_data() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let product_id = seed_product(&pool).await;

        sqlx::query!(
            "INSERT INTO parts (id, product_id, name, part_type, width_mm, height_mm, thickness_mm, quantity, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, 'Side Panel', 'panel', 720, 600, 18, 2, NOW(), NOW()),
                    (gen_random_uuid(), $1, 'Bottom',     'panel', 564, 564, 18, 1, NOW(), NOW())",
            product_id
        )
        .execute(&mut *tx)
        .await
        .unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(parts::configure),
        )
        .await;

        let req = test::TestRequest::get()
            .uri(&format!("/products/{product_id}/parts"))
            .to_request();
        let resp: Value = test::call_and_read_body_json(&app, req).await;
        assert!(resp.as_array().unwrap().len() >= 2);

        tx.rollback().await.unwrap();
    }

    // 3. Get part — found
    #[actix_web::test]
    async fn test_get_part_found() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let product_id = seed_product(&pool).await;
        let part_id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO parts (id, product_id, name, part_type, width_mm, height_mm, thickness_mm, quantity, created_at, updated_at)
             VALUES ($1, $2, 'Door', 'door', 596, 714, 18, 1, NOW(), NOW())",
            part_id, product_id
        )
        .execute(&mut *tx).await.unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(parts::configure),
        )
        .await;

        let req = test::TestRequest::get()
            .uri(&format!("/products/{product_id}/parts/{part_id}"))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["name"].as_str().unwrap(), "Door");

        tx.rollback().await.unwrap();
    }

    // 4. Get part — not found
    #[actix_web::test]
    async fn test_get_part_not_found() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(parts::configure),
        )
        .await;

        let req = test::TestRequest::get()
            .uri(&format!("/products/{}/parts/{}", Uuid::new_v4(), Uuid::new_v4()))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }

    // 5. Create part — success
    #[actix_web::test]
    async fn test_create_part_success() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let product_id = seed_product(&pool).await;

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(parts::configure),
        )
        .await;

        let req = test::TestRequest::post()
            .uri(&format!("/products/{product_id}/parts"))
            .set_json(json!({
                "name": "Back Panel",
                "part_type": "panel",
                "width_mm": 564,
                "height_mm": 720,
                "thickness_mm": 6,
                "quantity": 1
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 201);

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["name"].as_str().unwrap(), "Back Panel");

        tx.rollback().await.unwrap();
    }

    // 6. Create part — bad payload
    #[actix_web::test]
    async fn test_create_part_bad_payload() {
        let pool = test_pool().await;
        let product_id = Uuid::new_v4();
        let app = test::init_service(
            App::new()
                .app_data(
                    web::JsonConfig::default().error_handler(|err, _req| {
                        actix_web::error::InternalError::from_response(
                            err,
                            HttpResponse::BadRequest().finish(),
                        )
                        .into()
                    }),
                )
                .app_data(web::Data::new(pool))
                .configure(parts::configure),
        )
        .await;

        let req = test::TestRequest::post()
            .uri(&format!("/products/{product_id}/parts"))
            .set_json(json!({ "width_mm": 600 })) // missing many required fields
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_client_error());
    }

    // 7. Update part — success
    #[actix_web::test]
    async fn test_update_part_success() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let product_id = seed_product(&pool).await;
        let part_id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO parts (id, product_id, name, part_type, width_mm, height_mm, thickness_mm, quantity, created_at, updated_at)
             VALUES ($1, $2, 'Old Part', 'panel', 600, 720, 18, 1, NOW(), NOW())",
            part_id, product_id
        )
        .execute(&mut *tx).await.unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(parts::configure),
        )
        .await;

        let req = test::TestRequest::put()
            .uri(&format!("/products/{product_id}/parts/{part_id}"))
            .set_json(json!({ "name": "Updated Part", "quantity": 4 }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["name"].as_str().unwrap(), "Updated Part");
        assert_eq!(body["quantity"].as_i64().unwrap(), 4);

        tx.rollback().await.unwrap();
    }

    // 8. Update part — not found
    #[actix_web::test]
    async fn test_update_part_not_found() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(parts::configure),
        )
        .await;

        let req = test::TestRequest::put()
            .uri(&format!("/products/{}/parts/{}", Uuid::new_v4(), Uuid::new_v4()))
            .set_json(json!({ "name": "Ghost" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }

    // 9. Delete part — success
    #[actix_web::test]
    async fn test_delete_part_success() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let product_id = seed_product(&pool).await;
        let part_id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO parts (id, product_id, name, part_type, width_mm, height_mm, thickness_mm, quantity, created_at, updated_at)
             VALUES ($1, $2, 'Doomed Part', 'panel', 600, 720, 18, 1, NOW(), NOW())",
            part_id, product_id
        )
        .execute(&mut *tx).await.unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(parts::configure),
        )
        .await;

        let req = test::TestRequest::delete()
            .uri(&format!("/products/{product_id}/parts/{part_id}"))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 204);

        tx.rollback().await.unwrap();
    }

    // 10. Delete part — not found
    #[actix_web::test]
    async fn test_delete_part_not_found() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(parts::configure),
        )
        .await;

        let req = test::TestRequest::delete()
            .uri(&format!("/products/{}/parts/{}", Uuid::new_v4(), Uuid::new_v4()))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }
}

// ---------------------------------------------------------------------------
// ── operations ──────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

#[cfg(test)]
mod operations_tests {
    use super::*;
    use crate::api::operations;

    async fn seed_part(pool: &PgPool) -> Uuid {
        let job_id = Uuid::new_v4();
        let room_id = Uuid::new_v4();
        let product_id = Uuid::new_v4();
        let part_id = Uuid::new_v4();
        sqlx::query!(
            "INSERT INTO jobs (id, name, client_name, status, created_at, updated_at)
             VALUES ($1, 'J', 'C', 'draft', NOW(), NOW())",
            job_id
        ).execute(pool).await.unwrap();
        sqlx::query!(
            "INSERT INTO rooms (id, job_id, name, created_at, updated_at)
             VALUES ($1, $2, 'R', NOW(), NOW())",
            room_id, job_id
        ).execute(pool).await.unwrap();
        sqlx::query!(
            r#"INSERT INTO products (id, room_id, name, product_type, created_at, updated_at)
               VALUES ($1, $2, 'P', 'base'::product_type, NOW(), NOW())"#,
            product_id, room_id
        ).execute(pool).await.unwrap();
        sqlx::query!(
            "INSERT INTO parts (id, product_id, name, part_type, width_mm, height_mm, thickness_mm, quantity, created_at, updated_at)
             VALUES ($1, $2, 'Pt', 'panel', 600, 720, 18, 1, NOW(), NOW())",
            part_id, product_id
        ).execute(pool).await.unwrap();
        part_id
    }

    // 1. List operations — empty
    #[actix_web::test]
    async fn test_list_operations_empty() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let part_id = seed_part(&pool).await;

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(operations::configure),
        ).await;

        let req = test::TestRequest::get()
            .uri(&format!("/parts/{part_id}/operations"))
            .to_request();
        let resp: Value = test::call_and_read_body_json(&app, req).await;
        assert!(resp.as_array().unwrap().is_empty());

        tx.rollback().await.unwrap();
    }

    // 2. List operations — with data
    #[actix_web::test]
    async fn test_list_operations_with_data() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let part_id = seed_part(&pool).await;

        sqlx::query!(
            "INSERT INTO operations (id, part_id, operation_type, sequence_order, status, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, 'drill', 1, 'pending', NOW(), NOW()),
                    (gen_random_uuid(), $1, 'cut',   2, 'pending', NOW(), NOW())",
            part_id
        ).execute(&mut *tx).await.unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(operations::configure),
        ).await;

        let req = test::TestRequest::get()
            .uri(&format!("/parts/{part_id}/operations"))
            .to_request();
        let resp: Value = test::call_and_read_body_json(&app, req).await;
        assert!(resp.as_array().unwrap().len() >= 2);

        tx.rollback().await.unwrap();
    }

    // 3. Get operation — found
    #[actix_web::test]
    async fn test_get_operation_found() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let part_id = seed_part(&pool).await;
        let op_id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO operations (id, part_id, operation_type, sequence_order, status, created_at, updated_at)
             VALUES ($1, $2, 'bore', 1, 'pending', NOW(), NOW())",
            op_id, part_id
        ).execute(&mut *tx).await.unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(operations::configure),
        ).await;

        let req = test::TestRequest::get()
            .uri(&format!("/parts/{part_id}/operations/{op_id}"))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["operation_type"].as_str().unwrap(), "bore");

        tx.rollback().await.unwrap();
    }

    // 4. Get operation — not found
    #[actix_web::test]
    async fn test_get_operation_not_found() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(operations::configure),
        ).await;

        let req = test::TestRequest::get()
            .uri(&format!("/parts/{}/operations/{}", Uuid::new_v4(), Uuid::new_v4()))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }

    // 5. Create operation — success
    #[actix_web::test]
    async fn test_create_operation_success() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let part_id = seed_part(&pool).await;

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(operations::configure),
        ).await;

        let req = test::TestRequest::post()
            .uri(&format!("/parts/{part_id}/operations"))
            .set_json(json!({
                "operation_type": "drill",
                "sequence_order": 1,
                "feed_rate_mm_min": 3000.0,
                "spindle_speed_rpm": 18000,
                "depth_mm": 12.0
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 201);

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["status"].as_str().unwrap(), "pending"); // default
        assert_eq!(body["operation_type"].as_str().unwrap(), "drill");

        tx.rollback().await.unwrap();
    }

    // 6. Create operation — bad payload
    #[actix_web::test]
    async fn test_create_operation_bad_payload() {
        let pool = test_pool().await;
        let part_id = Uuid::new_v4();
        let app = test::init_service(
            App::new()
                .app_data(
                    web::JsonConfig::default().error_handler(|err, _req| {
                        actix_web::error::InternalError::from_response(
                            err,
                            HttpResponse::BadRequest().finish(),
                        )
                        .into()
                    }),
                )
                .app_data(web::Data::new(pool))
                .configure(operations::configure),
        ).await;

        let req = test::TestRequest::post()
            .uri(&format!("/parts/{part_id}/operations"))
            .set_json(json!({})) // empty body
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_client_error());
    }

    // 7. Update operation — success
    #[actix_web::test]
    async fn test_update_operation_success() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let part_id = seed_part(&pool).await;
        let op_id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO operations (id, part_id, operation_type, sequence_order, status, created_at, updated_at)
             VALUES ($1, $2, 'cut', 1, 'pending', NOW(), NOW())",
            op_id, part_id
        ).execute(&mut *tx).await.unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(operations::configure),
        ).await;

        let req = test::TestRequest::put()
            .uri(&format!("/parts/{part_id}/operations/{op_id}"))
            .set_json(json!({ "status": "complete", "feed_rate_mm_min": 5000.0 }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["status"].as_str().unwrap(), "complete");

        tx.rollback().await.unwrap();
    }

    // 8. Update operation — not found
    #[actix_web::test]
    async fn test_update_operation_not_found() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(operations::configure),
        ).await;

        let req = test::TestRequest::put()
            .uri(&format!("/parts/{}/operations/{}", Uuid::new_v4(), Uuid::new_v4()))
            .set_json(json!({ "status": "complete" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }

    // 9. Delete operation — success
    #[actix_web::test]
    async fn test_delete_operation_success() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let part_id = seed_part(&pool).await;
        let op_id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO operations (id, part_id, operation_type, sequence_order, status, created_at, updated_at)
             VALUES ($1, $2, 'groove', 1, 'pending', NOW(), NOW())",
            op_id, part_id
        ).execute(&mut *tx).await.unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(operations::configure),
        ).await;

        let req = test::TestRequest::delete()
            .uri(&format!("/parts/{part_id}/operations/{op_id}"))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 204);

        tx.rollback().await.unwrap();
    }

    // 10. Delete operation — not found
    #[actix_web::test]
    async fn test_delete_operation_not_found() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(operations::configure),
        ).await;

        let req = test::TestRequest::delete()
            .uri(&format!("/parts/{}/operations/{}", Uuid::new_v4(), Uuid::new_v4()))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }
}

// ---------------------------------------------------------------------------
// ── materials ───────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

#[cfg(test)]
mod materials_tests {
    use super::*;
    use crate::api::materials;

    // 1. List materials — empty
    #[actix_web::test]
    async fn test_list_materials_empty() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        sqlx::query!("DELETE FROM materials").execute(&mut *tx).await.unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(materials::configure),
        ).await;

        let req = test::TestRequest::get().uri("/materials").to_request();
        let resp: Value = test::call_and_read_body_json(&app, req).await;
        assert!(resp.as_array().unwrap().is_empty());

        tx.rollback().await.unwrap();
    }

    // 2. List materials — with data
    #[actix_web::test]
    async fn test_list_materials_with_data() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;

        sqlx::query!(
            "INSERT INTO materials (id, name, sku, material_type, thickness_mm, created_at, updated_at)
             VALUES (gen_random_uuid(), 'MDF 18mm', 'MDF18', 'sheet', 18, NOW(), NOW()),
                    (gen_random_uuid(), 'Ply 12mm', 'PLY12', 'sheet', 12, NOW(), NOW())"
        ).execute(&mut *tx).await.unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(materials::configure),
        ).await;

        let req = test::TestRequest::get().uri("/materials").to_request();
        let resp: Value = test::call_and_read_body_json(&app, req).await;
        assert!(resp.as_array().unwrap().len() >= 2);

        tx.rollback().await.unwrap();
    }

    // 3. Get material — found
    #[actix_web::test]
    async fn test_get_material_found() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO materials (id, name, sku, material_type, thickness_mm, created_at, updated_at)
             VALUES ($1, 'Oak Veneer', 'OAK-V', 'veneer', 1, NOW(), NOW())",
            id
        ).execute(&mut *tx).await.unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(materials::configure),
        ).await;

        let req = test::TestRequest::get()
            .uri(&format!("/materials/{id}"))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["name"].as_str().unwrap(), "Oak Veneer");

        tx.rollback().await.unwrap();
    }

    // 4. Get material — not found
    #[actix_web::test]
    async fn test_get_material_not_found() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(materials::configure),
        ).await;

        let req = test::TestRequest::get()
            .uri(&format!("/materials/{}", Uuid::new_v4()))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }

    // 5. Create material — success
    #[actix_web::test]
    async fn test_create_material_success() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(materials::configure),
        ).await;

        let req = test::TestRequest::post()
            .uri("/materials")
            .set_json(json!({
                "name": "Melamine White",
                "sku": "MEL-W-18",
                "material_type": "sheet",
                "thickness_mm": 18.0
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 201);

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["name"].as_str().unwrap(), "Melamine White");

        tx.rollback().await.unwrap();
    }

    // 6. Create material — missing required fields
    #[actix_web::test]
    async fn test_create_material_bad_payload() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(
                    web::JsonConfig::default().error_handler(|err, _req| {
                        actix_web::error::InternalError::from_response(
                            err,
                            HttpResponse::BadRequest().finish(),
                        )
                        .into()
                    }),
                )
                .app_data(web::Data::new(pool))
                .configure(materials::configure),
        ).await;

        let req = test::TestRequest::post()
            .uri("/materials")
            .set_json(json!({ "sku": "X" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_client_error());
    }

    // 7. Update material — success
    #[actix_web::test]
    async fn test_update_material_success() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO materials (id, name, sku, material_type, thickness_mm, created_at, updated_at)
             VALUES ($1, 'Old Material', 'OLD', 'sheet', 18, NOW(), NOW())",
            id
        ).execute(&mut *tx).await.unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(materials::configure),
        ).await;

        let req = test::TestRequest::put()
            .uri(&format!("/materials/{id}"))
            .set_json(json!({ "name": "New Material", "cost_per_sheet": 45.50 }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["name"].as_str().unwrap(), "New Material");

        tx.rollback().await.unwrap();
    }

    // 8. Update material — not found
    #[actix_web::test]
    async fn test_update_material_not_found() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(materials::configure),
        ).await;

        let req = test::TestRequest::put()
            .uri(&format!("/materials/{}", Uuid::new_v4()))
            .set_json(json!({ "name": "Ghost" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }

    // 9. Delete material — success
    #[actix_web::test]
    async fn test_delete_material_success() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO materials (id, name, sku, material_type, thickness_mm, created_at, updated_at)
             VALUES ($1, 'Doomed Material', 'DOOM', 'sheet', 18, NOW(), NOW())",
            id
        ).execute(&mut *tx).await.unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(materials::configure),
        ).await;

        let req = test::TestRequest::delete()
            .uri(&format!("/materials/{id}"))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 204);

        tx.rollback().await.unwrap();
    }

    // 10. Delete material — not found
    #[actix_web::test]
    async fn test_delete_material_not_found() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(materials::configure),
        ).await;

        let req = test::TestRequest::delete()
            .uri(&format!("/materials/{}", Uuid::new_v4()))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }
}

// ---------------------------------------------------------------------------
// ── hardware ────────────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

#[cfg(test)]
mod hardware_tests {
    use super::*;
    use crate::api::hardware;

    // 1. List hardware — empty
    #[actix_web::test]
    async fn test_list_hardware_empty() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        sqlx::query!("DELETE FROM hardware").execute(&mut *tx).await.unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(hardware::configure),
        ).await;

        let req = test::TestRequest::get().uri("/hardware").to_request();
        let resp: Value = test::call_and_read_body_json(&app, req).await;
        assert!(resp.as_array().unwrap().is_empty());

        tx.rollback().await.unwrap();
    }

    // 2. List hardware — with data
    #[actix_web::test]
    async fn test_list_hardware_with_data() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;

        sqlx::query!(
            "INSERT INTO hardware (id, name, sku, hardware_type, created_at, updated_at)
             VALUES (gen_random_uuid(), 'Hinge Blum', 'HNG-B', 'hinge', NOW(), NOW()),
                    (gen_random_uuid(), 'Drawer Runner', 'DR-500', 'runner', NOW(), NOW())"
        ).execute(&mut *tx).await.unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(hardware::configure),
        ).await;

        let req = test::TestRequest::get().uri("/hardware").to_request();
        let resp: Value = test::call_and_read_body_json(&app, req).await;
        assert!(resp.as_array().unwrap().len() >= 2);

        tx.rollback().await.unwrap();
    }

    // 3. Get hardware — found
    #[actix_web::test]
    async fn test_get_hardware_found() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO hardware (id, name, sku, hardware_type, created_at, updated_at)
             VALUES ($1, 'Soft-close Hinge', 'SCH-100', 'hinge', NOW(), NOW())",
            id
        ).execute(&mut *tx).await.unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(hardware::configure),
        ).await;

        let req = test::TestRequest::get()
            .uri(&format!("/hardware/{id}"))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["name"].as_str().unwrap(), "Soft-close Hinge");

        tx.rollback().await.unwrap();
    }

    // 4. Get hardware — not found
    #[actix_web::test]
    async fn test_get_hardware_not_found() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(hardware::configure),
        ).await;

        let req = test::TestRequest::get()
            .uri(&format!("/hardware/{}", Uuid::new_v4()))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }

    // 5. Create hardware — success
    #[actix_web::test]
    async fn test_create_hardware_success() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(hardware::configure),
        ).await;

        let req = test::TestRequest::post()
            .uri("/hardware")
            .set_json(json!({
                "name": "Euro Screw 5x50",
                "sku": "ESC-550",
                "hardware_type": "fastener",
                "unit_cost": 0.15
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 201);

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["name"].as_str().unwrap(), "Euro Screw 5x50");

        tx.rollback().await.unwrap();
    }

    // 6. Create hardware — missing required fields
    #[actix_web::test]
    async fn test_create_hardware_bad_payload() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(
                    web::JsonConfig::default().error_handler(|err, _req| {
                        actix_web::error::InternalError::from_response(
                            err,
                            HttpResponse::BadRequest().finish(),
                        )
                        .into()
                    }),
                )
                .app_data(web::Data::new(pool))
                .configure(hardware::configure),
        ).await;

        let req = test::TestRequest::post()
            .uri("/hardware")
            .set_json(json!({ "sku": "X" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert!(resp.status().is_client_error());
    }

    // 7. Update hardware — success
    #[actix_web::test]
    async fn test_update_hardware_success() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO hardware (id, name, sku, hardware_type, created_at, updated_at)
             VALUES ($1, 'Old Hinge', 'OHG', 'hinge', NOW(), NOW())",
            id
        ).execute(&mut *tx).await.unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(hardware::configure),
        ).await;

        let req = test::TestRequest::put()
            .uri(&format!("/hardware/{id}"))
            .set_json(json!({ "name": "New Hinge", "unit_cost": 3.50 }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["name"].as_str().unwrap(), "New Hinge");

        tx.rollback().await.unwrap();
    }

    // 8. Update hardware — not found
    #[actix_web::test]
    async fn test_update_hardware_not_found() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(hardware::configure),
        ).await;

        let req = test::TestRequest::put()
            .uri(&format!("/hardware/{}", Uuid::new_v4()))
            .set_json(json!({ "name": "Ghost" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }

    // 9. Delete hardware — success
    #[actix_web::test]
    async fn test_delete_hardware_success() {
        let pool = test_pool().await;
        let mut tx = begin_tx(&pool).await;
        let id = Uuid::new_v4();

        sqlx::query!(
            "INSERT INTO hardware (id, name, sku, hardware_type, created_at, updated_at)
             VALUES ($1, 'Doomed Hinge', 'DOOM', 'hinge', NOW(), NOW())",
            id
        ).execute(&mut *tx).await.unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(hardware::configure),
        ).await;

        let req = test::TestRequest::delete()
            .uri(&format!("/hardware/{id}"))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 204);

        tx.rollback().await.unwrap();
    }

    // 10. Delete hardware — not found
    #[actix_web::test]
    async fn test_delete_hardware_not_found() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(hardware::configure),
        ).await;

        let req = test::TestRequest::delete()
            .uri(&format!("/hardware/{}", Uuid::new_v4()))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }
}
