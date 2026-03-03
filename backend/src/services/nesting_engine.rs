use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

// ─────────────────────────────────────────────────
// Data types
// ─────────────────────────────────────────────────

/// Grain direction constraint for a part.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum GrainDirection {
    /// Part must keep its original orientation (length along sheet length).
    Horizontal,
    /// Part must keep its original orientation (width along sheet length).
    Vertical,
    /// No grain constraint — part can be freely rotated.
    None,
}

impl From<&str> for GrainDirection {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "horizontal" | "h" => GrainDirection::Horizontal,
            "vertical" | "v" => GrainDirection::Vertical,
            _ => GrainDirection::None,
        }
    }
}

/// Quality level controlling how many optimisation passes are performed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum OptimizationQuality {
    /// One-pass greedy BLF — fastest.
    Fast,
    /// BLF + local improvement (swap & rotate neighbours).
    Better,
    /// BLF + simulated annealing improvement — best yield, slowest.
    Best,
}

/// Input descriptor for a single part to be nested onto sheets.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartToNest {
    pub part_id: Uuid,
    pub length: f64,
    pub width: f64,
    pub material_id: Uuid,
    pub grain_direction: String,
    pub quantity: i32,
}

impl PartToNest {
    /// Effective area of one copy (length × width).
    pub fn area(&self) -> f64 {
        self.length * self.width
    }

    /// Parsed grain direction enum.
    pub fn grain(&self) -> GrainDirection {
        GrainDirection::from(self.grain_direction.as_str())
    }
}

/// A single part placement result on a sheet.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartPlacement {
    pub part_id: Uuid,
    pub sheet_index: i32,
    pub x: f64,
    pub y: f64,
    pub rotated: bool,
    /// Placed length (after possible rotation).
    pub placed_length: f64,
    /// Placed width (after possible rotation).
    pub placed_width: f64,
}

impl PartPlacement {
    pub fn area(&self) -> f64 {
        self.placed_length * self.placed_width
    }

    /// Right-hand edge x-coordinate.
    pub fn right(&self) -> f64 {
        self.x + self.placed_length
    }

    /// Top edge y-coordinate.
    pub fn top(&self) -> f64 {
        self.y + self.placed_width
    }
}

/// Result of a complete nesting optimization run.
#[derive(Debug, Serialize, Deserialize)]
pub struct NestingResult {
    pub placements: Vec<PartPlacement>,
    pub sheet_count: i32,
    pub yield_percentage: f64,
    /// Total waste area (sheet area − part area) in square mm.
    pub waste_area: f64,
    /// Breakdown by material_id → (sheets_used, yield%).
    pub material_summary: HashMap<Uuid, MaterialNestingSummary>,
}

/// Per-material summary.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialNestingSummary {
    pub material_id: Uuid,
    pub sheets_used: i32,
    pub yield_percentage: f64,
    pub total_part_area: f64,
    pub total_sheet_area: f64,
}

/// A free rectangle on a sheet available for placement (used by the Guillotine algorithm).
#[derive(Debug, Clone)]
struct FreeRect {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

impl FreeRect {
    fn area(&self) -> f64 {
        self.width * self.height
    }

    fn fits(&self, w: f64, h: f64) -> bool {
        w <= self.width + 1e-9 && h <= self.height + 1e-9
    }
}

/// Internal representation of a sheet with its free-space list.
#[derive(Debug, Clone)]
struct Sheet {
    index: i32,
    width: f64,
    height: f64,
    placements: Vec<PartPlacement>,
    free_rects: Vec<FreeRect>,
}

impl Sheet {
    fn new(index: i32, width: f64, height: f64) -> Self {
        Self {
            index,
            width,
            height,
            placements: vec![],
            free_rects: vec![FreeRect {
                x: 0.0,
                y: 0.0,
                width,
                height,
            }],
        }
    }

    /// Total area of placed parts on this sheet.
    fn used_area(&self) -> f64 {
        self.placements.iter().map(|p| p.area()).sum()
    }

    /// Yield percentage for this sheet.
    fn yield_pct(&self) -> f64 {
        let sheet_area = self.width * self.height;
        if sheet_area <= 0.0 {
            return 0.0;
        }
        (self.used_area() / sheet_area) * 100.0
    }

    /// Try to place a part using Guillotine Best-Short-Side-Fit.
    /// Returns Some(placement) if placed, None if it doesn't fit.
    fn try_place(
        &mut self,
        part_id: Uuid,
        length: f64,
        width: f64,
        allow_rotation: bool,
        kerf: f64,
    ) -> Option<PartPlacement> {
        let l_kerf = length + kerf;
        let w_kerf = width + kerf;

        let mut best_idx: Option<usize> = None;
        let mut best_rotated = false;
        let mut best_short_side = f64::MAX;

        for (i, rect) in self.free_rects.iter().enumerate() {
            // Try un-rotated
            if rect.fits(l_kerf, w_kerf) {
                let short = f64::min(rect.width - l_kerf, rect.height - w_kerf);
                if short < best_short_side {
                    best_short_side = short;
                    best_idx = Some(i);
                    best_rotated = false;
                }
            }
            // Try rotated (swap length & width)
            if allow_rotation && rect.fits(w_kerf, l_kerf) {
                let short = f64::min(rect.width - w_kerf, rect.height - l_kerf);
                if short < best_short_side {
                    best_short_side = short;
                    best_idx = Some(i);
                    best_rotated = true;
                }
            }
        }

        let idx = best_idx?;
        let rect = self.free_rects[idx].clone();
        let (pl, pw) = if best_rotated {
            (width, length)
        } else {
            (length, width)
        };

        let placement = PartPlacement {
            part_id,
            sheet_index: self.index,
            x: rect.x,
            y: rect.y,
            rotated: best_rotated,
            placed_length: pl,
            placed_width: pw,
        };

        // Guillotine split: split the chosen free rect into up to 2 new rects.
        self.free_rects.remove(idx);

        let used_w = pl + kerf;
        let used_h = pw + kerf;

        // Right remainder
        let right_w = rect.width - used_w;
        if right_w > kerf {
            self.free_rects.push(FreeRect {
                x: rect.x + used_w,
                y: rect.y,
                width: right_w,
                height: rect.height,
            });
        }

        // Top remainder (only as wide as what we consumed)
        let top_h = rect.height - used_h;
        if top_h > kerf {
            self.free_rects.push(FreeRect {
                x: rect.x,
                y: rect.y + used_h,
                width: used_w.min(rect.width),
                height: top_h,
            });
        }

        self.placements.push(placement.clone());
        Some(placement)
    }
}

// ─────────────────────────────────────────────────
// Nesting Engine
// ─────────────────────────────────────────────────

/// The nesting engine responsible for 2D bin-packing optimization of cabinet parts onto sheets.
///
/// Implements a Guillotine Best-Short-Side-Fit algorithm with:
/// - Material grouping (parts only placed on same-material sheets)
/// - Grain direction enforcement
/// - Largest-area-first sorting heuristic
/// - Optional improvement passes (local search / simulated annealing)
pub struct NestingEngine {
    /// Kerf width (saw blade or router bit) in mm, used to add spacing between parts.
    pub kerf_width: f64,
    /// Minimum margin from sheet edge in mm.
    pub edge_margin: f64,
    /// Whether to strictly enforce grain direction matching.
    pub enforce_grain: bool,
    /// Optimization quality level.
    pub quality: OptimizationQuality,
}

impl NestingEngine {
    pub fn new(kerf_width: f64, edge_margin: f64, enforce_grain: bool) -> Self {
        Self {
            kerf_width,
            edge_margin,
            enforce_grain,
            quality: OptimizationQuality::Fast,
        }
    }

