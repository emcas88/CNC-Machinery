use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

// ---- Textures ----

/// List all textures.
#[get("")]
pub async fn list_textures(_pool: web::Data<PgPool>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "List all textures",
        "data": []
    }))
}

/// Get a single texture by ID.
#[get("/{id}")]
pub async fn get_texture(_pool: web::Data<PgPool>, id: web::Path<Uuid>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Get texture {}", id)
    }))
}

/// Create a new texture definition.
#[post("")]
pub async fn create_texture(
    _pool: web::Data<PgPool>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Created().json(json!({
        "status": "ok",
        "message": "Texture created"
    }))
}

/// Update a texture.
#[put("/{id}")]
pub async fn update_texture(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Texture {} updated", id)
    }))
}

/// Delete a texture.
#[delete("/{id}")]
pub async fn delete_texture(_pool: web::Data<PgPool>, id: web::Path<Uuid>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Texture {} deleted", id)
    }))
}

// ---- Texture Groups ----

/// List all texture groups.
#[get("")]
pub async fn list_texture_groups(_pool: web::Data<PgPool>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "List all texture groups",
        "data": []
    }))
}

/// Get a texture group with all its textures.
#[get("/{id}")]
pub async fn get_texture_group(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Get texture group {} with all textures", id)
    }))
}

/// Create a new texture group.
#[post("")]
pub async fn create_texture_group(
    _pool: web::Data<PgPool>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Created().json(json!({
        "status": "ok",
        "message": "Texture group created"
    }))
}

/// Update a texture group.
#[put("/{id}")]
pub async fn update_texture_group(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Texture group {} updated", id)
    }))
}

/// Delete a texture group.
#[delete("/{id}")]
pub async fn delete_texture_group(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Texture group {} deleted", id)
    }))
}

/// Configure routes for the textures module.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/textures")
            .service(list_textures)
            .service(create_texture)
            .service(get_texture)
            .service(update_texture)
            .service(delete_texture),
    );
    cfg.service(
        web::scope("/texture-groups")
            .service(list_texture_groups)
            .service(create_texture_group)
            .service(get_texture_group)
            .service(update_texture_group)
            .service(delete_texture_group),
    );
}
