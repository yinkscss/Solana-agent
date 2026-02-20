import type { WSHub } from '../services/ws-hub.service.js';
import type { WSConnection } from '../services/ws-hub.service.js';

export type WSUpgradeParams = {
  orgId: string;
  events?: string[];
};

export const createWSHandler = (hub: WSHub) => ({
  onOpen(ws: { send(data: string): void; close(): void }, params: WSUpgradeParams): WSConnection {
    const conn: WSConnection = {
      id: crypto.randomUUID(),
      orgId: params.orgId,
      events: params.events,
      send: (data: string) => ws.send(data),
      close: () => ws.close(),
    };

    hub.addConnection(conn);
    ws.send(JSON.stringify({ type: 'connected', connectionId: conn.id }));
    return conn;
  },

  onMessage(connId: string, data: string): void {
    try {
      const msg = JSON.parse(data) as { type?: string; events?: string[] };
      if (msg.type !== 'subscribe' || !Array.isArray(msg.events)) return;

      const conns = hub.getConnectionsByOrg('');
      const conn = conns.find((c) => c.id === connId);
      if (conn) {
        conn.events = msg.events;
      }
    } catch {
      // ignore malformed messages
    }
  },

  onClose(connId: string): void {
    hub.removeConnection(connId);
  },
});
