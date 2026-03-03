//! Integration tests for Batch 3 — Specialized CNC-Machinery API modules.
//!
//! Modules covered
//! ───────────────
//!   cutlists   — GET /jobs/{job_id}/cutlist, GET /jobs/{job_id}/bom
//!   optimizer  — POST /jobs/{job_id}/optimize, GET /optimization-runs/{id},
//!                GET /jobs/{job_id}/optimization-runs,
//!                PUT /optimization-runs/{id}, DELETE /optimization-runs/{id}
//!   labels     — GET/POST/PUT/DELETE /label-templates, GET /jobs/{job_id}/labels
//!   drawings   — GET/POST/PUT/DELETE /drawing-templates
//!   shop_apps  — GET /shop/cutlist/{job_id}, GET /shop/assembly/{job_id},
//!                GET /shop/labels/{job_id}, POST /shop/scan
//!   rendering  — POST /renders, GET /renders/{id}, GET /renders
//!   export     — GET /export/csv/{job_id}, GET /export/labels/{job_id}
//!
//! Test strategy
//! ─────────────
//! All handlers are stub implementations — they never open a real database
//! connection.  We use `connect_lazy` to build a fake PgPool that satisfies
//! the `web::Data<PgPool>` extractor without network I/O.
//!
//! Each test follows the pattern:
//!   1. Build an Actix-web test `App` with the relevant `configure()` function.
//!   2. Fire a `TestRequest` at the target URI.
//!   3. Assert the expected HTTP status code.
//!   4. For JSON responses, assert `body["status"] == "ok"`.
//!   5. For binary/text responses (CSV), assert `Content-Type` and non-empty body.
//!
//! Run with:
//!   cargo test --test api_crud_tests_batch3

use actix_web::{test, web, App};
use serde_json::Value;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use uuid::Uuid;

// ─── shared helpers ───────────────────────────────────────────────────────────

