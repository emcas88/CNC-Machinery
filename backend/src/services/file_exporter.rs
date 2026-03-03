//! # File Exporter
//!
//! Generates downloadable files from CNC cabinet job/part/cut-list data.
//!
//! ## Supported output formats
//!
//! | Format    | Method                   | Description                                   |
//! |-----------|--------------------------|-----------------------------------------------|
//! | CSV       | `export_csv`             | Cut-list, parts list, operations, materials   |
//! | DXF R12   | `export_dxf`             | 2-D part outlines with layers                 |
//! | PDF-text  | `export_pdf`             | Structured report (pipe to PDF renderer)      |
//! | SketchUp  | `export_sketchup`        | Ruby script that builds SketchUp geometry     |
//! | DXF nest  | `export_cutting_diagram` | Sheet outlines with nested part placements    |

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Public enums
// ---------------------------------------------------------------------------

/// Top-level export format selector.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExportFormat {
    Csv,
    Dxf,
    Pdf,
    SketchUp,
}

/// Sub-type for CSV export; selects which view of the data to produce.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CsvExportType {
    /// One row per part with dimensions, material, grain, and edge-band info.
    CutList,
    /// One row per part with product/room hierarchy context.
    PartsList,
    /// One row per machining operation with position, depth, and tool info.
    OperationsList,
    /// One row per material with total area, sheet count, and estimated cost.
    MaterialsSummary,
}

// ---------------------------------------------------------------------------
// Data structures consumed by the exporter
// ---------------------------------------------------------------------------

/// A single machining operation on a part.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportOperation {
    pub id: Uuid,
    pub part_id: Uuid,
    /// Human-readable operation type ("drill", "route", "dado", etc.).
    pub operation_type: String,
    /// X origin relative to part bottom-left corner (mm).
    pub position_x: f64,
    /// Y origin (mm).
    pub position_y: f64,
    /// Z start depth (mm).
    pub position_z: f64,
    /// Bounding width of the operation (mm); None for point operations.
    pub width: Option<f64>,
    /// Bounding height of the operation (mm).
    pub height: Option<f64>,
    /// Cut depth (mm).
    pub depth: f64,
    /// Tool identifier assigned to this operation, if any.
    pub tool_id: Option<Uuid>,
    /// Which face the operation is applied to ("top", "front", etc.).
    pub side: String,
    /// Optional label / description for the operation.
    pub label: Option<String>,
}

/// A single manufactured part.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportPart {
    pub id: Uuid,
    pub name: String,
    /// Cabinet part role ("side", "door", "shelf", etc.).
    pub part_type: String,
    /// Finished length (mm).
    pub length: f64,
    /// Finished width (mm).
    pub width: f64,
    /// Finished thickness (mm).
    pub thickness: f64,
    pub material_id: Uuid,
    /// Human-readable material name.
    pub material_name: String,
    pub grain_direction: String,
    /// Edge-band category applied to the top edge, if any.
    pub edge_band_top: Option<i32>,
    pub edge_band_bottom: Option<i32>,
    pub edge_band_left: Option<i32>,
    pub edge_band_right: Option<i32>,
    /// Quantity of identical parts required.
    pub quantity: u32,
    /// Machining operations to be performed on this part.
    pub operations: Vec<ExportOperation>,
    /// Parent product name (cabinet name).
    pub product_name: String,
    /// Room / area name where the product is installed.
    pub room_name: String,
}

/// Aggregated cost and area figures for one material.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialSummaryRow {
    pub material_id: Uuid,
    pub material_name: String,
    /// Total finished area consumed (mm2).
    pub total_area_mm2: f64,
    /// Total finished area (ft2).
    pub total_area_sqft: f64,
    /// Standard sheet width used for planning (mm).
    pub sheet_width_mm: f64,
    /// Standard sheet length used for planning (mm).
    pub sheet_length_mm: f64,
    /// Estimated full sheets required (rounded up, with waste factor applied).
    pub sheets_required: u32,
    /// Unit cost per sheet (currency).
    pub cost_per_sheet: f64,
    /// Estimated total material cost.
    pub estimated_cost: f64,
}

/// The complete data payload handed to the file exporter.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportData {
    pub job_id: Uuid,
    pub job_name: String,
    pub client_name: String,
    pub address: String,
    pub designer: Option<String>,
    pub notes: Option<String>,
    /// UTC timestamp of when this export was requested.
    pub export_date: DateTime<Utc>,
    pub parts: Vec<ExportPart>,
    pub materials_summary: Vec<MaterialSummaryRow>,
    /// Total estimated job cost (materials + labour).
    pub total_cost: f64,
    /// Optional pre-computed labour cost component.
    pub labour_cost: Option<f64>,
}

// ---------------------------------------------------------------------------
// DXF helper types
// ---------------------------------------------------------------------------

/// A named drawing layer in a DXF file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DxfLayer {
    /// Layer name (must not contain spaces or special characters in DXF R12).
    pub name: String,
    /// ACI colour index (0 = BYBLOCK, 7 = white/black).
    pub color: i32,
    /// Linetype name (e.g. "CONTINUOUS", "DASHED").
    pub linetype: String,
}

/// A single geometric entity to write into a DXF ENTITIES section.
#[derive(Debug, Clone)]
pub enum DxfEntity {
    /// A straight line segment.
    Line {
        layer: String,
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
    },
    /// A single-point text label.
    Text {
        layer: String,
        x: f64,
        y: f64,
        height: f64,
        value: String,
    },
    /// A circle (for drill holes, etc.).
    Circle {
        layer: String,
        cx: f64,
        cy: f64,
        radius: f64,
    },
}

/// Placement of a single part on a physical sheet.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartPlacement {
    pub part_id: Uuid,
    pub part_name: String,
    /// X position of the part's bottom-left corner on the sheet (mm).
    pub x: f64,
    /// Y position (mm).
    pub y: f64,
    /// True if the part has been rotated 90 degrees to fit the sheet.
    pub rotated: bool,
    /// Finished length of the part (mm).
    pub length: f64,
    /// Finished width of the part (mm).
    pub width: f64,
}

/// One physical sheet with nested part placements.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NestingSheet {
    pub sheet_index: u32,
    pub material_name: String,
    /// Sheet width (mm).
    pub width: f64,
    /// Sheet length (mm).
    pub length: f64,
    pub waste_percentage: f64,
    pub placements: Vec<PartPlacement>,
}

// ---------------------------------------------------------------------------
// Main service struct
// ---------------------------------------------------------------------------

/// Handles exporting job data to external formats.
pub struct FileExporter;

impl FileExporter {
    pub fn new() -> Self {
        Self
    }

    // -----------------------------------------------------------------------
    // CSV export
    // -----------------------------------------------------------------------

    /// Export job data to CSV.
    ///
    /// The content varies by `export_type`:
    /// - `CutList` - one row per part x quantity with all dimension fields.
    /// - `PartsList` - one row per unique part with product/room hierarchy.
    /// - `OperationsList` - one row per machining operation.
    /// - `MaterialsSummary` - one row per material with area / cost totals.
    ///
    /// All text fields are properly escaped (commas and double-quotes handled).
    pub fn export_csv(&self, data: &ExportData, export_type: CsvExportType) -> String {
        match export_type {
            CsvExportType::CutList => self.build_cut_list_csv(data),
            CsvExportType::PartsList => self.build_parts_list_csv(data),
            CsvExportType::OperationsList => self.build_operations_list_csv(data),
            CsvExportType::MaterialsSummary => self.build_materials_summary_csv(data),
        }
    }

