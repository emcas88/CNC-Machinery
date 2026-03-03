//! # Cloud Renderer
//!
//! Manages asynchronous 3D rendering jobs for cabinet and room visualizations.
//! Provides the full job management pipeline that would integrate with any
//! photorealistic rendering backend (e.g., Cycles, V-Ray, Arnold, cloud-based
//! REST rendering services).
//!
//! ## Design overview
//!
//! 1. **Submit** – caller supplies a [`RenderRequest`] describing the scene,
//!    camera, resolution, and quality level. The renderer validates the scene
//!    description, creates a [`RenderJob`] in [`RenderStatus::Queued`] state,
//!    stores it in an in-memory map, and returns the job's [`Uuid`].
//!
//! 2. **Poll** – caller uses the job ID to call [`CloudRenderer::check_status`],
//!    which returns the current [`RenderStatus`] without blocking.
//!
//! 3. **Advance** – an internal (or test) helper
//!    [`CloudRenderer::update_job_status`] drives the state machine:
//!    Queued → Processing → Complete / Failed.  Invalid transitions are
//!    rejected with a descriptive error.
//!
//! 4. **Retrieve** – once a job reaches [`RenderStatus::Complete`] the caller
//!    may call [`CloudRenderer::get_result`] to obtain the [`RenderResult`].
//!
//! 5. **Cancel** – any job that is still Queued or Processing can be cancelled.
//!    Complete / Failed / Cancelled jobs are terminal.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/// Lifecycle state of a render job.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RenderStatus {
    /// Job is waiting in the queue; not yet picked up by a worker.
    Queued,
    /// A worker is actively rendering the scene.
    Processing,
    /// Render finished successfully; result data is available.
    Complete,
    /// Render failed; the inner string carries the failure reason.
    Failed(String),
    /// Job was cancelled before it could finish.
    Cancelled,
}

impl RenderStatus {
    /// Returns `true` for terminal states (Complete, Failed, Cancelled).
    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            RenderStatus::Complete | RenderStatus::Failed(_) | RenderStatus::Cancelled
        )
    }

    /// Human-readable label for the status (without failure detail).
    pub fn label(&self) -> &'static str {
        match self {
            RenderStatus::Queued => "queued",
            RenderStatus::Processing => "processing",
            RenderStatus::Complete => "complete",
            RenderStatus::Failed(_) => "failed",
            RenderStatus::Cancelled => "cancelled",
        }
    }
}

/// Render quality preset that controls sampling and denoising parameters.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RenderQuality {
    /// Low sample count, quick turnaround for workflow previews.
    Draft,
    /// Balanced quality and speed; suitable for client review.
    Standard,
    /// High sample count with denoising; near-production output.
    High,
    /// Maximum fidelity; suitable for marketing renders.
    Production,
}

impl RenderQuality {
    /// Relative weight factor used in render-time estimation.
    pub fn time_factor(self) -> f64 {
        match self {
            RenderQuality::Draft => 1.0,
            RenderQuality::Standard => 4.0,
            RenderQuality::High => 12.0,
            RenderQuality::Production => 40.0,
        }
    }
}

/// Supported output image formats.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum OutputFormat {
    Png,
    Jpeg,
    Exr,
    Tiff,
    Webp,
}

// ---------------------------------------------------------------------------
// Sub-structures for RenderRequest
// ---------------------------------------------------------------------------

/// XYZ position in world-space coordinates (millimetres).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vec3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

/// Camera placement and optics settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraPosition {
    /// World-space position of the camera origin.
    pub position: Vec3,
    /// Point the camera is aimed at.
    pub target: Vec3,
    /// Up direction vector (normalised).
    pub up: Vec3,
    /// Horizontal field-of-view in degrees (1–180).
    pub fov_degrees: f64,
}

/// Pixel dimensions of the rendered output.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct RenderResolution {
    /// Width in pixels (must be ≥ 1).
    pub width: u32,
    /// Height in pixels (must be ≥ 1).
    pub height: u32,
}

impl RenderResolution {
    /// Total pixel count.
    pub fn pixel_count(self) -> u64 {
        self.width as u64 * self.height as u64
    }

    /// Megapixels (may be fractional).
    pub fn megapixels(self) -> f64 {
        self.pixel_count() as f64 / 1_000_000.0
    }
}

/// Description of a single light source in the scene.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LightSource {
    /// Light type identifier, e.g. "sun", "point", "area", "hdri".
    pub light_type: String,
    /// Intensity in watts (must be > 0).
    pub intensity: f64,
    /// Optional world-space position (not required for directional / HDRI).
    pub position: Option<Vec3>,
    /// Colour as an RGB triple in [0.0, 1.0].
    pub color: Option<(f64, f64, f64)>,
}

/// A single scene object (cabinet, wall, floor, prop, …).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneObject {
    /// Unique identifier within the scene.
    pub object_id: Uuid,
    /// Human-readable name, e.g. "Base Cabinet Left".
    pub name: String,
    /// Mesh reference identifier (e.g. asset key or model path).
    pub mesh_ref: String,
    /// World-space transform origin of the object.
    pub position: Vec3,
    /// Optional material/texture identifier.
    pub material_id: Option<Uuid>,
}

/// Full scene graph passed to the renderer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneDescription {
    /// All objects to include in the render.
    pub objects: Vec<SceneObject>,
    /// Light sources in the scene (at least one required).
    pub lights: Vec<LightSource>,
    /// Ambient / environment map reference (e.g. HDRI path).
    pub environment_map: Option<String>,
    /// Optional background colour as hex string (e.g. "#FFFFFF").
    pub background_color: Option<String>,
}

// ---------------------------------------------------------------------------
// RenderRequest
// ---------------------------------------------------------------------------

/// Parameters required to submit a new render job.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderRequest {
    /// Full scene description including objects and lights.
    pub scene: SceneDescription,
    /// Camera placement and optics.
    pub camera: CameraPosition,
    /// Output image dimensions.
    pub resolution: RenderResolution,
    /// Quality preset.
    pub quality: RenderQuality,
    /// Desired output format.
    pub output_format: OutputFormat,
    /// Optional human-readable label for the job.
    pub label: Option<String>,
}

// ---------------------------------------------------------------------------
// RenderJob (internal storage record)
// ---------------------------------------------------------------------------

