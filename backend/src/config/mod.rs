use std::env;

#[cfg(test)]
mod tests;

/// Application configuration loaded from environment variables.
#[derive(Debug, Clone)]
pub struct AppConfig {
    pub database_url: String,
    pub server_host: String,
    pub server_port: u16,
}

impl AppConfig {
    /// Load configuration from environment variables.
    /// Panics if required variables are missing.
    pub fn from_env() -> Self {
        AppConfig {
            database_url: env::var("DATABASE_URL")
                .expect("DATABASE_URL must be set"),
            server_host: env::var("SERVER_HOST")
                .unwrap_or_else(|_| "0.0.0.0".to_string()),
            server_port: env::var("SERVER_PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse::<u16>()
                .expect("SERVER_PORT must be a valid port number"),
        }
    }
}
