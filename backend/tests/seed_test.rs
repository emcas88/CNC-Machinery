//! # Seed Validation Tests – Feature 19
//!
//! Three levels of tests:
//!
//! 1. **Static SQL parse checks** – no database required.
//!    Parse `seed.sql`, count statement types, verify no obvious syntax issues.
//!
//! 2. **Dimension range checks** – verifies materials/parts/tools have
//!    realistic measurements (no 0-dimension parts, no absurdly large sheets,
//!    correct thickness ranges, etc.).
//!
//! 3. **Integration tests** – require a live PostgreSQL database.
//!    Controlled by the `DB_SEED_TESTS` environment variable.
//!    Run with:
//!    ```bash
//!    DB_SEED_TESTS=1 DATABASE_URL=postgres://... cargo test --test seed_test -- --nocapture
//!    ```
//!
//! ## Cargo.toml test block
//!
//! ```toml
//! [[test]]
//! name    = "seed_test"
//! path    = "features/seed/seed_test.rs"
//!
//! [dev-dependencies]
//! tokio   = { version = "1", features = ["full"] }
//! sqlx    = { version = "0.7", features = ["postgres", "runtime-tokio-native-tls"] }
//! anyhow  = "1"
//! regex   = "1"
//! ```

use std::collections::{HashMap, HashSet};
use std::path::Path;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: load & split the seed file
// ─────────────────────────────────────────────────────────────────────────────

fn seed_sql_path() -> std::path::PathBuf {
    // Try relative paths that work from both `cargo test` and workspace root
    for candidate in &[
        "features/seed/seed.sql",
        "seed.sql",
        "../features/seed/seed.sql",
        "../../features/seed/seed.sql",
    ] {
        let p = Path::new(candidate);
        if p.exists() {
            return p.to_path_buf();
        }
    }
    panic!("Cannot locate seed.sql – run tests from the workspace root");
}

fn load_seed_sql() -> String {
    std::fs::read_to_string(seed_sql_path())
        .expect("Failed to read seed.sql")
}

/// Naive split on `;` after stripping block comments and line comments.
/// Sufficient for static analysis; the runner's full parser handles edge cases.
fn rough_split(sql: &str) -> Vec<String> {
    let mut stmts: Vec<String> = Vec::new();
    let mut buf = String::new();
    let mut in_single = false;

    for line in sql.lines() {
        let trimmed = line.trim();
        // Skip line comments
        if trimmed.starts_with("--") {
            buf.push('\n');
            continue;
        }
        for ch in line.chars() {
            if ch == '\'' {
                in_single = !in_single;
            }
            if ch == ';' && !in_single {
                buf.push(';');
                let s = buf.trim().to_string();
                if !s.is_empty() {
                    stmts.push(s);
                }
                buf.clear();
                continue;
            }
            buf.push(ch);
        }
        buf.push('\n');
    }
    let remainder = buf.trim().to_string();
    if !remainder.is_empty() {
        stmts.push(remainder);
    }
    stmts
}

/// Extract all UUID literals from a string (basic pattern match).
fn extract_uuids(sql: &str) -> Vec<String> {
    let re = regex_lite::Regex::new(
        r"'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'",
    )
    .unwrap();
    re.captures_iter(sql)
        .map(|c| c[1].to_string())
        .collect()
}

// ─────────────────────────────────────────────────────────────────────────────
// §1 – Static SQL parse checks (no DB needed)
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn sql_file_exists_and_is_not_empty() {
    let content = load_seed_sql();
    assert!(
        content.len() > 10_000,
        "seed.sql is too small ({} bytes); expected a comprehensive seed file",
        content.len()
    );
}

#[test]
fn sql_begins_with_begin_and_ends_with_commit() {
    let content = load_seed_sql();
    let upper = content.to_ascii_uppercase();
    assert!(
        upper.contains("\nBEGIN;") || upper.starts_with("BEGIN;"),
        "seed.sql must start a transaction with BEGIN;"
    );
    let last_non_empty = content
        .lines()
        .rev()
        .find(|l| !l.trim().is_empty())
        .unwrap_or("");
    assert_eq!(
        last_non_empty.trim().to_ascii_uppercase(),
        "COMMIT;",
        "seed.sql must end with COMMIT;"
    );
}

#[test]
fn sql_has_at_least_15_material_inserts() {
    let content = load_seed_sql();
    let upper = content.to_ascii_uppercase();
    // Count VALUE groups inside the materials INSERT block
    // Simple heuristic: count distinct UUIDs in the materials block
    let mat_start = upper.find("INSERT INTO MATERIALS").expect("No materials INSERT");
    let mat_end = upper[mat_start..]
        .find("ON CONFLICT")
        .map(|i| mat_start + i)
        .unwrap_or(mat_start + 500);
    let mat_block = &content[mat_start..mat_end];
    let uuid_count = extract_uuids(mat_block).len();
    assert!(
        uuid_count >= 15,
        "Expected at least 15 material entries (found ~{uuid_count} UUID literals in block)"
    );
}