/// Internal record stored per job in the renderer's job map.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderJob {
    /// Globally unique job identifier returned to the caller.
    pub id: Uuid,
    /// Original request captured at submission time.
    pub request: RenderRequest,
    /// Current lifecycle status.
    pub status: RenderStatus,
    /// When the job was created.
    pub created_at: DateTime<Utc>,
    /// When the status was last changed.
    pub updated_at: DateTime<Utc>,
    /// Estimated render time in seconds (computed at submission).
    pub estimated_seconds: f64,
    /// Result data; present only when status is [`RenderStatus::Complete`].
    pub result: Option<RenderResult>,
}

// ---------------------------------------------------------------------------
// RenderResult
// ---------------------------------------------------------------------------

/// Data returned after a job completes successfully.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderResult {
    /// The job that produced this result.
    pub job_id: Uuid,
    /// Full-resolution image URL (would point to object storage in production).
    pub image_url: String,
    /// Thumbnail URL (lower resolution preview).
    pub thumbnail_url: String,
    /// Actual wall-clock render duration in seconds.
    pub render_time_seconds: f64,
    /// Output pixel width.
    pub width: u32,
    /// Output pixel height.
    pub height: u32,
    /// Format of the rendered image.
    pub format: OutputFormat,
    /// Timestamp when the render completed.
    pub completed_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// CloudRenderer
// ---------------------------------------------------------------------------

/// Thread-safe, in-memory cloud renderer job manager.
///
/// All public methods are synchronous; the `Mutex` guard provides interior
/// mutability so the renderer can be shared across threads (e.g. wrapped in
/// `Arc<CloudRenderer>` within an Actix-web `Data`).
pub struct CloudRenderer {
    /// Base URL of the cloud rendering service (informational in this stub).
    pub service_url: String,
    /// API key for authentication (informational in this stub).
    pub api_key: String,
    /// In-memory job store protected by a mutex.
    jobs: Mutex<HashMap<Uuid, RenderJob>>,
}

