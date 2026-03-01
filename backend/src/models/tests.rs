//! Comprehensive tests for all model structs, enums, and DTOs.
//!
//! Organized by model file. Each sub-module covers:
//!   - Enum serialization (snake_case)
//!   - Enum deserialization
//!   - Enum round-trips
//!   - All variants
//!   - Struct serialization / deserialization
//!   - Create / Update DTO deserialization
//!   - Optional fields (Some / None)
//!   - Edge cases (empty strings, zero, negative, large values, Unicode)

#[cfg(test)]
mod tests {
    use chrono::Utc;
    use serde_json::{json, Value};
    use uuid::Uuid;

    // -------------------------------------------------------------------------
    // job
    // -------------------------------------------------------------------------
    mod job {
        use super::*;
        use crate::models::{CreateJob, JobStatus, UpdateJob};

        #[test]
        fn test_job_status_active_serializes_to_snake_case() {
            let s = serde_json::to_string(&JobStatus::Active).unwrap();
            assert_eq!(s, "\"active\"");
        }

        #[test]
        fn test_job_status_completed_serializes_to_snake_case() {
            let s = serde_json::to_string(&JobStatus::Completed).unwrap();
            assert_eq!(s, "\"completed\"");
        }

        #[test]
        fn test_job_status_lost_serializes_to_snake_case() {
            let s = serde_json::to_string(&JobStatus::Lost).unwrap();
            assert_eq!(s, "\"lost\"");
        }

        #[test]
        fn test_job_status_deserializes_from_snake_case() {
            let active: JobStatus = serde_json::from_str("\"active\"").unwrap();
            assert_eq!(active, JobStatus::Active);

            let completed: JobStatus = serde_json::from_str("\"completed\"").unwrap();
            assert_eq!(completed, JobStatus::Completed);

            let lost: JobStatus = serde_json::from_str("\"lost\"").unwrap();
            assert_eq!(lost, JobStatus::Lost);
        }

        #[test]
        fn test_job_status_round_trip() {
            for variant in [JobStatus::Active, JobStatus::Completed, JobStatus::Lost] {
                let serialized = serde_json::to_string(&variant).unwrap();
                let deserialized: JobStatus = serde_json::from_str(&serialized).unwrap();
                assert_eq!(variant, deserialized);
            }
        }

