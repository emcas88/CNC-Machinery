// backend/src/auth/auth_api.rs
// =============================================================
// Round-3 integration fixes
// Fixed Issues 14-17 (compiler errors in auth_api):
//   14. Added missing `log` crate usage (log::error! calls).
//   15. Resolved ambiguous imports – explicit use of crate::auth::mod items.
//   16. Corrected RefreshRequest field name: refresh_token (not token).
//   17. logout handler now accepts JSON body and returns 200 with JSON.
// =============================================================

use actix_web::{post, web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::auth::{
    create_access_token, create_refresh_token, verify_refresh_token, hash_password,
    verify_password, AuthError,
};

// ------------------------------------------------------------------
// Request / Response shapes
// ------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    /// Fixed Issue 16: field name is `refresh_token`, matching the JSON body.
    pub refresh_token: String,
}

#[derive(Debug, Deserialize)]
pub struct LogoutRequest {
    pub refresh_token: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
}

// ------------------------------------------------------------------
// Route mounting
// ------------------------------------------------------------------

pub fn auth_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/auth")
            .service(register)
            .service(login)
            .service(refresh_token)
            .service(logout),
    );
}

// ------------------------------------------------------------------
// Handlers
// ------------------------------------------------------------------

#[post("/register")]
pub async fn register(
    pool: web::Data<PgPool>,
    body: web::Json<RegisterRequest>,
) -> impl Responder {
    // Hash the plaintext password
    let hashed = match hash_password(&body.password) {
        Ok(h) => h,
        Err(e) => {
            log::error!("register: hash_password failed: {e:?}");
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": "Internal server error"}));
        }
    };

    // Insert new user
    let result = sqlx::query_as::<_, (Uuid,)>(
        "INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id"
    )
    .bind(&body.email)
    .bind(&hashed)
    .bind(&body.first_name)
    .bind(&body.last_name)
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok((user_id,)) => {
            let access = match create_access_token(user_id, "viewer") {
                Ok(t) => t,
                Err(e) => {
                    log::error!("register: create_access_token failed: {e:?}");
                    return HttpResponse::InternalServerError()
                        .json(serde_json::json!({"error": "Token generation failed"}));
                }
            };
            let refresh = match create_refresh_token(user_id) {
                Ok(t) => t,
                Err(e) => {
                    log::error!("register: create_refresh_token failed: {e:?}");
                    return HttpResponse::InternalServerError()
                        .json(serde_json::json!({"error": "Token generation failed"}));
                }
            };
            HttpResponse::Created().json(AuthResponse {
                access_token: access,
                refresh_token: refresh,
                token_type: "Bearer".to_string(),
            })
        }
        Err(e) => {
            log::error!("register: DB insert failed: {e}");
            if e.to_string().contains("duplicate key") {
                HttpResponse::Conflict().json(serde_json::json!({"error": "Email already registered"}))
            } else {
                HttpResponse::InternalServerError().json(serde_json::json!({"error": "Database error"}))
            }
        }
    }
}

#[post("/login")]
pub async fn login(
    pool: web::Data<PgPool>,
    body: web::Json<LoginRequest>,
) -> impl Responder {
    let result = sqlx::query_as::<_, (Uuid, String, String)>(
        "SELECT id, password_hash, role FROM users WHERE email = $1 AND is_active = true"
    )
    .bind(&body.email)
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some((user_id, hash, role))) => {
            match verify_password(&body.password, &hash) {
                Ok(true) => {}
                Ok(false) => {
                    return HttpResponse::Unauthorized()
                        .json(serde_json::json!({"error": "Invalid credentials"}));
                }
                Err(e) => {
                    log::error!("login: verify_password error: {e:?}");
                    return HttpResponse::InternalServerError()
                        .json(serde_json::json!({"error": "Internal server error"}));
                }
            }

            let access = match create_access_token(user_id, &role) {
                Ok(t) => t,
                Err(e) => {
                    log::error!("login: create_access_token failed: {e:?}");
                    return HttpResponse::InternalServerError()
                        .json(serde_json::json!({"error": "Token generation failed"}));
                }
            };
            let refresh = match create_refresh_token(user_id) {
                Ok(t) => t,
                Err(e) => {
                    log::error!("login: create_refresh_token failed: {e:?}");
                    return HttpResponse::InternalServerError()
                        .json(serde_json::json!({"error": "Token generation failed"}));
                }
            };
            HttpResponse::Ok().json(AuthResponse {
                access_token: access,
                refresh_token: refresh,
                token_type: "Bearer".to_string(),
            })
        }
        Ok(None) => {
            HttpResponse::Unauthorized().json(serde_json::json!({"error": "Invalid credentials"}))
        }
        Err(e) => {
            log::error!("login: DB query failed: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Database error"}))
        }
    }
}

#[post("/refresh")]
pub async fn refresh_token(
    pool: web::Data<PgPool>,
    body: web::Json<RefreshRequest>,
) -> impl Responder {
    // Fixed Issue 16: use body.refresh_token
    let claims = match verify_refresh_token(&body.refresh_token) {
        Ok(c) => c,
        Err(AuthError::TokenExpired) => {
            return HttpResponse::Unauthorized()
                .json(serde_json::json!({"error": "Refresh token expired"}));
        }
        Err(e) => {
            log::error!("refresh: verify_refresh_token failed: {e:?}");
            return HttpResponse::Unauthorized()
                .json(serde_json::json!({"error": "Invalid refresh token"}));
        }
    };

    let user_id: Uuid = match claims.sub.parse() {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized()
            .json(serde_json::json!({"error": "Invalid token subject"})),
    };

    // Fetch current role
    let role_result = sqlx::query_as::<_, (String,)>(
        "SELECT role FROM users WHERE id = $1 AND is_active = true"
    )
    .bind(user_id)
    .fetch_optional(pool.get_ref())
    .await;

    let role = match role_result {
        Ok(Some((r,))) => r,
        Ok(None) => return HttpResponse::Unauthorized()
            .json(serde_json::json!({"error": "User not found or inactive"})),
        Err(e) => {
            log::error!("refresh: DB role lookup failed: {e}");
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": "Database error"}));
        }
    };

    let access = match create_access_token(user_id, &role) {
        Ok(t) => t,
        Err(e) => {
            log::error!("refresh: create_access_token failed: {e:?}");
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": "Token generation failed"}));
        }
    };
    let new_refresh = match create_refresh_token(user_id) {
        Ok(t) => t,
        Err(e) => {
            log::error!("refresh: create_refresh_token failed: {e:?}");
            return HttpResponse::InternalServerError()
                .json(serde_json::json!({"error": "Token generation failed"}));
        }
    };

    HttpResponse::Ok().json(AuthResponse {
        access_token: access,
        refresh_token: new_refresh,
        token_type: "Bearer".to_string(),
    })
}

#[post("/logout")]
pub async fn logout(
    _pool: web::Data<PgPool>,
    _body: web::Json<LogoutRequest>,
) -> impl Responder {
    // Fixed Issue 17: return JSON 200 instead of bare 204
    HttpResponse::Ok().json(serde_json::json!({"message": "Logged out successfully"}))
}
