use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// A saved camera/view state for a 3D room scene.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SavedView {
    pub id: Uuid,
    pub room_id: Uuid,
    pub name: String,
    /// Camera position and orientation as JSON {x, y, z, target_x, target_y, target_z, fov}.
    pub camera_position: Value,
    /// JSON map of layer name to visibility boolean.
    pub layer_visibility: Value,
    pub created_at: DateTime<Utc>,
}

/// DTO for creating a saved view.
#[derive(Debug, Deserialize)]
pub struct CreateSavedView {
    pub room_id: Uuid,
    pub name: String,
    pub camera_position: Value,
    pub layer_visibility: Option<Value>,
}

/// DTO for updating a saved view.
#[derive(Debug, Deserialize)]
pub struct UpdateSavedView {
    pub name: Option<String>,
    pub camera_position: Option<Value>,
    pub layer_visibility: Option<Value>,
}
