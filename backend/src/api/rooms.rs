use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

/// List all rooms for a job.
#[get("")]
pub async fn list_rooms(
    _pool: web::Data<PgPool>,
    job_id: web::Path<Uuid>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("List rooms for job {}", job_id),
        "data": []
    }))
}

/// Get a single room with its floor plan data.
#[get("/{room_id}")]
pub async fn get_room(
    _pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
) -> impl Responder {
    let (job_id, room_id) = path.into_inner();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Get room {} in job {}", room_id, job_id)
    }))
}

/// Create a new room in a job.
#[post("")]
pub async fn create_room(
    _pool: web::Data<PgPool>,
    job_id: web::Path<Uuid>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    HttpResponse::Created().json(json!({
        "status": "ok",
        "message": format!("Room created in job {}", job_id)
    }))
}

/// Update a room's dimensions or layout.
#[put("/{room_id}")]
pub async fn update_room(
    _pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    let (job_id, room_id) = path.into_inner();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Room {} updated in job {}", room_id, job_id)
    }))
}

/// Delete a room and all its products.
#[delete("/{room_id}")]
pub async fn delete_room(
    _pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
) -> impl Responder {
    let (job_id, room_id) = path.into_inner();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Room {} deleted from job {}", room_id, job_id)
    }))
}

/// Get the floor plan SVG or JSON representation for a room.
#[get("/{room_id}/floor-plan")]
pub async fn get_floor_plan(
    _pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
) -> impl Responder {
    let (_job_id, room_id) = path.into_inner();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Floor plan for room {}", room_id),
        "data": {
            "walls": [],
            "obstacles": [],
            "dimensions": {}
        }
    }))
}

/// Save a room's floor plan layout.
#[post("/{room_id}/floor-plan")]
pub async fn save_floor_plan(
    _pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
    _body: web::Json<serde_json::Value>,
) -> impl Responder {
    let (_job_id, room_id) = path.into_inner();
    HttpResponse::Ok().json(json!({
        "status": "ok",
        "message": format!("Floor plan saved for room {}", room_id)
    }))
}

/// Configure routes for the rooms module.
pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/jobs/{job_id}/rooms")
            .service(list_rooms)
            .service(create_room)
            .service(get_room)
            .service(update_room)
            .service(delete_room)
            .service(get_floor_plan)
            .service(save_floor_plan),
    );
}
