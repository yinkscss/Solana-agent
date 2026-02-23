'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';

interface WebSocketContextValue {
  connected: boolean;
  lastEvent: { type: string; data: unknown; timestamp: string } | null;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws';

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { connected, lastEvent } = useWebSocket(WS_URL, 'default');

  return (
    <WebSocketContext.Provider value={{ connected, lastEvent }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return ctx;
}
