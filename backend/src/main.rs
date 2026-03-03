use axum::Router;
use std::net::SocketAddr;
use tower_http::cors::{CorsLayer, Any};
use tracing_subscriber;

mod api;
mod auth;
mod db;
mod errors;
mod models;
mod middleware;
mod services;

pub use auth::AuthenticatedUser;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| {
            eprintln!("ERROR: DATABASE_URL environment variable not set");
            std::process::exit(1);
        });

    let pool = sqlx::PgPool::connect(&database_url)
        .await
        .unwrap_or_else(|e| {
            eprintln!("ERROR: Failed to connect to database: {}", e);
            std::process::exit(1);
        });

    let auth_config = auth::AuthConfig::from_env_or_exit();

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .nest("/api", api::router(pool.clone()))
        .nest("/api", auth::auth_api::router(pool.clone(), auth_config.clone()))
        .layer(cors)
        .layer(middleware::AuditMiddlewareLayer::new(pool.clone()))
        .with_state(pool);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    tracing::info!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
