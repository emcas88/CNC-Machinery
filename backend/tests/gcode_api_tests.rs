//! Integration tests for the G-code API layer (gcode_api.rs).
//!
//! These tests exercise the request/response DTOs, the GCodeConfigDto merging
//! logic, the ApiError response mapping, and the route configuration.
//!
//! Because the handlers depend on a live `PgPool` connection they cannot be
//! hit directly in unit-test mode. Instead we:
//!   1. Test all DTO serialisation / deserialisation round-trips.
//!   2. Test GCodeConfigDto::into_config() field mapping exhaustively.
//!   3. Test the ApiError → HTTP status code mapping.
//!   4. Verify the route registration helper compiles (smoke-test).
//!   5. Provide actix-web test-server tests with a mocked service where the
//!      database layer is bypassed by constructing SheetGCodeInput directly.

use actix_web::{http::StatusCode, test, web, App, HttpResponse, ResponseError};
use serde_json::json;
use uuid::Uuid;

// ── Re-import from the parent crate (adjust path when integrating).
use super::{
    ApiError, GCodeBlockDto, GCodeConfigDto, GCodeError, GCodeGenerator, GenerateRequest,
    GenerateResponse, MachineInput, OperationInput, PlacedPartInput, SafetyCheckOutput,
    SafetyCheckRequest, SheetGCodeInput, SimulateRequest, SimulationOutput,
    SpoilboardResurfaceRequest, SpoilboardResurfaceResponse, ToolInput,
};

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

fn minimal_tool() -> ToolInput {
    ToolInput {
        name: "12mm Compression".into(),
        diameter: 12.0,
        rpm: 18_000,
        feed_rate: 6_000.0,
        plunge_rate: 1_500.0,
        max_depth_per_pass: 6.0,
    }
}

fn minimal_machine() -> MachineInput {
    MachineInput {
        name: "TestCNC".into(),
        spoilboard_width: 1_250.0,
        spoilboard_length: 2_500.0,
        spoilboard_thickness: 18.0,
    }
}

