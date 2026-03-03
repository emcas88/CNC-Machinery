//! # Redis Cache Service
//!
//! Provides a high-level Redis wrapper for the CNC-Machinery backend.
//! Handles connection pool management, JSON serialization, key expiry,
//! and domain-specific caching for nesting results, render jobs, and
//! user sessions.
//!
//! ## Design
//!
//! - **Connection pooling** via a configurable pool of Redis connections.
//! - **JSON serialization** – any `Serialize`/`Deserialize` type can be
//!   cached transparently; stored as JSON strings in Redis.
//! - **Key namespacing** – all keys are prefixed with a configurable
//!   namespace (default `cnc:`) to avoid collisions.
//! - **TTL management** – default and per-key TTLs; explicit expire/persist.
//! - **Batch operations** – `mget`, `mset` for bulk cache warming.
//!
//! ## Usage
//!
//! ```rust,ignore
//! let cache = CacheService::new(CacheConfig::default())?;
//! cache.set("nesting:job-1", &nesting_result, Some(3600)).await?;
//! let result: Option<NestingResult> = cache.get("nesting:job-1").await?;
//! ```

use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/// Errors that can occur during cache operations.
#[derive(Debug, Clone, PartialEq)]
pub enum CacheError {
    /// Connection to Redis failed or was lost.
    ConnectionError(String),
    /// Serialization or deserialization failed.
    SerializationError(String),
    /// The requested key was not found (distinct from a deserialisation error).
    KeyNotFound(String),
    /// A pool-level error (exhausted connections, timeout).
    PoolError(String),
    /// Generic / unexpected error.
    Other(String),
}

impl std::fmt::Display for CacheError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CacheError::ConnectionError(msg) => write!(f, "cache connection error: {}", msg),
            CacheError::SerializationError(msg) => write!(f, "cache serialization error: {}", msg),
            CacheError::KeyNotFound(key) => write!(f, "cache key not found: {}", key),
            CacheError::PoolError(msg) => write!(f, "cache pool error: {}", msg),
            CacheError::Other(msg) => write!(f, "cache error: {}", msg),
        }
    }
}

impl std::error::Error for CacheError {}

pub type CacheResult<T> = Result<T, CacheError>;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/// Redis connection and behaviour configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    /// Redis connection URL (e.g. `redis://127.0.0.1:6379`).
    pub url: String,
    /// Key prefix / namespace. Default: `"cnc:"`.
    pub namespace: String,
    /// Default TTL in seconds for keys without an explicit TTL. `None` = no expiry.
    pub default_ttl_secs: Option<u64>,
    /// Maximum number of connections in the pool.
    pub pool_size: usize,
    /// Connection timeout.
    pub connect_timeout_ms: u64,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            url: "redis://127.0.0.1:6379".into(),
            namespace: "cnc:".into(),
            default_ttl_secs: Some(3600),
            pool_size: 8,
            connect_timeout_ms: 5000,
        }
    }
}

// ---------------------------------------------------------------------------
// Internal cache entry (for in-process mock / testing)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
struct CacheEntry {
    value: String,
    expires_at: Option<Instant>,
}

impl CacheEntry {
    fn is_expired(&self) -> bool {
        self.expires_at.map_or(false, |t| Instant::now() >= t)
    }
}

// ---------------------------------------------------------------------------
// CacheService
// ---------------------------------------------------------------------------

/// High-level Redis cache wrapper.
///
/// In production this wraps a real Redis connection pool. The implementation
/// below uses an in-memory `HashMap` behind a `Mutex` so it can be tested
/// without a running Redis instance.
#[derive(Debug, Clone)]
pub struct CacheService {
    config: CacheConfig,
    store: Arc<Mutex<HashMap<String, CacheEntry>>>,
    connected: Arc<Mutex<bool>>,
}

impl CacheService {
    /// Create a new cache service. In production this would establish a
    /// connection pool to Redis; here it initialises the in-memory store.
    pub fn new(config: CacheConfig) -> CacheResult<Self> {
        if config.url.is_empty() {
            return Err(CacheError::ConnectionError("empty URL".into()));
        }
        if config.pool_size == 0 {
            return Err(CacheError::PoolError("pool_size must be > 0".into()));
        }
        Ok(Self {
            config,
            store: Arc::new(Mutex::new(HashMap::new())),
            connected: Arc::new(Mutex::new(true)),
        })
    }

