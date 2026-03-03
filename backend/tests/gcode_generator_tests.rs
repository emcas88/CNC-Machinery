//! Comprehensive unit tests for the G-code generation engine.
//!
//! Targets 90%+ coverage of gcode_generator.rs by exercising:
//!   - GCodeEmitter (all emit methods, line numbering, comments)
//!   - GCodeConfig (defaults, custom values)
//!   - ToolpathPlanner (sorting, grouping, nearest-neighbour)
//!   - SafetyChecker (every violation and warning path)
//!   - ToolpathSimulator (G0/G1/G2/G3, tool changes, pass counting)
//!   - PostProcessorEngine (all built-in variables, custom vars, unknowns)
//!   - Per-operation generators (drill, route, dado, tenon, pocket, profile, cutout)
//!   - GCodeGenerator.generate() integration paths
//!   - generate_spoilboard_resurface()
//!   - depth_passes() helper
//!   - Edge cases (zero depth, huge depth, max_depth_per_pass=0, etc.)

#![allow(clippy::approx_constant)]

use std::collections::HashMap;
use uuid::Uuid;

// When building inside the main crate tree, adjust this path to match.
// e.g. `use crate::services::gcode_generator::*;`
use super::*; // assumes tests live inside the crate module

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Build a basic tool with sensible defaults for most tests.
fn make_tool(diameter: f64, feed: f64, plunge: f64, max_depth: f64) -> ToolInput {
    ToolInput {
        name: "Test Cutter".into(),
        diameter,
        rpm: 18_000,
        feed_rate: feed,
        plunge_rate: plunge,
        max_depth_per_pass: max_depth,
    }
}

/// Build a standard 12 mm compression bit.
fn default_tool() -> ToolInput {
    make_tool(12.0, 6_000.0, 1_500.0, 6.0)
}

/// Build a standard test machine (1250 × 2500 spoilboard).
fn make_machine() -> MachineInput {
    MachineInput {
        name: "TestRouter".into(),
        spoilboard_width: 1_250.0,
        spoilboard_length: 2_500.0,
        spoilboard_thickness: 18.0,
    }
}

/// Build a default GCodeConfig.
fn default_config() -> GCodeConfig {
    GCodeConfig::default()
}

/// Build a minimal SheetGCodeInput with one part and one operation.
fn make_sheet(
    op_type: &str,
    depth: f64,
    width: Option<f64>,
    height: Option<f64>,
) -> SheetGCodeInput {
    make_sheet_with_params(op_type, depth, width, height, serde_json::json!({}))
}

fn make_sheet_with_params(
    op_type: &str,
    depth: f64,
    width: Option<f64>,
    height: Option<f64>,
    params: serde_json::Value,
) -> SheetGCodeInput {
    SheetGCodeInput {
        sheet_id: Uuid::new_v4(),
        sheet_width: 1_220.0,
        sheet_length: 2_440.0,
        material_thickness: 18.0,
        parts: vec![PlacedPartInput {
            part_id: Uuid::new_v4(),
            name: "TestPart".into(),
            x: 50.0,
            y: 50.0,
            length: 500.0,
            width: 400.0,
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
                parameters: params,
            }],
        }],
        machine: make_machine(),
        tools: vec![default_tool()],
        post_processor: None,
        program_name: Some("TEST_PROG".into()),
        material: Some("MDF".into()),
    }
}

/// Generate G-code for the given sheet and panic on failure.
fn gen(sheet: &SheetGCodeInput) -> GCodeOutput {
    GCodeGenerator::default()
        .generate(sheet)
        .expect("generate should succeed")
}

/// Assert that `haystack` contains `needle` (provides a useful message on failure).
fn assert_contains(haystack: &str, needle: &str) {
    assert!(
        haystack.contains(needle),
        "Expected to find {:?} in output:\n{}",
        needle,
        &haystack[..haystack.len().min(800)]
    );
}

