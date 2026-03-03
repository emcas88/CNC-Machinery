//! # Construction Methods Engine  –  Feature 15
//!
//! Determines how cabinet parts are joined and assembled based on the chosen
//! construction method.  Four industry-standard methods are supported:
//!
//! | Method        | Style                        | Origin        |
//! |---------------|------------------------------|---------------|
//! | `FaceFrame`   | Traditional US, 1½" FF rail  | North America |
//! | `Frameless`   | Euro 32-mm system, full OL   | Europe        |
//! | `Inset`       | Flush doors / face frame     | North America |
//! | `Hybrid`      | FF + full overlay (modern)   | North America |
//!
//! ## Core operations
//!
//! * [`ConstructionMethodsEngine::determine_parts`] – generate all carcass
//!   parts (sides, top, bottom, back, face-frame rails/stiles, stretchers,
//!   nailers) with finished dimensions.
//! * [`ConstructionMethodsEngine::calculate_joinery`] – resolve the joinery
//!   operations (dado, rabbet, dowel, cam-lock, confirmat, pocket-screw) for
//!   a given method.
//! * [`ConstructionMethodsEngine::generate_32mm_pattern`] – produce the
//!   system-hole boring pattern used in frameless (Euro) cabinets.
//! * [`ConstructionMethodsEngine::calculate_overlay`] – door/drawer overlay
//!   dimensions from method + reveal preferences.
//! * [`ConstructionMethodsEngine::calculate_toe_kick`] – toe-kick dimensions
//!   from method + product category.
//! * [`ConstructionMethodsEngine::validate_method`] – compatibility check
//!   between a construction method and a product category.

use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────────────────────────────────────────
// Public constants
// ─────────────────────────────────────────────────────────────────────────────

/// Standard 32-mm hole spacing (mm).
pub const MM32_SPACING: f64 = 32.0;
/// Distance from the front edge of a frameless panel to the first system hole (mm).
pub const MM32_FRONT_INSET: f64 = 37.0;
/// Distance from the rear edge of a frameless panel to the last system hole (mm).
pub const MM32_REAR_INSET: f64 = 37.0;
/// Standard system-hole diameter (mm).
pub const SYSTEM_HOLE_DIA: f64 = 5.0;
/// Standard hinge-cup bore diameter (mm).
pub const HINGE_CUP_DIA: f64 = 35.0;
/// Standard face-frame width in mm (1.5 inches).
pub const FACE_FRAME_WIDTH_MM: f64 = 38.1;
/// Standard material thickness for carcass panels (mm).
pub const DEFAULT_PANEL_THICKNESS: f64 = 18.0;
/// Standard back panel thickness (mm).
pub const DEFAULT_BACK_THICKNESS: f64 = 6.0;
/// Standard face-frame lumber thickness (mm).
pub const FACE_FRAME_THICKNESS: f64 = 19.05; // ¾ inch
/// Standard dado depth (mm).
pub const DADO_DEPTH: f64 = 9.5;
/// Standard rabbet depth (mm).
pub const RABBET_DEPTH: f64 = 9.5;

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

/// The high-level cabinet construction style.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConstructionMethod {
    /// Traditional US face-frame cabinet with 1½" solid-wood frame glued /
    /// screwed to the front of the carcass.  Doors overlay the face frame.
    FaceFrame,
    /// European frameless (32-mm system).  Full overlay doors and drawers.
    /// Carcass sides are drilled with a 32-mm system-hole pattern.
    Frameless,
    /// Face-frame cabinet where doors sit flush (inset) within the face-frame
    /// opening rather than overlaying it.
    Inset,
    /// Modern hybrid: face frame with full overlay doors/drawers (Shaker style,
    /// transitional kitchens).
    Hybrid,
}

impl ConstructionMethod {
    /// Human-readable display name.
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::FaceFrame => "Face Frame",
            Self::Frameless => "Frameless (Euro/32mm)",
            Self::Inset => "Inset",
            Self::Hybrid => "Hybrid (Face Frame / Full Overlay)",
        }
    }

    /// Whether this method uses a face frame attached to the carcass front.
    pub fn has_face_frame(&self) -> bool {
        matches!(self, Self::FaceFrame | Self::Inset | Self::Hybrid)
    }

    /// Whether the method uses the 32-mm system-hole boring pattern.
    pub fn uses_32mm_system(&self) -> bool {
        matches!(self, Self::Frameless)
    }
}

impl std::fmt::Display for ConstructionMethod {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.display_name())
    }
}

/// The type of joinery used to connect carcass parts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JoineryType {
    /// Rectangular channel milled across the grain to receive a panel edge.
    Dado,
    /// L-shaped shoulder cut along the edge of a panel to create a lip.
    Rabbet,
    /// Round cylindrical peg glued into blind holes in both mating parts.
    Dowel,
    /// Knock-down eccentric cam fitting: bolt in one part, cam in the other.
    CamLock,
    /// European confirmat (Euroscrew) – single-piece fastener through clearance
    /// into pilot hole.
    ConfirmatScrew,
    /// Angled pocket hole with screw driven at ~15°; requires pocket-hole jig.
    PocketScrew,
    /// Biscuit (plate) joinery: compressed-wood oval inserted into slots.
    Biscuit,
    /// Glue-only joint (used for face-frame assembly and glued-up panels).
    GlueJoint,
}

impl JoineryType {
    /// Human-readable display name.
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Dado => "Dado",
            Self::Rabbet => "Rabbet",
            Self::Dowel => "Dowel",
            Self::CamLock => "Cam-Lock (KD Fitting)",
            Self::ConfirmatScrew => "Confirmat Screw",
            Self::PocketScrew => "Pocket Screw",
            Self::Biscuit => "Biscuit / Plate Joint",
            Self::GlueJoint => "Glue Joint",
        }
    }
}

/// Category of a cabinet product – used for method compatibility validation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProductCategory {
    BaseCabinet,
    WallCabinet,
    TallCabinet,
    Vanity,
    Closet,
    Wardrobe,
    Furniture,
}

impl ProductCategory {
    /// Whether this category normally sits on the floor and therefore has a toe
    /// kick.
    pub fn has_toe_kick(&self) -> bool {
        matches!(
            self,
            Self::BaseCabinet | Self::Vanity | Self::TallCabinet | Self::Closet
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Part representation
// ─────────────────────────────────────────────────────────────────────────────

/// The structural role of a generated carcass part.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CarcassPartType {
    Side,
    Top,
    Bottom,
    Back,
    /// Horizontal face-frame member (top / bottom rail).
    FaceFrameRail,
    /// Vertical face-frame member (outer / mid stile).
    FaceFrameStile,
    /// Horizontal stretcher connecting the two sides at the top or bottom.
    Stretcher,
    /// Horizontal nailer strip (provides a fastening surface to the wall).
    Nailer,
    /// Fixed shelf.
    Shelf,
    /// Toe-kick panel.
    ToeKick,
}

/// A single carcass or face-frame part with its finished dimensions.
///
/// All dimensions are in **millimetres**.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CarcassPart {
    /// Descriptive label (e.g. `"Left Side"`, `"Top Rail"`).
    pub label: String,
    /// Structural role.
    pub part_type: CarcassPartType,
    /// Finished width dimension (mm) – typically the horizontal dimension when
    /// the part is in its installed orientation.
    pub width: f64,
    /// Finished height dimension (mm) – vertical extent in installed position.
    pub height: f64,
    /// Material thickness (mm).
    pub thickness: f64,
    /// Number of identical pieces required.
    pub qty: u32,
    /// Notes relevant to this part (grain direction, edge banding, etc.).
    pub notes: String,
}

impl CarcassPart {
    /// Convenience constructor.
    pub fn new(
        label: impl Into<String>,
        part_type: CarcassPartType,
        width: f64,
        height: f64,
        thickness: f64,
        qty: u32,
        notes: impl Into<String>,
    ) -> Self {
        Self {
            label: label.into(),
            part_type,
            width,
            height,
            thickness,
            qty,
            notes: notes.into(),
        }
    }

    /// Area of a single piece in square millimetres.
    pub fn area(&self) -> f64 {
        self.width * self.height
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Joinery operation
// ─────────────────────────────────────────────────────────────────────────────

/// A single joinery operation to be performed on a carcass.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct JoineryOperation {
    /// The joinery technique.
    pub joinery_type: JoineryType,
    /// Human-readable description of where and how this operation is applied.
    pub description: String,
    /// Tool / bit diameter (mm), if applicable.
    pub tool_diameter: Option<f64>,
    /// Depth of cut or penetration (mm), if applicable.
    pub depth: Option<f64>,
    /// On-centre spacing between repeated features (mm), if applicable (e.g.
    /// dowel spacing, screw spacing).
    pub spacing: Option<f64>,
    /// Notes (e.g. glueline requirements, clamping pressure).
    pub notes: String,
}

impl JoineryOperation {
    /// Build a new `JoineryOperation`.
    pub fn new(
        joinery_type: JoineryType,
        description: impl Into<String>,
        tool_diameter: Option<f64>,
        depth: Option<f64>,
        spacing: Option<f64>,
        notes: impl Into<String>,
    ) -> Self {
        Self {
            joinery_type,
            description: description.into(),
            tool_diameter,
            depth,
            spacing,
            notes: notes.into(),
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 32-mm system holes
// ─────────────────────────────────────────────────────────────────────────────

/// A single 5-mm system hole in the 32-mm boring pattern.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct SystemHole {
    /// Distance from the front face of the panel to the hole centre (mm).
    pub x: f64,
    /// Distance from the bottom edge of the panel to the hole centre (mm).
    pub y: f64,
    /// Diameter of the hole (mm).
    pub diameter: f64,
    /// Whether this is a hinge-cup location rather than a standard system hole.
    pub is_hinge_location: bool,
}

/// The full 32-mm boring pattern for one side panel.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SystemHolePattern {
    /// Which panel the pattern applies to.
    pub panel_label: String,
    /// All holes in the pattern (front column and rear column combined).
    pub holes: Vec<SystemHole>,
    /// Distance from the front edge to the front column of holes (mm).
    pub front_column_x: f64,
    /// Distance from the front edge to the rear column of holes (mm).
    pub rear_column_x: f64,
    /// Number of system holes in each column.
    pub holes_per_column: u32,
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlay specification
// ─────────────────────────────────────────────────────────────────────────────

/// Describes how much a door or drawer front overlaps the cabinet opening.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OverlaySpec {
    /// Overlay amount on the hinge side (mm).
    pub hinge_side: f64,
    /// Overlay amount on the opposite (pull) side (mm).
    pub opposite_side: f64,
    /// Overlay at the top of the door/drawer (mm).
    pub top: f64,
    /// Overlay at the bottom of the door/drawer (mm).
    pub bottom: f64,
    /// Gap (reveal) between adjacent doors or between a door and the face frame
    /// (mm).
    pub reveal: f64,
    /// Human-readable description of the overlay style.
    pub description: String,
}

impl OverlaySpec {
    /// Returns the total door width given the opening width.
    pub fn door_width_for_opening(&self, opening_width: f64) -> f64 {
        opening_width + self.hinge_side + self.opposite_side
    }

