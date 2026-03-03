//! # Cost Calculator
//!
//! Computes material costs, labor costs, markups, and generates full quotes
//! for CNC cabinet manufacturing jobs.
//!
//! ## Design overview
//!
//! The calculator operates in three phases:
//! 1. **Material cost** – price each part's sheet-good consumption by area,
//!    applying per-material waste factors and minimum order quantities.
//! 2. **Labor cost** – price each CNC operation by type, using configurable
//!    hourly rates and per-operation time estimates.
//! 3. **Quote generation** – aggregate the above, apply a chain of markup
//!    rules (percentage, fixed, or tiered), and produce a `JobCostResult`
//!    with full line-item transparency.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

/// Unit of measurement used when pricing a material.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CostUnit {
    PerSheet,
    PerSqFt,
    PerBoardFt,
    PerLinearFt,
}

/// Pricing record for a specific material.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialPricing {
    /// Unique identifier matching the material in the job.
    pub material_id: Uuid,
    /// Human-readable material name (e.g. "18mm Melamine White").
    pub name: String,
    /// Cost per square foot of raw sheet area (USD).
    pub price_per_sqft: f64,
    /// Minimum ordered area in sq ft; if computed need is less, this is billed.
    pub min_order_sqft: f64,
    /// Waste factor as a fraction >= 0.0  (e.g. 0.15 = 15% waste).
    pub waste_factor: f64,
}

impl MaterialPricing {
    /// Create a new `MaterialPricing` record.
    ///
    /// # Panics
    /// Panics if `waste_factor` < 0 or `price_per_sqft` < 0.
    pub fn new(
        material_id: Uuid,
        name: impl Into<String>,
        price_per_sqft: f64,
        min_order_sqft: f64,
        waste_factor: f64,
    ) -> Self {
        assert!(price_per_sqft >= 0.0, "price_per_sqft must be >= 0");
        assert!(waste_factor >= 0.0, "waste_factor must be >= 0");
        assert!(min_order_sqft >= 0.0, "min_order_sqft must be >= 0");
        Self {
            material_id,
            name: name.into(),
            price_per_sqft,
            min_order_sqft,
            waste_factor,
        }
    }
}

/// Type of CNC operation performed on a part.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OperationType {
    Cut,
    Bore,
    Route,
    EdgeBand,
    Dado,
    Pocket,
    Profile,
    Drill,
    Tenon,
    Cutout,
    Custom,
}

/// Labor rate record keyed to an operation type.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaborRate {
    /// The operation this rate applies to.
    pub operation_type: OperationType,
    /// Hourly machine rate (USD).
    pub hourly_rate: f64,
    /// Fixed setup time in minutes charged once per batch (per part).
    pub setup_time_minutes: f64,
    /// Incremental machining time per operation unit in minutes.
    pub per_unit_time_minutes: f64,
}

impl LaborRate {
    /// Create a new `LaborRate`.
    ///
    /// # Panics
    /// Panics if any value is negative.
    pub fn new(
        operation_type: OperationType,
        hourly_rate: f64,
        setup_time_minutes: f64,
        per_unit_time_minutes: f64,
    ) -> Self {
        assert!(hourly_rate >= 0.0, "hourly_rate must be >= 0");
        assert!(setup_time_minutes >= 0.0, "setup_time_minutes must be >= 0");
        assert!(
            per_unit_time_minutes >= 0.0,
            "per_unit_time_minutes must be >= 0"
        );
        Self {
            operation_type,
            hourly_rate,
            setup_time_minutes,
            per_unit_time_minutes,
        }
    }

    /// Compute the total cost for `count` operations.
    pub fn compute_cost(&self, count: u32) -> f64 {
        if count == 0 {
            return 0.0;
        }
        let total_minutes = self.setup_time_minutes + self.per_unit_time_minutes * (count as f64);
        self.hourly_rate * total_minutes / 60.0
    }
}

// ---------------------------------------------------------------------------
// Markup / pricing rules
// ---------------------------------------------------------------------------

/// Discriminates how a markup rule is applied.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum MarkupKind {
    /// Add `value`% of the subtotal (e.g. `value = 20.0` -> +20%).
    Percentage { value: f64 },
    /// Add a flat dollar amount regardless of subtotal.
    Fixed { amount: f64 },
    /// Tiered percentage: each tier specifies a `threshold` and a `rate`.
    /// The tier with the *highest* threshold that is *<= subtotal* applies.
    Tiered { tiers: Vec<MarkupTier> },
}

/// A single threshold/rate pair for tiered markups.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MarkupTier {
    /// Subtotal must be >= this value for the tier to apply.
    pub threshold: f64,
    /// Markup percentage applied at this tier.
    pub rate: f64,
}

/// A named markup rule that can be applied to a subtotal.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostRule {
    /// Human-readable rule name (e.g. "Contractor overhead").
    pub name: String,
    /// Whether this rule is currently active.
    pub enabled: bool,
    /// How the rule calculates the markup.
    pub kind: MarkupKind,
}

impl CostRule {
    /// Compute the dollar amount this rule adds to `subtotal`.
    pub fn compute_markup(&self, subtotal: f64) -> f64 {
        if !self.enabled || subtotal < 0.0 {
            return 0.0;
        }
        match &self.kind {
            MarkupKind::Percentage { value } => subtotal * value / 100.0,
            MarkupKind::Fixed { amount } => *amount,
            MarkupKind::Tiered { tiers } => {
                // Find the highest threshold that is <= subtotal.
                let applicable = tiers
                    .iter()
                    .filter(|t| subtotal >= t.threshold)
                    .max_by(|a, b| a.threshold.partial_cmp(&b.threshold).unwrap());
                match applicable {
                    Some(tier) => subtotal * tier.rate / 100.0,
                    None => 0.0,
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Input data transfer objects
// ---------------------------------------------------------------------------

/// Lightweight part descriptor used as input to `calculate_material_cost`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartCostInput {
    /// Unique identifier for this part (carried through to output).
    pub part_id: Uuid,
    /// Display name for the part (e.g. "Left Side Panel").
    pub part_name: String,
    /// Material that this part is cut from.
    pub material_id: Uuid,
    /// Part finished length in **millimeters**.
    pub length_mm: f64,
    /// Part finished width in **millimeters**.
    pub width_mm: f64,
    /// How many copies of this part are needed.
    pub quantity: u32,
}

impl PartCostInput {
    /// Area of this part in **square feet** (converted from mm^2).
    pub fn area_sqft(&self) -> f64 {
        // 1 mm^2 = 1 / 92_903.04 ft^2
        self.length_mm * self.width_mm / 92_903.04
    }
}

/// Lightweight operation descriptor used as input to `calculate_labor_cost`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationCostInput {
    /// Unique identifier for this operation.
    pub operation_id: Uuid,
    /// Part this operation belongs to.
    pub part_id: Uuid,
    /// Human-readable operation description (e.g. "Drill 5mm holes").
    pub description: String,
    /// Operation classification.
    pub operation_type: OperationType,
    /// Number of times this operation is performed on a single part.
    pub count: u32,
    /// Number of parts that carry this operation (multiplier).
    pub quantity: u32,
}

// ---------------------------------------------------------------------------
// Output line items
// ---------------------------------------------------------------------------

/// One line in a material cost breakdown.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialCostLine {
    /// Part identifier this line refers to.
    pub part_id: Uuid,
    /// Part display name.
    pub part_name: String,
    /// Material name.
    pub material_name: String,
    /// Net area used by this part (sqft), before waste.
    pub area_used_sqft: f64,
    /// Gross area billed (area_used x (1 + waste_factor)).
    pub area_billed_sqft: f64,
    /// Waste percentage expressed as 0-100.
    pub waste_percentage: f64,
    /// Dollar cost for this line item.
    pub cost: f64,
}

/// One line in a labor cost breakdown.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaborCostLine {
    /// Operation identifier.
    pub operation_id: Uuid,
    /// Part identifier.
    pub part_id: Uuid,
    /// Human-readable description.
    pub description: String,
    /// Operation type classification.
    pub operation_type: OperationType,
    /// Total number of individual operation executions (count x quantity).
    pub total_operations: u32,
    /// Total machine time in minutes.
    pub total_minutes: f64,
    /// Dollar cost for this line.
    pub cost: f64,
}

/// A single named line item in a quote (material, labor, markup, etc.).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuoteLineItem {
    /// Category: "material", "labor", "markup", "hardware", etc.
    pub category: String,
    /// Human-readable description.
    pub description: String,
    /// Dollar amount for this line.
    pub amount: f64,
    /// Optional breakdown notes (e.g. "20% x $1,200.00").
    pub note: Option<String>,
}

