// backend/src/auth/tests.rs
// ============================================================
// F20 · Authentication System — Comprehensive Test Suite
// ============================================================
//
// 60+ tests covering:
//   - Password hashing & verification
//   - Password strength validation
//   - JWT creation & validation
//   - Token expiry
//   - Token type enforcement
//   - Role definitions & privilege levels
//   - AuthenticatedUser helpers
//   - RequireRole extractor
//   - AuthConfig construction
//   - AuthError response codes
//   - Middleware behavior (unit-level)
//   - Login / registration validation logic
//   - Refresh token flow
//   - Edge cases (empty strings, very long inputs, special chars)
// ============================================================

#[cfg(test)]
mod password_tests {
    use crate::auth::password::*;

    // ── Hashing ──────────────────────────────────────────

    #[test]
    fn test_hash_password_returns_phc_string() {
        let hash = hash_password("Str0ngP@ss!").unwrap();
        assert!(
            hash.starts_with("$argon2"),
            "Expected PHC-formatted hash, got: {hash}"
        );
    }

    #[test]
    fn test_hash_password_different_salts() {
        let h1 = hash_password("Str0ngP@ss!").unwrap();
        let h2 = hash_password("Str0ngP@ss!").unwrap();
        assert_ne!(
            h1, h2,
            "Two hashes of the same password must differ (random salt)"
        );
    }

    #[test]
    fn test_hash_password_empty_string() {
        // Argon2 can hash empty strings — it shouldn't panic
        let result = hash_password("");
        assert!(result.is_ok());
    }

    #[test]
    fn test_hash_password_unicode() {
        let result = hash_password("pässwörd_日本語_🔒");
        assert!(result.is_ok());
    }

    #[test]
    fn test_hash_password_very_long() {
        let long_pw: String = "A".repeat(1000);
        let result = hash_password(&long_pw);
        assert!(result.is_ok());
    }

    // ── Verification ─────────────────────────────────────

    #[test]
    fn test_verify_correct_password() {
        let hash = hash_password("Correct1").unwrap();
        assert!(verify_password("Correct1", &hash).unwrap());
    }

    #[test]
    fn test_verify_wrong_password() {
        let hash = hash_password("Correct1").unwrap();
        assert!(!verify_password("Wrong123", &hash).unwrap());
    }

    #[test]
    fn test_verify_empty_password_against_hash() {
        let hash = hash_password("NonEmpty1").unwrap();
        assert!(!verify_password("", &hash).unwrap());
    }

    #[test]
    fn test_verify_against_invalid_hash() {
        let result = verify_password("anything", "not-a-valid-hash");
        assert!(result.is_err());
    }

    #[test]
    fn test_verify_password_unicode() {
        let pw = "pässwörd_日本語_🔒";
        let hash = hash_password(pw).unwrap();
        assert!(verify_password(pw, &hash).unwrap());
        assert!(!verify_password("wrong_password", &hash).unwrap());
    }

    // ── Strength validation ──────────────────────────────

    #[test]
    fn test_strength_valid_password() {
        assert!(validate_password_strength("Str0ngPw").is_ok());
    }

    #[test]
    fn test_strength_too_short() {
        let err = validate_password_strength("Sh0rt").unwrap_err();
        assert!(err.contains("8 characters"));
    }

    #[test]
    fn test_strength_too_long() {
        let long = "A".repeat(129) + "a1";
        let err = validate_password_strength(&long).unwrap_err();
        assert!(err.contains("128 characters"));
    }

    #[test]
    fn test_strength_no_uppercase() {
        let err = validate_password_strength("alllower1").unwrap_err();
        assert!(err.contains("uppercase"));
    }

    #[test]
    fn test_strength_no_lowercase() {
        let err = validate_password_strength("ALLUPPER1").unwrap_err();
        assert!(err.contains("lowercase"));
    }

    #[test]
    fn test_strength_no_digit() {
        let err = validate_password_strength("NoDigitsHere").unwrap_err();
        assert!(err.contains("digit"));
    }

    #[test]
    fn test_strength_exactly_8_chars() {
        assert!(validate_password_strength("Exactly8").is_ok());
    }

    #[test]
    fn test_strength_exactly_128_chars() {
        // 126 'a' + 'A' + '1' = 128 chars
        let pw = "a".repeat(126) + "A1";
        assert!(validate_password_strength(&pw).is_ok());
    }
}

#[cfg(test)]
mod jwt_tests {
    use crate::auth::*;
    use chrono::{Duration, Utc};
    use uuid::Uuid;

