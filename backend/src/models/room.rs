use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// A room within a job, containing one or more products (cabinets).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Room {
    pub id: Uuid,
    pub job_id: Uuid,
    pub name: String,
    /// Room width in millimeters.
    pub width: f64,
    /// Room height in millimeters.
    pub height: f64,
    /// Room depth in millimeters.
    pub depth: f64,
    pub notes: Option<String>,
    /// Per-room overrides for material assignments (JSON map of part_type -> material_id).
    pub material_overrides: Option<Value>,
    /// Per-room overrides for construction methods.
    pub construction_overrides: Option<Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a new room.
#[derive(Debug, Deserialize)]
pub struct CreateRoom {
    pub job_id: Uuid,
    pub name: String,
    pub width: f64,
    pub height: f64,
    pub depth: f64,
    pub notes: Option<String>,
    pub material_overrides: Option<Value>,
    pub construction_overrides: Option<Value>,
}

/// DTO for updating an existing room.
#[derive(Debug, Deserialize)]
pub struct UpdateRoom {
    pub name: Option<String>,
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub depth: Option<f64>,
    pub notes: Option<String>,
    pub material_overrides: Option<Value>,
    pub construction_overrides: Option<Value>,
}
