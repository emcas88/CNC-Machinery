//! Label-template CRUD and job-label generation handlers.
//!
//! Table
//! ─────
//!   label_templates (id, name, width, height, fields, created_at, updated_at)
//!
//! Routes
//! ──────
//!   GET    /label-templates              — List all templates
//!   GET    /label-templates/{id}         — Get one template
//!   POST   /label-templates              — Create a template
//!   PUT    /label-templates/{id}         — Update a template
//!   DELETE /label-templates/{id}         — Delete a template
//!   GET    /jobs/{job_id}/labels         — Generate label data for all parts
//!                                          in a job (aggregated from parts table)

use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::label_template::{CreateLabelTemplate, UpdateLabelTemplate};

// ─── GET /label-templates ─────────────────────────────────────────────────────

/// List every label template ordered by name.
#[get("/label-templates")]
pub async fn list_label_templates(pool: web::Data<PgPool>) -> impl Responder {
    let rows = sqlx::query!(
        r#"
        SELECT id, name, width, height, fields, created_at, updated_at
        FROM label_templates
        ORDER BY name
        "#
    )
    .fetch_all(pool.get_ref())
    .await;

    match rows {
        Err(e) => {
            log::error!("Failed to list label templates: {e}");
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to list label templates",
                "detail": e.to_string()
            }))
        }
        Ok(rows) => {
            let data: Vec<Value> = rows
                .into_iter()
                .map(|r| {
                    json!({
                        "id":         r.id,
                        "name":       r.name,
                        "width":      r.width,
                        "height":     r.height,
                        "fields":     r.fields,
                        "created_at": r.created_at,
                        "updated_at": r.updated_at,
                    })
                })
                .collect();

            HttpResponse::Ok().json(json!({
                "status": "ok",
                "count":  data.len(),
                "data":   data,
            }))
        }
    }
}

// ─── GET /label-templates/{id} ───────────────────────────────────────────────

/// Retrieve a single label template by UUID.
#[get("/label-templates/{id}")]
pub async fn get_label_template(pool: web::Data<PgPool>, id: web::Path<Uuid>) -> impl Responder {
    let template_id = *id;

    let row = sqlx::query!(
        r#"
        SELECT id, name, width, height, fields, created_at, updated_at
        FROM label_templates
        WHERE id = $1
        "#,
        template_id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match row {
        Err(e) => {
            log::error!("Failed to fetch label template {template_id}: {e}");
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Database error",
                "detail": e.to_string()
            }))
        }
        Ok(None) => HttpResponse::NotFound().json(json!({
            "status": "error",
            "message": format!("Label template {} not found", template_id)
        })),
        Ok(Some(r)) => HttpResponse::Ok().json(json!({
            "status": "ok",
            "data": {
                "id":         r.id,
                "name":       r.name,
                "width":      r.width,
                "height":     r.height,
                "fields":     r.fields,
                "created_at": r.created_at,
                "updated_at": r.updated_at,
            }
        })),
    }
}

// ─── POST /label-templates ────────────────────────────────────────────────────

/// Create a new label template.
#[post("/label-templates")]
pub async fn create_label_template(
    pool: web::Data<PgPool>,
    body: web::Json<CreateLabelTemplate>,
) -> impl Responder {
    let dto = body.into_inner();
    let new_id = Uuid::new_v4();

    let result = sqlx::query!(
        r#"
        INSERT INTO label_templates (id, name, width, height, fields, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        "#,
        new_id,
        dto.name,
        dto.width_mm,
        dto.height_mm,
        dto.fields,
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Err(e) => {
            log::error!("Failed to create label template: {e}");
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to create label template",
                "detail": e.to_string()
            }))
        }
        Ok(_) => HttpResponse::Created().json(json!({
            "status": "ok",
            "message": "Label template created",
            "data": { "id": new_id }
        })),
    }
}

// ─── PUT /label-templates/{id} ───────────────────────────────────────────────

/// Update an existing label template.  Only provided fields are changed.
#[put("/label-templates/{id}")]
pub async fn update_label_template(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    body: web::Json<UpdateLabelTemplate>,
) -> impl Responder {
    let template_id = *id;
    let dto = body.into_inner();

    let result = sqlx::query!(
        r#"
        UPDATE label_templates SET
            name       = COALESCE($2, name),
            width      = COALESCE($3, width),
            height     = COALESCE($4, height),
            fields     = COALESCE($5, fields),
            updated_at = NOW()
        WHERE id = $1
        "#,
        template_id,
        dto.name,
        dto.width_mm,
        dto.height_mm,
        dto.fields,
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Err(e) => {
            log::error!("Failed to update label template {template_id}: {e}");
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to update label template",
                "detail": e.to_string()
            }))
        }
        Ok(r) if r.rows_affected() == 0 => HttpResponse::NotFound().json(json!({
            "status": "error",
            "message": format!("Label template {} not found", template_id)
        })),
        Ok(_) => HttpResponse::Ok().json(json!({
            "status":  "ok",
            "message": format!("Label template {} updated", template_id),
            "data":    { "id": template_id }
        })),
    }
}

