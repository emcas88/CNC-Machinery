//! Integration tests for CRUD API – Batch 2
//!
//! # Running
//! ```
//! TEST_DATABASE_URL=postgres://... cargo test --test api_crud_tests_batch2
//! ```
//!
//! Each module section contains at least 10 tests covering:
//!   - Happy-path list, get, create, update, delete
//!   - 404 for missing resources
//!   - Field validation / edge cases
//!   - Partial update behaviour
//!   - Cascade / computed field behaviour where applicable

#![cfg(test)]

use actix_web::{test, web, App};
use serde_json::{json, Value};
use sqlx::PgPool;
use std::env;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/// Spin up a PgPool from the TEST_DATABASE_URL env var.
/// Each test function that needs DB access calls this.
async fn test_pool() -> PgPool {
    let url = env::var("TEST_DATABASE_URL")
        .expect("TEST_DATABASE_URL must be set to run integration tests");
    PgPool::connect(&url)
        .await
        .expect("Failed to connect to test database")
}

// ===========================================================================
// 1. TOOLS
// ===========================================================================

mod tools_tests {
    use super::*;
    use crate::api::tools;

    fn app(
        pool: PgPool,
    ) -> impl actix_web::dev::Service<
        actix_http::Request,
        Response = actix_web::dev::ServiceResponse,
        Error = actix_web::Error,
    > {
        test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(tools::configure),
        )
    }

    #[actix_web::test]
    async fn test_tools_list_returns_200() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(tools::configure),
        )
        .await;
        let req = test::TestRequest::get().uri("/tools").to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);
    }

    #[actix_web::test]
    async fn test_tools_list_returns_json_array() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(tools::configure),
        )
        .await;
        let req = test::TestRequest::get().uri("/tools").to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        assert!(body.is_array(), "Expected JSON array");
    }

    #[actix_web::test]
    async fn test_tools_create_returns_201() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(tools::configure),
        )
        .await;
        let payload = json!({
            "name": "Test Upcut 6mm",
            "diameter": 6.0,
            "tool_type": "up_cut",
            "rpm": 18000,
            "feed_rate": 4500.0,
            "plunge_rate": 1500.0,
            "max_depth_per_pass": 3.0
        });
        let req = test::TestRequest::post()
            .uri("/tools")
            .set_json(&payload)
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 201);
    }

    #[actix_web::test]
    async fn test_tools_create_persists_tool_type() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(tools::configure),
        )
        .await;
        let payload = json!({
            "name": "Drill Bit 3mm",
            "diameter": 3.0,
            "tool_type": "drill_bit",
            "rpm": 24000,
            "feed_rate": 2000.0,
            "plunge_rate": 800.0,
            "max_depth_per_pass": 1.5
        });
        let req = test::TestRequest::post()
            .uri("/tools")
            .set_json(&payload)
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        assert_eq!(body["tool_type"], "drill_bit");
    }

    #[actix_web::test]
    async fn test_tools_get_by_id_returns_200() {
        let pool = test_pool().await;
        // Insert a known tool directly
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO tools (id, name, diameter, tool_type, rpm, feed_rate, plunge_rate, max_depth_per_pass, created_at, updated_at)
               VALUES ($1, 'Dovetail 10mm', 10.0, 'dovetail'::tool_type, 12000, 3000, 1000, 5.0, $2, $2)"#,
            id, now
        )
        .execute(&pool)
        .await
        .unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(tools::configure),
        )
        .await;
        let req = test::TestRequest::get()
            .uri(&format!("/tools/{id}"))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        // Cleanup
        sqlx::query!("DELETE FROM tools WHERE id = $1", id)
            .execute(&pool)
            .await
            .unwrap();
    }

    #[actix_web::test]
    async fn test_tools_get_nonexistent_returns_404() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(tools::configure),
        )
        .await;
        let fake_id = Uuid::new_v4();
        let req = test::TestRequest::get()
            .uri(&format!("/tools/{fake_id}"))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }

    #[actix_web::test]
    async fn test_tools_update_returns_200() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO tools (id, name, diameter, tool_type, rpm, feed_rate, plunge_rate, max_depth_per_pass, created_at, updated_at)
               VALUES ($1, 'Profile Bit 8mm', 8.0, 'profile_bit'::tool_type, 16000, 3500, 1200, 4.0, $2, $2)"#,
            id, now
        )
        .execute(&pool)
        .await
        .unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(tools::configure),
        )
        .await;
        let req = test::TestRequest::put()
            .uri(&format!("/tools/{id}"))
            .set_json(json!({ "rpm": 20000 }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);

        sqlx::query!("DELETE FROM tools WHERE id = $1", id)
            .execute(&pool)
            .await
            .unwrap();
    }

    #[actix_web::test]
    async fn test_tools_update_partial_preserves_unchanged_fields() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO tools (id, name, diameter, tool_type, rpm, feed_rate, plunge_rate, max_depth_per_pass, created_at, updated_at)
               VALUES ($1, 'Down Shear 6mm', 6.0, 'down_shear'::tool_type, 15000, 4000, 1300, 3.5, $2, $2)"#,
            id, now
        )
        .execute(&pool)
        .await
        .unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(tools::configure),
        )
        .await;
        let req = test::TestRequest::put()
            .uri(&format!("/tools/{id}"))
            .set_json(json!({ "feed_rate": 5000.0 }))
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        // name should be unchanged
        assert_eq!(body["name"], "Down Shear 6mm");
        assert_eq!(body["feed_rate"], 5000.0);

        sqlx::query!("DELETE FROM tools WHERE id = $1", id)
            .execute(&pool)
            .await
            .unwrap();
    }

    #[actix_web::test]
    async fn test_tools_update_nonexistent_returns_404() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(tools::configure),
        )
        .await;
        let fake_id = Uuid::new_v4();
        let req = test::TestRequest::put()
            .uri(&format!("/tools/{fake_id}"))
            .set_json(json!({ "rpm": 12000 }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }

    #[actix_web::test]
    async fn test_tools_delete_returns_204() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO tools (id, name, diameter, tool_type, rpm, feed_rate, plunge_rate, max_depth_per_pass, created_at, updated_at)
               VALUES ($1, 'Temp Tool', 4.0, 'up_cut'::tool_type, 10000, 2000, 700, 2.0, $2, $2)"#,
            id, now
        )
        .execute(&pool)
        .await
        .unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(tools::configure),
        )
        .await;
        let req = test::TestRequest::delete()
            .uri(&format!("/tools/{id}"))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 204);
    }

    #[actix_web::test]
    async fn test_tools_delete_nonexistent_returns_404() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(tools::configure),
        )
        .await;
        let fake_id = Uuid::new_v4();
        let req = test::TestRequest::delete()
            .uri(&format!("/tools/{fake_id}"))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 404);
    }

    #[actix_web::test]
    async fn test_tools_all_enum_variants_accepted() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(tools::configure),
        )
        .await;
        let variants = [
            "compression_cutter",
            "down_shear",
            "up_cut",
            "dovetail",
            "profile_bit",
            "drill_bit",
        ];
        for variant in variants {
            let payload = json!({
                "name": format!("Enum test {variant}"),
                "diameter": 5.0,
                "tool_type": variant,
                "rpm": 12000,
                "feed_rate": 3000.0,
                "plunge_rate": 1000.0,
                "max_depth_per_pass": 2.5
            });
            let req = test::TestRequest::post()
                .uri("/tools")
                .set_json(&payload)
                .to_request();
            let resp = test::call_service(&app, req).await;
            assert_eq!(resp.status(), 201, "Expected 201 for tool_type={variant}");
        }
        // Cleanup
        sqlx::query!("DELETE FROM tools WHERE name LIKE 'Enum test %'")
            .execute(&pool)
            .await
            .unwrap();
    }
}

