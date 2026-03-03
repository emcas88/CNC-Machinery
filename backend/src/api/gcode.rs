//! # G-code API Handlers
//!
//! Actix-web request handlers for all G-code endpoints.
//! The handlers are fully typed, use proper DTOs, and delegate all logic to
//! [`crate::services::gcode_generator::GCodeGenerator`].
//!
//! ## Endpoints
//! | Method | Path                          | Description                          |
//! |--------|-------------------------------|--------------------------------------|
//! | POST   | /gcode/generate               | Generate G-code for a nested sheet   |
//! | POST   | /gcode/simulate               | Simulate toolpath (time/distance)    |
//! | POST   | /gcode/safety-check           | Run safety validation only           |
//! | POST   | /gcode/spoilboard-resurface   | Generate spoilboard resurfacing prog |
//! | GET    | /gcode/export/{sheet_id}      | Download G-code as a file            |

use actix_web::{
    get, post,
    web::{self, Data, Json, Path},
    HttpRequest, HttpResponse, ResponseError,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

// Re-export the generator types from the services module.
// When integrated into the project the path will be:
//   use crate::services::gcode_generator::{...};
// For the standalone file we reference them inline – replace the `use` path
// as appropriate when integrating.
use crate::services::gcode_generator::{
    GCodeConfig, GCodeError, GCodeGenerator, MachineInput, OperationInput, PlacedPartInput,
    PostProcessorInput, SafetyCheckOutput, SheetGCodeInput, SimulationOutput, ToolInput,
};

// ─────────────────────────────────────────────────────────────────────────────
// Error type
// ─────────────────────────────────────────────────────────────────────────────

/// API-level error wrapper.
#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("G-code generation failed: {0}")]
    GeneratorError(#[from] GCodeError),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),
}

impl ResponseError for ApiError {
    fn error_response(&self) -> HttpResponse {
        let body = serde_json::json!({ "error": self.to_string() });
        match self {
            ApiError::NotFound(_) => HttpResponse::NotFound().json(body),
            ApiError::BadRequest(_) => HttpResponse::BadRequest().json(body),
            _ => HttpResponse::InternalServerError().json(body),
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Request / Response DTOs
// ─────────────────────────────────────────────────────────────────────────────

/// Optional generator configuration knobs that callers may override.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GCodeConfigDto {
    pub safe_z: Option<f64>,
    pub clearance_z: Option<f64>,
    pub spoilboard_tolerance: Option<f64>,
    pub pocket_stepover_ratio: Option<f64>,
    pub lead_in_radius: Option<f64>,
    pub tab_width: Option<f64>,
    pub tab_height: Option<f64>,
    pub default_tab_count: Option<usize>,
    pub include_comments: Option<bool>,
    pub line_number_increment: Option<u32>,
}

impl GCodeConfigDto {
    /// Merge caller overrides into a default `GCodeConfig`.
    pub fn into_config(self) -> GCodeConfig {
        let mut cfg = GCodeConfig::default();
        if let Some(v) = self.safe_z {
            cfg.safe_z = v;
        }
        if let Some(v) = self.clearance_z {
            cfg.clearance_z = v;
        }
        if let Some(v) = self.spoilboard_tolerance {
            cfg.spoilboard_tolerance = v;
        }
        if let Some(v) = self.pocket_stepover_ratio {
            cfg.pocket_stepover_ratio = v;
        }
        if let Some(v) = self.lead_in_radius {
            cfg.lead_in_radius = v;
        }
        if let Some(v) = self.tab_width {
            cfg.tab_width = v;
        }
        if let Some(v) = self.tab_height {
            cfg.tab_height = v;
        }
        if let Some(v) = self.default_tab_count {
            cfg.default_tab_count = v;
        }
        if let Some(v) = self.include_comments {
            cfg.include_comments = v;
        }
        if let Some(v) = self.line_number_increment {
            cfg.line_number_increment = v;
        }
        cfg
    }
}

// ── Generate ──────────────────────────────────────────────────────────────────

/// Request body for `POST /gcode/generate`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateRequest {
    /// The sheet UUID to generate G-code for.
    pub sheet_id: Uuid,
    /// Optional config overrides.
    #[serde(default)]
    pub config: GCodeConfigDto,
}

/// Response body for `POST /gcode/generate`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateResponse {
    pub sheet_id: Uuid,
    /// Raw G-code string.
    pub gcode: String,
    /// Structured blocks for UI display.
    pub blocks: Vec<GCodeBlockDto>,
    pub tool_changes: i32,
    pub estimated_cut_time_seconds: f64,
    pub total_distance_mm: f64,
    pub warnings: Vec<String>,
}

/// Serialisable block (mirrors the engine's GCodeBlock).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GCodeBlockDto {
    pub label: String,
    pub lines: Vec<String>,
    pub part_id: Option<Uuid>,
    pub operation_id: Option<Uuid>,
}

