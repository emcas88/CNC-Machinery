// backend/src/api/auth.rs
// ============================================================
// F20 · Auth HTTP handlers (register, login, refresh, me, change-password)
// ============================================================

use actix_web::{web, HttpMessage, HttpRequest, HttpResponse};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

use crate::auth::{
    generate_token_pair,
    password::{hash_password, validate_password_strength, verify_password},
    validate_token, AuthConfig, AuthError, AuthenticatedUser, TokenType, UserRole,
};

// ── Request / Response DTOs ──────────────────────────────────

#[derive(Debug, Deserialize, Validate)]
pub struct RegisterRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,
    #[validate(length(min = 8, max = 128, message = "Password must be 8-128 characters"))]
    pub password: String,
    #[validate(length(min = 1, max = 100, message = "Name is required"))]
    pub name: String,
    /// Optional — defaults to `shop_floor` if omitted.
    pub role: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Debug, Serialize)]
pub struct UserProfileResponse {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub role: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize)]
pub struct MessageResponse {
    pub message: String,
}

// ── Internal DB row ──────────────────────────────────────────

#[derive(Debug, sqlx::FromRow)]
struct UserRow {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub password_hash: String,
    pub role: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

// ── POST /api/auth/register ──────────────────────────────────

pub async fn register(
    pool: web::Data<PgPool>,
    config: web::Data<AuthConfig>,
    body: web::Json<RegisterRequest>,
) -> Result<HttpResponse, AuthError> {
    // Validate DTO fields
    body.validate()
        .map_err(|e| AuthError::ValidationError(e.to_string()))?;

    // Validate password strength beyond length
    validate_password_strength(&body.password).map_err(AuthError::ValidationError)?;

    // Determine role (default to shop_floor)
    let role = match &body.role {
        Some(r) => UserRole::from_str_role(r)
            .ok_or_else(|| AuthError::ValidationError(format!("Invalid role: {r}")))?,
        None => UserRole::ShopFloor,
    };

    // Check for existing email
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)")
        .bind(&body.email)
        .fetch_one(pool.get_ref())
        .await
        .map_err(|e| AuthError::Internal(e.to_string()))?;

    if exists {
        return Err(AuthError::EmailAlreadyExists);
    }

    // Hash password
    let password_hash =
        hash_password(&body.password).map_err(|e| AuthError::Internal(e.to_string()))?;

    // Insert user
    let user_id = Uuid::new_v4();
    let role_str = role.to_string();

    sqlx::query(
        "INSERT INTO users (id, email, name, password_hash, role, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())",
    )
    .bind(user_id)
    .bind(&body.email)
    .bind(&body.name)
    .bind(&password_hash)
    .bind(&role_str)
    .execute(pool.get_ref())
    .await
    .map_err(|e| AuthError::Internal(e.to_string()))?;

    // Generate tokens
    let tokens = generate_token_pair(user_id, &body.email, role, config.get_ref())?;

    Ok(HttpResponse::Created().json(tokens))
}

// ── POST /api/auth/login ─────────────────────────────────────

pub async fn login(
    pool: web::Data<PgPool>,
    config: web::Data<AuthConfig>,
    body: web::Json<LoginRequest>,
) -> Result<HttpResponse, AuthError> {
    // Look up user
    let user: UserRow = sqlx::query_as(
        "SELECT id, email, name, password_hash, role, created_at
         FROM users WHERE email = $1",
    )
    .bind(&body.email)
    .fetch_optional(pool.get_ref())
    .await
    .map_err(|e| AuthError::Internal(e.to_string()))?
    .ok_or(AuthError::InvalidCredentials)?;

    // Verify password
    let valid = verify_password(&body.password, &user.password_hash)
        .map_err(|e| AuthError::Internal(e.to_string()))?;

    if !valid {
        return Err(AuthError::InvalidCredentials);
    }

    let role = UserRole::from_str_role(&user.role)
        .ok_or_else(|| AuthError::Internal(format!("Unknown role in DB: {}", user.role)))?;

    let tokens = generate_token_pair(user.id, &user.email, role, config.get_ref())?;

    Ok(HttpResponse::Ok().json(tokens))
}