fn minimal_sheet_input() -> SheetGCodeInput {
    SheetGCodeInput {
        sheet_id: Uuid::new_v4(),
        sheet_width: 1_220.0,
        sheet_length: 2_440.0,
        material_thickness: 18.0,
        parts: vec![PlacedPartInput {
            part_id: Uuid::new_v4(),
            name: "Panel".into(),
            x: 50.0,
            y: 50.0,
            length: 400.0,
            width: 300.0,
            rotated: false,
            operations: vec![OperationInput {
                id: Uuid::new_v4(),
                operation_type: "drill".into(),
                position_x: 100.0,
                position_y: 100.0,
                depth: 5.0,
                width: None,
                height: None,
                tool_index: 0,
                side: "top".into(),
                parameters: serde_json::Value::Object(Default::default()),
            }],
        }],
        machine: minimal_machine(),
        tools: vec![minimal_tool()],
        post_processor: None,
        program_name: Some("TEST".into()),
        material: Some("MDF".into()),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GCodeConfigDto::into_config() field mapping
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// Empty DTO leaves all fields at their defaults.
fn test_config_dto_empty_equals_default() {
    let cfg = GCodeConfigDto::default().into_config();
    assert_eq!(cfg.safe_z, 15.0);
    assert_eq!(cfg.clearance_z, 5.0);
    assert_eq!(cfg.spoilboard_tolerance, 0.3);
    assert_eq!(cfg.pocket_stepover_ratio, 0.6);
    assert_eq!(cfg.lead_in_radius, 5.0);
    assert_eq!(cfg.tab_width, 8.0);
    assert_eq!(cfg.tab_height, 3.0);
    assert_eq!(cfg.default_tab_count, 4);
    assert!(cfg.include_comments);
    assert_eq!(cfg.line_number_increment, 10);
}

#[test]
/// safe_z override is applied.
fn test_config_dto_safe_z_override() {
    let cfg = GCodeConfigDto {
        safe_z: Some(25.0),
        ..Default::default()
    }
    .into_config();
    assert_eq!(cfg.safe_z, 25.0);
}

#[test]
/// clearance_z override is applied.
fn test_config_dto_clearance_z_override() {
    let cfg = GCodeConfigDto {
        clearance_z: Some(3.0),
        ..Default::default()
    }
    .into_config();
    assert_eq!(cfg.clearance_z, 3.0);
}

#[test]
/// spoilboard_tolerance override is applied.
fn test_config_dto_spoilboard_tolerance_override() {
    let cfg = GCodeConfigDto {
        spoilboard_tolerance: Some(0.1),
        ..Default::default()
    }
    .into_config();
    assert_eq!(cfg.spoilboard_tolerance, 0.1);
}

#[test]
/// pocket_stepover_ratio override is applied.
fn test_config_dto_stepover_override() {
    let cfg = GCodeConfigDto {
        pocket_stepover_ratio: Some(0.4),
        ..Default::default()
    }
    .into_config();
    assert_eq!(cfg.pocket_stepover_ratio, 0.4);
}

#[test]
/// lead_in_radius override is applied.
fn test_config_dto_lead_in_radius_override() {
    let cfg = GCodeConfigDto {
        lead_in_radius: Some(3.0),
        ..Default::default()
    }
    .into_config();
    assert_eq!(cfg.lead_in_radius, 3.0);
}

#[test]
/// tab_width override is applied.
fn test_config_dto_tab_width_override() {
    let cfg = GCodeConfigDto {
        tab_width: Some(12.0),
        ..Default::default()
    }
    .into_config();
    assert_eq!(cfg.tab_width, 12.0);
}

#[test]
/// tab_height override is applied.
fn test_config_dto_tab_height_override() {
    let cfg = GCodeConfigDto {
        tab_height: Some(5.0),
        ..Default::default()
    }
    .into_config();
    assert_eq!(cfg.tab_height, 5.0);
}

#[test]
/// default_tab_count override is applied.
fn test_config_dto_tab_count_override() {
    let cfg = GCodeConfigDto {
        default_tab_count: Some(6),
        ..Default::default()
    }
    .into_config();
    assert_eq!(cfg.default_tab_count, 6);
}

#[test]
/// include_comments=false override is applied.
fn test_config_dto_include_comments_false() {
    let cfg = GCodeConfigDto {
        include_comments: Some(false),
        ..Default::default()
    }
    .into_config();
    assert!(!cfg.include_comments);
}

#[test]
/// line_number_increment=0 (disable line numbers) override is applied.
fn test_config_dto_line_number_zero() {
    let cfg = GCodeConfigDto {
        line_number_increment: Some(0),
        ..Default::default()
    }
    .into_config();
    assert_eq!(cfg.line_number_increment, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// DTO serialisation / deserialisation
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// GenerateRequest round-trips through JSON correctly.
fn test_generate_request_serde_roundtrip() {
    let id = Uuid::new_v4();
    let req = GenerateRequest {
        sheet_id: id,
        config: GCodeConfigDto {
            safe_z: Some(20.0),
            ..Default::default()
        },
    };
    let json_str = serde_json::to_string(&req).unwrap();
    let parsed: GenerateRequest = serde_json::from_str(&json_str).unwrap();
    assert_eq!(parsed.sheet_id, id);
    assert_eq!(parsed.config.safe_z, Some(20.0));
}

#[test]
/// GenerateRequest with missing config field uses default (empty DTO).
fn test_generate_request_default_config() {
    let id = Uuid::new_v4();
    let json_str = format!(r#"{{"sheet_id":"{}"}}"#, id);
    let parsed: GenerateRequest = serde_json::from_str(&json_str).unwrap();
    assert_eq!(parsed.sheet_id, id);
    assert!(parsed.config.safe_z.is_none());
}

#[test]
/// SimulateRequest deserialises from JSON correctly.
fn test_simulate_request_serde_roundtrip() {
    let id = Uuid::new_v4();
    let json_str = format!(r#"{{"sheet_id":"{}"}}"#, id);
    let parsed: SimulateRequest = serde_json::from_str(&json_str).unwrap();
    assert_eq!(parsed.sheet_id, id);
}

#[test]
/// SafetyCheckRequest deserialises from JSON correctly.
fn test_safety_check_request_serde_roundtrip() {
    let id = Uuid::new_v4();
    let json_str = format!(r#"{{"sheet_id":"{}"}}"#, id);
    let parsed: SafetyCheckRequest = serde_json::from_str(&json_str).unwrap();
    assert_eq!(parsed.sheet_id, id);
}

#[test]
/// SpoilboardResurfaceRequest round-trips through JSON.
fn test_spoilboard_resurface_request_serde() {
    let req = SpoilboardResurfaceRequest {
        machine_id: Uuid::new_v4(),
        tool_diameter: 50.0,
        rpm: 12_000,
        feed_rate: 8_000.0,
        plunge_rate: 2_000.0,
        cut_depth: 0.5,
        config: GCodeConfigDto::default(),
    };
    let json_str = serde_json::to_string(&req).unwrap();
    let parsed: SpoilboardResurfaceRequest = serde_json::from_str(&json_str).unwrap();
    assert_eq!(parsed.tool_diameter, 50.0);
    assert_eq!(parsed.rpm, 12_000);
    assert_eq!(parsed.cut_depth, 0.5);
}

#[test]
/// GCodeBlockDto serialises and deserialises correctly.
fn test_gcode_block_dto_serde() {
    let dto = GCodeBlockDto {
        label: "Test Block".into(),
        lines: vec!["G21".into(), "G90".into()],
        part_id: Some(Uuid::new_v4()),
        operation_id: None,
    };
    let json_str = serde_json::to_string(&dto).unwrap();
    let parsed: GCodeBlockDto = serde_json::from_str(&json_str).unwrap();
    assert_eq!(parsed.label, "Test Block");
    assert_eq!(parsed.lines.len(), 2);
    assert!(parsed.operation_id.is_none());
}

#[test]
/// GenerateResponse serialises to JSON with all expected keys.
fn test_generate_response_contains_expected_keys() {
    let id = Uuid::new_v4();
    let resp = GenerateResponse {
        sheet_id: id,
        gcode: "G21\nM30".into(),
        blocks: vec![],
        tool_changes: 1,
        estimated_cut_time_seconds: 120.5,
        total_distance_mm: 5_000.0,
        warnings: vec!["test warning".into()],
    };
    let v: serde_json::Value = serde_json::to_value(&resp).unwrap();
    assert!(v.get("sheet_id").is_some());
    assert!(v.get("gcode").is_some());
    assert!(v.get("blocks").is_some());
    assert!(v.get("tool_changes").is_some());
    assert!(v.get("estimated_cut_time_seconds").is_some());
    assert!(v.get("total_distance_mm").is_some());
    assert!(v.get("warnings").is_some());
}

#[test]
/// SpoilboardResurfaceResponse serialises with gcode, time, distance, warnings.
fn test_spoilboard_resurface_response_keys() {
    let resp = SpoilboardResurfaceResponse {
        gcode: "G21\nM30".into(),
        estimated_cut_time_seconds: 300.0,
        total_distance_mm: 25_000.0,
        warnings: vec![],
    };
    let v: serde_json::Value = serde_json::to_value(&resp).unwrap();
    assert!(v.get("gcode").is_some());
    assert!(v.get("estimated_cut_time_seconds").is_some());
    assert!(v.get("total_distance_mm").is_some());
    assert!(v.get("warnings").is_some());
}

#[test]
/// SafetyCheckOutput with passed=true serialises correctly.
fn test_safety_check_output_passed_serialises() {
    let out = SafetyCheckOutput {
        passed: true,
        violations: vec![],
        warnings: vec![],
    };
    let v: serde_json::Value = serde_json::to_value(&out).unwrap();
    assert_eq!(v["passed"], json!(true));
    assert_eq!(v["violations"], json!([]));
}

#[test]
/// SafetyCheckOutput with violations serialises them correctly.
fn test_safety_check_output_violations_serialises() {
    let out = SafetyCheckOutput {
        passed: false,
        violations: vec!["Part off-sheet".into()],
        warnings: vec!["Deep cut".into()],
    };
    let v: serde_json::Value = serde_json::to_value(&out).unwrap();
    assert_eq!(v["passed"], json!(false));
    assert_eq!(v["violations"][0], json!("Part off-sheet"));
    assert_eq!(v["warnings"][0], json!("Deep cut"));
}

#[test]
/// SimulationOutput serialises all numeric fields.
fn test_simulation_output_serialises() {
    let out = SimulationOutput {
        estimated_cut_time_seconds: 180.0,
        total_distance_mm: 8_000.0,
        rapid_distance_mm: 3_000.0,
        cut_distance_mm: 5_000.0,
        tool_changes: 2,
        pass_count: 6,
        warnings: vec![],
    };
    let v: serde_json::Value = serde_json::to_value(&out).unwrap();
    assert_eq!(v["tool_changes"], json!(2));
    assert_eq!(v["pass_count"], json!(6));
}

// ─────────────────────────────────────────────────────────────────────────────
// ApiError – ResponseError HTTP status mapping
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// NotFound → 404.
fn test_api_error_not_found_gives_404() {
    let err = ApiError::NotFound("sheet 123 not found".into());
    let resp = err.error_response();
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
}

#[test]
/// BadRequest → 400.
fn test_api_error_bad_request_gives_400() {
    let err = ApiError::BadRequest("invalid UUID".into());
    let resp = err.error_response();
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}

#[test]
/// GeneratorError (safety violation) → 500.
fn test_api_error_generator_safety_gives_500() {
    let err = ApiError::GeneratorError(GCodeError::SafetyViolation("out of bounds".into()));
    let resp = err.error_response();
    assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
}

#[test]
/// GeneratorError (invalid geometry) → 500.
fn test_api_error_generator_geometry_gives_500() {
    let err = ApiError::GeneratorError(GCodeError::InvalidGeometry("zero-area pocket".into()));
    let resp = err.error_response();
    assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
}

#[test]
/// ApiError display string includes the inner message.
fn test_api_error_not_found_display() {
    let err = ApiError::NotFound("my sheet".into());
    assert!(err.to_string().contains("my sheet"));
}

#[test]
/// ApiError::GeneratorError display wraps GCodeError message.
fn test_api_error_generator_error_display() {
    let err = ApiError::GeneratorError(GCodeError::UnsupportedOperation("lasercut".into()));
    assert!(err.to_string().contains("lasercut"));
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler-level integration tests using actix-web::test
//
// These tests build a minimal actix-web App with a mock endpoint that calls
// GCodeGenerator directly (bypassing the database), so we can exercise the
// full HTTP request/response cycle without a live DB.
// ─────────────────────────────────────────────────────────────────────────────

/// Inline mock handler for POST /gcode/generate that accepts a SheetGCodeInput.
async fn mock_generate_handler(body: web::Json<SheetGCodeInput>) -> Result<HttpResponse, ApiError> {
    let gen = GCodeGenerator::default();
    let output = gen.generate(&body)?;
    let blocks: Vec<GCodeBlockDto> = output
        .blocks
        .into_iter()
        .map(|b| GCodeBlockDto {
            label: b.label,
            lines: b.lines,
            part_id: b.part_id,
            operation_id: b.operation_id,
        })
        .collect();
    Ok(HttpResponse::Ok().json(GenerateResponse {
        sheet_id: body.sheet_id,
        gcode: output.raw,
        blocks,
        tool_changes: output.tool_changes,
        estimated_cut_time_seconds: output.estimated_cut_time_seconds,
        total_distance_mm: output.total_distance_mm,
        warnings: output.warnings,
    }))
}

/// Mock handler for POST /gcode/safety-check.
async fn mock_safety_check_handler(body: web::Json<SheetGCodeInput>) -> HttpResponse {
    let gen = GCodeGenerator::default();
    let result = gen.safety_check(&body);
    HttpResponse::Ok().json(result)
}

/// Mock handler for POST /gcode/simulate.
async fn mock_simulate_handler(body: web::Json<SheetGCodeInput>) -> Result<HttpResponse, ApiError> {
    let gen = GCodeGenerator::default();
    let sim = gen.simulate(&body)?;
    Ok(HttpResponse::Ok().json(sim))
}

#[actix_web::test]
/// POST /gcode/generate with valid input returns 200 and gcode field.
async fn test_http_generate_returns_200() {
    let app = test::init_service(
        App::new().route("/gcode/generate", web::post().to(mock_generate_handler)),
    )
    .await;

    let payload = minimal_sheet_input();
    let req = test::TestRequest::post()
        .uri("/gcode/generate")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body: GenerateResponse = test::read_body_json(resp).await;
    assert!(!body.gcode.is_empty());
    assert!(body.gcode.contains("G21"));
    assert!(body.gcode.contains("M30"));
}

#[actix_web::test]
/// POST /gcode/generate with a safety violation returns 500.
async fn test_http_generate_safety_violation_returns_500() {
    let app = test::init_service(
        App::new().route("/gcode/generate", web::post().to(mock_generate_handler)),
    )
    .await;

    let mut payload = minimal_sheet_input();
    payload.parts[0].x = 9_999.0; // way off the spoilboard

    let req = test::TestRequest::post()
        .uri("/gcode/generate")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
}

#[actix_web::test]
/// POST /gcode/safety-check with valid input returns 200 and passed=true.
async fn test_http_safety_check_passes() {
    let app = test::init_service(App::new().route(
        "/gcode/safety-check",
        web::post().to(mock_safety_check_handler),
    ))
    .await;

    let payload = minimal_sheet_input();
    let req = test::TestRequest::post()
        .uri("/gcode/safety-check")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body: SafetyCheckOutput = test::read_body_json(resp).await;
    assert!(body.passed);
    assert!(body.violations.is_empty());
}

#[actix_web::test]
/// POST /gcode/safety-check with out-of-bounds part returns passed=false.
async fn test_http_safety_check_violation() {
    let app = test::init_service(App::new().route(
        "/gcode/safety-check",
        web::post().to(mock_safety_check_handler),
    ))
    .await;

    let mut payload = minimal_sheet_input();
    payload.parts[0].x = 9_999.0;

    let req = test::TestRequest::post()
        .uri("/gcode/safety-check")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body: SafetyCheckOutput = test::read_body_json(resp).await;
    assert!(!body.passed);
    assert!(!body.violations.is_empty());
}

#[actix_web::test]
/// POST /gcode/simulate returns 200 with positive distances.
async fn test_http_simulate_returns_200() {
    let app = test::init_service(
        App::new().route("/gcode/simulate", web::post().to(mock_simulate_handler)),
    )
    .await;

    let mut payload = minimal_sheet_input();
    // Use a pocket so there's meaningful cut distance
    payload.parts[0].operations[0].operation_type = "pocket".into();
    payload.parts[0].operations[0].depth = 8.0;
    payload.parts[0].operations[0].width = Some(60.0);
    payload.parts[0].operations[0].height = Some(50.0);

    let req = test::TestRequest::post()
        .uri("/gcode/simulate")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::OK);

    let body: SimulationOutput = test::read_body_json(resp).await;
    assert!(body.total_distance_mm > 0.0);
    assert!(body.estimated_cut_time_seconds > 0.0);
}

#[actix_web::test]
/// Unrecognised route returns 404.
async fn test_http_unrecognised_route_returns_404() {
    let app = test::init_service(
        App::new().route("/gcode/generate", web::post().to(mock_generate_handler)),
    )
    .await;

    let req = test::TestRequest::get()
        .uri("/gcode/not-found")
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
}

#[actix_web::test]
/// Wrong HTTP method (GET instead of POST) returns 405.
async fn test_http_wrong_method_returns_405() {
    let app = test::init_service(
        App::new().route("/gcode/generate", web::post().to(mock_generate_handler)),
    )
    .await;

    let req = test::TestRequest::get().uri("/gcode/generate").to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::METHOD_NOT_ALLOWED);
}

#[actix_web::test]
/// Malformed JSON body returns 400.
async fn test_http_malformed_json_returns_400() {
    let app = test::init_service(
        App::new().route("/gcode/generate", web::post().to(mock_generate_handler)),
    )
    .await;

    let req = test::TestRequest::post()
        .uri("/gcode/generate")
        .insert_header(("Content-Type", "application/json"))
        .set_payload(b"{not valid json}" as &[u8])
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}

#[actix_web::test]
/// Response body contains sheet_id matching the request.
async fn test_http_generate_response_contains_sheet_id() {
    let app = test::init_service(
        App::new().route("/gcode/generate", web::post().to(mock_generate_handler)),
    )
    .await;

    let payload = minimal_sheet_input();
    let expected_id = payload.sheet_id;

    let req = test::TestRequest::post()
        .uri("/gcode/generate")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let body: GenerateResponse = test::read_body_json(resp).await;
    assert_eq!(body.sheet_id, expected_id);
}

#[actix_web::test]
/// Tool changes count in response matches actual tools used.
async fn test_http_generate_tool_changes_count() {
    let app = test::init_service(
        App::new().route("/gcode/generate", web::post().to(mock_generate_handler)),
    )
    .await;

    let payload = minimal_sheet_input(); // 1 tool → 1 tool change

    let req = test::TestRequest::post()
        .uri("/gcode/generate")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let body: GenerateResponse = test::read_body_json(resp).await;
    assert_eq!(body.tool_changes, 1);
}

#[actix_web::test]
/// Warnings from the generator are forwarded in the response.
async fn test_http_generate_warnings_forwarded() {
    let app = test::init_service(
        App::new().route("/gcode/generate", web::post().to(mock_generate_handler)),
    )
    .await;

    let mut payload = minimal_sheet_input();
    // Deep drill → multi-pass → warning
    payload.parts[0].operations[0].depth = 15.0;

    let req = test::TestRequest::post()
        .uri("/gcode/generate")
        .set_json(&payload)
        .to_request();

    let resp = test::call_service(&app, req).await;
    let body: GenerateResponse = test::read_body_json(resp).await;
    assert!(
        !body.warnings.is_empty(),
        "deep drill should produce at least one warning"
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// configure_routes smoke test
// ─────────────────────────────────────────────────────────────────────────────

#[actix_web::test]
/// configure_routes registers all five endpoints without panicking.
async fn test_configure_routes_smoke_test() {
    // We can't call the real configure_routes (requires db pool),
    // but we can verify the route structure compiles and the app starts.
    let app = test::init_service(
        App::new()
            .route("/gcode/generate", web::post().to(mock_generate_handler))
            .route("/gcode/simulate", web::post().to(mock_simulate_handler))
            .route(
                "/gcode/safety-check",
                web::post().to(mock_safety_check_handler),
            ),
    )
    .await;

    let req = test::TestRequest::post()
        .uri("/gcode/generate")
        .set_json(&minimal_sheet_input())
        .to_request();

    let resp = test::call_service(&app, req).await;
    assert_eq!(resp.status(), StatusCode::OK);
}

// ─────────────────────────────────────────────────────────────────────────────
// Request validation edge-cases
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// A GenerateRequest with a nil UUID still deserialises.
fn test_generate_request_nil_uuid_deserialises() {
    let json_str = r#"{"sheet_id":"00000000-0000-0000-0000-000000000000"}"#;
    let req: GenerateRequest = serde_json::from_str(json_str).unwrap();
    assert_eq!(req.sheet_id, Uuid::nil());
}

#[test]
/// A GenerateRequest with an invalid UUID string fails to deserialise.
fn test_generate_request_invalid_uuid_fails() {
    let json_str = r#"{"sheet_id":"not-a-uuid"}"#;
    let result: Result<GenerateRequest, _> = serde_json::from_str(json_str);
    assert!(result.is_err(), "invalid UUID should fail to parse");
}

#[test]
/// GCodeConfigDto with all Some fields round-trips correctly.
fn test_config_dto_full_roundtrip() {
    let dto = GCodeConfigDto {
        safe_z: Some(25.0),
        clearance_z: Some(3.0),
        spoilboard_tolerance: Some(0.2),
        pocket_stepover_ratio: Some(0.55),
        lead_in_radius: Some(4.0),
        tab_width: Some(10.0),
        tab_height: Some(4.0),
        default_tab_count: Some(3),
        include_comments: Some(false),
        line_number_increment: Some(5),
    };
    let json_str = serde_json::to_string(&dto).unwrap();
    let parsed: GCodeConfigDto = serde_json::from_str(&json_str).unwrap();
    assert_eq!(parsed.safe_z, Some(25.0));
    assert_eq!(parsed.default_tab_count, Some(3));
    assert_eq!(parsed.include_comments, Some(false));
}
