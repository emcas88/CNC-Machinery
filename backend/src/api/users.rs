// backend/src/api/users.rs
// Admin CRUD for the users table.

use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::password::hash_password;
use crate::models::user::{CreateUser, UpdateUser, UserRole};

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
        "SELECT id, email, first_name, last_name, role::text, is_active FROM users LIMIT $1 OFFSET $2",
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
        "SELECT id, email, first_name, last_name, role::text, is_active FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some((id, email, first_name, last_name, role, is_active))) => {
            HttpResponse::Ok().json(UserResponse {
                id,
                email,
                first_name,
                last_name,
                role,
                is_active,
            })
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
        Err(_) => {
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": "Password hashing failed"}))
        }
    };

    let role = body.role.unwrap_or(UserRole::ShopFloor);

    let result = sqlx::query_as::<_, (Uuid,)>(
        "INSERT INTO users (email, password_hash, first_name, last_name, role, name) \
         VALUES ($1, $2, $3, $4, $5::text, COALESCE($3, '') || ' ' || COALESCE($4, '')) RETURNING id",
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
                HttpResponse::Conflict()
                    .json(serde_json::json!({"error": "Email already exists"}))
            } else {
                HttpResponse::InternalServerError()
                    .json(serde_json::json!({"error": "Database error"}))
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

    let hashed_password = if let Some(ref pw) = body.password {
        match hash_password(pw) {
            Ok(h) => Some(h),
            Err(_) => {
                return HttpResponse::InternalServerError()
                    .json(serde_json::json!({"error": "Password hashing failed"}))
            }
        }
    } else {
        None
    };

    let result = sqlx::query(
        "UPDATE users SET \
            email      = COALESCE($2, email), \
            first_name = COALESCE($3, first_name), \
            last_name  = COALESCE($4, last_name), \
            password_hash = COALESCE($5, password_hash), \
            role       = COALESCE($6::text, role::text)::user_role, \
            updated_at = NOW() \
         WHERE id = $1",
    )
    .bind(user_id)
    .bind(&body.email)
    .bind(&body.first_name)
    .bind(&body.last_name)
    .bind(&hashed_password)
    .bind(body.role.map(|r| r.to_string()))
    .execute(pool.get_ref())
    .await;

    match result {
        Ok(r) if r.rows_affected() == 0 => {
            HttpResponse::NotFound().json(serde_json::json!({"error": "User not found"}))
        }
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({"message": "User updated"})),
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
        Ok(r) if r.rows_affected() == 0 => {
            HttpResponse::NotFound().json(serde_json::json!({"error": "User not found"}))
        }
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({"message": "User deleted"})),
        Err(e) => {
            log::error!("delete_user error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Database error"}))
        }
    }
}
