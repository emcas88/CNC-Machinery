use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// A nesting optimization run for a job or set of parts.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OptimizationRun {
    pub id: Uuid,
    pub job_id: Uuid,
    /// Run status: "queued", "running", "complete", "failed".
    pub status: String,
    /// Algorithm used: "guillotine", "maxrects", "genetic", etc.
    pub algorithm: String,
    /// Overall material utilization percentage (0.0–100.0).
    pub utilization_percent: Option<f64>,
    /// Number of sheets used across all materials.
    pub sheets_used: Option<i32>,
    /// Algorithm configuration passed at run time.
    pub config: Value,
    /// Result summary and statistics.
    pub result_summary: Option<Value>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// DTO for creating an optimization run.
#[derive(Debug, Deserialize)]
pub struct CreateOptimizationRun {
    pub job_id: Uuid,
    pub algorithm: Option<String>,
    pub config: Option<Value>,
}
