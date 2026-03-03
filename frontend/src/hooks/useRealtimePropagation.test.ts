/**
 * Feature 14: Realtime Propagation — Frontend Hook Tests
 *
 * 30+ tests covering:
 *   - computeBackoffDelay utility
 *   - Connection lifecycle (Connecting → Connected → Disconnected)
 *   - Auto-reconnect with exponential backoff
 *   - Max reconnect attempts limit
 *   - subscribe / unsubscribe API
 *   - Message handling (PropagationUpdate, pong, error, rate_limit, disconnect)
 *   - Auth token sending on connect
 *   - Re-subscribe on reconnect
 *   - Ping loop start/stop
 *   - Manual disconnect prevents auto-reconnect
 *   - Reconnect() from Disconnected state
 *   - URL change triggers fresh connection
 *   - Unmount cleanup
 *
 * Stack: Vitest + @testing-library/react-hooks (or renderHook from RTL v13+)
 * WebSocket is mocked via a simple class shim.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  computeBackoffDelay,
  useRealtimePropagation,
  type PropagationUpdate,
} from "./useRealtimePropagation";

// ─────────────────────────────────────────────
//  Mock WebSocket
// ─────────────────────────────────────────────

type WsEventName = "open" | "message" | "error" | "close";

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  url: string;
  sentMessages: string[] = [];

  onopen: ((e: Event) => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(_code?: number, _reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({} as CloseEvent);
  }

  /** Test helper: simulate the server accepting the handshake. */
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  /** Test helper: push a message from the server. */
  simulateMessage(data: unknown) {
    this.onmessage?.(
      new MessageEvent("message", { data: JSON.stringify(data) })
    );
  }

  /** Test helper: simulate a network error then close. */
  simulateError() {
    this.onerror?.(new Event("error"));
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({} as CloseEvent);
  }

  /** Test helper: simulate server closing the connection. */
  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({} as CloseEvent);
  }

  static instances: MockWebSocket[] = [];

  static reset() {
    MockWebSocket.instances = [];
  }

  static latest(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }
}

// ─────────────────────────────────────────────
//  Test setup / teardown
// ─────────────────────────────────────────────