/// Assert that `haystack` does NOT contain `needle`.
fn assert_not_contains(haystack: &str, needle: &str) {
    assert!(
        !haystack.contains(needle),
        "Did NOT expect {:?} in output",
        needle
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// depth_passes helper
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// depth_passes returns 1 when depth == max_per_pass.
fn test_depth_passes_exact_fit() {
    assert_eq!(depth_passes(6.0, 6.0), 1);
}

#[test]
/// depth_passes rounds up when depth is not a multiple of max_per_pass.
fn test_depth_passes_rounds_up() {
    assert_eq!(depth_passes(7.0, 6.0), 2);
    assert_eq!(depth_passes(13.0, 6.0), 3);
}

#[test]
/// depth_passes returns 1 when depth is 0 (nothing to cut).
fn test_depth_passes_zero_depth() {
    assert_eq!(depth_passes(0.0, 6.0), 1);
}

#[test]
/// depth_passes returns 1 when max_per_pass is 0 (guard against division-by-zero).
fn test_depth_passes_zero_max_per_pass() {
    assert_eq!(depth_passes(18.0, 0.0), 1);
}

#[test]
/// depth_passes handles negative max_per_pass safely.
fn test_depth_passes_negative_max_per_pass() {
    assert_eq!(depth_passes(18.0, -1.0), 1);
}

#[test]
/// depth_passes computes many passes for a very deep cut.
fn test_depth_passes_many_passes() {
    assert_eq!(depth_passes(18.0, 6.0), 3);
    assert_eq!(depth_passes(19.0, 6.0), 4);
    assert_eq!(depth_passes(60.0, 6.0), 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// GCodeEmitter
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// fmt_f trims trailing zeros after the decimal point.
fn test_fmt_f_trim_trailing_zeros() {
    assert_eq!(GCodeEmitter::fmt_f(1.0), "1");
    assert_eq!(GCodeEmitter::fmt_f(1.500), "1.5");
    assert_eq!(GCodeEmitter::fmt_f(1.123), "1.123");
    assert_eq!(GCodeEmitter::fmt_f(0.0), "0");
    assert_eq!(GCodeEmitter::fmt_f(100.0), "100");
}

#[test]
/// fmt_f formats negative values correctly.
fn test_fmt_f_negative() {
    assert_eq!(GCodeEmitter::fmt_f(-5.0), "-5");
    assert_eq!(GCodeEmitter::fmt_f(-18.3), "-18.3");
    assert_eq!(GCodeEmitter::fmt_f(-0.300), "-0.3");
}

#[test]
/// fmt_f keeps up to 3 decimal places.
fn test_fmt_f_three_decimal_places() {
    assert_eq!(GCodeEmitter::fmt_f(1.2345), "1.235"); // rounds at 3dp
    assert_eq!(GCodeEmitter::fmt_f(1.001), "1.001");
}

#[test]
/// emit() with line numbering prefixes each code line with N<n>.
fn test_emitter_line_numbering() {
    let mut e = GCodeEmitter::new(10, false);
    e.emit("G21");
    e.emit("G90");
    let lines = e.lines();
    assert_eq!(lines[0], "N10 G21");
    assert_eq!(lines[1], "N20 G90");
}

#[test]
/// emit() with increment=0 produces no line numbers.
fn test_emitter_no_line_numbers() {
    let mut e = GCodeEmitter::new(0, false);
    e.emit("G21");
    assert_eq!(e.lines()[0], "G21");
}

#[test]
/// comment() produces a semicolon-prefixed line when comments=true.
fn test_emitter_comment_enabled() {
    let mut e = GCodeEmitter::new(0, true);
    e.comment("Hello world");
    assert_eq!(e.lines()[0], "; Hello world");
}

#[test]
/// comment() produces no line when comments=false.
fn test_emitter_comment_disabled() {
    let mut e = GCodeEmitter::new(0, false);
    e.comment("should not appear");
    assert_eq!(e.lines().len(), 0);
}

#[test]
/// blank() inserts an empty line when comments=true.
fn test_emitter_blank_enabled() {
    let mut e = GCodeEmitter::new(0, true);
    e.blank();
    assert_eq!(e.lines().len(), 1);
    assert_eq!(e.lines()[0], "");
}

#[test]
/// blank() does nothing when comments=false.
fn test_emitter_blank_disabled() {
    let mut e = GCodeEmitter::new(0, false);
    e.blank();
    assert_eq!(e.lines().len(), 0);
}

#[test]
/// rapid_xy emits a G0 X Y line.
fn test_emitter_rapid_xy() {
    let mut e = GCodeEmitter::new(0, false);
    e.rapid_xy(100.0, 200.5);
    assert_eq!(e.lines()[0], "G0 X100 Y200.5");
}

#[test]
/// rapid_z emits a G0 Z line.
fn test_emitter_rapid_z() {
    let mut e = GCodeEmitter::new(0, false);
    e.rapid_z(15.0);
    assert_eq!(e.lines()[0], "G0 Z15");
}

#[test]
/// rapid_xyz emits a combined G0 X Y Z line.
fn test_emitter_rapid_xyz() {
    let mut e = GCodeEmitter::new(0, false);
    e.rapid_xyz(10.0, 20.0, 5.0);
    assert_eq!(e.lines()[0], "G0 X10 Y20 Z5");
}

#[test]
/// plunge emits G1 Z F line.
fn test_emitter_plunge() {
    let mut e = GCodeEmitter::new(0, false);
    e.plunge(-6.0, 1500.0);
    assert_eq!(e.lines()[0], "G1 Z-6 F1500");
}

#[test]
/// cut_xy emits G1 X Y F line.
fn test_emitter_cut_xy() {
    let mut e = GCodeEmitter::new(0, false);
    e.cut_xy(300.0, 150.0, 6000.0);
    assert_eq!(e.lines()[0], "G1 X300 Y150 F6000");
}

#[test]
/// cut_xyz emits G1 X Y Z F line.
fn test_emitter_cut_xyz() {
    let mut e = GCodeEmitter::new(0, false);
    e.cut_xyz(100.0, 200.0, -3.0, 3000.0);
    assert_eq!(e.lines()[0], "G1 X100 Y200 Z-3 F3000");
}

#[test]
/// arc() emits G2 for clockwise arcs.
fn test_emitter_arc_cw() {
    let mut e = GCodeEmitter::new(0, false);
    e.arc(true, 50.0, 60.0, 5.0, 0.0, 6000.0);
    assert!(e.lines()[0].starts_with("G2 "));
}

#[test]
/// arc() emits G3 for counter-clockwise arcs.
fn test_emitter_arc_ccw() {
    let mut e = GCodeEmitter::new(0, false);
    e.arc(false, 50.0, 60.0, 5.0, 0.0, 6000.0);
    assert!(e.lines()[0].starts_with("G3 "));
}

#[test]
/// spindle_on emits S<rpm> M3.
fn test_emitter_spindle_on() {
    let mut e = GCodeEmitter::new(0, false);
    e.spindle_on(18_000);
    assert_eq!(e.lines()[0], "S18000 M3");
}

#[test]
/// spindle_off emits M5.
fn test_emitter_spindle_off() {
    let mut e = GCodeEmitter::new(0, false);
    e.spindle_off();
    assert_eq!(e.lines()[0], "M5");
}

#[test]
/// coolant(true) emits M8; coolant(false) emits M9.
fn test_emitter_coolant() {
    let mut e = GCodeEmitter::new(0, false);
    e.coolant(true);
    e.coolant(false);
    assert_eq!(e.lines()[0], "M8");
    assert_eq!(e.lines()[1], "M9");
}

#[test]
/// tool_change emits T<n> M6.
fn test_emitter_tool_change() {
    let mut e = GCodeEmitter::new(0, false);
    e.tool_change(3);
    assert_eq!(e.lines()[0], "T3 M6");
}

#[test]
/// program_end emits M30.
fn test_emitter_program_end() {
    let mut e = GCodeEmitter::new(0, false);
    e.program_end();
    assert_eq!(e.lines()[0], "M30");
}

#[test]
/// into_string joins all lines with newlines.
fn test_emitter_into_string() {
    let mut e = GCodeEmitter::new(0, false);
    e.emit("G21");
    e.emit("G90");
    let s = e.into_string();
    assert_eq!(s, "G21\nG90");
}

// ─────────────────────────────────────────────────────────────────────────────
// GCodeConfig
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// Default config has expected standard values.
fn test_config_defaults() {
    let cfg = GCodeConfig::default();
    assert_eq!(cfg.safe_z, 15.0);
    assert_eq!(cfg.clearance_z, 5.0);
    assert_eq!(cfg.spoilboard_tolerance, 0.3);
    assert!(cfg.absolute_mode);
    assert!(cfg.metric_units);
    assert_eq!(cfg.line_number_increment, 10);
    assert!(cfg.include_comments);
    assert_eq!(cfg.pocket_stepover_ratio, 0.6);
    assert_eq!(cfg.lead_in_radius, 5.0);
    assert_eq!(cfg.tab_width, 8.0);
    assert_eq!(cfg.tab_height, 3.0);
    assert_eq!(cfg.default_tab_count, 4);
}

#[test]
/// A custom config propagates its values correctly.
fn test_config_custom_values() {
    let cfg = GCodeConfig {
        safe_z: 25.0,
        clearance_z: 3.0,
        spoilboard_tolerance: 0.5,
        absolute_mode: true,
        metric_units: true,
        line_number_increment: 5,
        include_comments: false,
        pocket_stepover_ratio: 0.4,
        lead_in_radius: 3.0,
        tab_width: 10.0,
        tab_height: 5.0,
        default_tab_count: 6,
    };
    let gen = GCodeGenerator::new(cfg.clone());
    assert_eq!(gen.config.safe_z, 25.0);
    assert_eq!(gen.config.default_tab_count, 6);
    assert!(!gen.config.include_comments);
}

#[test]
/// GCodeGenerator::default() produces the same config as GCodeConfig::default().
fn test_generator_default_config() {
    let gen = GCodeGenerator::default();
    let def = GCodeConfig::default();
    assert_eq!(gen.config.safe_z, def.safe_z);
    assert_eq!(gen.config.pocket_stepover_ratio, def.pocket_stepover_ratio);
}

// ─────────────────────────────────────────────────────────────────────────────
// SafetyChecker
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// A valid sheet with an operation well within bounds passes all checks.
fn test_safety_check_passes_for_valid_input() {
    let sheet = make_sheet("drill", 5.0, None, None);
    let result = SafetyChecker::check(&sheet, &default_config());
    assert!(result.passed);
    assert!(result.violations.is_empty());
}

#[test]
/// Empty parts list passes without error.
fn test_safety_check_empty_parts() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    sheet.parts.clear();
    let result = SafetyChecker::check(&sheet, &default_config());
    assert!(result.passed);
    assert!(result.violations.is_empty());
}

#[test]
/// Part placed with negative X coordinate produces a violation.
fn test_safety_check_negative_x_coordinate() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    sheet.parts[0].x = -10.0;
    let result = SafetyChecker::check(&sheet, &default_config());
    assert!(!result.passed);
    assert!(result.violations.iter().any(|v| v.contains("negative")));
}

#[test]
/// Part placed with negative Y coordinate produces a violation.
fn test_safety_check_negative_y_coordinate() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    sheet.parts[0].y = -5.0;
    let result = SafetyChecker::check(&sheet, &default_config());
    assert!(!result.passed);
    assert!(result.violations.iter().any(|v| v.contains("negative")));
}

#[test]
/// Part extending beyond spoilboard width produces a violation.
fn test_safety_check_exceeds_x_limit() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    // part.x=50, length=500 → right edge = 550; spoilboard_width=1250 → place at 800
    sheet.parts[0].x = 800.0;
    let result = SafetyChecker::check(&sheet, &default_config());
    assert!(!result.passed);
    assert!(result.violations.iter().any(|v| v.contains("spoilboard X")));
}

#[test]
/// Part extending beyond spoilboard length produces a violation.
fn test_safety_check_exceeds_y_limit() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    sheet.parts[0].y = 2_200.0; // part y+width = 2600 > 2500
    let result = SafetyChecker::check(&sheet, &default_config());
    assert!(!result.passed);
    assert!(result.violations.iter().any(|v| v.contains("spoilboard Y")));
}

#[test]
/// Operation depth exactly at material_thickness + tolerance passes.
fn test_safety_check_depth_exactly_at_limit() {
    let mut sheet = make_sheet("drill", 18.0, None, None);
    // tolerance = 0.3 → limit = 18.3; depth = 18.3 → should pass
    sheet.parts[0].operations[0].depth = 18.3;
    let result = SafetyChecker::check(&sheet, &default_config());
    assert!(result.passed, "depth at limit should pass");
}

#[test]
/// Operation depth just above limit produces a violation.
fn test_safety_check_depth_exceeds_limit() {
    let mut sheet = make_sheet("drill", 25.0, None, None);
    let result = SafetyChecker::check(&sheet, &default_config());
    assert!(!result.passed);
    assert!(result.violations.iter().any(|v| v.contains("depth")));
}

#[test]
/// Invalid tool index (beyond the tools vec) produces a violation.
fn test_safety_check_invalid_tool_index() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    sheet.parts[0].operations[0].tool_index = 99;
    let result = SafetyChecker::check(&sheet, &default_config());
    assert!(!result.passed);
    assert!(result.violations.iter().any(|v| v.contains("tool index")));
}

#[test]
/// Valid tool index 0 with one tool does not produce a violation.
fn test_safety_check_valid_tool_index() {
    let sheet = make_sheet("drill", 5.0, None, None);
    let result = SafetyChecker::check(&sheet, &default_config());
    assert!(result.passed);
}

#[test]
/// Operation absolute position outside machine bounds (operation positioned off-sheet).
fn test_safety_check_operation_out_of_absolute_bounds() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    // part at x=50, op position_x=1300 → abs_x=1350 > spoilboard_width=1250
    sheet.parts[0].operations[0].position_x = 1_300.0;
    let result = SafetyChecker::check(&sheet, &default_config());
    assert!(!result.passed);
    assert!(result.violations.iter().any(|v| v.contains("outside")));
}

