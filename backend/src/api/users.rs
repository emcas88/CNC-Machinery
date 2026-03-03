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
// Data Transfer Objects
// ---------------------------------------

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub role: UserRole,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserRequest {
    pub name: Option<String>,
    pub email: Option<String>,
    pub role: Option<UserRole>,
}

// ---------------------------------------
// Route Configuration
// ---------------------------------------

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/users")
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
async fn list_users(pool: web::Data<PgPool>) -> impl Responder {
    let result = sqlx::query_as::<_, (Uuid, String, String, UserRole)>(
        "SELECT id, email, name, role FROM users ORDER BY name"
    )
    .fetch_all(pool.get_ref())
    .await;

    match result {
        Ok(rows) => {
            let users: Vec<UserResponse> = rows
                .into_iter()
                .map(|(id, email, name, role)| UserResponse { id, email, name, role })
                .collect();
            HttpResponse::Ok().json(users)
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

#[get("/{id}")]
async fn get_user(path: web::Path<Uuid>, pool: web::Data<PgPool>) -> impl Responder {
    let id = path.into_inner();
    let result = sqlx::query_as::<_, (Uuid, String, String, UserRole)>(
        "SELECT id, email, name, role FROM users WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some((id, email, name, role))) => {
            HttpResponse::Ok().json(UserResponse { id, email, name, role })
        }
        Ok(None) => HttpResponse::NotFound().body("User not found"),
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

#[post("")]
async fn create_user(
    pool: web::Data<PgPool>,
    body: web::Json<CreateUser>,
) -> impl Responder {
    let hashed = match hash_password(&body.password) {
        Ok(h) => h,
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    let result = sqlx::query_as::<_, (Uuid, String, String, UserRole)>(
        "INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role"
    )
    .bind(&body.email)
    .bind(&body.name)
    .bind(&hashed)
    .bind(UserRole::Operator)
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok((id, email, name, role)) => {
            HttpResponse::Created().json(UserResponse { id, email, name, role })
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

#[put("/{id}")]
async fn update_user(
    path: web::Path<Uuid>,
    pool: web::Data<PgPool>,
    body: web::Json<UpdateUserRequest>,
) -> impl Responder {
    let id = path.into_inner();

    // Fetch existing user first
    let existing = sqlx::query_as::<_, (Uuid, String, String, UserRole)>(
        "SELECT id, email, name, role FROM users WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(pool.get_ref())
    .await;

    let (_, current_email, current_name, current_role) = match existing {
        Ok(Some(row)) => row,
        Ok(None) => return HttpResponse::NotFound().body("User not found"),
        Err(e) => return HttpResponse::InternalServerError().body(e.to_string()),
    };

    let new_email = body.email.clone().unwrap_or(current_email);
    let new_name = body.name.clone().unwrap_or(current_name);
    let new_role = body.role.clone().unwrap_or(current_role);

    let result = sqlx::query_as::<_, (Uuid, String, String, UserRole)>(
        "UPDATE users SET email = $1, name = $2, role = $3 WHERE id = $4 RETURNING id, email, name, role"
    )
    .bind(&new_email)
    .bind(&new_name)
    .bind(&new_role)
    .bind(id)
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok((id, email, name, role)) => {
            HttpResponse::Ok().json(UserResponse { id, email, name, role })
        }
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

#[delete("/{id}")]
async fn delete_user(path: web::Path<Uuid>, pool: web::Data<PgPool>) -> impl Responder {
    let id = path.into_inner();
    let result = sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(id)
        .execute(pool.get_ref())
        .await;

    match result {
        Ok(r) if r.rows_affected() > 0 => HttpResponse::NoContent().finish(),
        Ok(_) => HttpResponse::NotFound().body("User not found"),
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}
