// backend/src/auth/mod.rs
// ============================================================
// F20 · Authentication module (JWT + types)
// ============================================================
//
// Provides JWT access/refresh token generation, validation, role
// definitions, and the `AuthenticatedUser` extractor for Actix-web
// handlers.

pub mod middleware;
pub mod password;

#[cfg(test)]
pub mod tests;

use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, TokenData, Validation};
use serde::{Deserialize, Serialize};
use std::fmt;
use thiserror::Error;
use uuid::Uuid;

// ── Configuration ────────────────────────────────────────────

/// Auth configuration loaded at startup.
#[derive(Clone, Debug)]
pub struct AuthConfig {
    /// HMAC-SHA256 secret for signing JWTs.
    pub jwt_secret: String,
    /// Lifetime of an access token (default: 24 h).
    pub access_token_ttl: Duration,
    /// Lifetime of a refresh token (default: 7 d).
    pub refresh_token_ttl: Duration,
}

impl AuthConfig {
    /// Build config from environment variables with sensible defaults.
    pub fn from_env() -> Self {
        let jwt_secret =
            std::env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-me".to_string());
        let access_hours: i64 = std::env::var("ACCESS_TOKEN_HOURS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(24);
        let refresh_days: i64 = std::env::var("REFRESH_TOKEN_DAYS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(7);

        Self {
            jwt_secret,
            access_token_ttl: Duration::hours(access_hours),
            refresh_token_ttl: Duration::days(refresh_days),
        }
    }
}

// ── Roles ────────────────────────────────────────────────────

/// Application-level roles stored in the `users.role` column.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Hash)]
#[serde(rename_all = "snake_case")]
pub enum UserRole {
    SuperAdmin,
    Designer,
    CncOperator,
    ShopFloor,
}

impl fmt::Display for UserRole {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            UserRole::SuperAdmin => write!(f, "super_admin"),
            UserRole::Designer => write!(f, "designer"),
            UserRole::CncOperator => write!(f, "cnc_operator"),
            UserRole::ShopFloor => write!(f, "shop_floor"),
        }
    }
}

impl UserRole {
    /// Parse a role from the database string representation.
    pub fn from_str_role(s: &str) -> Option<Self> {
        match s {
            "super_admin" => Some(Self::SuperAdmin),
            "designer" => Some(Self::Designer),
            "cnc_operator" => Some(Self::CncOperator),
            "shop_floor" => Some(Self::ShopFloor),
            _ => None,
        }
    }

    /// Return the numeric privilege level (higher = more privileged).
    pub fn privilege_level(&self) -> u8 {
        match self {
            UserRole::SuperAdmin => 100,
            UserRole::Designer => 50,
            UserRole::CncOperator => 30,
            UserRole::ShopFloor => 10,
        }
    }
}

// ── Token types ──────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TokenType {
    Access,
    Refresh,
}

// ── JWT Claims ───────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    /// Subject = user id.
    pub sub: Uuid,
    pub email: String,
    pub role: UserRole,
    pub token_type: TokenType,
    /// Issued-at (Unix timestamp).
    pub iat: i64,
    /// Expiration (Unix timestamp).
    pub exp: i64,
}

// ── Token pair returned to the client ────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,       // "Bearer"
    pub expires_in: i64,          // seconds until access token expires
}

// ── AuthenticatedUser (inserted into request extensions) ─────

/// Lightweight struct carried through request extensions after the
/// auth middleware validates the JWT.
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

    /// Returns `true` if this user has one of the `allowed` roles.
    pub fn has_any_role(&self, allowed: &[UserRole]) -> bool {
        allowed.contains(&self.role)
    }

    /// Returns `true` if this user's privilege level is ≥ `min_level`.
    pub fn has_min_privilege(&self, min_level: u8) -> bool {
        self.role.privilege_level() >= min_level
    }
}

