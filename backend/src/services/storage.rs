//! # S3 / MinIO Storage Service
//!
//! Provides a high-level wrapper for S3-compatible object storage (MinIO)
//! in the CNC-Machinery backend. Handles file upload, download, deletion,
//! listing, pre-signed URL generation, and bucket management.
//!
//! ## Design
//!
//! - **Bucket-aware** – every operation targets a named bucket; helpers
//!   exist for default buckets (textures, renders, exports).
//! - **Content-type detection** – automatic MIME type inference from file
//!   extension on upload.
//! - **Pre-signed URLs** – time-limited download/upload URLs for direct
//!   browser access without proxying through the API.
//! - **Metadata** – arbitrary key-value metadata attached to objects.
//!
//! ## Usage
//!
//! ```rust,ignore
//! let storage = StorageService::new(StorageConfig::default())?;
//! storage.create_bucket("textures").await?;
//! storage.upload("textures", "oak.png", &bytes, None).await?;
//! let url = storage.presigned_download("textures", "oak.png", 3600)?;
//! ```

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq)]
pub enum StorageError {
    /// Connection or authentication failure.
    ConnectionError(String),
    /// The target bucket does not exist.
    BucketNotFound(String),
    /// The target bucket already exists (on create).
    BucketAlreadyExists(String),
    /// The target object was not found.
    ObjectNotFound { bucket: String, key: String },
    /// Upload or download I/O error.
    IoError(String),
    /// Access denied.
    PermissionDenied(String),
    /// The object exceeds the maximum allowed size.
    SizeLimitExceeded { max_bytes: u64, actual_bytes: u64 },
    /// Generic error.
    Other(String),
}

impl std::fmt::Display for StorageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StorageError::ConnectionError(msg) => write!(f, "storage connection error: {msg}"),
            StorageError::BucketNotFound(b) => write!(f, "bucket not found: {b}"),
            StorageError::BucketAlreadyExists(b) => write!(f, "bucket already exists: {b}"),
            StorageError::ObjectNotFound { bucket, key } => {
                write!(f, "object not found: {bucket}/{key}")
            }
            StorageError::IoError(msg) => write!(f, "storage I/O error: {msg}"),
            StorageError::PermissionDenied(msg) => write!(f, "permission denied: {msg}"),
            StorageError::SizeLimitExceeded {
                max_bytes,
                actual_bytes,
            } => {
                write!(f, "size limit exceeded: {actual_bytes} > {max_bytes}")
            }
            StorageError::Other(msg) => write!(f, "storage error: {msg}"),
        }
    }
}

impl std::error::Error for StorageError {}

pub type StorageResult<T> = Result<T, StorageError>;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageConfig {
    /// S3/MinIO endpoint URL.
    pub endpoint: String,
    /// Access key (username).
    pub access_key: String,
    /// Secret key (password).
    pub secret_key: String,
    /// Default region.
    pub region: String,
    /// Whether to use path-style addressing (required for MinIO).
    pub path_style: bool,
    /// Maximum upload size in bytes (default 100 MB).
    pub max_upload_bytes: u64,
    /// Pre-signed URL default expiry in seconds.
    pub presign_expiry_secs: u64,
}

impl Default for StorageConfig {
    fn default() -> Self {
        Self {
            endpoint: "http://127.0.0.1:9000".into(),
            access_key: "minioadmin".into(),
            secret_key: "minioadmin".into(),
            region: "us-east-1".into(),
            path_style: true,
            max_upload_bytes: 100 * 1024 * 1024, // 100 MB
            presign_expiry_secs: 3600,
        }
    }
}

// ---------------------------------------------------------------------------
// Object / Bucket metadata
// ---------------------------------------------------------------------------

/// Metadata for a stored object.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ObjectInfo {
    pub key: String,
    pub bucket: String,
    pub size_bytes: u64,
    pub content_type: String,
    pub etag: String,
    pub last_modified: DateTime<Utc>,
    pub metadata: HashMap<String, String>,
}

