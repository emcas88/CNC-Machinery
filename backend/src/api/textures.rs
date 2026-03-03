use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::texture::{
    CreateTexture, CreateTextureGroup, GrainOrientation, Sheen, Texture, TextureGroup,
    UpdateTexture, UpdateTextureGroup,
};

// ---------------------------------------------------------------------------
// Configure routes
// ---------------------------------------------------------------------------

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/textures")
            .service(list_textures)
            .service(get_texture)
            .service(create_texture)
            .service(update_texture)
            .service(delete_texture),
    );
    cfg.service(
        web::scope("/texture-groups")
            .service(list_texture_groups)
            .service(create_texture_group)
            .service(update_texture_group)
            .service(delete_texture_group),
    );
}

// ===========================================================================
// TEXTURE HANDLERS
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /textures
// ---------------------------------------------------------------------------

#[get("")]
pub async fn list_textures(pool: web::Data<PgPool>) -> impl Responder {
    let result = sqlx::query_as!(
        Texture,
        r#"
        SELECT
            id,
            name,
            abbreviation,
            image_url,
            sheen         AS "sheen: Sheen",
            grain_orientation AS "grain_orientation: GrainOrientation",
            transparency,
            metallicness,
            visual_width,
            visual_height,
            rotation_angle,
            texture_group_id,
            created_at,
            updated_at
        FROM textures
        ORDER BY name ASC
        "#
    )
    .fetch_all(pool.get_ref())
    .await;

    match result {
        Ok(textures) => HttpResponse::Ok().json(textures),
        Err(e) => {
            log::error!("list_textures DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to retrieve textures"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// GET /textures/{id}
// ---------------------------------------------------------------------------

#[get("/{id}")]
pub async fn get_texture(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query_as!(
        Texture,
        r#"
        SELECT
            id,
            name,
            abbreviation,
            image_url,
            sheen         AS "sheen: Sheen",
            grain_orientation AS "grain_orientation: GrainOrientation",
            transparency,
            metallicness,
            visual_width,
            visual_height,
            rotation_angle,
            texture_group_id,
            created_at,
            updated_at
        FROM textures
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(texture)) => HttpResponse::Ok().json(texture),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Texture not found",
            "id": id
        })),
        Err(e) => {
            log::error!("get_texture DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to retrieve texture"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// POST /textures
// ---------------------------------------------------------------------------

#[post("")]
pub async fn create_texture(
    pool: web::Data<PgPool>,
    body: web::Json<CreateTexture>,
) -> impl Responder {
    let id = Uuid::new_v4();
    let now = chrono::Utc::now();

    let result = sqlx::query_as!(
        Texture,
        r#"
        INSERT INTO textures (
            id, name, abbreviation, image_url,
            sheen, grain_orientation,
            transparency, metallicness,
            visual_width, visual_height, rotation_angle,
            texture_group_id,
            created_at, updated_at
        )
        VALUES (
            $1, $2, $3, $4,
            $5::text::texture_sheen, $6::text::texture_grain_orientation,
            $7, $8,
            $9, $10, $11,
            $12,
            $13, $14
        )
        RETURNING
            id,
            name,
            abbreviation,
            image_url,
            sheen         AS "sheen: Sheen",
            grain_orientation AS "grain_orientation: GrainOrientation",
            transparency,
            metallicness,
            visual_width,
            visual_height,
            rotation_angle,
            texture_group_id,
            created_at,
            updated_at
        "#,
        id,
        body.name,
        body.abbreviation,
        body.image_url,
        body.sheen.to_string(),
        body.grain_orientation.to_string(),
        body.transparency,
        body.metallicness,
        body.visual_width,
        body.visual_height,
        body.rotation_angle,
        body.texture_group_id,
        now,
        now
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(texture) => HttpResponse::Created().json(texture),
        Err(e) => {
            log::error!("create_texture DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create texture"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /textures/{id}
// ---------------------------------------------------------------------------

#[put("/{id}")]
pub async fn update_texture(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    body: web::Json<UpdateTexture>,
) -> impl Responder {
    let id = path.into_inner();
    let now = chrono::Utc::now();

    let exists = sqlx::query_scalar!("SELECT EXISTS(SELECT 1 FROM textures WHERE id = $1)", id)
        .fetch_one(pool.get_ref())
        .await;

    match exists {
        Ok(Some(false)) | Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Texture not found",
                "id": id
            }))
        }
        Err(e) => {
            log::error!("update_texture existence check error: {e}");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update texture"
            }));
        }
        _ => {}
    }

    let result = sqlx::query_as!(
        Texture,
        r#"
        UPDATE textures SET
            name              = COALESCE($2, name),
            abbreviation      = COALESCE($3, abbreviation),
            image_url         = COALESCE($4, image_url),
            sheen             = COALESCE($5::text::texture_sheen, sheen),
            grain_orientation = COALESCE($6::text::texture_grain_orientation, grain_orientation),
            transparency      = COALESCE($7, transparency),
            metallicness      = COALESCE($8, metallicness),
            visual_width      = COALESCE($9, visual_width),
            visual_height     = COALESCE($10, visual_height),
            rotation_angle    = COALESCE($11, rotation_angle),
            texture_group_id  = COALESCE($12, texture_group_id),
            updated_at        = $13
        WHERE id = $1
        RETURNING
            id,
            name,
            abbreviation,
            image_url,
            sheen         AS "sheen: Sheen",
            grain_orientation AS "grain_orientation: GrainOrientation",
            transparency,
            metallicness,
            visual_width,
            visual_height,
            rotation_angle,
            texture_group_id,
            created_at,
            updated_at
        "#,
        id,
        body.name,
        body.abbreviation,
        body.image_url,
        body.sheen.as_ref().map(|s| s.to_string()),
        body.grain_orientation.as_ref().map(|g| g.to_string()),
        body.transparency,
        body.metallicness,
        body.visual_width,
        body.visual_height,
        body.rotation_angle,
        body.texture_group_id,
        now
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(texture) => HttpResponse::Ok().json(texture),
        Err(e) => {
            log::error!("update_texture DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update texture"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /textures/{id}
// ---------------------------------------------------------------------------

#[delete("/{id}")]
pub async fn delete_texture(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query!("DELETE FROM textures WHERE id = $1 RETURNING id", id)
        .fetch_optional(pool.get_ref())
        .await;

    match result {
        Ok(Some(_)) => HttpResponse::NoContent().finish(),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Texture not found",
            "id": id
        })),
        Err(e) => {
            log::error!("delete_texture DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete texture"
            }))
        }
    }
}