    /// Returns the total door height given the opening height.
    pub fn door_height_for_opening(&self, opening_height: f64) -> f64 {
        opening_height + self.top + self.bottom
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Toe-kick specification
// ─────────────────────────────────────────────────────────────────────────────

/// Toe-kick geometry for a floor-standing cabinet.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToeKickSpec {
    /// Height of the toe-kick recess (mm).
    pub height: f64,
    /// Depth of the toe-kick recess measured from the cabinet face (mm).
    pub depth: f64,
    /// Whether the toe kick is a separate applied panel (`true`) or a cut-out
    /// of the carcass side (`false`).
    pub is_applied_panel: bool,
    /// Thickness of the toe-kick panel if it is an applied panel (mm).
    pub panel_thickness: Option<f64>,
    /// Notes on installation.
    pub notes: String,
}

// ─────────────────────────────────────────────────────────────────────────────
// Reveal preferences (input)
// ─────────────────────────────────────────────────────────────────────────────

/// User-configurable reveal / gap preferences.
///
/// All values in **millimetres**.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RevealPreferences {
    /// Gap between adjacent doors (mm).  Defaults to 3 mm.
    pub door_gap: f64,
    /// Gap between a door and the face-frame stile edge (mm).  Defaults to 0
    /// for overlay, positive for inset clearance.
    pub door_to_frame_gap: f64,
    /// Additional reveal on top of the standard overlay (mm).
    pub extra_overlay: f64,
}

impl Default for RevealPreferences {
    fn default() -> Self {
        Self {
            door_gap: 3.0,
            door_to_frame_gap: 0.0,
            extra_overlay: 0.0,
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation error
// ─────────────────────────────────────────────────────────────────────────────

/// Describes an incompatibility between a construction method and a product
/// category.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ValidationError {
    /// The construction method that was tested.
    pub method: ConstructionMethod,
    /// The product category that was tested.
    pub category: ProductCategory,
    /// Human-readable explanation.
    pub message: String,
    /// Whether this error is a hard blocker (`true`) or merely a warning
    /// (`false`).
    pub is_blocking: bool,
}

// ─────────────────────────────────────────────────────────────────────────────
// Product dimensions (input)
// ─────────────────────────────────────────────────────────────────────────────

/// Overall cabinet dimensions as supplied by the product model.
///
/// All values in **millimetres**.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProductDimensions {
    /// Overall width of the cabinet (outside of carcass).
    pub width: f64,
    /// Overall height of the cabinet (outside of carcass, floor to top).
    pub height: f64,
    /// Overall depth of the cabinet (outside of carcass, front to back).
    pub depth: f64,
    /// Thickness of side, top and bottom panels (mm).  Defaults to 18 mm.
    pub panel_thickness: f64,
    /// Thickness of the back panel (mm).  Defaults to 6 mm.
    pub back_thickness: f64,
    /// Product category (used in part-generation and validation logic).
    pub category: ProductCategory,
}

impl ProductDimensions {
    /// Create dimensions with the standard 18 mm panels and 6 mm back.
    pub fn new(width: f64, height: f64, depth: f64, category: ProductCategory) -> Self {
        Self {
            width,
            height,
            depth,
            panel_thickness: DEFAULT_PANEL_THICKNESS,
            back_thickness: DEFAULT_BACK_THICKNESS,
            category,
        }
    }

    /// Interior cabinet width (width minus two panel thicknesses).
    pub fn interior_width(&self) -> f64 {
        self.width - 2.0 * self.panel_thickness
    }

