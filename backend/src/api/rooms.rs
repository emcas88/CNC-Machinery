use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::room::{CreateRoom, Room, UpdateRoom};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /jobs/{job_id}/rooms
#[get("")]
pub async fn list_rooms(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let job_id = path.into_inner();

    let result = sqlx::query_as!(
        Room,
        r#"
        SELECT id, job_id, name, width, height, depth, notes,
               material_overrides, construction_overrides,
               created_at, updated_at
        FROM rooms
        WHERE job_id = $1
        ORDER BY created_at ASC
        "#,
        job_id
    )
    .fetch_all(pool.get_ref())
    .await;

    match result {
        Ok(rooms) => HttpResponse::Ok().json(rooms),
        Err(e) => {
            log::error!("list_rooms DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch rooms"
            }))
        }
    }
}

/// GET /jobs/{job_id}/rooms/{id}
#[get("/{id}")]
pub async fn get_room(pool: web::Data<PgPool>, path: web::Path<(Uuid, Uuid)>) -> impl Responder {
    let (job_id, id) = path.into_inner();

    let result = sqlx::query_as!(
        Room,
        r#"
        SELECT id, job_id, name, width, height, depth, notes,
               material_overrides, construction_overrides,
               created_at, updated_at
        FROM rooms
        WHERE id = $1 AND job_id = $2
        "#,
        id,
        job_id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(room)) => HttpResponse::Ok().json(room),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": format!("Room {} not found for job {}", id, job_id)
        })),
        Err(e) => {
            log::error!("get_room DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch room"
            }))
        }
    }
}

/// POST /jobs/{job_id}/rooms
#[post("")]
pub async fn create_room(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    body: web::Json<CreateRoom>,
) -> impl Responder {
    let job_id = path.into_inner();

    let result = sqlx::query_as!(
        Room,
        r#"
        INSERT INTO rooms (
            id, job_id, name, width, height, depth, notes,
            material_overrides, construction_overrides,
            created_at, updated_at
        )
        VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6,
            $7, $8,
            NOW(), NOW()
        )
        RETURNING id, job_id, name, width, height, depth, notes,
                  material_overrides, construction_overrides,
                  created_at, updated_at
        "#,
        job_id,
        body.name,
        body.width,
        body.height,
        body.depth,
        body.notes,
        body.material_overrides as _,
        body.construction_overrides as _,
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(room) => HttpResponse::Created().json(room),
        Err(e) => {
            log::error!("create_room DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create room"
            }))
        }
    }
}

/// PUT /jobs/{job_id}/rooms/{id}
#[put("/{id}")]
pub async fn update_room(
    pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
    body: web::Json<UpdateRoom>,
) -> impl Responder {
    let (job_id, id) = path.into_inner();

    let exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM rooms WHERE id = $1 AND job_id = $2)",
        id,
        job_id
    )
    .fetch_one(pool.get_ref())
    .await;

    match exists {
        Ok(Some(false)) | Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": format!("Room {} not found for job {}", id, job_id)
            }));
        }
        Err(e) => {
            log::error!("update_room existence check error: {e}");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update room"
            }));
        }
        Ok(Some(true)) => {}
    }

    let mut builder =
        sqlx::QueryBuilder::<sqlx::Postgres>::new("UPDATE rooms SET updated_at = NOW()");

    if let Some(name) = &body.name {
        builder.push(", name = ");
        builder.push_bind(name);
    }
    if let Some(width) = &body.width {
        builder.push(", width = ");
        builder.push_bind(width);
    }
    if let Some(height) = &body.height {
        builder.push(", height = ");
        builder.push_bind(height);
    }
    if let Some(depth) = &body.depth {
        builder.push(", depth = ");
        builder.push_bind(depth);
    }
    if let Some(notes) = &body.notes {
        builder.push(", notes = ");
        builder.push_bind(notes);
    }
    if let Some(material_overrides) = &body.material_overrides {
        builder.push(", material_overrides = ");
        builder.push_bind(material_overrides);
    }
    if let Some(construction_overrides) = &body.construction_overrides {
        builder.push(", construction_overrides = ");
        builder.push_bind(construction_overrides);
    }

    builder.push(" WHERE id = ");
    builder.push_bind(id);
    builder.push(" AND job_id = ");
    builder.push_bind(job_id);
    builder.push(
        " RETURNING id, job_id, name, width, height, depth, notes,
                   material_overrides, construction_overrides,
                   created_at, updated_at",
    );

    let query = builder.build_query_as::<Room>();
    match query.fetch_one(pool.get_ref()).await {
        Ok(room) => HttpResponse::Ok().json(room),
        Err(e) => {
            log::error!("update_room DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update room"
            }))
        }
    }
}

/// DELETE /jobs/{job_id}/rooms/{id}
#[delete("/{id}")]
pub async fn delete_room(pool: web::Data<PgPool>, path: web::Path<(Uuid, Uuid)>) -> impl Responder {
    let (job_id, id) = path.into_inner();

    let result = sqlx::query!(
        "DELETE FROM rooms WHERE id = $1 AND job_id = $2 RETURNING id",
        id,
        job_id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(_)) => HttpResponse::NoContent().finish(),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": format!("Room {} not found for job {}", id, job_id)
        })),
        Err(e) => {
            log::error!("delete_room DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete room"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// Router — nested under /jobs/{job_id}
// ---------------------------------------------------------------------------

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/jobs/{job_id}/rooms")
            .service(list_rooms)
            .service(get_room)
            .service(create_room)
            .service(update_room)
            .service(delete_room),
    );
}
