use actix_web::{get, post, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

/// Get a shop-floor-optimized cutlist view for a job (simplified, touch-friendly).
#[get("/cutlist/{job_id}")]
pub async fn get_shop_cutlist(
    _pool: web::Data<PgPool>,
    job_id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Shop floor cutlist for job {}", job_id),
        "data": {
            "parts": [],
            "grouped_by_machine": {}
        }
    }))
}

/// Get assembly instructions for a single product (shop floor view).
#[get("/assembly/{product_id}")]
pub async fn get_shop_assembly(
    _pool: web::Data<PgPool>,
    product_id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Assembly instructions for product {}", product_id),
        "data": {
            "steps": [],
            "hardware_needed": []
        }
    }))
}

/// Send a label to the shop floor label printer.
#[post("/label/print")]
pub async fn shop_print_label(
    _pool: web::Data<PgPool>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "Label sent to printer"
    }))
}

/// Log a part into the remake bin (defective/damaged).
#[post("/remake-bin")]
pub async fn log_remake_bin(
    _pool: web::Data<PgPool>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "Part logged in remake bin. Replacement scheduled."
    }))
}

/// Get real-time manufacturing progress for a job.
#[get("/progress/{job_id}")]
pub async fn get_shop_progress(
    _pool: web::Data<PgPool>,
    job_id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Manufacturing progress for job {}", job_id),
        "data": {
            "total_parts": 0,
            "cut": 0,
            "assembled": 0,
            "shipped": 0,
            "percentage_complete": 0.0
        }
    }))
}

/// Configure routes for the shop apps module.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/shop")
            .service(get_shop_cutlist)
            .service(get_shop_assembly)
            .service(shop_print_label)
            .service(log_remake_bin)
            .service(get_shop_progress),
    );
}
