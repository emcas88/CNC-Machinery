use actix_cors::Cors;
use actix_web::{get, middleware, web, App, HttpResponse, HttpServer, Responder};
use dotenv::dotenv;
use sqlx::postgres::PgPoolOptions;

use cnc_backend::{api, config};

/// Health check endpoint.
#[get("/api/health")]
async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "ok",
        "service": "cnc-backend",
        "version": env!("CARGO_PKG_VERSION")
    }))
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    // Load .env file for local development.
    dotenv().ok();

    // Initialize logger (controlled by RUST_LOG env var).
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    // Load configuration from environment.
    let config = config::AppConfig::from_env();

    log::info!(
        "Starting CNC Machinery backend on {}:{}",
        config.server_host,
        config.server_port
    );

    // Connect to PostgreSQL and run pending migrations.
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await
        .expect("Failed to connect to PostgreSQL");

    log::info!("Database connection established");

    sqlx::migrate!("../migrations")
        .run(&pool)
        .await
        .expect("Failed to run database migrations");

    log::info!("Migrations applied successfully");

    let pool = web::Data::new(pool);
    let host = config.server_host.clone();
    let port = config.server_port;

    HttpServer::new(move || {
        // Allow all origins for development. Restrict in production.
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);

        App::new()
            .wrap(cors)
            .wrap(middleware::Logger::default())
            .app_data(pool.clone())
            // Health check (not under /api prefix configured by modules)
            .service(health_check)
            // Mount all API modules under /api prefix.
            .service(
                web::scope("/api").configure(api::configure_routes),
            )
    })
    .bind((host.as_str(), port))?
    .run()
    .await
}
