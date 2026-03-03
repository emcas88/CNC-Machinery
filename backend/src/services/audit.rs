//! # Audit Logging Service
//!
//! Captures structured audit log entries for every significant action in the
//! CNC-Machinery system. Provides query capabilities with filtering by user,
//! entity, date range, and action type.
//!
//! ## Design
//!
//! - **Structured entries** – each [`AuditEntry`] captures who did what, when,
//!   to which entity, including old/new values for change tracking.
//! - **Middleware factory** – [`AuditService::log_middleware_factory`] returns
//!   a closure suitable for plugging into an Actix-web / Axum middleware chain.
//! - **Queryable** – filter logs by user, entity type, entity ID, action,
//!   and date range using [`AuditQuery`].
//! - **Thread-safe** – backed by `Arc<Mutex<>>` for concurrent access.
//!
//! ## Usage
//!
//! ```rust,ignore
//! let audit = AuditService::new();
//! audit.log_action(AuditEntry {
//!     user_id: "u-1".into(),
//!     action: AuditAction::Create,
//!     entity_type: "job".into(),
//!     entity_id: "j-42".into(),
//!     ..Default::default()
//! })?;
//! let logs = audit.query_logs(AuditQuery::by_user("u-1"))?;
//! ```

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq)]
pub enum AuditError {
    /// A required field was missing or invalid.
    ValidationError(String),
    /// Storage / persistence error.
    StorageError(String),
    /// Generic error.
    Other(String),
}

impl std::fmt::Display for AuditError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuditError::ValidationError(msg) => write!(f, "audit validation error: {msg}"),
            AuditError::StorageError(msg) => write!(f, "audit storage error: {msg}"),
            AuditError::Other(msg) => write!(f, "audit error: {msg}"),
        }
    }
}

impl std::error::Error for AuditError {}

pub type AuditResult<T> = Result<T, AuditError>;

// ---------------------------------------------------------------------------
// Audit action enum
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditAction {
    Create,
    Read,
    Update,
    Delete,
    Login,
    Logout,
    Export,
    Import,
    Print,
    Submit,
    Approve,
    Reject,
    Archive,
    Restore,
    Custom(String),
}

impl AuditAction {
    pub fn as_str(&self) -> &str {
        match self {
            AuditAction::Create => "create",
            AuditAction::Read => "read",
            AuditAction::Update => "update",
            AuditAction::Delete => "delete",
            AuditAction::Login => "login",
            AuditAction::Logout => "logout",
            AuditAction::Export => "export",
            AuditAction::Import => "import",
            AuditAction::Print => "print",
            AuditAction::Submit => "submit",
            AuditAction::Approve => "approve",
            AuditAction::Reject => "reject",
            AuditAction::Archive => "archive",
            AuditAction::Restore => "restore",
            AuditAction::Custom(s) => s.as_str(),
        }
    }
}

// ---------------------------------------------------------------------------
// Audit entry
// ---------------------------------------------------------------------------

/// A single audit log entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    /// Unique ID for this log entry (auto-generated if empty).
    pub id: String,
    /// The user who performed the action.
    pub user_id: String,
    /// The action performed.
    pub action: AuditAction,
    /// The type of entity affected (e.g., "job", "part", "material").
    pub entity_type: String,
    /// The ID of the affected entity.
    pub entity_id: String,
    /// The previous value (for updates); JSON-encoded.
    pub old_value: Option<String>,
    /// The new value (for creates/updates); JSON-encoded.
    pub new_value: Option<String>,
    /// The IP address of the client.
    pub ip_address: Option<String>,
    /// User agent string.
    pub user_agent: Option<String>,
    /// Additional context (free-form key-value pairs).
    pub metadata: HashMap<String, String>,
    /// When the action occurred.
    pub timestamp: DateTime<Utc>,
}

impl Default for AuditEntry {
    fn default() -> Self {
        Self {
            id: String::new(),
            user_id: String::new(),
            action: AuditAction::Read,
            entity_type: String::new(),
            entity_id: String::new(),
            old_value: None,
            new_value: None,
            ip_address: None,
            user_agent: None,
            metadata: HashMap::new(),
            timestamp: Utc::now(),
        }
    }
}

