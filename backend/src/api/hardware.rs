use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

/// List all hardware items.
#[get("")]
pub async fn list_hardware(_pool: web::Data<PgPool>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "List all hardware",
        "data": []
    }))
}

/// Get a single hardware item.
#[get("/{id}")]
pub async fn get_hardware(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Get hardware {}", id)
    }))
}

/// Configure routes for the hardware module.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/hardware")
            .service(list_hardware)
            .service(get_hardware),
    );
}