// ── Simulate ──────────────────────────────────────────────────────────────────

/// Request body for `POST /gcode/simulate`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulateRequest {
    pub sheet_id: Uuid,
    #[serde(default)]
    pub config: GCodeConfigDto,
}

// ── Safety check ───────────────────────────────────────────────────────────────

/// Request body for `POST /gcode/safety-check`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyCheckRequest {
    pub sheet_id: Uuid,
    #[serde(default)]
    pub config: GCodeConfigDto,
}

// ── Spoilboard resurface ───────────────────────────────────────────────────────

/// Request body for `POST /gcode/spoilboard-resurface`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpoilboardResurfaceRequest {
    pub machine_id: Uuid,
    /// Tool diameter in mm (facing cutter).
    pub tool_diameter: f64,
    /// RPM for the facing operation.
    pub rpm: i32,
    /// Feed rate in mm/min.
    pub feed_rate: f64,
    /// Plunge rate in mm/min.
    pub plunge_rate: f64,
    /// Depth of resurfacing cut in mm (typically 0.3–1.0 mm).
    pub cut_depth: f64,
    #[serde(default)]
    pub config: GCodeConfigDto,
}

/// Response for the spoilboard resurfacing endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpoilboardResurfaceResponse {
    pub gcode: String,
    pub estimated_cut_time_seconds: f64,
    pub total_distance_mm: f64,
    pub warnings: Vec<String>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Database helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Load everything needed to generate G-code for a sheet from the database.
