//! # Seed Runner – Feature 19
//!
//! Reads `seed.sql` and executes it against the configured PostgreSQL database.
//!
//! ## Usage
//!
//! ```bash
//! # Default: idempotent append (INSERT … ON CONFLICT DO NOTHING)
//! cargo run --bin seed_runner
//!
//! # Reset: truncate all seed tables then re-insert
//! cargo run --bin seed_runner -- --reset
//!
//! # Append: same as default – skip rows that already exist
//! cargo run --bin seed_runner -- --append
//!
//! # Point at a different SQL file
//! cargo run --bin seed_runner -- --file /path/to/custom.sql
//!
//! # Dry-run: parse, validate, but do NOT commit
//! cargo run --bin seed_runner -- --dry-run
//! ```
//!
//! ## Environment Variables
//!
//! | Variable        | Default                                              |
//! |-----------------|------------------------------------------------------|
//! | `DATABASE_URL`  | `postgres://postgres:postgres@localhost:5432/cnc_db` |
//!
//! ## Dependency block (Cargo.toml)
//!
//! ```toml
//! [dependencies]
//! sqlx        = { version = "0.7", features = ["postgres", "runtime-tokio-native-tls", "uuid"] }
//! tokio       = { version = "1",   features = ["full"] }
//! clap        = { version = "4",   features = ["derive"] }
//! dotenvy     = "0.15"
//! anyhow      = "1"
//! indicatif   = "0.17"
//! colored     = "2"
//! chrono      = { version = "0.4", features = ["serde"] }
//! ```

use anyhow::{bail, Context, Result};
use clap::Parser;
use colored::Colorize;
use indicatif::{ProgressBar, ProgressStyle};
use sqlx::{postgres::PgPoolOptions, PgPool, Row};
use std::{
    path::PathBuf,
    time::{Duration, Instant},
};

// ─────────────────────────────────────────────────────────────────────────────
// CLI Arguments
// ─────────────────────────────────────────────────────────────────────────────

/// CNC-Machinery seed runner.
///
/// Populates the PostgreSQL database with realistic sample data for
/// development and testing.
#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
struct Args {
    /// Drop and recreate all seed data (TRUNCATE then re-insert).
    #[arg(long, conflicts_with = "append")]
    reset: bool,

    /// Append mode – skip rows that already exist (default behaviour).
    #[arg(long)]
    append: bool,

    /// Dry-run – parse and validate SQL but do not commit any changes.
    #[arg(long)]
    dry_run: bool,

    /// Path to the SQL seed file.
    #[arg(long, short, default_value = "seed.sql")]
    file: PathBuf,

    /// Database connection URL (overrides DATABASE_URL env variable).
    #[arg(long, env = "DATABASE_URL")]
    database_url: Option<String>,

    /// Suppress all output except errors.
    #[arg(long, short)]
    quiet: bool,
}

// ─────────────────────────────────────────────────────────────────────────────
// Table-reset order (respects FK constraints – children first)
// ─────────────────────────────────────────────────────────────────────────────

