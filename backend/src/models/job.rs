use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A manufacturing job grouping one or more rooms and their parts.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Job {
    pub id: Uuid,
    pub name: String,
    pub client_name: Option<String>,
    /// Current status: "draft", "quoted", "in_production", "shipped", "complete".
    pub status: String,
    pub due_date: Option<DateTime<Utc>>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a job.
#[derive(Debug, Deserialize)]
pub struct CreateJob {
    pub name: String,
    pub client_name: Option<String>,
    pub status: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub notes: Option<String>,
}

/// DTO for updating a job.
#[derive(Debug, Deserialize)]
pub struct UpdateJob {
    pub name: Option<String>,
    pub client_name: Option<String>,
    pub status: Option<String>,
    pub due_date: Option<DateTime<Utc>>,
    pub notes: Option<String>,
}
