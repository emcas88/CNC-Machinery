use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// A nesting optimization run for a job or set of parts.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OptimizationRun {
    pub id: Uuid,
    pub job_id: Uuid,
    pub name: String,
    pub status: OptimizationStatus,
    pub quality: OptimizationQuality,
    pub settings: Value,
    pub sheets: Value,
    pub yield_percentage: Option<f64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Optimization quality/algorithm presets.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "optimization_quality", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum OptimizationQuality {
    FastEstimate,
    Good,
    Better,
    Best,
}

impl std::fmt::Display for OptimizationQuality {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::FastEstimate => write!(f, "fast_estimate"),
            Self::Good => write!(f, "good"),
            Self::Better => write!(f, "better"),
            Self::Best => write!(f, "best"),
        }
    }
}

/// Optimization run status.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "optimization_status", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum OptimizationStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

impl std::fmt::Display for OptimizationStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Running => write!(f, "running"),
            Self::Completed => write!(f, "completed"),
            Self::Failed => write!(f, "failed"),
        }
    }
}

/// DTO for creating an optimization run.
#[derive(Debug, Deserialize)]
pub struct CreateOptimizationRun {
    pub job_id: Uuid,
    pub name: Option<String>,
    pub quality: Option<OptimizationQuality>,
    pub settings: Option<Value>,
}

/// DTO for updating an optimization run.
#[derive(Debug, Deserialize)]
pub struct UpdateOptimizationRun {
    pub name: Option<String>,
    pub status: Option<OptimizationStatus>,
    pub quality: Option<OptimizationQuality>,
    pub settings: Option<Value>,
    pub sheets: Option<Value>,
    pub yield_percentage: Option<f64>,
}
