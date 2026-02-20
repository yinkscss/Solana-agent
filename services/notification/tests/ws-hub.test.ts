import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WSHub } from '../src/services/ws-hub.service.js';
import type { WSConnection } from '../src/services/ws-hub.service.js';
import type { NotificationEvent } from '../src/types/index.js';

const makeConn = (overrides: Partial<WSConnection> = {}): WSConnection => ({
  id: crypto.randomUUID(),
  orgId: 'org-1',
  send: vi.fn(),
  close: vi.fn(),
  ...overrides,
});

const makeEvent = (overrides: Partial<NotificationEvent> = {}): NotificationEvent => ({
  type: 'transaction.confirmed',
  orgId: 'org-1',
  data: { txId: 'tx-123' },
  timestamp: new Date().toISOString(),
  ...overrides,
});

describe('WSHub', () => {
  let hub: WSHub;

  beforeEach(() => {
    hub = new WSHub();
  });

  it('tracks connection count', () => {
    expect(hub.getConnectionCount()).toBe(0);
    hub.addConnection(makeConn());
    expect(hub.getConnectionCount()).toBe(1);
  });

  it('removes connections', () => {
    const conn = makeConn();
    hub.addConnection(conn);
    hub.removeConnection(conn.id);
    expect(hub.getConnectionCount()).toBe(0);
  });

  it('removing nonexistent connection is a no-op', () => {
    hub.removeConnection('nope');
    expect(hub.getConnectionCount()).toBe(0);
  });

  it('broadcasts to connections in the same org', () => {
    const conn1 = makeConn({ orgId: 'org-1' });
    const conn2 = makeConn({ orgId: 'org-2' });
    hub.addConnection(conn1);
    hub.addConnection(conn2);

    hub.broadcast(makeEvent({ orgId: 'org-1' }));

    expect(conn1.send).toHaveBeenCalledOnce();
    expect(conn2.send).not.toHaveBeenCalled();
  });

  it('filters by event type when subscribed', () => {
    const conn = makeConn({ events: ['transaction.confirmed'] });
    hub.addConnection(conn);

    hub.broadcast(makeEvent({ type: 'policy.denied' }));
    expect(conn.send).not.toHaveBeenCalled();

    hub.broadcast(makeEvent({ type: 'transaction.confirmed' }));
    expect(conn.send).toHaveBeenCalledOnce();
  });

  it('sends all events when no event filter', () => {
    const conn = makeConn({ events: undefined });
    hub.addConnection(conn);

    hub.broadcast(makeEvent({ type: 'any.event' }));
    expect(conn.send).toHaveBeenCalledOnce();
  });

  it('returns connections by org', () => {
    const c1 = makeConn({ orgId: 'org-A' });
    const c2 = makeConn({ orgId: 'org-A' });
    const c3 = makeConn({ orgId: 'org-B' });
    hub.addConnection(c1);
    hub.addConnection(c2);
    hub.addConnection(c3);

    expect(hub.getConnectionsByOrg('org-A')).toHaveLength(2);
    expect(hub.getConnectionsByOrg('org-B')).toHaveLength(1);
    expect(hub.getConnectionsByOrg('org-C')).toHaveLength(0);
  });

  it('removes connection on send failure', () => {
    const conn = makeConn();
    (conn.send as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('connection closed');
    });

    hub.addConnection(conn);
    hub.broadcast(makeEvent());

    expect(hub.getConnectionCount()).toBe(0);
  });

  it('cleans up org index when last connection removed', () => {
    const conn = makeConn({ orgId: 'org-1' });
    hub.addConnection(conn);
    hub.removeConnection(conn.id);
    expect(hub.getConnectionsByOrg('org-1')).toHaveLength(0);
  });
});
