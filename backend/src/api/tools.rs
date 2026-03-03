use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::tool::{CreateTool, Tool, ToolType, UpdateTool};

// ---------------------------------------------------------------------------
// Configure routes
// ---------------------------------------------------------------------------

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/tools")
            .service(list_tools)
            .service(get_tool)
            .service(create_tool)
            .service(update_tool)
            .service(delete_tool),
    );
}

// ---------------------------------------------------------------------------
// GET /tools
// ---------------------------------------------------------------------------

#[get("")]
pub async fn list_tools(pool: web::Data<PgPool>) -> impl Responder {
    let result = sqlx::query_as!(
        Tool,
        r#"
        SELECT
            id,
            name,
            diameter,
            tool_type AS "tool_type: ToolType",
            rpm,
            feed_rate,
            plunge_rate,
            max_depth_per_pass,
            created_at,
            updated_at
        FROM tools
        ORDER BY name ASC
        "#
    )
    .fetch_all(pool.get_ref())
    .await;

    match result {
        Ok(tools) => HttpResponse::Ok().json(tools),
        Err(e) => {
            log::error!("list_tools DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to retrieve tools"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// GET /tools/{id}
// ---------------------------------------------------------------------------

#[get("/{id}")]
pub async fn get_tool(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query_as!(
        Tool,
        r#"
        SELECT
            id,
            name,
            diameter,
            tool_type AS "tool_type: ToolType",
            rpm,
            feed_rate,
            plunge_rate,
            max_depth_per_pass,
            created_at,
            updated_at
        FROM tools
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(tool)) => HttpResponse::Ok().json(tool),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Tool not found",
            "id": id
        })),
        Err(e) => {
            log::error!("get_tool DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to retrieve tool"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// POST /tools
// ---------------------------------------------------------------------------

#[post("")]
pub async fn create_tool(
    pool: web::Data<PgPool>,
    body: web::Json<CreateTool>,
) -> impl Responder {
    let id = Uuid::new_v4();
    let now = chrono::Utc::now();

    // Cast the enum via text round-trip so sqlx does not need a runtime PG
    // type OID lookup for the enum at compile time.
    let result = sqlx::query_as!(
        Tool,
        r#"
        INSERT INTO tools (
            id, name, diameter, tool_type,
            rpm, feed_rate, plunge_rate, max_depth_per_pass,
            created_at, updated_at
        )
        VALUES (
            $1, $2, $3,
            $4::text::tool_type,
            $5, $6, $7, $8,
            $9, $10
        )
        RETURNING
            id,
            name,
            diameter,
            tool_type AS "tool_type: ToolType",
            rpm,
            feed_rate,
            plunge_rate,
            max_depth_per_pass,
            created_at,
            updated_at
        "#,
        id,
        body.name,
        body.diameter,
        body.tool_type.to_string(),
        body.rpm,
        body.feed_rate,
        body.plunge_rate,
        body.max_depth_per_pass,
        now,
        now
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(tool) => HttpResponse::Created().json(tool),
        Err(e) => {
            log::error!("create_tool DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create tool"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /tools/{id}
// ---------------------------------------------------------------------------

#[put("/{id}")]
pub async fn update_tool(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    body: web::Json<UpdateTool>,
) -> impl Responder {
    let id = path.into_inner();
    let now = chrono::Utc::now();

    // Verify existence first
    let exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM tools WHERE id = $1)",
        id
    )
    .fetch_one(pool.get_ref())
    .await;

    match exists {
        Ok(Some(false)) | Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Tool not found",
                "id": id
            }))
        }
        Err(e) => {
            log::error!("update_tool existence check error: {e}");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update tool"
            }));
        }
        _ => {}
    }

    let result = sqlx::query_as!(
        Tool,
        r#"
        UPDATE tools SET
            name               = COALESCE($2, name),
            diameter           = COALESCE($3, diameter),
            tool_type          = COALESCE($4::text::tool_type, tool_type),
            rpm                = COALESCE($5, rpm),
            feed_rate          = COALESCE($6, feed_rate),
            plunge_rate        = COALESCE($7, plunge_rate),
            max_depth_per_pass = COALESCE($8, max_depth_per_pass),
            updated_at         = $9
        WHERE id = $1
        RETURNING
            id,
            name,
            diameter,
            tool_type AS "tool_type: ToolType",
            rpm,
            feed_rate,
            plunge_rate,
            max_depth_per_pass,
            created_at,
            updated_at
        "#,
        id,
        body.name,
        body.diameter,
        body.tool_type.as_ref().map(|t| t.to_string()),
        body.rpm,
        body.feed_rate,
        body.plunge_rate,
        body.max_depth_per_pass,
        now
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(tool) => HttpResponse::Ok().json(tool),
        Err(e) => {
            log::error!("update_tool DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update tool"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /tools/{id}
// ---------------------------------------------------------------------------

#[delete("/{id}")]
pub async fn delete_tool(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query!(
        "DELETE FROM tools WHERE id = $1 RETURNING id",
        id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(_)) => HttpResponse::NoContent().finish(),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Tool not found",
            "id": id
        })),
        Err(e) => {
            log::error!("delete_tool DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete tool"
            }))
        }
    }
}
