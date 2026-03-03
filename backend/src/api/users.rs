use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::user::{CreateUser, UpdateUser, UserRole};

// ---------------------------------------------------------------------------
// Configure routes
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Public user view — password_hash is intentionally excluded.
// ---------------------------------------------------------------------------

/// A safe projection of the `users` table that never exposes password_hash.
#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct PublicUser {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub role: UserRole,
    pub permissions: Option<serde_json::Value>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

// ---------------------------------------------------------------------------
// GET /users
// ---------------------------------------------------------------------------

#[get("")]
pub async fn list_users(pool: web::Data<PgPool>) -> impl Responder {
    let result = sqlx::query_as!(
        PublicUser,
        r#"
        SELECT
            id,
            email,
            name,
            role AS "role: UserRole",
            permissions,
            created_at,
            updated_at
        FROM users
        ORDER BY name ASC
        "#
    )
    .fetch_all(pool.get_ref())
    .await;

    match result {
        Ok(users) => HttpResponse::Ok().json(users),
        Err(e) => {
            log::error!("list_users DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to retrieve users"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// GET /users/{id}
// ---------------------------------------------------------------------------

#[get("/{id}")]
pub async fn get_user(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query_as!(
        PublicUser,
        r#"
        SELECT
            id,
            email,
            name,
            role AS "role: UserRole",
            permissions,
            created_at,
            updated_at
        FROM users
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(user)) => HttpResponse::Ok().json(user),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "User not found",
            "id": id
        })),
        Err(e) => {
            log::error!("get_user DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to retrieve user"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// POST /users
// ---------------------------------------------------------------------------

#[post("")]
pub async fn create_user(pool: web::Data<PgPool>, body: web::Json<CreateUser>) -> impl Responder {
    // NOTE: The caller must hash the password before passing `password_hash`.
    // This handler does not perform hashing — that belongs in an auth service.
    let id = Uuid::new_v4();
    let now = chrono::Utc::now();

    let result = sqlx::query_as!(
        PublicUser,
        r#"
        INSERT INTO users (
            id, email, name, password_hash, role, permissions,
            created_at, updated_at
        )
        VALUES (
            $1, $2, $3, $4,
            $5::text::user_role,
            $6, $7, $8
        )
        RETURNING
            id,
            email,
            name,
            role AS "role: UserRole",
            permissions,
            created_at,
            updated_at
        "#,
        id,
        body.email,
        body.name,
        body.password,
        body.role.to_string(),
        body.permissions,
        now,
        now
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(user) => HttpResponse::Created().json(user),
        Err(sqlx::Error::Database(db_err)) if db_err.constraint() == Some("users_email_key") => {
            HttpResponse::Conflict().json(serde_json::json!({
                "error": "A user with that email address already exists"
            }))
        }
        Err(e) => {
            log::error!("create_user DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create user"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /users/{id}
// ---------------------------------------------------------------------------

#[put("/{id}")]
pub async fn update_user(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    body: web::Json<UpdateUser>,
) -> impl Responder {
    let id = path.into_inner();
    let now = chrono::Utc::now();

    let exists = sqlx::query_scalar!("SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)", id)
        .fetch_one(pool.get_ref())
        .await;

    match exists {
        Ok(Some(false)) | Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "User not found",
                "id": id
            }))
        }
        Err(e) => {
            log::error!("update_user existence check error: {e}");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update user"
            }));
        }
        _ => {}
    }

    let result = sqlx::query_as!(
        PublicUser,
        r#"
        UPDATE users SET
            email       = COALESCE($2, email),
            name        = COALESCE($3, name),
            role        = COALESCE($4::text::user_role, role),
            permissions = COALESCE($5, permissions),
            updated_at  = $6
        WHERE id = $1
        RETURNING
            id,
            email,
            name,
            role AS "role: UserRole",
            permissions,
            created_at,
            updated_at
        "#,
        id,
        body.email,
        body.name,
        body.role.as_ref().map(|r| r.to_string()),
        body.permissions,
        now
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(user) => HttpResponse::Ok().json(user),
        Err(sqlx::Error::Database(db_err)) if db_err.constraint() == Some("users_email_key") => {
            HttpResponse::Conflict().json(serde_json::json!({
                "error": "A user with that email address already exists"
            }))
        }
        Err(e) => {
            log::error!("update_user DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update user"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /users/{id}
// ---------------------------------------------------------------------------

#[delete("/{id}")]
pub async fn delete_user(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query!("DELETE FROM users WHERE id = $1 RETURNING id", id)
        .fetch_optional(pool.get_ref())
        .await;

    match result {
        Ok(Some(_)) => HttpResponse::NoContent().finish(),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "User not found",
            "id": id
        })),
        Err(e) => {
            log::error!("delete_user DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete user"
            }))
        }
    }
}
