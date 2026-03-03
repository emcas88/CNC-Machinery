use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, patch, post},
    Router,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::AuthenticatedUser;

#[derive(Debug, Serialize)]
pub struct UserRow {
    pub id: Uuid,
    pub email: String,
    pub username: String,
    pub first_name: String,
    pub last_name: String,
    pub role: String,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserRequest {
    pub email: Option<String>,
    pub username: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub role: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

pub fn router(pool: PgPool) -> Router {
    Router::new()
        .route("/", get(list_users))
        .route("/:id", get(get_user))
        .route("/:id", patch(update_user))
        .route("/:id", delete(delete_user))
        .route("/change-password", post(change_password))
        .with_state(pool)
}

async fn list_users(
    _auth: AuthenticatedUser,
    State(pool): State<PgPool>,
) -> impl IntoResponse {
    let rows = sqlx::query_as!(
        UserRow,
        "SELECT id, email, username, first_name, last_name, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC"
    )
    .fetch_all(&pool)
    .await;

    match rows {
        Ok(users) => (StatusCode::OK, Json(users)).into_response(),
        Err(e) => {
            tracing::error!("Failed to fetch users: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Database error" }))).into_response()
        }
    }
}

async fn get_user(
    _auth: AuthenticatedUser,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let row = sqlx::query_as!(
        UserRow,
        "SELECT id, email, username, first_name, last_name, role, is_active, created_at, updated_at FROM users WHERE id = $1",
        id
    )
    .fetch_optional(&pool)
    .await;

    match row {
        Ok(Some(user)) => (StatusCode::OK, Json(user)).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "User not found" }))).into_response(),
        Err(e) => {
            tracing::error!("Failed to fetch user: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Database error" }))).into_response()
        }
    }
}

async fn update_user(
    _auth: AuthenticatedUser,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateUserRequest>,
) -> impl IntoResponse {
    // Build dynamic update using individual fields
    let row = sqlx::query!(
        "SELECT id, email, username, first_name, last_name, role, is_active, created_at, updated_at FROM users WHERE id = $1",
        id
    )
    .fetch_optional(&pool)
    .await;

    match row {
        Ok(None) => return (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "User not found" }))).into_response(),
        Err(e) => {
            tracing::error!("DB error: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Database error" }))).into_response();
        }
        Ok(Some(existing)) => {
            let new_email = req.email.unwrap_or(existing.email);
            let new_username = req.username.unwrap_or(existing.username);
            let new_first = req.first_name.unwrap_or(existing.first_name);
            let new_last = req.last_name.unwrap_or(existing.last_name);
            let new_role = req.role.unwrap_or(existing.role);
            let new_active = req.is_active.unwrap_or(existing.is_active);

            let update_result = sqlx::query!(
                "UPDATE users SET email=$1, username=$2, first_name=$3, last_name=$4, role=$5, is_active=$6, updated_at=NOW() WHERE id=$7",
                new_email, new_username, new_first, new_last, new_role, new_active, id
            )
            .execute(&pool)
            .await;

            match update_result {
                Ok(_) => {
                    // Re-fetch updated user
                    let updated = sqlx::query_as!(
                        UserRow,
                        "SELECT id, email, username, first_name, last_name, role, is_active, created_at, updated_at FROM users WHERE id = $1",
                        id
                    )
                    .fetch_one(&pool)
                    .await;

                    match updated {
                        Ok(u) => (StatusCode::OK, Json(u)).into_response(),
                        Err(e) => {
                            tracing::error!("Failed to re-fetch user: {}", e);
                            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Database error" }))).into_response()
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to update user: {}", e);
                    (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Database error" }))).into_response()
                }
            }
        }
    }
}

async fn delete_user(
    _auth: AuthenticatedUser,
    State(pool): State<PgPool>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let result = sqlx::query!("DELETE FROM users WHERE id = $1", id)
        .execute(&pool)
        .await;

    match result {
        Ok(r) if r.rows_affected() == 0 => {
            (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "User not found" }))).into_response()
        }
        Ok(_) => (StatusCode::NO_CONTENT).into_response(),
        Err(e) => {
            tracing::error!("Failed to delete user: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Database error" }))).into_response()
        }
    }
}

async fn change_password(
    auth: AuthenticatedUser,
    State(pool): State<PgPool>,
    Json(req): Json<ChangePasswordRequest>,
) -> impl IntoResponse {
    let row = sqlx::query!(
        "SELECT password_hash FROM users WHERE id = $1",
        auth.user_id
    )
    .fetch_optional(&pool)
    .await;

    match row {
        Ok(Some(user)) => {
            match crate::auth::password::verify(&req.current_password, &user.password_hash) {
                Ok(true) => {
                    if let Err(e) = crate::auth::password::validate_strength(&req.new_password) {
                        return (StatusCode::UNPROCESSABLE_ENTITY, Json(serde_json::json!({ "error": e }))).into_response();
                    }
                    match crate::auth::password::hash(&req.new_password) {
                        Ok(new_hash) => {
                            let res = sqlx::query!(
                                "UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2",
                                new_hash, auth.user_id
                            )
                            .execute(&pool)
                            .await;
                            match res {
                                Ok(_) => (StatusCode::OK, Json(serde_json::json!({ "message": "Password updated" }))).into_response(),
                                Err(e) => {
                                    tracing::error!("Failed to update password: {}", e);
                                    (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Database error" }))).into_response()
                                }
                            }
                        }
                        Err(e) => {
                            tracing::error!("Password hash failed: {}", e);
                            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Internal error" }))).into_response()
                        }
                    }
                }
                Ok(false) => (StatusCode::UNAUTHORIZED, Json(serde_json::json!({ "error": "Current password is incorrect" }))).into_response(),
                Err(e) => {
                    tracing::error!("Verify error: {}", e);
                    (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Internal error" }))).into_response()
                }
            }
        }
        Ok(None) => (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "User not found" }))).into_response(),
        Err(e) => {
            tracing::error!("DB error: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Database error" }))).into_response()
        }
    }
}
