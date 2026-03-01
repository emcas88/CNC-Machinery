use actix_web::{get, post, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

/// Get the full cutlist for a job (all parts across all rooms and products).
#[get("/jobs/{job_id}/cutlist")]
pub async fn get_cutlist(
    _pool: web::Data<PgPool>,
    job_id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Cutlist for job {}", job_id),
        "data": {
            "parts": [],
            "total_count": 0
        }
    }))
}

/// Get the Bill of Materials (BOM) for a job - materials and quantities needed.
#[get("/jobs/{job_id}/bom")]
pub async fn get_bom(
    _pool: web::Data<PgPool>,
    job_id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Bill of Materials for job {}", job_id),
        "data": {
            "materials": [],
            "hardware": []
        }
    }))
}

/// Configure routes for the cutlists module.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(get_cutlist)
        .service(get_bom);
}
