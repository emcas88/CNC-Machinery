use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// A drawing template defining page layout, title block, and dimensions.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DrawingTemplate {
    pub id: Uuid,
    pub name: String,
    pub page_size: String,
    pub layout: Value,
    pub title_block: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a drawing template.
#[derive(Debug, Deserialize)]
pub struct CreateDrawingTemplate {
    pub name: String,
    pub page_size: String,
    pub layout: Option<Value>,
    pub title_block: Option<Value>,
}

/// DTO for updating a drawing template.
#[derive(Debug, Deserialize)]
pub struct UpdateDrawingTemplate {
    pub name: Option<String>,
    pub page_size: Option<String>,
    pub layout: Option<Value>,
    pub title_block: Option<Value>,
}
