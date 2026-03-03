use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A stock sheet of material available for cutting.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Sheet {
    pub id: Uuid,
    pub material_id: Uuid,
    /// Width in millimetres.
    pub width_mm: f64,
    /// Length in millimetres.
    pub length_mm: f64,
    /// Quantity on hand.
    pub quantity: i32,
    /// Optional label or batch code.
    pub label: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a sheet record.
#[derive(Debug, Deserialize)]
pub struct CreateSheet {
    pub material_id: Uuid,
    pub width_mm: f64,
    pub length_mm: f64,
    pub quantity: i32,
    pub label: Option<String>,
}
