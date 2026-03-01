use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A material definition (sheet goods, solid wood, etc.) in the material library.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Material {
    pub id: Uuid,
    pub name: String,
    pub sku: Option<String>,
    /// Material category: "sheet", "solid_wood", "veneer", "laminate", etc.
    pub material_type: String,
    /// Thickness in millimetres.
    pub thickness_mm: f64,
    /// Sheet width in millimetres (null for non-sheet goods).
    pub width_mm: Option<f64>,
    /// Sheet length in millimetres (null for non-sheet goods).
    pub length_mm: Option<f64>,
    pub supplier: Option<String>,
    pub cost_per_sheet: Option<f64>,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a material.
#[derive(Debug, Deserialize)]
pub struct CreateMaterial {
    pub name: String,
    pub sku: Option<String>,
    pub material_type: String,
    pub thickness_mm: f64,
    pub width_mm: Option<f64>,
    pub length_mm: Option<f64>,
    pub supplier: Option<String>,
    pub cost_per_sheet: Option<f64>,
    pub description: Option<String>,
}

/// DTO for updating a material.
#[derive(Debug, Deserialize)]
pub struct UpdateMaterial {
    pub name: Option<String>,
    pub sku: Option<String>,
    pub material_type: Option<String>,
    pub thickness_mm: Option<f64>,
    pub width_mm: Option<f64>,
    pub length_mm: Option<f64>,
    pub supplier: Option<String>,
    pub cost_per_sheet: Option<f64>,
    pub description: Option<String>,
}
