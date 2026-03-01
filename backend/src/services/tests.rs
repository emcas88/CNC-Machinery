//! Comprehensive tests for all service structs and methods.
//!
//! Services tested:
//!   - NestingEngine      – constructor params, stub returns
//!   - GCodeGenerator     – constructor, apply_post_processor passthrough, safety_check empty
//!   - CostCalculator     – constructor, apply_markups (real implementation), stub async returns
//!   - PropagationEngine  – Default impl, constructor
//!   - DovetailGenerator  – constructor, default angle 14.0, stub returns
//!   - DoorProfileGenerator – constructor, generate_mdf_door JSON shape
//!   - FlipsideManager    – constructor, generate_flip_gcode content, alignment_system empty
//!   - LabelGenerator     – constructor, generate_barcode empty bytes
//!   - CloudRenderer      – constructor fields, submit_render Ok, check_status Queued, get_result Err
//!   - FileExporter       – export_csv Ok with header, export_dxf Ok, export_sketchup/pdf Err
//!
//! For async methods that require a PgPool we create a lazy (never-connecting)
//! pool. Because all service async methods are stubs that ignore `_pool`,
//! this is safe: no real TCP connection is ever opened.

#[cfg(test)]
mod tests {
    use sqlx::postgres::PgPoolOptions;
    use sqlx::PgPool;
    use uuid::Uuid;

    /// Create a lazy PgPool that never opens a real TCP connection.
    /// Safe to use with any stub async method that ignores its `_pool` arg.
    fn lazy_pool() -> PgPool {
        PgPoolOptions::new()
            .max_connections(1)
            .connect_lazy("postgres://stub:stub@localhost:5432/stub")
            .expect("connect_lazy must not fail")
    }

    // -------------------------------------------------------------------------
    // NestingEngine
    // -------------------------------------------------------------------------
    mod nesting_engine {
        use super::lazy_pool;
        use crate::services::nesting_engine::{NestingEngine, PartToNest};
        use uuid::Uuid;

        #[test]
        fn test_nesting_engine_new_stores_kerf_width() {
            let engine = NestingEngine::new(3.2, 10.0, true);
            assert_eq!(engine.kerf_width, 3.2);
        }

        #[test]
        fn test_nesting_engine_new_stores_edge_margin() {
            let engine = NestingEngine::new(3.2, 10.0, true);
            assert_eq!(engine.edge_margin, 10.0);
        }

        #[test]
        fn test_nesting_engine_new_stores_enforce_grain_true() {
            let engine = NestingEngine::new(3.2, 10.0, true);
            assert!(engine.enforce_grain);
        }

        #[test]
        fn test_nesting_engine_new_stores_enforce_grain_false() {
            let engine = NestingEngine::new(0.0, 0.0, false);
            assert!(!engine.enforce_grain);
        }

        #[test]
        fn test_nesting_engine_zero_kerf_and_margin() {
            let engine = NestingEngine::new(0.0, 0.0, false);
            assert_eq!(engine.kerf_width, 0.0);
            assert_eq!(engine.edge_margin, 0.0);
        }

        #[tokio::test]
        async fn test_optimize_returns_empty_placements() {
            let engine = NestingEngine::new(3.2, 10.0, true);
            let pool = lazy_pool();
            let result = engine.optimize(vec![], 1220.0, 2440.0).await;
            drop(pool);
            assert!(result.placements.is_empty());
        }

        #[tokio::test]
        async fn test_optimize_returns_zero_sheet_count() {
            let engine = NestingEngine::new(3.2, 10.0, true);
            let result = engine.optimize(vec![], 1220.0, 2440.0).await;
            assert_eq!(result.sheet_count, 0);
        }

        #[tokio::test]
        async fn test_optimize_returns_zero_yield_percentage() {
            let engine = NestingEngine::new(3.2, 10.0, true);
            let result = engine.optimize(vec![], 1220.0, 2440.0).await;
            assert_eq!(result.yield_percentage, 0.0);
        }

        #[tokio::test]
        async fn test_optimize_with_parts_still_returns_empty_stub() {
            let engine = NestingEngine::new(3.2, 10.0, false);
            let parts = vec![PartToNest {
                part_id: Uuid::new_v4(),
                length: 600.0,
                width: 400.0,
                material_id: Uuid::new_v4(),
                grain_direction: "vertical".to_string(),
                quantity: 4,
            }];
            let result = engine.optimize(parts, 1220.0, 2440.0).await;
            assert!(result.placements.is_empty());
            assert_eq!(result.sheet_count, 0);
        }

        #[test]
        fn test_calculate_yield_returns_zero() {
            let engine = NestingEngine::new(3.2, 10.0, true);
            assert_eq!(engine.calculate_yield(&[], 2976800.0), 0.0);
        }