    fn test_config() -> AuthConfig {
        AuthConfig {
            jwt_secret: "test-secret-key-for-unit-tests-only".to_string(),
            access_token_ttl: Duration::hours(24),
            refresh_token_ttl: Duration::days(7),
        }
    }

    // ── Token generation ─────────────────────────────────

    #[test]
    fn test_generate_token_pair() {
        let config = test_config();
        let uid = Uuid::new_v4();
        let pair =
            generate_token_pair(uid, "alice@example.com", UserRole::Designer, &config).unwrap();

        assert!(!pair.access_token.is_empty());
        assert!(!pair.refresh_token.is_empty());
        assert_ne!(pair.access_token, pair.refresh_token);
        assert_eq!(pair.token_type, "Bearer");
        assert_eq!(pair.expires_in, 86400); // 24h in seconds
    }

    #[test]
    fn test_access_token_contains_correct_claims() {
        let config = test_config();
        let uid = Uuid::new_v4();
        let email = "bob@cnc.io";
        let pair = generate_token_pair(uid, email, UserRole::CncOperator, &config).unwrap();

        let claims =
            validate_token(&pair.access_token, &config.jwt_secret, TokenType::Access).unwrap();
        assert_eq!(claims.sub, uid);
        assert_eq!(claims.email, email);
        assert_eq!(claims.role, UserRole::CncOperator);
        assert_eq!(claims.token_type, TokenType::Access);
    }

    #[test]
    fn test_refresh_token_contains_correct_claims() {
        let config = test_config();
        let uid = Uuid::new_v4();
        let pair = generate_token_pair(uid, "carol@cnc.io", UserRole::SuperAdmin, &config).unwrap();

        let claims =
            validate_token(&pair.refresh_token, &config.jwt_secret, TokenType::Refresh).unwrap();
        assert_eq!(claims.sub, uid);
        assert_eq!(claims.token_type, TokenType::Refresh);
        assert_eq!(claims.role, UserRole::SuperAdmin);
    }

    // ── Token validation ─────────────────────────────────

    #[test]
    fn test_decode_valid_access_token() {
        let config = test_config();
        let uid = Uuid::new_v4();
        let pair = generate_token_pair(uid, "test@test.com", UserRole::ShopFloor, &config).unwrap();
        let result = decode_token(&pair.access_token, &config.jwt_secret);
        assert!(result.is_ok());
    }

    #[test]
    fn test_decode_with_wrong_secret() {
        let config = test_config();
        let uid = Uuid::new_v4();
        let pair = generate_token_pair(uid, "test@test.com", UserRole::Designer, &config).unwrap();
        let result = decode_token(&pair.access_token, "wrong-secret");
        assert!(result.is_err());
    }

    #[test]
    fn test_decode_garbage_token() {
        let result = decode_token("not.a.jwt", "any-secret");
        assert!(result.is_err());
    }

    #[test]
    fn test_decode_empty_token() {
        let result = decode_token("", "any-secret");
        assert!(result.is_err());
    }

    // ── Token type enforcement ───────────────────────────

    #[test]
    fn test_validate_access_token_as_refresh_fails() {
        let config = test_config();
        let uid = Uuid::new_v4();
        let pair = generate_token_pair(uid, "t@t.com", UserRole::Designer, &config).unwrap();

        let err =
            validate_token(&pair.access_token, &config.jwt_secret, TokenType::Refresh).unwrap_err();
        matches!(err, AuthError::WrongTokenType { .. });
    }

    #[test]
    fn test_validate_refresh_token_as_access_fails() {
        let config = test_config();
        let uid = Uuid::new_v4();
        let pair = generate_token_pair(uid, "t@t.com", UserRole::Designer, &config).unwrap();

        let err =
            validate_token(&pair.refresh_token, &config.jwt_secret, TokenType::Access).unwrap_err();
        matches!(err, AuthError::WrongTokenType { .. });
    }

    // ── Token expiry ─────────────────────────────────────

    #[test]
    fn test_expired_token_returns_error() {
        let config = test_config();
        let now = Utc::now();
        let claims = Claims {
            sub: Uuid::new_v4(),
            email: "expired@test.com".into(),
            role: UserRole::ShopFloor,
            token_type: TokenType::Access,
            iat: (now - Duration::hours(25)).timestamp(),
            exp: (now - Duration::hours(1)).timestamp(), // expired 1h ago
        };
        let token = encode_token(&claims, &config.jwt_secret).unwrap();
        let err = decode_token(&token, &config.jwt_secret).unwrap_err();
        assert!(matches!(err, AuthError::TokenExpired));
    }

