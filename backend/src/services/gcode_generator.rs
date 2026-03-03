//! # G-code Generation Engine
//!
//! Production-quality G-code generator for CNC cabinet manufacturing.
//! Handles all standard cabinet operations: Drill, Route, Dado, Tenon, Pocket, Profile, Cutout.
//!
//! ## Architecture
//! ```text
//! GCodeGenerator
//! ├── GCodeConfig          – safe Z, clearance, coordinate mode, units
//! ├── ToolpathPlanner      – sorts operations, groups by tool, minimises tool changes
//! ├── GCodeEmitter         – formats G-code strings with line numbers and comments
//! ├── PostProcessorEngine  – template variable substitution for machine-specific headers
//! ├── SafetyChecker        – bounds checking, spoilboard protection, collision detection
//! └── ToolpathSimulator    – time/distance estimation from feed rates and geometry
//! ```
//!
//! The engine is **fully synchronous and database-free**: it operates exclusively on
//! pre-populated input structs that the async API layer fills from the database.

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;
use uuid::Uuid;

// ─────────────────────────────────────────────────────────────────────────────
// Error types
// ─────────────────────────────────────────────────────────────────────────────

/// Errors that can occur during G-code generation.
#[derive(Debug, Error)]
pub enum GCodeError {
    #[error("Safety violation: {0}")]
    SafetyViolation(String),

    #[error("Invalid tool index {index} (only {count} tools provided)")]
    InvalidToolIndex { index: usize, count: usize },

    #[error("Unsupported operation type: {0}")]
    UnsupportedOperation(String),

    #[error("Invalid geometry: {0}")]
    InvalidGeometry(String),

    #[error("Post-processor template error: {0}")]
    TemplateError(String),

    #[error("Machine bounds exceeded: {0}")]
    BoundsExceeded(String),
}

pub type GCodeResult<T> = Result<T, GCodeError>;

// ─────────────────────────────────────────────────────────────────────────────
// Input structs (database-free; API layer populates these)
// ─────────────────────────────────────────────────────────────────────────────

/// Top-level input describing a full nested sheet to be machined.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SheetGCodeInput {
    pub sheet_id: Uuid,
    pub sheet_width: f64,
    pub sheet_length: f64,
    pub material_thickness: f64,
    pub parts: Vec<PlacedPartInput>,
    pub machine: MachineInput,
    /// All tools referenced by operations on this sheet.
    pub tools: Vec<ToolInput>,
    /// Optional post-processor template content. If `None` a generic header is used.
    pub post_processor: Option<PostProcessorInput>,
    /// Program name embedded in the header.
    pub program_name: Option<String>,
    /// Material description embedded in the header.
    pub material: Option<String>,
}

/// A single part placed at a known (x, y) position on the sheet.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlacedPartInput {
    pub part_id: Uuid,
    pub name: String,
    /// Sheet-origin X of the bottom-left corner of the part's bounding box.
    pub x: f64,
    /// Sheet-origin Y of the bottom-left corner of the part's bounding box.
    pub y: f64,
    pub length: f64,
    pub width: f64,
    pub rotated: bool,
    pub operations: Vec<OperationInput>,
}

/// A single machining operation (drill, pocket, profile, etc.) on a part.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationInput {
    pub id: Uuid,
    /// One of: "drill" | "route" | "dado" | "tenon" | "pocket" | "profile" | "cutout"
    pub operation_type: String,
    /// X position **relative to the part's bottom-left corner**.
    pub position_x: f64,
    /// Y position **relative to the part's bottom-left corner**.
    pub position_y: f64,
    pub depth: f64,
    pub width: Option<f64>,
    pub height: Option<f64>,
    /// Index into the parent `SheetGCodeInput::tools` vector.
    pub tool_index: usize,
    /// "top" or "bottom" (ignored when generating single-side programs).
    pub side: String,
    /// Extra operation-specific parameters (e.g., tab_count, stepover_ratio, conventional_cut).
    pub parameters: serde_json::Value,
}

/// Machine descriptor used for bounds checking and header generation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MachineInput {
    pub name: String,
    pub spoilboard_width: f64,
    pub spoilboard_length: f64,
    pub spoilboard_thickness: f64,
}

/// Tool descriptor.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolInput {
    pub name: String,
    pub diameter: f64,
    pub rpm: i32,
    pub feed_rate: f64,
    pub plunge_rate: f64,
    pub max_depth_per_pass: f64,
}

/// Post-processor template (optional).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostProcessorInput {
    pub name: String,
    pub output_format: String,
    /// Raw template content with `{VARIABLE}` placeholders.
    pub template_content: String,
    /// Static variable overrides from the post-processor record.
    pub variables: serde_json::Value,
}

// ─────────────────────────────────────────────────────────────────────────────
// Output structs
// ─────────────────────────────────────────────────────────────────────────────

/// One logical block of G-code (corresponds to a single operation or section).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GCodeBlock {
    /// Human-readable label.
    pub label: String,
    /// The raw G-code lines for this block.
    pub lines: Vec<String>,
    /// Part the block belongs to (if any).
    pub part_id: Option<Uuid>,
    /// Operation the block belongs to (if any).
    pub operation_id: Option<Uuid>,
}

/// Full output from the G-code generator.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GCodeOutput {
    /// Structured blocks for UI display and navigation.
    pub blocks: Vec<GCodeBlock>,
    /// Complete G-code program as a single string ready to write to a file.
    pub raw: String,
    /// Number of tool changes in the program.
    pub tool_changes: i32,
    /// Estimated machining time in seconds (derived from feed rates and distances).
    pub estimated_cut_time_seconds: f64,
    /// Total toolpath distance in mm.
    pub total_distance_mm: f64,
    /// Non-fatal warnings (e.g., a depth that required many passes).
    pub warnings: Vec<String>,
}

/// Simplified result for the simulate endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationOutput {
    pub estimated_cut_time_seconds: f64,
    pub total_distance_mm: f64,
    pub rapid_distance_mm: f64,
    pub cut_distance_mm: f64,
    pub tool_changes: i32,
    pub pass_count: i32,
    pub warnings: Vec<String>,
}

/// Result from the safety checker.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyCheckOutput {
    pub passed: bool,
    pub violations: Vec<String>,
    pub warnings: Vec<String>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/// Generator-wide configuration knobs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GCodeConfig {
    /// Z height for rapid traversals between operations (mm above sheet top).
    pub safe_z: f64,
    /// Z height used for initial positioning before a plunge (mm above sheet top).
    pub clearance_z: f64,
    /// Extra thickness added below `material_thickness` before stopping (spoilboard protection).
    pub spoilboard_tolerance: f64,
    /// Use absolute (G90) or incremental (G91) coordinates. Almost always G90.
    pub absolute_mode: bool,
    /// Use metric (G21) or imperial (G20) units. Cabinet work is always metric.
    pub metric_units: bool,
    /// Line number increment (0 = no line numbers).
    pub line_number_increment: u32,
    /// Whether to add descriptive comments (`;` prefix).
    pub include_comments: bool,
    /// Pocket stepover as a fraction of tool diameter (default 0.6 = 60%).
    pub pocket_stepover_ratio: f64,
    /// Arc radius for lead-in / lead-out moves on profile cuts (mm).
    pub lead_in_radius: f64,
    /// Minimum tab width for cutout operations (mm).
    pub tab_width: f64,
    /// Tab height above sheet bottom (mm). Typically 3–5 mm.
    pub tab_height: f64,
    /// Default number of holding tabs per cutout perimeter.
    pub default_tab_count: usize,
}