    /// Return the fully-qualified key with namespace prefix.
    pub fn namespaced_key(&self, key: &str) -> String {
        format!("{}{}", self.config.namespace, key)
    }

    // -- helpers --

    fn effective_ttl(&self, ttl: Option<u64>) -> Option<Duration> {
        let secs = ttl.or(self.config.default_ttl_secs)?;
        Some(Duration::from_secs(secs))
    }

    fn check_connected(&self) -> CacheResult<()> {
        let connected = self
            .connected
            .lock()
            .map_err(|e| CacheError::Other(e.to_string()))?;
        if !*connected {
            return Err(CacheError::ConnectionError("not connected".into()));
        }
        Ok(())
    }

    fn purge_expired(&self) {
        if let Ok(mut store) = self.store.lock() {
            store.retain(|_, entry| !entry.is_expired());
        }
    }

    // -----------------------------------------------------------------------
    // Core operations
    // -----------------------------------------------------------------------

    /// Store a JSON-serialisable value under `key` with an optional TTL
    /// (seconds). If `ttl` is `None` the `default_ttl_secs` from the config
    /// is used; pass `Some(0)` for no expiry.
    pub fn set<T: Serialize>(
        &self,
        key: &str,
        value: &T,
        ttl_secs: Option<u64>,
    ) -> CacheResult<()> {
        self.check_connected()?;
        let json = serde_json::to_string(value)
            .map_err(|e| CacheError::SerializationError(e.to_string()))?;

        let ns_key = self.namespaced_key(key);
        let expires_at = if ttl_secs == Some(0) {
            None
        } else {
            self.effective_ttl(ttl_secs).map(|d| Instant::now() + d)
        };

        let mut store = self
            .store
            .lock()
            .map_err(|e| CacheError::Other(e.to_string()))?;
        store.insert(
            ns_key,
            CacheEntry {
                value: json,
                expires_at,
            },
        );
        Ok(())
    }

    /// Retrieve and deserialise a value. Returns `Ok(None)` if the key does
    /// not exist or has expired.
    pub fn get<T: DeserializeOwned>(&self, key: &str) -> CacheResult<Option<T>> {
        self.check_connected()?;
        let ns_key = self.namespaced_key(key);
        let store = self
            .store
            .lock()
            .map_err(|e| CacheError::Other(e.to_string()))?;

        match store.get(&ns_key) {
            Some(entry) if !entry.is_expired() => {
                let val = serde_json::from_str(&entry.value)
                    .map_err(|e| CacheError::SerializationError(e.to_string()))?;
                Ok(Some(val))
            }
            _ => Ok(None),
        }
    }

    /// Delete a key. Returns `true` if the key existed.
    pub fn delete(&self, key: &str) -> CacheResult<bool> {
        self.check_connected()?;
        let ns_key = self.namespaced_key(key);
        let mut store = self
            .store
            .lock()
            .map_err(|e| CacheError::Other(e.to_string()))?;
        Ok(store.remove(&ns_key).is_some())
    }

    /// Check whether a key exists and is not expired.
    pub fn exists(&self, key: &str) -> CacheResult<bool> {
        self.check_connected()?;
        let ns_key = self.namespaced_key(key);
        let store = self
            .store
            .lock()
            .map_err(|e| CacheError::Other(e.to_string()))?;
        Ok(store.get(&ns_key).map_or(false, |e| !e.is_expired()))
    }