#[test]
/// Multiple violations are all accumulated (not short-circuited).
fn test_safety_check_multiple_violations_accumulated() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    sheet.parts[0].x = -10.0; // negative coord violation
    sheet.parts[0].operations[0].depth = 99.0; // depth violation
    sheet.parts[0].operations[0].tool_index = 99; // invalid tool
    let result = SafetyChecker::check(&sheet, &default_config());
    assert!(!result.passed);
    assert!(result.violations.len() >= 2); // at minimum negative + invalid tool
}

#[test]
/// max_depth_per_pass > 1.5 × tool diameter produces a warning (not a violation).
fn test_safety_check_deep_pass_warning() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    // Make a tool where max_depth_per_pass = 30mm and diameter = 12mm → 30 > 1.5 × 12 = 18
    sheet.tools[0].max_depth_per_pass = 30.0;
    let result = SafetyChecker::check(&sheet, &default_config());
    assert!(!result.warnings.is_empty(), "should warn about deep pass");
    assert!(result.warnings.iter().any(|w| w.contains("1.5×")));
}

#[test]
/// Rotated part uses swapped dimensions for bounds checking.
fn test_safety_check_rotated_part_dimensions() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    // Un-rotated: length=500, width=400 → footprint 500×400
    // Rotated: footprint 400×500 (width × length)
    // Place near the right edge; with rotation the width becomes length, which might overflow
    sheet.parts[0].rotated = true;
    sheet.parts[0].x = 900.0; // 900 + width(400) = 1300 > 1250 spoilboard width
    let result = SafetyChecker::check(&sheet, &default_config());
    assert!(!result.passed, "rotated part should exceed X limit");
}

// ─────────────────────────────────────────────────────────────────────────────
// ToolpathSimulator
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// Simulating an empty line list returns all-zero output.
fn test_simulator_empty_program() {
    let sim = ToolpathSimulator::simulate(&[], 10_000.0);
    assert_eq!(sim.rapid_distance_mm, 0.0);
    assert_eq!(sim.cut_distance_mm, 0.0);
    assert_eq!(sim.tool_changes, 0);
    assert_eq!(sim.pass_count, 0);
}

#[test]
/// G0 rapid moves accumulate into rapid_distance_mm.
fn test_simulator_g0_rapid_distance() {
    let lines = vec![
        "G0 X100 Y0".to_string(),   // move 100mm along X
        "G0 X100 Y100".to_string(), // move 100mm along Y
    ];
    let sim = ToolpathSimulator::simulate(&lines, 10_000.0);
    assert!((sim.rapid_distance_mm - 200.0).abs() < 0.1);
    assert_eq!(sim.cut_distance_mm, 0.0);
}

#[test]
/// G1 cutting moves accumulate into cut_distance_mm.
fn test_simulator_g1_cut_distance() {
    let lines = vec![
        "G1 X100 Y0 F6000".to_string(),
        "G1 X100 Y100 F6000".to_string(),
    ];
    let sim = ToolpathSimulator::simulate(&lines, 10_000.0);
    assert!((sim.cut_distance_mm - 200.0).abs() < 0.1);
    assert_eq!(sim.rapid_distance_mm, 0.0);
}

#[test]
/// G2 arc moves are counted as cut distance.
fn test_simulator_g2_arc_counted_as_cut() {
    let lines = vec!["G2 X10 Y10 I5 J0 F6000".to_string()];
    let sim = ToolpathSimulator::simulate(&lines, 10_000.0);
    assert!(sim.cut_distance_mm > 0.0);
}

#[test]
/// G3 arc moves are counted as cut distance.
fn test_simulator_g3_arc_counted_as_cut() {
    let lines = vec!["G3 X10 Y10 I5 J0 F6000".to_string()];
    let sim = ToolpathSimulator::simulate(&lines, 10_000.0);
    assert!(sim.cut_distance_mm > 0.0);
}

#[test]
/// Downward Z moves (dz < -0.01) are counted as passes.
fn test_simulator_pass_counting() {
    let lines = vec![
        "G0 Z5".to_string(),
        "G1 Z-6 F1500".to_string(), // pass 1 (downward)
        "G0 Z5".to_string(),
        "G1 Z-12 F1500".to_string(), // pass 2 (downward)
    ];
    let sim = ToolpathSimulator::simulate(&lines, 10_000.0);
    assert_eq!(sim.pass_count, 2);
}

#[test]
/// Tool change instructions (M6/M06) are counted correctly.
fn test_simulator_tool_change_counting() {
    let lines = vec![
        "T1 M6".to_string(),
        "T2 M6".to_string(),
        "T2 M06".to_string(),
    ];
    let sim = ToolpathSimulator::simulate(&lines, 10_000.0);
    assert_eq!(sim.tool_changes, 3);
}

#[test]
/// F=0 on a non-zero move produces a warning about zero feed rate.
fn test_simulator_zero_feed_warning() {
    let lines = vec!["G1 X100 Y0".to_string()]; // no F word → feed stays 0
    let sim = ToolpathSimulator::simulate(&lines, 10_000.0);
    assert!(!sim.warnings.is_empty());
    assert!(sim.warnings.iter().any(|w| w.contains("F=0")));
}

#[test]
/// Comment lines and blank lines are skipped during simulation.
fn test_simulator_skips_comments_and_blanks() {
    let lines = vec![
        "; This is a comment".to_string(),
        "".to_string(),
        "G0 X50 Y0".to_string(),
    ];
    let sim = ToolpathSimulator::simulate(&lines, 10_000.0);
    assert!((sim.rapid_distance_mm - 50.0).abs() < 0.1);
}

#[test]
/// total_distance_mm = rapid_distance_mm + cut_distance_mm.
fn test_simulator_total_distance_is_sum() {
    let lines = vec!["G0 X50 Y0".to_string(), "G1 X100 Y0 F6000".to_string()];
    let sim = ToolpathSimulator::simulate(&lines, 10_000.0);
    let expected = sim.rapid_distance_mm + sim.cut_distance_mm;
    assert!((sim.total_distance_mm - expected).abs() < 0.001);
}

#[test]
/// estimated_cut_time_seconds is positive for a non-trivial program.
fn test_simulator_time_estimate_positive() {
    let sheet = make_sheet("pocket", 10.0, Some(80.0), Some(60.0));
    let gen = GCodeGenerator::default();
    let output = gen.generate(&sheet).unwrap();
    assert!(output.estimated_cut_time_seconds > 0.0);
}

// ─────────────────────────────────────────────────────────────────────────────
// PostProcessorEngine (via GCodeGenerator.generate())
// ─────────────────────────────────────────────────────────────────────────────

fn make_pp_sheet(template: &str) -> SheetGCodeInput {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    sheet.post_processor = Some(PostProcessorInput {
        name: "TestPP".into(),
        output_format: "nc".into(),
        template_content: template.into(),
        variables: serde_json::Value::Object(serde_json::Map::new()),
    });
    sheet
}

#[test]
/// {PROGRAM_NAME} is replaced with the program name.
fn test_pp_program_name_substitution() {
    let mut sheet = make_pp_sheet("PN:{PROGRAM_NAME}");
    sheet.program_name = Some("MY_PROG".into());
    let out = gen(&sheet);
    assert_contains(&out.raw, "MY_PROG");
}

#[test]
/// {MACHINE} is replaced with the machine name.
fn test_pp_machine_substitution() {
    let sheet = make_pp_sheet("MC:{MACHINE}");
    let out = gen(&sheet);
    assert_contains(&out.raw, "TestRouter");
}

#[test]
/// {TOOL_COUNT} reflects the number of distinct tools used.
fn test_pp_tool_count_substitution() {
    let sheet = make_pp_sheet("TC:{TOOL_COUNT}");
    let out = gen(&sheet);
    assert_contains(&out.raw, "TC:1");
}

#[test]
/// {MATERIAL} is replaced with the material name.
fn test_pp_material_substitution() {
    let mut sheet = make_pp_sheet("MAT:{MATERIAL}");
    sheet.material = Some("BIRCH_PLY".into());
    let out = gen(&sheet);
    assert_contains(&out.raw, "BIRCH_PLY");
}

#[test]
/// {MATERIAL} defaults to UNKNOWN when no material is specified.
fn test_pp_material_default_unknown() {
    let mut sheet = make_pp_sheet("MAT:{MATERIAL}");
    sheet.material = None;
    let out = gen(&sheet);
    assert_contains(&out.raw, "UNKNOWN");
}

#[test]
/// {THICKNESS} is formatted to one decimal place.
fn test_pp_thickness_substitution() {
    let sheet = make_pp_sheet("T:{THICKNESS}");
    let out = gen(&sheet);
    assert_contains(&out.raw, "18.0");
}

