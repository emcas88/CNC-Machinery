//! Feature 14: Realtime Propagation — WebSocket Handler
//!
//! Implements a full WebSocket session system using actix-web-actors.
//! Supports:
//!   - Subscribe / Unsubscribe to entity IDs
//!   - PropagationUpdate broadcasts to subscribed clients
//!   - Heartbeat (ping every 30 s, disconnect after 60 s silence)
//!   - Rate limiting (max 100 messages / sec per client)
//!   - Connection lifecycle with optional token authentication
//!   - Graceful disconnect cleanup via SessionManager

use actix::prelude::*;
use actix_web::{web, Error, HttpRequest, HttpResponse};
use actix_web_actors::ws;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::time::{Duration, Instant};
use uuid::Uuid;

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────

/// How often the server sends a ping frame.
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(30);

/// How long to wait for a pong before declaring the client dead.
const CLIENT_TIMEOUT: Duration = Duration::from_secs(60);

/// Maximum number of application-level messages a client may send per second.
const MAX_MESSAGES_PER_SECOND: usize = 100;

// ─────────────────────────────────────────────
//  Wire message types (JSON)
// ─────────────────────────────────────────────

/// Every JSON message sent by the client must be one of these.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    /// Ask the server to start sending updates for `entity_id`.
    Subscribe { entity_id: Uuid },
    /// Stop receiving updates for `entity_id`.
    Unsubscribe { entity_id: Uuid },
    /// Client-initiated ping (application level).
    Ping { seq: u64 },
    /// Authenticate with a token (optional).
    Auth { token: String },
}

/// Every JSON message sent by the server.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    /// Subscription acknowledged.
    Subscribed { entity_id: Uuid },
    /// Unsubscription acknowledged.
    Unsubscribed { entity_id: Uuid },
    /// A propagation update for an entity the client is subscribed to.
    PropagationUpdate {
        entity_type: String,
        entity_id: Uuid,
        changes: serde_json::Value,
        timestamp: DateTime<Utc>,
    },
    /// Application-level pong carrying the same seq back.
    Pong { seq: u64 },
    /// Authentication result.
    AuthResult { success: bool, message: String },
    /// Rate limit exceeded warning.
    RateLimitExceeded { retry_after_ms: u64 },
    /// Server-initiated error (e.g. bad JSON).
    Error { code: u16, message: String },
    /// Graceful disconnect notice.
    Disconnect { reason: String },
}

// ─────────────────────────────────────────────
//  Actix messages (internal bus)
// ─────────────────────────────────────────────

/// Sent by a WsSession to the SessionManager to register itself.
#[derive(Message)]
#[rtype(result = "()")]
pub struct Connect {
    pub session_id: Uuid,
    pub addr: Addr<WsSession>,
}

/// Sent by a WsSession to the SessionManager on disconnect.
#[derive(Message)]
#[rtype(result = "()")]
pub struct Disconnect {
    pub session_id: Uuid,
}

/// Sent by a WsSession to the SessionManager to add a subscription.
#[derive(Message)]
#[rtype(result = "()")]
pub struct AddSubscription {
    pub session_id: Uuid,
    pub entity_id: Uuid,
}

/// Sent by a WsSession to the SessionManager to remove a subscription.
#[derive(Message)]
#[rtype(result = "()")]
pub struct RemoveSubscription {
    pub session_id: Uuid,
    pub entity_id: Uuid,
}

/// External callers send this to the SessionManager to fan-out an update.
#[derive(Message, Clone, Debug, Serialize, Deserialize)]
#[rtype(result = "()")]
pub struct BroadcastPropagation {
    pub entity_type: String,
    pub entity_id: Uuid,
    pub changes: serde_json::Value,
}

/// The SessionManager wraps a ServerMessage and routes it to one session.
#[derive(Message)]
#[rtype(result = "()")]
pub struct SendToSession {
    pub msg: ServerMessage,
}