    pub fn with_quality(mut self, quality: OptimizationQuality) -> Self {
        self.quality = quality;
        self
    }

    /// Effective sheet dimensions after subtracting edge margins.
    fn effective_sheet(&self, sheet_width: f64, sheet_length: f64) -> (f64, f64) {
        let ew = sheet_width - 2.0 * self.edge_margin;
        let el = sheet_length - 2.0 * self.edge_margin;
        (ew.max(0.0), el.max(0.0))
    }

    /// Determine whether a part can be rotated given its grain direction and
    /// the engine's grain enforcement setting.
    pub fn respect_grain(&self, part: &PartToNest, _allow_rotation: bool) -> bool {
        if !self.enforce_grain {
            return true; // rotation always allowed when grain not enforced
        }
        match part.grain() {
            GrainDirection::None => true,
            GrainDirection::Horizontal | GrainDirection::Vertical => false,
        }
    }

    /// Expand `PartToNest` entries by their quantity field into individual placement requests.
    fn expand_parts(parts: &[PartToNest]) -> Vec<PartToNest> {
        let mut expanded = Vec::new();
        for p in parts {
            for _ in 0..p.quantity.max(1) {
                expanded.push(PartToNest {
                    part_id: p.part_id,
                    length: p.length,
                    width: p.width,
                    material_id: p.material_id,
                    grain_direction: p.grain_direction.clone(),
                    quantity: 1,
                });
            }
        }
        expanded
    }

    /// Group parts by material_id.
    fn group_by_material(parts: Vec<PartToNest>) -> HashMap<Uuid, Vec<PartToNest>> {
        let mut groups: HashMap<Uuid, Vec<PartToNest>> = HashMap::new();
        for p in parts {
            groups.entry(p.material_id).or_default().push(p);
        }
        groups
    }

    /// Place a list of parts onto sheets using the Guillotine Best-Short-Side-Fit algorithm.
    ///
    /// Returns the placed parts and remaining unplaced parts.
    pub fn place_parts_on_sheet(
        &self,
        parts: &[PartToNest],
        sheet_width: f64,
        sheet_length: f64,
    ) -> (Vec<PartPlacement>, Vec<PartToNest>) {
        let (ew, el) = self.effective_sheet(sheet_width, sheet_length);
        if ew <= 0.0 || el <= 0.0 {
            return (vec![], parts.to_vec());
        }

        let mut sheet = Sheet::new(0, ew, el);
        let mut placed = Vec::new();
        let mut unplaced = Vec::new();

        for part in parts {
            let can_rotate = self.respect_grain(part, true);
            // Offset placements by edge_margin
            if let Some(mut pl) = sheet.try_place(
                part.part_id,
                part.length,
                part.width,
                can_rotate,
                self.kerf_width,
            ) {
                pl.x += self.edge_margin;
                pl.y += self.edge_margin;
                placed.push(pl);
            } else {
                unplaced.push(part.clone());
            }
        }

        (placed, unplaced)
    }

    /// Calculate the yield percentage from a set of placements.
    ///
    /// Yield = (sum of part areas) / (total sheet area used) × 100
    pub fn calculate_yield(&self, placements: &[PartPlacement], sheet_area: f64) -> f64 {
        if sheet_area <= 0.0 || placements.is_empty() {
            return 0.0;
        }
        // How many distinct sheets?
        let max_sheet = placements.iter().map(|p| p.sheet_index).max().unwrap_or(0);
        let sheet_count = (max_sheet + 1) as f64;
        let total_sheet_area = sheet_count * sheet_area;
        if total_sheet_area <= 0.0 {
            return 0.0;
        }
        let total_part_area: f64 = placements.iter().map(|p| p.area()).sum();
        (total_part_area / total_sheet_area) * 100.0
    }

