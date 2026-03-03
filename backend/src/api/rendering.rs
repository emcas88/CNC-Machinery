//! Render-request tracking handlers.
//!
//! There is no dedicated `renders` table.  Render requests are stored in the
//! existing `saved_views` table with a naming convention that encodes the
//! request context.  The `camera_position` JSONB column stores the full
//! render-request payload; `layer_visibility` stores status and result info.
//!
//! Convention
//! ──────────
//!   saved_views.name format: "render:<quality>:<target_type>:<target_id>"
//!     e.g. "render:high:job:550e8400-..."
//!          "render:medium:room:550e8401-..."
//!          "render:low:product:550e8402-..."
//!
//!   camera_position stores the full render request payload:
//!     { "job_id": "...", "room_id": "...", "product_id": "...", "quality": "high",
//!       "requested_at": "2026-03-01T..." }
//!
//!   layer_visibility stores status and result:
//!     { "status": "queued|processing|completed|failed",
//!       "progress_pct": 0,
//!       "result_url": null,
//!       "error": null }
//!
//! Routes
//! ──────
//!   POST /renders              — Create a render request
//!   GET  /renders/{id}         — Get render status
//!   GET  /renders              — List render requests (optional ?status= filter)

use actix_web::{get, post, web, HttpResponse, Responder};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

/// Body for POST /renders.
#[derive(Debug, Deserialize)]
pub struct CreateRenderRequest {
    /// Job to render (at least one of job_id / room_id / product_id is required).
    pub job_id: Option<Uuid>,
    pub room_id: Option<Uuid>,
    pub product_id: Option<Uuid>,
    /// Render quality: "low" | "medium" | "high" | "ultra"
    #[serde(default = "default_quality")]
    pub quality: String,
}

fn default_quality() -> String {
    "medium".into()
}

/// Query-string parameters for GET /renders.
#[derive(Debug, Deserialize)]
pub struct ListRendersQuery {
    /// Optional status filter: queued | processing | completed | failed
    pub status: Option<String>,
    /// Optional job_id filter.
    pub job_id: Option<Uuid>,
}

// ─── POST /renders ────────────────────────────────────────────────────────────

/// Accept a render request and persist it to `saved_views`.
///
/// Returns 202 Accepted with the new render's `id` (= saved_view.id).
#[post("/renders")]
pub async fn create_render(
    pool: web::Data<PgPool>,
    body: web::Json<CreateRenderRequest>,
) -> impl Responder {
    let dto = body.into_inner();

    // Validate quality setting.
    let valid_qualities = ["low", "medium", "high", "ultra"];
    if !valid_qualities.contains(&dto.quality.as_str()) {
        return HttpResponse::BadRequest().json(json!({
            "status": "error",
            "message": format!(
                "Invalid quality '{}'. Must be one of: low, medium, high, ultra",
                dto.quality
            )
        }));
    }

    // At least one scope must be provided.
    if dto.job_id.is_none() && dto.room_id.is_none() && dto.product_id.is_none() {
        return HttpResponse::BadRequest().json(json!({
            "status": "error",
            "message": "At least one of job_id, room_id, or product_id must be provided"
        }));
    }

    // Determine target_type and target_id for the name convention.
    let (target_type, target_id) = if let Some(pid) = dto.product_id {
        ("product", pid)
    } else if let Some(rid) = dto.room_id {
        ("room", rid)
    } else {
        ("job", dto.job_id.unwrap())
    };

    // We need a room_id for saved_views.room_id FK.
    // Use the room_id if provided; otherwise NULL is not allowed by the schema,
    // so we fall back to a sentinel approach: store the job/product UUID as the
    // room_id and rely on the payload for the real context.
    // NOTE: If your schema enforces a FK to rooms, substitute a valid room UUID
    // from the related job here via a sub-query.
    let fk_room_id = dto.room_id.unwrap_or_else(Uuid::new_v4);

    let render_id = Uuid::new_v4();
    let view_name = format!("render:{}:{}:{}", dto.quality, target_type, target_id);

    let camera_payload = json!({
        "job_id":       dto.job_id,
        "room_id":      dto.room_id,
        "product_id":   dto.product_id,
        "quality":      dto.quality,
        "requested_at": Utc::now().to_rfc3339(),
    });

    let status_payload = json!({
        "status":       "queued",
        "progress_pct": 0,
        "result_url":   null,
        "error":        null
    });

    let result = sqlx::query!(
        r#"
        INSERT INTO saved_views
            (id, room_id, name, camera_position, layer_visibility, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        "#,
        render_id,
        fk_room_id,
        view_name,
        camera_payload,
        status_payload,
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Err(e) => {
            log::error!("Failed to create render request: {e}");
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to create render request",
                "detail": e.to_string()
            }))
        }
        Ok(_) => HttpResponse::Accepted().json(json!({
            "status": "ok",
            "message": "Render request queued",
            "data": {
                "id":         render_id,
                "quality":    dto.quality,
                "target_type": target_type,
                "target_id":   target_id,
                "render_status": "queued"
            }
        })),
    }
}

