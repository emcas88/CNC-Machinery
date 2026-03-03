#[cfg(test)]
mod tests {
    use crate::auth::{AuthConfig, AuthenticatedUser, AuthError, Claims, generate_token_pair, validate_token};
    use crate::auth::password;
    use uuid::Uuid;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_config() -> AuthConfig {
        AuthConfig {
            secret: "test_secret_key_for_unit_tests_only_32ch".to_string(),
            access_token_expiry_secs: 900,
            refresh_token_expiry_secs: 604800,
        }
    }

    // ---- AuthConfig tests ----

    #[test]
    fn test_auth_config_default_expiry() {
        let config = test_config();
        assert_eq!(config.access_token_expiry_secs, 900);
        assert_eq!(config.refresh_token_expiry_secs, 604800);
    }

    #[test]
    fn test_auth_config_secret() {
        let config = test_config();
        assert!(!config.secret.is_empty());
    }

    // ---- Token generation tests ----

    #[test]
    fn test_generate_token_pair_returns_two_tokens() {
        let config = test_config();
        let user_id = Uuid::new_v4();
        let result = generate_token_pair(user_id, &config);
        assert!(result.is_ok());
        let (access, refresh) = result.unwrap();
        assert!(!access.is_empty());
        assert!(!refresh.is_empty());
        assert_ne!(access, refresh);
    }

    #[test]
    fn test_generate_token_pair_tokens_are_different() {
        let config = test_config();
        let id = Uuid::new_v4();
        let (t1, t2) = generate_token_pair(id, &config).unwrap();
        assert_ne!(t1, t2);
    }

    #[test]
    fn test_tokens_contain_three_jwt_parts() {
        let config = test_config();
        let id = Uuid::new_v4();
        let (access, _) = generate_token_pair(id, &config).unwrap();
        assert_eq!(access.split('.').count(), 3);
    }

    // ---- Token validation tests ----