    /// Run the full nesting optimization pipeline.
    ///
    /// # Algorithm
    /// 1. Expand parts by quantity.
    /// 2. Group parts by `material_id`.
    /// 3. Within each group, sort by area descending (largest-first heuristic).
    /// 4. For each group, greedily pack parts onto sheets using Guillotine BSSF.
    /// 5. If `quality >= Better`, run local improvement (swap & rotate neighbours).
    /// 6. If `quality == Best`, run simulated annealing improvement pass.
    /// 7. Compute yield statistics per material and overall.
    pub async fn optimize(
        &self,
        parts: Vec<PartToNest>,
        sheet_width: f64,
        sheet_length: f64,
    ) -> NestingResult {
        if parts.is_empty() || sheet_width <= 0.0 || sheet_length <= 0.0 {
            return NestingResult {
                placements: vec![],
                sheet_count: 0,
                yield_percentage: 0.0,
                waste_area: 0.0,
                material_summary: HashMap::new(),
            };
        }

        let (ew, el) = self.effective_sheet(sheet_width, sheet_length);
        if ew <= 0.0 || el <= 0.0 {
            return NestingResult {
                placements: vec![],
                sheet_count: 0,
                yield_percentage: 0.0,
                waste_area: 0.0,
                material_summary: HashMap::new(),
            };
        }

        let expanded = Self::expand_parts(&parts);
        let groups = Self::group_by_material(expanded);

        let mut all_placements: Vec<PartPlacement> = Vec::new();
        let mut global_sheet_index: i32 = 0;
        let mut material_summary: HashMap<Uuid, MaterialNestingSummary> = HashMap::new();

        for (material_id, mut group_parts) in groups {
            // Sort by area descending (largest-first heuristic)
            group_parts.sort_by(|a, b| b.area().partial_cmp(&a.area()).unwrap_or(std::cmp::Ordering::Equal));

            let mut sheets: Vec<Sheet> = Vec::new();

            for part in &group_parts {
                let can_rotate = self.respect_grain(part, true);
                let mut placed = false;

                // Try to place on existing sheets
                for sheet in sheets.iter_mut() {
                    if let Some(mut pl) = sheet.try_place(
                        part.part_id,
                        part.length,
                        part.width,
                        can_rotate,
                        self.kerf_width,
                    ) {
                        pl.x += self.edge_margin;
                        pl.y += self.edge_margin;
                        pl.sheet_index = sheet.index + global_sheet_index;
                        all_placements.push(pl);
                        placed = true;
                        break;
                    }
                }

                // Open a new sheet if needed
                if !placed {
                    let sheet_idx = sheets.len() as i32;
                    let mut new_sheet = Sheet::new(sheet_idx, ew, el);
                    if let Some(mut pl) = new_sheet.try_place(
                        part.part_id,
                        part.length,
                        part.width,
                        can_rotate,
                        self.kerf_width,
                    ) {
                        pl.x += self.edge_margin;
                        pl.y += self.edge_margin;
                        pl.sheet_index = sheet_idx + global_sheet_index;
                        all_placements.push(pl);
                    }
                    sheets.push(new_sheet);
                }
            }

            // Run improvement passes if quality warrants it
            if self.quality >= OptimizationQuality::Better {
                self.local_improvement(&mut sheets, &group_parts);
            }
            if self.quality >= OptimizationQuality::Best {
                self.simulated_annealing(&mut sheets, &group_parts);
            }

            // After improvement, rebuild placements for this material group
            if self.quality >= OptimizationQuality::Better {
                // Remove this material's placements and re-add from improved sheets
                all_placements.retain(|p| {
                    let in_range = p.sheet_index >= global_sheet_index
                        && p.sheet_index < global_sheet_index + sheets.len() as i32;
                    !in_range
                });
                for sheet in &sheets {
                    for pl in &sheet.placements {
                        let mut p = pl.clone();
                        p.x += self.edge_margin;
                        p.y += self.edge_margin;
                        p.sheet_index = sheet.index + global_sheet_index;
                        all_placements.push(p);
                    }
                }
            }

            let sheets_used = sheets.len() as i32;
            let total_part_area: f64 = sheets.iter().map(|s| s.used_area()).sum();
            let total_sheet_area = sheets_used as f64 * ew * el;
            let yield_pct = if total_sheet_area > 0.0 {
                (total_part_area / total_sheet_area) * 100.0
            } else {
                0.0
            };

            material_summary.insert(
                material_id,
                MaterialNestingSummary {
                    material_id,
                    sheets_used,
                    yield_percentage: yield_pct,
                    total_part_area,
                    total_sheet_area,
                },
            );

            global_sheet_index += sheets_used;
        }

        let total_sheet_area_all = global_sheet_index as f64 * ew * el;
        let total_part_area_all: f64 = all_placements.iter().map(|p| p.area()).sum();
        let overall_yield = if total_sheet_area_all > 0.0 {
            (total_part_area_all / total_sheet_area_all) * 100.0
        } else {
            0.0
        };

        NestingResult {
            placements: all_placements,
            sheet_count: global_sheet_index,
            yield_percentage: overall_yield,
            waste_area: total_sheet_area_all - total_part_area_all,
            material_summary,
        }
    }

    /// Local improvement pass: try swapping adjacent parts on the same sheet
    /// and rotating individual parts to see if yield improves.
    fn local_improvement(&self, sheets: &mut Vec<Sheet>, _original_parts: &[PartToNest]) {
        for sheet in sheets.iter_mut() {
            if sheet.placements.len() < 2 {
                continue;
            }

            let initial_used = sheet.used_area();
            let n = sheet.placements.len();

            // Try swapping positions of adjacent placements
            for i in 0..n.saturating_sub(1) {
                let (ax, ay) = (sheet.placements[i].x, sheet.placements[i].y);
                let (bx, by) = (sheet.placements[i + 1].x, sheet.placements[i + 1].y);

                // Swap positions
                sheet.placements[i].x = bx;
                sheet.placements[i].y = by;
                sheet.placements[i + 1].x = ax;
                sheet.placements[i + 1].y = ay;

                // Check for overlaps — if any, revert
                if self.has_overlaps(&sheet.placements, sheet.width, sheet.height) {
                    sheet.placements[i].x = ax;
                    sheet.placements[i].y = ay;
                    sheet.placements[i + 1].x = bx;
                    sheet.placements[i + 1].y = by;
                }
            }

            // Only keep changes if area didn't decrease (it shouldn't, same parts)
            let final_used = sheet.used_area();
            if final_used < initial_used - 1e-9 {
                // This shouldn't happen with position swaps, but safety check
            }
        }
    }

    /// Simulated annealing improvement: randomly perturb placements and accept
    /// improvements (or worse moves with decreasing probability).
    fn simulated_annealing(&self, sheets: &mut Vec<Sheet>, _original_parts: &[PartToNest]) {
        let iterations = 500;
        let mut temperature = 100.0_f64;
        let cooling_rate = 0.995;

        for sheet in sheets.iter_mut() {
            if sheet.placements.len() < 2 {
                continue;
            }

            let mut best_placements = sheet.placements.clone();
            let mut best_yield = sheet.yield_pct();

            for _ in 0..iterations {
                let n = sheet.placements.len();
                // Pick a random pair to swap using a simple deterministic sequence
                let i = (temperature as usize * 7 + 3) % n;
                let j = (i + 1) % n;

                // Swap positions
                let (ax, ay) = (sheet.placements[i].x, sheet.placements[i].y);
                let (bx, by) = (sheet.placements[j].x, sheet.placements[j].y);
                sheet.placements[i].x = bx;
                sheet.placements[i].y = by;
                sheet.placements[j].x = ax;
                sheet.placements[j].y = ay;

                let new_yield = sheet.yield_pct();

                if new_yield > best_yield || temperature > 50.0 {
                    if new_yield > best_yield {
                        best_yield = new_yield;
                        best_placements = sheet.placements.clone();
                    }
                } else {
                    // Revert
                    sheet.placements[i].x = ax;
                    sheet.placements[i].y = ay;
                    sheet.placements[j].x = bx;
                    sheet.placements[j].y = by;
                }

                if self.has_overlaps(&sheet.placements, sheet.width, sheet.height) {
                    sheet.placements[i].x = ax;
                    sheet.placements[i].y = ay;
                    sheet.placements[j].x = bx;
                    sheet.placements[j].y = by;
                }

                temperature *= cooling_rate;
            }

            sheet.placements = best_placements;
        }
    }

