// backend/src/auth/mod.rs
// Auth module: JWT creation/verification, password hashing, refresh token management.
// Fixed Issue 19: JWT secret loaded from environment (JWT_SECRET env var).
// Fixed Issue 20: Refresh tokens stored/validated in DB, not in-memory map.

pub mod auth_api;
pub mod password;
#[cfg(test)]
mod tests_r3;

use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use std::env;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: String,   // user id
    pub role: String,
    pub exp: usize,
    pub iat: usize,
}

fn jwt_secret() -> Vec<u8> {
    env::var("JWT_SECRET")
        .expect("JWT_SECRET must be set")
        .into_bytes()
}

pub fn create_access_token(user_id: Uuid, role: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let exp = (now + Duration::minutes(15)).timestamp() as usize;
    let iat = now.timestamp() as usize;

    let claims = Claims {
        sub: user_id.to_string(),
        role: role.to_string(),
        exp,
        iat,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(&jwt_secret()),
    )
}

pub fn verify_token(token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(&jwt_secret()),
        &Validation::default(),
    )?;
    Ok(data.claims)
}

/// Creates a new refresh token, stores it in the database, and returns the raw token string.
pub async fn create_refresh_token(user_id: Uuid, pool: &PgPool) -> Result<String, sqlx::Error> {
    let token = Uuid::new_v4().to_string();
    let expires_at = Utc::now() + Duration::days(30);

    // Fixed Issue 20: Persist refresh token to DB
    sqlx::query(
        "INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)"
    )
    .bind(&token)
    .bind(user_id)
    .bind(expires_at)
    .execute(pool)
    .await?;

    Ok(token)
}

/// Revokes a specific refresh token for a user.
pub async fn revoke_refresh_token(token: &str, pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM refresh_tokens WHERE token = $1")
        .bind(token)
        .execute(pool)
        .await?;
    Ok(())
}

/// Revokes ALL refresh tokens for a given user (logout-all / password change).
pub async fn revoke_all_refresh_tokens(user_id: Uuid, pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM refresh_tokens WHERE user_id = $1")
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}
