import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'test-api-key';

const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
};

export default function () {
  group('health check', () => {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
      'health status 200': (r) => r.status === 200,
      'health body ok': (r) => r.json('status') === 'ok',
    });
  });

  group('list agents', () => {
    const res = http.get(`${BASE_URL}/api/v1/agents`, { headers });
    check(res, {
      'agents status < 500': (r) => r.status < 500,
    });
  });

  group('wallet flow', () => {
    const createRes = http.post(
      `${BASE_URL}/api/v1/wallets`,
      JSON.stringify({ name: `load-test-${__VU}-${__ITER}` }),
      { headers },
    );
    check(createRes, {
      'create wallet < 500': (r) => r.status < 500,
    });

    if (createRes.status === 200 || createRes.status === 201) {
      const walletId = createRes.json('id');
      if (walletId) {
        const balanceRes = http.get(`${BASE_URL}/api/v1/wallets/${walletId}/balance`, { headers });
        check(balanceRes, {
          'balance status < 500': (r) => r.status < 500,
        });
      }
    }
  });

  group('create transaction', () => {
    const res = http.post(
      `${BASE_URL}/api/v1/transactions`,
      JSON.stringify({
        type: 'transfer',
        amount: '0.001',
        to: 'So11111111111111111111111111111111111111112',
      }),
      { headers },
    );
    check(res, {
      'transaction status < 500': (r) => r.status < 500,
    });
  });

  sleep(1);
}
