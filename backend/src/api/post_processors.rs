use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::post_processor::{CreatePostProcessor, PostProcessor, UpdatePostProcessor};

// ---------------------------------------------------------------------------
// Configure routes
// ---------------------------------------------------------------------------

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/post-processors")
            .service(list_post_processors)
            .service(get_post_processor)
            .service(create_post_processor)
            .service(update_post_processor)
            .service(delete_post_processor),
    );
}

// ---------------------------------------------------------------------------
// GET /post-processors
// ---------------------------------------------------------------------------

#[get("")]
pub async fn list_post_processors(pool: web::Data<PgPool>) -> impl Responder {
    let result = sqlx::query_as!(
        PostProcessor,
        r#"
        SELECT
            id,
            name,
            controller_type,
            file_extension,
            template_config,
            created_at,
            updated_at
        FROM post_processors
        ORDER BY name ASC
        "#
    )
    .fetch_all(pool.get_ref())
    .await;

    match result {
        Ok(processors) => HttpResponse::Ok().json(processors),
        Err(e) => {
            log::error!("list_post_processors DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to retrieve post-processors"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// GET /post-processors/{id}
// ---------------------------------------------------------------------------

#[get("/{id}")]
pub async fn get_post_processor(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query_as!(
        PostProcessor,
        r#"
        SELECT
            id,
            name,
            controller_type,
            file_extension,
            template_config,
            created_at,
            updated_at
        FROM post_processors
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(processor)) => HttpResponse::Ok().json(processor),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Post-processor not found",
            "id": id
        })),
        Err(e) => {
            log::error!("get_post_processor DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to retrieve post-processor"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// POST /post-processors
// ---------------------------------------------------------------------------

#[post("")]
pub async fn create_post_processor(
    pool: web::Data<PgPool>,
    body: web::Json<CreatePostProcessor>,
) -> impl Responder {
    let id = Uuid::new_v4();
    let now = chrono::Utc::now();

    let result = sqlx::query_as!(
        PostProcessor,
        r#"
        INSERT INTO post_processors (
            id, name, controller_type, file_extension, template_config,
            created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
            id,
            name,
            controller_type,
            file_extension,
            template_config,
            created_at,
            updated_at
        "#,
        id,
        body.name,
        body.controller_type,
        body.file_extension,
        body.template_config,
        now,
        now
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(processor) => HttpResponse::Created().json(processor),
        Err(e) => {
            log::error!("create_post_processor DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create post-processor"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /post-processors/{id}
// ---------------------------------------------------------------------------

#[put("/{id}")]
pub async fn update_post_processor(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    body: web::Json<UpdatePostProcessor>,
) -> impl Responder {
    let id = path.into_inner();
    let now = chrono::Utc::now();

    let exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM post_processors WHERE id = $1)",
        id
    )
    .fetch_one(pool.get_ref())
    .await;

    match exists {
        Ok(Some(false)) | Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Post-processor not found",
                "id": id
            }))
        }
        Err(e) => {
            log::error!("update_post_processor existence check error: {e}");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update post-processor"
            }));
        }
        _ => {}
    }

    let result = sqlx::query_as!(
        PostProcessor,
        r#"
        UPDATE post_processors SET
            name            = COALESCE($2, name),
            controller_type = COALESCE($3, controller_type),
            file_extension  = COALESCE($4, file_extension),
            template_config = COALESCE($5, template_config),
            updated_at      = $6
        WHERE id = $1
        RETURNING
            id,
            name,
            controller_type,
            file_extension,
            template_config,
            created_at,
            updated_at
        "#,
        id,
        body.name,
        body.controller_type,
        body.file_extension,
        body.template_config,
        now
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(processor) => HttpResponse::Ok().json(processor),
        Err(e) => {
            log::error!("update_post_processor DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update post-processor"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /post-processors/{id}
// ---------------------------------------------------------------------------

#[delete("/{id}")]
pub async fn delete_post_processor(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query!("DELETE FROM post_processors WHERE id = $1 RETURNING id", id)
        .fetch_optional(pool.get_ref())
        .await;

    match result {
        Ok(Some(_)) => HttpResponse::NoContent().finish(),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Post-processor not found",
            "id": id
        })),
        Err(e) => {
            log::error!("delete_post_processor DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete post-processor"
            }))
        }
    }
}
