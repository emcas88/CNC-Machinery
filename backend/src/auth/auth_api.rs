// backend/src/auth/auth_api.rs
// Provides /auth/login and /auth/refresh endpoints.
// Fixed Issue 23: Unified token response field to `access_token`.
// Fixed Issue 24: refresh_token lookup uses the token value, not user id.

use actix_web::{post, web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::mod::{create_access_token, create_refresh_token, verify_token};
use crate::auth::password::verify_password;

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
}

#[derive(Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

pub fn auth_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/auth")
            .service(login)
            .service(refresh),
    );
}

#[post("/login")]
async fn login(
    pool: web::Data<PgPool>,
    body: web::Json<LoginRequest>,
) -> impl Responder {
    // Look up user by email
    let result = sqlx::query_as::<_, (Uuid, String, String)>(
        "SELECT id, password_hash, role FROM users WHERE email = $1"
    )
    .bind(&body.email)
    .fetch_optional(pool.get_ref())
    .await;

    let (user_id, password_hash, role) = match result {
        Ok(Some(row)) => row,
        Ok(None) => return HttpResponse::Unauthorized().body("Invalid credentials"),
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    if !verify_password(&body.password, &password_hash) {
        return HttpResponse::Unauthorized().body("Invalid credentials");
    }

    let access_token = match create_access_token(user_id, &role) {
        Ok(t) => t,
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    let refresh_token = match create_refresh_token(user_id, pool.get_ref()).await {
        Ok(t) => t,
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    HttpResponse::Ok().json(TokenResponse {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
    })
}

#[post("/refresh")]
async fn refresh(
    pool: web::Data<PgPool>,
    body: web::Json<RefreshRequest>,
) -> impl Responder {
    // Fixed Issue 24: Look up the stored refresh token by its value
    let result = sqlx::query_as::<_, (Uuid, String)>(
        "SELECT user_id, role FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()"
    )
    .bind(&body.refresh_token)
    .fetch_optional(pool.get_ref())
    .await;

    let (user_id, role) = match result {
        Ok(Some(row)) => row,
        Ok(None) => return HttpResponse::Unauthorized().body("Invalid or expired refresh token"),
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    let new_access_token = match create_access_token(user_id, &role) {
        Ok(t) => t,
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    // Rotate: delete old refresh token and issue new one
    let _ = sqlx::query("DELETE FROM refresh_tokens WHERE token = $1")
        .bind(&body.refresh_token)
        .execute(pool.get_ref())
        .await;

    let new_refresh_token = match create_refresh_token(user_id, pool.get_ref()).await {
        Ok(t) => t,
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    HttpResponse::Ok().json(TokenResponse {
        access_token: new_access_token,
        refresh_token: new_refresh_token,
        token_type: "Bearer".to_string(),
    })
}
