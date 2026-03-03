/**
 * Feature 14: Realtime Propagation — React hook
 *
 * Provides a WebSocket connection with:
 *   - Exponential-backoff auto-reconnect
 *   - Subscribe / unsubscribe to entity IDs
 *   - Callback-based propagation update handling
 *   - Connection status tracking
 *   - Application-level ping / pong heartbeat
 *   - Clean unmount teardown
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export type ConnectionStatus =
  | "Connecting"
  | "Connected"
  | "Disconnected"
  | "Reconnecting";

/** Matches the server's PropagationUpdate payload. */
export interface PropagationUpdate {
  entity_type: string;
  entity_id: string;
  changes: Record<string, unknown>;
  timestamp: string;
}

/** Every JSON frame the server may send. */
export type ServerMessage =
  | { type: "subscribed"; entity_id: string }
  | { type: "unsubscribed"; entity_id: string }
  | { type: "propagation_update" } & PropagationUpdate
  | { type: "pong"; seq: number }
  | { type: "auth_result"; success: boolean; message: string }
  | { type: "rate_limit_exceeded"; retry_after_ms: number }
  | { type: "error"; code: number; message: string }
  | { type: "disconnect"; reason: string };

/** Every JSON frame we send to the server. */
export type ClientMessage =
  | { type: "subscribe"; entity_id: string }
  | { type: "unsubscribe"; entity_id: string }
  | { type: "ping"; seq: number }
  | { type: "auth"; token: string };

/** Options accepted by the hook. */
export interface UseRealtimePropagationOptions {
  /** WebSocket endpoint, e.g. "ws://localhost:8080/ws" */
  url: string;
  /** Called whenever a PropagationUpdate is received for any subscribed entity. */
  onUpdate?: (update: PropagationUpdate) => void;
  /** Called whenever the connection status changes. */
  onStatusChange?: (status: ConnectionStatus) => void;
  /** Optional auth token sent right after connecting. */
  authToken?: string;
  /** Base delay (ms) for exponential backoff. Default: 500 */
  reconnectBaseDelayMs?: number;
  /** Maximum delay cap (ms). Default: 30_000 */
  reconnectMaxDelayMs?: number;
  /** Maximum reconnection attempts (0 = unlimited). Default: 0 */
  maxReconnectAttempts?: number;
  /** Application-level ping interval (ms). Default: 25_000 */
  pingIntervalMs?: number;
}

/** Values returned by the hook. */
export interface UseRealtimePropagationReturn {
  /** Current connection state. */
  status: ConnectionStatus;
  /** Subscribe to propagation updates for the given entity ID. */
  subscribe: (entityId: string) => void;
  /** Unsubscribe from updates for the given entity ID. */
  unsubscribe: (entityId: string) => void;
  /** Set of entity IDs currently subscribed. */
  subscriptions: ReadonlySet<string>;
  /** Manually trigger a disconnect (will not auto-reconnect). */
  disconnect: () => void;
  /** Re-initiate connection if currently disconnected. */
  reconnect: () => void;
  /** Number of reconnection attempts since last clean connect. */
  reconnectAttempts: number;
}

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────

const DEFAULT_RECONNECT_BASE_DELAY_MS = 500;
const DEFAULT_RECONNECT_MAX_DELAY_MS = 30_000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 0; // unlimited
const DEFAULT_PING_INTERVAL_MS = 25_000;

// ─────────────────────────────────────────────
//  Backoff helper
// ─────────────────────────────────────────────

/**
 * Computes exponential backoff with full jitter:
 *   delay = random(0, min(cap, base * 2^attempt))
 */
export function computeBackoffDelay(
  attempt: number,
  baseMs: number,
  maxMs: number
): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxMs);
  return Math.floor(Math.random() * capped);
}

// ─────────────────────────────────────────────
//  Hook
// ─────────────────────────────────────────────

