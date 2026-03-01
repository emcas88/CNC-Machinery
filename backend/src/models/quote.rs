use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// A quote/estimate document for a job.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Quote {
    pub id: Uuid,
    pub job_id: Uuid,
    /// Human-readable quote number (e.g., "Q-2024-0042").
    pub quote_number: String,
    pub material_cost: f64,
    pub hardware_cost: f64,
    pub labor_cost: f64,
    /// Markup applied as a percentage (e.g., 20.0 = 20%).
    pub markup_percentage: f64,
    pub total: f64,
    /// Detailed line items as JSON array.
    pub line_items: Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a quote.
#[derive(Debug, Deserialize)]
pub struct CreateQuote {
    pub job_id: Uuid,
    pub quote_number: String,
    pub material_cost: f64,
    pub hardware_cost: f64,
    pub labor_cost: f64,
    pub markup_percentage: f64,
    pub line_items: Option<Value>,
}

/// DTO for updating a quote.
#[derive(Debug, Deserialize)]
pub struct UpdateQuote {
    pub quote_number: Option<String>,
    pub material_cost: Option<f64>,
    pub hardware_cost: Option<f64>,
    pub labor_cost: Option<f64>,
    pub markup_percentage: Option<f64>,
    pub line_items: Option<Value>,
}
