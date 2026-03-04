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
        let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

        let jwt_secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");

        let bind_addr = std::env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".to_string());

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
    use std::sync::Mutex;

    /// Global mutex to serialise env-var manipulation across tests.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    /// Lock the ENV_LOCK, recovering from poison if a previous test panicked.
    fn lock_env() -> std::sync::MutexGuard<'static, ()> {
        ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Save, run, and restore environment variables around a closure that may panic.
    fn with_env_restore<F: FnOnce() + std::panic::UnwindSafe>(f: F) {
        let saved_db = std::env::var("DATABASE_URL").ok();
        let saved_jwt = std::env::var("JWT_SECRET").ok();
        let saved_bind = std::env::var("BIND_ADDR").ok();
        let saved_ath = std::env::var("ACCESS_TOKEN_HOURS").ok();
        let saved_rtd = std::env::var("REFRESH_TOKEN_DAYS").ok();

        let result = std::panic::catch_unwind(f);

        // Restore all env vars
        for (key, saved) in [
            ("DATABASE_URL", saved_db),
            ("JWT_SECRET", saved_jwt),
            ("BIND_ADDR", saved_bind),
            ("ACCESS_TOKEN_HOURS", saved_ath),
            ("REFRESH_TOKEN_DAYS", saved_rtd),
        ] {
            match saved {
                Some(v) => std::env::set_var(key, v),
                None => std::env::remove_var(key),
            }
        }

        if let Err(e) = result {
            std::panic::resume_unwind(e);
        }
    }

    #[test]
    #[should_panic(expected = "DATABASE_URL must be set")]
    fn test_from_env_panics_without_database_url() {
        let _guard = lock_env();
        with_env_restore(|| {
            std::env::remove_var("DATABASE_URL");
            std::env::remove_var("JWT_SECRET");
            Config::from_env();
        });
    }

    #[test]
    #[should_panic(expected = "JWT_SECRET must be set")]
    fn test_from_env_panics_without_jwt_secret() {
        let _guard = lock_env();
        with_env_restore(|| {
            std::env::set_var("DATABASE_URL", "postgres://localhost/test");
            std::env::remove_var("JWT_SECRET");
            Config::from_env();
        });
    }

    #[test]
    fn test_from_env_uses_defaults() {
        let _guard = lock_env();
        with_env_restore(|| {
            std::env::set_var("DATABASE_URL", "postgres://localhost/test");
            std::env::set_var("JWT_SECRET", "test-secret");
            std::env::remove_var("BIND_ADDR");
            std::env::remove_var("ACCESS_TOKEN_HOURS");
            std::env::remove_var("REFRESH_TOKEN_DAYS");

            let cfg = Config::from_env();
            assert_eq!(cfg.bind_addr, "0.0.0.0:8080");
            assert_eq!(cfg.access_token_hours, 24);
            assert_eq!(cfg.refresh_token_days, 7);
        });
    }

    #[test]
    fn test_from_env_custom_values() {
        let _guard = lock_env();
        with_env_restore(|| {
            std::env::set_var("DATABASE_URL", "postgres://user:pass@db:5432/prod");
            std::env::set_var("JWT_SECRET", "my-secret");
            std::env::set_var("BIND_ADDR", "127.0.0.1:3000");
            std::env::set_var("ACCESS_TOKEN_HOURS", "48");
            std::env::set_var("REFRESH_TOKEN_DAYS", "30");

            let cfg = Config::from_env();
            assert_eq!(cfg.database_url, "postgres://user:pass@db:5432/prod");
            assert_eq!(cfg.jwt_secret, "my-secret");
            assert_eq!(cfg.bind_addr, "127.0.0.1:3000");
            assert_eq!(cfg.access_token_hours, 48);
            assert_eq!(cfg.refresh_token_days, 30);
        });
    }

    #[test]
    fn test_from_env_invalid_access_token_hours_uses_default() {
        let _guard = lock_env();
        with_env_restore(|| {
            std::env::set_var("DATABASE_URL", "postgres://localhost/test");
            std::env::set_var("JWT_SECRET", "test");
            std::env::set_var("ACCESS_TOKEN_HOURS", "not-a-number");

            let cfg = Config::from_env();
            assert_eq!(cfg.access_token_hours, 24);
        });
    }

    #[test]
    fn test_from_env_invalid_refresh_token_days_uses_default() {
        let _guard = lock_env();
        with_env_restore(|| {
            std::env::set_var("DATABASE_URL", "postgres://localhost/test");
            std::env::set_var("JWT_SECRET", "test");
            std::env::set_var("REFRESH_TOKEN_DAYS", "not-a-number");

            let cfg = Config::from_env();
            assert_eq!(cfg.refresh_token_days, 7);
        });
    }

    #[test]
    fn test_config_is_cloneable() {
        let _guard = lock_env();
        with_env_restore(|| {
            std::env::set_var("DATABASE_URL", "postgres://localhost/test");
            std::env::set_var("JWT_SECRET", "test");

            let cfg = Config::from_env();
            let cloned = cfg.clone();
            assert_eq!(cfg.database_url, cloned.database_url);
            assert_eq!(cfg.jwt_secret, cloned.jwt_secret);
        });
    }

    #[test]
    fn test_config_debug() {
        let _guard = lock_env();
        with_env_restore(|| {
            std::env::set_var("DATABASE_URL", "postgres://localhost/test");
            std::env::set_var("JWT_SECRET", "test");

            let cfg = Config::from_env();
            let debug = format!("{:?}", cfg);
            assert!(debug.contains("database_url"));
            assert!(debug.contains("jwt_secret"));
        });
    }
}
