"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface UseWebSocketOptions {
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
}

interface WebSocketEvent {
  type: string;
  data: unknown;
  timestamp: string;
}

const DEFAULT_OPTIONS: Required<UseWebSocketOptions> = {
  maxRetries: 10,
  initialBackoffMs: 1000,
  maxBackoffMs: 30000,
};

export function useWebSocket(
  url: string,
  orgId: string,
  options?: UseWebSocketOptions
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const backoffRef = useRef(opts.initialBackoffMs);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (unmountedRef.current || !url) return;

    try {
      const wsUrl = `${url}?orgId=${encodeURIComponent(orgId)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmountedRef.current) return;
        setConnected(true);
        retriesRef.current = 0;
        backoffRef.current = opts.initialBackoffMs;
      };

      ws.onmessage = (event) => {
        if (unmountedRef.current) return;
        try {
          const parsed = JSON.parse(event.data) as WebSocketEvent;
          setLastEvent(parsed);
        } catch {
          setLastEvent({
            type: "raw",
            data: event.data,
            timestamp: new Date().toISOString(),
          });
        }
      };

      ws.onclose = () => {
        if (unmountedRef.current) return;
        setConnected(false);
        wsRef.current = null;

        if (retriesRef.current < opts.maxRetries) {
          const delay = Math.min(backoffRef.current, opts.maxBackoffMs);
          reconnectTimerRef.current = setTimeout(() => {
            retriesRef.current += 1;
            backoffRef.current = Math.min(delay * 2, opts.maxBackoffMs);
            connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      setConnected(false);
    }
  }, [url, orgId, opts.initialBackoffMs, opts.maxRetries, opts.maxBackoffMs]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      clearReconnectTimer();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, clearReconnectTimer]);

  return { connected, lastEvent };
}