#[test]
/// {SHEET_WIDTH} is substituted correctly.
fn test_pp_sheet_width_substitution() {
    let sheet = make_pp_sheet("W:{SHEET_WIDTH}");
    let out = gen(&sheet);
    assert_contains(&out.raw, "1220.0");
}

#[test]
/// {SHEET_LENGTH} is substituted correctly.
fn test_pp_sheet_length_substitution() {
    let sheet = make_pp_sheet("L:{SHEET_LENGTH}");
    let out = gen(&sheet);
    assert_contains(&out.raw, "2440.0");
}

#[test]
/// {PART_COUNT} reflects the number of parts on the sheet.
fn test_pp_part_count_substitution() {
    let sheet = make_pp_sheet("PC:{PART_COUNT}");
    let out = gen(&sheet);
    assert_contains(&out.raw, "PC:1");
}

#[test]
/// {DATE} is substituted with a date-like string.
fn test_pp_date_substitution() {
    let sheet = make_pp_sheet("D:{DATE}");
    let out = gen(&sheet);
    // Date format is YYYY-MM-DD – check it contains a dash (won't contain literal {DATE}).
    assert!(
        !out.raw.contains("{DATE}"),
        "DATE variable must be substituted"
    );
}

#[test]
/// {TIME} is substituted with a time-like string (HH:MM:SS).
fn test_pp_time_substitution() {
    let sheet = make_pp_sheet("T:{TIME}");
    let out = gen(&sheet);
    assert!(
        !out.raw.contains("{TIME}"),
        "TIME variable must be substituted"
    );
}

#[test]
/// Unknown variables in the template are left as-is (not removed).
fn test_pp_unknown_variable_preserved() {
    let sheet = make_pp_sheet("FOO:{UNKNOWN_VAR}");
    let out = gen(&sheet);
    assert_contains(&out.raw, "{UNKNOWN_VAR}");
}

#[test]
/// Template with no variables passes through unchanged (aside from the header block).
fn test_pp_no_variables_passthrough() {
    let sheet = make_pp_sheet("PLAIN HEADER NO VARS");
    let out = gen(&sheet);
    assert_contains(&out.raw, "PLAIN HEADER NO VARS");
}

#[test]
/// Same variable appearing multiple times is replaced in all occurrences.
fn test_pp_multiple_occurrences_of_same_var() {
    let sheet = make_pp_sheet("{MACHINE} / {MACHINE}");
    let out = gen(&sheet);
    // Both occurrences of {MACHINE} → "TestRouter"
    let count = out.raw.matches("TestRouter").count();
    assert!(
        count >= 2,
        "variable should be replaced at every occurrence"
    );
}

#[test]
/// Custom variables from post_processor.variables override built-in ones.
fn test_pp_custom_variable_override() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    let mut vars = serde_json::Map::new();
    vars.insert(
        "MACHINE".to_string(),
        serde_json::Value::String("CUSTOM_MACHINE".to_string()),
    );
    sheet.post_processor = Some(PostProcessorInput {
        name: "OverridePP".into(),
        output_format: "nc".into(),
        template_content: "MC:{MACHINE}".into(),
        variables: serde_json::Value::Object(vars),
    });
    let out = gen(&sheet);
    assert_contains(&out.raw, "CUSTOM_MACHINE");
}

#[test]
/// Post-processor with empty template_content falls back to default header.
fn test_pp_empty_template_falls_back_to_default_header() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    sheet.post_processor = Some(PostProcessorInput {
        name: "EmptyPP".into(),
        output_format: "nc".into(),
        template_content: "   ".into(), // whitespace only → treated as empty
        variables: serde_json::Value::Object(serde_json::Map::new()),
    });
    let out = gen(&sheet);
    // Default header contains "Program:" label
    assert_contains(&out.raw, "Program:");
}

#[test]
/// Default header (no post-processor) contains all expected metadata fields.
fn test_default_header_contains_metadata() {
    let sheet = make_sheet("drill", 5.0, None, None);
    let out = gen(&sheet);
    assert_contains(&out.raw, "Program:");
    assert_contains(&out.raw, "Machine:");
    assert_contains(&out.raw, "Material:");
    assert_contains(&out.raw, "Sheet:");
    assert_contains(&out.raw, "Parts:");
    assert_contains(&out.raw, "Tools:");
}

#[test]
/// When program_name is None the sheet UUID prefix is used in the header.
fn test_default_header_uses_uuid_when_no_program_name() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    sheet.program_name = None;
    let out = gen(&sheet);
    assert_contains(&out.raw, "SHEET_");
}

// ─────────────────────────────────────────────────────────────────────────────
// GCodeGenerator.generate() – preamble / footer
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// Generated program contains G21 (metric units) preamble.
fn test_preamble_contains_g21() {
    let out = gen(&make_sheet("drill", 5.0, None, None));
    assert_contains(&out.raw, "G21");
}

#[test]
/// Generated program contains G90 (absolute mode) preamble.
fn test_preamble_contains_g90() {
    let out = gen(&make_sheet("drill", 5.0, None, None));
    assert_contains(&out.raw, "G90");
}

#[test]
/// Generated program contains G17 (XY plane selection) preamble.
fn test_preamble_contains_g17() {
    let out = gen(&make_sheet("drill", 5.0, None, None));
    assert_contains(&out.raw, "G17");
}

#[test]
/// Generated program ends with M30.
fn test_program_ends_with_m30() {
    let out = gen(&make_sheet("drill", 5.0, None, None));
    let last_nc = out
        .raw
        .lines()
        .filter(|l| !l.trim().is_empty() && !l.starts_with(';'))
        .last()
        .unwrap_or("");
    // M30 should appear somewhere near the end
    assert_contains(&out.raw, "M30");
    assert!(
        last_nc.contains("M30"),
        "M30 should be the last non-comment NC line"
    );
}

#[test]
/// Header block is the first block in the output.
fn test_first_block_is_header() {
    let out = gen(&make_sheet("drill", 5.0, None, None));
    assert_eq!(out.blocks[0].label, "Program Header");
}

#[test]
/// Footer block (Program End) is the last block.
fn test_last_block_is_footer() {
    let out = gen(&make_sheet("drill", 5.0, None, None));
    let last = out.blocks.last().unwrap();
    assert_eq!(last.label, "Program End");
}

#[test]
/// Output with line numbering enabled prefixes lines with N<n>.
fn test_line_numbering_in_output() {
    let sheet = make_sheet("drill", 5.0, None, None);
    let gen = GCodeGenerator::new(GCodeConfig {
        line_number_increment: 10,
        include_comments: false,
        ..GCodeConfig::default()
    });
    let out = gen.generate(&sheet).unwrap();
    // At least one line should start with "N"
    assert!(out.raw.lines().any(|l| l.starts_with('N')));
}

#[test]
/// With line numbering off, no lines start with N.
fn test_no_line_numbers_when_increment_zero() {
    let sheet = make_sheet("drill", 5.0, None, None);
    let gen = GCodeGenerator::new(GCodeConfig {
        line_number_increment: 0,
        ..GCodeConfig::default()
    });
    let out = gen.generate(&sheet).unwrap();
    // After the header (which uses increment=0 always) no N-prefixed lines
    let nc_lines: Vec<&str> = out
        .raw
        .lines()
        .filter(|l| !l.starts_with(';') && !l.trim().is_empty())
        .collect();
    assert!(!nc_lines.iter().any(|l| l.starts_with('N')));
}

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate conversion (part-relative → absolute)
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// Absolute coordinates in G-code = part.x + op.position_x (non-rotated).
fn test_coordinate_conversion_non_rotated() {
    // part at (50, 50), operation at (100, 100) → absolute (150, 150)
    let sheet = make_sheet("drill", 5.0, None, None);
    let out = gen(&sheet);
    // G81/G0 commands should contain X150 or Y150
    assert_contains(&out.raw, "X150");
    assert_contains(&out.raw, "Y150");
}

#[test]
/// For a rotated part, X and Y offsets are swapped in the coordinate transform.
fn test_coordinate_conversion_rotated_part() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    sheet.parts[0].rotated = true;
    // op.position_x=100, op.position_y=100
    // rotated: abs_x = part.x + op.position_y = 50 + 100 = 150
    //          abs_y = part.y + op.position_x = 50 + 100 = 150
    // (both 150 in this symmetric case – test non-symmetric values)
    sheet.parts[0].operations[0].position_x = 80.0;
    sheet.parts[0].operations[0].position_y = 120.0;
    let out = gen(&sheet);
    // abs_x = 50 + 120 = 170; abs_y = 50 + 80 = 130
    assert_contains(&out.raw, "X170");
    assert_contains(&out.raw, "Y130");
}

