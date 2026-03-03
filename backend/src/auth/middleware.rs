use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use crate::auth::{AuthConfig, AuthenticatedUser};

pub async fn auth_middleware(
    State(auth_config): State<AuthConfig>,
    mut request: Request,
    next: Next,
) -> Response {
    let token = request
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|s| s.to_owned());

    match token {
        None => (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({ "error": "Missing authorization token" })),
        )
            .into_response(),
        Some(token_str) => match crate::auth::validate_token(&token_str, &auth_config) {
            Ok(user_id) => {
                request.extensions_mut().insert(AuthenticatedUser { user_id });
                next.run(request).await
            }
            Err(_) => (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "Invalid or expired token" })),
            )
                .into_response(),
        },
    }
}