// ---------------------------------------------------------------------------
// Top-level result
// ---------------------------------------------------------------------------

/// Full cost calculation result for a job.
#[derive(Debug, Serialize, Deserialize)]
pub struct JobCostResult {
    /// Material cost detail, one line per part.
    pub material_lines: Vec<MaterialCostLine>,
    /// Labor cost detail, one line per operation type per part.
    pub labor_lines: Vec<LaborCostLine>,
    /// Flat list of every line item (materials + labor + markups).
    pub quote_lines: Vec<QuoteLineItem>,
    /// Per-part total cost (part_id -> cost).
    pub per_part_cost: HashMap<Uuid, f64>,
    /// Sum of all material costs before markup.
    pub material_total: f64,
    /// Sum of all labor costs before markup.
    pub labor_total: f64,
    /// Sum of markup amounts.
    pub markup_total: f64,
    /// material_total + labor_total + markup_total.
    pub grand_total: f64,
    /// Timestamp at which this quote was generated.
    pub generated_at: DateTime<Utc>,
    /// Quote reference number, if provided.
    pub quote_number: Option<String>,
}

// ---------------------------------------------------------------------------
// CostCalculator
// ---------------------------------------------------------------------------

/// Calculates material costs, labor costs, applies markup rules, and generates
/// complete quotes for CNC cabinet manufacturing jobs.
pub struct CostCalculator {
    /// Material pricing table, keyed by `material_id`.
    pub material_pricing: HashMap<Uuid, MaterialPricing>,
    /// Labor rate table, keyed by `OperationType`.
    pub labor_rates: HashMap<OperationType, LaborRate>,
    /// Default labor rate (USD/hr) used when no specific rate is configured.
    pub default_labor_rate: f64,
    /// Default per-operation time (minutes) when no specific rate is configured.
    pub default_per_unit_minutes: f64,
}

impl CostCalculator {
    // -----------------------------------------------------------------------
    // Construction helpers
    // -----------------------------------------------------------------------

    /// Create a `CostCalculator` with empty pricing tables and given defaults.
    pub fn new(default_labor_rate: f64, default_per_unit_minutes: f64) -> Self {
        Self {
            material_pricing: HashMap::new(),
            labor_rates: HashMap::new(),
            default_labor_rate,
            default_per_unit_minutes,
        }
    }

    /// Register a material pricing record.
    pub fn add_material_pricing(&mut self, pricing: MaterialPricing) {
        self.material_pricing.insert(pricing.material_id, pricing);
    }

    /// Register a labor rate record.
    pub fn add_labor_rate(&mut self, rate: LaborRate) {
        self.labor_rates.insert(rate.operation_type.clone(), rate);
    }

    // -----------------------------------------------------------------------
    // Material cost
    // -----------------------------------------------------------------------

    /// Calculate material cost for a list of parts.
    ///
    /// For each part:
    /// 1. Look up `MaterialPricing` by `material_id`.  If not found, the part
    ///    is skipped (zero cost).
    /// 2. Compute net area = `length_mm x width_mm x quantity` (converted to sqft).
    /// 3. Apply waste factor: gross_area = net_area x (1 + waste_factor).
    /// 4. Enforce minimum order: billed_area = max(gross_area, min_order_sqft).
    /// 5. cost = billed_area x price_per_sqft.
    ///
    /// Returns one `MaterialCostLine` per `PartCostInput` that has a matching
    /// `MaterialPricing`.
    pub fn calculate_material_cost(&self, parts: &[PartCostInput]) -> Vec<MaterialCostLine> {
        let mut lines = Vec::with_capacity(parts.len());
        for part in parts {
            let pricing = match self.material_pricing.get(&part.material_id) {
                Some(p) => p,
                None => continue,
            };
            if part.quantity == 0 {
                continue;
            }
            let net_area = part.area_sqft() * (part.quantity as f64);
            let gross_area = net_area * (1.0 + pricing.waste_factor);
            let billed_area = gross_area.max(pricing.min_order_sqft);
            let cost = billed_area * pricing.price_per_sqft;

            lines.push(MaterialCostLine {
                part_id: part.part_id,
                part_name: part.part_name.clone(),
                material_name: pricing.name.clone(),
                area_used_sqft: net_area,
                area_billed_sqft: billed_area,
                waste_percentage: pricing.waste_factor * 100.0,
                cost,
            });
        }
        lines
    }

    // -----------------------------------------------------------------------
    // Labor cost
    // -----------------------------------------------------------------------

    /// Calculate labor cost for a list of operations.
    ///
    /// For each operation:
    /// 1. Look up `LaborRate` by `operation_type`; fall back to the calculator's
    ///    default rate if not found.
    /// 2. total_ops = `count x quantity`.
    /// 3. total_minutes = setup_time + per_unit_time x total_ops.
    /// 4. cost = hourly_rate x total_minutes / 60.
    ///
    /// Returns one `LaborCostLine` per `OperationCostInput`.
    pub fn calculate_labor_cost(&self, operations: &[OperationCostInput]) -> Vec<LaborCostLine> {
        let mut lines = Vec::with_capacity(operations.len());
        for op in operations {
            let total_ops = op.count * op.quantity;
            let (hourly_rate, setup_time, per_unit_time) =
                if let Some(rate) = self.labor_rates.get(&op.operation_type) {
                    (
                        rate.hourly_rate,
                        rate.setup_time_minutes,
                        rate.per_unit_time_minutes,
                    )
                } else {
                    (self.default_labor_rate, 0.0, self.default_per_unit_minutes)
                };

            let total_minutes = if total_ops == 0 {
                0.0
            } else {
                setup_time + per_unit_time * (total_ops as f64)
            };
            let cost = hourly_rate * total_minutes / 60.0;

            lines.push(LaborCostLine {
                operation_id: op.operation_id,
                part_id: op.part_id,
                description: op.description.clone(),
                operation_type: op.operation_type.clone(),
                total_operations: total_ops,
                total_minutes,
                cost,
            });
        }
        lines
    }

    // -----------------------------------------------------------------------
    // Markup application
    // -----------------------------------------------------------------------

    /// Apply a single percentage markup to a subtotal.
    ///
    /// This is the original one-liner from the stub, preserved verbatim.
    pub fn apply_markups(&self, subtotal: f64, markup_pct: f64) -> f64 {
        subtotal * (1.0 + markup_pct / 100.0)
    }

    /// Apply an ordered list of `CostRule`s to a subtotal and return the
    /// dollar total of all markup amounts combined.
    ///
    /// Rules are applied sequentially; each rule operates on the *original*
    /// subtotal (not the running total), so rule order only affects the
    /// *description* not the final mathematics when rules are additive.
    pub fn apply_cost_rules(&self, subtotal: f64, rules: &[CostRule]) -> f64 {
        rules.iter().map(|r| r.compute_markup(subtotal)).sum()
    }