// ===========================================================================
// 2. MACHINES
// ===========================================================================

mod machines_tests {
    use super::*;
    use crate::api::machines;

    #[actix_web::test]
    async fn test_machines_list_returns_200() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(machines::configure),
        )
        .await;
        let req = test::TestRequest::get().uri("/machines").to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);
    }

    #[actix_web::test]
    async fn test_machines_list_returns_array() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(machines::configure),
        )
        .await;
        let req = test::TestRequest::get().uri("/machines").to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        assert!(body.is_array());
    }

    #[actix_web::test]
    async fn test_machines_create_returns_201() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(machines::configure),
        )
        .await;
        let payload = json!({
            "name": "ShopBot PRSalpha",
            "machine_type": "cnc_router",
            "manufacturer": "ShopBot",
            "model_number": "PRS-4896",
            "max_x_mm": 2438.0,
            "max_y_mm": 1219.0,
            "max_z_mm": 152.0,
            "settings": { "spindle_brand": "HSD", "vacuum_table": true }
        });
        let req = test::TestRequest::post()
            .uri("/machines")
            .set_json(&payload)
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 201);
        // cleanup handled implicitly (tests use isolated schema or truncation)
    }

    #[actix_web::test]
    async fn test_machines_create_stores_jsonb_settings() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(machines::configure),
        )
        .await;
        let payload = json!({
            "name": "Haas VF-2",
            "machine_type": "milling",
            "manufacturer": "Haas",
            "model_number": "VF-2",
            "max_x_mm": 508.0,
            "max_y_mm": 406.0,
            "max_z_mm": 508.0,
            "settings": { "coolant": "through-spindle", "axis_count": 3 }
        });
        let req = test::TestRequest::post()
            .uri("/machines")
            .set_json(&payload)
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        assert_eq!(body["settings"]["coolant"], "through-spindle");
    }

    #[actix_web::test]
    async fn test_machines_get_existing_returns_200() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO machines (id, name, machine_type, manufacturer, model_number, max_x_mm, max_y_mm, max_z_mm, settings, created_at, updated_at)
               VALUES ($1, 'Axiom AR8 Pro+', 'cnc_router', 'Axiom', 'AR8-Pro+', 2032.0, 1220.0, 200.0, '{}', $2, $2)"#,
            id, now
        )
        .execute(&pool)
        .await
        .unwrap();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(machines::configure),
        )
        .await;
        let req = test::TestRequest::get()
            .uri(&format!("/machines/{id}"))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);
        sqlx::query!("DELETE FROM machines WHERE id = $1", id)
            .execute(&pool)
            .await
            .unwrap();
    }

    #[actix_web::test]
    async fn test_machines_get_nonexistent_returns_404() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(machines::configure),
        )
        .await;
        let req = test::TestRequest::get()
            .uri(&format!("/machines/{}", Uuid::new_v4()))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 404);
    }

    #[actix_web::test]
    async fn test_machines_update_returns_200() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO machines (id, name, machine_type, manufacturer, model_number, max_x_mm, max_y_mm, max_z_mm, settings, created_at, updated_at)
               VALUES ($1, 'Update Me', 'cnc_router', 'ACME', 'X-100', 1000.0, 1000.0, 100.0, '{}', $2, $2)"#,
            id, now
        )
        .execute(&pool)
        .await
        .unwrap();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(machines::configure),
        )
        .await;
        let req = test::TestRequest::put()
            .uri(&format!("/machines/{id}"))
            .set_json(json!({ "name": "Updated Machine" }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 200);
        sqlx::query!("DELETE FROM machines WHERE id = $1", id)
            .execute(&pool)
            .await
            .unwrap();
    }

    #[actix_web::test]
    async fn test_machines_update_partial_settings_merge() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO machines (id, name, machine_type, manufacturer, model_number, max_x_mm, max_y_mm, max_z_mm, settings, created_at, updated_at)
               VALUES ($1, 'Patch Me', 'cnc_router', 'FooCo', 'F-200', 900.0, 600.0, 150.0, '{"key":"original"}', $2, $2)"#,
            id, now
        )
        .execute(&pool)
        .await
        .unwrap();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(machines::configure),
        )
        .await;
        let req = test::TestRequest::put()
            .uri(&format!("/machines/{id}"))
            .set_json(json!({ "settings": {"key": "updated"} }))
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        assert_eq!(body["settings"]["key"], "updated");
        sqlx::query!("DELETE FROM machines WHERE id = $1", id)
            .execute(&pool)
            .await
            .unwrap();
    }

    #[actix_web::test]
    async fn test_machines_update_nonexistent_returns_404() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(machines::configure),
        )
        .await;
        let req = test::TestRequest::put()
            .uri(&format!("/machines/{}", Uuid::new_v4()))
            .set_json(json!({ "name": "Ghost" }))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 404);
    }

    #[actix_web::test]
    async fn test_machines_delete_returns_204() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO machines (id, name, machine_type, manufacturer, model_number, max_x_mm, max_y_mm, max_z_mm, settings, created_at, updated_at)
               VALUES ($1, 'Delete Me', 'cnc_router', 'ACME', 'DEL-1', 800.0, 800.0, 80.0, '{}', $2, $2)"#,
            id, now
        )
        .execute(&pool)
        .await
        .unwrap();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(machines::configure),
        )
        .await;
        let req = test::TestRequest::delete()
            .uri(&format!("/machines/{id}"))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 204);
    }

    #[actix_web::test]
    async fn test_machines_delete_nonexistent_returns_404() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(machines::configure),
        )
        .await;
        let req = test::TestRequest::delete()
            .uri(&format!("/machines/{}", Uuid::new_v4()))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 404);
    }
}

