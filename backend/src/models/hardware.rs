use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// A hardware item (hinge, handle, cam lock, etc.) in the hardware library.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Hardware {
    pub id: Uuid,
    pub name: String,
    pub sku: Option<String>,
    pub hardware_type: String,
    pub supplier: Option<String>,
    pub unit_cost: Option<f64>,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a hardware item.
#[derive(Debug, Deserialize)]
pub struct CreateHardware {
    pub name: String,
    pub sku: Option<String>,
    pub hardware_type: String,
    pub supplier: Option<String>,
    pub unit_cost: Option<f64>,
    pub description: Option<String>,
}

/// DTO for updating a hardware item.
#[derive(Debug, Deserialize)]
pub struct UpdateHardware {
    pub name: Option<String>,
    pub sku: Option<String>,
    pub hardware_type: Option<String>,
    pub supplier: Option<String>,
    pub unit_cost: Option<f64>,
    pub description: Option<String>,
}
