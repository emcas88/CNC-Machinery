use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

/// List all drawing templates.
#[get("")]
pub async fn list_drawing_templates(_pool: web::Data<PgPool>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "List all drawing templates",
        "data": []
    }))
}

/// Get a single drawing template.
#[get("/{id}")]
pub async fn get_drawing_template(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Get drawing template {}", id)
    }))
}

/// Configure routes for the drawings module.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/drawings")
            .service(list_drawing_templates)
            .service(get_drawing_template),
    );
}
