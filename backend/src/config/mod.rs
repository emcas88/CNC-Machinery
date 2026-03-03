// =============================================================================
// backend/src/config/mod.rs — Enhanced application configuration
// F21: Backend Compilation Fixes
//
// Adds Redis, MinIO/S3, JWT, and CORS configuration fields.
// Uses Result<AppConfig, ConfigError> instead of .expect() for graceful errors.
// =============================================================================

use std::env;
use std::fmt;

#[cfg(test)]
mod tests;

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/// Errors that can occur when loading configuration from the environment.
#[derive(Debug, Clone)]
pub enum ConfigError {
    /// A required environment variable is missing.
    MissingVar(String),
    /// An environment variable has an invalid value.
    InvalidValue { var: String, message: String },
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ConfigError::MissingVar(var) => {
                write!(f, "Missing required environment variable: {}", var)
            }
            ConfigError::InvalidValue { var, message } => {
                write!(f, "Invalid value for {}: {}", var, message)
            }
        }
    }
}

impl std::error::Error for ConfigError {}

// ---------------------------------------------------------------------------
// Configuration struct
// ---------------------------------------------------------------------------

/// Application configuration loaded from environment variables.
#[derive(Debug, Clone)]
pub struct AppConfig {
    // ── Core ──────────────────────────────────────────────────────────────────────
    pub database_url: String,
    pub server_host: String,
    pub server_port: u16,

    // ── Redis ─────────────────────────────────────────────────────────────────────
    pub redis_url: String,

    // ── MinIO / S3 ────────────────────────────────────────────────────────────────
    pub minio_endpoint: String,
    pub minio_access_key: String,
    pub minio_secret_key: String,
    pub minio_bucket: String,

    // ── JWT ───────────────────────────────────────────────────────────────────────
    pub jwt_secret: String,
    pub jwt_access_expires_secs: u64,
    pub jwt_refresh_expires_secs: u64,

    // ── CORS ──────────────────────────────────────────────────────────────────────
    pub cors_allowed_origins: Vec<String>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Read a required env var or return `ConfigError::MissingVar`.
fn require_var(name: &str) -> Result<String, ConfigError> {
    env::var(name).map_err(|_| ConfigError::MissingVar(name.to_string()))
}

/// Read an optional env var with a fallback default.
fn optional_var(name: &str, default: &str) -> String {
    env::var(name).unwrap_or_else(|_| default.to_string())
}

/// Parse a numeric env var with a fallback default.
fn parse_u64_var(name: &str, default: u64) -> Result<u64, ConfigError> {
    match env::var(name) {
        Ok(val) => val.parse::<u64>().map_err(|_| ConfigError::InvalidValue {
            var: name.to_string(),
            message: format!("'{}' is not a valid u64", val),
        }),
        Err(_) => Ok(default),
    }
}

/// Parse a u16 env var with a fallback default.
fn parse_u16_var(name: &str, default: u16) -> Result<u16, ConfigError> {
    match env::var(name) {
        Ok(val) => val.parse::<u16>().map_err(|_| ConfigError::InvalidValue {
            var: name.to_string(),
            message: format!("'{}' is not a valid port number (u16)", val),
        }),
        Err(_) => Ok(default),
    }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

impl AppConfig {
    /// Load configuration from environment variables.
    ///
    /// Returns `Err(ConfigError)` when a required variable is missing or a
    /// value cannot be parsed, instead of panicking.
    pub fn from_env() -> Result<AppConfig, ConfigError> {
        let cors_raw = optional_var("CORS_ALLOWED_ORIGINS", "http://localhost:5173");
        let cors_allowed_origins: Vec<String> = cors_raw
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        Ok(AppConfig {
            // Core
            database_url: require_var("DATABASE_URL")?,
            server_host: optional_var("SERVER_HOST", "0.0.0.0"),
            server_port: parse_u16_var("SERVER_PORT", 8080)?,

            // Redis
            redis_url: optional_var("REDIS_URL", "redis://127.0.0.1:6379"),

            // MinIO / S3
            minio_endpoint: optional_var("MINIO_ENDPOINT", "http://localhost:9000"),
            minio_access_key: optional_var("MINIO_ACCESS_KEY", "minioadmin"),
            minio_secret_key: optional_var("MINIO_SECRET_KEY", "minioadmin"),
            minio_bucket: optional_var("MINIO_BUCKET", "cnc-files"),

            // JWT
            jwt_secret: require_var("JWT_SECRET")?,
            jwt_access_expires_secs: parse_u64_var("JWT_ACCESS_EXPIRES_SECS", 900)?, // 15 min
            jwt_refresh_expires_secs: parse_u64_var("JWT_REFRESH_EXPIRES_SECS", 604800)?, // 7 days

            // CORS
            cors_allowed_origins,
        })
    }

    /// Convenience: Load config or exit the process with a human-readable
    /// error. Intended for `main()`.
    pub fn from_env_or_exit() -> AppConfig {
        match Self::from_env() {
            Ok(cfg) => cfg,
            Err(e) => {
                eprintln!("Configuration error: {e}");
                std::process::exit(1);
            }
        }
    }
}
