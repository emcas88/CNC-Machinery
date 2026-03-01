use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A saved ATC (Automatic Tool Changer) tool set for a specific machine.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AtcToolSet {
    pub id: Uuid,
    pub name: String,
    pub machine_id: Uuid,
    /// Ordered list of tool UUIDs loaded in the tool magazine.
    pub tool_ids: Vec<Uuid>,
    pub created_at: DateTime<Utc>,
}

/// DTO for creating an ATC tool set.
#[derive(Debug, Deserialize)]
pub struct CreateAtcToolSet {
    pub name: String,
    pub machine_id: Uuid,
    pub tool_ids: Vec<Uuid>,
}

/// DTO for updating an ATC tool set.
#[derive(Debug, Deserialize)]
pub struct UpdateAtcToolSet {
    pub name: Option<String>,
    pub tool_ids: Option<Vec<Uuid>>,
}
