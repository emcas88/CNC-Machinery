use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/// Minimum door width in millimetres.
const MIN_DOOR_WIDTH: f64 = 150.0;
/// Maximum door width in millimetres.
const MAX_DOOR_WIDTH: f64 = 1200.0;
/// Minimum door height in millimetres.
const MIN_DOOR_HEIGHT: f64 = 200.0;
/// Maximum door height in millimetres.
const MAX_DOOR_HEIGHT: f64 = 2400.0;
/// Minimum door thickness in millimetres.
const MIN_THICKNESS: f64 = 12.0;
/// Maximum door thickness in millimetres.
const MAX_THICKNESS: f64 = 50.0;

/// Minimum rail/stile width for framed doors (mm).
const MIN_RAIL_WIDTH: f64 = 45.0;
/// Maximum rail/stile width as a proportion of shorter door dimension.
const MAX_RAIL_PROPORTION: f64 = 0.35;

/// Standard cope-and-stick tongue depth (mm).
const COPE_DEPTH: f64 = 6.35;
/// Standard groove width for panel (mm).
const GROOVE_WIDTH: f64 = 5.0;
/// Standard groove depth (mm).
const GROOVE_DEPTH: f64 = 10.0;
/// Panel raising bevel angle (degrees).
const PANEL_RAISE_ANGLE: f64 = 7.0;
/// Panel raising depth (mm).
const PANEL_RAISE_DEPTH: f64 = 12.0;
/// Edge banding thickness (mm).
const EDGE_BAND_THICKNESS: f64 = 2.0;
/// Hinge cup diameter (mm).
const HINGE_CUP_DIAMETER: f64 = 35.0;
/// Hinge cup depth (mm).
const HINGE_CUP_DEPTH: f64 = 13.0;
/// Standard hinge inset from top/bottom (mm).
const HINGE_INSET: f64 = 100.0;

// ─────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────

/// Supported door construction styles.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DoorStyle {
    /// Five-piece door with flat recessed panel and square profiled frame.
    Shaker,
    /// Five-piece door with bevelled/raised solid panel.
    RaisedPanel,
    /// Single flat slab door with optional edge banding.
    Slab,
    /// Five-piece door with cathedral (arch) profile on upper rail.
    Cathedral,
    /// Five-piece door with full arched top rail and matching panel.
    Arched,
}

/// Role of a part within the door assembly.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DoorPartType {
    /// Vertical frame member.
    Stile,
    /// Horizontal frame member.
    Rail,
    /// Centre infill panel.
    Panel,
}

/// Type of machining operation applied to a door part.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DoorOpType {
    /// Stick (groove) profile on inner edge of rail/stile.
    StickProfile,
    /// Cope (tenon) cut on rail ends for cope-and-stick joinery.
    CopeProfile,
    /// Panel raising bevel on panel perimeter.
    PanelRaise,
    /// Edge banding application.
    EdgeBand,
    /// Hinge cup boring (blind pocket).
    HingeBore,
    /// Full perimeter profile route.
    PerimeterProfile,
    /// Arc cut for cathedral/arched rail.
    ArcCut,
    /// Dado/groove slot.
    DadoGroove,
}

// ─────────────────────────────────────────────
// Structs
// ─────────────────────────────────────────────

/// Three-dimensional size specification (all in millimetres).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Dimensions {
    pub width: f64,
    pub height: f64,
    pub thickness: f64,
}

/// A single CNC operation attached to a door part.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoorOperation {
    pub id: Uuid,
    pub op_type: DoorOpType,
    /// Tool UUID (None = operator selects from database).
    pub tool_id: Option<Uuid>,
    /// Ordered list of (X, Y, Z) coordinate tuples (mm, relative to part origin).
    pub coordinates: Vec<(f64, f64, f64)>,
    /// Cut depth in mm.
    pub depth: f64,
    /// Feed rate in mm/min.
    pub feed_rate: f64,
    /// Spindle speed in RPM.
    pub spindle_rpm: u32,
    /// Human-readable description.
    pub description: String,
}

/// A single manufactured part produced for the door.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoorPart {
    pub id: Uuid,
    pub part_type: DoorPartType,
    pub name: String,
    pub dimensions: Dimensions,
    pub material_id: Uuid,
    pub operations: Vec<DoorOperation>,
    /// Edge banding required: top, bottom, left, right.
    pub edge_band: [bool; 4],
}

/// Fully-described door assembly returned by the generator.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DoorProfile {
    pub id: Uuid,
    pub style: DoorStyle,
    pub material_id: Uuid,
    pub overall_dimensions: Dimensions,
    pub parts: Vec<DoorPart>,
    /// All distinct machining operations across the entire door, ordered for
    /// efficient CNC execution (grouped by tool, then by part).
    pub operations: Vec<DoorOperation>,
    /// Cut list suitable for sheet goods optimisation.
    pub cut_list: Vec<CutListEntry>,
}

/// One line in the cut list.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CutListEntry {
    pub part_name: String,
    pub quantity: u32,
    pub length: f64,
    pub width: f64,
    pub thickness: f64,
    pub material_id: Uuid,
    pub notes: String,
}

/// Validated dimension result.
#[derive(Debug, Clone, PartialEq)]
pub enum ValidationResult {
    Ok,
    Err(Vec<String>),
}

impl ValidationResult {
    pub fn is_ok(&self) -> bool {
        matches!(self, ValidationResult::Ok)
    }
    pub fn errors(&self) -> &[String] {
        match self {
            ValidationResult::Ok => &[],
            ValidationResult::Err(e) => e,
        }
    }
}

// ─────────────────────────────────────────────
// Generator
// ─────────────────────────────────────────────

/// Generates door profile assemblies with full machining operation trees.
pub struct DoorProfileGenerator;

impl DoorProfileGenerator {
    pub fn new() -> Self {
        Self
    }

    // ── Public API ──────────────────────────────────────────────────────────

    /// Generate a complete door profile for the given dimensions and style.
    ///
    /// Returns `Err` if dimensions fail validation.
    pub fn generate_mdf_door(
        &self,
        width: f64,
        height: f64,
        thickness: f64,
        style: DoorStyle,
        material_id: Uuid,
    ) -> Result<DoorProfile, Vec<String>> {
        let validation = self.validate_dimensions(width, height, thickness);
        if !validation.is_ok() {
            return Err(validation.errors().to_vec());
        }

        let parts = match &style {
            DoorStyle::Shaker => self.generate_shaker_door(width, height, thickness, material_id),
            DoorStyle::RaisedPanel => {
                self.generate_raised_panel_door(width, height, thickness, material_id)
            }
            DoorStyle::Slab => self.generate_slab_door(width, height, thickness, material_id),
            DoorStyle::Cathedral => {
                self.generate_cathedral_door(width, height, thickness, material_id)
            }
            DoorStyle::Arched => {
                self.generate_arched_door(width, height, thickness, material_id)
            }
        };

        let cut_list = Self::build_cut_list(&parts);
        let operations = Self::flatten_operations(&parts);

        Ok(DoorProfile {
            id: Uuid::new_v4(),
            style,
            material_id,
            overall_dimensions: Dimensions {
                width,
                height,
                thickness,
            },
            parts,
            operations,
            cut_list,
        })
    }

