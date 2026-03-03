//! Dovetail Generator – Feature 6
//!
//! Generates complete drawer-box parts with dovetail joinery geometry
//! and CNC machining operations (router paths, dados).
//!
//! Joint types supported:
//!   - Through dovetail  (classic hand-cut look, full thickness)
//!   - Half-blind dovetail (concealed from front, used on drawer fronts)
//!   - Sliding dovetail  (one elongated tail slides into a socket)
//!   - Box joint (finger joint – equal-width pins/tails, 90° walls)

use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

/// The kind of dovetail (or analogous) joint used at the corners of a drawer box.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DovetailJointType {
    /// Classic through-dovetail – joint fully visible from both faces.
    Through,
    /// Half-blind dovetail – tails are hidden from one face (typically the drawer front).
    HalfBlind,
    /// A single elongated tail that slides into a long socket (used for shelves / dividers).
    SlidingDovetail,
    /// Box (finger) joint – square interlocking fingers; simpler CNC setup.
    BoxJoint,
}

impl Default for DovetailJointType {
    fn default() -> Self {
        DovetailJointType::Through
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Structs
// ─────────────────────────────────────────────────────────────────────────────

/// Full specification for a drawer box to be generated.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DrawerBoxSpec {
    /// Overall outer width of the drawer box (mm).
    pub width: f64,
    /// Overall outer depth / run of the drawer box (mm).
    pub depth: f64,
    /// Overall outer height of the drawer box (mm).
    pub height: f64,
    /// Thickness of the side / front / back boards (mm).
    pub material_thickness: f64,
    /// Thickness of the bottom panel (mm).
    pub bottom_thickness: f64,
    /// Type of corner joint to use.
    pub joint_type: DovetailJointType,
}

/// A single side / panel that makes up the drawer box.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DrawerSide {
    /// Unique identifier for this part.
    pub id: Uuid,
    /// Human-readable label (e.g. "Left Side", "Back").
    pub label: String,
    /// Finished length of this board (mm).
    pub length: f64,
    /// Finished width (height) of this board (mm).
    pub width: f64,
    /// Board thickness (mm).
    pub thickness: f64,
    /// CNC operations required to machine this part.
    pub operations: Vec<DovetailOperation>,
}

/// The assembled drawer box containing all five parts.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DrawerBox {
    /// Unique identifier for this drawer box assembly.
    pub id: Uuid,
    /// Four perimeter sides of the box.
    pub sides: Vec<DrawerSide>,
    /// The bottom panel of the box.
    pub bottom: DrawerSide,
    /// Resolved joint geometry (same geometry applies to all corners for a given spec).
    pub joint_geometry: DovetailGeometry,
}

/// Fully resolved geometry for one set of dovetail (or box) joints.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct DovetailGeometry {
    /// Number of full pins (or fingers for box joint).
    pub pin_count: u32,
    /// Width of each pin at its narrowest point (at the baseline) in mm.
    pub pin_width: f64,
    /// Width of each tail at its widest point (at the baseline) in mm.
    pub tail_width: f64,
    /// Centre-to-centre spacing between adjacent pins (mm).
    pub pin_spacing: f64,
    /// Depth the joint is cut into the board (mm).
    pub socket_depth: f64,
    /// Width of the half-pin at each edge of the board (mm).
    pub half_pin_width: f64,
    /// Angle of the dovetail walls in degrees (0° = box joint).
    pub angle_degrees: f64,
}

/// A single CNC machining operation on a drawer part.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DovetailOperation {
    /// Unique identifier for this operation.
    pub id: Uuid,
    /// Human-readable description.
    pub description: String,
    /// Operation kind: "profile_cut", "pocket", "dado", "drill".
    pub operation_type: String,
    /// X start position on the part (mm from left edge).
    pub x_start: f64,
    /// Y start position (mm from bottom edge).
    pub y_start: f64,
    /// Cut depth below the surface (mm, positive value).
    pub depth: f64,
    /// Width of the toolpath / feature (mm).
    pub width: f64,
    /// Length / pass distance along the board (mm).
    pub length: f64,
    /// Recommended tool diameter (mm).
    pub tool_diameter: f64,
    /// Feed rate (mm/min).
    pub feed_rate: f64,
    /// Spindle speed (RPM).
    pub spindle_speed: f64,
    /// Extra structured data (pass count, angle, etc.).
    pub metadata: serde_json::Value,
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation error
// ─────────────────────────────────────────────────────────────────────────────

