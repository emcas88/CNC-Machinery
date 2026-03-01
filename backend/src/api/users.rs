use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

/// List all users (admin only).
#[get("")]
pub async fn list_users(_pool: web::Data<PgPool>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "List all users",
        "data": []
    }))
}

/// Get a single user by ID.
#[get("/{id}")]
pub async fn get_user(_pool: web::Data<PgPool>, id: web::Path<Uuid>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Get user {}", id)
    }))
}

/// Create a new user (admin operation).
#[post("")]
pub async fn create_user(
    _pool: web::Data<PgPool>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Created().json(json!({
        "status": "ok",
        "message": "User created"
    }))
}

/// Update a user's details or role.
#[put("/{id}")]
pub async fn update_user(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("User {} updated", id)
    }))
}

/// Delete a user account.
#[delete("/{id}")]
pub async fn delete_user(_pool: web::Data<PgPool>, id: web::Path<Uuid>) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("User {} deleted", id)
    }))
}

/// Authenticate a user and return a session token.
#[post("/login")]
pub async fn login(
    _pool: web::Data<PgPool>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": "Login successful",
        "data": {
            "token": "stub-jwt-token",
            "user": {
                "id": null,
                "email": "",
                "role": "designer"
            }
        }
    }))
}

/// Register a new user account (self-service or admin).
#[post("/register")]
pub async fn register(
    _pool: web::Data<PgPool>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Created().json(json!({
        "status": "ok",
        "message": "User registered successfully"
    }))
}

/// Update role assignment for a user.
#[put("/{id}/role")]
pub async fn update_user_role(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Role updated for user {}", id)
    }))
}

/// Update fine-grained permissions for a user.
#[put("/{id}/permissions")]
pub async fn update_user_permissions(
    _pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Permissions updated for user {}", id)
    }))
}

/// Configure routes for the users module.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/users")
            .service(login)
            .service(register)
            .service(list_users)
            .service(create_user)
            .service(get_user)
            .service(update_user)
            .service(delete_user)
            .service(update_user_role)
            .service(update_user_permissions),
    );
}
