use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// A named set of assembly and joinery rules for cabinet construction.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ConstructionMethod {
    pub id: Uuid,
    pub name: String,
    /// List of joinery types used (e.g., ["dowel", "confirmat", "cam_lock"]).
    pub joinery_type: Vec<String>,
    /// Fastener specifications as JSON (type, spacing, diameter, etc.).
    pub fastener_specs: Value,
    /// Rules for part placement, reveal, inset, and clearance.
    pub placement_rules: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a construction method.
#[derive(Debug, Deserialize)]
pub struct CreateConstructionMethod {
    pub name: String,
    pub joinery_type: Vec<String>,
    pub fastener_specs: Option<Value>,
    pub placement_rules: Option<Value>,
}

/// DTO for updating a construction method.
#[derive(Debug, Deserialize)]
pub struct UpdateConstructionMethod {
    pub name: Option<String>,
    pub joinery_type: Option<Vec<String>>,
    pub fastener_specs: Option<Value>,
    pub placement_rules: Option<Value>,
}
