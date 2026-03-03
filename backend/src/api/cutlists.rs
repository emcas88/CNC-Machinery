//! Cutlist and Bill-of-Materials handlers.
//!
//! There is no dedicated `cutlists` table — all data is aggregated at
//! request time via JOINs across:
//!   jobs → rooms → products → parts → materials
//!
//! Routes
//! ──────
//!   GET  /jobs/{job_id}/cutlist  — Full cutlist grouped by material
//!   GET  /jobs/{job_id}/bom      — Bill of Materials (material sq-ft totals +
//!                                   hardware counts from JSONB definitions)

use actix_web::{get, web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

// ─── response shapes ─────────────────────────────────────────────────────────

/// One row returned by the cutlist query.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CutlistRow {
    pub part_id: Uuid,
    pub part_name: String,
    pub part_type: String,
    pub length: f64,
    pub width: f64,
    pub thickness: f64,
    pub grain_direction: String,
    pub edge_band_top: Option<i32>,
    pub edge_band_bottom: Option<i32>,
    pub edge_band_left: Option<i32>,
    pub edge_band_right: Option<i32>,
    pub material_id: Uuid,
    pub material_name: String,
    pub cutlist_name: String,
    pub product_name: String,
    pub room_name: String,
}

/// Aggregated material row for the BOM.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct BomMaterialRow {
    pub material_id: Uuid,
    pub material_name: String,
    pub cutlist_name: String,
    pub thickness: f64,
    pub total_parts: i64,
    /// Sum of (length × width) for all parts using this material, in mm².
    pub total_area_mm2: f64,
    /// Derived: total_area_mm2 converted to square feet.
    pub total_area_sqft: f64,
}

/// One hardware line in the BOM, derived from product JSONB definitions.
#[derive(Debug, Serialize)]
pub struct BomHardwareRow {
    pub hardware_name: String,
    pub total_quantity: i64,
}

// ─── GET /jobs/{job_id}/cutlist ───────────────────────────────────────────────

/// Return all parts for a job, grouped by material.
///
/// SQL path: jobs → rooms → products → parts → materials
///
/// The response shape is:
/// ```json
/// {
///   "status": "ok",
///   "job_id": "<uuid>",
///   "groups": [
///     {
///       "material_id": "<uuid>",
///       "material_name": "White Melamine",
///       "cutlist_name": "W/M 18",
///       "parts": [ { ...CutlistRow fields... } ]
///     }
///   ],
///   "total_parts": 42
/// }
/// ```
#[get("/jobs/{job_id}/cutlist")]
pub async fn get_cutlist(pool: web::Data<PgPool>, job_id: web::Path<Uuid>) -> impl Responder {
    let job_id = *job_id;

    let rows = sqlx::query_as!(
        CutlistRow,
        r#"
        SELECT
            p.id                    AS part_id,
            p.name                  AS part_name,
            p.part_type::TEXT       AS part_type,
            p.length,
            p.width,
            p.thickness,
            p.grain_direction::TEXT AS grain_direction,
            p.edge_band_top,
            p.edge_band_bottom,
            p.edge_band_left,
            p.edge_band_right,
            m.id                    AS material_id,
            m.name                  AS material_name,
            m.cutlist_name,
            pr.name                 AS product_name,
            r.name                  AS room_name
        FROM jobs j
        JOIN rooms      r  ON r.job_id     = j.id
        JOIN products   pr ON pr.room_id   = r.id
        JOIN parts      p  ON p.product_id = pr.id
        JOIN materials  m  ON m.id         = p.material_id
        WHERE j.id = $1
        ORDER BY m.cutlist_name, r.name, pr.name, p.name
        "#,
        job_id
    )
    .fetch_all(pool.get_ref())
    .await;

    match rows {
        Err(e) => {
            log::error!("cutlist query failed for job {job_id}: {e}");
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to fetch cutlist",
                "detail": e.to_string()
            }))
        }
        Ok(rows) => {
            // Group parts by material in Rust — avoids nested SQL aggregation.
            let total_parts = rows.len();
            let groups = group_by_material(rows);

            HttpResponse::Ok().json(json!({
                "status": "ok",
                "job_id": job_id,
                "total_parts": total_parts,
                "groups": groups
            }))
        }
    }
}

/// Group a flat list of `CutlistRow`s by `(material_id, material_name, cutlist_name)`.
fn group_by_material(rows: Vec<CutlistRow>) -> Vec<Value> {
    // Use a Vec of (key, bucket) to preserve ORDER BY from SQL.
    let mut buckets: Vec<(Uuid, String, String, Vec<Value>)> = Vec::new();

    for row in rows {
        // Find existing bucket or push a new one.
        let pos = buckets
            .iter()
            .position(|(id, _, _, _)| *id == row.material_id);

        let part_val = json!({
            "part_id":          row.part_id,
            "part_name":        row.part_name,
            "part_type":        row.part_type,
            "room":             row.room_name,
            "product":          row.product_name,
            "length":           row.length,
            "width":            row.width,
            "thickness":        row.thickness,
            "grain_direction":  row.grain_direction,
            "edge_band_top":    row.edge_band_top,
            "edge_band_bottom": row.edge_band_bottom,
            "edge_band_left":   row.edge_band_left,
            "edge_band_right":  row.edge_band_right,
        });

        if let Some(i) = pos {
            buckets[i].3.push(part_val);
        } else {
            buckets.push((
                row.material_id,
                row.material_name.clone(),
                row.cutlist_name.clone(),
                vec![part_val],
            ));
        }
    }

    buckets
        .into_iter()
        .map(|(id, name, cname, parts)| {
            json!({
                "material_id":   id,
                "material_name": name,
                "cutlist_name":  cname,
                "parts":         parts,
            })
        })
        .collect()
}

