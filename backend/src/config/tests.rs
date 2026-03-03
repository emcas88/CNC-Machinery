//! Tests for AppConfig environment variable loading.
//!
//! Each test sets the environment variables it needs, calls from_env(), and
//! then removes the variables it set so the test environment stays clean for
//! other parallel tests.
//!
//! Because Rust runs unit tests in the same process (potentially in parallel),
//! we use a mutex to serialise tests that mutate env vars.

#[cfg(test)]
mod tests {
    use crate::config::AppConfig;
    use std::sync::Mutex;

    // Global mutex to serialise env-var manipulation across parallel tests.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    /// Helper: set DATABASE_URL, SERVER_HOST, and SERVER_PORT; return a guard
    /// so the caller can clean up after from_env() returns.
    fn set_all_env(db_url: &str, host: &str, port: &str) {
        unsafe {
            std::env::set_var("DATABASE_URL", db_url);
            std::env::set_var("SERVER_HOST", host);
            std::env::set_var("SERVER_PORT", port);
        }
    }

    fn remove_all_env() {
        unsafe {
            std::env::remove_var("DATABASE_URL");
            std::env::remove_var("SERVER_HOST");
            std::env::remove_var("SERVER_PORT");
        }
    }

    // -------------------------------------------------------------------------
    // from_env() with all variables explicitly set
    // -------------------------------------------------------------------------

    #[test]
    fn test_from_env_reads_database_url() {
        let _guard = ENV_LOCK.lock().unwrap();
        set_all_env(
            "postgres://user:pass@localhost:5432/cnc_db",
            "127.0.0.1",
            "9000",
        );
        let cfg = AppConfig::from_env();
        assert_eq!(
            cfg.database_url,
            "postgres://user:pass@localhost:5432/cnc_db"
        );
        remove_all_env();
    }

    #[test]
    fn test_from_env_reads_server_host() {
        let _guard = ENV_LOCK.lock().unwrap();
        set_all_env("postgres://localhost/cnc", "192.168.1.100", "8080");
        let cfg = AppConfig::from_env();
        assert_eq!(cfg.server_host, "192.168.1.100");
        remove_all_env();
    }

    #[test]
    fn test_from_env_reads_server_port_as_u16() {
        let _guard = ENV_LOCK.lock().unwrap();
        set_all_env("postgres://localhost/cnc", "0.0.0.0", "3000");
        let cfg = AppConfig::from_env();
        assert_eq!(cfg.server_port, 3000u16);
        remove_all_env();
    }

    #[test]
    fn test_from_env_all_vars_set_returns_correct_config() {
        let _guard = ENV_LOCK.lock().unwrap();
        set_all_env(
            "postgres://admin:secret@db.internal:5432/production",
            "10.0.0.1",
            "8443",
        );
        let cfg = AppConfig::from_env();
        assert_eq!(
            cfg.database_url,
            "postgres://admin:secret@db.internal:5432/production"
        );
        assert_eq!(cfg.server_host, "10.0.0.1");
        assert_eq!(cfg.server_port, 8443u16);
        remove_all_env();
    }

    // -------------------------------------------------------------------------
    // Default values when optional vars are absent
    // -------------------------------------------------------------------------

    #[test]
    fn test_from_env_server_host_defaults_to_0000() {
        let _guard = ENV_LOCK.lock().unwrap();
        unsafe {
            std::env::set_var("DATABASE_URL", "postgres://localhost/cnc");
            std::env::remove_var("SERVER_HOST");
            std::env::remove_var("SERVER_PORT");
        }
        let cfg = AppConfig::from_env();
        assert_eq!(
            cfg.server_host, "0.0.0.0",
            "SERVER_HOST must default to 0.0.0.0 when not set"
        );
        remove_all_env();
    }

    #[test]
    fn test_from_env_server_port_defaults_to_8080() {
        let _guard = ENV_LOCK.lock().unwrap();
        unsafe {
            std::env::set_var("DATABASE_URL", "postgres://localhost/cnc");
            std::env::remove_var("SERVER_HOST");
            std::env::remove_var("SERVER_PORT");
        }
        let cfg = AppConfig::from_env();
        assert_eq!(
            cfg.server_port, 8080u16,
            "SERVER_PORT must default to 8080 when not set"
        );
        remove_all_env();
    }

    #[test]
    fn test_from_env_defaults_both_host_and_port() {
        let _guard = ENV_LOCK.lock().unwrap();
        unsafe {
            std::env::set_var("DATABASE_URL", "postgres://localhost/cnc_test");
            std::env::remove_var("SERVER_HOST");
            std::env::remove_var("SERVER_PORT");
        }
        let cfg = AppConfig::from_env();
        assert_eq!(cfg.server_host, "0.0.0.0");
        assert_eq!(cfg.server_port, 8080);
        remove_all_env();
    }

    // -------------------------------------------------------------------------
    // DATABASE_URL variations
    // -------------------------------------------------------------------------

