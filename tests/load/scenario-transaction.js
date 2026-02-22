import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const txCreated = new Counter('transactions_created');
const txConfirmed = new Rate('transaction_confirmation_rate');

export const options = {
  scenarios: {
    tx_throughput: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 2,
      maxDuration: '10m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.1'],
    transaction_confirmation_rate: ['rate>0.8'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const API_KEY = __ENV.API_KEY || 'test-api-key';

const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
};

export default function () {
  let walletId;

  group('create wallet', () => {
    const res = http.post(
      `${BASE_URL}/api/v1/wallets`,
      JSON.stringify({ name: `tx-test-wallet-${__VU}-${__ITER}` }),
      { headers },
    );
    check(res, { 'wallet created': (r) => r.status === 200 || r.status === 201 });
    if (res.status === 200 || res.status === 201) {
      walletId = res.json('id');
    }
  });

  if (!walletId) return;

  group('batch transactions', () => {
    const txIds = [];

    for (let i = 0; i < 100; i++) {
      const res = http.post(
        `${BASE_URL}/api/v1/transactions`,
        JSON.stringify({
          walletId,
          type: 'transfer',
          amount: '0.001',
          to: 'So11111111111111111111111111111111111111112',
          memo: `load-test-tx-${__VU}-${__ITER}-${i}`,
        }),
        { headers },
      );

      if (res.status === 200 || res.status === 201) {
        txCreated.add(1);
        const txId = res.json('id');
        if (txId) txIds.push(txId);
      }

      if (i % 10 === 9) sleep(0.1);
    }

    sleep(2);

    for (const txId of txIds) {
      const statusRes = http.get(
        `${BASE_URL}/api/v1/transactions/${txId}`,
        { headers },
      );
      const confirmed =
        statusRes.status === 200 &&
        (statusRes.json('status') === 'confirmed' || statusRes.json('status') === 'finalized');
      txConfirmed.add(confirmed);
    }
  });

  sleep(1);
}
