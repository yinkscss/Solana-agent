import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 500 },
    { duration: '5m', target: 1000 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'test-api-key';

const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
};

export default function () {
  group('health', () => {
    const res = http.get(`${BASE_URL}/health`);
    check(res, { 'health 200': (r) => r.status === 200 });
  });

  group('agents', () => {
    const res = http.get(`${BASE_URL}/api/v1/agents`, { headers });
    check(res, { 'agents reachable': (r) => r.status < 500 });
  });

  group('wallets', () => {
    const res = http.get(`${BASE_URL}/api/v1/wallets`, { headers });
    check(res, { 'wallets reachable': (r) => r.status < 500 });
  });

  group('transactions', () => {
    const res = http.post(
      `${BASE_URL}/api/v1/transactions`,
      JSON.stringify({ type: 'transfer', amount: '0.001', to: 'target-address' }),
      { headers },
    );
    check(res, { 'tx reachable': (r) => r.status < 500 });
  });

  group('defi', () => {
    const res = http.get(`${BASE_URL}/api/v1/defi/pools`, { headers });
    check(res, { 'defi reachable': (r) => r.status < 500 });
  });

  sleep(0.5);
}
