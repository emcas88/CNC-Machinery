//! Optimizer handlers — optimization runs and nested sheets.
//!
//! Tables
//! ──────
//!   optimization_runs  (id, job_id, name, status, quality, settings, sheets,
//!                        yield_percentage, created_at, updated_at)
//!   nested_sheets      (id, optimization_run_id, material_id, sheet_index,
//!                        width, length, parts_layout, waste_percentage,
//!                        gcode_file, created_at)
//!
//! Routes
//! ──────
//!   POST /jobs/{job_id}/optimize              — Queue a new optimization run
//!   GET  /optimization-runs/{id}              — Get run + its nested sheets
//!   GET  /jobs/{job_id}/optimization-runs     — List all runs for a job
//!   PUT  /optimization-runs/{id}              — Update run (status, results…)
//!   DELETE /optimization-runs/{id}            — Delete a run and its sheets

use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::optimization_run::{
    CreateOptimizationRun, OptimizationQuality, OptimizationStatus, UpdateOptimizationRun,
};
use crate::models::nested_sheet::CreateNestedSheet;

// ─── POST /jobs/{job_id}/optimize ────────────────────────────────────────────

/// Queue a new nesting optimization run for the given job.
///
/// The body should be a `CreateOptimizationRun` JSON object.
/// On success returns 202 Accepted with the new run's `id`.
#[post("/jobs/{job_id}/optimize")]
pub async fn create_optimization_run(
    pool: web::Data<PgPool>,
    job_id: web::Path<Uuid>,
    body: web::Json<CreateOptimizationRun>,
) -> impl Responder {
    let job_id = *job_id;
    let dto = body.into_inner();

    let run_id = Uuid::new_v4();
    let settings = dto.settings.unwrap_or_else(|| json!({}));

    let result = sqlx::query!(
        r#"
        INSERT INTO optimization_runs
            (id, job_id, name, status, quality, settings, sheets,
             yield_percentage, created_at, updated_at)
        VALUES
            ($1, $2, $3,
             'queued'::optimization_status,
             $4::optimization_quality,
             $5, '[]'::jsonb,
             NULL,
             NOW(), NOW())
        "#,
        run_id,
        job_id,
        dto.name,
        dto.quality as OptimizationQuality,
        settings,
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Err(e) => {
            log::error!("Failed to create optimization run for job {job_id}: {e}");
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to queue optimization run",
                "detail": e.to_string()
            }))
        }
        Ok(_) => HttpResponse::Accepted().json(json!({
            "status": "ok",
            "message": "Optimization run queued",
            "data": {
                "id":     run_id,
                "job_id": job_id,
                "status": "queued"
            }
        })),
    }
}

// ─── GET /optimization-runs/{id} ─────────────────────────────────────────────

/// Retrieve a single optimization run together with all of its nested sheets.
#[get("/optimization-runs/{id}")]
pub async fn get_optimization_run(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    let run_id = *id;

    // Fetch the run record.
    let run = sqlx::query!(
        r#"
        SELECT
            id, job_id, name,
            status::TEXT          AS status,
            quality::TEXT         AS quality,
            settings, sheets,
            yield_percentage,
            created_at, updated_at
        FROM optimization_runs
        WHERE id = $1
        "#,
        run_id
    )
    .fetch_optional(pool.get_ref())
    .await;

    let run = match run {
        Err(e) => {
            log::error!("Failed to fetch optimization run {run_id}: {e}");
            return HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Database error",
                "detail": e.to_string()
            }));
        }
        Ok(None) => {
            return HttpResponse::NotFound().json(json!({
                "status": "error",
                "message": format!("Optimization run {} not found", run_id)
            }));
        }
        Ok(Some(r)) => r,
    };

    // Fetch associated nested sheets.
    let sheets = sqlx::query!(
        r#"
        SELECT
            id, optimization_run_id, material_id,
            sheet_index, width, length,
            parts_layout, waste_percentage, gcode_file,
            created_at
        FROM nested_sheets
        WHERE optimization_run_id = $1
        ORDER BY sheet_index
        "#,
        run_id
    )
    .fetch_all(pool.get_ref())
    .await;

    let sheets = match sheets {
        Err(e) => {
            log::error!("Failed to fetch nested sheets for run {run_id}: {e}");
            return HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to fetch nested sheets",
                "detail": e.to_string()
            }));
        }
        Ok(rows) => rows
            .into_iter()
            .map(|s| {
                json!({
                    "id":                   s.id,
                    "optimization_run_id":  s.optimization_run_id,
                    "material_id":          s.material_id,
                    "sheet_index":          s.sheet_index,
                    "width":                s.width,
                    "length":               s.length,
                    "parts_layout":         s.parts_layout,
                    "waste_percentage":     s.waste_percentage,
                    "gcode_file":           s.gcode_file,
                    "created_at":           s.created_at,
                })
            })
            .collect::<Vec<_>>(),
    };

    HttpResponse::Ok().json(json!({
        "status": "ok",
        "data": {
            "id":               run.id,
            "job_id":           run.job_id,
            "name":             run.name,
            "status":           run.status,
            "quality":          run.quality,
            "settings":         run.settings,
            "sheets_summary":   run.sheets,
            "yield_percentage": run.yield_percentage,
            "created_at":       run.created_at,
            "updated_at":       run.updated_at,
            "nested_sheets":    sheets,
        }
    }))
}

// ─── GET /jobs/{job_id}/optimization-runs ────────────────────────────────────