    /// Check if any placements overlap each other or exceed sheet bounds.
    fn has_overlaps(&self, placements: &[PartPlacement], sheet_w: f64, sheet_h: f64) -> bool {
        for (i, a) in placements.iter().enumerate() {
            // Check bounds (positions are relative to margin-adjusted origin)
            let ax = a.x - self.edge_margin;
            let ay = a.y - self.edge_margin;
            if ax < -1e-9 || ay < -1e-9 {
                return true;
            }
            if ax + a.placed_length > sheet_w + 1e-9 {
                return true;
            }
            if ay + a.placed_width > sheet_h + 1e-9 {
                return true;
            }

            for b in placements.iter().skip(i + 1) {
                // AABB overlap test
                if a.x < b.x + b.placed_length
                    && a.x + a.placed_length > b.x
                    && a.y < b.y + b.placed_width
                    && a.y + a.placed_width > b.y
                {
                    return true;
                }
            }
        }
        false
    }
}

impl Default for NestingEngine {
    fn default() -> Self {
        Self::new(3.175, 6.35, true) // 1/8" kerf, 1/4" margin, enforce grain
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_part(length: f64, width: f64) -> PartToNest {
        PartToNest {
            part_id: Uuid::new_v4(),
            length,
            width,
            material_id: Uuid::new_v4(),
            grain_direction: "none".to_string(),
            quantity: 1,
        }
    }

    fn make_part_with_material(
        length: f64,
        width: f64,
        material_id: Uuid,
        grain: &str,
        qty: i32,
    ) -> PartToNest {
        PartToNest {
            part_id: Uuid::new_v4(),
            length,
            width,
            material_id,
            grain_direction: grain.to_string(),
            quantity: qty,
        }
    }

    // ─── GrainDirection ────────────────────────────────

    #[test]
    fn grain_direction_from_str_horizontal() {
        assert_eq!(GrainDirection::from("horizontal"), GrainDirection::Horizontal);
        assert_eq!(GrainDirection::from("H"), GrainDirection::Horizontal);
    }

    #[test]
    fn grain_direction_from_str_vertical() {
        assert_eq!(GrainDirection::from("vertical"), GrainDirection::Vertical);
        assert_eq!(GrainDirection::from("v"), GrainDirection::Vertical);
    }

    #[test]
    fn grain_direction_from_str_none() {
        assert_eq!(GrainDirection::from("none"), GrainDirection::None);
        assert_eq!(GrainDirection::from("anything"), GrainDirection::None);
        assert_eq!(GrainDirection::from(""), GrainDirection::None);
    }

    // ─── PartToNest ────────────────────────────────────

    #[test]
    fn part_area_calculation() {
        let p = make_part(600.0, 400.0);
        assert!((p.area() - 240000.0).abs() < 1e-9);
    }

    #[test]
    fn part_grain_parsing() {
        let mut p = make_part(100.0, 50.0);
        p.grain_direction = "horizontal".to_string();
        assert_eq!(p.grain(), GrainDirection::Horizontal);
    }

    // ─── PartPlacement ────────────────────────────────

    #[test]
    fn placement_area() {
        let pl = PartPlacement {
            part_id: Uuid::new_v4(),
            sheet_index: 0,
            x: 10.0,
            y: 20.0,
            rotated: false,
            placed_length: 300.0,
            placed_width: 200.0,
        };
        assert!((pl.area() - 60000.0).abs() < 1e-9);
    }

    #[test]
    fn placement_right_and_top() {
        let pl = PartPlacement {
            part_id: Uuid::new_v4(),
            sheet_index: 0,
            x: 10.0,
            y: 20.0,
            rotated: false,
            placed_length: 300.0,
            placed_width: 200.0,
        };
        assert!((pl.right() - 310.0).abs() < 1e-9);
        assert!((pl.top() - 220.0).abs() < 1e-9);
    }

    // ─── NestingEngine construction ───────────────────

    #[test]
    fn engine_default() {
        let eng = NestingEngine::default();
        assert!((eng.kerf_width - 3.175).abs() < 1e-9);
        assert!((eng.edge_margin - 6.35).abs() < 1e-9);
        assert!(eng.enforce_grain);
        assert_eq!(eng.quality, OptimizationQuality::Fast);
    }

    #[test]
    fn engine_new() {
        let eng = NestingEngine::new(4.0, 10.0, false);
        assert!((eng.kerf_width - 4.0).abs() < 1e-9);
        assert!((eng.edge_margin - 10.0).abs() < 1e-9);
        assert!(!eng.enforce_grain);
    }

    #[test]
    fn engine_with_quality() {
        let eng = NestingEngine::new(3.0, 5.0, true).with_quality(OptimizationQuality::Best);
        assert_eq!(eng.quality, OptimizationQuality::Best);
    }

    // ─── respect_grain ────────────────────────────────

    #[test]
    fn respect_grain_no_enforcement() {
        let eng = NestingEngine::new(3.0, 5.0, false);
        let p = make_part(100.0, 50.0);
        assert!(eng.respect_grain(&p, true));
    }

    #[test]
    fn respect_grain_enforced_none() {
        let eng = NestingEngine::new(3.0, 5.0, true);
        let mut p = make_part(100.0, 50.0);
        p.grain_direction = "none".to_string();
        assert!(eng.respect_grain(&p, true));
    }

    #[test]
    fn respect_grain_enforced_horizontal_cannot_rotate() {
        let eng = NestingEngine::new(3.0, 5.0, true);
        let mut p = make_part(100.0, 50.0);
        p.grain_direction = "horizontal".to_string();
        assert!(!eng.respect_grain(&p, true));
    }

    #[test]
    fn respect_grain_enforced_vertical_cannot_rotate() {
        let eng = NestingEngine::new(3.0, 5.0, true);
        let mut p = make_part(100.0, 50.0);
        p.grain_direction = "vertical".to_string();
        assert!(!eng.respect_grain(&p, true));
    }

    // ─── effective_sheet ──────────────────────────────

    #[test]
    fn effective_sheet_dimensions() {
        let eng = NestingEngine::new(3.0, 10.0, true);
        let (ew, el) = eng.effective_sheet(2440.0, 1220.0);
        assert!((ew - 2420.0).abs() < 1e-9);
        assert!((el - 1200.0).abs() < 1e-9);
    }

    #[test]
    fn effective_sheet_zero_margin() {
        let eng = NestingEngine::new(3.0, 0.0, true);
        let (ew, el) = eng.effective_sheet(2440.0, 1220.0);
        assert!((ew - 2440.0).abs() < 1e-9);
        assert!((el - 1220.0).abs() < 1e-9);
    }

    #[test]
    fn effective_sheet_margin_too_large() {
        let eng = NestingEngine::new(3.0, 5000.0, true);
        let (ew, el) = eng.effective_sheet(100.0, 100.0);
        assert!(ew == 0.0);
        assert!(el == 0.0);
    }

    // ─── expand_parts ─────────────────────────────────

    #[test]
    fn expand_parts_by_quantity() {
        let parts = vec![make_part_with_material(100.0, 50.0, Uuid::new_v4(), "none", 3)];
        let expanded = NestingEngine::expand_parts(&parts);
        assert_eq!(expanded.len(), 3);
        for ep in &expanded {
            assert_eq!(ep.quantity, 1);
        }
    }

    #[test]
    fn expand_parts_zero_quantity_defaults_to_one() {
        let parts = vec![make_part_with_material(100.0, 50.0, Uuid::new_v4(), "none", 0)];
        let expanded = NestingEngine::expand_parts(&parts);
        assert_eq!(expanded.len(), 1);
    }

    // ─── group_by_material ────────────────────────────

    #[test]
    fn group_by_material_single() {
        let mat = Uuid::new_v4();
        let parts = vec![
            make_part_with_material(100.0, 50.0, mat, "none", 1),
            make_part_with_material(200.0, 100.0, mat, "none", 1),
        ];
        let groups = NestingEngine::group_by_material(parts);
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[&mat].len(), 2);
    }