    #[test]
    fn test_from_env_database_url_with_ssl_mode() {
        let _guard = ENV_LOCK.lock().unwrap();
        set_all_env(
            "postgres://user:pass@db.example.com:5432/cnc?sslmode=require",
            "0.0.0.0",
            "8080",
        );
        let cfg = AppConfig::from_env();
        assert!(
            cfg.database_url.contains("sslmode=require"),
            "DATABASE_URL must preserve query parameters"
        );
        remove_all_env();
    }

    #[test]
    fn test_from_env_database_url_localhost() {
        let _guard = ENV_LOCK.lock().unwrap();
        set_all_env("postgres://localhost/test_cnc", "0.0.0.0", "8080");
        let cfg = AppConfig::from_env();
        assert_eq!(cfg.database_url, "postgres://localhost/test_cnc");
        remove_all_env();
    }

    // -------------------------------------------------------------------------
    // SERVER_PORT edge cases
    // -------------------------------------------------------------------------

    #[test]
    fn test_from_env_server_port_minimum_valid_port() {
        let _guard = ENV_LOCK.lock().unwrap();
        set_all_env("postgres://localhost/cnc", "0.0.0.0", "1");
        let cfg = AppConfig::from_env();
        assert_eq!(cfg.server_port, 1u16);
        remove_all_env();
    }

    #[test]
    fn test_from_env_server_port_maximum_valid_port() {
        let _guard = ENV_LOCK.lock().unwrap();
        set_all_env("postgres://localhost/cnc", "0.0.0.0", "65535");
        let cfg = AppConfig::from_env();
        assert_eq!(cfg.server_port, 65535u16);
        remove_all_env();
    }

    #[test]
    fn test_from_env_server_port_common_alternative_3000() {
        let _guard = ENV_LOCK.lock().unwrap();
        set_all_env("postgres://localhost/cnc", "localhost", "3000");
        let cfg = AppConfig::from_env();
        assert_eq!(cfg.server_port, 3000u16);
        remove_all_env();
    }

    // -------------------------------------------------------------------------
    // AppConfig structural tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_app_config_is_cloneable() {
        let _guard = ENV_LOCK.lock().unwrap();
        set_all_env("postgres://localhost/cnc", "0.0.0.0", "8080");
        let cfg = AppConfig::from_env();
        let cloned = cfg.clone();
        assert_eq!(cloned.database_url, cfg.database_url);
        assert_eq!(cloned.server_host, cfg.server_host);
        assert_eq!(cloned.server_port, cfg.server_port);
        remove_all_env();
    }

    #[test]
    fn test_app_config_debug_format_contains_fields() {
        let _guard = ENV_LOCK.lock().unwrap();
        set_all_env("postgres://localhost/cnc", "0.0.0.0", "8080");
        let cfg = AppConfig::from_env();
        let debug_str = format!("{:?}", cfg);
        assert!(debug_str.contains("database_url"));
        assert!(debug_str.contains("server_host"));
        assert!(debug_str.contains("server_port"));
        remove_all_env();
    }

    // -------------------------------------------------------------------------
    // Panic tests: from_env() must panic when DATABASE_URL is missing
    // -------------------------------------------------------------------------

    #[test]
    #[should_panic(expected = "DATABASE_URL must be set")]
    fn test_from_env_panics_when_database_url_missing() {
        let _guard = ENV_LOCK.lock().unwrap();
        unsafe {
            std::env::remove_var("DATABASE_URL");
            std::env::remove_var("SERVER_HOST");
            std::env::remove_var("SERVER_PORT");
        }
        // This must panic with the expected message
        let _ = AppConfig::from_env();
    }

    // -------------------------------------------------------------------------
    // SERVER_PORT parse failure causes panic
    // -------------------------------------------------------------------------

    #[test]
    #[should_panic(expected = "SERVER_PORT must be a valid port number")]
    fn test_from_env_panics_when_server_port_not_numeric() {
        let _guard = ENV_LOCK.lock().unwrap();
        unsafe {
            std::env::set_var("DATABASE_URL", "postgres://localhost/cnc");
            std::env::set_var("SERVER_PORT", "not_a_number");
            std::env::remove_var("SERVER_HOST");
        }
        let _ = AppConfig::from_env();
        // cleanup in case we somehow don't panic (won't reach in practice)
        remove_all_env();
    }

    #[test]
    #[should_panic(expected = "SERVER_PORT must be a valid port number")]
    fn test_from_env_panics_when_server_port_exceeds_u16() {
        let _guard = ENV_LOCK.lock().unwrap();
        unsafe {
            std::env::set_var("DATABASE_URL", "postgres://localhost/cnc");
            std::env::set_var("SERVER_PORT", "99999"); // > u16::MAX
            std::env::remove_var("SERVER_HOST");
        }
        let _ = AppConfig::from_env();
        remove_all_env();
    }
}
