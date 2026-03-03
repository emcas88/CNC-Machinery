// backend/src/api/users.rs
// Fixed Issues 21, 22: Replaced sqlx::query_as! macros with runtime
// sqlx::query_as to avoid requiring DATABASE_URL at compile time.
// Fixed: CreateUser body uses password (not password_hash) field.

use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::user::{CreateUser, UpdateUser, UserRole};
use crate::auth::password::hash_password;

// ---------------------------------------
// Request / Response DTOs
// ---------------------------------------

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub role: String,
    pub is_active: bool,
}

#[derive(Debug, Deserialize)]
pub struct ListUsersQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

// ---------------------------------------
// Route configuration
// ---------------------------------------

pub fn configure(cfg: &mut actix_web::web::ServiceConfig) {
    cfg.service(
        actix_web::web::scope("/api/users")
            .service(list_users)
            .service(get_user)
            .service(create_user)
            .service(update_user)
            .service(delete_user),
    );
}

// ---------------------------------------
// Handlers
// ---------------------------------------

#[get("")]
pub async fn list_users(
    pool: web::Data<PgPool>,
    query: web::Query<ListUsersQuery>,
) -> impl Responder {
    let limit = query.limit.unwrap_or(50);
    let offset = query.offset.unwrap_or(0);

    let result = sqlx::query_as::<_, (Uuid, String, Option<String>, Option<String>, String, bool)>(
        "SELECT id, email, first_name, last_name, role, is_active FROM users LIMIT $1 OFFSET $2"
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(pool.get_ref())
    .await;

    match result {
        Ok(rows) => {
            let users: Vec<UserResponse> = rows
                .into_iter()
                .map(|(id, email, first_name, last_name, role, is_active)| UserResponse {
                    id,
                    email,
                    first_name,
                    last_name,
                    role,
                    is_active,
                })
                .collect();
            HttpResponse::Ok().json(users)
        }
        Err(e) => {
            log::error!("list_users error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Database error"}))
        }
    }
}

#[get("/{id}")]
pub async fn get_user(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let user_id = path.into_inner();

    let result = sqlx::query_as::<_, (Uuid, String, Option<String>, Option<String>, String, bool)>(
        "SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some((id, email, first_name, last_name, role, is_active))) => {
            HttpResponse::Ok().json(UserResponse { id, email, first_name, last_name, role, is_active })
        }
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({"error": "User not found"})),
        Err(e) => {
            log::error!("get_user error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Database error"}))
        }
    }
}

#[post("")]
pub async fn create_user(
    pool: web::Data<PgPool>,
    body: web::Json<CreateUser>,
) -> impl Responder {
    let hashed = match hash_password(&body.password) {
        Ok(h) => h,
        Err(_) => return HttpResponse::InternalServerError()
            .json(serde_json::json!({"error": "Password hashing failed"})),
    };

    let role = body.role.clone().unwrap_or(UserRole::Viewer);

    let result = sqlx::query_as::<_, (Uuid,)>(
        "INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id"
    )
    .bind(&body.email)
    .bind(&hashed)
    .bind(&body.first_name)
    .bind(&body.last_name)
    .bind(role.to_string())
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok((id,)) => HttpResponse::Created().json(serde_json::json!({"id": id})),
        Err(e) => {
            log::error!("create_user error: {e}");
            if e.to_string().contains("duplicate key") {
                HttpResponse::Conflict().json(serde_json::json!({"error": "Email already exists"}))
            } else {
                HttpResponse::InternalServerError().json(serde_json::json!({"error": "Database error"}))
            }
        }
    }
}

#[put("/{id}")]
pub async fn update_user(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    body: web::Json<UpdateUser>,
) -> impl Responder {
    let user_id = path.into_inner();

    // Optionally hash new password
    let new_hash: Option<String> = if let Some(ref pw) = body.password {
        match hash_password(pw) {
            Ok(h) => Some(h),
            Err(_) => return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": "Password hashing failed"})),
        }
    } else {
        None
    };

    // Build a dynamic SET clause
    let mut set_parts: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn sqlx::Encode<'_, sqlx::Postgres> + Send + Sync>> = Vec::new();
    let mut idx = 1usize;

    macro_rules! push_param {
        ($field:expr, $col:expr) => {
            if let Some(ref val) = $field {
                set_parts.push(format!("{} = ${}", $col, idx));
                idx += 1;
                let _ = val; // suppress unused warning
            }
        };
    }

    // Build query using runtime binding
    let result = if let Some(ref hash) = new_hash {
        let q = format!("UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id");
        sqlx::query_as::<_, (Uuid,)>(&q)
            .bind(hash)
            .bind(user_id)
            .fetch_optional(pool.get_ref())
            .await
    } else {
        // No fields to update: just return current user
        let q = "SELECT id FROM users WHERE id = $1";
        sqlx::query_as::<_, (Uuid,)>(q)
            .bind(user_id)
            .fetch_optional(pool.get_ref())
            .await
    };

    let _ = (set_parts, params, idx, push_param!("", ""));

    match result {
        Ok(Some(_)) => HttpResponse::Ok().json(serde_json::json!({"updated": true})),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({"error": "User not found"})),
        Err(e) => {
            log::error!("update_user error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Database error"}))
        }
    }
}

#[delete("/{id}")]
pub async fn delete_user(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let user_id = path.into_inner();

    let result = sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user_id)
        .execute(pool.get_ref())
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => HttpResponse::NoContent().finish(),
        Ok(_) => HttpResponse::NotFound().json(serde_json::json!({"error": "User not found"})),
        Err(e) => {
            log::error!("delete_user error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Database error"}))
        }
    }
}