        #[test]
        fn test_respect_grain_returns_true() {
            let engine = NestingEngine::new(3.2, 10.0, true);
            let part = PartToNest {
                part_id: Uuid::new_v4(),
                length: 500.0,
                width: 300.0,
                material_id: Uuid::new_v4(),
                grain_direction: "horizontal".to_string(),
                quantity: 2,
            };
            assert!(engine.respect_grain(&part, false));
            assert!(engine.respect_grain(&part, true));
        }

        #[test]
        fn test_place_parts_on_sheet_returns_empty_tuples() {
            let engine = NestingEngine::new(3.2, 10.0, true);
            let (placed, unplaced) = engine.place_parts_on_sheet(&[], 1220.0, 2440.0);
            assert!(placed.is_empty());
            assert!(unplaced.is_empty());
        }

        #[test]
        fn test_part_to_nest_struct_fields() {
            let part_id = Uuid::new_v4();
            let part = PartToNest {
                part_id,
                length: 715.0,
                width: 554.0,
                material_id: Uuid::new_v4(),
                grain_direction: "vertical".to_string(),
                quantity: 2,
            };
            assert_eq!(part.length, 715.0);
            assert_eq!(part.quantity, 2);
        }
    }

    // -------------------------------------------------------------------------
    // GCodeGenerator
    // -------------------------------------------------------------------------
    mod gcode_generator {
        use crate::services::gcode_generator::{GCodeBlock, GCodeGenerator};
        use serde_json::json;
        use uuid::Uuid;

        #[test]
        fn test_gcode_generator_new_stores_post_processor_id() {
            let pp_id = Uuid::new_v4();
            let gen = GCodeGenerator::new(Some(pp_id), true);
            assert_eq!(gen.post_processor_id, Some(pp_id));
        }

        #[test]
        fn test_gcode_generator_new_stores_verbose_comments_true() {
            let gen = GCodeGenerator::new(None, true);
            assert!(gen.verbose_comments);
        }

        #[test]
        fn test_gcode_generator_new_no_post_processor() {
            let gen = GCodeGenerator::new(None, false);
            assert!(gen.post_processor_id.is_none());
            assert!(!gen.verbose_comments);
        }

        #[test]
        fn test_apply_post_processor_returns_input_unchanged() {
            let gen = GCodeGenerator::new(None, false);
            let raw = "G21 G90\nG0 X0 Y0\nM30\n";
            let result = gen.apply_post_processor(raw, &json!({}));
            assert_eq!(result, raw);
        }

        #[test]
        fn test_apply_post_processor_with_variables_still_returns_input() {
            let gen = GCodeGenerator::new(None, false);
            let raw = "G0 X{ORIGIN_X} Y{ORIGIN_Y}\nM30\n";
            let result = gen.apply_post_processor(raw, &json!({"ORIGIN_X": 0}));
            assert_eq!(result, raw, "Stub must return input unchanged");
        }

        #[test]
        fn test_apply_post_processor_empty_string() {
            let gen = GCodeGenerator::new(None, false);
            let result = gen.apply_post_processor("", &json!({}));
            assert_eq!(result, "");
        }

        #[test]
        fn test_apply_post_processor_multiline_program() {
            let gen = GCodeGenerator::new(None, true);
            let program = "G21\nG90\nG0 X100 Y100\nG1 Z-5 F2000\nM30\n";
            let result = gen.apply_post_processor(program, &json!({"MATERIAL": "MDF"}));
            assert_eq!(result, program);
        }

        #[test]
        fn test_simulate_toolpath_returns_zero_cut_time() {
            let gen = GCodeGenerator::new(None, false);
            let (cut_time, _) = gen.simulate_toolpath("G0 X100 Y100\nG1 X200\n");
            assert_eq!(cut_time, 0.0);
        }

        #[test]
        fn test_simulate_toolpath_returns_zero_distance() {
            let gen = GCodeGenerator::new(None, false);
            let (_, distance) = gen.simulate_toolpath("G1 X100 Y200\n");
            assert_eq!(distance, 0.0);
        }

        #[test]
        fn test_safety_check_returns_empty_vec_for_normal_gcode() {
            let gen = GCodeGenerator::new(None, false);
            let warnings = gen.safety_check("G21\nG0 X0 Y0\nM30\n", (1300.0, 2500.0));
            assert!(warnings.is_empty());
        }

        #[test]
        fn test_safety_check_returns_empty_vec_for_any_input() {
            let gen = GCodeGenerator::new(None, true);
            let warnings = gen.safety_check("G0 Z-100\nG1 X9999 Y9999\n", (1220.0, 2440.0));
            assert!(warnings.is_empty(), "Stub must always return empty vec");
        }

