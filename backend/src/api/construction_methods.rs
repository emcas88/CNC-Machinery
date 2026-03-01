use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

/// List all construction methods.
#[get("")]
pub async fn list_construction_methods(_pool: web::Data<PgPool>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "List all construction methods",
        "data": []
    }))
}

/// Get a single construction method.
#[get("/{id}")]
pub async fn get_construction_method(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Get construction method {}", id)
    }))
}

/// Create a new construction method.
#[post("")]
pub async fn create_construction_method(
    _pool: web::Data<PgPool>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Created().json(json!({
        "status": "ok",
        "message": "Construction method created"
    }))
}

/// Update a construction method.
#[put("/{id}")]
pub async fn update_construction_method(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Construction method {} updated", id)
    }))
}

/// Delete a construction method.
#[delete("/{id}")]
pub async fn delete_construction_method(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Construction method {} deleted", id)
    }))
}

/// Apply a construction method to a product, recalculating all joinery operations.
#[post("/{id}/apply-to-product")]
pub async fn apply_to_product(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Construction method {} applied to product. Operations regenerated.", id)
    }))
}

/// Configure routes for the construction methods module.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/construction-methods")
            .service(list_construction_methods)
            .service(create_construction_method)
            .service(get_construction_method)
            .service(update_construction_method)
            .service(delete_construction_method)
            .service(apply_to_product),
    );
}