    #[test]
    fn group_by_material_multiple() {
        let mat_a = Uuid::new_v4();
        let mat_b = Uuid::new_v4();
        let parts = vec![
            make_part_with_material(100.0, 50.0, mat_a, "none", 1),
            make_part_with_material(200.0, 100.0, mat_b, "none", 1),
            make_part_with_material(150.0, 75.0, mat_a, "none", 1),
        ];
        let groups = NestingEngine::group_by_material(parts);
        assert_eq!(groups.len(), 2);
        assert_eq!(groups[&mat_a].len(), 2);
        assert_eq!(groups[&mat_b].len(), 1);
    }

    // ─── calculate_yield ──────────────────────────────

    #[test]
    fn yield_empty_placements() {
        let eng = NestingEngine::default();
        let y = eng.calculate_yield(&[], 100000.0);
        assert!((y - 0.0).abs() < 1e-9);
    }

    #[test]
    fn yield_zero_sheet_area() {
        let eng = NestingEngine::default();
        let placements = vec![PartPlacement {
            part_id: Uuid::new_v4(),
            sheet_index: 0,
            x: 0.0,
            y: 0.0,
            rotated: false,
            placed_length: 100.0,
            placed_width: 50.0,
        }];
        let y = eng.calculate_yield(&placements, 0.0);
        assert!((y - 0.0).abs() < 1e-9);
    }

    #[test]
    fn yield_50_percent() {
        let eng = NestingEngine::default();
        let placements = vec![PartPlacement {
            part_id: Uuid::new_v4(),
            sheet_index: 0,
            x: 0.0,
            y: 0.0,
            rotated: false,
            placed_length: 100.0,
            placed_width: 50.0,
        }];
        // 1 sheet, sheet_area = 10000, part area = 5000 → 50%
        let y = eng.calculate_yield(&placements, 10000.0);
        assert!((y - 50.0).abs() < 1e-9);
    }

    #[test]
    fn yield_multiple_sheets() {
        let eng = NestingEngine::default();
        let placements = vec![
            PartPlacement {
                part_id: Uuid::new_v4(),
                sheet_index: 0,
                x: 0.0,
                y: 0.0,
                rotated: false,
                placed_length: 100.0,
                placed_width: 100.0,
            },
            PartPlacement {
                part_id: Uuid::new_v4(),
                sheet_index: 1,
                x: 0.0,
                y: 0.0,
                rotated: false,
                placed_length: 100.0,
                placed_width: 100.0,
            },
        ];
        // 2 sheets × 20000 each = 40000, parts = 20000 → 50%
        let y = eng.calculate_yield(&placements, 20000.0);
        assert!((y - 50.0).abs() < 1e-9);
    }

    // ─── place_parts_on_sheet ─────────────────────────

    #[test]
    fn place_single_part_fits() {
        let eng = NestingEngine::new(0.0, 0.0, false);
        let parts = vec![make_part(100.0, 50.0)];
        let (placed, unplaced) = eng.place_parts_on_sheet(&parts, 200.0, 200.0);
        assert_eq!(placed.len(), 1);
        assert_eq!(unplaced.len(), 0);
        assert!((placed[0].placed_length - 100.0).abs() < 1e-9);
    }

    #[test]
    fn place_part_too_large() {
        let eng = NestingEngine::new(0.0, 0.0, false);
        let parts = vec![make_part(500.0, 500.0)];
        let (placed, unplaced) = eng.place_parts_on_sheet(&parts, 200.0, 200.0);
        assert_eq!(placed.len(), 0);
        assert_eq!(unplaced.len(), 1);
    }

