// backend/src/config/mod.rs

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub bind_addr: String,
    pub access_token_hours: i64,
    pub refresh_token_days: i64,
}

impl Config {
    /// Load configuration from environment variables.
    /// Panics if required variables are missing (DATABASE_URL, JWT_SECRET).
    pub fn from_env() -> Self {
        let database_url = std::env::var("DATABASE_URL")
            .expect("DATABASE_URL must be set");

        let jwt_secret = std::env::var("JWT_SECRET")
            .expect("JWT_SECRET must be set");

        let bind_addr = std::env::var("BIND_ADDR")
            .unwrap_or_else(|_| "0.0.0.0:8080".to_string());

        let access_token_hours = std::env::var("ACCESS_TOKEN_HOURS")
            .ok()
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(24);

        let refresh_token_days = std::env::var("REFRESH_TOKEN_DAYS")
            .ok()
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(7);

        Self {
            database_url,
            jwt_secret,
            bind_addr,
            access_token_hours,
            refresh_token_days,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[should_panic(expected = "DATABASE_URL must be set")]
    fn test_from_env_panics_without_database_url() {
        // Remove both vars; DATABASE_URL is checked first.
        std::env::remove_var("DATABASE_URL");
        std::env::remove_var("JWT_SECRET");
        Config::from_env();
    }

    #[test]
    #[should_panic(expected = "JWT_SECRET must be set")]
    fn test_from_env_panics_without_jwt_secret() {
        // Set DATABASE_URL so we reach the JWT_SECRET check.
        std::env::set_var("DATABASE_URL", "postgres://localhost/test");
        std::env::remove_var("JWT_SECRET");
        Config::from_env();
    }

    #[test]
    fn test_from_env_uses_defaults() {
        std::env::set_var("DATABASE_URL", "postgres://localhost/test");
        std::env::set_var("JWT_SECRET", "test-secret");
        std::env::remove_var("BIND_ADDR");
        std::env::remove_var("ACCESS_TOKEN_HOURS");
        std::env::remove_var("REFRESH_TOKEN_DAYS");

        let cfg = Config::from_env();
        assert_eq!(cfg.bind_addr, "0.0.0.0:8080");
        assert_eq!(cfg.access_token_hours, 24);
        assert_eq!(cfg.refresh_token_days, 7);
    }
}
