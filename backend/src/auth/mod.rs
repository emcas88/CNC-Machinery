pub mod auth_api;
pub mod password;
pub mod middleware;

#[cfg(test)]
mod tests;
#[cfg(test)]
mod tests_r3;

use actix_web::{http::StatusCode, HttpResponse, ResponseError};
use chrono::{Duration, Utc};
use jsonwebtoken::{
    decode, encode, errors::ErrorKind, DecodingKey, EncodingKey, Header, TokenData, Validation,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub use crate::models::user::UserRole;
pub use password::{hash_password, verify_password};

#[derive(Clone)]
pub struct AuthConfig {
    pub jwt_secret: String,
    pub access_token_ttl: Duration,
    pub refresh_token_ttl: Duration,
}

impl AuthConfig {
    pub fn from_env() -> Self {
        let jwt_secret =
            std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-me".to_string());

        let access_hours = std::env::var("ACCESS_TOKEN_HOURS")
            .ok()
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(24);

        let refresh_days = std::env::var("REFRESH_TOKEN_DAYS")
            .ok()
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(7);

        Self {
            jwt_secret,
            access_token_ttl: Duration::hours(access_hours),
            refresh_token_ttl: Duration::days(refresh_days),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Claims {
    pub sub: Uuid,
    pub email: String,
    pub role: UserRole,
    pub token_type: TokenType,
    pub iat: i64,
    pub exp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenClaims {
    pub sub: String,
    pub role: String,
    pub exp: usize,
    pub iat: usize,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TokenType {
    Access,
    Refresh,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: i64,
}

#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub user_id: Uuid,
    pub email: String,
    pub role: UserRole,
}

impl AuthenticatedUser {
    pub fn from_claims(claims: &Claims) -> Self {
        Self {
            user_id: claims.sub,
            email: claims.email.clone(),
            role: claims.role,
        }
    }

    pub fn has_any_role(&self, roles: &[UserRole]) -> bool {
        roles.contains(&self.role)
    }

    pub fn has_min_privilege(&self, min_level: u32) -> bool {
        self.role.privilege_level() >= min_level
    }
}

#[derive(Debug)]
pub enum AuthError {
    TokenExpired,
    InvalidToken,
    MissingToken,
    WrongTokenType { expected: TokenType },
    InsufficientRole { required: Vec<UserRole> },
    InvalidCredentials,
    UserNotFound,
    EmailAlreadyExists,
    ValidationError(String),
    Internal(String),
    JwtError(jsonwebtoken::errors::Error),
    HashError(bcrypt::BcryptError),
}

impl std::fmt::Display for AuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuthError::TokenExpired => write!(f, "Token has expired"),
            AuthError::InvalidToken => write!(f, "Invalid or expired token"),
            AuthError::MissingToken => write!(f, "Missing authorization header"),
            AuthError::WrongTokenType { expected } => {
                write!(f, "Invalid token type; expected {expected:?}")
            }
            AuthError::InsufficientRole { required } => {
                let req = required
                    .iter()
                    .map(ToString::to_string)
                    .collect::<Vec<_>>()
                    .join(", ");
                write!(f, "Insufficient role. Required one of: {req}")
            }
            AuthError::InvalidCredentials => write!(f, "Invalid credentials"),
            AuthError::UserNotFound => write!(f, "User not found"),
            AuthError::EmailAlreadyExists => write!(f, "Email already registered"),
            AuthError::ValidationError(msg) => write!(f, "{msg}"),
            AuthError::Internal(msg) => write!(f, "{msg}"),
            AuthError::JwtError(_) => write!(f, "Invalid or expired token"),
            AuthError::HashError(e) => write!(f, "hash error: {e}"),
        }
    }
}

impl ResponseError for AuthError {
    fn status_code(&self) -> StatusCode {
        match self {
            AuthError::TokenExpired
            | AuthError::InvalidToken
            | AuthError::MissingToken
            | AuthError::WrongTokenType { .. }
            | AuthError::InvalidCredentials
            | AuthError::JwtError(_) => StatusCode::UNAUTHORIZED,
            AuthError::InsufficientRole { .. } => StatusCode::FORBIDDEN,
            AuthError::UserNotFound => StatusCode::NOT_FOUND,
            AuthError::EmailAlreadyExists => StatusCode::CONFLICT,
            AuthError::ValidationError(_) => StatusCode::BAD_REQUEST,
            AuthError::Internal(_) | AuthError::HashError(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_response(&self) -> HttpResponse {
        HttpResponse::build(self.status_code()).json(serde_json::json!({ "error": self.to_string() }))
    }
}

impl From<jsonwebtoken::errors::Error> for AuthError {
    fn from(err: jsonwebtoken::errors::Error) -> Self {
        if matches!(err.kind(), ErrorKind::ExpiredSignature) {
            AuthError::TokenExpired
        } else {
            AuthError::JwtError(err)
        }
    }
}

impl From<bcrypt::BcryptError> for AuthError {
    fn from(err: bcrypt::BcryptError) -> Self {
        AuthError::HashError(err)
    }
}

pub fn encode_token(claims: &Claims, secret: &str) -> Result<String, AuthError> {
    encode(
        &Header::default(),
        claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(AuthError::from)
}

pub fn decode_token(token: &str, secret: &str) -> Result<TokenData<Claims>, AuthError> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(AuthError::from)
}

pub fn generate_token_pair(
    user_id: Uuid,
    email: &str,
    role: UserRole,
    config: &AuthConfig,
) -> Result<TokenPair, AuthError> {
    let now = Utc::now();
    let access_exp = now + config.access_token_ttl;
    let refresh_exp = now + config.refresh_token_ttl;

    let access_claims = Claims {
        sub: user_id,
        email: email.to_string(),
        role,
        token_type: TokenType::Access,
        iat: now.timestamp(),
        exp: access_exp.timestamp(),
    };

    let refresh_claims = Claims {
        sub: user_id,
        email: email.to_string(),
        role,
        token_type: TokenType::Refresh,
        iat: now.timestamp(),
        exp: refresh_exp.timestamp(),
    };

    let access_token = encode_token(&access_claims, &config.jwt_secret)?;
    let refresh_token = encode_token(&refresh_claims, &config.jwt_secret)?;

    Ok(TokenPair {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: config.access_token_ttl.num_seconds(),
    })
}

pub fn validate_token(
    token: &str,
    secret: &str,
    expected_type: TokenType,
) -> Result<Claims, AuthError> {
    let data = decode_token(token, secret)?;
    let claims = data.claims;

    if claims.token_type != expected_type {
        return Err(AuthError::WrongTokenType {
            expected: expected_type,
        });
    }

    Ok(claims)
}

pub fn require_admin(user: &AuthenticatedUser) -> Result<(), AuthError> {
    require_roles(user, &[UserRole::SuperAdmin])
}

pub fn require_roles(user: &AuthenticatedUser, allowed: &[UserRole]) -> Result<(), AuthError> {
    if allowed.contains(&user.role) {
        Ok(())
    } else {
        Err(AuthError::InsufficientRole {
            required: allowed.to_vec(),
        })
    }
}

pub struct AdminOnly;
pub struct DesignerOrAbove;
pub struct OperatorOrAbove;
pub struct AnyAuthenticated;

impl AdminOnly {
    pub fn allowed_roles() -> Vec<UserRole> {
        vec![UserRole::SuperAdmin]
    }
}

impl DesignerOrAbove {
    pub fn allowed_roles() -> Vec<UserRole> {
        vec![UserRole::SuperAdmin, UserRole::Designer]
    }
}

impl OperatorOrAbove {
    pub fn allowed_roles() -> Vec<UserRole> {
        vec![UserRole::SuperAdmin, UserRole::Designer, UserRole::CncOperator]
    }
}

impl AnyAuthenticated {
    pub fn allowed_roles() -> Vec<UserRole> {
        vec![
            UserRole::SuperAdmin,
            UserRole::Designer,
            UserRole::CncOperator,
            UserRole::ShopFloor,
        ]
    }
}

fn jwt_secret() -> String {
    std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-me".to_string())
}

pub fn create_access_token(user_id: Uuid, role: &str) -> Result<String, AuthError> {
    let now = Utc::now().timestamp() as usize;
    let claims = TokenClaims {
        sub: user_id.to_string(),
        role: role.to_string(),
        iat: now,
        exp: now + 15 * 60,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret().as_bytes()),
    )
    .map_err(AuthError::from)
}

pub fn create_refresh_token(user_id: Uuid) -> Result<String, AuthError> {
    let now = Utc::now().timestamp() as usize;
    let claims = TokenClaims {
        sub: user_id.to_string(),
        role: String::new(),
        iat: now,
        exp: now + 7 * 24 * 60 * 60,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret().as_bytes()),
    )
    .map_err(AuthError::from)
}

pub fn verify_access_token(token: &str) -> Result<TokenClaims, AuthError> {
    decode::<TokenClaims>(
        token,
        &DecodingKey::from_secret(jwt_secret().as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(AuthError::from)
}

pub fn verify_refresh_token(token: &str) -> Result<TokenClaims, AuthError> {
    decode::<TokenClaims>(
        token,
        &DecodingKey::from_secret(jwt_secret().as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(AuthError::from)
}