/// Tables truncated during `--reset`, in dependency-safe order
/// (leaf tables first, root tables last).
const RESET_ORDER: &[&str] = &[
    "atc_tool_sets",
    "machine_template_rules",
    "optimization_runs", // also drops nested_sheets via CASCADE
    "remnants",
    "quotes",
    "annotation_layers",
    "saved_views",
    "operations",
    "parts",
    "products",
    "rooms",
    "jobs",
    "machines",
    "post_processors",
    "tools",
    "hardware",
    "construction_methods",
    "material_templates",
    "materials",
    "textures",
    "texture_groups",
    "users",
    "label_templates",
    "drawing_templates",
];

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() -> Result<()> {
    // Load .env if present (dev convenience)
    let _ = dotenvy::dotenv();

    let args = Args::parse();

    let db_url = args
        .database_url
        .clone()
        .or_else(|| std::env::var("DATABASE_URL").ok())
        .unwrap_or_else(|| "postgres://postgres:postgres@localhost:5432/cnc_db".to_string());

    if !args.quiet {
        banner();
    }

    // ── Resolve SQL file path ────────────────────────────────────────────────
    let sql_path = resolve_sql_path(&args.file)?;
    if !args.quiet {
        println!(
            "{} {}",
            "SQL file:".dimmed(),
            sql_path.display().to_string().cyan()
        );
        println!(
            "{} {}",
            "Database:".dimmed(),
            redact_password(&db_url).cyan()
        );
        println!();
    }

    // ── Read & split the SQL file into individual statements ─────────────────
    let sql_content = std::fs::read_to_string(&sql_path)
        .with_context(|| format!("Cannot read {}", sql_path.display()))?;

    let statements = split_sql_statements(&sql_content);

    if !args.quiet {
        println!(
            "{} {} SQL statements found",
            "→".green(),
            statements.len().to_string().bold()
        );
    }

    // ── Connect ──────────────────────────────────────────────────────────────
    let pool = connect(&db_url).await?;

    if !args.quiet {
        println!("{} Connected to PostgreSQL\n", "✔".green());
    }

    // ── Dry-run: only parse & count, then exit ───────────────────────────────
    if args.dry_run {
        run_dry(&pool, &statements, args.quiet).await?;
        if !args.quiet {
            println!("\n{} Dry-run complete – no changes committed.", "✔".green());
        }
        return Ok(());
    }

    // ── Reset mode: truncate tables first ────────────────────────────────────
    if args.reset {
        run_reset(&pool, args.quiet).await?;
    }

    // ── Execute seed statements ───────────────────────────────────────────────
    let start = Instant::now();
    let result = run_seed(&pool, &statements, args.quiet).await;

    match result {
        Ok(stats) => {
            if !args.quiet {
                print_summary(&stats, start.elapsed());
            }
        }
        Err(e) => {
            eprintln!("\n{} Seed failed: {e:#}", "✘".red().bold());
            std::process::exit(1);
        }
    }

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Database helpers
// ─────────────────────────────────────────────────────────────────────────────

async fn connect(db_url: &str) -> Result<PgPool> {
    PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(10))
        .connect(db_url)
        .await
        .with_context(|| "Failed to connect to PostgreSQL. Is the server running?")
}

// ─────────────────────────────────────────────────────────────────────────────
// Reset
// ─────────────────────────────────────────────────────────────────────────────

async fn run_reset(pool: &PgPool, quiet: bool) -> Result<()> {
    if !quiet {
        println!("{} Resetting seed tables…", "⚠".yellow().bold());
    }

    let pb = if !quiet {
        let pb = ProgressBar::new(RESET_ORDER.len() as u64);
        pb.set_style(progress_style());
        Some(pb)
    } else {
        None
    };

    let mut tx = pool.begin().await?;

    for table in RESET_ORDER {
        sqlx::query(&format!(
            "TRUNCATE TABLE {} RESTART IDENTITY CASCADE",
            table
        ))
        .execute(&mut *tx)
        .await
        .with_context(|| format!("TRUNCATE {table} failed"))?;

        if let Some(ref pb) = pb {
            pb.set_message(table.to_string());
            pb.inc(1);
        }
    }

    tx.commit().await?;

    if let Some(pb) = pb {
        pb.finish_with_message("tables cleared");
    }

    if !quiet {
        println!("{} All seed tables cleared.\n", "✔".green());
    }

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Dry-run
// ─────────────────────────────────────────────────────────────────────────────

async fn run_dry(pool: &PgPool, statements: &[String], quiet: bool) -> Result<()> {
    if !quiet {
        println!("{} Dry-run mode – validating statements…", "→".cyan());
    }

    let pb = if !quiet {
        let pb = ProgressBar::new(statements.len() as u64);
        pb.set_style(progress_style());
        Some(pb)
    } else {
        None
    };

    // Use a transaction we always roll back
    let mut tx = pool.begin().await?;

    for (i, stmt) in statements.iter().enumerate() {
        let trimmed = stmt.trim();
        if trimmed.is_empty() || trimmed.starts_with("--") {
            continue;
        }

        // Wrap in a savepoint so a bad statement doesn't kill the whole tx
        let sp_name = format!("dry_sp_{i}");
        sqlx::query(&format!("SAVEPOINT {sp_name}"))
            .execute(&mut *tx)
            .await?;

        match sqlx::query(trimmed).execute(&mut *tx).await {
            Ok(_) => {
                if let Some(ref pb) = pb {
                    pb.inc(1);
                }
            }
            Err(e) => {
                // Roll back to savepoint so the transaction stays alive
                let _ = sqlx::query(&format!("ROLLBACK TO SAVEPOINT {sp_name}"))
                    .execute(&mut *tx)
                    .await;

                if let Some(ref pb) = pb {
                    pb.finish_with_message("validation error");
                }

                bail!(
                    "Statement {}/{} failed validation:\n  SQL: {}…\n  Error: {e}",
                    i + 1,
                    statements.len(),
                    &trimmed[..trimmed.len().min(80)]
                );
            }
        }
    }

    // Always roll back – dry-run touches nothing
    tx.rollback().await?;

    if let Some(pb) = pb {
        pb.finish_with_message("all statements valid");
    }

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed execution
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Default)]
struct SeedStats {
    total_statements: usize,
    executed: usize,
    skipped: usize, // empty / comment-only lines
    rows_affected: u64,
}