        #[test]
        fn test_gcode_block_struct_fields_accessible() {
            let block = GCodeBlock {
                line_number: 1,
                code: "G21".to_string(),
                comment: Some("Set metric mode".to_string()),
            };
            assert_eq!(block.line_number, 1);
            assert_eq!(block.code, "G21");
            assert!(block.comment.is_some());
        }

        #[test]
        fn test_gcode_block_without_comment() {
            let block = GCodeBlock {
                line_number: 5,
                code: "M30".to_string(),
                comment: None,
            };
            assert!(block.comment.is_none());
        }
    }

    // -------------------------------------------------------------------------
    // CostCalculator – the only service with a real implementation
    // -------------------------------------------------------------------------
    mod cost_calculator {
        use super::lazy_pool;
        use crate::services::cost_calculator::{CostCalculator, CostLineItem};
        use uuid::Uuid;

        #[test]
        fn test_cost_calculator_new_stores_labor_rate() {
            let calc = CostCalculator::new(85.0, 4.5);
            assert_eq!(calc.labor_rate_per_hour, 85.0);
        }

        #[test]
        fn test_cost_calculator_new_stores_avg_machine_minutes() {
            let calc = CostCalculator::new(85.0, 4.5);
            assert_eq!(calc.avg_machine_minutes_per_part, 4.5);
        }

        #[test]
        fn test_apply_markups_zero_percent_returns_same_value() {
            let calc = CostCalculator::new(85.0, 4.5);
            assert_eq!(calc.apply_markups(1000.0, 0.0), 1000.0);
        }

        #[test]
        fn test_apply_markups_twenty_percent_on_one_thousand_is_twelve_hundred() {
            let calc = CostCalculator::new(85.0, 4.5);
            let result = calc.apply_markups(1000.0, 20.0);
            assert!(
                (result - 1200.0).abs() < 1e-9,
                "Expected 1200.0, got {result}"
            );
        }

        #[test]
        fn test_apply_markups_hundred_percent_doubles_value() {
            let calc = CostCalculator::new(85.0, 4.5);
            let result = calc.apply_markups(500.0, 100.0);
            assert!((result - 1000.0).abs() < 1e-9);
        }

        #[test]
        fn test_apply_markups_negative_markup_reduces_value() {
            let calc = CostCalculator::new(85.0, 4.5);
            // -10% markup = subtotal * 0.90
            let result = calc.apply_markups(1000.0, -10.0);
            assert!((result - 900.0).abs() < 1e-9, "Expected 900.0, got {result}");
        }

        #[test]
        fn test_apply_markups_zero_subtotal_with_any_markup() {
            let calc = CostCalculator::new(85.0, 4.5);
            assert_eq!(calc.apply_markups(0.0, 50.0), 0.0);
        }

        #[test]
        fn test_apply_markups_fifty_percent_on_two_hundred() {
            let calc = CostCalculator::new(85.0, 4.5);
            let result = calc.apply_markups(200.0, 50.0);
            assert!((result - 300.0).abs() < 1e-9);
        }

        #[test]
        fn test_apply_markups_fractional_percentage_12_5() {
            let calc = CostCalculator::new(85.0, 4.5);
            // 12.5% on 800 = 900
            let result = calc.apply_markups(800.0, 12.5);
            assert!((result - 900.0).abs() < 1e-9, "Expected 900.0, got {result}");
        }

        #[test]
        fn test_apply_markups_large_subtotal() {
            let calc = CostCalculator::new(85.0, 4.5);
            let result = calc.apply_markups(1_000_000.0, 25.0);
            assert!((result - 1_250_000.0).abs() < 1e-6);
        }

        #[test]
        fn test_apply_markups_very_small_subtotal() {
            let calc = CostCalculator::new(85.0, 4.5);
            let result = calc.apply_markups(0.01, 100.0);
            assert!((result - 0.02).abs() < 1e-9);
        }

        #[test]
        fn test_apply_markups_25_percent_realistic_job() {
            let calc = CostCalculator::new(85.0, 4.5);
            // Typical job: $3130 subtotal, 25% markup -> $3912.50
            let result = calc.apply_markups(3130.0, 25.0);
            assert!((result - 3912.50).abs() < 1e-6);
        }

        #[tokio::test]
        async fn test_generate_quote_returns_empty_material_line_items() {
            let calc = CostCalculator::new(85.0, 4.5);
            let pool = lazy_pool();
            let result = calc.generate_quote(Uuid::new_v4(), 20.0, &pool).await;
            assert!(result.material_line_items.is_empty());
        }

        #[tokio::test]
        async fn test_generate_quote_returns_empty_hardware_line_items() {
            let calc = CostCalculator::new(85.0, 4.5);
            let pool = lazy_pool();
            let result = calc.generate_quote(Uuid::new_v4(), 20.0, &pool).await;
            assert!(result.hardware_line_items.is_empty());
        }