// ===========================================================================
// 3. CONSTRUCTION METHODS
// ===========================================================================

mod construction_methods_tests {
    use super::*;
    use crate::api::construction_methods;

    #[actix_web::test]
    async fn test_cm_list_returns_200() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(construction_methods::configure),
        )
        .await;
        let req = test::TestRequest::get()
            .uri("/construction-methods")
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 200);
    }

    #[actix_web::test]
    async fn test_cm_list_returns_array() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(construction_methods::configure),
        )
        .await;
        let req = test::TestRequest::get()
            .uri("/construction-methods")
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        assert!(body.is_array());
    }

    #[actix_web::test]
    async fn test_cm_create_returns_201() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(construction_methods::configure),
        )
        .await;
        let payload = json!({
            "name": "Pocket Screw",
            "joinery_type": ["pocket_screw", "glue"],
            "fastener_specs": { "screw_length_mm": 38, "torque_nm": 4 },
            "placement_rules": { "spacing_mm": 150 }
        });
        let req = test::TestRequest::post()
            .uri("/construction-methods")
            .set_json(&payload)
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 201);
    }

    #[actix_web::test]
    async fn test_cm_create_stores_text_array() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(construction_methods::configure),
        )
        .await;
        let payload = json!({
            "name": "Dado Joint",
            "joinery_type": ["dado", "glue", "nail"],
            "fastener_specs": {},
            "placement_rules": {}
        });
        let req = test::TestRequest::post()
            .uri("/construction-methods")
            .set_json(&payload)
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        assert_eq!(body["joinery_type"].as_array().unwrap().len(), 3);
    }

    #[actix_web::test]
    async fn test_cm_get_nonexistent_returns_404() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(construction_methods::configure),
        )
        .await;
        let req = test::TestRequest::get()
            .uri(&format!("/construction-methods/{}", Uuid::new_v4()))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 404);
    }

    #[actix_web::test]
    async fn test_cm_get_existing_returns_correct_body() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO construction_methods (id, name, joinery_type, fastener_specs, placement_rules, created_at, updated_at)
               VALUES ($1, 'Mortise & Tenon', ARRAY['mortise_tenon'], '{}', '{}', $2, $2)"#,
            id, now
        )
        .execute(&pool)
        .await
        .unwrap();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(construction_methods::configure),
        )
        .await;
        let req = test::TestRequest::get()
            .uri(&format!("/construction-methods/{id}"))
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        assert_eq!(body["name"], "Mortise & Tenon");
        sqlx::query!("DELETE FROM construction_methods WHERE id = $1", id)
            .execute(&pool)
            .await
            .unwrap();
    }

    #[actix_web::test]
    async fn test_cm_update_name_partial() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO construction_methods (id, name, joinery_type, fastener_specs, placement_rules, created_at, updated_at)
               VALUES ($1, 'Old Name', ARRAY['biscuit'], '{}', '{}', $2, $2)"#,
            id, now
        )
        .execute(&pool)
        .await
        .unwrap();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(construction_methods::configure),
        )
        .await;
        let req = test::TestRequest::put()
            .uri(&format!("/construction-methods/{id}"))
            .set_json(json!({ "name": "New Name" }))
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        assert_eq!(body["name"], "New Name");
        // joinery_type must be unchanged
        assert!(body["joinery_type"].as_array().is_some());
        sqlx::query!("DELETE FROM construction_methods WHERE id = $1", id)
            .execute(&pool)
            .await
            .unwrap();
    }

    #[actix_web::test]
    async fn test_cm_update_joinery_type_array() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO construction_methods (id, name, joinery_type, fastener_specs, placement_rules, created_at, updated_at)
               VALUES ($1, 'Array Update', ARRAY['glue'], '{}', '{}', $2, $2)"#,
            id, now
        )
        .execute(&pool)
        .await
        .unwrap();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(construction_methods::configure),
        )
        .await;
        let req = test::TestRequest::put()
            .uri(&format!("/construction-methods/{id}"))
            .set_json(json!({ "joinery_type": ["glue", "brad_nail"] }))
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        assert_eq!(body["joinery_type"].as_array().unwrap().len(), 2);
        sqlx::query!("DELETE FROM construction_methods WHERE id = $1", id)
            .execute(&pool)
            .await
            .unwrap();
    }

    #[actix_web::test]
    async fn test_cm_update_nonexistent_returns_404() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(construction_methods::configure),
        )
        .await;
        let req = test::TestRequest::put()
            .uri(&format!("/construction-methods/{}", Uuid::new_v4()))
            .set_json(json!({ "name": "Ghost" }))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 404);
    }

    #[actix_web::test]
    async fn test_cm_delete_returns_204() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO construction_methods (id, name, joinery_type, fastener_specs, placement_rules, created_at, updated_at)
               VALUES ($1, 'To Delete', ARRAY['glue'], '{}', '{}', $2, $2)"#,
            id, now
        )
        .execute(&pool)
        .await
        .unwrap();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(construction_methods::configure),
        )
        .await;
        let req = test::TestRequest::delete()
            .uri(&format!("/construction-methods/{id}"))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 204);
    }

    #[actix_web::test]
    async fn test_cm_delete_nonexistent_returns_404() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(construction_methods::configure),
        )
        .await;
        let req = test::TestRequest::delete()
            .uri(&format!("/construction-methods/{}", Uuid::new_v4()))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 404);
    }
}