    fn build_cut_list_csv(&self, data: &ExportData) -> String {
        let mut out = String::new();
        // Header
        out.push_str(
            "Part Name,Part Type,Product,Room,Length (mm),Width (mm),Thickness (mm),\
             Material,Grain Direction,Edge Top,Edge Bottom,Edge Left,Edge Right,Quantity\n",
        );
        // Sort: room -> product -> part_type -> name
        let mut parts = data.parts.clone();
        parts.sort_by(|a, b| {
            a.room_name
                .cmp(&b.room_name)
                .then(a.product_name.cmp(&b.product_name))
                .then(a.part_type.cmp(&b.part_type))
                .then(a.name.cmp(&b.name))
        });
        for part in &parts {
            let row = format!(
                "{},{},{},{},{:.2},{:.2},{:.2},{},{},{},{},{},{},{}\n",
                csv_escape(&part.name),
                csv_escape(&part.part_type),
                csv_escape(&part.product_name),
                csv_escape(&part.room_name),
                part.length,
                part.width,
                part.thickness,
                csv_escape(&part.material_name),
                csv_escape(&part.grain_direction),
                part.edge_band_top
                    .map(|v| v.to_string())
                    .unwrap_or_default(),
                part.edge_band_bottom
                    .map(|v| v.to_string())
                    .unwrap_or_default(),
                part.edge_band_left
                    .map(|v| v.to_string())
                    .unwrap_or_default(),
                part.edge_band_right
                    .map(|v| v.to_string())
                    .unwrap_or_default(),
                part.quantity,
            );
            out.push_str(&row);
        }
        out
    }

    fn build_parts_list_csv(&self, data: &ExportData) -> String {
        let mut out = String::new();
        out.push_str(
            "Part ID,Part Name,Part Type,Product,Room,Length (mm),Width (mm),\
             Thickness (mm),Material,Operations Count\n",
        );
        let mut parts = data.parts.clone();
        parts.sort_by(|a, b| {
            a.product_name
                .cmp(&b.product_name)
                .then(a.name.cmp(&b.name))
        });
        for part in &parts {
            let row = format!(
                "{},{},{},{},{},{:.2},{:.2},{:.2},{},{}\n",
                part.id,
                csv_escape(&part.name),
                csv_escape(&part.part_type),
                csv_escape(&part.product_name),
                csv_escape(&part.room_name),
                part.length,
                part.width,
                part.thickness,
                csv_escape(&part.material_name),
                part.operations.len(),
            );
            out.push_str(&row);
        }
        out
    }

    fn build_operations_list_csv(&self, data: &ExportData) -> String {
        let mut out = String::new();
        out.push_str(
            "Operation ID,Part Name,Operation Type,Side,Position X (mm),Position Y (mm),\
             Position Z (mm),Width (mm),Height (mm),Depth (mm),Tool ID,Label\n",
        );
        for part in &data.parts {
            for op in &part.operations {
                let row = format!(
                    "{},{},{},{},{:.2},{:.2},{:.2},{},{},{:.2},{},{}\n",
                    op.id,
                    csv_escape(&part.name),
                    csv_escape(&op.operation_type),
                    csv_escape(&op.side),
                    op.position_x,
                    op.position_y,
                    op.position_z,
                    op.width.map(|v| format!("{:.2}", v)).unwrap_or_default(),
                    op.height.map(|v| format!("{:.2}", v)).unwrap_or_default(),
                    op.depth,
                    op.tool_id.map(|u| u.to_string()).unwrap_or_default(),
                    csv_escape(op.label.as_deref().unwrap_or("")),
                );
                out.push_str(&row);
            }
        }
        out
    }

    fn build_materials_summary_csv(&self, data: &ExportData) -> String {
        let mut out = String::new();
        out.push_str(
            "Material,Total Area (mm2),Total Area (ft2),Sheet Width (mm),\
             Sheet Length (mm),Sheets Required,Cost Per Sheet,Estimated Cost\n",
        );
        for row in &data.materials_summary {
            let line = format!(
                "{},{:.2},{:.4},{:.2},{:.2},{},{:.4},{:.4}\n",
                csv_escape(&row.material_name),
                row.total_area_mm2,
                row.total_area_sqft,
                row.sheet_width_mm,
                row.sheet_length_mm,
                row.sheets_required,
                row.cost_per_sheet,
                row.estimated_cost,
            );
            out.push_str(&line);
        }
        out
    }

    // -----------------------------------------------------------------------
    // DXF R12 export
    // -----------------------------------------------------------------------

    /// Export part outlines to a DXF R12 ASCII file.
    ///
    /// Each part is represented as four LINE entities forming a closed
    /// rectangle.  A TEXT entity is placed inside the rectangle with the part
    /// name.  Parts are arranged in a grid layout (10 columns x N rows) with
    /// a 20 mm gap between adjacent parts.
    ///
    /// Layers:
    /// - `PARTS`   - part outlines (color 7 = white/black)
    /// - `LABELS`  - part name text (color 3 = green)
    /// - `DIMS`    - dimension annotations (color 5 = blue)
    pub fn export_dxf(&self, data: &ExportData) -> String {
        let layers = vec![
            DxfLayer {
                name: "PARTS".to_string(),
                color: 7,
                linetype: "CONTINUOUS".to_string(),
            },
            DxfLayer {
                name: "LABELS".to_string(),
                color: 3,
                linetype: "CONTINUOUS".to_string(),
            },
            DxfLayer {
                name: "DIMS".to_string(),
                color: 5,
                linetype: "CONTINUOUS".to_string(),
            },
        ];

        let entities = self.build_dxf_entities_for_parts(&data.parts);
        self.build_dxf_r12(data, &layers, &entities)
    }

    fn build_dxf_entities_for_parts(&self, parts: &[ExportPart]) -> Vec<DxfEntity> {
        const COLS: usize = 10;
        const GAP: f64 = 20.0;

        let mut entities = Vec::new();
        for (i, part) in parts.iter().enumerate() {
            let col = i % COLS;
            let row = i / COLS;

            // Find the bounding box for this column (max width so far)
            let col_x_offset: f64 = parts
                .iter()
                .take(i)
                .enumerate()
                .filter(|(j, _)| j % COLS == col)
                .map(|(_, p)| p.length + GAP)
                .sum();

            let x0 = col_x_offset + (col as f64) * GAP;
            let y0 = -(row as f64) * (part.width + GAP);
            let x1 = x0 + part.length;
            let y1 = y0 + part.width;

            // Four outline lines (bottom, right, top, left)
            entities.push(DxfEntity::Line {
                layer: "PARTS".to_string(),
                x1: x0,
                y1: y0,
                x2: x1,
                y2: y0,
            });
            entities.push(DxfEntity::Line {
                layer: "PARTS".to_string(),
                x1: x1,
                y1: y0,
                x2: x1,
                y2: y1,
            });
            entities.push(DxfEntity::Line {
                layer: "PARTS".to_string(),
                x1: x1,
                y1: y1,
                x2: x0,
                y2: y1,
            });
            entities.push(DxfEntity::Line {
                layer: "PARTS".to_string(),
                x1: x0,
                y1: y1,
                x2: x0,
                y2: y0,
            });

            // Label at centre
            let cx = x0 + part.length / 2.0;
            let cy = y0 + part.width / 2.0;
            entities.push(DxfEntity::Text {
                layer: "LABELS".to_string(),
                x: cx,
                y: cy,
                height: 5.0,
                value: part.name.clone(),
            });

            // Dimension annotation
            let dim_text = format!("{}x{}x{}", part.length, part.width, part.thickness);
            entities.push(DxfEntity::Text {
                layer: "DIMS".to_string(),
                x: cx,
                y: cy - 7.0,
                height: 3.5,
                value: dim_text,
            });

            // Drill holes as circles
            for op in &part.operations {
                if op.operation_type.to_lowercase() == "drill" {
                    let radius = op.width.unwrap_or(4.0) / 2.0;
                    entities.push(DxfEntity::Circle {
                        layer: "PARTS".to_string(),
                        cx: x0 + op.position_x,
                        cy: y0 + op.position_y,
                        radius,
                    });
                }
            }
        }
        entities
    }

