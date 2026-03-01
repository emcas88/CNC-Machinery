use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// A rule that maps a cabinet/part template to a specific machine and operation.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MachineTemplateRule {
    pub id: Uuid,
    pub machine_id: Uuid,
    /// The template or part-type selector this rule applies to.
    pub template_selector: String,
    /// The operation type (e.g., "cut", "drill", "edge_band").
    pub operation_type: String,
    /// Priority order — lower numbers run first.
    pub priority: i32,
    /// Rule-specific parameters as JSON.
    pub parameters: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a machine template rule.
#[derive(Debug, Deserialize)]
pub struct CreateMachineTemplateRule {
    pub machine_id: Uuid,
    pub template_selector: String,
    pub operation_type: String,
    pub priority: Option<i32>,
    pub parameters: Option<Value>,
}

/// DTO for updating a machine template rule.
#[derive(Debug, Deserialize)]
pub struct UpdateMachineTemplateRule {
    pub template_selector: Option<String>,
    pub operation_type: Option<String>,
    pub priority: Option<i32>,
    pub parameters: Option<Value>,
}