    #[test]
    fn test_validate_token_valid() {
        let config = test_config();
        let user_id = Uuid::new_v4();
        let (access, _) = generate_token_pair(user_id, &config).unwrap();
        let result = validate_token(&access, &config);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), user_id);
    }

    #[test]
    fn test_validate_token_invalid() {
        let config = test_config();
        let result = validate_token("not.a.token", &config);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_token_wrong_secret() {
        let config = test_config();
        let user_id = Uuid::new_v4();
        let (access, _) = generate_token_pair(user_id, &config).unwrap();
        let bad_config = AuthConfig {
            secret: "wrong_secret_key_completely_different".to_string(),
            ..config
        };
        let result = validate_token(&access, &bad_config);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_token_empty() {
        let config = test_config();
        assert!(validate_token("", &config).is_err());
    }

    #[test]
    fn test_validate_token_malformed() {
        let config = test_config();
        assert!(validate_token("abc.def", &config).is_err());
    }

    #[test]
    fn test_validate_refresh_token() {
        let config = test_config();
        let user_id = Uuid::new_v4();
        let (_, refresh) = generate_token_pair(user_id, &config).unwrap();
        let result = validate_token(&refresh, &config);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), user_id);
    }

    // ---- AuthenticatedUser tests ----

    #[test]
    fn test_authenticated_user_clone() {
        let user = AuthenticatedUser { user_id: Uuid::new_v4() };
        let cloned = user.clone();
        assert_eq!(user.user_id, cloned.user_id);
    }

    #[test]
    fn test_authenticated_user_debug() {
        let user = AuthenticatedUser { user_id: Uuid::new_v4() };
        let debug = format!("{:?}", user);
        assert!(debug.contains("AuthenticatedUser"));
    }

    // ---- AuthError tests ----

    #[test]
    fn test_auth_error_variants_exist() {
        let _e1 = AuthError::MissingToken;
        let _e2 = AuthError::InvalidToken;
        let _e3 = AuthError::ExpiredToken;
        let _e4 = AuthError::InternalError("test".to_string());
    }

    // ---- Password hashing tests ----

    #[test]
    fn test_password_hash_produces_output() {
        let result = password::hash("TestPass1!");
        assert!(result.is_ok());
        let hashed = result.unwrap();
        assert!(!hashed.is_empty());
        assert!(hashed.starts_with("$argon2"));
    }

    #[test]
    fn test_password_hash_is_unique_per_call() {
        let h1 = password::hash("TestPass1!").unwrap();
        let h2 = password::hash("TestPass1!").unwrap();
        assert_ne!(h1, h2); // Different salts
    }

    #[test]
    fn test_password_verify_correct() {
        let plain = "TestPass1!";
        let hashed = password::hash(plain).unwrap();
        let result = password::verify(plain, &hashed);
        assert!(result.is_ok());
        assert!(result.unwrap());
    }

    #[test]
    fn test_password_verify_incorrect() {
        let hashed = password::hash("TestPass1!").unwrap();
        let result = password::verify("WrongPass1!", &hashed);
        assert!(result.is_ok());
        assert!(!result.unwrap());
    }

    #[test]
    fn test_password_verify_invalid_hash() {
        let result = password::verify("password", "not-a-valid-hash");
        assert!(result.is_err());
    }

    #[test]
    fn test_password_strength_valid() {
        assert!(password::validate_strength("SecurePass1!").is_ok());
    }

    #[test]
    fn test_password_strength_too_short() {
        assert!(password::validate_strength("Sh0rt!").is_err());
    }

    #[test]
    fn test_password_strength_no_uppercase() {
        assert!(password::validate_strength("lowercase1!").is_err());
    }

    #[test]
    fn test_password_strength_no_lowercase() {
        assert!(password::validate_strength("UPPERCASE1!").is_err());
    }

    #[test]
    fn test_password_strength_no_digit() {
        assert!(password::validate_strength("NoDigitPass!").is_err());
    }

    #[test]
    fn test_password_strength_exactly_8_chars() {
        assert!(password::validate_strength("Abcdef1!").is_ok());
    }

    #[test]
    fn test_password_strength_empty() {
        assert!(password::validate_strength("").is_err());
    }

    // ---- Token claims tests ----

    #[test]
    fn test_claims_serialization() {
        let claims = Claims {
            sub: Uuid::new_v4().to_string(),
            exp: 9999999999,
            iat: 1000000000,
            token_type: "access".to_string(),
        };
        let json = serde_json::to_string(&claims).unwrap();
        assert!(json.contains("access"));
    }

    #[test]
    fn test_token_expiry_is_in_future() {
        let config = test_config();
        let id = Uuid::new_v4();
        let (access, _) = generate_token_pair(id, &config).unwrap();

        // Decode without validation to check expiry
        use jsonwebtoken::{decode, DecodingKey, Validation};
        let mut val = Validation::default();
        val.insecure_disable_signature_validation();
        val.validate_exp = false;
        let data = decode::<Claims>(
            &access,
            &DecodingKey::from_secret(b"any"),
            &val,
        ).unwrap();

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        assert!(data.claims.exp > now);
    }

    #[test]
    fn test_access_token_type_claim() {
        let config = test_config();
        let id = Uuid::new_v4();
        let (access, _) = generate_token_pair(id, &config).unwrap();

        use jsonwebtoken::{decode, DecodingKey, Validation};
        let mut val = Validation::default();
        val.insecure_disable_signature_validation();
        val.validate_exp = false;
        let data = decode::<Claims>(
            &access,
            &DecodingKey::from_secret(b"any"),
            &val,
        ).unwrap();

        assert_eq!(data.claims.token_type, "access");
    }

    #[test]
    fn test_refresh_token_type_claim() {
        let config = test_config();
        let id = Uuid::new_v4();
        let (_, refresh) = generate_token_pair(id, &config).unwrap();

        use jsonwebtoken::{decode, DecodingKey, Validation};
        let mut val = Validation::default();
        val.insecure_disable_signature_validation();
        val.validate_exp = false;
        let data = decode::<Claims>(
            &refresh,
            &DecodingKey::from_secret(b"any"),
            &val,
        ).unwrap();

        assert_eq!(data.claims.token_type, "refresh");
    }
}