    /// Interior cabinet depth (depth minus back thickness for frameless, or
    /// the same for face-frame types where the back sits in a rabbet on the
    /// rear edge of the sides).
    pub fn interior_depth(&self) -> f64 {
        self.depth - self.back_thickness
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────────────────────────────────────

/// The main construction methods engine.
///
/// All methods are pure functions (no mutable state) so an instance can be
/// shared freely between threads.
#[derive(Debug, Clone, Default)]
pub struct ConstructionMethodsEngine;

impl ConstructionMethodsEngine {
    /// Create a new engine instance.
    pub fn new() -> Self {
        Self
    }

    // ─────────────────────────────────────────────────────────────────────────
    // determine_parts
    // ─────────────────────────────────────────────────────────────────────────

    /// Generate all required carcass parts for the given product dimensions and
    /// construction method.
    ///
    /// Returns a list of [`CarcassPart`] values in build order (sides → top/
    /// bottom → back → face frame → stretchers → nailers → toe kick).
    ///
    /// # Cabinet sizing conventions
    ///
    /// * **Frameless** – sides run full height; top and bottom are captured
    ///   between the sides (width = `interior_width()`).
    /// * **FaceFrame / Inset / Hybrid** – sides run full height; top/bottom
    ///   captured between sides; a solid-wood face frame is glued to the front.
    pub fn determine_parts(
        &self,
        dims: &ProductDimensions,
        method: ConstructionMethod,
    ) -> Vec<CarcassPart> {
        let mut parts = Vec::new();

        let t = dims.panel_thickness;
        let tb = dims.back_thickness;
        let w = dims.width;
        let h = dims.height;
        let d = dims.depth;
        let iw = dims.interior_width(); // width between the two sides

        // Toe-kick height: base/vanity/tall = 89 mm (3½"), others = 0.
        let tk_h = if dims.category.has_toe_kick() { 89.0 } else { 0.0 };

        // ── Carcass sides ────────────────────────────────────────────────────
        // Sides are always full height × full depth.
        parts.push(CarcassPart::new(
            "Left Side",
            CarcassPartType::Side,
            d,
            h,
            t,
            1,
            "Edge band front edge",
        ));
        parts.push(CarcassPart::new(
            "Right Side",
            CarcassPartType::Side,
            d,
            h,
            t,
            1,
            "Edge band front edge",
        ));

        // ── Top and bottom ───────────────────────────────────────────────────
        // For all methods: top and bottom run between the sides.
        // Height of top/bottom = depth minus back-panel thickness (back sits
        // in a rabbet at the rear, flush with the back of the sides).
        let tb_depth = d - tb;

        parts.push(CarcassPart::new(
            "Top",
            CarcassPartType::Top,
            iw,
            tb_depth,
            t,
            1,
            "Edge band front edge",
        ));
        parts.push(CarcassPart::new(
            "Bottom",
            CarcassPartType::Bottom,
            iw,
            tb_depth,
            t,
            1,
            "Edge band front edge",
        ));

        // ── Back panel ───────────────────────────────────────────────────────
        // Back fits into a rabbet on all four inside faces (sides, top, bottom).
        // Its dimensions therefore match the outside of the top/bottom rail and
        // the full interior height.
        parts.push(CarcassPart::new(
            "Back",
            CarcassPartType::Back,
            iw,
            h - 2.0 * t,
            tb,
            1,
            "1/4\" or 6mm plywood; fits into 3/8\" rabbet",
        ));

        // ── Method-specific parts ────────────────────────────────────────────
        match method {
            ConstructionMethod::Frameless => {
                // Frameless uses a top stretcher and rear nailer instead of a
                // face frame.
                parts.push(CarcassPart::new(
                    "Top Stretcher",
                    CarcassPartType::Stretcher,
                    iw,
                    96.0, // 96 mm (≈ 3¾") standard stretcher height
                    t,
                    1,
                    "Pocket-screwed to sides; front face flush with side fronts",
                ));
                parts.push(CarcassPart::new(
                    "Rear Nailer",
                    CarcassPartType::Nailer,
                    iw,
                    89.0,
                    t,
                    1,
                    "Fastens cabinet to wall; sits below top",
                ));
                // Toe kick for floor-standing variants
                if dims.category.has_toe_kick() {
                    parts.push(CarcassPart::new(
                        "Toe Kick",
                        CarcassPartType::ToeKick,
                        w, // full cabinet width
                        tk_h,
                        t,
                        1,
                        "Applied panel; snaps into adjustable leg system or glued",
                    ));
                }
            }

            ConstructionMethod::FaceFrame => {
                // Face frame: top and bottom horizontal rails + two outer stiles.
                // Rail width = 38.1 mm (1½"), stile width = 38.1 mm.
                let ff_w = FACE_FRAME_WIDTH_MM;
                let ff_t = FACE_FRAME_THICKNESS;

                // Top and bottom rails span the full cabinet width.
                parts.push(CarcassPart::new(
                    "Face Frame Top Rail",
                    CarcassPartType::FaceFrameRail,
                    w,
                    ff_w,
                    ff_t,
                    1,
                    "1½\" solid wood; glue & pocket-screw to carcass",
                ));
                parts.push(CarcassPart::new(
                    "Face Frame Bottom Rail",
                    CarcassPartType::FaceFrameRail,
                    w,
                    ff_w,
                    ff_t,
                    1,
                    "1½\" solid wood; glue & pocket-screw to carcass",
                ));
                // Left and right stiles run full height.
                parts.push(CarcassPart::new(
                    "Face Frame Left Stile",
                    CarcassPartType::FaceFrameStile,
                    ff_w,
                    h,
                    ff_t,
                    1,
                    "1½\" solid wood; outer edge flush with side",
                ));
                parts.push(CarcassPart::new(
                    "Face Frame Right Stile",
                    CarcassPartType::FaceFrameStile,
                    ff_w,
                    h,
                    ff_t,
                    1,
                    "1½\" solid wood; outer edge flush with side",
                ));
                // Rear nailer
                parts.push(CarcassPart::new(
                    "Rear Nailer",
                    CarcassPartType::Nailer,
                    iw,
                    89.0,
                    t,
                    1,
                    "Fastens cabinet to wall",
                ));
                if dims.category.has_toe_kick() {
                    parts.push(CarcassPart::new(
                        "Toe Kick",
                        CarcassPartType::ToeKick,
                        w,
                        tk_h,
                        t,
                        1,
                        "Applied panel or solid wood; face-nailed to base",
                    ));
                }
            }

            ConstructionMethod::Inset => {
                // Inset uses the same face-frame members but with closer
                // tolerances (doors fit flush).
                let ff_w = FACE_FRAME_WIDTH_MM;
                let ff_t = FACE_FRAME_THICKNESS;

                parts.push(CarcassPart::new(
                    "Face Frame Top Rail",
                    CarcassPartType::FaceFrameRail,
                    w,
                    ff_w,
                    ff_t,
                    1,
                    "1½\" solid wood; inset door clearance 1.6 mm per side",
                ));
                parts.push(CarcassPart::new(
                    "Face Frame Bottom Rail",
                    CarcassPartType::FaceFrameRail,
                    w,
                    ff_w,
                    ff_t,
                    1,
                    "1½\" solid wood; inset door clearance 1.6 mm per side",
                ));
                parts.push(CarcassPart::new(
                    "Face Frame Left Stile",
                    CarcassPartType::FaceFrameStile,
                    ff_w,
                    h,
                    ff_t,
                    1,
                    "1½\" solid wood; inset reveal 1.6 mm each side",
                ));
                parts.push(CarcassPart::new(
                    "Face Frame Right Stile",
                    CarcassPartType::FaceFrameStile,
                    ff_w,
                    h,
                    ff_t,
                    1,
                    "1½\" solid wood; inset reveal 1.6 mm each side",
                ));
                parts.push(CarcassPart::new(
                    "Rear Nailer",
                    CarcassPartType::Nailer,
                    iw,
                    89.0,
                    t,
                    1,
                    "Fastens cabinet to wall",
                ));
                if dims.category.has_toe_kick() {
                    parts.push(CarcassPart::new(
                        "Toe Kick",
                        CarcassPartType::ToeKick,
                        w,
                        tk_h,
                        t,
                        1,
                        "Solid wood preferred for inset style",
                    ));
                }
            }

            ConstructionMethod::Hybrid => {
                // Hybrid face-frame with full overlay – narrower rails so that
                // the full-overlay door hides the rail completely (only the
                // stile edge is typically visible).
                let ff_w = FACE_FRAME_WIDTH_MM;
                let ff_t = FACE_FRAME_THICKNESS;

                parts.push(CarcassPart::new(
                    "Face Frame Top Rail",
                    CarcassPartType::FaceFrameRail,
                    w,
                    ff_w,
                    ff_t,
                    1,
                    "Full-overlay door covers this rail completely",
                ));
                parts.push(CarcassPart::new(
                    "Face Frame Bottom Rail",
                    CarcassPartType::FaceFrameRail,
                    w,
                    ff_w,
                    ff_t,
                    1,
                    "Full-overlay door covers this rail completely",
                ));
                parts.push(CarcassPart::new(
                    "Face Frame Left Stile",
                    CarcassPartType::FaceFrameStile,
                    ff_w,
                    h,
                    ff_t,
                    1,
                    "Outer edge flush with side; only edge visible in full-OL",
                ));
                parts.push(CarcassPart::new(
                    "Face Frame Right Stile",
                    CarcassPartType::FaceFrameStile,
                    ff_w,
                    h,
                    ff_t,
                    1,
                    "Outer edge flush with side; only edge visible in full-OL",
                ));
                parts.push(CarcassPart::new(
                    "Top Stretcher",
                    CarcassPartType::Stretcher,
                    iw,
                    96.0,
                    t,
                    1,
                    "Behind top rail; provides rigid top connection",
                ));
                parts.push(CarcassPart::new(
                    "Rear Nailer",
                    CarcassPartType::Nailer,
                    iw,
                    89.0,
                    t,
                    1,
                    "Fastens cabinet to wall",
                ));
                if dims.category.has_toe_kick() {
                    parts.push(CarcassPart::new(
                        "Toe Kick",
                        CarcassPartType::ToeKick,
                        w,
                        tk_h,
                        t,
                        1,
                        "Applied panel; paint-grade or match door finish",
                    ));
                }
            }
        }

        parts
    }

    // ─────────────────────────────────────────────────────────────────────────
    // calculate_joinery
    // ─────────────────────────────────────────────────────────────────────────

    /// Return the set of joinery operations required for the given construction
    /// method.
    ///
    /// The returned list is ordered from primary structural joinery (highest
    /// strength) to secondary / finishing joinery.
    pub fn calculate_joinery(
        &self,
        method: ConstructionMethod,
        panel_thickness: f64,
    ) -> Vec<JoineryOperation> {
        let mut ops = Vec::new();
        let t = panel_thickness;

        match method {
            ConstructionMethod::Frameless => {
                // Primary: dado for top / bottom into sides.
                ops.push(JoineryOperation::new(
                    JoineryType::Dado,
                    "Dado on inside face of each side panel for top and bottom shelf",
                    Some(t),
                    Some(DADO_DEPTH),
                    None,
                    "Mill at 9.5 mm depth; align with top and bottom panel positions",
                ));
                // Rabbet at rear of sides for back panel.
                ops.push(JoineryOperation::new(
                    JoineryType::Rabbet,
                    "Rabbet along rear inside edge of sides, top, and bottom for back panel",
                    Some(t),
                    Some(RABBET_DEPTH),
                    None,
                    "3/8\" rabbet; back panel is 1/4\" ply with 1/8\" clearance",
                ));
                // Dowels for top/bottom to side joint (optional supplement).
                ops.push(JoineryOperation::new(
                    JoineryType::Dowel,
                    "8 mm dowels through sides into top and bottom panels",
                    Some(8.0),
                    Some(30.0),
                    Some(96.0),
                    "32-mm system: first dowel at 37 mm from front, subsequent at 96 mm OC",
                ));
                // Cam-lock fittings for knockdown assembly.
                ops.push(JoineryOperation::new(
                    JoineryType::CamLock,
                    "Cam-lock (eccentric) fittings at each top/bottom corner",
                    Some(15.0),
                    Some(12.5),
                    None,
                    "Bore 15 mm dia × 12.5 mm deep in side for cam; 6 mm bolt in top/bottom",
                ));
                // Pocket screws for stretcher attachment.
                ops.push(JoineryOperation::new(
                    JoineryType::PocketScrew,
                    "Pocket screws attaching top stretcher and rear nailer to sides",
                    Some(9.5),
                    Some(38.0),
                    Some(150.0),
                    "Kreg-style pocket; 1-1/4\" coarse screws into face grain",
                ));
            }

            ConstructionMethod::FaceFrame => {
                // Primary: dado for top/bottom.
                ops.push(JoineryOperation::new(
                    JoineryType::Dado,
                    "Dado on inside faces of sides for top and bottom",
                    Some(t),
                    Some(DADO_DEPTH),
                    None,
                    "Same depth as panel thickness / 2 (max 9.5 mm)",
                ));
                // Rabbet for back panel.
                ops.push(JoineryOperation::new(
                    JoineryType::Rabbet,
                    "Rabbet along rear inside edge of sides and top/bottom for back panel",
                    Some(t),
                    Some(RABBET_DEPTH),
                    None,
                    "3/8\" deep rabbet",
                ));
                // Confirmat screws for carcass-to-face-frame.
                ops.push(JoineryOperation::new(
                    JoineryType::ConfirmatScrew,
                    "Confirmat screws through face-frame rails into carcass top/bottom",
                    Some(7.0),
                    Some(50.0),
                    Some(150.0),
                    "7 mm confirmat, 50 mm depth; countersink 10 mm",
                ));
                // Pocket screws for face-frame assembly (stile-to-rail joints).
                ops.push(JoineryOperation::new(
                    JoineryType::PocketScrew,
                    "Pocket screws joining face-frame stiles to rails",
                    Some(9.5),
                    Some(32.0),
                    None,
                    "Standard Kreg R3 setup; 1-1/4\" coarse screws",
                ));
                // Glue joint for face-frame to carcass.
                ops.push(JoineryOperation::new(
                    JoineryType::GlueJoint,
                    "Glue line between face-frame back face and carcass front edges",
                    None,
                    None,
                    None,
                    "PVA glue; clamp 30 minutes; flush-trim after dry",
                ));
            }

            ConstructionMethod::Inset => {
                // Inset uses the same carcass joinery as face-frame but
                // tolerances are tighter because doors hang inside the opening.
                ops.push(JoineryOperation::new(
                    JoineryType::Dado,
                    "Dado on inside faces of sides for top and bottom",
                    Some(t),
                    Some(DADO_DEPTH),
                    None,
                    "Same as face-frame; accuracy critical for inset door fit",
                ));
                ops.push(JoineryOperation::new(
                    JoineryType::Rabbet,
                    "Rabbet along rear inside edges for back panel",
                    Some(t),
                    Some(RABBET_DEPTH),
                    None,
                    "3/8\" rabbet; flush back",
                ));
                ops.push(JoineryOperation::new(
                    JoineryType::ConfirmatScrew,
                    "Confirmat screws for face-frame-to-carcass joint",
                    Some(7.0),
                    Some(50.0),
                    Some(150.0),
                    "7 mm confirmat; accurate pilot essential",
                ));
                ops.push(JoineryOperation::new(
                    JoineryType::PocketScrew,
                    "Pocket screws for face-frame rail-to-stile joints",
                    Some(9.5),
                    Some(32.0),
                    None,
                    "Face-frame must be flat and square for inset doors",
                ));
                ops.push(JoineryOperation::new(
                    JoineryType::GlueJoint,
                    "Glue face-frame to carcass front edges",
                    None,
                    None,
                    None,
                    "Extra care required: flush within 0.1 mm for inset clearance",
                ));
                // Biscuits for face-frame alignment.
                ops.push(JoineryOperation::new(
                    JoineryType::Biscuit,
                    "Biscuits (FF20) aligning face-frame to carcass during glue-up",
                    Some(4.0),
                    Some(10.0),
                    Some(200.0),
                    "Use FF20 biscuits at 200 mm OC for alignment only, not primary strength",
                ));
            }

            ConstructionMethod::Hybrid => {
                // Hybrid shares carcass joinery with frameless but adds a
                // face-frame similar to face-frame method.
                ops.push(JoineryOperation::new(
                    JoineryType::Dado,
                    "Dado on inside faces of sides for top and bottom",
                    Some(t),
                    Some(DADO_DEPTH),
                    None,
                    "Same as frameless carcass build",
                ));
                ops.push(JoineryOperation::new(
                    JoineryType::Rabbet,
                    "Rabbet along rear inside edges for back panel",
                    Some(t),
                    Some(RABBET_DEPTH),
                    None,
                    "3/8\" rabbet",
                ));
                ops.push(JoineryOperation::new(
                    JoineryType::PocketScrew,
                    "Pocket screws joining face-frame to carcass and stile-to-rail joints",
                    Some(9.5),
                    Some(32.0),
                    Some(150.0),
                    "1-1/4\" coarse pocket screws; PVA glue on face-frame back face",
                ));
                ops.push(JoineryOperation::new(
                    JoineryType::Dowel,
                    "Optional dowels for face-frame rail-to-stile alignment",
                    Some(8.0),
                    Some(30.0),
                    None,
                    "Use in addition to pocket screws for added rigidity",
                ));
                ops.push(JoineryOperation::new(
                    JoineryType::GlueJoint,
                    "Glue face-frame to carcass front edges",
                    None,
                    None,
                    None,
                    "PVA glue; clamp 30 minutes",
                ));
                ops.push(JoineryOperation::new(
                    JoineryType::ConfirmatScrew,
                    "Confirmat screws through top/bottom into face-frame rails",
                    Some(7.0),
                    Some(50.0),
                    Some(150.0),
                    "Fills screwhole with cap or wood filler",
                ));
            }
        }

        ops
    }

    // ─────────────────────────────────────────────────────────────────────────
    // generate_32mm_pattern
    // ─────────────────────────────────────────────────────────────────────────

    /// Generate the 32-mm system-hole boring pattern for a frameless side
    /// panel.
    ///
    /// The pattern consists of:
    /// * A **front column** at `MM32_FRONT_INSET` (37 mm) from the front edge.
    /// * A **rear column** at `panel_depth - MM32_REAR_INSET` (37 mm from rear).
    /// * Holes at 32-mm intervals along the height, starting at
    ///   `first_hole_from_bottom`.
    ///
    /// Hinge-cup positions are identified for holes that fall within
    /// `hinge_zone_min..hinge_zone_max` on the front column.
    ///
    /// # Arguments
    ///
    /// * `panel_height` – finished height of the side panel (mm).
    /// * `panel_depth` – finished depth of the side panel (mm).
    /// * `first_hole_from_bottom` – Y offset of the first hole from the panel
    ///   bottom (mm).  Defaults to 37 mm if set to `None`.
    /// * `panel_label` – label for the generated pattern (e.g. `"Left Side"`).
    ///
    /// # Returns
    ///
    /// A [`SystemHolePattern`] with both front and rear columns combined.
    pub fn generate_32mm_pattern(
        &self,
        panel_height: f64,
        panel_depth: f64,
        first_hole_from_bottom: Option<f64>,
        panel_label: impl Into<String>,
    ) -> SystemHolePattern {
        let first_y = first_hole_from_bottom.unwrap_or(37.0);
        let front_x = MM32_FRONT_INSET;
        let rear_x = panel_depth - MM32_REAR_INSET;

        // Hinge cup zone – roughly mid-height and low (~100–400 mm) on door
        // panels.  We flag as hinge location for informational purposes.
        let hinge_zone_min = first_y;
        let hinge_zone_max = first_y + 4.0 * MM32_SPACING; // first 4 rows

        let mut holes = Vec::new();
        let mut y = first_y;
        let mut col_count: u32 = 0;

        while y <= panel_height - first_y + 1.0 {
            let is_hinge = y >= hinge_zone_min && y <= hinge_zone_max;

            // Front column
            holes.push(SystemHole {
                x: front_x,
                y,
                diameter: SYSTEM_HOLE_DIA,
                is_hinge_location: is_hinge,
            });

            // Rear column (standard system holes only, not hinge locations)
            holes.push(SystemHole {
                x: rear_x,
                y,
                diameter: SYSTEM_HOLE_DIA,
                is_hinge_location: false,
            });

            y += MM32_SPACING;
            col_count += 1;
        }

        SystemHolePattern {
            panel_label: panel_label.into(),
            holes,
            front_column_x: front_x,
            rear_column_x: rear_x,
            holes_per_column: col_count,
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // calculate_overlay
    // ─────────────────────────────────────────────────────────────────────────

    /// Determine door/drawer overlay dimensions based on the construction
    /// method and reveal preferences.
    ///
    /// # Overlay conventions
    ///
    /// | Method    | Hinge side   | Opp. side    | Top   | Bottom | Style          |
    /// |-----------|-------------|-------------|-------|--------|----------------|
    /// | FaceFrame | 9.5 mm OL   | 9.5 mm OL   | 9.5   | 9.5    | Standard OL    |
    /// | Frameless | 18.0 mm OL  | 18.0 mm OL  | 18.0  | 18.0   | Full OL (FL)   |
    /// | Inset     | 0 (flush)   | 0 (flush)   | 0     | 0      | Inset / flush  |
    /// | Hybrid    | 18.0 mm OL  | 18.0 mm OL  | 18.0  | 18.0   | Full OL on FF  |
    pub fn calculate_overlay(
        &self,
        method: ConstructionMethod,
        prefs: &RevealPreferences,
    ) -> OverlaySpec {
        let extra = prefs.extra_overlay;
        match method {
            ConstructionMethod::FaceFrame => OverlaySpec {
                hinge_side: 9.5 + extra,
                opposite_side: 9.5 + extra,
                top: 9.5 + extra,
                bottom: 9.5 + extra,
                reveal: prefs.door_gap,
                description: format!(
                    "Standard overlay on face frame (9.5 mm + {:.1} mm extra per side)",
                    extra
                ),
            },
            ConstructionMethod::Frameless => OverlaySpec {
                hinge_side: 18.0 + extra,
                opposite_side: 18.0 + extra,
                top: 18.0 + extra,
                bottom: 18.0 + extra,
                reveal: prefs.door_gap,
                description: format!(
                    "Full overlay frameless (18.0 mm + {:.1} mm extra per side)",
                    extra
                ),
            },
            ConstructionMethod::Inset => OverlaySpec {
                hinge_side: 0.0,
                opposite_side: 0.0,
                top: 0.0,
                bottom: 0.0,
                reveal: prefs.door_to_frame_gap.max(1.6), // 1/16" minimum clearance
                description: format!(
                    "Inset / flush – door sits inside face-frame opening (gap {:.1} mm per side)",
                    prefs.door_to_frame_gap.max(1.6)
                ),
            },
            ConstructionMethod::Hybrid => OverlaySpec {
                hinge_side: 18.0 + extra,
                opposite_side: 18.0 + extra,
                top: 18.0 + extra,
                bottom: 18.0 + extra,
                reveal: prefs.door_gap,
                description: format!(
                    "Full overlay on face frame / hybrid (18.0 mm + {:.1} mm extra per side)",
                    extra
                ),
            },
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // calculate_toe_kick
    // ─────────────────────────────────────────────────────────────────────────

    /// Calculate toe-kick dimensions for the given method and product category.
    ///
    /// Returns `None` if the product category does not have a toe kick (e.g.
    /// wall cabinets, wardrobes, furniture).
    ///
    /// Standard toe-kick:
    /// * Height = 89 mm (3½ inches) for base/vanity/tall.
    /// * Depth  = 76 mm (3 inches) from the cabinet front face.
    pub fn calculate_toe_kick(
        &self,
        method: ConstructionMethod,
        category: ProductCategory,
    ) -> Option<ToeKickSpec> {
        if !category.has_toe_kick() {
            return None;
        }

        match method {
            ConstructionMethod::Frameless => Some(ToeKickSpec {
                height: 89.0,
                depth: 76.0,
                is_applied_panel: true,
                panel_thickness: Some(DEFAULT_PANEL_THICKNESS),
                notes: "Applied panel; typically clips onto adjustable levelling legs or \
                        is glued and nailed to a plywood strip attached to the cabinet bottom."
                    .into(),
            }),

            ConstructionMethod::FaceFrame => Some(ToeKickSpec {
                height: 89.0,
                depth: 76.0,
                is_applied_panel: true,
                panel_thickness: Some(DEFAULT_PANEL_THICKNESS),
                notes: "Applied panel nailed through the face frame bottom rail or \
                        attached to a 2× cleat. Paint-grade or match door species."
                    .into(),
            }),

            ConstructionMethod::Inset => Some(ToeKickSpec {
                height: 89.0,
                depth: 76.0,
                is_applied_panel: true,
                panel_thickness: Some(19.0), // solid wood preferred
                notes: "Solid wood or ply panel in species to match face frame; \
                        cope-and-stick detail optional on exposed corners."
                    .into(),
            }),

            ConstructionMethod::Hybrid => Some(ToeKickSpec {
                height: 89.0,
                depth: 76.0,
                is_applied_panel: true,
                panel_thickness: Some(DEFAULT_PANEL_THICKNESS),
                notes: "Applied panel; finish to match door or painted; \
                        attach to base cleat or bottom stretcher."
                    .into(),
            }),
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // validate_method
    // ─────────────────────────────────────────────────────────────────────────

    /// Check compatibility between a construction method and a product
    /// category.
    ///
    /// Returns a `Vec<ValidationError>`.  An empty vector means the combination
    /// is fully compatible.  Non-empty vectors may contain warnings
    /// (`is_blocking = false`) or hard errors (`is_blocking = true`).
    pub fn validate_method(
        &self,
        method: ConstructionMethod,
        category: ProductCategory,
    ) -> Vec<ValidationError> {
        let mut errors = Vec::new();

        match (method, category) {
            // Inset is not typically used on frameless-style furniture or
            // closet wardrobes – it requires a robust face frame.
            (ConstructionMethod::Inset, ProductCategory::Furniture) => {
                errors.push(ValidationError {
                    method,
                    category,
                    message: "Inset construction on furniture requires high precision; \
                              consider Hybrid or FaceFrame instead."
                        .into(),
                    is_blocking: false,
                });
            }

            // Frameless on a wall cabinet is fully standard.
            (ConstructionMethod::Frameless, ProductCategory::WallCabinet) => { /* OK */ }

            // Inset on a tall cabinet is unusual (door fitting is complex at
            // tall heights).
            (ConstructionMethod::Inset, ProductCategory::TallCabinet) => {
                errors.push(ValidationError {
                    method,
                    category,
                    message: "Inset doors on tall cabinets require very accurate carcass \
                              construction; seasonal wood movement may cause binding. \
                              Ensure the face frame is kiln-dried solid wood."
                        .into(),
                    is_blocking: false,
                });
            }

            // Inset on a Closet is unusual – closets are normally frameless.
            (ConstructionMethod::Inset, ProductCategory::Closet) => {
                errors.push(ValidationError {
                    method,
                    category,
                    message: "Inset construction is uncommon for closet systems; \
                              Frameless is the industry standard for closet cabinetry."
                        .into(),
                    is_blocking: false,
                });
            }

            // Inset on a Wardrobe – same concern.
            (ConstructionMethod::Inset, ProductCategory::Wardrobe) => {
                errors.push(ValidationError {
                    method,
                    category,
                    message: "Inset construction is uncommon for wardrobes; \
                              Frameless or Hybrid are recommended."
                        .into(),
                    is_blocking: false,
                });
            }

            // Everything else is acceptable.
            _ => {}
        }

        errors
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// Count parts by type from a parts list.
    pub fn count_parts_by_type(
        &self,
        parts: &[CarcassPart],
        part_type: CarcassPartType,
    ) -> usize {
        parts
            .iter()
            .filter(|p| p.part_type == part_type)
            .count()
    }

    /// Total sheet area (mm²) for all parts in a list, accounting for quantity.
    pub fn total_sheet_area(&self, parts: &[CarcassPart]) -> f64 {
        parts
            .iter()
            .map(|p| p.area() * p.qty as f64)
            .sum()
    }

    /// Returns the default panel thickness for the given method.
    pub fn default_panel_thickness(&self, _method: ConstructionMethod) -> f64 {
        DEFAULT_PANEL_THICKNESS
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── helpers ────────────────────────────────────────────────────────────────

    fn engine() -> ConstructionMethodsEngine {
        ConstructionMethodsEngine::new()
    }

    /// Standard 600 × 720 × 560 mm base cabinet used across most tests.
    fn base_dims() -> ProductDimensions {
        ProductDimensions::new(600.0, 720.0, 560.0, ProductCategory::BaseCabinet)
    }

    fn wall_dims() -> ProductDimensions {
        ProductDimensions::new(600.0, 720.0, 360.0, ProductCategory::WallCabinet)
    }

    fn tall_dims() -> ProductDimensions {
        ProductDimensions::new(600.0, 2100.0, 560.0, ProductCategory::TallCabinet)
    }

    fn furniture_dims() -> ProductDimensions {
        ProductDimensions::new(900.0, 760.0, 450.0, ProductCategory::Furniture)
    }

    fn default_prefs() -> RevealPreferences {
        RevealPreferences::default()
    }

    // ════════════════════════════════════════════════════════════════════════
    // 1. ConstructionMethod enum
    // ════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_method_display_names() {
        assert_eq!(ConstructionMethod::FaceFrame.display_name(), "Face Frame");
        assert_eq!(
            ConstructionMethod::Frameless.display_name(),
            "Frameless (Euro/32mm)"
        );
        assert_eq!(ConstructionMethod::Inset.display_name(), "Inset");
        assert!(ConstructionMethod::Hybrid
            .display_name()
            .contains("Hybrid"));
    }

    #[test]
    fn test_method_has_face_frame() {
        assert!(ConstructionMethod::FaceFrame.has_face_frame());
        assert!(ConstructionMethod::Inset.has_face_frame());
        assert!(ConstructionMethod::Hybrid.has_face_frame());
        assert!(!ConstructionMethod::Frameless.has_face_frame());
    }

    #[test]
    fn test_method_uses_32mm_system() {
        assert!(ConstructionMethod::Frameless.uses_32mm_system());
        assert!(!ConstructionMethod::FaceFrame.uses_32mm_system());
        assert!(!ConstructionMethod::Inset.uses_32mm_system());
        assert!(!ConstructionMethod::Hybrid.uses_32mm_system());
    }

    #[test]
    fn test_method_display_trait() {
        let s = format!("{}", ConstructionMethod::FaceFrame);
        assert!(!s.is_empty());
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. ProductDimensions helpers
    // ════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_interior_width() {
        let d = base_dims();
        assert!((d.interior_width() - (600.0 - 2.0 * 18.0)).abs() < 1e-9);
    }

    #[test]
    fn test_interior_depth() {
        let d = base_dims();
        assert!((d.interior_depth() - (560.0 - 6.0)).abs() < 1e-9);
    }

    #[test]
    fn test_product_category_has_toe_kick() {
        assert!(ProductCategory::BaseCabinet.has_toe_kick());
        assert!(ProductCategory::Vanity.has_toe_kick());
        assert!(ProductCategory::TallCabinet.has_toe_kick());
        assert!(ProductCategory::Closet.has_toe_kick());
        assert!(!ProductCategory::WallCabinet.has_toe_kick());
        assert!(!ProductCategory::Wardrobe.has_toe_kick());
        assert!(!ProductCategory::Furniture.has_toe_kick());
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3. CarcassPart helpers
    // ════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_carcass_part_area() {
        let p = CarcassPart::new("Test", CarcassPartType::Side, 560.0, 720.0, 18.0, 1, "");
        assert!((p.area() - 560.0 * 720.0).abs() < 1e-6);
    }

    #[test]
    fn test_carcass_part_new_fields() {
        let p = CarcassPart::new("Back", CarcassPartType::Back, 564.0, 684.0, 6.0, 1, "ply");
        assert_eq!(p.label, "Back");
        assert_eq!(p.part_type, CarcassPartType::Back);
        assert_eq!(p.qty, 1);
        assert_eq!(p.notes, "ply");
    }

    // ════════════════════════════════════════════════════════════════════════
    // 4. determine_parts – Frameless
    // ════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_determine_parts_frameless_count() {
        let e = engine();
        let parts = e.determine_parts(&base_dims(), ConstructionMethod::Frameless);
        // Sides(2) + Top + Bottom + Back + Stretcher + Nailer + ToeKick = 8
        assert_eq!(parts.len(), 8);
    }

    #[test]
    fn test_determine_parts_frameless_has_sides() {
        let e = engine();
        let parts = e.determine_parts(&base_dims(), ConstructionMethod::Frameless);
        let sides: Vec<_> = parts
            .iter()
            .filter(|p| p.part_type == CarcassPartType::Side)
            .collect();
        assert_eq!(sides.len(), 2);
    }

    #[test]
    fn test_determine_parts_frameless_sides_dimensions() {
        let e = engine();
        let dims = base_dims();
        let parts = e.determine_parts(&dims, ConstructionMethod::Frameless);
        let left = parts.iter().find(|p| p.label == "Left Side").unwrap();
        assert!((left.width - dims.depth).abs() < 1e-6);
        assert!((left.height - dims.height).abs() < 1e-6);
        assert!((left.thickness - dims.panel_thickness).abs() < 1e-6);
    }

    #[test]
    fn test_determine_parts_frameless_top_bottom_width() {
        let e = engine();
        let dims = base_dims();
        let parts = e.determine_parts(&dims, ConstructionMethod::Frameless);
        let top = parts.iter().find(|p| p.part_type == CarcassPartType::Top).unwrap();
        assert!((top.width - dims.interior_width()).abs() < 1e-6);
    }

    #[test]
    fn test_determine_parts_frameless_no_face_frame_parts() {
        let e = engine();
        let parts = e.determine_parts(&base_dims(), ConstructionMethod::Frameless);
        assert_eq!(
            e.count_parts_by_type(&parts, CarcassPartType::FaceFrameRail),
            0
        );
        assert_eq!(
            e.count_parts_by_type(&parts, CarcassPartType::FaceFrameStile),
            0
        );
    }

    #[test]
    fn test_determine_parts_frameless_has_stretcher() {
        let e = engine();
        let parts = e.determine_parts(&base_dims(), ConstructionMethod::Frameless);
        assert_eq!(
            e.count_parts_by_type(&parts, CarcassPartType::Stretcher),
            1
        );
    }

    #[test]
    fn test_determine_parts_frameless_wall_no_toe_kick() {
        let e = engine();
        let parts = e.determine_parts(&wall_dims(), ConstructionMethod::Frameless);
        assert_eq!(
            e.count_parts_by_type(&parts, CarcassPartType::ToeKick),
            0
        );
    }

    #[test]
    fn test_determine_parts_frameless_base_has_toe_kick() {
        let e = engine();
        let parts = e.determine_parts(&base_dims(), ConstructionMethod::Frameless);
        assert_eq!(
            e.count_parts_by_type(&parts, CarcassPartType::ToeKick),
            1
        );
    }

    // ════════════════════════════════════════════════════════════════════════
    // 5. determine_parts – FaceFrame
    // ════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_determine_parts_faceframe_count() {
        let e = engine();
        // Sides(2) + Top + Bottom + Back + Rail(2) + Stile(2) + Nailer + ToeKick = 11
        let parts = e.determine_parts(&base_dims(), ConstructionMethod::FaceFrame);
        assert_eq!(parts.len(), 11);
    }

    #[test]
    fn test_determine_parts_faceframe_has_rails() {
        let e = engine();
        let parts = e.determine_parts(&base_dims(), ConstructionMethod::FaceFrame);
        assert_eq!(
            e.count_parts_by_type(&parts, CarcassPartType::FaceFrameRail),
            2
        );
    }

    #[test]
    fn test_determine_parts_faceframe_has_stiles() {
        let e = engine();
        let parts = e.determine_parts(&base_dims(), ConstructionMethod::FaceFrame);
        assert_eq!(
            e.count_parts_by_type(&parts, CarcassPartType::FaceFrameStile),
            2
        );
    }

    #[test]
    fn test_determine_parts_faceframe_rail_width() {
        let e = engine();
        let dims = base_dims();
        let parts = e.determine_parts(&dims, ConstructionMethod::FaceFrame);
        let rail = parts
            .iter()
            .find(|p| p.label == "Face Frame Top Rail")
            .unwrap();
        assert!((rail.width - dims.width).abs() < 1e-6);
        assert!((rail.height - FACE_FRAME_WIDTH_MM).abs() < 1e-6);
    }

    #[test]
    fn test_determine_parts_faceframe_stile_height() {
        let e = engine();
        let dims = base_dims();
        let parts = e.determine_parts(&dims, ConstructionMethod::FaceFrame);
        let stile = parts
            .iter()
            .find(|p| p.label == "Face Frame Left Stile")
            .unwrap();
        assert!((stile.height - dims.height).abs() < 1e-6);
    }

    #[test]
    fn test_determine_parts_faceframe_no_stretcher() {
        let e = engine();
        let parts = e.determine_parts(&base_dims(), ConstructionMethod::FaceFrame);
        assert_eq!(
            e.count_parts_by_type(&parts, CarcassPartType::Stretcher),
            0
        );
    }

    #[test]
    fn test_determine_parts_faceframe_wall_no_toe_kick() {
        let e = engine();
        let parts = e.determine_parts(&wall_dims(), ConstructionMethod::FaceFrame);
        assert_eq!(
            e.count_parts_by_type(&parts, CarcassPartType::ToeKick),
            0
        );
    }

    // ════════════════════════════════════════════════════════════════════════
    // 6. determine_parts – Inset
    // ════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_determine_parts_inset_count() {
        let e = engine();
        // Same structure as FaceFrame: 11 parts for base cabinet
        let parts = e.determine_parts(&base_dims(), ConstructionMethod::Inset);
        assert_eq!(parts.len(), 11);
    }

    #[test]
    fn test_determine_parts_inset_has_face_frame() {
        let e = engine();
        let parts = e.determine_parts(&base_dims(), ConstructionMethod::Inset);
        assert_eq!(
            e.count_parts_by_type(&parts, CarcassPartType::FaceFrameRail),
            2
        );
        assert_eq!(
            e.count_parts_by_type(&parts, CarcassPartType::FaceFrameStile),
            2
        );
    }

    #[test]
    fn test_determine_parts_inset_rail_note_contains_inset() {
        let e = engine();
        let parts = e.determine_parts(&base_dims(), ConstructionMethod::Inset);
        let rail = parts
            .iter()
            .find(|p| p.label == "Face Frame Top Rail")
            .unwrap();
        assert!(rail.notes.to_lowercase().contains("inset"));
    }

    #[test]
    fn test_determine_parts_inset_tall_has_toe_kick() {
        let e = engine();
        let parts = e.determine_parts(&tall_dims(), ConstructionMethod::Inset);
        assert_eq!(
            e.count_parts_by_type(&parts, CarcassPartType::ToeKick),
            1
        );
    }

    // ════════════════════════════════════════════════════════════════════════
    // 7. determine_parts – Hybrid
    // ════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_determine_parts_hybrid_count() {
        let e = engine();
        // Sides(2) + Top + Bottom + Back + Rail(2) + Stile(2) + Stretcher + Nailer + ToeKick = 12
        let parts = e.determine_parts(&base_dims(), ConstructionMethod::Hybrid);
        assert_eq!(parts.len(), 12);
    }

    #[test]
    fn test_determine_parts_hybrid_has_face_frame_and_stretcher() {
        let e = engine();
        let parts = e.determine_parts(&base_dims(), ConstructionMethod::Hybrid);
        assert_eq!(
            e.count_parts_by_type(&parts, CarcassPartType::FaceFrameRail),
            2
        );
        assert_eq!(
            e.count_parts_by_type(&parts, CarcassPartType::Stretcher),
            1
        );
    }

    #[test]
    fn test_determine_parts_hybrid_wall_no_toe_kick() {
        let e = engine();
        let parts = e.determine_parts(&wall_dims(), ConstructionMethod::Hybrid);
        assert_eq!(
            e.count_parts_by_type(&parts, CarcassPartType::ToeKick),
            0
        );
    }

    #[test]
    fn test_determine_parts_furniture_no_toe_kick_any_method() {
        let e = engine();
        let dims = furniture_dims();
        for method in [
            ConstructionMethod::Frameless,
            ConstructionMethod::FaceFrame,
            ConstructionMethod::Inset,
            ConstructionMethod::Hybrid,
        ] {
            let parts = e.determine_parts(&dims, method);
            assert_eq!(
                e.count_parts_by_type(&parts, CarcassPartType::ToeKick),
                0,
                "method {:?} should not generate toe kick for Furniture",
                method
            );
        }
    }

    #[test]
    fn test_determine_parts_back_dimensions() {
        let e = engine();
        let dims = base_dims();
        for method in [
            ConstructionMethod::Frameless,
            ConstructionMethod::FaceFrame,
            ConstructionMethod::Inset,
            ConstructionMethod::Hybrid,
        ] {
            let parts = e.determine_parts(&dims, method);
            let back = parts
                .iter()
                .find(|p| p.part_type == CarcassPartType::Back)
                .unwrap_or_else(|| panic!("No back for {:?}", method));
            assert!(
                (back.width - dims.interior_width()).abs() < 1e-6,
                "Back width wrong for {:?}",
                method
            );
            assert_eq!(back.thickness as u32, dims.back_thickness as u32);
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 8. calculate_joinery – Frameless
    // ════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_joinery_frameless_count() {
        let e = engine();
        let ops = e.calculate_joinery(ConstructionMethod::Frameless, DEFAULT_PANEL_THICKNESS);
        assert!(ops.len() >= 4);
    }

    #[test]
    fn test_joinery_frameless_has_dado() {
        let e = engine();
        let ops = e.calculate_joinery(ConstructionMethod::Frameless, DEFAULT_PANEL_THICKNESS);
        assert!(ops.iter().any(|o| o.joinery_type == JoineryType::Dado));
    }

    #[test]
    fn test_joinery_frameless_has_rabbet() {
        let e = engine();
        let ops = e.calculate_joinery(ConstructionMethod::Frameless, DEFAULT_PANEL_THICKNESS);
        assert!(ops.iter().any(|o| o.joinery_type == JoineryType::Rabbet));
    }

    #[test]
    fn test_joinery_frameless_has_cam_lock() {
        let e = engine();
        let ops = e.calculate_joinery(ConstructionMethod::Frameless, DEFAULT_PANEL_THICKNESS);
        assert!(ops.iter().any(|o| o.joinery_type == JoineryType::CamLock));
    }

    #[test]
    fn test_joinery_frameless_has_pocket_screw() {
        let e = engine();
        let ops = e.calculate_joinery(ConstructionMethod::Frameless, DEFAULT_PANEL_THICKNESS);
        assert!(ops
            .iter()
            .any(|o| o.joinery_type == JoineryType::PocketScrew));
    }

    #[test]
    fn test_joinery_frameless_dado_depth() {
        let e = engine();
        let ops = e.calculate_joinery(ConstructionMethod::Frameless, DEFAULT_PANEL_THICKNESS);
        let dado = ops
            .iter()
            .find(|o| o.joinery_type == JoineryType::Dado)
            .unwrap();
        assert_eq!(dado.depth, Some(DADO_DEPTH));
    }

    // ════════════════════════════════════════════════════════════════════════
    // 9. calculate_joinery – FaceFrame
    // ════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_joinery_faceframe_count() {
        let e = engine();
        let ops = e.calculate_joinery(ConstructionMethod::FaceFrame, DEFAULT_PANEL_THICKNESS);
        assert!(ops.len() >= 4);
    }

    #[test]
    fn test_joinery_faceframe_has_confirmat() {
        let e = engine();
        let ops = e.calculate_joinery(ConstructionMethod::FaceFrame, DEFAULT_PANEL_THICKNESS);
        assert!(ops
            .iter()
            .any(|o| o.joinery_type == JoineryType::ConfirmatScrew));
    }

    #[test]
    fn test_joinery_faceframe_has_glue_joint() {
        let e = engine();
        let ops = e.calculate_joinery(ConstructionMethod::FaceFrame, DEFAULT_PANEL_THICKNESS);
        assert!(ops
            .iter()
            .any(|o| o.joinery_type == JoineryType::GlueJoint));
    }

    #[test]
    fn test_joinery_faceframe_rabbet_depth() {
        let e = engine();
        let ops = e.calculate_joinery(ConstructionMethod::FaceFrame, DEFAULT_PANEL_THICKNESS);
        let rabbet = ops
            .iter()
            .find(|o| o.joinery_type == JoineryType::Rabbet)
            .unwrap();
        assert_eq!(rabbet.depth, Some(RABBET_DEPTH));
    }

    // ════════════════════════════════════════════════════════════════════════
    // 10. calculate_joinery – Inset
    // ════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_joinery_inset_has_biscuit() {
        let e = engine();
        let ops = e.calculate_joinery(ConstructionMethod::Inset, DEFAULT_PANEL_THICKNESS);
        assert!(ops.iter().any(|o| o.joinery_type == JoineryType::Biscuit));
    }

    #[test]
    fn test_joinery_inset_has_glue_joint() {
        let e = engine();
        let ops = e.calculate_joinery(ConstructionMethod::Inset, DEFAULT_PANEL_THICKNESS);
        assert!(ops
            .iter()
            .any(|o| o.joinery_type == JoineryType::GlueJoint));
    }

    #[test]
    fn test_joinery_inset_has_dado_and_rabbet() {
        let e = engine();
        let ops = e.calculate_joinery(ConstructionMethod::Inset, DEFAULT_PANEL_THICKNESS);
        assert!(ops.iter().any(|o| o.joinery_type == JoineryType::Dado));
        assert!(ops.iter().any(|o| o.joinery_type == JoineryType::Rabbet));
    }

    // ════════════════════════════════════════════════════════════════════════
    // 11. calculate_joinery – Hybrid
    // ════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_joinery_hybrid_has_confirmat() {
        let e = engine();
        let ops = e.calculate_joinery(ConstructionMethod::Hybrid, DEFAULT_PANEL_THICKNESS);
        assert!(ops
            .iter()
            .any(|o| o.joinery_type == JoineryType::ConfirmatScrew));
    }

    #[test]
    fn test_joinery_hybrid_has_dowel() {
        let e = engine();
        let ops = e.calculate_joinery(ConstructionMethod::Hybrid, DEFAULT_PANEL_THICKNESS);
        assert!(ops.iter().any(|o| o.joinery_type == JoineryType::Dowel));
    }

    #[test]
    fn test_joinery_hybrid_count() {
        let e = engine();
        let ops = e.calculate_joinery(ConstructionMethod::Hybrid, DEFAULT_PANEL_THICKNESS);
        assert!(ops.len() >= 5);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 12. JoineryType display names
    // ════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_joinery_display_names() {
        assert_eq!(JoineryType::Dado.display_name(), "Dado");
        assert_eq!(JoineryType::Rabbet.display_name(), "Rabbet");
        assert_eq!(JoineryType::Dowel.display_name(), "Dowel");
        assert!(JoineryType::CamLock.display_name().contains("Cam"));
        assert!(JoineryType::ConfirmatScrew.display_name().contains("Confirmat"));
        assert!(JoineryType::PocketScrew.display_name().contains("Pocket"));
        assert!(JoineryType::Biscuit.display_name().contains("Biscuit"));
        assert!(JoineryType::GlueJoint.display_name().contains("Glue"));
    }

    // ════════════════════════════════════════════════════════════════════════
    // 13. generate_32mm_pattern
    // ════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_32mm_pattern_basic_structure() {
        let e = engine();
        let pat = e.generate_32mm_pattern(720.0, 560.0, None, "Left Side");
        assert_eq!(pat.panel_label, "Left Side");
        assert!(!pat.holes.is_empty());
        assert!(pat.holes_per_column > 0);
    }

    #[test]
    fn test_32mm_pattern_front_column_x() {
        let e = engine();
        let pat = e.generate_32mm_pattern(720.0, 560.0, None, "Left Side");
        assert!((pat.front_column_x - MM32_FRONT_INSET).abs() < 1e-9);
    }

    #[test]
    fn test_32mm_pattern_rear_column_x() {
        let e = engine();
        let panel_depth = 560.0;
        let pat = e.generate_32mm_pattern(720.0, panel_depth, None, "Left Side");
        let expected = panel_depth - MM32_REAR_INSET;
        assert!((pat.rear_column_x - expected).abs() < 1e-9);
    }

    #[test]
    fn test_32mm_pattern_hole_count_two_columns() {
        let e = engine();
        let pat = e.generate_32mm_pattern(720.0, 560.0, None, "L");
        // Each position generates 2 holes (front + rear column).
        assert_eq!(pat.holes.len(), pat.holes_per_column as usize * 2);
    }

    #[test]
    fn test_32mm_pattern_spacing_32mm() {
        let e = engine();
        let pat = e.generate_32mm_pattern(720.0, 560.0, None, "L");
        let front_holes: Vec<_> = pat.holes.iter().filter(|h| {
            (h.x - MM32_FRONT_INSET).abs() < 1e-6
        }).collect();
        if front_holes.len() >= 2 {
            let delta = front_holes[1].y - front_holes[0].y;
            assert!((delta - MM32_SPACING).abs() < 1e-6);
        }
    }

    #[test]
    fn test_32mm_pattern_hole_diameter() {
        let e = engine();
        let pat = e.generate_32mm_pattern(720.0, 560.0, None, "L");
        for hole in &pat.holes {
            assert!((hole.diameter - SYSTEM_HOLE_DIA).abs() < 1e-9);
        }
    }

    #[test]
    fn test_32mm_pattern_hinge_locations_on_front_column() {
        let e = engine();
        let pat = e.generate_32mm_pattern(720.0, 560.0, None, "L");
        // Rear column holes should never be flagged as hinge locations.
        let rear_hinge = pat
            .holes
            .iter()
            .filter(|h| (h.x - pat.rear_column_x).abs() < 1e-6 && h.is_hinge_location)
            .count();
        assert_eq!(rear_hinge, 0);
    }

    #[test]
    fn test_32mm_pattern_custom_first_hole() {
        let e = engine();
        let pat = e.generate_32mm_pattern(720.0, 560.0, Some(50.0), "L");
        let first_front = pat
            .holes
            .iter()
            .filter(|h| (h.x - MM32_FRONT_INSET).abs() < 1e-6)
            .min_by(|a, b| a.y.partial_cmp(&b.y).unwrap())
            .unwrap();
        assert!((first_front.y - 50.0).abs() < 1e-6);
    }

    #[test]
    fn test_32mm_pattern_tall_panel() {
        let e = engine();
        let pat = e.generate_32mm_pattern(2100.0, 560.0, None, "Tall Left");
        // Tall panel should have significantly more holes than a 720 mm panel.
        let normal = engine().generate_32mm_pattern(720.0, 560.0, None, "Normal");
        assert!(pat.holes_per_column > normal.holes_per_column);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 14. calculate_overlay
    // ════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_overlay_faceframe_standard() {
        let e = engine();
        let spec = e.calculate_overlay(ConstructionMethod::FaceFrame, &default_prefs());
        assert!((spec.hinge_side - 9.5).abs() < 1e-9);
        assert!((spec.opposite_side - 9.5).abs() < 1e-9);
        assert!((spec.top - 9.5).abs() < 1e-9);
        assert!((spec.bottom - 9.5).abs() < 1e-9);
    }

    #[test]
    fn test_overlay_frameless_full_overlay() {
        let e = engine();
        let spec = e.calculate_overlay(ConstructionMethod::Frameless, &default_prefs());
        assert!((spec.hinge_side - 18.0).abs() < 1e-9);
        assert!((spec.opposite_side - 18.0).abs() < 1e-9);
    }

    #[test]
    fn test_overlay_inset_zero_overlay() {
        let e = engine();
        let spec = e.calculate_overlay(ConstructionMethod::Inset, &default_prefs());
        assert!((spec.hinge_side - 0.0).abs() < 1e-9);
        assert!((spec.opposite_side - 0.0).abs() < 1e-9);
        assert!((spec.top - 0.0).abs() < 1e-9);
        assert!((spec.bottom - 0.0).abs() < 1e-9);
    }

    #[test]
    fn test_overlay_inset_minimum_reveal() {
        let e = engine();
        let mut prefs = default_prefs();
        prefs.door_to_frame_gap = 0.5; // below minimum
        let spec = e.calculate_overlay(ConstructionMethod::Inset, &prefs);
        // Minimum gap should be 1.6 mm (1/16").
        assert!(spec.reveal >= 1.6);
    }

    #[test]
    fn test_overlay_hybrid_full_overlay() {
        let e = engine();
        let spec = e.calculate_overlay(ConstructionMethod::Hybrid, &default_prefs());
        assert!((spec.hinge_side - 18.0).abs() < 1e-9);
    }

    #[test]
    fn test_overlay_extra_overlay_applied() {
        let e = engine();
        let mut prefs = default_prefs();
        prefs.extra_overlay = 3.0;
        let spec = e.calculate_overlay(ConstructionMethod::FaceFrame, &prefs);
        assert!((spec.hinge_side - (9.5 + 3.0)).abs() < 1e-9);
    }

    #[test]
    fn test_overlay_door_width_for_opening() {
        let e = engine();
        let spec = e.calculate_overlay(ConstructionMethod::Frameless, &default_prefs());
        let door_w = spec.door_width_for_opening(400.0);
        assert!((door_w - (400.0 + 18.0 + 18.0)).abs() < 1e-9);
    }

    #[test]
    fn test_overlay_door_height_for_opening() {
        let e = engine();
        let spec = e.calculate_overlay(ConstructionMethod::Frameless, &default_prefs());
        let door_h = spec.door_height_for_opening(600.0);
        assert!((door_h - (600.0 + 18.0 + 18.0)).abs() < 1e-9);
    }

    #[test]
    fn test_overlay_reveal_matches_prefs() {
        let e = engine();
        let mut prefs = default_prefs();
        prefs.door_gap = 4.0;
        let spec = e.calculate_overlay(ConstructionMethod::Frameless, &prefs);
        assert!((spec.reveal - 4.0).abs() < 1e-9);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 15. calculate_toe_kick
    // ════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_toe_kick_base_cabinet_returns_some() {
        let e = engine();
        assert!(e
            .calculate_toe_kick(ConstructionMethod::FaceFrame, ProductCategory::BaseCabinet)
            .is_some());
    }

    #[test]
    fn test_toe_kick_wall_cabinet_returns_none() {
        let e = engine();
        assert!(e
            .calculate_toe_kick(ConstructionMethod::Frameless, ProductCategory::WallCabinet)
            .is_none());
    }

    #[test]
    fn test_toe_kick_furniture_returns_none() {
        let e = engine();
        for method in [
            ConstructionMethod::Frameless,
            ConstructionMethod::FaceFrame,
            ConstructionMethod::Inset,
            ConstructionMethod::Hybrid,
        ] {
            assert!(
                e.calculate_toe_kick(method, ProductCategory::Furniture).is_none(),
                "Expected None for {:?} + Furniture",
                method
            );
        }
    }

    #[test]
    fn test_toe_kick_standard_height_89mm() {
        let e = engine();
        for method in [
            ConstructionMethod::Frameless,
            ConstructionMethod::FaceFrame,
            ConstructionMethod::Inset,
            ConstructionMethod::Hybrid,
        ] {
            let tk = e
                .calculate_toe_kick(method, ProductCategory::BaseCabinet)
                .unwrap();
            assert!(
                (tk.height - 89.0).abs() < 1e-9,
                "Expected 89 mm height for {:?}",
                method
            );
        }
    }

    #[test]
    fn test_toe_kick_standard_depth_76mm() {
        let e = engine();
        let tk = e
            .calculate_toe_kick(ConstructionMethod::FaceFrame, ProductCategory::BaseCabinet)
            .unwrap();
        assert!((tk.depth - 76.0).abs() < 1e-9);
    }

    #[test]
    fn test_toe_kick_is_applied_panel() {
        let e = engine();
        for method in [
            ConstructionMethod::Frameless,
            ConstructionMethod::FaceFrame,
            ConstructionMethod::Inset,
            ConstructionMethod::Hybrid,
        ] {
            let tk = e
                .calculate_toe_kick(method, ProductCategory::BaseCabinet)
                .unwrap();
            assert!(tk.is_applied_panel, "Expected applied panel for {:?}", method);
            assert!(tk.panel_thickness.is_some());
        }
    }

    #[test]
    fn test_toe_kick_vanity_returns_some() {
        let e = engine();
        assert!(e
            .calculate_toe_kick(ConstructionMethod::Frameless, ProductCategory::Vanity)
            .is_some());
    }

    #[test]
    fn test_toe_kick_tall_cabinet_returns_some() {
        let e = engine();
        assert!(e
            .calculate_toe_kick(ConstructionMethod::Hybrid, ProductCategory::TallCabinet)
            .is_some());
    }

    // ════════════════════════════════════════════════════════════════════════
    // 16. validate_method
    // ════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_validate_frameless_base_ok() {
        let e = engine();
        let errors = e.validate_method(
            ConstructionMethod::Frameless,
            ProductCategory::BaseCabinet,
        );
        assert!(errors.is_empty());
    }

    #[test]
    fn test_validate_faceframe_base_ok() {
        let e = engine();
        let errors =
            e.validate_method(ConstructionMethod::FaceFrame, ProductCategory::BaseCabinet);
        assert!(errors.is_empty());
    }

    #[test]
    fn test_validate_hybrid_wall_ok() {
        let e = engine();
        let errors =
            e.validate_method(ConstructionMethod::Hybrid, ProductCategory::WallCabinet);
        assert!(errors.is_empty());
    }

    #[test]
    fn test_validate_frameless_wall_ok() {
        let e = engine();
        let errors =
            e.validate_method(ConstructionMethod::Frameless, ProductCategory::WallCabinet);
        assert!(errors.is_empty());
    }

    #[test]
    fn test_validate_inset_furniture_warning() {
        let e = engine();
        let errors =
            e.validate_method(ConstructionMethod::Inset, ProductCategory::Furniture);
        assert!(!errors.is_empty());
        assert!(!errors[0].is_blocking);
    }

    #[test]
    fn test_validate_inset_tall_warning() {
        let e = engine();
        let errors =
            e.validate_method(ConstructionMethod::Inset, ProductCategory::TallCabinet);
        assert!(!errors.is_empty());
        assert!(!errors[0].is_blocking);
    }

    #[test]
    fn test_validate_inset_closet_warning() {
        let e = engine();
        let errors =
            e.validate_method(ConstructionMethod::Inset, ProductCategory::Closet);
        assert!(!errors.is_empty());
    }

    #[test]
    fn test_validate_inset_wardrobe_warning() {
        let e = engine();
        let errors =
            e.validate_method(ConstructionMethod::Inset, ProductCategory::Wardrobe);
        assert!(!errors.is_empty());
    }

    #[test]
    fn test_validate_error_fields_populated() {
        let e = engine();
        let errors =
            e.validate_method(ConstructionMethod::Inset, ProductCategory::Furniture);
        let err = &errors[0];
        assert_eq!(err.method, ConstructionMethod::Inset);
        assert_eq!(err.category, ProductCategory::Furniture);
        assert!(!err.message.is_empty());
    }

    // ════════════════════════════════════════════════════════════════════════
    // 17. Engine helpers
    // ════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_count_parts_by_type() {
        let e = engine();
        let parts = e.determine_parts(&base_dims(), ConstructionMethod::FaceFrame);
        let side_count = e.count_parts_by_type(&parts, CarcassPartType::Side);
        assert_eq!(side_count, 2);
    }

