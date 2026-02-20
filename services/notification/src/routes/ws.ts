import { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import type { WSHub } from '../services/ws-hub.service.js';
import type { WSConnection } from '../services/ws-hub.service.js';

const { upgradeWebSocket, websocket } = createBunWebSocket();

export { websocket };

export const createWSRoute = (hub: WSHub) => {
  const router = new Hono();

  router.get(
    '/',
    upgradeWebSocket((c) => {
      const orgId = c.req.query('orgId') ?? '';
      const eventsParam = c.req.query('events');
      const events = eventsParam ? eventsParam.split(',').filter(Boolean) : undefined;

      let conn: WSConnection | null = null;

      return {
        onOpen(_event, ws) {
          conn = {
            id: crypto.randomUUID(),
            orgId,
            events,
            send: (data: string) => ws.send(data),
            close: () => ws.close(),
          };

          hub.addConnection(conn);
          ws.send(JSON.stringify({ type: 'connected', connectionId: conn.id }));
        },

        onMessage(event) {
          if (!conn) return;

          try {
            const msg = JSON.parse(String(event.data)) as { type?: string; events?: string[] };
            if (msg.type === 'subscribe' && Array.isArray(msg.events)) {
              conn.events = msg.events;
            }
          } catch {
            // ignore malformed messages
          }
        },

        onClose() {
          if (conn) hub.removeConnection(conn.id);
        },
      };
    }),
  );

  return router;
};
