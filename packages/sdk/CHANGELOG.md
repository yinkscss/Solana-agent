# @solagent/sdk Changelog

## 0.1.0-alpha (2026-02-19)

### Features

- `SolAgentClient` — main client with gateway and per-service URL support
- `WalletModule` — create, get, balance, token balances, deactivate, recover, list by agent
- `PolicyModule` — create, get, update, deactivate, activate, list by wallet, evaluate
- `TransactionModule` — create, get, list by wallet, retry, waitForConfirmation
- HTTP client with automatic retry, exponential backoff, and timeout
- Typed error hierarchy (WalletNotFoundError, PolicyViolationError, TransactionFailedError, NetworkError, TimeoutError)
- Native `fetch` — zero external HTTP dependencies
