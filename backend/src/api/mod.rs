use axum::Router;
use sqlx::PgPool;

mod machines;
mod jobs;
mod materials;
mod tools;
mod operators;
mod maintenance;
mod quality_control;
mod production;
mod inventory;
mod analytics;
mod settings;
mod users;
mod dashboard;
mod components;
mod reports;
mod notifications;
mod tasks;
mod files;
mod suppliers;
mod customers;
mod contracts;
mod audit_logs;

pub fn router(pool: PgPool) -> Router {
    Router::new()
        .nest("/machines", machines::router(pool.clone()))
        .nest("/jobs", jobs::router(pool.clone()))
        .nest("/materials", materials::router(pool.clone()))
        .nest("/tools", tools::router(pool.clone()))
        .nest("/operators", operators::router(pool.clone()))
        .nest("/maintenance", maintenance::router(pool.clone()))
        .nest("/quality", quality_control::router(pool.clone()))
        .nest("/production", production::router(pool.clone()))
        .nest("/inventory", inventory::router(pool.clone()))
        .nest("/analytics", analytics::router(pool.clone()))
        .nest("/settings", settings::router(pool.clone()))
        .nest("/users", users::router(pool.clone()))
        .nest("/dashboard", dashboard::router(pool.clone()))
        .nest("/components", components::router(pool.clone()))
        .nest("/reports", reports::router(pool.clone()))
        .nest("/notifications", notifications::router(pool.clone()))
        .nest("/tasks", tasks::router(pool.clone()))
        .nest("/files", files::router(pool.clone()))
        .nest("/suppliers", suppliers::router(pool.clone()))
        .nest("/customers", customers::router(pool.clone()))
        .nest("/contracts", contracts::router(pool.clone()))
        .nest("/audit-logs", audit_logs::router(pool.clone()))
}
