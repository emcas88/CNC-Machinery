use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// A label template for part labels printed at the shop floor.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LabelTemplate {
    pub id: Uuid,
    pub name: String,
    /// Width in millimetres.
    pub width_mm: f64,
    /// Height in millimetres.
    pub height_mm: f64,
    /// Field layout configuration as JSON.
    pub fields: Value,
    pub created_at: DateTime<Utc>,
}

/// DTO for creating a label template.
#[derive(Debug, Deserialize)]
pub struct CreateLabelTemplate {
    pub name: String,
    pub width_mm: f64,
    pub height_mm: f64,
    pub fields: Option<Value>,
}

/// DTO for updating a label template.
#[derive(Debug, Deserialize)]
pub struct UpdateLabelTemplate {
    pub name: Option<String>,
    pub width_mm: Option<f64>,
    pub height_mm: Option<f64>,
    pub fields: Option<Value>,
}
