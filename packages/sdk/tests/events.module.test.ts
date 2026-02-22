import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventsModule } from "../src/modules/events.module.js";
import type { EventPayload } from "../src/modules/events.module.js";

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  url: string;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => this.onopen?.(), 0);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  simulateMessage(data: EventPayload) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

describe("EventsModule", () => {
  let originalWebSocket: typeof globalThis.WebSocket;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    (globalThis as any).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  it("constructs with wsUrl and orgId", () => {
    const events = new EventsModule("ws://localhost:3006", "org-1");
    expect(events).toBeDefined();
  });

  it("subscribes to specific event type", () => {
    const events = new EventsModule("ws://localhost:3006", "org-1");
    events.connect();

    const handler = vi.fn();
    events.on("transaction.confirmed", handler);

    const ws = (events as any).ws as MockWebSocket;
    ws.simulateMessage({
      type: "transaction.confirmed",
      data: { txId: "tx-1" },
      timestamp: new Date().toISOString(),
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: "transaction.confirmed" }),
    );

    events.disconnect();
  });

  it("does not call handler for non-matching event type", () => {
    const events = new EventsModule("ws://localhost:3006", "org-1");
    events.connect();

    const handler = vi.fn();
    events.on("policy.denied", handler);

    const ws = (events as any).ws as MockWebSocket;
    ws.simulateMessage({
      type: "transaction.confirmed",
      data: {},
      timestamp: new Date().toISOString(),
    });

    expect(handler).not.toHaveBeenCalled();

    events.disconnect();
  });

  it("onAll receives all event types", () => {
    const events = new EventsModule("ws://localhost:3006", "org-1");
    events.connect();

    const handler = vi.fn();
    events.onAll(handler);

    const ws = (events as any).ws as MockWebSocket;
    ws.simulateMessage({ type: "a", data: {}, timestamp: "" });
    ws.simulateMessage({ type: "b", data: {}, timestamp: "" });

    expect(handler).toHaveBeenCalledTimes(2);

    events.disconnect();
  });

  it("unsubscribe removes handler", () => {
    const events = new EventsModule("ws://localhost:3006", "org-1");
    events.connect();

    const handler = vi.fn();
    const unsub = events.on("test", handler);

    const ws = (events as any).ws as MockWebSocket;
    ws.simulateMessage({ type: "test", data: {}, timestamp: "" });
    expect(handler).toHaveBeenCalledOnce();

    unsub();
    ws.simulateMessage({ type: "test", data: {}, timestamp: "" });
    expect(handler).toHaveBeenCalledOnce();

    events.disconnect();
  });

  it("disconnect closes the websocket", () => {
    const events = new EventsModule("ws://localhost:3006", "org-1");
    events.connect();

    expect((events as any).ws).not.toBeNull();

    events.disconnect();

    expect((events as any).ws).toBeNull();
  });

  it("connects to correct URL with orgId", () => {
    const events = new EventsModule("ws://localhost:3006", "org-42");
    events.connect();

    const ws = (events as any).ws as MockWebSocket;
    expect(ws.url).toContain("orgId=org-42");
    expect(ws.url).toContain("/ws");

    events.disconnect();
  });

  it("handles malformed messages gracefully", () => {
    const events = new EventsModule("ws://localhost:3006", "org-1");
    events.connect();

    const handler = vi.fn();
    events.onAll(handler);

    const ws = (events as any).ws as MockWebSocket;
    ws.onmessage?.({ data: "not-json" });

    expect(handler).not.toHaveBeenCalled();

    events.disconnect();
  });

  it("handler errors do not propagate", () => {
    const events = new EventsModule("ws://localhost:3006", "org-1");
    events.connect();

    const badHandler = vi.fn(() => { throw new Error("handler crash"); });
    const goodHandler = vi.fn();
    events.on("test", badHandler);
    events.on("test", goodHandler);

    const ws = (events as any).ws as MockWebSocket;
    ws.simulateMessage({ type: "test", data: {}, timestamp: "" });

    expect(badHandler).toHaveBeenCalledOnce();
    expect(goodHandler).toHaveBeenCalledOnce();

    events.disconnect();
  });

  it("connected getter reflects WebSocket state", () => {
    const events = new EventsModule("ws://localhost:3006", "org-1");
    expect(events.connected).toBe(false);

    events.connect();
    expect(events.connected).toBe(true);

    events.disconnect();
    expect(events.connected).toBe(false);
  });
});