        #[tokio::test]
        async fn test_generate_quote_returns_zero_total() {
            let calc = CostCalculator::new(85.0, 4.5);
            let pool = lazy_pool();
            let result = calc.generate_quote(Uuid::new_v4(), 20.0, &pool).await;
            assert_eq!(result.total, 0.0);
        }

        #[tokio::test]
        async fn test_calculate_material_cost_returns_empty_vec() {
            let calc = CostCalculator::new(85.0, 4.5);
            let pool = lazy_pool();
            let items = calc.calculate_material_cost(Uuid::new_v4(), &pool).await;
            assert!(items.is_empty());
        }

        #[tokio::test]
        async fn test_calculate_labor_cost_returns_empty_vec() {
            let calc = CostCalculator::new(85.0, 4.5);
            let pool = lazy_pool();
            let items = calc.calculate_labor_cost(Uuid::new_v4(), &pool).await;
            assert!(items.is_empty());
        }

        #[test]
        fn test_cost_line_item_struct_fields() {
            let item = CostLineItem {
                description: "18mm White Melamine \u2013 12 sheets".to_string(),
                quantity: 12.0,
                unit: "sheet".to_string(),
                unit_cost: 45.0,
                total: 540.0,
            };
            assert_eq!(item.quantity, 12.0);
            assert_eq!(item.total, 540.0);
            assert_eq!(item.unit, "sheet");
            assert!((item.total - item.quantity * item.unit_cost).abs() < 1e-9);
        }
    }

    // -------------------------------------------------------------------------
    // PropagationEngine
    // -------------------------------------------------------------------------
    mod propagation_engine {
        use super::lazy_pool;
        use crate::services::propagation_engine::PropagationEngine;
        use uuid::Uuid;

        #[test]
        fn test_propagation_engine_new_creates_instance() {
            let _engine = PropagationEngine::new();
        }

        #[test]
        fn test_propagation_engine_default_creates_instance() {
            let _engine = PropagationEngine::default();
        }

        #[tokio::test]
        async fn test_on_product_change_returns_ok() {
            let engine = PropagationEngine::new();
            let pool = lazy_pool();
            let result = engine.on_product_change(Uuid::new_v4(), &pool).await;
            assert!(result.is_ok());
        }

        #[tokio::test]
        async fn test_on_material_change_job_scope_returns_ok() {
            let engine = PropagationEngine::new();
            let pool = lazy_pool();
            let result = engine
                .on_material_change("job", Uuid::new_v4(), Uuid::new_v4(), &pool)
                .await;
            assert!(result.is_ok());
        }

        #[tokio::test]
        async fn test_on_material_change_part_scope_returns_ok() {
            let engine = PropagationEngine::new();
            let pool = lazy_pool();
            let result = engine
                .on_material_change("part", Uuid::new_v4(), Uuid::new_v4(), &pool)
                .await;
            assert!(result.is_ok());
        }

        #[tokio::test]
        async fn test_recalculate_parts_returns_empty_vec() {
            let engine = PropagationEngine::new();
            let pool = lazy_pool();
            let parts = engine.recalculate_parts(Uuid::new_v4(), &pool).await;
            assert!(parts.is_empty());
        }

        #[tokio::test]
        async fn test_recalculate_operations_returns_empty_vec() {
            let engine = PropagationEngine::new();
            let pool = lazy_pool();
            let ops = engine.recalculate_operations(Uuid::new_v4(), &pool).await;
            assert!(ops.is_empty());
        }
    }

    // -------------------------------------------------------------------------
    // DovetailGenerator
    // -------------------------------------------------------------------------
    mod dovetail_generator {
        use crate::services::dovetail_generator::{DovetailGenerator, DrawerBoxParams};

        fn sample_params() -> DrawerBoxParams {
            DrawerBoxParams {
                overall_width: 500.0,
                overall_height: 150.0,
                overall_depth: 450.0,
                material_thickness: 18.0,
                pin_count: 5,
                tail_ratio: 1.5,
                baseline_offset: 6.0,
            }
        }

        #[test]
        fn test_dovetail_generator_new_creates_instance() {
            let _gen = DovetailGenerator::new();
        }

        #[test]
        fn test_dovetail_generator_default_creates_instance() {
            let _gen = DovetailGenerator::default();
        }

        #[test]
        fn test_generate_drawer_box_returns_empty_vec() {
            let gen = DovetailGenerator::new();
            let parts = gen.generate_drawer_box(&sample_params());
            assert!(parts.is_empty(), "Stub must return empty vec");
        }

        #[test]
        fn test_calculate_joint_geometry_angle_is_14_degrees() {
            let gen = DovetailGenerator::new();
            let geom = gen.calculate_joint_geometry(500.0, &sample_params());
            assert!(
                (geom.angle_degrees - 14.0).abs() < 1e-9,
                "Default dovetail angle must be exactly 14.0, got {}",
                geom.angle_degrees
            );
        }