    #[test]
    fn test_total_sheet_area_positive() {
        let e = engine();
        let parts = e.determine_parts(&base_dims(), ConstructionMethod::Frameless);
        assert!(e.total_sheet_area(&parts) > 0.0);
    }

    #[test]
    fn test_total_sheet_area_empty_parts() {
        let e = engine();
        assert_eq!(e.total_sheet_area(&[]), 0.0);
    }

    #[test]
    fn test_default_panel_thickness() {
        let e = engine();
        assert!(
            (e.default_panel_thickness(ConstructionMethod::Frameless) - DEFAULT_PANEL_THICKNESS)
                .abs()
                < 1e-9
        );
    }

    // ════════════════════════════════════════════════════════════════════════
    // 18. Serialisation round-trip
    // ════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_construction_method_serde_roundtrip() {
        let methods = [
            ConstructionMethod::FaceFrame,
            ConstructionMethod::Frameless,
            ConstructionMethod::Inset,
            ConstructionMethod::Hybrid,
        ];
        for m in &methods {
            let json = serde_json::to_string(m).unwrap();
            let back: ConstructionMethod = serde_json::from_str(&json).unwrap();
            assert_eq!(*m, back);
        }
    }

    #[test]
    fn test_carcass_part_serde_roundtrip() {
        let p = CarcassPart::new("Side", CarcassPartType::Side, 560.0, 720.0, 18.0, 1, "eb");
        let json = serde_json::to_string(&p).unwrap();
        let back: CarcassPart = serde_json::from_str(&json).unwrap();
        assert_eq!(p, back);
    }