// ── Errors ───────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum AuthError {
    #[error("Invalid or expired token")]
    InvalidToken,

    #[error("Token has expired")]
    TokenExpired,

    #[error("Invalid token type: expected {expected:?}")]
    WrongTokenType { expected: TokenType },

    #[error("Missing authorization header")]
    MissingToken,

    #[error("Insufficient permissions: required one of {required:?}")]
    InsufficientRole { required: Vec<UserRole> },

    #[error("Invalid credentials")]
    InvalidCredentials,

    #[error("User not found")]
    UserNotFound,

    #[error("Email already registered")]
    EmailAlreadyExists,

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl actix_web::ResponseError for AuthError {
    fn status_code(&self) -> actix_web::http::StatusCode {
        use actix_web::http::StatusCode;
        match self {
            AuthError::InvalidToken | AuthError::TokenExpired | AuthError::MissingToken => {
                StatusCode::UNAUTHORIZED
            }
            AuthError::WrongTokenType { .. } => StatusCode::UNAUTHORIZED,
            AuthError::InsufficientRole { .. } => StatusCode::FORBIDDEN,
            AuthError::InvalidCredentials => StatusCode::UNAUTHORIZED,
            AuthError::UserNotFound => StatusCode::NOT_FOUND,
            AuthError::EmailAlreadyExists => StatusCode::CONFLICT,
            AuthError::ValidationError(_) => StatusCode::BAD_REQUEST,
            AuthError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_response(&self) -> actix_web::HttpResponse {
        let status = self.status_code();
        actix_web::HttpResponse::build(status).json(serde_json::json!({
            "error": self.to_string(),
            "status": status.as_u16(),
        }))
    }
}

// ── Token generation & validation ────────────────────────────

/// Generate an access + refresh token pair for the given user.
pub fn generate_token_pair(
    user_id: Uuid,
    email: &str,
    role: UserRole,
    config: &AuthConfig,
) -> Result<TokenPair, AuthError> {
    let now = Utc::now();

    let access_claims = Claims {
        sub: user_id,
        email: email.to_string(),
        role,
        token_type: TokenType::Access,
        iat: now.timestamp(),
        exp: (now + config.access_token_ttl).timestamp(),
    };

    let refresh_claims = Claims {
        sub: user_id,
        email: email.to_string(),
        role,
        token_type: TokenType::Refresh,
        iat: now.timestamp(),
        exp: (now + config.refresh_token_ttl).timestamp(),
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

/// Encode a `Claims` struct into a signed JWT string.
pub fn encode_token(claims: &Claims, secret: &str) -> Result<String, AuthError> {
    encode(
        &Header::default(), // HS256
        claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AuthError::Internal(format!("JWT encode error: {e}")))
}

/// Decode and validate a JWT string, returning the parsed `Claims`.
pub fn decode_token(token: &str, secret: &str) -> Result<TokenData<Claims>, AuthError> {
    let mut validation = Validation::default();
    validation.set_required_spec_claims(&["exp", "sub", "iat"]);

    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map_err(|e| match e.kind() {
        jsonwebtoken::errors::ErrorKind::ExpiredSignature => AuthError::TokenExpired,
        _ => AuthError::InvalidToken,
    })
}

/// Decode a token and assert that it is of the expected `TokenType`.
pub fn validate_token(
    token: &str,
    secret: &str,
    expected_type: TokenType,
) -> Result<Claims, AuthError> {
    let token_data = decode_token(token, secret)?;
    let claims = token_data.claims;
    if claims.token_type != expected_type {
        return Err(AuthError::WrongTokenType {
            expected: expected_type,
        });
    }
    Ok(claims)
}

// ── Role-based guard helper ──────────────────────────────────

/// Verifies that the `AuthenticatedUser` holds one of the `allowed` roles.
/// Returns `Ok(())` or an `AuthError::InsufficientRole`.
pub fn require_roles(user: &AuthenticatedUser, allowed: &[UserRole]) -> Result<(), AuthError> {
    if user.has_any_role(allowed) {
        Ok(())
    } else {
        Err(AuthError::InsufficientRole {
            required: allowed.to_vec(),
        })
    }
}

/// Convenience wrapper — allows **only** `SuperAdmin`.
pub fn require_admin(user: &AuthenticatedUser) -> Result<(), AuthError> {
    require_roles(user, &[UserRole::SuperAdmin])
}

// ── RequireRole extractor ────────────────────────────────────

use actix_web::{FromRequest, HttpRequest};
use std::future::{ready, Ready};
use std::marker::PhantomData;

/// Marker traits for compile-time role checking.
pub trait RoleGuard {
    fn allowed_roles() -> Vec<UserRole>;
}

/// Allows only super_admin.
pub struct AdminOnly;
impl RoleGuard for AdminOnly {
    fn allowed_roles() -> Vec<UserRole> {
        vec![UserRole::SuperAdmin]
    }
}

/// Allows super_admin and designer.
pub struct DesignerOrAbove;
impl RoleGuard for DesignerOrAbove {
    fn allowed_roles() -> Vec<UserRole> {
        vec![UserRole::SuperAdmin, UserRole::Designer]
    }
}

/// Allows super_admin, designer, and cnc_operator.
pub struct OperatorOrAbove;
impl RoleGuard for OperatorOrAbove {
    fn allowed_roles() -> Vec<UserRole> {
        vec![UserRole::SuperAdmin, UserRole::Designer, UserRole::CncOperator]
    }
}

/// Allows any authenticated user.
pub struct AnyAuthenticated;
impl RoleGuard for AnyAuthenticated {
    fn allowed_roles() -> Vec<UserRole> {
        vec![
            UserRole::SuperAdmin,
            UserRole::Designer,
            UserRole::CncOperator,
            UserRole::ShopFloor,
        ]
    }
}

/// Generic Actix-web extractor that combines authentication + role check.
///
/// Usage in a handler:
/// ```rust
/// async fn admin_only(user: RequireRole<AdminOnly>) -> impl Responder { ... }
/// ```
pub struct RequireRole<R: RoleGuard> {
    pub user: AuthenticatedUser,
    _marker: PhantomData<R>,
}

impl<R: RoleGuard> RequireRole<R> {
    pub fn into_inner(self) -> AuthenticatedUser {
        self.user
    }
}

impl<R: RoleGuard + 'static> FromRequest for RequireRole<R> {
    type Error = AuthError;
    type Future = Ready<Result<Self, Self::Error>>;

    fn from_request(req: &HttpRequest, _payload: &mut actix_web::dev::Payload) -> Self::Future {
        let result = req
            .extensions()
            .get::<AuthenticatedUser>()
            .cloned()
            .ok_or(AuthError::MissingToken)
            .and_then(|user| {
                require_roles(&user, &R::allowed_roles())?;
                Ok(RequireRole {
                    user,
                    _marker: PhantomData,
                })
            });
        ready(result)
    }
}
