use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

/// List all label templates.
#[get("")]
pub async fn list_label_templates(_pool: web::Data<PgPool>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "List all label templates",
        "data": []
    }))
}

/// Get a single label template.
#[get("/{id}")]
pub async fn get_label_template(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Get label template {}", id)
    }))
}

/// Create a new label template.
#[post("")]
pub async fn create_label_template(
    _pool: web::Data<PgPool>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Created().json(json!({
        "status": "ok",
        "message": "Label template created"
    }))
}

/// Update a label template.
#[put("/{id}")]
pub async fn update_label_template(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Label template {} updated", id)
    }))
}

/// Delete a label template.
#[delete("/{id}")]
pub async fn delete_label_template(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Label template {} deleted", id)
    }))
}

/// Generate labels for all parts on a nested sheet.
#[post("/generate-for-sheet")]
pub async fn generate_labels_for_sheet(
    _pool: web::Data<PgPool>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "Labels generated for all parts on sheet",
        "data": {
            "label_pdf_url": null,
            "count": 0
        }
    }))
}

/// Send labels to a connected label printer.
#[post("/print")]
pub async fn print_label(
    _pool: web::Data<PgPool>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "Print job sent to label printer"
    }))
}

/// Configure routes for the labels module.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/labels")
            .service(generate_labels_for_sheet)
            .service(print_label)
            .service(list_label_templates)
            .service(create_label_template)
            .service(get_label_template)
            .service(update_label_template)
            .service(delete_label_template),
    );
}
