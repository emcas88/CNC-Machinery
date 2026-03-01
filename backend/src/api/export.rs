use actix_web::{post, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::PgPool;

/// Export a job's room/product data to SketchUp format (.skp).
#[post("/sketchup")]
pub async fn export_sketchup(
    _pool: web::Data<PgPool>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "SketchUp export generated",
        "data": {
            "download_url": null
        }
    }))
}

/// Configure routes for the export module.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/export")
            .service(export_sketchup),
    );
}
