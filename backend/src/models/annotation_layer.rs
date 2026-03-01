use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// A named annotation layer for markup and dimension overlays in the designer.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AnnotationLayer {
    pub id: Uuid,
    pub room_id: Uuid,
    pub name: String,
    /// CSS-style hex color for this layer's annotations (e.g., "#FF5500").
    pub color: String,
    pub visible: bool,
    /// JSON array of annotation items (dimensions, text, arrows, symbols).
    pub items: Value,
    pub created_at: DateTime<Utc>,
}

/// DTO for creating an annotation layer.
#[derive(Debug, Deserialize)]
pub struct CreateAnnotationLayer {
    pub room_id: Uuid,
    pub name: String,
    pub color: String,
    #[serde(default = "default_true")]
    pub visible: bool,
    pub items: Option<Value>,
}

fn default_true() -> bool {
    true
}

/// DTO for updating an annotation layer.
#[derive(Debug, Deserialize)]
pub struct UpdateAnnotationLayer {
    pub name: Option<String>,
    pub color: Option<String>,
    pub visible: Option<bool>,
    pub items: Option<Value>,
}
