//! Drawing-template CRUD handlers.
//!
//! Table
//! ─────
//!   drawing_templates (id, name, page_size, layout, title_block,
//!                       created_at, updated_at)
//!
//! Routes
//! ──────
//!   GET    /drawing-templates         — List all drawing templates
//!   GET    /drawing-templates/{id}    — Get one template
//!   POST   /drawing-templates         — Create a template
//!   PUT    /drawing-templates/{id}    — Update a template (partial update)
//!   DELETE /drawing-templates/{id}    — Delete a template

use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::drawing_template::{CreateDrawingTemplate, UpdateDrawingTemplate};

// ─── GET /drawing-templates ───────────────────────────────────────────────────

/// List all drawing templates, ordered by name.
#[get("/drawing-templates")]
pub async fn list_drawing_templates(pool: web::Data<PgPool>) -> impl Responder {
    let rows = sqlx::query!(
        r#"
        SELECT id, name, page_size, layout, title_block, created_at, updated_at
        FROM drawing_templates
        ORDER BY name
        "#
    )
    .fetch_all(pool.get_ref())
    .await;

    match rows {
        Err(e) => {
            log::error!("Failed to list drawing templates: {e}");
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to list drawing templates",
                "detail": e.to_string()
            }))
        }
        Ok(rows) => {
            let data: Vec<Value> = rows
                .into_iter()
                .map(|r| {
                    json!({
                        "id":          r.id,
                        "name":        r.name,
                        "page_size":   r.page_size,
                        "layout":      r.layout,
                        "title_block": r.title_block,
                        "created_at":  r.created_at,
                        "updated_at":  r.updated_at,
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

// ─── GET /drawing-templates/{id} ─────────────────────────────────────────────

/// Retrieve a single drawing template by UUID.
#[get("/drawing-templates/{id}")]
pub async fn get_drawing_template(pool: web::Data<PgPool>, id: web::Path<Uuid>) -> impl Responder {
    let template_id = *id;

    let row = sqlx::query!(
        r#"
        SELECT id, name, page_size, layout, title_block, created_at, updated_at
        FROM drawing_templates
        WHERE id = $1
        "#,
        template_id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match row {
        Err(e) => {
            log::error!("Failed to fetch drawing template {template_id}: {e}");
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Database error",
                "detail": e.to_string()
            }))
        }
        Ok(None) => HttpResponse::NotFound().json(json!({
            "status": "error",
            "message": format!("Drawing template {} not found", template_id)
        })),
        Ok(Some(r)) => HttpResponse::Ok().json(json!({
            "status": "ok",
            "data": {
                "id":          r.id,
                "name":        r.name,
                "page_size":   r.page_size,
                "layout":      r.layout,
                "title_block": r.title_block,
                "created_at":  r.created_at,
                "updated_at":  r.updated_at,
            }
        })),
    }
}

// ─── POST /drawing-templates ──────────────────────────────────────────────────

/// Create a new drawing template.
///
/// `page_size` should be a standard identifier such as `"A4"`, `"A3"`,
/// `"Letter"`, or `"Tabloid"`.
/// `layout` and `title_block` are free-form JSON objects.
#[post("/drawing-templates")]
pub async fn create_drawing_template(
    pool: web::Data<PgPool>,
    body: web::Json<CreateDrawingTemplate>,
) -> impl Responder {
    let dto = body.into_inner();
    let new_id = Uuid::new_v4();

    let result = sqlx::query!(
        r#"
        INSERT INTO drawing_templates
            (id, name, page_size, layout, title_block, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        "#,
        new_id,
        dto.name,
        dto.page_size,
        dto.layout,
        dto.title_block,
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Err(e) => {
            log::error!("Failed to create drawing template: {e}");
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to create drawing template",
                "detail": e.to_string()
            }))
        }
        Ok(_) => HttpResponse::Created().json(json!({
            "status": "ok",
            "message": "Drawing template created",
            "data": { "id": new_id }
        })),
    }
}

// ─── PUT /drawing-templates/{id} ─────────────────────────────────────────────

/// Partially update a drawing template.  Absent JSON fields are preserved.
#[put("/drawing-templates/{id}")]
pub async fn update_drawing_template(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    body: web::Json<UpdateDrawingTemplate>,
) -> impl Responder {
    let template_id = *id;
    let dto = body.into_inner();

    let result = sqlx::query!(
        r#"
        UPDATE drawing_templates SET
            name        = COALESCE($2, name),
            page_size   = COALESCE($3, page_size),
            layout      = COALESCE($4, layout),
            title_block = COALESCE($5, title_block),
            updated_at  = NOW()
        WHERE id = $1
        "#,
        template_id,
        dto.name,
        dto.page_size,
        dto.layout,
        dto.title_block,
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Err(e) => {
            log::error!("Failed to update drawing template {template_id}: {e}");
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to update drawing template",
                "detail": e.to_string()
            }))
        }
        Ok(r) if r.rows_affected() == 0 => HttpResponse::NotFound().json(json!({
            "status": "error",
            "message": format!("Drawing template {} not found", template_id)
        })),
        Ok(_) => HttpResponse::Ok().json(json!({
            "status":  "ok",
            "message": format!("Drawing template {} updated", template_id),
            "data":    { "id": template_id }
        })),
    }
}

// ─── DELETE /drawing-templates/{id} ──────────────────────────────────────────

/// Permanently delete a drawing template.
#[delete("/drawing-templates/{id}")]
pub async fn delete_drawing_template(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    let template_id = *id;

    let result = sqlx::query!("DELETE FROM drawing_templates WHERE id = $1", template_id)
        .execute(pool.get_ref())
        .await;

    match result {
        Err(e) => {
            log::error!("Failed to delete drawing template {template_id}: {e}");
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to delete drawing template",
                "detail": e.to_string()
            }))
        }
        Ok(r) if r.rows_affected() == 0 => HttpResponse::NotFound().json(json!({
            "status": "error",
            "message": format!("Drawing template {} not found", template_id)
        })),
        Ok(_) => HttpResponse::Ok().json(json!({
            "status":  "ok",
            "message": format!("Drawing template {} deleted", template_id),
            "data":    { "id": template_id }
        })),
    }
}

// ─── route registration ───────────────────────────────────────────────────────

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(list_drawing_templates)
        .service(get_drawing_template)
        .service(create_drawing_template)
        .service(update_drawing_template)
        .service(delete_drawing_template);
}
