use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// A single manufactured part (panel, door, shelf, etc.).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Part {
    pub id: Uuid,
    pub product_id: Uuid,
    pub material_id: Uuid,
    pub name: String,
    /// Part role within the cabinet: "carcass", "door", "shelf", "back", "drawer_front", etc.
    pub part_type: String,
    /// Finished width in millimetres.
    pub width_mm: f64,
    /// Finished height in millimetres.
    pub height_mm: f64,
    /// Finished thickness in millimetres.
    pub thickness_mm: f64,
    pub quantity: i32,
    /// Edge banding configuration per edge as JSON
    /// (e.g., {"top": true, "bottom": false, "left": true, "right": true}).
    pub edge_banding: Value,
    /// CNC toolpath or machining instructions as JSON.
    pub machining_data: Option<Value>,
    /// Grain direction: "horizontal", "vertical", or "none".
    pub grain_direction: Option<String>,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a part.
#[derive(Debug, Deserialize)]
pub struct CreatePart {
    pub product_id: Uuid,
    pub material_id: Uuid,
    pub name: String,
    pub part_type: String,
    pub width_mm: f64,
    pub height_mm: f64,
    pub thickness_mm: f64,
    pub quantity: Option<i32>,
    pub edge_banding: Option<Value>,
    pub machining_data: Option<Value>,
    pub grain_direction: Option<String>,
    pub notes: Option<String>,
}

/// DTO for updating a part.
#[derive(Debug, Deserialize)]
pub struct UpdatePart {
    pub material_id: Option<Uuid>,
    pub name: Option<String>,
    pub part_type: Option<String>,
    pub width_mm: Option<f64>,
    pub height_mm: Option<f64>,
    pub thickness_mm: Option<f64>,
    pub quantity: Option<i32>,
    pub edge_banding: Option<Value>,
    pub machining_data: Option<Value>,
    pub grain_direction: Option<String>,
    pub notes: Option<String>,
}