// ── POST /api/auth/refresh ───────────────────────────────────

pub async fn refresh(
    pool: web::Data<PgPool>,
    config: web::Data<AuthConfig>,
    body: web::Json<RefreshRequest>,
) -> Result<HttpResponse, AuthError> {
    // Validate the refresh token
    let claims = validate_token(&body.refresh_token, &config.jwt_secret, TokenType::Refresh)?;

    // Verify the user still exists
    let user: UserRow = sqlx::query_as(
        "SELECT id, email, name, password_hash, role, created_at
         FROM users WHERE id = $1",
    )
    .bind(claims.sub)
    .fetch_optional(pool.get_ref())
    .await
    .map_err(|e| AuthError::Internal(e.to_string()))?
    .ok_or(AuthError::UserNotFound)?;

    let role = UserRole::from_str_role(&user.role)
        .ok_or_else(|| AuthError::Internal(format!("Unknown role in DB: {}", user.role)))?;

    let tokens = generate_token_pair(user.id, &user.email, role, config.get_ref())?;

    Ok(HttpResponse::Ok().json(tokens))
}

// ── GET /api/auth/me ─────────────────────────────────────────

pub async fn me(req: HttpRequest, pool: web::Data<PgPool>) -> Result<HttpResponse, AuthError> {
    let user = req
        .extensions()
        .get::<AuthenticatedUser>()
        .cloned()
        .ok_or(AuthError::MissingToken)?;

    let row: UserRow = sqlx::query_as(
        "SELECT id, email, name, password_hash, role, created_at
         FROM users WHERE id = $1",
    )
    .bind(user.user_id)
    .fetch_optional(pool.get_ref())
    .await
    .map_err(|e| AuthError::Internal(e.to_string()))?
    .ok_or(AuthError::UserNotFound)?;

    Ok(HttpResponse::Ok().json(UserProfileResponse {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        created_at: row.created_at,
    }))
}

// ── POST /api/auth/change-password ───────────────────────────

pub async fn change_password(
    req: HttpRequest,
    pool: web::Data<PgPool>,
    body: web::Json<ChangePasswordRequest>,
) -> Result<HttpResponse, AuthError> {
    let user = req
        .extensions()
        .get::<AuthenticatedUser>()
        .cloned()
        .ok_or(AuthError::MissingToken)?;

    // Validate new password strength
    validate_password_strength(&body.new_password).map_err(AuthError::ValidationError)?;

    // Fetch current hash
    let current_hash: String = sqlx::query_scalar("SELECT password_hash FROM users WHERE id = $1")
        .bind(user.user_id)
        .fetch_one(pool.get_ref())
        .await
        .map_err(|e| AuthError::Internal(e.to_string()))?;

    // Verify current password
    let valid = verify_password(&body.current_password, &current_hash)
        .map_err(|e| AuthError::Internal(e.to_string()))?;

    if !valid {
        return Err(AuthError::InvalidCredentials);
    }

    // Hash new password
    let new_hash =
        hash_password(&body.new_password).map_err(|e| AuthError::Internal(e.to_string()))?;

    sqlx::query("UPDATE users SET password_hash = $1 WHERE id = $2")
        .bind(&new_hash)
        .bind(user.user_id)
        .execute(pool.get_ref())
        .await
        .map_err(|e| AuthError::Internal(e.to_string()))?;

    Ok(HttpResponse::Ok().json(MessageResponse {
        message: "Password changed successfully".to_string(),
    }))
}

// ── Route configuration ──────────────────────────────────────

/// Register all auth routes under `/api/auth`.
pub fn auth_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/auth")
            .route("/register", web::post().to(register))
            .route("/login", web::post().to(login))
            .route("/refresh", web::post().to(refresh))
            .route("/me", web::get().to(me))
            .route("/change-password", web::post().to(change_password)),
    );
}
