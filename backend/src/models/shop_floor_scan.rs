use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// A shop-floor barcode / QR scan event used for production tracking.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ShopFloorScan {
    pub id: Uuid,
    pub job_id: Uuid,
    pub part_id: Option<Uuid>,
    /// The scanned barcode or QR payload.
    pub scan_payload: String,
    /// Station or machine where the scan occurred.
    pub station: Option<String>,
    /// Additional metadata captured at scan time.
    pub metadata: Option<Value>,
    pub scanned_at: DateTime<Utc>,
}

/// DTO for recording a new scan event.
#[derive(Debug, Deserialize)]
pub struct CreateShopFloorScan {
    pub job_id: Uuid,
    pub part_id: Option<Uuid>,
    pub scan_payload: String,
    pub station: Option<String>,
    pub metadata: Option<Value>,
}
