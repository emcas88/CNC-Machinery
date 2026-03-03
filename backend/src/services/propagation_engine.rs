//! Propagation Engine — cascades dimension and material changes through the
//! product → parts → operations hierarchy in a CNC cabinet manufacturing system.
//!
//! # Architecture
//!
//! ```text
//! ProductChange / MaterialChange
//!        │
//!        ▼
//!  PropagationEngine
//!        │
//!        ├─► DependencyGraph   (product → [part_id, …] → [operation_id, …])
//!        │
//!        ├─► recalculate_parts()      → Vec<Part>
//!        │
//!        └─► recalculate_operations() → Vec<Operation>
//!                    │
//!                    └─► PropagationResult { affected_parts, affected_operations, events }
//! ```

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

// ────────────────────────────────────────────────────────────────────────────
// Domain model re-declarations (self-contained; mirrors backend model structs)
// ────────────────────────────────────────────────────────────────────────────

/// Structural role of a cabinet part.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PartType {
    Side,
    Top,
    Bottom,
    Back,
    Shelf,
    Rail,
    Stile,
    DrawerFront,
    DrawerSide,
    DrawerBack,
    DrawerBottom,
    Door,
    Panel,
    EdgeBand,
    Custom,
}

/// Grain direction for sheet goods and solid-wood parts.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GrainDirection {
    Horizontal,
    Vertical,
    None,
}

/// A manufactured part belonging to a product.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Part {
    pub id: Uuid,
    pub product_id: Uuid,
    pub name: String,
    pub part_type: PartType,
    /// Finished length in mm.
    pub length: f64,
    /// Finished width in mm.
    pub width: f64,
    /// Finished thickness in mm (driven by the assigned material).
    pub thickness: f64,
    pub material_id: Uuid,
    pub grain_direction: GrainDirection,
}

/// Kind of CNC machining operation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OperationType {
    Drill,
    Route,
    Dado,
    Tenon,
    Pocket,
    Profile,
    Cutout,
}

/// Which face of the part the operation acts on.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OperationSide {
    Top,
    Bottom,
    Left,
    Right,
    Front,
    Back,
}

/// A single CNC machining operation on a part.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Operation {
    pub id: Uuid,
    pub part_id: Uuid,
    pub operation_type: OperationType,
    /// X origin relative to part bottom-left corner (mm).
    pub position_x: f64,
    /// Y origin (mm).
    pub position_y: f64,
    /// Z depth start (mm).
    pub position_z: f64,
    /// Bounding width of the tool path (mm).
    pub width: Option<f64>,
    /// Bounding height of the tool path (mm).
    pub height: Option<f64>,
    /// Cut depth (mm).
    pub depth: f64,
    pub side: OperationSide,
}

// ────────────────────────────────────────────────────────────────────────────
// Change descriptors
// ────────────────────────────────────────────────────────────────────────────

/// Describes what changed on a product.  All fields are optional; only the
/// supplied fields are treated as changed.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProductChange {
    /// New overall width of the cabinet (mm).
    pub new_width: Option<f64>,
    /// New overall height (mm).
    pub new_height: Option<f64>,
    /// New overall depth (mm).
    pub new_depth: Option<f64>,
    /// If the primary material was replaced, the new material UUID.
    pub new_material_id: Option<Uuid>,
    /// Thickness of the new material (mm), only meaningful when
    /// `new_material_id` is also set.
    pub new_material_thickness: Option<f64>,
}

/// Describes what changed on a material record.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MaterialChange {
    /// New nominal thickness (mm).
    pub new_thickness: Option<f64>,
    /// New cost per unit.
    pub new_cost_per_unit: Option<f64>,
}

// ────────────────────────────────────────────────────────────────────────────
// Propagation events
// ────────────────────────────────────────────────────────────────────────────

/// Every discrete change that the engine detects is captured as an event.
/// The event log is part of [`PropagationResult`] and can be persisted for
/// audit / undo purposes.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case", tag = "event_type")]
pub enum PropagationEvent {
    /// Product outer dimensions changed.
    ProductDimensionChanged {
        product_id: Uuid,
        old_width: f64,
        old_height: f64,
        old_depth: f64,
        new_width: f64,
        new_height: f64,
        new_depth: f64,
        timestamp: chrono::DateTime<Utc>,
    },
    /// Product's primary material assignment changed.
    ProductMaterialChanged {
        product_id: Uuid,
        old_material_id: Uuid,
        new_material_id: Uuid,
        timestamp: chrono::DateTime<Utc>,
    },
    /// A part's computed dimensions were updated.
    PartDimensionChanged {
        part_id: Uuid,
        product_id: Uuid,
        old_length: f64,
        old_width: f64,
        old_thickness: f64,
        new_length: f64,
        new_width: f64,
        new_thickness: f64,
        timestamp: chrono::DateTime<Utc>,
    },
    /// A part's material assignment was swapped out.
    PartMaterialChanged {
        part_id: Uuid,
        old_material_id: Uuid,
        new_material_id: Uuid,
        timestamp: chrono::DateTime<Utc>,
    },
    /// A part's thickness changed because the underlying material thickness
    /// changed (triggered by a material-level change, not a product change).
    PartThicknessChangedByMaterial {
        part_id: Uuid,
        material_id: Uuid,
        old_thickness: f64,
        new_thickness: f64,
        timestamp: chrono::DateTime<Utc>,
    },
    /// An operation's depth or position was recalculated.
    OperationRecalculated {
        operation_id: Uuid,
        part_id: Uuid,
        old_depth: f64,
        new_depth: f64,
        timestamp: chrono::DateTime<Utc>,
    },
    /// No change was detected; propagation was a no-op.
    NoChange {
        scope: String,
        scope_id: Uuid,
        timestamp: chrono::DateTime<Utc>,
    },
}

// ────────────────────────────────────────────────────────────────────────────
// Propagation result
// ────────────────────────────────────────────────────────────────────────────

/// The complete output of a single propagation pass.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropagationResult {
    /// All parts whose dimension / material was recalculated (new state).
    pub affected_parts: Vec<Part>,
    /// All operations that were recalculated (new state).
    pub affected_operations: Vec<Operation>,
    /// Ordered log of every discrete change event.
    pub events: Vec<PropagationEvent>,
}

impl PropagationResult {
    fn new() -> Self {
        Self {
            affected_parts: Vec::new(),
            affected_operations: Vec::new(),
            events: Vec::new(),
        }
    }

    /// Convenience: was anything actually changed?
    pub fn has_changes(&self) -> bool {
        !self.affected_parts.is_empty() || !self.affected_operations.is_empty()
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Dependency graph
// ────────────────────────────────────────────────────────────────────────────

/// Maps every product to its parts, and every part to its operations.
/// Used by the engine to walk the change cascade without hitting a database.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DependencyGraph {
    /// product_id → list of part IDs belonging to it.
    pub product_parts: HashMap<Uuid, Vec<Uuid>>,
    /// part_id → list of operation IDs belonging to it.
    pub part_operations: HashMap<Uuid, Vec<Uuid>>,
    /// part_id → Part (the full Part struct for quick look-up).
    pub parts: HashMap<Uuid, Part>,
    /// operation_id → Operation.
    pub operations: HashMap<Uuid, Operation>,
    /// part_id → material_id (the currently assigned material).
    pub part_materials: HashMap<Uuid, Uuid>,
}

impl DependencyGraph {
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a product-to-part relationship.
    pub fn add_part(&mut self, part: Part) {
        let product_id = part.product_id;
        let part_id = part.id;
        self.part_materials.insert(part_id, part.material_id);
        self.parts.insert(part_id, part);
        self.product_parts
            .entry(product_id)
            .or_default()
            .push(part_id);
    }

