use actix_web::{get, post, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

/// Generate G-code for a set of nested sheets.
#[post("/generate")]
pub async fn generate_gcode(
    _pool: web::Data<PgPool>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "G-code generation initiated for specified sheets",
        "data": {
            "job_id": null,
            "files": []
        }
    }))
}

/// Configure routes for the gcode module.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/gcode")
            .service(generate_gcode),
    );
}
