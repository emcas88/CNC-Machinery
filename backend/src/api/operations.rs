use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::operation::{CreateOperation, Operation, UpdateOperation};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /parts/{part_id}/operations
#[get("")]
pub async fn list_operations(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let part_id = path.into_inner();

    let result = sqlx::query_as!(
        Operation,
        r#"
        SELECT
            id, part_id, machine_id, operation_type,
            sequence_order, tool_id,
            feed_rate_mm_min, spindle_speed_rpm, depth_mm,
            parameters, status,
            created_at, updated_at
        FROM operations
        WHERE part_id = $1
        ORDER BY sequence_order ASC, created_at ASC
        "#,
        part_id
    )
    .fetch_all(pool.get_ref())
    .await;

    match result {
        Ok(operations) => HttpResponse::Ok().json(operations),
        Err(e) => {
            log::error!("list_operations DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch operations"
            }))
        }
    }
}

/// GET /parts/{part_id}/operations/{id}
#[get("/{id}")]
pub async fn get_operation(
    pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
) -> impl Responder {
    let (part_id, id) = path.into_inner();

    let result = sqlx::query_as!(
        Operation,
        r#"
        SELECT
            id, part_id, machine_id, operation_type,
            sequence_order, tool_id,
            feed_rate_mm_min, spindle_speed_rpm, depth_mm,
            parameters, status,
            created_at, updated_at
        FROM operations
        WHERE id = $1 AND part_id = $2
        "#,
        id,
        part_id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(op)) => HttpResponse::Ok().json(op),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": format!("Operation {} not found for part {}", id, part_id)
        })),
        Err(e) => {
            log::error!("get_operation DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch operation"
            }))
        }
    }
}

/// POST /parts/{part_id}/operations
#[post("")]
pub async fn create_operation(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    body: web::Json<CreateOperation>,
) -> impl Responder {
    let part_id = path.into_inner();

    let result = sqlx::query_as!(
        Operation,
        r#"
        INSERT INTO operations (
            id, part_id, machine_id, operation_type,
            sequence_order, tool_id,
            feed_rate_mm_min, spindle_speed_rpm, depth_mm,
            parameters, status,
            created_at, updated_at
        )
        VALUES (
            gen_random_uuid(), $1, $2, $3,
            $4, $5,
            $6, $7, $8,
            $9, COALESCE($10, 'pending'),
            NOW(), NOW()
        )
        RETURNING
            id, part_id, machine_id, operation_type,
            sequence_order, tool_id,
            feed_rate_mm_min, spindle_speed_rpm, depth_mm,
            parameters, status,
            created_at, updated_at
        "#,
        part_id,
        body.machine_id,
        body.operation_type,
        body.sequence_order,
        body.tool_id,
        body.feed_rate_mm_min,
        body.spindle_speed_rpm,
        body.depth_mm,
        body.parameters as _,
        body.status,
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(op) => HttpResponse::Created().json(op),
        Err(e) => {
            log::error!("create_operation DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create operation"
            }))
        }
    }
}

/// PUT /parts/{part_id}/operations/{id}
#[put("/{id}")]
pub async fn update_operation(
    pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
    body: web::Json<UpdateOperation>,
) -> impl Responder {
    let (part_id, id) = path.into_inner();

    let exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM operations WHERE id = $1 AND part_id = $2)",
        id,
        part_id
    )
    .fetch_one(pool.get_ref())
    .await;

    match exists {
        Ok(Some(false)) | Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": format!("Operation {} not found for part {}", id, part_id)
            }));
        }
        Err(e) => {
            log::error!("update_operation existence check error: {e}");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update operation"
            }));
        }
        Ok(Some(true)) => {}
    }

    let mut builder =
        sqlx::QueryBuilder::<sqlx::Postgres>::new("UPDATE operations SET updated_at = NOW()");

    if let Some(machine_id) = &body.machine_id {
        builder.push(", machine_id = ");
        builder.push_bind(machine_id);
    }
    if let Some(operation_type) = &body.operation_type {
        builder.push(", operation_type = ");
        builder.push_bind(operation_type);
    }
    if let Some(sequence_order) = &body.sequence_order {
        builder.push(", sequence_order = ");
        builder.push_bind(sequence_order);
    }
    if let Some(tool_id) = &body.tool_id {
        builder.push(", tool_id = ");
        builder.push_bind(tool_id);
    }
    if let Some(feed_rate_mm_min) = &body.feed_rate_mm_min {
        builder.push(", feed_rate_mm_min = ");
        builder.push_bind(feed_rate_mm_min);
    }
    if let Some(spindle_speed_rpm) = &body.spindle_speed_rpm {
        builder.push(", spindle_speed_rpm = ");
        builder.push_bind(spindle_speed_rpm);
    }
    if let Some(depth_mm) = &body.depth_mm {
        builder.push(", depth_mm = ");
        builder.push_bind(depth_mm);
    }
    if let Some(parameters) = &body.parameters {
        builder.push(", parameters = ");
        builder.push_bind(parameters);
    }
    if let Some(status) = &body.status {
        builder.push(", status = ");
        builder.push_bind(status);
    }

    builder.push(" WHERE id = ");
    builder.push_bind(id);
    builder.push(" AND part_id = ");
    builder.push_bind(part_id);
    builder.push(
        " RETURNING id, part_id, machine_id, operation_type,
                   sequence_order, tool_id,
                   feed_rate_mm_min, spindle_speed_rpm, depth_mm,
                   parameters, status,
                   created_at, updated_at",
    );

    let query = builder.build_query_as::<Operation>();
    match query.fetch_one(pool.get_ref()).await {
        Ok(op) => HttpResponse::Ok().json(op),
        Err(e) => {
            log::error!("update_operation DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update operation"
            }))
        }
    }
}

/// DELETE /parts/{part_id}/operations/{id}
#[delete("/{id}")]
pub async fn delete_operation(
    pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
) -> impl Responder {
    let (part_id, id) = path.into_inner();

    let result = sqlx::query!(
        "DELETE FROM operations WHERE id = $1 AND part_id = $2 RETURNING id",
        id,
        part_id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(_)) => HttpResponse::NoContent().finish(),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": format!("Operation {} not found for part {}", id, part_id)
        })),
        Err(e) => {
            log::error!("delete_operation DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete operation"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// Router — nested under /parts/{part_id}
// ---------------------------------------------------------------------------

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/parts/{part_id}/operations")
            .service(list_operations)
            .service(get_operation)
            .service(create_operation)
            .service(update_operation)
            .service(delete_operation),
    );
}
