// backend/src/auth/tests_r3.rs
// Round 3 integration tests for auth module.
// Tests JWT creation/verification and refresh token DB operations.

#[cfg(test)]
mod tests {
    use sqlx::PgPool;
    use uuid::Uuid;

    use crate::auth::mod::{
        create_access_token, create_refresh_token, revoke_refresh_token,
        revoke_all_refresh_tokens, verify_token,
    };

    fn set_jwt_secret() {
        std::env::set_var("JWT_SECRET", "test-secret-for-r3-tests");
    }

    #[test]
    fn test_create_and_verify_access_token() {
        set_jwt_secret();
        let user_id = Uuid::new_v4();
        let token = create_access_token(user_id, "admin").expect("Should create token");
        let claims = verify_token(&token).expect("Should verify token");
        assert_eq!(claims.sub, user_id.to_string());
        assert_eq!(claims.role, "admin");
    }

    #[test]
    fn test_verify_invalid_token() {
        set_jwt_secret();
        let result = verify_token("not.a.valid.token");
        assert!(result.is_err());
    }

    #[sqlx::test]
    async fn test_create_and_revoke_refresh_token(pool: PgPool) {
        let user_id = Uuid::new_v4();
        // Create a user so FK constraint passes
        sqlx::query(
            "INSERT INTO users (id, email, name, password_hash, role) VALUES ($1, $2, $3, $4, $5)"
        )
        .bind(user_id)
        .bind(format!("auth_test+{}@example.com", user_id))
        .bind("Auth Test User")
        .bind("$2b$12$placeholder")
        .bind("operator")
        .execute(&pool)
        .await
        .unwrap();

        let token = create_refresh_token(user_id, &pool).await.expect("Should create refresh token");
        assert!(!token.is_empty());

        // Verify it exists in DB
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM refresh_tokens WHERE token = $1"
        )
        .bind(&token)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(count, 1);

        // Revoke it
        revoke_refresh_token(&token, &pool).await.expect("Should revoke");

        let count_after: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM refresh_tokens WHERE token = $1"
        )
        .bind(&token)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(count_after, 0);
    }

    #[sqlx::test]
    async fn test_revoke_all_refresh_tokens(pool: PgPool) {
        let user_id = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO users (id, email, name, password_hash, role) VALUES ($1, $2, $3, $4, $5)"
        )
        .bind(user_id)
        .bind(format!("auth_test2+{}@example.com", user_id))
        .bind("Auth Test User 2")
        .bind("$2b$12$placeholder")
        .bind("operator")
        .execute(&pool)
        .await
        .unwrap();

        // Create multiple tokens
        create_refresh_token(user_id, &pool).await.unwrap();
        create_refresh_token(user_id, &pool).await.unwrap();
        create_refresh_token(user_id, &pool).await.unwrap();

        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1"
        )
        .bind(user_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(count, 3);

        revoke_all_refresh_tokens(user_id, &pool).await.unwrap();

        let count_after: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1"
        )
        .bind(user_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(count_after, 0);
    }
}