    #[test]
    fn test_system_hole_serde_roundtrip() {
        let e = engine();
        let pat = e.generate_32mm_pattern(720.0, 560.0, None, "L");
        let json = serde_json::to_string(&pat).unwrap();
        let back: SystemHolePattern = serde_json::from_str(&json).unwrap();
        assert_eq!(pat.holes.len(), back.holes.len());
    }

    #[test]
    fn test_overlay_spec_serde_roundtrip() {
        let e = engine();
        let spec = e.calculate_overlay(ConstructionMethod::FaceFrame, &default_prefs());
        let json = serde_json::to_string(&spec).unwrap();
        let back: OverlaySpec = serde_json::from_str(&json).unwrap();
        assert!((spec.hinge_side - back.hinge_side).abs() < 1e-9);
    }

    #[test]
    fn test_toe_kick_spec_serde_roundtrip() {
        let e = engine();
        let tk = e
            .calculate_toe_kick(ConstructionMethod::FaceFrame, ProductCategory::BaseCabinet)
            .unwrap();
        let json = serde_json::to_string(&tk).unwrap();
        let back: ToeKickSpec = serde_json::from_str(&json).unwrap();
        assert!((tk.height - back.height).abs() < 1e-9);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 19. Edge cases
    // ════════════════════════════════════════════════════════════════════════

    #[test]
    fn test_32mm_pattern_very_short_panel_no_crash() {
        let e = engine();
        // Panel height shorter than 2× first-hole inset – pattern may be empty but no panic.
        let pat = e.generate_32mm_pattern(60.0, 560.0, None, "Short");
        // Should not panic; holes may be zero or one row.
        let _ = pat.holes_per_column;
    }

    #[test]
    fn test_determine_parts_minimal_dimensions() {
        let e = engine();
        let dims = ProductDimensions::new(300.0, 300.0, 300.0, ProductCategory::WallCabinet);
        let parts = e.determine_parts(&dims, ConstructionMethod::Frameless);
        assert!(!parts.is_empty());
    }

    #[test]
    fn test_overlay_spec_description_not_empty() {
        let e = engine();
        for method in [
            ConstructionMethod::FaceFrame,
            ConstructionMethod::Frameless,
            ConstructionMethod::Inset,
            ConstructionMethod::Hybrid,
        ] {
            let spec = e.calculate_overlay(method, &default_prefs());
            assert!(
                !spec.description.is_empty(),
                "Description empty for {:?}",
                method
            );
        }
    }

    #[test]
    fn test_joinery_operation_fields_populated() {
        let e = engine();
        for method in [
            ConstructionMethod::Frameless,
            ConstructionMethod::FaceFrame,
            ConstructionMethod::Inset,
            ConstructionMethod::Hybrid,
        ] {
            let ops = e.calculate_joinery(method, DEFAULT_PANEL_THICKNESS);
            for op in &ops {
                assert!(
                    !op.description.is_empty(),
                    "Empty description for {:?}",
                    method
                );
            }
        }
    }

    #[test]
    fn test_nailer_present_all_methods() {
        let e = engine();
        for method in [
            ConstructionMethod::Frameless,
            ConstructionMethod::FaceFrame,
            ConstructionMethod::Inset,
            ConstructionMethod::Hybrid,
        ] {
            let parts = e.determine_parts(&base_dims(), method);
            assert!(
                e.count_parts_by_type(&parts, CarcassPartType::Nailer) >= 1,
                "No nailer for {:?}",
                method
            );
        }
    }
}