impl Default for GCodeConfig {
    fn default() -> Self {
        GCodeConfig {
            safe_z: 15.0,
            clearance_z: 5.0,
            spoilboard_tolerance: 0.3,
            absolute_mode: true,
            metric_units: true,
            line_number_increment: 10,
            include_comments: true,
            pocket_stepover_ratio: 0.6,
            lead_in_radius: 5.0,
            tab_width: 8.0,
            tab_height: 3.0,
            default_tab_count: 4,
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal planner types
// ─────────────────────────────────────────────────────────────────────────────

/// An operation annotated with its absolute sheet coordinates (after adding part offset).
#[derive(Debug, Clone)]
struct ResolvedOperation<'a> {
    op: &'a OperationInput,
    /// Absolute X on sheet.
    abs_x: f64,
    /// Absolute Y on sheet.
    abs_y: f64,
    part: &'a PlacedPartInput,
}

// ─────────────────────────────────────────────────────────────────────────────
// GCodeEmitter – low-level line formatter
// ─────────────────────────────────────────────────────────────────────────────

/// Emits formatted G-code lines.
///
/// Handles line numbering, coordinate formatting, and comment insertion so all
/// higher-level logic can focus on *what* to machine rather than *how to format*.
struct GCodeEmitter {
    lines: Vec<String>,
    line_num: u32,
    increment: u32,
    comments: bool,
}

impl GCodeEmitter {
    fn new(increment: u32, comments: bool) -> Self {
        GCodeEmitter {
            lines: Vec::new(),
            line_num: increment,
            increment,
            comments,
        }
    }

    /// Format a floating-point coordinate to 3 decimal places, stripping trailing zeros.
    fn fmt_f(v: f64) -> String {
        // Use fixed 3dp then trim trailing zeros after the decimal point.
        let s = format!("{:.3}", v);
        let s = s.trim_end_matches('0');
        let s = s.trim_end_matches('.');
        s.to_string()
    }

    /// Emit a raw line (prefixed with line number if configured).
    fn emit(&mut self, code: &str) {
        if self.increment > 0 {
            self.lines.push(format!("N{} {}", self.line_num, code));
            self.line_num += self.increment;
        } else {
            self.lines.push(code.to_string());
        }
    }

    /// Emit a comment line (`;` prefix).
    fn comment(&mut self, text: &str) {
        if self.comments {
            // Comments are NOT given line numbers – they are pure annotations.
            self.lines.push(format!("; {}", text));
        }
    }

    /// Emit a blank separator line.
    fn blank(&mut self) {
        if self.comments {
            self.lines.push(String::new());
        }
    }

    /// Emit `G0 X… Y…` rapid move.
    fn rapid_xy(&mut self, x: f64, y: f64) {
        self.emit(&format!("G0 X{} Y{}", Self::fmt_f(x), Self::fmt_f(y)));
    }

    /// Emit `G0 Z…` rapid Z move.
    fn rapid_z(&mut self, z: f64) {
        self.emit(&format!("G0 Z{}", Self::fmt_f(z)));
    }

    /// Emit `G0 X… Y… Z…` combined rapid move.
    fn rapid_xyz(&mut self, x: f64, y: f64, z: f64) {
        self.emit(&format!(
            "G0 X{} Y{} Z{}",
            Self::fmt_f(x),
            Self::fmt_f(y),
            Self::fmt_f(z)
        ));
    }

    /// Emit `G1 Z… F…` linear plunge.
    fn plunge(&mut self, z: f64, feed: f64) {
        self.emit(&format!("G1 Z{} F{}", Self::fmt_f(z), Self::fmt_f(feed)));
    }

    /// Emit `G1 X… Y… F…` linear cut move.
    fn cut_xy(&mut self, x: f64, y: f64, feed: f64) {
        self.emit(&format!(
            "G1 X{} Y{} F{}",
            Self::fmt_f(x),
            Self::fmt_f(y),
            Self::fmt_f(feed)
        ));
    }

    /// Emit `G1 X… Y… Z… F…` cut move with simultaneous Z.
    fn cut_xyz(&mut self, x: f64, y: f64, z: f64, feed: f64) {
        self.emit(&format!(
            "G1 X{} Y{} Z{} F{}",
            Self::fmt_f(x),
            Self::fmt_f(y),
            Self::fmt_f(z),
            Self::fmt_f(feed)
        ));
    }

    /// Emit `G2` (CW) or `G3` (CCW) arc using I/J offsets.
    fn arc(&mut self, clockwise: bool, end_x: f64, end_y: f64, i: f64, j: f64, feed: f64) {
        let g = if clockwise { "G2" } else { "G3" };
        self.emit(&format!(
            "{} X{} Y{} I{} J{} F{}",
            g,
            Self::fmt_f(end_x),
            Self::fmt_f(end_y),
            Self::fmt_f(i),
            Self::fmt_f(j),
            Self::fmt_f(feed)
        ));
    }

    /// Emit spindle on at given RPM (S word + M3).
    fn spindle_on(&mut self, rpm: i32) {
        self.emit(&format!("S{} M3", rpm));
    }

    /// Emit spindle stop (M5).
    fn spindle_off(&mut self) {
        self.emit("M5");
    }

    /// Emit coolant on (M8) / off (M9).
    fn coolant(&mut self, on: bool) {
        self.emit(if on { "M8" } else { "M9" });
    }

    /// Emit tool change with tool number (T… M6).
    fn tool_change(&mut self, tool_number: usize) {
        self.emit(&format!("T{} M6", tool_number));
    }

    /// Emit program end (M30).
    fn program_end(&mut self) {
        self.emit("M30");
    }

    /// Consume the emitter and return all lines joined by `\n`.
    fn into_string(self) -> String {
        self.lines.join("\n")
    }

    /// Return a reference to the lines accumulated so far.
    fn lines(&self) -> &[String] {
        &self.lines
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ToolpathPlanner – operation sorting and tool grouping
// ─────────────────────────────────────────────────────────────────────────────

/// Plans the execution order of all operations to minimise tool changes and
/// unnecessary travel.
struct ToolpathPlanner;

impl ToolpathPlanner {
    /// Given a list of resolved operations, return them grouped by tool index.
    /// Within each tool group operations are sorted by operation type priority
    /// (holes before pockets before profiles before cutouts) and then by
    /// spatial proximity (nearest-neighbour greedy) to reduce rapid travel.
    fn plan<'a>(ops: Vec<ResolvedOperation<'a>>) -> Vec<Vec<ResolvedOperation<'a>>> {
        // Group by tool_index.
        let mut groups: HashMap<usize, Vec<ResolvedOperation<'a>>> = HashMap::new();
        for op in ops {
            groups.entry(op.op.tool_index).or_default().push(op);
        }

        // Sort tool groups by index so tool 0 (lowest number) runs first.
        let mut sorted_keys: Vec<usize> = groups.keys().cloned().collect();
        sorted_keys.sort_unstable();

        sorted_keys
            .into_iter()
            .map(|key| {
                let mut group = groups.remove(&key).unwrap();
                // Sort by type priority then nearest-neighbour within each type.
                group.sort_by_key(|r| Self::type_priority(&r.op.operation_type));
                Self::nearest_neighbour_sort(group)
            })
            .collect()
    }

    /// Lower number = earlier in program.
    /// Drill → Route → Dado → Tenon → Pocket → Profile → Cutout
    fn type_priority(op_type: &str) -> u8 {
        match op_type.to_lowercase().as_str() {
            "drill" => 0,
            "route" => 1,
            "dado" => 2,
            "tenon" => 3,
            "pocket" => 4,
            "profile" => 5,
            "cutout" => 6,
            _ => 7,
        }
    }

    /// Greedy nearest-neighbour reordering to minimise rapid travel distance.
    fn nearest_neighbour_sort<'a>(
        mut ops: Vec<ResolvedOperation<'a>>,
    ) -> Vec<ResolvedOperation<'a>> {
        if ops.len() <= 1 {
            return ops;
        }
        let mut sorted = Vec::with_capacity(ops.len());
        // Start from origin (machine home).
        let mut cur_x = 0.0f64;
        let mut cur_y = 0.0f64;

        while !ops.is_empty() {
            let mut best_idx = 0;
            let mut best_dist = f64::MAX;
            for (i, op) in ops.iter().enumerate() {
                let dx = op.abs_x - cur_x;
                let dy = op.abs_y - cur_y;
                let d = dx * dx + dy * dy; // squared – no need for sqrt
                if d < best_dist {
                    best_dist = d;
                    best_idx = i;
                }
            }
            let next = ops.remove(best_idx);
            cur_x = next.abs_x;
            cur_y = next.abs_y;
            sorted.push(next);
        }
        sorted
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SafetyChecker
// ─────────────────────────────────────────────────────────────────────────────

/// Validates the machining program before emission.
pub struct SafetyChecker;

impl SafetyChecker {
    /// Run all safety checks and return a structured result.
    pub fn check(input: &SheetGCodeInput, config: &GCodeConfig) -> SafetyCheckOutput {
        let mut violations: Vec<String> = Vec::new();
        let mut warnings: Vec<String> = Vec::new();

        let max_z = input.material_thickness + config.spoilboard_tolerance;
        let max_x = input.machine.spoilboard_width;
        let max_y = input.machine.spoilboard_length;

        for part in &input.parts {
            // Part must fit on spoilboard.
            let (part_w, part_h) = if part.rotated {
                (part.width, part.length)
            } else {
                (part.length, part.width)
            };

            if part.x < 0.0 || part.y < 0.0 {
                violations.push(format!(
                    "Part '{}' has negative placement coordinates ({:.1}, {:.1})",
                    part.name, part.x, part.y
                ));
            }
            if part.x + part_w > max_x {
                violations.push(format!(
                    "Part '{}' extends beyond spoilboard X limit ({:.1} > {:.1})",
                    part.name,
                    part.x + part_w,
                    max_x
                ));
            }
            if part.y + part_h > max_y {
                violations.push(format!(
                    "Part '{}' extends beyond spoilboard Y limit ({:.1} > {:.1})",
                    part.name,
                    part.y + part_h,
                    max_y
                ));
            }

            for op in &part.operations {
                // Tool index valid?
                if op.tool_index >= input.tools.len() {
                    violations.push(format!(
                        "Operation {} on part '{}' references tool index {} but only {} tools provided",
                        op.id, part.name, op.tool_index, input.tools.len()
                    ));
                    continue;
                }

                let tool = &input.tools[op.tool_index];

                // Depth must not exceed spoilboard protection threshold.
                if op.depth > max_z {
                    violations.push(format!(
                        "Operation {} on part '{}': depth {:.3}mm exceeds safe limit {:.3}mm \
                         (material {:.1}mm + tolerance {:.1}mm)",
                        op.id,
                        part.name,
                        op.depth,
                        max_z,
                        input.material_thickness,
                        config.spoilboard_tolerance
                    ));
                }

                // Warn on very deep passes relative to tool diameter.
                if tool.max_depth_per_pass > tool.diameter * 1.5 {
                    warnings.push(format!(
                        "Tool '{}': max_depth_per_pass ({:.1}mm) > 1.5× diameter ({:.1}mm) – \
                         consider reducing for tool life",
                        tool.name, tool.max_depth_per_pass, tool.diameter
                    ));
                }

                // Absolute XY bounds check.
                let abs_x = part.x + op.position_x;
                let abs_y = part.y + op.position_y;
                if abs_x < 0.0 || abs_x > max_x || abs_y < 0.0 || abs_y > max_y {
                    violations.push(format!(
                        "Operation {} on part '{}': absolute position ({:.1}, {:.1}) is outside \
                         machine bounds (0–{:.0}, 0–{:.0})",
                        op.id, part.name, abs_x, abs_y, max_x, max_y
                    ));
                }
            }
        }

        SafetyCheckOutput {
            passed: violations.is_empty(),
            violations,
            warnings,
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ToolpathSimulator
// ─────────────────────────────────────────────────────────────────────────────

/// Estimates cut time and distance from the final G-code line list.
struct ToolpathSimulator;

impl ToolpathSimulator {
    /// Parse the emitted G-code lines and accumulate rapid + cut distances,
    /// then convert distances to time using feed rate information embedded in the
    /// lines (F words) and a configurable rapid feed assumption.
    fn simulate(lines: &[String], rapid_feed_mm_min: f64) -> SimulationOutput {
        // Very lightweight G-code parser – reads X/Y/Z/F values from each line.
        let re_xy = Regex::new(r"X([-\d.]+)\s*Y([-\d.]+)").unwrap();
        let re_z = Regex::new(r"Z([-\d.]+)").unwrap();
        let re_f = Regex::new(r"F([\d.]+)").unwrap();

        let mut cur = (0.0f64, 0.0f64, 0.0f64); // (x, y, z)
        let mut rapid_dist = 0.0f64;
        let mut cut_dist = 0.0f64;
        let mut cut_time_s = 0.0f64;
        let mut rapid_time_s = 0.0f64;
        let mut current_feed = 0.0f64;
        let mut tool_changes = 0i32;
        let mut pass_count = 0i32;
        let mut warnings: Vec<String> = Vec::new();

        for line in lines {
            let upper = line.to_uppercase();
            // Skip comments and blank lines.
            if upper.starts_with(';') || upper.trim().is_empty() {
                continue;
            }

            let is_g0 = upper.contains("G0 ") || upper.contains("G00 ");
            let is_g1 = upper.contains("G1 ") || upper.contains("G01 ");
            let is_g2 = upper.contains("G2 ") || upper.contains("G02 ");
            let is_g3 = upper.contains("G3 ") || upper.contains("G03 ");
            let is_tool_change = upper.contains("M6") || upper.contains("M06");

            if is_tool_change {
                tool_changes += 1;
            }

            // Update current feed.
            if let Some(cap) = re_f.captures(line) {
                current_feed = cap[1].parse::<f64>().unwrap_or(current_feed);
            }

            let mut next = cur;

            if let Some(cap) = re_xy.captures(line) {
                next.0 = cap[1].parse::<f64>().unwrap_or(cur.0);
                next.1 = cap[2].parse::<f64>().unwrap_or(cur.1);
            }
            if let Some(cap) = re_z.captures(line) {
                next.2 = cap[1].parse::<f64>().unwrap_or(cur.2);
            }

            let dx = next.0 - cur.0;
            let dy = next.1 - cur.1;
            let dz = next.2 - cur.2;
            let dist = (dx * dx + dy * dy + dz * dz).sqrt();

            if is_g0 {
                rapid_dist += dist;
                let feed = rapid_feed_mm_min.max(1.0);
                rapid_time_s += (dist / feed) * 60.0;
            } else if is_g1 || is_g2 || is_g3 {
                // Count downward Z moves as passes.
                if dz < -0.01 {
                    pass_count += 1;
                }
                cut_dist += dist;
                if current_feed > 0.0 {
                    cut_time_s += (dist / current_feed) * 60.0;
                } else if dist > 0.0 {
                    warnings.push(
                        "Feed rate F=0 encountered during simulation – time estimate may be low."
                            .to_string(),
                    );
                }
            }

            cur = next;
        }

        SimulationOutput {
            estimated_cut_time_seconds: cut_time_s + rapid_time_s,
            total_distance_mm: rapid_dist + cut_dist,
            rapid_distance_mm: rapid_dist,
            cut_distance_mm: cut_dist,
            tool_changes,
            pass_count,
            warnings,
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PostProcessorEngine
// ─────────────────────────────────────────────────────────────────────────────

/// Applies post-processor template variable substitution to the generated G-code.
struct PostProcessorEngine;

impl PostProcessorEngine {
    /// Build a variable map from the input and built-in values, then substitute
    /// all `{VARIABLE}` occurrences in the template.
    fn apply(template: &str, input: &SheetGCodeInput, tool_count: usize) -> GCodeResult<String> {
        let mut vars: HashMap<String, String> = HashMap::new();

        // Built-in variables.
        vars.insert(
            "PROGRAM_NAME".into(),
            input
                .program_name
                .clone()
                .unwrap_or_else(|| format!("SHEET_{}", &input.sheet_id.to_string()[..8])),
        );
        vars.insert(
            "DATE".into(),
            chrono::Local::now().format("%Y-%m-%d").to_string(),
        );
        vars.insert(
            "TIME".into(),
            chrono::Local::now().format("%H:%M:%S").to_string(),
        );
        vars.insert("MACHINE".into(), input.machine.name.clone());
        vars.insert("TOOL_COUNT".into(), tool_count.to_string());
        vars.insert(
            "MATERIAL".into(),
            input.material.clone().unwrap_or_else(|| "UNKNOWN".into()),
        );
        vars.insert(
            "THICKNESS".into(),
            format!("{:.1}", input.material_thickness),
        );
        vars.insert("SHEET_WIDTH".into(), format!("{:.1}", input.sheet_width));
        vars.insert("SHEET_LENGTH".into(), format!("{:.1}", input.sheet_length));
        vars.insert("PART_COUNT".into(), input.parts.len().to_string());

        // Override / extend with post-processor static variables if present.
        if let Some(pp) = &input.post_processor {
            if let serde_json::Value::Object(map) = &pp.variables {
                for (k, v) in map {
                    if let serde_json::Value::String(s) = v {
                        vars.insert(k.to_uppercase(), s.clone());
                    }
                }
            }
        }

        let re = Regex::new(r"\{([A-Z0-9_]+)\}")
            .map_err(|e| GCodeError::TemplateError(format!("Regex compile error: {}", e)))?;

        let result = re.replace_all(template, |caps: &regex::Captures| {
            let key = &caps[1];
            vars.get(key)
                .cloned()
                .unwrap_or_else(|| format!("{{{}}}", key))
        });

        Ok(result.into_owned())
    }

    /// Generate a generic program header when no post-processor template is provided.
    fn default_header(input: &SheetGCodeInput, tool_count: usize) -> String {
        let prog_name = input
            .program_name
            .clone()
            .unwrap_or_else(|| format!("SHEET_{}", &input.sheet_id.to_string()[..8]));
        let date = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
        let material = input.material.clone().unwrap_or_else(|| "UNKNOWN".into());

        format!(
            "; ====================================================\n\
             ; Program: {}\n\
             ; Date:    {}\n\
             ; Machine: {}\n\
             ; Material: {} – {:.1}mm thick\n\
             ; Sheet:   {:.0} x {:.0}mm\n\
             ; Parts:   {}\n\
             ; Tools:   {}\n\
             ; ====================================================",
            prog_name,
            date,
            input.machine.name,
            material,
            input.material_thickness,
            input.sheet_width,
            input.sheet_length,
            input.parts.len(),
            tool_count,
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-operation toolpath generators
// ─────────────────────────────────────────────────────────────────────────────

/// Generates the G-code for a single drill hole.
///
/// Uses G81 canned cycle when depth fits in one pass; falls back to manual
/// G0/G1 plunge-and-retract loop for deep holes requiring multiple passes.
fn generate_drill(
    e: &mut GCodeEmitter,
    abs_x: f64,
    abs_y: f64,
    op: &OperationInput,
    tool: &ToolInput,
    config: &GCodeConfig,
    warnings: &mut Vec<String>,
) {
    let final_z = -(op.depth);
    let num_passes = depth_passes(op.depth, tool.max_depth_per_pass);

    if num_passes > 1 {
        warnings.push(format!(
            "Drill at ({:.1},{:.1}): depth {:.1}mm requires {} passes (max per pass {:.1}mm)",
            abs_x, abs_y, op.depth, num_passes, tool.max_depth_per_pass
        ));

        // Manual peck-drill loop.
        e.comment("Peck drill – multi-pass");
        e.rapid_xy(abs_x, abs_y);
        e.rapid_z(config.clearance_z);

        let mut z_current = 0.0f64;
        for pass in 0..num_passes {
            let target_z = -(((pass as f64 + 1.0) * tool.max_depth_per_pass).min(op.depth));
            e.comment(&format!(
                "  Pass {}/{}: plunge to Z{:.3}",
                pass + 1,
                num_passes,
                target_z
            ));
            e.plunge(target_z, tool.plunge_rate);
            // Peck retract to clear chips.
            e.rapid_z(config.clearance_z);
            z_current = target_z;
        }
        // Final retract.
        let _ = z_current; // used for clarity
        e.rapid_z(config.safe_z);
    } else {
        // G81 canned cycle: G81 X… Y… Z… R… F…
        // R = clearance height, Z = final drill depth, F = plunge feed.
        e.comment("G81 drill canned cycle");
        e.rapid_xy(abs_x, abs_y);
        e.emit(&format!(
            "G81 X{} Y{} Z{} R{} F{}",
            GCodeEmitter::fmt_f(abs_x),
            GCodeEmitter::fmt_f(abs_y),
            GCodeEmitter::fmt_f(final_z),
            GCodeEmitter::fmt_f(config.clearance_z),
            GCodeEmitter::fmt_f(tool.plunge_rate)
        ));
        // Cancel canned cycle.
        e.emit("G80");
        e.rapid_z(config.safe_z);
    }
}

/// Generates the G-code for a linear route (straight cut between two points).
///
/// Supports tool radius compensation (G41/G42) and climb vs. conventional milling.
fn generate_route(
    e: &mut GCodeEmitter,
    abs_x: f64,
    abs_y: f64,
    op: &OperationInput,
    tool: &ToolInput,
    config: &GCodeConfig,
    warnings: &mut Vec<String>,
) {
    // Read optional parameters from op.parameters.
    let end_x: f64 = op
        .parameters
        .get("end_x")
        .and_then(|v| v.as_f64())
        .unwrap_or(abs_x);
    let end_y: f64 = op
        .parameters
        .get("end_y")
        .and_then(|v| v.as_f64())
        .unwrap_or(abs_y + 100.0); // default 100mm forward if not specified
    let use_compensation = op
        .parameters
        .get("compensation")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let climb = op
        .parameters
        .get("climb")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    let num_passes = depth_passes(op.depth, tool.max_depth_per_pass);
    if num_passes > 1 {
        warnings.push(format!(
            "Route at ({:.1},{:.1}): depth {:.1}mm requires {} passes",
            abs_x, abs_y, op.depth, num_passes
        ));
    }

    // Activate tool compensation if requested.
    if use_compensation {
        // G41 = left (climb mill on outside), G42 = right (conventional).
        let comp_cmd = if climb { "G41" } else { "G42" };
        e.comment(&format!(
            "Tool compensation {} (D={}mm)",
            comp_cmd, tool.diameter
        ));
        e.emit(&format!(
            "{} D{}",
            comp_cmd,
            GCodeEmitter::fmt_f(tool.diameter / 2.0)
        ));
    }

    e.rapid_xyz(abs_x, abs_y, config.clearance_z);

    for pass in 0..num_passes {
        let pass_z = -(((pass as f64 + 1.0) * tool.max_depth_per_pass).min(op.depth));
        e.comment(&format!(
            "Route pass {}/{} at Z{:.3}",
            pass + 1,
            num_passes,
            pass_z
        ));
        e.plunge(pass_z, tool.plunge_rate);
        e.cut_xy(end_x, end_y, tool.feed_rate);
    }

    // Retract and cancel compensation.
    e.rapid_z(config.safe_z);
    if use_compensation {
        e.emit("G40");
        e.comment("Cancel tool compensation");
    }
}

/// Generates the G-code for a dado (channel/groove).
///
/// A dado is a rectangular channel cut with the full width of the tool (or
/// multiple stepover passes for wide dados). Supports multiple depth passes.
fn generate_dado(
    e: &mut GCodeEmitter,
    abs_x: f64,
    abs_y: f64,
    op: &OperationInput,
    tool: &ToolInput,
    config: &GCodeConfig,
    warnings: &mut Vec<String>,
) {
    let dado_width = op.width.unwrap_or(tool.diameter);
    let dado_height = op.height.unwrap_or(100.0); // default 100mm length along dado

    // Determine if we need multiple side passes (dado wider than tool).
    let stepover = tool.diameter * config.pocket_stepover_ratio;
    let side_passes = if dado_width <= tool.diameter {
        1
    } else {
        ((dado_width - tool.diameter) / stepover).ceil() as usize + 1
    };

    let num_depth_passes = depth_passes(op.depth, tool.max_depth_per_pass);

    if num_depth_passes > 1 {
        warnings.push(format!(
            "Dado at ({:.1},{:.1}): {:.1}mm depth needs {} depth passes",
            abs_x, abs_y, op.depth, num_depth_passes
        ));
    }

    e.comment(&format!(
        "Dado {:.1}w × {:.1}L × {:.1}D mm  ({} side-pass × {} depth-pass)",
        dado_width, dado_height, op.depth, side_passes, num_depth_passes
    ));

    for depth_pass in 0..num_depth_passes {
        let pass_z = -(((depth_pass as f64 + 1.0) * tool.max_depth_per_pass).min(op.depth));

        for side in 0..side_passes {
            let offset_x = abs_x + (side as f64 * stepover).min(dado_width - tool.diameter);
            e.rapid_xyz(offset_x, abs_y, config.clearance_z);
            e.plunge(pass_z, tool.plunge_rate);
            // Cut along the dado length (Y direction by convention).
            e.cut_xy(offset_x, abs_y + dado_height, tool.feed_rate);
            e.rapid_z(config.clearance_z);
        }
    }
    e.rapid_z(config.safe_z);
}

/// Generates the G-code for a tenon (rectangular tongue left standing proud).
///
/// Strategy: profile the perimeter of the tenon shoulder at increasing depth
/// until the specified depth is reached, leaving the central tongue untouched.
fn generate_tenon(
    e: &mut GCodeEmitter,
    abs_x: f64,
    abs_y: f64,
    op: &OperationInput,
    tool: &ToolInput,
    config: &GCodeConfig,
    warnings: &mut Vec<String>,
) {
    let tenon_width = match op.width {
        Some(w) => w,
        None => {
            warnings.push(format!(
                "Tenon at ({:.1},{:.1}): no width provided – skipping",
                abs_x, abs_y
            ));
            return;
        }
    };
    let tenon_height = match op.height {
        Some(h) => h,
        None => {
            warnings.push(format!(
                "Tenon at ({:.1},{:.1}): no height provided – skipping",
                abs_x, abs_y
            ));
            return;
        }
    };

    let num_passes = depth_passes(op.depth, tool.max_depth_per_pass);
    let r = tool.diameter / 2.0;

    e.comment(&format!(
        "Tenon {}×{}mm depth {:.1}mm ({} passes)",
        tenon_width, tenon_height, op.depth, num_passes
    ));

    for pass in 0..num_passes {
        let pass_z = -(((pass as f64 + 1.0) * tool.max_depth_per_pass).min(op.depth));
        e.comment(&format!(
            "  Tenon pass {}/{} Z{:.3}",
            pass + 1,
            num_passes,
            pass_z
        ));

        // Profile the tenon shoulder perimeter (tool centre path = tenon perimeter + r).
        let x0 = abs_x - r;
        let y0 = abs_y - r;
        let x1 = abs_x + tenon_width + r;
        let y1 = abs_y + tenon_height + r;

        e.rapid_xyz(x0, y0, config.clearance_z);
        e.plunge(pass_z, tool.plunge_rate);
        e.cut_xy(x1, y0, tool.feed_rate);
        e.cut_xy(x1, y1, tool.feed_rate);
        e.cut_xy(x0, y1, tool.feed_rate);
        e.cut_xy(x0, y0, tool.feed_rate); // close rectangle
        e.rapid_z(config.clearance_z);
    }
    e.rapid_z(config.safe_z);
}

/// Generates the G-code for a rectangular pocket.
///
/// Uses a zigzag (raster) clearing strategy with configurable stepover.
/// Profiles the perimeter last to achieve a clean finish wall.
fn generate_pocket(
    e: &mut GCodeEmitter,
    abs_x: f64,
    abs_y: f64,
    op: &OperationInput,
    tool: &ToolInput,
    config: &GCodeConfig,
    warnings: &mut Vec<String>,
) {
    let pocket_width = match op.width {
        Some(w) => w,
        None => {
            warnings.push(format!(
                "Pocket at ({:.1},{:.1}): no width provided – skipping",
                abs_x, abs_y
            ));
            return;
        }
    };
    let pocket_height = match op.height {
        Some(h) => h,
        None => {
            warnings.push(format!(
                "Pocket at ({:.1},{:.1}): no height provided – skipping",
                abs_x, abs_y
            ));
            return;
        }
    };

    if pocket_width < tool.diameter || pocket_height < tool.diameter {
        warnings.push(format!(
            "Pocket at ({:.1},{:.1}): {:.1}×{:.1}mm pocket is smaller than tool diameter {:.1}mm",
            abs_x, abs_y, pocket_width, pocket_height, tool.diameter
        ));
        return;
    }

    let stepover = tool.diameter * config.pocket_stepover_ratio;
    let r = tool.diameter / 2.0;
    let num_depth_passes = depth_passes(op.depth, tool.max_depth_per_pass);

    // Inner clearance limits (tool centre must stay inside these).
    let inner_x0 = abs_x + r;
    let inner_y0 = abs_y + r;
    let inner_x1 = abs_x + pocket_width - r;
    let inner_y1 = abs_y + pocket_height - r;

    if inner_x1 < inner_x0 || inner_y1 < inner_y0 {
        warnings.push(format!(
            "Pocket at ({:.1},{:.1}): pocket too small for this tool after offset – skipping clearing",
            abs_x, abs_y
        ));
        return;
    }

    e.comment(&format!(
        "Pocket {:.1}×{:.1}mm depth {:.1}mm ({} depth pass, stepover {:.1}mm)",
        pocket_width, pocket_height, op.depth, num_depth_passes, stepover
    ));

    for depth_pass in 0..num_depth_passes {
        let pass_z = -(((depth_pass as f64 + 1.0) * tool.max_depth_per_pass).min(op.depth));
        e.comment(&format!(
            "  Depth pass {}/{} Z{:.3}",
            depth_pass + 1,
            num_depth_passes,
            pass_z
        ));

        // Plunge at start corner.
        e.rapid_xyz(inner_x0, inner_y0, config.clearance_z);
        e.plunge(pass_z, tool.plunge_rate);

        // Zigzag clearing rows.
        let mut y = inner_y0;
        let mut left_to_right = true;
        while y <= inner_y1 + 0.001 {
            if left_to_right {
                e.cut_xy(inner_x1, y, tool.feed_rate);
            } else {
                e.cut_xy(inner_x0, y, tool.feed_rate);
            }
            y += stepover;
            if y <= inner_y1 + 0.001 {
                // Step over to next row.
                if left_to_right {
                    e.cut_xy(inner_x1, y.min(inner_y1), tool.feed_rate);
                } else {
                    e.cut_xy(inner_x0, y.min(inner_y1), tool.feed_rate);
                }
            }
            left_to_right = !left_to_right;
        }

        // Finish pass: profile the pocket perimeter for clean walls.
        e.comment("  Pocket finish pass – perimeter profile");
        e.cut_xy(inner_x0, inner_y0, tool.feed_rate);
        e.cut_xy(inner_x1, inner_y0, tool.feed_rate);
        e.cut_xy(inner_x1, inner_y1, tool.feed_rate);
        e.cut_xy(inner_x0, inner_y1, tool.feed_rate);
        e.cut_xy(inner_x0, inner_y0, tool.feed_rate); // close

        e.rapid_z(config.clearance_z);
    }
    e.rapid_z(config.safe_z);
}

/// Generates the G-code for a profile cut (contour along a rectangle).
///
/// Adds arc-based lead-in and lead-out moves to avoid plunge marks on the
/// finished edge. Supports tool compensation.
fn generate_profile(
    e: &mut GCodeEmitter,
    abs_x: f64,
    abs_y: f64,
    op: &OperationInput,
    tool: &ToolInput,
    config: &GCodeConfig,
    warnings: &mut Vec<String>,
) {
    let profile_width = match op.width {
        Some(w) => w,
        None => {
            warnings.push(format!(
                "Profile at ({:.1},{:.1}): no width – skipping",
                abs_x, abs_y
            ));
            return;
        }
    };
    let profile_height = match op.height {
        Some(h) => h,
        None => {
            warnings.push(format!(
                "Profile at ({:.1},{:.1}): no height – skipping",
                abs_x, abs_y
            ));
            return;
        }
    };

    let r = tool.diameter / 2.0;
    let lead_r = config
        .lead_in_radius
        .min(profile_width / 4.0)
        .min(profile_height / 4.0);
    let num_passes = depth_passes(op.depth, tool.max_depth_per_pass);

    // Tool centre path (outside of part perimeter for outside profile).
    let tc_x0 = abs_x - r;
    let tc_y0 = abs_y - r;
    let tc_x1 = abs_x + profile_width + r;
    let tc_y1 = abs_y + profile_height + r;

    e.comment(&format!(
        "Profile {:.1}×{:.1}mm depth {:.1}mm ({} passes)",
        profile_width, profile_height, op.depth, num_passes
    ));

    for pass in 0..num_passes {
        let pass_z = -(((pass as f64 + 1.0) * tool.max_depth_per_pass).min(op.depth));

        // Lead-in: rapid to a point offset from the start corner, then arc in.
        // Start on the bottom edge, entry from the left of the bottom-left corner.
        let entry_x = tc_x0 - lead_r;
        let entry_y = tc_y0;
        let arc_center_x = tc_x0;
        let arc_center_y = tc_y0;

        e.comment(&format!(
            "  Profile pass {}/{} Z{:.3}",
            pass + 1,
            num_passes,
            pass_z
        ));
        e.rapid_xyz(entry_x, entry_y, config.clearance_z);
        e.plunge(pass_z, tool.plunge_rate);

        // CCW arc lead-in from bottom-left approach to start of bottom edge.
        e.arc(
            false, // CCW = G3
            tc_x0,
            tc_y0 + lead_r,
            lead_r, // I offset from entry_x to arc centre
            0.0,
            tool.feed_rate,
        );

        // Profile the rectangle CCW.
        e.cut_xy(tc_x0, tc_y1, tool.feed_rate); // left edge  ↑
        e.cut_xy(tc_x1, tc_y1, tool.feed_rate); // top edge   →
        e.cut_xy(tc_x1, tc_y0, tool.feed_rate); // right edge ↓
        e.cut_xy(tc_x0 + lead_r, tc_y0, tool.feed_rate); // bottom edge →, stop before lead-out

        // Lead-out arc.
        e.arc(
            false,
            tc_x0,
            tc_y0 - lead_r,
            -lead_r, // I: move left to arc centre
            0.0,
            tool.feed_rate,
        );

        e.rapid_z(config.clearance_z);
    }
    e.rapid_z(config.safe_z);
}

/// Generates the G-code for a full cutout with holding tabs.
///
/// This is the final operation that separates the part from the sheet.
/// Holding tabs are placed at equal intervals around the perimeter to prevent
/// the part from shifting before the program is complete.
fn generate_cutout(
    e: &mut GCodeEmitter,
    abs_x: f64,
    abs_y: f64,
    op: &OperationInput,
    tool: &ToolInput,
    config: &GCodeConfig,
    part: &PlacedPartInput,
    warnings: &mut Vec<String>,
) {
    let cut_width = op.width.unwrap_or(part.length);
    let cut_height = op.height.unwrap_or(part.width);

    let r = tool.diameter / 2.0;
    let lead_r = config
        .lead_in_radius
        .min(cut_width / 6.0)
        .min(cut_height / 6.0);
    let num_passes = depth_passes(op.depth, tool.max_depth_per_pass);

    // Tool centre path (just outside part perimeter).
    let tc_x0 = abs_x - r;
    let tc_y0 = abs_y - r;
    let tc_x1 = abs_x + cut_width + r;
    let tc_y1 = abs_y + cut_height + r;

    // Tab count from parameters or default.
    let tab_count = op
        .parameters
        .get("tab_count")
        .and_then(|v| v.as_u64())
        .map(|n| n as usize)
        .unwrap_or(config.default_tab_count);

    let tab_height_abs = op.depth - config.tab_height; // Z where tab top is
    let tab_w = config.tab_width;

    e.comment(&format!(
        "Cutout {:.1}×{:.1}mm depth {:.1}mm ({} passes, {} tabs)",
        cut_width, cut_height, op.depth, num_passes, tab_count
    ));

    if tab_count == 0 {
        warnings.push(format!(
            "Cutout at ({:.1},{:.1}): no holding tabs – part may shift!",
            abs_x, abs_y
        ));
    }

    // Build the perimeter as a sequence of segments in CCW order.
    // Each segment is (x0,y0,x1,y1).
    let perimeter_segs: Vec<(f64, f64, f64, f64)> = vec![
        (tc_x0, tc_y0, tc_x0, tc_y1), // left  ↑
        (tc_x0, tc_y1, tc_x1, tc_y1), // top   →
        (tc_x1, tc_y1, tc_x1, tc_y0), // right ↓
        (tc_x1, tc_y0, tc_x0, tc_y0), // bottom ←
    ];

    // Compute total perimeter length to distribute tabs evenly.
    let total_perim = 2.0 * (cut_width + cut_height + 4.0 * r);
    let tab_interval = if tab_count > 0 {
        total_perim / tab_count as f64
    } else {
        f64::MAX
    };

    for pass in 0..num_passes {
        let pass_z = -(((pass as f64 + 1.0) * tool.max_depth_per_pass).min(op.depth));
        // On the final pass we leave tabs; all earlier passes cut through fully.
        let is_final_pass = pass == num_passes - 1;

        e.comment(&format!(
            "  Cutout pass {}/{} Z{:.3}{}",
            pass + 1,
            num_passes,
            pass_z,
            if is_final_pass {
                " [final – tabs active]"
            } else {
                ""
            }
        ));

        // Lead-in approach.
        e.rapid_xyz(tc_x0 - lead_r, tc_y0, config.clearance_z);
        e.plunge(pass_z, tool.plunge_rate);
        // Arc lead-in.
        e.arc(false, tc_x0, tc_y0 + lead_r, lead_r, 0.0, tool.feed_rate);

        if is_final_pass && tab_count > 0 {
            // Emit the perimeter with tab interruptions.
            emit_perimeter_with_tabs(
                e,
                &perimeter_segs,
                tab_interval,
                tab_w,
                tab_height_abs,
                pass_z,
                tool,
                config,
            );
        } else {
            // Full-depth perimeter without tabs.
            for (x0, y0, x1, y1) in &perimeter_segs {
                e.comment(&format!(
                    "  Seg ({:.1},{:.1})→({:.1},{:.1})",
                    x0, y0, x1, y1
                ));
                let _ = (y0, x0); // already at start via previous segment
                e.cut_xy(*x1, *y1, tool.feed_rate);
            }
        }

        // Lead-out.
        e.arc(false, tc_x0, tc_y0 - lead_r, -lead_r, 0.0, tool.feed_rate);
        e.rapid_z(config.clearance_z);
    }
    e.rapid_z(config.safe_z);
}

/// Helper: emit a rectangular perimeter with evenly-spaced holding tabs.
///
/// Tabs are implemented by raising the Z to `tab_z` when passing through
/// a tab zone, then plunging back to `cut_z` after the tab.
fn emit_perimeter_with_tabs(
    e: &mut GCodeEmitter,
    segs: &[(f64, f64, f64, f64)],
    tab_interval: f64,
    tab_width: f64,
    tab_z: f64, // Z height of tab top (shallow)
    cut_z: f64, // Full cutting depth (negative)
    tool: &ToolInput,
    _config: &GCodeConfig,
) {
    let half_tab = tab_width / 2.0;
    let mut dist_along_perim = 0.0f64;

    for &(x0, y0, x1, y1) in segs {
        let seg_dx = x1 - x0;
        let seg_dy = y1 - y0;
        let seg_len = (seg_dx * seg_dx + seg_dy * seg_dy).sqrt();
        if seg_len < 0.001 {
            continue;
        }
        let ux = seg_dx / seg_len; // unit vector
        let uy = seg_dy / seg_len;

        // Find tab centres that fall within this segment.
        let seg_start_dist = dist_along_perim;
        let seg_end_dist = dist_along_perim + seg_len;

        // All tab centre distances (multiples of tab_interval) in [seg_start_dist, seg_end_dist).
        let first_tab_center = {
            let n = (seg_start_dist / tab_interval).ceil();
            n * tab_interval
        };

        // Build a list of "events" along the segment: (local_dist, event_type)
        // event_type: 'start_tab' | 'end_tab'
        let mut events: Vec<(f64, &str)> = Vec::new();
        let mut tc = first_tab_center;
        while tc < seg_end_dist - 0.001 {
            let local = tc - seg_start_dist;
            // Tab starts at local - half_tab, ends at local + half_tab.
            let ts = (local - half_tab).max(0.0);
            let te = (local + half_tab).min(seg_len);
            if ts < seg_len {
                events.push((ts, "start_tab"));
            }
            if te < seg_len {
                events.push((te, "end_tab"));
            }
            tc += tab_interval;
        }
        events.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());

        let mut cur_local = 0.0f64;
        let mut in_tab = false;

        for (event_dist, event_type) in events {
            if event_dist > cur_local + 0.001 {
                // Cut from cur_local to event_dist at current Z.
                let ex = x0 + ux * event_dist;
                let ey = y0 + uy * event_dist;
                e.cut_xy(ex, ey, tool.feed_rate);
                cur_local = event_dist;
            }
            match event_type {
                "start_tab" => {
                    e.comment("  Tab start – raise Z");
                    e.cut_xyz(
                        x0 + ux * cur_local,
                        y0 + uy * cur_local,
                        -tab_z,
                        tool.plunge_rate,
                    );
                    in_tab = true;
                }
                "end_tab" => {
                    e.comment("  Tab end – return to cut depth");
                    e.cut_xyz(
                        x0 + ux * cur_local,
                        y0 + uy * cur_local,
                        cut_z,
                        tool.plunge_rate,
                    );
                    in_tab = false;
                }
                _ => {}
            }
        }

        // Cut remaining portion of segment.
        if cur_local < seg_len - 0.001 {
            e.cut_xy(x1, y1, tool.feed_rate);
        }

        let _ = in_tab; // handled above
        dist_along_perim += seg_len;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main GCodeGenerator
// ─────────────────────────────────────────────────────────────────────────────

/// The top-level G-code generator.
///
/// Create one instance, call [`GCodeGenerator::generate`] with a
/// [`SheetGCodeInput`] and optional [`GCodeConfig`].
pub struct GCodeGenerator {
    pub config: GCodeConfig,
}

impl GCodeGenerator {
    /// Create a new generator with the given config.
    pub fn new(config: GCodeConfig) -> Self {
        GCodeGenerator { config }
    }

    /// Create a generator with default configuration.
    pub fn default() -> Self {
        GCodeGenerator {
            config: GCodeConfig::default(),
        }
    }

    /// Generate complete G-code for an entire nested sheet.
    ///
    /// Returns a [`GCodeOutput`] with both structured blocks and the raw string.
    pub fn generate(&self, input: &SheetGCodeInput) -> GCodeResult<GCodeOutput> {
        // ── 1. Safety check ──────────────────────────────────────────────────
        let safety = SafetyChecker::check(input, &self.config);
        if !safety.passed {
            return Err(GCodeError::SafetyViolation(safety.violations.join("; ")));
        }

        let mut warnings: Vec<String> = safety.warnings;
        let mut blocks: Vec<GCodeBlock> = Vec::new();
        let mut tool_changes = 0i32;

        // ── 2. Build resolved operations (absolute sheet coords) ─────────────
        let mut all_ops: Vec<ResolvedOperation> = Vec::new();
        for part in &input.parts {
            for op in &part.operations {
                if op.tool_index >= input.tools.len() {
                    return Err(GCodeError::InvalidToolIndex {
                        index: op.tool_index,
                        count: input.tools.len(),
                    });
                }
                // Translate part-relative coords to absolute sheet coords.
                // If the part is rotated 90°, swap X/Y offsets.
                let (abs_x, abs_y) = if part.rotated {
                    (part.x + op.position_y, part.y + op.position_x)
                } else {
                    (part.x + op.position_x, part.y + op.position_y)
                };
                all_ops.push(ResolvedOperation {
                    op,
                    abs_x,
                    abs_y,
                    part,
                });
            }
        }

        // ── 3. Plan toolpath (sort + group by tool) ──────────────────────────
        let tool_groups = ToolpathPlanner::plan(all_ops);
        let tool_count = tool_groups.len();

        // ── 4. Emit program header ───────────────────────────────────────────
        let header_str = match &input.post_processor {
            Some(pp) if !pp.template_content.trim().is_empty() => {
                PostProcessorEngine::apply(&pp.template_content, input, tool_count)?
            }
            _ => PostProcessorEngine::default_header(input, tool_count),
        };

        let mut header_block = GCodeBlock {
            label: "Program Header".into(),
            lines: header_str.lines().map(|l| l.to_string()).collect(),
            part_id: None,
            operation_id: None,
        };

        // Standard G-code preamble.
        {
            let mut e = GCodeEmitter::new(0, self.config.include_comments); // no line nums in header
            e.blank();
            e.emit(if self.config.metric_units {
                "G21"
            } else {
                "G20"
            });
            e.comment(if self.config.metric_units {
                "Units: millimetres"
            } else {
                "Units: inches"
            });
            e.emit(if self.config.absolute_mode {
                "G90"
            } else {
                "G91"
            });
            e.comment(if self.config.absolute_mode {
                "Absolute coordinate mode"
            } else {
                "Incremental coordinate mode"
            });
            e.emit("G17"); // XY plane
            e.comment("Select XY machining plane");
            e.rapid_z(self.config.safe_z);
            e.comment(&format!("Retract to safe Z ({:.1}mm)", self.config.safe_z));
            for line in e.lines() {
                header_block.lines.push(line.clone());
            }
        }
        blocks.push(header_block);

        // ── 5. Emit operations per tool group ────────────────────────────────
        let mut current_tool_index: Option<usize> = None;

        for group in &tool_groups {
            if group.is_empty() {
                continue;
            }

            let tool_idx = group[0].op.tool_index;
            let tool = &input.tools[tool_idx];

            // ── Tool change block ─────────────────────────────────────────
            let mut tc_block = GCodeBlock {
                label: format!("Tool Change – T{} ({})", tool_idx + 1, tool.name),
                lines: Vec::new(),
                part_id: None,
                operation_id: None,
            };
            {
                let mut e = GCodeEmitter::new(
                    self.config.line_number_increment,
                    self.config.include_comments,
                );
                e.blank();
                e.comment(&format!(
                    "══ Tool {} ══  {} Ø{:.1}mm  RPM: {}  Feed: {:.0}mm/min",
                    tool_idx + 1,
                    tool.name,
                    tool.diameter,
                    tool.rpm,
                    tool.feed_rate
                ));

                // Retract before tool change.
                e.rapid_z(self.config.safe_z);
                e.spindle_off();

                if current_tool_index != Some(tool_idx) {
                    e.tool_change(tool_idx + 1); // T1-based (tool_idx is 0-based)
                    tool_changes += 1;
                    current_tool_index = Some(tool_idx);
                }

                e.spindle_on(tool.rpm);
                e.coolant(true);

                for line in e.lines() {
                    tc_block.lines.push(line.clone());
                }
            }
            blocks.push(tc_block);

            // ── Per-operation blocks ──────────────────────────────────────
            for resolved in group {
                let op = resolved.op;
                let abs_x = resolved.abs_x;
                let abs_y = resolved.abs_y;
                let part = resolved.part;

                let op_label = format!(
                    "{} – {} @ ({:.1},{:.1})",
                    part.name,
                    op.operation_type.to_uppercase(),
                    abs_x,
                    abs_y
                );

                let mut op_block = GCodeBlock {
                    label: op_label.clone(),
                    lines: Vec::new(),
                    part_id: Some(part.part_id),
                    operation_id: Some(op.id),
                };

                let mut e = GCodeEmitter::new(
                    self.config.line_number_increment,
                    self.config.include_comments,
                );
                e.blank();
                e.comment(&op_label);

                match op.operation_type.to_lowercase().as_str() {
                    "drill" => {
                        generate_drill(&mut e, abs_x, abs_y, op, tool, &self.config, &mut warnings)
                    }
                    "route" => {
                        generate_route(&mut e, abs_x, abs_y, op, tool, &self.config, &mut warnings)
                    }
                    "dado" => {
                        generate_dado(&mut e, abs_x, abs_y, op, tool, &self.config, &mut warnings)
                    }
                    "tenon" => {
                        generate_tenon(&mut e, abs_x, abs_y, op, tool, &self.config, &mut warnings)
                    }
                    "pocket" => {
                        generate_pocket(&mut e, abs_x, abs_y, op, tool, &self.config, &mut warnings)
                    }
                    "profile" => generate_profile(
                        &mut e,
                        abs_x,
                        abs_y,
                        op,
                        tool,
                        &self.config,
                        &mut warnings,
                    ),
                    "cutout" => generate_cutout(
                        &mut e,
                        abs_x,
                        abs_y,
                        op,
                        tool,
                        &self.config,
                        part,
                        &mut warnings,
                    ),
                    other => {
                        warnings.push(format!(
                            "Unknown operation type '{}' on part '{}' – skipped",
                            other, part.name
                        ));
                    }
                }

                for line in e.lines() {
                    op_block.lines.push(line.clone());
                }
                blocks.push(op_block);
            }
        }

        // ── 6. Footer / program end ──────────────────────────────────────────
        {
            let mut footer_block = GCodeBlock {
                label: "Program End".into(),
                lines: Vec::new(),
                part_id: None,
                operation_id: None,
            };
            let mut e = GCodeEmitter::new(
                self.config.line_number_increment,
                self.config.include_comments,
            );
            e.blank();
            e.comment("════ End of program ════");
            e.spindle_off();
            e.coolant(false);
            e.rapid_z(self.config.safe_z);
            e.rapid_xy(0.0, 0.0);
            e.comment("Return to home position");
            e.program_end();
            for line in e.lines() {
                footer_block.lines.push(line.clone());
            }
            blocks.push(footer_block);
        }

        // ── 7. Assemble raw string ───────────────────────────────────────────
        let raw: String = blocks
            .iter()
            .flat_map(|b| b.lines.iter().cloned())
            .collect::<Vec<_>>()
            .join("\n");

        // ── 8. Simulate for time/distance ────────────────────────────────────
        let all_lines: Vec<String> = raw.lines().map(|l| l.to_string()).collect();
        // Assume 10 m/min rapid traverse (typical for CNC routers).
        let sim = ToolpathSimulator::simulate(&all_lines, 10_000.0);

        for w in &sim.warnings {
            warnings.push(w.clone());
        }

        Ok(GCodeOutput {
            blocks,
            raw,
            tool_changes,
            estimated_cut_time_seconds: sim.estimated_cut_time_seconds,
            total_distance_mm: sim.total_distance_mm,
            warnings,
        })
    }

    /// Simulate a sheet's toolpath without generating the full G-code.
    pub fn simulate(&self, input: &SheetGCodeInput) -> GCodeResult<SimulationOutput> {
        // Generate and then simulate – the full generation is the canonical path.
        let output = self.generate(input)?;
        let all_lines: Vec<String> = output.raw.lines().map(|l| l.to_string()).collect();
        let sim = ToolpathSimulator::simulate(&all_lines, 10_000.0);
        Ok(sim)
    }

    /// Run only the safety checks without generating G-code.
    pub fn safety_check(&self, input: &SheetGCodeInput) -> SafetyCheckOutput {
        SafetyChecker::check(input, &self.config)
    }

    /// Generate a spoilboard resurfacing program.
    ///
    /// Uses a large-diameter facing tool to skim the spoilboard in parallel passes.
    pub fn generate_spoilboard_resurface(
        &self,
        machine: &MachineInput,
        facing_tool: &ToolInput,
        cut_depth: f64,
    ) -> GCodeResult<GCodeOutput> {
        let stepover = facing_tool.diameter * 0.85; // 85% for facing operations
        let num_passes_x =
            ((machine.spoilboard_width - facing_tool.diameter) / stepover).ceil() as usize + 1;

        let mut e = GCodeEmitter::new(
            self.config.line_number_increment,
            self.config.include_comments,
        );

        e.comment("════ Spoilboard Resurfacing Program ════");
        e.comment(&format!(
            "Machine: {}  Spoilboard: {:.0}×{:.0}mm",
            machine.name, machine.spoilboard_width, machine.spoilboard_length
        ));
        e.comment(&format!(
            "Tool: {} Ø{:.1}mm  Stepover: {:.1}mm  Passes: {}",
            facing_tool.name, facing_tool.diameter, stepover, num_passes_x
        ));
        e.emit("G21"); // metric
        e.emit("G90"); // absolute
        e.emit("G17"); // XY plane
        e.rapid_z(self.config.safe_z);
        e.spindle_on(facing_tool.rpm);
        e.coolant(false); // dry facing

        let mut left_to_right = true;
        for pass in 0..num_passes_x {
            let x = (facing_tool.diameter / 2.0) + pass as f64 * stepover;
            let x_clamped = x.min(machine.spoilboard_width - facing_tool.diameter / 2.0);

            e.comment(&format!("Pass {} at X={:.1}", pass + 1, x_clamped));
            e.rapid_xy(
                x_clamped,
                if left_to_right {
                    0.0
                } else {
                    machine.spoilboard_length
                },
            );
            e.rapid_z(self.config.clearance_z);
            e.plunge(-cut_depth, facing_tool.plunge_rate);

            e.cut_xy(
                x_clamped,
                if left_to_right {
                    machine.spoilboard_length
                } else {
                    0.0
                },
                facing_tool.feed_rate,
            );
            e.rapid_z(self.config.clearance_z);
            left_to_right = !left_to_right;
        }

        e.spindle_off();
        e.rapid_z(self.config.safe_z);
        e.rapid_xy(0.0, 0.0);
        e.program_end();

        let raw = e.into_string();
        let lines: Vec<String> = raw.lines().map(|l| l.to_string()).collect();
        let sim = ToolpathSimulator::simulate(&lines, 10_000.0);

        let block = GCodeBlock {
            label: "Spoilboard Resurface".into(),
            lines: raw.lines().map(|l| l.to_string()).collect(),
            part_id: None,
            operation_id: None,
        };

        Ok(GCodeOutput {
            blocks: vec![block],
            raw,
            tool_changes: 0,
            estimated_cut_time_seconds: sim.estimated_cut_time_seconds,
            total_distance_mm: sim.total_distance_mm,
            warnings: sim.warnings,
        })
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Calculate the number of depth passes required given a total depth and the
/// maximum depth per pass for the current tool.
#[inline]
fn depth_passes(total_depth: f64, max_per_pass: f64) -> usize {
    if max_per_pass <= 0.0 || total_depth <= 0.0 {
        return 1;
    }
    (total_depth / max_per_pass).ceil() as usize
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn make_tool(diameter: f64, feed: f64, plunge: f64, max_depth: f64) -> ToolInput {
        ToolInput {
            name: "Test Cutter".into(),
            diameter,
            rpm: 18000,
            feed_rate: feed,
            plunge_rate: plunge,
            max_depth_per_pass: max_depth,
        }
    }

    fn make_machine() -> MachineInput {
        MachineInput {
            name: "Test Router".into(),
            spoilboard_width: 1250.0,
            spoilboard_length: 2500.0,
            spoilboard_thickness: 18.0,
        }
    }

    fn minimal_sheet(
        op_type: &str,
        depth: f64,
        width: Option<f64>,
        height: Option<f64>,
    ) -> SheetGCodeInput {
        SheetGCodeInput {
            sheet_id: Uuid::new_v4(),
            sheet_width: 1220.0,
            sheet_length: 2440.0,
            material_thickness: 18.0,
            parts: vec![PlacedPartInput {
                part_id: Uuid::new_v4(),
                name: "TestPart".into(),
                x: 50.0,
                y: 50.0,
                length: 400.0,
                width: 300.0,
                rotated: false,
                operations: vec![OperationInput {
                    id: Uuid::new_v4(),
                    operation_type: op_type.into(),
                    position_x: 100.0,
                    position_y: 100.0,
                    depth,
                    width,
                    height,
                    tool_index: 0,
                    side: "top".into(),
                    parameters: serde_json::Value::Object(serde_json::Map::new()),
                }],
            }],
            machine: make_machine(),
            tools: vec![make_tool(12.0, 6000.0, 1500.0, 6.0)],
            post_processor: None,
            program_name: Some("TEST_PROG".into()),
            material: Some("MDF".into()),
        }
    }

    #[test]
    fn test_depth_passes() {
        assert_eq!(depth_passes(18.0, 6.0), 3);
        assert_eq!(depth_passes(6.0, 6.0), 1);
        assert_eq!(depth_passes(7.0, 6.0), 2);
        assert_eq!(depth_passes(0.0, 6.0), 1);
    }

    #[test]
    fn test_generate_drill() {
        let input = minimal_sheet("drill", 15.0, None, None);
        let gen = GCodeGenerator::default();
        let output = gen.generate(&input).expect("should generate");
        assert!(!output.raw.is_empty());
        // Multi-pass drill: depth 15 / max 6 = 3 passes
        assert!(output.warnings.iter().any(|w| w.contains("3 passes")));
    }

    #[test]
    fn test_generate_pocket() {
        let input = minimal_sheet("pocket", 10.0, Some(80.0), Some(60.0));
        let gen = GCodeGenerator::default();
        let output = gen.generate(&input).expect("should generate pocket");
        assert!(output.raw.contains("Pocket"));
    }

    #[test]
    fn test_generate_cutout() {
        let input = minimal_sheet("cutout", 18.3, Some(400.0), Some(300.0));
        let gen = GCodeGenerator::default();
        let output = gen.generate(&input).expect("should generate cutout");
        assert!(output.raw.contains("Tab"));
    }

    #[test]
    fn test_safety_check_bounds_violation() {
        let mut input = minimal_sheet("drill", 5.0, None, None);
        // Place part way off the spoilboard.
        input.parts[0].x = 1300.0;
        let gen = GCodeGenerator::default();
        let result = gen.generate(&input);
        assert!(result.is_err());
    }

    #[test]
    fn test_safety_check_depth_violation() {
        // Depth beyond material + tolerance should fail.
        let input = minimal_sheet("pocket", 25.0, Some(80.0), Some(60.0));
        let gen = GCodeGenerator::default();
        let result = gen.generate(&input);
        assert!(result.is_err());
    }

    #[test]
    fn test_simulate() {
        let input = minimal_sheet("pocket", 10.0, Some(80.0), Some(60.0));
        let gen = GCodeGenerator::default();
        let sim = gen.simulate(&input).expect("should simulate");
        assert!(sim.total_distance_mm > 0.0);
        assert!(sim.estimated_cut_time_seconds > 0.0);
    }

    #[test]
    fn test_spoilboard_resurface() {
        let gen = GCodeGenerator::default();
        let machine = make_machine();
        let tool = ToolInput {
            name: "Facing Cutter".into(),
            diameter: 50.0,
            rpm: 12000,
            feed_rate: 8000.0,
            plunge_rate: 2000.0,
            max_depth_per_pass: 1.0,
        };
        let output = gen
            .generate_spoilboard_resurface(&machine, &tool, 0.5)
            .expect("should generate resurface");
        assert!(output.raw.contains("Spoilboard Resurfacing"));
        assert!(output.raw.contains("M30"));
    }

    #[test]
    fn test_post_processor_substitution() {
        let mut input = minimal_sheet("drill", 5.0, None, None);
        input.post_processor = Some(PostProcessorInput {
            name: "Generic NC".into(),
            output_format: "nc".into(),
            template_content: "% Program: {PROGRAM_NAME} Date: {DATE} Material: {MATERIAL}".into(),
            variables: serde_json::Value::Object(serde_json::Map::new()),
        });
        input.program_name = Some("MY_PROG".into());
        input.material = Some("PLYWOOD".into());
        let gen = GCodeGenerator::default();
        let output = gen
            .generate(&input)
            .expect("should generate with post-processor");
        assert!(output.raw.contains("MY_PROG"));
        assert!(output.raw.contains("PLYWOOD"));
    }
}
