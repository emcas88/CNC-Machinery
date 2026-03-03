use actix_web::{delete, get, post, put, web, HttpResponse, Responder};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::product::{CreateProduct, Product, ProductType, UpdateProduct};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /rooms/{room_id}/products
#[get("")]
pub async fn list_products(pool: web::Data<PgPool>, path: web::Path<Uuid>) -> impl Responder {
    let room_id = path.into_inner();

    let result = sqlx::query_as!(
        Product,
        r#"
        SELECT
            id, room_id, name,
            product_type   AS "product_type: _",
            cabinet_style  AS "cabinet_style: _",
            width, height, depth,
            position_x, position_y, position_z,
            rotation, wall_id,
            face_definition, interior_definition,
            material_overrides, construction_overrides,
            library_entry_id,
            created_at, updated_at
        FROM products
        WHERE room_id = $1
        ORDER BY created_at ASC
        "#,
        room_id
    )
    .fetch_all(pool.get_ref())
    .await;

    match result {
        Ok(products) => HttpResponse::Ok().json(products),
        Err(e) => {
            log::error!("list_products DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch products"
            }))
        }
    }
}

/// GET /rooms/{room_id}/products/{id}
#[get("/{id}")]
pub async fn get_product(pool: web::Data<PgPool>, path: web::Path<(Uuid, Uuid)>) -> impl Responder {
    let (room_id, id) = path.into_inner();

    let result = sqlx::query_as!(
        Product,
        r#"
        SELECT
            id, room_id, name,
            product_type   AS "product_type: _",
            cabinet_style  AS "cabinet_style: _",
            width, height, depth,
            position_x, position_y, position_z,
            rotation, wall_id,
            face_definition, interior_definition,
            material_overrides, construction_overrides,
            library_entry_id,
            created_at, updated_at
        FROM products
        WHERE id = $1 AND room_id = $2
        "#,
        id,
        room_id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(product)) => HttpResponse::Ok().json(product),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": format!("Product {} not found in room {}", id, room_id)
        })),
        Err(e) => {
            log::error!("get_product DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch product"
            }))
        }
    }
}

/// POST /rooms/{room_id}/products
/// product_type and cabinet_style are PostgreSQL enums — cast with `$N::product_type`.
#[post("")]
pub async fn create_product(
    pool: web::Data<PgPool>,
    path: web::Path<Uuid>,
    body: web::Json<CreateProduct>,
) -> impl Responder {
    let room_id = path.into_inner();

    let result = sqlx::query_as!(
        Product,
        r#"
        INSERT INTO products (
            id, room_id, name,
            product_type, cabinet_style,
            width, height, depth,
            position_x, position_y, position_z,
            rotation, wall_id,
            face_definition, interior_definition,
            material_overrides, construction_overrides,
            library_entry_id,
            created_at, updated_at
        )
        VALUES (
            gen_random_uuid(), $1, $2,
            $3::product_type, $4::cabinet_style,
            $5, $6, $7,
            $8, $9, $10,
            $11, $12,
            $13, $14,
            $15, $16,
            $17,
            NOW(), NOW()
        )
        RETURNING
            id, room_id, name,
            product_type   AS "product_type: _",
            cabinet_style  AS "cabinet_style: _",
            width, height, depth,
            position_x, position_y, position_z,
            rotation, wall_id,
            face_definition, interior_definition,
            material_overrides, construction_overrides,
            library_entry_id,
            created_at, updated_at
        "#,
        room_id,
        body.name,
        body.product_type.clone() as ProductType,
        body.cabinet_style as _,
        body.width,
        body.height,
        body.depth,
        body.position_x,
        body.position_y,
        body.position_z,
        body.rotation,
        body.wall_id,
        body.face_definition as _,
        body.interior_definition as _,
        body.material_overrides as _,
        body.construction_overrides as _,
        body.library_entry_id,
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(product) => HttpResponse::Created().json(product),
        Err(e) => {
            log::error!("create_product DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create product"
            }))
        }
    }
}