    // -----------------------------------------------------------------------
    // Quote generation
    // -----------------------------------------------------------------------

    /// Orchestrate full quote: compute material costs, labor costs, apply
    /// markup rules, and return a `JobCostResult` with complete line items and
    /// per-part cost breakdown.
    ///
    /// `markup_rules` is applied after all subtotals are summed.
    /// If `markup_rules` is empty a 0% markup is assumed.
    pub fn generate_quote(
        &self,
        parts: &[PartCostInput],
        operations: &[OperationCostInput],
        markup_rules: &[CostRule],
        quote_number: Option<String>,
    ) -> JobCostResult {
        // --- Phase 1: material costs ----------------------------------------
        let material_lines = self.calculate_material_cost(parts);
        let material_total: f64 = material_lines.iter().map(|l| l.cost).sum();

        // --- Phase 2: labor costs --------------------------------------------
        let labor_lines = self.calculate_labor_cost(operations);
        let labor_total: f64 = labor_lines.iter().map(|l| l.cost).sum();

        // --- Phase 3: markups ------------------------------------------------
        let subtotal = material_total + labor_total;
        let markup_total = self.apply_cost_rules(subtotal, markup_rules);
        let grand_total = subtotal + markup_total;

        // --- Phase 4: quote line items (summary view) -----------------------
        let mut quote_lines: Vec<QuoteLineItem> = Vec::new();

        // Material summary lines
        for ml in &material_lines {
            quote_lines.push(QuoteLineItem {
                category: "material".to_string(),
                description: format!("{} -- {}", ml.part_name, ml.material_name),
                amount: ml.cost,
                note: Some(format!(
                    "{:.3} sqft billed ({:.1}% waste)",
                    ml.area_billed_sqft, ml.waste_percentage
                )),
            });
        }

        // Labor summary lines
        for ll in &labor_lines {
            quote_lines.push(QuoteLineItem {
                category: "labor".to_string(),
                description: ll.description.clone(),
                amount: ll.cost,
                note: Some(format!("{:.1} min", ll.total_minutes)),
            });
        }

        // Markup lines
        for rule in markup_rules {
            if !rule.enabled {
                continue;
            }
            let amount = rule.compute_markup(subtotal);
            let note = match &rule.kind {
                MarkupKind::Percentage { value } => {
                    Some(format!("{:.1}% x ${:.2}", value, subtotal))
                }
                MarkupKind::Fixed { amount: _ } => Some("Fixed charge".to_string()),
                MarkupKind::Tiered { tiers: _ } => Some(format!("Tiered on ${:.2}", subtotal)),
            };
            quote_lines.push(QuoteLineItem {
                category: "markup".to_string(),
                description: rule.name.clone(),
                amount,
                note,
            });
        }

        // --- Phase 5: per-part cost breakdown --------------------------------
        let mut per_part_cost: HashMap<Uuid, f64> = HashMap::new();

        // Accumulate material cost per part
        for ml in &material_lines {
            *per_part_cost.entry(ml.part_id).or_insert(0.0) += ml.cost;
        }

        // Accumulate labor cost per part (keyed by part_id on the operation)
        for ll in &labor_lines {
            *per_part_cost.entry(ll.part_id).or_insert(0.0) += ll.cost;
        }

        JobCostResult {
            material_lines,
            labor_lines,
            quote_lines,
            per_part_cost,
            material_total,
            labor_total,
            markup_total,
            grand_total,
            generated_at: Utc::now(),
            quote_number,
        }
    }
}

// ---------------------------------------------------------------------------
// Default convenience builder
// ---------------------------------------------------------------------------

