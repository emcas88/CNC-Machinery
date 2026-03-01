use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// A reusable material assignment template for cabinet carcasses.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MaterialTemplate {
    pub id: Uuid,
    pub name: String,
    /// Material assignments per panel role as JSON
    /// (e.g., {"carcass": uuid, "back": uuid, "door": uuid}).
    pub assignments: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a material template.
#[derive(Debug, Deserialize)]
pub struct CreateMaterialTemplate {
    pub name: String,
    pub assignments: Option<Value>,
}

/// DTO for updating a material template.
#[derive(Debug, Deserialize)]
pub struct UpdateMaterialTemplate {
    pub name: Option<String>,
    pub assignments: Option<Value>,
}
