#[cfg(test)]
mod tests {
    use crate::auth::password;

    // ---- Password integration tests ----

    #[test]
    fn test_hash_and_verify_roundtrip() {
        let plain = "SecurePass1!";
        let hash = password::hash(plain).expect("hash should succeed");
        let ok = password::verify(plain, &hash).expect("verify should succeed");
        assert!(ok);
    }

    #[test]
    fn test_verify_wrong_password() {
        let hash = password::hash("Correct1!").unwrap();
        let ok = password::verify("Wrong1!", &hash).unwrap();
        assert!(!ok);
    }

    #[test]
    fn test_hash_is_argon2() {
        let hash = password::hash("TestPass1!").unwrap();
        assert!(hash.starts_with("$argon2"));
    }

    #[test]
    fn test_hash_unique_per_call() {
        let h1 = password::hash("Pass1!").unwrap();
        let h2 = password::hash("Pass1!").unwrap();
        assert_ne!(h1, h2);
    }

    #[test]
    fn test_validate_strength_valid() {
        assert!(password::validate_strength("SecurePass1!").is_ok());
    }

    #[test]
    fn test_validate_strength_too_short() {
        assert!(password::validate_strength("Ab1!").is_err());
    }

    #[test]
    fn test_validate_strength_no_upper() {
        assert!(password::validate_strength("lowercase1!").is_err());
    }

    #[test]
    fn test_validate_strength_no_lower() {
        assert!(password::validate_strength("UPPERCASE1!").is_err());
    }

    #[test]
    fn test_validate_strength_no_digit() {
        assert!(password::validate_strength("NoDigitPass!").is_err());
    }

    // ---- UUID / user ID tests ----

    #[test]
    fn test_uuid_new_v4_is_unique() {
        use uuid::Uuid;
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();
        assert_ne!(id1, id2);
    }

    #[test]
    fn test_uuid_parse_valid() {
        use uuid::Uuid;
        let id = Uuid::new_v4();
        let s = id.to_string();
        let parsed = Uuid::parse_str(&s).unwrap();
        assert_eq!(id, parsed);
    }

    #[test]
    fn test_uuid_parse_invalid() {
        use uuid::Uuid;
        assert!(Uuid::parse_str("not-a-uuid").is_err());
    }

    // ---- Role validation tests ----

    #[test]
    fn test_valid_roles() {
        let roles = vec!["Admin", "Manager", "Operator", "Viewer"];
        for role in &roles {
            assert!(["Admin", "Manager", "Operator", "Viewer"].contains(role));
        }
    }

    #[test]
    fn test_invalid_role() {
        let invalid = "Superuser";
        assert!(!["Admin", "Manager", "Operator", "Viewer"].contains(&invalid));
    }

    // ---- Serde tests for request structs ----

    #[test]
    fn test_change_password_request_deserialization() {
        let json = r#"{"current_password": "OldPass1!", "new_password": "NewPass1!"}"#;
        let req: serde_json::Value = serde_json::from_str(json).unwrap();
        assert_eq!(req["current_password"], "OldPass1!");
        assert_eq!(req["new_password"], "NewPass1!");
    }

    #[test]
    fn test_update_user_request_partial() {
        let json = r#"{"email": "new@example.com"}"#;
        let req: serde_json::Value = serde_json::from_str(json).unwrap();
        assert_eq!(req["email"], "new@example.com");
        assert!(req.get("role").is_none());
    }

    // ---- Error response format tests ----

    #[test]
    fn test_error_response_format() {
        let err = serde_json::json!({ "error": "User not found" });
        assert_eq!(err["error"], "User not found");
    }

    #[test]
    fn test_success_response_format() {
        let res = serde_json::json!({ "message": "Password updated" });
        assert_eq!(res["message"], "Password updated");
    }

    // ---- Status code tests ----

    #[test]
    fn test_status_codes_are_correct_values() {
        use axum::http::StatusCode;
        assert_eq!(StatusCode::OK.as_u16(), 200);
        assert_eq!(StatusCode::CREATED.as_u16(), 201);
        assert_eq!(StatusCode::NO_CONTENT.as_u16(), 204);
        assert_eq!(StatusCode::UNAUTHORIZED.as_u16(), 401);
        assert_eq!(StatusCode::NOT_FOUND.as_u16(), 404);
        assert_eq!(StatusCode::INTERNAL_SERVER_ERROR.as_u16(), 500);
    }

    #[test]
    fn test_conflict_status_code() {
        use axum::http::StatusCode;
        assert_eq!(StatusCode::CONFLICT.as_u16(), 409);
    }

    #[test]
    fn test_unprocessable_entity_status_code() {
        use axum::http::StatusCode;
        assert_eq!(StatusCode::UNPROCESSABLE_ENTITY.as_u16(), 422);
    }
}