///
/// Pulls: sheet metadata, all placed parts, all operations per part, tools,
/// machine config, and optional post-processor.
async fn load_sheet_input(pool: &PgPool, sheet_id: Uuid) -> Result<SheetGCodeInput, ApiError> {
    // ── Sheet ──────────────────────────────────────────────────────────────────────
    let sheet_row = sqlx::query!(
        r#"
        SELECT id, width, length, material_thickness, program_name, material,
               machine_id
          FROM sheets
         WHERE id = $1
        "#,
        sheet_id
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound(format!("Sheet {} not found", sheet_id)))?;

    // ── Machine ────────────────────────────────────────────────────────────────────
    let machine_row = sqlx::query!(
        r#"
        SELECT id, name, spoilboard_width, spoilboard_length, spoilboard_thickness,
               post_processor_id
          FROM machines
         WHERE id = $1
        "#,
        sheet_row.machine_id
    )
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| ApiError::NotFound(format!("Machine for sheet {} not found", sheet_id)))?;

    let machine_input = MachineInput {
        name: machine_row.name.clone(),
        spoilboard_width: machine_row.spoilboard_width,
        spoilboard_length: machine_row.spoilboard_length,
        spoilboard_thickness: machine_row.spoilboard_thickness,
    };

    // ── Post-processor (optional) ─────────────────────────────────────────────────
    let post_processor = if let Some(pp_id) = machine_row.post_processor_id {
        let pp = sqlx::query!(
            r#"
            SELECT name, output_format, template_content, variables, machine_type
              FROM post_processors
             WHERE id = $1
            "#,
            pp_id
        )
        .fetch_optional(pool)
        .await?;

        pp.map(|row| PostProcessorInput {
            name: row.name,
            output_format: row.output_format,
            template_content: row.template_content,
            variables: row.variables,
        })
    } else {
        None
    };

    // ── Collect all tool UUIDs used by ops on this sheet ───────────────
    // We build a deduplicated list ordered by first appearance so tool_index
    // stays stable and minimal.
    let tool_id_rows = sqlx::query!(
        r#"
        SELECT DISTINCT o.tool_id
          FROM part_placements pp
          JOIN operations o ON o.part_id = pp.part_id
         WHERE pp.sheet_id = $1
           AND o.tool_id IS NOT NULL
         ORDER BY o.tool_id
        "#,
        sheet_id
    )
    .fetch_all(pool)
    .await?;

    let tool_ids: Vec<Uuid> = tool_id_rows.into_iter().filter_map(|r| r.tool_id).collect();

    // Map tool UUID → index into the tools vec.
    let tool_index_map: std::collections::HashMap<Uuid, usize> = tool_ids
        .iter()
        .enumerate()
        .map(|(i, id)| (*id, i))
        .collect();

    // Load tool rows.
    let mut tools: Vec<ToolInput> = Vec::new();
    for tool_id in &tool_ids {
        let t = sqlx::query!(
            r#"
            SELECT name, diameter, rpm, feed_rate, plunge_rate, max_depth_per_pass
              FROM tools
             WHERE id = $1
            "#,
            tool_id
        )
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Tool {} not found", tool_id)))?;

        tools.push(ToolInput {
            name: t.name,
            diameter: t.diameter,
            rpm: t.rpm,
            feed_rate: t.feed_rate,
            plunge_rate: t.plunge_rate,
            max_depth_per_pass: t.max_depth_per_pass,
        });
    }

    // Fallback: if no tools have been assigned yet, provide a sensible default
    // so the API doesn't return an empty tool list error.
    if tools.is_empty() {
        tools.push(ToolInput {
            name: "Default 12mm Compression".into(),
            diameter: 12.0,
            rpm: 18000,
            feed_rate: 6000.0,
            plunge_rate: 1500.0,
            max_depth_per_pass: 6.0,
        });
    }

    // ── Parts + placements ────────────────────────────────────────────────────────
    let placement_rows = sqlx::query!(
        r#"
        SELECT pp.id AS placement_id,
               pp.part_id,
               pp.x, pp.y,
               pp.rotated,
               p.name,
               p.length,
               p.width
          FROM part_placements pp
          JOIN parts p ON p.id = pp.part_id
         WHERE pp.sheet_id = $1
         ORDER BY pp.y, pp.x
        "#,
        sheet_id
    )
    .fetch_all(pool)
    .await?;

    let mut parts: Vec<PlacedPartInput> = Vec::new();
    for row in placement_rows {
        // Load operations for this part.
        let op_rows = sqlx::query!(
            r#"
            SELECT id, operation_type, position_x, position_y, depth,
                   width, height, tool_id, side, parameters
              FROM operations
             WHERE part_id = $1
             ORDER BY position_y, position_x
            "#,
            row.part_id
        )
        .fetch_all(pool)
        .await?;

        let mut operations: Vec<OperationInput> = Vec::new();
        for op in op_rows {
            // Resolve tool_index; if no tool assigned fall back to index 0.
            let tool_index = op
                .tool_id
                .and_then(|tid| tool_index_map.get(&tid).copied())
                .unwrap_or(0);

            operations.push(OperationInput {
                id: op.id,
                operation_type: op.operation_type.to_lowercase(),
                position_x: op.position_x,
                position_y: op.position_y,
                depth: op.depth,
                width: op.width,
                height: op.height,
                tool_index,
                side: op.side.unwrap_or_else(|| "top".to_string()).to_lowercase(),
                parameters: op.parameters,
            });
        }

        parts.push(PlacedPartInput {
            part_id: row.part_id.expect("part_placement must reference a part"),
            name: row.name,
            x: row.x,
            y: row.y,
            length: row.length,
            width: row.width,
            rotated: row.rotated,
            operations,
        });
    }

    Ok(SheetGCodeInput {
        sheet_id,
        sheet_width: sheet_row.width,
        sheet_length: sheet_row.length,
        material_thickness: sheet_row.material_thickness,
        parts,
        machine: machine_input,
        tools,
        post_processor,
        program_name: sheet_row.program_name,
        material: sheet_row.material,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handlers
// ─────────────────────────────────────────────────────────────────────────────

/// `POST /gcode/generate`
///
/// Generate complete G-code for a nested sheet identified by `sheet_id`.
/// The generator loads the sheet, its parts, and their operations from the
/// database, runs the full generation pipeline, and returns the G-code along
/// with toolpath statistics.
#[post("/gcode/generate")]
pub async fn generate_gcode(
    pool: Data<PgPool>,
    req: Json<GenerateRequest>,
) -> Result<HttpResponse, ApiError> {
    let input = load_sheet_input(&pool, req.sheet_id).await?;
    let config = req.config.clone().into_config();
    let generator = GCodeGenerator::new(config);

    let output = generator.generate(&input)?;

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
        sheet_id: req.sheet_id,
        gcode: output.raw,
        blocks,
        tool_changes: output.tool_changes,
        estimated_cut_time_seconds: output.estimated_cut_time_seconds,
        total_distance_mm: output.total_distance_mm,
        warnings: output.warnings,
    }))
}

