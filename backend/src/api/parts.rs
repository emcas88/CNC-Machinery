use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::part::{CreatePart, Part, UpdatePart};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /products/{product_id}/parts
#[get("")]
pub async fn list_parts(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let product_id = path.into_inner();

    let result = sqlx::query_as!(
        Part,
        r#"
        SELECT
            id, product_id, material_id, name, part_type,
            width_mm, height_mm, thickness_mm, quantity,
            edge_banding, machining_data,
            grain_direction, notes,
            created_at, updated_at
        FROM parts
        WHERE product_id = $1
        ORDER BY created_at ASC
        "#,
        product_id
    )
    .fetch_all(pool.get_ref())
    .await;

    match result {
        Ok(parts) => HttpResponse::Ok().json(parts),
        Err(e) => {
            log::error!("list_parts DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch parts"
            }))
        }
    }
}

/// GET /products/{product_id}/parts/{id}
#[get("/{id}")]
pub async fn get_part(pool: web::Data<PgPool>, path: web::Path<(Uuid, Uuid)>) -> impl Responder {
    let (product_id, id) = path.into_inner();

    let result = sqlx::query_as!(
        Part,
        r#"
        SELECT
            id, product_id, material_id, name, part_type,
            width_mm, height_mm, thickness_mm, quantity,
            edge_banding, machining_data,
            grain_direction, notes,
            created_at, updated_at
        FROM parts
        WHERE id = $1 AND product_id = $2
        "#,
        id,
        product_id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(part)) => HttpResponse::Ok().json(part),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": format!("Part {} not found for product {}", id, product_id)
        })),
        Err(e) => {
            log::error!("get_part DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch part"
            }))
        }
    }
}

/// POST /products/{product_id}/parts
#[post("")]
pub async fn create_part(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    body: web::Json<CreatePart>,
) -> impl Responder {
    let product_id = path.into_inner();

    let result = sqlx::query_as!(
        Part,
        r#"
        INSERT INTO parts (
            id, product_id, material_id, name, part_type,
            width_mm, height_mm, thickness_mm, quantity,
            edge_banding, machining_data,
            grain_direction, notes,
            created_at, updated_at
        )
        VALUES (
            gen_random_uuid(), $1, $2, $3, $4,
            $5, $6, $7, $8,
            $9, $10,
            $11, $12,
            NOW(), NOW()
        )
        RETURNING
            id, product_id, material_id, name, part_type,
            width_mm, height_mm, thickness_mm, quantity,
            edge_banding, machining_data,
            grain_direction, notes,
            created_at, updated_at
        "#,
        product_id,
        body.material_id,
        body.name,
        body.part_type,
        body.width_mm,
        body.height_mm,
        body.thickness_mm,
        body.quantity,
        body.edge_banding as _,
        body.machining_data as _,
        body.grain_direction,
        body.notes,
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(part) => HttpResponse::Created().json(part),
        Err(e) => {
            log::error!("create_part DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create part"
            }))
        }
    }
}

/// PUT /products/{product_id}/parts/{id}
#[put("/{id}")]
pub async fn update_part(
    pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
    body: web::Json<UpdatePart>,
) -> impl Responder {
    let (product_id, id) = path.into_inner();

    let exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM parts WHERE id = $1 AND product_id = $2)",
        id,
        product_id
    )
    .fetch_one(pool.get_ref())
    .await;

    match exists {
        Ok(Some(false)) | Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": format!("Part {} not found for product {}", id, product_id)
            }));
        }
        Err(e) => {
            log::error!("update_part existence check error: {e}");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update part"
            }));
        }
        Ok(Some(true)) => {}
    }

    let mut builder =
        sqlx::QueryBuilder::<sqlx::Postgres>::new("UPDATE parts SET updated_at = NOW()");

    if let Some(material_id) = &body.material_id {
        builder.push(", material_id = ");
        builder.push_bind(material_id);
    }
    if let Some(name) = &body.name {
        builder.push(", name = ");
        builder.push_bind(name);
    }
    if let Some(part_type) = &body.part_type {
        builder.push(", part_type = ");
        builder.push_bind(part_type);
    }
    if let Some(width_mm) = &body.width_mm {
        builder.push(", width_mm = ");
        builder.push_bind(width_mm);
    }
    if let Some(height_mm) = &body.height_mm {
        builder.push(", height_mm = ");
        builder.push_bind(height_mm);
    }
    if let Some(thickness_mm) = &body.thickness_mm {
        builder.push(", thickness_mm = ");
        builder.push_bind(thickness_mm);
    }
    if let Some(quantity) = &body.quantity {
        builder.push(", quantity = ");
        builder.push_bind(quantity);
    }
    if let Some(edge_banding) = &body.edge_banding {
        builder.push(", edge_banding = ");
        builder.push_bind(edge_banding);
    }
    if let Some(machining_data) = &body.machining_data {
        builder.push(", machining_data = ");
        builder.push_bind(machining_data);
    }
    if let Some(grain_direction) = &body.grain_direction {
        builder.push(", grain_direction = ");
        builder.push_bind(grain_direction);
    }
    if let Some(notes) = &body.notes {
        builder.push(", notes = ");
        builder.push_bind(notes);
    }

    builder.push(" WHERE id = ");
    builder.push_bind(id);
    builder.push(" AND product_id = ");
    builder.push_bind(product_id);
    builder.push(
        " RETURNING id, product_id, material_id, name, part_type,
                   width_mm, height_mm, thickness_mm, quantity,
                   edge_banding, machining_data,
                   grain_direction, notes,
                   created_at, updated_at",
    );

    let query = builder.build_query_as::<Part>();
    match query.fetch_one(pool.get_ref()).await {
        Ok(part) => HttpResponse::Ok().json(part),
        Err(e) => {
            log::error!("update_part DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update part"
            }))
        }
    }
}

/// DELETE /products/{product_id}/parts/{id}
#[delete("/{id}")]
pub async fn delete_part(pool: web::Data<PgPool>, path: web::Path<(Uuid, Uuid)>) -> impl Responder {
    let (product_id, id) = path.into_inner();

    let result = sqlx::query!(
        "DELETE FROM parts WHERE id = $1 AND product_id = $2 RETURNING id",
        id,
        product_id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(_)) => HttpResponse::NoContent().finish(),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": format!("Part {} not found for product {}", id, product_id)
        })),
        Err(e) => {
            log::error!("delete_part DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete part"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// Router — nested under /products/{product_id}
// ---------------------------------------------------------------------------

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/products/{product_id}/parts")
            .service(list_parts)
            .service(get_part)
            .service(create_part)
            .service(update_part)
            .service(delete_part),
    );
}
