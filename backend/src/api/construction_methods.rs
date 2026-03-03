use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::construction_method::{
    ConstructionMethod, CreateConstructionMethod, UpdateConstructionMethod,
};

// ---------------------------------------------------------------------------
// Configure routes
// ---------------------------------------------------------------------------

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/construction-methods")
            .service(list_construction_methods)
            .service(get_construction_method)
            .service(create_construction_method)
            .service(update_construction_method)
            .service(delete_construction_method),
    );
}

// ---------------------------------------------------------------------------
// GET /construction-methods
// ---------------------------------------------------------------------------

#[get("")]
pub async fn list_construction_methods(pool: web::Data<PgPool>) -> impl Responder {
    let result = sqlx::query_as!(
        ConstructionMethod,
        r#"
        SELECT
            id,
            name,
            joinery_type,
            fastener_specs,
            placement_rules,
            created_at,
            updated_at
        FROM construction_methods
        ORDER BY name ASC
        "#
    )
    .fetch_all(pool.get_ref())
    .await;

    match result {
        Ok(methods) => HttpResponse::Ok().json(methods),
        Err(e) => {
            log::error!("list_construction_methods DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to retrieve construction methods"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// GET /construction-methods/{id}
// ---------------------------------------------------------------------------

#[get("/{id}")]
pub async fn get_construction_method(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query_as!(
        ConstructionMethod,
        r#"
        SELECT
            id,
            name,
            joinery_type,
            fastener_specs,
            placement_rules,
            created_at,
            updated_at
        FROM construction_methods
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(method)) => HttpResponse::Ok().json(method),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Construction method not found",
            "id": id
        })),
        Err(e) => {
            log::error!("get_construction_method DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to retrieve construction method"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// POST /construction-methods
// ---------------------------------------------------------------------------

#[post("")]
pub async fn create_construction_method(
    pool: web::Data<PgPool>,
    body: web::Json<CreateConstructionMethod>,
) -> impl Responder {
    let id = Uuid::new_v4();
    let now = chrono::Utc::now();

    // joinery_type is TEXT[] — pass as &[String] which sqlx maps to text[]
    let result = sqlx::query_as!(
        ConstructionMethod,
        r#"
        INSERT INTO construction_methods (
            id, name, joinery_type, fastener_specs, placement_rules,
            created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
            id,
            name,
            joinery_type,
            fastener_specs,
            placement_rules,
            created_at,
            updated_at
        "#,
        id,
        body.name,
        &body.joinery_type, // &[String] → text[]
        body.fastener_specs,
        body.placement_rules,
        now,
        now
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(method) => HttpResponse::Created().json(method),
        Err(e) => {
            log::error!("create_construction_method DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create construction method"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /construction-methods/{id}
// ---------------------------------------------------------------------------

#[put("/{id}")]
pub async fn update_construction_method(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    body: web::Json<UpdateConstructionMethod>,
) -> impl Responder {
    let id = path.into_inner();
    let now = chrono::Utc::now();

    let exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM construction_methods WHERE id = $1)",
        id
    )
    .fetch_one(pool.get_ref())
    .await;

    match exists {
        Ok(Some(false)) | Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Construction method not found",
                "id": id
            }))
        }
        Err(e) => {
            log::error!("update_construction_method existence check error: {e}");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update construction method"
            }));
        }
        _ => {}
    }

    // For TEXT[] partial updates we fall back to a dynamic approach:
    // if joinery_type is Some we replace the entire array, otherwise keep current.
    let result = sqlx::query_as!(
        ConstructionMethod,
        r#"
        UPDATE construction_methods SET
            name            = COALESCE($2, name),
            joinery_type    = CASE WHEN $3::text[] IS NOT NULL THEN $3 ELSE joinery_type END,
            fastener_specs  = COALESCE($4, fastener_specs),
            placement_rules = COALESCE($5, placement_rules),
            updated_at      = $6
        WHERE id = $1
        RETURNING
            id,
            name,
            joinery_type,
            fastener_specs,
            placement_rules,
            created_at,
            updated_at
        "#,
        id,
        body.name,
        body.joinery_type.as_deref(), // Option<&[String]>
        body.fastener_specs,
        body.placement_rules,
        now
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(method) => HttpResponse::Ok().json(method),
        Err(e) => {
            log::error!("update_construction_method DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update construction method"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /construction-methods/{id}
// ---------------------------------------------------------------------------

#[delete("/{id}")]
pub async fn delete_construction_method(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query!(
        "DELETE FROM construction_methods WHERE id = $1 RETURNING id",
        id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(_)) => HttpResponse::NoContent().finish(),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Construction method not found",
            "id": id
        })),
        Err(e) => {
            log::error!("delete_construction_method DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete construction method"
            }))
        }
    }
}