    /// Generate an ordered toolpath from an existing `DoorProfile`.
    ///
    /// Operations are sorted: HingeBore -> DadoGroove/StickProfile ->
    /// CopeProfile -> PanelRaise -> EdgeBand -> PerimeterProfile -> ArcCut.
    pub fn calculate_toolpath(&self, profile: &DoorProfile) -> Vec<DoorOperation> {
        let mut ops: Vec<DoorOperation> = profile.operations.clone();
        ops.sort_by_key(|op| toolpath_order(&op.op_type));
        // Within the same operation type, sort by Y coordinate of first move for
        // a consistent top-to-bottom machining order.
        ops.sort_by(|a, b| {
            let ord_a = toolpath_order(&a.op_type);
            let ord_b = toolpath_order(&b.op_type);
            ord_a.cmp(&ord_b).then_with(|| {
                let ya = a.coordinates.first().map_or(0.0, |c| c.1);
                let yb = b.coordinates.first().map_or(0.0, |c| c.1);
                ya.partial_cmp(&yb).unwrap_or(std::cmp::Ordering::Equal)
            })
        });
        ops
    }

    // ── Door style generators ────────────────────────────────────────────────

    /// Build a Shaker-style door: 2 stiles + 2 rails + 1 flat panel,
    /// cope-and-stick joinery, flat recessed panel.
    pub fn generate_shaker_door(
        &self,
        width: f64,
        height: f64,
        thickness: f64,
        material_id: Uuid,
    ) -> Vec<DoorPart> {
        let rail_w = Self::rail_width(width, height);
        let stile_w = Self::stile_width(width, height);

        // Stile dimensions: full height, stile_w wide
        let stile_dims = Dimensions {
            width: stile_w,
            height,
            thickness,
        };
        // Rail dimensions: spans between stiles
        let rail_length = width - 2.0 * stile_w;
        let rail_dims = Dimensions {
            width: rail_length,
            height: rail_w,
            thickness,
        };
        // Panel sits in grooves; sized to fit the groove pocket
        let panel_w = width - 2.0 * stile_w + 2.0 * GROOVE_DEPTH - 3.0;
        let panel_h = height - 2.0 * rail_w + 2.0 * GROOVE_DEPTH - 3.0;
        let panel_thickness = thickness - 6.0; // recessed
        let panel_dims = Dimensions {
            width: panel_w,
            height: panel_h,
            thickness: panel_thickness,
        };

        let mut parts = Vec::new();

        // Left stile
        let mut left_stile = Self::make_part("Left Stile", DoorPartType::Stile, stile_dims.clone(), material_id);
        left_stile.operations.push(stick_profile_op(stile_w, height, thickness, true));
        left_stile.operations.push(hinge_bore_op(stile_w, height, thickness, true));
        parts.push(left_stile);

        // Right stile
        let mut right_stile = Self::make_part("Right Stile", DoorPartType::Stile, stile_dims, material_id);
        right_stile.operations.push(stick_profile_op(stile_w, height, thickness, true));
        parts.push(right_stile);

        // Top rail
        let mut top_rail = Self::make_part("Top Rail", DoorPartType::Rail, rail_dims.clone(), material_id);
        top_rail.operations.push(stick_profile_op(rail_length, rail_w, thickness, false));
        top_rail.operations.push(cope_op(rail_length, rail_w, thickness));
        parts.push(top_rail);

        // Bottom rail
        let mut bottom_rail = Self::make_part("Bottom Rail", DoorPartType::Rail, rail_dims, material_id);
        bottom_rail.operations.push(stick_profile_op(rail_length, rail_w, thickness, false));
        bottom_rail.operations.push(cope_op(rail_length, rail_w, thickness));
        parts.push(bottom_rail);

        // Panel
        let mut panel = Self::make_part("Centre Panel", DoorPartType::Panel, panel_dims, material_id);
        panel.operations.push(perimeter_profile_op(panel_w, panel_h, panel_thickness, 2.0));
        parts.push(panel);

        parts
    }

    /// Build a Raised Panel door: like Shaker but panel has a bevelled raise.
    pub fn generate_raised_panel_door(
        &self,
        width: f64,
        height: f64,
        thickness: f64,
        material_id: Uuid,
    ) -> Vec<DoorPart> {
        let rail_w = Self::rail_width(width, height);
        let stile_w = Self::stile_width(width, height);
        let rail_length = width - 2.0 * stile_w;

        let stile_dims = Dimensions { width: stile_w, height, thickness };
        let rail_dims = Dimensions { width: rail_length, height: rail_w, thickness };
        let panel_w = width - 2.0 * stile_w + 2.0 * GROOVE_DEPTH - 3.0;
        let panel_h = height - 2.0 * rail_w + 2.0 * GROOVE_DEPTH - 3.0;
        let panel_thickness = thickness; // full thickness; raise is cut on face
        let panel_dims = Dimensions { width: panel_w, height: panel_h, thickness: panel_thickness };

        let mut parts = Vec::new();

        let mut left_stile = Self::make_part("Left Stile", DoorPartType::Stile, stile_dims.clone(), material_id);
        left_stile.operations.push(stick_profile_op(stile_w, height, thickness, true));
        left_stile.operations.push(hinge_bore_op(stile_w, height, thickness, true));
        parts.push(left_stile);

        let mut right_stile = Self::make_part("Right Stile", DoorPartType::Stile, stile_dims, material_id);
        right_stile.operations.push(stick_profile_op(stile_w, height, thickness, true));
        parts.push(right_stile);

        let mut top_rail = Self::make_part("Top Rail", DoorPartType::Rail, rail_dims.clone(), material_id);
        top_rail.operations.push(stick_profile_op(rail_length, rail_w, thickness, false));
        top_rail.operations.push(cope_op(rail_length, rail_w, thickness));
        parts.push(top_rail);

        let mut bottom_rail = Self::make_part("Bottom Rail", DoorPartType::Rail, rail_dims, material_id);
        bottom_rail.operations.push(stick_profile_op(rail_length, rail_w, thickness, false));
        bottom_rail.operations.push(cope_op(rail_length, rail_w, thickness));
        parts.push(bottom_rail);

        let mut panel = Self::make_part("Raised Panel", DoorPartType::Panel, panel_dims, material_id);
        // Panel raising is the key difference from Shaker
        panel.operations.push(panel_raise_op(panel_w, panel_h, panel_thickness));
        parts.push(panel);

        parts
    }

    /// Build a Slab door: single panel, optional perimeter edge banding.
    pub fn generate_slab_door(
        &self,
        width: f64,
        height: f64,
        thickness: f64,
        material_id: Uuid,
    ) -> Vec<DoorPart> {
        let dims = Dimensions { width, height, thickness };
        let mut slab = Self::make_part("Slab Door", DoorPartType::Panel, dims, material_id);
        // All four edges get edge banding
        slab.edge_band = [true, true, true, true];
        slab.operations.push(edge_band_op(width, height, thickness));
        slab.operations.push(hinge_bore_op(width, height, thickness, false));
        slab.operations.push(perimeter_profile_op(width, height, thickness, 3.0));
        vec![slab]
    }