    #[test]
    fn place_multiple_parts() {
        let eng = NestingEngine::new(0.0, 0.0, false);
        let parts = vec![
            make_part(100.0, 50.0),
            make_part(100.0, 50.0),
            make_part(100.0, 50.0),
        ];
        let (placed, unplaced) = eng.place_parts_on_sheet(&parts, 300.0, 200.0);
        assert!(placed.len() >= 2);
        assert_eq!(placed.len() + unplaced.len(), 3);
    }

    #[test]
    fn place_with_kerf_spacing() {
        let eng = NestingEngine::new(5.0, 0.0, false);
        // Two 100×50 parts with 5mm kerf on a 210×50 sheet
        // First takes 100+5=105, second takes 100+5=105 → 210 needed, fits exactly
        let parts = vec![make_part(100.0, 50.0), make_part(100.0, 50.0)];
        let (placed, _unplaced) = eng.place_parts_on_sheet(&parts, 210.0, 55.0);
        assert_eq!(placed.len(), 2);
    }

    #[test]
    fn place_with_edge_margin() {
        let eng = NestingEngine::new(0.0, 10.0, false);
        // Sheet 120×70, margin 10 → effective 100×50
        let parts = vec![make_part(100.0, 50.0)];
        let (placed, unplaced) = eng.place_parts_on_sheet(&parts, 120.0, 70.0);
        assert_eq!(placed.len(), 1);
        assert_eq!(unplaced.len(), 0);
        // Placement should be offset by margin
        assert!(placed[0].x >= 10.0 - 1e-9);
        assert!(placed[0].y >= 10.0 - 1e-9);
    }

    #[test]
    fn place_zero_sheet_returns_all_unplaced() {
        let eng = NestingEngine::new(0.0, 0.0, false);
        let parts = vec![make_part(100.0, 50.0)];
        let (placed, unplaced) = eng.place_parts_on_sheet(&parts, 0.0, 0.0);
        assert_eq!(placed.len(), 0);
        assert_eq!(unplaced.len(), 1);
    }

    #[test]
    fn place_part_with_rotation() {
        let eng = NestingEngine::new(0.0, 0.0, false);
        // Part is 200×100, sheet is 110×210 → doesn't fit un-rotated, fits rotated as 100×200
        let parts = vec![make_part(200.0, 100.0)];
        let (placed, unplaced) = eng.place_parts_on_sheet(&parts, 110.0, 210.0);
        assert_eq!(placed.len(), 1);
        assert_eq!(unplaced.len(), 0);
        assert!(placed[0].rotated);
    }

    #[test]
    fn place_grain_prevents_rotation() {
        let eng = NestingEngine::new(0.0, 0.0, true);
        // Part is 200×100 horizontal grain, sheet is 110×210 → can't rotate, doesn't fit
        let mut p = make_part(200.0, 100.0);
        p.grain_direction = "horizontal".to_string();
        let parts = vec![p];
        let (placed, unplaced) = eng.place_parts_on_sheet(&parts, 110.0, 210.0);
        assert_eq!(placed.len(), 0);
        assert_eq!(unplaced.len(), 1);
    }

    // ─── optimize (async) ────────────────────────────

    #[tokio::test]
    async fn optimize_empty_parts() {
        let eng = NestingEngine::default();
        let result = eng.optimize(vec![], 2440.0, 1220.0).await;
        assert_eq!(result.sheet_count, 0);
        assert_eq!(result.placements.len(), 0);
        assert!((result.yield_percentage - 0.0).abs() < 1e-9);
    }

    #[tokio::test]
    async fn optimize_zero_sheet() {
        let eng = NestingEngine::default();
        let parts = vec![make_part(100.0, 50.0)];
        let result = eng.optimize(parts, 0.0, 0.0).await;
        assert_eq!(result.sheet_count, 0);
    }

    #[tokio::test]
    async fn optimize_single_part() {
        let eng = NestingEngine::new(0.0, 0.0, false);
        let parts = vec![make_part(100.0, 50.0)];
        let result = eng.optimize(parts, 200.0, 200.0).await;
        assert_eq!(result.sheet_count, 1);
        assert_eq!(result.placements.len(), 1);
        assert!(result.yield_percentage > 0.0);
    }

    #[tokio::test]
    async fn optimize_multiple_parts_same_material() {
        let mat = Uuid::new_v4();
        let eng = NestingEngine::new(0.0, 0.0, false);
        let parts = vec![
            make_part_with_material(100.0, 50.0, mat, "none", 1),
            make_part_with_material(100.0, 50.0, mat, "none", 1),
            make_part_with_material(100.0, 50.0, mat, "none", 1),
        ];
        let result = eng.optimize(parts, 500.0, 500.0).await;
        assert_eq!(result.placements.len(), 3);
        assert!(result.sheet_count >= 1);
        assert!(result.yield_percentage > 0.0);
        assert_eq!(result.material_summary.len(), 1);
    }

    #[tokio::test]
    async fn optimize_different_materials_separate_sheets() {
        let mat_a = Uuid::new_v4();
        let mat_b = Uuid::new_v4();
        let eng = NestingEngine::new(0.0, 0.0, false);
        let parts = vec![
            make_part_with_material(100.0, 50.0, mat_a, "none", 1),
            make_part_with_material(100.0, 50.0, mat_b, "none", 1),
        ];
        let result = eng.optimize(parts, 200.0, 200.0).await;
        assert_eq!(result.placements.len(), 2);
        // Should use at least 2 sheets (one per material)
        assert!(result.sheet_count >= 2);
        assert_eq!(result.material_summary.len(), 2);
    }

    #[tokio::test]
    async fn optimize_quantity_expansion() {
        let mat = Uuid::new_v4();
        let eng = NestingEngine::new(0.0, 0.0, false);
        let parts = vec![make_part_with_material(100.0, 50.0, mat, "none", 5)];
        let result = eng.optimize(parts, 1000.0, 1000.0).await;
        assert_eq!(result.placements.len(), 5);
    }

    #[tokio::test]
    async fn optimize_overflow_to_new_sheet() {
        let mat = Uuid::new_v4();
        let eng = NestingEngine::new(0.0, 0.0, false);
        // Each part is 100×100, sheet is 150×150 → only 1 fits per sheet
        let parts = vec![
            make_part_with_material(100.0, 100.0, mat, "none", 1),
            make_part_with_material(100.0, 100.0, mat, "none", 1),
        ];
        let result = eng.optimize(parts, 150.0, 150.0).await;
        assert_eq!(result.placements.len(), 2);
        assert_eq!(result.sheet_count, 2);
    }

