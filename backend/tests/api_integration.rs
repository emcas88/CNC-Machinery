//! Integration tests for all 22 CNC Cabinet Manufacturing API route modules.
//!
//! These tests use actix-web's built-in test utilities to exercise every
//! endpoint in every module.  All handlers are stubs that never actually
//! query the database, so we supply a lazy PgPool that never opens a real
//! connection.
//!
//! Run with:
//!   cargo test --test api_integration
//!
//! Every test follows the same pattern:
//!   1. Build a test `App` with the full `/api` scope via `configure_routes`.
//!   2. Fire an `actix_web::test::TestRequest` at the target URI.
//!   3. Assert the expected HTTP status.
//!   4. For JSON responses, assert `body["status"] == "ok"`.

use actix_web::{test, web, App};
use serde_json::Value;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use uuid::Uuid;

// ─── helpers ─────────────────────────────────────────────────────────────────

/// Create a lazy PgPool that never opens a real TCP connection.
/// The handlers never call the pool, so this is safe for stub testing.
fn create_test_pool() -> PgPool {
    PgPoolOptions::new()
        .max_connections(1)
        .connect_lazy("postgres://fake:fake@localhost:5432/fake")
        .expect("connect_lazy should never fail")
}

/// Build and initialise a full test service with all API routes mounted.
macro_rules! make_app {
    ($pool:expr) => {
        test::init_service(
            App::new()
                .app_data(web::Data::new($pool))
                .service(
                    web::scope("/api")
                        .configure(cnc_backend::api::configure_routes),
                ),
        )
        .await
    };
}

// ─── health ──────────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_health_check() {
    use actix_web::{get, HttpResponse, Responder};

    #[get("/api/health")]
    async fn health() -> impl Responder {
        HttpResponse::Ok().json(serde_json::json!({
            "status": "ok",
            "service": "cnc-backend",
            "version": "0.1.0"
        }))
    }

    let app = test::init_service(App::new().service(health)).await;
    let req = test::TestRequest::get().uri("/api/health").to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/health should return 200");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

