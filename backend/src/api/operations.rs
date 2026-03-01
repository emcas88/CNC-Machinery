use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

/// List all operations for a part.
#[get("")]
pub async fn list_operations(
    _pool: web::Data<PgPool>,
    part_id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("List operations for part {}", part_id),
        "data": []
    }))
}

/// Get a single operation.
#[get("/{operation_id}")]
pub async fn get_operation(
    _pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
) -> impl Responder {
    let (part_id, operation_id) = path.into_inner();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Get operation {} on part {}", operation_id, part_id)
    }))
}

/// Create a new machining operation on a part.
#[post("")]
pub async fn create_operation(
    _pool: web::Data<PgPool>,
    part_id: web::Path<Uuid>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Created().json(json!({
        "status": "ok",
        "message": format!("Operation created on part {}", part_id)
    }))
}

/// Update an existing operation's parameters.
#[put("/{operation_id}")]
pub async fn update_operation(
    _pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    let (part_id, operation_id) = path.into_inner();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Operation {} updated on part {}", operation_id, part_id)
    }))
}

/// Delete an operation.
#[delete("/{operation_id}")]
pub async fn delete_operation(
    _pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
) -> impl Responder {
    let (part_id, operation_id) = path.into_inner();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Operation {} deleted from part {}", operation_id, part_id)
    }))
}

/// Configure routes for the operations module.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/parts/{part_id}/operations")
            .service(list_operations)
            .service(create_operation)
            .service(get_operation)
            .service(update_operation)
            .service(delete_operation),
    );
}