/// Build a lazy PgPool that never actually connects.
/// Safe to use with stub handlers that never execute SQL.
fn fake_pool() -> PgPool {
    PgPoolOptions::new()
        .max_connections(1)
        .connect_lazy("postgres://fake:fake@localhost:5432/fake")
        .expect("connect_lazy must not fail")
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. cutlists
// ─────────────────────────────────────────────────────────────────────────────

mod cutlists_tests {
    use super::*;
    use cnc_backend::api::cutlists;

    macro_rules! cutlist_app {
        ($pool:expr) => {
            test::init_service(
                App::new()
                    .app_data(web::Data::new($pool))
                    .configure(cutlists::configure),
            )
            .await
        };
    }

    #[actix_web::test]
    async fn test_get_cutlist_returns_200() {
        let pool = fake_pool();
        let app  = cutlist_app!(pool);
        let id   = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/jobs/{}/cutlist", id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(
            resp.status(), 200,
            "GET /jobs/{{job_id}}/cutlist should return 200"
        );
        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["status"], "ok");
    }

    #[actix_web::test]
    async fn test_get_cutlist_response_has_groups_field() {
        let pool = fake_pool();
        let app  = cutlist_app!(pool);
        let id   = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/jobs/{}/cutlist", id))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let body: Value = test::read_body_json(resp).await;

        assert!(body.get("groups").is_some(), "Response must include 'groups' field");
        assert!(body.get("total_parts").is_some(), "Response must include 'total_parts' field");
    }

    #[actix_web::test]
    async fn test_get_bom_returns_200() {
        let pool = fake_pool();
        let app  = cutlist_app!(pool);
        let id   = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/jobs/{}/bom", id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(
            resp.status(), 200,
            "GET /jobs/{{job_id}}/bom should return 200"
        );
        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["status"], "ok");
    }

    #[actix_web::test]
    async fn test_get_bom_response_has_materials_and_hardware() {
        let pool = fake_pool();
        let app  = cutlist_app!(pool);
        let id   = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/jobs/{}/bom", id))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let body: Value = test::read_body_json(resp).await;

        assert!(body.get("materials").is_some(), "BOM must contain 'materials'");
        assert!(body.get("hardware").is_some(),  "BOM must contain 'hardware'");
    }

    #[actix_web::test]
    async fn test_cutlist_uses_valid_job_uuid_in_response() {
        let pool = fake_pool();
        let app  = cutlist_app!(pool);
        let id   = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/jobs/{}/cutlist", id))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let body: Value = test::read_body_json(resp).await;

        let returned_id = body["job_id"].as_str().unwrap_or("");
        assert_eq!(returned_id, id.to_string(), "job_id in response must match URL param");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. optimizer
// ─────────────────────────────────────────────────────────────────────────────

mod optimizer_tests {
    use super::*;
    use cnc_backend::api::optimizer;

    macro_rules! opt_app {
        ($pool:expr) => {
            test::init_service(
                App::new()
                    .app_data(web::Data::new($pool))
                    .configure(optimizer::configure),
            )
            .await
        };
    }

    #[actix_web::test]
    async fn test_create_optimization_run_returns_202() {
        let pool = fake_pool();
        let app  = opt_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::post()
            .uri(&format!("/jobs/{}/optimize", job_id))
            .set_json(serde_json::json!({
                "job_id":  job_id,
                "name":    "Test Run",
                "quality": "good",
                "settings": {}
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), 202, "POST /jobs/{{id}}/optimize should return 202");
        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["status"], "ok");
    }

    #[actix_web::test]
    async fn test_create_run_response_has_id_and_status() {
        let pool = fake_pool();
        let app  = opt_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::post()
            .uri(&format!("/jobs/{}/optimize", job_id))
            .set_json(serde_json::json!({
                "job_id":  job_id,
                "name":    "Test Run",
                "quality": "best"
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let body: Value = test::read_body_json(resp).await;

        assert!(body["data"]["id"].is_string(), "Response data.id must be a UUID string");
        assert_eq!(body["data"]["status"], "queued", "New run must start with status 'queued'");
    }

    #[actix_web::test]
    async fn test_get_optimization_run_returns_200_or_404() {
        let pool = fake_pool();
        let app  = opt_app!(pool);
        let id   = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/optimization-runs/{}", id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        let status = resp.status().as_u16();
        assert!(
            status == 200 || status == 404,
            "GET /optimization-runs/{{id}} must return 200 or 404, got {status}"
        );
    }

    #[actix_web::test]
    async fn test_list_optimization_runs_for_job_returns_200() {
        let pool   = fake_pool();
        let app    = opt_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/jobs/{}/optimization-runs", job_id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), 200, "GET /jobs/{{id}}/optimization-runs should return 200");
        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["status"], "ok");
        assert!(body["data"].is_array(), "Response data must be an array");
    }

    #[actix_web::test]
    async fn test_update_optimization_run_returns_200_or_404() {
        let pool = fake_pool();
        let app  = opt_app!(pool);
        let id   = Uuid::new_v4();

        let req = test::TestRequest::put()
            .uri(&format!("/optimization-runs/{}", id))
            .set_json(serde_json::json!({
                "status": "completed",
                "yield_percentage": 87.5
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;

        let status = resp.status().as_u16();
        assert!(
            status == 200 || status == 404,
            "PUT /optimization-runs/{{id}} must return 200 or 404, got {status}"
        );
    }

    #[actix_web::test]
    async fn test_delete_optimization_run_returns_200_or_404() {
        let pool = fake_pool();
        let app  = opt_app!(pool);
        let id   = Uuid::new_v4();

        let req = test::TestRequest::delete()
            .uri(&format!("/optimization-runs/{}", id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        let status = resp.status().as_u16();
        assert!(
            status == 200 || status == 404,
            "DELETE /optimization-runs/{{id}} must return 200 or 404, got {status}"
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. labels
// ─────────────────────────────────────────────────────────────────────────────

mod labels_tests {
    use super::*;
    use cnc_backend::api::labels;

    macro_rules! labels_app {
        ($pool:expr) => {
            test::init_service(
                App::new()
                    .app_data(web::Data::new($pool))
                    .configure(labels::configure),
            )
            .await
        };
    }

    #[actix_web::test]
    async fn test_list_label_templates_returns_200() {
        let pool = fake_pool();
        let app  = labels_app!(pool);

        let req = test::TestRequest::get()
            .uri("/label-templates")
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), 200, "GET /label-templates should return 200");
        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["status"], "ok");
        assert!(body["data"].is_array());
    }

    #[actix_web::test]
    async fn test_get_label_template_returns_200_or_404() {
        let pool = fake_pool();
        let app  = labels_app!(pool);
        let id   = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/label-templates/{}", id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        let status = resp.status().as_u16();
        assert!(
            status == 200 || status == 404,
            "GET /label-templates/{{id}} must return 200 or 404, got {status}"
        );
    }

    #[actix_web::test]
    async fn test_create_label_template_returns_201() {
        let pool = fake_pool();
        let app  = labels_app!(pool);

        let req = test::TestRequest::post()
            .uri("/label-templates")
            .set_json(serde_json::json!({
                "name":   "Standard 100×50",
                "width":  100.0,
                "height": 50.0,
                "fields": [
                    { "type": "text",    "key": "part_name",    "x": 5, "y": 5 },
                    { "type": "barcode", "key": "barcode_data", "x": 5, "y": 20 }
                ]
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), 201, "POST /label-templates should return 201");
        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["status"], "ok");
        assert!(body["data"]["id"].is_string(), "Response must include new template id");
    }

    #[actix_web::test]
    async fn test_update_label_template_returns_200_or_404() {
        let pool = fake_pool();
        let app  = labels_app!(pool);
        let id   = Uuid::new_v4();

        let req = test::TestRequest::put()
            .uri(&format!("/label-templates/{}", id))
            .set_json(serde_json::json!({ "name": "Updated Template" }))
            .to_request();
        let resp = test::call_service(&app, req).await;

        let status = resp.status().as_u16();
        assert!(
            status == 200 || status == 404,
            "PUT /label-templates/{{id}} must return 200 or 404, got {status}"
        );
    }

    #[actix_web::test]
    async fn test_delete_label_template_returns_200_or_404() {
        let pool = fake_pool();
        let app  = labels_app!(pool);
        let id   = Uuid::new_v4();

        let req = test::TestRequest::delete()
            .uri(&format!("/label-templates/{}", id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        let status = resp.status().as_u16();
        assert!(
            status == 200 || status == 404,
            "DELETE /label-templates/{{id}} must return 200 or 404, got {status}"
        );
    }

    #[actix_web::test]
    async fn test_get_job_labels_returns_200() {
        let pool   = fake_pool();
        let app    = labels_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/jobs/{}/labels", job_id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), 200, "GET /jobs/{{job_id}}/labels should return 200");
        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["status"], "ok");
        assert!(body["labels"].is_array(), "Response must include labels array");
    }

    #[actix_web::test]
    async fn test_job_labels_response_has_barcode_data() {
        let pool   = fake_pool();
        let app    = labels_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/jobs/{}/labels", job_id))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let body: Value = test::read_body_json(resp).await;

        // If there are labels (from a real DB run) each must have barcode_data.
        if let Some(labels) = body["labels"].as_array() {
            for label in labels {
                assert!(
                    label.get("barcode_data").is_some(),
                    "Every label must have a barcode_data field"
                );
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. drawings
// ─────────────────────────────────────────────────────────────────────────────

mod drawings_tests {
    use super::*;
    use cnc_backend::api::drawings;

    macro_rules! drawings_app {
        ($pool:expr) => {
            test::init_service(
                App::new()
                    .app_data(web::Data::new($pool))
                    .configure(drawings::configure),
            )
            .await
        };
    }

    #[actix_web::test]
    async fn test_list_drawing_templates_returns_200() {
        let pool = fake_pool();
        let app  = drawings_app!(pool);

        let req = test::TestRequest::get()
            .uri("/drawing-templates")
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), 200, "GET /drawing-templates should return 200");
        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["status"], "ok");
        assert!(body["data"].is_array());
    }

    #[actix_web::test]
    async fn test_get_drawing_template_returns_200_or_404() {
        let pool = fake_pool();
        let app  = drawings_app!(pool);
        let id   = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/drawing-templates/{}", id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        let status = resp.status().as_u16();
        assert!(
            status == 200 || status == 404,
            "GET /drawing-templates/{{id}} must return 200 or 404, got {status}"
        );
    }

    #[actix_web::test]
    async fn test_create_drawing_template_returns_201() {
        let pool = fake_pool();
        let app  = drawings_app!(pool);

        let req = test::TestRequest::post()
            .uri("/drawing-templates")
            .set_json(serde_json::json!({
                "name":       "A4 Portrait",
                "page_size":  "A4",
                "layout":     { "orientation": "portrait", "margin_mm": 10 },
                "title_block": {
                    "project": "",
                    "drawn_by": "",
                    "date": ""
                }
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), 201, "POST /drawing-templates should return 201");
        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["status"], "ok");
        assert!(body["data"]["id"].is_string());
    }

    #[actix_web::test]
    async fn test_update_drawing_template_returns_200_or_404() {
        let pool = fake_pool();
        let app  = drawings_app!(pool);
        let id   = Uuid::new_v4();

        let req = test::TestRequest::put()
            .uri(&format!("/drawing-templates/{}", id))
            .set_json(serde_json::json!({ "page_size": "A3" }))
            .to_request();
        let resp = test::call_service(&app, req).await;

        let status = resp.status().as_u16();
        assert!(
            status == 200 || status == 404,
            "PUT /drawing-templates/{{id}} must return 200 or 404, got {status}"
        );
    }

    #[actix_web::test]
    async fn test_delete_drawing_template_returns_200_or_404() {
        let pool = fake_pool();
        let app  = drawings_app!(pool);
        let id   = Uuid::new_v4();

        let req = test::TestRequest::delete()
            .uri(&format!("/drawing-templates/{}", id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        let status = resp.status().as_u16();
        assert!(
            status == 200 || status == 404,
            "DELETE /drawing-templates/{{id}} must return 200 or 404, got {status}"
        );
    }

    #[actix_web::test]
    async fn test_create_drawing_template_missing_fields_returns_400() {
        let pool = fake_pool();
        let app  = drawings_app!(pool);

        let req = test::TestRequest::post()
            .uri("/drawing-templates")
            .set_json(serde_json::json!({
                // Missing required fields: page_size, layout, title_block
                "name": "Incomplete"
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;

        // Actix-web returns 400 when required fields are missing in the body.
        assert_eq!(
            resp.status(), 400,
            "POST /drawing-templates with missing required fields should return 400"
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. shop_apps
// ─────────────────────────────────────────────────────────────────────────────

mod shop_apps_tests {
    use super::*;
    use cnc_backend::api::shop_apps;

    macro_rules! shop_app {
        ($pool:expr) => {
            test::init_service(
                App::new()
                    .app_data(web::Data::new($pool))
                    .configure(shop_apps::configure),
            )
            .await
        };
    }

    #[actix_web::test]
    async fn test_shop_cutlist_returns_200() {
        let pool   = fake_pool();
        let app    = shop_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/shop/cutlist/{}", job_id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        // Stub returns 200 or 404 (if job not found in DB).
        let status = resp.status().as_u16();
        assert!(
            status == 200 || status == 404,
            "GET /shop/cutlist/{{job_id}} must return 200 or 404, got {status}"
        );
    }

    #[actix_web::test]
    async fn test_shop_cutlist_200_has_parts_array() {
        let pool   = fake_pool();
        let app    = shop_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/shop/cutlist/{}", job_id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        if resp.status() == 200 {
            let body: Value = test::read_body_json(resp).await;
            assert_eq!(body["status"], "ok");
            assert!(body.get("parts").is_some(), "Response must include 'parts' field");
        }
    }

    #[actix_web::test]
    async fn test_shop_assembly_returns_200_or_404() {
        let pool   = fake_pool();
        let app    = shop_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/shop/assembly/{}", job_id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        let status = resp.status().as_u16();
        assert!(
            status == 200 || status == 404,
            "GET /shop/assembly/{{job_id}} must return 200 or 404, got {status}"
        );
    }

    #[actix_web::test]
    async fn test_shop_assembly_200_has_products_array() {
        let pool   = fake_pool();
        let app    = shop_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/shop/assembly/{}", job_id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        if resp.status() == 200 {
            let body: Value = test::read_body_json(resp).await;
            assert_eq!(body["status"], "ok");
            assert!(body["products"].is_array(), "Response must include 'products' array");
        }
    }

    #[actix_web::test]
    async fn test_shop_labels_returns_200_or_404() {
        let pool   = fake_pool();
        let app    = shop_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/shop/labels/{}", job_id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        let status = resp.status().as_u16();
        assert!(
            status == 200 || status == 404,
            "GET /shop/labels/{{job_id}} must return 200 or 404, got {status}"
        );
    }

    #[actix_web::test]
    async fn test_shop_labels_200_has_barcode_data() {
        let pool   = fake_pool();
        let app    = shop_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/shop/labels/{}", job_id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        if resp.status() == 200 {
            let body: Value = test::read_body_json(resp).await;
            if let Some(labels) = body["labels"].as_array() {
                for label in labels {
                    assert!(
                        label.get("barcode_data").is_some(),
                        "Every label must contain barcode_data"
                    );
                }
            }
        }
    }

    #[actix_web::test]
    async fn test_shop_scan_valid_payload_returns_201_or_404() {
        let pool    = fake_pool();
        let app     = shop_app!(pool);
        let part_id = Uuid::new_v4();

        let req = test::TestRequest::post()
            .uri("/shop/scan")
            .set_json(serde_json::json!({
                "part_id":  part_id,
                "action":   "cut",
                "operator": "OP-001"
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;

        let status = resp.status().as_u16();
        // 201 = event recorded, 404 = part not found in stub DB
        assert!(
            status == 201 || status == 404,
            "POST /shop/scan must return 201 or 404, got {status}"
        );
    }

    #[actix_web::test]
    async fn test_shop_scan_invalid_action_returns_400() {
        let pool    = fake_pool();
        let app     = shop_app!(pool);
        let part_id = Uuid::new_v4();

        let req = test::TestRequest::post()
            .uri("/shop/scan")
            .set_json(serde_json::json!({
                "part_id": part_id,
                "action":  "paint"      // not a valid action
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(
            resp.status(), 400,
            "POST /shop/scan with invalid action must return 400"
        );
        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["status"], "error");
    }

    #[actix_web::test]
    async fn test_shop_scan_all_valid_actions() {
        let pool = fake_pool();
        let app  = shop_app!(pool);

        for action in &["cut", "edgeband", "drill", "assemble"] {
            let part_id = Uuid::new_v4();
            let req = test::TestRequest::post()
                .uri("/shop/scan")
                .set_json(serde_json::json!({
                    "part_id": part_id,
                    "action":  action
                }))
                .to_request();
            let resp = test::call_service(&app, req).await;
            let status = resp.status().as_u16();
            assert!(
                status == 201 || status == 404,
                "POST /shop/scan action='{}' should return 201 or 404, got {status}",
                action
            );
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. rendering
// ─────────────────────────────────────────────────────────────────────────────

mod rendering_tests {
    use super::*;
    use cnc_backend::api::rendering;

    macro_rules! render_app {
        ($pool:expr) => {
            test::init_service(
                App::new()
                    .app_data(web::Data::new($pool))
                    .configure(rendering::configure),
            )
            .await
        };
    }

    #[actix_web::test]
    async fn test_create_render_with_job_id_returns_202() {
        let pool   = fake_pool();
        let app    = render_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::post()
            .uri("/renders")
            .set_json(serde_json::json!({
                "job_id":  job_id,
                "quality": "high"
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), 202, "POST /renders should return 202");
        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["status"], "ok");
    }

    #[actix_web::test]
    async fn test_create_render_response_has_id() {
        let pool    = fake_pool();
        let app     = render_app!(pool);
        let room_id = Uuid::new_v4();

        let req = test::TestRequest::post()
            .uri("/renders")
            .set_json(serde_json::json!({
                "room_id": room_id,
                "quality": "medium"
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let body: Value = test::read_body_json(resp).await;

        assert!(body["data"]["id"].is_string(), "Response data.id must be a UUID string");
        assert_eq!(body["data"]["render_status"], "queued");
    }

    #[actix_web::test]
    async fn test_create_render_invalid_quality_returns_400() {
        let pool   = fake_pool();
        let app    = render_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::post()
            .uri("/renders")
            .set_json(serde_json::json!({
                "job_id":  job_id,
                "quality": "ultra_hd_4k"   // not a valid quality
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(
            resp.status(), 400,
            "POST /renders with invalid quality must return 400"
        );
    }

    #[actix_web::test]
    async fn test_create_render_no_target_returns_400() {
        let pool = fake_pool();
        let app  = render_app!(pool);

        let req = test::TestRequest::post()
            .uri("/renders")
            .set_json(serde_json::json!({
                // No job_id, room_id, or product_id
                "quality": "low"
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(
            resp.status(), 400,
            "POST /renders with no target must return 400"
        );
    }

    #[actix_web::test]
    async fn test_get_render_returns_200_or_404() {
        let pool = fake_pool();
        let app  = render_app!(pool);
        let id   = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/renders/{}", id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        let status = resp.status().as_u16();
        assert!(
            status == 200 || status == 404,
            "GET /renders/{{id}} must return 200 or 404, got {status}"
        );
    }

    #[actix_web::test]
    async fn test_list_renders_returns_200() {
        let pool = fake_pool();
        let app  = render_app!(pool);

        let req = test::TestRequest::get()
            .uri("/renders")
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), 200, "GET /renders should return 200");
        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["status"], "ok");
        assert!(body["data"].is_array());
    }

    #[actix_web::test]
    async fn test_list_renders_with_status_filter() {
        let pool = fake_pool();
        let app  = render_app!(pool);

        let req = test::TestRequest::get()
            .uri("/renders?status=queued")
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), 200, "GET /renders?status=queued should return 200");
        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["filters"]["status"], "queued");
    }

    #[actix_web::test]
    async fn test_list_renders_with_job_id_filter() {
        let pool   = fake_pool();
        let app    = render_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/renders?job_id={}", job_id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), 200, "GET /renders?job_id=... should return 200");
    }

    #[actix_web::test]
    async fn test_create_render_with_product_id() {
        let pool       = fake_pool();
        let app        = render_app!(pool);
        let product_id = Uuid::new_v4();

        let req = test::TestRequest::post()
            .uri("/renders")
            .set_json(serde_json::json!({
                "product_id": product_id,
                "quality":    "ultra"
            }))
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), 202, "POST /renders with product_id should return 202");
        let body: Value = test::read_body_json(resp).await;
        assert_eq!(body["data"]["target_type"], "product");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. export
// ─────────────────────────────────────────────────────────────────────────────

mod export_tests {
    use super::*;
    use actix_web::test::read_body;
    use cnc_backend::api::export;

    macro_rules! export_app {
        ($pool:expr) => {
            test::init_service(
                App::new()
                    .app_data(web::Data::new($pool))
                    .configure(export::configure),
            )
            .await
        };
    }

    #[actix_web::test]
    async fn test_export_csv_returns_200() {
        let pool   = fake_pool();
        let app    = export_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/export/csv/{}", job_id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), 200, "GET /export/csv/{{job_id}} should return 200");
    }

    #[actix_web::test]
    async fn test_export_csv_content_type_is_text_csv() {
        let pool   = fake_pool();
        let app    = export_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/export/csv/{}", job_id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        let ct = resp
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        assert!(
            ct.contains("text/csv"),
            "Content-Type must be text/csv, got: {ct}"
        );
    }

    #[actix_web::test]
    async fn test_export_csv_body_has_header_row() {
        let pool   = fake_pool();
        let app    = export_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/export/csv/{}", job_id))
            .to_request();
        let resp = test::call_service(&app, req).await;
        let body  = read_body(resp).await;
        let text  = std::str::from_utf8(&body).expect("body must be valid UTF-8");

        assert!(
            text.starts_with("Room,Product,Part Name"),
            "CSV must start with header row. Got: {}", &text[..text.len().min(60)]
        );
    }

    #[actix_web::test]
    async fn test_export_csv_has_content_disposition_attachment() {
        let pool   = fake_pool();
        let app    = export_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/export/csv/{}", job_id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        let cd = resp
            .headers()
            .get("content-disposition")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        assert!(
            cd.contains("attachment"),
            "Content-Disposition must be 'attachment', got: {cd}"
        );
        assert!(
            cd.contains(&job_id.to_string()),
            "Content-Disposition filename must contain job_id"
        );
    }

    #[actix_web::test]
    async fn test_export_labels_returns_200() {
        let pool   = fake_pool();
        let app    = export_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/export/labels/{}", job_id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        assert_eq!(resp.status(), 200, "GET /export/labels/{{job_id}} should return 200");
    }

    #[actix_web::test]
    async fn test_export_labels_content_type_is_json() {
        let pool   = fake_pool();
        let app    = export_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/export/labels/{}", job_id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        let ct = resp
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        assert!(
            ct.contains("application/json"),
            "Content-Type must be application/json, got: {ct}"
        );
    }

    #[actix_web::test]
    async fn test_export_labels_has_content_disposition_attachment() {
        let pool   = fake_pool();
        let app    = export_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/export/labels/{}", job_id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        let cd = resp
            .headers()
            .get("content-disposition")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        assert!(
            cd.contains("attachment"),
            "Content-Disposition must be 'attachment', got: {cd}"
        );
    }

    #[actix_web::test]
    async fn test_export_labels_body_is_valid_json() {
        let pool   = fake_pool();
        let app    = export_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/export/labels/{}", job_id))
            .to_request();
        let resp  = test::call_service(&app, req).await;
        let bytes = read_body(resp).await;
        let text  = std::str::from_utf8(&bytes).expect("body must be valid UTF-8");

        let parsed: Result<Value, _> = serde_json::from_str(text);
        assert!(parsed.is_ok(), "Label export body must be valid JSON");

        let val = parsed.unwrap();
        assert!(val.get("labels").is_some(), "JSON must include 'labels' key");
        assert!(val.get("job_id").is_some(), "JSON must include 'job_id' key");
    }

    #[actix_web::test]
    async fn test_export_labels_filename_contains_job_id() {
        let pool   = fake_pool();
        let app    = export_app!(pool);
        let job_id = Uuid::new_v4();

        let req = test::TestRequest::get()
            .uri(&format!("/export/labels/{}", job_id))
            .to_request();
        let resp = test::call_service(&app, req).await;

        let cd = resp
            .headers()
            .get("content-disposition")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        assert!(
            cd.contains(&job_id.to_string()),
            "Content-Disposition filename must contain job_id. Got: {cd}"
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. cross-module: uuid path param validation
// ─────────────────────────────────────────────────────────────────────────────

mod uuid_validation_tests {
    use super::*;
    use cnc_backend::api::{cutlists, drawings, labels, optimizer, rendering, export, shop_apps};

    /// When a non-UUID string is passed as a path parameter, Actix-web's
    /// built-in UUID extractor should return 404 (path pattern mismatch) or 400.
    async fn assert_bad_uuid_rejected(
        app: &impl actix_web::dev::Service<
            actix_web::test::TestRequest,
            Response = actix_web::dev::ServiceResponse,
            Error = actix_web::Error,
        >,
        uri: &str,
        method: &str,
    ) {
        let req = match method {
            "GET"    => test::TestRequest::get().uri(uri).to_request(),
            "DELETE" => test::TestRequest::delete().uri(uri).to_request(),
            _        => test::TestRequest::get().uri(uri).to_request(),
        };
        let resp = test::call_service(app, req).await;
        let status = resp.status().as_u16();
        assert!(
            status == 400 || status == 404,
            "Non-UUID path param at '{uri}' should return 400 or 404, got {status}"
        );
    }

    #[actix_web::test]
    async fn test_invalid_uuid_in_optimization_run_path() {
        let pool = fake_pool();
        let app  = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(optimizer::configure),
        )
        .await;
        assert_bad_uuid_rejected(&app, "/optimization-runs/not-a-uuid", "GET").await;
        assert_bad_uuid_rejected(&app, "/optimization-runs/not-a-uuid", "DELETE").await;
    }

    #[actix_web::test]
    async fn test_invalid_uuid_in_drawing_template_path() {
        let pool = fake_pool();
        let app  = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(drawings::configure),
        )
        .await;
        assert_bad_uuid_rejected(&app, "/drawing-templates/not-a-uuid", "GET").await;
        assert_bad_uuid_rejected(&app, "/drawing-templates/not-a-uuid", "DELETE").await;
    }

    #[actix_web::test]
    async fn test_invalid_uuid_in_label_template_path() {
        let pool = fake_pool();
        let app  = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(labels::configure),
        )
        .await;
        assert_bad_uuid_rejected(&app, "/label-templates/not-a-uuid", "GET").await;
        assert_bad_uuid_rejected(&app, "/label-templates/not-a-uuid", "DELETE").await;
    }

    #[actix_web::test]
    async fn test_invalid_uuid_in_render_path() {
        let pool = fake_pool();
        let app  = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(rendering::configure),
        )
        .await;
        assert_bad_uuid_rejected(&app, "/renders/not-a-uuid", "GET").await;
    }

    #[actix_web::test]
    async fn test_invalid_uuid_in_export_csv_path() {
        let pool = fake_pool();
        let app  = test::init_service(
            App::new()
                .app_data(web::Data::new(pool))
                .configure(export::configure),
        )
        .await;
        assert_bad_uuid_rejected(&app, "/export/csv/not-a-uuid", "GET").await;
        assert_bad_uuid_rejected(&app, "/export/labels/not-a-uuid", "GET").await;
    }
}