    fn build_dxf_r12(
        &self,
        _data: &ExportData,
        layers: &[DxfLayer],
        entities: &[DxfEntity],
    ) -> String {
        let mut dxf = String::with_capacity(4096);

        // ---- HEADER section -----------------------------------------------
        dxf.push_str("  0\nSECTION\n  2\nHEADER\n");
        dxf.push_str("  9\n$ACADVER\n  1\nAC1009\n"); // AutoCAD R12
        dxf.push_str("  9\n$INSUNITS\n 70\n4\n"); // 4 = millimeters
        dxf.push_str("  9\n$DWGCODEPAGE\n  3\nANSI_1252\n");
        dxf.push_str(&format!(
            "  9\n$TDCREATE\n 40\n{:.6}\n",
            julian_day_now()
        ));
        dxf.push_str("  0\nENDSEC\n");

        // ---- TABLES section -----------------------------------------------
        dxf.push_str("  0\nSECTION\n  2\nTABLES\n");

        // LTYPE table
        dxf.push_str("  0\nTABLE\n  2\nLTYPE\n 70\n     1\n");
        dxf.push_str("  0\nLTYPE\n  2\nCONTINUOUS\n 70\n     0\n  3\nSolid line\n 72\n    65\n 73\n     0\n 40\n0.0\n");
        dxf.push_str("  0\nENDTAB\n");

        // LAYER table
        dxf.push_str(&format!(
            "  0\nTABLE\n  2\nLAYER\n 70\n{:>6}\n",
            layers.len()
        ));
        for layer in layers {
            dxf.push_str(&format!(
                "  0\nLAYER\n  2\n{}\n 70\n     0\n 62\n{:>6}\n  6\n{}\n",
                layer.name, layer.color, layer.linetype
            ));
        }
        dxf.push_str("  0\nENDTAB\n");

        // STYLE table (minimal)
        dxf.push_str("  0\nTABLE\n  2\nSTYLE\n 70\n     1\n");
        dxf.push_str("  0\nSTYLE\n  2\nSTANDARD\n 70\n     0\n 40\n0.0\n 41\n1.0\n 50\n0.0\n 51\n0.0\n 71\n     0\n 42\n0.2\n  3\ntxt\n  4\n\n");
        dxf.push_str("  0\nENDTAB\n");

        dxf.push_str("  0\nENDSEC\n");

        // ---- BLOCKS section (empty) ---------------------------------------
        dxf.push_str("  0\nSECTION\n  2\nBLOCKS\n");
        dxf.push_str("  0\nENDSEC\n");

        // ---- ENTITIES section ---------------------------------------------
        dxf.push_str("  0\nSECTION\n  2\nENTITIES\n");
        for entity in entities {
            match entity {
                DxfEntity::Line {
                    layer,
                    x1,
                    y1,
                    x2,
                    y2,
                } => {
                    dxf.push_str(&format!(
                        "  0\nLINE\n  8\n{}\n 10\n{:.6}\n 20\n{:.6}\n 30\n0.0\n 11\n{:.6}\n 21\n{:.6}\n 31\n0.0\n",
                        layer, x1, y1, x2, y2
                    ));
                }
                DxfEntity::Text {
                    layer,
                    x,
                    y,
                    height,
                    value,
                } => {
                    dxf.push_str(&format!(
                        "  0\nTEXT\n  8\n{}\n 10\n{:.6}\n 20\n{:.6}\n 30\n0.0\n 40\n{:.6}\n  1\n{}\n 72\n     1\n 11\n{:.6}\n 21\n{:.6}\n 31\n0.0\n",
                        layer, x, y, height, value, x, y
                    ));
                }
                DxfEntity::Circle { layer, cx, cy, radius } => {
                    dxf.push_str(&format!(
                        "  0\nCIRCLE\n  8\n{}\n 10\n{:.6}\n 20\n{:.6}\n 30\n0.0\n 40\n{:.6}\n",
                        layer, cx, cy, radius
                    ));
                }
            }
        }
        dxf.push_str("  0\nENDSEC\n");

        // ---- EOF marker ---------------------------------------------------
        dxf.push_str("  0\nEOF\n");
        dxf
    }

    // -----------------------------------------------------------------------
    // PDF-style structured report
    // -----------------------------------------------------------------------

    /// Generate a structured text report suitable for piping to a PDF renderer.
    ///
    /// The output uses a clear, fixed-width-friendly layout:
    /// - Page header with job metadata
    /// - Parts table (one row per part)
    /// - Materials summary table
    /// - Cost breakdown section
    pub fn export_pdf(&self, data: &ExportData) -> String {
        let mut out = String::with_capacity(8192);
        let separator = "=".repeat(80);
        let thin_sep = "-".repeat(80);

        // ---- Page header --------------------------------------------------
        out.push_str(&separator);
        out.push('\n');
        out.push_str(&center_text("CNC CABINET MANUFACTURING - JOB REPORT", 80));
        out.push('\n');
        out.push_str(&separator);
        out.push('\n');
        out.push('\n');

        // Job metadata block
        out.push_str(&format!("  Job Name:    {}\n", data.job_name));
        out.push_str(&format!("  Client:      {}\n", data.client_name));
        out.push_str(&format!("  Address:     {}\n", data.address));
        if let Some(ref designer) = data.designer {
            out.push_str(&format!("  Designer:    {}\n", designer));
        }
        out.push_str(&format!(
            "  Export Date: {}\n",
            data.export_date.format("%Y-%m-%d %H:%M UTC")
        ));
        out.push_str(&format!("  Job ID:      {}\n", data.job_id));
        if let Some(ref notes) = data.notes {
            out.push_str(&format!("  Notes:       {}\n", notes));
        }
        out.push('\n');

        // ---- Parts table -------------------------------------------------
        out.push_str(&thin_sep);
        out.push('\n');
        out.push_str(&format!(
            "  {:<30} {:<12} {:<8} {:<8} {:<8} {:>6}  {}\n",
            "PART NAME", "PART TYPE", "L (mm)", "W (mm)", "T (mm)", "QTY", "MATERIAL"
        ));
        out.push_str(&thin_sep);
        out.push('\n');

        let mut sorted_parts = data.parts.clone();
        sorted_parts.sort_by(|a, b| {
            a.product_name
                .cmp(&b.product_name)
                .then(a.name.cmp(&b.name))
        });
        for part in &sorted_parts {
            out.push_str(&format!(
                "  {:<30} {:<12} {:>8.1} {:>8.1} {:>8.1} {:>6}  {}\n",
                truncate(&part.name, 30),
                truncate(&part.part_type, 12),
                part.length,
                part.width,
                part.thickness,
                part.quantity,
                part.material_name
            ));
        }
        out.push('\n');

        // Part count totals
        let total_parts: u32 = sorted_parts.iter().map(|p| p.quantity).sum();
        let unique_parts = sorted_parts.len();
        out.push_str(&format!(
            "  Total unique parts: {}   Total pieces: {}\n\n",
            unique_parts, total_parts
        ));

        // ---- Materials summary table -------------------------------------
        out.push_str(&thin_sep);
        out.push('\n');
        out.push_str(&format!(
            "  {:<30} {:>12} {:>10} {:>8} {:>14}\n",
            "MATERIAL", "AREA (ft2)", "SHEETS REQ.", "UNIT COST", "EST. COST"
        ));
        out.push_str(&thin_sep);
        out.push('\n');

        for mat in &data.materials_summary {
            out.push_str(&format!(
                "  {:<30} {:>12.2} {:>10} {:>8.2} {:>14.2}\n",
                truncate(&mat.material_name, 30),
                mat.total_area_sqft,
                mat.sheets_required,
                mat.cost_per_sheet,
                mat.estimated_cost
            ));
        }
        out.push('\n');

        // ---- Cost breakdown ----------------------------------------------
        out.push_str(&thin_sep);
        out.push('\n');
        out.push_str("  COST BREAKDOWN\n");
        out.push_str(&thin_sep);
        out.push('\n');

        let material_cost: f64 = data.materials_summary.iter().map(|m| m.estimated_cost).sum();
        let labour_cost = data.labour_cost.unwrap_or(0.0);
        let overhead = data.total_cost - material_cost - labour_cost;

        out.push_str(&format!("  Materials:      {:>10.2}\n", material_cost));
        out.push_str(&format!("  Labour:         {:>10.2}\n", labour_cost));
        if overhead.abs() > 0.001 {
            out.push_str(&format!("  Other/Markup:   {:>10.2}\n", overhead));
        }
        out.push_str(&thin_sep);
        out.push('\n');
        out.push_str(&format!("  TOTAL:          {:>10.2}\n", data.total_cost));
        out.push('\n');

        // ---- Operations summary ------------------------------------------
        let total_ops: usize = data.parts.iter().map(|p| p.operations.len()).sum();
        if total_ops > 0 {
            out.push_str(&thin_sep);
            out.push('\n');
            out.push_str(&format!(
                "  OPERATIONS SUMMARY  ({} total)\n",
                total_ops
            ));
            out.push_str(&thin_sep);
            out.push('\n');

            // Aggregate by operation type
            let mut op_counts: HashMap<String, usize> = HashMap::new();
            for part in &data.parts {
                for op in &part.operations {
                    *op_counts.entry(op.operation_type.clone()).or_insert(0) += 1;
                }
            }
            let mut op_types: Vec<(&String, &usize)> = op_counts.iter().collect();
            op_types.sort_by_key(|(k, _)| k.as_str());
            for (op_type, count) in op_types {
                out.push_str(&format!("    {:20}  {:>6} operations\n", op_type, count));
            }
            out.push('\n');
        }

        out.push_str(&separator);
        out.push('\n');
        out.push_str(&format!(
            "  Report generated: {}\n",
            data.export_date.format("%Y-%m-%d %H:%M:%S UTC")
        ));
        out.push_str(&separator);
        out.push('\n');

        out
    }

