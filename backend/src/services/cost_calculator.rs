use uuid::Uuid;

/// Detailed cost breakdown for a quote line item.
#[derive(Debug, Clone)]
pub struct CostLineItem {
    pub description: String,
    pub quantity: f64,
    pub unit: String,
    pub unit_cost: f64,
    pub total: f64,
}

/// Full cost calculation result for a job.
#[derive(Debug)]
pub struct JobCostResult {
    pub material_line_items: Vec<CostLineItem>,
    pub hardware_line_items: Vec<CostLineItem>,
    pub labor_line_items: Vec<CostLineItem>,
    pub material_subtotal: f64,
    pub hardware_subtotal: f64,
    pub labor_subtotal: f64,
    pub markup_amount: f64,
    pub total: f64,
}

/// Calculates material, hardware, and labor costs for jobs and generates quotes.
pub struct CostCalculator {
    /// Labor rate in dollars per hour.
    pub labor_rate_per_hour: f64,
    /// Estimated machine time per part in minutes (used for labor calculation).
    pub avg_machine_minutes_per_part: f64,
}

impl CostCalculator {
    pub fn new(labor_rate_per_hour: f64, avg_machine_minutes_per_part: f64) -> Self {
        Self {
            labor_rate_per_hour,
            avg_machine_minutes_per_part,
        }
    }

    /// Calculate total material cost for a job from the nested sheet layout.
    ///
    /// # Algorithm (TODO):
    /// 1. For each optimization run's sheets, count full sheets per material.
    /// 2. Multiply sheet count by material cost_per_unit (PerSheet).
    /// 3. For edge banding, sum total linear meters per edge band category and
    ///    multiply by the corresponding material's cost_per_unit (PerLinearFt).
    /// 4. Aggregate costs by material type.
    pub async fn calculate_material_cost(
        &self,
        _job_id: Uuid,
        _pool: &sqlx::PgPool,
    ) -> Vec<CostLineItem> {
        // TODO: implement material cost calculation
        vec![]
    }

    /// Calculate total labor cost based on part count, complexity, and machine time.
    ///
    /// # Algorithm (TODO):
    /// 1. Count total parts across all products in the job.
    /// 2. Sum estimated machine time from operation complexity.
    /// 3. Add assembly time estimate based on product types and hardware count.
    /// 4. Multiply by labor_rate_per_hour.
    pub async fn calculate_labor_cost(
        &self,
        _job_id: Uuid,
        _pool: &sqlx::PgPool,
    ) -> Vec<CostLineItem> {
        // TODO: implement labor cost calculation
        vec![]
    }

    /// Apply markup percentage to a subtotal.
    pub fn apply_markups(&self, subtotal: f64, markup_pct: f64) -> f64 {
        subtotal * (1.0 + markup_pct / 100.0)
    }

    /// Generate a complete quote for a job by aggregating all cost components.
    pub async fn generate_quote(
        &self,
        _job_id: Uuid,
        _markup_pct: f64,
        _pool: &sqlx::PgPool,
    ) -> JobCostResult {
        // TODO: implement full quote generation
        JobCostResult {
            material_line_items: vec![],
            hardware_line_items: vec![],
            labor_line_items: vec![],
            material_subtotal: 0.0,
            hardware_subtotal: 0.0,
            labor_subtotal: 0.0,
            markup_amount: 0.0,
            total: 0.0,
        }
    }
}
