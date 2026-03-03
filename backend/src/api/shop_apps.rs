//! Shop-floor aggregate API handlers for tablet/kiosk use.
//!
//! These endpoints are read-heavy aggregates designed for shop-floor tablets.
//! All data is derived from JOINs across jobs → rooms → products → parts → materials.
//! There are no dedicated shop_apps tables.
//!
//! Routes
//! ──────
//!   GET  /shop/cutlist/{job_id}    — Cutlist formatted for shop display
//!                                    (includes job name, room name per part)
//!   GET  /shop/assembly/{job_id}   — Products with their parts grouped for
//!                                    assembly (product name, part list)
//!   GET  /shop/labels/{job_id}     — Part labels (name, material, dims,
//!                                    barcode = part UUID)
//!   POST /shop/scan                — Record a shop-floor scan event
//!                                    (part_id, action: cut|edgeband|drill|assemble)

use actix_web::{get, post, web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

// ─── scan event DTO ───────────────────────────────────────────────────────────

/// Body for POST /shop/scan.
#[derive(Debug, Deserialize)]
pub struct ShopScanEvent {
    pub part_id: Uuid,
    /// One of: "cut" | "edgeband" | "drill" | "assemble"
    pub action: String,
    /// Optional operator identifier (badge ID, name, etc.).
    pub operator: Option<String>,
}

// ─── GET /shop/cutlist/{job_id} ───────────────────────────────────────────────

/// Return a shop-display cutlist for the given job.
///
/// Each part row includes the job name and room name so the tablet operator
/// can confirm context at a glance.  Parts are sorted by room → product → part
/// name for natural cabinet-assembly order.
///
/// Response shape:
/// ```json
/// {
///   "status": "ok",
///   "job_id": "<uuid>",
///   "job_name": "Smith Kitchen",
///   "total_parts": 84,
///   "parts": [
///     {
///       "part_id": "<uuid>",
///       "part_name": "Left Side",
///       "part_type": "side",
///       "room_name": "Kitchen",
///       "product_name": "Upper 600",
///       "material_name": "White Melamine",
///       "cutlist_name": "W/M 18",
///       "length": 720.0,
///       "width": 560.0,
///       "thickness": 18.0,
///       "grain_direction": "vertical",
///       "edge_band_top": 1,
///       "edge_band_bottom": null,
///       "edge_band_left": 1,
///       "edge_band_right": null
///     }
///   ]
/// }
/// ```
#[get("/shop/cutlist/{job_id}")]
pub async fn get_shop_cutlist(pool: web::Data<PgPool>, job_id: web::Path<Uuid>) -> impl Responder {
    let job_id = *job_id;

    // Fetch job name for display context.
    let job = sqlx::query!("SELECT name FROM jobs WHERE id = $1", job_id)
        .fetch_optional(pool.get_ref())
        .await;

    let job_name = match job {
        Ok(Some(j)) => j.name,
        Ok(None) => {
            return HttpResponse::NotFound().json(json!({
                "status": "error",
                "message": format!("Job {} not found", job_id)
            }));
        }
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Database error fetching job",
                "detail": e.to_string()
            }));
        }
    };

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
            log::error!("Shop cutlist query failed for job {job_id}: {e}");
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to fetch shop cutlist",
                "detail": e.to_string()
            }))
        }
        Ok(rows) => {
            let total = rows.len();
            let parts: Vec<Value> = rows
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
                    })
                })
                .collect();

            HttpResponse::Ok().json(json!({
                "status":      "ok",
                "job_id":      job_id,
                "job_name":    job_name,
                "total_parts": total,
                "parts":       parts,
            }))
        }
    }
}

// ─── GET /shop/assembly/{job_id} ─────────────────────────────────────────────