    /// Build a Cathedral door: Shaker frame with an arched upper rail.
    pub fn generate_cathedral_door(
        &self,
        width: f64,
        height: f64,
        thickness: f64,
        material_id: Uuid,
    ) -> Vec<DoorPart> {
        let rail_w = Self::rail_width(width, height);
        let stile_w = Self::stile_width(width, height);
        let rail_length = width - 2.0 * stile_w;

        let stile_dims = Dimensions { width: stile_w, height, thickness };
        // Cathedral top rail is taller to accommodate the arch
        let arch_height = (rail_length / 2.0).min(rail_w * 1.5);
        let top_rail_h = rail_w + arch_height;
        let top_rail_dims = Dimensions { width: rail_length, height: top_rail_h, thickness };
        let bottom_rail_dims = Dimensions { width: rail_length, height: rail_w, thickness };

        let panel_w = width - 2.0 * stile_w + 2.0 * GROOVE_DEPTH - 3.0;
        let panel_h = height - rail_w - top_rail_h + 2.0 * GROOVE_DEPTH - 3.0;
        let panel_thickness = thickness - 6.0;
        let panel_dims = Dimensions { width: panel_w, height: panel_h, thickness: panel_thickness };

        let mut parts = Vec::new();

        let mut left_stile = Self::make_part("Left Stile", DoorPartType::Stile, stile_dims.clone(), material_id);
        left_stile.operations.push(stick_profile_op(stile_w, height, thickness, true));
        left_stile.operations.push(hinge_bore_op(stile_w, height, thickness, true));
        parts.push(left_stile);

        let mut right_stile = Self::make_part("Right Stile", DoorPartType::Stile, stile_dims, material_id);
        right_stile.operations.push(stick_profile_op(stile_w, height, thickness, true));
        parts.push(right_stile);

        // Top rail has an arc cut
        let mut top_rail = Self::make_part("Top Rail (Cathedral)", DoorPartType::Rail, top_rail_dims, material_id);
        top_rail.operations.push(stick_profile_op(rail_length, top_rail_h, thickness, false));
        top_rail.operations.push(cope_op(rail_length, top_rail_h, thickness));
        top_rail.operations.push(arc_cut_op(rail_length, top_rail_h, thickness, arch_height, false));
        parts.push(top_rail);

        let mut bottom_rail = Self::make_part("Bottom Rail", DoorPartType::Rail, bottom_rail_dims, material_id);
        bottom_rail.operations.push(stick_profile_op(rail_length, rail_w, thickness, false));
        bottom_rail.operations.push(cope_op(rail_length, rail_w, thickness));
        parts.push(bottom_rail);

        let mut panel = Self::make_part("Cathedral Panel", DoorPartType::Panel, panel_dims.clone(), material_id);
        panel.operations.push(arc_cut_op(panel_dims.width, panel_dims.height, panel_thickness, arch_height, true));
        panel.operations.push(perimeter_profile_op(panel_dims.width, panel_dims.height, panel_thickness, 2.0));
        parts.push(panel);

        parts
    }

    /// Build an Arched door: full symmetrical arch on top rail and panel.
    pub fn generate_arched_door(
        &self,
        width: f64,
        height: f64,
        thickness: f64,
        material_id: Uuid,
    ) -> Vec<DoorPart> {
        let rail_w = Self::rail_width(width, height);
        let stile_w = Self::stile_width(width, height);
        let rail_length = width - 2.0 * stile_w;

        // Full semicircle arch: radius = rail_length / 2
        let arch_height = rail_length / 2.0;
        let top_rail_h = rail_w + arch_height;
        let stile_dims = Dimensions { width: stile_w, height, thickness };
        let top_rail_dims = Dimensions { width: rail_length, height: top_rail_h, thickness };
        let bottom_rail_dims = Dimensions { width: rail_length, height: rail_w, thickness };

        let panel_w = width - 2.0 * stile_w + 2.0 * GROOVE_DEPTH - 3.0;
        let panel_h = height - rail_w - top_rail_h + 2.0 * GROOVE_DEPTH - 3.0;
        let panel_thickness = thickness - 6.0;
        let panel_dims = Dimensions { width: panel_w, height: panel_h, thickness: panel_thickness };

        let mut parts = Vec::new();

        let mut left_stile = Self::make_part("Left Stile", DoorPartType::Stile, stile_dims.clone(), material_id);
        left_stile.operations.push(stick_profile_op(stile_w, height, thickness, true));
        left_stile.operations.push(hinge_bore_op(stile_w, height, thickness, true));
        parts.push(left_stile);

        let mut right_stile = Self::make_part("Right Stile", DoorPartType::Stile, stile_dims, material_id);
        right_stile.operations.push(stick_profile_op(stile_w, height, thickness, true));
        parts.push(right_stile);

        let mut top_rail = Self::make_part("Top Rail (Arch)", DoorPartType::Rail, top_rail_dims, material_id);
        top_rail.operations.push(stick_profile_op(rail_length, top_rail_h, thickness, false));
        top_rail.operations.push(cope_op(rail_length, top_rail_h, thickness));
        top_rail.operations.push(arc_cut_op(rail_length, top_rail_h, thickness, arch_height, true));
        parts.push(top_rail);

        let mut bottom_rail = Self::make_part("Bottom Rail", DoorPartType::Rail, bottom_rail_dims, material_id);
        bottom_rail.operations.push(stick_profile_op(rail_length, rail_w, thickness, false));
        bottom_rail.operations.push(cope_op(rail_length, rail_w, thickness));
        parts.push(bottom_rail);

        let mut panel = Self::make_part("Arched Panel", DoorPartType::Panel, panel_dims.clone(), material_id);
        panel.operations.push(arc_cut_op(panel_dims.width, panel_dims.height, panel_thickness, arch_height, true));
        panel.operations.push(perimeter_profile_op(panel_dims.width, panel_dims.height, panel_thickness, 2.0));
        parts.push(panel);

        parts
    }

    // ── Validation ───────────────────────────────────────────────────────────

