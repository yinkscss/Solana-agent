import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp } from '../src/app';
import type { LLMProvider, LLMResponse } from '../src/llm/provider.interface';

const textResponse: LLMResponse = {
  content: 'Hello!',
  finishReason: 'stop',
  usage: { promptTokens: 10, completionTokens: 5 },
};

describe('Agent Routes', () => {
  let app: ReturnType<typeof createApp>['app'];
  let mockProvider: LLMProvider;

  beforeEach(() => {
    mockProvider = { name: 'mock', chat: vi.fn().mockResolvedValue(textResponse) };
    const result = createApp({ providerFactory: () => mockProvider });
    app = result.app;
  });

  const req = (method: string, path: string, body?: unknown) =>
    new Request(`http://localhost${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });

  const json = async (res: Response) => res.json() as Promise<Record<string, unknown>>;

  describe('GET /health', () => {
    it('returns ok', async () => {
      const res = await app.fetch(req('GET', '/health'));
      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data.status).toBe('ok');
      expect(data.service).toBe('agent-runtime');
    });
  });

  describe('POST /api/v1/agents', () => {
    it('creates an agent', async () => {
      const res = await app.fetch(req('POST', '/api/v1/agents', {
        orgId: 'org-1',
        walletId: 'w-1',
        name: 'My Agent',
        systemPrompt: 'You are helpful.',
      }));
      expect(res.status).toBe(201);
      const data = await json(res);
      expect((data.data as Record<string, unknown>).name).toBe('My Agent');
      expect((data.data as Record<string, unknown>).status).toBe('created');
    });

    it('validates required fields', async () => {
      const res = await app.fetch(req('POST', '/api/v1/agents', { name: 'No prompt' }));
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/agents/:agentId', () => {
    it('returns an agent', async () => {
      const createRes = await app.fetch(req('POST', '/api/v1/agents', {
        orgId: 'org-1',
        walletId: 'w-1',
        name: 'Agent X',
        systemPrompt: 'test',
      }));
      const created = (await json(createRes)).data as Record<string, string>;

      const res = await app.fetch(req('GET', `/api/v1/agents/${created.id}`));
      expect(res.status).toBe(200);
      const data = await json(res);
      expect((data.data as Record<string, unknown>).id).toBe(created.id);
    });

    it('returns 404 for missing agent', async () => {
      const res = await app.fetch(req('GET', '/api/v1/agents/nonexistent'));
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/agents/:agentId/start', () => {
    it('starts an agent', async () => {
      const createRes = await app.fetch(req('POST', '/api/v1/agents', {
        orgId: 'org-1',
        walletId: 'w-1',
        name: 'Agent S',
        systemPrompt: 'test',
      }));
      const created = (await json(createRes)).data as Record<string, string>;

      const res = await app.fetch(req('POST', `/api/v1/agents/${created.id}/start`));
      expect(res.status).toBe(200);
      const data = await json(res);
      expect((data.data as Record<string, unknown>).status).toBe('running');
    });
  });

  describe('POST /api/v1/agents/:agentId/execute', () => {
    it('executes a running agent', async () => {
      const createRes = await app.fetch(req('POST', '/api/v1/agents', {
        orgId: 'org-1',
        walletId: 'w-1',
        name: 'Runner',
        systemPrompt: 'You are helpful.',
        tools: [],
      }));
      const created = (await json(createRes)).data as Record<string, string>;
      await app.fetch(req('POST', `/api/v1/agents/${created.id}/start`));

      const res = await app.fetch(req('POST', `/api/v1/agents/${created.id}/execute`, {
        message: 'Hello',
      }));
      expect(res.status).toBe(200);
      const data = await json(res);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('rejects execution for non-running agent', async () => {
      const createRes = await app.fetch(req('POST', '/api/v1/agents', {
        orgId: 'org-1',
        walletId: 'w-1',
        name: 'Idle',
        systemPrompt: 'test',
      }));
      const created = (await json(createRes)).data as Record<string, string>;

      const res = await app.fetch(req('POST', `/api/v1/agents/${created.id}/execute`, {
        message: 'Hello',
      }));
      expect(res.status).toBe(409);
    });
  });

  describe('lifecycle routes', () => {
    it('full lifecycle: create → start → pause → stop → destroy', async () => {
      const createRes = await app.fetch(req('POST', '/api/v1/agents', {
        orgId: 'org-1',
        walletId: 'w-1',
        name: 'Lifecycle Agent',
        systemPrompt: 'test',
      }));
      const created = (await json(createRes)).data as Record<string, string>;
      const id = created.id;

      let res = await app.fetch(req('POST', `/api/v1/agents/${id}/start`));
      expect((await json(res)).data).toHaveProperty('status', 'running');

      res = await app.fetch(req('POST', `/api/v1/agents/${id}/pause`));
      expect((await json(res)).data).toHaveProperty('status', 'paused');

      res = await app.fetch(req('POST', `/api/v1/agents/${id}/stop`));
      expect((await json(res)).data).toHaveProperty('status', 'stopped');

      res = await app.fetch(req('DELETE', `/api/v1/agents/${id}`));
      expect((await json(res)).data).toHaveProperty('status', 'destroyed');
    });
  });

  describe('GET /api/v1/orgs/:orgId/agents', () => {
    it('lists agents for org', async () => {
      await app.fetch(req('POST', '/api/v1/agents', {
        orgId: 'org-list',
        walletId: 'w-1',
        name: 'Agent L1',
        systemPrompt: 'test',
      }));
      await app.fetch(req('POST', '/api/v1/agents', {
        orgId: 'org-list',
        walletId: 'w-2',
        name: 'Agent L2',
        systemPrompt: 'test',
      }));

      const res = await app.fetch(req('GET', '/api/v1/orgs/org-list/agents'));
      expect(res.status).toBe(200);
      const data = await json(res);
      expect(data.total).toBe(2);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });
});