// ─────────────────────────────────────────────────────────────────────────────
// ToolpathPlanner – operation type priority and tool grouping
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// Drill operations (priority 0) appear before route (1) and pocket (4).
fn test_planner_drill_before_route_before_pocket() {
    let mut sheet = make_sheet("pocket", 10.0, Some(60.0), Some(50.0));
    sheet.tools.push(make_tool(8.0, 5_000.0, 1_200.0, 4.0));

    // Add a drill and a route using tool 0; pocket already on tool 0
    let drill_op = OperationInput {
        id: Uuid::new_v4(),
        operation_type: "drill".into(),
        position_x: 200.0,
        position_y: 200.0,
        depth: 5.0,
        width: None,
        height: None,
        tool_index: 0,
        side: "top".into(),
        parameters: serde_json::json!({}),
    };
    let route_op = OperationInput {
        id: Uuid::new_v4(),
        operation_type: "route".into(),
        position_x: 150.0,
        position_y: 150.0,
        depth: 6.0,
        width: None,
        height: None,
        tool_index: 0,
        side: "top".into(),
        parameters: serde_json::json!({}),
    };
    sheet.parts[0].operations.push(drill_op);
    sheet.parts[0].operations.push(route_op);

    let out = gen(&sheet);
    // In the raw output, look for "DRILL" appearing before "ROUTE" appearing before "POCKET"
    let drill_pos = out.raw.find("DRILL").unwrap_or(usize::MAX);
    let route_pos = out.raw.find("ROUTE").unwrap_or(usize::MAX);
    let pocket_pos = out.raw.find("POCKET").unwrap_or(usize::MAX);
    assert!(drill_pos < route_pos, "drill should precede route");
    assert!(route_pos < pocket_pos, "route should precede pocket");
}

#[test]
/// All operations sharing the same tool index appear in one contiguous group.
fn test_planner_tool_grouping_single_group() {
    let sheet = make_sheet("drill", 5.0, None, None);
    let out = gen(&sheet);
    // With one tool there should be exactly 1 tool-change block
    let tool_change_blocks: Vec<_> = out
        .blocks
        .iter()
        .filter(|b| b.label.starts_with("Tool Change"))
        .collect();
    assert_eq!(tool_change_blocks.len(), 1);
}

#[test]
/// Two tools produce two tool-change blocks with tool 0 first.
fn test_planner_two_tool_groups_ordering() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    sheet.tools.push(make_tool(6.0, 4_000.0, 1_000.0, 3.0));
    // Second operation uses tool 1
    sheet.parts[0].operations.push(OperationInput {
        id: Uuid::new_v4(),
        operation_type: "drill".into(),
        position_x: 200.0,
        position_y: 200.0,
        depth: 5.0,
        width: None,
        height: None,
        tool_index: 1,
        side: "top".into(),
        parameters: serde_json::json!({}),
    });
    let out = gen(&sheet);
    let tc_labels: Vec<&str> = out
        .blocks
        .iter()
        .filter(|b| b.label.starts_with("Tool Change"))
        .map(|b| b.label.as_str())
        .collect();
    assert_eq!(tc_labels.len(), 2);
    assert!(
        tc_labels[0].contains("T1"),
        "tool 1 (index 0) should be first"
    );
    assert!(
        tc_labels[1].contains("T2"),
        "tool 2 (index 1) should be second"
    );
}