impl AuditEntry {
    /// Validate the entry has required fields.
    pub fn validate(&self) -> AuditResult<()> {
        if self.user_id.is_empty() {
            return Err(AuditError::ValidationError("user_id is required".into()));
        }
        if self.entity_type.is_empty() {
            return Err(AuditError::ValidationError("entity_type is required".into()));
        }
        if self.entity_id.is_empty() {
            return Err(AuditError::ValidationError("entity_id is required".into()));
        }
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Audit query
// ---------------------------------------------------------------------------

/// Filter criteria for querying audit logs.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AuditQuery {
    pub user_id: Option<String>,
    pub entity_type: Option<String>,
    pub entity_id: Option<String>,
    pub action: Option<AuditAction>,
    pub start_time: Option<DateTime<Utc>>,
    pub end_time: Option<DateTime<Utc>>,
    pub ip_address: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

impl AuditQuery {
    pub fn by_user(user_id: &str) -> Self {
        Self { user_id: Some(user_id.into()), ..Default::default() }
    }

    pub fn by_entity(entity_type: &str, entity_id: &str) -> Self {
        Self {
            entity_type: Some(entity_type.into()),
            entity_id: Some(entity_id.into()),
            ..Default::default()
        }
    }

    pub fn by_action(action: AuditAction) -> Self {
        Self { action: Some(action), ..Default::default() }
    }

    pub fn by_entity_type(entity_type: &str) -> Self {
        Self { entity_type: Some(entity_type.into()), ..Default::default() }
    }

    pub fn in_range(start: DateTime<Utc>, end: DateTime<Utc>) -> Self {
        Self { start_time: Some(start), end_time: Some(end), ..Default::default() }
    }

    pub fn with_limit(mut self, limit: usize) -> Self {
        self.limit = Some(limit);
        self
    }

    pub fn with_offset(mut self, offset: usize) -> Self {
        self.offset = Some(offset);
        self
    }
}

/// Result of a query, including pagination info.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditQueryResult {
    pub entries: Vec<AuditEntry>,
    pub total_count: usize,
    pub offset: usize,
    pub limit: usize,
}

// ---------------------------------------------------------------------------
// Middleware request context
// ---------------------------------------------------------------------------

/// Represents an incoming HTTP request context for the audit middleware.
#[derive(Debug, Clone)]
pub struct RequestContext {
    pub user_id: String,
    pub ip_address: String,
    pub user_agent: String,
    pub method: String,
    pub path: String,
    pub status_code: u16,
}

// ---------------------------------------------------------------------------
// AuditService
// ---------------------------------------------------------------------------

/// In-memory audit log store. In production, this would persist to a
/// database (PostgreSQL, ClickHouse, etc.).
#[derive(Debug, Clone)]
pub struct AuditService {
    entries: Arc<Mutex<Vec<AuditEntry>>>,
    /// Whether to log read actions (can be very verbose).
    log_reads: bool,
}

impl AuditService {
    pub fn new() -> Self {
        Self {
            entries: Arc::new(Mutex::new(Vec::new())),
            log_reads: false,
        }
    }

    pub fn with_read_logging(mut self) -> Self {
        self.log_reads = true;
        self
    }

    // -----------------------------------------------------------------------
    // Core operations
    // -----------------------------------------------------------------------

    /// Log a single audit action.
    pub fn log_action(&self, mut entry: AuditEntry) -> AuditResult<String> {
        entry.validate()?;

        // Auto-generate ID if missing
        if entry.id.is_empty() {
            entry.id = Uuid::new_v4().to_string();
        }

        // Set timestamp if it's the epoch (default)
        if entry.timestamp.timestamp() == 0 {
            entry.timestamp = Utc::now();
        }

        let id = entry.id.clone();

        let mut entries = self.entries.lock().map_err(|e| AuditError::StorageError(e.to_string()))?;
        entries.push(entry);
        Ok(id)
    }

    /// Log a simple action with minimal fields.
    pub fn log_simple(
        &self,
        user_id: &str,
        action: AuditAction,
        entity_type: &str,
        entity_id: &str,
    ) -> AuditResult<String> {
        self.log_action(AuditEntry {
            user_id: user_id.into(),
            action,
            entity_type: entity_type.into(),
            entity_id: entity_id.into(),
            ..Default::default()
        })
    }