// ─── DELETE /label-templates/{id} ────────────────────────────────────────────

/// Permanently delete a label template.
#[delete("/label-templates/{id}")]
pub async fn delete_label_template(pool: web::Data<PgPool>, id: web::Path<Uuid>) -> impl Responder {
    let template_id = *id;

    let result = sqlx::query!("DELETE FROM label_templates WHERE id = $1", template_id)
        .execute(pool.get_ref())
        .await;

    match result {
        Err(e) => {
            log::error!("Failed to delete label template {template_id}: {e}");
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to delete label template",
                "detail": e.to_string()
            }))
        }
        Ok(r) if r.rows_affected() == 0 => HttpResponse::NotFound().json(json!({
            "status": "error",
            "message": format!("Label template {} not found", template_id)
        })),
        Ok(_) => HttpResponse::Ok().json(json!({
            "status":  "ok",
            "message": format!("Label template {} deleted", template_id),
            "data":    { "id": template_id }
        })),
    }
}

// ─── GET /jobs/{job_id}/labels ────────────────────────────────────────────────

/// Generate label data for every part in a job.
///
/// Each label record contains all data required to print a shop-floor part
/// label: dimensions, material, edge banding, room/product context, and a
/// barcode payload (the part UUID as a string).
///
/// Response shape:
/// ```json
/// {
///   "status": "ok",
///   "job_id": "<uuid>",
///   "count": 42,
///   "labels": [
///     {
///       "part_id":       "<uuid>",   // barcode_data
///       "part_name":     "Left Side",
///       "part_type":     "side",
///       "room_name":     "Kitchen",
///       "product_name":  "Upper Cabinet 600",
///       "material_name": "White Melamine",
///       "cutlist_name":  "W/M 18",
///       "length":        720.0,
///       "width":         560.0,
///       "thickness":     18.0,
///       "grain_direction": "vertical",
///       "edge_band_top":   1,
///       "edge_band_bottom": null,
///       "edge_band_left":  1,
///       "edge_band_right": null,
///       "barcode_data":  "<part-uuid-string>"
///     }
///   ]
/// }
/// ```
#[get("/jobs/{job_id}/labels")]
pub async fn get_job_labels(pool: web::Data<PgPool>, job_id: web::Path<Uuid>) -> impl Responder {
    let job_id = *job_id;

    let rows = sqlx::query!(
        r#"
        SELECT
            p.id                    AS part_id,
            p.name                  AS part_name,
            p.part_type::TEXT       AS part_type,
            p.length,
            p.width,
            p.thickness,
            p.grain_direction::TEXT AS grain_direction,
            p.edge_band_top,
            p.edge_band_bottom,
            p.edge_band_left,
            p.edge_band_right,
            m.name                  AS material_name,
            m.cutlist_name,
            pr.name                 AS product_name,
            r.name                  AS room_name
        FROM jobs j
        JOIN rooms      r  ON r.job_id     = j.id
        JOIN products   pr ON pr.room_id   = r.id
        JOIN parts      p  ON p.product_id = pr.id
        JOIN materials  m  ON m.id         = p.material_id
        WHERE j.id = $1
        ORDER BY r.name, pr.name, p.name
        "#,
        job_id
    )
    .fetch_all(pool.get_ref())
    .await;

    match rows {
        Err(e) => {
            log::error!("Failed to generate labels for job {job_id}: {e}");
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to generate label data",
                "detail": e.to_string()
            }))
        }
        Ok(rows) => {
            let labels: Vec<Value> = rows
                .iter()
                .map(|r| {
                    json!({
                        "part_id":          r.part_id,
                        "part_name":        r.part_name,
                        "part_type":        r.part_type,
                        "room_name":        r.room_name,
                        "product_name":     r.product_name,
                        "material_name":    r.material_name,
                        "cutlist_name":     r.cutlist_name,
                        "length":           r.length,
                        "width":            r.width,
                        "thickness":        r.thickness,
                        "grain_direction":  r.grain_direction,
                        "edge_band_top":    r.edge_band_top,
                        "edge_band_bottom": r.edge_band_bottom,
                        "edge_band_left":   r.edge_band_left,
                        "edge_band_right":  r.edge_band_right,
                        // barcode_data is the part UUID encoded as a string;
                        // scanners/printers use this to identify the physical part.
                        "barcode_data":     r.part_id.to_string(),
                    })
                })
                .collect();

            HttpResponse::Ok().json(json!({
                "status": "ok",
                "job_id": job_id,
                "count":  labels.len(),
                "labels": labels,
            }))
        }
    }
}

// ─── route registration ───────────────────────────────────────────────────────

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(list_label_templates)
        .service(get_label_template)
        .service(create_label_template)
        .service(update_label_template)
        .service(delete_label_template)
        .service(get_job_labels);
}
