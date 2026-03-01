use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

/// List all materials in the library.
#[get("")]
pub async fn list_materials(_pool: web::Data<PgPool>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "List all materials",
        "data": []
    }))
}

/// Get a single material by ID.
#[get("/{id}")]
pub async fn get_material(_pool: web::Data<PgPool>, id: web::Path<Uuid>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Get material {}", id)
    }))
}

/// Create a new material definition.
#[post("")]
pub async fn create_material(
    _pool: web::Data<PgPool>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Created().json(json!({
        "status": "ok",
        "message": "Material created"
    }))
}

/// Update a material definition.
#[put("/{id}")]
pub async fn update_material(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Material {} updated", id)
    }))
}

/// Delete a material from the library.
#[delete("/{id}")]
pub async fn delete_material(_pool: web::Data<PgPool>, id: web::Path<Uuid>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Material {} deleted", id)
    }))
}

/// Get all material templates (part_type -> material_id mappings).
#[get("/templates")]
pub async fn list_material_templates(_pool: web::Data<PgPool>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "List all material templates",
        "data": []
    }))
}

/// Resolve the effective material for a part given the override hierarchy.
#[post("/resolve")]
pub async fn resolve_material(
    _pool: web::Data<PgPool>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "Resolved effective material for part based on override hierarchy",
        "data": {
            "resolved_material_id": null,
            "resolution_source": "job_default"
        }
    }))
}

/// Configure routes for the materials module.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/materials")
            .service(list_material_templates)
            .service(resolve_material)
            .service(list_materials)
            .service(create_material)
            .service(get_material)
            .service(update_material)
            .service(delete_material),
    );
}