        #[test]
        fn test_calculate_joint_geometry_other_fields_are_zero() {
            let gen = DovetailGenerator::new();
            let geom = gen.calculate_joint_geometry(300.0, &sample_params());
            assert_eq!(geom.pin_width, 0.0);
            assert_eq!(geom.tail_width, 0.0);
            assert_eq!(geom.depth, 0.0);
            assert_eq!(geom.baseline_x, 0.0);
            assert!(geom.joints.is_empty());
        }

        #[test]
        fn test_calculate_joint_geometry_angle_unchanged_for_different_widths() {
            let gen = DovetailGenerator::new();
            let geom1 = gen.calculate_joint_geometry(200.0, &sample_params());
            let geom2 = gen.calculate_joint_geometry(800.0, &sample_params());
            assert_eq!(geom1.angle_degrees, geom2.angle_degrees);
        }

        #[test]
        fn test_drawer_box_params_fields_accessible() {
            let params = sample_params();
            assert_eq!(params.overall_width, 500.0);
            assert_eq!(params.pin_count, 5);
            assert_eq!(params.tail_ratio, 1.5);
            assert_eq!(params.baseline_offset, 6.0);
        }

        #[test]
        fn test_dovetail_geometry_is_cloneable() {
            let gen = DovetailGenerator::new();
            let geom = gen.calculate_joint_geometry(400.0, &sample_params());
            let cloned = geom.clone();
            assert_eq!(cloned.angle_degrees, 14.0);
        }
    }

    // -------------------------------------------------------------------------
    // DoorProfileGenerator
    // -------------------------------------------------------------------------
    mod door_profile_generator {
        use crate::services::door_profile_generator::{DoorProfileGenerator, DoorProfileParams};
        use uuid::Uuid;

        fn sample_params() -> DoorProfileParams {
            DoorProfileParams {
                door_width: 596.0,
                door_height: 716.0,
                material_thickness: 18.0,
                profile_name: "shaker".to_string(),
                profile_depth: 6.0,
                profile_inset: 50.0,
                tool_id: None,
            }
        }

        #[test]
        fn test_door_profile_generator_new_creates_instance() {
            let _gen = DoorProfileGenerator::new();
        }

        #[test]
        fn test_door_profile_generator_default_creates_instance() {
            let _gen = DoorProfileGenerator::default();
        }

        #[test]
        fn test_generate_mdf_door_part_type_is_door() {
            let gen = DoorProfileGenerator::new();
            let result = gen.generate_mdf_door(&sample_params());
            assert_eq!(result["part_type"], "door");
        }

        #[test]
        fn test_generate_mdf_door_has_operations_array() {
            let gen = DoorProfileGenerator::new();
            let result = gen.generate_mdf_door(&sample_params());
            assert!(result["operations"].is_array(), "operations must be an array");
        }

        #[test]
        fn test_generate_mdf_door_operations_is_empty_for_stub() {
            let gen = DoorProfileGenerator::new();
            let result = gen.generate_mdf_door(&sample_params());
            assert!(
                result["operations"].as_array().unwrap().is_empty(),
                "Stub operations must be empty"
            );
        }

        #[test]
        fn test_calculate_toolpath_returns_empty_vec() {
            let gen = DoorProfileGenerator::new();
            let ops = gen.calculate_toolpath(&sample_params());
            assert!(ops.is_empty());
        }

        #[test]
        fn test_generate_mdf_door_flat_profile() {
            let gen = DoorProfileGenerator::new();
            let params = DoorProfileParams {
                door_width: 400.0,
                door_height: 700.0,
                material_thickness: 18.0,
                profile_name: "flat".to_string(),
                profile_depth: 0.0,
                profile_inset: 0.0,
                tool_id: None,
            };
            let result = gen.generate_mdf_door(&params);
            assert_eq!(result["part_type"], "door");
        }

        #[test]
        fn test_door_profile_params_with_tool_id() {
            let tool_id = Uuid::new_v4();
            let params = DoorProfileParams {
                door_width: 596.0,
                door_height: 716.0,
                material_thickness: 18.0,
                profile_name: "ogee".to_string(),
                profile_depth: 8.0,
                profile_inset: 55.0,
                tool_id: Some(tool_id),
            };
            assert!(params.tool_id.is_some());
            assert_eq!(params.profile_name, "ogee");
        }
    }

    // -------------------------------------------------------------------------
    // FlipsideManager
    // -------------------------------------------------------------------------
    mod flipside_manager {
        use super::lazy_pool;
        use crate::services::flipside_manager::FlipsideManager;
        use serde_json::json;
        use uuid::Uuid;