    /// Log an update with old and new values.
    pub fn log_update(
        &self,
        user_id: &str,
        entity_type: &str,
        entity_id: &str,
        old_value: &str,
        new_value: &str,
    ) -> AuditResult<String> {
        self.log_action(AuditEntry {
            user_id: user_id.into(),
            action: AuditAction::Update,
            entity_type: entity_type.into(),
            entity_id: entity_id.into(),
            old_value: Some(old_value.into()),
            new_value: Some(new_value.into()),
            ..Default::default()
        })
    }

    // -----------------------------------------------------------------------
    // Query
    // -----------------------------------------------------------------------

    /// Query audit logs with filters.
    pub fn query_logs(&self, query: AuditQuery) -> AuditResult<AuditQueryResult> {
        let entries = self.entries.lock().map_err(|e| AuditError::StorageError(e.to_string()))?;

        let mut filtered: Vec<&AuditEntry> = entries.iter().filter(|e| {
            if let Some(ref uid) = query.user_id {
                if &e.user_id != uid { return false; }
            }
            if let Some(ref et) = query.entity_type {
                if &e.entity_type != et { return false; }
            }
            if let Some(ref eid) = query.entity_id {
                if &e.entity_id != eid { return false; }
            }
            if let Some(ref action) = query.action {
                if &e.action != action { return false; }
            }
            if let Some(ref start) = query.start_time {
                if &e.timestamp < start { return false; }
            }
            if let Some(ref end) = query.end_time {
                if &e.timestamp > end { return false; }
            }
            if let Some(ref ip) = query.ip_address {
                if e.ip_address.as_deref() != Some(ip.as_str()) { return false; }
            }
            true
        }).collect();

        // Sort by timestamp descending (newest first)
        filtered.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        let total_count = filtered.len();
        let offset = query.offset.unwrap_or(0);
        let limit = query.limit.unwrap_or(100);

        let entries: Vec<AuditEntry> = filtered
            .into_iter()
            .skip(offset)
            .take(limit)
            .cloned()
            .collect();

        Ok(AuditQueryResult { entries, total_count, offset, limit })
    }

    /// Get a single audit entry by ID.
    pub fn get_entry(&self, id: &str) -> AuditResult<Option<AuditEntry>> {
        let entries = self.entries.lock().map_err(|e| AuditError::StorageError(e.to_string()))?;
        Ok(entries.iter().find(|e| e.id == id).cloned())
    }

    /// Count total audit entries.
    pub fn count(&self) -> AuditResult<usize> {
        let entries = self.entries.lock().map_err(|e| AuditError::StorageError(e.to_string()))?;
        Ok(entries.len())
    }

    /// Count entries matching a query.
    pub fn count_matching(&self, query: AuditQuery) -> AuditResult<usize> {
        let result = self.query_logs(AuditQuery { limit: Some(usize::MAX), ..query })?;
        Ok(result.total_count)
    }

    // -----------------------------------------------------------------------
    // Middleware factory
    // -----------------------------------------------------------------------

    /// Creates a middleware closure that logs HTTP requests.
    ///
    /// The returned closure takes a [`RequestContext`] and logs it as an
    /// audit entry. In a real Axum/Actix setup this would wrap the request
    /// handler and extract context automatically.
    pub fn log_middleware_factory(&self) -> impl Fn(RequestContext) -> AuditResult<String> + '_ {
        move |ctx: RequestContext| {
            // Map HTTP method to audit action
            let action = match ctx.method.to_uppercase().as_str() {
                "GET" | "HEAD" => {
                    if !self.log_reads {
                        return Ok(String::new()); // skip reads
                    }
                    AuditAction::Read
                }
                "POST" => AuditAction::Create,
                "PUT" | "PATCH" => AuditAction::Update,
                "DELETE" => AuditAction::Delete,
                _ => AuditAction::Custom(ctx.method.clone()),
            };

            let mut metadata = HashMap::new();
            metadata.insert("http_method".into(), ctx.method.clone());
            metadata.insert("http_path".into(), ctx.path.clone());
            metadata.insert("http_status".into(), ctx.status_code.to_string());

            self.log_action(AuditEntry {
                user_id: ctx.user_id.clone(),
                action,
                entity_type: "http_request".into(),
                entity_id: ctx.path.clone(),
                ip_address: Some(ctx.ip_address),
                user_agent: Some(ctx.user_agent),
                metadata,
                ..Default::default()
            })
        }
    }

