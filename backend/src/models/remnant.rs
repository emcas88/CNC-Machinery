use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A remnant (offcut) piece of sheet material available for reuse.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Remnant {
    pub id: Uuid,
    pub material_id: Uuid,
    /// Remnant width in mm.
    pub width: f64,
    /// Remnant length in mm.
    pub length: f64,
    /// Remnant thickness in mm (matches the material thickness).
    pub thickness: f64,
    /// Reference to the source sheet/job this remnant came from.
    pub source_sheet: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// DTO for creating a remnant.
#[derive(Debug, Deserialize)]
pub struct CreateRemnant {
    pub material_id: Uuid,
    pub width: f64,
    pub length: f64,
    pub thickness: f64,
    pub source_sheet: Option<String>,
}

/// DTO for updating a remnant.
#[derive(Debug, Deserialize)]
pub struct UpdateRemnant {
    pub width: Option<f64>,
    pub length: Option<f64>,
    pub source_sheet: Option<String>,
}