export function useRealtimePropagation(
  options: UseRealtimePropagationOptions
): UseRealtimePropagationReturn {
  const {
    url,
    onUpdate,
    onStatusChange,
    authToken,
    reconnectBaseDelayMs = DEFAULT_RECONNECT_BASE_DELAY_MS,
    reconnectMaxDelayMs = DEFAULT_RECONNECT_MAX_DELAY_MS,
    maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
    pingIntervalMs = DEFAULT_PING_INTERVAL_MS,
  } = options;

  const [status, setStatusState] = useState<ConnectionStatus>("Connecting");
  const [subscriptions, setSubscriptions] = useState<Set<string>>(new Set());
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Stable refs — never trigger re-renders
  const wsRef = useRef<WebSocket | null>(null);
  const statusRef = useRef<ConnectionStatus>("Connecting");
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingSeqRef = useRef(0);
  const manuallyDisconnectedRef = useRef(false);
  const subscriptionsRef = useRef<Set<string>>(new Set());
  const onUpdateRef = useRef(onUpdate);
  const onStatusChangeRef = useRef(onStatusChange);

  // Keep callback refs fresh without re-running the effect
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  // ── Status setter (updates both ref and state) ──

  const setStatus = useCallback((next: ConnectionStatus) => {
    statusRef.current = next;
    setStatusState(next);
    onStatusChangeRef.current?.(next);
  }, []);

  // ── Send helper ──

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  // ── Ping loop ──

  const startPingLoop = useCallback(() => {
    if (pingTimerRef.current) clearInterval(pingTimerRef.current);
    pingTimerRef.current = setInterval(() => {
      pingSeqRef.current += 1;
      send({ type: "ping", seq: pingSeqRef.current });
    }, pingIntervalMs);
  }, [pingIntervalMs, send]);

  const stopPingLoop = useCallback(() => {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  // ── Connect ──

  const connect = useCallback(() => {
    // Tear down any existing socket
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const isReconnect = reconnectAttemptsRef.current > 0;
    setStatus(isReconnect ? "Reconnecting" : "Connecting");

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      // URL parse error — schedule reconnect
      scheduleReconnect();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setReconnectAttempts(0);
      setStatus("Connected");

      // Authenticate if a token was supplied
      if (authToken) {
        send({ type: "auth", token: authToken });
      }

      // Re-subscribe to all previously tracked entities
      for (const entityId of subscriptionsRef.current) {
        send({ type: "subscribe", entity_id: entityId });
      }

      startPingLoop();
    };

    ws.onmessage = (event: MessageEvent) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data as string) as ServerMessage;
      } catch {
        return; // ignore malformed frames
      }

      switch (msg.type) {
        case "propagation_update":
          onUpdateRef.current?.({
            entity_type: msg.entity_type,
            entity_id: msg.entity_id,
            changes: msg.changes,
            timestamp: msg.timestamp,
          });
          break;

        case "subscribed":
          subscriptionsRef.current.add(msg.entity_id);
          setSubscriptions(new Set(subscriptionsRef.current));
          break;

        case "unsubscribed":
          subscriptionsRef.current.delete(msg.entity_id);
          setSubscriptions(new Set(subscriptionsRef.current));
          break;

        case "pong":
          // Heartbeat acknowledged — nothing else needed
          break;

        case "rate_limit_exceeded":
          // Could expose this via a callback if needed
          break;

        case "error":
          // Optionally surface via onError callback
          break;

        case "disconnect":
          ws.close();
          break;

        default:
          break;
      }
    };

    ws.onerror = () => {
      // onclose will fire right after onerror — let it handle reconnect
    };

    ws.onclose = () => {
      stopPingLoop();
      wsRef.current = null;

      if (manuallyDisconnectedRef.current) {
        setStatus("Disconnected");
        return;
      }

      scheduleReconnect();
    };
  }, [url, authToken, send, startPingLoop, stopPingLoop, setStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reconnect scheduler ──

  // Defined with useRef to avoid circular dependency with connect
  const scheduleReconnectRef = useRef<() => void>(() => {});

  const scheduleReconnect = useCallback(() => {
    scheduleReconnectRef.current();
  }, []);

  useEffect(() => {
    scheduleReconnectRef.current = () => {
      const attempt = reconnectAttemptsRef.current;

      if (
        maxReconnectAttempts > 0 &&
        attempt >= maxReconnectAttempts
      ) {
        setStatus("Disconnected");
        return;
      }

      reconnectAttemptsRef.current = attempt + 1;
      setReconnectAttempts(attempt + 1);
      setStatus("Reconnecting");

      const delay = computeBackoffDelay(
        attempt,
        reconnectBaseDelayMs,
        reconnectMaxDelayMs
      );

      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [
    connect,
    maxReconnectAttempts,
    reconnectBaseDelayMs,
    reconnectMaxDelayMs,
    setStatus,
  ]);

  // ── Initial connection ──

  useEffect(() => {
    manuallyDisconnectedRef.current = false;
    reconnectAttemptsRef.current = 0;
    connect();

    return () => {
      // Cleanup on unmount
      manuallyDisconnectedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      stopPingLoop();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [url]); // reconnect from scratch if URL changes

  // ── Public API ──

  const subscribe = useCallback(
    (entityId: string) => {
      subscriptionsRef.current.add(entityId);
      setSubscriptions(new Set(subscriptionsRef.current));
      send({ type: "subscribe", entity_id: entityId });
    },
    [send]
  );

  const unsubscribe = useCallback(
    (entityId: string) => {
      subscriptionsRef.current.delete(entityId);
      setSubscriptions(new Set(subscriptionsRef.current));
      send({ type: "unsubscribe", entity_id: entityId });
    },
    [send]
  );

  const disconnect = useCallback(() => {
    manuallyDisconnectedRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    stopPingLoop();
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("Disconnected");
  }, [stopPingLoop, setStatus]);

  const reconnect = useCallback(() => {
    if (statusRef.current !== "Disconnected") return;
    manuallyDisconnectedRef.current = false;
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
    connect();
  }, [connect]);

  return {
    status,
    subscribe,
    unsubscribe,
    subscriptions,
    disconnect,
    reconnect,
    reconnectAttempts,
  };
}
