use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::quote::{CreateQuote, Quote, UpdateQuote};

// ---------------------------------------------------------------------------
// Configure routes
// ---------------------------------------------------------------------------

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/quotes")
            .service(list_quotes)
            .service(get_quote)
            .service(create_quote)
            .service(update_quote)
            .service(delete_quote),
    );
}

// ---------------------------------------------------------------------------
// Query parameters for filtering
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct QuoteQuery {
    pub job_id: Option<Uuid>,
}

// ---------------------------------------------------------------------------
// GET /quotes  (optional ?job_id=<uuid>)
// ---------------------------------------------------------------------------

#[get("")]
pub async fn list_quotes(pool: web::Data<PgPool>, query: web::Query<QuoteQuery>) -> impl Responder {
    let result = if let Some(job_id) = query.job_id {
        sqlx::query_as!(
            Quote,
            r#"
            SELECT
                id,
                job_id,
                quote_number,
                material_cost,
                hardware_cost,
                labor_cost,
                markup_percentage,
                total,
                line_items,
                created_at,
                updated_at
            FROM quotes
            WHERE job_id = $1
            ORDER BY created_at DESC
            "#,
            job_id
        )
        .fetch_all(pool.get_ref())
        .await
    } else {
        sqlx::query_as!(
            Quote,
            r#"
            SELECT
                id,
                job_id,
                quote_number,
                material_cost,
                hardware_cost,
                labor_cost,
                markup_percentage,
                total,
                line_items,
                created_at,
                updated_at
            FROM quotes
            ORDER BY created_at DESC
            "#
        )
        .fetch_all(pool.get_ref())
        .await
    };

    match result {
        Ok(quotes) => HttpResponse::Ok().json(quotes),
        Err(e) => {
            log::error!("list_quotes DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to retrieve quotes"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// GET /quotes/{id}
// ---------------------------------------------------------------------------

#[get("/{id}")]
pub async fn get_quote(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query_as!(
        Quote,
        r#"
        SELECT
            id,
            job_id,
            quote_number,
            material_cost,
            hardware_cost,
            labor_cost,
            markup_percentage,
            total,
            line_items,
            created_at,
            updated_at
        FROM quotes
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(quote)) => HttpResponse::Ok().json(quote),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Quote not found",
            "id": id
        })),
        Err(e) => {
            log::error!("get_quote DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to retrieve quote"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// POST /quotes
// Server-side total calculation:
//   total = (material_cost + hardware_cost + labor_cost) * (1 + markup_percentage / 100)
// ---------------------------------------------------------------------------

#[post("")]
pub async fn create_quote(pool: web::Data<PgPool>, body: web::Json<CreateQuote>) -> impl Responder {
    let id = Uuid::new_v4();
    let now = chrono::Utc::now();

    // Calculate total server-side so the client never has to pass it.
    let total = (body.material_cost + body.hardware_cost + body.labor_cost)
        * (1.0 + body.markup_percentage / 100.0);

    let result = sqlx::query_as!(
        Quote,
        r#"
        INSERT INTO quotes (
            id, job_id, quote_number,
            material_cost, hardware_cost, labor_cost,
            markup_percentage, total,
            line_items,
            created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING
            id,
            job_id,
            quote_number,
            material_cost,
            hardware_cost,
            labor_cost,
            markup_percentage,
            total,
            line_items,
            created_at,
            updated_at
        "#,
        id,
        body.job_id,
        body.quote_number,
        body.material_cost,
        body.hardware_cost,
        body.labor_cost,
        body.markup_percentage,
        total,
        body.line_items,
        now,
        now
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(quote) => HttpResponse::Created().json(quote),
        Err(e) => {
            log::error!("create_quote DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create quote"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /quotes/{id}
// Re-calculates total whenever any cost field changes.
// ---------------------------------------------------------------------------

#[put("/{id}")]
pub async fn update_quote(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    body: web::Json<UpdateQuote>,
) -> impl Responder {
    let id = path.into_inner();
    let now = chrono::Utc::now();

    // Fetch current row to be able to recalculate total with merged values.
    let current = sqlx::query_as!(
        Quote,
        r#"
        SELECT
            id, job_id, quote_number,
            material_cost, hardware_cost, labor_cost,
            markup_percentage, total,
            line_items,
            created_at, updated_at
        FROM quotes
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(pool.get_ref())
    .await;

    let current = match current {
        Ok(Some(q)) => q,
        Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Quote not found",
                "id": id
            }))
        }
        Err(e) => {
            log::error!("update_quote fetch current error: {e}");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update quote"
            }));
        }
    };

    let material_cost = body.material_cost.unwrap_or(current.material_cost);
    let hardware_cost = body.hardware_cost.unwrap_or(current.hardware_cost);
    let labor_cost = body.labor_cost.unwrap_or(current.labor_cost);
    let markup_percentage = body.markup_percentage.unwrap_or(current.markup_percentage);
    let total = (material_cost + hardware_cost + labor_cost) * (1.0 + markup_percentage / 100.0);

    let result = sqlx::query_as!(
        Quote,
        r#"
        UPDATE quotes SET
            job_id            = COALESCE($2, job_id),
            quote_number      = COALESCE($3, quote_number),
            material_cost     = $4,
            hardware_cost     = $5,
            labor_cost        = $6,
            markup_percentage = $7,
            total             = $8,
            line_items        = COALESCE($9, line_items),
            updated_at        = $10
        WHERE id = $1
        RETURNING
            id,
            job_id,
            quote_number,
            material_cost,
            hardware_cost,
            labor_cost,
            markup_percentage,
            total,
            line_items,
            created_at,
            updated_at
        "#,
        id,
        body.job_id,
        body.quote_number,
        material_cost,
        hardware_cost,
        labor_cost,
        markup_percentage,
        total,
        body.line_items,
        now
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(quote) => HttpResponse::Ok().json(quote),
        Err(e) => {
            log::error!("update_quote DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update quote"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /quotes/{id}
// ---------------------------------------------------------------------------

#[delete("/{id}")]
pub async fn delete_quote(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query!("DELETE FROM quotes WHERE id = $1 RETURNING id", id)
        .fetch_optional(pool.get_ref())
        .await;

    match result {
        Ok(Some(_)) => HttpResponse::NoContent().finish(),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Quote not found",
            "id": id
        })),
        Err(e) => {
            log::error!("delete_quote DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete quote"
            }))
        }
    }
}
