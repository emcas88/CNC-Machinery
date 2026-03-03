pub mod auth_api;
pub mod middleware;
pub mod password;

#[cfg(test)]
pub mod tests_r3;

use axum::extract::FromRequestParts;
use axum::http::{request::Parts, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct AuthConfig {
    pub secret: String,
    pub access_token_expiry_secs: u64,
    pub refresh_token_expiry_secs: u64,
}

impl AuthConfig {
    pub fn from_env_or_exit() -> Self {
        let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| {
            eprintln!("ERROR: JWT_SECRET environment variable not set");
            std::process::exit(1);
        });
        let access_token_expiry_secs = std::env::var("ACCESS_TOKEN_EXPIRY_SECS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(900); // 15 minutes
        let refresh_token_expiry_secs = std::env::var("REFRESH_TOKEN_EXPIRY_SECS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(604800); // 7 days
        Self {
            secret,
            access_token_expiry_secs,
            refresh_token_expiry_secs,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: u64,
    pub iat: u64,
    pub token_type: String,
}

#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub user_id: Uuid,
}

#[derive(Debug)]
pub enum AuthError {
    MissingToken,
    InvalidToken,
    ExpiredToken,
    InternalError(String),
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AuthError::MissingToken => (StatusCode::UNAUTHORIZED, "Missing token"),
            AuthError::InvalidToken => (StatusCode::UNAUTHORIZED, "Invalid token"),
            AuthError::ExpiredToken => (StatusCode::UNAUTHORIZED, "Token expired"),
            AuthError::InternalError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Internal error"),
        };
        (status, Json(serde_json::json!({ "error": message }))).into_response()
    }
}

#[axum::async_trait]
impl<S> FromRequestParts<S> for AuthenticatedUser
where
    S: Send + Sync,
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        parts
            .extensions
            .get::<AuthenticatedUser>()
            .cloned()
            .ok_or(AuthError::MissingToken)
    }
}

pub fn generate_token_pair(user_id: Uuid, config: &AuthConfig) -> Result<(String, String), String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();

    let access_claims = Claims {
        sub: user_id.to_string(),
        exp: now + config.access_token_expiry_secs,
        iat: now,
        token_type: "access".to_string(),
    };

    let refresh_claims = Claims {
        sub: user_id.to_string(),
        exp: now + config.refresh_token_expiry_secs,
        iat: now,
        token_type: "refresh".to_string(),
    };

    let encoding_key = EncodingKey::from_secret(config.secret.as_bytes());

    let access_token = encode(&Header::default(), &access_claims, &encoding_key)
        .map_err(|e| e.to_string())?;
    let refresh_token = encode(&Header::default(), &refresh_claims, &encoding_key)
        .map_err(|e| e.to_string())?;

    Ok((access_token, refresh_token))
}

pub fn validate_token(token: &str, config: &AuthConfig) -> Result<Uuid, AuthError> {
    let decoding_key = DecodingKey::from_secret(config.secret.as_bytes());
    let validation = Validation::default();

    let token_data = decode::<Claims>(token, &decoding_key, &validation)
        .map_err(|e| match e.kind() {
            jsonwebtoken::errors::ErrorKind::ExpiredSignature => AuthError::ExpiredToken,
            _ => AuthError::InvalidToken,
        })?;

    Uuid::parse_str(&token_data.claims.sub).map_err(|_| AuthError::InvalidToken)
}