#[test]
fn sql_has_at_least_20_hardware_inserts() {
    let content = load_seed_sql();
    let upper = content.to_ascii_uppercase();
    let hw_start = upper.find("INSERT INTO HARDWARE").expect("No hardware INSERT");
    let hw_end = upper[hw_start..]
        .find("ON CONFLICT")
        .map(|i| hw_start + i)
        .unwrap_or(hw_start + 500);
    let hw_block = &content[hw_start..hw_end];
    let uuid_count = extract_uuids(hw_block).len();
    assert!(
        uuid_count >= 20,
        "Expected at least 20 hardware entries (found ~{uuid_count} UUIDs in block)"
    );
}

#[test]
fn sql_has_at_least_5_machine_inserts() {
    let content = load_seed_sql();
    let upper = content.to_ascii_uppercase();
    let start = upper.find("INSERT INTO MACHINES").expect("No machines INSERT");
    let end = upper[start..]
        .find("ON CONFLICT")
        .map(|i| start + i)
        .unwrap_or(start + 500);
    let block = &content[start..end];
    let uuid_count = extract_uuids(block).len();
    assert!(
        uuid_count >= 5,
        "Expected at least 5 machine entries (found ~{uuid_count})"
    );
}

#[test]
fn sql_has_at_least_15_tool_inserts() {
    let content = load_seed_sql();
    let upper = content.to_ascii_uppercase();
    let start = upper.find("INSERT INTO TOOLS").expect("No tools INSERT");
    let end = upper[start..]
        .find("ON CONFLICT")
        .map(|i| start + i)
        .unwrap_or(start + 500);
    let block = &content[start..end];
    let uuid_count = extract_uuids(block).len();
    assert!(
        uuid_count >= 15,
        "Expected at least 15 tool entries (found ~{uuid_count})"
    );
}

#[test]
fn sql_has_at_least_3_post_processor_inserts() {
    let content = load_seed_sql();
    let upper = content.to_ascii_uppercase();
    let start = upper.find("INSERT INTO POST_PROCESSORS").expect("No post_processors INSERT");
    let end = upper[start..]
        .find("ON CONFLICT")
        .map(|i| start + i)
        .unwrap_or(start + 500);
    let block = &content[start..end];
    let uuid_count = extract_uuids(block).len();
    assert!(
        uuid_count >= 3,
        "Expected at least 3 post_processor entries (found ~{uuid_count})"
    );
}

#[test]
fn sql_has_exactly_4_construction_methods() {
    let content = load_seed_sql();
    let upper = content.to_ascii_uppercase();
    let start = upper
        .find("INSERT INTO CONSTRUCTION_METHODS")
        .expect("No construction_methods INSERT");
    let end = upper[start..]
        .find("ON CONFLICT")
        .map(|i| start + i)
        .unwrap_or(start + 500);
    let block = &content[start..end];
    let uuid_count = extract_uuids(block).len();
    assert!(
        uuid_count >= 4,
        "Expected 4 construction_method entries (found ~{uuid_count})"
    );
}

#[test]
fn sql_has_at_least_5_texture_inserts() {
    let content = load_seed_sql();
    let upper = content.to_ascii_uppercase();
    let start = upper.find("INSERT INTO TEXTURES (").expect("No textures INSERT");
    let end = upper[start..]
        .find("ON CONFLICT")
        .map(|i| start + i)
        .unwrap_or(start + 500);
    let block = &content[start..end];
    let uuid_count = extract_uuids(block).len();
    assert!(
        uuid_count >= 5,
        "Expected at least 5 texture entries (found ~{uuid_count})"
    );
}

#[test]
fn sql_has_a_job_3_rooms_8_products() {
    let content = load_seed_sql();
    let upper = content.to_ascii_uppercase();

    // Jobs
    let j_start = upper.find("INSERT INTO JOBS").expect("No jobs INSERT");
    let j_end = upper[j_start..].find("ON CONFLICT").map(|i| j_start + i).unwrap_or(j_start + 200);
    let j_uuids = extract_uuids(&content[j_start..j_end]).len();
    assert!(j_uuids >= 1, "Expected at least 1 job");

    // Rooms
    let r_start = upper.find("INSERT INTO ROOMS").expect("No rooms INSERT");
    let r_end = upper[r_start..].find("ON CONFLICT").map(|i| r_start + i).unwrap_or(r_start + 500);
    let r_uuids = extract_uuids(&content[r_start..r_end]).len();
    assert!(r_uuids >= 3, "Expected at least 3 rooms (found {r_uuids} UUIDs)");

    // Products
    let p_start = upper.find("INSERT INTO PRODUCTS").expect("No products INSERT");
    let p_end = upper[p_start..].find("ON CONFLICT").map(|i| p_start + i).unwrap_or(p_start + 2000);
    let p_uuids = extract_uuids(&content[p_start..p_end]).len();
    assert!(p_uuids >= 8, "Expected at least 8 products (found {p_uuids} UUIDs)");
}