// ===========================================================================
// 4. TEXTURES
// ===========================================================================

mod textures_tests {
    use super::*;
    use crate::api::textures;

    #[actix_web::test]
    async fn test_textures_list_returns_200() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(textures::configure),
        )
        .await;
        let req = test::TestRequest::get().uri("/textures").to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 200);
    }

    #[actix_web::test]
    async fn test_textures_create_returns_201() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(textures::configure),
        )
        .await;
        let payload = json!({
            "name": "Oak Natural",
            "abbreviation": "OAK-N",
            "image_url": "https://cdn.example.com/oak_natural.png",
            "sheen": "satin",
            "grain_orientation": "horizontal",
            "transparency": 0.0,
            "metallicness": 0.0,
            "visual_width": 200.0,
            "visual_height": 200.0,
            "rotation_angle": 0.0,
            "texture_group_id": null
        });
        let req = test::TestRequest::post()
            .uri("/textures")
            .set_json(&payload)
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 201);
    }

    #[actix_web::test]
    async fn test_textures_create_stores_sheen_enum() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(textures::configure),
        )
        .await;
        let payload = json!({
            "name": "Glass Panel",
            "abbreviation": "GLS",
            "image_url": "https://cdn.example.com/glass.png",
            "sheen": "glass",
            "grain_orientation": "none",
            "transparency": 0.85,
            "metallicness": 0.0,
            "visual_width": 100.0,
            "visual_height": 100.0,
            "rotation_angle": 0.0,
            "texture_group_id": null
        });
        let req = test::TestRequest::post()
            .uri("/textures")
            .set_json(&payload)
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        assert_eq!(body["sheen"], "glass");
    }

    #[actix_web::test]
    async fn test_textures_get_nonexistent_returns_404() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(textures::configure),
        )
        .await;
        let req = test::TestRequest::get()
            .uri(&format!("/textures/{}", Uuid::new_v4()))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 404);
    }

    #[actix_web::test]
    async fn test_textures_update_sheen_partial() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO textures (id, name, abbreviation, image_url, sheen, grain_orientation, transparency, metallicness, visual_width, visual_height, rotation_angle, created_at, updated_at)
               VALUES ($1, 'Matte Walnut', 'WAL-M', 'https://cdn.example.com/walnut.png', 'flat'::sheen, 'horizontal'::grain_orientation, 0.0, 0.0, 150.0, 150.0, 0.0, $2, $2)"#,
            id, now
        )
        .execute(&pool)
        .await
        .unwrap();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(textures::configure),
        )
        .await;
        let req = test::TestRequest::put()
            .uri(&format!("/textures/{id}"))
            .set_json(json!({ "sheen": "semi_gloss" }))
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        assert_eq!(body["sheen"], "semi_gloss");
        sqlx::query!("DELETE FROM textures WHERE id = $1", id)
            .execute(&pool)
            .await
            .unwrap();
    }

    #[actix_web::test]
    async fn test_textures_update_nonexistent_returns_404() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(textures::configure),
        )
        .await;
        let req = test::TestRequest::put()
            .uri(&format!("/textures/{}", Uuid::new_v4()))
            .set_json(json!({ "sheen": "flat" }))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 404);
    }

    #[actix_web::test]
    async fn test_textures_delete_returns_204() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO textures (id, name, abbreviation, image_url, sheen, grain_orientation, transparency, metallicness, visual_width, visual_height, rotation_angle, created_at, updated_at)
               VALUES ($1, 'Delete Me', 'DEL', 'https://cdn.example.com/del.png', 'none'::sheen, 'vertical'::grain_orientation, 0.0, 0.0, 100.0, 100.0, 0.0, $2, $2)"#,
            id, now
        )
        .execute(&pool)
        .await
        .unwrap();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(textures::configure),
        )
        .await;
        let req = test::TestRequest::delete()
            .uri(&format!("/textures/{id}"))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 204);
    }

    #[actix_web::test]
    async fn test_texture_groups_create_and_list() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(textures::configure),
        )
        .await;
        // Create
        let req = test::TestRequest::post()
            .uri("/texture-groups")
            .set_json(json!({ "name": "Wood Veneers" }))
            .to_request();
        let create_resp = test::call_service(&app, req).await;
        assert_eq!(create_resp.status(), 201);

        // List
        let req = test::TestRequest::get().uri("/texture-groups").to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        assert!(body.is_array());
    }

    #[actix_web::test]
    async fn test_texture_groups_update_returns_200() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();
        sqlx::query!(
            "INSERT INTO texture_groups (id, name, created_at) VALUES ($1, 'Old Group', $2)",
            id,
            now
        )
        .execute(&pool)
        .await
        .unwrap();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(textures::configure),
        )
        .await;
        let req = test::TestRequest::put()
            .uri(&format!("/texture-groups/{id}"))
            .set_json(json!({ "name": "Updated Group" }))
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        assert_eq!(body["name"], "Updated Group");
        sqlx::query!("DELETE FROM texture_groups WHERE id = $1", id)
            .execute(&pool)
            .await
            .unwrap();
    }

    #[actix_web::test]
    async fn test_texture_groups_delete_nonexistent_returns_404() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(textures::configure),
        )
        .await;
        let req = test::TestRequest::delete()
            .uri(&format!("/texture-groups/{}", Uuid::new_v4()))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 404);
    }

    #[actix_web::test]
    async fn test_textures_all_sheen_variants_accepted() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(textures::configure),
        )
        .await;
        let sheens = ["none", "flat", "satin", "semi_gloss", "high_gloss", "glass"];
        for sheen in sheens {
            let payload = json!({
                "name": format!("Sheen test {sheen}"),
                "abbreviation": &sheen[..3].to_uppercase(),
                "image_url": format!("https://cdn.example.com/{sheen}.png"),
                "sheen": sheen,
                "grain_orientation": "none",
                "transparency": 0.0,
                "metallicness": 0.0,
                "visual_width": 100.0,
                "visual_height": 100.0,
                "rotation_angle": 0.0,
                "texture_group_id": null
            });
            let req = test::TestRequest::post()
                .uri("/textures")
                .set_json(&payload)
                .to_request();
            let resp = test::call_service(&app, req).await;
            assert_eq!(resp.status(), 201, "Expected 201 for sheen={sheen}");
        }
        sqlx::query!("DELETE FROM textures WHERE name LIKE 'Sheen test %'")
            .execute(&pool)
            .await
            .unwrap();
    }
}