/// PUT /rooms/{room_id}/products/{id}
#[put("/{id}")]
pub async fn update_product(
    pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
    body: web::Json<UpdateProduct>,
) -> impl Responder {
    let (room_id, id) = path.into_inner();

    let exists = sqlx::query_scalar!(
        "SELECT EXISTS(SELECT 1 FROM products WHERE id = $1 AND room_id = $2)",
        id,
        room_id
    )
    .fetch_one(pool.get_ref())
    .await;

    match exists {
        Ok(Some(false)) | Ok(None) => {
            return HttpResponse::NotFound().json(serde_json::json!({
                "error": format!("Product {} not found in room {}", id, room_id)
            }));
        }
        Err(e) => {
            log::error!("update_product existence check error: {e}");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update product"
            }));
        }
        Ok(Some(true)) => {}
    }

    let mut builder =
        sqlx::QueryBuilder::<sqlx::Postgres>::new("UPDATE products SET updated_at = NOW()");

    if let Some(name) = &body.name {
        builder.push(", name = ");
        builder.push_bind(name);
    }
    if let Some(product_type) = &body.product_type {
        builder.push(", product_type = ");
        builder.push_bind(product_type.to_string());
        builder.push("::product_type");
    }
    if let Some(cabinet_style) = &body.cabinet_style {
        builder.push(", cabinet_style = ");
        builder.push_bind(cabinet_style.to_string());
        builder.push("::cabinet_style");
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
    if let Some(position_x) = &body.position_x {
        builder.push(", position_x = ");
        builder.push_bind(position_x);
    }
    if let Some(position_y) = &body.position_y {
        builder.push(", position_y = ");
        builder.push_bind(position_y);
    }
    if let Some(position_z) = &body.position_z {
        builder.push(", position_z = ");
        builder.push_bind(position_z);
    }
    if let Some(rotation) = &body.rotation {
        builder.push(", rotation = ");
        builder.push_bind(rotation);
    }
    if let Some(wall_id) = &body.wall_id {
        builder.push(", wall_id = ");
        builder.push_bind(wall_id);
    }
    if let Some(face_definition) = &body.face_definition {
        builder.push(", face_definition = ");
        builder.push_bind(face_definition);
    }
    if let Some(interior_definition) = &body.interior_definition {
        builder.push(", interior_definition = ");
        builder.push_bind(interior_definition);
    }
    if let Some(material_overrides) = &body.material_overrides {
        builder.push(", material_overrides = ");
        builder.push_bind(material_overrides);
    }
    if let Some(construction_overrides) = &body.construction_overrides {
        builder.push(", construction_overrides = ");
        builder.push_bind(construction_overrides);
    }
    if let Some(library_entry_id) = &body.library_entry_id {
        builder.push(", library_entry_id = ");
        builder.push_bind(library_entry_id);
    }

    builder.push(" WHERE id = ");
    builder.push_bind(id);
    builder.push(" AND room_id = ");
    builder.push_bind(room_id);
    builder.push(
        r#" RETURNING
            id, room_id, name,
            product_type   AS "product_type: _",
            cabinet_style  AS "cabinet_style: _",
            width, height, depth,
            position_x, position_y, position_z,
            rotation, wall_id,
            face_definition, interior_definition,
            material_overrides, construction_overrides,
            library_entry_id,
            created_at, updated_at"#,
    );

    let query = builder.build_query_as::<Product>();
    match query.fetch_one(pool.get_ref()).await {
        Ok(product) => HttpResponse::Ok().json(product),
        Err(e) => {
            log::error!("update_product DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update product"
            }))
        }
    }
}

/// DELETE /rooms/{room_id}/products/{id}
#[delete("/{id}")]
pub async fn delete_product(
    pool: web::Data<PgPool>,
    path: web::Path<(Uuid, Uuid)>,
) -> impl Responder {
    let (room_id, id) = path.into_inner();

    let result = sqlx::query!(
        "DELETE FROM products WHERE id = $1 AND room_id = $2 RETURNING id",
        id,
        room_id
    )
    .fetch_optional(pool.get_ref())
    .await;

    match result {
        Ok(Some(_)) => HttpResponse::NoContent().finish(),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
            "error": format!("Product {} not found in room {}", id, room_id)
        })),
        Err(e) => {
            log::error!("delete_product DB error: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete product"
            }))
        }
    }
}

// ---------------------------------------------------------------------------
// Router — nested under /rooms/{room_id}
// ---------------------------------------------------------------------------

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/rooms/{room_id}/products")
            .service(list_products)
            .service(get_product)
            .service(create_product)
            .service(update_product)
            .service(delete_product),
    );
}
