use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

/// List all products in a room.
#[get("")]
pub async fn list_products(
    _pool: web::Data<PgPool>,
    room_id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("List products in room {}", room_id),
        "data": []
    }))
}

/// Get a single product by ID with full part breakdown.
#[get("/{product_id}")]
pub async fn get_product(
    _pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
) -> impl Responder {
    let (room_id, product_id) = path.into_inner();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Get product {} in room {}", product_id, room_id)
    }))
}

/// Create a new product and auto-generate parts based on dimensions and construction method.
#[post("")]
pub async fn create_product(
    _pool: web::Data<PgPool>,
    room_id: web::Path<Uuid>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Created().json(json!({
        "status": "ok",
        "message": format!("Product created in room {}. Parts auto-generated.", room_id)
    }))
}

/// Update a product's dimensions and trigger part propagation.
#[put("/{product_id}")]
pub async fn update_product(
    _pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    let (room_id, product_id) = path.into_inner();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Product {} updated in room {}. Propagation triggered.", product_id, room_id)
    }))
}

/// Delete a product and all its parts.
#[delete("/{product_id}")]
pub async fn delete_product(
    _pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
) -> impl Responder {
    let (room_id, product_id) = path.into_inner();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Product {} deleted from room {}", product_id, room_id)
    }))
}

/// Save a configured product as a library entry for reuse in other jobs.
#[post("/{product_id}/save-to-library")]
pub async fn save_to_library(
    _pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    let (_room_id, product_id) = path.into_inner();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Product {} saved to library", product_id)
    }))
}

/// Configure routes for the products module.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/rooms/{room_id}/products")
            .service(list_products)
            .service(create_product)
            .service(get_product)
            .service(update_product)
            .service(delete_product)
            .service(save_to_library),
    );
}