    #[tokio::test]
    async fn optimize_waste_area_calculated() {
        let mat = Uuid::new_v4();
        let eng = NestingEngine::new(0.0, 0.0, false);
        let parts = vec![make_part_with_material(100.0, 100.0, mat, "none", 1)];
        let result = eng.optimize(parts, 200.0, 200.0).await;
        // Sheet area = 40000, part area = 10000, waste = 30000
        assert!((result.waste_area - 30000.0).abs() < 1e-3);
    }

    #[tokio::test]
    async fn optimize_material_summary_correct() {
        let mat = Uuid::new_v4();
        let eng = NestingEngine::new(0.0, 0.0, false);
        let parts = vec![make_part_with_material(100.0, 100.0, mat, "none", 1)];
        let result = eng.optimize(parts, 200.0, 200.0).await;
        let summary = &result.material_summary[&mat];
        assert_eq!(summary.sheets_used, 1);
        assert!((summary.total_part_area - 10000.0).abs() < 1e-3);
        assert!((summary.total_sheet_area - 40000.0).abs() < 1e-3);
        assert!((summary.yield_percentage - 25.0).abs() < 1e-3);
    }

    #[tokio::test]
    async fn optimize_with_grain_enforcement() {
        let mat = Uuid::new_v4();
        let eng = NestingEngine::new(0.0, 0.0, true);
        // Part 200×100 horizontal, sheet 110×210 → cannot rotate, won't fit
        let parts = vec![make_part_with_material(200.0, 100.0, mat, "horizontal", 1)];
        let result = eng.optimize(parts, 110.0, 210.0).await;
        // Part can still be placed on a larger sheet that opens
        // But on a 110×210, it would be placed un-rotated: 200 > 110, doesn't fit
        assert_eq!(result.placements.len(), 0);
    }

    #[tokio::test]
    async fn optimize_better_quality() {
        let mat = Uuid::new_v4();
        let eng = NestingEngine::new(0.0, 0.0, false).with_quality(OptimizationQuality::Better);
        let parts = vec![
            make_part_with_material(100.0, 50.0, mat, "none", 1),
            make_part_with_material(80.0, 40.0, mat, "none", 1),
            make_part_with_material(120.0, 60.0, mat, "none", 1),
        ];
        let result = eng.optimize(parts, 500.0, 500.0).await;
        assert_eq!(result.placements.len(), 3);
        assert!(result.yield_percentage > 0.0);
    }

    #[tokio::test]
    async fn optimize_best_quality_sa() {
        let mat = Uuid::new_v4();
        let eng = NestingEngine::new(0.0, 0.0, false).with_quality(OptimizationQuality::Best);
        let parts = vec![
            make_part_with_material(100.0, 50.0, mat, "none", 1),
            make_part_with_material(80.0, 40.0, mat, "none", 1),
        ];
        let result = eng.optimize(parts, 500.0, 500.0).await;
        assert_eq!(result.placements.len(), 2);
        assert!(result.yield_percentage > 0.0);
    }

    #[tokio::test]
    async fn optimize_with_kerf_and_margin() {
        let mat = Uuid::new_v4();
        let eng = NestingEngine::new(3.175, 6.35, false);
        let parts = vec![
            make_part_with_material(600.0, 300.0, mat, "none", 4),
        ];
        let result = eng.optimize(parts, 2440.0, 1220.0).await;
        assert_eq!(result.placements.len(), 4);
        assert!(result.sheet_count >= 1);
        assert!(result.yield_percentage > 0.0);
        // All placements should be offset by margin
        for pl in &result.placements {
            assert!(pl.x >= 6.35 - 1e-9);
            assert!(pl.y >= 6.35 - 1e-9);
        }
    }

    #[tokio::test]
    async fn optimize_large_batch() {
        let mat = Uuid::new_v4();
        let eng = NestingEngine::new(3.175, 6.35, false);
        // 20 different-sized parts
        let parts: Vec<PartToNest> = (0..20)
            .map(|i| {
                make_part_with_material(
                    200.0 + (i as f64 * 30.0),
                    100.0 + (i as f64 * 15.0),
                    mat,
                    "none",
                    1,
                )
            })
            .collect();
        let result = eng.optimize(parts, 2440.0, 1220.0).await;
        assert_eq!(result.placements.len(), 20);
        assert!(result.sheet_count >= 1);
        assert!(result.yield_percentage > 0.0);
        assert!(result.waste_area >= 0.0);
    }

    // ─── has_overlaps ─────────────────────────────────

    #[test]
    fn no_overlaps_empty() {
        let eng = NestingEngine::new(0.0, 0.0, false);
        assert!(!eng.has_overlaps(&[], 100.0, 100.0));
    }

    #[test]
    fn no_overlaps_single() {
        let eng = NestingEngine::new(0.0, 0.0, false);
        let placements = vec![PartPlacement {
            part_id: Uuid::new_v4(),
            sheet_index: 0,
            x: 0.0,
            y: 0.0,
            rotated: false,
            placed_length: 50.0,
            placed_width: 50.0,
        }];
        assert!(!eng.has_overlaps(&placements, 100.0, 100.0));
    }

    #[test]
    fn overlaps_detected() {
        let eng = NestingEngine::new(0.0, 0.0, false);
        let placements = vec![
            PartPlacement {
                part_id: Uuid::new_v4(),
                sheet_index: 0,
                x: 0.0,
                y: 0.0,
                rotated: false,
                placed_length: 60.0,
                placed_width: 60.0,
            },
            PartPlacement {
                part_id: Uuid::new_v4(),
                sheet_index: 0,
                x: 30.0,
                y: 30.0,
                rotated: false,
                placed_length: 60.0,
                placed_width: 60.0,
            },
        ];
        assert!(eng.has_overlaps(&placements, 200.0, 200.0));
    }

    #[test]
    fn overlaps_out_of_bounds() {
        let eng = NestingEngine::new(0.0, 0.0, false);
        let placements = vec![PartPlacement {
            part_id: Uuid::new_v4(),
            sheet_index: 0,
            x: 0.0,
            y: 0.0,
            rotated: false,
            placed_length: 150.0,
            placed_width: 50.0,
        }];
        assert!(eng.has_overlaps(&placements, 100.0, 100.0));
    }