    /// Set or update the TTL on an existing key. Returns `false` if key
    /// does not exist.
    pub fn expire(&self, key: &str, ttl_secs: u64) -> CacheResult<bool> {
        self.check_connected()?;
        let ns_key = self.namespaced_key(key);
        let mut store = self
            .store
            .lock()
            .map_err(|e| CacheError::Other(e.to_string()))?;

        if let Some(entry) = store.get_mut(&ns_key) {
            if entry.is_expired() {
                store.remove(&ns_key);
                return Ok(false);
            }
            entry.expires_at = Some(Instant::now() + Duration::from_secs(ttl_secs));
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Remove the TTL from a key (make it persistent).
    pub fn persist(&self, key: &str) -> CacheResult<bool> {
        self.check_connected()?;
        let ns_key = self.namespaced_key(key);
        let mut store = self
            .store
            .lock()
            .map_err(|e| CacheError::Other(e.to_string()))?;

        if let Some(entry) = store.get_mut(&ns_key) {
            entry.expires_at = None;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Retrieve the remaining TTL in seconds. `None` if the key has no
    /// expiry; returns an error if the key does not exist.
    pub fn ttl(&self, key: &str) -> CacheResult<Option<u64>> {
        self.check_connected()?;
        let ns_key = self.namespaced_key(key);
        let store = self
            .store
            .lock()
            .map_err(|e| CacheError::Other(e.to_string()))?;

        match store.get(&ns_key) {
            Some(entry) if !entry.is_expired() => match entry.expires_at {
                Some(exp) => {
                    let remaining = exp.saturating_duration_since(Instant::now());
                    Ok(Some(remaining.as_secs()))
                }
                None => Ok(None),
            },
            _ => Err(CacheError::KeyNotFound(key.into())),
        }
    }

    // -----------------------------------------------------------------------
    // Batch operations
    // -----------------------------------------------------------------------

    /// Get multiple keys at once.
    pub fn mget<T: DeserializeOwned>(&self, keys: &[&str]) -> CacheResult<Vec<Option<T>>> {
        self.check_connected()?;
        keys.iter().map(|k| self.get(k)).collect()
    }

    /// Set multiple keys at once with the same TTL.
    pub fn mset<T: Serialize>(
        &self,
        entries: &[(&str, &T)],
        ttl_secs: Option<u64>,
    ) -> CacheResult<()> {
        self.check_connected()?;
        for (key, value) in entries {
            self.set(key, value, ttl_secs)?;
        }
        Ok(())
    }

    /// Delete all keys matching a prefix (within the namespace).
    pub fn delete_pattern(&self, pattern: &str) -> CacheResult<usize> {
        self.check_connected()?;
        let full_prefix = self.namespaced_key(pattern);
        let mut store = self
            .store
            .lock()
            .map_err(|e| CacheError::Other(e.to_string()))?;
        let keys_to_remove: Vec<String> = store
            .keys()
            .filter(|k| k.starts_with(&full_prefix))
            .cloned()
            .collect();
        let count = keys_to_remove.len();
        for key in keys_to_remove {
            store.remove(&key);
        }
        Ok(count)
    }

    /// Count all non-expired keys in the namespace.
    pub fn key_count(&self) -> CacheResult<usize> {
        self.check_connected()?;
        self.purge_expired();
        let store = self
            .store
            .lock()
            .map_err(|e| CacheError::Other(e.to_string()))?;
        Ok(store.len())
    }

    /// Flush all keys in the namespace.
    pub fn flush(&self) -> CacheResult<()> {
        self.check_connected()?;
        let mut store = self
            .store
            .lock()
            .map_err(|e| CacheError::Other(e.to_string()))?;
        store.clear();
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Domain-specific helpers
    // -----------------------------------------------------------------------

    /// Cache a nesting result. Default TTL: 1 hour.
    pub fn cache_nesting_result<T: Serialize>(&self, job_id: &str, result: &T) -> CacheResult<()> {
        let key = format!("nesting:{}", job_id);
        self.set(&key, result, Some(3600))
    }

    /// Retrieve a cached nesting result.
    pub fn get_nesting_result<T: DeserializeOwned>(&self, job_id: &str) -> CacheResult<Option<T>> {
        let key = format!("nesting:{}", job_id);
        self.get(&key)
    }

    /// Invalidate a cached nesting result.
    pub fn invalidate_nesting(&self, job_id: &str) -> CacheResult<bool> {
        let key = format!("nesting:{}", job_id);
        self.delete(&key)
    }

    /// Cache a render job status. Default TTL: 30 minutes.
    pub fn cache_render_job<T: Serialize>(&self, render_id: &str, job: &T) -> CacheResult<()> {
        let key = format!("render:{}", render_id);
        self.set(&key, job, Some(1800))
    }

    /// Retrieve a cached render job.
    pub fn get_render_job<T: DeserializeOwned>(&self, render_id: &str) -> CacheResult<Option<T>> {
        let key = format!("render:{}", render_id);
        self.get(&key)
    }

    /// Store a user session. Default TTL: 24 hours.
    pub fn set_session<T: Serialize>(&self, session_id: &str, session: &T) -> CacheResult<()> {
        let key = format!("session:{}", session_id);
        self.set(&key, session, Some(86400))
    }

    /// Retrieve a user session.
    pub fn get_session<T: DeserializeOwned>(&self, session_id: &str) -> CacheResult<Option<T>> {
        let key = format!("session:{}", session_id);
        self.get(&key)
    }

    /// Delete a user session (logout).
    pub fn delete_session(&self, session_id: &str) -> CacheResult<bool> {
        let key = format!("session:{}", session_id);
        self.delete(&key)
    }

    /// Invalidate all sessions for a user (force logout everywhere).
    pub fn invalidate_user_sessions(&self, user_id: &str) -> CacheResult<usize> {
        let pattern = format!("session:{}:", user_id);
        self.delete_pattern(&pattern)
    }

    // -----------------------------------------------------------------------
    // Connection management (for testing / health checks)
    // -----------------------------------------------------------------------

    /// Simulate a disconnect (for testing error paths).
    pub fn simulate_disconnect(&self) {
        if let Ok(mut c) = self.connected.lock() {
            *c = false;
        }
    }

    /// Simulate a reconnect.
    pub fn simulate_reconnect(&self) {
        if let Ok(mut c) = self.connected.lock() {
            *c = true;
        }
    }

    /// Check if the service is connected.
    pub fn is_connected(&self) -> bool {
        self.connected.lock().map_or(false, |c| *c)
    }

    /// Return the current config (read-only).
    pub fn config(&self) -> &CacheConfig {
        &self.config
    }
}

// =========================================================================
// Tests
// =========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;

    fn make_cache() -> CacheService {
        CacheService::new(CacheConfig {
            default_ttl_secs: Some(60),
            ..CacheConfig::default()
        })
        .unwrap()
    }

    // --- Construction / config ---

    #[test]
    fn test_create_with_default_config() {
        let cache = CacheService::new(CacheConfig::default()).unwrap();
        assert!(cache.is_connected());
        assert_eq!(cache.config().namespace, "cnc:");
    }

    #[test]
    fn test_reject_empty_url() {
        let cfg = CacheConfig {
            url: "".into(),
            ..CacheConfig::default()
        };
        let err = CacheService::new(cfg).unwrap_err();
        assert!(matches!(err, CacheError::ConnectionError(_)));
    }

    #[test]
    fn test_reject_zero_pool_size() {
        let cfg = CacheConfig {
            pool_size: 0,
            ..CacheConfig::default()
        };
        let err = CacheService::new(cfg).unwrap_err();
        assert!(matches!(err, CacheError::PoolError(_)));
    }

    // --- Basic get / set / delete ---

    #[test]
    fn test_set_and_get_string() {
        let cache = make_cache();
        cache
            .set("greeting", &"hello world".to_string(), None)
            .unwrap();
        let val: Option<String> = cache.get("greeting").unwrap();
        assert_eq!(val, Some("hello world".to_string()));
    }

    #[test]
    fn test_set_and_get_struct() {
        #[derive(Debug, Serialize, Deserialize, PartialEq)]
        struct Point {
            x: f64,
            y: f64,
        }

        let cache = make_cache();
        let p = Point { x: 1.0, y: 2.0 };
        cache.set("point", &p, None).unwrap();
        let val: Option<Point> = cache.get("point").unwrap();
        assert_eq!(val, Some(Point { x: 1.0, y: 2.0 }));
    }

    #[test]
    fn test_get_nonexistent_returns_none() {
        let cache = make_cache();
        let val: Option<String> = cache.get("nope").unwrap();
        assert_eq!(val, None);
    }

    #[test]
    fn test_delete_existing_key() {
        let cache = make_cache();
        cache.set("to-delete", &42u32, None).unwrap();
        assert!(cache.delete("to-delete").unwrap());
        let val: Option<u32> = cache.get("to-delete").unwrap();
        assert!(val.is_none());
    }

    #[test]
    fn test_delete_nonexistent_key() {
        let cache = make_cache();
        assert!(!cache.delete("nope").unwrap());
    }

    // --- Exists ---

    #[test]
    fn test_exists_true() {
        let cache = make_cache();
        cache.set("alive", &1u32, None).unwrap();
        assert!(cache.exists("alive").unwrap());
    }

    #[test]
    fn test_exists_false() {
        let cache = make_cache();
        assert!(!cache.exists("ghost").unwrap());
    }

    // --- TTL / expiry ---

    #[test]
    fn test_key_expires() {
        let cache = CacheService::new(CacheConfig {
            default_ttl_secs: None,
            ..CacheConfig::default()
        })
        .unwrap();

        // Set with 1-second TTL
        cache.set("short-lived", &"data", Some(1)).unwrap();
        assert!(cache.exists("short-lived").unwrap());

        // Wait for expiry
        thread::sleep(Duration::from_millis(1100));
        let val: Option<String> = cache.get("short-lived").unwrap();
        assert!(val.is_none());
    }

    #[test]
    fn test_no_expiry_with_zero_ttl() {
        let cache = make_cache();
        cache.set("permanent", &"forever", Some(0)).unwrap();
        // The key should exist and have no TTL
        let ttl = cache.ttl("permanent").unwrap();
        assert!(ttl.is_none());
    }

    #[test]
    fn test_expire_updates_ttl() {
        let cache = make_cache();
        cache.set("item", &100u32, Some(60)).unwrap();
        assert!(cache.expire("item", 120).unwrap());
        let ttl = cache.ttl("item").unwrap().unwrap();
        assert!(ttl > 60); // should now be ~120
    }

    #[test]
    fn test_expire_nonexistent_key() {
        let cache = make_cache();
        assert!(!cache.expire("nope", 100).unwrap());
    }

    #[test]
    fn test_persist_removes_ttl() {
        let cache = make_cache();
        cache.set("with-ttl", &"val", Some(30)).unwrap();
        cache.persist("with-ttl").unwrap();
        let ttl = cache.ttl("with-ttl").unwrap();
        assert!(ttl.is_none());
    }

    #[test]
    fn test_ttl_key_not_found() {
        let cache = make_cache();
        let err = cache.ttl("nope").unwrap_err();
        assert!(matches!(err, CacheError::KeyNotFound(_)));
    }

    // --- Namespace ---

    #[test]
    fn test_namespaced_key() {
        let cache = make_cache();
        assert_eq!(cache.namespaced_key("foo"), "cnc:foo");
    }

    #[test]
    fn test_custom_namespace() {
        let cache = CacheService::new(CacheConfig {
            namespace: "myapp:".into(),
            ..CacheConfig::default()
        })
        .unwrap();
        assert_eq!(cache.namespaced_key("bar"), "myapp:bar");
    }

    // --- Batch operations ---

    #[test]
    fn test_mset_and_mget() {
        let cache = make_cache();
        let a = "alpha".to_string();
        let b = "beta".to_string();
        cache.mset(&[("a", &a), ("b", &b)], None).unwrap();

        let results: Vec<Option<String>> = cache.mget(&["a", "b", "c"]).unwrap();
        assert_eq!(
            results,
            vec![Some("alpha".into()), Some("beta".into()), None]
        );
    }

    #[test]
    fn test_delete_pattern() {
        let cache = make_cache();
        cache.set("render:1", &"a", None).unwrap();
        cache.set("render:2", &"b", None).unwrap();
        cache.set("session:x", &"c", None).unwrap();

        let deleted = cache.delete_pattern("render:").unwrap();
        assert_eq!(deleted, 2);
        assert!(!cache.exists("render:1").unwrap());
        assert!(cache.exists("session:x").unwrap());
    }

    // --- Key count / flush ---

    #[test]
    fn test_key_count() {
        let cache = make_cache();
        cache.set("a", &1u32, None).unwrap();
        cache.set("b", &2u32, None).unwrap();
        assert_eq!(cache.key_count().unwrap(), 2);
    }

    #[test]
    fn test_flush() {
        let cache = make_cache();
        cache.set("x", &1u32, None).unwrap();
        cache.set("y", &2u32, None).unwrap();
        cache.flush().unwrap();
        assert_eq!(cache.key_count().unwrap(), 0);
    }

    // --- Domain helpers ---

    #[test]
    fn test_cache_nesting_result() {
        #[derive(Debug, Serialize, Deserialize, PartialEq)]
        struct NestingResult {
            sheets: u32,
            yield_pct: f64,
        }

        let cache = make_cache();
        let result = NestingResult {
            sheets: 3,
            yield_pct: 87.5,
        };
        cache.cache_nesting_result("job-42", &result).unwrap();
        let got: Option<NestingResult> = cache.get_nesting_result("job-42").unwrap();
        assert_eq!(got, Some(result));
    }

    #[test]
    fn test_invalidate_nesting() {
        let cache = make_cache();
        cache.cache_nesting_result("job-42", &"data").unwrap();
        assert!(cache.invalidate_nesting("job-42").unwrap());
        let val: Option<String> = cache.get_nesting_result("job-42").unwrap();
        assert!(val.is_none());
    }

    #[test]
    fn test_cache_render_job() {
        let cache = make_cache();
        cache.cache_render_job("render-99", &"processing").unwrap();
        let got: Option<String> = cache.get_render_job("render-99").unwrap();
        assert_eq!(got, Some("processing".into()));
    }

    #[test]
    fn test_session_lifecycle() {
        #[derive(Debug, Serialize, Deserialize, PartialEq)]
        struct Session {
            user_id: String,
            role: String,
        }

        let cache = make_cache();
        let s = Session {
            user_id: "u-1".into(),
            role: "admin".into(),
        };
        cache.set_session("sess-abc", &s).unwrap();

        let got: Option<Session> = cache.get_session("sess-abc").unwrap();
        assert_eq!(
            got,
            Some(Session {
                user_id: "u-1".into(),
                role: "admin".into()
            })
        );

        assert!(cache.delete_session("sess-abc").unwrap());
        let gone: Option<Session> = cache.get_session("sess-abc").unwrap();
        assert!(gone.is_none());
    }

    // --- Connection error handling ---

    #[test]
    fn test_operations_fail_when_disconnected() {
        let cache = make_cache();
        cache.simulate_disconnect();

        assert!(cache.set("key", &"val", None).is_err());
        assert!(cache.get::<String>("key").is_err());
        assert!(cache.delete("key").is_err());
        assert!(cache.exists("key").is_err());
    }

    #[test]
    fn test_reconnect_restores_operations() {
        let cache = make_cache();
        cache.simulate_disconnect();
        assert!(!cache.is_connected());

        cache.simulate_reconnect();
        assert!(cache.is_connected());
        cache.set("key", &"val", None).unwrap();
        let v: Option<String> = cache.get("key").unwrap();
        assert_eq!(v, Some("val".into()));
    }

    // --- Overwrite / update ---

    #[test]
    fn test_set_overwrites_existing() {
        let cache = make_cache();
        cache.set("key", &"first", None).unwrap();
        cache.set("key", &"second", None).unwrap();
        let v: Option<String> = cache.get("key").unwrap();
        assert_eq!(v, Some("second".into()));
    }

    // --- Serialization edge cases ---

    #[test]
    fn test_cache_complex_nested_struct() {
        #[derive(Debug, Serialize, Deserialize, PartialEq)]
        struct Inner {
            val: Vec<u32>,
        }
        #[derive(Debug, Serialize, Deserialize, PartialEq)]
        struct Outer {
            name: String,
            inner: Inner,
        }

        let cache = make_cache();
        let data = Outer {
            name: "test".into(),
            inner: Inner { val: vec![1, 2, 3] },
        };
        cache.set("nested", &data, None).unwrap();
        let got: Option<Outer> = cache.get("nested").unwrap();
        assert_eq!(got, Some(data));
    }

    #[test]
    fn test_deserialization_error() {
        let cache = make_cache();
        cache.set("num", &42u32, None).unwrap();
        // Try to deserialize as a different type
        let result: CacheResult<Option<Vec<String>>> = cache.get("num");
        assert!(result.is_err());
    }

    // --- Thread safety ---

    #[test]
    fn test_concurrent_access() {
        let cache = make_cache();
        let cache_clone = cache.clone();

        let handle = thread::spawn(move || {
            for i in 0..100 {
                cache_clone.set(&format!("t1-{}", i), &i, None).unwrap();
            }
        });

        for i in 0..100 {
            cache.set(&format!("t2-{}", i), &i, None).unwrap();
        }

        handle.join().unwrap();
        assert!(cache.key_count().unwrap() >= 200);
    }
}