/// Metadata for a bucket.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BucketInfo {
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub object_count: usize,
    pub total_size_bytes: u64,
}

/// A list page of objects (paginated).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectListPage {
    pub objects: Vec<ObjectInfo>,
    pub prefix: String,
    pub is_truncated: bool,
    pub next_continuation_token: Option<String>,
}

/// Pre-signed URL result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresignedUrl {
    pub url: String,
    pub expires_at: DateTime<Utc>,
    pub method: String,
}

// ---------------------------------------------------------------------------
// Internal storage (in-memory mock)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
struct StoredObject {
    data: Vec<u8>,
    info: ObjectInfo,
}

#[derive(Debug, Clone)]
struct Bucket {
    info: BucketInfo,
    objects: HashMap<String, StoredObject>,
}

// ---------------------------------------------------------------------------
// StorageService
// ---------------------------------------------------------------------------

/// High-level S3/MinIO wrapper.
///
/// Uses an in-memory store for testing. In production, calls would go to
/// a real S3/MinIO endpoint via the AWS SDK or `rusoto`.
#[derive(Debug, Clone)]
pub struct StorageService {
    config: StorageConfig,
    buckets: Arc<Mutex<HashMap<String, Bucket>>>,
    connected: Arc<Mutex<bool>>,
}

impl StorageService {
    pub fn new(config: StorageConfig) -> StorageResult<Self> {
        if config.endpoint.is_empty() {
            return Err(StorageError::ConnectionError("empty endpoint".into()));
        }
        if config.access_key.is_empty() || config.secret_key.is_empty() {
            return Err(StorageError::PermissionDenied("missing credentials".into()));
        }
        Ok(Self {
            config,
            buckets: Arc::new(Mutex::new(HashMap::new())),
            connected: Arc::new(Mutex::new(true)),
        })
    }