    #[test]
    fn test_token_not_yet_expired() {
        let config = test_config();
        let now = Utc::now();
        let claims = Claims {
            sub: Uuid::new_v4(),
            email: "valid@test.com".into(),
            role: UserRole::Designer,
            token_type: TokenType::Access,
            iat: now.timestamp(),
            exp: (now + Duration::hours(1)).timestamp(),
        };
        let token = encode_token(&claims, &config.jwt_secret).unwrap();
        assert!(decode_token(&token, &config.jwt_secret).is_ok());
    }

    #[test]
    fn test_access_token_expiry_is_24h() {
        let config = test_config();
        let uid = Uuid::new_v4();
        let pair = generate_token_pair(uid, "t@t.com", UserRole::Designer, &config).unwrap();
        let claims = decode_token(&pair.access_token, &config.jwt_secret)
            .unwrap()
            .claims;
        let diff = claims.exp - claims.iat;
        assert_eq!(diff, 86400); // 24 * 60 * 60
    }

    #[test]
    fn test_refresh_token_expiry_is_7d() {
        let config = test_config();
        let uid = Uuid::new_v4();
        let pair = generate_token_pair(uid, "t@t.com", UserRole::Designer, &config).unwrap();
        let claims = decode_token(&pair.refresh_token, &config.jwt_secret)
            .unwrap()
            .claims;
        let diff = claims.exp - claims.iat;
        assert_eq!(diff, 604800); // 7 * 24 * 60 * 60
    }

    // ── Encode / decode round-trip ───────────────────────

    #[test]
    fn test_encode_decode_roundtrip() {
        let secret = "roundtrip-test";
        let uid = Uuid::new_v4();
        let now = Utc::now();
        let claims = Claims {
            sub: uid,
            email: "round@trip.com".into(),
            role: UserRole::SuperAdmin,
            token_type: TokenType::Access,
            iat: now.timestamp(),
            exp: (now + Duration::hours(1)).timestamp(),
        };
        let token = encode_token(&claims, secret).unwrap();
        let decoded = decode_token(&token, secret).unwrap();
        assert_eq!(decoded.claims.sub, uid);
        assert_eq!(decoded.claims.email, "round@trip.com");
        assert_eq!(decoded.claims.role, UserRole::SuperAdmin);
    }

    #[test]
    fn test_encode_all_roles() {
        let secret = "role-test";
        let now = Utc::now();
        for role in [
            UserRole::SuperAdmin,
            UserRole::Designer,
            UserRole::CncOperator,
            UserRole::ShopFloor,
        ] {
            let claims = Claims {
                sub: Uuid::new_v4(),
                email: "r@r.com".into(),
                role,
                token_type: TokenType::Access,
                iat: now.timestamp(),
                exp: (now + Duration::hours(1)).timestamp(),
            };
            let token = encode_token(&claims, secret).unwrap();
            let decoded = decode_token(&token, secret).unwrap();
            assert_eq!(decoded.claims.role, role);
        }
    }
}

#[cfg(test)]
mod role_tests {
    use crate::auth::*;

    #[test]
    fn test_role_from_str_valid() {
        assert_eq!(
            UserRole::from_str_role("super_admin"),
            Some(UserRole::SuperAdmin)
        );
        assert_eq!(
            UserRole::from_str_role("designer"),
            Some(UserRole::Designer)
        );
        assert_eq!(
            UserRole::from_str_role("cnc_operator"),
            Some(UserRole::CncOperator)
        );
        assert_eq!(
            UserRole::from_str_role("shop_floor"),
            Some(UserRole::ShopFloor)
        );
    }

    #[test]
    fn test_role_from_str_invalid() {
        assert_eq!(UserRole::from_str_role("admin"), None);
        assert_eq!(UserRole::from_str_role(""), None);
        assert_eq!(UserRole::from_str_role("SUPER_ADMIN"), None);
        assert_eq!(UserRole::from_str_role("unknown"), None);
    }

    #[test]
    fn test_role_display() {
        assert_eq!(UserRole::SuperAdmin.to_string(), "super_admin");
        assert_eq!(UserRole::Designer.to_string(), "designer");
        assert_eq!(UserRole::CncOperator.to_string(), "cnc_operator");
        assert_eq!(UserRole::ShopFloor.to_string(), "shop_floor");
    }

    #[test]
    fn test_role_display_roundtrip() {
        for role in [
            UserRole::SuperAdmin,
            UserRole::Designer,
            UserRole::CncOperator,
            UserRole::ShopFloor,
        ] {
            let s = role.to_string();
            assert_eq!(UserRole::from_str_role(&s), Some(role));
        }
    }