        #[test]
        fn test_flipside_manager_new_creates_instance() {
            let _mgr = FlipsideManager::new();
        }

        #[test]
        fn test_flipside_manager_default_creates_instance() {
            let _mgr = FlipsideManager::default();
        }

        #[tokio::test]
        async fn test_detect_flipside_parts_returns_empty_vec() {
            let mgr = FlipsideManager::new();
            let pool = lazy_pool();
            let parts = mgr.detect_flipside_parts(Uuid::new_v4(), &pool).await;
            assert!(parts.is_empty());
        }

        #[tokio::test]
        async fn test_generate_flip_gcode_contains_flipside_comment_header() {
            let mgr = FlipsideManager::new();
            let pool = lazy_pool();
            let gcode = mgr
                .generate_flip_gcode(Uuid::new_v4(), Uuid::new_v4(), &pool)
                .await;
            assert!(
                gcode.contains("; Flipside G-code"),
                "Flipside G-code must contain comment header"
            );
        }

        #[tokio::test]
        async fn test_generate_flip_gcode_ends_with_m30() {
            let mgr = FlipsideManager::new();
            let pool = lazy_pool();
            let gcode = mgr
                .generate_flip_gcode(Uuid::new_v4(), Uuid::new_v4(), &pool)
                .await;
            assert!(gcode.contains("M30"), "G-code must contain M30 end-of-program");
        }

        #[tokio::test]
        async fn test_generate_flip_gcode_is_not_empty() {
            let mgr = FlipsideManager::new();
            let pool = lazy_pool();
            let gcode = mgr
                .generate_flip_gcode(Uuid::new_v4(), Uuid::new_v4(), &pool)
                .await;
            assert!(!gcode.is_empty());
        }

        #[test]
        fn test_alignment_system_returns_empty_vec() {
            let mgr = FlipsideManager::new();
            let positions = mgr.alignment_system(600.0, 800.0, &[json!({}), json!({})]);
            assert!(positions.is_empty());
        }

        #[test]
        fn test_alignment_system_returns_empty_for_zero_dimensions() {
            let mgr = FlipsideManager::new();
            let positions = mgr.alignment_system(0.0, 0.0, &[]);
            assert!(positions.is_empty());
        }
    }

    // -------------------------------------------------------------------------
    // LabelGenerator
    // -------------------------------------------------------------------------
    mod label_generator {
        use super::lazy_pool;
        use crate::services::label_generator::{LabelGenerator, RenderedLabel};
        use uuid::Uuid;

        #[test]
        fn test_label_generator_new_creates_instance() {
            let _gen = LabelGenerator::new();
        }

        #[test]
        fn test_label_generator_default_creates_instance() {
            let _gen = LabelGenerator::default();
        }

        #[tokio::test]
        async fn test_generate_label_part_id_matches_input() {
            let gen = LabelGenerator::new();
            let part_id = Uuid::new_v4();
            let pool = lazy_pool();
            let label = gen.generate_label(part_id, Uuid::new_v4(), &pool).await;
            assert_eq!(label.part_id, part_id);
        }

        #[tokio::test]
        async fn test_generate_label_pdf_bytes_is_empty() {
            let gen = LabelGenerator::new();
            let pool = lazy_pool();
            let label = gen.generate_label(Uuid::new_v4(), Uuid::new_v4(), &pool).await;
            assert!(label.pdf_bytes.is_empty(), "Stub must return empty pdf_bytes");
        }

        #[tokio::test]
        async fn test_generate_label_width_is_100() {
            let gen = LabelGenerator::new();
            let pool = lazy_pool();
            let label = gen.generate_label(Uuid::new_v4(), Uuid::new_v4(), &pool).await;
            assert_eq!(label.width_mm, 100.0);
        }

        #[tokio::test]
        async fn test_generate_label_height_is_50() {
            let gen = LabelGenerator::new();
            let pool = lazy_pool();
            let label = gen.generate_label(Uuid::new_v4(), Uuid::new_v4(), &pool).await;
            assert_eq!(label.height_mm, 50.0);
        }

        #[test]
        fn test_generate_barcode_code128_returns_empty_bytes() {
            let gen = LabelGenerator::new();
            let bytes = gen.generate_barcode("PART-001", "code128", 300, 100);
            assert!(bytes.is_empty());
        }

        #[test]
        fn test_generate_barcode_qr_returns_empty_bytes() {
            let gen = LabelGenerator::new();
            let bytes = gen.generate_barcode(&Uuid::new_v4().to_string(), "qr", 200, 200);
            assert!(bytes.is_empty());
        }

        #[test]
        fn test_rendered_label_struct_fields_accessible() {
            let part_id = Uuid::new_v4();
            let label = RenderedLabel {
                part_id,
                pdf_bytes: vec![0x25, 0x50, 0x44, 0x46],
                width_mm: 100.0,
                height_mm: 50.0,
            };
            assert_eq!(label.part_id, part_id);
            assert_eq!(label.pdf_bytes.len(), 4);
            assert_eq!(label.pdf_bytes[0], 0x25); // '%' in %PDF
        }
    }

