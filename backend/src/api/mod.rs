pub mod construction_methods;
pub mod cutlists;
pub mod drawings;
pub mod export;
pub mod gcode;
pub mod hardware;
pub mod jobs;
pub mod labels;
pub mod machines;
pub mod materials;
pub mod operations;
pub mod optimizer;
pub mod parts;
pub mod post_processors;
pub mod products;
pub mod quotes;
pub mod rendering;
pub mod rooms;
pub mod shop_apps;
pub mod textures;
pub mod tools;
pub mod users;
#[cfg(test)]
mod users_test_r3;
pub mod websocket;

use actix_web::web;

/// Mount all API route modules under the /api prefix.
use crate::auth::auth_api;

pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    auth_api::auth_routes(cfg);
    jobs::configure(cfg);
    rooms::configure(cfg);
    products::configure(cfg);
    parts::configure(cfg);
    operations::configure(cfg);
    materials::configure(cfg);
    textures::configure(cfg);
    hardware::configure(cfg);
    construction_methods::configure(cfg);
    machines::configure(cfg);
    tools::configure(cfg);
    post_processors::configure(cfg);
    optimizer::configure(cfg);
    gcode::configure_routes(cfg);
    labels::configure(cfg);
    drawings::configure(cfg);
    cutlists::configure(cfg);
    quotes::configure(cfg);
    users::configure(cfg);
    shop_apps::configure(cfg);
    rendering::configure(cfg);
    export::configure(cfg);
}
