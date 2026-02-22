# Load Tests

k6 load test scripts for the SolAgent API Gateway.

## Prerequisites

Install [k6](https://k6.io/docs/get-started/installation/):

```bash
# macOS
brew install k6

# Docker
docker run --rm -i grafana/k6 run -
```

## Running Tests

All scripts target the API Gateway at `http://localhost:8080` by default.

### Smoke Test (quick validation)

```bash
k6 run tests/load/smoke.js
```

### Stress Test (ramp to 1000 VUs)

```bash
k6 run tests/load/stress.js
```

### Scenario: Agent Lifecycle

```bash
k6 run tests/load/scenario-agent-lifecycle.js
```

### Scenario: Transaction Throughput

```bash
k6 run tests/load/scenario-transaction.js
```

## Environment Variables

| Variable   | Default                  | Description           |
| ---------- | ------------------------ | --------------------- |
| `BASE_URL` | `http://localhost:8080`  | API Gateway base URL  |
| `API_KEY`  | `test-api-key`           | API key for auth      |

Override with:

```bash
k6 run -e BASE_URL=https://staging.example.com -e API_KEY=real-key tests/load/smoke.js
```

## Thresholds

| Test    | p95 Latency | p99 Latency | Error Rate |
| ------- | ----------- | ----------- | ---------- |
| Smoke   | < 500ms     | -           | < 1%       |
| Stress  | < 1000ms    | < 2000ms    | < 5%       |
