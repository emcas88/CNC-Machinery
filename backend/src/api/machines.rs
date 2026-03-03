use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::machine::{CreateMachine, Machine, UpdateMachine};

// ---------------------------------------------------------------------------
// Configure routes
// ---------------------------------------------------------------------------

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/machines")
            .service(list_machines)
            .service(get_machine)
            .service(create_machine)
            .service(update_machine)
            .service(delete_machine),
    );
}

// ---------------------------------------------------------------------------
// GET /machines
// ---------------------------------------------------------------------------

#[get("")]
pub async fn list_machines(pool: web::Data<PgPool>) -> impl Responder {
    let result = sqlx::query_as!(
        Machine,
        r#"
        SELECT
            id,
            name,
            machine_type,
            manufacturer,
            model_number,
            max_x_mm,
            max_y_mm,
            max_z_mm,
            settings,
            created_at,
            updated_at
        FROM machines
        ORDER BY name ASC
        "#
    )
    .fetch_all(pool.get_ref())
    .await;

    match result {
        Ok(machines) => HttpResponse::Ok().json(machines),
        Err(e) => {
            log::error!("list_machines DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to retrieve machines"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// GET /machines/{id}
// ---------------------------------------------------------------------------

#[get("/{id}")]
pub async fn get_machine(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query_as!(
        Machine,
        r#"
        SELECT
            id,
            name,
            machine_type,
            manufacturer,
            model_number,
            max_x_mm,
            max_y_mm,
            max_z_mm,
            settings,
            created_at,
            updated_at
        FROM machines
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(machine)) => HttpResponse::Ok().json(machine),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Machine not found",
            "id": id
        })),
        Err(e) => {
            log::error!("get_machine DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to retrieve machine"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// POST /machines
// ---------------------------------------------------------------------------

#[post("")]
pub async fn create_machine(
    pool: web::Data<PgPool>,
    body: web::Json<CreateMachine>,
) -> impl Responder {
    let id = Uuid::new_v4();
    let now = chrono::Utc::now();

    let result = sqlx::query_as!(
        Machine,
        r#"
        INSERT INTO machines (
            id, name, machine_type, manufacturer, model_number,
            max_x_mm, max_y_mm, max_z_mm, settings,
            created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING
            id,
            name,
            machine_type,
            manufacturer,
            model_number,
            max_x_mm,
            max_y_mm,
            max_z_mm,
            settings,
            created_at,
            updated_at
        "#,
        id,
        body.name,
        body.machine_type,
        body.manufacturer,
        body.model_number,
        body.max_x_mm,
        body.max_y_mm,
        body.max_z_mm,
        body.settings,
        now,
        now
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(machine) => HttpResponse::Created().json(machine),
        Err(e) => {
            log::error!("create_machine DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create machine"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /machines/{id}
// ---------------------------------------------------------------------------

#[put("/{id}")]
pub async fn update_machine(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    body: web::Json<UpdateMachine>,
) -> impl Responder {
    let id = path.into_inner();
    let now = chrono::Utc::now();

    let exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM machines WHERE id = $1)",
        id
    )
    .fetch_one(pool.get_ref())
    .await;

    match exists {
        Ok(Some(false)) | Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": "Machine not found",
                "id": id
            }))
        }
        Err(e) => {
            log::error!("update_machine existence check error: {e}");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update machine"
            }));
        }
        _ => {}
    }

    let result = sqlx::query_as!(
        Machine,
        r#"
        UPDATE machines SET
            name         = COALESCE($2, name),
            machine_type = COALESCE($3, machine_type),
            manufacturer = COALESCE($4, manufacturer),
            model_number = COALESCE($5, model_number),
            max_x_mm     = COALESCE($6, max_x_mm),
            max_y_mm     = COALESCE($7, max_y_mm),
            max_z_mm     = COALESCE($8, max_z_mm),
            settings     = COALESCE($9, settings),
            updated_at   = $10
        WHERE id = $1
        RETURNING
            id,
            name,
            machine_type,
            manufacturer,
            model_number,
            max_x_mm,
            max_y_mm,
            max_z_mm,
            settings,
            created_at,
            updated_at
        "#,
        id,
        body.name,
        body.machine_type,
        body.manufacturer,
        body.model_number,
        body.max_x_mm,
        body.max_y_mm,
        body.max_z_mm,
        body.settings,
        now
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(machine) => HttpResponse::Ok().json(machine),
        Err(e) => {
            log::error!("update_machine DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update machine"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /machines/{id}
// ---------------------------------------------------------------------------

#[delete("/{id}")]
pub async fn delete_machine(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query!(
        "DELETE FROM machines WHERE id = $1 RETURNING id",
        id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(_)) => HttpResponse::NoContent().finish(),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": "Machine not found",
            "id": id
        })),
        Err(e) => {
            log::error!("delete_machine DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete machine"
            }))
        }
    }
}