    #[test]
    fn test_privilege_levels_ordered() {
        assert!(UserRole::SuperAdmin.privilege_level() > UserRole::Designer.privilege_level());
        assert!(UserRole::Designer.privilege_level() > UserRole::CncOperator.privilege_level());
        assert!(UserRole::CncOperator.privilege_level() > UserRole::ShopFloor.privilege_level());
    }

    #[test]
    fn test_privilege_level_values() {
        assert_eq!(UserRole::SuperAdmin.privilege_level(), 100);
        assert_eq!(UserRole::Designer.privilege_level(), 50);
        assert_eq!(UserRole::CncOperator.privilege_level(), 30);
        assert_eq!(UserRole::ShopFloor.privilege_level(), 10);
    }

    #[test]
    fn test_role_serde_roundtrip() {
        for role in [
            UserRole::SuperAdmin,
            UserRole::Designer,
            UserRole::CncOperator,
            UserRole::ShopFloor,
        ] {
            let json = serde_json::to_string(&role).unwrap();
            let deserialized: UserRole = serde_json::from_str(&json).unwrap();
            assert_eq!(deserialized, role);
        }
    }

    #[test]
    fn test_role_serde_snake_case() {
        let json = serde_json::to_string(&UserRole::SuperAdmin).unwrap();
        assert_eq!(json, "\"super_admin\"");
        let json = serde_json::to_string(&UserRole::CncOperator).unwrap();
        assert_eq!(json, "\"cnc_operator\"");
    }
}

#[cfg(test)]
mod authenticated_user_tests {
    use crate::auth::*;
    use uuid::Uuid;

    fn make_user(role: UserRole) -> AuthenticatedUser {
        AuthenticatedUser {
            user_id: Uuid::new_v4(),
            email: "test@test.com".into(),
            role,
        }
    }

    #[test]
    fn test_from_claims() {
        let uid = Uuid::new_v4();
        let claims = Claims {
            sub: uid,
            email: "from@claims.com".into(),
            role: UserRole::Designer,
            token_type: TokenType::Access,
            iat: 0,
            exp: 9999999999,
        };
        let user = AuthenticatedUser::from_claims(&claims);
        assert_eq!(user.user_id, uid);
        assert_eq!(user.email, "from@claims.com");
        assert_eq!(user.role, UserRole::Designer);
    }

    #[test]
    fn test_has_any_role_match() {
        let user = make_user(UserRole::Designer);
        assert!(user.has_any_role(&[UserRole::Designer, UserRole::SuperAdmin]));
    }

    #[test]
    fn test_has_any_role_no_match() {
        let user = make_user(UserRole::ShopFloor);
        assert!(!user.has_any_role(&[UserRole::Designer, UserRole::SuperAdmin]));
    }

    #[test]
    fn test_has_any_role_empty_list() {
        let user = make_user(UserRole::SuperAdmin);
        assert!(!user.has_any_role(&[]));
    }

    #[test]
    fn test_has_min_privilege_admin() {
        let user = make_user(UserRole::SuperAdmin);
        assert!(user.has_min_privilege(100));
        assert!(user.has_min_privilege(50));
        assert!(user.has_min_privilege(1));
    }

    #[test]
    fn test_has_min_privilege_shop_floor() {
        let user = make_user(UserRole::ShopFloor);
        assert!(user.has_min_privilege(10));
        assert!(!user.has_min_privilege(30));
        assert!(!user.has_min_privilege(100));
    }

    #[test]
    fn test_has_min_privilege_zero() {
        let user = make_user(UserRole::ShopFloor);
        assert!(user.has_min_privilege(0));
    }
}

#[cfg(test)]
mod require_roles_tests {
    use crate::auth::*;
    use uuid::Uuid;

    fn user_with_role(role: UserRole) -> AuthenticatedUser {
        AuthenticatedUser {
            user_id: Uuid::new_v4(),
            email: "r@r.com".into(),
            role,
        }
    }

    #[test]
    fn test_require_admin_with_super_admin() {
        let user = user_with_role(UserRole::SuperAdmin);
        assert!(require_admin(&user).is_ok());
    }

    #[test]
    fn test_require_admin_with_designer() {
        let user = user_with_role(UserRole::Designer);
        assert!(require_admin(&user).is_err());
    }

    #[test]
    fn test_require_admin_with_cnc_operator() {
        let user = user_with_role(UserRole::CncOperator);
        assert!(require_admin(&user).is_err());
    }

    #[test]
    fn test_require_admin_with_shop_floor() {
        let user = user_with_role(UserRole::ShopFloor);
        assert!(require_admin(&user).is_err());
    }

