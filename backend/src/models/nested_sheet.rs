use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// A nested sheet layout produced by an optimization run.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct NestedSheet {
    pub id: Uuid,
    pub optimization_run_id: Uuid,
    pub material_id: Uuid,
    pub sheet_index: i32,
    /// Placed part polygons and positions as JSON.
    pub layout: Value,
    /// Waste percentage for this sheet (0.0–100.0).
    pub waste_percent: f64,
    pub created_at: DateTime<Utc>,
}

/// DTO for creating a nested sheet record.
#[derive(Debug, Deserialize)]
pub struct CreateNestedSheet {
    pub optimization_run_id: Uuid,
    pub material_id: Uuid,
    pub sheet_index: i32,
    pub layout: Value,
    pub waste_percent: f64,
}
