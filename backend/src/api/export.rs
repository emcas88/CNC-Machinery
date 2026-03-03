//! File-export handlers.
//!
//! Routes
//! ──────
//!   GET /export/csv/{job_id}     — CSV cutlist download
//!   GET /export/labels/{job_id}  — Label data as JSON download
//!
//! Both endpoints query the same jobs → rooms → products → parts → materials
//! JOIN chain used by the cutlists and labels modules.  They differ only in
//! output format and Content-Type / Content-Disposition headers.

use actix_web::{get, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

// ─── GET /export/csv/{job_id} ─────────────────────────────────────────────────

/// Generate and stream a UTF-8 CSV cutlist for the given job.
///
/// Response headers:
///   Content-Type:        text/csv; charset=utf-8
///   Content-Disposition: attachment; filename="cutlist-<job_id>.csv"
///
/// CSV columns (header row always present):
///   Room, Product, Part Name, Part Type, Material, Cutlist Name,
///   Length (mm), Width (mm), Thickness (mm), Grain Direction,
///   Edge Top, Edge Bottom, Edge Left, Edge Right
#[get("/export/csv/{job_id}")]
pub async fn export_csv(
    pool: web::Data<PgPool>,
    job_id: web::Path<Uuid>,
) -> impl Responder {
    let job_id = *job_id;

    let rows = sqlx::query!(
        r#"
        SELECT
            r.name                  AS room_name,
            pr.name                 AS product_name,
            p.name                  AS part_name,
            p.part_type::TEXT       AS part_type,
            m.name                  AS material_name,
            m.cutlist_name,
            p.length,
            p.width,
            p.thickness,
            p.grain_direction::TEXT AS grain_direction,
            p.edge_band_top,
            p.edge_band_bottom,
            p.edge_band_left,
            p.edge_band_right
        FROM jobs j
        JOIN rooms      r  ON r.job_id     = j.id
        JOIN products   pr ON pr.room_id   = r.id
        JOIN parts      p  ON p.product_id = pr.id
        JOIN materials  m  ON m.id         = p.material_id
        WHERE j.id = $1
        ORDER BY r.name, pr.name, p.name
        "#,
        job_id
    )
    .fetch_all(pool.get_ref())
    .await;

    match rows {
        Err(e) => {
            log::error!("CSV export query failed for job {job_id}: {e}");
            // Return a JSON error even though the client expected CSV —
            // this signals an unrecoverable server error.
            return HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to generate CSV cutlist",
                "detail": e.to_string()
            }));
        }
        Ok(rows) => {
            let mut csv = String::with_capacity(rows.len() * 120);

            // Header row.
            csv.push_str(
                "Room,Product,Part Name,Part Type,Material,Cutlist Name,\
                 Length (mm),Width (mm),Thickness (mm),Grain Direction,\
                 Edge Top,Edge Bottom,Edge Left,Edge Right\r\n",
            );

            for r in &rows {
                csv.push_str(&csv_field(&r.room_name));
                csv.push(',');
                csv.push_str(&csv_field(&r.product_name));
                csv.push(',');
                csv.push_str(&csv_field(&r.part_name));
                csv.push(',');
                csv.push_str(&csv_field(r.part_type.as_deref().unwrap_or("")));
                csv.push(',');
                csv.push_str(&csv_field(&r.material_name));
                csv.push(',');
                csv.push_str(&csv_field(&r.cutlist_name));
                csv.push(',');
                csv.push_str(&r.length.to_string());
                csv.push(',');
                csv.push_str(&r.width.to_string());
                csv.push(',');
                csv.push_str(&r.thickness.to_string());
                csv.push(',');
                csv.push_str(&csv_field(r.grain_direction.as_deref().unwrap_or("none")));
                csv.push(',');
                csv.push_str(&opt_i32_to_csv(r.edge_band_top));
                csv.push(',');
                csv.push_str(&opt_i32_to_csv(r.edge_band_bottom));
                csv.push(',');
                csv.push_str(&opt_i32_to_csv(r.edge_band_left));
                csv.push(',');
                csv.push_str(&opt_i32_to_csv(r.edge_band_right));
                csv.push_str("\r\n");
            }

            let filename = format!("cutlist-{job_id}.csv");

            HttpResponse::Ok()
                .content_type("text/csv; charset=utf-8")
                .insert_header((
                    "Content-Disposition",
                    format!("attachment; filename=\"{filename}\""),
                ))
                .body(csv)
        }
    }
}

// ─── GET /export/labels/{job_id} ─────────────────────────────────────────────

/// Generate and download label data for all parts in a job as JSON.
///
/// Response headers:
///   Content-Type:        application/json
///   Content-Disposition: attachment; filename="labels-<job_id>.json"
///
/// Each label object includes a `barcode_data` field containing the part UUID
/// as a plain string, ready to be encoded as Code-128 or QR.
#[get("/export/labels/{job_id}")]
pub async fn export_labels(
    pool: web::Data<PgPool>,
    job_id: web::Path<Uuid>,
) -> impl Responder {
    let job_id = *job_id;

    let rows = sqlx::query!(
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
        ORDER BY r.name, pr.name, p.name
        "#,
        job_id
    )
    .fetch_all(pool.get_ref())
    .await;

    match rows {
        Err(e) => {
            log::error!("Label export query failed for job {job_id}: {e}");
            return HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to generate label export",
                "detail": e.to_string()
            }));
        }
        Ok(rows) => {
            let count = rows.len();
            let labels: Vec<serde_json::Value> = rows
                .into_iter()
                .map(|r| {
                    json!({
                        "part_id":          r.part_id,
                        "part_name":        r.part_name,
                        "part_type":        r.part_type,
                        "room_name":        r.room_name,
                        "product_name":     r.product_name,
                        "material_name":    r.material_name,
                        "cutlist_name":     r.cutlist_name,
                        "length":           r.length,
                        "width":            r.width,
                        "thickness":        r.thickness,
                        "grain_direction":  r.grain_direction,
                        "edge_band_top":    r.edge_band_top,
                        "edge_band_bottom": r.edge_band_bottom,
                        "edge_band_left":   r.edge_band_left,
                        "edge_band_right":  r.edge_band_right,
                        "barcode_data":     r.part_id.to_string(),
                    })
                })
                .collect();

            let payload = json!({
                "job_id": job_id,
                "count":  count,
                "labels": labels,
            });

            let body = serde_json::to_string_pretty(&payload)
                .unwrap_or_else(|_| "{}".into());

            let filename = format!("labels-{job_id}.json");

            HttpResponse::Ok()
                .content_type("application/json")
                .insert_header((
                    "Content-Disposition",
                    format!("attachment; filename=\"{filename}\""),
                ))
                .body(body)
        }
    }
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

/// Wrap a field value in double-quotes and escape any embedded double-quotes.
/// This implements RFC 4180 §2 minimal quoting.
#[inline]
fn csv_field(s: &str) -> String {
    if s.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_owned()
    }
}

/// Render an optional edge-band integer as a bare number or empty string.
#[inline]
fn opt_i32_to_csv(v: Option<i32>) -> String {
    v.map(|n| n.to_string()).unwrap_or_default()
}

// ─── route registration ───────────────────────────────────────────────────────

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/export")
            .service(export_csv)
            .service(export_labels),
    );
}