// ─── GET /jobs/{job_id}/bom ───────────────────────────────────────────────────

/// Bill of Materials: aggregate material sq-ft and hardware counts.
///
/// Hardware is derived from the `face_definition` and `interior_definition`
/// JSONB columns on products.  Both columns are expected to contain a
/// `"hardware"` array where each element has `{ "name": "...", "qty": N }`.
///
/// Response shape:
/// ```json
/// {
///   "status": "ok",
///   "job_id": "<uuid>",
///   "materials": [ { BomMaterialRow fields } ],
///   "hardware":  [ { "hardware_name": "...", "total_quantity": N } ]
/// }
/// ```
#[get("/jobs/{job_id}/bom")]
pub async fn get_bom(pool: web::Data<PgPool>, job_id: web::Path<Uuid>) -> impl Responder {
    let job_id = *job_id;

    // ── material aggregation ──────────────────────────────────────────────────
    let mat_rows = sqlx::query!(
        r#"
        SELECT
            m.id                          AS material_id,
            m.name                        AS material_name,
            m.cutlist_name,
            m.thickness,
            COUNT(p.id)                   AS total_parts,
            COALESCE(SUM(p.length * p.width), 0.0) AS total_area_mm2
        FROM jobs j
        JOIN rooms      r  ON r.job_id     = j.id
        JOIN products   pr ON pr.room_id   = r.id
        JOIN parts      p  ON p.product_id = pr.id
        JOIN materials  m  ON m.id         = p.material_id
        WHERE j.id = $1
        GROUP BY m.id, m.name, m.cutlist_name, m.thickness
        ORDER BY m.cutlist_name
        "#,
        job_id
    )
    .fetch_all(pool.get_ref())
    .await;

    // ── hardware aggregation from JSONB ───────────────────────────────────────
    // Extract hardware items from both face_definition and interior_definition
    // JSONB arrays on products, then aggregate counts by name.
    let hw_rows = sqlx::query!(
        r#"
        SELECT
            hw_item->>'name'           AS hardware_name,
            SUM((hw_item->>'qty')::BIGINT)::BIGINT AS total_quantity
        FROM jobs j
        JOIN rooms    r  ON r.job_id   = j.id
        JOIN products pr ON pr.room_id = r.id,
        LATERAL (
            SELECT jsonb_array_elements(
                COALESCE(pr.face_definition->'hardware',     '[]'::jsonb) ||
                COALESCE(pr.interior_definition->'hardware', '[]'::jsonb)
            ) AS hw_item
        ) hw
        WHERE j.id = $1
          AND hw_item ? 'name'
          AND hw_item ? 'qty'
        GROUP BY hw_item->>'name'
        ORDER BY hw_item->>'name'
        "#,
        job_id
    )
    .fetch_all(pool.get_ref())
    .await;

    // Surface query errors
    if let Err(e) = &mat_rows {
        log::error!("BOM material query failed for job {job_id}: {e}");
        return HttpResponse::InternalServerError().json(json!({
            "status": "error",
            "message": "Failed to fetch BOM materials",
            "detail": e.to_string()
        }));
    }
    if let Err(e) = &hw_rows {
        log::error!("BOM hardware query failed for job {job_id}: {e}");
        return HttpResponse::InternalServerError().json(json!({
            "status": "error",
            "message": "Failed to fetch BOM hardware",
            "detail": e.to_string()
        }));
    }

    const MM2_PER_SQFT: f64 = 92_903.04;

    let materials: Vec<Value> = mat_rows
        .unwrap()
        .into_iter()
        .map(|r| {
            let area = r.total_area_mm2.unwrap_or(0.0);
            json!({
                "material_id":    r.material_id,
                "material_name":  r.material_name,
                "cutlist_name":   r.cutlist_name,
                "thickness_mm":   r.thickness,
                "total_parts":    r.total_parts.unwrap_or(0),
                "total_area_mm2": area,
                "total_area_sqft": area / MM2_PER_SQFT,
            })
        })
        .collect();

    let hardware: Vec<Value> = hw_rows
        .unwrap()
        .into_iter()
        .map(|r| {
            json!({
                "hardware_name":   r.hardware_name.unwrap_or_default(),
                "total_quantity":  r.total_quantity.unwrap_or(0),
            })
        })
        .collect();

    HttpResponse::Ok().json(json!({
        "status":    "ok",
        "job_id":    job_id,
        "materials": materials,
        "hardware":  hardware,
    }))
}

// ─── route registration ───────────────────────────────────────────────────────

/// Register cutlist routes.  These are stand-alone (no wrapping scope) because
/// they sit at `/jobs/{job_id}/...` alongside the jobs module routes.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(get_cutlist).service(get_bom);
}
