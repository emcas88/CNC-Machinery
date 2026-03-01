use actix_web::{get, post, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

/// Submit a cloud render job for a room or product.
#[post("/submit")]
pub async fn submit_render(
    _pool: web::Data<PgPool>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Accepted().json(json!({
        "status": "ok",
        "message": "Render job submitted",
        "data": {
            "render_id": null
        }
    }))
}

/// Get the status and result of a render job.
#[get("/status/{render_id}")]
pub async fn get_render_status(
    _pool: web::Data<PgPool>,
    render_id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Render {} status", render_id),
        "data": {
            "status": "pending",
            "result_url": null
        }
    }))
}

/// Cancel a pending or in-progress render job.
#[post("/cancel/{render_id}")]
pub async fn cancel_render(
    _pool: web::Data<PgPool>,
    render_id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Render {} cancelled", render_id)
    }))
}

/// Configure routes for the rendering module.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/render")
            .service(submit_render)
            .service(get_render_status)
            .service(cancel_render),
    );
}