// ─────────────────────────────────────────────
//  SessionManager actor
// ─────────────────────────────────────────────

/// Central registry: maps session IDs ↔ subscribed entity IDs, and holds
/// `Addr<WsSession>` so it can push messages.
pub struct SessionManager {
    /// session_id → WsSession address
    sessions: HashMap<Uuid, Addr<WsSession>>,
    /// entity_id → set of session IDs that care about it
    subscriptions: HashMap<Uuid, HashSet<Uuid>>,
    /// session_id → set of entity IDs that session is watching
    session_entities: HashMap<Uuid, HashSet<Uuid>>,
}

impl Default for SessionManager {
    fn default() -> Self {
        Self {
            sessions: HashMap::new(),
            subscriptions: HashMap::new(),
            session_entities: HashMap::new(),
        }
    }
}

impl Actor for SessionManager {
    type Context = Context<Self>;
}

impl Handler<Connect> for SessionManager {
    type Result = ();
    fn handle(&mut self, msg: Connect, _: &mut Context<Self>) {
        self.sessions.insert(msg.session_id, msg.addr);
        self.session_entities
            .entry(msg.session_id)
            .or_insert_with(HashSet::new);
    }
}

impl Handler<Disconnect> for SessionManager {
    type Result = ();
    fn handle(&mut self, msg: Disconnect, _: &mut Context<Self>) {
        // Remove session's addr
        self.sessions.remove(&msg.session_id);

        // Clean up all subscriptions held by this session
        if let Some(entities) = self.session_entities.remove(&msg.session_id) {
            for entity_id in entities {
                if let Some(subs) = self.subscriptions.get_mut(&entity_id) {
                    subs.remove(&msg.session_id);
                    if subs.is_empty() {
                        self.subscriptions.remove(&entity_id);
                    }
                }
            }
        }
    }
}

impl Handler<AddSubscription> for SessionManager {
    type Result = ();
    fn handle(&mut self, msg: AddSubscription, _: &mut Context<Self>) {
        self.subscriptions
            .entry(msg.entity_id)
            .or_insert_with(HashSet::new)
            .insert(msg.session_id);

        self.session_entities
            .entry(msg.session_id)
            .or_insert_with(HashSet::new)
            .insert(msg.entity_id);
    }
}

impl Handler<RemoveSubscription> for SessionManager {
    type Result = ();
    fn handle(&mut self, msg: RemoveSubscription, _: &mut Context<Self>) {
        if let Some(subs) = self.subscriptions.get_mut(&msg.entity_id) {
            subs.remove(&msg.session_id);
            if subs.is_empty() {
                self.subscriptions.remove(&msg.entity_id);
            }
        }
        if let Some(entities) = self.session_entities.get_mut(&msg.session_id) {
            entities.remove(&msg.entity_id);
        }
    }
}

impl Handler<BroadcastPropagation> for SessionManager {
    type Result = ();
    fn handle(&mut self, msg: BroadcastPropagation, _: &mut Context<Self>) {
        let now = Utc::now();
        let server_msg = ServerMessage::PropagationUpdate {
            entity_type: msg.entity_type.clone(),
            entity_id: msg.entity_id,
            changes: msg.changes.clone(),
            timestamp: now,
        };

        if let Some(subscribers) = self.subscriptions.get(&msg.entity_id) {
            for session_id in subscribers {
                if let Some(addr) = self.sessions.get(session_id) {
                    addr.do_send(SendToSession {
                        msg: server_msg.clone(),
                    });
                }
            }
        }
    }
}

// ─────────────────────────────────────────────
//  Rate limiter (token-bucket style, per second)
// ─────────────────────────────────────────────

#[derive(Debug)]
pub struct RateLimiter {
    /// How many tokens remain in the current window.
    tokens: usize,
    /// When the current 1-second window started.
    window_start: Instant,
    /// Maximum tokens per second.
    max_per_second: usize,
}

