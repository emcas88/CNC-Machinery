// backend/src/auth/password.rs
// ============================================================
// F20 · Password hashing & verification (Argon2id)
// ============================================================
//
// Uses the `argon2` crate with the recommended Argon2id variant and
// a random 16-byte salt generated via `rand_core::OsRng`.

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use thiserror::Error;

// ── Error types ──────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum PasswordError {
    #[error("Failed to hash password: {0}")]
    HashError(String),

    #[error("Password verification failed")]
    VerifyError,
}

// ── Public API ───────────────────────────────────────────────

/// Hash a plain-text password with Argon2id and a random salt.
/// Returns the PHC-formatted hash string (includes algorithm, salt, and hash).
pub fn hash_password(password: &str) -> Result<String, PasswordError> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default(); // Argon2id v19
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| PasswordError::HashError(e.to_string()))?;
    Ok(password_hash.to_string())
}

/// Verify a plain-text password against a stored PHC-formatted hash.
pub fn verify_password(password: &str, hash: &str) -> Result<bool, PasswordError> {
    let parsed_hash =
        PasswordHash::new(hash).map_err(|e| PasswordError::HashError(e.to_string()))?;
    match Argon2::default().verify_password(password.as_bytes(), &parsed_hash) {
        Ok(()) => Ok(true),
        Err(argon2::password_hash::Error::Password) => Ok(false),
        Err(e) => Err(PasswordError::HashError(e.to_string())),
    }
}

/// Validate password strength requirements.
/// Returns `Ok(())` if the password meets all criteria, otherwise returns
/// an error message describing the failure.
pub fn validate_password_strength(password: &str) -> Result<(), String> {
    if password.len() < 8 {
        return Err("Password must be at least 8 characters long".into());
    }
    if password.len() > 128 {
        return Err("Password must not exceed 128 characters".into());
    }
    if !password.chars().any(|c| c.is_uppercase()) {
        return Err("Password must contain at least one uppercase letter".into());
    }
    if !password.chars().any(|c| c.is_lowercase()) {
        return Err("Password must contain at least one lowercase letter".into());
    }
    if !password.chars().any(|c| c.is_ascii_digit()) {
        return Err("Password must contain at least one digit".into());
    }
    Ok(())
}