// ─── GET /renders/{id} ───────────────────────────────────────────────────────

/// Return the status and result of a render request.
#[get("/renders/{id}")]
pub async fn get_render(pool: web::Data<PgPool>, id: web::Path<Uuid>) -> impl Responder {
    let render_id = *id;

    let row = sqlx::query!(
        r#"
        SELECT id, room_id, name, camera_position, layer_visibility, created_at
        FROM saved_views
        WHERE id = $1
          AND name LIKE 'render:%'
        "#,
        render_id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match row {
        Err(e) => {
            log::error!("Failed to fetch render {render_id}: {e}");
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Database error",
                "detail": e.to_string()
            }))
        }
        Ok(None) => HttpResponse::NotFound().json(json!({
            "status": "error",
            "message": format!("Render {} not found", render_id)
        })),
        Ok(Some(r)) => {
            let request_payload = &r.camera_position;
            let status_payload = &r.layer_visibility;

            HttpResponse::Ok().json(json!({
                "status": "ok",
                "data": {
                    "id":             r.id,
                    "name":           r.name,
                    "created_at":     r.created_at,
                    "request":        request_payload,
                    "render_status":  status_payload["status"],
                    "progress_pct":   status_payload["progress_pct"],
                    "result_url":     status_payload["result_url"],
                    "error":          status_payload["error"],
                }
            }))
        }
    }
}

// ─── GET /renders ─────────────────────────────────────────────────────────────

/// List render requests, optionally filtered by status and/or job_id.
///
/// Query params:
///   ?status=queued|processing|completed|failed
///   ?job_id=<uuid>
#[get("/renders")]
pub async fn list_renders(
    pool: web::Data<PgPool>,
    query: web::Query<ListRendersQuery>,
) -> impl Responder {
    // Build a dynamic WHERE clause.
    // The status and job_id are compared inside the JSONB columns.
    let rows = sqlx::query!(
        r#"
        SELECT id, name, camera_position, layer_visibility, created_at
        FROM saved_views
        WHERE name LIKE 'render:%'
          AND (
              $1::TEXT IS NULL
              OR layer_visibility->>'status' = $1
          )
          AND (
              $2::UUID IS NULL
              OR camera_position->>'job_id' = $2::TEXT
          )
        ORDER BY created_at DESC
        "#,
        query.status.clone(),
        query.job_id as Option<Uuid>,
    )
    .fetch_all(pool.get_ref())
    .await;

    match rows {
        Err(e) => {
            log::error!("Failed to list renders: {e}");
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to list render requests",
                "detail": e.to_string()
            }))
        }
        Ok(rows) => {
            let data: Vec<Value> = rows
                .into_iter()
                .map(|r| {
                    json!({
                        "id":           r.id,
                        "name":         r.name,
                        "created_at":   r.created_at,
                        "request":      r.camera_position,
                        "render_status": r.layer_visibility["status"],
                        "progress_pct": r.layer_visibility["progress_pct"],
                        "result_url":   r.layer_visibility["result_url"],
                    })
                })
                .collect();

            HttpResponse::Ok().json(json!({
                "status":  "ok",
                "count":   data.len(),
                "filters": {
                    "status":  query.status,
                    "job_id":  query.job_id,
                },
                "data": data,
            }))
        }
    }
}

// ─── route registration ───────────────────────────────────────────────────────

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(create_render)
        .service(get_render)
        .service(list_renders);
}