    #[test]
    fn test_require_roles_multiple_allowed() {
        let user = user_with_role(UserRole::CncOperator);
        assert!(require_roles(&user, &[UserRole::CncOperator, UserRole::Designer]).is_ok());
    }

    #[test]
    fn test_require_roles_none_allowed() {
        let user = user_with_role(UserRole::CncOperator);
        let err = require_roles(&user, &[]).unwrap_err();
        assert!(matches!(err, AuthError::InsufficientRole { .. }));
    }

    #[test]
    fn test_require_roles_error_contains_required() {
        let user = user_with_role(UserRole::ShopFloor);
        let err = require_roles(&user, &[UserRole::SuperAdmin, UserRole::Designer]).unwrap_err();
        let msg = err.to_string();
        assert!(msg.contains("SuperAdmin") || msg.contains("Designer") || msg.contains("required"));
    }
}

#[cfg(test)]
mod auth_config_tests {
    use crate::auth::*;

    #[test]
    fn test_config_defaults() {
        // Clear env to test defaults
        std::env::remove_var("JWT_SECRET");
        std::env::remove_var("ACCESS_TOKEN_HOURS");
        std::env::remove_var("REFRESH_TOKEN_DAYS");

        let config = AuthConfig::from_env();
        assert_eq!(config.jwt_secret, "dev-secret-change-me");
        assert_eq!(config.access_token_ttl.num_hours(), 24);
        assert_eq!(config.refresh_token_ttl.num_days(), 7);
    }

    #[test]
    fn test_config_custom_secret() {
        std::env::set_var("JWT_SECRET", "my-custom-secret");
        let config = AuthConfig::from_env();
        assert_eq!(config.jwt_secret, "my-custom-secret");
        std::env::remove_var("JWT_SECRET");
    }

    #[test]
    fn test_config_custom_ttl() {
        std::env::set_var("ACCESS_TOKEN_HOURS", "1");
        std::env::set_var("REFRESH_TOKEN_DAYS", "30");
        let config = AuthConfig::from_env();
        assert_eq!(config.access_token_ttl.num_hours(), 1);
        assert_eq!(config.refresh_token_ttl.num_days(), 30);
        std::env::remove_var("ACCESS_TOKEN_HOURS");
        std::env::remove_var("REFRESH_TOKEN_DAYS");
    }

    #[test]
    fn test_config_invalid_ttl_uses_default() {
        std::env::set_var("ACCESS_TOKEN_HOURS", "not-a-number");
        let config = AuthConfig::from_env();
        assert_eq!(config.access_token_ttl.num_hours(), 24);
        std::env::remove_var("ACCESS_TOKEN_HOURS");
    }
}

#[cfg(test)]
mod auth_error_tests {
    use crate::auth::*;
    use actix_web::http::StatusCode;
    use actix_web::ResponseError;