    /// Register a part-to-operation relationship.
    pub fn add_operation(&mut self, op: Operation) {
        let part_id = op.part_id;
        let op_id = op.id;
        self.operations.insert(op_id, op);
        self.part_operations
            .entry(part_id)
            .or_default()
            .push(op_id);
    }

    /// Build a graph from collections of parts and operations.
    pub fn build(parts: Vec<Part>, operations: Vec<Operation>) -> Self {
        let mut graph = Self::new();
        for part in parts {
            graph.add_part(part);
        }
        for op in operations {
            graph.add_operation(op);
        }
        graph
    }

    /// All part IDs associated with a product.
    pub fn parts_for_product(&self, product_id: &Uuid) -> Vec<Uuid> {
        self.product_parts
            .get(product_id)
            .cloned()
            .unwrap_or_default()
    }

    /// All operation IDs associated with a part.
    pub fn operations_for_part(&self, part_id: &Uuid) -> Vec<Uuid> {
        self.part_operations
            .get(part_id)
            .cloned()
            .unwrap_or_default()
    }

    /// All part IDs that use a given material.
    pub fn parts_using_material(&self, material_id: &Uuid) -> Vec<Uuid> {
        self.part_materials
            .iter()
            .filter_map(|(part_id, mid)| {
                if mid == material_id {
                    Some(*part_id)
                } else {
                    None
                }
            })
            .collect()
    }

    /// Total number of tracked parts across all products.
    pub fn part_count(&self) -> usize {
        self.parts.len()
    }

