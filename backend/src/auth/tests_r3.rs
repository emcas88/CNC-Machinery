// auth/tests_r3.rs — Round-3 unit tests for the auth module.
//
// Tests cover:
//   • hash_password / verify_password
//   • create_access_token / verify_access_token
//   • create_refresh_token / verify_refresh_token
//   • AuthError variants and Display impl
//   • TokenClaims Clone derive
//   • Expired-token detection → AuthError::TokenExpired

#[cfg(test)]
mod tests {
    use std::env;
    use std::sync::Mutex;
    use uuid::Uuid;

    use crate::auth::{
        create_access_token, create_refresh_token, hash_password, verify_access_token,
        verify_password, verify_refresh_token, AuthError, TokenClaims,
    };

    /// Mutex to serialise env-var manipulation across tests.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn lock_env() -> std::sync::MutexGuard<'static, ()> {
        ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Save and restore JWT_SECRET around a test closure.
    fn with_jwt_restore<F: FnOnce()>(f: F) {
        let saved = env::var("JWT_SECRET").ok();
        f();
        match saved {
            Some(v) => env::set_var("JWT_SECRET", v),
            None => env::remove_var("JWT_SECRET"),
        }
    }

    // ------------------------------------------------------------------
    // password helpers
    // ------------------------------------------------------------------

    #[test]
    fn test_hash_and_verify_password_ok() {
        let hash = hash_password("hunter2").expect("hash_password should succeed");
        let ok = verify_password("hunter2", &hash).expect("verify_password should succeed");
        assert!(ok, "correct password must verify as true");
    }

    #[test]
    fn test_verify_password_wrong() {
        let hash = hash_password("correct").unwrap();
        let ok = verify_password("wrong", &hash).unwrap();
        assert!(!ok, "wrong password must verify as false");
    }

    #[test]
    fn test_hash_is_not_plaintext() {
        let hash = hash_password("mysecret").unwrap();
        assert_ne!(hash, "mysecret");
    }

    // ------------------------------------------------------------------
    // access token
    // ------------------------------------------------------------------

    #[test]
    fn test_create_and_verify_access_token() {
        let _guard = lock_env();
        with_jwt_restore(|| {
            env::set_var("JWT_SECRET", "test-secret");
            let uid = Uuid::new_v4();
            let token =
                create_access_token(uid, "admin").expect("create_access_token should succeed");
            let claims = verify_access_token(&token).expect("verify_access_token should succeed");
            assert_eq!(claims.sub, uid.to_string());
            assert_eq!(claims.role, "admin");
        });
    }

    #[test]
    fn test_access_token_invalid_signature() {
        let _guard = lock_env();
        with_jwt_restore(|| {
            env::set_var("JWT_SECRET", "secret-a");
            let uid = Uuid::new_v4();
            let token = create_access_token(uid, "viewer").unwrap();

            env::set_var("JWT_SECRET", "secret-b");
            let result = verify_access_token(&token);
            assert!(
                result.is_err(),
                "mismatched secret should fail verification"
            );
        });
    }

    // ------------------------------------------------------------------
    // refresh token
    // ------------------------------------------------------------------

    #[test]
    fn test_create_and_verify_refresh_token() {
        let _guard = lock_env();
        with_jwt_restore(|| {
            env::set_var("JWT_SECRET", "refresh-secret");
            let uid = Uuid::new_v4();
            let token = create_refresh_token(uid).expect("create_refresh_token should succeed");
            let claims = verify_refresh_token(&token).expect("verify_refresh_token should succeed");
            assert_eq!(claims.sub, uid.to_string());
            // refresh tokens don't carry a role
            assert_eq!(claims.role, "");
        });
    }

    #[test]
    fn test_refresh_token_invalid_signature() {
        let _guard = lock_env();
        with_jwt_restore(|| {
            env::set_var("JWT_SECRET", "sig-a");
            let uid = Uuid::new_v4();
            let token = create_refresh_token(uid).unwrap();

            env::set_var("JWT_SECRET", "sig-b");
            let result = verify_refresh_token(&token);
            assert!(result.is_err());
        });
    }

    // ------------------------------------------------------------------
    // AuthError variants
    // ------------------------------------------------------------------

    #[test]
    fn test_auth_error_display_token_expired() {
        let e = AuthError::TokenExpired;
        assert_eq!(e.to_string(), "Token has expired");
    }

    #[test]
    fn test_auth_error_display_hash_error() {
        // BcryptError from an obviously broken cost factor
        let err = bcrypt::hash("x", 40); // cost 40 is out of range
        if let Err(bcrypt_err) = err {
            let ae = AuthError::HashError(bcrypt_err);
            assert!(ae.to_string().contains("hash error"));
        }
        // If bcrypt accepts cost=40 on this platform, just skip
    }

    // ------------------------------------------------------------------
    // TokenClaims Clone
    // ------------------------------------------------------------------

    #[test]
    fn test_token_claims_clone() {
        let c = TokenClaims {
            sub: "abc".to_string(),
            role: "admin".to_string(),
            exp: 9999999999,
            iat: 0,
        };
        let c2 = c.clone();
        assert_eq!(c.sub, c2.sub);
    }

    // ------------------------------------------------------------------
    // Expired token detection (uses a manually crafted expired JWT)
    // ------------------------------------------------------------------

    #[test]
    fn test_expired_access_token_returns_token_expired() {
        use crate::auth::TokenClaims;
        use jsonwebtoken::{encode, EncodingKey, Header};

        let _guard = lock_env();
        with_jwt_restore(|| {
            env::set_var("JWT_SECRET", "exp-secret");
            let expired_claims = TokenClaims {
                sub: Uuid::new_v4().to_string(),
                role: "viewer".to_string(),
                iat: 0,
                exp: 1, // epoch+1 second — always expired
            };
            let token = encode(
                &Header::default(),
                &expired_claims,
                &EncodingKey::from_secret(b"exp-secret"),
            )
            .unwrap();

            let result = verify_access_token(&token);
            assert!(matches!(result, Err(AuthError::TokenExpired)));
        });
    }
}