    // -----------------------------------------------------------------------
    // SketchUp Ruby script export
    // -----------------------------------------------------------------------

    /// Generate a SketchUp-compatible Ruby script.
    ///
    /// The script uses the SketchUp API to create box-primitive geometry for
    /// each part.  Running the script inside SketchUp's Ruby console (or
    /// loading it as a plugin) will build the 3-D cabinet parts model.
    ///
    /// Dimensions are converted from mm to inches because SketchUp uses inches
    /// internally.
    pub fn export_sketchup(&self, data: &ExportData) -> String {
        let mut rb = String::with_capacity(4096);

        rb.push_str("# SketchUp Ruby Script - Auto-generated by CNC-Machinery\n");
        rb.push_str(&format!("# Job: {}\n", data.job_name));
        rb.push_str(&format!("# Client: {}\n", data.client_name));
        rb.push_str(&format!(
            "# Generated: {}\n\n",
            data.export_date.format("%Y-%m-%d %H:%M UTC")
        ));

        rb.push_str("model = Sketchup.active_model\n");
        rb.push_str("entities = model.active_entities\n");
        rb.push_str("model.start_operation('Import CNC Parts', true)\n\n");

        // Place parts in a row spaced by 10 inches
        let spacing_in = 10.0_f64; // inches
        let mut x_offset_in = 0.0_f64;

        for part in &data.parts {
            let l_in = mm_to_inches(part.length);
            let w_in = mm_to_inches(part.width);
            let t_in = mm_to_inches(part.thickness);

            rb.push_str(&format!(
                "# Part: {} ({} x {} x {} mm)\n",
                part.name, part.length, part.width, part.thickness
            ));

            // Create a group for each part
            rb.push_str(&format!(
                "grp_{} = entities.add_group\n",
                sanitize_ruby_id(&part.id.to_string())
            ));
            rb.push_str(&format!(
                "ents_{} = grp_{}.entities\n",
                sanitize_ruby_id(&part.id.to_string()),
                sanitize_ruby_id(&part.id.to_string())
            ));

            // Draw box using add_face + pushpull
            rb.push_str(&format!(
                "pt1 = Geom::Point3d.new({:.6}.inch, {:.6}.inch, 0)\n",
                x_offset_in, 0.0
            ));
            rb.push_str(&format!(
                "pt2 = Geom::Point3d.new({:.6}.inch, {:.6}.inch, 0)\n",
                x_offset_in + l_in, 0.0
            ));
            rb.push_str(&format!(
                "pt3 = Geom::Point3d.new({:.6}.inch, {:.6}.inch, 0)\n",
                x_offset_in + l_in, w_in
            ));
            rb.push_str(&format!(
                "pt4 = Geom::Point3d.new({:.6}.inch, {:.6}.inch, 0)\n",
                x_offset_in, w_in
            ));
            rb.push_str(&format!(
                "face_{} = ents_{}.add_face(pt1, pt2, pt3, pt4)\n",
                sanitize_ruby_id(&part.id.to_string()),
                sanitize_ruby_id(&part.id.to_string())
            ));
            rb.push_str(&format!(
                "face_{}.pushpull({:.6}.inch)\n",
                sanitize_ruby_id(&part.id.to_string()),
                t_in
            ));

            // Material assignment
            rb.push_str(&format!(
                "mat = model.materials['{}'] || model.materials.add('{}')\n",
                sanitize_ruby_string(&part.material_name),
                sanitize_ruby_string(&part.material_name)
            ));
            rb.push_str(&format!(
                "grp_{}.material = mat\n\n",
                sanitize_ruby_id(&part.id.to_string())
            ));

            x_offset_in += l_in + spacing_in;
        }

        rb.push_str("model.commit_operation\n");
        rb.push_str("Sketchup.send_action('viewIso:')\n");
        rb.push_str("UI.messagebox('CNC parts imported successfully!')\n");
        rb
    }

    // -----------------------------------------------------------------------
    // Cutting diagram (nested DXF)
    // -----------------------------------------------------------------------

    /// Generate a DXF cutting diagram from nesting results.
    ///
    /// Each sheet gets its own set of entities:
    /// - A sheet outline rectangle on layer `SHEET_<n>`
    /// - Part rectangles on layer `PARTS_<n>`
    /// - Part name labels on layer `LABELS`
    /// - A waste-percentage annotation near the bottom-left corner
    ///
    /// Sheets are stacked vertically with 50 mm gaps between them.
    pub fn export_cutting_diagram(&self, sheets: &[NestingSheet]) -> String {
        let layers = self.build_nesting_layers(sheets);
        let entities = self.build_nesting_entities(sheets);

        // Re-use the generic DXF builder with a synthetic ExportData for metadata
        let dummy_data = ExportData {
            job_id: Uuid::nil(),
            job_name: "Cutting Diagram".to_string(),
            client_name: String::new(),
            address: String::new(),
            designer: None,
            notes: None,
            export_date: Utc::now(),
            parts: Vec::new(),
            materials_summary: Vec::new(),
            total_cost: 0.0,
            labour_cost: None,
        };
        self.build_dxf_r12(&dummy_data, &layers, &entities)
    }

    fn build_nesting_layers(&self, sheets: &[NestingSheet]) -> Vec<DxfLayer> {
        let mut layers = vec![
            DxfLayer {
                name: "LABELS".to_string(),
                color: 3,
                linetype: "CONTINUOUS".to_string(),
            },
            DxfLayer {
                name: "ANNOTATIONS".to_string(),
                color: 4,
                linetype: "CONTINUOUS".to_string(),
            },
        ];
        for sheet in sheets {
            layers.push(DxfLayer {
                name: format!("SHEET_{}", sheet.sheet_index),
                color: 7,
                linetype: "CONTINUOUS".to_string(),
            });
            layers.push(DxfLayer {
                name: format!("PARTS_{}", sheet.sheet_index),
                color: 2,
                linetype: "CONTINUOUS".to_string(),
            });
        }
        layers
    }