    /// Validate door dimensions against physical and manufacturing constraints.
    pub fn validate_dimensions(&self, width: f64, height: f64, thickness: f64) -> ValidationResult {
        let mut errors = Vec::new();

        if width <= 0.0 {
            errors.push("Width must be greater than zero".into());
        } else if width < MIN_DOOR_WIDTH {
            errors.push(format!("Width {width:.1}mm is below minimum {MIN_DOOR_WIDTH}mm"));
        } else if width > MAX_DOOR_WIDTH {
            errors.push(format!("Width {width:.1}mm exceeds maximum {MAX_DOOR_WIDTH}mm"));
        }

        if height <= 0.0 {
            errors.push("Height must be greater than zero".into());
        } else if height < MIN_DOOR_HEIGHT {
            errors.push(format!("Height {height:.1}mm is below minimum {MIN_DOOR_HEIGHT}mm"));
        } else if height > MAX_DOOR_HEIGHT {
            errors.push(format!("Height {height:.1}mm exceeds maximum {MAX_DOOR_HEIGHT}mm"));
        }

        if thickness <= 0.0 {
            errors.push("Thickness must be greater than zero".into());
        } else if thickness < MIN_THICKNESS {
            errors.push(format!("Thickness {thickness:.1}mm is below minimum {MIN_THICKNESS}mm"));
        } else if thickness > MAX_THICKNESS {
            errors.push(format!("Thickness {thickness:.1}mm exceeds maximum {MAX_THICKNESS}mm"));
        }

        // Rail/stile proportion check (only meaningful when all dimensions > 0)
        if width > 0.0 && height > 0.0 {
            let shorter = width.min(height);
            let max_rail = shorter * MAX_RAIL_PROPORTION;
            if width > 0.0 && height > 0.0 && (MIN_RAIL_WIDTH > max_rail) {
                // Door is too narrow/short for a framed door; warn but don't block
                errors.push(format!(
                    "Door dimensions {width:.0}x{height:.0}mm are too small for framed construction; minimum rail width {MIN_RAIL_WIDTH}mm would exceed {MAX_RAIL_PROPORTION:.0}% of the shorter dimension"
                ));
            }
        }

        if errors.is_empty() {
            ValidationResult::Ok
        } else {
            ValidationResult::Err(errors)
        }
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    fn make_part(name: &str, part_type: DoorPartType, dimensions: Dimensions, material_id: Uuid) -> DoorPart {
        DoorPart {
            id: Uuid::new_v4(),
            part_type,
            name: name.to_string(),
            dimensions,
            material_id,
            operations: Vec::new(),
            edge_band: [false; 4],
        }
    }

    /// Calculate the standard rail width (top and bottom) for framed doors.
    fn rail_width(width: f64, height: f64) -> f64 {
        let shorter = width.min(height);
        let proportional = shorter * 0.12;
        proportional.max(MIN_RAIL_WIDTH).min(120.0)
    }

    /// Calculate stile width for framed doors.
    fn stile_width(width: f64, height: f64) -> f64 {
        Self::rail_width(width, height) // symmetric for standard doors
    }

    /// Flatten all per-part operations into a single ordered list.
    fn flatten_operations(parts: &[DoorPart]) -> Vec<DoorOperation> {
        parts.iter().flat_map(|p| p.operations.clone()).collect()
    }

    /// Build a cut list from assembled parts.
    fn build_cut_list(parts: &[DoorPart]) -> Vec<CutListEntry> {
        parts
            .iter()
            .map(|p| CutListEntry {
                part_name: p.name.clone(),
                quantity: 1,
                length: p.dimensions.height,
                width: p.dimensions.width,
                thickness: p.dimensions.thickness,
                material_id: p.material_id,
                notes: format!("{:?}", p.part_type),
            })
            .collect()
    }
}

impl Default for DoorProfileGenerator {
    fn default() -> Self {
        Self::new()
    }
}

// ─────────────────────────────────────────────
// Operation factory functions
// ─────────────────────────────────────────────

/// Toolpath execution order -- lower = earlier.
fn toolpath_order(op: &DoorOpType) -> u8 {
    match op {
        DoorOpType::HingeBore => 0,
        DoorOpType::DadoGroove => 1,
        DoorOpType::StickProfile => 2,
        DoorOpType::CopeProfile => 3,
        DoorOpType::PanelRaise => 4,
        DoorOpType::EdgeBand => 5,
        DoorOpType::PerimeterProfile => 6,
        DoorOpType::ArcCut => 7,
    }
}

/// Stick (groove) profile on the inner face edge of a stile or rail.
/// `is_stile`: if true, the groove runs along the height; otherwise along the width.
fn stick_profile_op(part_w: f64, part_h: f64, thickness: f64, is_stile: bool) -> DoorOperation {
    let half_t = thickness / 2.0;
    let groove_z_start = half_t - GROOVE_WIDTH / 2.0;
    let coords = if is_stile {
        // Groove runs full height on the inner (right) edge
        vec![
            (part_w, 0.0, groove_z_start),
            (part_w, part_h, groove_z_start),
        ]
    } else {
        // Groove runs full width on the inner (bottom) edge
        vec![
            (0.0, part_h, groove_z_start),
            (part_w, part_h, groove_z_start),
        ]
    };
    DoorOperation {
        id: Uuid::new_v4(),
        op_type: DoorOpType::StickProfile,
        tool_id: None,
        coordinates: coords,
        depth: GROOVE_DEPTH,
        feed_rate: 4000.0,
        spindle_rpm: 18000,
        description: "Cope-and-stick groove (stick profile)".into(),
    }
}

/// Cope (tenon) cut on both ends of a rail.
fn cope_op(rail_w: f64, rail_h: f64, thickness: f64) -> DoorOperation {
    let cope_z = thickness / 2.0 - GROOVE_WIDTH / 2.0;
    DoorOperation {
        id: Uuid::new_v4(),
        op_type: DoorOpType::CopeProfile,
        tool_id: None,
        coordinates: vec![
            // Left end
            (0.0, 0.0, cope_z),
            (COPE_DEPTH, rail_h, cope_z),
            // Right end
            (rail_w - COPE_DEPTH, 0.0, cope_z),
            (rail_w, rail_h, cope_z),
        ],
        depth: COPE_DEPTH,
        feed_rate: 3500.0,
        spindle_rpm: 18000,
        description: "Cope cut on rail ends for cope-and-stick joinery".into(),
    }
}

/// Panel raising bevel on all four panel edges.
fn panel_raise_op(panel_w: f64, panel_h: f64, thickness: f64) -> DoorOperation {
    let angle_rad = PANEL_RAISE_ANGLE.to_radians();
    let bevel_w = PANEL_RAISE_DEPTH / angle_rad.tan();
    DoorOperation {
        id: Uuid::new_v4(),
        op_type: DoorOpType::PanelRaise,
        tool_id: None,
        coordinates: vec![
            // Perimeter pass: bottom edge
            (bevel_w, 0.0, 0.0),
            (panel_w - bevel_w, 0.0, PANEL_RAISE_DEPTH),
            // Right edge
            (panel_w, bevel_w, 0.0),
            (panel_w, panel_h - bevel_w, PANEL_RAISE_DEPTH),
            // Top edge
            (panel_w - bevel_w, panel_h, 0.0),
            (bevel_w, panel_h, PANEL_RAISE_DEPTH),
            // Left edge
            (0.0, panel_h - bevel_w, 0.0),
            (0.0, bevel_w, PANEL_RAISE_DEPTH),
        ],
        depth: PANEL_RAISE_DEPTH,
        feed_rate: 3000.0,
        spindle_rpm: 15000,
        description: format!(
            "Panel raising bevel at {PANEL_RAISE_ANGLE} degrees on all four edges"
        ),
    }
}

/// Perimeter edge-banding operation (4 passes).
fn edge_band_op(width: f64, height: f64, _thickness: f64) -> DoorOperation {
    DoorOperation {
        id: Uuid::new_v4(),
        op_type: DoorOpType::EdgeBand,
        tool_id: None,
        coordinates: vec![
            (0.0, 0.0, 0.0),
            (width, 0.0, 0.0),      // bottom edge
            (width, height, 0.0),   // right edge
            (0.0, height, 0.0),     // top edge
            (0.0, 0.0, 0.0),        // left edge / close loop
        ],
        depth: EDGE_BAND_THICKNESS,
        feed_rate: 5000.0,
        spindle_rpm: 0, // applied by edge bander, not spindle
        description: "Edge banding -- all four edges".into(),
    }
}

/// Hinge boring operation: two 35 mm blind pockets on the hinge side.
/// `on_stile`: if true the positions are relative to a stile part; otherwise
/// they are relative to the full slab.
fn hinge_bore_op(part_w: f64, part_h: f64, _thickness: f64, on_stile: bool) -> DoorOperation {
    let cx = if on_stile {
        HINGE_CUP_DIAMETER / 2.0 + 4.0 // 4 mm from edge of stile
    } else {
        part_w - HINGE_CUP_DIAMETER / 2.0 - 4.0
    };
    DoorOperation {
        id: Uuid::new_v4(),
        op_type: DoorOpType::HingeBore,
        tool_id: None,
        coordinates: vec![
            // Top hinge cup centre
            (cx, part_h - HINGE_INSET, 0.0),
            // Bottom hinge cup centre
            (cx, HINGE_INSET, 0.0),
        ],
        depth: HINGE_CUP_DEPTH,
        feed_rate: 1200.0,
        spindle_rpm: 12000,
        description: format!(
            "Hinge cup boring: diameter {HINGE_CUP_DIAMETER}mm x {HINGE_CUP_DEPTH}mm deep"
        ),
    }
}

/// Full perimeter profile route (e.g. roundover, chamfer).
fn perimeter_profile_op(width: f64, height: f64, _thickness: f64, radius: f64) -> DoorOperation {
    DoorOperation {
        id: Uuid::new_v4(),
        op_type: DoorOpType::PerimeterProfile,
        tool_id: None,
        coordinates: vec![
            (radius, 0.0, 0.0),
            (width - radius, 0.0, 0.0),
            (width, radius, 0.0),
            (width, height - radius, 0.0),
            (width - radius, height, 0.0),
            (radius, height, 0.0),
            (0.0, height - radius, 0.0),
            (0.0, radius, 0.0),
            (radius, 0.0, 0.0), // close
        ],
        depth: radius,
        feed_rate: 4500.0,
        spindle_rpm: 18000,
        description: format!("Perimeter profile route, r={radius}mm"),
    }
}

/// Arc cut for cathedral/arched rail or panel.
/// `full_arch`: true = full semicircle (arched), false = single-apex arc (cathedral).
fn arc_cut_op(width: f64, _height: f64, thickness: f64, arch_height: f64, full_arch: bool) -> DoorOperation {
    let cx = width / 2.0;
    // Generate arc points (20-segment approximation)
    let segments = 20usize;
    let (start_angle, end_angle) = if full_arch {
        (std::f64::consts::PI, 0.0f64) // 180 -> 0 degrees semicircle
    } else {
        (std::f64::consts::PI * 0.75, std::f64::consts::PI * 0.25) // shallower arc
    };
    let radius = if full_arch {
        width / 2.0
    } else {
        // Cathedral radius: chord = width, rise = arch_height
        (width * width) / (8.0 * arch_height) + arch_height / 2.0
    };
    let cy = if full_arch { 0.0 } else { -radius + arch_height };

    let mut coords: Vec<(f64, f64, f64)> = (0..=segments)
        .map(|i| {
            let t = i as f64 / segments as f64;
            let angle = start_angle + t * (end_angle - start_angle);
            let x = cx + radius * angle.cos();
            let y = cy + radius * angle.sin();
            (x, y, thickness / 2.0)
        })
        .collect();
    // Ensure start/end are clamped to part edges
    if let Some(first) = coords.first_mut() { first.0 = 0.0; }
    if let Some(last) = coords.last_mut()  { last.0 = width; }

    DoorOperation {
        id: Uuid::new_v4(),
        op_type: DoorOpType::ArcCut,
        tool_id: None,
        coordinates: coords,
        depth: thickness,
        feed_rate: 3000.0,
        spindle_rpm: 18000,
        description: if full_arch {
            "Full semicircle arch cut".into()
        } else {
            "Cathedral (single-apex) arc cut".into()
        },
    }
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── Helpers ──────────────────────────────────────────────────────────────

    fn gen() -> DoorProfileGenerator {
        DoorProfileGenerator::new()
    }

    fn mat() -> Uuid {
        Uuid::new_v4()
    }

    /// Standard 600x900x19 door dimensions -- valid for all styles.
    fn std_dims() -> (f64, f64, f64) {
        (600.0, 900.0, 19.0)
    }

    // ── validate_dimensions ──────────────────────────────────────────────────

    #[test]
    fn test_validate_standard_dimensions_ok() {
        let (w, h, t) = std_dims();
        assert!(gen().validate_dimensions(w, h, t).is_ok());
    }

    #[test]
    fn test_validate_zero_width_errors() {
        let result = gen().validate_dimensions(0.0, 900.0, 19.0);
        assert!(!result.is_ok());
        assert!(result.errors().iter().any(|e| e.contains("Width")));
    }

    #[test]
    fn test_validate_zero_height_errors() {
        let result = gen().validate_dimensions(600.0, 0.0, 19.0);
        assert!(!result.is_ok());
        assert!(result.errors().iter().any(|e| e.contains("Height")));
    }

    #[test]
    fn test_validate_zero_thickness_errors() {
        let result = gen().validate_dimensions(600.0, 900.0, 0.0);
        assert!(!result.is_ok());
        assert!(result.errors().iter().any(|e| e.contains("Thickness")));
    }

    #[test]
    fn test_validate_negative_width_errors() {
        let result = gen().validate_dimensions(-10.0, 900.0, 19.0);
        assert!(!result.is_ok());
    }

    #[test]
    fn test_validate_below_min_width() {
        let result = gen().validate_dimensions(100.0, 900.0, 19.0);
        assert!(!result.is_ok());
        assert!(result.errors().iter().any(|e| e.contains("minimum")));
    }

    #[test]
    fn test_validate_above_max_width() {
        let result = gen().validate_dimensions(1500.0, 900.0, 19.0);
        assert!(!result.is_ok());
    }

    #[test]
    fn test_validate_below_min_height() {
        let result = gen().validate_dimensions(600.0, 100.0, 19.0);
        assert!(!result.is_ok());
    }

    #[test]
    fn test_validate_above_max_height() {
        let result = gen().validate_dimensions(600.0, 3000.0, 19.0);
        assert!(!result.is_ok());
    }

    #[test]
    fn test_validate_below_min_thickness() {
        let result = gen().validate_dimensions(600.0, 900.0, 6.0);
        assert!(!result.is_ok());
    }

    #[test]
    fn test_validate_above_max_thickness() {
        let result = gen().validate_dimensions(600.0, 900.0, 60.0);
        assert!(!result.is_ok());
    }

    #[test]
    fn test_validate_exact_min_width() {
        // Exactly at minimum -- should pass
        let result = gen().validate_dimensions(MIN_DOOR_WIDTH, 900.0, 19.0);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_exact_max_width() {
        let result = gen().validate_dimensions(MAX_DOOR_WIDTH, 900.0, 19.0);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_exact_min_height() {
        let result = gen().validate_dimensions(600.0, MIN_DOOR_HEIGHT, 19.0);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_exact_max_height() {
        let result = gen().validate_dimensions(600.0, MAX_DOOR_HEIGHT, 19.0);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_exact_min_thickness() {
        let result = gen().validate_dimensions(600.0, 900.0, MIN_THICKNESS);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_exact_max_thickness() {
        let result = gen().validate_dimensions(600.0, 900.0, MAX_THICKNESS);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_multiple_errors() {
        let result = gen().validate_dimensions(0.0, 0.0, 0.0);
        assert!(!result.is_ok());
        assert!(result.errors().len() >= 3);
    }

    // ── generate_mdf_door (dispatch) ─────────────────────────────────────────

    #[test]
    fn test_generate_mdf_door_shaker_ok() {
        let (w, h, t) = std_dims();
        let result = gen().generate_mdf_door(w, h, t, DoorStyle::Shaker, mat());
        assert!(result.is_ok());
    }

    #[test]
    fn test_generate_mdf_door_invalid_returns_err() {
        let result = gen().generate_mdf_door(0.0, 0.0, 0.0, DoorStyle::Slab, mat());
        assert!(result.is_err());
    }

    #[test]
    fn test_generate_mdf_door_preserves_dimensions() {
        let (w, h, t) = std_dims();
        let profile = gen().generate_mdf_door(w, h, t, DoorStyle::Slab, mat()).unwrap();
        assert_eq!(profile.overall_dimensions.width, w);
        assert_eq!(profile.overall_dimensions.height, h);
        assert_eq!(profile.overall_dimensions.thickness, t);
    }

    #[test]
    fn test_generate_mdf_door_preserves_material_id() {
        let m = mat();
        let (w, h, t) = std_dims();
        let profile = gen().generate_mdf_door(w, h, t, DoorStyle::Shaker, m).unwrap();
        assert_eq!(profile.material_id, m);
    }

    #[test]
    fn test_generate_mdf_door_has_unique_id() {
        let (w, h, t) = std_dims();
        let p1 = gen().generate_mdf_door(w, h, t, DoorStyle::Slab, mat()).unwrap();
        let p2 = gen().generate_mdf_door(w, h, t, DoorStyle::Slab, mat()).unwrap();
        assert_ne!(p1.id, p2.id);
    }

    // ── Shaker door ─────────────────────────────────────────────────────────

    #[test]
    fn test_shaker_part_count() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_shaker_door(w, h, t, mat());
        assert_eq!(parts.len(), 5, "Shaker door must have 5 parts");
    }

    #[test]
    fn test_shaker_has_two_stiles() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_shaker_door(w, h, t, mat());
        let stile_count = parts.iter().filter(|p| p.part_type == DoorPartType::Stile).count();
        assert_eq!(stile_count, 2);
    }

    #[test]
    fn test_shaker_has_two_rails() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_shaker_door(w, h, t, mat());
        let rail_count = parts.iter().filter(|p| p.part_type == DoorPartType::Rail).count();
        assert_eq!(rail_count, 2);
    }

    #[test]
    fn test_shaker_has_one_panel() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_shaker_door(w, h, t, mat());
        let panel_count = parts.iter().filter(|p| p.part_type == DoorPartType::Panel).count();
        assert_eq!(panel_count, 1);
    }

    #[test]
    fn test_shaker_stile_height_equals_door_height() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_shaker_door(w, h, t, mat());
        for stile in parts.iter().filter(|p| p.part_type == DoorPartType::Stile) {
            assert_eq!(stile.dimensions.height, h);
        }
    }

    #[test]
    fn test_shaker_has_stick_profile_ops() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_shaker_door(w, h, t, mat());
        let all_ops: Vec<_> = parts.iter().flat_map(|p| &p.operations).collect();
        assert!(all_ops.iter().any(|op| op.op_type == DoorOpType::StickProfile));
    }

    #[test]
    fn test_shaker_has_cope_ops() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_shaker_door(w, h, t, mat());
        let all_ops: Vec<_> = parts.iter().flat_map(|p| &p.operations).collect();
        assert!(all_ops.iter().any(|op| op.op_type == DoorOpType::CopeProfile));
    }

