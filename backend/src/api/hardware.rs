use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::hardware::{CreateHardware, Hardware, UpdateHardware};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /hardware
#[get("")]
pub async fn list_hardware(pool: web::Data<PgPool>) -> impl Responder {
    let result = sqlx::query_as!(
        Hardware,
        r#"
        SELECT
            id, name, sku, hardware_type,
            supplier, unit_cost, description,
            created_at, updated_at
        FROM hardware
        ORDER BY name ASC
        "#
    )
    .fetch_all(pool.get_ref())
    .await;

    match result {
        Ok(hardware) => HttpResponse::Ok().json(hardware),
        Err(e) => {
            log::error!("list_hardware DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch hardware"
            }))
        }
    }
}

/// GET /hardware/{id}
#[get("/{id}")]
pub async fn get_hardware_item(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query_as!(
        Hardware,
        r#"
        SELECT
            id, name, sku, hardware_type,
            supplier, unit_cost, description,
            created_at, updated_at
        FROM hardware
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(item)) => HttpResponse::Ok().json(item),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": format!("Hardware item {} not found", id)
        })),
        Err(e) => {
            log::error!("get_hardware_item DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch hardware item"
            }))
        }
    }
}

/// POST /hardware
#[post("")]
pub async fn create_hardware(
    pool: web::Data<PgPool>,
    body: web::Json<CreateHardware>,
) -> impl Responder {
    let result = sqlx::query_as!(
        Hardware,
        r#"
        INSERT INTO hardware (
            id, name, sku, hardware_type,
            supplier, unit_cost, description,
            created_at, updated_at
        )
        VALUES (
            gen_random_uuid(), $1, $2, $3,
            $4, $5, $6,
            NOW(), NOW()
        )
        RETURNING
            id, name, sku, hardware_type,
            supplier, unit_cost, description,
            created_at, updated_at
        "#,
        body.name,
        body.sku,
        body.hardware_type,
        body.supplier,
        body.unit_cost,
        body.description,
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(item) => HttpResponse::Created().json(item),
        Err(e) => {
            log::error!("create_hardware DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create hardware item"
            }))
        }
    }
}

/// PUT /hardware/{id}
#[put("/{id}")]
pub async fn update_hardware(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    body: web::Json<UpdateHardware>,
) -> impl Responder {
    let id = path.into_inner();

    let exists = sqlx::query_scalar!("SELECT EXISTS(SELECT 1 FROM hardware WHERE id = $1)", id)
        .fetch_one(pool.get_ref())
        .await;

    match exists {
        Ok(Some(false)) | Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": format!("Hardware item {} not found", id)
            }));
        }
        Err(e) => {
            log::error!("update_hardware existence check error: {e}");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update hardware item"
            }));
        }
        Ok(Some(true)) => {}
    }

    let mut builder =
        sqlx::QueryBuilder::<sqlx::Postgres>::new("UPDATE hardware SET updated_at = NOW()");

    if let Some(name) = &body.name {
        builder.push(", name = ");
        builder.push_bind(name);
    }
    if let Some(sku) = &body.sku {
        builder.push(", sku = ");
        builder.push_bind(sku);
    }
    if let Some(hardware_type) = &body.hardware_type {
        builder.push(", hardware_type = ");
        builder.push_bind(hardware_type);
    }
    if let Some(supplier) = &body.supplier {
        builder.push(", supplier = ");
        builder.push_bind(supplier);
    }
    if let Some(unit_cost) = &body.unit_cost {
        builder.push(", unit_cost = ");
        builder.push_bind(unit_cost);
    }
    if let Some(description) = &body.description {
        builder.push(", description = ");
        builder.push_bind(description);
    }

    builder.push(" WHERE id = ");
    builder.push_bind(id);
    builder.push(
        " RETURNING id, name, sku, hardware_type,
                   supplier, unit_cost, description,
                   created_at, updated_at",
    );

    let query = builder.build_query_as::<Hardware>();
    match query.fetch_one(pool.get_ref()).await {
        Ok(item) => HttpResponse::Ok().json(item),
        Err(e) => {
            log::error!("update_hardware DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update hardware item"
            }))
        }
    }
}

/// DELETE /hardware/{id}
#[delete("/{id}")]
pub async fn delete_hardware(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query!("DELETE FROM hardware WHERE id = $1 RETURNING id", id)
        .fetch_optional(pool.get_ref())
        .await;

    match result {
        Ok(Some(_)) => HttpResponse::NoContent().finish(),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": format!("Hardware item {} not found", id)
        })),
        Err(e) => {
            log::error!("delete_hardware DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete hardware item"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/hardware")
            .service(list_hardware)
            .service(get_hardware_item)
            .service(create_hardware)
            .service(update_hardware)
            .service(delete_hardware),
    );
}