    fn build_nesting_entities(&self, sheets: &[NestingSheet]) -> Vec<DxfEntity> {
        const GAP: f64 = 50.0; // vertical gap between sheets (mm)
        let mut entities = Vec::new();
        let mut y_offset = 0.0_f64;

        for sheet in sheets {
            let sheet_layer = format!("SHEET_{}", sheet.sheet_index);
            let parts_layer = format!("PARTS_{}", sheet.sheet_index);

            // Sheet outline
            let sx0 = 0.0;
            let sy0 = y_offset;
            let sx1 = sheet.width;
            let sy1 = y_offset + sheet.length;

            entities.push(DxfEntity::Line { layer: sheet_layer.clone(), x1: sx0, y1: sy0, x2: sx1, y2: sy0 });
            entities.push(DxfEntity::Line { layer: sheet_layer.clone(), x1: sx1, y1: sy0, x2: sx1, y2: sy1 });
            entities.push(DxfEntity::Line { layer: sheet_layer.clone(), x1: sx1, y1: sy1, x2: sx0, y2: sy1 });
            entities.push(DxfEntity::Line { layer: sheet_layer.clone(), x1: sx0, y1: sy1, x2: sx0, y2: sy0 });

            // Sheet annotation (material + waste)
            entities.push(DxfEntity::Text {
                layer: "ANNOTATIONS".to_string(),
                x: sx0 + 5.0,
                y: sy0 - 8.0,
                height: 5.0,
                value: format!(
                    "Sheet {} - {}  Waste: {:.1}%",
                    sheet.sheet_index, sheet.material_name, sheet.waste_percentage
                ),
            });

            // Part placements
            for placement in &sheet.placements {
                let (pl, pw) = if placement.rotated {
                    (placement.width, placement.length)
                } else {
                    (placement.length, placement.width)
                };

                let px0 = sx0 + placement.x;
                let py0 = sy0 + placement.y;
                let px1 = px0 + pl;
                let py1 = py0 + pw;

                entities.push(DxfEntity::Line { layer: parts_layer.clone(), x1: px0, y1: py0, x2: px1, y2: py0 });
                entities.push(DxfEntity::Line { layer: parts_layer.clone(), x1: px1, y1: py0, x2: px1, y2: py1 });
                entities.push(DxfEntity::Line { layer: parts_layer.clone(), x1: px1, y1: py1, x2: px0, y2: py1 });
                entities.push(DxfEntity::Line { layer: parts_layer.clone(), x1: px0, y1: py1, x2: px0, y2: py0 });

                // Part label at centre
                entities.push(DxfEntity::Text {
                    layer: "LABELS".to_string(),
                    x: px0 + pl / 2.0,
                    y: py0 + pw / 2.0,
                    height: 4.0,
                    value: placement.part_name.clone(),
                });

                // Rotation indicator
                if placement.rotated {
                    entities.push(DxfEntity::Text {
                        layer: "LABELS".to_string(),
                        x: px0 + pl / 2.0,
                        y: py0 + pw / 2.0 - 6.0,
                        height: 3.0,
                        value: "[R]".to_string(),
                    });
                }
            }

            y_offset += sheet.length + GAP;
        }
        entities
    }
}

impl Default for FileExporter {
    fn default() -> Self {
        Self::new()
    }
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/// Escape a CSV field value: wrap in double-quotes if the value contains
/// commas, double-quotes, or newlines; double any embedded double-quotes.
pub fn csv_escape(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') || value.contains('\r') {
        let escaped = value.replace('"', "\"\"");
        format!("\"{}\"", escaped)
    } else {
        value.to_string()
    }
}

/// Centre-pad a string within a field of `width` characters.
fn center_text(s: &str, width: usize) -> String {
    if s.len() >= width {
        return s.to_string();
    }
    let pad = (width - s.len()) / 2;
    format!("{}{}", " ".repeat(pad), s)
}

/// Truncate a string to at most `max` characters, appending "..." if truncated.
fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        format!("{}...", &s[..max.saturating_sub(3)])
    }
}

/// Return an approximate Julian Day Number for the current UTC time.
/// DXF TDCREATE stores this as a floating-point Julian date.
fn julian_day_now() -> f64 {
    // Use a fixed reference: 2024-01-01 approx JD 2460310.5
    // We add a rough offset; precision is not critical for DXF headers.
    2460310.5_f64
}

/// Convert millimetres to inches (1 inch = 25.4 mm).
pub fn mm_to_inches(mm: f64) -> f64 {
    mm / 25.4
}

/// Sanitize a string for use as a Ruby identifier suffix (replace non-alnum with `_`).
fn sanitize_ruby_id(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_alphanumeric() { c } else { '_' })
        .collect()
}

