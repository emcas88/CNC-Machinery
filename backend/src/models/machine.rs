use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// A CNC machine or production equipment entry.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Machine {
    pub id: Uuid,
    pub name: String,
    /// Machine category: "cnc_router", "edge_bander", "saw", "drill", etc.
    pub machine_type: String,
    pub manufacturer: Option<String>,
    pub model_number: Option<String>,
    /// Maximum workable X dimension in millimetres.
    pub max_x_mm: Option<f64>,
    /// Maximum workable Y dimension in millimetres.
    pub max_y_mm: Option<f64>,
    /// Maximum workable Z dimension in millimetres.
    pub max_z_mm: Option<f64>,
    /// Extra machine-specific settings as JSON.
    pub settings: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a machine.
#[derive(Debug, Deserialize)]
pub struct CreateMachine {
    pub name: String,
    pub machine_type: String,
    pub manufacturer: Option<String>,
    pub model_number: Option<String>,
    pub max_x_mm: Option<f64>,
    pub max_y_mm: Option<f64>,
    pub max_z_mm: Option<f64>,
    pub settings: Option<Value>,
}

/// DTO for updating a machine.
#[derive(Debug, Deserialize)]
pub struct UpdateMachine {
    pub name: Option<String>,
    pub machine_type: Option<String>,
    pub manufacturer: Option<String>,
    pub model_number: Option<String>,
    pub max_x_mm: Option<f64>,
    pub max_y_mm: Option<f64>,
    pub max_z_mm: Option<f64>,
    pub settings: Option<Value>,
}
