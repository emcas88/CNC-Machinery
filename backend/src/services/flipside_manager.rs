//! # Flipside Manager
//!
//! Manages the two-sided (flipside) machining workflow for CNC cabinet parts that
//! require operations on both the top and bottom faces.
//!
//! ## Workflow overview
//! 1. **Detect** which parts need flipping (`detect_flipside_parts`).
//! 2. **Align** – place registration pins via `alignment_system` so the part can be
//!    re-registered after flipping.
//! 3. **Generate G-code** – `generate_flip_gcode` emits side-A operations, operator
//!    instructions, then side-B operations with mirrored coordinates.
//! 4. **Validate** – `validate_flipside_operations` verifies that bottom operations
//!    do not collide through the material with top operations.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

/// Which face of the part is being machined.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FlipSide {
    Top,
    Bottom,
}

/// The physical axis the part rotates around when flipped.
///
/// - `FlipX` – the part is lifted from the left/right edges and rotated 180° around
///   the X-axis (mirrors the Y coordinate in machine space).
/// - `FlipY` – the part is lifted from the front/back edges and rotated 180° around
///   the Y-axis (mirrors the X coordinate in machine space, the common case for
///   CNC router tables).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FlipDirection {
    FlipX,
    FlipY,
}

impl Default for FlipDirection {
    fn default() -> Self {
        FlipDirection::FlipY
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Operation input types (standalone – no sqlx dependency required for business
// logic or tests)
// ─────────────────────────────────────────────────────────────────────────────

/// Minimal description of one machining operation used by the flipside manager.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartOperation {
    pub id: Uuid,
    /// Which face this operation belongs to.
    pub side: FlipSide,
    /// X position in part space (mm from bottom-left corner).
    pub position_x: f64,
    /// Y position in part space (mm from bottom-left corner).
    pub position_y: f64,
    /// Z start height (usually 0 = top surface).
    pub position_z: f64,
    /// Width of the operation bounding box (mm).
    pub width: f64,
    /// Height of the operation bounding box (mm).
    pub height: f64,
    /// Cut depth (positive downward, mm).
    pub depth: f64,
    /// Optional tool assigned to this operation.
    pub tool_id: Option<Uuid>,
    /// Human-readable type name (e.g. "drill", "dado", "pocket").
    pub operation_type: String,
}

/// A part with all its operations, supplied as input to `detect_flipside_parts`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartWithOperations {
    pub part_id: Uuid,
    pub name: String,
    /// Finished length (X dimension) in mm.
    pub length: f64,
    /// Finished width (Y dimension) in mm.
    pub width: f64,
    /// Finished thickness in mm.
    pub thickness: f64,
    pub operations: Vec<PartOperation>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Output / result types
// ─────────────────────────────────────────────────────────────────────────────

/// A part that has been determined to need two-sided machining.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlipsidePart {
    pub part_id: Uuid,
    pub name: String,
    /// Finished length in mm.
    pub length: f64,
    /// Finished width in mm.
    pub width: f64,
    /// Finished thickness in mm.
    pub thickness: f64,
    /// Operations to run while the part is face-up (side A = Top).
    pub top_operations: Vec<PartOperation>,
    /// Operations to run after the part has been flipped (side B = Bottom).
    pub bottom_operations: Vec<PartOperation>,
    /// Axis around which the part will be physically flipped.
    pub flip_direction: FlipDirection,
}

/// An alignment / registration pin position.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct AlignmentPin {
    /// Sequential index (0-based) within the 3-pin set.
    pub index: usize,
    /// X coordinate on the spoilboard (mm).
    pub x: f64,
    /// Y coordinate on the spoilboard (mm).
    pub y: f64,
    /// Recommended drill diameter (mm).
    pub diameter: f64,
    /// Human-readable description of the pin's role.
    pub description: String,
}

/// The complete G-code output for a flipside part.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlipGCodeResult {
    /// Full G-code program as a single string.
    pub gcode: String,
    /// Number of tool changes required across both sides.
    pub tool_changes: usize,
    /// Estimated operator flip time (informational comment in the program).
    pub estimated_flip_seconds: f64,
    /// Alignment pin positions included in both side programs.
    pub alignment_pins: Vec<AlignmentPin>,
}

/// A validated or rejected pair of operations from opposite faces.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    /// `true` if all bottom operations pass.
    pub valid: bool,
    /// Detailed messages – one per detected problem.
    pub errors: Vec<String>,
    /// Non-blocking advisory messages.
    pub warnings: Vec<String>,
}

/// Describes a coordinate-origin transformation after a physical flip.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FlipOrigin {
    /// Offset applied to X after mirroring (mm).
    pub offset_x: f64,
    /// Offset applied to Y after mirroring (mm).
    pub offset_y: f64,
    /// `true` if the X axis is mirrored (FlipY direction).
    pub mirror_x: bool,
    /// `true` if the Y axis is mirrored (FlipX direction).
    pub mirror_y: bool,
}

// ─────────────────────────────────────────────────────────────────────────────
// Main struct
// ─────────────────────────────────────────────────────────────────────────────

/// Manages the two-sided (flipside) machining workflow.
pub struct FlipsideManager {
    /// Safe Z height for rapid travel moves (mm).
    pub safe_z: f64,
    /// Diameter of alignment pin holes drilled into the spoilboard (mm).
    pub alignment_pin_diameter: f64,
    /// Clearance margin kept between alignment pins and part edges (mm).
    pub pin_margin: f64,
    /// Default spindle speed for alignment pin drilling (RPM).
    pub default_spindle_rpm: u32,
    /// Default feed rate for drilling moves (mm/min).
    pub default_feed_rate: f64,
}