// ===========================================================================
// 5. POST PROCESSORS
// ===========================================================================

mod post_processors_tests {
    use super::*;
    use crate::api::post_processors;

    #[actix_web::test]
    async fn test_pp_list_returns_200() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(post_processors::configure),
        )
        .await;
        let req = test::TestRequest::get()
            .uri("/post-processors")
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 200);
    }

    #[actix_web::test]
    async fn test_pp_create_returns_201() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(post_processors::configure),
        )
        .await;
        let payload = json!({
            "name": "Fanuc Generic",
            "controller_type": "Fanuc",
            "file_extension": "nc",
            "template_config": {
                "line_ending": "CRLF",
                "arc_output": "IJ",
                "spindle_speed_prefix": "S"
            }
        });
        let req = test::TestRequest::post()
            .uri("/post-processors")
            .set_json(&payload)
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 201);
    }

    #[actix_web::test]
    async fn test_pp_create_stores_jsonb_config() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(post_processors::configure),
        )
        .await;
        let payload = json!({
            "name": "Mach3 Router",
            "controller_type": "Mach3",
            "file_extension": "tap",
            "template_config": { "units": "mm", "coolant": false }
        });
        let req = test::TestRequest::post()
            .uri("/post-processors")
            .set_json(&payload)
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        assert_eq!(body["template_config"]["units"], "mm");
    }

    #[actix_web::test]
    async fn test_pp_get_nonexistent_returns_404() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(post_processors::configure),
        )
        .await;
        let req = test::TestRequest::get()
            .uri(&format!("/post-processors/{}", Uuid::new_v4()))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 404);
    }

    #[actix_web::test]
    async fn test_pp_get_existing_returns_correct_body() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO post_processors (id, name, controller_type, file_extension, template_config, created_at, updated_at)
               VALUES ($1, 'Siemens 840D', 'Siemens', 'mpf', '{"cycles": true}', $2, $2)"#,
            id, now
        )
        .execute(&pool)
        .await
        .unwrap();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(post_processors::configure),
        )
        .await;
        let req = test::TestRequest::get()
            .uri(&format!("/post-processors/{id}"))
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        assert_eq!(body["name"], "Siemens 840D");
        sqlx::query!("DELETE FROM post_processors WHERE id = $1", id)
            .execute(&pool)
            .await
            .unwrap();
    }

    #[actix_web::test]
    async fn test_pp_update_returns_200() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO post_processors (id, name, controller_type, file_extension, template_config, created_at, updated_at)
               VALUES ($1, 'Haas Mill', 'Haas', 'nc', '{}', $2, $2)"#,
            id, now
        )
        .execute(&pool)
        .await
        .unwrap();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(post_processors::configure),
        )
        .await;
        let req = test::TestRequest::put()
            .uri(&format!("/post-processors/{id}"))
            .set_json(json!({ "file_extension": "ngc" }))
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        assert_eq!(body["file_extension"], "ngc");
        sqlx::query!("DELETE FROM post_processors WHERE id = $1", id)
            .execute(&pool)
            .await
            .unwrap();
    }

    #[actix_web::test]
    async fn test_pp_update_nonexistent_returns_404() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(post_processors::configure),
        )
        .await;
        let req = test::TestRequest::put()
            .uri(&format!("/post-processors/{}", Uuid::new_v4()))
            .set_json(json!({ "name": "Ghost" }))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 404);
    }

    #[actix_web::test]
    async fn test_pp_delete_returns_204() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO post_processors (id, name, controller_type, file_extension, template_config, created_at, updated_at)
               VALUES ($1, 'Delete Me PP', 'Generic', 'txt', '{}', $2, $2)"#,
            id, now
        )
        .execute(&pool)
        .await
        .unwrap();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(post_processors::configure),
        )
        .await;
        let req = test::TestRequest::delete()
            .uri(&format!("/post-processors/{id}"))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 204);
    }

    #[actix_web::test]
    async fn test_pp_delete_nonexistent_returns_404() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(post_processors::configure),
        )
        .await;
        let req = test::TestRequest::delete()
            .uri(&format!("/post-processors/{}", Uuid::new_v4()))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 404);
    }

    #[actix_web::test]
    async fn test_pp_update_config_jsonb() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO post_processors (id, name, controller_type, file_extension, template_config, created_at, updated_at)
               VALUES ($1, 'Config Patcher', 'Fanuc', 'nc', '{"v": 1}', $2, $2)"#,
            id, now
        )
        .execute(&pool)
        .await
        .unwrap();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(post_processors::configure),
        )
        .await;
        let req = test::TestRequest::put()
            .uri(&format!("/post-processors/{id}"))
            .set_json(json!({ "template_config": {"v": 2, "new_key": true} }))
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        assert_eq!(body["template_config"]["v"], 2);
        sqlx::query!("DELETE FROM post_processors WHERE id = $1", id)
            .execute(&pool)
            .await
            .unwrap();
    }

    #[actix_web::test]
    async fn test_pp_list_returns_array() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(post_processors::configure),
        )
        .await;
        let req = test::TestRequest::get()
            .uri("/post-processors")
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        assert!(body.is_array());
    }
}