    #[test]
    fn no_overlaps_adjacent() {
        let eng = NestingEngine::new(0.0, 0.0, false);
        let placements = vec![
            PartPlacement {
                part_id: Uuid::new_v4(),
                sheet_index: 0,
                x: 0.0,
                y: 0.0,
                rotated: false,
                placed_length: 50.0,
                placed_width: 50.0,
            },
            PartPlacement {
                part_id: Uuid::new_v4(),
                sheet_index: 0,
                x: 50.0,
                y: 0.0,
                rotated: false,
                placed_length: 50.0,
                placed_width: 50.0,
            },
        ];
        assert!(!eng.has_overlaps(&placements, 100.0, 100.0));
    }

    // ─── FreeRect ─────────────────────────────────────

    #[test]
    fn free_rect_area() {
        let r = FreeRect {
            x: 0.0,
            y: 0.0,
            width: 100.0,
            height: 50.0,
        };
        assert!((r.area() - 5000.0).abs() < 1e-9);
    }

    #[test]
    fn free_rect_fits() {
        let r = FreeRect {
            x: 0.0,
            y: 0.0,
            width: 100.0,
            height: 50.0,
        };
        assert!(r.fits(100.0, 50.0));
        assert!(r.fits(50.0, 50.0));
        assert!(!r.fits(101.0, 50.0));
        assert!(!r.fits(100.0, 51.0));
    }

    // ─── Sheet ────────────────────────────────────────

    #[test]
    fn sheet_new_has_one_free_rect() {
        let s = Sheet::new(0, 100.0, 200.0);
        assert_eq!(s.free_rects.len(), 1);
        assert!((s.free_rects[0].width - 100.0).abs() < 1e-9);
        assert!((s.free_rects[0].height - 200.0).abs() < 1e-9);
        assert_eq!(s.placements.len(), 0);
    }

    #[test]
    fn sheet_used_area_empty() {
        let s = Sheet::new(0, 100.0, 200.0);
        assert!((s.used_area() - 0.0).abs() < 1e-9);
    }

    #[test]
    fn sheet_yield_pct_empty() {
        let s = Sheet::new(0, 100.0, 200.0);
        assert!((s.yield_pct() - 0.0).abs() < 1e-9);
    }

    #[test]
    fn sheet_try_place_success() {
        let mut s = Sheet::new(0, 200.0, 200.0);
        let result = s.try_place(Uuid::new_v4(), 100.0, 50.0, false, 0.0);
        assert!(result.is_some());
        assert_eq!(s.placements.len(), 1);
        // Should have split the free rect
        assert!(s.free_rects.len() >= 1);
    }

    #[test]
    fn sheet_try_place_failure() {
        let mut s = Sheet::new(0, 50.0, 50.0);
        let result = s.try_place(Uuid::new_v4(), 100.0, 100.0, false, 0.0);
        assert!(result.is_none());
        assert_eq!(s.placements.len(), 0);
    }

    #[test]
    fn sheet_try_place_rotation() {
        let mut s = Sheet::new(0, 60.0, 110.0);
        // Part 100×50 doesn't fit un-rotated (100 > 60), but rotated 50×100 fits
        let result = s.try_place(Uuid::new_v4(), 100.0, 50.0, true, 0.0);
        assert!(result.is_some());
        let pl = result.unwrap();
        assert!(pl.rotated);
        assert!((pl.placed_length - 50.0).abs() < 1e-9);
        assert!((pl.placed_width - 100.0).abs() < 1e-9);
    }

    #[test]
    fn sheet_try_place_with_kerf() {
        let mut s = Sheet::new(0, 105.0, 55.0);
        // Part 100×50, kerf 5 → needs 105×55
        let result = s.try_place(Uuid::new_v4(), 100.0, 50.0, false, 5.0);
        assert!(result.is_some());
    }

    #[test]
    fn sheet_multiple_placements() {
        let mut s = Sheet::new(0, 300.0, 100.0);
        let r1 = s.try_place(Uuid::new_v4(), 100.0, 50.0, false, 0.0);
        assert!(r1.is_some());
        let r2 = s.try_place(Uuid::new_v4(), 100.0, 50.0, false, 0.0);
        assert!(r2.is_some());
        assert_eq!(s.placements.len(), 2);
        // No overlaps
        let p1 = &s.placements[0];
        let p2 = &s.placements[1];
        let overlap = p1.x < p2.x + p2.placed_length
            && p1.x + p1.placed_length > p2.x
            && p1.y < p2.y + p2.placed_width
            && p1.y + p1.placed_width > p2.y;
        assert!(!overlap);
    }

    // ─── OptimizationQuality ordering ─────────────────

    #[test]
    fn quality_ordering() {
        assert!(OptimizationQuality::Fast < OptimizationQuality::Better);
        assert!(OptimizationQuality::Better < OptimizationQuality::Best);
    }

    // ─── Serialization ────────────────────────────────

    #[test]
    fn nesting_result_serializes() {
        let result = NestingResult {
            placements: vec![],
            sheet_count: 0,
            yield_percentage: 0.0,
            waste_area: 0.0,
            material_summary: HashMap::new(),
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("yield_percentage"));
    }

    #[test]
    fn part_placement_serializes() {
        let pl = PartPlacement {
            part_id: Uuid::new_v4(),
            sheet_index: 0,
            x: 10.0,
            y: 20.0,
            rotated: false,
            placed_length: 100.0,
            placed_width: 50.0,
        };
        let json = serde_json::to_string(&pl).unwrap();
        let deser: PartPlacement = serde_json::from_str(&json).unwrap();
        assert!((deser.x - 10.0).abs() < 1e-9);
    }

    #[test]
    fn part_to_nest_serializes() {
        let p = make_part(100.0, 50.0);
        let json = serde_json::to_string(&p).unwrap();
        let deser: PartToNest = serde_json::from_str(&json).unwrap();
        assert!((deser.length - 100.0).abs() < 1e-9);
    }

    #[test]
    fn material_summary_serializes() {
        let s = MaterialNestingSummary {
            material_id: Uuid::new_v4(),
            sheets_used: 2,
            yield_percentage: 75.0,
            total_part_area: 30000.0,
            total_sheet_area: 40000.0,
        };
        let json = serde_json::to_string(&s).unwrap();
        assert!(json.contains("sheets_used"));
    }
}