impl CloudRenderer {
    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    /// Create a new `CloudRenderer` with the given service URL and API key.
    pub fn new(service_url: impl Into<String>, api_key: impl Into<String>) -> Self {
        Self {
            service_url: service_url.into(),
            api_key: api_key.into(),
            jobs: Mutex::new(HashMap::new()),
        }
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /// Validate a [`SceneDescription`] and return a list of validation errors.
    ///
    /// Returns `Ok(())` when the scene is valid, or `Err(Vec<String>)` with
    /// all collected problems.
    pub fn validate_scene(scene: &SceneDescription) -> Result<(), Vec<String>> {
        let mut errors: Vec<String> = Vec::new();

        if scene.objects.is_empty() {
            errors.push("scene must contain at least one object".to_string());
        }

        if scene.lights.is_empty() {
            errors.push("scene must contain at least one light source".to_string());
        }

        // Check for duplicate object IDs
        let mut seen_ids: HashMap<Uuid, usize> = HashMap::new();
        for (i, obj) in scene.objects.iter().enumerate() {
            if let Some(prev) = seen_ids.insert(obj.object_id, i) {
                errors.push(format!(
                    "duplicate object_id {} at indices {} and {}",
                    obj.object_id, prev, i
                ));
            }
            if obj.name.trim().is_empty() {
                errors.push(format!("object at index {} has an empty name", i));
            }
            if obj.mesh_ref.trim().is_empty() {
                errors.push(format!(
                    "object '{}' at index {} has an empty mesh_ref",
                    obj.name, i
                ));
            }
        }

        // Validate lights
        for (i, light) in scene.lights.iter().enumerate() {
            if light.intensity <= 0.0 {
                errors.push(format!(
                    "light at index {} has non-positive intensity ({})",
                    i, light.intensity
                ));
            }
            if light.light_type.trim().is_empty() {
                errors.push(format!("light at index {} has an empty light_type", i));
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    /// Estimate the render time in seconds for a given resolution and quality.
    ///
    /// Formula: `base_seconds × megapixels × quality_factor`
    /// where `base_seconds` = 2.0 (calibrated for a modern GPU node).
    pub fn estimate_render_time(resolution: RenderResolution, quality: RenderQuality) -> f64 {
        const BASE_SECONDS_PER_MEGAPIXEL: f64 = 2.0;
        let mp = resolution.megapixels().max(0.001); // guard against zero
        BASE_SECONDS_PER_MEGAPIXEL * mp * quality.time_factor()
    }

    /// Submit a render job.
    ///
    /// 1. Validates the scene description.
    /// 2. Validates the resolution and camera FOV.
    /// 3. Creates a [`RenderJob`] in [`RenderStatus::Queued`] state.
    /// 4. Stores it in the internal job map.
    /// 5. Returns the job's [`Uuid`].
    pub fn submit_render(&self, request: RenderRequest) -> Result<Uuid, String> {
        // --- scene validation ---
        Self::validate_scene(&request.scene)
            .map_err(|errs| format!("scene validation failed: {}", errs.join("; ")))?;

        // --- resolution validation ---
        if request.resolution.width == 0 || request.resolution.height == 0 {
            return Err("resolution width and height must both be > 0".to_string());
        }

        // --- camera validation ---
        if request.camera.fov_degrees <= 0.0 || request.camera.fov_degrees >= 180.0 {
            return Err(format!(
                "fov_degrees must be in (0, 180), got {}",
                request.camera.fov_degrees
            ));
        }

        let id = Uuid::new_v4();
        let now = Utc::now();
        let estimated_seconds =
            Self::estimate_render_time(request.resolution, request.quality);

        let job = RenderJob {
            id,
            estimated_seconds,
            status: RenderStatus::Queued,
            created_at: now,
            updated_at: now,
            result: None,
            request,
        };

        let mut jobs = self.jobs.lock().map_err(|e| e.to_string())?;
        jobs.insert(id, job);

        Ok(id)
    }

    /// Return the current [`RenderStatus`] of a job.
    ///
    /// Returns `Err` if the job ID is unknown.
    pub fn check_status(&self, job_id: Uuid) -> Result<RenderStatus, String> {
        let jobs = self.jobs.lock().map_err(|e| e.to_string())?;
        jobs.get(&job_id)
            .map(|j| j.status.clone())
            .ok_or_else(|| format!("job {} not found", job_id))
    }

    /// Retrieve the [`RenderResult`] for a completed job.
    ///
    /// - Returns `Err` if the job is not found.
    /// - Returns `Err` if the job is not in [`RenderStatus::Complete`] state.
    pub fn get_result(&self, job_id: Uuid) -> Result<RenderResult, String> {
        let jobs = self.jobs.lock().map_err(|e| e.to_string())?;
        let job = jobs
            .get(&job_id)
            .ok_or_else(|| format!("job {} not found", job_id))?;

        match &job.status {
            RenderStatus::Complete => job
                .result
                .clone()
                .ok_or_else(|| format!("job {} is complete but result data is missing", job_id)),
            RenderStatus::Queued => {
                Err(format!("job {} is still queued; result not available", job_id))
            }
            RenderStatus::Processing => Err(format!(
                "job {} is still processing; result not available",
                job_id
            )),
            RenderStatus::Failed(reason) => {
                Err(format!("job {} failed: {}", job_id, reason))
            }
            RenderStatus::Cancelled => {
                Err(format!("job {} was cancelled; no result available", job_id))
            }
        }
    }

    /// Cancel a queued or processing job.
    ///
    /// Terminal jobs (Complete, Failed, Cancelled) cannot be cancelled again.
    pub fn cancel_render(&self, job_id: Uuid) -> Result<(), String> {
        let mut jobs = self.jobs.lock().map_err(|e| e.to_string())?;
        let job = jobs
            .get_mut(&job_id)
            .ok_or_else(|| format!("job {} not found", job_id))?;

        match &job.status {
            RenderStatus::Queued | RenderStatus::Processing => {
                job.status = RenderStatus::Cancelled;
                job.updated_at = Utc::now();
                Ok(())
            }
            other => Err(format!(
                "cannot cancel job {} in terminal state '{}'",
                job_id,
                other.label()
            )),
        }
    }

    /// List all jobs, optionally filtered to those with a specific status.
    ///
    /// Returns a snapshot (cloned) vector of [`RenderJob`] records.
    pub fn list_jobs(&self, status_filter: Option<&RenderStatus>) -> Result<Vec<RenderJob>, String> {
        let jobs = self.jobs.lock().map_err(|e| e.to_string())?;
        let result: Vec<RenderJob> = jobs
            .values()
            .filter(|j| {
                status_filter
                    .map(|f| std::mem::discriminant(&j.status) == std::mem::discriminant(f))
                    .unwrap_or(true)
            })
            .cloned()
            .collect();
        Ok(result)
    }

    /// Drive a job through the state machine.
    ///
    /// Valid transitions:
    /// - Queued → Processing
    /// - Processing → Complete  (with result data)
    /// - Processing → Failed    (with reason string)
    ///
    /// All other transitions return `Err`.
    ///
    /// When transitioning to `Complete`, `result` must be `Some(…)`.
    pub fn update_job_status(
        &self,
        job_id: Uuid,
        new_status: RenderStatus,
        result: Option<RenderResult>,
    ) -> Result<(), String> {
        let mut jobs = self.jobs.lock().map_err(|e| e.to_string())?;
        let job = jobs
            .get_mut(&job_id)
            .ok_or_else(|| format!("job {} not found", job_id))?;

        // Validate transition
        let valid = match (&job.status, &new_status) {
            (RenderStatus::Queued, RenderStatus::Processing) => true,
            (RenderStatus::Processing, RenderStatus::Complete) => true,
            (RenderStatus::Processing, RenderStatus::Failed(_)) => true,
            _ => false,
        };

        if !valid {
            return Err(format!(
                "invalid status transition: {} → {} for job {}",
                job.status.label(),
                new_status.label(),
                job_id
            ));
        }

        if new_status == RenderStatus::Complete && result.is_none() {
            return Err(format!(
                "result data must be provided when transitioning job {} to Complete",
                job_id
            ));
        }

        job.status = new_status;
        job.updated_at = Utc::now();
        if let Some(r) = result {
            job.result = Some(r);
        }

        Ok(())
    }

    /// Retrieve a full [`RenderJob`] record by ID.
    ///
    /// Returns `Err` if the job ID is unknown.
    pub fn get_job(&self, job_id: Uuid) -> Result<RenderJob, String> {
        let jobs = self.jobs.lock().map_err(|e| e.to_string())?;
        jobs.get(&job_id)
            .cloned()
            .ok_or_else(|| format!("job {} not found", job_id))
    }

    /// Return the total number of tracked jobs.
    pub fn job_count(&self) -> Result<usize, String> {
        Ok(self.jobs.lock().map_err(|e| e.to_string())?.len())
    }
}

// ---------------------------------------------------------------------------
// Test helpers (available in tests only)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod helpers {
    use super::*;

    /// Build a minimal but valid [`SceneDescription`].
    pub fn minimal_scene() -> SceneDescription {
        SceneDescription {
            objects: vec![SceneObject {
                object_id: Uuid::new_v4(),
                name: "Base Cabinet".to_string(),
                mesh_ref: "cabinet_base_v1".to_string(),
                position: Vec3 { x: 0.0, y: 0.0, z: 0.0 },
                material_id: None,
            }],
            lights: vec![LightSource {
                light_type: "sun".to_string(),
                intensity: 1000.0,
                position: None,
                color: Some((1.0, 1.0, 1.0)),
            }],
            environment_map: None,
            background_color: None,
        }
    }

    /// Build a minimal valid [`CameraPosition`].
    pub fn default_camera() -> CameraPosition {
        CameraPosition {
            position: Vec3 { x: 5000.0, y: -3000.0, z: 2000.0 },
            target: Vec3 { x: 0.0, y: 0.0, z: 900.0 },
            up: Vec3 { x: 0.0, y: 0.0, z: 1.0 },
            fov_degrees: 55.0,
        }
    }

    /// Build a minimal valid [`RenderRequest`].
    pub fn minimal_request() -> RenderRequest {
        RenderRequest {
            scene: minimal_scene(),
            camera: default_camera(),
            resolution: RenderResolution { width: 1920, height: 1080 },
            quality: RenderQuality::Standard,
            output_format: OutputFormat::Png,
            label: Some("Test Render".to_string()),
        }
    }

    /// Build a [`CloudRenderer`] ready for testing.
    pub fn make_renderer() -> CloudRenderer {
        CloudRenderer::new("https://render.example.com", "test-api-key-123")
    }

    /// Create a [`RenderResult`] for a given job ID (simulate completion).
    pub fn fake_result(job_id: Uuid, req: &RenderRequest) -> RenderResult {
        RenderResult {
            job_id,
            image_url: format!("https://cdn.example.com/renders/{}.png", job_id),
            thumbnail_url: format!("https://cdn.example.com/renders/{}_thumb.png", job_id),
            render_time_seconds: 42.0,
            width: req.resolution.width,
            height: req.resolution.height,
            format: req.output_format,
            completed_at: Utc::now(),
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use helpers::*;

    // -----------------------------------------------------------------------
    // 1. Constructor / basic state
    // -----------------------------------------------------------------------

    #[test]
    fn test_new_renderer_stores_service_url() {
        let r = CloudRenderer::new("https://api.example.com", "key");
        assert_eq!(r.service_url, "https://api.example.com");
    }

    #[test]
    fn test_new_renderer_stores_api_key() {
        let r = CloudRenderer::new("url", "secret-key");
        assert_eq!(r.api_key, "secret-key");
    }

    #[test]
    fn test_new_renderer_starts_with_no_jobs() {
        let r = make_renderer();
        assert_eq!(r.job_count().unwrap(), 0);
    }

    // -----------------------------------------------------------------------
    // 2. submit_render – happy path
    // -----------------------------------------------------------------------

    #[test]
    fn test_submit_render_returns_uuid() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request());
        assert!(id.is_ok());
    }

    #[test]
    fn test_submit_render_increments_job_count() {
        let r = make_renderer();
        r.submit_render(minimal_request()).unwrap();
        assert_eq!(r.job_count().unwrap(), 1);
    }

    #[test]
    fn test_submit_render_multiple_jobs_unique_ids() {
        let r = make_renderer();
        let id1 = r.submit_render(minimal_request()).unwrap();
        let id2 = r.submit_render(minimal_request()).unwrap();
        assert_ne!(id1, id2);
        assert_eq!(r.job_count().unwrap(), 2);
    }

    #[test]
    fn test_submit_render_initial_status_is_queued() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();
        assert_eq!(r.check_status(id).unwrap(), RenderStatus::Queued);
    }

    #[test]
    fn test_submit_render_stores_label() {
        let r = make_renderer();
        let mut req = minimal_request();
        req.label = Some("Kitchen Render".to_string());
        let id = r.submit_render(req).unwrap();
        let job = r.get_job(id).unwrap();
        assert_eq!(job.request.label.as_deref(), Some("Kitchen Render"));
    }

    #[test]
    fn test_submit_render_no_label() {
        let r = make_renderer();
        let mut req = minimal_request();
        req.label = None;
        let id = r.submit_render(req).unwrap();
        let job = r.get_job(id).unwrap();
        assert!(job.request.label.is_none());
    }

    #[test]
    fn test_submit_render_records_created_at() {
        let before = Utc::now();
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();
        let after = Utc::now();
        let job = r.get_job(id).unwrap();
        assert!(job.created_at >= before && job.created_at <= after);
    }

    #[test]
    fn test_submit_render_estimated_seconds_positive() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();
        let job = r.get_job(id).unwrap();
        assert!(job.estimated_seconds > 0.0);
    }

    // -----------------------------------------------------------------------
    // 3. submit_render – validation failures
    // -----------------------------------------------------------------------

    #[test]
    fn test_submit_render_rejects_empty_objects() {
        let r = make_renderer();
        let mut req = minimal_request();
        req.scene.objects.clear();
        assert!(r.submit_render(req).is_err());
    }

    #[test]
    fn test_submit_render_rejects_empty_lights() {
        let r = make_renderer();
        let mut req = minimal_request();
        req.scene.lights.clear();
        assert!(r.submit_render(req).is_err());
    }

    #[test]
    fn test_submit_render_rejects_zero_width() {
        let r = make_renderer();
        let mut req = minimal_request();
        req.resolution.width = 0;
        assert!(r.submit_render(req).is_err());
    }

    #[test]
    fn test_submit_render_rejects_zero_height() {
        let r = make_renderer();
        let mut req = minimal_request();
        req.resolution.height = 0;
        assert!(r.submit_render(req).is_err());
    }

    #[test]
    fn test_submit_render_rejects_fov_zero() {
        let r = make_renderer();
        let mut req = minimal_request();
        req.camera.fov_degrees = 0.0;
        assert!(r.submit_render(req).is_err());
    }

    #[test]
    fn test_submit_render_rejects_fov_180() {
        let r = make_renderer();
        let mut req = minimal_request();
        req.camera.fov_degrees = 180.0;
        assert!(r.submit_render(req).is_err());
    }

    #[test]
    fn test_submit_render_rejects_fov_negative() {
        let r = make_renderer();
        let mut req = minimal_request();
        req.camera.fov_degrees = -10.0;
        assert!(r.submit_render(req).is_err());
    }

    #[test]
    fn test_submit_render_rejects_light_zero_intensity() {
        let r = make_renderer();
        let mut req = minimal_request();
        req.scene.lights[0].intensity = 0.0;
        assert!(r.submit_render(req).is_err());
    }

    #[test]
    fn test_submit_render_rejects_light_negative_intensity() {
        let r = make_renderer();
        let mut req = minimal_request();
        req.scene.lights[0].intensity = -5.0;
        assert!(r.submit_render(req).is_err());
    }

    #[test]
    fn test_submit_render_rejects_empty_object_name() {
        let r = make_renderer();
        let mut req = minimal_request();
        req.scene.objects[0].name = "   ".to_string();
        assert!(r.submit_render(req).is_err());
    }

    #[test]
    fn test_submit_render_rejects_empty_mesh_ref() {
        let r = make_renderer();
        let mut req = minimal_request();
        req.scene.objects[0].mesh_ref = "".to_string();
        assert!(r.submit_render(req).is_err());
    }

    #[test]
    fn test_submit_render_rejects_duplicate_object_ids() {
        let r = make_renderer();
        let mut req = minimal_request();
        let shared_id = Uuid::new_v4();
        req.scene.objects.push(SceneObject {
            object_id: shared_id,
            name: "Wall Panel".to_string(),
            mesh_ref: "wall_v2".to_string(),
            position: Vec3 { x: 1.0, y: 0.0, z: 0.0 },
            material_id: None,
        });
        // Give first object the same ID
        req.scene.objects[0].object_id = shared_id;
        assert!(r.submit_render(req).is_err());
    }

    #[test]
    fn test_submit_render_accepts_fov_boundary_just_below_180() {
        let r = make_renderer();
        let mut req = minimal_request();
        req.camera.fov_degrees = 179.9;
        assert!(r.submit_render(req).is_ok());
    }

    #[test]
    fn test_submit_render_accepts_fov_boundary_just_above_0() {
        let r = make_renderer();
        let mut req = minimal_request();
        req.camera.fov_degrees = 0.1;
        assert!(r.submit_render(req).is_ok());
    }

    // -----------------------------------------------------------------------
    // 4. check_status
    // -----------------------------------------------------------------------

    #[test]
    fn test_check_status_unknown_id_returns_err() {
        let r = make_renderer();
        assert!(r.check_status(Uuid::new_v4()).is_err());
    }

    #[test]
    fn test_check_status_after_processing_transition() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();
        r.update_job_status(id, RenderStatus::Processing, None).unwrap();
        assert_eq!(r.check_status(id).unwrap(), RenderStatus::Processing);
    }

