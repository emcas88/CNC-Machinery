use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// A drawing template defining page layout, title block, and dimensions.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DrawingTemplate {
    pub id: Uuid,
    pub name: String,
    /// Page size (e.g., "A4", "Letter", "Arch D").
    pub page_size: String,
    /// Page orientation: "portrait" or "landscape".
    pub orientation: String,
    /// Title block configuration as JSON.
    pub title_block: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a drawing template.
#[derive(Debug, Deserialize)]
pub struct CreateDrawingTemplate {
    pub name: String,
    pub page_size: String,
    pub orientation: String,
    pub title_block: Option<Value>,
}

/// DTO for updating a drawing template.
#[derive(Debug, Deserialize)]
pub struct UpdateDrawingTemplate {
    pub name: Option<String>,
    pub page_size: Option<String>,
    pub orientation: Option<String>,
    pub title_block: Option<Value>,
}