/// Errors returned by [`DovetailGenerator::validate_spec`].
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ValidationError {
    WidthTooSmall { given: f64, minimum: f64 },
    DepthTooSmall { given: f64, minimum: f64 },
    HeightTooSmall { given: f64, minimum: f64 },
    MaterialThicknessTooSmall { given: f64, minimum: f64 },
    MaterialThicknessTooLarge { given: f64, maximum: f64 },
    BottomThicknessTooSmall { given: f64, minimum: f64 },
    BottomThicknessTooLarge { given: f64, maximum: f64 },
    InsufficientInteriorSpace,
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/// Minimum board length that can sensibly hold at least one dovetail joint (mm).
/// Used as a lower bound for side_len calculation checks.
const MIN_BOARD_LENGTH: f64 = 50.0;
/// Minimum board width (height) for a drawer side (mm).
const MIN_BOARD_WIDTH: f64 = 30.0;
/// Minimum material thickness (mm).
const MIN_MATERIAL_THICKNESS: f64 = 6.0;
/// Maximum material thickness (mm) – thicker boards need a different workflow.
const MAX_MATERIAL_THICKNESS: f64 = 50.0;
/// Minimum bottom panel thickness (mm).
const MIN_BOTTOM_THICKNESS: f64 = 3.0;
/// Maximum bottom panel thickness relative to material_thickness (ratio).
const MAX_BOTTOM_THICKNESS_RATIO: f64 = 0.75;
/// Approximate spacing between joint centres (used to derive pin_count).
const JOINT_SPACING_MM: f64 = 22.0;
/// Minimum width of a drawer (must fit at least one joint with two half-pins).
const MIN_WIDTH: f64 = 80.0;
/// Minimum depth of a drawer.
const MIN_DEPTH: f64 = 80.0;
/// Minimum height of a drawer.
const MIN_HEIGHT: f64 = 30.0;
/// Dado groove width (bottom panel slot) equals bottom_thickness + 0.5 mm clearance.
const DADO_CLEARANCE: f64 = 0.5;
/// Distance from the bottom edge of the side to the centre of the dado (mm).
const DADO_BOTTOM_OFFSET: f64 = 9.0;
/// Default router bit diameter for profile/pocket cuts (mm).
const DEFAULT_TOOL_DIAMETER: f64 = 6.0;
/// Default dado bit diameter (mm).
const DADO_TOOL_DIAMETER: f64 = 6.0;
/// Default feed rate for hardwood joinery cuts (mm/min).
const DEFAULT_FEED_RATE: f64 = 2000.0;
/// Default spindle speed (RPM).
const DEFAULT_SPINDLE_SPEED: f64 = 18000.0;

// ─────────────────────────────────────────────────────────────────────────────
// Generator
// ─────────────────────────────────────────────────────────────────────────────

/// Generates drawer-box parts with dovetail (or box-joint) joinery for CNC machining.
pub struct DovetailGenerator;

impl DovetailGenerator {
    pub fn new() -> Self {
        Self
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /// Validate a [`DrawerBoxSpec`] and return all constraint violations found.
    /// Returns `Ok(())` when the spec is valid, or `Err(Vec<ValidationError>)`.
    pub fn validate_spec(&self, spec: &DrawerBoxSpec) -> Result<(), Vec<ValidationError>> {
        let mut errors = Vec::new();

        if spec.width < MIN_WIDTH {
            errors.push(ValidationError::WidthTooSmall {
                given: spec.width,
                minimum: MIN_WIDTH,
            });
        }
        if spec.depth < MIN_DEPTH {
            errors.push(ValidationError::DepthTooSmall {
                given: spec.depth,
                minimum: MIN_DEPTH,
            });
        }
        if spec.height < MIN_HEIGHT {
            errors.push(ValidationError::HeightTooSmall {
                given: spec.height,
                minimum: MIN_HEIGHT,
            });
        }
        if spec.material_thickness < MIN_MATERIAL_THICKNESS {
            errors.push(ValidationError::MaterialThicknessTooSmall {
                given: spec.material_thickness,
                minimum: MIN_MATERIAL_THICKNESS,
            });
        }
        if spec.material_thickness > MAX_MATERIAL_THICKNESS {
            errors.push(ValidationError::MaterialThicknessTooLarge {
                given: spec.material_thickness,
                maximum: MAX_MATERIAL_THICKNESS,
            });
        }
        if spec.bottom_thickness < MIN_BOTTOM_THICKNESS {
            errors.push(ValidationError::BottomThicknessTooSmall {
                given: spec.bottom_thickness,
                minimum: MIN_BOTTOM_THICKNESS,
            });
        }
        let max_bottom = spec.material_thickness * MAX_BOTTOM_THICKNESS_RATIO;
        if spec.bottom_thickness > max_bottom {
            errors.push(ValidationError::BottomThicknessTooLarge {
                given: spec.bottom_thickness,
                maximum: max_bottom,
            });
        }

        // Interior height must leave room for at least the bottom dado + a margin.
        let interior_height = spec.height - 2.0 * spec.material_thickness;
        if interior_height < 10.0 {
            errors.push(ValidationError::InsufficientInteriorSpace);
        }

        // Check that resulting board lengths are long enough for at least one joint.
        // side_len = depth - 2*t must be ≥ MIN_BOARD_LENGTH; board height ≥ MIN_BOARD_WIDTH.
        let side_len = spec.depth - 2.0 * spec.material_thickness;
        if side_len < MIN_BOARD_LENGTH {
            errors.push(ValidationError::DepthTooSmall {
                given: spec.depth,
                minimum: MIN_BOARD_LENGTH + 2.0 * spec.material_thickness,
            });
        }
        if spec.height < MIN_BOARD_WIDTH {
            errors.push(ValidationError::HeightTooSmall {
                given: spec.height,
                minimum: MIN_BOARD_WIDTH,
            });
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    /// Generate a complete drawer box from a [`DrawerBoxSpec`].
    ///
    /// Returns a [`DrawerBox`] containing four perimeter sides, one bottom panel,
    /// and the resolved joint geometry.  Every part carries its full list of
    /// [`DovetailOperation`]s ready for post-processing into G-code.
    pub fn generate_drawer_box(&self, spec: &DrawerBoxSpec) -> DrawerBox {
        // ── Board lengths ──────────────────────────────────────────────────
        // Width-direction boards (front / back): run the full outer width.
        // Depth-direction boards (left / right sides): fit between the front
        // and back boards, so their length = outer_depth − 2 × mat_thickness.
        let t = spec.material_thickness;
        let front_back_len = spec.width;
        let side_len = spec.depth - 2.0 * t;
        let board_height = spec.height; // all four sides are the same height

        // ── Joint geometry (shared by all four corners) ───────────────────
        // We compute geometry based on the shorter board (sides) for consistency.
        let geom = self.calculate_joint_geometry(
            side_len.min(front_back_len),
            t,
            self.default_angle_for_joint(&spec.joint_type),
        );

        // ── Build the four sides ───────────────────────────────────────────
        let front = self.build_side("Front", front_back_len, board_height, t, spec, &geom, true);
        let back = self.build_side("Back", front_back_len, board_height, t, spec, &geom, true);
        let left = self.build_side("Left Side", side_len, board_height, t, spec, &geom, false);
        let right = self.build_side("Right Side", side_len, board_height, t, spec, &geom, false);

        // ── Bottom panel ────────────────────────────────────────────────────
        let bottom = self.generate_box_bottom(spec);

        DrawerBox {
            id: Uuid::new_v4(),
            sides: vec![front, back, left, right],
            bottom,
            joint_geometry: geom,
        }
    }

    /// Calculate the resolved geometry for a dovetail (or box) joint.
    ///
    /// * `board_length`   – length of the board along which joints are spaced (mm).
    /// * `board_thickness`– thickness of the board being jointed (mm).
    /// * `dovetail_angle` – included half-angle of the dovetail walls (degrees).
    ///                      Use 14° for hardwood, 10° for softwood, 0° for box joint.
    pub fn calculate_joint_geometry(
        &self,
        board_length: f64,
        board_thickness: f64,
        dovetail_angle: f64,
    ) -> DovetailGeometry {
        // ── Pin count ──────────────────────────────────────────────────────
        // We fit as many joints as will fill the board at ~JOINT_SPACING_MM,
        // with a minimum of 1.
        let raw_count = (board_length / JOINT_SPACING_MM).floor() as u32;
        let pin_count = raw_count.max(1);

        // ── Spacing & widths ───────────────────────────────────────────────
        // Layout: [half-pin | tail | pin | tail | … | pin | tail | half-pin]
        //
        // With `n` pins and `n+1` tails the board is divided so that:
        //   half_pin_width = pin_spacing / 2
        //   total = 2 * half_pin + n * pin_width + (n+1) * tail_width
        //         = pin_count * pin_spacing / 2    (by construction below)
        //
        // We use the standard ratio: tail_width ≈ 1.5 × pin_width for hardwood.
        // For box joints (angle = 0°) the two widths are equal.

        let pin_spacing = board_length / (pin_count as f64 + 0.5);
        let (pin_width, tail_width) = if dovetail_angle.abs() < f64::EPSILON {
            // Box joint – equal fingers
            let w = pin_spacing * 0.5;
            (w, w)
        } else {
            // Dovetail – tail is wider than pin
            let pin_w = pin_spacing / 2.5; // pin takes 1/2.5 of spacing
            let tail_w = pin_spacing - pin_w;
            (pin_w, tail_w)
        };
        let half_pin_width = pin_width * 0.5;

        // ── Socket depth ───────────────────────────────────────────────────
        // Standard: cut to (material_thickness − 1 mm) so the joint is proud
        // before final flush-trimming.
        let socket_depth = (board_thickness - 1.0).max(1.0);

        DovetailGeometry {
            pin_count,
            pin_width,
            tail_width,
            pin_spacing,
            socket_depth,
            half_pin_width,
            angle_degrees: dovetail_angle,
        }
    }

    /// Generate the CNC router operations needed to cut a set of dovetail joints
    /// on one end of a board.
    ///
    /// * `board_height` – board dimension perpendicular to the joint (i.e. the
    ///                    board height/width that is being jointed).
    /// * `is_pin_board`  – `true` when cutting the pin board (front/back),
    ///                    `false` when cutting the tail board (side).
    /// * `x_offset`      – position along the board where this joint cluster starts.
    pub fn generate_dovetail_operations(
        &self,
        geom: &DovetailGeometry,
        board_height: f64,
        board_thickness: f64,
        is_pin_board: bool,
        x_offset: f64,
        joint_type: &DovetailJointType,
    ) -> Vec<DovetailOperation> {
        match joint_type {
            DovetailJointType::BoxJoint => self.box_joint_operations(
                geom,
                board_height,
                board_thickness,
                is_pin_board,
                x_offset,
            ),
            DovetailJointType::SlidingDovetail => {
                self.sliding_dovetail_operations(geom, board_height, board_thickness, x_offset)
            }
            DovetailJointType::HalfBlind => self.half_blind_operations(
                geom,
                board_height,
                board_thickness,
                is_pin_board,
                x_offset,
            ),
            DovetailJointType::Through => self.through_dovetail_operations(
                geom,
                board_height,
                board_thickness,
                is_pin_board,
                x_offset,
            ),
        }
    }

    /// Generate the dado (groove) operations that hold the drawer bottom panel.
    ///
    /// The dado runs the full length of the board at `DADO_BOTTOM_OFFSET` mm
    /// from the bottom edge.  Its width = bottom_thickness + DADO_CLEARANCE.
    pub fn generate_dado_operations(
        &self,
        board_length: f64,
        board_thickness: f64,
        bottom_thickness: f64,
    ) -> Vec<DovetailOperation> {
        let dado_width = bottom_thickness + DADO_CLEARANCE;
        let dado_depth = board_thickness * 0.4; // 40 % of board thickness
        let y_pos = DADO_BOTTOM_OFFSET - dado_width * 0.5; // centre at offset

        vec![DovetailOperation {
            id: Uuid::new_v4(),
            description: "Bottom panel dado groove".to_string(),
            operation_type: "dado".to_string(),
            x_start: 0.0,
            y_start: y_pos,
            depth: dado_depth,
            width: dado_width,
            length: board_length,
            tool_diameter: DADO_TOOL_DIAMETER,
            feed_rate: DEFAULT_FEED_RATE,
            spindle_speed: DEFAULT_SPINDLE_SPEED,
            metadata: serde_json::json!({
                "passes": Self::pass_count(dado_depth, 3.0),
                "direction": "longitudinal",
                "clearance_fit": true,
            }),
        }]
    }

    /// Calculate the bottom panel dimensions, accounting for the dado inset.
    ///
    /// Returns a [`DrawerSide`] representing the bottom panel (no joint operations,
    /// only the cut-to-size definition).
    pub fn generate_box_bottom(&self, spec: &DrawerBoxSpec) -> DrawerSide {
        let t = spec.material_thickness;
        let dado_depth = t * 0.4;

        // The bottom slides into dados on all four sides.
        // Its outer size equals interior dimension + 2 × dado_depth.
        let interior_width = spec.width - 2.0 * t;
        let interior_depth = spec.depth - 2.0 * t;
        let bottom_length = interior_width + 2.0 * dado_depth;
        let bottom_width = interior_depth + 2.0 * dado_depth;

        DrawerSide {
            id: Uuid::new_v4(),
            label: "Bottom Panel".to_string(),
            length: bottom_length,
            width: bottom_width,
            thickness: spec.bottom_thickness,
            operations: vec![DovetailOperation {
                id: Uuid::new_v4(),
                description: "Cut bottom panel to size".to_string(),
                operation_type: "profile_cut".to_string(),
                x_start: 0.0,
                y_start: 0.0,
                depth: spec.bottom_thickness,
                width: bottom_width,
                length: bottom_length,
                tool_diameter: DEFAULT_TOOL_DIAMETER,
                feed_rate: DEFAULT_FEED_RATE,
                spindle_speed: DEFAULT_SPINDLE_SPEED,
                metadata: serde_json::json!({ "cut_type": "perimeter", "grain_direction": "length" }),
            }],
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    fn default_angle_for_joint(&self, jt: &DovetailJointType) -> f64 {
        match jt {
            DovetailJointType::Through => 14.0,
            DovetailJointType::HalfBlind => 14.0,
            DovetailJointType::SlidingDovetail => 14.0,
            DovetailJointType::BoxJoint => 0.0,
        }
    }

    /// Build a single [`DrawerSide`] with all required operations.
    fn build_side(
        &self,
        label: &str,
        length: f64,
        height: f64,
        thickness: f64,
        spec: &DrawerBoxSpec,
        geom: &DovetailGeometry,
        is_pin_board: bool,
    ) -> DrawerSide {
        let mut ops = Vec::new();

        // Joint operations at the left end (x_offset = 0).
        ops.extend(self.generate_dovetail_operations(
            geom,
            height,
            thickness,
            is_pin_board,
            0.0,
            &spec.joint_type,
        ));
        // Joint operations at the right end (x_offset = length − socket_depth).
        let right_offset = length - geom.socket_depth;
        ops.extend(self.generate_dovetail_operations(
            geom,
            height,
            thickness,
            is_pin_board,
            right_offset,
            &spec.joint_type,
        ));

        // Dado for bottom panel on all four sides.
        ops.extend(self.generate_dado_operations(length, thickness, spec.bottom_thickness));

        DrawerSide {
            id: Uuid::new_v4(),
            label: label.to_string(),
            length,
            width: height,
            thickness,
            operations: ops,
        }
    }

    // ── Through dovetail operations ────────────────────────────────────────

    fn through_dovetail_operations(
        &self,
        geom: &DovetailGeometry,
        board_height: f64,
        board_thickness: f64,
        is_pin_board: bool,
        x_offset: f64,
    ) -> Vec<DovetailOperation> {
        let mut ops = Vec::new();
        let n = geom.pin_count as usize;

        if is_pin_board {
            // Pin board: cut sockets (waste between pins) using pocket operations.
            // Layout: half-pin | tail-socket | pin | tail-socket | … | half-pin
            // We cut each tail-socket as a pocket.
            let angle_rad = geom.angle_degrees.to_radians();
            let taper = geom.socket_depth * angle_rad.tan(); // horizontal taper per depth

            // Tail sockets: there are (pin_count + 1) sockets
            let mut x_cursor = x_offset + geom.half_pin_width;
            for i in 0..=(n) {
                let socket_width = if i == 0 || i == n {
                    // Edge sockets are narrower – only half the tail emerges here.
                    geom.tail_width * 0.5
                } else {
                    geom.tail_width
                };

                ops.push(DovetailOperation {
                    id: Uuid::new_v4(),
                    description: format!("Through dovetail tail socket #{}", i + 1),
                    operation_type: "pocket".to_string(),
                    x_start: x_cursor,
                    y_start: 0.0,
                    depth: geom.socket_depth,
                    width: socket_width + 2.0 * taper,
                    length: board_height,
                    tool_diameter: DEFAULT_TOOL_DIAMETER,
                    feed_rate: DEFAULT_FEED_RATE,
                    spindle_speed: DEFAULT_SPINDLE_SPEED,
                    metadata: serde_json::json!({
                        "passes": Self::pass_count(geom.socket_depth, 4.0),
                        "angle_degrees": geom.angle_degrees,
                        "taper_mm": taper,
                        "socket_index": i,
                    }),
                });

                x_cursor += socket_width + geom.pin_width;
            }
        } else {
            // Tail board: cut away the waste between tails (i.e. the pin sockets).
            // Layout: [half-pin-socket | tail | pin-socket | tail | … | half-pin-socket]
            let angle_rad = geom.angle_degrees.to_radians();
            let taper = geom.socket_depth * angle_rad.tan();

            let mut x_cursor = x_offset;
            for i in 0..=n {
                let pocket_width = if i == 0 || i == n {
                    geom.half_pin_width
                } else {
                    geom.pin_width
                };

                ops.push(DovetailOperation {
                    id: Uuid::new_v4(),
                    description: format!("Through dovetail pin socket #{}", i + 1),
                    operation_type: "pocket".to_string(),
                    x_start: x_cursor,
                    y_start: 0.0,
                    depth: geom.socket_depth,
                    width: pocket_width - 2.0 * taper,
                    length: board_height,
                    tool_diameter: DEFAULT_TOOL_DIAMETER,
                    feed_rate: DEFAULT_FEED_RATE * 0.8,
                    spindle_speed: DEFAULT_SPINDLE_SPEED,
                    metadata: serde_json::json!({
                        "passes": Self::pass_count(geom.socket_depth, 4.0),
                        "angle_degrees": geom.angle_degrees,
                        "taper_mm": taper,
                        "socket_index": i,
                        "is_half_pin": i == 0 || i == n,
                    }),
                });

                x_cursor += pocket_width + geom.tail_width;
            }

            // Profile cleanup pass along the angled walls.
            ops.push(DovetailOperation {
                id: Uuid::new_v4(),
                description: "Dovetail angled wall profile pass".to_string(),
                operation_type: "profile_cut".to_string(),
                x_start: x_offset,
                y_start: 0.0,
                depth: geom.socket_depth,
                width: board_thickness,
                length: board_height,
                tool_diameter: DEFAULT_TOOL_DIAMETER,
                feed_rate: DEFAULT_FEED_RATE * 0.6,
                spindle_speed: DEFAULT_SPINDLE_SPEED,
                metadata: serde_json::json!({
                    "cut_type": "angled_wall_cleanup",
                    "angle_degrees": geom.angle_degrees,
                }),
            });
        }

        ops
    }

    // ── Half-blind dovetail operations ────────────────────────────────────

    fn half_blind_operations(
        &self,
        geom: &DovetailGeometry,
        board_height: f64,
        board_thickness: f64,
        is_pin_board: bool,
        x_offset: f64,
    ) -> Vec<DovetailOperation> {
        // Half-blind joints are similar to through dovetails but the pin board is
        // only cut to (material_thickness − 3 mm) to leave a face layer.
        let blind_depth = (board_thickness - 3.0).max(geom.socket_depth * 0.75);
        let geom_blind = DovetailGeometry {
            socket_depth: blind_depth,
            ..*geom
        };
        let mut ops = self.through_dovetail_operations(
            &geom_blind,
            board_height,
            board_thickness,
            is_pin_board,
            x_offset,
        );
        // Tag all ops as half-blind.
        for op in &mut ops {
            if let serde_json::Value::Object(ref mut m) = op.metadata {
                m.insert("half_blind".to_string(), serde_json::Value::Bool(true));
                m.insert("blind_depth_mm".to_string(), serde_json::json!(blind_depth));
            }
            op.description = format!("[Half-Blind] {}", op.description);
        }
        ops
    }

    // ── Sliding dovetail operations ────────────────────────────────────────

    fn sliding_dovetail_operations(
        &self,
        geom: &DovetailGeometry,
        board_height: f64,
        board_thickness: f64,
        x_offset: f64,
    ) -> Vec<DovetailOperation> {
        // A sliding dovetail is a single elongated tail / socket.
        let angle_rad = geom.angle_degrees.to_radians();
        let taper = geom.socket_depth * angle_rad.tan();
        let slot_width = geom.tail_width.max(board_thickness * 0.33);

        vec![
            // Socket (slot) cut – runs the full board height.
            DovetailOperation {
                id: Uuid::new_v4(),
                description: "Sliding dovetail socket".to_string(),
                operation_type: "pocket".to_string(),
                x_start: x_offset,
                y_start: 0.0,
                depth: geom.socket_depth,
                width: slot_width + 2.0 * taper,
                length: board_height,
                tool_diameter: DEFAULT_TOOL_DIAMETER,
                feed_rate: DEFAULT_FEED_RATE * 0.7,
                spindle_speed: DEFAULT_SPINDLE_SPEED,
                metadata: serde_json::json!({
                    "passes": Self::pass_count(geom.socket_depth, 4.0),
                    "angle_degrees": geom.angle_degrees,
                    "taper_mm": taper,
                    "sliding": true,
                }),
            },
            // Angled wall cleanup on both sides of the slot.
            DovetailOperation {
                id: Uuid::new_v4(),
                description: "Sliding dovetail wall cleanup – left".to_string(),
                operation_type: "profile_cut".to_string(),
                x_start: x_offset,
                y_start: 0.0,
                depth: geom.socket_depth,
                width: taper,
                length: board_height,
                tool_diameter: DEFAULT_TOOL_DIAMETER,
                feed_rate: DEFAULT_FEED_RATE * 0.5,
                spindle_speed: DEFAULT_SPINDLE_SPEED,
                metadata: serde_json::json!({ "wall_side": "left", "angle_degrees": geom.angle_degrees }),
            },
            DovetailOperation {
                id: Uuid::new_v4(),
                description: "Sliding dovetail wall cleanup – right".to_string(),
                operation_type: "profile_cut".to_string(),
                x_start: x_offset + slot_width + taper,
                y_start: 0.0,
                depth: geom.socket_depth,
                width: taper,
                length: board_height,
                tool_diameter: DEFAULT_TOOL_DIAMETER,
                feed_rate: DEFAULT_FEED_RATE * 0.5,
                spindle_speed: DEFAULT_SPINDLE_SPEED,
                metadata: serde_json::json!({ "wall_side": "right", "angle_degrees": geom.angle_degrees }),
            },
        ]
    }

    // ── Box joint operations ───────────────────────────────────────────────

    fn box_joint_operations(
        &self,
        geom: &DovetailGeometry,
        board_height: f64,
        _board_thickness: f64,
        is_pin_board: bool,
        x_offset: f64,
    ) -> Vec<DovetailOperation> {
        let mut ops = Vec::new();
        let n = geom.pin_count as usize;
        // Finger width = pin_spacing / 2 (equal pins and sockets).
        let finger_w = geom.pin_width;

        // Board A has fingers at positions 0, 2, 4 …
        // Board B (offset by one finger) has fingers at 1, 3, 5 …
        // We cut the sockets (waste spaces) for the matching board.
        let start_index: usize = if is_pin_board { 0 } else { 1 };

        let total_fingers = 2 * n + 1;
        for i in 0..total_fingers {
            if i % 2 == start_index % 2 {
                // This is a socket to remove.
                ops.push(DovetailOperation {
                    id: Uuid::new_v4(),
                    description: format!("Box joint socket #{}", i + 1),
                    operation_type: "pocket".to_string(),
                    x_start: x_offset + i as f64 * finger_w,
                    y_start: 0.0,
                    depth: geom.socket_depth,
                    width: finger_w,
                    length: board_height,
                    tool_diameter: DEFAULT_TOOL_DIAMETER,
                    feed_rate: DEFAULT_FEED_RATE,
                    spindle_speed: DEFAULT_SPINDLE_SPEED,
                    metadata: serde_json::json!({
                        "passes": Self::pass_count(geom.socket_depth, 4.0),
                        "finger_index": i,
                        "joint_type": "box_joint",
                        "angle_degrees": 0,
                    }),
                });
            }
        }
        ops
    }

    /// Calculate number of depth passes needed given total depth and max-per-pass.
    fn pass_count(total_depth: f64, max_per_pass: f64) -> u32 {
        ((total_depth / max_per_pass).ceil() as u32).max(1)
    }
}

impl Default for DovetailGenerator {
    fn default() -> Self {
        Self::new()
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── Helpers ──────────────────────────────────────────────────────────────

    fn standard_spec() -> DrawerBoxSpec {
        DrawerBoxSpec {
            width: 400.0,
            depth: 500.0,
            height: 120.0,
            material_thickness: 18.0,
            bottom_thickness: 6.0,
            joint_type: DovetailJointType::Through,
        }
    }

    fn gen() -> DovetailGenerator {
        DovetailGenerator::new()
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. DovetailGenerator construction
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_generator_new() {
        let _g = DovetailGenerator::new();
    }

    #[test]
    fn test_generator_default() {
        let _g = DovetailGenerator::default();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. calculate_joint_geometry
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_geometry_through_dovetail_pin_count() {
        let g = gen();
        let geom = g.calculate_joint_geometry(200.0, 18.0, 14.0);
        assert!(geom.pin_count >= 1, "must have at least 1 pin");
        // 200 mm / 22 mm ≈ 9 pins
        assert_eq!(geom.pin_count, 9);
    }

    #[test]
    fn test_geometry_short_board_min_one_pin() {
        let g = gen();
        let geom = g.calculate_joint_geometry(30.0, 18.0, 14.0);
        assert_eq!(geom.pin_count, 1, "short board must still produce 1 pin");
    }

    #[test]
    fn test_geometry_pin_spacing_positive() {
        let g = gen();
        let geom = g.calculate_joint_geometry(300.0, 18.0, 14.0);
        assert!(geom.pin_spacing > 0.0);
    }

    #[test]
    fn test_geometry_tail_wider_than_pin_for_dovetail() {
        let g = gen();
        let geom = g.calculate_joint_geometry(300.0, 18.0, 14.0);
        assert!(
            geom.tail_width > geom.pin_width,
            "tails should be wider than pins in a dovetail joint"
        );
    }

    #[test]
    fn test_geometry_box_joint_equal_widths() {
        let g = gen();
        let geom = g.calculate_joint_geometry(300.0, 18.0, 0.0);
        let diff = (geom.pin_width - geom.tail_width).abs();
        assert!(diff < 1e-9, "box joint must have equal pin/tail widths");
    }

    #[test]
    fn test_geometry_socket_depth() {
        let g = gen();
        let board_t = 18.0_f64;
        let geom = g.calculate_joint_geometry(300.0, board_t, 14.0);
        let expected = board_t - 1.0;
        assert!((geom.socket_depth - expected).abs() < 1e-9);
    }

    #[test]
    fn test_geometry_socket_depth_thin_board() {
        let g = gen();
        // Board thickness 6 mm → depth = 5 mm (≥ 1)
        let geom = g.calculate_joint_geometry(100.0, 6.0, 14.0);
        assert!(geom.socket_depth >= 1.0);
    }

    #[test]
    fn test_geometry_half_pin_is_half_pin_width() {
        let g = gen();
        let geom = g.calculate_joint_geometry(300.0, 18.0, 14.0);
        let diff = (geom.half_pin_width - geom.pin_width * 0.5).abs();
        assert!(diff < 1e-9);
    }

    #[test]
    fn test_geometry_angle_preserved() {
        let g = gen();
        let geom = g.calculate_joint_geometry(300.0, 18.0, 10.0);
        assert!((geom.angle_degrees - 10.0).abs() < 1e-9);
    }

    #[test]
    fn test_geometry_angle_14_hardwood() {
        let g = gen();
        let geom = g.calculate_joint_geometry(300.0, 18.0, 14.0);
        assert!((geom.angle_degrees - 14.0).abs() < 1e-9);
    }

    #[test]
    fn test_geometry_pin_count_scales_with_length() {
        let g = gen();
        let geom_short = g.calculate_joint_geometry(100.0, 18.0, 14.0);
        let geom_long = g.calculate_joint_geometry(500.0, 18.0, 14.0);
        assert!(geom_long.pin_count > geom_short.pin_count);
    }

    #[test]
    fn test_geometry_all_widths_positive() {
        let g = gen();
        let geom = g.calculate_joint_geometry(400.0, 18.0, 14.0);
        assert!(geom.pin_width > 0.0);
        assert!(geom.tail_width > 0.0);
        assert!(geom.half_pin_width > 0.0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. generate_drawer_box – structure
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_drawer_box_has_four_sides() {
        let g = gen();
        let db = g.generate_drawer_box(&standard_spec());
        assert_eq!(db.sides.len(), 4);
    }

    #[test]
    fn test_drawer_box_unique_ids() {
        let g = gen();
        let db = g.generate_drawer_box(&standard_spec());
        let mut ids: Vec<Uuid> = db.sides.iter().map(|s| s.id).collect();
        ids.push(db.bottom.id);
        ids.push(db.id);
        ids.dedup();
        assert_eq!(ids.len(), 6, "all part IDs must be unique");
    }

    #[test]
    fn test_drawer_box_bottom_label() {
        let g = gen();
        let db = g.generate_drawer_box(&standard_spec());
        assert_eq!(db.bottom.label, "Bottom Panel");
    }

    #[test]
    fn test_drawer_box_side_labels() {
        let g = gen();
        let db = g.generate_drawer_box(&standard_spec());
        let labels: Vec<&str> = db.sides.iter().map(|s| s.label.as_str()).collect();
        assert!(labels.contains(&"Front"));
        assert!(labels.contains(&"Back"));
        assert!(labels.contains(&"Left Side"));
        assert!(labels.contains(&"Right Side"));
    }

    #[test]
    fn test_drawer_box_side_thicknesses() {
        let spec = standard_spec();
        let g = gen();
        let db = g.generate_drawer_box(&spec);
        for side in &db.sides {
            assert!((side.thickness - spec.material_thickness).abs() < 1e-9);
        }
    }

    #[test]
    fn test_drawer_box_front_back_length() {
        let spec = standard_spec();
        let g = gen();
        let db = g.generate_drawer_box(&spec);
        let front = db.sides.iter().find(|s| s.label == "Front").unwrap();
        assert!((front.length - spec.width).abs() < 1e-9);
    }

    #[test]
    fn test_drawer_box_side_length() {
        let spec = standard_spec();
        let g = gen();
        let db = g.generate_drawer_box(&spec);
        let left = db.sides.iter().find(|s| s.label == "Left Side").unwrap();
        let expected = spec.depth - 2.0 * spec.material_thickness;
        assert!((left.length - expected).abs() < 1e-9);
    }

    #[test]
    fn test_drawer_box_side_height() {
        let spec = standard_spec();
        let g = gen();
        let db = g.generate_drawer_box(&spec);
        for side in &db.sides {
            assert!((side.width - spec.height).abs() < 1e-9);
        }
    }

    #[test]
    fn test_drawer_box_operations_not_empty() {
        let g = gen();
        let db = g.generate_drawer_box(&standard_spec());
        for side in &db.sides {
            assert!(
                !side.operations.is_empty(),
                "{} has no operations",
                side.label
            );
        }
    }

    #[test]
    fn test_drawer_box_bottom_operations_not_empty() {
        let g = gen();
        let db = g.generate_drawer_box(&standard_spec());
        assert!(!db.bottom.operations.is_empty());
    }

    #[test]
    fn test_drawer_box_has_dado_operations() {
        let g = gen();
        let db = g.generate_drawer_box(&standard_spec());
        for side in &db.sides {
            let has_dado = side.operations.iter().any(|o| o.operation_type == "dado");
            assert!(has_dado, "{} missing dado operation", side.label);
        }
    }

    #[test]
    fn test_drawer_box_joint_geometry_angle() {
        let g = gen();
        let db = g.generate_drawer_box(&standard_spec());
        assert!((db.joint_geometry.angle_degrees - 14.0).abs() < 1e-9);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Through dovetail operations
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_through_dovetail_pin_board_has_pocket_ops() {
        let g = gen();
        let geom = g.calculate_joint_geometry(300.0, 18.0, 14.0);
        let ops = g.generate_dovetail_operations(
            &geom,
            100.0,
            18.0,
            true,
            0.0,
            &DovetailJointType::Through,
        );
        let pocket_count = ops.iter().filter(|o| o.operation_type == "pocket").count();
        assert!(pocket_count > 0);
    }

    #[test]
    fn test_through_dovetail_tail_board_has_pocket_and_profile() {
        let g = gen();
        let geom = g.calculate_joint_geometry(300.0, 18.0, 14.0);
        let ops = g.generate_dovetail_operations(
            &geom,
            100.0,
            18.0,
            false,
            0.0,
            &DovetailJointType::Through,
        );
        let has_pocket = ops.iter().any(|o| o.operation_type == "pocket");
        let has_profile = ops.iter().any(|o| o.operation_type == "profile_cut");
        assert!(has_pocket);
        assert!(has_profile);
    }

    #[test]
    fn test_through_dovetail_socket_count_equals_pin_count_plus_one() {
        let g = gen();
        let geom = g.calculate_joint_geometry(200.0, 18.0, 14.0);
        let ops = g.generate_dovetail_operations(
            &geom,
            100.0,
            18.0,
            true,
            0.0,
            &DovetailJointType::Through,
        );
        let pocket_count = ops.iter().filter(|o| o.operation_type == "pocket").count();
        // pin board has (pin_count + 1) tail sockets
        assert_eq!(pocket_count as u32, geom.pin_count + 1);
    }

    #[test]
    fn test_through_dovetail_all_depths_positive() {
        let g = gen();
        let geom = g.calculate_joint_geometry(300.0, 18.0, 14.0);
        let ops = g.generate_dovetail_operations(
            &geom,
            100.0,
            18.0,
            true,
            0.0,
            &DovetailJointType::Through,
        );
        for op in &ops {
            assert!(
                op.depth > 0.0,
                "op {} has non-positive depth",
                op.description
            );
        }
    }

    #[test]
    fn test_through_dovetail_x_offset_applied() {
        let g = gen();
        let geom = g.calculate_joint_geometry(300.0, 18.0, 14.0);
        let offset = 50.0;
        let ops = g.generate_dovetail_operations(
            &geom,
            100.0,
            18.0,
            true,
            offset,
            &DovetailJointType::Through,
        );
        // First pocket must start at or after x_offset.
        let first_pocket = ops.iter().find(|o| o.operation_type == "pocket").unwrap();
        assert!(first_pocket.x_start >= offset);
    }

    #[test]
    fn test_through_dovetail_metadata_has_angle() {
        let g = gen();
        let geom = g.calculate_joint_geometry(300.0, 18.0, 14.0);
        let ops = g.generate_dovetail_operations(
            &geom,
            100.0,
            18.0,
            true,
            0.0,
            &DovetailJointType::Through,
        );
        for op in ops.iter().filter(|o| o.operation_type == "pocket") {
            assert!(op.metadata.get("angle_degrees").is_some());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Half-blind dovetail operations
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_half_blind_tagged_in_metadata() {
        let g = gen();
        let geom = g.calculate_joint_geometry(300.0, 18.0, 14.0);
        let ops = g.generate_dovetail_operations(
            &geom,
            100.0,
            18.0,
            true,
            0.0,
            &DovetailJointType::HalfBlind,
        );
        let tagged = ops
            .iter()
            .filter(|o| {
                o.metadata
                    .get("half_blind")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false)
            })
            .count();
        assert!(tagged > 0, "at least one op must be tagged half_blind");
    }

    #[test]
    fn test_half_blind_depth_less_than_through() {
        let g = gen();
        let geom = g.calculate_joint_geometry(300.0, 18.0, 14.0);
        let through_ops = g.generate_dovetail_operations(
            &geom,
            100.0,
            18.0,
            true,
            0.0,
            &DovetailJointType::Through,
        );
        let blind_ops = g.generate_dovetail_operations(
            &geom,
            100.0,
            18.0,
            true,
            0.0,
            &DovetailJointType::HalfBlind,
        );
        let through_max = through_ops
            .iter()
            .map(|o| o.depth)
            .fold(f64::NEG_INFINITY, f64::max);
        let blind_max = blind_ops
            .iter()
            .map(|o| o.depth)
            .fold(f64::NEG_INFINITY, f64::max);
        assert!(
            blind_max <= through_max,
            "half-blind depth must not exceed through depth"
        );
    }

    #[test]
    fn test_half_blind_description_prefix() {
        let g = gen();
        let geom = g.calculate_joint_geometry(300.0, 18.0, 14.0);
        let ops = g.generate_dovetail_operations(
            &geom,
            100.0,
            18.0,
            true,
            0.0,
            &DovetailJointType::HalfBlind,
        );
        assert!(ops
            .iter()
            .all(|o| o.description.starts_with("[Half-Blind]")));
    }

    #[test]
    fn test_half_blind_has_operations() {
        let g = gen();
        let geom = g.calculate_joint_geometry(300.0, 18.0, 14.0);
        let ops = g.generate_dovetail_operations(
            &geom,
            100.0,
            18.0,
            false,
            0.0,
            &DovetailJointType::HalfBlind,
        );
        assert!(!ops.is_empty());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. Sliding dovetail operations
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_sliding_dovetail_returns_three_ops() {
        let g = gen();
        let geom = g.calculate_joint_geometry(300.0, 18.0, 14.0);
        let ops = g.generate_dovetail_operations(
            &geom,
            300.0,
            18.0,
            false,
            0.0,
            &DovetailJointType::SlidingDovetail,
        );
        assert_eq!(
            ops.len(),
            3,
            "sliding dovetail should produce exactly 3 operations"
        );
    }

    #[test]
    fn test_sliding_dovetail_has_pocket() {
        let g = gen();
        let geom = g.calculate_joint_geometry(300.0, 18.0, 14.0);
        let ops = g.generate_dovetail_operations(
            &geom,
            300.0,
            18.0,
            false,
            0.0,
            &DovetailJointType::SlidingDovetail,
        );
        assert!(ops.iter().any(|o| o.operation_type == "pocket"));
    }

    #[test]
    fn test_sliding_dovetail_has_two_wall_cleanups() {
        let g = gen();
        let geom = g.calculate_joint_geometry(300.0, 18.0, 14.0);
        let ops = g.generate_dovetail_operations(
            &geom,
            300.0,
            18.0,
            false,
            0.0,
            &DovetailJointType::SlidingDovetail,
        );
        let profile_count = ops
            .iter()
            .filter(|o| o.operation_type == "profile_cut")
            .count();
        assert_eq!(profile_count, 2);
    }

    #[test]
    fn test_sliding_dovetail_metadata_sliding_true() {
        let g = gen();
        let geom = g.calculate_joint_geometry(300.0, 18.0, 14.0);
        let ops = g.generate_dovetail_operations(
            &geom,
            300.0,
            18.0,
            false,
            0.0,
            &DovetailJointType::SlidingDovetail,
        );
        let pocket = ops.iter().find(|o| o.operation_type == "pocket").unwrap();
        assert_eq!(
            pocket.metadata.get("sliding").and_then(|v| v.as_bool()),
            Some(true)
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 7. Box joint operations
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_box_joint_all_pockets() {
        let g = gen();
        let geom = g.calculate_joint_geometry(200.0, 18.0, 0.0);
        let ops = g.generate_dovetail_operations(
            &geom,
            100.0,
            18.0,
            true,
            0.0,
            &DovetailJointType::BoxJoint,
        );
        assert!(ops.iter().all(|o| o.operation_type == "pocket"));
    }

    #[test]
    fn test_box_joint_equal_finger_widths() {
        let g = gen();
        let geom = g.calculate_joint_geometry(200.0, 18.0, 0.0);
        assert!((geom.pin_width - geom.tail_width).abs() < 1e-9);
    }

    #[test]
    fn test_box_joint_pin_board_vs_tail_board_different_pockets() {
        let g = gen();
        let geom = g.calculate_joint_geometry(200.0, 18.0, 0.0);
        let pin_ops = g.generate_dovetail_operations(
            &geom,
            100.0,
            18.0,
            true,
            0.0,
            &DovetailJointType::BoxJoint,
        );
        let tail_ops = g.generate_dovetail_operations(
            &geom,
            100.0,
            18.0,
            false,
            0.0,
            &DovetailJointType::BoxJoint,
        );
        // x positions should differ (interleaved pattern)
        let pin_xs: Vec<i64> = pin_ops
            .iter()
            .map(|o| (o.x_start * 1000.0) as i64)
            .collect();
        let tail_xs: Vec<i64> = tail_ops
            .iter()
            .map(|o| (o.x_start * 1000.0) as i64)
            .collect();
        // They must not be identical sets
        assert_ne!(pin_xs, tail_xs);
    }

    #[test]
    fn test_box_joint_metadata_angle_zero() {
        let g = gen();
        let geom = g.calculate_joint_geometry(200.0, 18.0, 0.0);
        let ops = g.generate_dovetail_operations(
            &geom,
            100.0,
            18.0,
            true,
            0.0,
            &DovetailJointType::BoxJoint,
        );
        for op in &ops {
            let angle = op
                .metadata
                .get("angle_degrees")
                .and_then(|v| v.as_i64())
                .unwrap_or(99);
            assert_eq!(angle, 0);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 8. generate_dado_operations
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_dado_returns_one_op() {
        let g = gen();
        let ops = g.generate_dado_operations(400.0, 18.0, 6.0);
        assert_eq!(ops.len(), 1);
    }

    #[test]
    fn test_dado_operation_type() {
        let g = gen();
        let ops = g.generate_dado_operations(400.0, 18.0, 6.0);
        assert_eq!(ops[0].operation_type, "dado");
    }

    #[test]
    fn test_dado_width_equals_bottom_plus_clearance() {
        let g = gen();
        let bottom_t = 6.0_f64;
        let ops = g.generate_dado_operations(400.0, 18.0, bottom_t);
        let expected = bottom_t + DADO_CLEARANCE;
        assert!((ops[0].width - expected).abs() < 1e-9);
    }

    #[test]
    fn test_dado_length_equals_board_length() {
        let g = gen();
        let board_len = 450.0_f64;
        let ops = g.generate_dado_operations(board_len, 18.0, 6.0);
        assert!((ops[0].length - board_len).abs() < 1e-9);
    }

    #[test]
    fn test_dado_depth_positive() {
        let g = gen();
        let ops = g.generate_dado_operations(400.0, 18.0, 6.0);
        assert!(ops[0].depth > 0.0);
    }

    #[test]
    fn test_dado_metadata_has_passes() {
        let g = gen();
        let ops = g.generate_dado_operations(400.0, 18.0, 6.0);
        assert!(ops[0].metadata.get("passes").is_some());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 9. generate_box_bottom
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_bottom_thickness_matches_spec() {
        let spec = standard_spec();
        let g = gen();
        let bottom = g.generate_box_bottom(&spec);
        assert!((bottom.thickness - spec.bottom_thickness).abs() < 1e-9);
    }

    #[test]
    fn test_bottom_label() {
        let g = gen();
        let bottom = g.generate_box_bottom(&standard_spec());
        assert_eq!(bottom.label, "Bottom Panel");
    }

    #[test]
    fn test_bottom_length_greater_than_interior_width() {
        let spec = standard_spec();
        let g = gen();
        let bottom = g.generate_box_bottom(&spec);
        let interior_width = spec.width - 2.0 * spec.material_thickness;
        assert!(bottom.length > interior_width);
    }

    #[test]
    fn test_bottom_has_perimeter_cut_op() {
        let g = gen();
        let bottom = g.generate_box_bottom(&standard_spec());
        assert!(bottom
            .operations
            .iter()
            .any(|o| o.operation_type == "profile_cut"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 10. validate_spec
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_validate_valid_spec() {
        let g = gen();
        assert!(g.validate_spec(&standard_spec()).is_ok());
    }

    #[test]
    fn test_validate_width_too_small() {
        let mut spec = standard_spec();
        spec.width = 50.0;
        let g = gen();
        let errs = g.validate_spec(&spec).unwrap_err();
        assert!(errs
            .iter()
            .any(|e| matches!(e, ValidationError::WidthTooSmall { .. })));
    }

    #[test]
    fn test_validate_depth_too_small() {
        let mut spec = standard_spec();
        spec.depth = 40.0;
        let g = gen();
        let errs = g.validate_spec(&spec).unwrap_err();
        assert!(errs
            .iter()
            .any(|e| matches!(e, ValidationError::DepthTooSmall { .. })));
    }

    #[test]
    fn test_validate_height_too_small() {
        let mut spec = standard_spec();
        spec.height = 20.0;
        let g = gen();
        let errs = g.validate_spec(&spec).unwrap_err();
        assert!(errs
            .iter()
            .any(|e| matches!(e, ValidationError::HeightTooSmall { .. })));
    }

    #[test]
    fn test_validate_material_thickness_too_small() {
        let mut spec = standard_spec();
        spec.material_thickness = 3.0;
        let g = gen();
        let errs = g.validate_spec(&spec).unwrap_err();
        assert!(errs
            .iter()
            .any(|e| matches!(e, ValidationError::MaterialThicknessTooSmall { .. })));
    }

    #[test]
    fn test_validate_material_thickness_too_large() {
        let mut spec = standard_spec();
        spec.material_thickness = 60.0;
        let g = gen();
        let errs = g.validate_spec(&spec).unwrap_err();
        assert!(errs
            .iter()
            .any(|e| matches!(e, ValidationError::MaterialThicknessTooLarge { .. })));
    }

    #[test]
    fn test_validate_bottom_thickness_too_small() {
        let mut spec = standard_spec();
        spec.bottom_thickness = 1.0;
        let g = gen();
        let errs = g.validate_spec(&spec).unwrap_err();
        assert!(errs
            .iter()
            .any(|e| matches!(e, ValidationError::BottomThicknessTooSmall { .. })));
    }

    #[test]
    fn test_validate_bottom_thickness_too_large() {
        let mut spec = standard_spec();
        spec.bottom_thickness = 16.0; // > 18 * 0.75 = 13.5
        let g = gen();
        let errs = g.validate_spec(&spec).unwrap_err();
        assert!(errs
            .iter()
            .any(|e| matches!(e, ValidationError::BottomThicknessTooLarge { .. })));
    }

    #[test]
    fn test_validate_insufficient_interior_space() {
        let mut spec = standard_spec();
        spec.height = 35.0; // 35 - 2*18 = -1 → interior < 10
        let g = gen();
        let errs = g.validate_spec(&spec).unwrap_err();
        assert!(errs
            .iter()
            .any(|e| matches!(e, ValidationError::InsufficientInteriorSpace)));
    }

    #[test]
    fn test_validate_multiple_errors_collected() {
        let spec = DrawerBoxSpec {
            width: 10.0,
            depth: 10.0,
            height: 10.0,
            material_thickness: 2.0,
            bottom_thickness: 1.0,
            joint_type: DovetailJointType::Through,
        };
        let g = gen();
        let errs = g.validate_spec(&spec).unwrap_err();
        assert!(
            errs.len() > 3,
            "should collect multiple errors simultaneously"
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 11. Joint type variations on generate_drawer_box
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_half_blind_drawer_box_complete() {
        let mut spec = standard_spec();
        spec.joint_type = DovetailJointType::HalfBlind;
        let g = gen();
        let db = g.generate_drawer_box(&spec);
        assert_eq!(db.sides.len(), 4);
        assert!(!db.bottom.operations.is_empty());
    }

    #[test]
    fn test_sliding_dovetail_drawer_box_complete() {
        let mut spec = standard_spec();
        spec.joint_type = DovetailJointType::SlidingDovetail;
        let g = gen();
        let db = g.generate_drawer_box(&spec);
        assert_eq!(db.sides.len(), 4);
    }

    #[test]
    fn test_box_joint_drawer_box_complete() {
        let mut spec = standard_spec();
        spec.joint_type = DovetailJointType::BoxJoint;
        let g = gen();
        let db = g.generate_drawer_box(&spec);
        assert_eq!(db.sides.len(), 4);
        assert!((db.joint_geometry.angle_degrees - 0.0).abs() < 1e-9);
    }

    #[test]
    fn test_box_joint_drawer_box_has_dado() {
        let mut spec = standard_spec();
        spec.joint_type = DovetailJointType::BoxJoint;
        let g = gen();
        let db = g.generate_drawer_box(&spec);
        for side in &db.sides {
            assert!(side.operations.iter().any(|o| o.operation_type == "dado"));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 12. Edge cases and boundary conditions
    // ─────────────────────────────────────────────────────────────────────────

    #[test]
    fn test_minimum_viable_spec() {
        let spec = DrawerBoxSpec {
            width: MIN_WIDTH,
            depth: MIN_DEPTH,
            height: MIN_HEIGHT + 40.0, // ensure interior space
            material_thickness: MIN_MATERIAL_THICKNESS,
            bottom_thickness: MIN_BOTTOM_THICKNESS,
            joint_type: DovetailJointType::Through,
        };
        let g = gen();
        assert!(g.validate_spec(&spec).is_ok());
        let db = g.generate_drawer_box(&spec);
        assert_eq!(db.sides.len(), 4);
    }

    #[test]
    fn test_large_drawer_box() {
        let spec = DrawerBoxSpec {
            width: 1200.0,
            depth: 600.0,
            height: 250.0,
            material_thickness: 25.0,
            bottom_thickness: 12.0,
            joint_type: DovetailJointType::Through,
        };
        let g = gen();
        assert!(g.validate_spec(&spec).is_ok());
        let db = g.generate_drawer_box(&spec);
        // More pins expected for wider boards
        assert!(db.joint_geometry.pin_count > 5);
    }

    #[test]
    fn test_geometry_zero_angle_box_joint_no_taper() {
        let g = gen();
        let geom = g.calculate_joint_geometry(200.0, 18.0, 0.0);
        assert!((geom.angle_degrees - 0.0).abs() < 1e-9);
    }

    #[test]
    fn test_dado_very_thin_bottom() {
        let g = gen();
        let ops = g.generate_dado_operations(400.0, 18.0, MIN_BOTTOM_THICKNESS);
        assert_eq!(ops.len(), 1);
        assert!(ops[0].depth > 0.0);
    }

    #[test]
    fn test_all_operation_ids_unique_in_drawer_box() {
        let g = gen();
        let db = g.generate_drawer_box(&standard_spec());
        let mut ids: Vec<Uuid> = Vec::new();
        for side in &db.sides {
            for op in &side.operations {
                ids.push(op.id);
            }
        }
        for op in &db.bottom.operations {
            ids.push(op.id);
        }
        let total = ids.len();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), total, "all operation UUIDs must be unique");
    }

    #[test]
    fn test_feed_rate_positive_all_ops() {
        let g = gen();
        let db = g.generate_drawer_box(&standard_spec());
        for side in &db.sides {
            for op in &side.operations {
                assert!(
                    op.feed_rate > 0.0,
                    "feed_rate must be positive in {}",
                    op.description
                );
            }
        }
    }

    #[test]
    fn test_spindle_speed_positive_all_ops() {
        let g = gen();
        let db = g.generate_drawer_box(&standard_spec());
        for side in &db.sides {
            for op in &side.operations {
                assert!(op.spindle_speed > 0.0);
            }
        }
    }

    #[test]
    fn test_through_dovetail_ten_degree_softwood() {
        let g = gen();
        let geom = g.calculate_joint_geometry(300.0, 18.0, 10.0);
        let ops = g.generate_dovetail_operations(
            &geom,
            100.0,
            18.0,
            true,
            0.0,
            &DovetailJointType::Through,
        );
        for op in ops.iter().filter(|o| o.operation_type == "pocket") {
            let angle = op
                .metadata
                .get("angle_degrees")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);
            assert!((angle - 10.0).abs() < 1e-9);
        }
    }

    #[test]
    fn test_serde_drawer_box_round_trip() {
        let g = gen();
        let db = g.generate_drawer_box(&standard_spec());
        let json = serde_json::to_string(&db).expect("serialization failed");
        let db2: DrawerBox = serde_json::from_str(&json).expect("deserialization failed");
        assert_eq!(db.id, db2.id);
        assert_eq!(db.sides.len(), db2.sides.len());
    }

    #[test]
    fn test_serde_spec_round_trip() {
        let spec = standard_spec();
        let json = serde_json::to_string(&spec).expect("serialization failed");
        let spec2: DrawerBoxSpec = serde_json::from_str(&json).expect("deserialization failed");
        assert!((spec.width - spec2.width).abs() < 1e-9);
    }

    #[test]
    fn test_dovetail_joint_type_default_is_through() {
        let jt = DovetailJointType::default();
        assert_eq!(jt, DovetailJointType::Through);
    }
}