    #[test]
    fn test_check_status_after_complete_transition() {
        let r = make_renderer();
        let req = minimal_request();
        let id = r.submit_render(req.clone()).unwrap();
        r.update_job_status(id, RenderStatus::Processing, None).unwrap();
        let result = fake_result(id, &req);
        r.update_job_status(id, RenderStatus::Complete, Some(result)).unwrap();
        assert_eq!(r.check_status(id).unwrap(), RenderStatus::Complete);
    }

    #[test]
    fn test_check_status_after_failed_transition() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();
        r.update_job_status(id, RenderStatus::Processing, None).unwrap();
        r.update_job_status(id, RenderStatus::Failed("OOM".to_string()), None).unwrap();
        assert!(matches!(r.check_status(id).unwrap(), RenderStatus::Failed(_)));
    }

    // -----------------------------------------------------------------------
    // 5. get_result
    // -----------------------------------------------------------------------

    #[test]
    fn test_get_result_unknown_job_returns_err() {
        let r = make_renderer();
        assert!(r.get_result(Uuid::new_v4()).is_err());
    }

    #[test]
    fn test_get_result_queued_returns_err() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();
        let err = r.get_result(id).unwrap_err();
        assert!(err.contains("queued"));
    }

    #[test]
    fn test_get_result_processing_returns_err() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();
        r.update_job_status(id, RenderStatus::Processing, None).unwrap();
        let err = r.get_result(id).unwrap_err();
        assert!(err.contains("processing"));
    }

    #[test]
    fn test_get_result_failed_returns_err() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();
        r.update_job_status(id, RenderStatus::Processing, None).unwrap();
        r.update_job_status(id, RenderStatus::Failed("timeout".to_string()), None).unwrap();
        let err = r.get_result(id).unwrap_err();
        assert!(err.contains("failed"));
    }

    #[test]
    fn test_get_result_cancelled_returns_err() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();
        r.cancel_render(id).unwrap();
        let err = r.get_result(id).unwrap_err();
        assert!(err.contains("cancelled"));
    }

    #[test]
    fn test_get_result_complete_returns_result() {
        let r = make_renderer();
        let req = minimal_request();
        let id = r.submit_render(req.clone()).unwrap();
        r.update_job_status(id, RenderStatus::Processing, None).unwrap();
        let result = fake_result(id, &req);
        r.update_job_status(id, RenderStatus::Complete, Some(result.clone())).unwrap();
        let got = r.get_result(id).unwrap();
        assert_eq!(got.job_id, id);
        assert_eq!(got.image_url, result.image_url);
    }

    #[test]
    fn test_get_result_complete_contains_correct_dimensions() {
        let r = make_renderer();
        let req = minimal_request();
        let id = r.submit_render(req.clone()).unwrap();
        r.update_job_status(id, RenderStatus::Processing, None).unwrap();
        let result = fake_result(id, &req);
        r.update_job_status(id, RenderStatus::Complete, Some(result)).unwrap();
        let got = r.get_result(id).unwrap();
        assert_eq!(got.width, 1920);
        assert_eq!(got.height, 1080);
    }

    // -----------------------------------------------------------------------
    // 6. cancel_render
    // -----------------------------------------------------------------------

    #[test]
    fn test_cancel_queued_job_succeeds() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();
        assert!(r.cancel_render(id).is_ok());
        assert_eq!(r.check_status(id).unwrap(), RenderStatus::Cancelled);
    }

    #[test]
    fn test_cancel_processing_job_succeeds() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();
        r.update_job_status(id, RenderStatus::Processing, None).unwrap();
        assert!(r.cancel_render(id).is_ok());
        assert_eq!(r.check_status(id).unwrap(), RenderStatus::Cancelled);
    }

    #[test]
    fn test_cancel_complete_job_returns_err() {
        let r = make_renderer();
        let req = minimal_request();
        let id = r.submit_render(req.clone()).unwrap();
        r.update_job_status(id, RenderStatus::Processing, None).unwrap();
        r.update_job_status(id, RenderStatus::Complete, Some(fake_result(id, &req))).unwrap();
        assert!(r.cancel_render(id).is_err());
    }

    #[test]
    fn test_cancel_failed_job_returns_err() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();
        r.update_job_status(id, RenderStatus::Processing, None).unwrap();
        r.update_job_status(id, RenderStatus::Failed("error".to_string()), None).unwrap();
        assert!(r.cancel_render(id).is_err());
    }

    #[test]
    fn test_cancel_already_cancelled_job_returns_err() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();
        r.cancel_render(id).unwrap();
        assert!(r.cancel_render(id).is_err());
    }

    #[test]
    fn test_cancel_unknown_job_returns_err() {
        let r = make_renderer();
        assert!(r.cancel_render(Uuid::new_v4()).is_err());
    }

    // -----------------------------------------------------------------------
    // 7. list_jobs
    // -----------------------------------------------------------------------

    #[test]
    fn test_list_jobs_empty_renderer() {
        let r = make_renderer();
        assert_eq!(r.list_jobs(None).unwrap().len(), 0);
    }

    #[test]
    fn test_list_jobs_returns_all_without_filter() {
        let r = make_renderer();
        r.submit_render(minimal_request()).unwrap();
        r.submit_render(minimal_request()).unwrap();
        r.submit_render(minimal_request()).unwrap();
        assert_eq!(r.list_jobs(None).unwrap().len(), 3);
    }

    #[test]
    fn test_list_jobs_filter_queued() {
        let r = make_renderer();
        let id1 = r.submit_render(minimal_request()).unwrap();
        let id2 = r.submit_render(minimal_request()).unwrap();
        r.update_job_status(id1, RenderStatus::Processing, None).unwrap();

        let queued = r.list_jobs(Some(&RenderStatus::Queued)).unwrap();
        assert_eq!(queued.len(), 1);
        assert_eq!(queued[0].id, id2);
    }

    #[test]
    fn test_list_jobs_filter_processing() {
        let r = make_renderer();
        let id1 = r.submit_render(minimal_request()).unwrap();
        r.submit_render(minimal_request()).unwrap();
        r.update_job_status(id1, RenderStatus::Processing, None).unwrap();

        let processing = r.list_jobs(Some(&RenderStatus::Processing)).unwrap();
        assert_eq!(processing.len(), 1);
        assert_eq!(processing[0].id, id1);
    }

    #[test]
    fn test_list_jobs_filter_complete() {
        let r = make_renderer();
        let req = minimal_request();
        let id = r.submit_render(req.clone()).unwrap();
        r.submit_render(minimal_request()).unwrap();
        r.update_job_status(id, RenderStatus::Processing, None).unwrap();
        r.update_job_status(id, RenderStatus::Complete, Some(fake_result(id, &req))).unwrap();

        let complete = r.list_jobs(Some(&RenderStatus::Complete)).unwrap();
        assert_eq!(complete.len(), 1);
    }

    #[test]
    fn test_list_jobs_filter_cancelled() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();
        r.submit_render(minimal_request()).unwrap();
        r.cancel_render(id).unwrap();

        let cancelled = r.list_jobs(Some(&RenderStatus::Cancelled)).unwrap();
        assert_eq!(cancelled.len(), 1);
    }

    #[test]
    fn test_list_jobs_filter_failed() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();
        r.update_job_status(id, RenderStatus::Processing, None).unwrap();
        r.update_job_status(id, RenderStatus::Failed("disk full".to_string()), None).unwrap();
        r.submit_render(minimal_request()).unwrap();

        let failed = r.list_jobs(Some(&RenderStatus::Failed(String::new()))).unwrap();
        assert_eq!(failed.len(), 1);
    }

    #[test]
    fn test_list_jobs_filter_returns_empty_when_no_match() {
        let r = make_renderer();
        r.submit_render(minimal_request()).unwrap();
        let complete = r.list_jobs(Some(&RenderStatus::Complete)).unwrap();
        assert!(complete.is_empty());
    }

    // -----------------------------------------------------------------------
    // 8. update_job_status – state machine
    // -----------------------------------------------------------------------

    #[test]
    fn test_update_queued_to_processing_ok() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();
        assert!(r.update_job_status(id, RenderStatus::Processing, None).is_ok());
    }

    #[test]
    fn test_update_processing_to_complete_ok() {
        let r = make_renderer();
        let req = minimal_request();
        let id = r.submit_render(req.clone()).unwrap();
        r.update_job_status(id, RenderStatus::Processing, None).unwrap();
        let result = fake_result(id, &req);
        assert!(r.update_job_status(id, RenderStatus::Complete, Some(result)).is_ok());
    }

    #[test]
    fn test_update_processing_to_failed_ok() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();
        r.update_job_status(id, RenderStatus::Processing, None).unwrap();
        assert!(r
            .update_job_status(id, RenderStatus::Failed("crash".to_string()), None)
            .is_ok());
    }

    #[test]
    fn test_update_queued_to_complete_invalid() {
        let r = make_renderer();
        let req = minimal_request();
        let id = r.submit_render(req.clone()).unwrap();
        let result = fake_result(id, &req);
        assert!(r.update_job_status(id, RenderStatus::Complete, Some(result)).is_err());
    }

    #[test]
    fn test_update_queued_to_failed_invalid() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();
        assert!(r
            .update_job_status(id, RenderStatus::Failed("x".to_string()), None)
            .is_err());
    }

    #[test]
    fn test_update_complete_to_queued_invalid() {
        let r = make_renderer();
        let req = minimal_request();
        let id = r.submit_render(req.clone()).unwrap();
        r.update_job_status(id, RenderStatus::Processing, None).unwrap();
        r.update_job_status(id, RenderStatus::Complete, Some(fake_result(id, &req))).unwrap();
        assert!(r.update_job_status(id, RenderStatus::Queued, None).is_err());
    }

    #[test]
    fn test_update_complete_to_processing_invalid() {
        let r = make_renderer();
        let req = minimal_request();
        let id = r.submit_render(req.clone()).unwrap();
        r.update_job_status(id, RenderStatus::Processing, None).unwrap();
        r.update_job_status(id, RenderStatus::Complete, Some(fake_result(id, &req))).unwrap();
        assert!(r.update_job_status(id, RenderStatus::Processing, None).is_err());
    }

    #[test]
    fn test_update_failed_to_processing_invalid() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();
        r.update_job_status(id, RenderStatus::Processing, None).unwrap();
        r.update_job_status(id, RenderStatus::Failed("err".to_string()), None).unwrap();
        assert!(r.update_job_status(id, RenderStatus::Processing, None).is_err());
    }

    #[test]
    fn test_update_complete_without_result_returns_err() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();
        r.update_job_status(id, RenderStatus::Processing, None).unwrap();
        assert!(r.update_job_status(id, RenderStatus::Complete, None).is_err());
    }

    #[test]
    fn test_update_unknown_job_returns_err() {
        let r = make_renderer();
        assert!(r
            .update_job_status(Uuid::new_v4(), RenderStatus::Processing, None)
            .is_err());
    }

    // -----------------------------------------------------------------------
    // 9. estimate_render_time
    // -----------------------------------------------------------------------

    #[test]
    fn test_estimate_draft_less_than_standard() {
        let res = RenderResolution { width: 1920, height: 1080 };
        let draft = CloudRenderer::estimate_render_time(res, RenderQuality::Draft);
        let standard = CloudRenderer::estimate_render_time(res, RenderQuality::Standard);
        assert!(draft < standard);
    }

    #[test]
    fn test_estimate_standard_less_than_high() {
        let res = RenderResolution { width: 1920, height: 1080 };
        let standard = CloudRenderer::estimate_render_time(res, RenderQuality::Standard);
        let high = CloudRenderer::estimate_render_time(res, RenderQuality::High);
        assert!(standard < high);
    }

    #[test]
    fn test_estimate_high_less_than_production() {
        let res = RenderResolution { width: 1920, height: 1080 };
        let high = CloudRenderer::estimate_render_time(res, RenderQuality::High);
        let prod = CloudRenderer::estimate_render_time(res, RenderQuality::Production);
        assert!(high < prod);
    }

    #[test]
    fn test_estimate_higher_resolution_takes_longer() {
        let small = RenderResolution { width: 640, height: 480 };
        let large = RenderResolution { width: 3840, height: 2160 };
        let t_small = CloudRenderer::estimate_render_time(small, RenderQuality::Standard);
        let t_large = CloudRenderer::estimate_render_time(large, RenderQuality::Standard);
        assert!(t_large > t_small);
    }

    #[test]
    fn test_estimate_always_positive() {
        let res = RenderResolution { width: 1, height: 1 };
        let t = CloudRenderer::estimate_render_time(res, RenderQuality::Draft);
        assert!(t > 0.0);
    }

    #[test]
    fn test_estimate_scales_linearly_with_megapixels() {
        // 4x the pixels should give approximately 4x the time at the same quality
        let res1 = RenderResolution { width: 1000, height: 1000 };
        let res2 = RenderResolution { width: 2000, height: 2000 };
        let t1 = CloudRenderer::estimate_render_time(res1, RenderQuality::Draft);
        let t2 = CloudRenderer::estimate_render_time(res2, RenderQuality::Draft);
        let ratio = t2 / t1;
        assert!((ratio - 4.0).abs() < 0.001, "expected ratio ~4.0, got {}", ratio);
    }

    // -----------------------------------------------------------------------
    // 10. validate_scene – standalone
    // -----------------------------------------------------------------------

    #[test]
    fn test_validate_scene_valid_returns_ok() {
        let scene = helpers::minimal_scene();
        assert!(CloudRenderer::validate_scene(&scene).is_ok());
    }

    #[test]
    fn test_validate_scene_empty_objects_returns_err() {
        let mut scene = helpers::minimal_scene();
        scene.objects.clear();
        let errs = CloudRenderer::validate_scene(&scene).unwrap_err();
        assert!(errs.iter().any(|e| e.contains("at least one object")));
    }

    #[test]
    fn test_validate_scene_empty_lights_returns_err() {
        let mut scene = helpers::minimal_scene();
        scene.lights.clear();
        let errs = CloudRenderer::validate_scene(&scene).unwrap_err();
        assert!(errs.iter().any(|e| e.contains("at least one light")));
    }

    #[test]
    fn test_validate_scene_collects_multiple_errors() {
        let mut scene = helpers::minimal_scene();
        scene.objects.clear();
        scene.lights.clear();
        let errs = CloudRenderer::validate_scene(&scene).unwrap_err();
        assert!(errs.len() >= 2);
    }

    #[test]
    fn test_validate_scene_duplicate_object_ids() {
        let mut scene = helpers::minimal_scene();
        let id = Uuid::new_v4();
        scene.objects[0].object_id = id;
        scene.objects.push(SceneObject {
            object_id: id,
            name: "Duplicate".to_string(),
            mesh_ref: "mesh_dup".to_string(),
            position: Vec3 { x: 1.0, y: 0.0, z: 0.0 },
            material_id: None,
        });
        let errs = CloudRenderer::validate_scene(&scene).unwrap_err();
        assert!(errs.iter().any(|e| e.contains("duplicate")));
    }

    #[test]
    fn test_validate_scene_light_empty_type() {
        let mut scene = helpers::minimal_scene();
        scene.lights[0].light_type = "".to_string();
        let errs = CloudRenderer::validate_scene(&scene).unwrap_err();
        assert!(errs.iter().any(|e| e.contains("light_type")));
    }

    // -----------------------------------------------------------------------
    // 11. RenderStatus helpers
    // -----------------------------------------------------------------------

    #[test]
    fn test_render_status_is_terminal_complete() {
        assert!(RenderStatus::Complete.is_terminal());
    }

    #[test]
    fn test_render_status_is_terminal_failed() {
        assert!(RenderStatus::Failed("x".to_string()).is_terminal());
    }

    #[test]
    fn test_render_status_is_terminal_cancelled() {
        assert!(RenderStatus::Cancelled.is_terminal());
    }

    #[test]
    fn test_render_status_not_terminal_queued() {
        assert!(!RenderStatus::Queued.is_terminal());
    }

    #[test]
    fn test_render_status_not_terminal_processing() {
        assert!(!RenderStatus::Processing.is_terminal());
    }

    #[test]
    fn test_render_status_label_queued() {
        assert_eq!(RenderStatus::Queued.label(), "queued");
    }

    #[test]
    fn test_render_status_label_complete() {
        assert_eq!(RenderStatus::Complete.label(), "complete");
    }

    // -----------------------------------------------------------------------
    // 12. RenderResolution helpers
    // -----------------------------------------------------------------------

    #[test]
    fn test_resolution_pixel_count() {
        let res = RenderResolution { width: 1920, height: 1080 };
        assert_eq!(res.pixel_count(), 2_073_600);
    }

    #[test]
    fn test_resolution_megapixels() {
        let res = RenderResolution { width: 1000, height: 1000 };
        assert!((res.megapixels() - 1.0).abs() < 1e-9);
    }

    // -----------------------------------------------------------------------
    // 13. Full lifecycle test
    // -----------------------------------------------------------------------

    #[test]
    fn test_full_lifecycle_queued_processing_complete() {
        let r = make_renderer();
        let req = minimal_request();

        // Submit
        let id = r.submit_render(req.clone()).unwrap();
        assert_eq!(r.check_status(id).unwrap(), RenderStatus::Queued);

        // Advance to processing
        r.update_job_status(id, RenderStatus::Processing, None).unwrap();
        assert_eq!(r.check_status(id).unwrap(), RenderStatus::Processing);

        // Complete
        let result = fake_result(id, &req);
        r.update_job_status(id, RenderStatus::Complete, Some(result.clone())).unwrap();
        assert_eq!(r.check_status(id).unwrap(), RenderStatus::Complete);

        // Retrieve
        let got = r.get_result(id).unwrap();
        assert_eq!(got.job_id, id);
        assert_eq!(got.render_time_seconds, 42.0);
    }

    #[test]
    fn test_full_lifecycle_queued_processing_failed() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();

        r.update_job_status(id, RenderStatus::Processing, None).unwrap();
        r.update_job_status(id, RenderStatus::Failed("worker died".to_string()), None).unwrap();

        assert!(matches!(r.check_status(id).unwrap(), RenderStatus::Failed(_)));
        assert!(r.get_result(id).is_err());
    }

    #[test]
    fn test_full_lifecycle_cancel_while_queued() {
        let r = make_renderer();
        let id = r.submit_render(minimal_request()).unwrap();
        r.cancel_render(id).unwrap();
        assert_eq!(r.check_status(id).unwrap(), RenderStatus::Cancelled);
        assert!(r.get_result(id).is_err());
    }

    // -----------------------------------------------------------------------
    // 14. Concurrent jobs
    // -----------------------------------------------------------------------

    #[test]
    fn test_concurrent_jobs_independent_status() {
        let r = make_renderer();
        let req = minimal_request();

        let id1 = r.submit_render(req.clone()).unwrap();
        let id2 = r.submit_render(req.clone()).unwrap();
        let id3 = r.submit_render(req.clone()).unwrap();

        // Advance id1 to processing
        r.update_job_status(id1, RenderStatus::Processing, None).unwrap();
        // Cancel id2
        r.cancel_render(id2).unwrap();
        // Leave id3 as queued

        assert_eq!(r.check_status(id1).unwrap(), RenderStatus::Processing);
        assert_eq!(r.check_status(id2).unwrap(), RenderStatus::Cancelled);
        assert_eq!(r.check_status(id3).unwrap(), RenderStatus::Queued);
    }

    #[test]
    fn test_multiple_complete_jobs_each_has_own_result() {
        let r = make_renderer();
        let req1 = minimal_request();
        let req2 = minimal_request();

        let id1 = r.submit_render(req1.clone()).unwrap();
        let id2 = r.submit_render(req2.clone()).unwrap();

        r.update_job_status(id1, RenderStatus::Processing, None).unwrap();
        r.update_job_status(id1, RenderStatus::Complete, Some(fake_result(id1, &req1))).unwrap();

        r.update_job_status(id2, RenderStatus::Processing, None).unwrap();
        r.update_job_status(id2, RenderStatus::Complete, Some(fake_result(id2, &req2))).unwrap();

        assert_eq!(r.get_result(id1).unwrap().job_id, id1);
        assert_eq!(r.get_result(id2).unwrap().job_id, id2);
    }

    // -----------------------------------------------------------------------
    // 15. Edge cases
    // -----------------------------------------------------------------------

    #[test]
    fn test_get_job_unknown_returns_err() {
        let r = make_renderer();
        assert!(r.get_job(Uuid::new_v4()).is_err());
    }

    #[test]
    fn test_get_job_returns_correct_record() {
        let r = make_renderer();
        let req = minimal_request();
        let id = r.submit_render(req.clone()).unwrap();
        let job = r.get_job(id).unwrap();
        assert_eq!(job.id, id);
        assert_eq!(job.request.quality, req.quality);
    }

    #[test]
    fn test_submit_high_resolution_production_quality() {
        let r = make_renderer();
        let mut req = minimal_request();
        req.resolution = RenderResolution { width: 7680, height: 4320 }; // 8K
        req.quality = RenderQuality::Production;
        let id = r.submit_render(req).unwrap();
        let job = r.get_job(id).unwrap();
        // 8K Production should be the longest estimate
        assert!(job.estimated_seconds > 200.0);
    }

    #[test]
    fn test_submit_with_environment_map() {
        let r = make_renderer();
        let mut req = minimal_request();
        req.scene.environment_map = Some("hdri/studio_01.exr".to_string());
        assert!(r.submit_render(req).is_ok());
    }

    #[test]
    fn test_submit_with_background_color() {
        let r = make_renderer();
        let mut req = minimal_request();
        req.scene.background_color = Some("#F5F5F5".to_string());
        assert!(r.submit_render(req).is_ok());
    }

    #[test]
    fn test_submit_multiple_objects_and_lights() {
        let r = make_renderer();
        let mut req = minimal_request();
        for i in 1..=5 {
            req.scene.objects.push(SceneObject {
                object_id: Uuid::new_v4(),
                name: format!("Cabinet {}", i),
                mesh_ref: format!("cabinet_{}", i),
                position: Vec3 { x: i as f64 * 600.0, y: 0.0, z: 0.0 },
                material_id: Some(Uuid::new_v4()),
            });
            req.scene.lights.push(LightSource {
                light_type: "point".to_string(),
                intensity: 500.0,
                position: Some(Vec3 { x: i as f64 * 300.0, y: 200.0, z: 2400.0 }),
                color: None,
            });
        }
        assert!(r.submit_render(req).is_ok());
    }

    #[test]
    fn test_all_output_formats_accepted() {
        let r = make_renderer();
        for fmt in &[
            OutputFormat::Png,
            OutputFormat::Jpeg,
            OutputFormat::Exr,
            OutputFormat::Tiff,
            OutputFormat::Webp,
        ] {
            let mut req = minimal_request();
            req.output_format = *fmt;
            assert!(r.submit_render(req).is_ok(), "format {:?} should be accepted", fmt);
        }
    }

    #[test]
    fn test_all_quality_levels_accepted() {
        let r = make_renderer();
        for q in &[
            RenderQuality::Draft,
            RenderQuality::Standard,
            RenderQuality::High,
            RenderQuality::Production,
        ] {
            let mut req = minimal_request();
            req.quality = *q;
            assert!(r.submit_render(req).is_ok(), "quality {:?} should be accepted", q);
        }
    }

    #[test]
    fn test_job_count_matches_submitted() {
        let r = make_renderer();
        for _ in 0..10 {
            r.submit_render(minimal_request()).unwrap();
        }
        assert_eq!(r.job_count().unwrap(), 10);
    }
}