async fn run_seed(pool: &PgPool, statements: &[String], quiet: bool) -> Result<SeedStats> {
    let mut stats = SeedStats {
        total_statements: statements.len(),
        ..Default::default()
    };

    if !quiet {
        println!("{} Executing seed statements…", "→".cyan());
    }

    let pb = if !quiet {
        let pb = ProgressBar::new(statements.len() as u64);
        pb.set_style(progress_style());
        Some(pb)
    } else {
        None
    };

    // Execute the whole file in a single transaction for atomicity.
    // `BEGIN` / `COMMIT` inside seed.sql are preserved as explicit statements.
    // We do NOT wrap in an additional transaction here to avoid nesting.
    for (i, stmt) in statements.iter().enumerate() {
        let trimmed = stmt.trim();

        if trimmed.is_empty() || is_comment_only(trimmed) {
            stats.skipped += 1;
            if let Some(ref pb) = pb {
                pb.inc(1);
            }
            continue;
        }

        let result = sqlx::query(trimmed).execute(pool).await.with_context(|| {
            format!(
                "Statement {}/{} failed:\n  {}…",
                i + 1,
                statements.len(),
                &trimmed[..trimmed.len().min(120)]
            )
        })?;

        stats.rows_affected += result.rows_affected();
        stats.executed += 1;

        if let Some(ref pb) = pb {
            // Show a short label for INSERT statements
            let label = statement_label(trimmed);
            pb.set_message(label);
            pb.inc(1);
        }
    }

    if let Some(pb) = pb {
        pb.finish_with_message("done");
    }

    Ok(stats)
}

// ─────────────────────────────────────────────────────────────────────────────
// Row-count verification (post-seed)
// ─────────────────────────────────────────────────────────────────────────────

