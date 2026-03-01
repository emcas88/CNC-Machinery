use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A named group of related textures (e.g., "Oak Veneer Collection").
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TextureGroup {
    pub id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

/// DTO for creating a new texture group.
#[derive(Debug, Deserialize)]
pub struct CreateTextureGroup {
    pub name: String,
}

/// DTO for updating a texture group.
#[derive(Debug, Deserialize)]
pub struct UpdateTextureGroup {
    pub name: Option<String>,
}
