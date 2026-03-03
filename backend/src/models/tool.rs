use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// CNC cutting tool type.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "tool_type", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum ToolType {
    CompressionCutter,
    DownShear,
    UpCut,
    Dovetail,
    ProfileBit,
    DrillBit,
}

impl std::fmt::Display for ToolType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::CompressionCutter => write!(f, "compression_cutter"),
            Self::DownShear => write!(f, "down_shear"),
            Self::UpCut => write!(f, "up_cut"),
            Self::Dovetail => write!(f, "dovetail"),
            Self::ProfileBit => write!(f, "profile_bit"),
            Self::DrillBit => write!(f, "drill_bit"),
        }
    }
}

/// A CNC cutting or drilling tool with feed/speed parameters.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Tool {
    pub id: Uuid,
    pub name: String,
    /// Cutting diameter in mm.
    pub diameter: f64,
    pub tool_type: ToolType,
    /// Spindle speed in RPM.
    pub rpm: i32,
    /// XY feed rate in mm/min.
    pub feed_rate: f64,
    /// Z plunge rate in mm/min.
    pub plunge_rate: f64,
    /// Maximum depth per pass in mm.
    pub max_depth_per_pass: f64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// DTO for creating a tool.
#[derive(Debug, Deserialize)]
pub struct CreateTool {
    pub name: String,
    pub diameter: f64,
    pub tool_type: ToolType,
    pub rpm: i32,
    pub feed_rate: f64,
    pub plunge_rate: f64,
    pub max_depth_per_pass: f64,
}

/// DTO for updating a tool.
#[derive(Debug, Deserialize)]
pub struct UpdateTool {
    pub name: Option<String>,
    pub diameter: Option<f64>,
    pub tool_type: Option<ToolType>,
    pub rpm: Option<i32>,
    pub feed_rate: Option<f64>,
    pub plunge_rate: Option<f64>,
    pub max_depth_per_pass: Option<f64>,
}
