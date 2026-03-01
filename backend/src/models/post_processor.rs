use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// A post-processor definition for generating machine-specific G-code or toolpath files.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PostProcessor {
    pub id: Uuid,
    pub name: String,
    /// Target controller type: "fanuc", "heidenhain", "grbl", "mach3", etc.
    pub controller_type: String,
    /// Output file extension (e.g., "nc", "tap", "cnc").
    pub file_extension: String,
    /// Template strings and substitution rules as JSON.
    pub template_config: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a post-processor.
#[derive(Debug, Deserialize)]
pub struct CreatePostProcessor {
    pub name: String,
    pub controller_type: String,
    pub file_extension: String,
    pub template_config: Option<Value>,
}

/// DTO for updating a post-processor.
#[derive(Debug, Deserialize)]
pub struct UpdatePostProcessor {
    pub name: Option<String>,
    pub controller_type: Option<String>,
    pub file_extension: Option<String>,
    pub template_config: Option<Value>,
}