/// Return all products for a job with their parts grouped, formatted for
/// assembly-sequence display on a shop tablet.
///
/// Response shape:
/// ```json
/// {
///   "status": "ok",
///   "job_id": "<uuid>",
///   "job_name": "Smith Kitchen",
///   "products": [
///     {
///       "product_id": "<uuid>",
///       "product_name": "Upper 600",
///       "room_name": "Kitchen",
///       "parts": [
///         {
///           "part_id": "<uuid>",
///           "part_name": "Left Side",
///           "part_type": "side",
///           "length": 720.0,
///           "width": 560.0,
///           "thickness": 18.0,
///           "material_name": "White Melamine"
///         }
///       ]
///     }
///   ]
/// }
/// ```
#[get("/shop/assembly/{job_id}")]
pub async fn get_shop_assembly(pool: web::Data<PgPool>, job_id: web::Path<Uuid>) -> impl Responder {
    let job_id = *job_id;

    let job = sqlx::query!("SELECT name FROM jobs WHERE id = $1", job_id)
        .fetch_optional(pool.get_ref())
        .await;

    let job_name = match job {
        Ok(Some(j)) => j.name,
        Ok(None) => {
            return HttpResponse::NotFound().json(json!({
                "status": "error",
                "message": format!("Job {} not found", job_id)
            }));
        }
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Database error fetching job",
                "detail": e.to_string()
            }));
        }
    };

    let rows = sqlx::query!(
        r#"
        SELECT
            pr.id                   AS product_id,
            pr.name                 AS product_name,
            r.name                  AS room_name,
            p.id                    AS part_id,
            p.name                  AS part_name,
            p.part_type::TEXT       AS part_type,
            p.length,
            p.width,
            p.thickness,
            m.name                  AS material_name
        FROM jobs j
        JOIN rooms      r  ON r.job_id     = j.id
        JOIN products   pr ON pr.room_id   = r.id
        JOIN parts      p  ON p.product_id = pr.id
        JOIN materials  m  ON m.id         = p.material_id
        WHERE j.id = $1
        ORDER BY r.name, pr.name, p.part_type::TEXT, p.name
        "#,
        job_id
    )
    .fetch_all(pool.get_ref())
    .await;

    match rows {
        Err(e) => {
            log::error!("Shop assembly query failed for job {job_id}: {e}");
            return HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to fetch assembly data",
                "detail": e.to_string()
            }));
        }
        Ok(rows) => {
            // Group by product, preserving ORDER BY from SQL.
            let mut products: Vec<(Uuid, String, String, Vec<Value>)> = Vec::new();

            for r in rows {
                let part_val = json!({
                    "part_id":       r.part_id,
                    "part_name":     r.part_name,
                    "part_type":     r.part_type,
                    "length":        r.length,
                    "width":         r.width,
                    "thickness":     r.thickness,
                    "material_name": r.material_name,
                });

                let pos = products
                    .iter()
                    .position(|(id, _, _, _)| *id == r.product_id);

                if let Some(i) = pos {
                    products[i].3.push(part_val);
                } else {
                    products.push((r.product_id, r.product_name, r.room_name, vec![part_val]));
                }
            }

            let product_vals: Vec<Value> = products
                .into_iter()
                .map(|(id, name, room, parts)| {
                    json!({
                        "product_id":   id,
                        "product_name": name,
                        "room_name":    room,
                        "parts":        parts,
                    })
                })
                .collect();

            HttpResponse::Ok().json(json!({
                "status":   "ok",
                "job_id":   job_id,
                "job_name": job_name,
                "products": product_vals,
            }))
        }
    }
}

// ─── GET /shop/labels/{job_id} ────────────────────────────────────────────────

/// Return label data for every part in a job, optimised for shop-floor use.
///
/// `barcode_data` is the part's UUID as a plain string — scanners/printers
/// encode this as a Code-128 barcode or QR code on the physical label.
#[get("/shop/labels/{job_id}")]
pub async fn get_shop_labels(pool: web::Data<PgPool>, job_id: web::Path<Uuid>) -> impl Responder {
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
            log::error!("Shop labels query failed for job {job_id}: {e}");
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to fetch label data",
                "detail": e.to_string()
            }))
        }
        Ok(rows) => {
            let count = rows.len();
            let labels: Vec<Value> = rows
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

            HttpResponse::Ok().json(json!({
                "status": "ok",
                "job_id": job_id,
                "count":  count,
                "labels": labels,
            }))
        }
    }
}

// ─── POST /shop/scan ──────────────────────────────────────────────────────────

/// Record a shop-floor scan event.
///
/// The body must contain `part_id` (UUID) and `action` (one of:
/// `"cut"`, `"edgeband"`, `"drill"`, `"assemble"`).
///
/// Scan events are stored in the `part_scan_events` table:
///   (id, part_id, action, operator, scanned_at)
///
/// If the `part_scan_events` table does not yet exist in the schema the
/// INSERT is gracefully handled.  The handler also verifies that the
/// referenced `part_id` exists in the `parts` table before recording.
#[post("/shop/scan")]
pub async fn record_shop_scan(
    pool: web::Data<PgPool>,
    body: web::Json<ShopScanEvent>,
) -> impl Responder {
    let dto = body.into_inner();

    // Validate action values.
    let valid_actions = ["cut", "edgeband", "drill", "assemble"];
    if !valid_actions.contains(&dto.action.as_str()) {
        return HttpResponse::BadRequest().json(json!({
            "status": "error",
            "message": format!(
                "Invalid action '{}'. Must be one of: cut, edgeband, drill, assemble",
                dto.action
            )
        }));
    }

    // Verify part exists.
    let part_exists = sqlx::query!("SELECT 1 AS exists FROM parts WHERE id = $1", dto.part_id)
        .fetch_optional(pool.get_ref())
        .await;

    match part_exists {
        Err(e) => {
            log::error!("Failed to verify part {}: {e}", dto.part_id);
            return HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Database error verifying part",
                "detail": e.to_string()
            }));
        }
        Ok(None) => {
            return HttpResponse::NotFound().json(json!({
                "status": "error",
                "message": format!("Part {} not found", dto.part_id)
            }));
        }
        Ok(Some(_)) => {}
    }

    let event_id = Uuid::new_v4();

    let result = sqlx::query!(
        r#"
        INSERT INTO part_scan_events (id, part_id, action, operator, scanned_at)
        VALUES ($1, $2, $3, $4, NOW())
        "#,
        event_id,
        dto.part_id,
        dto.action,
        dto.operator,
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Err(e) => {
            log::error!("Failed to record scan event for part {}: {e}", dto.part_id);
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to record scan event",
                "detail": e.to_string()
            }))
        }
        Ok(_) => HttpResponse::Created().json(json!({
            "status": "ok",
            "message": format!("Scan event '{}' recorded for part {}", dto.action, dto.part_id),
            "data": {
                "event_id":  event_id,
                "part_id":   dto.part_id,
                "action":    dto.action,
                "operator":  dto.operator,
            }
        })),
    }
}

// ─── route registration ───────────────────────────────────────────────────────

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/shop")
            .service(get_shop_cutlist)
            .service(get_shop_assembly)
            .service(get_shop_labels)
            .service(record_shop_scan),
    );
}
