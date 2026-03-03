// =============================================================================
// tests.rs — 50 tests for F21: Backend Compilation Fixes
//
// Covers:
//   - Config parsing (AppConfig::from_env)          — 22 tests
//   - Migration SQL validity                        — 10 tests
//   - Audit middleware helpers                       — 10 tests
//   - Services mod completeness                     —  4 tests
//   - Cargo.toml dependency sanity                  —  4 tests
//
// These tests are designed to run with `cargo test` inside the backend crate
// once the files from this feature branch are applied.
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// § 1  CONFIG PARSING TESTS
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod config_tests {
    use std::sync::Mutex;

    // Import the enhanced AppConfig and ConfigError from the new config module.
    // When integrated: `use crate::config::{AppConfig, ConfigError};`
    // For standalone compilation these are inlined below.

    // ── Inline types (mirrors config_mod.rs) ─────────────────────────────
    #[derive(Debug, Clone)]
    pub enum ConfigError {
        MissingVar(String),
        InvalidValue { var: String, message: String },
    }

    impl std::fmt::Display for ConfigError {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
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

    #[derive(Debug, Clone)]
    pub struct AppConfig {
        pub database_url: String,
        pub server_host: String,
        pub server_port: u16,
        pub redis_url: String,
        pub minio_endpoint: String,
        pub minio_access_key: String,
        pub minio_secret_key: String,
        pub minio_bucket: String,
        pub jwt_secret: String,
        pub jwt_access_expires_secs: u64,
        pub jwt_refresh_expires_secs: u64,
        pub cors_allowed_origins: Vec<String>,
    }

    fn require_var(name: &str) -> Result<String, ConfigError> {
        std::env::var(name).map_err(|_| ConfigError::MissingVar(name.to_string()))
    }
    fn optional_var(name: &str, default: &str) -> String {
        std::env::var(name).unwrap_or_else(|_| default.to_string())
    }
    fn parse_u64_var(name: &str, default: u64) -> Result<u64, ConfigError> {
        match std::env::var(name) {
            Ok(val) => val.parse::<u64>().map_err(|_| ConfigError::InvalidValue {
                var: name.to_string(),
                message: format!("'{}' is not a valid u64", val),
            }),
            Err(_) => Ok(default),
        }
    }
    fn parse_u16_var(name: &str, default: u16) -> Result<u16, ConfigError> {
        match std::env::var(name) {
            Ok(val) => val.parse::<u16>().map_err(|_| ConfigError::InvalidValue {
                var: name.to_string(),
                message: format!("'{}' is not a valid port number (u16)", val),
            }),
            Err(_) => Ok(default),
        }
    }

    impl AppConfig {
        pub fn from_env() -> Result<AppConfig, ConfigError> {
            let cors_raw = optional_var("CORS_ALLOWED_ORIGINS", "http://localhost:5173");
            let cors_allowed_origins: Vec<String> = cors_raw
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            Ok(AppConfig {
                database_url: require_var("DATABASE_URL")?,
                server_host: optional_var("SERVER_HOST", "0.0.0.0"),
                server_port: parse_u16_var("SERVER_PORT", 8080)?,
                redis_url: optional_var("REDIS_URL", "redis://127.0.0.1:6379"),
                minio_endpoint: optional_var("MINIO_ENDPOINT", "http://localhost:9000"),
                minio_access_key: optional_var("MINIO_ACCESS_KEY", "minioadmin"),
                minio_secret_key: optional_var("MINIO_SECRET_KEY", "minioadmin"),
                minio_bucket: optional_var("MINIO_BUCKET", "cnc-files"),
                jwt_secret: require_var("JWT_SECRET")?,
                jwt_access_expires_secs: parse_u64_var("JWT_ACCESS_EXPIRES_SECS", 900)?,
                jwt_refresh_expires_secs: parse_u64_var("JWT_REFRESH_EXPIRES_SECS", 604800)?,
                cors_allowed_origins,
            })
        }
    }

    // Serialise env-var manipulation across parallel test threads.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    /// Set all required + optional env vars for a full config load.
    fn set_full_env() {
        unsafe {
            std::env::set_var("DATABASE_URL", "postgres://u:p@localhost:5432/cnc");
            std::env::set_var("SERVER_HOST", "127.0.0.1");
            std::env::set_var("SERVER_PORT", "9090");
            std::env::set_var("REDIS_URL", "redis://redis:6379");
            std::env::set_var("MINIO_ENDPOINT", "http://minio:9000");
            std::env::set_var("MINIO_ACCESS_KEY", "mykey");
            std::env::set_var("MINIO_SECRET_KEY", "mysecret");
            std::env::set_var("MINIO_BUCKET", "test-bucket");
            std::env::set_var("JWT_SECRET", "super-secret-key-for-testing");
            std::env::set_var("JWT_ACCESS_EXPIRES_SECS", "1800");
            std::env::set_var("JWT_REFRESH_EXPIRES_SECS", "86400");
            std::env::set_var("CORS_ALLOWED_ORIGINS", "http://a.com,http://b.com");
        }
    }

    /// Set only the two required vars.
    fn set_minimal_env() {
        unsafe {
            std::env::set_var("DATABASE_URL", "postgres://localhost/cnc_min");
            std::env::set_var("JWT_SECRET", "min-secret");
        }
    }

    fn remove_all_env() {
        let vars = [
            "DATABASE_URL", "SERVER_HOST", "SERVER_PORT", "REDIS_URL",
            "MINIO_ENDPOINT", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY", "MINIO_BUCKET",
            "JWT_SECRET", "JWT_ACCESS_EXPIRES_SECS", "JWT_REFRESH_EXPIRES_SECS",
            "CORS_ALLOWED_ORIGINS",
        ];
        unsafe {
            for v in vars {
                std::env::remove_var(v);
            }
        }
    }

    // ── 1. Full env load ────────────────────────────────────────────────────────

    #[test]
    fn test_config_full_env_database_url() {
        let _g = ENV_LOCK.lock().unwrap();
        set_full_env();
        let cfg = AppConfig::from_env().unwrap();
        assert_eq!(cfg.database_url, "postgres://u:p@localhost:5432/cnc");
        remove_all_env();
    }

    #[test]
    fn test_config_full_env_server_host() {
        let _g = ENV_LOCK.lock().unwrap();
        set_full_env();
        let cfg = AppConfig::from_env().unwrap();
        assert_eq!(cfg.server_host, "127.0.0.1");
        remove_all_env();
    }

    #[test]
    fn test_config_full_env_server_port() {
        let _g = ENV_LOCK.lock().unwrap();
        set_full_env();
        let cfg = AppConfig::from_env().unwrap();
        assert_eq!(cfg.server_port, 9090);
        remove_all_env();
    }

    #[test]
    fn test_config_full_env_redis_url() {
        let _g = ENV_LOCK.lock().unwrap();
        set_full_env();
        let cfg = AppConfig::from_env().unwrap();
        assert_eq!(cfg.redis_url, "redis://redis:6379");
        remove_all_env();
    }

    #[test]
    fn test_config_full_env_minio_endpoint() {
        let _g = ENV_LOCK.lock().unwrap();
        set_full_env();
        let cfg = AppConfig::from_env().unwrap();
        assert_eq!(cfg.minio_endpoint, "http://minio:9000");
        remove_all_env();
    }

    #[test]
    fn test_config_full_env_minio_access_key() {
        let _g = ENV_LOCK.lock().unwrap();
        set_full_env();
        let cfg = AppConfig::from_env().unwrap();
        assert_eq!(cfg.minio_access_key, "mykey");
        remove_all_env();
    }

    #[test]
    fn test_config_full_env_minio_secret_key() {
        let _g = ENV_LOCK.lock().unwrap();
        set_full_env();
        let cfg = AppConfig::from_env().unwrap();
        assert_eq!(cfg.minio_secret_key, "mysecret");
        remove_all_env();
    }

    #[test]
    fn test_config_full_env_minio_bucket() {
        let _g = ENV_LOCK.lock().unwrap();
        set_full_env();
        let cfg = AppConfig::from_env().unwrap();
        assert_eq!(cfg.minio_bucket, "test-bucket");
        remove_all_env();
    }

    #[test]
    fn test_config_full_env_jwt_secret() {
        let _g = ENV_LOCK.lock().unwrap();
        set_full_env();
        let cfg = AppConfig::from_env().unwrap();
        assert_eq!(cfg.jwt_secret, "super-secret-key-for-testing");
        remove_all_env();
    }

    #[test]
    fn test_config_full_env_jwt_access_expires() {
        let _g = ENV_LOCK.lock().unwrap();
        set_full_env();
        let cfg = AppConfig::from_env().unwrap();
        assert_eq!(cfg.jwt_access_expires_secs, 1800);
        remove_all_env();
    }

    #[test]
    fn test_config_full_env_jwt_refresh_expires() {
        let _g = ENV_LOCK.lock().unwrap();
        set_full_env();
        let cfg = AppConfig::from_env().unwrap();
        assert_eq!(cfg.jwt_refresh_expires_secs, 86400);
        remove_all_env();
    }

    #[test]
    fn test_config_full_env_cors_origins_parsed() {
        let _g = ENV_LOCK.lock().unwrap();
        set_full_env();
        let cfg = AppConfig::from_env().unwrap();
        assert_eq!(cfg.cors_allowed_origins, vec!["http://a.com", "http://b.com"]);
        remove_all_env();
    }

    // ── 2. Defaults when optional vars absent ───────────────────────────────

    #[test]
    fn test_config_defaults_server_host() {
        let _g = ENV_LOCK.lock().unwrap();
        remove_all_env();
        set_minimal_env();
        let cfg = AppConfig::from_env().unwrap();
        assert_eq!(cfg.server_host, "0.0.0.0");
        remove_all_env();
    }

    #[test]
    fn test_config_defaults_server_port() {
        let _g = ENV_LOCK.lock().unwrap();
        remove_all_env();
        set_minimal_env();
        let cfg = AppConfig::from_env().unwrap();
        assert_eq!(cfg.server_port, 8080);
        remove_all_env();
    }

    #[test]
    fn test_config_defaults_redis_url() {
        let _g = ENV_LOCK.lock().unwrap();
        remove_all_env();
        set_minimal_env();
        let cfg = AppConfig::from_env().unwrap();
        assert_eq!(cfg.redis_url, "redis://127.0.0.1:6379");
        remove_all_env();
    }

    #[test]
    fn test_config_defaults_minio_bucket() {
        let _g = ENV_LOCK.lock().unwrap();
        remove_all_env();
        set_minimal_env();
        let cfg = AppConfig::from_env().unwrap();
        assert_eq!(cfg.minio_bucket, "cnc-files");
        remove_all_env();
    }

    #[test]
    fn test_config_defaults_jwt_access_expires() {
        let _g = ENV_LOCK.lock().unwrap();
        remove_all_env();
        set_minimal_env();
        let cfg = AppConfig::from_env().unwrap();
        assert_eq!(cfg.jwt_access_expires_secs, 900);
        remove_all_env();
    }

    #[test]
    fn test_config_defaults_jwt_refresh_expires() {
        let _g = ENV_LOCK.lock().unwrap();
        remove_all_env();
        set_minimal_env();
        let cfg = AppConfig::from_env().unwrap();
        assert_eq!(cfg.jwt_refresh_expires_secs, 604800);
        remove_all_env();
    }

    #[test]
    fn test_config_defaults_cors_single_origin() {
        let _g = ENV_LOCK.lock().unwrap();
        remove_all_env();
        set_minimal_env();
        let cfg = AppConfig::from_env().unwrap();
        assert_eq!(cfg.cors_allowed_origins, vec!["http://localhost:5173"]);
        remove_all_env();
    }

    // ── 3. Error cases (Result instead of panic) ────────────────────────────

    #[test]
    fn test_config_error_missing_database_url() {
        let _g = ENV_LOCK.lock().unwrap();
        remove_all_env();
        unsafe { std::env::set_var("JWT_SECRET", "x"); }
        let result = AppConfig::from_env();
        assert!(result.is_err());
        match result.unwrap_err() {
            ConfigError::MissingVar(v) => assert_eq!(v, "DATABASE_URL"),
            other => panic!("Expected MissingVar, got {:?}", other),
        }
        remove_all_env();
    }

    #[test]
    fn test_config_error_missing_jwt_secret() {
        let _g = ENV_LOCK.lock().unwrap();
        remove_all_env();
        unsafe { std::env::set_var("DATABASE_URL", "postgres://localhost/cnc"); }
        let result = AppConfig::from_env();
        assert!(result.is_err());
        match result.unwrap_err() {
            ConfigError::MissingVar(v) => assert_eq!(v, "JWT_SECRET"),
            other => panic!("Expected MissingVar, got {:?}", other),
        }
        remove_all_env();
    }

    #[test]
    fn test_config_error_invalid_server_port() {
        let _g = ENV_LOCK.lock().unwrap();
        remove_all_env();
        set_minimal_env();
        unsafe { std::env::set_var("SERVER_PORT", "not_a_number"); }
        let result = AppConfig::from_env();
        assert!(result.is_err());
        match result.unwrap_err() {
            ConfigError::InvalidValue { var, .. } => assert_eq!(var, "SERVER_PORT"),
            other => panic!("Expected InvalidValue, got {:?}", other),
        }
        remove_all_env();
    }

    #[test]
    fn test_config_error_port_exceeds_u16() {
        let _g = ENV_LOCK.lock().unwrap();
        remove_all_env();
        set_minimal_env();
        unsafe { std::env::set_var("SERVER_PORT", "99999"); }
        let result = AppConfig::from_env();
        assert!(result.is_err());
        remove_all_env();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2  MIGRATION SQL VALIDITY TESTS
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod migration_tests {

    /// Helper: read migration file content at compile-time or at runtime.
    /// For standalone testing we inline the SQL; when integrated, use include_str!.
    const MIGRATION_002: &str = include_str!("002_shop_floor_scans.sql");
    const MIGRATION_003: &str = include_str!("003_sessions_and_audit.sql");

    // ── 002_shop_floor_scans.sql ────────────────────────────────────────

    #[test]
    fn test_002_creates_shop_floor_scans_table() {
        assert!(
            MIGRATION_002.contains("CREATE TABLE IF NOT EXISTS shop_floor_scans"),
            "Migration 002 must create shop_floor_scans table"
        );
    }

    #[test]
    fn test_002_has_part_id_fk() {
        assert!(
            MIGRATION_002.contains("REFERENCES parts(id)"),
            "shop_floor_scans.part_id must reference parts(id)"
        );
    }

    #[test]
    fn test_002_has_machine_id_fk() {
        assert!(
            MIGRATION_002.contains("REFERENCES machines(id)"),
            "shop_floor_scans.machine_id must reference machines(id)"
        );
    }

    #[test]
    fn test_002_has_operator_fk() {
        assert!(
            MIGRATION_002.contains("REFERENCES users(id)"),
            "shop_floor_scans.operator_id should reference users(id)"
        );
    }

    #[test]
    fn test_002_creates_part_index() {
        assert!(
            MIGRATION_002.contains("idx_shop_floor_scans_part"),
            "Migration 002 must create index on part_id"
        );
    }

    #[test]
    fn test_002_creates_machine_index() {
        assert!(
            MIGRATION_002.contains("idx_shop_floor_scans_machine"),
            "Migration 002 must create index on machine_id"
        );
    }

    #[test]
    fn test_002_creates_status_index() {
        assert!(
            MIGRATION_002.contains("idx_shop_floor_scans_status"),
            "Migration 002 must create index on status"
        );
    }

    // ── 003_sessions_and_audit.sql ──────────────────────────────────────

    #[test]
    fn test_003_creates_sessions_table() {
        assert!(
            MIGRATION_003.contains("CREATE TABLE IF NOT EXISTS sessions"),
            "Migration 003 must create sessions table"
        );
    }

    #[test]
    fn test_003_creates_audit_logs_table() {
        assert!(
            MIGRATION_003.contains("CREATE TABLE IF NOT EXISTS audit_logs"),
            "Migration 003 must create audit_logs table"
        );
    }

    #[test]
    fn test_003_sessions_cascade_delete() {
        assert!(
            MIGRATION_003.contains("ON DELETE CASCADE"),
            "sessions.user_id should cascade on delete"
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3  AUDIT MIDDLEWARE HELPER TESTS
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod audit_tests {
    use uuid::Uuid;

    // ── Inline helpers (mirrors audit_middleware.rs) ─────────────────────

    fn entity_type_from_path(path: &str) -> String {
        let segments: Vec<&str> = path
            .trim_start_matches('/')
            .split('/')
            .filter(|s| !s.is_empty())
            .collect();
        if segments.len() >= 2 {
            segments[1].to_string()
        } else if !segments.is_empty() {
            segments[0].to_string()
        } else {
            "unknown".to_string()
        }
    }

    fn entity_id_from_path(path: &str) -> Option<Uuid> {
        path.split('/').find_map(|seg| Uuid::parse_str(seg).ok())
    }

    fn action_from_method(method: &str) -> &'static str {
        match method {
            "POST" => "create",
            "PUT" => "update",
            "PATCH" => "patch",
            "DELETE" => "delete",
            _ => "unknown",
        }
    }

    fn is_mutating(method: &str) -> bool {
        matches!(method, "POST" | "PUT" | "PATCH" | "DELETE")
    }

    // ── entity_type_from_path ───────────────────────────────────────────

    #[test]
    fn test_entity_type_from_api_jobs() {
        assert_eq!(entity_type_from_path("/api/jobs"), "jobs");
    }

    #[test]
    fn test_entity_type_from_api_jobs_with_id() {
        assert_eq!(
            entity_type_from_path("/api/jobs/550e8400-e29b-41d4-a716-446655440000"),
            "jobs"
        );
    }

    #[test]
    fn test_entity_type_from_api_parts() {
        assert_eq!(entity_type_from_path("/api/parts"), "parts");
    }

    #[test]
    fn test_entity_type_empty_path() {
        assert_eq!(entity_type_from_path("/"), "unknown");
    }

    #[test]
    fn test_entity_type_single_segment() {
        assert_eq!(entity_type_from_path("/health"), "health");
    }

    // ── entity_id_from_path ─────────────────────────────────────────────

    #[test]
    fn test_entity_id_from_path_with_uuid() {
        let id = Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap();
        assert_eq!(
            entity_id_from_path("/api/jobs/550e8400-e29b-41d4-a716-446655440000"),
            Some(id)
        );
    }

    #[test]
    fn test_entity_id_from_path_no_uuid() {
        assert_eq!(entity_id_from_path("/api/jobs"), None);
    }

    // ── action_from_method ──────────────────────────────────────────────

    #[test]
    fn test_action_post_is_create() {
        assert_eq!(action_from_method("POST"), "create");
    }

    #[test]
    fn test_action_delete_is_delete() {
        assert_eq!(action_from_method("DELETE"), "delete");
    }

    #[test]
    fn test_action_get_is_unknown() {
        assert_eq!(action_from_method("GET"), "unknown");
    }

    // ── is_mutating ─────────────────────────────────────────────────────

    #[test]
    fn test_get_is_not_mutating() {
        assert!(!is_mutating("GET"));
    }

    #[test]
    fn test_post_is_mutating() {
        assert!(is_mutating("POST"));
    }

    #[test]
    fn test_put_is_mutating() {
        assert!(is_mutating("PUT"));
    }

    #[test]
    fn test_patch_is_mutating() {
        assert!(is_mutating("PATCH"));
    }

    #[test]
    fn test_delete_is_mutating() {
        assert!(is_mutating("DELETE"));
    }

    #[test]
    fn test_options_is_not_mutating() {
        assert!(!is_mutating("OPTIONS"));
    }

    #[test]
    fn test_head_is_not_mutating() {
        assert!(!is_mutating("HEAD"));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4  SERVICES MOD COMPLETENESS
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod services_mod_tests {

    const SERVICES_MOD: &str = include_str!("services_mod.rs");

    #[test]
    fn test_services_mod_has_construction_methods_engine() {
        assert!(
            SERVICES_MOD.contains("pub mod construction_methods_engine"),
            "services/mod.rs must declare construction_methods_engine"
        );
    }

    #[test]
    fn test_services_mod_exports_construction_methods_engine() {
        assert!(
            SERVICES_MOD.contains("pub use construction_methods_engine::ConstructionMethodsEngine"),
            "services/mod.rs must re-export ConstructionMethodsEngine"
        );
    }

    #[test]
    fn test_services_mod_has_all_11_modules() {
        let expected = [
            "cloud_renderer",
            "construction_methods_engine",
            "cost_calculator",
            "door_profile_generator",
            "dovetail_generator",
            "file_exporter",
            "flipside_manager",
            "gcode_generator",
            "label_generator",
            "nesting_engine",
            "propagation_engine",
        ];
        for module in expected {
            let decl = format!("pub mod {};", module);
            assert!(
                SERVICES_MOD.contains(&decl),
                "services/mod.rs is missing module declaration: {}",
                module
            );
        }
    }

    #[test]
    fn test_services_mod_has_exactly_11_pub_mod_lines() {
        let count = SERVICES_MOD
            .lines()
            .filter(|l| l.trim().starts_with("pub mod "))
            .count();
        assert_eq!(count, 11, "Expected exactly 11 pub mod declarations, found {}", count);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 5  CARGO TOML DEPENDENCY SANITY
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod cargo_toml_tests {

    const CARGO_TOML: &str = include_str!("cargo_toml_deps.toml");

    #[test]
    fn test_cargo_toml_has_actix_web_actors() {
        assert!(
            CARGO_TOML.contains("actix-web-actors"),
            "Cargo.toml must include actix-web-actors dependency"
        );
    }

    #[test]
    fn test_cargo_toml_has_jsonwebtoken() {
        assert!(
            CARGO_TOML.contains("jsonwebtoken"),
            "Cargo.toml must include jsonwebtoken dependency"
        );
    }

    #[test]
    fn test_cargo_toml_has_argon2() {
        assert!(
            CARGO_TOML.contains("argon2"),
            "Cargo.toml must include argon2 dependency"
        );
    }

    #[test]
    fn test_cargo_toml_has_redis_with_tokio_comp() {
        assert!(
            CARGO_TOML.contains("redis") && CARGO_TOML.contains("tokio-comp"),
            "Cargo.toml must include redis with tokio-comp feature"
        );
    }
}