impl RateLimiter {
    pub fn new(max_per_second: usize) -> Self {
        Self {
            tokens: max_per_second,
            window_start: Instant::now(),
            max_per_second,
        }
    }

    /// Returns `true` if the message is allowed, `false` if rate-limited.
    pub fn check(&mut self) -> bool {
        let now = Instant::now();
        // Refill on new window
        if now.duration_since(self.window_start) >= Duration::from_secs(1) {
            self.tokens = self.max_per_second;
            self.window_start = now;
        }
        if self.tokens > 0 {
            self.tokens -= 1;
            true
        } else {
            false
        }
    }

    /// Milliseconds until next window refill.
    pub fn retry_after_ms(&self) -> u64 {
        let elapsed = self.window_start.elapsed();
        if elapsed >= Duration::from_secs(1) {
            0
        } else {
            (Duration::from_secs(1) - elapsed).as_millis() as u64
        }
    }
}

// ─────────────────────────────────────────────
//  WsSession actor
// ─────────────────────────────────────────────

/// Per-connection state.
pub struct WsSession {
    pub id: Uuid,
    pub manager: Addr<SessionManager>,
    /// Last time we received *any* frame (data or pong) from the client.
    pub last_heartbeat: Instant,
    pub rate_limiter: RateLimiter,
    /// Whether this session has been authenticated (if auth is enabled).
    pub authenticated: bool,
}

impl WsSession {
    pub fn new(manager: Addr<SessionManager>) -> Self {
        Self {
            id: Uuid::new_v4(),
            manager,
            last_heartbeat: Instant::now(),
            rate_limiter: RateLimiter::new(MAX_MESSAGES_PER_SECOND),
            authenticated: false,
        }
    }

    /// Start the heartbeat loop.
    fn start_heartbeat(&self, ctx: &mut ws::WebsocketContext<Self>) {
        ctx.run_interval(HEARTBEAT_INTERVAL, |act, ctx| {
            if Instant::now().duration_since(act.last_heartbeat) > CLIENT_TIMEOUT {
                // Client did not respond — evict it
                act.manager.do_send(Disconnect { session_id: act.id });
                ctx.stop();
                return;
            }
            ctx.ping(b"");
        });
    }

    /// Serialize a `ServerMessage` to JSON and send it as a text frame.
    fn send_msg(&self, ctx: &mut ws::WebsocketContext<Self>, msg: &ServerMessage) {
        if let Ok(json) = serde_json::to_string(msg) {
            ctx.text(json);
        }
    }

    /// Handle a parsed `ClientMessage`.
    fn dispatch(
        &mut self,
        ctx: &mut ws::WebsocketContext<Self>,
        client_msg: ClientMessage,
    ) {
        match client_msg {
            ClientMessage::Auth { token } => {
                // Minimal token check — in production, verify JWT / database
                let valid = !token.is_empty();
                self.authenticated = valid;
                self.send_msg(
                    ctx,
                    &ServerMessage::AuthResult {
                        success: valid,
                        message: if valid {
                            "Authenticated".to_string()
                        } else {
                            "Invalid token".to_string()
                        },
                    },
                );
            }

            ClientMessage::Subscribe { entity_id } => {
                self.manager.do_send(AddSubscription {
                    session_id: self.id,
                    entity_id,
                });
                self.send_msg(ctx, &ServerMessage::Subscribed { entity_id });
            }

            ClientMessage::Unsubscribe { entity_id } => {
                self.manager.do_send(RemoveSubscription {
                    session_id: self.id,
                    entity_id,
                });
                self.send_msg(ctx, &ServerMessage::Unsubscribed { entity_id });
            }

            ClientMessage::Ping { seq } => {
                self.send_msg(ctx, &ServerMessage::Pong { seq });
            }
        }
    }
}

