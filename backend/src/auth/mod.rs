// backend/src/auth/mod.rs
// =====================================================================
// Round-3 integration fixes
// Fixed Issues 7-13 (compiler errors in auth/mod.rs):
//   7.  Removed duplicate `pub mod password` declaration.
//   8.  Unified JWT secret retrieval into a single helper `jwt_secret()`.
//   9.  `TokenClaims` now derives Clone so it can be returned by value.
//   10. `create_access_token` & `create_refresh_token` return
//       Result<String, AuthError> (not bare String).
//   11. `verify_access_token` / `verify_refresh_token` use the shared
//       `jwt_secret()` helper.
//   12. Added `AuthError::TokenExpired` variant used by callers.
//   13. Re-exported `hash_password` / `verify_password` from the password
//       sub-module so auth_api can import them from `crate::auth`.
// =====================================================================

pub mod auth_api;
pub mod password;
#[cfg(test)]
mod tests_r3;

use chrono::Utc;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// Re-export password helpers so callers can use `crate::auth::hash_password`
pub use password::{hash_password, verify_password};

// ------------------------------------------------------------------
// Error type
// ------------------------------------------------------------------

#[derive(Debug)]
pub enum AuthError {
    /// JWT has expired
    TokenExpired,
    /// Any other JWT / encoding error
    JwtError(jsonwebtoken::errors::Error),
    /// Bcrypt / hashing error
    HashError(bcrypt::BcryptError),
}

impl std::fmt::Display for AuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuthError::TokenExpired => write!(f, "token expired"),
            AuthError::JwtError(e) => write!(f, "jwt error: {e}"),
            AuthError::HashError(e) => write!(f, "hash error: {e}"),
        }
    }
}

impl From<jsonwebtoken::errors::Error> for AuthError {
    fn from(e: jsonwebtoken::errors::Error) -> Self {
        use jsonwebtoken::errors::ErrorKind;
        if matches!(e.kind(), ErrorKind::ExpiredSignature) {
            AuthError::TokenExpired
        } else {
            AuthError::JwtError(e)
        }
    }
}

impl From<bcrypt::BcryptError> for AuthError {
    fn from(e: bcrypt::BcryptError) -> Self {
        AuthError::HashError(e)
    }
}

// ------------------------------------------------------------------
// Claims
// ------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenClaims {
    pub sub: String,
    pub role: String,
    pub exp: usize,
    pub iat: usize,
}

// ------------------------------------------------------------------
// Shared secret helper (Fixed Issue 8)
// ------------------------------------------------------------------

fn jwt_secret() -> String {
    std::env::var("JWT_SECRET").unwrap_or_else(|_| "change-me-in-production".to_string())
}

// ------------------------------------------------------------------
// Token creation (Fixed Issue 10)
// ------------------------------------------------------------------

pub fn create_access_token(user_id: Uuid, role: &str) -> Result<String, AuthError> {
    let now = Utc::now().timestamp() as usize;
    let claims = TokenClaims {
        sub: user_id.to_string(),
        role: role.to_string(),
        iat: now,
        exp: now + 15 * 60, // 15 minutes
    };
    let secret = jwt_secret();
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(AuthError::from)
}

pub fn create_refresh_token(user_id: Uuid) -> Result<String, AuthError> {
    let now = Utc::now().timestamp() as usize;
    let claims = TokenClaims {
        sub: user_id.to_string(),
        role: String::new(),
        iat: now,
        exp: now + 7 * 24 * 60 * 60, // 7 days
    };
    let secret = jwt_secret();
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(AuthError::from)
}

// ------------------------------------------------------------------
// Token verification (Fixed Issue 11)
// ------------------------------------------------------------------

pub fn verify_access_token(token: &str) -> Result<TokenClaims, AuthError> {
    let secret = jwt_secret();
    decode::<TokenClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map(|data| data.claims)
    .map_err(AuthError::from)
}

pub fn verify_refresh_token(token: &str) -> Result<TokenClaims, AuthError> {
    let secret = jwt_secret();
    decode::<TokenClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    )
    .map(|data| data.claims)
    .map_err(AuthError::from)
}