    #[test]
    fn test_shaker_has_hinge_bore_ops() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_shaker_door(w, h, t, mat());
        let all_ops: Vec<_> = parts.iter().flat_map(|p| &p.operations).collect();
        assert!(all_ops.iter().any(|op| op.op_type == DoorOpType::HingeBore));
    }

    #[test]
    fn test_shaker_no_panel_raise_ops() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_shaker_door(w, h, t, mat());
        let all_ops: Vec<_> = parts.iter().flat_map(|p| &p.operations).collect();
        assert!(!all_ops.iter().any(|op| op.op_type == DoorOpType::PanelRaise));
    }

    // ── Raised Panel door ─────────────────────────────────────────────────────

    #[test]
    fn test_raised_panel_part_count() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_raised_panel_door(w, h, t, mat());
        assert_eq!(parts.len(), 5);
    }

    #[test]
    fn test_raised_panel_has_panel_raise_op() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_raised_panel_door(w, h, t, mat());
        let all_ops: Vec<_> = parts.iter().flat_map(|p| &p.operations).collect();
        assert!(all_ops.iter().any(|op| op.op_type == DoorOpType::PanelRaise));
    }

    #[test]
    fn test_raised_panel_panel_depth_equals_thickness() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_raised_panel_door(w, h, t, mat());
        let panel = parts.iter().find(|p| p.part_type == DoorPartType::Panel).unwrap();
        assert_eq!(panel.dimensions.thickness, t);
    }

    #[test]
    fn test_raised_panel_has_two_stiles_two_rails() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_raised_panel_door(w, h, t, mat());
        let stiles = parts.iter().filter(|p| p.part_type == DoorPartType::Stile).count();
        let rails = parts.iter().filter(|p| p.part_type == DoorPartType::Rail).count();
        assert_eq!(stiles, 2);
        assert_eq!(rails, 2);
    }

    // ── Slab door ─────────────────────────────────────────────────────────────

    #[test]
    fn test_slab_part_count() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_slab_door(w, h, t, mat());
        assert_eq!(parts.len(), 1, "Slab door has exactly 1 part");
    }

    #[test]
    fn test_slab_part_is_panel_type() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_slab_door(w, h, t, mat());
        assert_eq!(parts[0].part_type, DoorPartType::Panel);
    }

    #[test]
    fn test_slab_full_dimensions() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_slab_door(w, h, t, mat());
        let slab = &parts[0];
        assert_eq!(slab.dimensions.width, w);
        assert_eq!(slab.dimensions.height, h);
        assert_eq!(slab.dimensions.thickness, t);
    }

    #[test]
    fn test_slab_all_edges_banded() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_slab_door(w, h, t, mat());
        assert_eq!(parts[0].edge_band, [true, true, true, true]);
    }

    #[test]
    fn test_slab_has_edge_band_op() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_slab_door(w, h, t, mat());
        assert!(parts[0].operations.iter().any(|op| op.op_type == DoorOpType::EdgeBand));
    }

    #[test]
    fn test_slab_has_hinge_bore() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_slab_door(w, h, t, mat());
        assert!(parts[0].operations.iter().any(|op| op.op_type == DoorOpType::HingeBore));
    }

    // ── Cathedral door ────────────────────────────────────────────────────────

    #[test]
    fn test_cathedral_part_count() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_cathedral_door(w, h, t, mat());
        assert_eq!(parts.len(), 5);
    }

    #[test]
    fn test_cathedral_top_rail_has_arc_cut() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_cathedral_door(w, h, t, mat());
        let top_rail = parts.iter().find(|p| p.name.contains("Cathedral")).unwrap();
        assert!(top_rail.operations.iter().any(|op| op.op_type == DoorOpType::ArcCut));
    }

    #[test]
    fn test_cathedral_bottom_rail_no_arc() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_cathedral_door(w, h, t, mat());
        let bottom_rail = parts.iter().find(|p| p.name == "Bottom Rail").unwrap();
        assert!(!bottom_rail.operations.iter().any(|op| op.op_type == DoorOpType::ArcCut));
    }

    #[test]
    fn test_cathedral_panel_has_arc_cut() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_cathedral_door(w, h, t, mat());
        let panel = parts.iter().find(|p| p.part_type == DoorPartType::Panel).unwrap();
        assert!(panel.operations.iter().any(|op| op.op_type == DoorOpType::ArcCut));
    }

    // ── Arched door ───────────────────────────────────────────────────────────

    #[test]
    fn test_arched_part_count() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_arched_door(w, h, t, mat());
        assert_eq!(parts.len(), 5);
    }

    #[test]
    fn test_arched_top_rail_has_arc_cut() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_arched_door(w, h, t, mat());
        let top_rail = parts.iter().find(|p| p.name.contains("Arch")).unwrap();
        assert!(top_rail.operations.iter().any(|op| op.op_type == DoorOpType::ArcCut));
    }

    #[test]
    fn test_arched_has_stiles_rails_panel() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_arched_door(w, h, t, mat());
        assert_eq!(parts.iter().filter(|p| p.part_type == DoorPartType::Stile).count(), 2);
        assert_eq!(parts.iter().filter(|p| p.part_type == DoorPartType::Rail).count(), 2);
        assert_eq!(parts.iter().filter(|p| p.part_type == DoorPartType::Panel).count(), 1);
    }

    // ── Cut list ──────────────────────────────────────────────────────────────

    #[test]
    fn test_cut_list_shaker_has_5_entries() {
        let (w, h, t) = std_dims();
        let profile = gen().generate_mdf_door(w, h, t, DoorStyle::Shaker, mat()).unwrap();
        assert_eq!(profile.cut_list.len(), 5);
    }

    #[test]
    fn test_cut_list_slab_has_1_entry() {
        let (w, h, t) = std_dims();
        let profile = gen().generate_mdf_door(w, h, t, DoorStyle::Slab, mat()).unwrap();
        assert_eq!(profile.cut_list.len(), 1);
    }

    #[test]
    fn test_cut_list_entries_have_positive_dimensions() {
        let (w, h, t) = std_dims();
        let profile = gen().generate_mdf_door(w, h, t, DoorStyle::Shaker, mat()).unwrap();
        for entry in &profile.cut_list {
            assert!(entry.length > 0.0, "{} has non-positive length", entry.part_name);
            assert!(entry.width > 0.0, "{} has non-positive width", entry.part_name);
            assert!(entry.thickness > 0.0, "{} has non-positive thickness", entry.part_name);
        }
    }

    #[test]
    fn test_cut_list_material_id_propagated() {
        let m = mat();
        let (w, h, t) = std_dims();
        let profile = gen().generate_mdf_door(w, h, t, DoorStyle::Shaker, m).unwrap();
        for entry in &profile.cut_list {
            assert_eq!(entry.material_id, m);
        }
    }

    // ── Toolpath calculation ──────────────────────────────────────────────────

    #[test]
    fn test_calculate_toolpath_returns_operations() {
        let (w, h, t) = std_dims();
        let profile = gen().generate_mdf_door(w, h, t, DoorStyle::Shaker, mat()).unwrap();
        let toolpath = gen().calculate_toolpath(&profile);
        assert!(!toolpath.is_empty());
    }

    #[test]
    fn test_calculate_toolpath_count_matches_total_ops() {
        let (w, h, t) = std_dims();
        let profile = gen().generate_mdf_door(w, h, t, DoorStyle::Shaker, mat()).unwrap();
        let toolpath = gen().calculate_toolpath(&profile);
        assert_eq!(toolpath.len(), profile.operations.len());
    }

    #[test]
    fn test_calculate_toolpath_hinge_bore_comes_first() {
        let (w, h, t) = std_dims();
        let profile = gen().generate_mdf_door(w, h, t, DoorStyle::Shaker, mat()).unwrap();
        let toolpath = gen().calculate_toolpath(&profile);
        if let Some(first) = toolpath.first() {
            assert_eq!(first.op_type, DoorOpType::HingeBore);
        }
    }

    #[test]
    fn test_calculate_toolpath_slab_ordered() {
        let (w, h, t) = std_dims();
        let profile = gen().generate_mdf_door(w, h, t, DoorStyle::Slab, mat()).unwrap();
        let toolpath = gen().calculate_toolpath(&profile);
        // All operations should be present and ordered
        assert!(!toolpath.is_empty());
        let orders: Vec<u8> = toolpath.iter().map(|op| toolpath_order(&op.op_type)).collect();
        let is_sorted = orders.windows(2).all(|w| w[0] <= w[1]);
        assert!(is_sorted, "Toolpath should be sorted by operation order");
    }

    #[test]
    fn test_calculate_toolpath_all_coords_finite() {
        let (w, h, t) = std_dims();
        let profile = gen().generate_mdf_door(w, h, t, DoorStyle::Arched, mat()).unwrap();
        let toolpath = gen().calculate_toolpath(&profile);
        for op in &toolpath {
            for &(x, y, z) in &op.coordinates {
                assert!(x.is_finite(), "x coord not finite in op {:?}", op.op_type);
                assert!(y.is_finite(), "y coord not finite in op {:?}", op.op_type);
                assert!(z.is_finite(), "z coord not finite in op {:?}", op.op_type);
            }
        }
    }

    #[test]
    fn test_calculate_toolpath_positive_feed_rates() {
        let (w, h, t) = std_dims();
        let profile = gen().generate_mdf_door(w, h, t, DoorStyle::RaisedPanel, mat()).unwrap();
        let toolpath = gen().calculate_toolpath(&profile);
        for op in &toolpath {
            // Edge band spindle_rpm can be 0 (applied by machine), but feed should be positive
            assert!(op.feed_rate > 0.0, "feed_rate should be > 0 for op {:?}", op.op_type);
        }
    }

    // ── Edge cases ────────────────────────────────────────────────────────────

    #[test]
    fn test_minimum_valid_slab() {
        let result = gen().generate_mdf_door(MIN_DOOR_WIDTH, MIN_DOOR_HEIGHT, MIN_THICKNESS, DoorStyle::Slab, mat());
        assert!(result.is_ok());
    }

    #[test]
    fn test_maximum_valid_slab() {
        let result = gen().generate_mdf_door(MAX_DOOR_WIDTH, MAX_DOOR_HEIGHT, MAX_THICKNESS, DoorStyle::Slab, mat());
        assert!(result.is_ok());
    }

    #[test]
    fn test_large_shaker_door() {
        let result = gen().generate_mdf_door(900.0, 2100.0, 22.0, DoorStyle::Shaker, mat());
        assert!(result.is_ok());
        let profile = result.unwrap();
        assert_eq!(profile.parts.len(), 5);
    }

    #[test]
    fn test_arched_door_all_styles_produce_non_empty_operations() {
        let (w, h, t) = std_dims();
        let m = mat();
        for style in [DoorStyle::Shaker, DoorStyle::RaisedPanel, DoorStyle::Slab, DoorStyle::Cathedral, DoorStyle::Arched] {
            let profile = gen().generate_mdf_door(w, h, t, style.clone(), m).unwrap();
            assert!(!profile.operations.is_empty(), "No operations for style {:?}", style);
        }
    }

    #[test]
    fn test_all_parts_have_unique_ids() {
        let (w, h, t) = std_dims();
        let profile = gen().generate_mdf_door(w, h, t, DoorStyle::Shaker, mat()).unwrap();
        let ids: Vec<_> = profile.parts.iter().map(|p| p.id).collect();
        let unique: std::collections::HashSet<_> = ids.iter().collect();
        assert_eq!(ids.len(), unique.len(), "All part IDs should be unique");
    }

    #[test]
    fn test_all_operations_have_unique_ids() {
        let (w, h, t) = std_dims();
        let profile = gen().generate_mdf_door(w, h, t, DoorStyle::Shaker, mat()).unwrap();
        let ids: Vec<_> = profile.operations.iter().map(|op| op.id).collect();
        let unique: std::collections::HashSet<_> = ids.iter().collect();
        assert_eq!(ids.len(), unique.len(), "All operation IDs should be unique");
    }

    #[test]
    fn test_default_constructor() {
        let _gen = DoorProfileGenerator::default();
    }

    #[test]
    fn test_door_style_serialize_deserialize() {
        let style = DoorStyle::RaisedPanel;
        let json = serde_json::to_string(&style).unwrap();
        let back: DoorStyle = serde_json::from_str(&json).unwrap();
        assert_eq!(style, back);
    }

    #[test]
    fn test_door_profile_serialize() {
        let (w, h, t) = std_dims();
        let profile = gen().generate_mdf_door(w, h, t, DoorStyle::Shaker, mat()).unwrap();
        let json = serde_json::to_string(&profile);
        assert!(json.is_ok(), "DoorProfile must serialize to JSON");
    }

    #[test]
    fn test_cathedral_vs_arched_top_rail_height_differs() {
        let (w, h, t) = std_dims();
        let m = mat();
        let cath_parts = gen().generate_cathedral_door(w, h, t, m);
        let arch_parts = gen().generate_arched_door(w, h, t, m);
        let cath_top = cath_parts.iter().find(|p| p.part_type == DoorPartType::Rail && p.name.contains("Top")).unwrap();
        let arch_top = arch_parts.iter().find(|p| p.part_type == DoorPartType::Rail && p.name.contains("Top")).unwrap();
        // Arched door top rail should be taller (full semicircle vs. shallower cathedral arc)
        assert!(arch_top.dimensions.height >= cath_top.dimensions.height);
    }

    #[test]
    fn test_raised_panel_vs_shaker_panel_thickness_differs() {
        let (w, h, t) = std_dims();
        let m = mat();
        let shaker = gen().generate_shaker_door(w, h, t, m);
        let raised = gen().generate_raised_panel_door(w, h, t, m);
        let sp = shaker.iter().find(|p| p.part_type == DoorPartType::Panel).unwrap();
        let rp = raised.iter().find(|p| p.part_type == DoorPartType::Panel).unwrap();
        // Shaker panel is recessed (thinner); raised panel is full thickness
        assert!(sp.dimensions.thickness < rp.dimensions.thickness);
    }

    #[test]
    fn test_hinge_bore_depth_correct() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_shaker_door(w, h, t, mat());
        let hinge_ops: Vec<_> = parts.iter().flat_map(|p| &p.operations)
            .filter(|op| op.op_type == DoorOpType::HingeBore)
            .collect();
        assert!(!hinge_ops.is_empty());
        for op in hinge_ops {
            assert!((op.depth - HINGE_CUP_DEPTH).abs() < 0.001);
        }
    }

    #[test]
    fn test_panel_raise_angle_op_has_8_coordinates() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_raised_panel_door(w, h, t, mat());
        let raise_op = parts.iter().flat_map(|p| &p.operations)
            .find(|op| op.op_type == DoorOpType::PanelRaise).unwrap();
        assert_eq!(raise_op.coordinates.len(), 8);
    }

    #[test]
    fn test_arc_cut_coordinates_are_populated() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_arched_door(w, h, t, mat());
        let arc_ops: Vec<_> = parts.iter().flat_map(|p| &p.operations)
            .filter(|op| op.op_type == DoorOpType::ArcCut)
            .collect();
        assert!(!arc_ops.is_empty());
        for op in arc_ops {
            assert!(op.coordinates.len() > 2, "Arc cut should have multiple coordinates");
        }
    }

    #[test]
    fn test_cope_op_has_four_coordinates() {
        let (w, h, t) = std_dims();
        let parts = gen().generate_shaker_door(w, h, t, mat());
        let cope_op = parts.iter().flat_map(|p| &p.operations)
            .find(|op| op.op_type == DoorOpType::CopeProfile).unwrap();
        assert_eq!(cope_op.coordinates.len(), 4);
    }

    #[test]
    fn test_generate_mdf_door_all_five_styles() {
        let (w, h, t) = std_dims();
        let m = mat();
        for style in [DoorStyle::Shaker, DoorStyle::RaisedPanel, DoorStyle::Slab, DoorStyle::Cathedral, DoorStyle::Arched] {
            let result = gen().generate_mdf_door(w, h, t, style.clone(), m);
            assert!(result.is_ok(), "Failed for style {:?}", style);
        }
    }
}
