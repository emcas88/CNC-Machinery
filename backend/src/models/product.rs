use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

/// Cabinet product type classification.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "product_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ProductType {
    BaseCabinet,
    WallCabinet,
    TallCabinet,
    Vanity,
    Closet,
    Wardrobe,
    Furniture,
}

/// Cabinet construction style.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "cabinet_style", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum CabinetStyle {
    Frameless,
    FaceFrame,
}

/// A single cabinet/product placed within a room.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Product {
    pub id: Uuid,
    pub room_id: Uuid,
    pub name: String,
    pub product_type: ProductType,
    pub cabinet_style: CabinetStyle,
    pub width: f64,
    pub height: f64,
    pub depth: f64,
    /// X position in 3D room layout (mm).
    pub position_x: f64,
    /// Y position in 3D room layout (mm).
    pub position_y: f64,
    /// Z position in 3D room layout (mm).
    pub position_z: f64,
    /// Rotation in degrees around the Y axis.
    pub rotation: f64,
    /// Optional wall assignment for placement.
    pub wall_id: Option<Uuid>,
    /// JSON definition of the exposed face (doors, drawers, panels).
    pub face_definition: Value,
    /// JSON definition of the interior (shelves, hardware, accessories).
    pub interior_definition: Value,
    /// Per-product material overrides.
    pub material_overrides: Option<Value>,
    /// Per-product construction overrides.
    pub construction_overrides: Option<Value>,
    /// Source library entry this product was instantiated from.
    pub library_entry_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a new product.
#[derive(Debug, Deserialize)]
pub struct CreateProduct {
    pub room_id: Uuid,
    pub name: String,
    pub product_type: ProductType,
    pub cabinet_style: CabinetStyle,
    pub width: f64,
    pub height: f64,
    pub depth: f64,
    #[serde(default)]
    pub position_x: f64,
    #[serde(default)]
    pub position_y: f64,
    #[serde(default)]
    pub position_z: f64,
    #[serde(default)]
    pub rotation: f64,
    pub wall_id: Option<Uuid>,
    pub face_definition: Option<Value>,
    pub interior_definition: Option<Value>,
    pub material_overrides: Option<Value>,
    pub construction_overrides: Option<Value>,
    pub library_entry_id: Option<Uuid>,
}

/// DTO for updating an existing product.
#[derive(Debug, Deserialize)]
pub struct UpdateProduct {
    pub name: Option<String>,
    pub product_type: Option<ProductType>,
    pub cabinet_style: Option<CabinetStyle>,
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub depth: Option<f64>,
    pub position_x: Option<f64>,
    pub position_y: Option<f64>,
    pub position_z: Option<f64>,
    pub rotation: Option<f64>,
    pub wall_id: Option<Uuid>,
    pub face_definition: Option<Value>,
    pub interior_definition: Option<Value>,
    pub material_overrides: Option<Value>,
    pub construction_overrides: Option<Value>,
    pub library_entry_id: Option<Uuid>,
}