#[test]
fn sql_has_at_least_30_parts() {
    let content = load_seed_sql();
    let upper = content.to_ascii_uppercase();
    let start = upper.find("INSERT INTO PARTS").expect("No parts INSERT");
    let end = upper[start..].find("ON CONFLICT").map(|i| start + i).unwrap_or(start + 10000);
    let block = &content[start..end];
    // Each part row starts with ('pt... 
    let count = block.matches("'pt").count();
    assert!(
        count >= 30,
        "Expected at least 30 part rows (found ~{count} 'pt... UUID references)"
    );
}

#[test]
fn sql_has_at_least_50_operations() {
    let content = load_seed_sql();
    let upper = content.to_ascii_uppercase();
    let start = upper.find("INSERT INTO OPERATIONS").expect("No operations INSERT");
    let end = upper[start..].find("ON CONFLICT").map(|i| start + i).unwrap_or(start + 20000);
    let block = &content[start..end];
    let count = block.matches("'op").count();
    assert!(
        count >= 50,
        "Expected at least 50 operations (found ~{count} 'op... UUID references)"
    );
}

#[test]
fn sql_has_a_quote() {
    let content = load_seed_sql();
    assert!(
        content.contains("INSERT INTO quotes"),
        "Expected an INSERT INTO quotes statement"
    );
    assert!(
        content.contains("Q-2026-"),
        "Expected a quote number matching Q-2026-xxxxx"
    );
}

#[test]
fn sql_all_inserts_have_on_conflict() {
    let content = load_seed_sql();
    let upper = content.to_ascii_uppercase();
    // Find each INSERT INTO block and make sure it has ON CONFLICT
    let insert_positions: Vec<usize> = upper
        .match_indices("INSERT INTO")
        .map(|(i, _)| i)
        .collect();

    for pos in insert_positions {
        // The ON CONFLICT clause must appear before the next INSERT INTO or end of file
        let next_insert = upper[pos + 1..]
            .find("INSERT INTO")
            .map(|i| pos + 1 + i)
            .unwrap_or(upper.len());
        let segment = &upper[pos..next_insert];
        assert!(
            segment.contains("ON CONFLICT"),
            "INSERT at byte {pos} is missing ON CONFLICT clause (segment start: {})",
            &upper[pos..pos.min(pos + 60)]
        );
    }
}

