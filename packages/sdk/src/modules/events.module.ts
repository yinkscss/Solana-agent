export type EventPayload = {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
};

export type EventHandler = (event: EventPayload) => void;

const ALL_EVENTS = '*';
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_BACKOFF_MS = 1000;

export class EventsModule {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<EventHandler>>();
  private reconnectAttempts = 0;
  private shouldReconnect = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly wsUrl: string,
    private readonly orgId: string,
  ) {}

  connect(): void {
    this.shouldReconnect = true;
    this.openSocket();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  on(eventType: string, handler: EventHandler): () => void {
    return this.addHandler(eventType, handler);
  }

  onAll(handler: EventHandler): () => void {
    return this.addHandler(ALL_EVENTS, handler);
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private openSocket(): void {
    const separator = this.wsUrl.includes('?') ? '&' : '?';
    const url = `${this.wsUrl}/ws${separator}orgId=${this.orgId}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(String(event.data)) as EventPayload;
        this.routeEvent(payload);
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;

    const backoff = BASE_BACKOFF_MS * 2 ** this.reconnectAttempts;
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, backoff);
  }

  private routeEvent(payload: EventPayload): void {
    const typed = this.handlers.get(payload.type);
    if (typed) {
      for (const handler of typed) {
        try { handler(payload); } catch { /* swallow handler errors */ }
      }
    }

    const wildcard = this.handlers.get(ALL_EVENTS);
    if (wildcard) {
      for (const handler of wildcard) {
        try { handler(payload); } catch { /* swallow handler errors */ }
      }
    }
  }

  private addHandler(key: string, handler: EventHandler): () => void {
    const set = this.handlers.get(key) ?? new Set();
    set.add(handler);
    this.handlers.set(key, set);

    return () => {
      set.delete(handler);
      if (set.size === 0) this.handlers.delete(key);
    };
  }
}
