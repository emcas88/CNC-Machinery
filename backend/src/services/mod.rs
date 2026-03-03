// =============================================================================
// backend/src/services/mod.rs — Fixed service registration (all 11 services)
// F21: Backend Compilation Fixes
// =============================================================================

#[cfg(test)]
mod tests;

pub mod cloud_renderer;
pub mod construction_methods_engine; // NEW — was missing, caused compilation failure
pub mod cost_calculator;
pub mod door_profile_generator;
pub mod dovetail_generator;
pub mod file_exporter;
pub mod flipside_manager;
pub mod gcode_generator;
pub mod label_generator;
pub mod nesting_engine;
pub mod propagation_engine;

pub use cloud_renderer::CloudRenderer;
pub use construction_methods_engine::ConstructionMethodsEngine;
pub use cost_calculator::CostCalculator;
pub use door_profile_generator::DoorProfileGenerator;
pub use dovetail_generator::DovetailGenerator;
pub use file_exporter::FileExporter;
pub use flipside_manager::FlipsideManager;
pub use gcode_generator::GCodeGenerator;
pub use label_generator::LabelGenerator;
pub use nesting_engine::NestingEngine;
pub use propagation_engine::PropagationEngine;