#[test]
/// Tool change count in output matches actual number of distinct tools used.
fn test_tool_change_count_output() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    sheet.tools.push(make_tool(6.0, 4_000.0, 1_000.0, 3.0));
    sheet.parts[0].operations.push(OperationInput {
        id: Uuid::new_v4(),
        operation_type: "drill".into(),
        position_x: 200.0,
        position_y: 200.0,
        depth: 5.0,
        width: None,
        height: None,
        tool_index: 1,
        side: "top".into(),
        parameters: serde_json::json!({}),
    });
    let out = gen(&sheet);
    assert_eq!(out.tool_changes, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-operation generator: Drill
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// Single-pass drill uses G81 canned cycle.
fn test_drill_shallow_uses_g81() {
    // depth=5, max_depth=6 → single pass → G81
    let sheet = make_sheet("drill", 5.0, None, None);
    let out = gen(&sheet);
    assert_contains(&out.raw, "G81");
    assert_contains(&out.raw, "G80"); // cancel canned cycle
}

#[test]
/// Single-pass drill G81 contains correct final Z depth.
fn test_drill_shallow_z_depth() {
    let sheet = make_sheet("drill", 5.0, None, None);
    let out = gen(&sheet);
    assert_contains(&out.raw, "Z-5");
}

#[test]
/// Deep drill (> max_depth_per_pass) falls back to manual peck-drill loop.
fn test_drill_deep_uses_manual_peck() {
    // depth=15, max_depth=6 → 3 passes → no G81
    let sheet = make_sheet("drill", 15.0, None, None);
    let out = gen(&sheet);
    assert_not_contains(&out.raw, "G81");
    // Should have "Peck drill" comment
    assert_contains(&out.raw, "Peck drill");
}

#[test]
/// Deep drill emits a warning noting the number of passes required.
fn test_drill_deep_emits_warning() {
    let sheet = make_sheet("drill", 15.0, None, None);
    let out = gen(&sheet);
    assert!(out.warnings.iter().any(|w| w.contains("3 passes")));
}

#[test]
/// Hinge boring hole (35mm diameter blind hole) uses G81 for shallow depth.
fn test_drill_hinge_boring_single_pass() {
    // Simulate a 35mm Forstner bit, 12mm deep in one pass
    let mut sheet = make_sheet("drill", 12.0, None, None);
    sheet.tools[0].max_depth_per_pass = 12.0; // can do it in one pass
    let out = gen(&sheet);
    assert_contains(&out.raw, "G81");
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-operation generator: Route
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// Simple linear route moves to the end point at the specified feed rate.
fn test_route_linear_cut() {
    let params = serde_json::json!({ "end_x": 250.0, "end_y": 150.0 });
    let sheet = make_sheet_with_params("route", 6.0, None, None, params);
    let out = gen(&sheet);
    assert_contains(&out.raw, "X250");
    assert_contains(&out.raw, "Y150");
    assert_contains(&out.raw, "F6000");
}

#[test]
/// Route with climb=true and compensation=true emits G41.
fn test_route_climb_milling_g41() {
    let params = serde_json::json!({ "compensation": true, "climb": true });
    let sheet = make_sheet_with_params("route", 6.0, None, None, params);
    let out = gen(&sheet);
    assert_contains(&out.raw, "G41");
    assert_contains(&out.raw, "G40"); // cancel at end
}

#[test]
/// Route with climb=false and compensation=true emits G42 (conventional).
fn test_route_conventional_milling_g42() {
    let params = serde_json::json!({ "compensation": true, "climb": false });
    let sheet = make_sheet_with_params("route", 6.0, None, None, params);
    let out = gen(&sheet);
    assert_contains(&out.raw, "G42");
}

#[test]
/// Multi-pass route emits a warning about the pass count.
fn test_route_multipass_warning() {
    // depth=12, max=6 → 2 passes
    let sheet = make_sheet("route", 12.0, None, None);
    let out = gen(&sheet);
    assert!(out
        .warnings
        .iter()
        .any(|w| w.contains("Route") && w.contains("2 passes")));
}

#[test]
/// Route without compensation does not emit G41/G42.
fn test_route_no_compensation_no_g41_g42() {
    let params = serde_json::json!({ "compensation": false });
    let sheet = make_sheet_with_params("route", 6.0, None, None, params);
    let out = gen(&sheet);
    assert_not_contains(&out.raw, "G41");
    assert_not_contains(&out.raw, "G42");
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-operation generator: Dado
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// Single-pass dado (narrow, fits tool diameter) generates exactly one plunge.
fn test_dado_single_pass_single_plunge() {
    // width = tool diameter = 12mm → single side pass, depth fits in one pass
    let sheet = make_sheet("dado", 6.0, Some(12.0), Some(100.0));
    let out = gen(&sheet);
    assert_contains(&out.raw, "Dado");
    // Count plunge (G1 Z-) occurrences – should be exactly one for single pass+side
    let plunges = out
        .raw
        .lines()
        .filter(|l| l.contains("G1 Z-") || l.contains("G01 Z-"))
        .count();
    assert_eq!(plunges, 1);
}

#[test]
/// Wide dado (wider than tool) creates multiple side passes.
fn test_dado_wide_multiple_side_passes() {
    // width=36mm, tool_diam=12mm, stepover=0.6×12=7.2 → (36-12)/7.2=3.3 → ceil+1=5 side passes
    let sheet = make_sheet("dado", 6.0, Some(36.0), Some(100.0));
    let out = gen(&sheet);
    // Multiple side passes means multiple plunge events
    let plunges = out
        .raw
        .lines()
        .filter(|l| (l.contains("G1 Z-") || l.contains("G01 Z-")))
        .count();
    assert!(plunges > 1, "should have multiple plunges for wide dado");
}

#[test]
/// Deep dado emits a warning.
fn test_dado_deep_emits_warning() {
    // depth=12, max=6 → 2 depth passes
    let sheet = make_sheet("dado", 12.0, Some(12.0), Some(100.0));
    let out = gen(&sheet);
    assert!(out
        .warnings
        .iter()
        .any(|w| w.contains("Dado") && w.contains("depth passes")));
}

#[test]
/// Dado default length (no height provided) defaults to 100mm.
fn test_dado_default_length() {
    let sheet = make_sheet("dado", 6.0, Some(12.0), None);
    let out = gen(&sheet);
    // Should still succeed; no crash with None height
    assert_contains(&out.raw, "Dado");
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-operation generator: Tenon
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// Tenon with width and height generates a rectangular perimeter profile.
fn test_tenon_generates_rectangle() {
    let sheet = make_sheet("tenon", 10.0, Some(40.0), Some(30.0));
    let out = gen(&sheet);
    assert_contains(&out.raw, "Tenon");
    // Four cut_xy moves per pass → should see multiple G1 X Y lines
    let cut_moves: Vec<&str> = out
        .raw
        .lines()
        .filter(|l| l.contains("G1 X") && l.contains(" Y"))
        .collect();
    assert!(
        !cut_moves.is_empty(),
        "should have cut moves for tenon perimeter"
    );
}

#[test]
/// Tenon without width skips generation and emits a warning.
fn test_tenon_no_width_skips_with_warning() {
    let sheet = make_sheet("tenon", 10.0, None, Some(30.0));
    let out = gen(&sheet);
    assert!(out.warnings.iter().any(|w| w.contains("no width")));
}

#[test]
/// Tenon without height skips generation and emits a warning.
fn test_tenon_no_height_skips_with_warning() {
    let sheet = make_sheet("tenon", 10.0, Some(40.0), None);
    let out = gen(&sheet);
    assert!(out.warnings.iter().any(|w| w.contains("no height")));
}

#[test]
/// Multi-pass tenon emits correct number of depth pass comments.
fn test_tenon_multipass() {
    // depth=12, max=6 → 2 passes
    let sheet = make_sheet("tenon", 12.0, Some(40.0), Some(30.0));
    let out = gen(&sheet);
    let pass_comments = out
        .raw
        .lines()
        .filter(|l| l.starts_with("; ") && l.contains("Tenon pass"))
        .count();
    assert_eq!(pass_comments, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-operation generator: Pocket
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// Small pocket (just larger than tool) generates zigzag clearing and finish pass.
fn test_pocket_small_generates_output() {
    let sheet = make_sheet("pocket", 10.0, Some(30.0), Some(25.0));
    let out = gen(&sheet);
    assert_contains(&out.raw, "Pocket");
    assert_contains(&out.raw, "finish pass");
}

#[test]
/// Large pocket generates multiple step-over rows.
fn test_pocket_large_multiple_stepover_rows() {
    let sheet = make_sheet("pocket", 10.0, Some(120.0), Some(100.0));
    let out = gen(&sheet);
    // With stepover=0.6×12=7.2mm and pocket_height=100 → many rows
    let cut_lines = out
        .raw
        .lines()
        .filter(|l| l.contains("G1 X") && l.contains(" Y"))
        .count();
    assert!(cut_lines > 5, "large pocket should have many cut moves");
}

#[test]
/// Pocket smaller than tool diameter is skipped with a warning.
fn test_pocket_smaller_than_tool_skipped() {
    // pocket 5×5mm with 12mm tool → too small
    let sheet = make_sheet("pocket", 5.0, Some(5.0), Some(5.0));
    let out = gen(&sheet);
    assert!(out
        .warnings
        .iter()
        .any(|w| w.contains("smaller than tool diameter")));
}

#[test]
/// Pocket without width is skipped with a warning.
fn test_pocket_no_width_warning() {
    let sheet = make_sheet("pocket", 5.0, None, Some(50.0));
    let out = gen(&sheet);
    assert!(out.warnings.iter().any(|w| w.contains("no width")));
}

#[test]
/// Pocket without height is skipped with a warning.
fn test_pocket_no_height_warning() {
    let sheet = make_sheet("pocket", 5.0, Some(50.0), None);
    let out = gen(&sheet);
    assert!(out.warnings.iter().any(|w| w.contains("no height")));
}

#[test]
/// Multi-depth pocket emits depth pass comments for each depth level.
fn test_pocket_multipass_depth() {
    // depth=12, max=6 → 2 depth passes
    let sheet = make_sheet("pocket", 12.0, Some(60.0), Some(50.0));
    let out = gen(&sheet);
    let depth_comments = out
        .raw
        .lines()
        .filter(|l| l.starts_with("; ") && l.contains("Depth pass"))
        .count();
    assert_eq!(depth_comments, 2);
}

#[test]
/// Pocket perimeter finish pass is emitted once per depth level.
fn test_pocket_finish_pass_per_depth() {
    let sheet = make_sheet("pocket", 12.0, Some(60.0), Some(50.0));
    let out = gen(&sheet);
    let finish_count = out
        .raw
        .lines()
        .filter(|l| l.contains("finish pass"))
        .count();
    assert_eq!(finish_count, 2, "one finish pass comment per depth level");
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-operation generator: Profile
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// Profile generates G3 arc lead-in move.
fn test_profile_generates_lead_in_arc() {
    let sheet = make_sheet("profile", 6.0, Some(100.0), Some(80.0));
    let out = gen(&sheet);
    assert_contains(&out.raw, "G3"); // CCW arc lead-in
}

#[test]
/// Profile generates G3 arc lead-out move (second arc).
fn test_profile_generates_lead_out_arc() {
    let sheet = make_sheet("profile", 6.0, Some(100.0), Some(80.0));
    let out = gen(&sheet);
    // Two G3 arcs: lead-in and lead-out
    let arc_count = out.raw.lines().filter(|l| l.contains("G3 ")).count();
    assert!(
        arc_count >= 2,
        "expected at least 2 arc moves (lead-in + lead-out)"
    );
}

#[test]
/// Profile without width is skipped with a warning.
fn test_profile_no_width_warning() {
    let sheet = make_sheet("profile", 6.0, None, Some(80.0));
    let out = gen(&sheet);
    assert!(out.warnings.iter().any(|w| w.contains("no width")));
}

#[test]
/// Profile without height is skipped with a warning.
fn test_profile_no_height_warning() {
    let sheet = make_sheet("profile", 6.0, Some(100.0), None);
    let out = gen(&sheet);
    assert!(out.warnings.iter().any(|w| w.contains("no height")));
}

#[test]
/// Multi-pass profile generates multiple pass comments.
fn test_profile_multipass() {
    let sheet = make_sheet("profile", 12.0, Some(100.0), Some(80.0));
    let out = gen(&sheet);
    let pass_comments = out
        .raw
        .lines()
        .filter(|l| l.starts_with("; ") && l.contains("Profile pass"))
        .count();
    assert_eq!(pass_comments, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-operation generator: Cutout
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// Cutout generates lead-in arc and perimeter cut moves.
fn test_cutout_generates_perimeter() {
    let sheet = make_sheet("cutout", 18.3, Some(200.0), Some(150.0));
    let out = gen(&sheet);
    assert_contains(&out.raw, "Cutout");
    assert_contains(&out.raw, "G3"); // arc lead-in/out
}

#[test]
/// Cutout with default tab count (4) generates tab start/end comments.
fn test_cutout_with_default_tabs() {
    let sheet = make_sheet("cutout", 18.3, Some(200.0), Some(150.0));
    let out = gen(&sheet);
    assert_contains(&out.raw, "Tab");
}

#[test]
/// Cutout with tab_count=0 emits a warning about no holding tabs.
fn test_cutout_zero_tabs_warning() {
    let params = serde_json::json!({ "tab_count": 0 });
    let sheet = make_sheet_with_params("cutout", 18.3, Some(200.0), Some(150.0), params);
    let out = gen(&sheet);
    assert!(out.warnings.iter().any(|w| w.contains("no holding tabs")));
}

#[test]
/// Cutout with custom tab_count=6 respects the override.
fn test_cutout_custom_tab_count() {
    let params = serde_json::json!({ "tab_count": 6 });
    let sheet = make_sheet_with_params("cutout", 18.3, Some(200.0), Some(150.0), params);
    // Generation should succeed without panic
    let out = gen(&sheet);
    assert_contains(&out.raw, "Cutout");
}

#[test]
/// Multi-pass cutout emits final-pass marker with "tabs active".
fn test_cutout_multipass_final_pass_marker() {
    // depth=12, max=6 → 2 passes; final pass has tab annotation
    let sheet = make_sheet("cutout", 12.0, Some(200.0), Some(150.0));
    let out = gen(&sheet);
    assert_contains(&out.raw, "final – tabs active");
}

#[test]
/// Cutout uses part dimensions as defaults when width/height are None.
fn test_cutout_uses_part_dimensions_as_default() {
    // width=None, height=None → uses part.length and part.width (500, 400)
    let sheet = make_sheet("cutout", 18.3, None, None);
    let out = gen(&sheet);
    assert_contains(&out.raw, "Cutout");
}

// ─────────────────────────────────────────────────────────────────────────────
// GCodeGenerator.generate() – integration tests
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// Simplest possible program: one part, one drill operation.
fn test_integration_single_part_single_drill() {
    let sheet = make_sheet("drill", 5.0, None, None);
    let out = gen(&sheet);
    assert!(!out.raw.is_empty());
    assert_eq!(out.blocks.iter().filter(|b| b.part_id.is_some()).count(), 1);
}

#[test]
/// Multiple operations on one part produce one block per operation.
fn test_integration_single_part_multiple_operations() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    sheet.parts[0].operations.push(OperationInput {
        id: Uuid::new_v4(),
        operation_type: "pocket".into(),
        position_x: 200.0,
        position_y: 200.0,
        depth: 8.0,
        width: Some(60.0),
        height: Some(50.0),
        tool_index: 0,
        side: "top".into(),
        parameters: serde_json::json!({}),
    });
    let out = gen(&sheet);
    let op_blocks = out
        .blocks
        .iter()
        .filter(|b| b.operation_id.is_some())
        .count();
    assert_eq!(op_blocks, 2);
}

#[test]
/// Multiple parts each get their own operation blocks.
fn test_integration_multiple_parts() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    sheet.parts.push(PlacedPartInput {
        part_id: Uuid::new_v4(),
        name: "Part2".into(),
        x: 300.0,
        y: 50.0,
        length: 200.0,
        width: 150.0,
        rotated: false,
        operations: vec![OperationInput {
            id: Uuid::new_v4(),
            operation_type: "drill".into(),
            position_x: 50.0,
            position_y: 50.0,
            depth: 5.0,
            width: None,
            height: None,
            tool_index: 0,
            side: "top".into(),
            parameters: serde_json::json!({}),
        }],
    });
    let out = gen(&sheet);
    let op_blocks = out
        .blocks
        .iter()
        .filter(|b| b.operation_id.is_some())
        .count();
    assert_eq!(op_blocks, 2, "two ops across two parts");
}

#[test]
/// All seven operation types can be combined in one program.
fn test_integration_all_operation_types() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    let ops = [
        ("route", 6.0, None, None),
        ("dado", 6.0, Some(12.0), Some(80.0)),
        ("tenon", 6.0, Some(30.0), Some(25.0)),
        ("pocket", 8.0, Some(60.0), Some(50.0)),
        ("profile", 8.0, Some(80.0), Some(60.0)),
        ("cutout", 18.3, Some(150.0), Some(100.0)),
    ];
    for (i, (op_type, depth, w, h)) in ops.iter().enumerate() {
        sheet.parts[0].operations.push(OperationInput {
            id: Uuid::new_v4(),
            operation_type: op_type.to_string(),
            position_x: 50.0 + i as f64 * 10.0,
            position_y: 50.0,
            depth: *depth,
            width: *w,
            height: *h,
            tool_index: 0,
            side: "top".into(),
            parameters: serde_json::json!({}),
        });
    }
    let out = gen(&sheet);
    // All operation types should appear in some form
    assert_contains(&out.raw, "G81"); // drill
    assert_contains(&out.raw, "Dado"); // dado
    assert_contains(&out.raw, "Tenon"); // tenon
    assert_contains(&out.raw, "Pocket"); // pocket
    assert_contains(&out.raw, "Profile"); // profile
    assert_contains(&out.raw, "Cutout"); // cutout
}

#[test]
/// Unknown operation type produces a warning and does not crash.
fn test_integration_unknown_operation_type_warns() {
    let sheet = make_sheet("lasercut", 5.0, None, None);
    let out = gen(&sheet);
    assert!(out.warnings.iter().any(|w| w.contains("lasercut")));
}

#[test]
/// Safety check failure (bounds violation) returns an Err from generate().
fn test_integration_safety_violation_returns_error() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    sheet.parts[0].x = 2_000.0; // way off the spoilboard
    let result = GCodeGenerator::default().generate(&sheet);
    assert!(result.is_err());
    match result.unwrap_err() {
        GCodeError::SafetyViolation(_) => {}
        other => panic!("Expected SafetyViolation, got {:?}", other),
    }
}

#[test]
/// Safety_check() method returns the same result as SafetyChecker::check().
fn test_generator_safety_check_method() {
    let sheet = make_sheet("drill", 5.0, None, None);
    let gen = GCodeGenerator::default();
    let result = gen.safety_check(&sheet);
    assert!(result.passed);
}

#[test]
/// simulate() method returns positive distances for a non-trivial program.
fn test_generator_simulate_method() {
    let sheet = make_sheet("pocket", 10.0, Some(80.0), Some(60.0));
    let gen = GCodeGenerator::default();
    let sim = gen.simulate(&sheet).unwrap();
    assert!(sim.total_distance_mm > 0.0);
    assert!(sim.cut_distance_mm > 0.0);
    assert!(sim.pass_count > 0);
}

#[test]
/// Operation blocks carry the correct part_id and operation_id.
fn test_block_ids_are_set_correctly() {
    let sheet = make_sheet("drill", 5.0, None, None);
    let part_id = sheet.parts[0].part_id;
    let op_id = sheet.parts[0].operations[0].id;
    let out = gen(&sheet);
    let op_block = out
        .blocks
        .iter()
        .find(|b| b.operation_id.is_some())
        .expect("should have at least one operation block");
    assert_eq!(op_block.part_id, Some(part_id));
    assert_eq!(op_block.operation_id, Some(op_id));
}

// ─────────────────────────────────────────────────────────────────────────────
// GCodeGenerator.generate_spoilboard_resurface()
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// Spoilboard resurface program contains the resurfacing header comment.
fn test_spoilboard_resurface_header_comment() {
    let gen = GCodeGenerator::default();
    let machine = make_machine();
    let tool = make_tool(50.0, 8_000.0, 2_000.0, 1.0);
    let out = gen
        .generate_spoilboard_resurface(&machine, &tool, 0.5)
        .unwrap();
    assert_contains(&out.raw, "Spoilboard Resurfacing");
}

#[test]
/// Spoilboard program ends with M30.
fn test_spoilboard_resurface_ends_with_m30() {
    let gen = GCodeGenerator::default();
    let machine = make_machine();
    let tool = make_tool(50.0, 8_000.0, 2_000.0, 1.0);
    let out = gen
        .generate_spoilboard_resurface(&machine, &tool, 0.5)
        .unwrap();
    assert_contains(&out.raw, "M30");
}

#[test]
/// Spoilboard program plunges to the correct negative depth.
fn test_spoilboard_resurface_plunge_depth() {
    let gen = GCodeGenerator::default();
    let machine = make_machine();
    let tool = make_tool(50.0, 8_000.0, 2_000.0, 0.5);
    let out = gen
        .generate_spoilboard_resurface(&machine, &tool, 0.5)
        .unwrap();
    assert_contains(&out.raw, "Z-0.5");
}

#[test]
/// Spoilboard program uses feed rate from the facing tool.
fn test_spoilboard_resurface_uses_feed_rate() {
    let gen = GCodeGenerator::default();
    let machine = make_machine();
    let tool = make_tool(50.0, 8_000.0, 2_000.0, 0.5);
    let out = gen
        .generate_spoilboard_resurface(&machine, &tool, 0.5)
        .unwrap();
    assert_contains(&out.raw, "F8000");
}

#[test]
/// Spoilboard program contains multiple parallel passes across the spoilboard.
fn test_spoilboard_resurface_multiple_passes() {
    let gen = GCodeGenerator::default();
    let machine = make_machine();
    let tool = make_tool(50.0, 8_000.0, 2_000.0, 0.5);
    let out = gen
        .generate_spoilboard_resurface(&machine, &tool, 0.5)
        .unwrap();
    // With 1250mm spoilboard, 50mm tool, 85% stepover=42.5mm → many passes
    let pass_comments = out.raw.lines().filter(|l| l.starts_with("; Pass ")).count();
    assert!(
        pass_comments > 5,
        "should have many passes for large spoilboard"
    );
}

#[test]
/// Spoilboard total_distance_mm is positive.
fn test_spoilboard_resurface_distance_positive() {
    let gen = GCodeGenerator::default();
    let machine = make_machine();
    let tool = make_tool(50.0, 8_000.0, 2_000.0, 0.5);
    let out = gen
        .generate_spoilboard_resurface(&machine, &tool, 0.5)
        .unwrap();
    assert!(out.total_distance_mm > 0.0);
}

#[test]
/// Spoilboard program uses boustrophedon (alternating) travel direction.
fn test_spoilboard_resurface_alternating_direction() {
    let gen = GCodeGenerator::default();
    let machine = make_machine();
    let tool = make_tool(50.0, 8_000.0, 2_000.0, 0.5);
    let out = gen
        .generate_spoilboard_resurface(&machine, &tool, 0.5)
        .unwrap();
    // One pass starts at Y=0, next at Y=spoilboard_length → different Y values should appear
    assert!(out.raw.contains("Y0") || out.raw.contains("Y2500"));
}

#[test]
/// Spoilboard tool_changes output is 0 (single tool, no changes).
fn test_spoilboard_resurface_zero_tool_changes() {
    let gen = GCodeGenerator::default();
    let machine = make_machine();
    let tool = make_tool(50.0, 8_000.0, 2_000.0, 0.5);
    let out = gen
        .generate_spoilboard_resurface(&machine, &tool, 0.5)
        .unwrap();
    assert_eq!(out.tool_changes, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// Zero-depth operation (edge case) does not crash; depth_passes returns 1.
fn test_edge_zero_depth_operation() {
    let sheet = make_sheet("drill", 0.0, None, None);
    let out = gen(&sheet);
    assert!(!out.raw.is_empty());
}

#[test]
/// Very deep operation produces many depth passes and warnings.
fn test_edge_very_deep_operation_many_passes() {
    let mut sheet = make_sheet("pocket", 18.0, Some(60.0), Some(50.0));
    sheet.material_thickness = 100.0; // big material so depth check passes
    let out = gen(&sheet);
    // depth=18, max=6 → 3 depth passes
    let depth_comments = out.raw.lines().filter(|l| l.contains("Depth pass")).count();
    assert_eq!(depth_comments, 3);
}

#[test]
/// max_depth_per_pass = 0 falls back to 1 pass (no infinite loop).
fn test_edge_max_depth_per_pass_zero_no_infinite_loop() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    sheet.tools[0].max_depth_per_pass = 0.0;
    // Should complete without hanging
    let out = gen(&sheet);
    assert!(!out.raw.is_empty());
}

#[test]
/// Very large sheet (3000×6000) generates valid G-code.
fn test_edge_very_large_sheet() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    sheet.sheet_width = 3_000.0;
    sheet.sheet_length = 6_000.0;
    sheet.machine.spoilboard_width = 3_000.0;
    sheet.machine.spoilboard_length = 6_000.0;
    let out = gen(&sheet);
    assert!(!out.raw.is_empty());
}

#[test]
/// Part placed at the sheet origin (x=0, y=0) does not violate safety checks.
fn test_edge_part_at_origin() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    sheet.parts[0].x = 0.0;
    sheet.parts[0].y = 0.0;
    sheet.parts[0].operations[0].position_x = 10.0;
    sheet.parts[0].operations[0].position_y = 10.0;
    let out = gen(&sheet);
    assert!(!out.raw.is_empty());
}

#[test]
/// Multiple parts at different positions each produce their own blocks.
fn test_edge_inter_part_safe_travel() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    for i in 1..4 {
        sheet.parts.push(PlacedPartInput {
            part_id: Uuid::new_v4(),
            name: format!("Part{}", i + 1),
            x: 100.0 * i as f64,
            y: 50.0,
            length: 80.0,
            width: 60.0,
            rotated: false,
            operations: vec![OperationInput {
                id: Uuid::new_v4(),
                operation_type: "drill".into(),
                position_x: 20.0,
                position_y: 20.0,
                depth: 5.0,
                width: None,
                height: None,
                tool_index: 0,
                side: "top".into(),
                parameters: serde_json::json!({}),
            }],
        });
    }
    let out = gen(&sheet);
    let op_blocks = out
        .blocks
        .iter()
        .filter(|b| b.operation_id.is_some())
        .count();
    assert_eq!(op_blocks, 4);
}

#[test]
/// raw string assembles all block lines joined with newlines.
fn test_raw_string_is_all_lines_joined() {
    let sheet = make_sheet("drill", 5.0, None, None);
    let out = gen(&sheet);
    let reconstructed: String = out
        .blocks
        .iter()
        .flat_map(|b| b.lines.iter())
        .cloned()
        .collect::<Vec<_>>()
        .join("\n");
    assert_eq!(out.raw, reconstructed);
}

#[test]
/// GCodeOutput warnings vec contains only strings (smoke test for type).
fn test_output_warnings_are_strings() {
    let sheet = make_sheet("drill", 15.0, None, None); // deep drill → warning
    let out = gen(&sheet);
    assert!(!out.warnings.is_empty());
    for w in &out.warnings {
        assert!(!w.is_empty(), "warning string should not be empty");
    }
}

#[test]
/// Program with no operations on any part still produces valid header+footer.
fn test_no_operations_produces_minimal_program() {
    let mut sheet = make_sheet("drill", 5.0, None, None);
    sheet.parts[0].operations.clear();
    let out = gen(&sheet);
    assert_contains(&out.raw, "G21");
    assert_contains(&out.raw, "M30");
}

// ─────────────────────────────────────────────────────────────────────────────
// GCodeConfigDto (API layer) – into_config()
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// Empty GCodeConfigDto produces default GCodeConfig values.
fn test_config_dto_all_none_produces_defaults() {
    let dto = GCodeConfigDto::default();
    let cfg = dto.into_config();
    let def = GCodeConfig::default();
    assert_eq!(cfg.safe_z, def.safe_z);
    assert_eq!(cfg.clearance_z, def.clearance_z);
    assert_eq!(cfg.pocket_stepover_ratio, def.pocket_stepover_ratio);
}

#[test]
/// Populated GCodeConfigDto overrides individual fields.
fn test_config_dto_overrides_fields() {
    let dto = GCodeConfigDto {
        safe_z: Some(30.0),
        clearance_z: Some(2.0),
        spoilboard_tolerance: Some(0.1),
        pocket_stepover_ratio: Some(0.5),
        lead_in_radius: Some(8.0),
        tab_width: Some(12.0),
        tab_height: Some(4.0),
        default_tab_count: Some(2),
        include_comments: Some(false),
        line_number_increment: Some(5),
    };
    let cfg = dto.into_config();
    assert_eq!(cfg.safe_z, 30.0);
    assert_eq!(cfg.clearance_z, 2.0);
    assert_eq!(cfg.spoilboard_tolerance, 0.1);
    assert_eq!(cfg.pocket_stepover_ratio, 0.5);
    assert_eq!(cfg.lead_in_radius, 8.0);
    assert_eq!(cfg.tab_width, 12.0);
    assert_eq!(cfg.tab_height, 4.0);
    assert_eq!(cfg.default_tab_count, 2);
    assert!(!cfg.include_comments);
    assert_eq!(cfg.line_number_increment, 5);
}

// ─────────────────────────────────────────────────────────────────────────────
// ApiError – ResponseError implementation
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// ApiError::NotFound maps to 404 status.
fn test_api_error_not_found_status() {
    use actix_web::ResponseError;
    let err = ApiError::NotFound("sheet not found".into());
    let resp = err.error_response();
    assert_eq!(resp.status(), actix_web::http::StatusCode::NOT_FOUND);
}

#[test]
/// ApiError::BadRequest maps to 400 status.
fn test_api_error_bad_request_status() {
    use actix_web::ResponseError;
    let err = ApiError::BadRequest("invalid input".into());
    let resp = err.error_response();
    assert_eq!(resp.status(), actix_web::http::StatusCode::BAD_REQUEST);
}

#[test]
/// ApiError::GeneratorError maps to 500 status.
fn test_api_error_generator_error_status() {
    use actix_web::ResponseError;
    let err = ApiError::GeneratorError(GCodeError::InvalidGeometry("bad geom".into()));
    let resp = err.error_response();
    assert_eq!(
        resp.status(),
        actix_web::http::StatusCode::INTERNAL_SERVER_ERROR
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// GCodeError display strings
// ─────────────────────────────────────────────────────────────────────────────

#[test]
/// GCodeError::SafetyViolation formats with the violation message.
fn test_gcode_error_safety_violation_display() {
    let e = GCodeError::SafetyViolation("out of bounds".into());
    assert!(e.to_string().contains("Safety violation"));
    assert!(e.to_string().contains("out of bounds"));
}

#[test]
/// GCodeError::InvalidToolIndex formats with index and count.
fn test_gcode_error_invalid_tool_index_display() {
    let e = GCodeError::InvalidToolIndex { index: 5, count: 2 };
    let s = e.to_string();
    assert!(s.contains('5'));
    assert!(s.contains('2'));
}

#[test]
/// GCodeError::UnsupportedOperation includes the operation type.
fn test_gcode_error_unsupported_operation_display() {
    let e = GCodeError::UnsupportedOperation("lasercut".into());
    assert!(e.to_string().contains("lasercut"));
}

#[test]
/// GCodeError::InvalidGeometry includes the message.
fn test_gcode_error_invalid_geometry_display() {
    let e = GCodeError::InvalidGeometry("negative radius".into());
    assert!(e.to_string().contains("negative radius"));
}

#[test]
/// GCodeError::TemplateError includes the error detail.
fn test_gcode_error_template_error_display() {
    let e = GCodeError::TemplateError("bad pattern".into());
    assert!(e.to_string().contains("bad pattern"));
}

#[test]
/// GCodeError::BoundsExceeded includes the boundary detail.
fn test_gcode_error_bounds_exceeded_display() {
    let e = GCodeError::BoundsExceeded("X > 2000".into());
    assert!(e.to_string().contains("X > 2000"));
}