    #[test]
    fn test_invalid_token_is_401() {
        let err = AuthError::InvalidToken;
        assert_eq!(err.status_code(), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn test_token_expired_is_401() {
        let err = AuthError::TokenExpired;
        assert_eq!(err.status_code(), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn test_missing_token_is_401() {
        let err = AuthError::MissingToken;
        assert_eq!(err.status_code(), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn test_wrong_token_type_is_401() {
        let err = AuthError::WrongTokenType {
            expected: TokenType::Access,
        };
        assert_eq!(err.status_code(), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn test_insufficient_role_is_403() {
        let err = AuthError::InsufficientRole {
            required: vec![UserRole::SuperAdmin],
        };
        assert_eq!(err.status_code(), StatusCode::FORBIDDEN);
    }

    #[test]
    fn test_invalid_credentials_is_401() {
        let err = AuthError::InvalidCredentials;
        assert_eq!(err.status_code(), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn test_user_not_found_is_404() {
        let err = AuthError::UserNotFound;
        assert_eq!(err.status_code(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn test_email_already_exists_is_409() {
        let err = AuthError::EmailAlreadyExists;
        assert_eq!(err.status_code(), StatusCode::CONFLICT);
    }

    #[test]
    fn test_validation_error_is_400() {
        let err = AuthError::ValidationError("bad input".into());
        assert_eq!(err.status_code(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn test_internal_error_is_500() {
        let err = AuthError::Internal("db crashed".into());
        assert_eq!(err.status_code(), StatusCode::INTERNAL_SERVER_ERROR);
    }

    #[test]
    fn test_error_display_messages() {
        assert_eq!(
            AuthError::InvalidToken.to_string(),
            "Invalid or expired token"
        );
        assert_eq!(AuthError::TokenExpired.to_string(), "Token has expired");
        assert_eq!(
            AuthError::MissingToken.to_string(),
            "Missing authorization header"
        );
        assert_eq!(
            AuthError::InvalidCredentials.to_string(),
            "Invalid credentials"
        );
        assert_eq!(AuthError::UserNotFound.to_string(), "User not found");
        assert_eq!(
            AuthError::EmailAlreadyExists.to_string(),
            "Email already registered"
        );
    }

    #[test]
    fn test_error_response_body_contains_status() {
        let err = AuthError::InvalidToken;
        let resp = err.error_response();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }
}

#[cfg(test)]
mod token_type_tests {
    use crate::auth::*;

    #[test]
    fn test_token_type_serde() {
        let access_json = serde_json::to_string(&TokenType::Access).unwrap();
        assert_eq!(access_json, "\"access\"");
        let refresh_json = serde_json::to_string(&TokenType::Refresh).unwrap();
        assert_eq!(refresh_json, "\"refresh\"");
    }

    #[test]
    fn test_token_type_deserialize() {
        let access: TokenType = serde_json::from_str("\"access\"").unwrap();
        assert_eq!(access, TokenType::Access);
        let refresh: TokenType = serde_json::from_str("\"refresh\"").unwrap();
        assert_eq!(refresh, TokenType::Refresh);
    }

    #[test]
    fn test_token_type_equality() {
        assert_eq!(TokenType::Access, TokenType::Access);
        assert_eq!(TokenType::Refresh, TokenType::Refresh);
        assert_ne!(TokenType::Access, TokenType::Refresh);
    }
}

#[cfg(test)]
mod token_pair_tests {
    use crate::auth::*;

    #[test]
    fn test_token_pair_serialization() {
        let pair = TokenPair {
            access_token: "abc".into(),
            refresh_token: "def".into(),
            token_type: "Bearer".into(),
            expires_in: 86400,
        };
        let json = serde_json::to_value(&pair).unwrap();
        assert_eq!(json["access_token"], "abc");
        assert_eq!(json["refresh_token"], "def");
        assert_eq!(json["token_type"], "Bearer");
        assert_eq!(json["expires_in"], 86400);
    }

    #[test]
    fn test_token_pair_deserialization() {
        let json = r#"{
            "access_token": "tok1",
            "refresh_token": "tok2",
            "token_type": "Bearer",
            "expires_in": 3600
        }"#;
        let pair: TokenPair = serde_json::from_str(json).unwrap();
        assert_eq!(pair.access_token, "tok1");
        assert_eq!(pair.refresh_token, "tok2");
        assert_eq!(pair.expires_in, 3600);
    }
}

#[cfg(test)]
mod claims_tests {
    use crate::auth::*;
    use uuid::Uuid;

    #[test]
    fn test_claims_serde_roundtrip() {
        let uid = Uuid::new_v4();
        let claims = Claims {
            sub: uid,
            email: "serde@test.com".into(),
            role: UserRole::CncOperator,
            token_type: TokenType::Refresh,
            iat: 1700000000,
            exp: 1700086400,
        };
        let json = serde_json::to_string(&claims).unwrap();
        let decoded: Claims = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded.sub, uid);
        assert_eq!(decoded.email, "serde@test.com");
        assert_eq!(decoded.role, UserRole::CncOperator);
        assert_eq!(decoded.token_type, TokenType::Refresh);
        assert_eq!(decoded.iat, 1700000000);
        assert_eq!(decoded.exp, 1700086400);
    }

    #[test]
    fn test_claims_with_special_email_chars() {
        let claims = Claims {
            sub: Uuid::new_v4(),
            email: "user+tag@sub.domain.com".into(),
            role: UserRole::ShopFloor,
            token_type: TokenType::Access,
            iat: 0,
            exp: 9999999999,
        };
        let token = encode_token(&claims, "secret").unwrap();
        let decoded = decode_token(&token, "secret").unwrap();
        assert_eq!(decoded.claims.email, "user+tag@sub.domain.com");
    }
}

#[cfg(test)]
mod role_guard_tests {
    use crate::auth::*;

    #[test]
    fn test_admin_only_guard() {
        let roles = AdminOnly::allowed_roles();
        assert_eq!(roles, vec![UserRole::SuperAdmin]);
    }

    #[test]
    fn test_designer_or_above_guard() {
        let roles = DesignerOrAbove::allowed_roles();
        assert!(roles.contains(&UserRole::SuperAdmin));
        assert!(roles.contains(&UserRole::Designer));
        assert!(!roles.contains(&UserRole::CncOperator));
        assert!(!roles.contains(&UserRole::ShopFloor));
    }

    #[test]
    fn test_operator_or_above_guard() {
        let roles = OperatorOrAbove::allowed_roles();
        assert!(roles.contains(&UserRole::SuperAdmin));
        assert!(roles.contains(&UserRole::Designer));
        assert!(roles.contains(&UserRole::CncOperator));
        assert!(!roles.contains(&UserRole::ShopFloor));
    }

    #[test]
    fn test_any_authenticated_guard() {
        let roles = AnyAuthenticated::allowed_roles();
        assert_eq!(roles.len(), 4);
        assert!(roles.contains(&UserRole::SuperAdmin));
        assert!(roles.contains(&UserRole::Designer));
        assert!(roles.contains(&UserRole::CncOperator));
        assert!(roles.contains(&UserRole::ShopFloor));
    }
}

#[cfg(test)]
mod middleware_logic_tests {
    //! Unit-level tests for middleware helper logic.
    //! Full integration tests require actix_rt::test with a test server —
    //! these validate the pure-function components.

    use crate::auth::*;
    use chrono::{Duration, Utc};
    use uuid::Uuid;

    fn test_secret() -> &'static str {
        "middleware-test-secret"
    }

    #[test]
    fn test_bearer_extraction_valid() {
        let header = "Bearer eyJhbGciOiJIUzI1NiJ9.abc.def";
        let token = &header[7..];
        assert_eq!(token, "eyJhbGciOiJIUzI1NiJ9.abc.def");
    }

    #[test]
    fn test_bearer_extraction_no_prefix() {
        let header = "eyJhbGciOiJIUzI1NiJ9.abc.def";
        assert!(!header.starts_with("Bearer "));
    }

    #[test]
    fn test_bearer_extraction_wrong_scheme() {
        let header = "Basic dXNlcjpwYXNz";
        assert!(!header.starts_with("Bearer "));
    }

    #[test]
    fn test_middleware_rejects_refresh_token_for_api_access() {
        let config = AuthConfig {
            jwt_secret: test_secret().into(),
            access_token_ttl: Duration::hours(1),
            refresh_token_ttl: Duration::days(7),
        };
        let pair = generate_token_pair(Uuid::new_v4(), "mw@test.com", UserRole::Designer, &config)
            .unwrap();

        // The middleware should reject a refresh token used as an access token.
        let claims = decode_token(&pair.refresh_token, test_secret())
            .unwrap()
            .claims;
        assert_eq!(claims.token_type, TokenType::Refresh);
        // In the real middleware, this would result in a 401 because token_type != Access
    }

    #[test]
    fn test_middleware_accepts_valid_access_token() {
        let config = AuthConfig {
            jwt_secret: test_secret().into(),
            access_token_ttl: Duration::hours(1),
            refresh_token_ttl: Duration::days(7),
        };
        let pair = generate_token_pair(Uuid::new_v4(), "mw@test.com", UserRole::Designer, &config)
            .unwrap();

        let claims = decode_token(&pair.access_token, test_secret())
            .unwrap()
            .claims;
        assert_eq!(claims.token_type, TokenType::Access);
    }

    #[test]
    fn test_expired_access_token_rejected() {
        let now = Utc::now();
        let claims = Claims {
            sub: Uuid::new_v4(),
            email: "exp@test.com".into(),
            role: UserRole::ShopFloor,
            token_type: TokenType::Access,
            iat: (now - Duration::hours(48)).timestamp(),
            exp: (now - Duration::hours(24)).timestamp(),
        };
        let token = encode_token(&claims, test_secret()).unwrap();
        assert!(decode_token(&token, test_secret()).is_err());
    }
}

#[cfg(test)]
mod integration_style_tests {
    //! Higher-level tests that exercise multi-step auth flows.

    use crate::auth::{password::*, *};
    use chrono::Duration;
    use uuid::Uuid;

    fn test_config() -> AuthConfig {
        AuthConfig {
            jwt_secret: "integration-test-secret".into(),
            access_token_ttl: Duration::hours(24),
            refresh_token_ttl: Duration::days(7),
        }
    }

    /// Simulates the full login flow: hash → store → verify → issue tokens.
    #[test]
    fn test_full_login_flow() {
        let raw_password = "MyStr0ng!";
        let hash = hash_password(raw_password).unwrap();

        // Simulate verification
        assert!(verify_password(raw_password, &hash).unwrap());
        assert!(!verify_password("WrongPass1", &hash).unwrap());

        // Issue tokens
        let uid = Uuid::new_v4();
        let config = test_config();
        let pair =
            generate_token_pair(uid, "login@cnc.io", UserRole::CncOperator, &config).unwrap();

        // Validate access token
        let claims =
            validate_token(&pair.access_token, &config.jwt_secret, TokenType::Access).unwrap();
        assert_eq!(claims.sub, uid);
        assert_eq!(claims.role, UserRole::CncOperator);
    }

    /// Simulates the refresh flow: use refresh token → get new pair.
    #[test]
    fn test_full_refresh_flow() {
        let config = test_config();
        let uid = Uuid::new_v4();
        let pair1 =
            generate_token_pair(uid, "refresh@cnc.io", UserRole::Designer, &config).unwrap();

        // Validate refresh token
        let refresh_claims =
            validate_token(&pair1.refresh_token, &config.jwt_secret, TokenType::Refresh).unwrap();
        assert_eq!(refresh_claims.sub, uid);

        // Issue new pair (simulating what the /refresh endpoint does)
        let pair2 =
            generate_token_pair(uid, "refresh@cnc.io", UserRole::Designer, &config).unwrap();
        assert_ne!(pair1.access_token, pair2.access_token);
    }

    /// Simulates change-password: old password verified, new password hashed.
    #[test]
    fn test_change_password_flow() {
        let old_pw = "OldPass1!";
        let new_pw = "NewPass2!";

        let old_hash = hash_password(old_pw).unwrap();

        // Verify old password
        assert!(verify_password(old_pw, &old_hash).unwrap());

        // Validate new password strength
        assert!(validate_password_strength(new_pw).is_ok());

        // Hash new password
        let new_hash = hash_password(new_pw).unwrap();

        // Verify new password works
        assert!(verify_password(new_pw, &new_hash).unwrap());
        // Old password no longer works against new hash
        assert!(!verify_password(old_pw, &new_hash).unwrap());
    }

    /// Verifies that role-based access control works across token → user flow.
    #[test]
    fn test_role_enforcement_via_token() {
        let config = test_config();

        let admin_pair = generate_token_pair(
            Uuid::new_v4(),
            "admin@cnc.io",
            UserRole::SuperAdmin,
            &config,
        )
        .unwrap();
        let floor_pair =
            generate_token_pair(Uuid::new_v4(), "floor@cnc.io", UserRole::ShopFloor, &config)
                .unwrap();

        let admin_claims = validate_token(
            &admin_pair.access_token,
            &config.jwt_secret,
            TokenType::Access,
        )
        .unwrap();
        let floor_claims = validate_token(
            &floor_pair.access_token,
            &config.jwt_secret,
            TokenType::Access,
        )
        .unwrap();

        let admin_user = AuthenticatedUser::from_claims(&admin_claims);
        let floor_user = AuthenticatedUser::from_claims(&floor_claims);

        // Admin can access admin-only resources
        assert!(require_admin(&admin_user).is_ok());
        // Shop floor cannot
        assert!(require_admin(&floor_user).is_err());

        // Both can access any-authenticated resources
        assert!(require_roles(&admin_user, &AnyAuthenticated::allowed_roles()).is_ok());
        assert!(require_roles(&floor_user, &AnyAuthenticated::allowed_roles()).is_ok());
    }

    /// Ensures a tampered token is rejected.
    #[test]
    fn test_tampered_token_rejected() {
        let config = test_config();
        let pair =
            generate_token_pair(Uuid::new_v4(), "tamper@cnc.io", UserRole::Designer, &config)
                .unwrap();

        // Flip one character in the token
        let mut tampered = pair.access_token.clone();
        let bytes = unsafe { tampered.as_bytes_mut() };
        if let Some(b) = bytes.last_mut() {
            *b = if *b == b'A' { b'B' } else { b'A' };
        }

        assert!(decode_token(&tampered, &config.jwt_secret).is_err());
    }

    /// Ensure tokens with different secrets are rejected.
    #[test]
    fn test_cross_secret_rejection() {
        let config1 = AuthConfig {
            jwt_secret: "secret-one".into(),
            access_token_ttl: Duration::hours(1),
            refresh_token_ttl: Duration::days(1),
        };
        let config2 = AuthConfig {
            jwt_secret: "secret-two".into(),
            access_token_ttl: Duration::hours(1),
            refresh_token_ttl: Duration::days(1),
        };

        let pair =
            generate_token_pair(Uuid::new_v4(), "x@x.com", UserRole::Designer, &config1).unwrap();
        assert!(decode_token(&pair.access_token, &config2.jwt_secret).is_err());
    }
}
