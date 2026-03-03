use axum::{
    extract::{Json, State},
    http::StatusCode,
    middleware,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::{AuthConfig, AuthenticatedUser};
use crate::auth::password;

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub first_name: String,
    pub last_name: String,
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub username: String,
    pub first_name: String,
    pub last_name: String,
    pub role: String,
    pub is_active: bool,
}

pub fn router(pool: PgPool, auth_config: AuthConfig) -> Router {
    let auth_routes = Router::new()
        .route("/register", post(register_handler))
        .route("/login", post(login_handler))
        .route(
            "/me",
            get(me_handler).route_layer(middleware::from_fn_with_state(
                auth_config.clone(),
                crate::auth::middleware::auth_middleware,
            )),
        )
        .with_state((pool, auth_config));

    Router::new().nest("/auth", auth_routes)
}

async fn register_handler(
    State((pool, auth_config)): State<(PgPool, AuthConfig)>,
    Json(req): Json<RegisterRequest>,
) -> impl IntoResponse {
    // Validate password strength
    if let Err(e) = password::validate_strength(&req.password) {
        return (StatusCode::UNPROCESSABLE_ENTITY, Json(serde_json::json!({ "error": e }))).into_response();
    }

    let hashed = match password::hash(&req.password) {
        Ok(h) => h,
        Err(e) => {
            tracing::error!("Password hashing failed: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Internal error" }))).into_response();
        }
    };

    // Check for duplicate email
    let existing = sqlx::query!(
        "SELECT id FROM users WHERE email = $1",
        req.email
    )
    .fetch_optional(&pool)
    .await;

    match existing {
        Ok(Some(_)) => {
            return (StatusCode::CONFLICT, Json(serde_json::json!({ "error": "Email already registered" }))).into_response();
        }
        Err(e) => {
            tracing::error!("DB error checking email: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Database error" }))).into_response();
        }
        Ok(None) => {}
    }

    let user_id = Uuid::new_v4();
    let result = sqlx::query!(
        "INSERT INTO users (id, email, username, first_name, last_name, password_hash, role, is_active, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, $6, 'Operator', true, NOW(), NOW()) RETURNING id",
        user_id,
        req.email,
        req.username,
        req.first_name,
        req.last_name,
        hashed
    )
    .fetch_one(&pool)
    .await;

    match result {
        Ok(row) => {
            match crate::auth::generate_token_pair(row.id, &auth_config) {
                Ok(tokens) => (
                    StatusCode::CREATED,
                    Json(TokenResponse {
                        access_token: tokens.0,
                        refresh_token: tokens.1,
                        token_type: "Bearer".to_string(),
                    }),
                ).into_response(),
                Err(e) => {
                    tracing::error!("Token generation failed: {}", e);
                    (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Token error" }))).into_response()
                }
            }
        }
        Err(e) => {
            tracing::error!("Failed to create user: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Failed to create user" }))).into_response()
        }
    }
}

async fn login_handler(
    State((pool, auth_config)): State<(PgPool, AuthConfig)>,
    Json(req): Json<LoginRequest>,
) -> impl IntoResponse {
    let row = sqlx::query!(
        "SELECT id, password_hash FROM users WHERE email = $1 AND is_active = true",
        req.email
    )
    .fetch_optional(&pool)
    .await;

    match row {
        Ok(Some(user)) => {
            match password::verify(&req.password, &user.password_hash) {
                Ok(true) => {
                    match crate::auth::generate_token_pair(user.id, &auth_config) {
                        Ok(tokens) => (
                            StatusCode::OK,
                            Json(TokenResponse {
                                access_token: tokens.0,
                                refresh_token: tokens.1,
                                token_type: "Bearer".to_string(),
                            }),
                        ).into_response(),
                        Err(e) => {
                            tracing::error!("Token generation failed: {}", e);
                            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Token error" }))).into_response()
                        }
                    }
                }
                Ok(false) => {
                    (StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "error": "Invalid credentials" }))).into_response()
                }
                Err(e) => {
                    tracing::error!("Password verify error: {}", e);
                    (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Internal error" }))).into_response()
                }
            }
        }
        Ok(None) => {
            (StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "error": "Invalid credentials" }))).into_response()
        }
        Err(e) => {
            tracing::error!("DB error during login: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Database error" }))).into_response()
        }
    }
}

async fn me_handler(
    auth_user: AuthenticatedUser,
    State((pool, _auth_config)): State<(PgPool, AuthConfig)>,
) -> impl IntoResponse {
    let row = sqlx::query!(
        "SELECT id, email, username, first_name, last_name, role, is_active FROM users WHERE id = $1",
        auth_user.user_id
    )
    .fetch_optional(&pool)
    .await;

    match row {
        Ok(Some(user)) => (
            StatusCode::OK,
            Json(UserResponse {
                id: user.id,
                email: user.email,
                username: user.username,
                first_name: user.first_name,
                last_name: user.last_name,
                role: user.role,
                is_active: user.is_active,
            }),
        ).into_response(),
        Ok(None) => {
            (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "User not found" }))).into_response()
        }
        Err(e) => {
            tracing::error!("DB error in /me: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Database error" }))).into_response()
        }
    }
}