// ─── 1. jobs ─────────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_jobs() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::get().uri("/api/jobs").to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/jobs");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_job() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/jobs/{}", id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/jobs/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_create_job() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/jobs")
        .set_json(serde_json::json!({"name": "Test Kitchen"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST /api/jobs");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_update_job() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/jobs/{}", id);
    let req = test::TestRequest::put()
        .uri(&uri)
        .set_json(serde_json::json!({"name": "Updated Kitchen"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "PUT /api/jobs/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_delete_job() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/jobs/{}", id);
    let req = test::TestRequest::delete().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "DELETE /api/jobs/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_job_dashboard() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/jobs/{}/dashboard", id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/jobs/{id}/dashboard");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_duplicate_job() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/jobs/{}/duplicate", id);
    let req = test::TestRequest::post().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST /api/jobs/{id}/duplicate");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_job_recovery() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/jobs/{}/recovery", id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/jobs/{id}/recovery");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_job_invalid_uuid() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::get()
        .uri("/api/jobs/not-a-uuid")
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 400, "GET /api/jobs/not-a-uuid should be 400");
}

// ─── 2. rooms ────────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_rooms() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let job_id = Uuid::new_v4();
    let uri = format!("/api/jobs/{}/rooms", job_id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/jobs/{job_id}/rooms");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_room() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let job_id = Uuid::new_v4();
    let room_id = Uuid::new_v4();
    let uri = format!("/api/jobs/{}/rooms/{}", job_id, room_id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/jobs/{job_id}/rooms/{room_id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_create_room() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let job_id = Uuid::new_v4();
    let uri = format!("/api/jobs/{}/rooms", job_id);
    let req = test::TestRequest::post()
        .uri(&uri)
        .set_json(serde_json::json!({"name": "Kitchen", "width": 3600, "height": 2400}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST /api/jobs/{job_id}/rooms");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_update_room() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let job_id = Uuid::new_v4();
    let room_id = Uuid::new_v4();
    let uri = format!("/api/jobs/{}/rooms/{}", job_id, room_id);
    let req = test::TestRequest::put()
        .uri(&uri)
        .set_json(serde_json::json!({"name": "Laundry"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "PUT /api/jobs/{job_id}/rooms/{room_id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_delete_room() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let job_id = Uuid::new_v4();
    let room_id = Uuid::new_v4();
    let uri = format!("/api/jobs/{}/rooms/{}", job_id, room_id);
    let req = test::TestRequest::delete().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "DELETE /api/jobs/{job_id}/rooms/{room_id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_room_elevation() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let job_id = Uuid::new_v4();
    let room_id = Uuid::new_v4();
    let uri = format!("/api/jobs/{}/rooms/{}/elevation", job_id, room_id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET .../rooms/{room_id}/elevation");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_room_floorplan() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let job_id = Uuid::new_v4();
    let room_id = Uuid::new_v4();
    let uri = format!("/api/jobs/{}/rooms/{}/floorplan", job_id, room_id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET .../rooms/{room_id}/floorplan");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

// ─── 3. products ─────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_products() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let room_id = Uuid::new_v4();
    let uri = format!("/api/rooms/{}/products", room_id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/rooms/{room_id}/products");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_product() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let room_id = Uuid::new_v4();
    let product_id = Uuid::new_v4();
    let uri = format!("/api/rooms/{}/products/{}", room_id, product_id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/rooms/{room_id}/products/{product_id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_create_product() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let room_id = Uuid::new_v4();
    let uri = format!("/api/rooms/{}/products", room_id);
    let req = test::TestRequest::post()
        .uri(&uri)
        .set_json(serde_json::json!({"type": "base_cabinet", "width": 600}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST /api/rooms/{room_id}/products");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_update_product() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let room_id = Uuid::new_v4();
    let product_id = Uuid::new_v4();
    let uri = format!("/api/rooms/{}/products/{}", room_id, product_id);
    let req = test::TestRequest::put()
        .uri(&uri)
        .set_json(serde_json::json!({"width": 900}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "PUT .../products/{product_id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_delete_product() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let room_id = Uuid::new_v4();
    let product_id = Uuid::new_v4();
    let uri = format!("/api/rooms/{}/products/{}", room_id, product_id);
    let req = test::TestRequest::delete().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "DELETE .../products/{product_id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_product_conform_to_shape() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let room_id = Uuid::new_v4();
    let product_id = Uuid::new_v4();
    let uri = format!("/api/rooms/{}/products/{}/conform-to-shape", room_id, product_id);
    let req = test::TestRequest::post()
        .uri(&uri)
        .set_json(serde_json::json!({"shape": "polygon"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST .../conform-to-shape");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_product_save_to_library() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let room_id = Uuid::new_v4();
    let product_id = Uuid::new_v4();
    let uri = format!("/api/rooms/{}/products/{}/save-to-library", room_id, product_id);
    let req = test::TestRequest::post()
        .uri(&uri)
        .set_json(serde_json::json!({"library_name": "My Cabinet"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST .../save-to-library");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

// ─── 4. parts ────────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_parts() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let product_id = Uuid::new_v4();
    let uri = format!("/api/products/{}/parts", product_id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/products/{product_id}/parts");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_part() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let product_id = Uuid::new_v4();
    let part_id = Uuid::new_v4();
    let uri = format!("/api/products/{}/parts/{}", product_id, part_id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET .../parts/{part_id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_create_part() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let product_id = Uuid::new_v4();
    let uri = format!("/api/products/{}/parts", product_id);
    let req = test::TestRequest::post()
        .uri(&uri)
        .set_json(serde_json::json!({"name": "Left Side", "width": 560, "height": 720}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST .../parts");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_update_part() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let product_id = Uuid::new_v4();
    let part_id = Uuid::new_v4();
    let uri = format!("/api/products/{}/parts/{}", product_id, part_id);
    let req = test::TestRequest::put()
        .uri(&uri)
        .set_json(serde_json::json!({"width": 580}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "PUT .../parts/{part_id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_delete_part() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let product_id = Uuid::new_v4();
    let part_id = Uuid::new_v4();
    let uri = format!("/api/products/{}/parts/{}", product_id, part_id);
    let req = test::TestRequest::delete().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "DELETE .../parts/{part_id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_part_editor() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let product_id = Uuid::new_v4();
    let part_id = Uuid::new_v4();
    let uri = format!("/api/products/{}/parts/{}/editor", product_id, part_id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET .../parts/{part_id}/editor");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_recalculate_part() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let product_id = Uuid::new_v4();
    let part_id = Uuid::new_v4();
    let uri = format!("/api/products/{}/parts/{}/recalculate", product_id, part_id);
    let req = test::TestRequest::post().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST .../parts/{part_id}/recalculate");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

// ─── 5. operations ───────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_operations() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let part_id = Uuid::new_v4();
    let uri = format!("/api/parts/{}/operations", part_id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/parts/{part_id}/operations");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_operation() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let part_id = Uuid::new_v4();
    let op_id = Uuid::new_v4();
    let uri = format!("/api/parts/{}/operations/{}", part_id, op_id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET .../operations/{op_id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_create_operation() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let part_id = Uuid::new_v4();
    let uri = format!("/api/parts/{}/operations", part_id);
    let req = test::TestRequest::post()
        .uri(&uri)
        .set_json(serde_json::json!({"type": "drill", "x": 32, "y": 32, "diameter": 5}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST .../operations");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_update_operation() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let part_id = Uuid::new_v4();
    let op_id = Uuid::new_v4();
    let uri = format!("/api/parts/{}/operations/{}", part_id, op_id);
    let req = test::TestRequest::put()
        .uri(&uri)
        .set_json(serde_json::json!({"depth": 15}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "PUT .../operations/{op_id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_delete_operation() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let part_id = Uuid::new_v4();
    let op_id = Uuid::new_v4();
    let uri = format!("/api/parts/{}/operations/{}", part_id, op_id);
    let req = test::TestRequest::delete().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "DELETE .../operations/{op_id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

// ─── 6. materials ────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_materials() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::get().uri("/api/materials").to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/materials");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_material() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/materials/{}", id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/materials/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_create_material() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/materials")
        .set_json(serde_json::json!({"name": "18mm MDF", "thickness": 18}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST /api/materials");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_update_material() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/materials/{}", id);
    let req = test::TestRequest::put()
        .uri(&uri)
        .set_json(serde_json::json!({"name": "16mm MDF"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "PUT /api/materials/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_delete_material() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/materials/{}", id);
    let req = test::TestRequest::delete().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "DELETE /api/materials/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_list_material_templates() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::get()
        .uri("/api/materials/templates")
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/materials/templates");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_resolve_material() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/materials/resolve")
        .set_json(serde_json::json!({"part_id": Uuid::new_v4().to_string()}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST /api/materials/resolve");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

// ─── 7. textures ─────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_textures() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::get().uri("/api/textures").to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/textures");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_texture() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/textures/{}", id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/textures/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_create_texture() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/textures")
        .set_json(serde_json::json!({"name": "Oak Grain", "url": "https://cdn/oak.png"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST /api/textures");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_update_texture() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/textures/{}", id);
    let req = test::TestRequest::put()
        .uri(&uri)
        .set_json(serde_json::json!({"name": "Dark Oak"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "PUT /api/textures/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_delete_texture() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/textures/{}", id);
    let req = test::TestRequest::delete().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "DELETE /api/textures/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_list_texture_groups() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::get()
        .uri("/api/texture-groups")
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/texture-groups");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_texture_group() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/texture-groups/{}", id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/texture-groups/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_create_texture_group() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/texture-groups")
        .set_json(serde_json::json!({"name": "Wood Veneers"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST /api/texture-groups");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_update_texture_group() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/texture-groups/{}", id);
    let req = test::TestRequest::put()
        .uri(&uri)
        .set_json(serde_json::json!({"name": "Laminates"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "PUT /api/texture-groups/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_delete_texture_group() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/texture-groups/{}", id);
    let req = test::TestRequest::delete().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "DELETE /api/texture-groups/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

// ─── 8. hardware ─────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_hardware() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::get().uri("/api/hardware").to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/hardware");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_hardware() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/hardware/{}", id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/hardware/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_create_hardware() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/hardware")
        .set_json(serde_json::json!({"name": "Blum Clip Top Hinge", "brand": "Blum"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST /api/hardware");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_update_hardware() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/hardware/{}", id);
    let req = test::TestRequest::put()
        .uri(&uri)
        .set_json(serde_json::json!({"opening_angle": 110}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "PUT /api/hardware/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_delete_hardware() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/hardware/{}", id);
    let req = test::TestRequest::delete().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "DELETE /api/hardware/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_hardware_by_brand() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::get()
        .uri("/api/hardware/by-brand/Blum")
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/hardware/by-brand/{brand}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_generate_drilling_pattern() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/hardware/{}/generate-drilling-pattern", id);
    let req = test::TestRequest::post()
        .uri(&uri)
        .set_json(serde_json::json!({"panel_thickness": 18}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST .../generate-drilling-pattern");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

// ─── 9. construction_methods ─────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_construction_methods() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::get()
        .uri("/api/construction-methods")
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/construction-methods");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_construction_method() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/construction-methods/{}", id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/construction-methods/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_create_construction_method() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/construction-methods")
        .set_json(serde_json::json!({"name": "Dowel Joinery"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST /api/construction-methods");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_update_construction_method() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/construction-methods/{}", id);
    let req = test::TestRequest::put()
        .uri(&uri)
        .set_json(serde_json::json!({"name": "Pocket Screw"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "PUT /api/construction-methods/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_delete_construction_method() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/construction-methods/{}", id);
    let req = test::TestRequest::delete().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "DELETE /api/construction-methods/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_apply_construction_method_to_product() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/construction-methods/{}/apply-to-product", id);
    let req = test::TestRequest::post()
        .uri(&uri)
        .set_json(serde_json::json!({"product_id": Uuid::new_v4().to_string()}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST .../apply-to-product");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

// ─── 10. machines ────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_machines() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::get().uri("/api/machines").to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/machines");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_machine() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/machines/{}", id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/machines/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_create_machine() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/machines")
        .set_json(serde_json::json!({"name": "Homag BOF 211", "type": "cnc_router"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST /api/machines");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_update_machine() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/machines/{}", id);
    let req = test::TestRequest::put()
        .uri(&uri)
        .set_json(serde_json::json!({"name": "Biesse Rover B"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "PUT /api/machines/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_delete_machine() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/machines/{}", id);
    let req = test::TestRequest::delete().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "DELETE /api/machines/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_update_tool_magazine() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/machines/{}/tool-magazine", id);
    let req = test::TestRequest::put()
        .uri(&uri)
        .set_json(serde_json::json!({"slots": []}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "PUT /api/machines/{id}/tool-magazine");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_list_atc_tool_sets() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/machines/{}/atc-tool-sets", id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/machines/{id}/atc-tool-sets");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_create_atc_tool_set() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/machines/{}/atc-tool-sets", id);
    let req = test::TestRequest::post()
        .uri(&uri)
        .set_json(serde_json::json!({"name": "Door Set", "tools": []}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST /api/machines/{id}/atc-tool-sets");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

// ─── 11. tools ───────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_tools() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::get().uri("/api/tools").to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/tools");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_tool() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/tools/{}", id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/tools/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_create_tool() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/tools")
        .set_json(serde_json::json!({"name": "8mm Spiral Upcut", "diameter": 8}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST /api/tools");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_update_tool() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/tools/{}", id);
    let req = test::TestRequest::put()
        .uri(&uri)
        .set_json(serde_json::json!({"feed_rate": 6000}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "PUT /api/tools/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_delete_tool() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/tools/{}", id);
    let req = test::TestRequest::delete().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "DELETE /api/tools/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

// ─── 12. post_processors ─────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_post_processors() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::get()
        .uri("/api/post-processors")
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/post-processors");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_post_processor() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/post-processors/{}", id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/post-processors/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_create_post_processor() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/post-processors")
        .set_json(serde_json::json!({"name": "Fanuc G-code", "template": ""}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST /api/post-processors");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_update_post_processor() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/post-processors/{}", id);
    let req = test::TestRequest::put()
        .uri(&uri)
        .set_json(serde_json::json!({"name": "Siemens 840D"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "PUT /api/post-processors/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_delete_post_processor() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/post-processors/{}", id);
    let req = test::TestRequest::delete().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "DELETE /api/post-processors/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_validate_post_processor() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/post-processors/{}/validate", id);
    let req = test::TestRequest::post().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST .../validate");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_generate_gcode_sample_from_post_processor() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/post-processors/{}/generate-gcode", id);
    let req = test::TestRequest::post()
        .uri(&uri)
        .set_json(serde_json::json!({"test_part_id": Uuid::new_v4().to_string()}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST .../generate-gcode");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

// ─── 13. optimizer ───────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_run_optimization() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/optimizer/run")
        .set_json(serde_json::json!({"job_id": Uuid::new_v4().to_string()}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 202, "POST /api/optimizer/run");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_optimization_run() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/optimizer/runs/{}", id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/optimizer/runs/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_adjust_optimization_run() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/optimizer/runs/{}/adjust", id);
    let req = test::TestRequest::post()
        .uri(&uri)
        .set_json(serde_json::json!({"adjustments": []}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST /api/optimizer/runs/{id}/adjust");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_optimization_sheets() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/optimizer/runs/{}/sheets", id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/optimizer/runs/{id}/sheets");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_duplicate_optimization_run() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/optimizer/runs/{}/duplicate", id);
    let req = test::TestRequest::post().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST /api/optimizer/runs/{id}/duplicate");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_list_remnants() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::get()
        .uri("/api/optimizer/remnants")
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/optimizer/remnants");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_create_remnant() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/optimizer/remnants")
        .set_json(serde_json::json!({"width": 800, "height": 1200, "material_id": Uuid::new_v4().to_string()}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST /api/optimizer/remnants");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_delete_remnant() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/optimizer/remnants/{}", id);
    let req = test::TestRequest::delete().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "DELETE /api/optimizer/remnants/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

// ─── 14. gcode ───────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_generate_gcode() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/gcode/generate")
        .set_json(serde_json::json!({"run_id": Uuid::new_v4().to_string(), "sheet_ids": []}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST /api/gcode/generate");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_simulate_gcode() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/gcode/simulate")
        .set_json(serde_json::json!({"gcode": "G0 X0 Y0\nG1 X100\n"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST /api/gcode/simulate");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_safety_check_gcode() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/gcode/safety-check")
        .set_json(serde_json::json!({"gcode": "G0 X0 Y0\n"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST /api/gcode/safety-check");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_spoilboard_resurface() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/gcode/spoilboard-resurface")
        .set_json(serde_json::json!({"machine_id": Uuid::new_v4().to_string(), "depth": 0.5}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST /api/gcode/spoilboard-resurface");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_export_gcode() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let sheet_id = Uuid::new_v4();
    let uri = format!("/api/gcode/export/{}", sheet_id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/gcode/export/{sheet_id}");
    let body = test::read_body(resp).await;
    let text = std::str::from_utf8(&body).expect("body is utf-8");
    assert!(text.contains("; G-code for sheet"), "Body should contain G-code header");
}

// ─── 15. labels ──────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_label_templates() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::get().uri("/api/labels").to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/labels");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_label_template() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/labels/{}", id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/labels/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_create_label_template() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/labels")
        .set_json(serde_json::json!({"name": "Part Label A4", "width_mm": 62}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST /api/labels");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_update_label_template() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/labels/{}", id);
    let req = test::TestRequest::put()
        .uri(&uri)
        .set_json(serde_json::json!({"name": "Updated Label Template"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "PUT /api/labels/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_delete_label_template() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/labels/{}", id);
    let req = test::TestRequest::delete().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "DELETE /api/labels/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_generate_labels_for_sheet() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/labels/generate-for-sheet")
        .set_json(serde_json::json!({"sheet_id": Uuid::new_v4().to_string(), "template_id": Uuid::new_v4().to_string()}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST /api/labels/generate-for-sheet");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_print_label() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/labels/print")
        .set_json(serde_json::json!({"part_id": Uuid::new_v4().to_string(), "printer_id": "LP001"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST /api/labels/print");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

// ─── 16. drawings ────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_drawing_templates() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::get().uri("/api/drawings").to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/drawings");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_drawing_template() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/drawings/{}", id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/drawings/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_create_drawing_template() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/drawings")
        .set_json(serde_json::json!({"name": "A3 Assembly Template"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST /api/drawings");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_update_drawing_template() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/drawings/{}", id);
    let req = test::TestRequest::put()
        .uri(&uri)
        .set_json(serde_json::json!({"name": "A4 Part Drawing"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "PUT /api/drawings/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_delete_drawing_template() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/drawings/{}", id);
    let req = test::TestRequest::delete().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "DELETE /api/drawings/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_generate_assembly_sheet() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/drawings/generate-assembly-sheet")
        .set_json(serde_json::json!({"product_id": Uuid::new_v4().to_string()}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST /api/drawings/generate-assembly-sheet");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_generate_part_drawing() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/drawings/generate-part-drawing")
        .set_json(serde_json::json!({"part_id": Uuid::new_v4().to_string()}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST /api/drawings/generate-part-drawing");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_export_drawing_pdf() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/drawings/export-pdf")
        .set_json(serde_json::json!({"drawing_id": Uuid::new_v4().to_string()}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST /api/drawings/export-pdf");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_export_drawing_dxf() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/drawings/export-dxf")
        .set_json(serde_json::json!({"drawing_id": Uuid::new_v4().to_string()}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST /api/drawings/export-dxf");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_import_dxf() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/drawings/import-dxf")
        .set_json(serde_json::json!({"filename": "custom_shape.dxf", "data_base64": ""}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST /api/drawings/import-dxf");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

// ─── 17. cutlists ────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_get_cutlist() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let job_id = Uuid::new_v4();
    let uri = format!("/api/jobs/{}/cutlist", job_id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/jobs/{job_id}/cutlist");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_bom() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let job_id = Uuid::new_v4();
    let uri = format!("/api/jobs/{}/bom", job_id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/jobs/{job_id}/bom");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_boq() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let job_id = Uuid::new_v4();
    let uri = format!("/api/jobs/{}/boq", job_id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/jobs/{job_id}/boq");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_order_list() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let job_id = Uuid::new_v4();
    let uri = format!("/api/jobs/{}/order-list", job_id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/jobs/{job_id}/order-list");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_create_custom_cutlist() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let job_id = Uuid::new_v4();
    let uri = format!("/api/jobs/{}/cutlist/custom", job_id);
    let req = test::TestRequest::post()
        .uri(&uri)
        .set_json(serde_json::json!({"overrides": []}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST /api/jobs/{job_id}/cutlist/custom");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_export_cutlist_csv() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let job_id = Uuid::new_v4();
    let uri = format!("/api/jobs/{}/cutlist/export-csv", job_id);
    let req = test::TestRequest::post()
        .uri(&uri)
        .set_json(serde_json::json!({}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST /api/jobs/{job_id}/cutlist/export-csv");
    let body = test::read_body(resp).await;
    let text = std::str::from_utf8(&body).expect("body is utf-8");
    assert!(text.contains("Part Name"), "CSV should contain header row");
}

// ─── 18. quotes ──────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_quotes() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::get().uri("/api/quotes").to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/quotes");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_quote() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/quotes/{}", id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/quotes/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_create_quote() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/quotes")
        .set_json(serde_json::json!({"job_id": Uuid::new_v4().to_string(), "markup_pct": 30}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST /api/quotes");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_update_quote() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/quotes/{}", id);
    let req = test::TestRequest::put()
        .uri(&uri)
        .set_json(serde_json::json!({"markup_pct": 35}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "PUT /api/quotes/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_delete_quote() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/quotes/{}", id);
    let req = test::TestRequest::delete().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "DELETE /api/quotes/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_auto_generate_estimate() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let job_id = Uuid::new_v4();
    let uri = format!("/api/jobs/{}/estimate", job_id);
    let req = test::TestRequest::post()
        .uri(&uri)
        .set_json(serde_json::json!({"markup_pct": 25, "include_hardware": true}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST /api/jobs/{job_id}/estimate");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_export_quote() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/quotes/{}/export-quote", id);
    let req = test::TestRequest::post().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST /api/quotes/{id}/export-quote");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

// ─── 19. users ───────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_users() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::get().uri("/api/users").to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/users");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_user() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/users/{}", id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/users/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_create_user() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/users")
        .set_json(serde_json::json!({"email": "alice@example.com", "role": "designer"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST /api/users");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_update_user() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/users/{}", id);
    let req = test::TestRequest::put()
        .uri(&uri)
        .set_json(serde_json::json!({"email": "bob@example.com"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "PUT /api/users/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_delete_user() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/users/{}", id);
    let req = test::TestRequest::delete().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "DELETE /api/users/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_user_login() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/users/login")
        .set_json(serde_json::json!({"email": "alice@example.com", "password": "secret"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST /api/users/login");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_user_register() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/users/register")
        .set_json(serde_json::json!({"email": "newuser@example.com", "password": "secure123"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 201, "POST /api/users/register");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_update_user_role() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/users/{}/role", id);
    let req = test::TestRequest::put()
        .uri(&uri)
        .set_json(serde_json::json!({"role": "admin"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "PUT /api/users/{id}/role");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_update_user_permissions() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/users/{}/permissions", id);
    let req = test::TestRequest::put()
        .uri(&uri)
        .set_json(serde_json::json!({"permissions": {"can_export": true}}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "PUT /api/users/{id}/permissions");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

// ─── 20. shop floor ──────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_list_shop_floor_items() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::get().uri("/api/shop-floor").to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/shop-floor");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_scan_barcode() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/shop-floor/scan")
        .set_json(serde_json::json!({"barcode": "PART-00042"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST /api/shop-floor/scan");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_mark_part_complete() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let part_id = Uuid::new_v4();
    let uri = format!("/api/shop-floor/parts/{}/complete", part_id);
    let req = test::TestRequest::post().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST /api/shop-floor/parts/{part_id}/complete");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_production_progress() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let job_id = Uuid::new_v4();
    let uri = format!("/api/shop-floor/jobs/{}/progress", job_id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/shop-floor/jobs/{job_id}/progress");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

// ─── 21. renderer ────────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_render_room() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/render/room")
        .set_json(serde_json::json!({"room_id": Uuid::new_v4().to_string(), "quality": "medium"}))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 202, "POST /api/render/room");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_render_status() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/render/{}", id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/render/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_render_result() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/render/{}/result", id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/render/{id}/result");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

// ─── 22. propagation ─────────────────────────────────────────────────────────

#[actix_web::test]
async fn test_propagate_change() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/propagate")
        .set_json(serde_json::json!({
            "source_type": "material",
            "source_id": Uuid::new_v4().to_string(),
            "change_type": "cost_update"
        }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 202, "POST /api/propagate");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_get_propagation_status() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let id = Uuid::new_v4();
    let uri = format!("/api/propagate/{}", id);
    let req = test::TestRequest::get().uri(&uri).to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "GET /api/propagate/{id}");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}

#[actix_web::test]
async fn test_preview_propagation() {
    let pool = create_test_pool();
    let app = make_app!(pool);
    let req = test::TestRequest::post()
        .uri("/api/propagate/preview")
        .set_json(serde_json::json!({
            "source_type": "construction_method",
            "source_id": Uuid::new_v4().to_string()
        }))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), 200, "POST /api/propagate/preview");
    let body: Value = test::read_body_json(resp).await;
    assert_eq!(body["status"], "ok");
}