    // -------------------------------------------------------------------------
    // CloudRenderer
    // -------------------------------------------------------------------------
    mod cloud_renderer {
        use crate::services::cloud_renderer::{CloudRenderer, RenderRequest, RenderStatus};
        use uuid::Uuid;

        fn make_renderer() -> CloudRenderer {
            CloudRenderer::new(
                "https://render.example.com".to_string(),
                "api-key-abc-123".to_string(),
            )
        }

        fn sample_request() -> RenderRequest {
            RenderRequest {
                scene_id: Uuid::new_v4(),
                scene_type: "room".to_string(),
                resolution_width: 1920,
                resolution_height: 1080,
                quality: "final".to_string(),
                view_id: None,
            }
        }

        #[test]
        fn test_cloud_renderer_stores_service_url() {
            let r = make_renderer();
            assert_eq!(r.service_url, "https://render.example.com");
        }

        #[test]
        fn test_cloud_renderer_stores_api_key() {
            let r = make_renderer();
            assert_eq!(r.api_key, "api-key-abc-123");
        }

        #[tokio::test]
        async fn test_submit_render_returns_ok() {
            let renderer = make_renderer();
            let result = renderer.submit_render(sample_request()).await;
            assert!(result.is_ok(), "submit_render must return Ok");
        }

        #[tokio::test]
        async fn test_submit_render_returns_valid_uuid() {
            let renderer = make_renderer();
            // Just verifying it's a valid UUID (not nil)
            let render_id = renderer.submit_render(sample_request()).await.unwrap();
            assert_ne!(render_id, uuid::Uuid::nil());
        }

        #[tokio::test]
        async fn test_submit_render_returns_different_uuids_each_call() {
            let renderer = make_renderer();
            let r1 = renderer.submit_render(sample_request()).await.unwrap();
            let r2 = renderer.submit_render(sample_request()).await.unwrap();
            assert_ne!(r1, r2, "Each call should return a unique render ID");
        }

        #[tokio::test]
        async fn test_check_status_returns_queued() {
            let renderer = make_renderer();
            let status = renderer.check_status(Uuid::new_v4()).await;
            assert_eq!(status, RenderStatus::Queued);
        }

        #[tokio::test]
        async fn test_check_status_always_queued_regardless_of_render_id() {
            let renderer = make_renderer();
            let s1 = renderer.check_status(Uuid::new_v4()).await;
            let s2 = renderer.check_status(Uuid::new_v4()).await;
            assert_eq!(s1, RenderStatus::Queued);
            assert_eq!(s2, RenderStatus::Queued);
        }

        #[tokio::test]
        async fn test_get_result_returns_err() {
            let renderer = make_renderer();
            let result = renderer.get_result(Uuid::new_v4()).await;
            assert!(result.is_err(), "get_result stub must return Err");
        }

        #[tokio::test]
        async fn test_get_result_error_message_is_not_empty() {
            let renderer = make_renderer();
            let err = renderer.get_result(Uuid::new_v4()).await.unwrap_err();
            assert!(!err.is_empty(), "Error message must not be empty");
        }

        #[test]
        fn test_render_status_queued_equals_queued() {
            assert_eq!(RenderStatus::Queued, RenderStatus::Queued);
        }

        #[test]
        fn test_render_status_processing_equals_processing() {
            assert_eq!(RenderStatus::Processing, RenderStatus::Processing);
        }

        #[test]
        fn test_render_status_completed_equals_completed() {
            assert_eq!(RenderStatus::Completed, RenderStatus::Completed);
        }

        #[test]
        fn test_render_status_queued_not_equal_to_completed() {
            assert_ne!(RenderStatus::Queued, RenderStatus::Completed);
        }

        #[test]
        fn test_render_status_failed_variant_contains_message() {
            let status = RenderStatus::Failed("Out of memory".to_string());
            match status {
                RenderStatus::Failed(msg) => assert_eq!(msg, "Out of memory"),
                _ => panic!("Expected Failed variant"),
            }
        }

        #[test]
        fn test_render_request_with_view_id() {
            let view_id = Uuid::new_v4();
            let req = RenderRequest {
                scene_id: Uuid::new_v4(),
                scene_type: "product".to_string(),
                resolution_width: 3840,
                resolution_height: 2160,
                quality: "ultra".to_string(),
                view_id: Some(view_id),
            };
            assert_eq!(req.resolution_width, 3840);
            assert!(req.view_id.is_some());
        }
    }