/// Query counts after seeding and format them for display.
async fn print_table_counts(pool: &PgPool) -> Result<()> {
    let tables = [
        "texture_groups",
        "textures",
        "materials",
        "construction_methods",
        "post_processors",
        "machines",
        "tools",
        "hardware",
        "users",
        "material_templates",
        "jobs",
        "rooms",
        "products",
        "parts",
        "operations",
        "quotes",
        "optimization_runs",
        "atc_tool_sets",
    ];

    println!("\n{}", "Row counts after seeding:".bold().underline());
    println!("{:<30} {}", "Table", "Rows");
    println!("{}", "─".repeat(40));

    for table in &tables {
        let row = sqlx::query(&format!("SELECT COUNT(*) AS n FROM {table}"))
            .fetch_one(pool)
            .await
            .with_context(|| format!("COUNT(*) on {table}"))?;
        let count: i64 = row.try_get("n")?;
        println!("  {:<28} {:>6}", table, count.to_string().green());
    }

    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// SQL file helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Split a SQL file into individual statements using `;` as the delimiter.
///
/// Handles:
/// - Multi-line statements
/// - `$$` dollar-quoted string literals (common in PostgreSQL functions)
/// - Single-line `--` comments
/// - Block `/* */` comments
fn split_sql_statements(sql: &str) -> Vec<String> {
    let mut statements: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut chars = sql.chars().peekable();
    let mut in_dollar_quote = false;
    let mut dollar_tag = String::new();
    let mut in_single_quote = false;
    let mut in_line_comment = false;
    let mut in_block_comment = false;

    while let Some(ch) = chars.next() {
        // ── Line comment ──────────────────────────────────────────────────
        if !in_single_quote && !in_dollar_quote && !in_block_comment {
            if ch == '-' {
                if chars.peek() == Some(&'-') {
                    in_line_comment = true;
                    current.push(ch);
                    continue;
                }
            }
        }

        if in_line_comment {
            current.push(ch);
            if ch == '\n' {
                in_line_comment = false;
            }
            continue;
        }

        // ── Block comment ─────────────────────────────────────────────────
        if !in_single_quote && !in_dollar_quote {
            if ch == '/' && chars.peek() == Some(&'*') {
                in_block_comment = true;
                current.push(ch);
                current.push(chars.next().unwrap());
                continue;
            }
            if in_block_comment && ch == '*' && chars.peek() == Some(&'/') {
                in_block_comment = false;
                current.push(ch);
                current.push(chars.next().unwrap());
                continue;
            }
        }

        if in_block_comment {
            current.push(ch);
            continue;
        }

        // ── Dollar quoting: $tag$ ... $tag$ ───────────────────────────────
        if !in_single_quote && ch == '$' {
            if in_dollar_quote {
                // Might be end of dollar-quote: collect tag and check
                let mut closing_tag = String::from("$");
                for c in chars.by_ref() {
                    closing_tag.push(c);
                    if c == '$' {
                        break;
                    }
                }
                current.push('$');
                current.push_str(&closing_tag);
                // Strip leading $ for comparison
                if closing_tag == dollar_tag[1..] || closing_tag == dollar_tag {
                    in_dollar_quote = false;
                    dollar_tag.clear();
                }
                continue;
            } else {
                // Might be start of dollar-quote
                let mut tag = String::from("$");
                let mut is_dollar_quote = false;
                let mut lookahead = String::new();
                for c in chars.by_ref() {
                    lookahead.push(c);
                    tag.push(c);
                    if c == '$' {
                        is_dollar_quote = true;
                        break;
                    }
                    if !c.is_alphanumeric() && c != '_' {
                        break;
                    }
                }
                current.push('$');
                current.push_str(&lookahead);
                if is_dollar_quote {
                    in_dollar_quote = true;
                    dollar_tag = tag;
                }
                continue;
            }
        }

        // ── Single quote ──────────────────────────────────────────────────
        if ch == '\'' && !in_dollar_quote {
            in_single_quote = !in_single_quote;
            current.push(ch);
            continue;
        }

        // ── Statement terminator ──────────────────────────────────────────
        if ch == ';' && !in_single_quote && !in_dollar_quote {
            current.push(';');
            let trimmed = current.trim().to_string();
            if !trimmed.is_empty() && trimmed != ";" {
                statements.push(trimmed);
            }
            current.clear();
            continue;
        }

        current.push(ch);
    }

    // Flush any trailing statement without a semicolon
    let remainder = current.trim().to_string();
    if !remainder.is_empty() && remainder != ";" {
        statements.push(remainder);
    }

    statements
}

/// Returns true if every non-whitespace character in the string belongs to a
/// SQL comment.
fn is_comment_only(s: &str) -> bool {
    let s = s.trim();
    if s.starts_with("--") {
        return true;
    }
    if s.starts_with("/*") && s.ends_with("*/") {
        return true;
    }
    false
}

/// Produce a short human-readable label for a statement (used in the progress bar).
fn statement_label(stmt: &str) -> String {
    let upper = stmt.to_ascii_uppercase();
    for keyword in &[
        "INSERT INTO",
        "UPDATE",
        "DELETE FROM",
        "TRUNCATE",
        "CREATE",
        "DROP",
        "BEGIN",
        "COMMIT",
    ] {
        if upper.starts_with(keyword) {
            // Try to grab the table name that follows the keyword
            let rest = stmt[keyword.len()..].trim();
            let table: String = rest.split_whitespace().next().unwrap_or("").to_string();
            return format!("{} {}", keyword.to_lowercase(), table.to_lowercase());
        }
    }
    stmt.chars().take(60).collect()
}

// ─────────────────────────────────────────────────────────────────────────────
// File-path helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Resolve the SQL file path, searching common locations when the file is not
/// found at the literal path provided.
fn resolve_sql_path(path: &PathBuf) -> Result<PathBuf> {
    if path.exists() {
        return Ok(path.clone());
    }

    // Try next to the binary
    if let Ok(exe) = std::env::current_exe() {
        let candidate = exe
            .parent()
            .unwrap_or_else(|| std::path::Path::new("."))
            .join(path);
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    // Try the workspace root (common for cargo run)
    for prefix in &[".", "seed", "features/seed", "backend/seed"] {
        let candidate = PathBuf::from(prefix).join(path);
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    bail!(
        "Cannot find SQL file '{}'. Pass --file <path> to specify its location.",
        path.display()
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Output helpers
// ─────────────────────────────────────────────────────────────────────────────

fn banner() {
    println!(
        "{}",
        r"
 ╔═══════════════════════════════════════════════════╗
 ║  CNC-Machinery  ·  Database Seed Runner  (F-19)   ║
 ╚═══════════════════════════════════════════════════╝"
            .cyan()
            .bold()
    );
    println!();
}

fn progress_style() -> ProgressStyle {
    ProgressStyle::with_template("{spinner:.green} [{bar:40.cyan/blue}] {pos}/{len} {msg}")
        .unwrap()
        .progress_chars("█░")
}

fn print_summary(stats: &SeedStats, elapsed: Duration) {
    println!("\n{}", "─".repeat(50).dimmed());
    println!(
        "  {:<28} {:>8}",
        "Total statements:",
        stats.total_statements.to_string().bold()
    );
    println!(
        "  {:<28} {:>8}",
        "Executed:",
        stats.executed.to_string().green().bold()
    );
    println!(
        "  {:<28} {:>8}",
        "Skipped (empty/comment):",
        stats.skipped.to_string().dimmed()
    );
    println!(
        "  {:<28} {:>8}",
        "Rows affected:",
        stats.rows_affected.to_string().green().bold()
    );
    println!(
        "  {:<28} {:>8}",
        "Elapsed:",
        format!("{:.2}s", elapsed.as_secs_f64()).yellow()
    );
    println!("{}", "─".repeat(50).dimmed());
}

/// Replace the password in a postgres:// URL with `***` for safe printing.
fn redact_password(url: &str) -> String {
    // postgres://user:password@host/db  →  postgres://user:***@host/db
    if let Some(at_pos) = url.find('@') {
        if let Some(pass_start) = url[..at_pos].rfind(':') {
            let scheme_end = url.find("://").map(|i| i + 3).unwrap_or(0);
            if pass_start > scheme_end {
                return format!("{}:***{}", &url[..pass_start], &url[at_pos..]);
            }
        }
    }
    url.to_string()
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API – usable as a library function from integration tests
// ─────────────────────────────────────────────────────────────────────────────

/// Run the seed file at `sql_path` against `pool`.
///
/// - If `reset` is true, all seed tables are truncated first.
/// - If `dry_run` is true, the transaction is rolled back after validation.
///
/// Returns the number of rows affected.
pub async fn seed(
    pool: &PgPool,
    sql_path: &std::path::Path,
    reset: bool,
    dry_run: bool,
) -> Result<u64> {
    let content = std::fs::read_to_string(sql_path)
        .with_context(|| format!("Cannot read {}", sql_path.display()))?;

    let statements = split_sql_statements(&content);

    if reset {
        run_reset(pool, true).await?;
    }

    if dry_run {
        run_dry(pool, &statements, true).await?;
        return Ok(0);
    }

    let stats = run_seed(pool, &statements, true).await?;
    Ok(stats.rows_affected)
}

// ─────────────────────────────────────────────────────────────────────────────
// Unit tests for pure helper functions (no DB required)
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod unit_tests {
    use super::*;

    #[test]
    fn test_split_simple_statements() {
        let sql = "SELECT 1; SELECT 2; SELECT 3;";
        let stmts = split_sql_statements(sql);
        assert_eq!(stmts.len(), 3);
        assert_eq!(stmts[0], "SELECT 1;");
    }

    #[test]
    fn test_split_multiline_insert() {
        let sql = "INSERT INTO foo (a, b)\nVALUES (1, 2);\nINSERT INTO bar (c) VALUES (3);";
        let stmts = split_sql_statements(sql);
        assert_eq!(stmts.len(), 2);
        assert!(stmts[0].contains("foo"));
        assert!(stmts[1].contains("bar"));
    }

    #[test]
    fn test_split_ignores_semicolons_in_string_literals() {
        let sql = "INSERT INTO t (v) VALUES ('hello; world'); SELECT 1;";
        let stmts = split_sql_statements(sql);
        assert_eq!(stmts.len(), 2, "got {:?}", stmts);
    }

    #[test]
    fn test_split_dollar_quoted() {
        let sql = "CREATE FUNCTION f() RETURNS void AS $$BEGIN; END;$$ LANGUAGE plpgsql; SELECT 1;";
        let stmts = split_sql_statements(sql);
        // Should produce 2 statements – function CREATE + SELECT
        assert_eq!(stmts.len(), 2, "got {:#?}", stmts);
    }

    #[test]
    fn test_split_line_comment_not_statement() {
        let sql = "-- This is a comment\nSELECT 1; -- trailing\nSELECT 2;";
        let stmts = split_sql_statements(sql);
        // Line comments are embedded in statements, not split points
        assert_eq!(stmts.len(), 2);
    }

    #[test]
    fn test_is_comment_only() {
        assert!(is_comment_only("-- just a comment"));
        assert!(is_comment_only("/* block */"));
        assert!(!is_comment_only("SELECT 1 -- has sql"));
    }

    #[test]
    fn test_redact_password() {
        let url = "postgres://user:secret@localhost:5432/db";
        let redacted = redact_password(url);
        assert!(!redacted.contains("secret"));
        assert!(redacted.contains("user:***"));
        assert!(redacted.contains("localhost"));
    }

    #[test]
    fn test_redact_no_password() {
        let url = "postgres://localhost/db";
        let redacted = redact_password(url);
        assert_eq!(redacted, url);
    }

    #[test]
    fn test_statement_label_insert() {
        let s = "INSERT INTO materials (id) VALUES ('abc')";
        assert_eq!(statement_label(s), "insert into materials");
    }

    #[test]
    fn test_statement_label_begin() {
        let s = "BEGIN";
        assert_eq!(statement_label(s), "begin ");
    }

    #[test]
    fn test_split_empty_input() {
        let stmts = split_sql_statements("");
        assert!(stmts.is_empty());
    }

    #[test]
    fn test_split_only_comments() {
        let sql = "-- comment\n/* another */\n";
        let stmts = split_sql_statements(sql);
        // Comment-only lines without semicolons produce no statements
        assert!(stmts.is_empty(), "got {:#?}", stmts);
    }
}