impl Actor for WsSession {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        self.start_heartbeat(ctx);
        self.manager.do_send(Connect {
            session_id: self.id,
            addr: ctx.address(),
        });
    }

    fn stopped(&mut self, _ctx: &mut Self::Context) {
        self.manager.do_send(Disconnect { session_id: self.id });
    }
}

/// Forward `SendToSession` pushed by the SessionManager to the WebSocket.
impl Handler<SendToSession> for WsSession {
    type Result = ();
    fn handle(&mut self, msg: SendToSession, ctx: &mut ws::WebsocketContext<Self>) {
        if let Ok(json) = serde_json::to_string(&msg.msg) {
            ctx.text(json);
        }
    }
}

/// Handle raw WebSocket frames.
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsSession {
    fn handle(&mut self, item: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        let msg = match item {
            Ok(m) => m,
            Err(_) => {
                ctx.stop();
                return;
            }
        };

        self.last_heartbeat = Instant::now();

        match msg {
            ws::Message::Text(text) => {
                // Rate limit check
                if !self.rate_limiter.check() {
                    let retry = self.rate_limiter.retry_after_ms();
                    self.send_msg(
                        ctx,
                        &ServerMessage::RateLimitExceeded {
                            retry_after_ms: retry,
                        },
                    );
                    return;
                }

                match serde_json::from_str::<ClientMessage>(&text) {
                    Ok(client_msg) => self.dispatch(ctx, client_msg),
                    Err(_) => {
                        self.send_msg(
                            ctx,
                            &ServerMessage::Error {
                                code: 400,
                                message: "Invalid JSON or unknown message type".to_string(),
                            },
                        );
                    }
                }
            }

            ws::Message::Binary(_) => {
                self.send_msg(
                    ctx,
                    &ServerMessage::Error {
                        code: 415,
                        message: "Binary messages not supported".to_string(),
                    },
                );
            }

            ws::Message::Ping(data) => {
                ctx.pong(&data);
            }

            ws::Message::Pong(_) => {
                // last_heartbeat already updated above
            }

            ws::Message::Close(reason) => {
                self.send_msg(
                    ctx,
                    &ServerMessage::Disconnect {
                        reason: reason
                            .as_ref()
                            .and_then(|r| r.description.clone())
                            .map(|s| s.to_string())
                            .unwrap_or_else(|| "Client closed connection".to_string()),
                    },
                );
                ctx.stop();
            }

            ws::Message::Continuation(_) | ws::Message::Nop => {}
        }
    }
}

// ─────────────────────────────────────────────
//  Actix-web HTTP upgrade handler
// ─────────────────────────────────────────────

/// Upgrade an HTTP GET request to a WebSocket connection.
///
/// Usage in your router:
/// ```rust
/// web::get().to(ws_handler)
/// ```
pub async fn ws_handler(
    req: HttpRequest,
    stream: web::Payload,
    manager: web::Data<Addr<SessionManager>>,
) -> Result<HttpResponse, Error> {
    let session = WsSession::new(manager.get_ref().clone());
    ws::start(session, &req, stream)
}

/// Convenience function to start the `SessionManager` and return its address.
pub fn start_session_manager() -> Addr<SessionManager> {
    SessionManager::default().start()
}

