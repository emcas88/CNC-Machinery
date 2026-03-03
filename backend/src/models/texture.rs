use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub use super::texture_group::{CreateTextureGroup, TextureGroup, UpdateTextureGroup};

/// Surface sheen level of the texture/finish.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "texture_sheen", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum TextureSheen {
    None,
    Flat,
    Satin,
    SemiGloss,
    HighGloss,
    Glass,
}

impl std::fmt::Display for TextureSheen {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::None => write!(f, "none"),
            Self::Flat => write!(f, "flat"),
            Self::Satin => write!(f, "satin"),
            Self::SemiGloss => write!(f, "semi_gloss"),
            Self::HighGloss => write!(f, "high_gloss"),
            Self::Glass => write!(f, "glass"),
        }
    }
}

/// Grain orientation for visual rendering alignment.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "texture_grain_orientation", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum GrainOrientation {
    Horizontal,
    Vertical,
    None,
}

impl std::fmt::Display for GrainOrientation {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Horizontal => write!(f, "horizontal"),
            Self::Vertical => write!(f, "vertical"),
            Self::None => write!(f, "none"),
        }
    }
}

/// A visual texture/finish definition used for rendering.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Texture {
    pub id: Uuid,
    pub name: String,
    pub abbreviation: String,
    /// URL to the texture image asset.
    pub image_url: Option<String>,
    pub sheen: TextureSheen,
    pub grain_orientation: GrainOrientation,
    /// Alpha transparency 0.0 (opaque) to 1.0 (fully transparent).
    pub transparency: f64,
    /// Metallic reflection factor 0.0 to 1.0.
    pub metallicness: f64,
    /// Physical width of one texture tile in mm.
    pub visual_width: f64,
    /// Physical height of one texture tile in mm.
    pub visual_height: f64,
    /// Rotation offset in degrees for texture mapping.
    pub rotation_angle: f64,
    pub texture_group_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a new texture.
#[derive(Debug, Deserialize)]
pub struct CreateTexture {
    pub name: String,
    pub abbreviation: String,
    pub image_url: Option<String>,
    pub sheen: TextureSheen,
    pub grain_orientation: GrainOrientation,
    #[serde(default)]
    pub transparency: f64,
    #[serde(default)]
    pub metallicness: f64,
    pub visual_width: f64,
    pub visual_height: f64,
    #[serde(default)]
    pub rotation_angle: f64,
    pub texture_group_id: Option<Uuid>,
}

pub type Sheen = TextureSheen;

/// DTO for updating an existing texture.
#[derive(Debug, Deserialize)]
pub struct UpdateTexture {
    pub name: Option<String>,
    pub abbreviation: Option<String>,
    pub image_url: Option<String>,
    pub sheen: Option<TextureSheen>,
    pub grain_orientation: Option<GrainOrientation>,
    pub transparency: Option<f64>,
    pub metallicness: Option<f64>,
    pub visual_width: Option<f64>,
    pub visual_height: Option<f64>,
    pub rotation_angle: Option<f64>,
    pub texture_group_id: Option<Uuid>,
}
