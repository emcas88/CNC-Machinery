use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// A machining operation to be executed on a CNC machine for a specific part.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Operation {
    pub id: Uuid,
    pub part_id: Uuid,
    pub machine_id: Option<Uuid>,
    /// Operation type: "profile_cut", "pocket", "drill", "engrave", "edge_band", etc.
    pub operation_type: String,
    /// Sequence order within the part's operations list.
    pub sequence_order: i32,
    pub tool_id: Option<Uuid>,
    /// Feed rate in mm/min.
    pub feed_rate_mm_min: Option<f64>,
    /// Spindle speed in RPM.
    pub spindle_speed_rpm: Option<i32>,
    /// Depth of cut in mm (per pass).
    pub depth_mm: Option<f64>,
    /// Operation-specific geometry and parameters as JSON.
    pub parameters: Value,
    /// Current status: "pending", "in_progress", "complete", "error".
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating an operation.
#[derive(Debug, Deserialize)]
pub struct CreateOperation {
    pub part_id: Uuid,
    pub machine_id: Option<Uuid>,
    pub operation_type: String,
    pub sequence_order: Option<i32>,
    pub tool_id: Option<Uuid>,
    pub feed_rate_mm_min: Option<f64>,
    pub spindle_speed_rpm: Option<i32>,
    pub depth_mm: Option<f64>,
    pub parameters: Option<Value>,
    pub status: Option<String>,
}

/// DTO for updating an operation.
#[derive(Debug, Deserialize)]
pub struct UpdateOperation {
    pub machine_id: Option<Uuid>,
    pub operation_type: Option<String>,
    pub sequence_order: Option<i32>,
    pub tool_id: Option<Uuid>,
    pub feed_rate_mm_min: Option<f64>,
    pub spindle_speed_rpm: Option<i32>,
    pub depth_mm: Option<f64>,
    pub parameters: Option<Value>,
    pub status: Option<String>,
}