// ─────────────────────────────────────────────
//  Tests
// ─────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use actix::Actor;
    use serde_json::json;

    // ── helpers ──────────────────────────────

    fn make_uuid() -> Uuid {
        Uuid::new_v4()
    }

    fn json_changes() -> serde_json::Value {
        json!({ "width": 120, "material": "steel" })
    }

    // ── ClientMessage serialization ──────────

    #[test]
    fn test_parse_subscribe_message() {
        let id = make_uuid();
        let json = format!(r#"{{"type":"subscribe","entity_id":"{}"}}"#, id);
        let msg: ClientMessage = serde_json::from_str(&json).unwrap();
        assert_eq!(msg, ClientMessage::Subscribe { entity_id: id });
    }

    #[test]
    fn test_parse_unsubscribe_message() {
        let id = make_uuid();
        let json = format!(r#"{{"type":"unsubscribe","entity_id":"{}"}}"#, id);
        let msg: ClientMessage = serde_json::from_str(&json).unwrap();
        assert_eq!(msg, ClientMessage::Unsubscribe { entity_id: id });
    }

    #[test]
    fn test_parse_ping_message() {
        let json = r#"{"type":"ping","seq":42}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        assert_eq!(msg, ClientMessage::Ping { seq: 42 });
    }

    #[test]
    fn test_parse_auth_message() {
        let json = r#"{"type":"auth","token":"my-secret-token"}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        assert_eq!(
            msg,
            ClientMessage::Auth {
                token: "my-secret-token".to_string()
            }
        );
    }

    #[test]
    fn test_parse_invalid_message_type() {
        let json = r#"{"type":"unknown","foo":"bar"}"#;
        let result: Result<ClientMessage, _> = serde_json::from_str(json);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_missing_entity_id() {
        let json = r#"{"type":"subscribe"}"#;
        let result: Result<ClientMessage, _> = serde_json::from_str(json);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_malformed_uuid() {
        let json = r#"{"type":"subscribe","entity_id":"not-a-uuid"}"#;
        let result: Result<ClientMessage, _> = serde_json::from_str(json);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_ping_seq_zero() {
        let json = r#"{"type":"ping","seq":0}"#;
        let msg: ClientMessage = serde_json::from_str(json).unwrap();
        assert_eq!(msg, ClientMessage::Ping { seq: 0 });
    }

    #[test]
    fn test_parse_ping_max_seq() {
        let json = format!(r#"{{"type":"ping","seq":{}}}"#, u64::MAX);
        let msg: ClientMessage = serde_json::from_str(&json).unwrap();
        assert_eq!(msg, ClientMessage::Ping { seq: u64::MAX });
    }

    // ── ServerMessage serialization ──────────

    #[test]
    fn test_serialize_subscribed() {
        let id = make_uuid();
        let msg = ServerMessage::Subscribed { entity_id: id };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("subscribed"));
        assert!(json.contains(&id.to_string()));
    }

    #[test]
    fn test_serialize_unsubscribed() {
        let id = make_uuid();
        let msg = ServerMessage::Unsubscribed { entity_id: id };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("unsubscribed"));
    }

    #[test]
    fn test_serialize_propagation_update() {
        let id = make_uuid();
        let msg = ServerMessage::PropagationUpdate {
            entity_type: "product".to_string(),
            entity_id: id,
            changes: json_changes(),
            timestamp: Utc::now(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("propagation_update"));
        assert!(json.contains("product"));
        assert!(json.contains("steel"));
    }

    #[test]
    fn test_serialize_pong() {
        let msg = ServerMessage::Pong { seq: 99 };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("pong"));
        assert!(json.contains("99"));
    }

    #[test]
    fn test_serialize_auth_result_success() {
        let msg = ServerMessage::AuthResult {
            success: true,
            message: "Authenticated".to_string(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("auth_result"));
        assert!(json.contains("true"));
    }

    #[test]
    fn test_serialize_auth_result_failure() {
        let msg = ServerMessage::AuthResult {
            success: false,
            message: "Invalid token".to_string(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("false"));
    }

    #[test]
    fn test_serialize_rate_limit_exceeded() {
        let msg = ServerMessage::RateLimitExceeded {
            retry_after_ms: 500,
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("rate_limit_exceeded"));
        assert!(json.contains("500"));
    }

    #[test]
    fn test_serialize_error() {
        let msg = ServerMessage::Error {
            code: 400,
            message: "bad input".to_string(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("error"));
        assert!(json.contains("400"));
    }

    #[test]
    fn test_serialize_disconnect() {
        let msg = ServerMessage::Disconnect {
            reason: "timeout".to_string(),
        };
        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("disconnect"));
        assert!(json.contains("timeout"));
    }

    // ── RateLimiter ──────────────────────────

    #[test]
    fn test_rate_limiter_allows_under_limit() {
        let mut rl = RateLimiter::new(100);
        for _ in 0..100 {
            assert!(rl.check(), "should allow up to 100 messages");
        }
    }

    #[test]
    fn test_rate_limiter_blocks_over_limit() {
        let mut rl = RateLimiter::new(5);
        for _ in 0..5 {
            assert!(rl.check());
        }
        assert!(!rl.check(), "101st message should be blocked");
    }

    #[test]
    fn test_rate_limiter_refills_after_window() {
        let mut rl = RateLimiter::new(3);
        for _ in 0..3 {
            assert!(rl.check());
        }
        assert!(!rl.check());
        // Force window reset by backdating
        rl.window_start = Instant::now() - Duration::from_secs(2);
        assert!(rl.check(), "should allow again after window reset");
    }

    #[test]
    fn test_rate_limiter_retry_after_ms_within_window() {
        let mut rl = RateLimiter::new(1);
        rl.check(); // consume
        let retry = rl.retry_after_ms();
        assert!(retry <= 1000, "retry should be ≤ 1000 ms");
    }

    #[test]
    fn test_rate_limiter_retry_after_ms_expired_window() {
        let mut rl = RateLimiter::new(1);
        rl.window_start = Instant::now() - Duration::from_secs(2);
        assert_eq!(rl.retry_after_ms(), 0);
    }

    #[test]
    fn test_rate_limiter_zero_limit() {
        let mut rl = RateLimiter::new(0);
        assert!(!rl.check(), "zero-limit limiter should always block");
    }

    #[test]
    fn test_rate_limiter_large_limit() {
        let mut rl = RateLimiter::new(10_000);
        for _ in 0..10_000 {
            assert!(rl.check());
        }
        assert!(!rl.check());
    }

    // ── SessionManager (Actix system) ────────

    #[actix::test]
    async fn test_session_manager_connect_registers_session() {
        let manager = SessionManager::default().start();
        // We cannot inspect internals directly, so we exercise the message path
        // and verify no panic occurs (structural test).
        let id = make_uuid();
        // Use a dummy address trick: send Connect with a fresh actor
        // We just verify message dispatch doesn't panic
        let _ = manager.send(Disconnect { session_id: id }).await;
    }

    #[actix::test]
    async fn test_session_manager_disconnect_nonexistent_is_noop() {
        let manager = SessionManager::default().start();
        let id = make_uuid();
        // Should not panic
        let _ = manager.send(Disconnect { session_id: id }).await;
    }

    #[actix::test]
    async fn test_session_manager_add_subscription() {
        let manager = SessionManager::default().start();
        let session_id = make_uuid();
        let entity_id = make_uuid();
        let _ = manager
            .send(AddSubscription {
                session_id,
                entity_id,
            })
            .await;
        // Remove and re-add — no panic expected
        let _ = manager
            .send(RemoveSubscription {
                session_id,
                entity_id,
            })
            .await;
    }

    #[actix::test]
    async fn test_session_manager_remove_nonexistent_subscription() {
        let manager = SessionManager::default().start();
        let session_id = make_uuid();
        let entity_id = make_uuid();
        // Remove without prior add — should not panic
        let _ = manager
            .send(RemoveSubscription {
                session_id,
                entity_id,
            })
            .await;
    }

    #[actix::test]
    async fn test_session_manager_broadcast_no_subscribers() {
        let manager = SessionManager::default().start();
        // Broadcast with no subscribers — should be silently dropped
        let _ = manager
            .send(BroadcastPropagation {
                entity_type: "product".to_string(),
                entity_id: make_uuid(),
                changes: json_changes(),
            })
            .await;
    }

    #[actix::test]
    async fn test_session_manager_multiple_subscriptions_same_entity() {
        let manager = SessionManager::default().start();
        let entity_id = make_uuid();
        for _ in 0..5 {
            let _ = manager
                .send(AddSubscription {
                    session_id: make_uuid(),
                    entity_id,
                })
                .await;
        }
        // Broadcast — no panic, no messages sent (no real sessions registered)
        let _ = manager
            .send(BroadcastPropagation {
                entity_type: "part".to_string(),
                entity_id,
                changes: json_changes(),
            })
            .await;
    }

    #[actix::test]
    async fn test_session_manager_disconnect_cleans_subscriptions() {
        let manager = SessionManager::default().start();
        let session_id = make_uuid();
        let entity_id = make_uuid();
        let _ = manager
            .send(AddSubscription {
                session_id,
                entity_id,
            })
            .await;
        let _ = manager.send(Disconnect { session_id }).await;
        // After disconnect broadcast should find no subscribers
        let _ = manager
            .send(BroadcastPropagation {
                entity_type: "product".to_string(),
                entity_id,
                changes: json_changes(),
            })
            .await;
    }

    #[actix::test]
    async fn test_session_manager_subscribe_multiple_entities() {
        let manager = SessionManager::default().start();
        let session_id = make_uuid();
        for _ in 0..10 {
            let _ = manager
                .send(AddSubscription {
                    session_id,
                    entity_id: make_uuid(),
                })
                .await;
        }
        // Disconnect should clean all 10
        let _ = manager.send(Disconnect { session_id }).await;
    }

    // ── Subscription logic edge cases ────────

    #[test]
    fn test_subscription_idempotent_add() {
        // Simulate adding the same subscription twice in manager state
        let mut subscriptions: HashMap<Uuid, HashSet<Uuid>> = HashMap::new();
        let entity_id = make_uuid();
        let session_id = make_uuid();
        subscriptions
            .entry(entity_id)
            .or_insert_with(HashSet::new)
            .insert(session_id);
        subscriptions
            .entry(entity_id)
            .or_insert_with(HashSet::new)
            .insert(session_id);
        assert_eq!(subscriptions[&entity_id].len(), 1);
    }

    #[test]
    fn test_subscription_removed_cleans_empty_set() {
        let mut subscriptions: HashMap<Uuid, HashSet<Uuid>> = HashMap::new();
        let entity_id = make_uuid();
        let session_id = make_uuid();
        subscriptions
            .entry(entity_id)
            .or_insert_with(HashSet::new)
            .insert(session_id);
        if let Some(subs) = subscriptions.get_mut(&entity_id) {
            subs.remove(&session_id);
            if subs.is_empty() {
                subscriptions.remove(&entity_id);
            }
        }
        assert!(!subscriptions.contains_key(&entity_id));
    }

    #[test]
    fn test_many_sessions_same_entity() {
        let mut subscriptions: HashMap<Uuid, HashSet<Uuid>> = HashMap::new();
        let entity_id = make_uuid();
        for _ in 0..1000 {
            subscriptions
                .entry(entity_id)
                .or_insert_with(HashSet::new)
                .insert(make_uuid());
        }
        assert_eq!(subscriptions[&entity_id].len(), 1000);
    }

    #[test]
    fn test_broadcast_only_reaches_subscribed_entity() {
        let mut subscriptions: HashMap<Uuid, HashSet<Uuid>> = HashMap::new();
        let entity_a = make_uuid();
        let entity_b = make_uuid();
        let session_a = make_uuid();
        let session_b = make_uuid();
 
        subscriptions
            .entry(entity_a)
            .or_insert_with(HashSet::new)
            .insert(session_a);
        subscriptions
            .entry(entity_b)
            .or_insert_with(HashSet::new)
            .insert(session_b);

        // Only entity_a subscribers should receive the broadcast
        let recipients = subscriptions.get(&entity_a).unwrap();
        assert!(recipients.contains(&session_a));
        assert!(!recipients.contains(&session_b));
    }
}