/// `POST /gcode/simulate`
///
/// Simulate the toolpath for a sheet and return time/distance statistics
/// without generating the full G-code string.
#[post("/gcode/simulate")]
pub async fn simulate_toolpath(
    pool: Data<PgPool>,
    req: Json<SimulateRequest>,
) -> Result<HttpResponse, ApiError> {
    let input = load_sheet_input(&pool, req.sheet_id).await?;
    let config = req.config.clone().into_config();
    let generator = GCodeGenerator::new(config);

    let sim = generator.simulate(&input)?;
    Ok(HttpResponse::Ok().json(sim))
}

/// `POST /gcode/safety-check`
///
/// Run only the safety validation checks for a sheet.
/// Returns a structured list of violations and warnings without generating any G-code.
#[post("/gcode/safety-check")]
pub async fn safety_check(
    pool: Data<PgPool>,
    req: Json<SafetyCheckRequest>,
) -> Result<HttpResponse, ApiError> {
    let input = load_sheet_input(&pool, req.sheet_id).await?;
    let config = req.config.clone().into_config();
    let generator = GCodeGenerator::new(config);

    let result = generator.safety_check(&input);
    Ok(HttpResponse::Ok().json(result))
}

/// `POST /gcode/spoilboard-resurface`
///
/// Generate a spoilboard resurfacing G-code program for a given machine.
/// Uses a large-diameter facing tool making parallel raster passes.
#[post("/gcode/spoilboard-resurface")]
pub async fn spoilboard_resurface(
    pool: Data<PgPool>,
    req: Json<SpoilboardResurfaceRequest>,
) -> Result<HttpResponse, ApiError> {
    // Load machine info for spoilboard dimensions.
    let machine_row = sqlx::query!(
        r#"
        SELECT name, spoilboard_width, spoilboard_length, spoilboard_thickness
          FROM machines
         WHERE id = $1
        "#,
        req.machine_id
    )
    .fetch_optional(&**pool)
    .await?
    .ok_or_else(|| ApiError::NotFound(format!("Machine {} not found", req.machine_id)))?;

    let machine = MachineInput {
        name: machine_row.name,
        spoilboard_width: machine_row.spoilboard_width,
        spoilboard_length: machine_row.spoilboard_length,
        spoilboard_thickness: machine_row.spoilboard_thickness,
    };

    let facing_tool = ToolInput {
        name: format!("Ø{:.0}mm Facing Cutter", req.tool_diameter),
        diameter: req.tool_diameter,
        rpm: req.rpm,
        feed_rate: req.feed_rate,
        plunge_rate: req.plunge_rate,
        max_depth_per_pass: req.cut_depth, // single-pass facing
    };

    let config = req.config.clone().into_config();
    let generator = GCodeGenerator::new(config);
    let output = generator.generate_spoilboard_resurface(&machine, &facing_tool, req.cut_depth)?;

    Ok(HttpResponse::Ok().json(SpoilboardResurfaceResponse {
        gcode: output.raw,
        estimated_cut_time_seconds: output.estimated_cut_time_seconds,
        total_distance_mm: output.total_distance_mm,
        warnings: output.warnings,
    }))
}

/// `GET /gcode/export/{sheet_id}`
///
/// Download the generated G-code as a file attachment.
/// Calls `load_sheet_input` + `generate` then streams the result as
/// `Content-Disposition: attachment`.
#[get("/gcode/export/{sheet_id}")]
pub async fn export_gcode(
    pool: Data<PgPool>,
    path: Path<Uuid>,
    _req: HttpRequest,
) -> Result<HttpResponse, ApiError> {
    let sheet_id = path.into_inner();
    let input = load_sheet_input(&pool, sheet_id).await?;
    let generator = GCodeGenerator::default();
    let output = generator.generate(&input)?;

    // Use the program name (if available) as the filename.
    let filename = input
        .program_name
        .clone()
        .unwrap_or_else(|| format!("sheet_{}", sheet_id))
        .replace(' ', "_")
        + ".nc";

    Ok(HttpResponse::Ok()
        .insert_header(("Content-Type", "text/plain; charset=utf-8"))
        .insert_header((
            "Content-Disposition",
            format!("attachment; filename=\"{}\"", filename),
        ))
        .body(output.raw))
}

// ─────────────────────────────────────────────────────────────────────────────
// Actix-web scope registration helper
// ─────────────────────────────────────────────────────────────────────────────

/// Register all G-code routes on the provided `ServiceConfig`.
///
/// Call from `main.rs` like:
/// ```rust
/// app.configure(gcode::configure_routes);
/// ```
pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(generate_gcode)
        .service(simulate_toolpath)
        .service(safety_check)
        .service(spoilboard_resurface)
        .service(export_gcode);
}
