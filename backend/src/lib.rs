// Library entry point for integration tests.
// Re-exports all internal modules so tests can access them via `cnc_backend::`.

pub mod api;
pub mod auth;
pub mod config;
pub mod middleware;
pub mod models;
pub mod services;