        #[test]
        fn test_create_job_deserializes_with_all_fields() {
            let id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "name": "Smith Kitchen Remodel",
                    "client_name": "John Smith",
                    "address": "123 Oak Street, Portland OR 97201",
                    "status": "active",
                    "tags": ["kitchen", "frameless", "rush"],
                    "assigned_designer": "Alice Johnson",
                    "notes": "Client wants soft-close on all drawers",
                    "default_construction_method_id": "{id}",
                    "default_material_template_id": "{id}"
                }}"#
            );
            let dto: CreateJob = serde_json::from_str(&json).unwrap();
            assert_eq!(dto.name, "Smith Kitchen Remodel");
            assert_eq!(dto.client_name, "John Smith");
            assert_eq!(dto.status, Some(JobStatus::Active));
            assert_eq!(dto.tags, vec!["kitchen", "frameless", "rush"]);
            assert!(dto.assigned_designer.is_some());
            assert!(dto.notes.is_some());
            assert!(dto.default_construction_method_id.is_some());
        }

        #[test]
        fn test_create_job_defaults_tags_to_empty_when_absent() {
            let json = r#"{
                "name": "Jones Bathroom",
                "client_name": "Jane Jones",
                "address": "456 Maple Ave, Seattle WA 98101"
            }"#;
            let dto: CreateJob = serde_json::from_str(json).unwrap();
            assert!(dto.tags.is_empty());
            assert!(dto.status.is_none());
        }

        #[test]
        fn test_update_job_partial_fields() {
            let json = r#"{"name": "Updated Job Name"}"#;
            let dto: UpdateJob = serde_json::from_str(json).unwrap();
            assert_eq!(dto.name, Some("Updated Job Name".to_string()));
            assert!(dto.client_name.is_none());
            assert!(dto.status.is_none());
        }

        #[test]
        fn test_update_job_status_field() {
            let json = r#"{"status": "completed"}"#;
            let dto: UpdateJob = serde_json::from_str(json).unwrap();
            assert_eq!(dto.status, Some(JobStatus::Completed));
        }

        #[test]
        fn test_create_job_empty_name_is_valid_struct() {
            let json = r#"{
                "name": "",
                "client_name": "",
                "address": ""
            }"#;
            let dto: CreateJob = serde_json::from_str(json).unwrap();
            assert_eq!(dto.name, "");
        }

        #[test]
        fn test_create_job_unicode_client_name() {
            let json = r#"{
                "name": "Job für Müller",
                "client_name": "Björn Müller",
                "address": "Hauptstraße 12, Berlin"
            }"#;
            let dto: CreateJob = serde_json::from_str(json).unwrap();
            assert_eq!(dto.client_name, "Björn Müller");
        }
    }

    // -------------------------------------------------------------------------
    // room
    // -------------------------------------------------------------------------
    mod room {
        use super::*;
        use crate::models::{CreateRoom, UpdateRoom};

        #[test]
        fn test_create_room_deserializes_correctly() {
            let job_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "job_id": "{job_id}",
                    "name": "Master Kitchen",
                    "width": 4200.0,
                    "height": 2400.0,
                    "depth": 600.0,
                    "notes": "L-shaped layout"
                }}"#
            );
            let dto: CreateRoom = serde_json::from_str(&json).unwrap();
            assert_eq!(dto.name, "Master Kitchen");
            assert_eq!(dto.width, 4200.0);
            assert_eq!(dto.height, 2400.0);
            assert_eq!(dto.depth, 600.0);
            assert_eq!(dto.notes, Some("L-shaped layout".to_string()));
        }

        #[test]
        fn test_create_room_with_material_overrides() {
            let job_id = Uuid::new_v4();
            let mat_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "job_id": "{job_id}",
                    "name": "Bathroom Vanity Room",
                    "width": 2400.0,
                    "height": 2200.0,
                    "depth": 500.0,
                    "material_overrides": {{"back": "{mat_id}"}},
                    "construction_overrides": {{"joinery": "cam_lock"}}
                }}"#
            );
            let dto: CreateRoom = serde_json::from_str(&json).unwrap();
            assert!(dto.material_overrides.is_some());
            assert!(dto.construction_overrides.is_some());
        }

        #[test]
        fn test_update_room_partial_fields() {
            let json = r#"{"name": "New Room Name", "width": 3600.0}"#;
            let dto: UpdateRoom = serde_json::from_str(json).unwrap();
            assert_eq!(dto.name, Some("New Room Name".to_string()));
            assert_eq!(dto.width, Some(3600.0));
            assert!(dto.height.is_none());
            assert!(dto.depth.is_none());
        }

        #[test]
        fn test_room_zero_dimension_is_valid_struct() {
            let job_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "job_id": "{job_id}",
                    "name": "Empty",
                    "width": 0.0,
                    "height": 0.0,
                    "depth": 0.0
                }}"#
            );
            let dto: CreateRoom = serde_json::from_str(&json).unwrap();
            assert_eq!(dto.width, 0.0);
        }

        #[test]
        fn test_update_room_all_none() {
            let json = r#"{}"#;
            let dto: UpdateRoom = serde_json::from_str(json).unwrap();
            assert!(dto.name.is_none());
            assert!(dto.width.is_none());
        }
    }

    // -------------------------------------------------------------------------
    // product
    // -------------------------------------------------------------------------
    mod product {
        use super::*;
        use crate::models::{CabinetStyle, CreateProduct, ProductType, UpdateProduct};

        #[test]
        fn test_product_type_all_variants_serialize() {
            let cases = vec![
                (ProductType::BaseCabinet, "\"base_cabinet\""),
                (ProductType::WallCabinet, "\"wall_cabinet\""),
                (ProductType::TallCabinet, "\"tall_cabinet\""),
                (ProductType::Vanity, "\"vanity\""),
                (ProductType::Closet, "\"closet\""),
                (ProductType::Wardrobe, "\"wardrobe\""),
                (ProductType::Furniture, "\"furniture\""),
            ];
            for (variant, expected) in cases {
                assert_eq!(serde_json::to_string(&variant).unwrap(), expected);
            }
        }

        #[test]
        fn test_cabinet_style_all_variants_serialize() {
            assert_eq!(
                serde_json::to_string(&CabinetStyle::Frameless).unwrap(),
                "\"frameless\""
            );
            assert_eq!(
                serde_json::to_string(&CabinetStyle::FaceFrame).unwrap(),
                "\"face_frame\""
            );
        }

        #[test]
        fn test_product_type_round_trip() {
            let variants = [
                ProductType::BaseCabinet,
                ProductType::WallCabinet,
                ProductType::TallCabinet,
                ProductType::Vanity,
                ProductType::Closet,
                ProductType::Wardrobe,
                ProductType::Furniture,
            ];
            for v in variants {
                let s = serde_json::to_string(&v).unwrap();
                let d: ProductType = serde_json::from_str(&s).unwrap();
                assert_eq!(v, d);
            }
        }

        #[test]
        fn test_cabinet_style_round_trip() {
            for v in [CabinetStyle::Frameless, CabinetStyle::FaceFrame] {
                let s = serde_json::to_string(&v).unwrap();
                let d: CabinetStyle = serde_json::from_str(&s).unwrap();
                assert_eq!(v, d);
            }
        }

        #[test]
        fn test_create_product_deserializes_correctly() {
            let room_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "room_id": "{room_id}",
                    "name": "Base Cabinet B01",
                    "product_type": "base_cabinet",
                    "cabinet_style": "frameless",
                    "width": 900.0,
                    "height": 720.0,
                    "depth": 560.0,
                    "position_x": 0.0,
                    "position_y": 0.0,
                    "position_z": 0.0,
                    "rotation": 0.0
                }}"#
            );
            let dto: CreateProduct = serde_json::from_str(&json).unwrap();
            assert_eq!(dto.name, "Base Cabinet B01");
            assert_eq!(dto.product_type, ProductType::BaseCabinet);
            assert_eq!(dto.cabinet_style, CabinetStyle::Frameless);
            assert_eq!(dto.width, 900.0);
        }

        #[test]
        fn test_create_product_position_defaults_to_zero() {
            let room_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "room_id": "{room_id}",
                    "name": "Wall Cabinet W01",
                    "product_type": "wall_cabinet",
                    "cabinet_style": "face_frame",
                    "width": 600.0,
                    "height": 600.0,
                    "depth": 300.0
                }}"#
            );
            let dto: CreateProduct = serde_json::from_str(&json).unwrap();
            assert_eq!(dto.position_x, 0.0);
            assert_eq!(dto.position_y, 0.0);
            assert_eq!(dto.position_z, 0.0);
            assert_eq!(dto.rotation, 0.0);
        }

        #[test]
        fn test_update_product_partial_fields() {
            let json = r#"{"width": 1200.0, "product_type": "tall_cabinet"}"#;
            let dto: UpdateProduct = serde_json::from_str(json).unwrap();
            assert_eq!(dto.width, Some(1200.0));
            assert_eq!(dto.product_type, Some(ProductType::TallCabinet));
            assert!(dto.height.is_none());
        }

        #[test]
        fn test_create_product_with_large_dimensions() {
            let room_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "room_id": "{room_id}",
                    "name": "Full-Height Wardrobe",
                    "product_type": "wardrobe",
                    "cabinet_style": "frameless",
                    "width": 2400.0,
                    "height": 2700.0,
                    "depth": 650.0
                }}"#
            );
            let dto: CreateProduct = serde_json::from_str(&json).unwrap();
            assert_eq!(dto.width, 2400.0);
            assert_eq!(dto.height, 2700.0);
        }
    }

    // -------------------------------------------------------------------------
    // part
    // -------------------------------------------------------------------------
    mod part {
        use super::*;
        use crate::models::{CreatePart, GrainDirection, PartType, UpdatePart};

        #[test]
        fn test_part_type_all_variants_serialize() {
            let cases = vec![
                (PartType::Side, "\"side\""),
                (PartType::Top, "\"top\""),
                (PartType::Bottom, "\"bottom\""),
                (PartType::Back, "\"back\""),
                (PartType::Shelf, "\"shelf\""),
                (PartType::Rail, "\"rail\""),
                (PartType::Stile, "\"stile\""),
                (PartType::DrawerFront, "\"drawer_front\""),
                (PartType::DrawerSide, "\"drawer_side\""),
                (PartType::DrawerBack, "\"drawer_back\""),
                (PartType::DrawerBottom, "\"drawer_bottom\""),
                (PartType::Door, "\"door\""),
                (PartType::Panel, "\"panel\""),
                (PartType::EdgeBand, "\"edge_band\""),
                (PartType::Custom, "\"custom\""),
            ];
            for (variant, expected) in cases {
                assert_eq!(serde_json::to_string(&variant).unwrap(), expected);
            }
        }

        #[test]
        fn test_grain_direction_all_variants_serialize() {
            assert_eq!(
                serde_json::to_string(&GrainDirection::Horizontal).unwrap(),
                "\"horizontal\""
            );
            assert_eq!(
                serde_json::to_string(&GrainDirection::Vertical).unwrap(),
                "\"vertical\""
            );
            assert_eq!(
                serde_json::to_string(&GrainDirection::None).unwrap(),
                "\"none\""
            );
        }

        #[test]
        fn test_part_type_round_trip() {
            let variants = [
                PartType::Side,
                PartType::Top,
                PartType::Bottom,
                PartType::Back,
                PartType::Shelf,
                PartType::Rail,
                PartType::Stile,
                PartType::DrawerFront,
                PartType::DrawerSide,
                PartType::DrawerBack,
                PartType::DrawerBottom,
                PartType::Door,
                PartType::Panel,
                PartType::EdgeBand,
                PartType::Custom,
            ];
            for v in variants {
                let s = serde_json::to_string(&v).unwrap();
                let d: PartType = serde_json::from_str(&s).unwrap();
                assert_eq!(v, d);
            }
        }

        #[test]
        fn test_grain_direction_round_trip() {
            for v in [
                GrainDirection::Horizontal,
                GrainDirection::Vertical,
                GrainDirection::None,
            ] {
                let s = serde_json::to_string(&v).unwrap();
                let d: GrainDirection = serde_json::from_str(&s).unwrap();
                assert_eq!(v, d);
            }
        }

        #[test]
        fn test_create_part_deserializes_with_edge_bands() {
            let product_id = Uuid::new_v4();
            let mat_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "product_id": "{product_id}",
                    "name": "Left Side Panel",
                    "part_type": "side",
                    "length": 715.0,
                    "width": 554.0,
                    "thickness": 18.0,
                    "material_id": "{mat_id}",
                    "grain_direction": "vertical",
                    "edge_band_top": 1,
                    "edge_band_bottom": 1,
                    "edge_band_left": null,
                    "edge_band_right": null
                }}"#
            );
            let dto: CreatePart = serde_json::from_str(&json).unwrap();
            assert_eq!(dto.name, "Left Side Panel");
            assert_eq!(dto.part_type, PartType::Side);
            assert_eq!(dto.length, 715.0);
            assert_eq!(dto.grain_direction, GrainDirection::Vertical);
            assert_eq!(dto.edge_band_top, Some(1));
            assert!(dto.edge_band_left.is_none());
        }

        #[test]
        fn test_create_part_no_edge_bands() {
            let product_id = Uuid::new_v4();
            let mat_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "product_id": "{product_id}",
                    "name": "Back Panel",
                    "part_type": "back",
                    "length": 680.0,
                    "width": 860.0,
                    "thickness": 6.0,
                    "material_id": "{mat_id}",
                    "grain_direction": "none"
                }}"#
            );
            let dto: CreatePart = serde_json::from_str(&json).unwrap();
            assert!(dto.edge_band_top.is_none());
            assert!(dto.texture_id.is_none());
        }

        #[test]
        fn test_update_part_partial() {
            let json = r#"{"name": "Renamed Shelf", "thickness": 16.0}"#;
            let dto: UpdatePart = serde_json::from_str(json).unwrap();
            assert_eq!(dto.name, Some("Renamed Shelf".to_string()));
            assert_eq!(dto.thickness, Some(16.0));
            assert!(dto.part_type.is_none());
        }
    }

    // -------------------------------------------------------------------------
    // operation
    // -------------------------------------------------------------------------
    mod operation {
        use super::*;
        use crate::models::{CreateOperation, OperationSide, OperationType, UpdateOperation};

        #[test]
        fn test_operation_type_all_variants_serialize() {
            let cases = vec![
                (OperationType::Drill, "\"drill\""),
                (OperationType::Route, "\"route\""),
                (OperationType::Dado, "\"dado\""),
                (OperationType::Tenon, "\"tenon\""),
                (OperationType::Pocket, "\"pocket\""),
                (OperationType::Profile, "\"profile\""),
                (OperationType::Cutout, "\"cutout\""),
            ];
            for (variant, expected) in cases {
                assert_eq!(serde_json::to_string(&variant).unwrap(), expected);
            }
        }

        #[test]
        fn test_operation_side_all_variants_serialize() {
            let cases = vec![
                (OperationSide::Top, "\"top\""),
                (OperationSide::Bottom, "\"bottom\""),
                (OperationSide::Left, "\"left\""),
                (OperationSide::Right, "\"right\""),
                (OperationSide::Front, "\"front\""),
                (OperationSide::Back, "\"back\""),
            ];
            for (variant, expected) in cases {
                assert_eq!(serde_json::to_string(&variant).unwrap(), expected);
            }
        }

        #[test]
        fn test_operation_type_round_trip() {
            for v in [
                OperationType::Drill,
                OperationType::Route,
                OperationType::Dado,
                OperationType::Tenon,
                OperationType::Pocket,
                OperationType::Profile,
                OperationType::Cutout,
            ] {
                let s = serde_json::to_string(&v).unwrap();
                let d: OperationType = serde_json::from_str(&s).unwrap();
                assert_eq!(v, d);
            }
        }

        #[test]
        fn test_operation_side_round_trip() {
            for v in [
                OperationSide::Top,
                OperationSide::Bottom,
                OperationSide::Left,
                OperationSide::Right,
                OperationSide::Front,
                OperationSide::Back,
            ] {
                let s = serde_json::to_string(&v).unwrap();
                let d: OperationSide = serde_json::from_str(&s).unwrap();
                assert_eq!(v, d);
            }
        }

        #[test]
        fn test_create_operation_hinge_drilling() {
            let part_id = Uuid::new_v4();
            let tool_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "part_id": "{part_id}",
                    "operation_type": "drill",
                    "position_x": 37.0,
                    "position_y": 100.0,
                    "position_z": 0.0,
                    "depth": 13.0,
                    "tool_id": "{tool_id}",
                    "side": "front",
                    "parameters": {{"diameter": 35.0, "hinge_cup": true}}
                }}"#
            );
            let dto: CreateOperation = serde_json::from_str(&json).unwrap();
            assert_eq!(dto.operation_type, OperationType::Drill);
            assert_eq!(dto.position_x, 37.0);
            assert_eq!(dto.side, OperationSide::Front);
            assert!(dto.tool_id.is_some());
        }

        #[test]
        fn test_create_operation_optional_width_height() {
            let part_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "part_id": "{part_id}",
                    "operation_type": "drill",
                    "position_x": 10.0,
                    "position_y": 10.0,
                    "position_z": 0.0,
                    "depth": 8.0,
                    "side": "top"
                }}"#
            );
            let dto: CreateOperation = serde_json::from_str(&json).unwrap();
            assert!(dto.width.is_none());
            assert!(dto.height.is_none());
            assert!(dto.tool_id.is_none());
        }

        #[test]
        fn test_update_operation_side_only() {
            let json = r#"{"side": "bottom"}"#;
            let dto: UpdateOperation = serde_json::from_str(json).unwrap();
            assert_eq!(dto.side, Some(OperationSide::Bottom));
            assert!(dto.operation_type.is_none());
        }
    }

    // -------------------------------------------------------------------------
    // material
    // -------------------------------------------------------------------------
    mod material {
        use super::*;
        use crate::models::{CostUnit, CreateMaterial, MaterialCategory, UpdateMaterial};

        #[test]
        fn test_material_category_all_variants_serialize() {
            let cases = vec![
                (MaterialCategory::SheetGood, "\"sheet_good\""),
                (MaterialCategory::SolidWood, "\"solid_wood\""),
                (MaterialCategory::EdgeBanding, "\"edge_banding\""),
                (MaterialCategory::Hardware, "\"hardware\""),
            ];
            for (variant, expected) in cases {
                assert_eq!(serde_json::to_string(&variant).unwrap(), expected);
            }
        }

        #[test]
        fn test_cost_unit_all_variants_serialize() {
            let cases = vec![
                (CostUnit::PerSheet, "\"per_sheet\""),
                (CostUnit::PerSqFt, "\"per_sq_ft\""),
                (CostUnit::PerBoardFt, "\"per_board_ft\""),
                (CostUnit::PerLinearFt, "\"per_linear_ft\""),
            ];
            for (variant, expected) in cases {
                assert_eq!(serde_json::to_string(&variant).unwrap(), expected);
            }
        }

        #[test]
        fn test_material_category_round_trip() {
            for v in [
                MaterialCategory::SheetGood,
                MaterialCategory::SolidWood,
                MaterialCategory::EdgeBanding,
                MaterialCategory::Hardware,
            ] {
                let s = serde_json::to_string(&v).unwrap();
                let d: MaterialCategory = serde_json::from_str(&s).unwrap();
                assert_eq!(v, d);
            }
        }

        #[test]
        fn test_cost_unit_round_trip() {
            for v in [
                CostUnit::PerSheet,
                CostUnit::PerSqFt,
                CostUnit::PerBoardFt,
                CostUnit::PerLinearFt,
            ] {
                let s = serde_json::to_string(&v).unwrap();
                let d: CostUnit = serde_json::from_str(&s).unwrap();
                assert_eq!(v, d);
            }
        }

        #[test]
        fn test_create_material_plywood_sheet() {
            let json = r#"{
                "name": "18mm White Melamine Particleboard",
                "cutlist_name": "18mm WM-PB",
                "abbreviation": "WM18",
                "category": "sheet_good",
                "default_width": 1220.0,
                "default_length": 2440.0,
                "thickness": 18.0,
                "cost_per_unit": 45.00,
                "cost_unit": "per_sheet"
            }"#;
            let dto: CreateMaterial = serde_json::from_str(json).unwrap();
            assert_eq!(dto.name, "18mm White Melamine Particleboard");
            assert_eq!(dto.category, MaterialCategory::SheetGood);
            assert_eq!(dto.thickness, 18.0);
            assert_eq!(dto.cost_unit, CostUnit::PerSheet);
            assert!(dto.texture_group_id.is_none());
        }

        #[test]
        fn test_create_material_edge_banding() {
            let json = r#"{
                "name": "22mm White ABS Edge Tape",
                "cutlist_name": "22W-ABS",
                "abbreviation": "WABS22",
                "category": "edge_banding",
                "default_width": 22.0,
                "default_length": 100000.0,
                "thickness": 0.5,
                "cost_per_unit": 0.05,
                "cost_unit": "per_linear_ft"
            }"#;
            let dto: CreateMaterial = serde_json::from_str(json).unwrap();
            assert_eq!(dto.category, MaterialCategory::EdgeBanding);
            assert_eq!(dto.cost_unit, CostUnit::PerLinearFt);
        }

        #[test]
        fn test_update_material_partial() {
            let json = r#"{"cost_per_unit": 52.50}"#;
            let dto: UpdateMaterial = serde_json::from_str(json).unwrap();
            assert_eq!(dto.cost_per_unit, Some(52.50));
            assert!(dto.name.is_none());
        }

        #[test]
        fn test_material_zero_cost() {
            let json = r#"{
                "name": "Free Sample",
                "cutlist_name": "SAMPLE",
                "abbreviation": "S",
                "category": "sheet_good",
                "default_width": 600.0,
                "default_length": 600.0,
                "thickness": 18.0,
                "cost_per_unit": 0.0,
                "cost_unit": "per_sheet"
            }"#;
            let dto: CreateMaterial = serde_json::from_str(json).unwrap();
            assert_eq!(dto.cost_per_unit, 0.0);
        }
    }

    // -------------------------------------------------------------------------
    // texture
    // -------------------------------------------------------------------------
    mod texture {
        use super::*;
        use crate::models::{CreateTexture, GrainOrientation, TextureSheen, UpdateTexture};

        #[test]
        fn test_texture_sheen_all_variants_serialize() {
            let cases = vec![
                (TextureSheen::None, "\"none\""),
                (TextureSheen::Flat, "\"flat\""),
                (TextureSheen::Satin, "\"satin\""),
                (TextureSheen::SemiGloss, "\"semi_gloss\""),
                (TextureSheen::HighGloss, "\"high_gloss\""),
                (TextureSheen::Glass, "\"glass\""),
            ];
            for (variant, expected) in cases {
                assert_eq!(serde_json::to_string(&variant).unwrap(), expected);
            }
        }

        #[test]
        fn test_grain_orientation_all_variants_serialize() {
            let cases = vec![
                (GrainOrientation::Horizontal, "\"horizontal\""),
                (GrainOrientation::Vertical, "\"vertical\""),
                (GrainOrientation::None, "\"none\""),
            ];
            for (variant, expected) in cases {
                assert_eq!(serde_json::to_string(&variant).unwrap(), expected);
            }
        }

        #[test]
        fn test_texture_sheen_round_trip() {
            for v in [
                TextureSheen::None,
                TextureSheen::Flat,
                TextureSheen::Satin,
                TextureSheen::SemiGloss,
                TextureSheen::HighGloss,
                TextureSheen::Glass,
            ] {
                let s = serde_json::to_string(&v).unwrap();
                let d: TextureSheen = serde_json::from_str(&s).unwrap();
                assert_eq!(v, d);
            }
        }

        #[test]
        fn test_grain_orientation_round_trip() {
            for v in [
                GrainOrientation::Horizontal,
                GrainOrientation::Vertical,
                GrainOrientation::None,
            ] {
                let s = serde_json::to_string(&v).unwrap();
                let d: GrainOrientation = serde_json::from_str(&s).unwrap();
                assert_eq!(v, d);
            }
        }

        #[test]
        fn test_create_texture_white_high_gloss() {
            let json = r#"{
                "name": "Arctic White High Gloss",
                "abbreviation": "AWHG",
                "image_url": "https://cdn.example.com/textures/arctic_white.jpg",
                "sheen": "high_gloss",
                "grain_orientation": "none",
                "transparency": 0.0,
                "metallicness": 0.1,
                "visual_width": 1000.0,
                "visual_height": 1000.0,
                "rotation_angle": 0.0
            }"#;
            let dto: CreateTexture = serde_json::from_str(json).unwrap();
            assert_eq!(dto.name, "Arctic White High Gloss");
            assert_eq!(dto.sheen, TextureSheen::HighGloss);
            assert_eq!(dto.grain_orientation, GrainOrientation::None);
            assert!(dto.image_url.is_some());
        }

        #[test]
        fn test_create_texture_oak_veneer_with_grain() {
            let json = r#"{
                "name": "Natural Oak Veneer",
                "abbreviation": "NOV",
                "sheen": "satin",
                "grain_orientation": "vertical",
                "visual_width": 300.0,
                "visual_height": 1200.0
            }"#;
            let dto: CreateTexture = serde_json::from_str(json).unwrap();
            assert_eq!(dto.grain_orientation, GrainOrientation::Vertical);
            assert!(dto.image_url.is_none());
            assert_eq!(dto.transparency, 0.0);
            assert_eq!(dto.metallicness, 0.0);
        }

        #[test]
        fn test_update_texture_sheen_only() {
            let json = r#"{"sheen": "semi_gloss"}"#;
            let dto: UpdateTexture = serde_json::from_str(json).unwrap();
            assert_eq!(dto.sheen, Some(TextureSheen::SemiGloss));
            assert!(dto.name.is_none());
        }
    }

    // -------------------------------------------------------------------------
    // texture_group
    // -------------------------------------------------------------------------
    mod texture_group {
        use super::*;
        use crate::models::{CreateTextureGroup, TextureGroup, UpdateTextureGroup};

        #[test]
        fn test_texture_group_struct_serializes() {
            let id = Uuid::new_v4();
            let now = Utc::now();
            let group = TextureGroup {
                id,
                name: "Oak Veneer Collection".to_string(),
                created_at: now,
            };
            let s = serde_json::to_string(&group).unwrap();
            let v: Value = serde_json::from_str(&s).unwrap();
            assert_eq!(v["name"], "Oak Veneer Collection");
        }

        #[test]
        fn test_create_texture_group_deserializes() {
            let json = r#"{"name": "Painted Finishes"}"#;
            let dto: CreateTextureGroup = serde_json::from_str(json).unwrap();
            assert_eq!(dto.name, "Painted Finishes");
        }

        #[test]
        fn test_update_texture_group_name_some() {
            let json = r#"{"name": "Premium Veneers"}"#;
            let dto: UpdateTextureGroup = serde_json::from_str(json).unwrap();
            assert_eq!(dto.name, Some("Premium Veneers".to_string()));
        }

        #[test]
        fn test_update_texture_group_empty_patch() {
            let json = r#"{}"#;
            let dto: UpdateTextureGroup = serde_json::from_str(json).unwrap();
            assert!(dto.name.is_none());
        }
    }

    // -------------------------------------------------------------------------
    // hardware
    // -------------------------------------------------------------------------
    mod hardware {
        use super::*;
        use crate::models::{CreateHardware, HardwareType, UpdateHardware};

        #[test]
        fn test_hardware_type_all_variants_serialize() {
            let cases = vec![
                (HardwareType::Hinge, "\"hinge\""),
                (HardwareType::Slide, "\"slide\""),
                (HardwareType::Handle, "\"handle\""),
                (HardwareType::Connector, "\"connector\""),
                (HardwareType::Fastener, "\"fastener\""),
            ];
            for (variant, expected) in cases {
                assert_eq!(serde_json::to_string(&variant).unwrap(), expected);
            }
        }

        #[test]
        fn test_hardware_type_round_trip() {
            for v in [
                HardwareType::Hinge,
                HardwareType::Slide,
                HardwareType::Handle,
                HardwareType::Connector,
                HardwareType::Fastener,
            ] {
                let s = serde_json::to_string(&v).unwrap();
                let d: HardwareType = serde_json::from_str(&s).unwrap();
                assert_eq!(v, d);
            }
        }

        #[test]
        fn test_create_hardware_blum_hinge() {
            let json = r#"{
                "name": "Blum CLIP top 110° Hinge",
                "brand": "Blum",
                "model_name": "71B3550",
                "hardware_type": "hinge",
                "drilling_pattern": {
                    "cup_hole": {"x": 37, "y": 0, "diameter": 35, "depth": 13},
                    "mounting_holes": [{"x": 37, "y": 48}, {"x": 37, "y": 48}]
                }
            }"#;
            let dto: CreateHardware = serde_json::from_str(json).unwrap();
            assert_eq!(dto.brand, "Blum");
            assert_eq!(dto.hardware_type, HardwareType::Hinge);
            assert!(dto.drilling_pattern.is_some());
        }

        #[test]
        fn test_create_hardware_minimal_fields() {
            let json = r#"{
                "name": "M6 Confirmat Screw",
                "brand": "Hafele",
                "model_name": "CF-6x50",
                "hardware_type": "fastener"
            }"#;
            let dto: CreateHardware = serde_json::from_str(json).unwrap();
            assert_eq!(dto.hardware_type, HardwareType::Fastener);
            assert!(dto.drilling_pattern.is_none());
            assert!(dto.parameters.is_none());
        }

        #[test]
        fn test_update_hardware_partial() {
            let json = r#"{"hardware_type": "slide"}"#;
            let dto: UpdateHardware = serde_json::from_str(json).unwrap();
            assert_eq!(dto.hardware_type, Some(HardwareType::Slide));
            assert!(dto.name.is_none());
        }
    }

    // -------------------------------------------------------------------------
    // construction_method
    // -------------------------------------------------------------------------
    mod construction_method {
        use super::*;
        use crate::models::{ConstructionMethod, CreateConstructionMethod, UpdateConstructionMethod};

        #[test]
        fn test_create_construction_method_dowel() {
            let json = r#"{
                "name": "32mm Dowel System",
                "joinery_type": ["dowel", "confirmat"],
                "fastener_specs": {"dowel_diameter": 8, "spacing": 32},
                "placement_rules": {"reveal": 2.0, "inset": 0.0}
            }"#;
            let dto: CreateConstructionMethod = serde_json::from_str(json).unwrap();
            assert_eq!(dto.name, "32mm Dowel System");
            assert_eq!(dto.joinery_type, vec!["dowel", "confirmat"]);
            assert!(dto.fastener_specs.is_some());
        }

        #[test]
        fn test_create_construction_method_empty_joinery() {
            let json = r#"{
                "name": "Basic Butt Joint",
                "joinery_type": []
            }"#;
            let dto: CreateConstructionMethod = serde_json::from_str(json).unwrap();
            assert!(dto.joinery_type.is_empty());
        }

        #[test]
        fn test_construction_method_struct_fields_accessible() {
            let id = Uuid::new_v4();
            let now = Utc::now();
            let cm = ConstructionMethod {
                id,
                name: "Cam Lock System".to_string(),
                joinery_type: vec!["cam_lock".to_string()],
                fastener_specs: json!({"cam_diameter": 15}),
                placement_rules: json!({}),
                created_at: now,
                updated_at: now,
            };
            assert_eq!(cm.joinery_type.len(), 1);
            assert_eq!(cm.joinery_type[0], "cam_lock");
        }

        #[test]
        fn test_update_construction_method_partial() {
            let json = r#"{"joinery_type": ["biscuit"]}"#;
            let dto: UpdateConstructionMethod = serde_json::from_str(json).unwrap();
            assert_eq!(dto.joinery_type, Some(vec!["biscuit".to_string()]));
            assert!(dto.name.is_none());
        }
    }

    // -------------------------------------------------------------------------
    // machine
    // -------------------------------------------------------------------------
    mod machine {
        use super::*;
        use crate::models::{CreateMachine, MachineType, UpdateMachine};

        #[test]
        fn test_machine_type_all_variants_serialize() {
            let cases = vec![
                (MachineType::NestingRouter, "\"nesting_router\""),
                (MachineType::PointToPoint, "\"point_to_point\""),
                (MachineType::VerticalCnc, "\"vertical_cnc\""),
                (MachineType::DrillAndDowel, "\"drill_and_dowel\""),
                (MachineType::BeamSaw, "\"beam_saw\""),
            ];
            for (variant, expected) in cases {
                assert_eq!(serde_json::to_string(&variant).unwrap(), expected);
            }
        }

        #[test]
        fn test_machine_type_round_trip() {
            for v in [
                MachineType::NestingRouter,
                MachineType::PointToPoint,
                MachineType::VerticalCnc,
                MachineType::DrillAndDowel,
                MachineType::BeamSaw,
            ] {
                let s = serde_json::to_string(&v).unwrap();
                let d: MachineType = serde_json::from_str(&s).unwrap();
                assert_eq!(v, d);
            }
        }

        #[test]
        fn test_create_machine_nesting_router() {
            let pp_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "name": "Biesse Rover A 5",
                    "brand": "Biesse",
                    "model_name": "Rover A 5",
                    "machine_type": "nesting_router",
                    "post_processor_id": "{pp_id}",
                    "spoilboard_width": 1300.0,
                    "spoilboard_length": 2500.0,
                    "spoilboard_thickness": 22.0
                }}"#
            );
            let dto: CreateMachine = serde_json::from_str(&json).unwrap();
            assert_eq!(dto.name, "Biesse Rover A 5");
            assert_eq!(dto.machine_type, MachineType::NestingRouter);
            assert!(dto.post_processor_id.is_some());
        }

        #[test]
        fn test_create_machine_no_post_processor() {
            let json = r#"{
                "name": "Generic Beam Saw",
                "brand": "SCM",
                "model_name": "Sigma 3",
                "machine_type": "beam_saw",
                "spoilboard_width": 3200.0,
                "spoilboard_length": 6400.0,
                "spoilboard_thickness": 0.0
            }"#;
            let dto: CreateMachine = serde_json::from_str(json).unwrap();
            assert!(dto.post_processor_id.is_none());
            assert_eq!(dto.machine_type, MachineType::BeamSaw);
        }

        #[test]
        fn test_update_machine_partial() {
            let json = r#"{"machine_type": "point_to_point"}"#;
            let dto: UpdateMachine = serde_json::from_str(json).unwrap();
            assert_eq!(dto.machine_type, Some(MachineType::PointToPoint));
            assert!(dto.name.is_none());
        }
    }

    // -------------------------------------------------------------------------
    // tool
    // -------------------------------------------------------------------------
    mod tool {
        use super::*;
        use crate::models::{CreateTool, ToolType, UpdateTool};

        #[test]
        fn test_tool_type_all_variants_serialize() {
            let cases = vec![
                (ToolType::CompressionCutter, "\"compression_cutter\""),
                (ToolType::DownShear, "\"down_shear\""),
                (ToolType::UpCut, "\"up_cut\""),
                (ToolType::Dovetail, "\"dovetail\""),
                (ToolType::ProfileBit, "\"profile_bit\""),
                (ToolType::DrillBit, "\"drill_bit\""),
            ];
            for (variant, expected) in cases {
                assert_eq!(serde_json::to_string(&variant).unwrap(), expected);
            }
        }

        #[test]
        fn test_tool_type_round_trip() {
            for v in [
                ToolType::CompressionCutter,
                ToolType::DownShear,
                ToolType::UpCut,
                ToolType::Dovetail,
                ToolType::ProfileBit,
                ToolType::DrillBit,
            ] {
                let s = serde_json::to_string(&v).unwrap();
                let d: ToolType = serde_json::from_str(&s).unwrap();
                assert_eq!(v, d);
            }
        }

        #[test]
        fn test_create_tool_compression_cutter() {
            let json = r#"{
                "name": "12mm Compression Spiral",
                "diameter": 12.0,
                "tool_type": "compression_cutter",
                "rpm": 18000,
                "feed_rate": 6000.0,
                "plunge_rate": 2000.0,
                "max_depth_per_pass": 18.0
            }"#;
            let dto: CreateTool = serde_json::from_str(json).unwrap();
            assert_eq!(dto.diameter, 12.0);
            assert_eq!(dto.tool_type, ToolType::CompressionCutter);
            assert_eq!(dto.rpm, 18000);
            assert_eq!(dto.feed_rate, 6000.0);
        }

        #[test]
        fn test_create_tool_drill_bit() {
            let json = r#"{
                "name": "5mm HSS Drill",
                "diameter": 5.0,
                "tool_type": "drill_bit",
                "rpm": 4000,
                "feed_rate": 800.0,
                "plunge_rate": 400.0,
                "max_depth_per_pass": 50.0
            }"#;
            let dto: CreateTool = serde_json::from_str(json).unwrap();
            assert_eq!(dto.tool_type, ToolType::DrillBit);
        }

        #[test]
        fn test_update_tool_rpm_and_feed() {
            let json = r#"{"rpm": 20000, "feed_rate": 7000.0}"#;
            let dto: UpdateTool = serde_json::from_str(json).unwrap();
            assert_eq!(dto.rpm, Some(20000));
            assert_eq!(dto.feed_rate, Some(7000.0));
            assert!(dto.diameter.is_none());
        }
    }

    // -------------------------------------------------------------------------
    // post_processor
    // -------------------------------------------------------------------------
    mod post_processor {
        use super::*;
        use crate::models::{CreatePostProcessor, OutputFormat, UpdatePostProcessor};

        #[test]
        fn test_output_format_all_variants_serialize() {
            let cases = vec![
                (OutputFormat::Nc, "\"nc\""),
                (OutputFormat::GCode, "\"g_code\""),
                (OutputFormat::Tap, "\"tap\""),
                (OutputFormat::Mpr, "\"mpr\""),
                (OutputFormat::Cix, "\"cix\""),
                (OutputFormat::Xcs, "\"xcs\""),
                (OutputFormat::Csv, "\"csv\""),
            ];
            for (variant, expected) in cases {
                assert_eq!(serde_json::to_string(&variant).unwrap(), expected);
            }
        }

        #[test]
        fn test_output_format_round_trip() {
            for v in [
                OutputFormat::Nc,
                OutputFormat::GCode,
                OutputFormat::Tap,
                OutputFormat::Mpr,
                OutputFormat::Cix,
                OutputFormat::Xcs,
                OutputFormat::Csv,
            ] {
                let s = serde_json::to_string(&v).unwrap();
                let d: OutputFormat = serde_json::from_str(&s).unwrap();
                assert_eq!(v, d);
            }
        }

        #[test]
        fn test_create_post_processor_biesse() {
            let json = r#"{
                "name": "Biesse WoodWOP",
                "machine_type": "nesting_router",
                "output_format": "mpr",
                "template_content": "%{PROGRAM_NAME}\n; Biesse WoodWOP program\nM30\n"
            }"#;
            let dto: CreatePostProcessor = serde_json::from_str(json).unwrap();
            assert_eq!(dto.name, "Biesse WoodWOP");
            assert_eq!(dto.output_format, OutputFormat::Mpr);
            assert!(dto.variables.is_none());
        }

        #[test]
        fn test_create_post_processor_generic_gcode() {
            let json = r#"{
                "name": "Generic G-code",
                "machine_type": "nesting_router",
                "output_format": "g_code",
                "template_content": "G21 G90\n{OPERATIONS}\nM30\n",
                "variables": {"SPINDLE_SPEED": 18000}
            }"#;
            let dto: CreatePostProcessor = serde_json::from_str(json).unwrap();
            assert_eq!(dto.output_format, OutputFormat::GCode);
            assert!(dto.variables.is_some());
        }

        #[test]
        fn test_update_post_processor_format_only() {
            let json = r#"{"output_format": "nc"}"#;
            let dto: UpdatePostProcessor = serde_json::from_str(json).unwrap();
            assert_eq!(dto.output_format, Some(OutputFormat::Nc));
            assert!(dto.name.is_none());
        }
    }

    // -------------------------------------------------------------------------
    // optimization_run
    // -------------------------------------------------------------------------
    mod optimization_run {
        use super::*;
        use crate::models::{
            CreateOptimizationRun, OptimizationQuality, OptimizationStatus, UpdateOptimizationRun,
        };

        #[test]
        fn test_optimization_status_all_variants_serialize() {
            let cases = vec![
                (OptimizationStatus::Pending, "\"pending\""),
                (OptimizationStatus::Running, "\"running\""),
                (OptimizationStatus::Completed, "\"completed\""),
                (OptimizationStatus::Failed, "\"failed\""),
            ];
            for (variant, expected) in cases {
                assert_eq!(serde_json::to_string(&variant).unwrap(), expected);
            }
        }

        #[test]
        fn test_optimization_quality_all_variants_serialize() {
            let cases = vec![
                (OptimizationQuality::FastEstimate, "\"fast_estimate\""),
                (OptimizationQuality::Good, "\"good\""),
                (OptimizationQuality::Better, "\"better\""),
                (OptimizationQuality::Best, "\"best\""),
            ];
            for (variant, expected) in cases {
                assert_eq!(serde_json::to_string(&variant).unwrap(), expected);
            }
        }

        #[test]
        fn test_optimization_status_round_trip() {
            for v in [
                OptimizationStatus::Pending,
                OptimizationStatus::Running,
                OptimizationStatus::Completed,
                OptimizationStatus::Failed,
            ] {
                let s = serde_json::to_string(&v).unwrap();
                let d: OptimizationStatus = serde_json::from_str(&s).unwrap();
                assert_eq!(v, d);
            }
        }

        #[test]
        fn test_optimization_quality_round_trip() {
            for v in [
                OptimizationQuality::FastEstimate,
                OptimizationQuality::Good,
                OptimizationQuality::Better,
                OptimizationQuality::Best,
            ] {
                let s = serde_json::to_string(&v).unwrap();
                let d: OptimizationQuality = serde_json::from_str(&s).unwrap();
                assert_eq!(v, d);
            }
        }

        #[test]
        fn test_create_optimization_run() {
            let job_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "job_id": "{job_id}",
                    "name": "Run 1 - Best Quality",
                    "quality": "best",
                    "settings": {{"kerf_width": 3.2, "edge_margin": 10.0, "enforce_grain": true}}
                }}"#
            );
            let dto: CreateOptimizationRun = serde_json::from_str(&json).unwrap();
            assert_eq!(dto.quality, OptimizationQuality::Best);
            assert!(dto.settings.is_some());
        }

        #[test]
        fn test_update_optimization_run_status() {
            let json = r#"{"status": "running", "yield_percentage": 87.5}"#;
            let dto: UpdateOptimizationRun = serde_json::from_str(json).unwrap();
            assert_eq!(dto.status, Some(OptimizationStatus::Running));
            assert_eq!(dto.yield_percentage, Some(87.5));
        }

        #[test]
        fn test_update_optimization_run_with_sheets() {
            let json = r#"{"sheets": [{"sheet_index": 1, "waste_pct": 12.3}], "status": "completed"}"#;
            let dto: UpdateOptimizationRun = serde_json::from_str(json).unwrap();
            assert_eq!(dto.status, Some(OptimizationStatus::Completed));
            assert!(dto.sheets.is_some());
        }
    }

    // -------------------------------------------------------------------------
    // nested_sheet
    // -------------------------------------------------------------------------
    mod nested_sheet {
        use super::*;
        use crate::models::CreateNestedSheet;

        #[test]
        fn test_create_nested_sheet_full() {
            let run_id = Uuid::new_v4();
            let mat_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "optimization_run_id": "{run_id}",
                    "material_id": "{mat_id}",
                    "sheet_index": 1,
                    "width": 1220.0,
                    "length": 2440.0,
                    "parts_layout": [
                        {{"part_id": "00000000-0000-0000-0000-000000000001", "x": 10, "y": 10, "rotated": false}}
                    ],
                    "waste_percentage": 8.5,
                    "gcode_file": "/gcode/run1_sheet1.nc"
                }}"#
            );
            let dto: CreateNestedSheet = serde_json::from_str(&json).unwrap();
            assert_eq!(dto.sheet_index, 1);
            assert_eq!(dto.width, 1220.0);
            assert_eq!(dto.waste_percentage, Some(8.5));
            assert!(dto.gcode_file.is_some());
        }

        #[test]
        fn test_create_nested_sheet_minimal() {
            let run_id = Uuid::new_v4();
            let mat_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "optimization_run_id": "{run_id}",
                    "material_id": "{mat_id}",
                    "sheet_index": 2,
                    "width": 1220.0,
                    "length": 2440.0
                }}"#
            );
            let dto: CreateNestedSheet = serde_json::from_str(&json).unwrap();
            assert!(dto.parts_layout.is_none());
            assert!(dto.waste_percentage.is_none());
            assert!(dto.gcode_file.is_none());
        }
    }

    // -------------------------------------------------------------------------
    // user
    // -------------------------------------------------------------------------
    mod user {
        use super::*;
        use crate::models::{CreateUser, LoginRequest, UpdateUser, User, UserRole};

        #[test]
        fn test_user_role_all_variants_serialize() {
            let cases = vec![
                (UserRole::SuperAdmin, "\"super_admin\""),
                (UserRole::Designer, "\"designer\""),
                (UserRole::CncOperator, "\"cnc_operator\""),
                (UserRole::ShopFloor, "\"shop_floor\""),
            ];
            for (variant, expected) in cases {
                assert_eq!(serde_json::to_string(&variant).unwrap(), expected);
            }
        }

        #[test]
        fn test_user_role_round_trip() {
            for v in [
                UserRole::SuperAdmin,
                UserRole::Designer,
                UserRole::CncOperator,
                UserRole::ShopFloor,
            ] {
                let s = serde_json::to_string(&v).unwrap();
                let d: UserRole = serde_json::from_str(&s).unwrap();
                assert_eq!(v, d);
            }
        }

        #[test]
        fn test_user_password_hash_skipped_during_serialization() {
            let now = Utc::now();
            let user = User {
                id: Uuid::new_v4(),
                email: "alice@example.com".to_string(),
                name: "Alice".to_string(),
                password_hash: "$argon2id$v=19$m=65536...secret_hash".to_string(),
                role: UserRole::Designer,
                permissions: json!({}),
                created_at: now,
                updated_at: now,
            };
            let serialized = serde_json::to_string(&user).unwrap();
            // password_hash must NOT appear in the JSON
            assert!(
                !serialized.contains("password_hash"),
                "password_hash should be skipped during serialization"
            );
            assert!(
                !serialized.contains("secret_hash"),
                "password hash value should not be serialized"
            );
            // email should appear
            assert!(serialized.contains("alice@example.com"));
        }

        #[test]
        fn test_user_role_is_serialized() {
            let now = Utc::now();
            let user = User {
                id: Uuid::new_v4(),
                email: "admin@shop.com".to_string(),
                name: "Admin User".to_string(),
                password_hash: "hash".to_string(),
                role: UserRole::SuperAdmin,
                permissions: json!({"all": true}),
                created_at: now,
                updated_at: now,
            };
            let v: Value = serde_json::from_str(&serde_json::to_string(&user).unwrap()).unwrap();
            assert_eq!(v["role"], "super_admin");
        }

        #[test]
        fn test_create_user_deserializes() {
            let json = r#"{
                "email": "designer@shop.com",
                "name": "Bob Designer",
                "password": "SecureP@ss123",
                "role": "designer"
            }"#;
            let dto: CreateUser = serde_json::from_str(json).unwrap();
            assert_eq!(dto.email, "designer@shop.com");
            assert_eq!(dto.password, "SecureP@ss123");
            assert_eq!(dto.role, UserRole::Designer);
            assert!(dto.permissions.is_none());
        }

        #[test]
        fn test_update_user_partial() {
            let json = r#"{"role": "cnc_operator"}"#;
            let dto: UpdateUser = serde_json::from_str(json).unwrap();
            assert_eq!(dto.role, Some(UserRole::CncOperator));
            assert!(dto.email.is_none());
        }

        #[test]
        fn test_login_request_deserializes() {
            let json = r#"{"email": "user@shop.com", "password": "mypassword"}"#;
            let dto: LoginRequest = serde_json::from_str(json).unwrap();
            assert_eq!(dto.email, "user@shop.com");
            assert_eq!(dto.password, "mypassword");
        }

        #[test]
        fn test_user_role_shop_floor_deserialization() {
            let role: UserRole = serde_json::from_str("\"shop_floor\"").unwrap();
            assert_eq!(role, UserRole::ShopFloor);
        }
    }

    // -------------------------------------------------------------------------
    // quote
    // -------------------------------------------------------------------------
    mod quote {
        use super::*;
        use crate::models::{CreateQuote, UpdateQuote};

        #[test]
        fn test_create_quote_deserializes() {
            let job_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "job_id": "{job_id}",
                    "quote_number": "Q-2025-0042",
                    "material_cost": 1850.00,
                    "hardware_cost": 320.50,
                    "labor_cost": 960.00,
                    "markup_percentage": 25.0,
                    "line_items": [
                        {{"description": "18mm White Melamine", "qty": 12, "unit_cost": 45.00}}
                    ]
                }}"#
            );
            let dto: CreateQuote = serde_json::from_str(&json).unwrap();
            assert_eq!(dto.quote_number, "Q-2025-0042");
            assert_eq!(dto.material_cost, 1850.00);
            assert_eq!(dto.markup_percentage, 25.0);
            assert!(dto.line_items.is_some());
        }

        #[test]
        fn test_create_quote_zero_costs() {
            let job_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "job_id": "{job_id}",
                    "quote_number": "Q-2025-0001",
                    "material_cost": 0.0,
                    "hardware_cost": 0.0,
                    "labor_cost": 0.0,
                    "markup_percentage": 0.0
                }}"#
            );
            let dto: CreateQuote = serde_json::from_str(&json).unwrap();
            assert_eq!(dto.total_implied(), 0.0);
        }

        #[test]
        fn test_update_quote_markup_only() {
            let json = r#"{"markup_percentage": 30.0}"#;
            let dto: UpdateQuote = serde_json::from_str(json).unwrap();
            assert_eq!(dto.markup_percentage, Some(30.0));
            assert!(dto.quote_number.is_none());
        }

        #[test]
        fn test_update_quote_all_fields() {
            let json = r#"{
                "quote_number": "Q-2025-0043",
                "material_cost": 2000.00,
                "hardware_cost": 400.00,
                "labor_cost": 1000.00,
                "markup_percentage": 20.0
            }"#;
            let dto: UpdateQuote = serde_json::from_str(json).unwrap();
            assert_eq!(dto.material_cost, Some(2000.00));
            assert_eq!(dto.labor_cost, Some(1000.00));
        }
    }

    // -------------------------------------------------------------------------
    // label_template
    // -------------------------------------------------------------------------
    mod label_template {
        use super::*;
        use crate::models::{CreateLabelTemplate, LabelTemplate, UpdateLabelTemplate};

        #[test]
        fn test_create_label_template_deserializes() {
            let json = r#"{
                "name": "Standard Part Label 100x50",
                "width": 100.0,
                "height": 50.0,
                "fields": [
                    {"type": "text", "content": "{part_name}", "x": 5, "y": 5},
                    {"type": "barcode", "content": "{part_id}", "x": 60, "y": 5}
                ]
            }"#;
            let dto: CreateLabelTemplate = serde_json::from_str(json).unwrap();
            assert_eq!(dto.name, "Standard Part Label 100x50");
            assert_eq!(dto.width, 100.0);
            assert_eq!(dto.height, 50.0);
        }

        #[test]
        fn test_label_template_struct_accessible() {
            let id = Uuid::new_v4();
            let now = Utc::now();
            let tmpl = LabelTemplate {
                id,
                name: "Tiny Label 50x25".to_string(),
                width: 50.0,
                height: 25.0,
                fields: json!([]),
                created_at: now,
                updated_at: now,
            };
            assert_eq!(tmpl.width, 50.0);
            assert_eq!(tmpl.height, 25.0);
        }

        #[test]
        fn test_update_label_template_dimensions() {
            let json = r#"{"width": 120.0, "height": 60.0}"#;
            let dto: UpdateLabelTemplate = serde_json::from_str(json).unwrap();
            assert_eq!(dto.width, Some(120.0));
            assert_eq!(dto.height, Some(60.0));
            assert!(dto.name.is_none());
        }
    }

    // -------------------------------------------------------------------------
    // drawing_template
    // -------------------------------------------------------------------------
    mod drawing_template {
        use super::*;
        use crate::models::{CreateDrawingTemplate, DrawingTemplate, UpdateDrawingTemplate};

        #[test]
        fn test_create_drawing_template_a3_landscape() {
            let json = r#"{
                "name": "A3 Landscape Cabinet Drawing",
                "page_size": "A3",
                "layout": {"orientation": "landscape", "viewports": []},
                "title_block": {"company": "CNC Shop", "drawn_by": "", "date": ""}
            }"#;
            let dto: CreateDrawingTemplate = serde_json::from_str(json).unwrap();
            assert_eq!(dto.page_size, "A3");
            assert_eq!(dto.name, "A3 Landscape Cabinet Drawing");
        }

        #[test]
        fn test_drawing_template_struct_accessible() {
            let now = Utc::now();
            let tmpl = DrawingTemplate {
                id: Uuid::new_v4(),
                name: "Letter Shop Drawing".to_string(),
                page_size: "Letter".to_string(),
                layout: json!({}),
                title_block: json!({}),
                created_at: now,
                updated_at: now,
            };
            assert_eq!(tmpl.page_size, "Letter");
        }

        #[test]
        fn test_update_drawing_template_page_size() {
            let json = r#"{"page_size": "A4"}"#;
            let dto: UpdateDrawingTemplate = serde_json::from_str(json).unwrap();
            assert_eq!(dto.page_size, Some("A4".to_string()));
            assert!(dto.name.is_none());
        }
    }

    // -------------------------------------------------------------------------
    // saved_view
    // -------------------------------------------------------------------------
    mod saved_view {
        use super::*;
        use crate::models::{CreateSavedView, SavedView, UpdateSavedView};

        #[test]
        fn test_create_saved_view_deserializes() {
            let room_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "room_id": "{room_id}",
                    "name": "Front Elevation View",
                    "camera_position": {{
                        "x": 0, "y": 1200, "z": 3000,
                        "target_x": 0, "target_y": 1200, "target_z": 0,
                        "fov": 45
                    }},
                    "layer_visibility": {{"cabinet_bodies": true, "hardware": false}}
                }}"#
            );
            let dto: CreateSavedView = serde_json::from_str(&json).unwrap();
            assert_eq!(dto.name, "Front Elevation View");
            assert!(dto.layer_visibility.is_some());
        }

        #[test]
        fn test_saved_view_struct_accessible() {
            let now = Utc::now();
            let view = SavedView {
                id: Uuid::new_v4(),
                room_id: Uuid::new_v4(),
                name: "3D Perspective".to_string(),
                camera_position: json!({"x": 2000, "y": 1500, "z": 2500}),
                layer_visibility: json!({}),
                created_at: now,
            };
            assert_eq!(view.name, "3D Perspective");
        }

        #[test]
        fn test_update_saved_view_name_only() {
            let json = r#"{"name": "Renamed View"}"#;
            let dto: UpdateSavedView = serde_json::from_str(json).unwrap();
            assert_eq!(dto.name, Some("Renamed View".to_string()));
            assert!(dto.camera_position.is_none());
        }
    }

    // -------------------------------------------------------------------------
    // annotation_layer
    // -------------------------------------------------------------------------
    mod annotation_layer {
        use super::*;
        use crate::models::{AnnotationLayer, CreateAnnotationLayer, UpdateAnnotationLayer};

        #[test]
        fn test_create_annotation_layer_visible_by_default() {
            let room_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "room_id": "{room_id}",
                    "name": "Dimension Annotations",
                    "color": "#FF5500"
                }}"#
            );
            let dto: CreateAnnotationLayer = serde_json::from_str(&json).unwrap();
            // visible defaults to true (via default_true function)
            assert!(dto.visible);
            assert!(dto.items.is_none());
        }

        #[test]
        fn test_create_annotation_layer_not_visible() {
            let room_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "room_id": "{room_id}",
                    "name": "Hidden Layer",
                    "color": "#0000FF",
                    "visible": false
                }}"#
            );
            let dto: CreateAnnotationLayer = serde_json::from_str(&json).unwrap();
            assert!(!dto.visible);
        }

        #[test]
        fn test_annotation_layer_struct_accessible() {
            let now = Utc::now();
            let layer = AnnotationLayer {
                id: Uuid::new_v4(),
                room_id: Uuid::new_v4(),
                name: "Notes Layer".to_string(),
                color: "#00FF00".to_string(),
                visible: true,
                items: json!([]),
                created_at: now,
            };
            assert_eq!(layer.color, "#00FF00");
            assert!(layer.visible);
        }

        #[test]
        fn test_update_annotation_layer_hide() {
            let json = r#"{"visible": false}"#;
            let dto: UpdateAnnotationLayer = serde_json::from_str(json).unwrap();
            assert_eq!(dto.visible, Some(false));
            assert!(dto.name.is_none());
        }
    }

    // -------------------------------------------------------------------------
    // remnant
    // -------------------------------------------------------------------------
    mod remnant {
        use super::*;
        use crate::models::{CreateRemnant, Remnant, UpdateRemnant};

        #[test]
        fn test_create_remnant_with_source() {
            let mat_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "material_id": "{mat_id}",
                    "width": 600.0,
                    "length": 800.0,
                    "thickness": 18.0,
                    "source_sheet": "Job-042-Sheet-3"
                }}"#
            );
            let dto: CreateRemnant = serde_json::from_str(&json).unwrap();
            assert_eq!(dto.width, 600.0);
            assert_eq!(dto.source_sheet, Some("Job-042-Sheet-3".to_string()));
        }

        #[test]
        fn test_create_remnant_no_source() {
            let mat_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "material_id": "{mat_id}",
                    "width": 400.0,
                    "length": 600.0,
                    "thickness": 16.0
                }}"#
            );
            let dto: CreateRemnant = serde_json::from_str(&json).unwrap();
            assert!(dto.source_sheet.is_none());
        }

        #[test]
        fn test_remnant_struct_accessible() {
            let now = Utc::now();
            let r = Remnant {
                id: Uuid::new_v4(),
                material_id: Uuid::new_v4(),
                width: 550.0,
                length: 700.0,
                thickness: 18.0,
                source_sheet: None,
                created_at: now,
            };
            assert_eq!(r.thickness, 18.0);
            assert!(r.source_sheet.is_none());
        }

        #[test]
        fn test_update_remnant_dimensions() {
            let json = r#"{"width": 500.0, "length": 750.0}"#;
            let dto: UpdateRemnant = serde_json::from_str(json).unwrap();
            assert_eq!(dto.width, Some(500.0));
            assert_eq!(dto.length, Some(750.0));
            assert!(dto.source_sheet.is_none());
        }
    }

    // -------------------------------------------------------------------------
    // material_template
    // -------------------------------------------------------------------------
    mod material_template {
        use super::*;
        use crate::models::{CreateMaterialTemplate, MaterialTemplate, UpdateMaterialTemplate};

        #[test]
        fn test_create_material_template_with_assignments() {
            let side_mat = Uuid::new_v4();
            let back_mat = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "name": "Standard White Kitchen",
                    "assignments": {{
                        "side": "{side_mat}",
                        "back": "{back_mat}",
                        "shelf": "{side_mat}"
                    }}
                }}"#
            );
            let dto: CreateMaterialTemplate = serde_json::from_str(&json).unwrap();
            assert_eq!(dto.name, "Standard White Kitchen");
            let assignments = dto.assignments.as_object().unwrap();
            assert!(assignments.contains_key("side"));
            assert!(assignments.contains_key("back"));
        }

        #[test]
        fn test_material_template_struct_accessible() {
            let now = Utc::now();
            let tmpl = MaterialTemplate {
                id: Uuid::new_v4(),
                name: "Oak Veneer Template".to_string(),
                assignments: json!({"side": "uuid-abc"}),
                created_at: now,
                updated_at: now,
            };
            assert_eq!(tmpl.name, "Oak Veneer Template");
        }

        #[test]
        fn test_update_material_template_name_only() {
            let json = r#"{"name": "New Template Name"}"#;
            let dto: UpdateMaterialTemplate = serde_json::from_str(json).unwrap();
            assert_eq!(dto.name, Some("New Template Name".to_string()));
            assert!(dto.assignments.is_none());
        }
    }

    // -------------------------------------------------------------------------
    // atc_tool_set
    // -------------------------------------------------------------------------
    mod atc_tool_set {
        use super::*;
        use crate::models::{AtcToolSet, CreateAtcToolSet, UpdateAtcToolSet};

        #[test]
        fn test_create_atc_tool_set_with_tools() {
            let machine_id = Uuid::new_v4();
            let tool1 = Uuid::new_v4();
            let tool2 = Uuid::new_v4();
            let tool3 = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "name": "Kitchen Production Set",
                    "machine_id": "{machine_id}",
                    "tool_ids": ["{tool1}", "{tool2}", "{tool3}"]
                }}"#
            );
            let dto: CreateAtcToolSet = serde_json::from_str(&json).unwrap();
            assert_eq!(dto.name, "Kitchen Production Set");
            assert_eq!(dto.tool_ids.len(), 3);
        }

        #[test]
        fn test_create_atc_tool_set_empty_tool_ids() {
            let machine_id = Uuid::new_v4();
            let json = format!(
                r#"{{
                    "name": "Empty Set",
                    "machine_id": "{machine_id}",
                    "tool_ids": []
                }}"#
            );
            let dto: CreateAtcToolSet = serde_json::from_str(&json).unwrap();
            assert!(dto.tool_ids.is_empty());
        }

        #[test]
        fn test_atc_tool_set_struct_accessible() {
            let now = Utc::now();
            let set = AtcToolSet {
                id: Uuid::new_v4(),
                name: "Standard 8-Tool Set".to_string(),
                machine_id: Uuid::new_v4(),
                tool_ids: vec![Uuid::new_v4(), Uuid::new_v4()],
                created_at: now,
            };
            assert_eq!(set.tool_ids.len(), 2);
        }

        #[test]
        fn test_update_atc_tool_set() {
            let t1 = Uuid::new_v4();
            let json = format!(r#"{{"name": "Updated Set", "tool_ids": ["{t1}"]}}"#);
            let dto: UpdateAtcToolSet = serde_json::from_str(&json).unwrap();
            assert_eq!(dto.name, Some("Updated Set".to_string()));
            assert_eq!(dto.tool_ids.as_ref().unwrap().len(), 1);
        }
    }

    // -------------------------------------------------------------------------
    // Trait impl helper – CreateQuote::total_implied
    // -------------------------------------------------------------------------
    trait TotalImplied {
        fn total_implied(&self) -> f64;
    }

    impl TotalImplied for crate::models::CreateQuote {
        fn total_implied(&self) -> f64 {
            let sub = self.material_cost + self.hardware_cost + self.labor_cost;
            sub * (1.0 + self.markup_percentage / 100.0)
        }
    }
}