impl FlipsideManager {
    pub fn new() -> Self {
        Self {
            safe_z: 15.0,
            alignment_pin_diameter: 6.0,
            pin_margin: 20.0,
            default_spindle_rpm: 18000,
            default_feed_rate: 3000.0,
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 1. detect_flipside_parts
    // ─────────────────────────────────────────────────────────────────────

    /// Inspects every part and returns those that have operations on **both** the
    /// `Top` and `Bottom` faces.
    ///
    /// Parts with operations on only one face are silently ignored.
    ///
    /// The [`FlipDirection`] is chosen automatically:
    /// - If the part is wider than it is long, flipping around Y (mirroring X)
    ///   keeps the registration edge on the longer axis → `FlipY`.
    /// - Otherwise `FlipX`.
    pub fn detect_flipside_parts(&self, parts: Vec<PartWithOperations>) -> Vec<FlipsidePart> {
        parts
            .into_iter()
            .filter_map(|part| {
                let top_ops: Vec<PartOperation> = part
                    .operations
                    .iter()
                    .filter(|op| op.side == FlipSide::Top)
                    .cloned()
                    .collect();

                let bottom_ops: Vec<PartOperation> = part
                    .operations
                    .iter()
                    .filter(|op| op.side == FlipSide::Bottom)
                    .cloned()
                    .collect();

                if top_ops.is_empty() || bottom_ops.is_empty() {
                    return None;
                }

                // Heuristic: keep the longer axis as the flip edge
                let flip_direction = if part.width >= part.length {
                    FlipDirection::FlipY
                } else {
                    FlipDirection::FlipX
                };

                Some(FlipsidePart {
                    part_id: part.part_id,
                    name: part.name,
                    length: part.length,
                    width: part.width,
                    thickness: part.thickness,
                    top_operations: top_ops,
                    bottom_operations: bottom_ops,
                    flip_direction,
                })
            })
            .collect()
    }

    // ─────────────────────────────────────────────────────────────────────
    // 2. generate_flip_gcode
    // ─────────────────────────────────────────────────────────────────────

    /// Generates a complete G-code program for a flipside part.
    ///
    /// ### Program structure
    /// ```text
    /// ; === SIDE A (TOP) ===
    /// ; alignment pin drills
    /// ; side-A operations (grouped by tool)
    /// ; === OPERATOR FLIP INSTRUCTION ===
    /// ; === SIDE B (BOTTOM) ===
    /// ; alignment pin verification drills (mirrored)
    /// ; side-B operations (coordinates mirrored per flip direction)
    /// M30
    /// ```
    pub fn generate_flip_gcode(&self, part: &FlipsidePart) -> FlipGCodeResult {
        let alignment_pins = self.alignment_system(part.length, part.width, &[]);
        let flip_origin = self.calculate_flip_origin(part.length, part.width, part.flip_direction);

        let mut lines: Vec<String> = Vec::new();
        let mut tool_changes = 0usize;

        // ── Program header ────────────────────────────────────────────────
        lines.push(format!("; Flipside G-code for part: {}", part.name));
        lines.push(format!("; Part ID: {}", part.part_id));
        lines.push(format!(
            "; Dimensions: {}mm L x {}mm W x {}mm T",
            part.length, part.width, part.thickness
        ));
        lines.push(format!("; Flip direction: {:?}", part.flip_direction));
        lines.push(format!("; Safe Z: {}mm", self.safe_z));
        lines.push(String::new());

        // ── Safety / init ─────────────────────────────────────────────────
        lines.push("; === PROGRAM INIT ===".to_string());
        lines.push("G21          ; metric mode".to_string());
        lines.push("G90          ; absolute coordinates".to_string());
        lines.push("G17          ; XY plane".to_string());
        lines.push(format!("G0 Z{:.3}     ; rapid to safe Z", self.safe_z));
        lines.push(String::new());

        // ── Side A alignment pins ─────────────────────────────────────────
        lines.push("; === SIDE A – ALIGNMENT PIN HOLES ===".to_string());
        lines.push(format!(
            "; Drill {}mm registration holes at 3-point pin locations",
            self.alignment_pin_diameter
        ));
        let pin_tool_change = self.emit_tool_change(None, "Alignment pin drill (6mm)", &mut lines);
        tool_changes += pin_tool_change;
        lines.push(format!(
            "S{} M3       ; spindle on, {} RPM",
            self.default_spindle_rpm, self.default_spindle_rpm
        ));

        for pin in &alignment_pins {
            lines.push(format!("; Pin {} – {}", pin.index, pin.description));
            lines.push(format!("G0 X{:.3} Y{:.3}", pin.x, pin.y));
            lines.push(format!("G0 Z2.000    ; approach"));
            lines.push(format!(
                "G1 Z-{:.3} F{:.0}  ; drill pin hole",
                self.alignment_pin_diameter / 2.0,
                self.default_feed_rate
            ));
            lines.push(format!("G0 Z{:.3}  ; retract", self.safe_z));
        }
        lines.push(String::new());

        // ── Side A operations ─────────────────────────────────────────────
        lines.push("; === SIDE A (TOP) – MACHINING OPERATIONS ===".to_string());
        self.emit_operations(
            &part.top_operations,
            &flip_origin, // side A: identity (no mirror)
            false,        // do NOT apply the flip transform on side A
            &mut lines,
            &mut tool_changes,
        );
        lines.push(String::new());

        // ── Operator flip instruction ─────────────────────────────────────
        lines.push("M5           ; spindle off".to_string());
        lines.push(format!("G0 Z{:.3}     ; rise to safe Z", self.safe_z));
        lines.push("G0 X0 Y0     ; return to home".to_string());
        lines.push(String::new());
        lines.push("; ═══════════════════════════════════════════════════════".to_string());
        lines.push("; === OPERATOR ACTION REQUIRED – FLIP THE PART ===".to_string());
        lines.push("; ───────────────────────────────────────────────────────".to_string());
        lines.push(format!(
            "; 1. Rotate part 180° around the {:?} axis",
            part.flip_direction
        ));
        lines.push(";    (keep front edge against front fence)".to_string());
        lines.push("; 2. Locate part onto the 3 registration pins.".to_string());
        lines.push("; 3. Clamp securely before resuming.".to_string());
        lines.push("; 4. Resume program when prompted by machine controller.".to_string());
        lines.push("; ═══════════════════════════════════════════════════════".to_string());
        lines.push("M0           ; program pause – wait for operator".to_string());
        lines.push(String::new());

        // ── Side B alignment pin verification (mirrored positions) ────────
        lines.push("; === SIDE B – ALIGNMENT VERIFICATION (DRY-RUN) ===".to_string());
        lines.push("; (machine should be at home, spindle off)".to_string());
        lines.push("; Rapid to each pin center to confirm registration.".to_string());

        let mirrored_pins: Vec<(f64, f64)> = alignment_pins
            .iter()
            .map(|pin| {
                self.mirror_point(pin.x, pin.y, part.length, part.width, part.flip_direction)
            })
            .collect();

        for (i, (mx, my)) in mirrored_pins.iter().enumerate() {
            lines.push(format!("; Pin {} mirrored position", i));
            lines.push(format!("G0 X{:.3} Y{:.3}", mx, my));
        }
        lines.push(String::new());

        // ── Side B operations ─────────────────────────────────────────────
        lines.push("; === SIDE B (BOTTOM) – MACHINING OPERATIONS ===".to_string());
        lines.push(format!(
            "; Coordinates mirrored: mirror_x={}, mirror_y={}",
            flip_origin.mirror_x, flip_origin.mirror_y
        ));
        lines.push(format!(
            "; Origin offset: dx={:.3}, dy={:.3}",
            flip_origin.offset_x, flip_origin.offset_y
        ));

        // Restart spindle before side B
        lines.push(format!(
            "S{} M3       ; spindle on for side B",
            self.default_spindle_rpm
        ));

        self.emit_operations(
            &part.bottom_operations,
            &flip_origin,
            true, // apply flip transform on side B
            &mut lines,
            &mut tool_changes,
        );
        lines.push(String::new());

        // ── Program end ───────────────────────────────────────────────────
        lines.push("M5           ; spindle off".to_string());
        lines.push(format!("G0 Z{:.3}     ; retract to safe Z", self.safe_z));
        lines.push("G0 X0 Y0     ; return to home".to_string());
        lines.push("; === PROGRAM COMPLETE ===".to_string());
        lines.push("M30          ; end of program".to_string());

        FlipGCodeResult {
            gcode: lines.join("\n"),
            tool_changes,
            estimated_flip_seconds: 120.0, // 2-minute operator average
            alignment_pins,
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3. alignment_system
    // ─────────────────────────────────────────────────────────────────────

    /// Calculates 3-point registration pin positions for a part.
    ///
    /// ### Layout strategy (3-2-1 registration)
    /// ```text
    ///   ┌──────────────────────────────────────┐
    ///   │  Pin 0 ●            Pin 1 ●          │
    ///   │        (front edge, two pins)         │
    ///   │                                       │
    ///   │                 Pin 2 ●               │
    ///   │             (back edge, one pin)       │
    ///   └──────────────────────────────────────┘
    /// ```
    ///
    /// - **Pin 0** and **Pin 1**: constrain one long edge (Y = `pin_margin`).
    ///   Spaced at ~1/4 and ~3/4 of the part length.
    /// - **Pin 2**: constrains the opposite edge (Y = `width - pin_margin`),
    ///   centred along X.
    ///
    /// The `_existing_operations` parameter is reserved for future obstacle
    /// avoidance; currently unused.
    pub fn alignment_system(
        &self,
        part_length: f64,
        part_width: f64,
        _existing_operations: &[serde_json::Value],
    ) -> Vec<AlignmentPin> {
        let m = self.pin_margin;
        let d = self.alignment_pin_diameter;

        // Pin 0 – front-left, 1/4 along length
        let pin0 = AlignmentPin {
            index: 0,
            x: (part_length / 4.0).max(m),
            y: m,
            diameter: d,
            description: "Front edge – primary datum (left)".to_string(),
        };

        // Pin 1 – front-right, 3/4 along length
        let pin1 = AlignmentPin {
            index: 1,
            x: (3.0 * part_length / 4.0).min(part_length - m),
            y: m,
            diameter: d,
            description: "Front edge – primary datum (right)".to_string(),
        };

        // Pin 2 – back edge, centred
        let pin2 = AlignmentPin {
            index: 2,
            x: part_length / 2.0,
            y: (part_width - m).max(m + 1.0),
            diameter: d,
            description: "Back edge – secondary datum (centre)".to_string(),
        };

        vec![pin0, pin1, pin2]
    }

    // ─────────────────────────────────────────────────────────────────────
    // 4. calculate_flip_origin
    // ─────────────────────────────────────────────────────────────────────

    /// Computes the axis-mirror transformation applied to side-B coordinates.
    ///
    /// | `flip_direction` | Mirror axis | Formula                          |
    /// |-----------------|-------------|----------------------------------|
    /// | `FlipY`          | Y axis      | `x' = part_length - x`           |
    /// | `FlipX`          | X axis      | `y' = part_width  - y`           |
    ///
    /// The returned [`FlipOrigin`] can be applied to any `(x, y)` pair with
    /// [`apply_flip_transform`](FlipsideManager::apply_flip_transform).
    pub fn calculate_flip_origin(
        &self,
        part_length: f64,
        part_width: f64,
        flip_direction: FlipDirection,
    ) -> FlipOrigin {
        match flip_direction {
            FlipDirection::FlipY => FlipOrigin {
                offset_x: part_length,
                offset_y: 0.0,
                mirror_x: true,
                mirror_y: false,
            },
            FlipDirection::FlipX => FlipOrigin {
                offset_x: 0.0,
                offset_y: part_width,
                mirror_x: false,
                mirror_y: true,
            },
        }
    }

    /// Applies a `FlipOrigin` transform to a single `(x, y)` coordinate pair.
    ///
    /// - `FlipY` (mirror X): `x' = offset_x - x`,  `y' = y`
    /// - `FlipX` (mirror Y): `x' = x`,              `y' = offset_y - y`
    pub fn apply_flip_transform(&self, x: f64, y: f64, origin: &FlipOrigin) -> (f64, f64) {
        let nx = if origin.mirror_x {
            origin.offset_x - x
        } else {
            x
        };
        let ny = if origin.mirror_y {
            origin.offset_y - y
        } else {
            y
        };
        (nx, ny)
    }

    // ─────────────────────────────────────────────────────────────────────
    // 5. validate_flipside_operations
    // ─────────────────────────────────────────────────────────────────────

    /// Validates that bottom operations do not collide through the material with
    /// top operations, and that depths are physically possible.
    ///
    /// ### Checks performed
    /// 1. **Depth sanity**: no operation depth > material thickness.
    /// 2. **Through-material collision**: for each overlapping top/bottom
    ///    bounding-box pair, verify `depth_top + depth_bottom < thickness`.
    /// 3. **Negative / zero dimensions**: warns when an operation has
    ///    non-positive width or height.
    pub fn validate_flipside_operations(&self, part: &FlipsidePart) -> ValidationResult {
        let mut errors: Vec<String> = Vec::new();
        let mut warnings: Vec<String> = Vec::new();
        let thickness = part.thickness;

        // ── Individual depth checks ───────────────────────────────────────
        for op in part
            .top_operations
            .iter()
            .chain(part.bottom_operations.iter())
        {
            if op.depth > thickness {
                errors.push(format!(
                    "Operation {} ({:?} side) depth {:.3}mm exceeds part thickness {:.3}mm",
                    op.id, op.side, op.depth, thickness
                ));
            }
            if op.depth <= 0.0 {
                errors.push(format!(
                    "Operation {} has non-positive depth {:.3}mm",
                    op.id, op.depth
                ));
            }
            if op.width <= 0.0 || op.height <= 0.0 {
                warnings.push(format!(
                    "Operation {} has non-positive bounding box ({}x{}mm) – check parameters",
                    op.id, op.width, op.height
                ));
            }
        }

        // ── Through-material collision check ──────────────────────────────
        for top_op in &part.top_operations {
            for bot_op in &part.bottom_operations {
                if Self::bboxes_overlap(top_op, bot_op) {
                    let combined = top_op.depth + bot_op.depth;
                    if combined > thickness {
                        errors.push(format!(
                            "Collision detected: top operation {} (depth {:.3}mm) and \
                             bottom operation {} (depth {:.3}mm) overlap XY \
                             and combined depth {:.3}mm exceeds thickness {:.3}mm",
                            top_op.id, top_op.depth, bot_op.id, bot_op.depth, combined, thickness
                        ));
                    } else if combined > thickness * 0.9 {
                        warnings.push(format!(
                            "Warning: top op {} and bottom op {} overlap XY with combined \
                             depth {:.3}mm – only {:.3}mm of material remains (< 10%)",
                            top_op.id,
                            bot_op.id,
                            combined,
                            thickness - combined
                        ));
                    }
                }
            }
        }

        ValidationResult {
            valid: errors.is_empty(),
            errors,
            warnings,
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────

    /// Check whether two operations' bounding boxes overlap in the XY plane.
    fn bboxes_overlap(a: &PartOperation, b: &PartOperation) -> bool {
        let a_x1 = a.position_x;
        let a_x2 = a.position_x + a.width;
        let a_y1 = a.position_y;
        let a_y2 = a.position_y + a.height;

        let b_x1 = b.position_x;
        let b_x2 = b.position_x + b.width;
        let b_y1 = b.position_y;
        let b_y2 = b.position_y + b.height;

        a_x1 < b_x2 && a_x2 > b_x1 && a_y1 < b_y2 && a_y2 > b_y1
    }

    /// Mirror a spoilboard point to its post-flip position.
    fn mirror_point(
        &self,
        x: f64,
        y: f64,
        part_length: f64,
        part_width: f64,
        direction: FlipDirection,
    ) -> (f64, f64) {
        let origin = self.calculate_flip_origin(part_length, part_width, direction);
        self.apply_flip_transform(x, y, &origin)
    }

    /// Emit G-code lines for a list of operations, applying the flip transform if requested.
    /// Returns the number of tool changes added.
    fn emit_operations(
        &self,
        operations: &[PartOperation],
        origin: &FlipOrigin,
        apply_transform: bool,
        lines: &mut Vec<String>,
        tool_changes: &mut usize,
    ) {
        if operations.is_empty() {
            lines.push("; (no operations on this side)".to_string());
            return;
        }

        let mut current_tool: Option<Uuid> = None;

        for op in operations {
            // Tool change if needed
            if op.tool_id != current_tool {
                let desc = format!("{} operation", op.operation_type);
                *tool_changes += self.emit_tool_change(op.tool_id, &desc, lines);
                lines.push(format!(
                    "S{} M3       ; spindle on",
                    self.default_spindle_rpm
                ));
                current_tool = op.tool_id;
            }

            let (px, py) = if apply_transform {
                self.apply_flip_transform(op.position_x, op.position_y, origin)
            } else {
                (op.position_x, op.position_y)
            };

            lines.push(format!(
                "; Op {} – {} on {:?} side",
                op.id, op.operation_type, op.side
            ));
            // Rapid to XY at safe Z
            lines.push(format!("G0 Z{:.3}", self.safe_z));
            lines.push(format!("G0 X{:.3} Y{:.3}", px, py));
            // Approach
            lines.push("G0 Z2.000    ; approach clearance".to_string());
            // Plunge
            lines.push(format!(
                "G1 Z-{:.3} F{:.0}  ; plunge to depth",
                op.depth,
                self.default_feed_rate / 2.0
            ));

            // If the operation has a non-trivial footprint, emit a simple bounding pass
            if op.width > 0.0 && op.height > 0.0 {
                let (ex, ey) = if apply_transform {
                    self.apply_flip_transform(
                        op.position_x + op.width,
                        op.position_y + op.height,
                        origin,
                    )
                } else {
                    (op.position_x + op.width, op.position_y + op.height)
                };
                lines.push(format!(
                    "G1 X{:.3} Y{:.3} F{:.0}  ; cut pass",
                    ex, ey, self.default_feed_rate
                ));
            }

            // Retract
            lines.push(format!("G0 Z{:.3}  ; retract", self.safe_z));
        }
    }

    /// Emit a tool-change block and return 1 (to count the change).
    fn emit_tool_change(
        &self,
        tool_id: Option<Uuid>,
        description: &str,
        lines: &mut Vec<String>,
    ) -> usize {
        lines.push(format!("; Tool change – {}", description));
        match tool_id {
            Some(id) => lines.push(format!(
                "T{}  ; tool UUID prefix: {}",
                // Use first 8 hex chars as a short tool index for readability
                &id.to_string()[..8],
                id
            )),
            None => lines.push("T0  ; unassigned tool slot".to_string()),
        }
        lines.push("M6           ; execute tool change".to_string());
        1
    }
}

impl Default for FlipsideManager {
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
    use uuid::Uuid;

    // ── Helpers ──────────────────────────────────────────────────────────────

    fn mgr() -> FlipsideManager {
        FlipsideManager::new()
    }

    fn make_op(side: FlipSide, x: f64, y: f64, w: f64, h: f64, depth: f64) -> PartOperation {
        PartOperation {
            id: Uuid::new_v4(),
            side,
            position_x: x,
            position_y: y,
            position_z: 0.0,
            width: w,
            height: h,
            depth,
            tool_id: None,
            operation_type: "drill".to_string(),
        }
    }

    fn make_op_typed(
        side: FlipSide,
        x: f64,
        y: f64,
        w: f64,
        h: f64,
        depth: f64,
        op_type: &str,
        tool_id: Option<Uuid>,
    ) -> PartOperation {
        PartOperation {
            id: Uuid::new_v4(),
            side,
            position_x: x,
            position_y: y,
            position_z: 0.0,
            width: w,
            height: h,
            depth,
            tool_id,
            operation_type: op_type.to_string(),
        }
    }

    fn make_part(
        name: &str,
        length: f64,
        width: f64,
        thickness: f64,
        ops: Vec<PartOperation>,
    ) -> PartWithOperations {
        PartWithOperations {
            part_id: Uuid::new_v4(),
            name: name.to_string(),
            length,
            width,
            thickness,
            operations: ops,
        }
    }

    fn make_flipside_part(
        length: f64,
        width: f64,
        thickness: f64,
        top_ops: Vec<PartOperation>,
        bottom_ops: Vec<PartOperation>,
        flip_direction: FlipDirection,
    ) -> FlipsidePart {
        FlipsidePart {
            part_id: Uuid::new_v4(),
            name: "TestPanel".to_string(),
            length,
            width,
            thickness,
            top_operations: top_ops,
            bottom_operations: bottom_ops,
            flip_direction,
        }
    }

    // ── FlipsideManager::new / Default ────────────────────────────────────────

    #[test]
    fn test_new_safe_z() {
        assert_eq!(mgr().safe_z, 15.0);
    }

    #[test]
    fn test_new_pin_diameter() {
        assert_eq!(mgr().alignment_pin_diameter, 6.0);
    }

    #[test]
    fn test_new_pin_margin() {
        assert_eq!(mgr().pin_margin, 20.0);
    }

    #[test]
    fn test_default_is_same_as_new() {
        let a = FlipsideManager::new();
        let b = FlipsideManager::default();
        assert_eq!(a.safe_z, b.safe_z);
        assert_eq!(a.alignment_pin_diameter, b.alignment_pin_diameter);
    }

    // ── detect_flipside_parts ─────────────────────────────────────────────────

    #[test]
    fn test_detect_empty_input_returns_empty() {
        let result = mgr().detect_flipside_parts(vec![]);
        assert!(result.is_empty());
    }

    #[test]
    fn test_detect_single_side_top_only_excluded() {
        let ops = vec![make_op(FlipSide::Top, 10.0, 10.0, 8.0, 8.0, 5.0)];
        let part = make_part("TopOnly", 600.0, 300.0, 18.0, ops);
        let result = mgr().detect_flipside_parts(vec![part]);
        assert!(result.is_empty());
    }

    #[test]
    fn test_detect_single_side_bottom_only_excluded() {
        let ops = vec![make_op(FlipSide::Bottom, 10.0, 10.0, 8.0, 8.0, 5.0)];
        let part = make_part("BottomOnly", 600.0, 300.0, 18.0, ops);
        let result = mgr().detect_flipside_parts(vec![part]);
        assert!(result.is_empty());
    }

    #[test]
    fn test_detect_no_operations_excluded() {
        let part = make_part("NoOps", 600.0, 300.0, 18.0, vec![]);
        let result = mgr().detect_flipside_parts(vec![part]);
        assert!(result.is_empty());
    }

    #[test]
    fn test_detect_both_sides_included() {
        let ops = vec![
            make_op(FlipSide::Top, 10.0, 10.0, 8.0, 8.0, 5.0),
            make_op(FlipSide::Bottom, 50.0, 50.0, 8.0, 8.0, 8.0),
        ];
        let part = make_part("BothSides", 600.0, 300.0, 18.0, ops);
        let result = mgr().detect_flipside_parts(vec![part]);
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn test_detect_preserves_part_id() {
        let id = Uuid::new_v4();
        let ops = vec![
            make_op(FlipSide::Top, 10.0, 10.0, 8.0, 8.0, 5.0),
            make_op(FlipSide::Bottom, 50.0, 50.0, 8.0, 8.0, 5.0),
        ];
        let part = PartWithOperations {
            part_id: id,
            name: "Identified".to_string(),
            length: 600.0,
            width: 300.0,
            thickness: 18.0,
            operations: ops,
        };
        let result = mgr().detect_flipside_parts(vec![part]);
        assert_eq!(result[0].part_id, id);
    }

    #[test]
    fn test_detect_separates_top_and_bottom_operations() {
        let ops = vec![
            make_op(FlipSide::Top, 10.0, 10.0, 8.0, 8.0, 5.0),
            make_op(FlipSide::Top, 20.0, 10.0, 8.0, 8.0, 5.0),
            make_op(FlipSide::Bottom, 50.0, 50.0, 8.0, 8.0, 5.0),
        ];
        let part = make_part("Mixed", 600.0, 300.0, 18.0, ops);
        let result = mgr().detect_flipside_parts(vec![part]);
        assert_eq!(result[0].top_operations.len(), 2);
        assert_eq!(result[0].bottom_operations.len(), 1);
    }

    #[test]
    fn test_detect_multiple_parts_only_flipside_returned() {
        let top_only = make_part(
            "TopOnly",
            500.0,
            200.0,
            18.0,
            vec![make_op(FlipSide::Top, 10.0, 10.0, 8.0, 8.0, 5.0)],
        );
        let both = make_part(
            "Both",
            600.0,
            300.0,
            18.0,
            vec![
                make_op(FlipSide::Top, 10.0, 10.0, 8.0, 8.0, 5.0),
                make_op(FlipSide::Bottom, 50.0, 50.0, 8.0, 8.0, 5.0),
            ],
        );
        let result = mgr().detect_flipside_parts(vec![top_only, both]);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "Both");
    }

    #[test]
    fn test_detect_flip_direction_flipy_when_width_gte_length() {
        // width (500) >= length (400) → FlipY
        let ops = vec![
            make_op(FlipSide::Top, 10.0, 10.0, 8.0, 8.0, 5.0),
            make_op(FlipSide::Bottom, 50.0, 50.0, 8.0, 8.0, 5.0),
        ];
        let part = make_part("Wide", 400.0, 500.0, 18.0, ops);
        let result = mgr().detect_flipside_parts(vec![part]);
        assert_eq!(result[0].flip_direction, FlipDirection::FlipY);
    }

    #[test]
    fn test_detect_flip_direction_flipx_when_length_gt_width() {
        // length (700) > width (300) → FlipX
        let ops = vec![
            make_op(FlipSide::Top, 10.0, 10.0, 8.0, 8.0, 5.0),
            make_op(FlipSide::Bottom, 50.0, 50.0, 8.0, 8.0, 5.0),
        ];
        let part = make_part("Long", 700.0, 300.0, 18.0, ops);
        let result = mgr().detect_flipside_parts(vec![part]);
        assert_eq!(result[0].flip_direction, FlipDirection::FlipX);
    }

    #[test]
    fn test_detect_preserves_dimensions() {
        let ops = vec![
            make_op(FlipSide::Top, 10.0, 10.0, 8.0, 8.0, 5.0),
            make_op(FlipSide::Bottom, 50.0, 50.0, 8.0, 8.0, 5.0),
        ];
        let part = make_part("Dims", 650.0, 350.0, 18.0, ops);
        let result = mgr().detect_flipside_parts(vec![part]);
        assert_eq!(result[0].length, 650.0);
        assert_eq!(result[0].width, 350.0);
        assert_eq!(result[0].thickness, 18.0);
    }

    #[test]
    fn test_detect_multiple_flipside_parts_all_returned() {
        let parts: Vec<PartWithOperations> = (0..3)
            .map(|_| {
                make_part(
                    "P",
                    600.0,
                    300.0,
                    18.0,
                    vec![
                        make_op(FlipSide::Top, 10.0, 10.0, 8.0, 8.0, 5.0),
                        make_op(FlipSide::Bottom, 50.0, 50.0, 8.0, 8.0, 5.0),
                    ],
                )
            })
            .collect();
        let result = mgr().detect_flipside_parts(parts);
        assert_eq!(result.len(), 3);
    }

    // ── alignment_system ──────────────────────────────────────────────────────

    #[test]
    fn test_alignment_returns_three_pins() {
        let pins = mgr().alignment_system(600.0, 300.0, &[]);
        assert_eq!(pins.len(), 3);
    }

    #[test]
    fn test_alignment_pin_indices_are_sequential() {
        let pins = mgr().alignment_system(600.0, 300.0, &[]);
        for (i, pin) in pins.iter().enumerate() {
            assert_eq!(pin.index, i);
        }
    }

    #[test]
    fn test_alignment_pin_diameter_matches_manager() {
        let m = mgr();
        let pins = m.alignment_system(600.0, 300.0, &[]);
        for pin in &pins {
            assert_eq!(pin.diameter, m.alignment_pin_diameter);
        }
    }

    #[test]
    fn test_alignment_pin0_y_equals_margin() {
        let m = mgr();
        let pins = m.alignment_system(600.0, 300.0, &[]);
        assert_eq!(pins[0].y, m.pin_margin);
    }

    #[test]
    fn test_alignment_pin1_y_equals_margin() {
        let m = mgr();
        let pins = m.alignment_system(600.0, 300.0, &[]);
        assert_eq!(pins[1].y, m.pin_margin);
    }

    #[test]
    fn test_alignment_pin2_on_back_edge() {
        let m = mgr();
        let width = 300.0;
        let pins = m.alignment_system(600.0, width, &[]);
        assert!(pins[2].y > width / 2.0, "Pin 2 should be on the back half");
    }

    #[test]
    fn test_alignment_pin0_x_around_quarter_length() {
        let length = 600.0;
        let pins = mgr().alignment_system(length, 300.0, &[]);
        let expected = length / 4.0;
        assert!((pins[0].x - expected).abs() < 1.0);
    }

    #[test]
    fn test_alignment_pin1_x_around_three_quarter_length() {
        let length = 600.0;
        let pins = mgr().alignment_system(length, 300.0, &[]);
        let expected = 3.0 * length / 4.0;
        assert!((pins[1].x - expected).abs() < 1.0);
    }

    #[test]
    fn test_alignment_pin2_centred_x() {
        let length = 600.0;
        let pins = mgr().alignment_system(length, 300.0, &[]);
        assert_eq!(pins[2].x, length / 2.0);
    }

    #[test]
    fn test_alignment_pins_within_part_bounds() {
        let length = 600.0;
        let width = 300.0;
        let pins = mgr().alignment_system(length, width, &[]);
        for pin in &pins {
            assert!(
                pin.x >= 0.0 && pin.x <= length,
                "Pin X out of bounds: {}",
                pin.x
            );
            assert!(
                pin.y >= 0.0 && pin.y <= width,
                "Pin Y out of bounds: {}",
                pin.y
            );
        }
    }

    #[test]
    fn test_alignment_small_part_does_not_panic() {
        let pins = mgr().alignment_system(50.0, 50.0, &[]);
        assert_eq!(pins.len(), 3);
    }

    #[test]
    fn test_alignment_descriptions_non_empty() {
        let pins = mgr().alignment_system(600.0, 300.0, &[]);
        for pin in &pins {
            assert!(!pin.description.is_empty());
        }
    }

    // ── calculate_flip_origin ──────────────────────────────────────────────────

    #[test]
    fn test_flip_origin_flipy_mirrors_x() {
        let origin = mgr().calculate_flip_origin(600.0, 300.0, FlipDirection::FlipY);
        assert!(origin.mirror_x);
        assert!(!origin.mirror_y);
    }

    #[test]
    fn test_flip_origin_flipy_offset_x_equals_length() {
        let origin = mgr().calculate_flip_origin(600.0, 300.0, FlipDirection::FlipY);
        assert_eq!(origin.offset_x, 600.0);
        assert_eq!(origin.offset_y, 0.0);
    }

    #[test]
    fn test_flip_origin_flipx_mirrors_y() {
        let origin = mgr().calculate_flip_origin(600.0, 300.0, FlipDirection::FlipX);
        assert!(!origin.mirror_x);
        assert!(origin.mirror_y);
    }

    #[test]
    fn test_flip_origin_flipx_offset_y_equals_width() {
        let origin = mgr().calculate_flip_origin(600.0, 300.0, FlipDirection::FlipX);
        assert_eq!(origin.offset_y, 300.0);
        assert_eq!(origin.offset_x, 0.0);
    }

    #[test]
    fn test_apply_flip_transform_flipy_x_mirrored() {
        let m = mgr();
        let origin = m.calculate_flip_origin(600.0, 300.0, FlipDirection::FlipY);
        let (nx, ny) = m.apply_flip_transform(100.0, 50.0, &origin);
        assert_eq!(nx, 500.0); // 600 - 100
        assert_eq!(ny, 50.0); // unchanged
    }

    #[test]
    fn test_apply_flip_transform_flipy_midpoint_unchanged_y() {
        let m = mgr();
        let origin = m.calculate_flip_origin(600.0, 300.0, FlipDirection::FlipY);
        let (_, ny) = m.apply_flip_transform(300.0, 150.0, &origin);
        assert_eq!(ny, 150.0);
    }

    #[test]
    fn test_apply_flip_transform_flipx_y_mirrored() {
        let m = mgr();
        let origin = m.calculate_flip_origin(600.0, 300.0, FlipDirection::FlipX);
        let (nx, ny) = m.apply_flip_transform(100.0, 50.0, &origin);
        assert_eq!(nx, 100.0); // unchanged
        assert_eq!(ny, 250.0); // 300 - 50
    }

    #[test]
    fn test_apply_flip_transform_double_application_is_identity() {
        // Applying twice should return to origin
        let m = mgr();
        let origin = m.calculate_flip_origin(600.0, 300.0, FlipDirection::FlipY);
        let (x1, y1) = m.apply_flip_transform(123.0, 45.6, &origin);
        let (x2, y2) = m.apply_flip_transform(x1, y1, &origin);
        assert!((x2 - 123.0).abs() < 1e-9);
        assert!((y2 - 45.6).abs() < 1e-9);
    }

    #[test]
    fn test_flip_origin_zero_dimensions() {
        let origin = mgr().calculate_flip_origin(0.0, 0.0, FlipDirection::FlipY);
        assert_eq!(origin.offset_x, 0.0);
    }

    #[test]
    fn test_flip_origin_equality() {
        let a = mgr().calculate_flip_origin(600.0, 300.0, FlipDirection::FlipY);
        let b = mgr().calculate_flip_origin(600.0, 300.0, FlipDirection::FlipY);
        assert_eq!(a, b);
    }

    // ── generate_flip_gcode ───────────────────────────────────────────────────

    fn simple_flipside_part() -> FlipsidePart {
        make_flipside_part(
            600.0,
            300.0,
            18.0,
            vec![make_op(FlipSide::Top, 100.0, 50.0, 8.0, 8.0, 5.0)],
            vec![make_op(FlipSide::Bottom, 80.0, 60.0, 8.0, 8.0, 6.0)],
            FlipDirection::FlipY,
        )
    }

    #[test]
    fn test_gcode_result_has_gcode_string() {
        let part = simple_flipside_part();
        let result = mgr().generate_flip_gcode(&part);
        assert!(!result.gcode.is_empty());
    }

    #[test]
    fn test_gcode_contains_m30() {
        let part = simple_flipside_part();
        let result = mgr().generate_flip_gcode(&part);
        assert!(result.gcode.contains("M30"), "G-code must end with M30");
    }

    #[test]
    fn test_gcode_contains_program_pause_m0() {
        let part = simple_flipside_part();
        let result = mgr().generate_flip_gcode(&part);
        assert!(
            result.gcode.contains("M0"),
            "G-code must contain M0 operator pause"
        );
    }

    #[test]
    fn test_gcode_contains_side_a_header() {
        let part = simple_flipside_part();
        let result = mgr().generate_flip_gcode(&part);
        assert!(result.gcode.contains("SIDE A"));
    }

    #[test]
    fn test_gcode_contains_side_b_header() {
        let part = simple_flipside_part();
        let result = mgr().generate_flip_gcode(&part);
        assert!(result.gcode.contains("SIDE B"));
    }

    #[test]
    fn test_gcode_contains_flip_instruction() {
        let part = simple_flipside_part();
        let result = mgr().generate_flip_gcode(&part);
        assert!(
            result.gcode.contains("FLIP") || result.gcode.contains("Rotate"),
            "G-code must mention flip action"
        );
    }

    #[test]
    fn test_gcode_contains_g21_metric() {
        let part = simple_flipside_part();
        let result = mgr().generate_flip_gcode(&part);
        assert!(result.gcode.contains("G21"), "G-code must set metric mode");
    }

    #[test]
    fn test_gcode_contains_g90_absolute() {
        let part = simple_flipside_part();
        let result = mgr().generate_flip_gcode(&part);
        assert!(
            result.gcode.contains("G90"),
            "G-code must use absolute mode"
        );
    }

    #[test]
    fn test_gcode_contains_safe_z_height() {
        let part = simple_flipside_part();
        let result = mgr().generate_flip_gcode(&part);
        assert!(
            result.gcode.contains("15.000") || result.gcode.contains("Z15"),
            "G-code must reference safe Z height"
        );
    }

    #[test]
    fn test_gcode_has_spindle_on() {
        let part = simple_flipside_part();
        let result = mgr().generate_flip_gcode(&part);
        assert!(result.gcode.contains("M3"), "G-code must turn spindle on");
    }

    #[test]
    fn test_gcode_has_spindle_off() {
        let part = simple_flipside_part();
        let result = mgr().generate_flip_gcode(&part);
        assert!(result.gcode.contains("M5"), "G-code must turn spindle off");
    }

    #[test]
    fn test_gcode_tool_changes_at_least_one() {
        let part = simple_flipside_part();
        let result = mgr().generate_flip_gcode(&part);
        assert!(result.tool_changes >= 1);
    }

    #[test]
    fn test_gcode_alignment_pins_three() {
        let part = simple_flipside_part();
        let result = mgr().generate_flip_gcode(&part);
        assert_eq!(result.alignment_pins.len(), 3);
    }

    #[test]
    fn test_gcode_contains_part_name() {
        let part = simple_flipside_part();
        let result = mgr().generate_flip_gcode(&part);
        assert!(result.gcode.contains("TestPanel"));
    }

    #[test]
    fn test_gcode_estimated_flip_time_positive() {
        let part = simple_flipside_part();
        let result = mgr().generate_flip_gcode(&part);
        assert!(result.estimated_flip_seconds > 0.0);
    }

    #[test]
    fn test_gcode_mirrored_x_coordinate_present_for_flipy() {
        let part = make_flipside_part(
            600.0,
            300.0,
            18.0,
            vec![make_op(FlipSide::Top, 100.0, 50.0, 8.0, 8.0, 5.0)],
            vec![make_op(FlipSide::Bottom, 100.0, 50.0, 8.0, 8.0, 6.0)],
            FlipDirection::FlipY,
        );
        let result = mgr().generate_flip_gcode(&part);
        // side-B x should be 600 - 100 = 500
        assert!(
            result.gcode.contains("X500.000"),
            "Expected mirrored X=500.000"
        );
    }

    #[test]
    fn test_gcode_different_tool_ids_increase_tool_changes() {
        let t1 = Uuid::new_v4();
        let t2 = Uuid::new_v4();
        let top_op = make_op_typed(FlipSide::Top, 10.0, 10.0, 8.0, 8.0, 5.0, "drill", Some(t1));
        let bot_op = make_op_typed(
            FlipSide::Bottom,
            50.0,
            50.0,
            8.0,
            8.0,
            5.0,
            "dado",
            Some(t2),
        );
        let part = make_flipside_part(
            600.0,
            300.0,
            18.0,
            vec![top_op],
            vec![bot_op],
            FlipDirection::FlipY,
        );
        let result = mgr().generate_flip_gcode(&part);
        // pin drill + t1 + t2 = at least 3 tool changes
        assert!(result.tool_changes >= 3);
    }

    #[test]
    fn test_gcode_empty_ops_on_side_handled_gracefully() {
        // Should never happen (detect filters these out) but manager must not panic
        let part = make_flipside_part(
            600.0,
            300.0,
            18.0,
            vec![],
            vec![make_op(FlipSide::Bottom, 50.0, 50.0, 8.0, 8.0, 5.0)],
            FlipDirection::FlipY,
        );
        let result = mgr().generate_flip_gcode(&part);
        assert!(result.gcode.contains("no operations"));
    }

    // ── validate_flipside_operations ──────────────────────────────────────────

    #[test]
    fn test_validate_clean_part_is_valid() {
        let part = make_flipside_part(
            600.0,
            300.0,
            18.0,
            vec![make_op(FlipSide::Top, 10.0, 10.0, 8.0, 8.0, 5.0)],
            vec![make_op(FlipSide::Bottom, 200.0, 200.0, 8.0, 8.0, 6.0)],
            FlipDirection::FlipY,
        );
        let v = mgr().validate_flipside_operations(&part);
        assert!(v.valid);
        assert!(v.errors.is_empty());
    }

    #[test]
    fn test_validate_top_op_exceeds_thickness_error() {
        let part = make_flipside_part(
            600.0,
            300.0,
            18.0,
            vec![make_op(FlipSide::Top, 10.0, 10.0, 8.0, 8.0, 20.0)], // 20 > 18
            vec![make_op(FlipSide::Bottom, 200.0, 200.0, 8.0, 8.0, 5.0)],
            FlipDirection::FlipY,
        );
        let v = mgr().validate_flipside_operations(&part);
        assert!(!v.valid);
        assert!(!v.errors.is_empty());
        assert!(v.errors[0].contains("thickness"));
    }

    #[test]
    fn test_validate_bottom_op_exceeds_thickness_error() {
        let part = make_flipside_part(
            600.0,
            300.0,
            18.0,
            vec![make_op(FlipSide::Top, 10.0, 10.0, 8.0, 8.0, 5.0)],
            vec![make_op(FlipSide::Bottom, 200.0, 200.0, 8.0, 8.0, 25.0)], // 25 > 18
            FlipDirection::FlipY,
        );
        let v = mgr().validate_flipside_operations(&part);
        assert!(!v.valid);
    }

    #[test]
    fn test_validate_overlapping_ops_collision_error() {
        // Both ops at same XY, combined depth > thickness
        let part = make_flipside_part(
            600.0,
            300.0,
            18.0,
            vec![make_op(FlipSide::Top, 50.0, 50.0, 20.0, 20.0, 10.0)],
            vec![make_op(FlipSide::Bottom, 50.0, 50.0, 20.0, 20.0, 10.0)],
            FlipDirection::FlipY,
        );
        let v = mgr().validate_flipside_operations(&part);
        assert!(!v.valid);
        assert!(v.errors.iter().any(|e| e.contains("Collision")));
    }

    #[test]
    fn test_validate_overlapping_ops_combined_depth_ok() {
        // Ops overlap XY but combined depth is within thickness
        let part = make_flipside_part(
            600.0,
            300.0,
            18.0,
            vec![make_op(FlipSide::Top, 50.0, 50.0, 20.0, 20.0, 6.0)],
            vec![make_op(FlipSide::Bottom, 50.0, 50.0, 20.0, 20.0, 5.0)],
            FlipDirection::FlipY,
        );
        let v = mgr().validate_flipside_operations(&part);
        assert!(v.valid, "6+5=11 < 18mm thickness, should be valid");
    }

    #[test]
    fn test_validate_non_overlapping_high_depth_is_valid() {
        // Deep ops but they don't overlap XY so no collision
        let part = make_flipside_part(
            600.0,
            300.0,
            18.0,
            vec![make_op(FlipSide::Top, 10.0, 10.0, 20.0, 20.0, 16.0)],
            vec![make_op(FlipSide::Bottom, 200.0, 200.0, 20.0, 20.0, 16.0)],
            FlipDirection::FlipY,
        );
        let v = mgr().validate_flipside_operations(&part);
        assert!(v.valid);
    }

    #[test]
    fn test_validate_zero_depth_op_is_error() {
        let part = make_flipside_part(
            600.0,
            300.0,
            18.0,
            vec![make_op(FlipSide::Top, 10.0, 10.0, 8.0, 8.0, 0.0)],
            vec![make_op(FlipSide::Bottom, 200.0, 200.0, 8.0, 8.0, 5.0)],
            FlipDirection::FlipY,
        );
        let v = mgr().validate_flipside_operations(&part);
        assert!(!v.valid);
        assert!(v.errors.iter().any(|e| e.contains("non-positive depth")));
    }

    #[test]
    fn test_validate_negative_depth_is_error() {
        let part = make_flipside_part(
            600.0,
            300.0,
            18.0,
            vec![make_op(FlipSide::Top, 10.0, 10.0, 8.0, 8.0, -1.0)],
            vec![make_op(FlipSide::Bottom, 200.0, 200.0, 8.0, 8.0, 5.0)],
            FlipDirection::FlipY,
        );
        let v = mgr().validate_flipside_operations(&part);
        assert!(!v.valid);
    }

    #[test]
    fn test_validate_multiple_errors_reported() {
        let part = make_flipside_part(
            600.0,
            300.0,
            18.0,
            vec![
                make_op(FlipSide::Top, 10.0, 10.0, 8.0, 8.0, 20.0), // exceeds thickness
                make_op(FlipSide::Top, 20.0, 20.0, 8.0, 8.0, -2.0), // negative depth
            ],
            vec![make_op(FlipSide::Bottom, 200.0, 200.0, 8.0, 8.0, 5.0)],
            FlipDirection::FlipY,
        );
        let v = mgr().validate_flipside_operations(&part);
        assert!(v.errors.len() >= 2);
    }

    #[test]
    fn test_validate_near_thickness_warning_issued() {
        // 10 + 8 = 18mm; combined = 100% of thickness, > 90% → warning expected
        let part = make_flipside_part(
            600.0,
            300.0,
            18.0,
            vec![make_op(FlipSide::Top, 50.0, 50.0, 20.0, 20.0, 10.0)],
            vec![make_op(FlipSide::Bottom, 50.0, 50.0, 20.0, 20.0, 8.0)], // 10+8=18 >= 18
            FlipDirection::FlipY,
        );
        let v = mgr().validate_flipside_operations(&part);
        // Combined 18 == thickness → collision error, not just warning
        assert!(!v.valid);
    }

    #[test]
    fn test_validate_warning_for_zero_width_op() {
        let mut op = make_op(FlipSide::Top, 10.0, 10.0, 0.0, 0.0, 5.0);
        op.width = 0.0;
        op.height = 0.0;
        let part = make_flipside_part(
            600.0,
            300.0,
            18.0,
            vec![op],
            vec![make_op(FlipSide::Bottom, 200.0, 200.0, 8.0, 8.0, 5.0)],
            FlipDirection::FlipY,
        );
        let v = mgr().validate_flipside_operations(&part);
        // zero-depth warning is also triggered (depth=5 is fine, but width=0 triggers warning)
        assert!(!v.warnings.is_empty());
    }

    // ── FlipSide / FlipDirection enum serialization ────────────────────────────

    #[test]
    fn test_flipside_serialize_top() {
        let s = serde_json::to_string(&FlipSide::Top).unwrap();
        assert_eq!(s, "\"top\"");
    }

    #[test]
    fn test_flipside_serialize_bottom() {
        let s = serde_json::to_string(&FlipSide::Bottom).unwrap();
        assert_eq!(s, "\"bottom\"");
    }

    #[test]
    fn test_flipdirection_default_is_flipy() {
        assert_eq!(FlipDirection::default(), FlipDirection::FlipY);
    }

    #[test]
    fn test_flipdirection_serialize_flipy() {
        let s = serde_json::to_string(&FlipDirection::FlipY).unwrap();
        assert_eq!(s, "\"flip_y\"");
    }

    #[test]
    fn test_flipdirection_serialize_flipx() {
        let s = serde_json::to_string(&FlipDirection::FlipX).unwrap();
        assert_eq!(s, "\"flip_x\"");
    }

    // ── AlignmentPin / FlipOrigin struct tests ────────────────────────────────

    #[test]
    fn test_alignment_pin_equality() {
        let p1 = AlignmentPin {
            index: 0,
            x: 150.0,
            y: 20.0,
            diameter: 6.0,
            description: "test".to_string(),
        };
        let p2 = AlignmentPin {
            index: 0,
            x: 150.0,
            y: 20.0,
            diameter: 6.0,
            description: "test".to_string(),
        };
        assert_eq!(p1, p2);
    }

    #[test]
    fn test_flip_origin_struct_equality() {
        let o1 = FlipOrigin {
            offset_x: 600.0,
            offset_y: 0.0,
            mirror_x: true,
            mirror_y: false,
        };
        let o2 = FlipOrigin {
            offset_x: 600.0,
            offset_y: 0.0,
            mirror_x: true,
            mirror_y: false,
        };
        assert_eq!(o1, o2);
    }
}