// ===========================================================================
// TEXTURE GROUP HANDLERS
// ===========================================================================

// ---------------------------------------------------------------------------
// GET /texture-groups
// ---------------------------------------------------------------------------

#[get("")]
pub async fn list_texture_groups(pool: web::Data<PgPool>) -> impl Responder {
    let result = sqlx::query_as!(
        TextureGroup,
        r#"
        SELECT id, name, created_at
        FROM texture_groups
        ORDER BY name ASC
        "#
    )
    .fetch_all(pool.get_ref())
    .await;

    match result {
        Ok(groups) => HttpResponse::Ok().json(groups),
        Err(e) => {
            log::error!("list_texture_groups DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to retrieve texture groups"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// POST /texture-groups
// ---------------------------------------------------------------------------

#[post("")]
pub async fn create_texture_group(
    pool: web::Data<PgPool>,
    body: web::Json<CreateTextureGroup>,
) -> impl Responder {
    let id = Uuid::new_v4();
    let now = chrono::Utc::now();

    let result = sqlx::query_as!(
        TextureGroup,
        r#"
        INSERT INTO texture_groups (id, name, created_at)
        VALUES ($1, $2, $3)
        RETURNING id, name, created_at
        "#,
        id,
        body.name,
        now
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(group) => HttpResponse::Created().json(group),
        Err(e) => {
            log::error!("create_texture_group DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create texture group"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /texture-groups/{id}
// ---------------------------------------------------------------------------

#[put("/{id}")]
pub async fn update_texture_group(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    body: web::Json<UpdateTextureGroup>,
) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query_as!(
        TextureGroup,
        r#"
        UPDATE texture_groups SET
            name = COALESCE($2, name)
        WHERE id = $1
        RETURNING id, name, created_at
        "#,
        id,
        body.name
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(group)) => HttpResponse::Ok().json(group),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Texture group not found",
            "id": id
        })),
        Err(e) => {
            log::error!("update_texture_group DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update texture group"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /texture-groups/{id}
// ---------------------------------------------------------------------------

#[delete("/{id}")]
pub async fn delete_texture_group(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query!("DELETE FROM texture_groups WHERE id = $1 RETURNING id", id)
        .fetch_optional(pool.get_ref())
        .await;

    match result {
        Ok(Some(_)) => HttpResponse::NoContent().finish(),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Texture group not found",
            "id": id
        })),
        Err(e) => {
            log::error!("delete_texture_group DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete texture group"
            }))
        }
    }
}