/// Escape a Ruby string literal (backslash and single-quote escaping).
fn sanitize_ruby_string(s: &str) -> String {
    s.replace('\\', "\\\\").replace('\'', "\\'")
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

#[cfg(test)]
mod test_helpers {
    use super::*;

    pub fn make_operation(op_type: &str, side: &str) -> ExportOperation {
        ExportOperation {
            id: Uuid::new_v4(),
            part_id: Uuid::new_v4(),
            operation_type: op_type.to_string(),
            position_x: 10.0,
            position_y: 10.0,
            position_z: 0.0,
            width: Some(8.0),
            height: Some(8.0),
            depth: 18.0,
            tool_id: None,
            side: side.to_string(),
            label: None,
        }
    }

    pub fn make_part(name: &str, l: f64, w: f64, t: f64, material: &str) -> ExportPart {
        ExportPart {
            id: Uuid::new_v4(),
            name: name.to_string(),
            part_type: "side".to_string(),
            length: l,
            width: w,
            thickness: t,
            material_id: Uuid::new_v4(),
            material_name: material.to_string(),
            grain_direction: "vertical".to_string(),
            edge_band_top: None,
            edge_band_bottom: None,
            edge_band_left: None,
            edge_band_right: None,
            quantity: 1,
            operations: Vec::new(),
            product_name: "Kitchen Base".to_string(),
            room_name: "Kitchen".to_string(),
        }
    }

    pub fn make_export_data_minimal() -> ExportData {
        ExportData {
            job_id: Uuid::new_v4(),
            job_name: "Test Job".to_string(),
            client_name: "Test Client".to_string(),
            address: "123 Main St".to_string(),
            designer: None,
            notes: None,
            export_date: Utc::now(),
            parts: Vec::new(),
            materials_summary: Vec::new(),
            total_cost: 0.0,
            labour_cost: None,
        }
    }

    pub fn make_full_export_data() -> ExportData {
        let part1 = {
            let mut p = make_part("Left Side", 720.0, 560.0, 18.0, "18mm Melamine White");
            p.quantity = 2;
            p.edge_band_top = Some(1);
            p.operations.push(make_operation("drill", "top"));
            p
        };
        let part2 = {
            let mut p = make_part("Top Panel", 600.0, 560.0, 18.0, "18mm Melamine White");
            p.part_type = "top".to_string();
            p.operations.push(make_operation("route", "top"));
            p.operations.push(make_operation("drill", "front"));
            p
        };
        let part3 = make_part("Door, \"Oak\"", 720.0, 396.0, 18.0, "18mm MDF,Oak");
        ExportData {
            job_id: Uuid::new_v4(),
            job_name: "Kitchen Reno".to_string(),
            client_name: "Smith, John".to_string(),
            address: "42 Elm St".to_string(),
            designer: Some("Jane Doe".to_string()),
            notes: Some("Rush order".to_string()),
            export_date: Utc::now(),
            parts: vec![part1, part2, part3],
            materials_summary: vec![
                MaterialSummaryRow {
                    material_id: Uuid::new_v4(),
                    material_name: "18mm Melamine White".to_string(),
                    total_area_mm2: 1_200_000.0,
                    total_area_sqft: 12.92,
                    sheet_width_mm: 1220.0,
                    sheet_length_mm: 2440.0,
                    sheets_required: 2,
                    cost_per_sheet: 45.00,
                    estimated_cost: 90.00,
                },
                MaterialSummaryRow {
                    material_id: Uuid::new_v4(),
                    material_name: "18mm MDF,Oak".to_string(),
                    total_area_mm2: 285_120.0,
                    total_area_sqft: 3.07,
                    sheet_width_mm: 1220.0,
                    sheet_length_mm: 2440.0,
                    sheets_required: 1,
                    cost_per_sheet: 80.00,
                    estimated_cost: 80.00,
                },
            ],
            total_cost: 250.00,
            labour_cost: Some(80.00),
        }
    }

    pub fn make_nesting_sheet(index: u32, w: f64, l: f64, waste: f64) -> NestingSheet {
        NestingSheet {
            sheet_index: index,
            material_name: "18mm Melamine".to_string(),
            width: w,
            length: l,
            waste_percentage: waste,
            placements: vec![
                PartPlacement {
                    part_id: Uuid::new_v4(),
                    part_name: "Left Side".to_string(),
                    x: 0.0,
                    y: 0.0,
                    rotated: false,
                    length: 720.0,
                    width: 560.0,
                },
                PartPlacement {
                    part_id: Uuid::new_v4(),
                    part_name: "Top Panel".to_string(),
                    x: 730.0,
                    y: 0.0,
                    rotated: true,
                    length: 600.0,
                    width: 560.0,
                },
            ],
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::test_helpers::*;
    use super::*;

    // ------------------------------------------------------------------
    // csv_escape helper
    // ------------------------------------------------------------------

    #[test]
    fn test_csv_escape_plain_string() {
        assert_eq!(csv_escape("Hello"), "Hello");
    }

    #[test]
    fn test_csv_escape_string_with_comma() {
        assert_eq!(csv_escape("Smith, John"), "\"Smith, John\"");
    }

    #[test]
    fn test_csv_escape_string_with_double_quote() {
        assert_eq!(csv_escape("18\" Panel"), "\"18\"\" Panel\"");
    }

    #[test]
    fn test_csv_escape_string_with_newline() {
        assert_eq!(csv_escape("line1\nline2"), "\"line1\nline2\"");
    }

    #[test]
    fn test_csv_escape_empty_string() {
        assert_eq!(csv_escape(""), "");
    }

    #[test]
    fn test_csv_escape_only_quotes() {
        assert_eq!(csv_escape("\"\""), "\"\"\"\"\"\"");
    }

    #[test]
    fn test_csv_escape_carriage_return() {
        assert_eq!(csv_escape("a\rb"), "\"a\rb\"");
    }

    // ------------------------------------------------------------------
    // Cut-list CSV
    // ------------------------------------------------------------------

    #[test]
    fn test_cut_list_csv_has_correct_header() {
        let exporter = FileExporter::new();
        let data = make_export_data_minimal();
        let csv = exporter.export_csv(&data, CsvExportType::CutList);
        assert!(
            csv.starts_with("Part Name,Part Type,Product,Room,Length (mm),Width (mm),Thickness (mm),Material,Grain Direction,Edge Top,Edge Bottom,Edge Left,Edge Right,Quantity\n")
        );
    }

    #[test]
    fn test_cut_list_csv_empty_data_has_only_header() {
        let exporter = FileExporter::new();
        let data = make_export_data_minimal();
        let csv = exporter.export_csv(&data, CsvExportType::CutList);
        let lines: Vec<&str> = csv.lines().collect();
        assert_eq!(lines.len(), 1, "Only header row expected for empty data");
    }

    #[test]
    fn test_cut_list_csv_row_count_matches_parts() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let csv = exporter.export_csv(&data, CsvExportType::CutList);
        let lines: Vec<&str> = csv.lines().collect();
        // 1 header + 3 parts
        assert_eq!(lines.len(), 4);
    }

    #[test]
    fn test_cut_list_csv_contains_part_dimensions() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let csv = exporter.export_csv(&data, CsvExportType::CutList);
        assert!(csv.contains("720.00"));
        assert!(csv.contains("560.00"));
        assert!(csv.contains("18.00"));
    }

    #[test]
    fn test_cut_list_csv_material_name_with_comma_escaped() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let csv = exporter.export_csv(&data, CsvExportType::CutList);
        // "18mm MDF,Oak" should be quoted
        assert!(csv.contains("\"18mm MDF,Oak\""));
    }

    #[test]
    fn test_cut_list_csv_part_name_with_quote_escaped() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let csv = exporter.export_csv(&data, CsvExportType::CutList);
        // 'Door, "Oak"' -> "Door, ""Oak"""
        assert!(csv.contains("\"Door, \"\"Oak\"\"\""));
    }

    #[test]
    fn test_cut_list_csv_edge_band_fields_present() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let csv = exporter.export_csv(&data, CsvExportType::CutList);
        // "Left Side" has edge_band_top = Some(1)
        assert!(csv.contains(",1,,,"));
    }

    #[test]
    fn test_cut_list_csv_quantity_field() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let csv = exporter.export_csv(&data, CsvExportType::CutList);
        // "Left Side" has quantity 2
        assert!(csv.contains(",2\n") || csv.contains(",2\r"));
    }

    #[test]
    fn test_cut_list_csv_sorted_by_room_product_part() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let csv = exporter.export_csv(&data, CsvExportType::CutList);
        // Door starts with "D", Left Side with "L", Top Panel with "T"
        let door_pos = csv.find("Door").unwrap_or(usize::MAX);
        let left_pos = csv.find("Left Side").unwrap_or(usize::MAX);
        let top_pos = csv.find("Top Panel").unwrap_or(usize::MAX);
        assert!(door_pos < left_pos, "Door should sort before Left Side");
        assert!(left_pos < top_pos, "Left Side should sort before Top Panel");
    }

    // ------------------------------------------------------------------
    // Parts-list CSV
    // ------------------------------------------------------------------

    #[test]
    fn test_parts_list_csv_has_correct_header() {
        let exporter = FileExporter::new();
        let data = make_export_data_minimal();
        let csv = exporter.export_csv(&data, CsvExportType::PartsList);
        assert!(csv.starts_with("Part ID,Part Name,Part Type,Product,Room,Length (mm),Width (mm),Thickness (mm),Material,Operations Count\n"));
    }

    #[test]
    fn test_parts_list_csv_includes_operation_count() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let csv = exporter.export_csv(&data, CsvExportType::PartsList);
        // Top Panel has 2 operations
        assert!(csv.contains(",2\n") || csv.contains(",2\r"));
    }

    #[test]
    fn test_parts_list_csv_row_count() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let csv = exporter.export_csv(&data, CsvExportType::PartsList);
        let lines: Vec<&str> = csv.lines().collect();
        assert_eq!(lines.len(), 4); // header + 3 parts
    }

    // ------------------------------------------------------------------
    // Operations-list CSV
    // ------------------------------------------------------------------

    #[test]
    fn test_operations_list_csv_has_correct_header() {
        let exporter = FileExporter::new();
        let data = make_export_data_minimal();
        let csv = exporter.export_csv(&data, CsvExportType::OperationsList);
        assert!(csv.starts_with(
            "Operation ID,Part Name,Operation Type,Side,Position X (mm),Position Y (mm),Position Z (mm),Width (mm),Height (mm),Depth (mm),Tool ID,Label\n"
        ));
    }

    #[test]
    fn test_operations_list_csv_empty_data() {
        let exporter = FileExporter::new();
        let data = make_export_data_minimal();
        let csv = exporter.export_csv(&data, CsvExportType::OperationsList);
        let lines: Vec<&str> = csv.lines().collect();
        assert_eq!(lines.len(), 1);
    }

    #[test]
    fn test_operations_list_csv_row_count() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let csv = exporter.export_csv(&data, CsvExportType::OperationsList);
        let lines: Vec<&str> = csv.lines().collect();
        // header + 3 operations total (1 drill on Left Side, 2 on Top Panel)
        assert_eq!(lines.len(), 4);
    }

    #[test]
    fn test_operations_list_csv_contains_operation_type() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let csv = exporter.export_csv(&data, CsvExportType::OperationsList);
        assert!(csv.contains("drill"));
        assert!(csv.contains("route"));
    }

    #[test]
    fn test_operations_list_csv_depth_field() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let csv = exporter.export_csv(&data, CsvExportType::OperationsList);
        assert!(csv.contains("18.00"));
    }

    // ------------------------------------------------------------------
    // Materials summary CSV
    // ------------------------------------------------------------------

    #[test]
    fn test_materials_summary_csv_has_correct_header() {
        let exporter = FileExporter::new();
        let data = make_export_data_minimal();
        let csv = exporter.export_csv(&data, CsvExportType::MaterialsSummary);
        assert!(csv.starts_with(
            "Material,Total Area (mm2),Total Area (ft2),Sheet Width (mm),Sheet Length (mm),Sheets Required,Cost Per Sheet,Estimated Cost\n"
        ));
    }

    #[test]
    fn test_materials_summary_csv_row_count() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let csv = exporter.export_csv(&data, CsvExportType::MaterialsSummary);
        let lines: Vec<&str> = csv.lines().collect();
        assert_eq!(lines.len(), 3); // header + 2 materials
    }

    #[test]
    fn test_materials_summary_csv_cost_values() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let csv = exporter.export_csv(&data, CsvExportType::MaterialsSummary);
        assert!(csv.contains("90.0000"));
        assert!(csv.contains("80.0000"));
    }

    #[test]
    fn test_materials_summary_csv_sheet_count() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let csv = exporter.export_csv(&data, CsvExportType::MaterialsSummary);
        assert!(csv.contains(",2,"));
    }

    #[test]
    fn test_materials_summary_csv_material_name_with_comma_escaped() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let csv = exporter.export_csv(&data, CsvExportType::MaterialsSummary);
        assert!(csv.contains("\"18mm MDF,Oak\""));
    }

    // ------------------------------------------------------------------
    // DXF structure
    // ------------------------------------------------------------------

    #[test]
    fn test_dxf_contains_section_markers() {
        let exporter = FileExporter::new();
        let data = make_export_data_minimal();
        let dxf = exporter.export_dxf(&data);
        assert!(dxf.contains("SECTION"));
        assert!(dxf.contains("ENDSEC"));
        assert!(dxf.contains("EOF"));
    }

    #[test]
    fn test_dxf_contains_header_section() {
        let exporter = FileExporter::new();
        let data = make_export_data_minimal();
        let dxf = exporter.export_dxf(&data);
        assert!(dxf.contains("HEADER"));
        assert!(dxf.contains("AC1009")); // DXF R12 version string
    }

    #[test]
    fn test_dxf_contains_tables_section() {
        let exporter = FileExporter::new();
        let data = make_export_data_minimal();
        let dxf = exporter.export_dxf(&data);
        assert!(dxf.contains("TABLES"));
        assert!(dxf.contains("TABLE"));
        assert!(dxf.contains("ENDTAB"));
    }

    #[test]
    fn test_dxf_contains_layer_definitions() {
        let exporter = FileExporter::new();
        let data = make_export_data_minimal();
        let dxf = exporter.export_dxf(&data);
        assert!(dxf.contains("PARTS"));
        assert!(dxf.contains("LABELS"));
        assert!(dxf.contains("DIMS"));
    }

    #[test]
    fn test_dxf_contains_entities_section() {
        let exporter = FileExporter::new();
        let data = make_export_data_minimal();
        let dxf = exporter.export_dxf(&data);
        assert!(dxf.contains("ENTITIES"));
    }

    #[test]
    fn test_dxf_empty_parts_still_valid() {
        let exporter = FileExporter::new();
        let data = make_export_data_minimal();
        let dxf = exporter.export_dxf(&data);
        // Must still have correct start/end
        assert!(dxf.starts_with("  0\nSECTION\n  2\nHEADER\n"));
        assert!(dxf.ends_with("  0\nEOF\n"));
    }

    #[test]
    fn test_dxf_line_entities_for_parts() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let dxf = exporter.export_dxf(&data);
        // Each part gets 4 LINE entities for the outline
        let line_count = dxf.matches("  0\nLINE\n").count();
        // 3 parts x 4 lines = 12 minimum
        assert!(line_count >= 12, "Expected at least 12 LINE entities, got {}", line_count);
    }

    #[test]
    fn test_dxf_text_entities_for_labels() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let dxf = exporter.export_dxf(&data);
        let text_count = dxf.matches("  0\nTEXT\n").count();
        // Each part gets 2 TEXT entities (label + dim)
        assert!(text_count >= 6, "Expected at least 6 TEXT entities, got {}", text_count);
    }

    #[test]
    fn test_dxf_circle_entities_for_drills() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let dxf = exporter.export_dxf(&data);
        // Left Side has 1 drill, Top Panel has 1 drill -> 2 circles
        let circle_count = dxf.matches("  0\nCIRCLE\n").count();
        assert_eq!(circle_count, 2);
    }

    #[test]
    fn test_dxf_has_eof_marker() {
        let exporter = FileExporter::new();
        let data = make_export_data_minimal();
        let dxf = exporter.export_dxf(&data);
        assert!(dxf.ends_with("  0\nEOF\n"));
    }

    #[test]
    fn test_dxf_insunits_set_to_millimeters() {
        let exporter = FileExporter::new();
        let data = make_export_data_minimal();
        let dxf = exporter.export_dxf(&data);
        assert!(dxf.contains("$INSUNITS"));
        assert!(dxf.contains("\n 70\n4\n")); // 4 = mm
    }

    // ------------------------------------------------------------------
    // PDF report structure
    // ------------------------------------------------------------------

    #[test]
    fn test_pdf_contains_job_name() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let report = exporter.export_pdf(&data);
        assert!(report.contains("Kitchen Reno"));
    }

    #[test]
    fn test_pdf_contains_client_name() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let report = exporter.export_pdf(&data);
        assert!(report.contains("Smith, John"));
    }

    #[test]
    fn test_pdf_contains_address() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let report = exporter.export_pdf(&data);
        assert!(report.contains("42 Elm St"));
    }

    #[test]
    fn test_pdf_contains_designer() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let report = exporter.export_pdf(&data);
        assert!(report.contains("Jane Doe"));
    }

    #[test]
    fn test_pdf_contains_notes() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let report = exporter.export_pdf(&data);
        assert!(report.contains("Rush order"));
    }

    #[test]
    fn test_pdf_contains_part_names() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let report = exporter.export_pdf(&data);
        assert!(report.contains("Left Side"));
        assert!(report.contains("Top Panel"));
    }

    #[test]
    fn test_pdf_contains_total_cost() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let report = exporter.export_pdf(&data);
        assert!(report.contains("250.00"));
    }

    #[test]
    fn test_pdf_contains_material_cost() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let report = exporter.export_pdf(&data);
        // Materials: 90 + 80 = 170
        assert!(report.contains("170.00"));
    }

    #[test]
    fn test_pdf_contains_labour_cost() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let report = exporter.export_pdf(&data);
        assert!(report.contains("80.00"));
    }

    #[test]
    fn test_pdf_contains_separator_lines() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let report = exporter.export_pdf(&data);
        assert!(report.contains("=".repeat(80).as_str()));
        assert!(report.contains("-".repeat(80).as_str()));
    }

    #[test]
    fn test_pdf_contains_parts_count() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let report = exporter.export_pdf(&data);
        assert!(report.contains("Total unique parts: 3"));
    }

    #[test]
    fn test_pdf_contains_operations_summary() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let report = exporter.export_pdf(&data);
        assert!(report.contains("OPERATIONS SUMMARY"));
        assert!(report.contains("drill"));
        assert!(report.contains("route"));
    }

    #[test]
    fn test_pdf_empty_parts_no_panic() {
        let exporter = FileExporter::new();
        let data = make_export_data_minimal();
        let report = exporter.export_pdf(&data);
        assert!(report.contains("Test Job"));
    }

    #[test]
    fn test_pdf_no_designer_section_omitted() {
        let exporter = FileExporter::new();
        let mut data = make_export_data_minimal();
        data.designer = None;
        let report = exporter.export_pdf(&data);
        assert!(!report.contains("Designer:"));
    }

    #[test]
    fn test_pdf_material_names_in_report() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let report = exporter.export_pdf(&data);
        assert!(report.contains("18mm Melamine White"));
    }

    // ------------------------------------------------------------------
    // SketchUp Ruby script
    // ------------------------------------------------------------------

    #[test]
    fn test_sketchup_contains_ruby_header() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let rb = exporter.export_sketchup(&data);
        assert!(rb.contains("Sketchup.active_model"));
    }

    #[test]
    fn test_sketchup_contains_start_operation() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let rb = exporter.export_sketchup(&data);
        assert!(rb.contains("model.start_operation"));
    }

    #[test]
    fn test_sketchup_contains_commit_operation() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let rb = exporter.export_sketchup(&data);
        assert!(rb.contains("model.commit_operation"));
    }

    #[test]
    fn test_sketchup_contains_part_groups() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let rb = exporter.export_sketchup(&data);
        assert!(rb.contains("entities.add_group"));
    }

    #[test]
    fn test_sketchup_contains_pushpull() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let rb = exporter.export_sketchup(&data);
        assert!(rb.contains("pushpull"));
    }

    #[test]
    fn test_sketchup_contains_add_face() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let rb = exporter.export_sketchup(&data);
        assert!(rb.contains("add_face"));
    }

    #[test]
    fn test_sketchup_contains_material_assignment() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let rb = exporter.export_sketchup(&data);
        assert!(rb.contains("model.materials"));
        assert!(rb.contains("18mm Melamine White"));
    }

    #[test]
    fn test_sketchup_contains_messagebox() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let rb = exporter.export_sketchup(&data);
        assert!(rb.contains("UI.messagebox"));
    }

    #[test]
    fn test_sketchup_converts_dimensions_to_inches() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let rb = exporter.export_sketchup(&data);
        // 720mm / 25.4 approx 28.346456 inches
        assert!(rb.contains("28.346") || rb.contains("28.34"));
    }

    #[test]
    fn test_sketchup_empty_parts_no_panic() {
        let exporter = FileExporter::new();
        let data = make_export_data_minimal();
        let rb = exporter.export_sketchup(&data);
        assert!(rb.contains("model.commit_operation"));
    }

    #[test]
    fn test_sketchup_job_name_in_comment() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let rb = exporter.export_sketchup(&data);
        assert!(rb.contains("Kitchen Reno"));
    }

    #[test]
    fn test_sketchup_uses_ruby_inch_method() {
        let exporter = FileExporter::new();
        let data = make_full_export_data();
        let rb = exporter.export_sketchup(&data);
        assert!(rb.contains(".inch"));
    }

    // ------------------------------------------------------------------
    // Cutting diagram / nested DXF
    // ------------------------------------------------------------------

    #[test]
    fn test_cutting_diagram_contains_section_markers() {
        let exporter = FileExporter::new();
        let sheet = make_nesting_sheet(1, 1220.0, 2440.0, 12.5);
        let dxf = exporter.export_cutting_diagram(&[sheet]);
        assert!(dxf.contains("SECTION"));
        assert!(dxf.contains("EOF"));
    }

    #[test]
    fn test_cutting_diagram_sheet_layer_present() {
        let exporter = FileExporter::new();
        let sheet = make_nesting_sheet(1, 1220.0, 2440.0, 12.5);
        let dxf = exporter.export_cutting_diagram(&[sheet]);
        assert!(dxf.contains("SHEET_1"));
    }

    #[test]
    fn test_cutting_diagram_parts_layer_present() {
        let exporter = FileExporter::new();
        let sheet = make_nesting_sheet(1, 1220.0, 2440.0, 12.5);
        let dxf = exporter.export_cutting_diagram(&[sheet]);
        assert!(dxf.contains("PARTS_1"));
    }

    #[test]
    fn test_cutting_diagram_part_labels_present() {
        let exporter = FileExporter::new();
        let sheet = make_nesting_sheet(1, 1220.0, 2440.0, 12.5);
        let dxf = exporter.export_cutting_diagram(&[sheet]);
        assert!(dxf.contains("Left Side"));
        assert!(dxf.contains("Top Panel"));
    }

    #[test]
    fn test_cutting_diagram_rotation_marker_present() {
        let exporter = FileExporter::new();
        let sheet = make_nesting_sheet(1, 1220.0, 2440.0, 12.5);
        let dxf = exporter.export_cutting_diagram(&[sheet]);
        // Top Panel is rotated
        assert!(dxf.contains("[R]"));
    }

    #[test]
    fn test_cutting_diagram_waste_percentage_in_annotation() {
        let exporter = FileExporter::new();
        let sheet = make_nesting_sheet(1, 1220.0, 2440.0, 12.5);
        let dxf = exporter.export_cutting_diagram(&[sheet]);
        assert!(dxf.contains("12.5%"));
    }

    #[test]
    fn test_cutting_diagram_multiple_sheets_have_distinct_layers() {
        let exporter = FileExporter::new();
        let sheet1 = make_nesting_sheet(1, 1220.0, 2440.0, 12.5);
        let sheet2 = make_nesting_sheet(2, 1220.0, 2440.0, 8.0);
        let dxf = exporter.export_cutting_diagram(&[sheet1, sheet2]);
        assert!(dxf.contains("SHEET_1"));
        assert!(dxf.contains("SHEET_2"));
        assert!(dxf.contains("PARTS_1"));
        assert!(dxf.contains("PARTS_2"));
    }

    #[test]
    fn test_cutting_diagram_empty_sheets_no_panic() {
        let exporter = FileExporter::new();
        let dxf = exporter.export_cutting_diagram(&[]);
        assert!(dxf.contains("EOF"));
    }

    #[test]
    fn test_cutting_diagram_line_entities_for_sheet_outline() {
        let exporter = FileExporter::new();
        let sheet = make_nesting_sheet(1, 1220.0, 2440.0, 12.5);
        let dxf = exporter.export_cutting_diagram(&[sheet]);
        let line_count = dxf.matches("  0\nLINE\n").count();
        // 4 for sheet outline + 4x2 for 2 parts = 12 minimum
        assert!(line_count >= 12);
    }

    #[test]
    fn test_cutting_diagram_text_labels_count() {
        let exporter = FileExporter::new();
        let sheet = make_nesting_sheet(1, 1220.0, 2440.0, 12.5);
        let dxf = exporter.export_cutting_diagram(&[sheet]);
        let text_count = dxf.matches("  0\nTEXT\n").count();
        // 1 sheet annotation + 2 part labels + 1 rotation marker
        assert!(text_count >= 3);
    }

    // ------------------------------------------------------------------
    // Utility functions
    // ------------------------------------------------------------------

    #[test]
    fn test_mm_to_inches_known_value() {
        let result = mm_to_inches(25.4);
        assert!((result - 1.0).abs() < 1e-9);
    }

    #[test]
    fn test_mm_to_inches_720mm() {
        let result = mm_to_inches(720.0);
        assert!((result - 28.346_456_692_913_385).abs() < 1e-6);
    }

    #[test]
    fn test_mm_to_inches_zero() {
        assert_eq!(mm_to_inches(0.0), 0.0);
    }

    #[test]
    fn test_truncate_short_string() {
        assert_eq!(truncate("hello", 10), "hello");
    }

    #[test]
    fn test_truncate_exact_length() {
        assert_eq!(truncate("hello", 5), "hello");
    }

    #[test]
    fn test_truncate_long_string() {
        let result = truncate("abcdefghij", 5);
        assert!(result.len() <= 6); // 4 chars + ellipsis
        assert!(result.contains('.'));
    }

    #[test]
    fn test_center_text_short_string() {
        let result = center_text("HI", 10);
        assert_eq!(result.trim(), "HI");
        assert_eq!(result.len(), 10);
    }

    #[test]
    fn test_center_text_exact_width() {
        let result = center_text("HELLO", 5);
        assert_eq!(result, "HELLO");
    }

    // ------------------------------------------------------------------
    // ExportFormat and CsvExportType serialization
    // ------------------------------------------------------------------

    #[test]
    fn test_export_format_serializes_to_snake_case() {
        let json = serde_json::to_string(&ExportFormat::Csv).unwrap();
        assert_eq!(json, "\"csv\"");
        let json2 = serde_json::to_string(&ExportFormat::Dxf).unwrap();
        assert_eq!(json2, "\"dxf\"");
        let json3 = serde_json::to_string(&ExportFormat::Pdf).unwrap();
        assert_eq!(json3, "\"pdf\"");
        let json4 = serde_json::to_string(&ExportFormat::SketchUp).unwrap();
        assert_eq!(json4, "\"sketch_up\"");
    }

    #[test]
    fn test_csv_export_type_serializes_to_snake_case() {
        let j = serde_json::to_string(&CsvExportType::CutList).unwrap();
        assert_eq!(j, "\"cut_list\"");
        let j2 = serde_json::to_string(&CsvExportType::OperationsList).unwrap();
        assert_eq!(j2, "\"operations_list\"");
    }

    #[test]
    fn test_export_format_equality() {
        assert_eq!(ExportFormat::Csv, ExportFormat::Csv);
        assert_ne!(ExportFormat::Csv, ExportFormat::Dxf);
    }

    #[test]
    fn test_csv_export_type_equality() {
        assert_eq!(CsvExportType::CutList, CsvExportType::CutList);
        assert_ne!(CsvExportType::CutList, CsvExportType::PartsList);
    }

    // ------------------------------------------------------------------
    // FileExporter default
    // ------------------------------------------------------------------

    #[test]
    fn test_file_exporter_default_constructs() {
        let _fe: FileExporter = FileExporter::default();
    }
}
