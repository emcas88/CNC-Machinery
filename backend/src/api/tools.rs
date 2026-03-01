use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

/// List all tools in the tool library.
#[get("")]
pub async fn list_tools(_pool: web::Data<PgPool>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "List all tools",
        "data": []
    }))
}

/// Get a single tool.
#[get("/{id}")]
pub async fn get_tool(_pool: web::Data<PgPool>, id: web::Path<Uuid>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Get tool {}", id)
    }))
}

/// Create a new tool definition.
#[post("")]
pub async fn create_tool(
    _pool: web::Data<PgPool>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Created().json(json!({
        "status": "ok",
        "message": "Tool created"
    }))
}

/// Update a tool's parameters.
#[put("/{id}")]
pub async fn update_tool(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Tool {} updated", id)
    }))
}

/// Delete a tool.
#[delete("/{id}")]
pub async fn delete_tool(_pool: web::Data<PgPool>, id: web::Path<Uuid>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Tool {} deleted", id)
    }))
}

/// Configure routes for the tools module.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/tools")
            .service(list_tools)
            .service(create_tool)
            .service(get_tool)
            .service(update_tool)
            .service(delete_tool),
    );
}