/// List all optimization runs for a job, ordered newest-first.
#[get("/jobs/{job_id}/optimization-runs")]
pub async fn list_optimization_runs(
    pool: web::Data<PgPool>,
    job_id: web::Path<Uuid>,
) -> impl Responder {
    let job_id = *job_id;

    let rows = sqlx::query!(
        r#"
        SELECT
            id, job_id, name,
            status::TEXT    AS status,
            quality::TEXT   AS quality,
            settings,
            yield_percentage,
            created_at, updated_at
        FROM optimization_runs
        WHERE job_id = $1
        ORDER BY created_at DESC
        "#,
        job_id
    )
    .fetch_all(pool.get_ref())
    .await;

    match rows {
        Err(e) => {
            log::error!("Failed to list optimization runs for job {job_id}: {e}");
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to list optimization runs",
                "detail": e.to_string()
            }))
        }
        Ok(rows) => {
            let data: Vec<Value> = rows
                .into_iter()
                .map(|r| {
                    json!({
                        "id":               r.id,
                        "job_id":           r.job_id,
                        "name":             r.name,
                        "status":           r.status,
                        "quality":          r.quality,
                        "settings":         r.settings,
                        "yield_percentage": r.yield_percentage,
                        "created_at":       r.created_at,
                        "updated_at":       r.updated_at,
                    })
                })
                .collect();

            HttpResponse::Ok().json(json!({
                "status": "ok",
                "job_id": job_id,
                "count":  data.len(),
                "data":   data,
            }))
        }
    }
}

// ─── PUT /optimization-runs/{id} ─────────────────────────────────────────────

/// Update mutable fields on an optimization run (status, quality, results, etc.).
///
/// Only fields present in the JSON body are updated; absent fields are left
/// unchanged via COALESCE.
#[put("/optimization-runs/{id}")]
pub async fn update_optimization_run(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
    body: web::Json<UpdateOptimizationRun>,
) -> impl Responder {
    let run_id = *id;
    let dto = body.into_inner();

    let result = sqlx::query!(
        r#"
        UPDATE optimization_runs SET
            name             = COALESCE($2, name),
            status           = COALESCE($3::optimization_status, status),
            quality          = COALESCE($4::optimization_quality, quality),
            settings         = COALESCE($5, settings),
            sheets           = COALESCE($6, sheets),
            yield_percentage = COALESCE($7, yield_percentage),
            updated_at       = NOW()
        WHERE id = $1
        "#,
        run_id,
        dto.name,
        dto.status   as Option<OptimizationStatus>,
        dto.quality  as Option<OptimizationQuality>,
        dto.settings,
        dto.sheets,
        dto.yield_percentage,
    )
    .execute(pool.get_ref())
    .await;

    match result {
        Err(e) => {
            log::error!("Failed to update optimization run {run_id}: {e}");
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to update optimization run",
                "detail": e.to_string()
            }))
        }
        Ok(r) if r.rows_affected() == 0 => {
            HttpResponse::NotFound().json(json!({
                "status": "error",
                "message": format!("Optimization run {} not found", run_id)
            }))
        }
        Ok(_) => HttpResponse::Ok().json(json!({
            "status":  "ok",
            "message": format!("Optimization run {} updated", run_id),
            "data":    { "id": run_id }
        })),
    }
}

// ─── DELETE /optimization-runs/{id} ──────────────────────────────────────────

/// Delete an optimization run and cascade-delete its nested sheets.
///
/// The ON DELETE CASCADE constraint on `nested_sheets.optimization_run_id`
/// handles child removal automatically.  If no such constraint exists the
/// nested sheets are deleted explicitly in a transaction.
#[delete("/optimization-runs/{id}")]
pub async fn delete_optimization_run(
    pool: web::Data<PgPool>,
    id: web::Path<Uuid>,
) -> impl Responder {
    let run_id = *id;

    // Use a transaction to delete nested sheets first, then the run.
    let mut tx = match pool.begin().await {
        Err(e) => {
            return HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to begin transaction",
                "detail": e.to_string()
            }));
        }
        Ok(tx) => tx,
    };

    // Delete child sheets first (guard against missing CASCADE).
    if let Err(e) = sqlx::query!(
        "DELETE FROM nested_sheets WHERE optimization_run_id = $1",
        run_id
    )
    .execute(&mut *tx)
    .await
    {
        log::error!("Failed to delete nested sheets for run {run_id}: {e}");
        return HttpResponse::InternalServerError().json(json!({
            "status": "error",
            "message": "Failed to delete nested sheets",
            "detail": e.to_string()
        }));
    }

    let result = sqlx::query!(
        "DELETE FROM optimization_runs WHERE id = $1",
        run_id
    )
    .execute(&mut *tx)
    .await;

    match result {
        Err(e) => {
            log::error!("Failed to delete optimization run {run_id}: {e}");
            HttpResponse::InternalServerError().json(json!({
                "status": "error",
                "message": "Failed to delete optimization run",
                "detail": e.to_string()
            }))
        }
        Ok(r) if r.rows_affected() == 0 => {
            HttpResponse::NotFound().json(json!({
                "status": "error",
                "message": format!("Optimization run {} not found", run_id)
            }))
        }
        Ok(_) => {
            let _ = tx.commit().await;
            HttpResponse::Ok().json(json!({
                "status":  "ok",
                "message": format!("Optimization run {} and its nested sheets deleted", run_id),
                "data":    { "id": run_id }
            }))
        }
    }
}

// ─── route registration ───────────────────────────────────────────────────────

/// Register optimizer routes.
///
/// Routes span two different URL namespaces:
///   /jobs/{job_id}/optimize              (POST – start a run)
///   /jobs/{job_id}/optimization-runs     (GET  – list runs for a job)
///   /optimization-runs/{id}              (GET, PUT, DELETE)
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(create_optimization_run)
        .service(list_optimization_runs)
        .service(get_optimization_run)
        .service(update_optimization_run)
        .service(delete_optimization_run);
}
