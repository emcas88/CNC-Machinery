use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::material::{CreateMaterial, Material, UpdateMaterial};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /materials
#[get("")]
pub async fn list_materials(pool: web::Data<PgPool>) -> impl Responder {
    let result = sqlx::query_as!(
        Material,
        r#"
        SELECT
            id, name, sku, material_type,
            thickness_mm, width_mm, length_mm,
            supplier, cost_per_sheet, description,
            created_at, updated_at
        FROM materials
        ORDER BY name ASC
        "#
    )
    .fetch_all(pool.get_ref())
    .await;

    match result {
        Ok(materials) => HttpResponse::Ok().json(materials),
        Err(e) => {
            log::error!("list_materials DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch materials"
            }))
        }
    }
}

/// GET /materials/{id}
#[get("/{id}")]
pub async fn get_material(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query_as!(
        Material,
        r#"
        SELECT
            id, name, sku, material_type,
            thickness_mm, width_mm, length_mm,
            supplier, cost_per_sheet, description,
            created_at, updated_at
        FROM materials
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(material)) => HttpResponse::Ok().json(material),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": format!("Material {} not found", id)
        })),
        Err(e) => {
            log::error!("get_material DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch material"
            }))
        }
    }
}

/// POST /materials
#[post("")]
pub async fn create_material(
    pool: web::Data<PgPool>,
    body: web::Json<CreateMaterial>,
) -> impl Responder {
    let result = sqlx::query_as!(
        Material,
        r#"
        INSERT INTO materials (
            id, name, sku, material_type,
            thickness_mm, width_mm, length_mm,
            supplier, cost_per_sheet, description,
            created_at, updated_at
        )
        VALUES (
            gen_random_uuid(), $1, $2, $3,
            $4, $5, $6,
            $7, $8, $9,
            NOW(), NOW()
        )
        RETURNING
            id, name, sku, material_type,
            thickness_mm, width_mm, length_mm,
            supplier, cost_per_sheet, description,
            created_at, updated_at
        "#,
        body.name,
        body.sku,
        body.material_type,
        body.thickness_mm,
        body.width_mm,
        body.length_mm,
        body.supplier,
        body.cost_per_sheet,
        body.description,
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(material) => HttpResponse::Created().json(material),
        Err(e) => {
            log::error!("create_material DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create material"
            }))
        }
    }
}

/// PUT /materials/{id}
#[put("/{id}")]
pub async fn update_material(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    body: web::Json<UpdateMaterial>,
) -> impl Responder {
    let id = path.into_inner();

    let exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM materials WHERE id = $1)",
        id
    )
    .fetch_one(pool.get_ref())
    .await;

    match exists {
        Ok(Some(false)) | Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": format!("Material {} not found", id)
            }));
        }
        Err(e) => {
            log::error!("update_material existence check error: {e}");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update material"
            }));
        }
        Ok(Some(true)) => {}
    }

    let mut builder =
        sqlx::QueryBuilder::<sqlx::Postgres>::new("UPDATE materials SET updated_at = NOW()");

    if let Some(name) = &body.name {
        builder.push(", name = ");
        builder.push_bind(name);
    }
    if let Some(sku) = &body.sku {
        builder.push(", sku = ");
        builder.push_bind(sku);
    }
    if let Some(material_type) = &body.material_type {
        builder.push(", material_type = ");
        builder.push_bind(material_type);
    }
    if let Some(thickness_mm) = &body.thickness_mm {
        builder.push(", thickness_mm = ");
        builder.push_bind(thickness_mm);
    }
    if let Some(width_mm) = &body.width_mm {
        builder.push(", width_mm = ");
        builder.push_bind(width_mm);
    }
    if let Some(length_mm) = &body.length_mm {
        builder.push(", length_mm = ");
        builder.push_bind(length_mm);
    }
    if let Some(supplier) = &body.supplier {
        builder.push(", supplier = ");
        builder.push_bind(supplier);
    }
    if let Some(cost_per_sheet) = &body.cost_per_sheet {
        builder.push(", cost_per_sheet = ");
        builder.push_bind(cost_per_sheet);
    }
    if let Some(description) = &body.description {
        builder.push(", description = ");
        builder.push_bind(description);
    }

    builder.push(" WHERE id = ");
    builder.push_bind(id);
    builder.push(
        " RETURNING id, name, sku, material_type,
                   thickness_mm, width_mm, length_mm,
                   supplier, cost_per_sheet, description,
                   created_at, updated_at",
    );

    let query = builder.build_query_as::<Material>();
    match query.fetch_one(pool.get_ref()).await {
        Ok(material) => HttpResponse::Ok().json(material),
        Err(e) => {
            log::error!("update_material DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update material"
            }))
        }
    }
}

/// DELETE /materials/{id}
#[delete("/{id}")]
pub async fn delete_material(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query!(
        "DELETE FROM materials WHERE id = $1 RETURNING id",
        id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(_)) => HttpResponse::NoContent().finish(),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": format!("Material {} not found", id)
        })),
        Err(e) => {
            log::error!("delete_material DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete material"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/materials")
            .service(list_materials)
            .service(get_material)
            .service(create_material)
            .service(update_material)
            .service(delete_material),
    );
}