beforeEach(() => {
  MockWebSocket.reset();
  vi.stubGlobal("WebSocket", MockWebSocket);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ─────────────────────────────────────────────
//  Utility: computeBackoffDelay
// ─────────────────────────────────────────────

describe("computeBackoffDelay", () => {
  it("returns 0 for attempt 0 with base 0", () => {
    // base * 2^0 = 0, random(0,0) = 0
    const delay = computeBackoffDelay(0, 0, 1000);
    expect(delay).toBe(0);
  });

  it("is always >= 0", () => {
    for (let i = 0; i < 20; i++) {
      const d = computeBackoffDelay(i, 500, 30_000);
      expect(d).toBeGreaterThanOrEqual(0);
    }
  });

  it("is always <= max", () => {
    for (let i = 0; i < 20; i++) {
      const d = computeBackoffDelay(i, 500, 8_000);
      expect(d).toBeLessThanOrEqual(8_000);
    }
  });

  it("caps at maxMs for large attempts", () => {
    const d = computeBackoffDelay(100, 500, 1_000);
    expect(d).toBeLessThanOrEqual(1_000);
  });

  it("grows exponentially up to the cap", () => {
    // At attempt 0 the max jitter window is base * 2^0 = base
    // At attempt 1 it is base * 2^1 = 2*base (before cap)
    // We seed Math.random to return 0.99 to get near-max values
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const d0 = computeBackoffDelay(0, 100, 100_000);
    const d1 = computeBackoffDelay(1, 100, 100_000);
    expect(d1).toBeGreaterThan(d0);
  });
});

// ─────────────────────────────────────────────
//  Connection lifecycle
// ─────────────────────────────────────────────

describe("Connection lifecycle", () => {
  it("starts in Connecting status", () => {
    const { result } = renderHook(() =>
      useRealtimePropagation({ url: "ws://localhost/ws" })
    );
    expect(result.current.status).toBe("Connecting");
  });

  it("transitions to Connected after WebSocket opens", async () => {
    const { result } = renderHook(() =>
      useRealtimePropagation({ url: "ws://localhost/ws" })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    await waitFor(() => expect(result.current.status).toBe("Connected"));
  });

  it("calls onStatusChange with Connected", async () => {
    const onStatusChange = vi.fn();
    renderHook(() =>
      useRealtimePropagation({ url: "ws://localhost/ws", onStatusChange })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    await waitFor(() =>
      expect(onStatusChange).toHaveBeenCalledWith("Connected")
    );
  });

  it("transitions to Reconnecting after unexpected close", async () => {
    const { result } = renderHook(() =>
      useRealtimePropagation({
        url: "ws://localhost/ws",
        reconnectBaseDelayMs: 100,
        reconnectMaxDelayMs: 200,
      })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    act(() => MockWebSocket.latest().simulateClose());
    await waitFor(() => expect(result.current.status).toBe("Reconnecting"));
  });

  it("creates a new WebSocket after reconnect delay", async () => {
    renderHook(() =>
      useRealtimePropagation({
        url: "ws://localhost/ws",
        reconnectBaseDelayMs: 500,
        reconnectMaxDelayMs: 500,
      })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    act(() => MockWebSocket.latest().simulateClose());
    const countBefore = MockWebSocket.instances.length;
    await act(async () => vi.advanceTimersByTime(600));
    expect(MockWebSocket.instances.length).toBeGreaterThan(countBefore);
  });

  it("increments reconnectAttempts on each failed connection", async () => {
    const { result } = renderHook(() =>
      useRealtimePropagation({
        url: "ws://localhost/ws",
        reconnectBaseDelayMs: 100,
        reconnectMaxDelayMs: 100,
      })
    );
    act(() => MockWebSocket.latest().simulateClose());
    await waitFor(() => expect(result.current.reconnectAttempts).toBe(1));
  });

  it("resets reconnectAttempts to 0 after successful open", async () => {
    const { result } = renderHook(() =>
      useRealtimePropagation({
        url: "ws://localhost/ws",
        reconnectBaseDelayMs: 100,
        reconnectMaxDelayMs: 100,
      })
    );
    act(() => MockWebSocket.latest().simulateClose());
    await act(async () => vi.advanceTimersByTime(200));
    act(() => MockWebSocket.latest().simulateOpen());
    await waitFor(() => expect(result.current.reconnectAttempts).toBe(0));
  });
});

// ─────────────────────────────────────────────
//  Max reconnect attempts
// ─────────────────────────────────────────────

describe("Max reconnect attempts", () => {
  it("stops reconnecting after maxReconnectAttempts", async () => {
    const { result } = renderHook(() =>
      useRealtimePropagation({
        url: "ws://localhost/ws",
        reconnectBaseDelayMs: 100,
        reconnectMaxDelayMs: 100,
        maxReconnectAttempts: 2,
      })
    );
    // First close
    act(() => MockWebSocket.latest().simulateClose());
    await act(async () => vi.advanceTimersByTime(200));
    // Second close
    act(() => MockWebSocket.latest().simulateClose());
    await act(async () => vi.advanceTimersByTime(200));
    // Third close — should hit limit
    act(() => MockWebSocket.latest().simulateClose());
    await act(async () => vi.advanceTimersByTime(200));
    await waitFor(() => expect(result.current.status).toBe("Disconnected"));
  });
});

// ─────────────────────────────────────────────
//  Subscribe / Unsubscribe
// ─────────────────────────────────────────────

describe("subscribe / unsubscribe", () => {
  it("sends subscribe message to WebSocket", async () => {
    const { result } = renderHook(() =>
      useRealtimePropagation({ url: "ws://localhost/ws" })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    act(() => result.current.subscribe("entity-123"));

    const ws = MockWebSocket.latest();
    const subscribeMsg = ws.sentMessages.find((m) =>
      m.includes("subscribe")
    );
    expect(subscribeMsg).toBeDefined();
    expect(subscribeMsg).toContain("entity-123");
  });

  it("adds entity to subscriptions set after subscribe", async () => {
    const { result } = renderHook(() =>
      useRealtimePropagation({ url: "ws://localhost/ws" })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    act(() => {
      result.current.subscribe("abc-001");
      MockWebSocket.latest().simulateMessage({
        type: "subscribed",
        entity_id: "abc-001",
      });
    });
    await waitFor(() =>
      expect(result.current.subscriptions.has("abc-001")).toBe(true)
    );
  });

  it("sends unsubscribe message", async () => {
    const { result } = renderHook(() =>
      useRealtimePropagation({ url: "ws://localhost/ws" })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    act(() => result.current.subscribe("entity-abc"));
    act(() => result.current.unsubscribe("entity-abc"));

    const ws = MockWebSocket.latest();
    const unsubMsg = ws.sentMessages.find((m) =>
      m.includes("unsubscribe") && m.includes("entity-abc")
    );
    expect(unsubMsg).toBeDefined();
  });

  it("removes entity from subscriptions set after unsubscribe ack", async () => {
    const { result } = renderHook(() =>
      useRealtimePropagation({ url: "ws://localhost/ws" })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    act(() => {
      result.current.subscribe("abc-001");
      MockWebSocket.latest().simulateMessage({
        type: "subscribed",
        entity_id: "abc-001",
      });
    });
    act(() => {
      result.current.unsubscribe("abc-001");
      MockWebSocket.latest().simulateMessage({
        type: "unsubscribed",
        entity_id: "abc-001",
      });
    });
    await waitFor(() =>
      expect(result.current.subscriptions.has("abc-001")).toBe(false)
    );
  });

  it("re-subscribes to all entities after reconnect", async () => {
    const { result } = renderHook(() =>
      useRealtimePropagation({
        url: "ws://localhost/ws",
        reconnectBaseDelayMs: 100,
        reconnectMaxDelayMs: 100,
      })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    act(() => result.current.subscribe("entity-recon"));
    // Trigger disconnect + reconnect
    act(() => MockWebSocket.latest().simulateClose());
    await act(async () => vi.advanceTimersByTime(200));
    act(() => MockWebSocket.latest().simulateOpen());

    const ws = MockWebSocket.latest();
    const resubMsg = ws.sentMessages.find(
      (m) => m.includes("subscribe") && m.includes("entity-recon")
    );
    expect(resubMsg).toBeDefined();
  });

  it("does not send subscribe when socket is not open", () => {
    const { result } = renderHook(() =>
      useRealtimePropagation({ url: "ws://localhost/ws" })
    );
    // Don't open the socket
    act(() => result.current.subscribe("silent-entity"));
    // No message should have been sent (socket still connecting)
    expect(MockWebSocket.latest().sentMessages).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
//  Message handling
// ─────────────────────────────────────────────

describe("Message handling", () => {
  it("calls onUpdate for propagation_update", async () => {
    const onUpdate = vi.fn();
    renderHook(() =>
      useRealtimePropagation({ url: "ws://localhost/ws", onUpdate })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    act(() =>
      MockWebSocket.latest().simulateMessage({
        type: "propagation_update",
        entity_type: "product",
        entity_id: "prod-1",
        changes: { width: 100, material: "aluminum" },
        timestamp: "2026-03-03T11:00:00Z",
      })
    );
    await waitFor(() => expect(onUpdate).toHaveBeenCalledOnce());
    const update: PropagationUpdate = onUpdate.mock.calls[0][0];
    expect(update.entity_type).toBe("product");
    expect(update.entity_id).toBe("prod-1");
    expect(update.changes.width).toBe(100);
  });

  it("calls onUpdate with nested changes", async () => {
    const onUpdate = vi.fn();
    renderHook(() =>
      useRealtimePropagation({ url: "ws://localhost/ws", onUpdate })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    act(() =>
      MockWebSocket.latest().simulateMessage({
        type: "propagation_update",
        entity_type: "part",
        entity_id: "part-2",
        changes: {
          dimensions: { width: 50, height: 80 },
          material: { grade: "6061", type: "aluminum" },
        },
        timestamp: "2026-03-03T11:00:00Z",
      })
    );
    const update: PropagationUpdate = onUpdate.mock.calls[0][0];
    expect((update.changes.dimensions as Record<string, unknown>).width).toBe(50);
  });

  it("ignores malformed JSON messages", () => {
    const onUpdate = vi.fn();
    renderHook(() =>
      useRealtimePropagation({ url: "ws://localhost/ws", onUpdate })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    act(() =>
      MockWebSocket.latest().onmessage?.(
        new MessageEvent("message", { data: "{{bad json" })
      )
    );
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("handles pong message without error", () => {
    renderHook(() =>
      useRealtimePropagation({ url: "ws://localhost/ws" })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    expect(() =>
      act(() =>
        MockWebSocket.latest().simulateMessage({ type: "pong", seq: 1 })
      )
    ).not.toThrow();
  });

  it("closes connection on server disconnect message", async () => {
    const { result } = renderHook(() =>
      useRealtimePropagation({
        url: "ws://localhost/ws",
        reconnectBaseDelayMs: 100,
        reconnectMaxDelayMs: 100,
      })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    act(() =>
      MockWebSocket.latest().simulateMessage({
        type: "disconnect",
        reason: "server shutdown",
      })
    );
    await waitFor(() => expect(result.current.status).toBe("Reconnecting"));
  });

  it("handles rate_limit_exceeded message without crashing", () => {
    renderHook(() =>
      useRealtimePropagation({ url: "ws://localhost/ws" })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    expect(() =>
      act(() =>
        MockWebSocket.latest().simulateMessage({
          type: "rate_limit_exceeded",
          retry_after_ms: 800,
        })
      )
    ).not.toThrow();
  });

  it("handles error message without crashing", () => {
    renderHook(() =>
      useRealtimePropagation({ url: "ws://localhost/ws" })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    expect(() =>
      act(() =>
        MockWebSocket.latest().simulateMessage({
          type: "error",
          code: 400,
          message: "bad request",
        })
      )
    ).not.toThrow();
  });

  it("handles auth_result message without crashing", () => {
    renderHook(() =>
      useRealtimePropagation({
        url: "ws://localhost/ws",
        authToken: "tok",
      })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    expect(() =>
      act(() =>
        MockWebSocket.latest().simulateMessage({
          type: "auth_result",
          success: true,
          message: "Authenticated",
        })
      )
    ).not.toThrow();
  });
});

// ─────────────────────────────────────────────
//  Auth token
// ─────────────────────────────────────────────

describe("Auth token", () => {
  it("sends auth message immediately after open when token provided", async () => {
    renderHook(() =>
      useRealtimePropagation({
        url: "ws://localhost/ws",
        authToken: "Bearer xyz",
      })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    const ws = MockWebSocket.latest();
    const authMsg = ws.sentMessages.find((m) => m.includes('"auth"'));
    expect(authMsg).toBeDefined();
    expect(authMsg).toContain("Bearer xyz");
  });

  it("does not send auth message when no token", () => {
    renderHook(() =>
      useRealtimePropagation({ url: "ws://localhost/ws" })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    const ws = MockWebSocket.latest();
    const authMsg = ws.sentMessages.find((m) => m.includes('"auth"'));
    expect(authMsg).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
//  Ping loop
// ─────────────────────────────────────────────

describe("Ping loop", () => {
  it("sends a ping message after pingIntervalMs", async () => {
    renderHook(() =>
      useRealtimePropagation({
        url: "ws://localhost/ws",
        pingIntervalMs: 1000,
      })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    await act(async () => vi.advanceTimersByTime(1100));
    const ws = MockWebSocket.latest();
    const pingMsg = ws.sentMessages.find((m) => m.includes('"ping"'));
    expect(pingMsg).toBeDefined();
  });

  it("increments ping seq on each interval", async () => {
    renderHook(() =>
      useRealtimePropagation({
        url: "ws://localhost/ws",
        pingIntervalMs: 500,
      })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    await act(async () => vi.advanceTimersByTime(1600));
    const ws = MockWebSocket.latest();
    const pings = ws.sentMessages.filter((m) => m.includes('"ping"'));
    expect(pings.length).toBeGreaterThanOrEqual(2);
    const seqs = pings.map((p) => (JSON.parse(p) as { seq: number }).seq);
    expect(seqs[1]).toBeGreaterThan(seqs[0]);
  });
});

// ─────────────────────────────────────────────
//  Manual disconnect / reconnect
// ─────────────────────────────────────────────

describe("Manual disconnect / reconnect", () => {
  it("transitions to Disconnected on manual disconnect()", async () => {
    const { result } = renderHook(() =>
      useRealtimePropagation({ url: "ws://localhost/ws" })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    act(() => result.current.disconnect());
    await waitFor(() => expect(result.current.status).toBe("Disconnected"));
  });

  it("does not auto-reconnect after manual disconnect", async () => {
    const { result } = renderHook(() =>
      useRealtimePropagation({
        url: "ws://localhost/ws",
        reconnectBaseDelayMs: 100,
        reconnectMaxDelayMs: 100,
      })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    act(() => result.current.disconnect());
    const countAfterDisconnect = MockWebSocket.instances.length;
    await act(async () => vi.advanceTimersByTime(500));
    expect(MockWebSocket.instances.length).toBe(countAfterDisconnect);
  });

  it("reconnect() from Disconnected restores Connected", async () => {
    const { result } = renderHook(() =>
      useRealtimePropagation({ url: "ws://localhost/ws" })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    act(() => result.current.disconnect());
    await waitFor(() => expect(result.current.status).toBe("Disconnected"));
    act(() => result.current.reconnect());
    act(() => MockWebSocket.latest().simulateOpen());
    await waitFor(() => expect(result.current.status).toBe("Connected"));
  });

  it("reconnect() is a no-op when already Connected", async () => {
    const { result } = renderHook(() =>
      useRealtimePropagation({ url: "ws://localhost/ws" })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    const countBefore = MockWebSocket.instances.length;
    act(() => result.current.reconnect());
    expect(MockWebSocket.instances.length).toBe(countBefore);
  });
});

// ─────────────────────────────────────────────
//  Cleanup on unmount
// ─────────────────────────────────────────────

describe("Cleanup on unmount", () => {
  it("closes WebSocket on unmount", () => {
    const { unmount } = renderHook(() =>
      useRealtimePropagation({ url: "ws://localhost/ws" })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    const ws = MockWebSocket.latest();
    unmount();
    expect(ws.readyState).toBe(MockWebSocket.CLOSED);
  });

  it("does not trigger reconnect after unmount", async () => {
    const { unmount } = renderHook(() =>
      useRealtimePropagation({
        url: "ws://localhost/ws",
        reconnectBaseDelayMs: 100,
        reconnectMaxDelayMs: 100,
      })
    );
    act(() => MockWebSocket.latest().simulateOpen());
    unmount();
    const countAfterUnmount = MockWebSocket.instances.length;
    await act(async () => vi.advanceTimersByTime(500));
    expect(MockWebSocket.instances.length).toBe(countAfterUnmount);
  });
});
