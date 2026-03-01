use uuid::Uuid;

/// Engine that reactively propagates dimension and material changes through the
/// product-part-operation hierarchy.
pub struct PropagationEngine;

impl PropagationEngine {
    pub fn new() -> Self {
        Self
    }

    /// Triggered when a product's dimensions, style, or construction method changes.
    ///
    /// # Propagation chain (TODO):
    /// 1. Load the product with its construction method and material template.
    /// 2. Recalculate each part's dimensions using the product's formula set:
    ///    - Side height = product height - top/bottom panel thickness
    ///    - Shelf width = product width - (2 * side thickness) - clearance
    ///    - Back dimensions account for dado depth if applicable
    ///    - etc.
    /// 3. For each recalculated part, call recalculate_operations().
    /// 4. Persist updated parts to the database.
    /// 5. Invalidate any existing optimization runs for the parent job.
    pub async fn on_product_change(
        &self,
        _product_id: Uuid,
        _pool: &sqlx::PgPool,
    ) -> Result<(), String> {
        // TODO: implement product change propagation
        Ok(())
    }

    /// Triggered when a material assignment changes at job, room, or product level.
    ///
    /// # Propagation chain (TODO):
    /// 1. Resolve the new effective material for each affected part using the override hierarchy.
    /// 2. Update part thickness if the new material has a different thickness.
    /// 3. If thickness changed, re-trigger on_product_change() for affected products.
    /// 4. Propagate texture changes to rendering cache.
    pub async fn on_material_change(
        &self,
        _scope_type: &str, // "job" | "room" | "product" | "part"
        _scope_id: Uuid,
        _new_material_id: Uuid,
        _pool: &sqlx::PgPool,
    ) -> Result<(), String> {
        // TODO: implement material change propagation
        Ok(())
    }

    /// Recalculate all part dimensions for a product based on current product dimensions
    /// and the assigned construction method's placement rules.
    ///
    /// Returns a list of (part_id, new_length, new_width, new_thickness) tuples.
    pub async fn recalculate_parts(
        &self,
        _product_id: Uuid,
        _pool: &sqlx::PgPool,
    ) -> Vec<(Uuid, f64, f64, f64)> {
        // TODO: implement part dimension recalculation
        // Formula examples:
        //   side_height = product_height - top_thickness - bottom_thickness
        //   shelf_width = product_width - (2.0 * side_thickness) - shelf_clearance
        //   back_height = product_height - (2.0 * back_setback)
        vec![]
    }

    /// Recalculate all machining operations for a part based on current hardware assignments
    /// and construction method fastener specs.
    ///
    /// Returns updated operation definitions.
    pub async fn recalculate_operations(
        &self,
        _part_id: Uuid,
        _pool: &sqlx::PgPool,
    ) -> Vec<serde_json::Value> {
        // TODO: implement operation recalculation
        // Includes:
        //   - Hinge drilling patterns from hardware drilling_pattern
        //   - Drawer slide mounting holes
        //   - Confirmat/dowel/cam-lock positions from fastener_specs
        //   - Edge dado for back panel
        vec![]
    }
}

impl Default for PropagationEngine {
    fn default() -> Self {
        Self::new()
    }
}
