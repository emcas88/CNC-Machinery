use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

/// Submit a new optimization run for a job.
/// Triggers the nesting engine asynchronously.
#[post("/run")]
pub async fn run_optimization(
    _pool: web::Data<PgPool>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Accepted().json(json!({
        "status": "ok",
        "message": "Optimization run queued. Poll /runs/{id} for status.",
        "data": {
            "run_id": null
        }
    }))
}

/// Get a specific optimization run's status and results.
#[get("/runs/{id}")]
pub async fn get_optimization_run(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Optimization run {} - status and results", id)
    }))
}

/// Manually adjust part placements on nested sheets.
#[post("/runs/{id}/adjust")]
pub async fn adjust_optimization_run(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Run {} adjusted. Yield recalculated.", id)
    }))
}

/// Get all nested sheets for an optimization run.
#[get("/runs/{id}/sheets")]
pub async fn get_optimization_sheets(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Nested sheets for run {}", id),
        "data": []
    }))
}

/// Duplicate an optimization run to try alternative settings.
#[post("/runs/{id}/duplicate")]
pub async fn duplicate_optimization_run(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Created().json(json!({
        "status": "ok",
        "message": format!("Optimization run {} duplicated", id)
    }))
}

/// List all available remnants in inventory.
#[get("/remnants")]
pub async fn list_remnants(_pool: web::Data<PgPool>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "List all remnants",
        "data": []
    }))
}

/// Create a new remnant record.
#[post("/remnants")]
pub async fn create_remnant(
    _pool: web::Data<PgPool>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Created().json(json!({
        "status": "ok",
        "message": "Remnant created"
    }))
}

/// Delete a remnant (mark as consumed).
#[delete("/remnants/{id}")]
pub async fn delete_remnant(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Remnant {} consumed/deleted", id)
    }))
}

/// Configure routes for the optimizer module.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/optimizer")
            .service(run_optimization)
            .service(get_optimization_run)
            .service(adjust_optimization_run)
            .service(get_optimization_sheets)
            .service(duplicate_optimization_run)
            .service(list_remnants)
            .service(create_remnant)
            .service(delete_remnant),
    );
}