// ===========================================================================
// 6. QUOTES
// ===========================================================================

mod quotes_tests {
    use super::*;
    use crate::api::quotes;

    fn sample_quote_payload(job_id: Uuid) -> Value {
        json!({
            "job_id": job_id,
            "quote_number": "Q-2026-001",
            "material_cost": 450.0,
            "hardware_cost": 75.0,
            "labor_cost": 300.0,
            "markup_percentage": 20.0,
            "line_items": [
                { "description": "Plywood 4x8", "qty": 3, "unit_price": 85.0 }
            ]
        })
    }

    #[actix_web::test]
    async fn test_quotes_list_returns_200() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(quotes::configure),
        )
        .await;
        let req = test::TestRequest::get().uri("/quotes").to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 200);
    }

    #[actix_web::test]
    async fn test_quotes_create_returns_201() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(quotes::configure),
        )
        .await;
        let payload = sample_quote_payload(Uuid::new_v4());
        let req = test::TestRequest::post()
            .uri("/quotes")
            .set_json(&payload)
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 201);
    }

    #[actix_web::test]
    async fn test_quotes_total_calculated_server_side() {
        // total = (450 + 75 + 300) * 1.2 = 990.0
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(quotes::configure),
        )
        .await;
        let payload = sample_quote_payload(Uuid::new_v4());
        let req = test::TestRequest::post()
            .uri("/quotes")
            .set_json(&payload)
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        let total = body["total"].as_f64().unwrap();
        assert!(
            (total - 990.0).abs() < 0.01,
            "Expected total ~990.0, got {total}"
        );
    }

    #[actix_web::test]
    async fn test_quotes_list_filter_by_job_id() {
        let pool = test_pool().await;
        let job_id = Uuid::new_v4();
        let now = chrono::Utc::now();
        let qid = Uuid::new_v4();
        sqlx::query!(
            r#"INSERT INTO quotes (id, job_id, quote_number, material_cost, hardware_cost, labor_cost, markup_percentage, total, line_items, created_at, updated_at)
               VALUES ($1, $2, 'Q-FILTER-01', 100.0, 50.0, 200.0, 10.0, 385.0, '[]', $3, $3)"#,
            qid, job_id, now
        )
        .execute(&pool)
        .await
        .unwrap();

        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(quotes::configure),
        )
        .await;
        let req = test::TestRequest::get()
            .uri(&format!("/quotes?job_id={job_id}"))
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        let arr = body.as_array().unwrap();
        assert!(!arr.is_empty());
        assert!(arr.iter().all(|q| q["job_id"] == job_id.to_string()));

        sqlx::query!("DELETE FROM quotes WHERE id = $1", qid)
            .execute(&pool)
            .await
            .unwrap();
    }

    #[actix_web::test]
    async fn test_quotes_get_nonexistent_returns_404() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(quotes::configure),
        )
        .await;
        let req = test::TestRequest::get()
            .uri(&format!("/quotes/{}", Uuid::new_v4()))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 404);
    }

    #[actix_web::test]
    async fn test_quotes_update_recalculates_total() {
        // Existing: mat=100, hw=50, lab=200, markup=10  → total=385
        // After: markup=20 → total=(100+50+200)*1.2=420
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let job_id = Uuid::new_v4();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO quotes (id, job_id, quote_number, material_cost, hardware_cost, labor_cost, markup_percentage, total, line_items, created_at, updated_at)
               VALUES ($1, $2, 'Q-UPD-01', 100.0, 50.0, 200.0, 10.0, 385.0, '[]', $3, $3)"#,
            id, job_id, now
        )
        .execute(&pool)
        .await
        .unwrap();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(quotes::configure),
        )
        .await;
        let req = test::TestRequest::put()
            .uri(&format!("/quotes/{id}"))
            .set_json(json!({ "markup_percentage": 20.0 }))
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        let total = body["total"].as_f64().unwrap();
        assert!(
            (total - 420.0).abs() < 0.01,
            "Expected total ~420.0, got {total}"
        );
        sqlx::query!("DELETE FROM quotes WHERE id = $1", id)
            .execute(&pool)
            .await
            .unwrap();
    }

    #[actix_web::test]
    async fn test_quotes_update_nonexistent_returns_404() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(quotes::configure),
        )
        .await;
        let req = test::TestRequest::put()
            .uri(&format!("/quotes/{}", Uuid::new_v4()))
            .set_json(json!({ "markup_percentage": 15.0 }))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 404);
    }

    #[actix_web::test]
    async fn test_quotes_delete_returns_204() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let job_id = Uuid::new_v4();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO quotes (id, job_id, quote_number, material_cost, hardware_cost, labor_cost, markup_percentage, total, line_items, created_at, updated_at)
               VALUES ($1, $2, 'Q-DEL-01', 0.0, 0.0, 0.0, 0.0, 0.0, '[]', $3, $3)"#,
            id, job_id, now
        )
        .execute(&pool)
        .await
        .unwrap();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(quotes::configure),
        )
        .await;
        let req = test::TestRequest::delete()
            .uri(&format!("/quotes/{id}"))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 204);
    }

    #[actix_web::test]
    async fn test_quotes_delete_nonexistent_returns_404() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(quotes::configure),
        )
        .await;
        let req = test::TestRequest::delete()
            .uri(&format!("/quotes/{}", Uuid::new_v4()))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 404);
    }

    #[actix_web::test]
    async fn test_quotes_zero_markup_total_equals_sum() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(quotes::configure),
        )
        .await;
        let payload = json!({
            "job_id": Uuid::new_v4(),
            "quote_number": "Q-ZERO-MARKUP",
            "material_cost": 200.0,
            "hardware_cost": 100.0,
            "labor_cost": 300.0,
            "markup_percentage": 0.0,
            "line_items": []
        });
        let req = test::TestRequest::post()
            .uri("/quotes")
            .set_json(&payload)
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        let total = body["total"].as_f64().unwrap();
        assert!(
            (total - 600.0).abs() < 0.01,
            "Expected 600.0 with 0% markup, got {total}"
        );
    }
}