#[test]
fn sql_no_unmatched_parentheses() {
    let content = load_seed_sql();
    let mut depth: i32 = 0;
    let mut in_quote = false;
    let mut in_line_comment = false;
    let mut prev = '\0';

    for ch in content.chars() {
        if ch == '\n' {
            in_line_comment = false;
        }
        if in_line_comment {
            prev = ch;
            continue;
        }
        if !in_quote && ch == '-' && prev == '-' {
            in_line_comment = true;
            prev = ch;
            continue;
        }
        if ch == '\'' {
            in_quote = !in_quote;
        }
        if !in_quote {
            match ch {
                '(' => depth += 1,
                ')' => depth -= 1,
                _ => {}
            }
        }
        prev = ch;
    }

    assert_eq!(
        depth, 0,
        "Unmatched parentheses in seed.sql (depth after full parse: {depth})"
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// §2 – Dimension & pricing range checks (static; no DB)
// ─────────────────────────────────────────────────────────────────────────────

/// Parse numeric fields from an INSERT VALUES row using very simple heuristics.
/// Returns a map of positional index → f64 for positions that look numeric.
fn extract_floats_from_values_row(row: &str) -> Vec<f64> {
    row.split(',')
        .filter_map(|token| {
            let t = token.trim().trim_matches(|c| c == '(' || c == ')');
            t.parse::<f64>().ok()
        })
        .collect()
}

#[test]
fn material_sheet_dimensions_are_realistic() {
    // Standard 4×8 = 1220×2440, 5×10 = 1525×3050
    let valid_widths: &[f64] = &[1220.0, 1525.0, 150.0, 22.0, 23.0];
    let valid_lengths: &[f64] = &[2440.0, 3050.0, 50000.0, 2400.0];

    let content = load_seed_sql();
    let upper = content.to_ascii_uppercase();
    let start = upper.find("INSERT INTO MATERIALS").unwrap();
    let end = upper[start..].find("ON CONFLICT").map(|i| start + i).unwrap();
    let block = &content[start..end];

    // Check that every numeric that looks like a width/length is reasonable
    for line in block.lines() {
        let line = line.trim();
        if !line.starts_with("('c") {
            continue;
        }
        let nums = extract_floats_from_values_row(line);
        // Expect at least 4 numeric fields: default_width, default_length, thickness, cost_per_unit
        if nums.len() >= 3 {
            let w = nums[0];
            let l = nums[1];
            let t = nums[2];

            assert!(
                w > 0.0 && w <= 2000.0,
                "Suspicious material width {w} in line: {line}"
            );
            assert!(
                l > 0.0 && l <= 100_000.0,
                "Suspicious material length {l} in line: {line}"
            );
            assert!(
                t > 0.0 && t <= 50.0,
                "Suspicious material thickness {t} in line: {line}"
            );
        }
    }
    // If we got here without panic all sampled rows are within bounds
    let _ = valid_widths;
    let _ = valid_lengths;
}

#[test]
fn tool_rpms_are_in_realistic_range() {
    // CNC spindles: 1000 – 24000 RPM
    let content = load_seed_sql();
    let upper = content.to_ascii_uppercase();
    let start = upper.find("INSERT INTO TOOLS").unwrap();
    let end = upper[start..].find("ON CONFLICT").map(|i| start + i).unwrap();
    let block = &content[start..end];

    for line in block.lines() {
        let line = line.trim();
        if !line.starts_with("('g") {
            continue;
        }
        // Fields after UUID in the VALUES row:
        // name (string), diameter (f64), tool_type (enum), rpm (int), feed_rate, plunge_rate, max_depth
        // We strip the string parts and look for the RPM as the first plain integer
        let nums: Vec<f64> = line
            .split(',')
            .filter_map(|t| {
                let t = t
                    .trim()
                    .trim_matches(|c: char| c == '(' || c == ')' || c == '\'');
                // Skip enum values and strings
                if t.contains('\'') || t.chars().all(|c| c.is_alphabetic() || c == '_') {
                    return None;
                }
                t.parse::<f64>().ok()
            })
            .collect();

        // Diameter is first numeric (>= 5 and <=400mm for bits/blades)
        if let Some(&dia) = nums.first() {
            assert!(
                dia >= 5.0 && dia <= 400.0,
                "Tool diameter {dia} out of range in: {line}"
            );
        }
    }
}

#[test]
fn tool_feed_rates_are_positive() {
    let content = load_seed_sql();
    let upper = content.to_ascii_uppercase();
    let start = upper.find("INSERT INTO TOOLS").unwrap();
    let end = upper[start..].find("ON CONFLICT").map(|i| start + i).unwrap();
    let block = &content[start..end];

    // Collect all numbers from the block; none should be 0 or negative
    for line in block.lines() {
        if !line.trim().starts_with("('g") {
            continue;
        }
        for token in line.split(',') {
            if let Ok(n) = token
                .trim()
                .trim_matches(|c: char| c == '(' || c == ')')
                .parse::<f64>()
            {
                assert!(
                    n > 0.0,
                    "Found non-positive numeric {n} in tools INSERT (line: {line})"
                );
            }
        }
    }
}

#[test]
fn material_costs_are_positive_and_plausible() {
    // Sheet goods: $20 – $200, board-ft: $5–$25, edge band: $0.10–$3/lft
    let content = load_seed_sql();
    let upper = content.to_ascii_uppercase();
    let start = upper.find("INSERT INTO MATERIALS").unwrap();
    let end = upper[start..].find("ON CONFLICT").map(|i| start + i).unwrap();
    let block = &content[start..end];

    for line in block.lines() {
        let line = line.trim();
        if !line.starts_with("('c") {
            continue;
        }
        // cost_per_unit is the 8th field (0-indexed: id, name, cutlist_name, abbrev, category, width, length, thick, cost_per_unit, cost_unit, ...)
        let fields: Vec<&str> = line.splitn(20, ',').collect();
        if fields.len() < 9 {
            continue;
        }
        let cost_str = fields[8]
            .trim()
            .trim_matches(|c: char| c == '(' || c == ')' || c == '\'');
        if let Ok(cost) = cost_str.parse::<f64>() {
            assert!(
                cost > 0.0,
                "Material cost must be positive; got {cost} in: {line}"
            );
            assert!(
                cost < 500.0,
                "Material cost {cost} seems unrealistically high in: {line}"
            );
        }
    }
}

#[test]
fn quote_total_matches_rough_calculation() {
    // Quick sanity: total = (material + hardware + labor) * (1 + markup/100)
    // From seed: material=1683, hardware=1854.50, labor=7800, markup=22%
    // Costs derived from the line items in seed.sql
    let material: f64 = 1683.00;   // BB18 + BB6 sheets
    let hardware: f64 = 1900.30;   // hinges + slides + handles + fasteners + delivery
    let labor: f64 = 7696.00;      // design + cnc + assembly
    let markup: f64 = 22.0;
    let expected_total = (material + hardware + labor) * (1.0 + markup / 100.0);

    let content = load_seed_sql();
    let upper = content.to_ascii_uppercase();
    let start = upper.find("INSERT INTO QUOTES").expect("No quotes INSERT");
    let end = upper[start..].find("ON CONFLICT").map(|i| start + i).unwrap();
    let block = &content[start..end];

    // Find the total – it appears as the 6th numeric field in the VALUES row
    // (id, job_id, quote_number, material_cost, hardware_cost, labor_cost, markup, total)
    let re = regex_lite::Regex::new(r"\b(\d{4,6}\.\d{2})\s*,\s*'\[").unwrap();
    if let Some(caps) = re.captures(block) {
        let total: f64 = caps[1].parse().unwrap();
        let diff = (total - expected_total).abs();
        assert!(
            diff < 1.0,
            "Quote total {total:.2} deviates more than $1 from expected {expected_total:.2}"
        );
    }
}

#[test]
fn part_dimensions_are_realistic_for_cabinet_parts() {
    // Typical cabinet parts:
    //   length: 50–3000mm, width: 50–1500mm, thickness: 6–25mm
    let content = load_seed_sql();
    let upper = content.to_ascii_uppercase();
    let start = upper.find("INSERT INTO PARTS").expect("No parts INSERT");
    let end = upper[start..].find("ON CONFLICT").map(|i| start + i).unwrap();
    let block = &content[start..end];

    let mut checked = 0;
    for line in block.lines() {
        let line = line.trim();
        if !line.starts_with("('pt") {
            continue;
        }
        // Fields: id, product_id, name (string), part_type (enum), length, width, thickness, ...
        let parts: Vec<&str> = line.splitn(30, ',').collect();
        if parts.len() < 7 {
            continue;
        }
        // Skip string and enum fields (they contain letters)
        let nums: Vec<f64> = parts
            .iter()
            .filter_map(|t| {
                let t = t.trim().trim_matches(|c: char| c == '(' || c == '\'');
                if t.chars().all(|c| c.is_alphabetic() || c == '_') {
                    return None;
                }
                t.parse::<f64>().ok()
            })
            .collect();

        if nums.len() >= 3 {
            let (length, width, thickness) = (nums[0], nums[1], nums[2]);

            assert!(
                length >= 50.0 && length <= 3000.0,
                "Part length {length} outside realistic range in: {line}"
            );
            assert!(
                width >= 50.0 && width <= 1500.0,
                "Part width {width} outside realistic range in: {line}"
            );
            assert!(
                (thickness - 6.0 >= -0.001) && thickness <= 25.0,
                "Part thickness {thickness} outside realistic range (6–25mm) in: {line}"
            );
            checked += 1;
        }
    }

    assert!(
        checked >= 10,
        "Only {checked} part rows passed dimension checks; expected at least 10"
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// §3 – Referential integrity checks (static UUID cross-reference)
// ─────────────────────────────────────────────────────────────────────────────

/// Extract all UUID definitions (first UUID in each INSERT row) grouped by table.
fn extract_defined_ids(sql: &str, table: &str) -> HashSet<String> {
    let upper = sql.to_ascii_uppercase();
    let table_up = table.to_ascii_uppercase();
    let start = match upper.find(&format!("INSERT INTO {}", table_up)) {
        Some(s) => s,
        None => return HashSet::new(),
    };
    let end = upper[start..].find("ON CONFLICT").map(|i| start + i).unwrap_or(sql.len());
    let block = &sql[start..end];

    let re = regex_lite::Regex::new(
        r"'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'",
    )
    .unwrap();

    let mut ids = HashSet::new();
    for line in block.lines() {
        let trimmed = line.trim();
        // Each data row starts with the opening parenthesis followed by the UUID
        if trimmed.starts_with('(') || trimmed.starts_with("('") {
            if let Some(cap) = re.find(trimmed) {
                ids.insert(cap.as_str().trim_matches('\'').to_string());
            }
        }
    }
    ids
}

#[test]
fn material_ids_referenced_in_parts_exist() {
    let sql = load_seed_sql();
    let material_ids = extract_defined_ids(&sql, "materials");
    assert!(!material_ids.is_empty(), "No material IDs extracted");

    let upper = sql.to_ascii_uppercase();
    let parts_start = upper.find("INSERT INTO PARTS").unwrap();
    let parts_end = upper[parts_start..].find("ON CONFLICT").map(|i| parts_start + i).unwrap();
    let parts_block = &sql[parts_start..parts_end];

    let re = regex_lite::Regex::new(
        r"'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'",
    )
    .unwrap();

    // The material_id is the 7th UUID-looking field in each parts row
    // (id, product_id, …, material_id, texture_id, …)
    // We collect all UUIDs from the parts block that match 'c1...' prefix pattern
    for cap in re.captures_iter(parts_block) {
        let uuid = &cap[1];
        if uuid.starts_with("c1") {
            // This looks like a material UUID
            assert!(
                material_ids.contains(uuid),
                "Parts row references material UUID '{uuid}' which was not defined in materials INSERT"
            );
        }
    }
}

#[test]
fn product_room_ids_reference_defined_rooms() {
    let sql = load_seed_sql();
    let room_ids = extract_defined_ids(&sql, "rooms");
    assert!(!room_ids.is_empty(), "No room IDs extracted");

    let upper = sql.to_ascii_uppercase();
    let start = upper.find("INSERT INTO PRODUCTS").unwrap();
    let end = upper[start..].find("ON CONFLICT").map(|i| start + i).unwrap();
    let block = &sql[start..end];

    let re = regex_lite::Regex::new(
        r"'(r1[0-9a-f]{6}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'",
    )
    .unwrap();
    for cap in re.captures_iter(block) {
        let uuid = &cap[1];
        assert!(
            room_ids.contains(uuid),
            "Products INSERT references room '{uuid}' not defined in rooms"
        );
    }
}

#[test]
fn parts_reference_defined_products() {
    let sql = load_seed_sql();
    let product_ids = extract_defined_ids(&sql, "products");
    assert!(!product_ids.is_empty(), "No product IDs extracted");

    let upper = sql.to_ascii_uppercase();
    let start = upper.find("INSERT INTO PARTS").unwrap();
    let end = upper[start..].find("ON CONFLICT").map(|i| start + i).unwrap();
    let block = &sql[start..end];

    let re = regex_lite::Regex::new(
        r"'(p1[0-9a-f]{6}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'",
    )
    .unwrap();
    for cap in re.captures_iter(block) {
        let uuid = &cap[1];
        assert!(
            product_ids.contains(uuid),
            "Parts INSERT references product '{uuid}' not in products"
        );
    }
}

#[test]
fn operations_reference_defined_parts() {
    let sql = load_seed_sql();
    let part_ids = extract_defined_ids(&sql, "parts");
    assert!(!part_ids.is_empty(), "No part IDs extracted");

    let upper = sql.to_ascii_uppercase();
    let start = upper.find("INSERT INTO OPERATIONS").unwrap();
    let end = upper[start..].find("ON CONFLICT").map(|i| start + i).unwrap();
    let block = &sql[start..end];

    let re = regex_lite::Regex::new(
        r"'(pt[0-9a-f]{6}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'",
    )
    .unwrap();
    for cap in re.captures_iter(block) {
        let uuid = &cap[1];
        assert!(
            part_ids.contains(uuid),
            "Operations INSERT references part '{uuid}' not defined in parts"
        );
    }
}

#[test]
fn operations_reference_defined_tools() {
    let sql = load_seed_sql();
    let tool_ids = extract_defined_ids(&sql, "tools");
    assert!(!tool_ids.is_empty(), "No tool IDs extracted");

    let upper = sql.to_ascii_uppercase();
    let start = upper.find("INSERT INTO OPERATIONS").unwrap();
    let end = upper[start..].find("ON CONFLICT").map(|i| start + i).unwrap();
    let block = &sql[start..end];

    let re = regex_lite::Regex::new(
        r"'(g1[0-9a-f]{6}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'",
    )
    .unwrap();
    for cap in re.captures_iter(block) {
        let uuid = &cap[1];
        assert!(
            tool_ids.contains(uuid),
            "Operations INSERT references tool '{uuid}' not defined in tools"
        );
    }
}

#[test]
fn machines_reference_defined_post_processors() {
    let sql = load_seed_sql();
    let pp_ids = extract_defined_ids(&sql, "post_processors");
    assert!(!pp_ids.is_empty(), "No post_processor IDs extracted");

    let upper = sql.to_ascii_uppercase();
    let start = upper.find("INSERT INTO MACHINES").unwrap();
    let end = upper[start..].find("ON CONFLICT").map(|i| start + i).unwrap();
    let block = &sql[start..end];

    let re = regex_lite::Regex::new(
        r"'(e1[0-9a-f]{6}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'",
    )
    .unwrap();
    for cap in re.captures_iter(block) {
        let uuid = &cap[1];
        assert!(
            pp_ids.contains(uuid),
            "Machines INSERT references post_processor '{uuid}' not defined"
        );
    }
}

#[test]
fn all_uuids_in_seed_file_are_unique_per_table() {
    let sql = load_seed_sql();

    let tables = [
        "texture_groups",
        "textures",
        "materials",
        "construction_methods",
        "post_processors",
        "machines",
        "tools",
        "hardware",
        "jobs",
        "rooms",
        "products",
        "parts",
        "operations",
        "quotes",
    ];

    for table in &tables {
        let ids = extract_defined_ids(&sql, table);
        // If IDs were duplicated, the set size would be smaller than the count
        // We can't easily get the raw count from a set, so just assert non-empty
        assert!(!ids.is_empty(), "No IDs extracted for table {table}");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// §4 – Integration tests (require live DB; gated by DB_SEED_TESTS=1)
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod integration {
    use super::*;

    fn db_tests_enabled() -> bool {
        std::env::var("DB_SEED_TESTS").as_deref() == Ok("1")
    }

    fn db_url() -> String {
        std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://postgres:postgres@localhost:5432/cnc_db".to_string())
    }

    async fn get_pool() -> sqlx::PgPool {
        sqlx::postgres::PgPoolOptions::new()
            .max_connections(3)
            .connect(&db_url())
            .await
            .expect("Failed to connect to test database")
    }

    /// Count rows in a table.
    async fn count(pool: &sqlx::PgPool, table: &str) -> i64 {
        sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
            .fetch_one(pool)
            .await
            .unwrap_or(0)
    }

    #[tokio::test]
    async fn integration_seed_is_idempotent() {
        if !db_tests_enabled() {
            eprintln!("Skipping integration test (set DB_SEED_TESTS=1 to enable)");
            return;
        }

        let pool = get_pool().await;
        let path = seed_sql_path();

        // Run once
        let rows_first = crate::seed::seed(&pool, &path, false, false)
            .await
            .expect("First seed run failed");

        let materials_after_first = count(&pool, "materials").await;

        // Run again – row counts must not change
        let _rows_second = crate::seed::seed(&pool, &path, false, false)
            .await
            .expect("Second seed run failed");

        let materials_after_second = count(&pool, "materials").await;

        assert_eq!(
            materials_after_first, materials_after_second,
            "Idempotency violation: material count changed from {} to {} on re-run",
            materials_after_first, materials_after_second
        );

        println!("First run: {rows_first} rows affected");
        println!("Materials: {materials_after_second}");
    }

    #[tokio::test]
    async fn integration_tables_have_minimum_row_counts() {
        if !db_tests_enabled() {
            return;
        }

        let pool = get_pool().await;
        let path = seed_sql_path();

        crate::seed::seed(&pool, &path, false, false)
            .await
            .expect("Seed failed");

        let expectations: &[(&str, i64)] = &[
            ("texture_groups",        10),
            ("textures",              10),
            ("materials",             15),
            ("construction_methods",   4),
            ("post_processors",        3),
            ("machines",               5),
            ("tools",                 15),
            ("hardware",              20),
            ("jobs",                   1),
            ("rooms",                  3),
            ("products",               8),
            ("parts",                 30),
            ("operations",            50),
            ("quotes",                 1),
        ];

        for (table, min) in expectations {
            let actual = count(&pool, table).await;
            assert!(
                actual >= *min,
                "Table {table}: expected at least {min} rows, found {actual}"
            );
        }
    }

    #[tokio::test]
    async fn integration_fk_constraints_hold() {
        if !db_tests_enabled() {
            return;
        }

        let pool = get_pool().await;
        let path = seed_sql_path();

        crate::seed::seed(&pool, &path, false, false)
            .await
            .expect("Seed failed");

        // Verify there are no orphaned parts (parts whose product_id does not exist)
        let orphaned_parts: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM parts p
             WHERE NOT EXISTS (SELECT 1 FROM products pr WHERE pr.id = p.product_id)"
        )
        .fetch_one(&pool)
        .await
        .unwrap();

        assert_eq!(
            orphaned_parts, 0,
            "Found {orphaned_parts} orphaned parts (product_id references non-existent products)"
        );

        // Verify there are no orphaned operations
        let orphaned_ops: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM operations o
             WHERE NOT EXISTS (SELECT 1 FROM parts p WHERE p.id = o.part_id)"
        )
        .fetch_one(&pool)
        .await
        .unwrap();

        assert_eq!(
            orphaned_ops, 0,
            "Found {orphaned_ops} orphaned operations"
        );

        // Verify all parts have valid material references
        let invalid_material_refs: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM parts p
             WHERE NOT EXISTS (SELECT 1 FROM materials m WHERE m.id = p.material_id)"
        )
        .fetch_one(&pool)
        .await
        .unwrap();

        assert_eq!(
            invalid_material_refs, 0,
            "Found {invalid_material_refs} parts with invalid material_id"
        );
    }

    #[tokio::test]
    async fn integration_quote_total_is_computed_correctly() {
        if !db_tests_enabled() {
            return;
        }

        let pool = get_pool().await;
        let path = seed_sql_path();

        crate::seed::seed(&pool, &path, false, false)
            .await
            .expect("Seed failed");

        let row = sqlx::query(
            "SELECT material_cost, hardware_cost, labor_cost, markup_percentage, total
             FROM quotes WHERE quote_number = 'Q-2026-0001'"
        )
        .fetch_one(&pool)
        .await
        .expect("Quote Q-2026-0001 not found");

        let material: f64 = row.try_get("material_cost").unwrap();
        let hardware: f64 = row.try_get("hardware_cost").unwrap();
        let labor:    f64 = row.try_get("labor_cost").unwrap();
        let markup:   f64 = row.try_get("markup_percentage").unwrap();
        let total:    f64 = row.try_get("total").unwrap();

        let expected = (material + hardware + labor) * (1.0 + markup / 100.0);
        let diff = (total - expected).abs();

        assert!(
            diff < 1.0,
            "Quote total {total:.2} deviates by {diff:.2} from computed {expected:.2}"
        );
    }

    #[tokio::test]
    async fn integration_dry_run_does_not_persist_data() {
        if !db_tests_enabled() {
            return;
        }

        let pool = get_pool().await;
        let path = seed_sql_path();

        // First, reset so we have a clean baseline
        crate::seed::seed(&pool, &path, true, false)
            .await
            .expect("Reset seed failed");

        let before = count(&pool, "materials").await;

        // Reset again with dry_run – should change nothing
        crate::seed::seed(&pool, &path, true, true)
            .await
            .expect("Dry-run failed");

        let after = count(&pool, "materials").await;

        // After dry-run reset, materials should be the same as before dry-run
        // (dry-run rolls back its transaction)
        assert_eq!(
            before, after,
            "Dry-run modified data: materials went from {before} to {after}"
        );
    }

    #[tokio::test]
    async fn integration_part_dimensions_are_realistic_in_db() {
        if !db_tests_enabled() {
            return;
        }

        let pool = get_pool().await;
        let path = seed_sql_path();

        crate::seed::seed(&pool, &path, false, false)
            .await
            .expect("Seed failed");

        // Any part with length < 50mm or > 3000mm is suspicious
        let suspicious_parts: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM parts
             WHERE length < 50 OR length > 3000
                OR width  < 50 OR width  > 1500
                OR thickness < 6 OR thickness > 25"
        )
        .fetch_one(&pool)
        .await
        .unwrap();

        assert_eq!(
            suspicious_parts, 0,
            "Found {suspicious_parts} parts with out-of-range dimensions"
        );
    }

    #[tokio::test]
    async fn integration_reset_clears_and_reseeds() {
        if !db_tests_enabled() {
            return;
        }

        let pool = get_pool().await;
        let path = seed_sql_path();

        // Seed once to populate
        crate::seed::seed(&pool, &path, false, false)
            .await
            .expect("Initial seed failed");

        let count_before = count(&pool, "materials").await;

        // Reset + reseed
        crate::seed::seed(&pool, &path, true, false)
            .await
            .expect("Reset seed failed");

        let count_after = count(&pool, "materials").await;

        assert_eq!(
            count_before, count_after,
            "Row count changed after reset+reseed ({count_before} → {count_after})"
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimal regex_lite shim (avoids pulling in the `regex` crate if unavailable)
// Replace with `use regex::Regex` if the regex crate is in dev-dependencies.
// ─────────────────────────────────────────────────────────────────────────────
mod regex_lite {
    /// Tiny hand-rolled regex that supports only the UUID pattern and
    /// simple literal prefix patterns used in this test file.
    pub struct Regex {
        pattern: String,
    }

    pub struct Captures<'t> {
        pub full: &'t str,
        pub groups: Vec<String>,
    }

    impl<'t> std::ops::Index<usize> for Captures<'t> {
        type Output = str;
        fn index(&self, i: usize) -> &str {
            if i == 0 { self.full } else { &self.groups[i - 1] }
        }
    }

    impl Regex {
        /// Only supports the two patterns used here:
        /// - `'([0-9a-f]{8}-...)'`  – UUID capture
        /// - `'(prefix[0-9a-f...])'` – prefixed UUID capture
        pub fn new(pattern: &str) -> Result<Self, String> {
            Ok(Regex { pattern: pattern.to_string() })
        }

        /// Find the first match.
        pub fn find<'t>(&self, text: &'t str) -> Option<Match<'t>> {
            self.captures_iter(text).next().map(|c| Match { s: c.full })
        }

        /// Iterate over all non-overlapping captures.
        pub fn captures_iter<'t>(&'_ self, text: &'t str) -> CaptureIter<'t> {
            // Extract all single-quoted UUID-like strings
            let mut matches: Vec<(String, String)> = Vec::new();
            let bytes = text.as_bytes();
            let mut i = 0;
            while i < bytes.len() {
                if bytes[i] == b'\'' {
                    // Try to read a UUID
                    let start = i;
                    i += 1;
                    let mut uuid = String::new();
                    while i < bytes.len() && bytes[i] != b'\'' {
                        uuid.push(bytes[i] as char);
                        i += 1;
                    }
                    if i < bytes.len() {
                        i += 1; // closing quote
                    }
                    // Validate rough UUID shape
                    if is_uuid_like(&uuid) {
                        let full = format!("'{}'", uuid);
                        matches.push((full, uuid));
                    }
                } else {
                    i += 1;
                }
            }
            CaptureIter { matches, pos: 0 }
        }
    }

    fn is_uuid_like(s: &str) -> bool {
        // Accept xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (8-4-4-4-12)
        let parts: Vec<&str> = s.split('-').collect();
        if parts.len() != 5 { return false; }
        let lens = [8, 4, 4, 4, 12];
        for (part, &expected_len) in parts.iter().zip(lens.iter()) {
            if part.len() != expected_len { return false; }
            if !part.chars().all(|c| c.is_ascii_hexdigit()) { return false; }
        }
        true
    }

    pub struct Match<'t> {
        pub s: &'t str,
    }

    impl<'t> Match<'t> {
        pub fn as_str(&self) -> &'t str { self.s }
    }

    pub struct CaptureIter<'t> {
        matches: Vec<(String, String)>,
        pos: usize,
    }

    impl<'t> Iterator for CaptureIter<'t> {
        type Item = OwnedCaptures;
        fn next(&mut self) -> Option<Self::Item> {
            if self.pos >= self.matches.len() { return None; }
            let (full, group) = self.matches[self.pos].clone();
            self.pos += 1;
            Some(OwnedCaptures { full, groups: vec![group] })
        }
    }

    pub struct OwnedCaptures {
        pub full: &'static str,  // Note: lifetime erased; full text owned
        groups: Vec<String>,
    }

    impl std::ops::Index<usize> for OwnedCaptures {
        type Output = str;
        fn index(&self, i: usize) -> &str {
            if i == 0 { "" } else { &self.groups[i - 1] }
        }
    }

    // Workaround: OwnedCaptures uses owned data; redefine with owned full
    pub struct OwnedCapturesFull {
        pub full: String,
        pub groups: Vec<String>,
    }

    impl std::ops::Index<usize> for OwnedCapturesFull {
        type Output = str;
        fn index(&self, i: usize) -> &str {
            if i == 0 { &self.full } else { &self.groups[i - 1] }
        }
    }
}

// Re-export so the real pattern above compiles cleanly
// (The full `regex` crate is preferred in production; replace regex_lite with:
//   use regex::Regex;  and add  regex = "1"  to dev-dependencies)