    // -------------------------------------------------------------------------
    // FileExporter
    // -------------------------------------------------------------------------
    mod file_exporter {
        use super::lazy_pool;
        use crate::services::file_exporter::FileExporter;
        use uuid::Uuid;

        #[test]
        fn test_file_exporter_new_creates_instance() {
            let _exp = FileExporter::new();
        }

        #[test]
        fn test_file_exporter_default_creates_instance() {
            let _exp = FileExporter::default();
        }

        #[tokio::test]
        async fn test_export_sketchup_returns_err() {
            let exp = FileExporter::new();
            let pool = lazy_pool();
            let result = exp.export_sketchup(Uuid::new_v4(), &pool).await;
            assert!(result.is_err(), "export_sketchup stub must return Err");
        }

        #[tokio::test]
        async fn test_export_sketchup_error_message_not_empty() {
            let exp = FileExporter::new();
            let pool = lazy_pool();
            let err = exp.export_sketchup(Uuid::new_v4(), &pool).await.unwrap_err();
            assert!(!err.is_empty());
        }

        #[tokio::test]
        async fn test_export_csv_returns_ok() {
            let exp = FileExporter::new();
            let pool = lazy_pool();
            let result = exp.export_csv(Uuid::new_v4(), &pool).await;
            assert!(result.is_ok(), "export_csv stub must return Ok");
        }

        #[tokio::test]
        async fn test_export_csv_bytes_are_valid_utf8() {
            let exp = FileExporter::new();
            let pool = lazy_pool();
            let bytes = exp.export_csv(Uuid::new_v4(), &pool).await.unwrap();
            assert!(
                std::str::from_utf8(&bytes).is_ok(),
                "CSV must be valid UTF-8"
            );
        }

        #[tokio::test]
        async fn test_export_csv_contains_part_name_column() {
            let exp = FileExporter::new();
            let pool = lazy_pool();
            let bytes = exp.export_csv(Uuid::new_v4(), &pool).await.unwrap();
            let csv = String::from_utf8(bytes).unwrap();
            assert!(csv.contains("Part Name"), "CSV header must contain 'Part Name'");
        }

        #[tokio::test]
        async fn test_export_csv_contains_material_column() {
            let exp = FileExporter::new();
            let pool = lazy_pool();
            let bytes = exp.export_csv(Uuid::new_v4(), &pool).await.unwrap();
            let csv = String::from_utf8(bytes).unwrap();
            assert!(csv.contains("Material"));
        }

        #[tokio::test]
        async fn test_export_csv_contains_dimension_columns() {
            let exp = FileExporter::new();
            let pool = lazy_pool();
            let bytes = exp.export_csv(Uuid::new_v4(), &pool).await.unwrap();
            let csv = String::from_utf8(bytes).unwrap();
            assert!(csv.contains("Length"));
            assert!(csv.contains("Width"));
            assert!(csv.contains("Thickness"));
        }

        #[tokio::test]
        async fn test_export_dxf_returns_ok() {
            let exp = FileExporter::new();
            let pool = lazy_pool();
            let result = exp.export_dxf(Uuid::new_v4(), &pool).await;
            assert!(result.is_ok(), "export_dxf stub must return Ok");
        }

        #[tokio::test]
        async fn test_export_dxf_contains_section_keyword() {
            let exp = FileExporter::new();
            let pool = lazy_pool();
            let bytes = exp.export_dxf(Uuid::new_v4(), &pool).await.unwrap();
            let dxf = String::from_utf8(bytes).unwrap();
            assert!(dxf.contains("SECTION"));
        }

        #[tokio::test]
        async fn test_export_dxf_contains_endsec_keyword() {
            let exp = FileExporter::new();
            let pool = lazy_pool();
            let bytes = exp.export_dxf(Uuid::new_v4(), &pool).await.unwrap();
            let dxf = String::from_utf8(bytes).unwrap();
            assert!(dxf.contains("ENDSEC"));
        }

        #[tokio::test]
        async fn test_export_dxf_contains_eof_marker() {
            let exp = FileExporter::new();
            let pool = lazy_pool();
            let bytes = exp.export_dxf(Uuid::new_v4(), &pool).await.unwrap();
            let dxf = String::from_utf8(bytes).unwrap();
            assert!(dxf.contains("EOF"));
        }

        #[tokio::test]
        async fn test_export_pdf_returns_err() {
            let exp = FileExporter::new();
            let pool = lazy_pool();
            let result = exp.export_pdf(Uuid::new_v4(), &pool).await;
            assert!(result.is_err(), "export_pdf stub must return Err");
        }

        #[tokio::test]
        async fn test_export_pdf_error_message_not_empty() {
            let exp = FileExporter::new();
            let pool = lazy_pool();
            let err = exp.export_pdf(Uuid::new_v4(), &pool).await.unwrap_err();
            assert!(!err.is_empty());
        }
    }
}
