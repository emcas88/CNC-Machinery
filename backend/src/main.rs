// backend/src/main.rs
// Fixed Issue 18: Removed duplicate route registrations;
// all routes now registered once via api::configure_routes.

use actix_web::{middleware::Logger, web, App, HttpServer};
use sqlx::postgres::PgPoolOptions;
use std::env;

mod api;
mod auth;
mod middleware;
mod models;
mod services;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();
    env_logger::init();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    let pool = web::Data::new(pool);

    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .wrap(crate::middleware::audit::AuditMiddleware)
            .app_data(pool.clone())
            .configure(api::configure_routes)
    })
    .bind(("0.0.0.0", 8080))?
    .run()
    .await
}
