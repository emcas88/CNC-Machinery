use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::job::{CreateJob, Job, UpdateJob};

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct JobListParams {
    pub status: Option<String>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /jobs
/// Returns all jobs, optionally filtered by `?status=<value>`.
#[get("")]
pub async fn list_jobs(
    pool: web::Data<PgPool>,
    query: web::Query<JobListParams>,
) -> impl Responder {
    let result = match &query.status {
        Some(status) => {
            sqlx::query_as!(
                Job,
                r#"
                SELECT id, name, client_name, status, due_date, notes,
                       created_at, updated_at
                FROM jobs
                WHERE status = $1
                ORDER BY created_at DESC
                "#,
                status
            )
            .fetch_all(pool.get_ref())
            .await
        }
        None => {
            sqlx::query_as!(
                Job,
                r#"
                SELECT id, name, client_name, status, due_date, notes,
                       created_at, updated_at
                FROM jobs
                ORDER BY created_at DESC
                "#
            )
            .fetch_all(pool.get_ref())
            .await
        }
    };

    match result {
        Ok(jobs) => HttpResponse::Ok().json(jobs),
        Err(e) => {
            log::error!("list_jobs DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch jobs"
            }))
        }
    }
}

/// GET /jobs/{id}
#[get("/{id}")]
pub async fn get_job(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query_as!(
        Job,
        r#"
        SELECT id, name, client_name, status, due_date, notes,
               created_at, updated_at
        FROM jobs
        WHERE id = $1
        "#,
        id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(job)) => HttpResponse::Ok().json(job),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": format!("Job {} not found", id)
        })),
        Err(e) => {
            log::error!("get_job DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch job"
            }))
        }
    }
}

/// POST /jobs
#[post("")]
pub async fn create_job(
    pool: web::Data<PgPool>,
    body: web::Json<CreateJob>,
) -> impl Responder {
    let result = sqlx::query_as!(
        Job,
        r#"
        INSERT INTO jobs (id, name, client_name, status, due_date, notes, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, $2, COALESCE($3, 'draft'), $4, $5, NOW(), NOW())
        RETURNING id, name, client_name, status, due_date, notes, created_at, updated_at
        "#,
        body.name,
        body.client_name,
        body.status,
        body.due_date,
        body.notes,
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(job) => HttpResponse::Created().json(job),
        Err(e) => {
            log::error!("create_job DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create job"
            }))
        }
    }
}

/// PUT /jobs/{id}
/// Applies partial updates — only provided fields are written.
#[put("/{id}")]
pub async fn update_job(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    body: web::Json<UpdateJob>,
) -> impl Responder {
    let id = path.into_inner();

    // Verify the job exists first so we can return a proper 404.
    let exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM jobs WHERE id = $1)",
        id
    )
    .fetch_one(pool.get_ref())
    .await;

    match exists {
        Ok(Some(false)) | Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": format!("Job {} not found", id)
            }));
        }
        Err(e) => {
            log::error!("update_job existence check error: {e}");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update job"
            }));
        }
        Ok(Some(true)) => {}
    }

    // Build a dynamic UPDATE using QueryBuilder so we only touch supplied fields.
    let mut builder = sqlx::QueryBuilder::<sqlx::Postgres>::new("UPDATE jobs SET updated_at = NOW()");

    if let Some(name) = &body.name {
        builder.push(", name = ");
        builder.push_bind(name);
    }
    if let Some(client_name) = &body.client_name {
        builder.push(", client_name = ");
        builder.push_bind(client_name);
    }
    if let Some(status) = &body.status {
        builder.push(", status = ");
        builder.push_bind(status);
    }
    if let Some(due_date) = &body.due_date {
        builder.push(", due_date = ");
        builder.push_bind(due_date);
    }
    if let Some(notes) = &body.notes {
        builder.push(", notes = ");
        builder.push_bind(notes);
    }

    builder.push(" WHERE id = ");
    builder.push_bind(id);
    builder.push(
        " RETURNING id, name, client_name, status, due_date, notes, created_at, updated_at",
    );

    let query = builder.build_query_as::<Job>();
    match query.fetch_one(pool.get_ref()).await {
        Ok(job) => HttpResponse::Ok().json(job),
        Err(e) => {
            log::error!("update_job DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update job"
            }))
        }
    }
}

/// DELETE /jobs/{id}
#[delete("/{id}")]
pub async fn delete_job(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let id = path.into_inner();

    let result = sqlx::query!(
        "DELETE FROM jobs WHERE id = $1 RETURNING id",
        id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(_)) => HttpResponse::NoContent().finish(),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": format!("Job {} not found", id)
        })),
        Err(e) => {
            log::error!("delete_job DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete job"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/jobs")
            .service(list_jobs)
            .service(get_job)
            .service(create_job)
            .service(update_job)
            .service(delete_job),
    );
}
