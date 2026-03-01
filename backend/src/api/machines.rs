use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

/// List all machines.
#[get("")]
pub async fn list_machines(_pool: web::Data<PgPool>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "List all machines",
        "data": []
    }))
}

/// Get a single machine with its tool magazine and ATC sets.
#[get("/{id}")]
pub async fn get_machine(_pool: web::Data<PgPool>, id: web::Path<Uuid>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Get machine {}", id)
    }))
}

/// Create a new machine.
#[post("")]
pub async fn create_machine(
    _pool: web::Data<PgPool>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Created().json(json!({
        "status": "ok",
        "message": "Machine created"
    }))
}

/// Update a machine's configuration.
#[put("/{id}")]
pub async fn update_machine(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Machine {} updated", id)
    }))
}

/// Delete a machine.
#[delete("/{id}")]
pub async fn delete_machine(_pool: web::Data<PgPool>, id: web::Path<Uuid>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Machine {} deleted", id)
    }))
}

/// Update the tool magazine configuration for a machine.
#[put("/{id}/tool-magazine")]
pub async fn update_tool_magazine(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Tool magazine updated for machine {}", id)
    }))
}

/// List all ATC tool sets for a machine.
#[get("/{id}/atc-tool-sets")]
pub async fn list_atc_tool_sets(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("ATC tool sets for machine {}", id),
        "data": []
    }))
}

/// Create a new ATC tool set for a machine.
#[post("/{id}/atc-tool-sets")]
pub async fn create_atc_tool_set(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Created().json(json!({
        "status": "ok",
        "message": format!("ATC tool set created for machine {}", id)
    }))
}

/// Configure routes for the machines module.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/machines")
            .service(list_machines)
            .service(create_machine)
            .service(get_machine)
            .service(update_machine)
            .service(delete_machine)
            .service(update_tool_magazine)
            .service(list_atc_tool_sets)
            .service(create_atc_tool_set),
    );
}