    fn check_connected(&self) -> StorageResult<()> {
        let c = self
            .connected
            .lock()
            .map_err(|e| StorageError::Other(e.to_string()))?;
        if !*c {
            return Err(StorageError::ConnectionError("not connected".into()));
        }
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Bucket management
    // -----------------------------------------------------------------------

    pub fn create_bucket(&self, name: &str) -> StorageResult<BucketInfo> {
        self.check_connected()?;
        let mut buckets = self
            .buckets
            .lock()
            .map_err(|e| StorageError::Other(e.to_string()))?;
        if buckets.contains_key(name) {
            return Err(StorageError::BucketAlreadyExists(name.into()));
        }
        let info = BucketInfo {
            name: name.into(),
            created_at: Utc::now(),
            object_count: 0,
            total_size_bytes: 0,
        };
        buckets.insert(
            name.into(),
            Bucket {
                info: info.clone(),
                objects: HashMap::new(),
            },
        );
        Ok(info)
    }

    pub fn delete_bucket(&self, name: &str) -> StorageResult<()> {
        self.check_connected()?;
        let mut buckets = self
            .buckets
            .lock()
            .map_err(|e| StorageError::Other(e.to_string()))?;
        if !buckets.contains_key(name) {
            return Err(StorageError::BucketNotFound(name.into()));
        }
        buckets.remove(name);
        Ok(())
    }

    pub fn list_buckets(&self) -> StorageResult<Vec<BucketInfo>> {
        self.check_connected()?;
        let buckets = self
            .buckets
            .lock()
            .map_err(|e| StorageError::Other(e.to_string()))?;
        Ok(buckets.values().map(|b| b.info.clone()).collect())
    }

    pub fn bucket_exists(&self, name: &str) -> StorageResult<bool> {
        self.check_connected()?;
        let buckets = self
            .buckets
            .lock()
            .map_err(|e| StorageError::Other(e.to_string()))?;
        Ok(buckets.contains_key(name))
    }

    pub fn bucket_info(&self, name: &str) -> StorageResult<BucketInfo> {
        self.check_connected()?;
        let buckets = self
            .buckets
            .lock()
            .map_err(|e| StorageError::Other(e.to_string()))?;
        buckets
            .get(name)
            .map(|b| b.info.clone())
            .ok_or_else(|| StorageError::BucketNotFound(name.into()))
    }

    /// Ensure a bucket exists, creating it if necessary.
    pub fn ensure_bucket(&self, name: &str) -> StorageResult<BucketInfo> {
        if self.bucket_exists(name)? {
            self.bucket_info(name)
        } else {
            self.create_bucket(name)
        }
    }

    // -----------------------------------------------------------------------
    // Object operations
    // -----------------------------------------------------------------------

    /// Upload data to a bucket under the given key.
    pub fn upload(
        &self,
        bucket: &str,
        key: &str,
        data: &[u8],
        content_type: Option<&str>,
        metadata: Option<HashMap<String, String>>,
    ) -> StorageResult<ObjectInfo> {
        self.check_connected()?;

        if data.len() as u64 > self.config.max_upload_bytes {
            return Err(StorageError::SizeLimitExceeded {
                max_bytes: self.config.max_upload_bytes,
                actual_bytes: data.len() as u64,
            });
        }

        let ct = content_type
            .map(|s| s.to_string())
            .unwrap_or_else(|| guess_content_type(key));

        let etag = format!("{:x}", md5_hash(data));

        let info = ObjectInfo {
            key: key.into(),
            bucket: bucket.into(),
            size_bytes: data.len() as u64,
            content_type: ct,
            etag,
            last_modified: Utc::now(),
            metadata: metadata.unwrap_or_default(),
        };

        let mut buckets = self
            .buckets
            .lock()
            .map_err(|e| StorageError::Other(e.to_string()))?;
        let bkt = buckets
            .get_mut(bucket)
            .ok_or_else(|| StorageError::BucketNotFound(bucket.into()))?;

        // Update bucket stats
        if let Some(old) = bkt.objects.get(key) {
            bkt.info.total_size_bytes -= old.info.size_bytes;
        } else {
            bkt.info.object_count += 1;
        }
        bkt.info.total_size_bytes += info.size_bytes;

        bkt.objects.insert(
            key.into(),
            StoredObject {
                data: data.to_vec(),
                info: info.clone(),
            },
        );

        Ok(info)
    }

    /// Download an object's data.
    pub fn download(&self, bucket: &str, key: &str) -> StorageResult<Vec<u8>> {
        self.check_connected()?;
        let buckets = self
            .buckets
            .lock()
            .map_err(|e| StorageError::Other(e.to_string()))?;
        let bkt = buckets
            .get(bucket)
            .ok_or_else(|| StorageError::BucketNotFound(bucket.into()))?;
        let obj = bkt
            .objects
            .get(key)
            .ok_or_else(|| StorageError::ObjectNotFound {
                bucket: bucket.into(),
                key: key.into(),
            })?;
        Ok(obj.data.clone())
    }

    /// Get object metadata without downloading data.
    pub fn head(&self, bucket: &str, key: &str) -> StorageResult<ObjectInfo> {
        self.check_connected()?;
        let buckets = self
            .buckets
            .lock()
            .map_err(|e| StorageError::Other(e.to_string()))?;
        let bkt = buckets
            .get(bucket)
            .ok_or_else(|| StorageError::BucketNotFound(bucket.into()))?;
        bkt.objects
            .get(key)
            .map(|o| o.info.clone())
            .ok_or_else(|| StorageError::ObjectNotFound {
                bucket: bucket.into(),
                key: key.into(),
            })
    }

    /// Delete an object.
    pub fn delete_object(&self, bucket: &str, key: &str) -> StorageResult<()> {
        self.check_connected()?;
        let mut buckets = self
            .buckets
            .lock()
            .map_err(|e| StorageError::Other(e.to_string()))?;
        let bkt = buckets
            .get_mut(bucket)
            .ok_or_else(|| StorageError::BucketNotFound(bucket.into()))?;

        if let Some(obj) = bkt.objects.remove(key) {
            bkt.info.object_count -= 1;
            bkt.info.total_size_bytes -= obj.info.size_bytes;
            Ok(())
        } else {
            Err(StorageError::ObjectNotFound {
                bucket: bucket.into(),
                key: key.into(),
            })
        }
    }

    /// List objects in a bucket with optional prefix filter.
    pub fn list_objects(
        &self,
        bucket: &str,
        prefix: Option<&str>,
        max_keys: Option<usize>,
    ) -> StorageResult<ObjectListPage> {
        self.check_connected()?;
        let buckets = self
            .buckets
            .lock()
            .map_err(|e| StorageError::Other(e.to_string()))?;
        let bkt = buckets
            .get(bucket)
            .ok_or_else(|| StorageError::BucketNotFound(bucket.into()))?;

        let pfx = prefix.unwrap_or("");
        let mut objects: Vec<ObjectInfo> = bkt
            .objects
            .values()
            .filter(|o| o.info.key.starts_with(pfx))
            .map(|o| o.info.clone())
            .collect();

        objects.sort_by(|a, b| a.key.cmp(&b.key));

        let limit = max_keys.unwrap_or(1000);
        let is_truncated = objects.len() > limit;
        objects.truncate(limit);

        Ok(ObjectListPage {
            objects,
            prefix: pfx.into(),
            is_truncated,
            next_continuation_token: None,
        })
    }

    /// Check if an object exists.
    pub fn object_exists(&self, bucket: &str, key: &str) -> StorageResult<bool> {
        match self.head(bucket, key) {
            Ok(_) => Ok(true),
            Err(StorageError::ObjectNotFound { .. }) => Ok(false),
            Err(e) => Err(e),
        }
    }

    /// Copy an object within or between buckets.
    pub fn copy_object(
        &self,
        src_bucket: &str,
        src_key: &str,
        dst_bucket: &str,
        dst_key: &str,
    ) -> StorageResult<ObjectInfo> {
        let data = self.download(src_bucket, src_key)?;
        let src_info = self.head(src_bucket, src_key)?;
        self.upload(
            dst_bucket,
            dst_key,
            &data,
            Some(&src_info.content_type),
            Some(src_info.metadata),
        )
    }

    // -----------------------------------------------------------------------
    // Pre-signed URLs
    // -----------------------------------------------------------------------

    /// Generate a pre-signed download URL.
    pub fn presigned_download(
        &self,
        bucket: &str,
        key: &str,
        expiry_secs: Option<u64>,
    ) -> StorageResult<PresignedUrl> {
        self.check_connected()?;
        // Verify the object exists
        self.head(bucket, key)?;

        let expiry = expiry_secs.unwrap_or(self.config.presign_expiry_secs);
        let expires_at = Utc::now() + chrono::Duration::seconds(expiry as i64);

        Ok(PresignedUrl {
            url: format!(
                "{}/{}/{}?X-Amz-Expires={}",
                self.config.endpoint, bucket, key, expiry
            ),
            expires_at,
            method: "GET".into(),
        })
    }

    /// Generate a pre-signed upload URL.
    pub fn presigned_upload(
        &self,
        bucket: &str,
        key: &str,
        expiry_secs: Option<u64>,
    ) -> StorageResult<PresignedUrl> {
        self.check_connected()?;
        // Verify the bucket exists
        if !self.bucket_exists(bucket)? {
            return Err(StorageError::BucketNotFound(bucket.into()));
        }

        let expiry = expiry_secs.unwrap_or(self.config.presign_expiry_secs);
        let expires_at = Utc::now() + chrono::Duration::seconds(expiry as i64);

        Ok(PresignedUrl {
            url: format!(
                "{}/{}/{}?X-Amz-Expires={}&X-Amz-Method=PUT",
                self.config.endpoint, bucket, key, expiry
            ),
            expires_at,
            method: "PUT".into(),
        })
    }

    // -----------------------------------------------------------------------
    // Domain-specific helpers
    // -----------------------------------------------------------------------

    /// Upload a texture image to the `textures` bucket.
    pub fn upload_texture(
        &self,
        filename: &str,
        data: &[u8],
        metadata: Option<HashMap<String, String>>,
    ) -> StorageResult<ObjectInfo> {
        self.ensure_bucket("textures")?;
        self.upload("textures", filename, data, None, metadata)
    }

    /// Store a render output to the `renders` bucket.
    pub fn store_render_output(
        &self,
        render_id: &str,
        filename: &str,
        data: &[u8],
    ) -> StorageResult<ObjectInfo> {
        self.ensure_bucket("renders")?;
        let key = format!("{}/{}", render_id, filename);
        self.upload("renders", &key, data, None, None)
    }

    /// Store an export file (G-code, DXF, etc.).
    pub fn store_export(
        &self,
        job_id: &str,
        filename: &str,
        data: &[u8],
    ) -> StorageResult<ObjectInfo> {
        self.ensure_bucket("exports")?;
        let key = format!("{}/{}", job_id, filename);
        self.upload("exports", &key, data, None, None)
    }

    /// Get a download URL for a texture.
    pub fn texture_url(&self, filename: &str) -> StorageResult<PresignedUrl> {
        self.presigned_download("textures", filename, None)
    }

    /// Get a download URL for a render output.
    pub fn render_output_url(
        &self,
        render_id: &str,
        filename: &str,
    ) -> StorageResult<PresignedUrl> {
        let key = format!("{}/{}", render_id, filename);
        self.presigned_download("renders", &key, None)
    }

    /// Get a download URL for an export.
    pub fn export_url(&self, job_id: &str, filename: &str) -> StorageResult<PresignedUrl> {
        let key = format!("{}/{}", job_id, filename);
        self.presigned_download("exports", &key, None)
    }

    // -----------------------------------------------------------------------
    // Connection management (testing)
    // -----------------------------------------------------------------------

    pub fn simulate_disconnect(&self) {
        if let Ok(mut c) = self.connected.lock() {
            *c = false;
        }
    }

    pub fn simulate_reconnect(&self) {
        if let Ok(mut c) = self.connected.lock() {
            *c = true;
        }
    }

    pub fn is_connected(&self) -> bool {
        self.connected.lock().map_or(false, |c| *c)
    }

    pub fn config(&self) -> &StorageConfig {
        &self.config
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Simple content type guesser based on file extension.
fn guess_content_type(filename: &str) -> String {
    let ext = filename.rsplit('.').next().unwrap_or("").to_lowercase();

    match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "pdf" => "application/pdf",
        "json" => "application/json",
        "gcode" | "nc" => "text/plain",
        "dxf" => "application/dxf",
        "stl" => "model/stl",
        "obj" => "model/obj",
        "zip" => "application/zip",
        "csv" => "text/csv",
        _ => "application/octet-stream",
    }
    .into()
}

/// Very simple hash for ETags (not cryptographic – for testing only).
fn md5_hash(data: &[u8]) -> u64 {
    let mut hash: u64 = 0xcbf29ce484222325;
    for &byte in data {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

// =========================================================================
// Tests
// =========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn make_storage() -> StorageService {
        StorageService::new(StorageConfig::default()).unwrap()
    }

    fn setup_with_bucket(name: &str) -> StorageService {
        let s = make_storage();
        s.create_bucket(name).unwrap();
        s
    }

    // --- Construction / config ---

    #[test]
    fn test_create_with_default_config() {
        let s = make_storage();
        assert!(s.is_connected());
        assert_eq!(s.config().endpoint, "http://127.0.0.1:9000");
    }

    #[test]
    fn test_reject_empty_endpoint() {
        let cfg = StorageConfig {
            endpoint: "".into(),
            ..StorageConfig::default()
        };
        assert!(matches!(
            StorageService::new(cfg),
            Err(StorageError::ConnectionError(_))
        ));
    }

    #[test]
    fn test_reject_empty_credentials() {
        let cfg = StorageConfig {
            access_key: "".into(),
            ..StorageConfig::default()
        };
        assert!(matches!(
            StorageService::new(cfg),
            Err(StorageError::PermissionDenied(_))
        ));
    }

    // --- Bucket management ---

    #[test]
    fn test_create_bucket() {
        let s = make_storage();
        let info = s.create_bucket("test-bucket").unwrap();
        assert_eq!(info.name, "test-bucket");
        assert_eq!(info.object_count, 0);
    }

    #[test]
    fn test_create_duplicate_bucket() {
        let s = make_storage();
        s.create_bucket("dup").unwrap();
        assert!(matches!(
            s.create_bucket("dup"),
            Err(StorageError::BucketAlreadyExists(_))
        ));
    }

    #[test]
    fn test_delete_bucket() {
        let s = setup_with_bucket("temp");
        s.delete_bucket("temp").unwrap();
        assert!(!s.bucket_exists("temp").unwrap());
    }

    #[test]
    fn test_delete_nonexistent_bucket() {
        let s = make_storage();
        assert!(matches!(
            s.delete_bucket("nope"),
            Err(StorageError::BucketNotFound(_))
        ));
    }

    #[test]
    fn test_list_buckets() {
        let s = make_storage();
        s.create_bucket("alpha").unwrap();
        s.create_bucket("beta").unwrap();
        let list = s.list_buckets().unwrap();
        assert_eq!(list.len(), 2);
    }

    #[test]
    fn test_bucket_exists() {
        let s = setup_with_bucket("exists");
        assert!(s.bucket_exists("exists").unwrap());
        assert!(!s.bucket_exists("nope").unwrap());
    }

    #[test]
    fn test_ensure_bucket_creates() {
        let s = make_storage();
        s.ensure_bucket("auto-created").unwrap();
        assert!(s.bucket_exists("auto-created").unwrap());
    }

    #[test]
    fn test_ensure_bucket_existing() {
        let s = setup_with_bucket("existing");
        let info = s.ensure_bucket("existing").unwrap();
        assert_eq!(info.name, "existing");
    }

    // --- Upload / Download ---

    #[test]
    fn test_upload_and_download() {
        let s = setup_with_bucket("files");
        let data = b"hello world";
        s.upload("files", "greeting.txt", data, None, None).unwrap();
        let downloaded = s.download("files", "greeting.txt").unwrap();
        assert_eq!(downloaded, data);
    }

    #[test]
    fn test_upload_auto_content_type() {
        let s = setup_with_bucket("files");
        let info = s
            .upload("files", "photo.png", b"png-data", None, None)
            .unwrap();
        assert_eq!(info.content_type, "image/png");
    }

    #[test]
    fn test_upload_explicit_content_type() {
        let s = setup_with_bucket("files");
        let info = s
            .upload(
                "files",
                "data.bin",
                b"binary",
                Some("application/custom"),
                None,
            )
            .unwrap();
        assert_eq!(info.content_type, "application/custom");
    }

    #[test]
    fn test_upload_with_metadata() {
        let s = setup_with_bucket("files");
        let mut meta = HashMap::new();
        meta.insert("author".into(), "john".into());
        let info = s
            .upload("files", "doc.pdf", b"pdf-data", None, Some(meta))
            .unwrap();
        assert_eq!(info.metadata.get("author").unwrap(), "john");
    }

    #[test]
    fn test_upload_to_nonexistent_bucket() {
        let s = make_storage();
        let err = s
            .upload("nope", "file.txt", b"data", None, None)
            .unwrap_err();
        assert!(matches!(err, StorageError::BucketNotFound(_)));
    }

    #[test]
    fn test_upload_size_limit() {
        let s = StorageService::new(StorageConfig {
            max_upload_bytes: 10,
            ..StorageConfig::default()
        })
        .unwrap();
        s.create_bucket("small").unwrap();
        let err = s
            .upload("small", "big.bin", &[0u8; 20], None, None)
            .unwrap_err();
        assert!(matches!(err, StorageError::SizeLimitExceeded { .. }));
    }

    #[test]
    fn test_upload_overwrites() {
        let s = setup_with_bucket("files");
        s.upload("files", "item", b"v1", None, None).unwrap();
        s.upload("files", "item", b"v2", None, None).unwrap();
        let data = s.download("files", "item").unwrap();
        assert_eq!(data, b"v2");
    }

    #[test]
    fn test_download_nonexistent() {
        let s = setup_with_bucket("files");
        assert!(matches!(
            s.download("files", "nope"),
            Err(StorageError::ObjectNotFound { .. })
        ));
    }

    // --- Head / exists ---

    #[test]
    fn test_head_object() {
        let s = setup_with_bucket("files");
        s.upload("files", "test.json", b"{}", None, None).unwrap();
        let info = s.head("files", "test.json").unwrap();
        assert_eq!(info.size_bytes, 2);
        assert_eq!(info.content_type, "application/json");
    }

    #[test]
    fn test_object_exists() {
        let s = setup_with_bucket("files");
        s.upload("files", "exists.txt", b"yes", None, None).unwrap();
        assert!(s.object_exists("files", "exists.txt").unwrap());
        assert!(!s.object_exists("files", "nope.txt").unwrap());
    }

    // --- Delete ---

    #[test]
    fn test_delete_object() {
        let s = setup_with_bucket("files");
        s.upload("files", "temp.txt", b"data", None, None).unwrap();
        s.delete_object("files", "temp.txt").unwrap();
        assert!(!s.object_exists("files", "temp.txt").unwrap());
    }

    #[test]
    fn test_delete_nonexistent_object() {
        let s = setup_with_bucket("files");
        assert!(matches!(
            s.delete_object("files", "nope"),
            Err(StorageError::ObjectNotFound { .. })
        ));
    }

    #[test]
    fn test_delete_updates_bucket_stats() {
        let s = setup_with_bucket("files");
        s.upload("files", "a.txt", b"12345", None, None).unwrap();
        s.upload("files", "b.txt", b"67890", None, None).unwrap();
        let info_before = s.bucket_info("files").unwrap();
        assert_eq!(info_before.object_count, 2);
        assert_eq!(info_before.total_size_bytes, 10);

        s.delete_object("files", "a.txt").unwrap();
        let info_after = s.bucket_info("files").unwrap();
        assert_eq!(info_after.object_count, 1);
        assert_eq!(info_after.total_size_bytes, 5);
    }

    // --- List ---

    #[test]
    fn test_list_objects() {
        let s = setup_with_bucket("files");
        s.upload("files", "a.txt", b"a", None, None).unwrap();
        s.upload("files", "b.txt", b"b", None, None).unwrap();
        let page = s.list_objects("files", None, None).unwrap();
        assert_eq!(page.objects.len(), 2);
    }

    #[test]
    fn test_list_objects_with_prefix() {
        let s = setup_with_bucket("files");
        s.upload("files", "images/a.png", b"a", None, None).unwrap();
        s.upload("files", "images/b.png", b"b", None, None).unwrap();
        s.upload("files", "docs/c.pdf", b"c", None, None).unwrap();

        let page = s.list_objects("files", Some("images/"), None).unwrap();
        assert_eq!(page.objects.len(), 2);
    }

    #[test]
    fn test_list_objects_max_keys() {
        let s = setup_with_bucket("files");
        for i in 0..5 {
            s.upload("files", &format!("{}.txt", i), b"x", None, None)
                .unwrap();
        }
        let page = s.list_objects("files", None, Some(3)).unwrap();
        assert_eq!(page.objects.len(), 3);
        assert!(page.is_truncated);
    }

    // --- Copy ---

    #[test]
    fn test_copy_object() {
        let s = make_storage();
        s.create_bucket("src").unwrap();
        s.create_bucket("dst").unwrap();
        s.upload("src", "file.txt", b"original", None, None)
            .unwrap();

        let info = s.copy_object("src", "file.txt", "dst", "copy.txt").unwrap();
        assert_eq!(info.key, "copy.txt");

        let data = s.download("dst", "copy.txt").unwrap();
        assert_eq!(data, b"original");
    }

    // --- Pre-signed URLs ---

    #[test]
    fn test_presigned_download() {
        let s = setup_with_bucket("files");
        s.upload("files", "doc.pdf", b"pdf", None, None).unwrap();
        let url = s.presigned_download("files", "doc.pdf", Some(600)).unwrap();
        assert!(url.url.contains("files/doc.pdf"));
        assert!(url.url.contains("X-Amz-Expires=600"));
        assert_eq!(url.method, "GET");
    }

    #[test]
    fn test_presigned_download_nonexistent() {
        let s = setup_with_bucket("files");
        assert!(matches!(
            s.presigned_download("files", "nope", None),
            Err(StorageError::ObjectNotFound { .. })
        ));
    }

    #[test]
    fn test_presigned_upload() {
        let s = setup_with_bucket("files");
        let url = s.presigned_upload("files", "new.png", None).unwrap();
        assert!(url.url.contains("X-Amz-Method=PUT"));
        assert_eq!(url.method, "PUT");
    }

    // --- Domain helpers ---

    #[test]
    fn test_upload_texture() {
        let s = make_storage();
        let info = s.upload_texture("oak.png", b"png-data", None).unwrap();
        assert_eq!(info.bucket, "textures");
        assert_eq!(info.key, "oak.png");
    }

    #[test]
    fn test_store_render_output() {
        let s = make_storage();
        let info = s.store_render_output("r-123", "final.png", b"img").unwrap();
        assert_eq!(info.bucket, "renders");
        assert_eq!(info.key, "r-123/final.png");
    }

    #[test]
    fn test_store_export() {
        let s = make_storage();
        let info = s
            .store_export("job-42", "output.gcode", b"G0 X0 Y0")
            .unwrap();
        assert_eq!(info.bucket, "exports");
        assert_eq!(info.key, "job-42/output.gcode");
    }

    #[test]
    fn test_texture_url() {
        let s = make_storage();
        s.upload_texture("walnut.jpg", b"jpg", None).unwrap();
        let url = s.texture_url("walnut.jpg").unwrap();
        assert!(url.url.contains("textures/walnut.jpg"));
    }

    // --- Connection errors ---

    #[test]
    fn test_operations_fail_disconnected() {
        let s = make_storage();
        s.simulate_disconnect();
        assert!(s.create_bucket("x").is_err());
        assert!(s.list_buckets().is_err());
    }

    #[test]
    fn test_reconnect() {
        let s = make_storage();
        s.simulate_disconnect();
        s.simulate_reconnect();
        s.create_bucket("ok").unwrap();
    }

    // --- Content type guessing ---

    #[test]
    fn test_guess_content_types() {
        assert_eq!(guess_content_type("photo.jpg"), "image/jpeg");
        assert_eq!(guess_content_type("doc.pdf"), "application/pdf");
        assert_eq!(guess_content_type("program.gcode"), "text/plain");
        assert_eq!(guess_content_type("model.stl"), "model/stl");
        assert_eq!(guess_content_type("unknown"), "application/octet-stream");
    }
}