/// Build a `CostCalculator` pre-loaded with sensible default labor rates for
/// common CNC cabinet operations.
pub fn default_cost_calculator() -> CostCalculator {
    let mut calc = CostCalculator::new(65.0, 2.0);

    let rates = vec![
        LaborRate::new(OperationType::Cut, 85.0, 1.0, 1.5),
        LaborRate::new(OperationType::Bore, 75.0, 0.5, 0.8),
        LaborRate::new(OperationType::Route, 90.0, 2.0, 3.0),
        LaborRate::new(OperationType::EdgeBand, 60.0, 1.0, 2.0),
        LaborRate::new(OperationType::Dado, 85.0, 1.5, 2.5),
        LaborRate::new(OperationType::Pocket, 80.0, 1.0, 2.0),
        LaborRate::new(OperationType::Profile, 95.0, 2.5, 4.0),
        LaborRate::new(OperationType::Drill, 70.0, 0.5, 0.7),
        LaborRate::new(OperationType::Tenon, 90.0, 2.0, 3.5),
        LaborRate::new(OperationType::Cutout, 85.0, 1.5, 2.0),
        LaborRate::new(OperationType::Custom, 75.0, 1.0, 2.0),
    ];
    for r in rates {
        calc.add_labor_rate(r);
    }
    calc
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // Floating-point comparison helper macro (avoids external `approx` crate).
    macro_rules! assert_approx {
        ($a:expr, $b:expr) => {
            let a = $a as f64;
            let b = $b as f64;
            assert!(
                (a - b).abs() < 1e-6,
                "assert_approx!({} approx {}) failed: |{} - {}| = {}",
                stringify!($a),
                stringify!($b),
                a,
                b,
                (a - b).abs()
            );
        };
        ($a:expr, $b:expr, $eps:expr) => {
            let a = $a as f64;
            let b = $b as f64;
            let eps = $eps as f64;
            assert!(
                (a - b).abs() < eps,
                "assert_approx!({} approx {} +/-{}) failed: |{} - {}| = {}",
                stringify!($a),
                stringify!($b),
                eps,
                a,
                b,
                (a - b).abs()
            );
        };
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    fn material_id_a() -> Uuid {
        Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap()
    }
    fn material_id_b() -> Uuid {
        Uuid::parse_str("00000000-0000-0000-0000-000000000002").unwrap()
    }
    fn part_id(n: u8) -> Uuid {
        Uuid::parse_str(&format!("11111111-0000-0000-0000-{:012}", n)).unwrap()
    }
    fn op_id(n: u8) -> Uuid {
        Uuid::parse_str(&format!("22222222-0000-0000-0000-{:012}", n)).unwrap()
    }

    /// Build a calculator with two materials and all standard labor rates.
    fn test_calculator() -> CostCalculator {
        let mut calc = default_cost_calculator();
        calc.add_material_pricing(MaterialPricing::new(
            material_id_a(),
            "18mm Melamine White",
            2.50, // $2.50/sqft
            0.0,  // no minimum
            0.10, // 10% waste
        ));
        calc.add_material_pricing(MaterialPricing::new(
            material_id_b(),
            "3mm HDF Back",
            0.80, // $0.80/sqft
            2.0,  // 2 sqft minimum
            0.05, // 5% waste
        ));
        calc
    }

    /// Create a simple one-part slice for a 1200x600mm panel of material A.
    fn single_part_a() -> Vec<PartCostInput> {
        vec![PartCostInput {
            part_id: part_id(1),
            part_name: "Left Side".to_string(),
            material_id: material_id_a(),
            length_mm: 1200.0,
            width_mm: 600.0,
            quantity: 1,
        }]
    }

    // -----------------------------------------------------------------------
    // PartCostInput: area conversion
    // -----------------------------------------------------------------------

    #[test]
    fn test_part_area_sqft_conversion() {
        let p = PartCostInput {
            part_id: part_id(1),
            part_name: "Test".to_string(),
            material_id: material_id_a(),
            length_mm: 304.8, // exactly 1 ft
            width_mm: 304.8,  // exactly 1 ft
            quantity: 1,
        };
        // 304.8^2 mm^2 = 92_903.04 mm^2 = 1 ft^2
        assert_approx!(p.area_sqft(), 1.0, 1e-4);
    }

    #[test]
    fn test_part_area_sqft_large_panel() {
        // 2440 x 1220 mm ~= standard 4x8 sheet ~= 32 sqft
        let p = PartCostInput {
            part_id: part_id(1),
            part_name: "Sheet".to_string(),
            material_id: material_id_a(),
            length_mm: 2440.0,
            width_mm: 1220.0,
            quantity: 1,
        };
        // expected: 2440 * 1220 / 92903.04 ~= 32.05 sqft
        assert_approx!(p.area_sqft(), 2_976_800.0 / 92_903.04, 1e-4);
    }

    // -----------------------------------------------------------------------
    // MaterialPricing
    // -----------------------------------------------------------------------

    #[test]
    fn test_material_pricing_new() {
        let mp = MaterialPricing::new(material_id_a(), "Oak", 3.0, 5.0, 0.15);
        assert_eq!(mp.name, "Oak");
        assert_approx!(mp.price_per_sqft, 3.0);
        assert_approx!(mp.waste_factor, 0.15);
    }

    #[test]
    #[should_panic]
    fn test_material_pricing_negative_price_panics() {
        MaterialPricing::new(material_id_a(), "Bad", -1.0, 0.0, 0.0);
    }

    #[test]
    #[should_panic]
    fn test_material_pricing_negative_waste_panics() {
        MaterialPricing::new(material_id_a(), "Bad", 1.0, 0.0, -0.1);
    }

    // -----------------------------------------------------------------------
    // LaborRate
    // -----------------------------------------------------------------------

    #[test]
    fn test_labor_rate_zero_count() {
        let r = LaborRate::new(OperationType::Cut, 60.0, 5.0, 2.0);
        assert_approx!(r.compute_cost(0), 0.0);
    }

    #[test]
    fn test_labor_rate_one_operation() {
        // $60/hr, setup=5min, per_unit=2min -> total=7min -> cost=7/60x60=$7
        let r = LaborRate::new(OperationType::Cut, 60.0, 5.0, 2.0);
        assert_approx!(r.compute_cost(1), 7.0);
    }

    #[test]
    fn test_labor_rate_multiple_operations() {
        // $90/hr, setup=2min, per_unit=3min, count=4 -> 2+12=14min -> 14/60x90=$21
        let r = LaborRate::new(OperationType::Route, 90.0, 2.0, 3.0);
        assert_approx!(r.compute_cost(4), 90.0 * 14.0 / 60.0);
    }

    #[test]
    fn test_labor_rate_no_setup_time() {
        let r = LaborRate::new(OperationType::Bore, 60.0, 0.0, 1.0);
        // 3 ops, no setup -> 3 min -> $3
        assert_approx!(r.compute_cost(3), 3.0);
    }

    // -----------------------------------------------------------------------
    // CostRule: percentage markup
    // -----------------------------------------------------------------------

    #[test]
    fn test_markup_percentage_20_pct() {
        let rule = CostRule {
            name: "Overhead".to_string(),
            enabled: true,
            kind: MarkupKind::Percentage { value: 20.0 },
        };
        assert_approx!(rule.compute_markup(1000.0), 200.0);
    }

    #[test]
    fn test_markup_percentage_zero() {
        let rule = CostRule {
            name: "Zero".to_string(),
            enabled: true,
            kind: MarkupKind::Percentage { value: 0.0 },
        };
        assert_approx!(rule.compute_markup(500.0), 0.0);
    }

    #[test]
    fn test_markup_percentage_disabled() {
        let rule = CostRule {
            name: "Disabled".to_string(),
            enabled: false,
            kind: MarkupKind::Percentage { value: 50.0 },
        };
        assert_approx!(rule.compute_markup(1000.0), 0.0);
    }

    // -----------------------------------------------------------------------
    // CostRule: fixed markup
    // -----------------------------------------------------------------------

    #[test]
    fn test_markup_fixed_amount() {
        let rule = CostRule {
            name: "Delivery".to_string(),
            enabled: true,
            kind: MarkupKind::Fixed { amount: 150.0 },
        };
        assert_approx!(rule.compute_markup(1000.0), 150.0);
        assert_approx!(rule.compute_markup(50.0), 150.0); // fixed regardless of subtotal
    }

    #[test]
    fn test_markup_fixed_zero_amount() {
        let rule = CostRule {
            name: "Free delivery".to_string(),
            enabled: true,
            kind: MarkupKind::Fixed { amount: 0.0 },
        };
        assert_approx!(rule.compute_markup(500.0), 0.0);
    }

    // -----------------------------------------------------------------------
    // CostRule: tiered markup
    // -----------------------------------------------------------------------

    #[test]
    fn test_markup_tiered_selects_correct_tier() {
        let rule = CostRule {
            name: "Volume discount".to_string(),
            enabled: true,
            kind: MarkupKind::Tiered {
                tiers: vec![
                    MarkupTier {
                        threshold: 0.0,
                        rate: 30.0,
                    },
                    MarkupTier {
                        threshold: 500.0,
                        rate: 25.0,
                    },
                    MarkupTier {
                        threshold: 2000.0,
                        rate: 20.0,
                    },
                ],
            },
        };
        // subtotal=300 -> tier 0 (30%) -> 90
        assert_approx!(rule.compute_markup(300.0), 90.0);
        // subtotal=1000 -> tier 1 (25%) -> 250
        assert_approx!(rule.compute_markup(1000.0), 250.0);
        // subtotal=5000 -> tier 2 (20%) -> 1000
        assert_approx!(rule.compute_markup(5000.0), 1000.0);
    }

    #[test]
    fn test_markup_tiered_no_applicable_tier() {
        let rule = CostRule {
            name: "High threshold".to_string(),
            enabled: true,
            kind: MarkupKind::Tiered {
                tiers: vec![MarkupTier {
                    threshold: 1000.0,
                    rate: 15.0,
                }],
            },
        };
        // subtotal=50 is below the only threshold -> 0
        assert_approx!(rule.compute_markup(50.0), 0.0);
    }

    #[test]
    fn test_markup_tiered_exact_threshold() {
        let rule = CostRule {
            name: "Exact".to_string(),
            enabled: true,
            kind: MarkupKind::Tiered {
                tiers: vec![MarkupTier {
                    threshold: 500.0,
                    rate: 10.0,
                }],
            },
        };
        assert_approx!(rule.compute_markup(500.0), 50.0);
    }

    // -----------------------------------------------------------------------
    // CostCalculator::apply_markups (original 1-liner)
    // -----------------------------------------------------------------------

    #[test]
    fn test_apply_markups_20_pct() {
        let calc = test_calculator();
        assert_approx!(calc.apply_markups(1000.0, 20.0), 1200.0);
    }

    #[test]
    fn test_apply_markups_zero_pct() {
        let calc = test_calculator();
        assert_approx!(calc.apply_markups(500.0, 0.0), 500.0);
    }

    #[test]
    fn test_apply_markups_100_pct() {
        let calc = test_calculator();
        assert_approx!(calc.apply_markups(200.0, 100.0), 400.0);
    }

    // -----------------------------------------------------------------------
    // calculate_material_cost: single part
    // -----------------------------------------------------------------------

    #[test]
    fn test_material_cost_single_part() {
        let calc = test_calculator();
        let parts = single_part_a();
        let lines = calc.calculate_material_cost(&parts);
        assert_eq!(lines.len(), 1);
        let line = &lines[0];
        assert_eq!(line.part_id, part_id(1));
        assert_eq!(line.material_name, "18mm Melamine White");
        // net area = 1200*600/92903.04
        let net = 1200.0 * 600.0 / 92_903.04;
        assert_approx!(line.area_used_sqft, net, 1e-4);
        // gross = net * 1.10
        let gross = net * 1.10;
        // no minimum, so billed = gross
        assert_approx!(line.area_billed_sqft, gross, 1e-4);
        assert_approx!(line.cost, gross * 2.50, 1e-4);
        assert_approx!(line.waste_percentage, 10.0);
    }

    #[test]
    fn test_material_cost_multi_part_same_material() {
        let calc = test_calculator();
        let parts = vec![
            PartCostInput {
                part_id: part_id(1),
                part_name: "Left".to_string(),
                material_id: material_id_a(),
                length_mm: 800.0,
                width_mm: 400.0,
                quantity: 1,
            },
            PartCostInput {
                part_id: part_id(2),
                part_name: "Right".to_string(),
                material_id: material_id_a(),
                length_mm: 800.0,
                width_mm: 400.0,
                quantity: 1,
            },
        ];
        let lines = calc.calculate_material_cost(&parts);
        assert_eq!(lines.len(), 2);
        // Both lines should be equal in cost since same dimensions
        assert_approx!(lines[0].cost, lines[1].cost, 1e-6);
    }

    #[test]
    fn test_material_cost_quantity_multiplier() {
        let calc = test_calculator();
        let parts_qty1 = vec![PartCostInput {
            part_id: part_id(1),
            part_name: "Panel".to_string(),
            material_id: material_id_a(),
            length_mm: 600.0,
            width_mm: 400.0,
            quantity: 1,
        }];
        let parts_qty3 = vec![PartCostInput {
            part_id: part_id(1),
            part_name: "Panel".to_string(),
            material_id: material_id_a(),
            length_mm: 600.0,
            width_mm: 400.0,
            quantity: 3,
        }];
        let cost1 = calc.calculate_material_cost(&parts_qty1)[0].cost;
        let cost3 = calc.calculate_material_cost(&parts_qty3)[0].cost;
        assert_approx!(cost3, cost1 * 3.0, 1e-6);
    }

    #[test]
    fn test_material_cost_different_materials() {
        let calc = test_calculator();
        let parts = vec![
            PartCostInput {
                part_id: part_id(1),
                part_name: "Side".to_string(),
                material_id: material_id_a(),
                length_mm: 800.0,
                width_mm: 600.0,
                quantity: 1,
            },
            PartCostInput {
                part_id: part_id(2),
                part_name: "Back".to_string(),
                material_id: material_id_b(),
                length_mm: 800.0,
                width_mm: 600.0,
                quantity: 1,
            },
        ];
        let lines = calc.calculate_material_cost(&parts);
        assert_eq!(lines.len(), 2);
        // material B is cheaper ($0.80 vs $2.50) even with higher minimum
        assert!(
            lines[1].cost < lines[0].cost || lines[1].area_billed_sqft >= lines[0].area_billed_sqft
        );
    }

    #[test]
    fn test_material_cost_missing_material_skipped() {
        let calc = test_calculator();
        let unknown_id = Uuid::new_v4();
        let parts = vec![PartCostInput {
            part_id: part_id(1),
            part_name: "Mystery".to_string(),
            material_id: unknown_id,
            length_mm: 1000.0,
            width_mm: 500.0,
            quantity: 1,
        }];
        let lines = calc.calculate_material_cost(&parts);
        assert!(lines.is_empty());
    }

    #[test]
    fn test_material_cost_zero_parts() {
        let calc = test_calculator();
        let lines = calc.calculate_material_cost(&[]);
        assert!(lines.is_empty());
    }

    #[test]
    fn test_material_cost_zero_quantity_skipped() {
        let calc = test_calculator();
        let parts = vec![PartCostInput {
            part_id: part_id(1),
            part_name: "None".to_string(),
            material_id: material_id_a(),
            length_mm: 800.0,
            width_mm: 600.0,
            quantity: 0,
        }];
        let lines = calc.calculate_material_cost(&parts);
        assert!(lines.is_empty());
    }

    #[test]
    fn test_material_cost_minimum_order_applied() {
        let calc = test_calculator();
        // Material B has min_order_sqft = 2.0
        // A very tiny part: 50x50mm -> ~0.027 sqft, even with 5% waste = ~0.028 sqft < 2.0
        let parts = vec![PartCostInput {
            part_id: part_id(2),
            part_name: "Tiny Back".to_string(),
            material_id: material_id_b(),
            length_mm: 50.0,
            width_mm: 50.0,
            quantity: 1,
        }];
        let lines = calc.calculate_material_cost(&parts);
        assert_eq!(lines.len(), 1);
        let line = &lines[0];
        // billed_area should be the minimum (2.0 sqft)
        assert_approx!(line.area_billed_sqft, 2.0, 1e-6);
        assert_approx!(line.cost, 2.0 * 0.80, 1e-6);
    }

    #[test]
    fn test_material_cost_waste_factor_zero() {
        let mut calc = test_calculator();
        let id = Uuid::new_v4();
        calc.add_material_pricing(MaterialPricing::new(id, "No Waste", 1.0, 0.0, 0.0));
        let parts = vec![PartCostInput {
            part_id: part_id(9),
            part_name: "P".to_string(),
            material_id: id,
            length_mm: 304.8,
            width_mm: 304.8,
            quantity: 1,
        }];
        let lines = calc.calculate_material_cost(&parts);
        assert_eq!(lines.len(), 1);
        // net_area ~= 1 sqft, no waste, cost ~= $1.00
        assert_approx!(lines[0].cost, 1.0, 1e-3);
    }

    #[test]
    fn test_material_cost_high_waste_factor() {
        let mut calc = test_calculator();
        let id = Uuid::new_v4();
        calc.add_material_pricing(MaterialPricing::new(id, "Expensive Waste", 2.0, 0.0, 0.50));
        let parts = vec![PartCostInput {
            part_id: part_id(9),
            part_name: "P".to_string(),
            material_id: id,
            length_mm: 304.8, // ~1 sqft
            width_mm: 304.8,
            quantity: 2,
        }];
        let lines = calc.calculate_material_cost(&parts);
        // net = 2 sqft, gross = 3 sqft (50% waste), cost = $6
        assert_approx!(lines[0].cost, 6.0, 1e-2);
    }

    // -----------------------------------------------------------------------
    // calculate_labor_cost
    // -----------------------------------------------------------------------

    #[test]
    fn test_labor_cost_single_cut_operation() {
        let calc = test_calculator();
        let ops = vec![OperationCostInput {
            operation_id: op_id(1),
            part_id: part_id(1),
            description: "Rip cut".to_string(),
            operation_type: OperationType::Cut,
            count: 1,
            quantity: 1,
        }];
        let lines = calc.calculate_labor_cost(&ops);
        assert_eq!(lines.len(), 1);
        // Cut: $85/hr, setup=1min, per_unit=1.5min, total=2.5min
        assert_approx!(lines[0].total_minutes, 2.5);
        assert_approx!(lines[0].cost, 85.0 * 2.5 / 60.0, 1e-6);
    }

    #[test]
    fn test_labor_cost_bore_operation() {
        let calc = test_calculator();
        let ops = vec![OperationCostInput {
            operation_id: op_id(1),
            part_id: part_id(1),
            description: "Hinge bores".to_string(),
            operation_type: OperationType::Bore,
            count: 4,
            quantity: 2,
        }];
        let lines = calc.calculate_labor_cost(&ops);
        // total_ops = 4*2=8, setup=0.5min, per_unit=0.8min -> 0.5+6.4=6.9min
        assert_approx!(lines[0].total_operations, 8.0);
        assert_approx!(lines[0].total_minutes, 6.9);
        assert_approx!(lines[0].cost, 75.0 * 6.9 / 60.0, 1e-6);
    }

    #[test]
    fn test_labor_cost_route_operation() {
        let calc = test_calculator();
        let ops = vec![OperationCostInput {
            operation_id: op_id(2),
            part_id: part_id(2),
            description: "Dado slot".to_string(),
            operation_type: OperationType::Route,
            count: 2,
            quantity: 1,
        }];
        let lines = calc.calculate_labor_cost(&ops);
        // Route: $90/hr, setup=2min, per_unit=3min, count=2 -> 2+6=8min
        assert_approx!(lines[0].total_minutes, 8.0);
        assert_approx!(lines[0].cost, 90.0 * 8.0 / 60.0, 1e-6);
    }

    #[test]
    fn test_labor_cost_edge_band_operation() {
        let calc = test_calculator();
        let ops = vec![OperationCostInput {
            operation_id: op_id(3),
            part_id: part_id(1),
            description: "Top edge band".to_string(),
            operation_type: OperationType::EdgeBand,
            count: 1,
            quantity: 4,
        }];
        let lines = calc.calculate_labor_cost(&ops);
        // EdgeBand: $60/hr, setup=1min, per_unit=2min, total_ops=4 -> 1+8=9min
        assert_approx!(lines[0].total_minutes, 9.0);
        assert_approx!(lines[0].cost, 60.0 * 9.0 / 60.0, 1e-6);
    }

    #[test]
    fn test_labor_cost_drill_operation() {
        let calc = test_calculator();
        let ops = vec![OperationCostInput {
            operation_id: op_id(4),
            part_id: part_id(1),
            description: "Shelf pin holes".to_string(),
            operation_type: OperationType::Drill,
            count: 16,
            quantity: 1,
        }];
        let lines = calc.calculate_labor_cost(&ops);
        // Drill: $70/hr, setup=0.5min, per_unit=0.7min, total_ops=16 -> 0.5+11.2=11.7min
        assert_approx!(lines[0].total_minutes, 11.7, 1e-6);
        assert_approx!(lines[0].cost, 70.0 * 11.7 / 60.0, 1e-5);
    }

    #[test]
    fn test_labor_cost_profile_operation() {
        let calc = test_calculator();
        let ops = vec![OperationCostInput {
            operation_id: op_id(5),
            part_id: part_id(3),
            description: "Decorative profile".to_string(),
            operation_type: OperationType::Profile,
            count: 1,
            quantity: 1,
        }];
        let lines = calc.calculate_labor_cost(&ops);
        // Profile: $95/hr, setup=2.5min, per_unit=4.0min -> 6.5min
        assert_approx!(lines[0].total_minutes, 6.5);
        assert_approx!(lines[0].cost, 95.0 * 6.5 / 60.0, 1e-6);
    }

    #[test]
    fn test_labor_cost_dado_operation() {
        let calc = test_calculator();
        let ops = vec![OperationCostInput {
            operation_id: op_id(6),
            part_id: part_id(1),
            description: "Back panel dado".to_string(),
            operation_type: OperationType::Dado,
            count: 1,
            quantity: 2,
        }];
        let lines = calc.calculate_labor_cost(&ops);
        // Dado: $85/hr, setup=1.5min, per_unit=2.5min, total_ops=2 -> 6.5min
        assert_approx!(lines[0].total_minutes, 6.5);
    }

    #[test]
    fn test_labor_cost_pocket_operation() {
        let calc = test_calculator();
        let ops = vec![OperationCostInput {
            operation_id: op_id(7),
            part_id: part_id(1),
            description: "Pocket screws".to_string(),
            operation_type: OperationType::Pocket,
            count: 6,
            quantity: 1,
        }];
        let lines = calc.calculate_labor_cost(&ops);
        // Pocket: $80/hr, setup=1min, per_unit=2min, total_ops=6 -> 13min
        assert_approx!(lines[0].total_minutes, 13.0);
        assert_approx!(lines[0].cost, 80.0 * 13.0 / 60.0, 1e-6);
    }

    #[test]
    fn test_labor_cost_tenon_operation() {
        let calc = test_calculator();
        let ops = vec![OperationCostInput {
            operation_id: op_id(8),
            part_id: part_id(2),
            description: "Mortise and tenon".to_string(),
            operation_type: OperationType::Tenon,
            count: 4,
            quantity: 1,
        }];
        let lines = calc.calculate_labor_cost(&ops);
        // Tenon: $90/hr, setup=2min, per_unit=3.5min, total_ops=4 -> 16min
        assert_approx!(lines[0].total_minutes, 16.0);
        assert_approx!(lines[0].cost, 90.0 * 16.0 / 60.0, 1e-6);
    }

    #[test]
    fn test_labor_cost_cutout_operation() {
        let calc = test_calculator();
        let ops = vec![OperationCostInput {
            operation_id: op_id(9),
            part_id: part_id(2),
            description: "Speaker cutout".to_string(),
            operation_type: OperationType::Cutout,
            count: 1,
            quantity: 1,
        }];
        let lines = calc.calculate_labor_cost(&ops);
        // Cutout: $85/hr, setup=1.5min, per_unit=2.0min -> 3.5min
        assert_approx!(lines[0].total_minutes, 3.5);
    }

    #[test]
    fn test_labor_cost_custom_operation() {
        let calc = test_calculator();
        let ops = vec![OperationCostInput {
            operation_id: op_id(10),
            part_id: part_id(1),
            description: "Hand-finishing".to_string(),
            operation_type: OperationType::Custom,
            count: 1,
            quantity: 1,
        }];
        let lines = calc.calculate_labor_cost(&ops);
        // Custom: $75/hr, setup=1min, per_unit=2min -> 3min
        assert_approx!(lines[0].total_minutes, 3.0);
        assert_approx!(lines[0].cost, 75.0 * 3.0 / 60.0, 1e-6);
    }

    #[test]
    fn test_labor_cost_unknown_type_uses_default() {
        // Create a calculator WITHOUT custom rates, so it falls back to defaults.
        let calc = CostCalculator::new(50.0, 3.0);
        let ops = vec![OperationCostInput {
            operation_id: op_id(1),
            part_id: part_id(1),
            description: "Fallback op".to_string(),
            operation_type: OperationType::Custom,
            count: 1,
            quantity: 1,
        }];
        let lines = calc.calculate_labor_cost(&ops);
        // default_labor_rate=50, default_per_unit=3min, no setup -> 3min -> $2.50
        assert_approx!(lines[0].total_minutes, 3.0);
        assert_approx!(lines[0].cost, 50.0 * 3.0 / 60.0, 1e-6);
    }

    #[test]
    fn test_labor_cost_zero_operations() {
        let calc = test_calculator();
        let lines = calc.calculate_labor_cost(&[]);
        assert!(lines.is_empty());
    }

    #[test]
    fn test_labor_cost_zero_count_zero_quantity() {
        let calc = test_calculator();
        let ops = vec![OperationCostInput {
            operation_id: op_id(1),
            part_id: part_id(1),
            description: "Zero".to_string(),
            operation_type: OperationType::Cut,
            count: 0,
            quantity: 0,
        }];
        let lines = calc.calculate_labor_cost(&ops);
        assert_eq!(lines.len(), 1);
        assert_approx!(lines[0].total_minutes, 0.0);
        assert_approx!(lines[0].cost, 0.0);
    }

    #[test]
    fn test_labor_cost_multiple_operations_different_types() {
        let calc = test_calculator();
        let ops = vec![
            OperationCostInput {
                operation_id: op_id(1),
                part_id: part_id(1),
                description: "Cut".to_string(),
                operation_type: OperationType::Cut,
                count: 1,
                quantity: 1,
            },
            OperationCostInput {
                operation_id: op_id(2),
                part_id: part_id(1),
                description: "Bore".to_string(),
                operation_type: OperationType::Bore,
                count: 2,
                quantity: 1,
            },
        ];
        let lines = calc.calculate_labor_cost(&ops);
        assert_eq!(lines.len(), 2);
        // Each line should be > 0
        assert!(lines[0].cost > 0.0);
        assert!(lines[1].cost > 0.0);
    }

    // -----------------------------------------------------------------------
    // apply_cost_rules
    // -----------------------------------------------------------------------

    #[test]
    fn test_apply_cost_rules_single_percentage() {
        let calc = test_calculator();
        let rules = vec![CostRule {
            name: "OH".to_string(),
            enabled: true,
            kind: MarkupKind::Percentage { value: 25.0 },
        }];
        assert_approx!(calc.apply_cost_rules(1000.0, &rules), 250.0);
    }

    #[test]
    fn test_apply_cost_rules_multiple_rules_sum() {
        let calc = test_calculator();
        let rules = vec![
            CostRule {
                name: "R1".to_string(),
                enabled: true,
                kind: MarkupKind::Percentage { value: 10.0 },
            },
            CostRule {
                name: "R2".to_string(),
                enabled: true,
                kind: MarkupKind::Fixed { amount: 50.0 },
            },
        ];
        // 10% of 1000 = 100, + fixed 50 = 150 total markup
        assert_approx!(calc.apply_cost_rules(1000.0, &rules), 150.0);
    }

    #[test]
    fn test_apply_cost_rules_all_disabled() {
        let calc = test_calculator();
        let rules = vec![CostRule {
            name: "R".to_string(),
            enabled: false,
            kind: MarkupKind::Percentage { value: 30.0 },
        }];
        assert_approx!(calc.apply_cost_rules(1000.0, &rules), 0.0);
    }

    #[test]
    fn test_apply_cost_rules_empty() {
        let calc = test_calculator();
        assert_approx!(calc.apply_cost_rules(1000.0, &[]), 0.0);
    }

    // -----------------------------------------------------------------------
    // generate_quote: full orchestration
    // -----------------------------------------------------------------------

    #[test]
    fn test_generate_quote_empty_job() {
        let calc = test_calculator();
        let result = calc.generate_quote(&[], &[], &[], None);
        assert_approx!(result.material_total, 0.0);
        assert_approx!(result.labor_total, 0.0);
        assert_approx!(result.markup_total, 0.0);
        assert_approx!(result.grand_total, 0.0);
        assert!(result.material_lines.is_empty());
        assert!(result.labor_lines.is_empty());
    }

    #[test]
    fn test_generate_quote_material_only() {
        let calc = test_calculator();
        let parts = single_part_a();
        let result = calc.generate_quote(&parts, &[], &[], None);
        assert!(result.material_total > 0.0);
        assert_approx!(result.labor_total, 0.0);
        assert_approx!(result.markup_total, 0.0);
        assert_approx!(result.grand_total, result.material_total);
    }

    #[test]
    fn test_generate_quote_labor_only() {
        let calc = test_calculator();
        let ops = vec![OperationCostInput {
            operation_id: op_id(1),
            part_id: part_id(1),
            description: "Cut".to_string(),
            operation_type: OperationType::Cut,
            count: 1,
            quantity: 1,
        }];
        let result = calc.generate_quote(&[], &ops, &[], None);
        assert_approx!(result.material_total, 0.0);
        assert!(result.labor_total > 0.0);
        assert_approx!(result.grand_total, result.labor_total);
    }

    #[test]
    fn test_generate_quote_with_percentage_markup() {
        let calc = test_calculator();
        let parts = single_part_a();
        let rules = vec![CostRule {
            name: "30% markup".to_string(),
            enabled: true,
            kind: MarkupKind::Percentage { value: 30.0 },
        }];
        let result = calc.generate_quote(&parts, &[], &rules, None);
        let expected_markup = result.material_total * 0.30;
        assert_approx!(result.markup_total, expected_markup, 1e-6);
        assert_approx!(
            result.grand_total,
            result.material_total + expected_markup,
            1e-6
        );
    }

    #[test]
    fn test_generate_quote_with_fixed_markup() {
        let calc = test_calculator();
        let rules = vec![CostRule {
            name: "Setup fee".to_string(),
            enabled: true,
            kind: MarkupKind::Fixed { amount: 200.0 },
        }];
        let result = calc.generate_quote(&[], &[], &rules, None);
        // Even with zero subtotal, fixed markup still applies
        assert_approx!(result.markup_total, 200.0);
        assert_approx!(result.grand_total, 200.0);
    }

    #[test]
    fn test_generate_quote_grand_total_is_sum() {
        let calc = test_calculator();
        let parts = single_part_a();
        let ops = vec![OperationCostInput {
            operation_id: op_id(1),
            part_id: part_id(1),
            description: "Cut".to_string(),
            operation_type: OperationType::Cut,
            count: 2,
            quantity: 1,
        }];
        let rules = vec![CostRule {
            name: "Margin".to_string(),
            enabled: true,
            kind: MarkupKind::Percentage { value: 15.0 },
        }];
        let result = calc.generate_quote(&parts, &ops, &rules, None);
        let expected = result.material_total + result.labor_total + result.markup_total;
        assert_approx!(result.grand_total, expected, 1e-9);
    }

    #[test]
    fn test_generate_quote_per_part_cost_populated() {
        let calc = test_calculator();
        let parts = single_part_a();
        let ops = vec![OperationCostInput {
            operation_id: op_id(1),
            part_id: part_id(1),
            description: "Cut".to_string(),
            operation_type: OperationType::Cut,
            count: 1,
            quantity: 1,
        }];
        let result = calc.generate_quote(&parts, &ops, &[], None);
        assert!(result.per_part_cost.contains_key(&part_id(1)));
        let combined = result.per_part_cost[&part_id(1)];
        assert_approx!(combined, result.material_total + result.labor_total, 1e-6);
    }

    #[test]
    fn test_generate_quote_multiple_parts_per_part_breakdown() {
        let calc = test_calculator();
        let parts = vec![
            PartCostInput {
                part_id: part_id(1),
                part_name: "Part A".to_string(),
                material_id: material_id_a(),
                length_mm: 1000.0,
                width_mm: 500.0,
                quantity: 1,
            },
            PartCostInput {
                part_id: part_id(2),
                part_name: "Part B".to_string(),
                material_id: material_id_a(),
                length_mm: 600.0,
                width_mm: 300.0,
                quantity: 1,
            },
        ];
        let result = calc.generate_quote(&parts, &[], &[], None);
        assert_eq!(result.per_part_cost.len(), 2);
        let total_parts: f64 = result.per_part_cost.values().sum();
        assert_approx!(total_parts, result.material_total, 1e-6);
    }

    #[test]
    fn test_generate_quote_quote_number_stored() {
        let calc = test_calculator();
        let result = calc.generate_quote(&[], &[], &[], Some("Q-2024-0042".to_string()));
        assert_eq!(result.quote_number, Some("Q-2024-0042".to_string()));
    }

    #[test]
    fn test_generate_quote_no_quote_number() {
        let calc = test_calculator();
        let result = calc.generate_quote(&[], &[], &[], None);
        assert!(result.quote_number.is_none());
    }

    #[test]
    fn test_generate_quote_line_items_present() {
        let calc = test_calculator();
        let parts = single_part_a();
        let ops = vec![OperationCostInput {
            operation_id: op_id(1),
            part_id: part_id(1),
            description: "Cut".to_string(),
            operation_type: OperationType::Cut,
            count: 1,
            quantity: 1,
        }];
        let rules = vec![CostRule {
            name: "Markup".to_string(),
            enabled: true,
            kind: MarkupKind::Percentage { value: 20.0 },
        }];
        let result = calc.generate_quote(&parts, &ops, &rules, None);
        // Expect material + labor + markup = 3 quote lines
        assert_eq!(result.quote_lines.len(), 3);
        assert!(result.quote_lines.iter().any(|l| l.category == "material"));
        assert!(result.quote_lines.iter().any(|l| l.category == "labor"));
        assert!(result.quote_lines.iter().any(|l| l.category == "markup"));
    }

    #[test]
    fn test_generate_quote_quote_lines_sum_matches_grand_total() {
        let calc = test_calculator();
        let parts = single_part_a();
        let rules = vec![CostRule {
            name: "Fee".to_string(),
            enabled: true,
            kind: MarkupKind::Fixed { amount: 100.0 },
        }];
        let result = calc.generate_quote(&parts, &[], &rules, None);
        let sum: f64 = result.quote_lines.iter().map(|l| l.amount).sum();
        assert_approx!(sum, result.grand_total, 1e-6);
    }

    #[test]
    fn test_generate_quote_generated_at_is_recent() {
        let before = Utc::now();
        let calc = test_calculator();
        let result = calc.generate_quote(&[], &[], &[], None);
        let after = Utc::now();
        assert!(result.generated_at >= before);
        assert!(result.generated_at <= after);
    }

    // -----------------------------------------------------------------------
    // Tiered markup integration in generate_quote
    // -----------------------------------------------------------------------

    #[test]
    fn test_generate_quote_tiered_markup_correct_tier_selected() {
        let calc = test_calculator();
        // Build parts that total > $500 so the upper tier applies
        let parts = vec![PartCostInput {
            part_id: part_id(1),
            part_name: "Big Cabinet".to_string(),
            material_id: material_id_a(),
            length_mm: 10000.0, // very large -> high cost
            width_mm: 5000.0,
            quantity: 10,
        }];
        let rules = vec![CostRule {
            name: "Tiered OH".to_string(),
            enabled: true,
            kind: MarkupKind::Tiered {
                tiers: vec![
                    MarkupTier {
                        threshold: 0.0,
                        rate: 30.0,
                    },
                    MarkupTier {
                        threshold: 100.0,
                        rate: 20.0,
                    },
                ],
            },
        }];
        let result = calc.generate_quote(&parts, &[], &rules, None);
        // subtotal should be well above $100, so 20% tier applies
        let expected = result.material_total * 0.20;
        assert_approx!(result.markup_total, expected, 1e-6);
    }

    // -----------------------------------------------------------------------
    // Edge cases and numerical stability
    // -----------------------------------------------------------------------

    #[test]
    fn test_material_cost_very_small_dimensions() {
        let calc = test_calculator();
        let parts = vec![PartCostInput {
            part_id: part_id(1),
            part_name: "Tiny".to_string(),
            material_id: material_id_a(),
            length_mm: 1.0,
            width_mm: 1.0,
            quantity: 1,
        }];
        let lines = calc.calculate_material_cost(&parts);
        // Cost should be very small but non-negative
        assert!(lines[0].cost >= 0.0);
    }

    #[test]
    fn test_material_cost_very_large_dimensions() {
        let calc = test_calculator();
        let parts = vec![PartCostInput {
            part_id: part_id(1),
            part_name: "Big".to_string(),
            material_id: material_id_a(),
            length_mm: 100_000.0,
            width_mm: 100_000.0,
            quantity: 100,
        }];
        let lines = calc.calculate_material_cost(&parts);
        assert!(lines[0].cost > 0.0);
        assert!(lines[0].cost.is_finite());
    }

    #[test]
    fn test_markup_zero_subtotal_percentage() {
        let rule = CostRule {
            name: "OH".to_string(),
            enabled: true,
            kind: MarkupKind::Percentage { value: 20.0 },
        };
        assert_approx!(rule.compute_markup(0.0), 0.0);
    }

    #[test]
    fn test_markup_negative_subtotal_returns_zero() {
        let rule = CostRule {
            name: "OH".to_string(),
            enabled: true,
            kind: MarkupKind::Percentage { value: 20.0 },
        };
        // Negative subtotals are guard-returned as 0
        assert_approx!(rule.compute_markup(-100.0), 0.0);
    }

    #[test]
    fn test_default_cost_calculator_has_all_labor_rates() {
        let calc = default_cost_calculator();
        let ops = vec![
            OperationType::Cut,
            OperationType::Bore,
            OperationType::Route,
            OperationType::EdgeBand,
            OperationType::Dado,
            OperationType::Pocket,
            OperationType::Profile,
            OperationType::Drill,
            OperationType::Tenon,
            OperationType::Cutout,
            OperationType::Custom,
        ];
        for op in ops {
            assert!(
                calc.labor_rates.contains_key(&op),
                "Missing rate for {:?}",
                op
            );
        }
    }

    #[test]
    fn test_generate_quote_material_line_names_correct() {
        let calc = test_calculator();
        let parts = single_part_a();
        let result = calc.generate_quote(&parts, &[], &[], None);
        let mat_line = result
            .quote_lines
            .iter()
            .find(|l| l.category == "material")
            .unwrap();
        assert!(mat_line.description.contains("Left Side"));
        assert!(mat_line.description.contains("18mm Melamine White"));
    }

    #[test]
    fn test_generate_quote_labor_line_description_passed_through() {
        let calc = test_calculator();
        let ops = vec![OperationCostInput {
            operation_id: op_id(1),
            part_id: part_id(1),
            description: "Shelf pin holes".to_string(),
            operation_type: OperationType::Drill,
            count: 8,
            quantity: 1,
        }];
        let result = calc.generate_quote(&[], &ops, &[], None);
        let labor_line = result
            .quote_lines
            .iter()
            .find(|l| l.category == "labor")
            .unwrap();
        assert_eq!(labor_line.description, "Shelf pin holes");
    }

    #[test]
    fn test_add_material_pricing_overwrite() {
        let mut calc = test_calculator();
        // Overwrite material A with a different price
        calc.add_material_pricing(MaterialPricing::new(
            material_id_a(),
            "Updated",
            5.0,
            0.0,
            0.0,
        ));
        let parts = single_part_a();
        let lines = calc.calculate_material_cost(&parts);
        // Should use the updated price of $5/sqft
        let net_sqft = 1200.0 * 600.0 / 92_903.04;
        assert_approx!(lines[0].cost, net_sqft * 5.0, 1e-4);
    }

    #[test]
    fn test_cost_result_serializes_to_json() {
        let calc = test_calculator();
        let result = calc.generate_quote(
            &single_part_a(),
            &[],
            &[CostRule {
                name: "Fee".to_string(),
                enabled: true,
                kind: MarkupKind::Percentage { value: 10.0 },
            }],
            Some("Q-001".to_string()),
        );
        let json = serde_json::to_string(&result);
        assert!(json.is_ok(), "JobCostResult should serialize to JSON");
        let serialized = json.unwrap();
        assert!(serialized.contains("material_total"));
        assert!(serialized.contains("grand_total"));
        assert!(serialized.contains("Q-001"));
    }
}