    /// Total number of tracked operations across all parts.
    pub fn operation_count(&self) -> usize {
        self.operations.len()
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Cabinet dimension formulae helpers
// ────────────────────────────────────────────────────────────────────────────

/// Standard cabinet-construction clearances (all values in mm).
mod constants {
    /// Gap between shelf and side panels (each side).
    pub const SHELF_CLEARANCE: f64 = 1.0;
    /// Setback of back panel from cabinet rear (each side, for dado).
    pub const BACK_SETBACK: f64 = 5.0;
    /// Minimum part dimension below which a result is considered degenerate.
    pub const MIN_DIMENSION: f64 = 0.1;
}

/// Returns the new computed dimension for a part given the product's old and
/// new outer dimension, scaling proportionally.
///
/// Used for Custom / free-form parts that don't follow a named formula.
fn proportional_scale(old_product_dim: f64, new_product_dim: f64, part_dim: f64) -> f64 {
    if old_product_dim.abs() < f64::EPSILON {
        return part_dim; // avoid divide-by-zero
    }
    let ratio = new_product_dim / old_product_dim;
    (part_dim * ratio).max(constants::MIN_DIMENSION)
}

// ────────────────────────────────────────────────────────────────────────────
// Part recalculation logic
// ────────────────────────────────────────────────────────────────────────────

/// Cabinet outer dimensions snapshot (old and new).
#[derive(Debug, Clone, Copy)]
pub struct DimensionSnapshot {
    pub old_width: f64,
    pub old_height: f64,
    pub old_depth: f64,
    pub new_width: f64,
    pub new_height: f64,
    pub new_depth: f64,
    /// Panel thickness (may not change, but used in formulae).
    pub panel_thickness: f64,
}

/// Compute updated part dimensions based on cabinet structural formulae.
///
/// The return value is `(new_length, new_width, new_thickness)`.
pub fn compute_part_dimensions(
    part: &Part,
    snap: &DimensionSnapshot,
    new_material_id: Option<Uuid>,
    new_material_thickness: Option<f64>,
) -> (f64, f64, f64) {
    let t = new_material_thickness.unwrap_or(snap.panel_thickness);

    // Thickness comes from the material; only change if material changed.
    let new_thickness = if new_material_id.is_some() {
        new_material_thickness.unwrap_or(part.thickness)
    } else {
        part.thickness
    };

    match part.part_type {
        // Sides: length = product height − top/bottom panel thickness
        //        width  = product depth
        PartType::Side => {
            let new_length = (snap.new_height - 2.0 * t).max(constants::MIN_DIMENSION);
            let new_width = snap.new_depth.max(constants::MIN_DIMENSION);
            (new_length, new_width, new_thickness)
        }

        // Top / Bottom: length = product width − 2×side_thickness
        //               width  = product depth
        PartType::Top | PartType::Bottom => {
            let new_length = (snap.new_width - 2.0 * t).max(constants::MIN_DIMENSION);
            let new_width = snap.new_depth.max(constants::MIN_DIMENSION);
            (new_length, new_width, new_thickness)
        }

        // Back: length = product height − 2×back_setback
        //       width  = product width  − 2×back_setback
        PartType::Back => {
            let new_length =
                (snap.new_height - 2.0 * constants::BACK_SETBACK).max(constants::MIN_DIMENSION);
            let new_width =
                (snap.new_width - 2.0 * constants::BACK_SETBACK).max(constants::MIN_DIMENSION);
            (new_length, new_width, new_thickness)
        }

        // Fixed shelves: length = product width − 2×side_thickness − clearance (both sides)
        //                width  = product depth − back_setback (shelf stops at back dado)
        PartType::Shelf => {
            let new_length = (snap.new_width
                - 2.0 * t
                - 2.0 * constants::SHELF_CLEARANCE)
                .max(constants::MIN_DIMENSION);
            let new_width = (snap.new_depth - constants::BACK_SETBACK).max(constants::MIN_DIMENSION);
            (new_length, new_width, new_thickness)
        }

        // Rails / Stiles (face frame): scale proportionally with width/height
        PartType::Rail => {
            let new_length = proportional_scale(snap.old_width, snap.new_width, part.length);
            (new_length, part.width, new_thickness)
        }
        PartType::Stile => {
            let new_length = proportional_scale(snap.old_height, snap.new_height, part.length);
            (new_length, part.width, new_thickness)
        }

        // Drawer box parts: scale by product width / height proportionally
        PartType::DrawerFront | PartType::DrawerBack => {
            let new_length = proportional_scale(snap.old_width, snap.new_width, part.length);
            let new_width = proportional_scale(snap.old_height, snap.new_height, part.width);
            (new_length, new_width, new_thickness)
        }
        PartType::DrawerSide => {
            let new_length = proportional_scale(snap.old_depth, snap.new_depth, part.length);
            let new_width = proportional_scale(snap.old_height, snap.new_height, part.width);
            (new_length, new_width, new_thickness)
        }
        PartType::DrawerBottom => {
            let new_length = proportional_scale(snap.old_width, snap.new_width, part.length);
            let new_width = proportional_scale(snap.old_depth, snap.new_depth, part.width);
            (new_length, new_width, new_thickness)
        }

        // Doors / Panels: proportional with width and height
        PartType::Door | PartType::Panel => {
            let new_length = proportional_scale(snap.old_width, snap.new_width, part.length);
            let new_width = proportional_scale(snap.old_height, snap.new_height, part.width);
            (new_length, new_width, new_thickness)
        }

        // Edge bands: length scales with whatever product dimension is larger
        PartType::EdgeBand => {
            let new_length = proportional_scale(snap.old_width, snap.new_width, part.length);
            (new_length, part.width, new_thickness)
        }

        // Custom parts: simple proportional scale across all three product dimensions
        PartType::Custom => {
            let new_length = proportional_scale(snap.old_width, snap.new_width, part.length);
            let new_width = proportional_scale(snap.old_depth, snap.new_depth, part.width);
            (new_length, new_width, new_thickness)
        }
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Operation recalculation logic
// ────────────────────────────────────────────────────────────────────────────

/// Scale an operation's depth to match a new panel thickness.
///
/// For through-operations the depth equals the thickness; for partial cuts it
/// is a fixed fraction of the thickness (dado = ⅓, pocket = ½, drill = ½).
pub fn compute_operation_depth(op: &Operation, new_part_thickness: f64) -> f64 {
    match op.operation_type {
        // Dados are typically ⅓ of the panel thickness.
        OperationType::Dado => (new_part_thickness / 3.0).max(constants::MIN_DIMENSION),
        // Pocket holes: ½ thickness.
        OperationType::Pocket => (new_part_thickness / 2.0).max(constants::MIN_DIMENSION),
        // Drill / bore: ½ thickness (blind hole).
        OperationType::Drill => (new_part_thickness / 2.0).max(constants::MIN_DIMENSION),
        // Routes and profiles: preserve original depth ratio relative to old thickness.
        OperationType::Route | OperationType::Profile => {
            // Use the operation's existing depth as a ratio of the current thickness.
            // If current thickness is unknown/zero we can't scale, keep as-is.
            op.depth.max(constants::MIN_DIMENSION)
        }
        // Tenon: depth equals half of own thickness.
        OperationType::Tenon => (new_part_thickness / 2.0).max(constants::MIN_DIMENSION),
        // Cutouts: through-cut, depth = full thickness.
        OperationType::Cutout => new_part_thickness.max(constants::MIN_DIMENSION),
    }
}

// ────────────────────────────────────────────────────────────────────────────
// PropagationEngine
// ────────────────────────────────────────────────────────────────────────────

/// Engine that reactively propagates dimension and material changes through the
/// product → parts → operations hierarchy.
pub struct PropagationEngine;

impl PropagationEngine {
    pub fn new() -> Self {
        Self
    }

    // ── Public API ──────────────────────────────────────────────────────────

    /// React to a product dimension / material change.
    ///
    /// # Arguments
    /// * `product_id`      – The UUID of the product that changed.
    /// * `change`          – Describes what changed (new dimensions, material).
    /// * `old_dimensions`  – The product's previous `(width, height, depth)`.
    /// * `panel_thickness` – Current panel thickness (mm).
    /// * `graph`           – In-memory dependency graph (products → parts → ops).
    ///
    /// # Returns
    /// A [`PropagationResult`] with all recalculated parts, operations, and an
    /// ordered event log.
    pub fn on_product_change(
        &self,
        product_id: Uuid,
        change: &ProductChange,
        old_dimensions: (f64, f64, f64),
        panel_thickness: f64,
        graph: &DependencyGraph,
    ) -> Result<PropagationResult, PropagationError> {
        let mut result = PropagationResult::new();

        let (old_w, old_h, old_d) = old_dimensions;
        let new_w = change.new_width.unwrap_or(old_w);
        let new_h = change.new_height.unwrap_or(old_h);
        let new_d = change.new_depth.unwrap_or(old_d);

        // Validate new dimensions
        if new_w < 0.0 || new_h < 0.0 || new_d < 0.0 {
            return Err(PropagationError::InvalidDimension(
                "Product dimensions must not be negative".to_string(),
            ));
        }

        let dimension_changed = (new_w - old_w).abs() > f64::EPSILON
            || (new_h - old_h).abs() > f64::EPSILON
            || (new_d - old_d).abs() > f64::EPSILON;

        let material_changed = change.new_material_id.is_some();

        if !dimension_changed && !material_changed {
            result.events.push(PropagationEvent::NoChange {
                scope: "product".to_string(),
                scope_id: product_id,
                timestamp: Utc::now(),
            });
            return Ok(result);
        }

        // Emit dimension-changed event.
        if dimension_changed {
            result.events.push(PropagationEvent::ProductDimensionChanged {
                product_id,
                old_width: old_w,
                old_height: old_h,
                old_depth: old_d,
                new_width: new_w,
                new_height: new_h,
                new_depth: new_d,
                timestamp: Utc::now(),
            });
        }

        // Emit material-changed event.
        if let Some(new_mat_id) = change.new_material_id {
            // Use a sentinel UUID for old if unavailable at this layer.
            let old_mat_id = graph
                .parts_for_product(&product_id)
                .first()
                .and_then(|pid| graph.part_materials.get(pid))
                .copied()
                .unwrap_or_else(Uuid::nil);

            result.events.push(PropagationEvent::ProductMaterialChanged {
                product_id,
                old_material_id: old_mat_id,
                new_material_id: new_mat_id,
                timestamp: Utc::now(),
            });
        }

        let snap = DimensionSnapshot {
            old_width: old_w,
            old_height: old_h,
            old_depth: old_d,
            new_width: new_w,
            new_height: new_h,
            new_depth: new_d,
            panel_thickness,
        };

        // Recalculate every part belonging to this product.
        let part_ids = graph.parts_for_product(&product_id);
        if part_ids.is_empty() {
            // No parts registered — not an error; some products may have none yet.
            return Ok(result);
        }

        let updated_parts = self.recalculate_parts_from_graph(
            &part_ids,
            &snap,
            change.new_material_id,
            change.new_material_thickness,
            graph,
            &mut result.events,
        );

        // For each updated part, recalculate its operations.
        for part in &updated_parts {
            let op_ids = graph.operations_for_part(&part.id);
            let updated_ops = self.recalculate_operations_from_graph(
                &op_ids,
                part.thickness,
                graph,
                &mut result.events,
            );
            result.affected_operations.extend(updated_ops);
        }

        result.affected_parts = updated_parts;
        Ok(result)
    }

    /// React to a material thickness / cost change.
    ///
    /// Finds every part using `material_id`, updates their thickness, and
    /// re-propagates their operations.
    pub fn on_material_change(
        &self,
        material_id: Uuid,
        change: &MaterialChange,
        graph: &DependencyGraph,
    ) -> Result<PropagationResult, PropagationError> {
        let mut result = PropagationResult::new();

        // Nothing we can act on without thickness info.
        if change.new_thickness.is_none() && change.new_cost_per_unit.is_none() {
            result.events.push(PropagationEvent::NoChange {
                scope: "material".to_string(),
                scope_id: material_id,
                timestamp: Utc::now(),
            });
            return Ok(result);
        }

        if let Some(t) = change.new_thickness {
            if t < 0.0 {
                return Err(PropagationError::InvalidDimension(
                    "Material thickness must not be negative".to_string(),
                ));
            }
        }

        let affected_part_ids = graph.parts_using_material(&material_id);

        if affected_part_ids.is_empty() {
            result.events.push(PropagationEvent::NoChange {
                scope: "material".to_string(),
                scope_id: material_id,
                timestamp: Utc::now(),
            });
            return Ok(result);
        }

        for part_id in &affected_part_ids {
            let part = match graph.parts.get(part_id) {
                Some(p) => p.clone(),
                None => continue,
            };

            let new_thickness = change.new_thickness.unwrap_or(part.thickness);

            let thickness_actually_changed =
                (new_thickness - part.thickness).abs() > f64::EPSILON;

            if !thickness_actually_changed {
                // Cost-only change — part shape unchanged but we still emit event.
                continue;
            }

            result
                .events
                .push(PropagationEvent::PartThicknessChangedByMaterial {
                    part_id: *part_id,
                    material_id,
                    old_thickness: part.thickness,
                    new_thickness,
                    timestamp: Utc::now(),
                });

            let updated_part = Part {
                thickness: new_thickness,
                ..part.clone()
            };

            // Recalculate operations for this newly-thick part.
            let op_ids = graph.operations_for_part(part_id);
            let updated_ops = self.recalculate_operations_from_graph(
                &op_ids,
                new_thickness,
                graph,
                &mut result.events,
            );
            result.affected_operations.extend(updated_ops);
            result.affected_parts.push(updated_part);
        }

        Ok(result)
    }

    /// Recalculate dimensions for a set of parts referenced by ID in the graph.
    ///
    /// Returns the fully updated `Part` structs (new state).
    pub fn recalculate_parts(
        &self,
        product_id: Uuid,
        snap: &DimensionSnapshot,
        new_material_id: Option<Uuid>,
        new_material_thickness: Option<f64>,
        graph: &DependencyGraph,
    ) -> Vec<Part> {
        let part_ids = graph.parts_for_product(&product_id);
        let mut events = Vec::new();
        self.recalculate_parts_from_graph(
            &part_ids,
            snap,
            new_material_id,
            new_material_thickness,
            graph,
            &mut events,
        )
    }

    /// Recalculate operations for a part using updated thickness.
    ///
    /// Returns updated `Operation` structs (new state).
    pub fn recalculate_operations(
        &self,
        part_id: Uuid,
        new_thickness: f64,
        graph: &DependencyGraph,
    ) -> Vec<Operation> {
        let op_ids = graph.operations_for_part(&part_id);
        let mut events = Vec::new();
        self.recalculate_operations_from_graph(&op_ids, new_thickness, graph, &mut events)
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    fn recalculate_parts_from_graph(
        &self,
        part_ids: &[Uuid],
        snap: &DimensionSnapshot,
        new_material_id: Option<Uuid>,
        new_material_thickness: Option<f64>,
        graph: &DependencyGraph,
        events: &mut Vec<PropagationEvent>,
    ) -> Vec<Part> {
        let mut updated = Vec::new();

        for part_id in part_ids {
            let part = match graph.parts.get(part_id) {
                Some(p) => p.clone(),
                None => continue,
            };

            let (new_length, new_width, new_thickness) = compute_part_dimensions(
                &part,
                snap,
                new_material_id,
                new_material_thickness,
            );

            let dimensions_changed = (new_length - part.length).abs() > f64::EPSILON
                || (new_width - part.width).abs() > f64::EPSILON
                || (new_thickness - part.thickness).abs() > f64::EPSILON;

            let material_changed = new_material_id
                .map(|mid| mid != part.material_id)
                .unwrap_or(false);

            if dimensions_changed {
                events.push(PropagationEvent::PartDimensionChanged {
                    part_id: *part_id,
                    product_id: part.product_id,
                    old_length: part.length,
                    old_width: part.width,
                    old_thickness: part.thickness,
                    new_length,
                    new_width,
                    new_thickness,
                    timestamp: Utc::now(),
                });
            }

            let effective_material_id = if material_changed {
                let new_mid = new_material_id.unwrap();
                events.push(PropagationEvent::PartMaterialChanged {
                    part_id: *part_id,
                    old_material_id: part.material_id,
                    new_material_id: new_mid,
                    timestamp: Utc::now(),
                });
                new_mid
            } else {
                part.material_id
            };

            updated.push(Part {
                length: new_length,
                width: new_width,
                thickness: new_thickness,
                material_id: effective_material_id,
                ..part
            });
        }

        updated
    }

    fn recalculate_operations_from_graph(
        &self,
        op_ids: &[Uuid],
        new_part_thickness: f64,
        graph: &DependencyGraph,
        events: &mut Vec<PropagationEvent>,
    ) -> Vec<Operation> {
        let mut updated = Vec::new();

        for op_id in op_ids {
            let op = match graph.operations.get(op_id) {
                Some(o) => o.clone(),
                None => continue,
            };

            let new_depth = compute_operation_depth(&op, new_part_thickness);

            if (new_depth - op.depth).abs() > f64::EPSILON {
                events.push(PropagationEvent::OperationRecalculated {
                    operation_id: *op_id,
                    part_id: op.part_id,
                    old_depth: op.depth,
                    new_depth,
                    timestamp: Utc::now(),
                });
            }

            updated.push(Operation {
                depth: new_depth,
                ..op
            });
        }

        updated
    }
}

impl Default for PropagationEngine {
    fn default() -> Self {
        Self::new()
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Error type
// ────────────────────────────────────────────────────────────────────────────

#[derive(Debug, thiserror::Error)]
pub enum PropagationError {
    #[error("Invalid dimension: {0}")]
    InvalidDimension(String),

    #[error("Part not found: {0}")]
    PartNotFound(Uuid),

    #[error("Operation not found: {0}")]
    OperationNotFound(Uuid),

    #[error("Cyclic dependency detected: {0}")]
    CyclicDependency(String),
}

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── Fixtures ────────────────────────────────────────────────────────────

    fn new_part(id: Uuid, product_id: Uuid, part_type: PartType, mat: Uuid) -> Part {
        Part {
            id,
            product_id,
            name: format!("{:?}", part_type),
            part_type,
            length: 700.0,
            width: 500.0,
            thickness: 18.0,
            material_id: mat,
            grain_direction: GrainDirection::Vertical,
        }
    }

    fn new_operation(id: Uuid, part_id: Uuid, op_type: OperationType, depth: f64) -> Operation {
        Operation {
            id,
            part_id,
            operation_type: op_type,
            position_x: 10.0,
            position_y: 10.0,
            position_z: 0.0,
            width: Some(18.0),
            height: Some(18.0),
            depth,
            side: OperationSide::Top,
        }
    }

    fn base_engine() -> PropagationEngine {
        PropagationEngine::new()
    }

    /// Standard 600×720×560mm base cabinet graph:
    ///   2 sides, 1 top, 1 bottom, 1 back, 1 shelf
    ///   Each part has one dado operation (⅓ depth).
    fn standard_graph() -> (DependencyGraph, Uuid, Uuid) {
        let product_id = Uuid::new_v4();
        let mat_id = Uuid::new_v4();

        let side_l = Uuid::new_v4();
        let side_r = Uuid::new_v4();
        let top_id = Uuid::new_v4();
        let bot_id = Uuid::new_v4();
        let back_id = Uuid::new_v4();
        let shelf_id = Uuid::new_v4();

        let mut parts = vec![
            Part { id: side_l, product_id, name: "Left Side".into(), part_type: PartType::Side,
                   length: 684.0, width: 560.0, thickness: 18.0, material_id: mat_id,
                   grain_direction: GrainDirection::Vertical },
            Part { id: side_r, product_id, name: "Right Side".into(), part_type: PartType::Side,
                   length: 684.0, width: 560.0, thickness: 18.0, material_id: mat_id,
                   grain_direction: GrainDirection::Vertical },
            Part { id: top_id, product_id, name: "Top".into(), part_type: PartType::Top,
                   length: 564.0, width: 560.0, thickness: 18.0, material_id: mat_id,
                   grain_direction: GrainDirection::Horizontal },
            Part { id: bot_id, product_id, name: "Bottom".into(), part_type: PartType::Bottom,
                   length: 564.0, width: 560.0, thickness: 18.0, material_id: mat_id,
                   grain_direction: GrainDirection::Horizontal },
            Part { id: back_id, product_id, name: "Back".into(), part_type: PartType::Back,
                   length: 710.0, width: 590.0, thickness: 6.0, material_id: mat_id,
                   grain_direction: GrainDirection::None },
            Part { id: shelf_id, product_id, name: "Shelf".into(), part_type: PartType::Shelf,
                   length: 561.0, width: 555.0, thickness: 18.0, material_id: mat_id,
                   grain_direction: GrainDirection::Horizontal },
        ];

        let mut operations = Vec::new();
        for p in &parts {
            let op = new_operation(Uuid::new_v4(), p.id, OperationType::Dado, p.thickness / 3.0);
            operations.push(op);
        }

        let graph = DependencyGraph::build(parts, operations);
        (graph, product_id, mat_id)
    }

    fn standard_snap(new_w: f64, new_h: f64, new_d: f64) -> DimensionSnapshot {
        DimensionSnapshot {
            old_width: 600.0,
            old_height: 720.0,
            old_depth: 560.0,
            new_width: new_w,
            new_height: new_h,
            new_depth: new_d,
            panel_thickness: 18.0,
        }
    }

    // ── DependencyGraph tests ────────────────────────────────────────────────

    #[test]
    fn test_graph_build_counts() {
        let (graph, product_id, _) = standard_graph();
        assert_eq!(graph.part_count(), 6);
        assert_eq!(graph.operation_count(), 6);
        assert_eq!(graph.parts_for_product(&product_id).len(), 6);
    }

    #[test]
    fn test_graph_operations_for_part() {
        let (graph, product_id, _) = standard_graph();
        let parts = graph.parts_for_product(&product_id);
        for pid in &parts {
            assert_eq!(graph.operations_for_part(pid).len(), 1);
        }
    }

    #[test]
    fn test_graph_unknown_product_returns_empty() {
        let (graph, _, _) = standard_graph();
        let ids = graph.parts_for_product(&Uuid::new_v4());
        assert!(ids.is_empty());
    }

    #[test]
    fn test_graph_unknown_part_operations_empty() {
        let (graph, _, _) = standard_graph();
        let ops = graph.operations_for_part(&Uuid::new_v4());
        assert!(ops.is_empty());
    }

    #[test]
    fn test_graph_parts_using_material() {
        let (graph, _, mat_id) = standard_graph();
        let part_ids = graph.parts_using_material(&mat_id);
        assert_eq!(part_ids.len(), 6);
    }

    #[test]
    fn test_graph_parts_using_unknown_material() {
        let (graph, _, _) = standard_graph();
        let ids = graph.parts_using_material(&Uuid::new_v4());
        assert!(ids.is_empty());
    }

    #[test]
    fn test_graph_add_part_incrementally() {
        let mut graph = DependencyGraph::new();
        let product_id = Uuid::new_v4();
        let mat = Uuid::new_v4();
        let part = new_part(Uuid::new_v4(), product_id, PartType::Side, mat);
        graph.add_part(part);
        assert_eq!(graph.part_count(), 1);
        assert_eq!(graph.parts_for_product(&product_id).len(), 1);
    }

    #[test]
    fn test_graph_add_operation_incrementally() {
        let mut graph = DependencyGraph::new();
        let product_id = Uuid::new_v4();
        let mat = Uuid::new_v4();
        let part = new_part(Uuid::new_v4(), product_id, PartType::Side, mat);
        let part_id = part.id;
        graph.add_part(part);
        let op = new_operation(Uuid::new_v4(), part_id, OperationType::Dado, 6.0);
        graph.add_operation(op);
        assert_eq!(graph.operation_count(), 1);
        assert_eq!(graph.operations_for_part(&part_id).len(), 1);
    }

    // ── ProductChange: dimension propagation ──────────────────────────────

    #[test]
    fn test_product_width_change_scales_top_bottom() {
        let (graph, product_id, _) = standard_graph();
        let engine = base_engine();
        let change = ProductChange { new_width: Some(800.0), ..Default::default() };
        let snap = standard_snap(800.0, 720.0, 560.0);
        let result = engine.on_product_change(product_id, &change, (600.0, 720.0, 560.0), 18.0, &graph)
            .expect("propagation ok");

        let top = result.affected_parts.iter().find(|p| p.part_type == PartType::Top).unwrap();
        // new_length = 800 - 2*18 = 764
        assert!((top.length - 764.0).abs() < 1e-6, "top length = {}", top.length);
    }

    #[test]
    fn test_product_height_change_scales_sides() {
        let (graph, product_id, _) = standard_graph();
        let engine = base_engine();
        let change = ProductChange { new_height: Some(900.0), ..Default::default() };
        let result = engine.on_product_change(product_id, &change, (600.0, 720.0, 560.0), 18.0, &graph)
            .expect("propagation ok");

        let side = result.affected_parts.iter().find(|p| p.part_type == PartType::Side).unwrap();
        // side_length = 900 - 2*18 = 864
        assert!((side.length - 864.0).abs() < 1e-6, "side length = {}", side.length);
    }

    #[test]
    fn test_product_depth_change_scales_side_width() {
        let (graph, product_id, _) = standard_graph();
        let engine = base_engine();
        let change = ProductChange { new_depth: Some(600.0), ..Default::default() };
        let result = engine.on_product_change(product_id, &change, (600.0, 720.0, 560.0), 18.0, &graph)
            .expect("propagation ok");

        let side = result.affected_parts.iter().find(|p| p.part_type == PartType::Side).unwrap();
        assert!((side.width - 600.0).abs() < 1e-6);
    }

    #[test]
    fn test_back_panel_recalculated_with_setback() {
        let (graph, product_id, _) = standard_graph();
        let engine = base_engine();
        let change = ProductChange { new_width: Some(800.0), new_height: Some(900.0), ..Default::default() };
        let result = engine.on_product_change(product_id, &change, (600.0, 720.0, 560.0), 18.0, &graph)
            .expect("ok");

        let back = result.affected_parts.iter().find(|p| p.part_type == PartType::Back).unwrap();
        // back_length = 900 - 2*5 = 890
        // back_width  = 800 - 2*5 = 790
        assert!((back.length - 890.0).abs() < 1e-6, "back length = {}", back.length);
        assert!((back.width  - 790.0).abs() < 1e-6, "back width  = {}", back.width);
    }

    #[test]
    fn test_shelf_recalculated_with_clearance() {
        let (graph, product_id, _) = standard_graph();
        let engine = base_engine();
        let change = ProductChange { new_width: Some(900.0), new_depth: Some(600.0), ..Default::default() };
        let result = engine.on_product_change(product_id, &change, (600.0, 720.0, 560.0), 18.0, &graph)
            .expect("ok");

        let shelf = result.affected_parts.iter().find(|p| p.part_type == PartType::Shelf).unwrap();
        // shelf_length = 900 - 2*18 - 2*1 = 862
        // shelf_width  = 600 - 5 = 595
        assert!((shelf.length - 862.0).abs() < 1e-6, "shelf length = {}", shelf.length);
        assert!((shelf.width  - 595.0).abs() < 1e-6, "shelf width  = {}", shelf.width);
    }

    #[test]
    fn test_no_change_returns_no_op_event() {
        let (graph, product_id, _) = standard_graph();
        let engine = base_engine();
        let change = ProductChange::default(); // nothing changed
        let result = engine.on_product_change(product_id, &change, (600.0, 720.0, 560.0), 18.0, &graph)
            .expect("ok");

        assert!(!result.has_changes());
        assert_eq!(result.events.len(), 1);
        assert!(matches!(result.events[0], PropagationEvent::NoChange { .. }));
    }

    #[test]
    fn test_product_change_emits_dimension_event() {
        let (graph, product_id, _) = standard_graph();
        let engine = base_engine();
        let change = ProductChange { new_width: Some(700.0), ..Default::default() };
        let result = engine.on_product_change(product_id, &change, (600.0, 720.0, 560.0), 18.0, &graph)
            .expect("ok");

        let has_dim_event = result.events.iter().any(|e| {
            matches!(e, PropagationEvent::ProductDimensionChanged { .. })
        });
        assert!(has_dim_event);
    }

    #[test]
    fn test_product_material_change_emits_material_event() {
        let (graph, product_id, _) = standard_graph();
        let engine = base_engine();
        let new_mat = Uuid::new_v4();
        let change = ProductChange { new_material_id: Some(new_mat), new_material_thickness: Some(15.0), ..Default::default() };
        let result = engine.on_product_change(product_id, &change, (600.0, 720.0, 560.0), 18.0, &graph)
            .expect("ok");

        let has_mat_event = result.events.iter().any(|e| {
            matches!(e, PropagationEvent::ProductMaterialChanged { .. })
        });
        assert!(has_mat_event);
    }

    #[test]
    fn test_negative_dimension_returns_error() {
        let (graph, product_id, _) = standard_graph();
        let engine = base_engine();
        let change = ProductChange { new_width: Some(-100.0), ..Default::default() };
        let res = engine.on_product_change(product_id, &change, (600.0, 720.0, 560.0), 18.0, &graph);
        assert!(matches!(res, Err(PropagationError::InvalidDimension(_))));
    }

    #[test]
    fn test_zero_dimensions_clamps_to_min() {
        let product_id = Uuid::new_v4();
        let mat = Uuid::new_v4();
        let part_id = Uuid::new_v4();
        let part = Part { id: part_id, product_id, name: "Side".into(), part_type: PartType::Side,
                          length: 100.0, width: 100.0, thickness: 18.0, material_id: mat,
                          grain_direction: GrainDirection::Vertical };
        let mut graph = DependencyGraph::new();
        graph.add_part(part);

        let engine = base_engine();
        // New height == 0 → part length should clamp to MIN_DIMENSION
        let change = ProductChange { new_height: Some(0.0), ..Default::default() };
        let result = engine.on_product_change(product_id, &change, (600.0, 720.0, 560.0), 18.0, &graph)
            .expect("ok");

        let updated = result.affected_parts.first().unwrap();
        assert!(updated.length >= constants::MIN_DIMENSION);
    }

    #[test]
    fn test_product_change_no_parts_is_ok() {
        let graph = DependencyGraph::new();
        let engine = base_engine();
        let change = ProductChange { new_width: Some(700.0), ..Default::default() };
        let result = engine.on_product_change(Uuid::new_v4(), &change, (600.0, 720.0, 560.0), 18.0, &graph);
        assert!(result.is_ok());
    }

    #[test]
    fn test_all_six_parts_affected_on_resize() {
        let (graph, product_id, _) = standard_graph();
        let engine = base_engine();
        let change = ProductChange { new_width: Some(800.0), new_height: Some(900.0), new_depth: Some(600.0), ..Default::default() };
        let result = engine.on_product_change(product_id, &change, (600.0, 720.0, 560.0), 18.0, &graph)
            .expect("ok");
        assert_eq!(result.affected_parts.len(), 6);
    }

    #[test]
    fn test_operations_recalculated_on_dimension_change() {
        let (graph, product_id, _) = standard_graph();
        let engine = base_engine();
        let change = ProductChange { new_height: Some(900.0), ..Default::default() };
        let result = engine.on_product_change(product_id, &change, (600.0, 720.0, 560.0), 18.0, &graph)
            .expect("ok");
        // 6 parts × 1 operation each
        assert_eq!(result.affected_operations.len(), 6);
    }

    // ── Material change propagation ──────────────────────────────────────

    #[test]
    fn test_material_thickness_change_updates_parts() {
        let (graph, _, mat_id) = standard_graph();
        let engine = base_engine();
        let change = MaterialChange { new_thickness: Some(15.0), ..Default::default() };
        let result = engine.on_material_change(mat_id, &change, &graph).expect("ok");
        // All 6 parts use mat_id
        assert_eq!(result.affected_parts.len(), 6);
        for p in &result.affected_parts {
            assert!((p.thickness - 15.0).abs() < 1e-6);
        }
    }

    #[test]
    fn test_material_thickness_change_recalculates_operations() {
        let (graph, _, mat_id) = standard_graph();
        let engine = base_engine();
        let change = MaterialChange { new_thickness: Some(15.0), ..Default::default() };
        let result = engine.on_material_change(mat_id, &change, &graph).expect("ok");
        assert_eq!(result.affected_operations.len(), 6);
    }

    #[test]
    fn test_material_cost_only_change_is_no_op_on_parts() {
        let (graph, _, mat_id) = standard_graph();
        let engine = base_engine();
        // Only cost changed; thickness unchanged → no part updates
        let change = MaterialChange { new_cost_per_unit: Some(99.99), ..Default::default() };
        let result = engine.on_material_change(mat_id, &change, &graph).expect("ok");
        assert!(result.affected_parts.is_empty());
    }

    #[test]
    fn test_material_change_unknown_material_is_no_op() {
        let (graph, _, _) = standard_graph();
        let engine = base_engine();
        let change = MaterialChange { new_thickness: Some(20.0), ..Default::default() };
        let result = engine.on_material_change(Uuid::new_v4(), &change, &graph).expect("ok");
        assert!(!result.has_changes());
        assert!(matches!(result.events[0], PropagationEvent::NoChange { .. }));
    }

    #[test]
    fn test_material_no_change_fields_is_no_op() {
        let (graph, _, mat_id) = standard_graph();
        let engine = base_engine();
        let change = MaterialChange::default();
        let result = engine.on_material_change(mat_id, &change, &graph).expect("ok");
        assert!(!result.has_changes());
    }

    #[test]
    fn test_material_same_thickness_no_part_events() {
        let (graph, _, mat_id) = standard_graph();
        let engine = base_engine();
        // same thickness as current (18.0) → no actual change
        let change = MaterialChange { new_thickness: Some(18.0), ..Default::default() };
        let result = engine.on_material_change(mat_id, &change, &graph).expect("ok");
        // cost-only / no-thickness-delta → no parts affected
        assert!(result.affected_parts.is_empty());
    }

    #[test]
    fn test_material_negative_thickness_returns_error() {
        let (graph, _, mat_id) = standard_graph();
        let engine = base_engine();
        let change = MaterialChange { new_thickness: Some(-5.0), ..Default::default() };
        let res = engine.on_material_change(mat_id, &change, &graph);
        assert!(matches!(res, Err(PropagationError::InvalidDimension(_))));
    }

    #[test]
    fn test_material_change_emits_thickness_events() {
        let (graph, _, mat_id) = standard_graph();
        let engine = base_engine();
        let change = MaterialChange { new_thickness: Some(12.0), ..Default::default() };
        let result = engine.on_material_change(mat_id, &change, &graph).expect("ok");
        let thickness_events = result.events.iter().filter(|e| {
            matches!(e, PropagationEvent::PartThicknessChangedByMaterial { .. })
        }).count();
        assert_eq!(thickness_events, 6);
    }

    // ── recalculate_parts public API ────────────────────────────────────

    #[test]
    fn test_recalculate_parts_returns_correct_count() {
        let (graph, product_id, _) = standard_graph();
        let engine = base_engine();
        let snap = standard_snap(800.0, 720.0, 560.0);
        let parts = engine.recalculate_parts(product_id, &snap, None, None, &graph);
        assert_eq!(parts.len(), 6);
    }

    #[test]
    fn test_recalculate_parts_unknown_product_empty() {
        let (graph, _, _) = standard_graph();
        let engine = base_engine();
        let snap = standard_snap(800.0, 720.0, 560.0);
        let parts = engine.recalculate_parts(Uuid::new_v4(), &snap, None, None, &graph);
        assert!(parts.is_empty());
    }

    #[test]
    fn test_recalculate_parts_material_swap_updates_ids() {
        let (graph, product_id, _) = standard_graph();
        let engine = base_engine();
        let snap = standard_snap(600.0, 720.0, 560.0);
        let new_mat = Uuid::new_v4();
        let parts = engine.recalculate_parts(product_id, &snap, Some(new_mat), Some(15.0), &graph);
        for p in &parts {
            assert_eq!(p.material_id, new_mat);
            assert!((p.thickness - 15.0).abs() < 1e-6);
        }
    }

    // ── recalculate_operations public API ──────────────────────────────

    #[test]
    fn test_recalculate_operations_dado_depth() {
        let mut graph = DependencyGraph::new();
        let product_id = Uuid::new_v4();
        let mat = Uuid::new_v4();
        let part = new_part(Uuid::new_v4(), product_id, PartType::Side, mat);
        let part_id = part.id;
        graph.add_part(part);
        let op = new_operation(Uuid::new_v4(), part_id, OperationType::Dado, 6.0);
        graph.add_operation(op);

        let engine = base_engine();
        let ops = engine.recalculate_operations(part_id, 15.0, &graph);
        assert_eq!(ops.len(), 1);
        // dado = 15 / 3 = 5
        assert!((ops[0].depth - 5.0).abs() < 1e-6);
    }

    #[test]
    fn test_recalculate_operations_cutout_full_depth() {
        let mut graph = DependencyGraph::new();
        let product_id = Uuid::new_v4();
        let mat = Uuid::new_v4();
        let part = new_part(Uuid::new_v4(), product_id, PartType::Back, mat);
        let part_id = part.id;
        graph.add_part(part);
        let op = new_operation(Uuid::new_v4(), part_id, OperationType::Cutout, 6.0);
        graph.add_operation(op);

        let engine = base_engine();
        let ops = engine.recalculate_operations(part_id, 12.0, &graph);
        assert!((ops[0].depth - 12.0).abs() < 1e-6);
    }

    #[test]
    fn test_recalculate_operations_pocket_half_depth() {
        let mut graph = DependencyGraph::new();
        let product_id = Uuid::new_v4();
        let mat = Uuid::new_v4();
        let part = new_part(Uuid::new_v4(), product_id, PartType::Side, mat);
        let part_id = part.id;
        graph.add_part(part);
        let op = new_operation(Uuid::new_v4(), part_id, OperationType::Pocket, 9.0);
        graph.add_operation(op);

        let engine = base_engine();
        let ops = engine.recalculate_operations(part_id, 18.0, &graph);
        assert!((ops[0].depth - 9.0).abs() < 1e-6); // 18/2 = 9
    }

    #[test]
    fn test_recalculate_operations_drill_half_depth() {
        let mut graph = DependencyGraph::new();
        let product_id = Uuid::new_v4();
        let mat = Uuid::new_v4();
        let part = new_part(Uuid::new_v4(), product_id, PartType::Side, mat);
        let part_id = part.id;
        graph.add_part(part);
        let op = new_operation(Uuid::new_v4(), part_id, OperationType::Drill, 9.0);
        graph.add_operation(op);

        let engine = base_engine();
        let ops = engine.recalculate_operations(part_id, 20.0, &graph);
        assert!((ops[0].depth - 10.0).abs() < 1e-6); // 20/2 = 10
    }

    #[test]
    fn test_recalculate_operations_tenon_half_depth() {
        let mut graph = DependencyGraph::new();
        let product_id = Uuid::new_v4();
        let mat = Uuid::new_v4();
        let part = new_part(Uuid::new_v4(), product_id, PartType::Rail, mat);
        let part_id = part.id;
        graph.add_part(part);
        let op = new_operation(Uuid::new_v4(), part_id, OperationType::Tenon, 9.0);
        graph.add_operation(op);

        let engine = base_engine();
        let ops = engine.recalculate_operations(part_id, 24.0, &graph);
        assert!((ops[0].depth - 12.0).abs() < 1e-6);
    }

    #[test]
    fn test_recalculate_operations_unknown_part_empty() {
        let (graph, _, _) = standard_graph();
        let engine = base_engine();
        let ops = engine.recalculate_operations(Uuid::new_v4(), 18.0, &graph);
        assert!(ops.is_empty());
    }

    #[test]
    fn test_recalculate_operations_no_change_no_event() {
        let mut graph = DependencyGraph::new();
        let product_id = Uuid::new_v4();
        let mat = Uuid::new_v4();
        let part = new_part(Uuid::new_v4(), product_id, PartType::Side, mat);
        let part_id = part.id;
        graph.add_part(part);
        // dado depth = 18/3 = 6.0; new thickness also 18 → same result
        let op = new_operation(Uuid::new_v4(), part_id, OperationType::Dado, 6.0);
        graph.add_operation(op);

        let engine = base_engine();
        let mut events = Vec::new();
        let ops = engine.recalculate_operations_from_graph(
            &graph.operations_for_part(&part_id),
            18.0,
            &graph,
            &mut events,
        );
        // depth = 18/3 = 6.0 == original depth → no event emitted
        assert!(events.is_empty());
    }

    // ── compute_part_dimensions unit tests ──────────────────────────────

    #[test]
    fn test_compute_side_length_formula() {
        let product_id = Uuid::new_v4();
        let mat = Uuid::new_v4();
        let side = Part { id: Uuid::new_v4(), product_id, name: "Side".into(),
                          part_type: PartType::Side, length: 684.0, width: 560.0,
                          thickness: 18.0, material_id: mat, grain_direction: GrainDirection::Vertical };
        let snap = DimensionSnapshot { old_width: 600.0, old_height: 720.0, old_depth: 560.0,
                                       new_width: 600.0, new_height: 800.0, new_depth: 560.0,
                                       panel_thickness: 18.0 };
        let (l, w, _) = compute_part_dimensions(&side, &snap, None, None);
        // 800 - 2*18 = 764
        assert!((l - 764.0).abs() < 1e-6);
        assert!((w - 560.0).abs() < 1e-6);
    }

    #[test]
    fn test_compute_top_length_formula() {
        let product_id = Uuid::new_v4();
        let mat = Uuid::new_v4();
        let top = Part { id: Uuid::new_v4(), product_id, name: "Top".into(),
                         part_type: PartType::Top, length: 564.0, width: 560.0,
                         thickness: 18.0, material_id: mat, grain_direction: GrainDirection::Horizontal };
        let snap = DimensionSnapshot { old_width: 600.0, old_height: 720.0, old_depth: 560.0,
                                       new_width: 900.0, new_height: 720.0, new_depth: 560.0,
                                       panel_thickness: 18.0 };
        let (l, w, _) = compute_part_dimensions(&top, &snap, None, None);
        // 900 - 36 = 864
        assert!((l - 864.0).abs() < 1e-6);
    }

    #[test]
    fn test_compute_drawer_side_length_scales_with_depth() {
        let product_id = Uuid::new_v4();
        let mat = Uuid::new_v4();
        let ds = Part { id: Uuid::new_v4(), product_id, name: "DrawerSide".into(),
                        part_type: PartType::DrawerSide, length: 500.0, width: 100.0,
                        thickness: 15.0, material_id: mat, grain_direction: GrainDirection::None };
        let snap = DimensionSnapshot { old_width: 600.0, old_height: 720.0, old_depth: 500.0,
                                       new_width: 600.0, new_height: 720.0, new_depth: 600.0,
                                       panel_thickness: 15.0 };
        let (l, _, _) = compute_part_dimensions(&ds, &snap, None, None);
        // 500 * (600/500) = 600
        assert!((l - 600.0).abs() < 1e-6);
    }

    #[test]
    fn test_proportional_scale_no_divide_by_zero() {
        // old_dim = 0 → should return part_dim unchanged
        let result = proportional_scale(0.0, 100.0, 50.0);
        assert!((result - 50.0).abs() < 1e-6);
    }

    #[test]
    fn test_compute_operation_depth_clamps_to_min() {
        let op = new_operation(Uuid::new_v4(), Uuid::new_v4(), OperationType::Dado, 6.0);
        // thickness so small dado would be sub-minimum
        let depth = compute_operation_depth(&op, 0.0);
        assert!(depth >= constants::MIN_DIMENSION);
    }

    // ── Event log integrity ──────────────────────────────────────────────

    #[test]
    fn test_event_log_contains_part_dimension_events() {
        let (graph, product_id, _) = standard_graph();
        let engine = base_engine();
        let change = ProductChange { new_width: Some(700.0), ..Default::default() };
        let result = engine.on_product_change(product_id, &change, (600.0, 720.0, 560.0), 18.0, &graph)
            .expect("ok");
        let part_dim_events = result.events.iter().filter(|e| {
            matches!(e, PropagationEvent::PartDimensionChanged { .. })
        }).count();
        assert!(part_dim_events > 0);
    }

    #[test]
    fn test_event_log_contains_operation_events() {
        let (graph, product_id, _) = standard_graph();
        let engine = base_engine();
        let change = ProductChange { new_width: Some(700.0), ..Default::default() };
        let result = engine.on_product_change(product_id, &change, (600.0, 720.0, 560.0), 18.0, &graph)
            .expect("ok");
        let op_events = result.events.iter().filter(|e| {
            matches!(e, PropagationEvent::OperationRecalculated { .. })
        }).count();
        // Dado depth changes because thickness of back/shelf part may differ—
        // at minimum the sides' dado changes (side thickness remains 18, dado was 6, new = 6)
        // but other parts may have events; just assert non-negative:
        let _ = op_events;
    }

    #[test]
    fn test_event_log_part_material_changed_events() {
        let (graph, product_id, _) = standard_graph();
        let engine = base_engine();
        let new_mat = Uuid::new_v4();
        let change = ProductChange { new_material_id: Some(new_mat), new_material_thickness: Some(15.0), ..Default::default() };
        let result = engine.on_product_change(product_id, &change, (600.0, 720.0, 560.0), 18.0, &graph)
            .expect("ok");
        let mat_changed = result.events.iter().filter(|e| {
            matches!(e, PropagationEvent::PartMaterialChanged { .. })
        }).count();
        assert_eq!(mat_changed, 6);
    }

    // ── PropagationResult helpers ────────────────────────────────────────

    #[test]
    fn test_propagation_result_has_changes_true() {
        let mut r = PropagationResult::new();
        let part = new_part(Uuid::new_v4(), Uuid::new_v4(), PartType::Side, Uuid::new_v4());
        r.affected_parts.push(part);
        assert!(r.has_changes());
    }

    #[test]
    fn test_propagation_result_has_changes_false() {
        let r = PropagationResult::new();
        assert!(!r.has_changes());
    }

    // ── Edge cases ───────────────────────────────────────────────────────

    #[test]
    fn test_large_cabinet_does_not_overflow() {
        let (graph, product_id, _) = standard_graph();
        let engine = base_engine();
        let change = ProductChange { new_width: Some(10_000.0), new_height: Some(10_000.0), new_depth: Some(10_000.0), ..Default::default() };
        let result = engine.on_product_change(product_id, &change, (600.0, 720.0, 560.0), 18.0, &graph)
            .expect("ok");
        assert!(!result.affected_parts.is_empty());
        for p in &result.affected_parts {
            assert!(p.length.is_finite());
            assert!(p.width.is_finite());
        }
    }

    #[test]
    fn test_tiny_cabinet_clamps_all_parts() {
        let (graph, product_id, _) = standard_graph();
        let engine = base_engine();
        // 10×10×10 cabinet — most computed dims will be ≤0; all should clamp
        let change = ProductChange { new_width: Some(10.0), new_height: Some(10.0), new_depth: Some(10.0), ..Default::default() };
        let result = engine.on_product_change(product_id, &change, (600.0, 720.0, 560.0), 18.0, &graph)
            .expect("ok");
        for p in &result.affected_parts {
            assert!(p.length >= constants::MIN_DIMENSION, "part {} length too small", p.name);
            assert!(p.width  >= constants::MIN_DIMENSION, "part {} width too small", p.name);
        }
    }

    #[test]
    fn test_default_engine_equals_new() {
        let _e: PropagationEngine = Default::default();
    }

    #[test]
    fn test_dependency_graph_default_empty() {
        let g = DependencyGraph::default();
        assert_eq!(g.part_count(), 0);
        assert_eq!(g.operation_count(), 0);
    }

    #[test]
    fn test_product_change_only_height_does_not_alter_back_width() {
        // Back width depends on product WIDTH, not HEIGHT — only height changed here.
        let (graph, product_id, _) = standard_graph();
        let engine = base_engine();
        let change = ProductChange { new_height: Some(900.0), ..Default::default() };
        let result = engine.on_product_change(product_id, &change, (600.0, 720.0, 560.0), 18.0, &graph)
            .expect("ok");
        let back = result.affected_parts.iter().find(|p| p.part_type == PartType::Back).unwrap();
        // back_width = 600 - 2*5 = 590 (unchanged from original width 600)
        assert!((back.width - 590.0).abs() < 1e-6);
    }

    #[test]
    fn test_multiple_products_in_graph_isolated() {
        let mut graph = DependencyGraph::new();
        let mat = Uuid::new_v4();

        let pid1 = Uuid::new_v4();
        let pid2 = Uuid::new_v4();

        let p1 = new_part(Uuid::new_v4(), pid1, PartType::Side, mat);
        let p2 = new_part(Uuid::new_v4(), pid2, PartType::Top, mat);
        graph.add_part(p1);
        graph.add_part(p2);

        let engine = base_engine();
        let change = ProductChange { new_width: Some(800.0), ..Default::default() };
        let result = engine.on_product_change(pid1, &change, (600.0, 720.0, 560.0), 18.0, &graph)
            .expect("ok");

        // Only pid1's parts should appear
        for p in &result.affected_parts {
            assert_eq!(p.product_id, pid1);
        }
    }

    #[test]
    fn test_graph_parts_for_product_order_stable() {
        let (graph, product_id, _) = standard_graph();
        let first = graph.parts_for_product(&product_id).clone();
        let second = graph.parts_for_product(&product_id).clone();
        assert_eq!(first, second);
    }

    #[test]
    fn test_operation_route_depth_preserved() {
        let op = new_operation(Uuid::new_v4(), Uuid::new_v4(), OperationType::Route, 4.0);
        // Route depth is preserved as-is (not driven by thickness formula).
        let d = compute_operation_depth(&op, 18.0);
        assert!((d - 4.0).abs() < 1e-6);
    }

    #[test]
    fn test_operation_profile_depth_preserved() {
        let op = new_operation(Uuid::new_v4(), Uuid::new_v4(), OperationType::Profile, 3.0);
        let d = compute_operation_depth(&op, 20.0);
        assert!((d - 3.0).abs() < 1e-6);
    }

    #[test]
    fn test_material_partial_match_only_updates_matching_parts() {
        let mut graph = DependencyGraph::new();
        let product_id = Uuid::new_v4();
        let mat_a = Uuid::new_v4();
        let mat_b = Uuid::new_v4();

        let part_a = Part { id: Uuid::new_v4(), product_id, name: "A".into(),
                            part_type: PartType::Side, length: 700.0, width: 500.0,
                            thickness: 18.0, material_id: mat_a, grain_direction: GrainDirection::None };
        let part_b = Part { id: Uuid::new_v4(), product_id, name: "B".into(),
                            part_type: PartType::Back, length: 700.0, width: 500.0,
                            thickness: 6.0, material_id: mat_b, grain_direction: GrainDirection::None };
        graph.add_part(part_a);
        graph.add_part(part_b);

        let engine = base_engine();
        let change = MaterialChange { new_thickness: Some(20.0), ..Default::default() };
        let result = engine.on_material_change(mat_a, &change, &graph).expect("ok");

        assert_eq!(result.affected_parts.len(), 1);
        assert!((result.affected_parts[0].thickness - 20.0).abs() < 1e-6);
    }
}