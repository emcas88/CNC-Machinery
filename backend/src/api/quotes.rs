use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

/// List all quotes.
#[get("")]
pub async fn list_quotes(_pool: web::Data<PgPool>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "List all quotes",
        "data": []
    }))
}

/// Get a single quote with line items.
#[get("/{id}")]
pub async fn get_quote(_pool: web::Data<PgPool>, id: web::Path<Uuid>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Get quote {}", id)
    }))
}

/// Generate a quote from a job's BOM and cost data.
#[post("/generate")]
pub async fn generate_quote(
    _pool: web::Data<PgPool>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Created().json(json!({
        "status": "ok",
        "message": "Quote generated from job cost data"
    }))
}

/// Update a quote's line items or markup.
#[put("/{id}")]
pub async fn update_quote(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Quote {} updated", id)
    }))
}

/// Delete a quote.
#[delete("/{id}")]
pub async fn delete_quote(_pool: web::Data<PgPool>, id: web::Path<Uuid>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Quote {} deleted", id)
    }))
}

/// Export a quote to PDF.
#[post("/{id}/export-pdf")]
pub async fn export_quote_pdf(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Quote {} exported as PDF", id),
        "data": {
            "pdf_url": null
        }
    }))
}

/// Configure routes for the quotes module.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/quotes")
            .service(generate_quote)
            .service(list_quotes)
            .service(get_quote)
            .service(update_quote)
            .service(delete_quote)
            .service(export_quote_pdf),
    );
}