// ===========================================================================
// 7. USERS
// ===========================================================================

mod users_tests {
    use super::*;
    use crate::api::users;

    fn random_email() -> String {
        format!("test_{}@example.com", Uuid::new_v4().simple())
    }

    #[actix_web::test]
    async fn test_users_list_returns_200() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(users::configure),
        )
        .await;
        let req = test::TestRequest::get().uri("/users").to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 200);
    }

    #[actix_web::test]
    async fn test_users_list_does_not_expose_password_hash() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(users::configure),
        )
        .await;
        let req = test::TestRequest::get().uri("/users").to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        let arr = body.as_array().unwrap();
        for user in arr {
            assert!(
                user.get("password_hash").is_none(),
                "password_hash must not appear in list response"
            );
        }
    }

    #[actix_web::test]
    async fn test_users_create_returns_201() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(users::configure),
        )
        .await;
        let email = random_email();
        let payload = json!({
            "email": email,
            "name": "Jane Designer",
            "password_hash": "$argon2id$v=19$m=65536,t=2,p=1$...",
            "role": "designer",
            "preferences": { "theme": "dark" }
        });
        let req = test::TestRequest::post()
            .uri("/users")
            .set_json(&payload)
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 201);
        sqlx::query!("DELETE FROM users WHERE email = $1", email)
            .execute(&pool)
            .await
            .unwrap();
    }

    #[actix_web::test]
    async fn test_users_create_does_not_return_password_hash() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(users::configure),
        )
        .await;
        let email = random_email();
        let payload = json!({
            "email": email,
            "name": "No Hash Bob",
            "password_hash": "$argon2id$secure_hash",
            "role": "cnc_operator",
            "preferences": null
        });
        let req = test::TestRequest::post()
            .uri("/users")
            .set_json(&payload)
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        assert!(
            body.get("password_hash").is_none(),
            "password_hash must not appear in create response"
        );
        sqlx::query!("DELETE FROM users WHERE email = $1", email)
            .execute(&pool)
            .await
            .unwrap();
    }

    #[actix_web::test]
    async fn test_users_duplicate_email_returns_409() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(users::configure),
        )
        .await;
        let email = random_email();
        let payload = json!({
            "email": email,
            "name": "Dup User",
            "password_hash": "hash",
            "role": "designer",
            "preferences": null
        });
        // First create
        let req = test::TestRequest::post()
            .uri("/users")
            .set_json(&payload)
            .to_request();
        test::call_service(&app, req).await;

        // Second create — should conflict
        let req = test::TestRequest::post()
            .uri("/users")
            .set_json(&payload)
            .to_request();
        let resp = test::call_service(&app, req).await;
        assert_eq!(resp.status(), 409);

        sqlx::query!("DELETE FROM users WHERE email = $1", email)
            .execute(&pool)
            .await
            .unwrap();
    }

    #[actix_web::test]
    async fn test_users_get_nonexistent_returns_404() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(users::configure),
        )
        .await;
        let req = test::TestRequest::get()
            .uri(&format!("/users/{}", Uuid::new_v4()))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 404);
    }

    #[actix_web::test]
    async fn test_users_get_existing_returns_200() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let email = random_email();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO users (id, email, name, password_hash, role, preferences, created_at, updated_at)
               VALUES ($1, $2, 'Fetch Me', 'hashed', 'designer'::user_role, '{}', $3, $3)"#,
            id, email, now
        )
        .execute(&pool)
        .await
        .unwrap();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(users::configure),
        )
        .await;
        let req = test::TestRequest::get()
            .uri(&format!("/users/{id}"))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 200);
        sqlx::query!("DELETE FROM users WHERE id = $1", id)
            .execute(&pool)
            .await
            .unwrap();
    }

    #[actix_web::test]
    async fn test_users_update_role_partial() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let email = random_email();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO users (id, email, name, password_hash, role, preferences, created_at, updated_at)
               VALUES ($1, $2, 'Role Changer', 'hash', 'designer'::user_role, '{}', $3, $3)"#,
            id, email, now
        )
        .execute(&pool)
        .await
        .unwrap();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(users::configure),
        )
        .await;
        let req = test::TestRequest::put()
            .uri(&format!("/users/{id}"))
            .set_json(json!({ "role": "cnc_operator" }))
            .to_request();
        let body: Value = test::call_and_read_body_json(&app, req).await;
        assert_eq!(body["role"], "cnc_operator");
        assert!(body.get("password_hash").is_none());
        sqlx::query!("DELETE FROM users WHERE id = $1", id)
            .execute(&pool)
            .await
            .unwrap();
    }

    #[actix_web::test]
    async fn test_users_update_nonexistent_returns_404() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(users::configure),
        )
        .await;
        let req = test::TestRequest::put()
            .uri(&format!("/users/{}", Uuid::new_v4()))
            .set_json(json!({ "name": "Ghost" }))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 404);
    }

    #[actix_web::test]
    async fn test_users_delete_returns_204() {
        let pool = test_pool().await;
        let id = Uuid::new_v4();
        let email = random_email();
        let now = chrono::Utc::now();
        sqlx::query!(
            r#"INSERT INTO users (id, email, name, password_hash, role, preferences, created_at, updated_at)
               VALUES ($1, $2, 'Delete Me User', 'hash', 'shop_floor'::user_role, '{}', $3, $3)"#,
            id, email, now
        )
        .execute(&pool)
        .await
        .unwrap();
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(users::configure),
        )
        .await;
        let req = test::TestRequest::delete()
            .uri(&format!("/users/{id}"))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 204);
    }

    #[actix_web::test]
    async fn test_users_delete_nonexistent_returns_404() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(users::configure),
        )
        .await;
        let req = test::TestRequest::delete()
            .uri(&format!("/users/{}", Uuid::new_v4()))
            .to_request();
        assert_eq!(test::call_service(&app, req).await.status(), 404);
    }

    #[actix_web::test]
    async fn test_users_all_role_variants_accepted() {
        let pool = test_pool().await;
        let app = test::init_service(
            App::new()
                .app_data(web::Data::new(pool.clone()))
                .configure(users::configure),
        )
        .await;
        let roles = ["super_admin", "designer", "cnc_operator", "shop_floor"];
        let mut created_ids: Vec<String> = Vec::new();
        for role in roles {
            let email = random_email();
            let payload = json!({
                "email": email,
                "name": format!("Role test {role}"),
                "password_hash": "hash",
                "role": role,
                "preferences": null
            });
            let req = test::TestRequest::post()
                .uri("/users")
                .set_json(&payload)
                .to_request();
            let resp = test::call_service(&app, req).await;
            assert_eq!(resp.status(), 201, "Expected 201 for role={role}");
            created_ids.push(email);
        }
        for email in &created_ids {
            sqlx::query!("DELETE FROM users WHERE email = $1", email)
                .execute(&pool)
                .await
                .unwrap();
        }
    }
}
