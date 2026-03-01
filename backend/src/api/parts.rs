use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

/// List all parts for a product.
#[get("")]
pub async fn list_parts(
    _pool: web::Data<PgPool>,
    product_id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("List parts for product {}", product_id),
        "data": []
    }))
}

/// Get a single part with all its operations.
#[get("/{part_id}")]
pub async fn get_part(
    _pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
) -> impl Responder {
    let (product_id, part_id) = path.into_inner();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Get part {} in product {}", part_id, product_id)
    }))
}

/// Create a custom part manually (bypasses auto-generation).
#[post("")]
pub async fn create_part(
    _pool: web::Data<PgPool>,
    product_id: web::Path<Uuid>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Created().json(json!({
        "status": "ok",
        "message": format!("Custom part created for product {}", product_id)
    }))
}

/// Update a part's dimensions or material assignment.
#[put("/{part_id}")]
pub async fn update_part(
    _pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    let (product_id, part_id) = path.into_inner();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Part {} updated in product {}", part_id, product_id)
    }))
}

/// Delete a part.
#[delete("/{part_id}")]
pub async fn delete_part(
    _pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
) -> impl Responder {
    let (product_id, part_id) = path.into_inner();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Part {} deleted from product {}", part_id, product_id)
    }))
}

/// Open the custom part editor with detailed machining view for a part.
#[get("/{part_id}/editor")]
pub async fn get_part_editor(
    _pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
) -> impl Responder {
    let (_product_id, part_id) = path.into_inner();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Custom part editor data for part {}", part_id),
        "data": {
            "part": {},
            "available_tools": [],
            "machine_capabilities": {}
        }
    }))
}

/// Recalculate operations for a part based on current hardware and construction rules.
#[post("/{part_id}/recalculate")]
pub async fn recalculate_part(
    _pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
) -> impl Responder {
    let (_product_id, part_id) = path.into_inner();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Operations recalculated for part {}", part_id)
    }))
}

/// Configure routes for the parts module.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/products/{product_id}/parts")
            .service(list_parts)
            .service(create_part)
            .service(get_part)
            .service(update_part)
            .service(delete_part)
            .service(get_part_editor)
            .service(recalculate_part),
    );
}