    // -----------------------------------------------------------------------
    // Maintenance
    // -----------------------------------------------------------------------

    /// Purge entries older than the given date.
    pub fn purge_before(&self, before: DateTime<Utc>) -> AuditResult<usize> {
        let mut entries = self.entries.lock().map_err(|e| AuditError::StorageError(e.to_string()))?;
        let before_len = entries.len();
        entries.retain(|e| e.timestamp >= before);
        Ok(before_len - entries.len())
    }

    /// Clear all entries.
    pub fn clear(&self) -> AuditResult<()> {
        let mut entries = self.entries.lock().map_err(|e| AuditError::StorageError(e.to_string()))?;
        entries.clear();
        Ok(())
    }
}

impl Default for AuditService {
    fn default() -> Self {
        Self::new()
    }
}

// =========================================================================
// Tests
// =========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    fn make_service() -> AuditService {
        AuditService::new()
    }

    fn sample_entry(user: &str, action: AuditAction, entity_type: &str, entity_id: &str) -> AuditEntry {
        AuditEntry {
            user_id: user.into(),
            action,
            entity_type: entity_type.into(),
            entity_id: entity_id.into(),
            ..Default::default()
        }
    }

    // --- Basic logging ---

    #[test]
    fn test_log_action() {
        let svc = make_service();
        let id = svc.log_action(sample_entry("u-1", AuditAction::Create, "job", "j-1")).unwrap();
        assert!(!id.is_empty());
        assert_eq!(svc.count().unwrap(), 1);
    }

    #[test]
    fn test_log_simple() {
        let svc = make_service();
        let id = svc.log_simple("u-1", AuditAction::Delete, "part", "p-42").unwrap();
        assert!(!id.is_empty());
    }

    #[test]
    fn test_log_update_with_values() {
        let svc = make_service();
        let id = svc.log_update("u-1", "material", "m-1", r#"{"name":"Oak"}"#, r#"{"name":"Walnut"}"#).unwrap();
        let entry = svc.get_entry(&id).unwrap().unwrap();
        assert_eq!(entry.old_value.as_deref(), Some(r#"{"name":"Oak"}"#));
        assert_eq!(entry.new_value.as_deref(), Some(r#"{"name":"Walnut"}"#));
    }

    #[test]
    fn test_auto_generates_id() {
        let svc = make_service();
        let id = svc.log_action(sample_entry("u-1", AuditAction::Create, "job", "j-1")).unwrap();
        // Should be a valid UUID
        assert!(Uuid::parse_str(&id).is_ok());
    }

    #[test]
    fn test_preserves_custom_id() {
        let svc = make_service();
        let mut entry = sample_entry("u-1", AuditAction::Create, "job", "j-1");
        entry.id = "custom-id-123".into();
        let id = svc.log_action(entry).unwrap();
        assert_eq!(id, "custom-id-123");
    }

    // --- Validation ---

    #[test]
    fn test_reject_empty_user_id() {
        let svc = make_service();
        let entry = sample_entry("", AuditAction::Create, "job", "j-1");
        assert!(matches!(svc.log_action(entry), Err(AuditError::ValidationError(_))));
    }

    #[test]
    fn test_reject_empty_entity_type() {
        let svc = make_service();
        let entry = sample_entry("u-1", AuditAction::Create, "", "j-1");
        assert!(matches!(svc.log_action(entry), Err(AuditError::ValidationError(_))));
    }

    #[test]
    fn test_reject_empty_entity_id() {
        let svc = make_service();
        let entry = sample_entry("u-1", AuditAction::Create, "job", "");
        assert!(matches!(svc.log_action(entry), Err(AuditError::ValidationError(_))));
    }

    // --- Query by user ---

    #[test]
    fn test_query_by_user() {
        let svc = make_service();
        svc.log_simple("alice", AuditAction::Create, "job", "j-1").unwrap();
        svc.log_simple("bob", AuditAction::Create, "job", "j-2").unwrap();
        svc.log_simple("alice", AuditAction::Update, "job", "j-1").unwrap();

        let result = svc.query_logs(AuditQuery::by_user("alice")).unwrap();
        assert_eq!(result.total_count, 2);
        assert!(result.entries.iter().all(|e| e.user_id == "alice"));
    }

    // --- Query by entity ---

    #[test]
    fn test_query_by_entity() {
        let svc = make_service();
        svc.log_simple("u-1", AuditAction::Create, "job", "j-1").unwrap();
        svc.log_simple("u-1", AuditAction::Update, "job", "j-1").unwrap();
        svc.log_simple("u-1", AuditAction::Create, "part", "p-1").unwrap();

        let result = svc.query_logs(AuditQuery::by_entity("job", "j-1")).unwrap();
        assert_eq!(result.total_count, 2);
    }

    #[test]
    fn test_query_by_entity_type() {
        let svc = make_service();
        svc.log_simple("u-1", AuditAction::Create, "job", "j-1").unwrap();
        svc.log_simple("u-1", AuditAction::Create, "part", "p-1").unwrap();
        svc.log_simple("u-1", AuditAction::Create, "part", "p-2").unwrap();

        let result = svc.query_logs(AuditQuery::by_entity_type("part")).unwrap();
        assert_eq!(result.total_count, 2);
    }

    // --- Query by action ---

    #[test]
    fn test_query_by_action() {
        let svc = make_service();
        svc.log_simple("u-1", AuditAction::Create, "job", "j-1").unwrap();
        svc.log_simple("u-1", AuditAction::Delete, "job", "j-2").unwrap();
        svc.log_simple("u-1", AuditAction::Create, "part", "p-1").unwrap();

        let result = svc.query_logs(AuditQuery::by_action(AuditAction::Create)).unwrap();
        assert_eq!(result.total_count, 2);
    }

    // --- Query by date range ---

    #[test]
    fn test_query_by_date_range() {
        let svc = make_service();
        let now = Utc::now();

        let mut old_entry = sample_entry("u-1", AuditAction::Create, "job", "j-old");
        old_entry.timestamp = now - Duration::hours(48);
        svc.log_action(old_entry).unwrap();

        svc.log_simple("u-1", AuditAction::Create, "job", "j-new").unwrap();

        let start = now - Duration::hours(1);
        let end = now + Duration::hours(1);
        let result = svc.query_logs(AuditQuery::in_range(start, end)).unwrap();
        assert_eq!(result.total_count, 1);
        assert_eq!(result.entries[0].entity_id, "j-new");
    }

    // --- Query by IP ---

    #[test]
    fn test_query_by_ip() {
        let svc = make_service();
        let mut e1 = sample_entry("u-1", AuditAction::Create, "job", "j-1");
        e1.ip_address = Some("192.168.1.1".into());
        svc.log_action(e1).unwrap();

        let mut e2 = sample_entry("u-1", AuditAction::Create, "job", "j-2");
        e2.ip_address = Some("10.0.0.1".into());
        svc.log_action(e2).unwrap();

        let result = svc.query_logs(AuditQuery {
            ip_address: Some("192.168.1.1".into()),
            ..Default::default()
        }).unwrap();
        assert_eq!(result.total_count, 1);
    }

    // --- Pagination ---

    #[test]
    fn test_query_with_limit() {
        let svc = make_service();
        for i in 0..10 {
            svc.log_simple("u-1", AuditAction::Create, "job", &format!("j-{}", i)).unwrap();
        }

        let result = svc.query_logs(AuditQuery::default().with_limit(3)).unwrap();
        assert_eq!(result.entries.len(), 3);
        assert_eq!(result.total_count, 10);
    }

    #[test]
    fn test_query_with_offset() {
        let svc = make_service();
        for i in 0..5 {
            svc.log_simple("u-1", AuditAction::Create, "job", &format!("j-{}", i)).unwrap();
        }

        let result = svc.query_logs(AuditQuery::default().with_limit(2).with_offset(2)).unwrap();
        assert_eq!(result.entries.len(), 2);
        assert_eq!(result.offset, 2);
    }

    // --- Sort order ---

    #[test]
    fn test_results_sorted_newest_first() {
        let svc = make_service();
        let now = Utc::now();

        let mut e1 = sample_entry("u-1", AuditAction::Create, "job", "j-old");
        e1.timestamp = now - Duration::hours(2);
        svc.log_action(e1).unwrap();

        let mut e2 = sample_entry("u-1", AuditAction::Create, "job", "j-new");
        e2.timestamp = now;
        svc.log_action(e2).unwrap();

        let result = svc.query_logs(AuditQuery::default()).unwrap();
        assert_eq!(result.entries[0].entity_id, "j-new");
        assert_eq!(result.entries[1].entity_id, "j-old");
    }

    // --- Get entry ---

    #[test]
    fn test_get_entry_by_id() {
        let svc = make_service();
        let id = svc.log_simple("u-1", AuditAction::Create, "job", "j-1").unwrap();
        let entry = svc.get_entry(&id).unwrap().unwrap();
        assert_eq!(entry.user_id, "u-1");
        assert_eq!(entry.entity_id, "j-1");
    }

    #[test]
    fn test_get_nonexistent_entry() {
        let svc = make_service();
        assert!(svc.get_entry("nonexistent").unwrap().is_none());
    }

    // --- Metadata ---

    #[test]
    fn test_entry_with_metadata() {
        let svc = make_service();
        let mut entry = sample_entry("u-1", AuditAction::Export, "job", "j-1");
        entry.metadata.insert("format".into(), "gcode".into());
        entry.metadata.insert("machine".into(), "biesse".into());
        let id = svc.log_action(entry).unwrap();

        let loaded = svc.get_entry(&id).unwrap().unwrap();
        assert_eq!(loaded.metadata.get("format").unwrap(), "gcode");
        assert_eq!(loaded.metadata.get("machine").unwrap(), "biesse");
    }

    // --- IP and user agent ---

    #[test]
    fn test_entry_with_ip_and_user_agent() {
        let svc = make_service();
        let mut entry = sample_entry("u-1", AuditAction::Login, "session", "s-1");
        entry.ip_address = Some("203.0.113.50".into());
        entry.user_agent = Some("Mozilla/5.0".into());
        let id = svc.log_action(entry).unwrap();

        let loaded = svc.get_entry(&id).unwrap().unwrap();
        assert_eq!(loaded.ip_address.as_deref(), Some("203.0.113.50"));
        assert_eq!(loaded.user_agent.as_deref(), Some("Mozilla/5.0"));
    }

    // --- Middleware factory ---

    #[test]
    fn test_middleware_logs_post_as_create() {
        let svc = make_service();
        let middleware = svc.log_middleware_factory();

        let ctx = RequestContext {
            user_id: "u-1".into(),
            ip_address: "127.0.0.1".into(),
            user_agent: "test-agent".into(),
            method: "POST".into(),
            path: "/api/jobs".into(),
            status_code: 201,
        };

        let id = middleware(ctx).unwrap();
        assert!(!id.is_empty());

        let entry = svc.get_entry(&id).unwrap().unwrap();
        assert_eq!(entry.action, AuditAction::Create);
        assert_eq!(entry.entity_type, "http_request");
    }

    #[test]
    fn test_middleware_logs_delete() {
        let svc = make_service();
        let middleware = svc.log_middleware_factory();

        let ctx = RequestContext {
            user_id: "u-1".into(),
            ip_address: "127.0.0.1".into(),
            user_agent: "test-agent".into(),
            method: "DELETE".into(),
            path: "/api/jobs/j-1".into(),
            status_code: 204,
        };

        let id = middleware(ctx).unwrap();
        let entry = svc.get_entry(&id).unwrap().unwrap();
        assert_eq!(entry.action, AuditAction::Delete);
    }

    #[test]
    fn test_middleware_skips_get_by_default() {
        let svc = make_service();
        let middleware = svc.log_middleware_factory();

        let ctx = RequestContext {
            user_id: "u-1".into(),
            ip_address: "127.0.0.1".into(),
            user_agent: "test-agent".into(),
            method: "GET".into(),
            path: "/api/jobs".into(),
            status_code: 200,
        };

        let id = middleware(ctx).unwrap();
        assert!(id.is_empty()); // skipped
        assert_eq!(svc.count().unwrap(), 0);
    }

    #[test]
    fn test_middleware_logs_get_when_enabled() {
        let svc = AuditService::new().with_read_logging();
        let middleware = svc.log_middleware_factory();

        let ctx = RequestContext {
            user_id: "u-1".into(),
            ip_address: "127.0.0.1".into(),
            user_agent: "test".into(),
            method: "GET".into(),
            path: "/api/jobs".into(),
            status_code: 200,
        };

        let id = middleware(ctx).unwrap();
        assert!(!id.is_empty());
    }

    #[test]
    fn test_middleware_captures_http_metadata() {
        let svc = make_service();
        let middleware = svc.log_middleware_factory();

        let ctx = RequestContext {
            user_id: "u-1".into(),
            ip_address: "10.0.0.1".into(),
            user_agent: "curl/7.68".into(),
            method: "PUT".into(),
            path: "/api/parts/p-1".into(),
            status_code: 200,
        };

        let id = middleware(ctx).unwrap();
        let entry = svc.get_entry(&id).unwrap().unwrap();
        assert_eq!(entry.metadata.get("http_method").unwrap(), "PUT");
        assert_eq!(entry.metadata.get("http_path").unwrap(), "/api/parts/p-1");
        assert_eq!(entry.metadata.get("http_status").unwrap(), "200");
    }

    // --- Maintenance ---

    #[test]
    fn test_purge_before() {
        let svc = make_service();
        let now = Utc::now();

        let mut old = sample_entry("u-1", AuditAction::Create, "job", "j-old");
        old.timestamp = now - Duration::days(30);
        svc.log_action(old).unwrap();

        svc.log_simple("u-1", AuditAction::Create, "job", "j-new").unwrap();

        let purged = svc.purge_before(now - Duration::days(7)).unwrap();
        assert_eq!(purged, 1);
        assert_eq!(svc.count().unwrap(), 1);
    }

    #[test]
    fn test_clear() {
        let svc = make_service();
        svc.log_simple("u-1", AuditAction::Create, "job", "j-1").unwrap();
        svc.log_simple("u-1", AuditAction::Create, "job", "j-2").unwrap();
        svc.clear().unwrap();
        assert_eq!(svc.count().unwrap(), 0);
    }

    // --- Custom actions ---

    #[test]
    fn test_custom_action() {
        let svc = make_service();
        let id = svc.log_simple("u-1", AuditAction::Custom("nest_optimize".into()), "job", "j-1").unwrap();
        let entry = svc.get_entry(&id).unwrap().unwrap();
        assert_eq!(entry.action, AuditAction::Custom("nest_optimize".into()));
        assert_eq!(entry.action.as_str(), "nest_optimize");
    }

    // --- Thread safety ---

    #[test]
    fn test_concurrent_logging() {
        use std::thread;

        let svc = make_service();
        let svc_clone = svc.clone();

        let h1 = thread::spawn(move || {
            for i in 0..50 {
                svc_clone.log_simple("u-1", AuditAction::Create, "job", &format!("j-{}", i)).unwrap();
            }
        });

        for i in 50..100 {
            svc.log_simple("u-2", AuditAction::Create, "part", &format!("p-{}", i)).unwrap();
        }

        h1.join().unwrap();
        assert_eq!(svc.count().unwrap(), 100);
    }

    // --- AuditAction::as_str ---

    #[test]
    fn test_action_as_str() {
        assert_eq!(AuditAction::Create.as_str(), "create");
        assert_eq!(AuditAction::Read.as_str(), "read");
        assert_eq!(AuditAction::Update.as_str(), "update");
        assert_eq!(AuditAction::Delete.as_str(), "delete");
        assert_eq!(AuditAction::Login.as_str(), "login");
        assert_eq!(AuditAction::Export.as_str(), "export");
        assert_eq!(AuditAction::Archive.as_str(), "archive");
        assert_eq!(AuditAction::Restore.as_str(), "restore");
    }
}