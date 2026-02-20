import type { NotificationEvent } from '../types/index.js';

export interface WSConnection {
  id: string;
  orgId: string;
  events?: string[];
  send(data: string): void;
  close(): void;
}

export class WSHub {
  private connections = new Map<string, WSConnection>();
  private orgIndex = new Map<string, Set<string>>();

  addConnection(conn: WSConnection): void {
    this.connections.set(conn.id, conn);

    const orgConns = this.orgIndex.get(conn.orgId) ?? new Set();
    orgConns.add(conn.id);
    this.orgIndex.set(conn.orgId, orgConns);
  }

  removeConnection(connId: string): void {
    const conn = this.connections.get(connId);
    if (!conn) return;

    this.connections.delete(connId);

    const orgConns = this.orgIndex.get(conn.orgId);
    if (!orgConns) return;

    orgConns.delete(connId);
    if (orgConns.size === 0) {
      this.orgIndex.delete(conn.orgId);
    }
  }

  broadcast(event: NotificationEvent): void {
    const orgConns = this.orgIndex.get(event.orgId);
    if (!orgConns) return;

    const payload = JSON.stringify(event);

    for (const connId of orgConns) {
      const conn = this.connections.get(connId);
      if (!conn) continue;

      if (conn.events?.length && !conn.events.includes(event.type)) continue;

      try {
        conn.send(payload);
      } catch {
        this.removeConnection(connId);
      }
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getConnectionsByOrg(orgId: string): WSConnection[] {
    const orgConns = this.orgIndex.get(orgId);
    if (!orgConns) return [];

    const result: WSConnection[] = [];
    for (const connId of orgConns) {
      const conn = this.connections.get(connId);
      if (conn) result.push(conn);
    }
    return result;
  }
}
