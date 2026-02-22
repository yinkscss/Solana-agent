import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  scenarios: {
    agent_lifecycle: {
      executor: 'per-vu-iterations',
      vus: 20,
      iterations: 5,
      maxDuration: '5m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'test-api-key';

const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
};

export default function () {
  let agentId;

  group('create agent', () => {
    const res = http.post(
      `${BASE_URL}/api/v1/agents`,
      JSON.stringify({
        name: `load-agent-${__VU}-${__ITER}`,
        model: 'gpt-4',
        systemPrompt: 'You are a helpful trading assistant.',
      }),
      { headers },
    );
    check(res, { 'agent created': (r) => r.status === 200 || r.status === 201 });
    if (res.status === 200 || res.status === 201) {
      agentId = res.json('id');
    }
  });

  if (!agentId) return;

  group('start agent', () => {
    const res = http.post(`${BASE_URL}/api/v1/agents/${agentId}/start`, null, { headers });
    check(res, { 'agent started': (r) => r.status < 500 });
  });

  group('execute messages', () => {
    for (let i = 0; i < 10; i++) {
      const res = http.post(
        `${BASE_URL}/api/v1/agents/${agentId}/messages`,
        JSON.stringify({ content: `Test message ${i + 1}: What is the current SOL price?` }),
        { headers },
      );
      check(res, { [`msg ${i + 1} ok`]: (r) => r.status < 500 });
      sleep(0.2);
    }
  });

  group('pause agent', () => {
    const res = http.post(`${BASE_URL}/api/v1/agents/${agentId}/pause`, null, { headers });
    check(res, { 'agent paused': (r) => r.status < 500 });
  });

  sleep(1);

  group('resume agent', () => {
    const res = http.post(`${BASE_URL}/api/v1/agents/${agentId}/resume`, null, { headers });
    check(res, { 'agent resumed': (r) => r.status < 500 });
  });

  group('stop agent', () => {
    const res = http.post(`${BASE_URL}/api/v1/agents/${agentId}/stop`, null, { headers });
    check(res, { 'agent stopped': (r) => r.status < 500 });
  });

  group('destroy agent', () => {
    const res = http.del(`${BASE_URL}/api/v1/agents/${agentId}`, null, { headers });
    check(res, { 'agent destroyed': (r) => r.status < 500 });
  });

  sleep(0.5);
}
