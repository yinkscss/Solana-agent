# SolAgent Deployment Guide

This guide covers how to deploy the SolAgent platform. The repo currently supports **Docker Compose** for local/single-server deployment; Kubernetes and Terraform are placeholders for future use.

---

## Option 1: Local / single-server (Docker + Node)

Best for: development, demos, or a single VPS/VM.

### 1. Start infrastructure

```bash
bun run docker:up
```

This starts PostgreSQL, Redis, RedPanda, and the observability stack (Prometheus, Grafana, Loki, Tempo). Wait for Postgres and Redis to be healthy.

### 2. Run database migrations

```bash
bun run db:migrate
bun run db:seed   # optional: seed data
```

### 3. Start backend services

**Option A — Docker (recommended for a clean “deploy”)**

```bash
bun run services:up
```

This starts in Docker:

- **agent-runtime** (3001)
- **wallet-engine** (3002)
- **transaction-engine** (3004)
- **defi-integration** (3005)
- **api-gateway** (8080)

**Option B — Node (same as dev)**

```bash
export $(grep -v '^#' .env | xargs)
turbo run dev --filter=@solagent/agent-runtime --filter=@solagent/wallet-engine --filter=@solagent/transaction-engine --filter=@solagent/defi-integration --filter=@solagent/api-gateway
```

(Or run `bun run dev` to start all apps + services including the dashboard.)

### 4. Run the dashboard

The dashboard can run on the same machine and talk to the backends via `localhost`.

**Development:**

```bash
cd apps/dashboard && bun run dev
```

**Production build:**

```bash
cd apps/dashboard
bun run build
bun run start
```

Default port is 3000. Set `PORT` if needed.

### 5. Environment variables

Ensure `.env` (or the environment of each process) has at least:

| Variable            | Example                                                      | Description                                |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------ |
| `DATABASE_URL`      | `postgresql://solagent:dev_password@localhost:5432/solagent` | Postgres                                   |
| `REDIS_URL`         | `redis://localhost:6379`                                     | Redis                                      |
| `SOLANA_RPC_URL`    | `https://api.devnet.solana.com`                              | Solana RPC                                 |
| `OPENAI_API_KEY`    | `sk-...`                                                     | For agent-runtime LLM                      |
| `AGENT_RUNTIME_URL` | `http://localhost:3001`                                      | Used by dashboard API routes (server-side) |
| `WALLET_ENGINE_URL` | `http://localhost:3002`                                      | Used by dashboard wallet-provision route   |

For the **dashboard** when run separately (e.g. on another host), set:

- `AGENT_RUNTIME_URL` — URL of the agent-runtime service (e.g. `https://agent.example.com`)
- `WALLET_ENGINE_URL` — URL of the wallet-engine (e.g. `https://wallet.example.com`)
- `NEXT_PUBLIC_API_URL` — Optional; public URL of the API gateway (e.g. `https://api.example.com`) if the frontend calls it directly.
- `NEXT_PUBLIC_WS_URL` — Optional; WebSocket URL (e.g. `wss://api.example.com/ws`) for real-time updates.

---

## Option 2: Dashboard on Vercel, backends elsewhere

Best for: hosting the Next.js UI on Vercel and running backends on a VPS, Railway, Render, Fly.io, etc.

### 1. Deploy backends

Run the backend services (agent-runtime, wallet-engine, transaction-engine, defi-integration, api-gateway) on a server or PaaS, with Postgres and Redis (e.g. from Docker or a managed service). Use the same `.env` and migrations as in Option 1.

### 2. Deploy dashboard to Vercel

- Connect the repo to Vercel and set the **root directory** to `apps/dashboard` (or use a monorepo preset and set it).
- **Build command:** `cd ../.. && bun run build --filter=dashboard` (or `npm run build` if the dashboard’s `package.json` has a build that works from repo root).
- **Output:** Next.js (default).

### 3. Set Vercel environment variables

Configure these in the Vercel project (Production/Preview as needed):

| Name                      | Value                                    | Notes                           |
| ------------------------- | ---------------------------------------- | ------------------------------- |
| `AGENT_RUNTIME_URL`       | `https://your-agent-runtime.example.com` | Server-side only                |
| `WALLET_ENGINE_URL`       | `https://your-wallet-engine.example.com` | Server-side only                |
| `NEXT_PUBLIC_API_URL`     | `https://your-api-gateway.example.com`   | If the client calls the gateway |
| `NEXT_PUBLIC_WS_URL`      | `wss://your-api-gateway.example.com/ws`  | Optional; for live updates      |
| `NEXT_PUBLIC_GRAFANA_URL` | `https://grafana.example.com`            | Optional; for monitoring link   |

Redeploy after changing env vars.

---

## Option 3: All-in-one Docker (dashboard in Compose)

For a single `docker compose up` that includes the dashboard, add a **dashboard** service to `infrastructure/docker/docker-compose.services.yml`:

```yaml
dashboard:
  image: oven/bun:1
  working_dir: /app
  command: sh -c "cd apps/dashboard && bun run build && bun run start"
  volumes:
    - ../../:/app
  ports:
    - '3000:3000'
  env_file: ../../.env
  environment:
    AGENT_RUNTIME_URL: http://agent-runtime:3001
    WALLET_ENGINE_URL: http://wallet-engine:3002
  depends_on:
    - agent-runtime
    - wallet-engine
```

Then:

```bash
bun run docker:up
bun run db:migrate
bun run services:up   # now includes dashboard
```

Users would open `http://localhost:3000` (or your host’s IP). For production, put a reverse proxy (e.g. Caddy, nginx) in front with TLS.

---

## Full cloud (Render)

Best for: one-click deploy of the full stack (Postgres, Redis, 7 backends, api-gateway, dashboard) on [Render](https://render.com) using the repo Blueprint.

### Prerequisites

- A [Render](https://render.com) account
- OpenAI API key (for agent-runtime)
- (Optional) Solana RPC URL; default in Blueprint uses devnet

### Step-by-step

1. **Connect the repo** to Render (Dashboard → New → Blueprint).
2. **Select the repo** that contains `render.yaml` and apply the Blueprint. Render will create:
   - 1 Postgres database (`solagent-db`)
   - 1 Key Value / Redis instance (`solagent-redis`)
   - 8 web services: agent-runtime, wallet-engine, policy-engine, transaction-engine, defi-integration, notification, api-gateway, dashboard
3. **Set secrets** when prompted (or in each service's Environment tab):
   - **agent-runtime:** `OPENAI_API_KEY` (required)
   - **wallet-engine, transaction-engine, defi-integration:** `SOLANA_RPC_URL` (optional; defaults to devnet)
   - **api-gateway:** `API_KEYS` (comma-separated list of API keys for `/api/*` routes)
   - **dashboard:** `NEXT_PUBLIC_API_URL` = your api-gateway public URL (e.g. `https://api-gateway-xxxx.onrender.com`) so the client can call the API
4. **Run migrations** once Postgres is up:
   - In Render Dashboard, open the **Shell** for any service that has the repo (e.g. agent-runtime), or use a one-off Background Worker.
   - Run: `DATABASE_URL=<paste from solagent-db Internal connection string> bun run scripts/run-migrations.ts`
   - Or from your machine: `DATABASE_URL=<Render Postgres URL> bun run scripts/run-migrations.ts`
5. **Deploy** (or let auto-deploy run). Wait until all services are live.
6. **Run the smoke test** to verify the stack:

   ```bash
   bun run scripts/smoke-test-deployed.ts https://dashboard-xxxx.onrender.com https://api-gateway-xxxx.onrender.com
   ```

   With an API key for the protected check:

   ```bash
   API_KEY=your-key bun run scripts/smoke-test-deployed.ts https://dashboard-xxxx.onrender.com https://api-gateway-xxxx.onrender.com
   ```

   Or use the **Smoke test (deployed)** GitHub Action (workflow_dispatch) after setting repo secrets: `RENDER_DASHBOARD_URL`, `RENDER_API_GATEWAY_URL`, and optionally `API_KEY` or `API_KEYS`.

7. **Trigger redeploys via API (optional):** If you have a [Render API key](https://dashboard.render.com/settings#api-keys), you can trigger deploys for all services without opening the Dashboard:

   ```bash
   RENDER_API_KEY=rnd_xxx bun run scripts/render-trigger-deploys.ts
   ```

8. **All-in-one (migrations + trigger deploys + smoke test):** Set the relevant env vars and run:
   ```bash
   DATABASE_URL=... RENDER_API_KEY=... RENDER_DASHBOARD_URL=... RENDER_API_GATEWAY_URL=... bun run scripts/render-deploy-and-test.ts
   ```
   The script runs only the steps whose env vars are set (migrations if `DATABASE_URL`, trigger deploys if `RENDER_API_KEY`, smoke test if dashboard/gateway URLs).

### Environment variables (Render)

The Blueprint wires `DATABASE_URL` and `REDIS_URL` from the created Postgres and Key Value instances. Set the rest in the Render Dashboard (or in the Blueprint with `sync: false` so Render prompts you).

| Service            | Variable (set in Dashboard) | Description                            |
| ------------------ | --------------------------- | -------------------------------------- |
| agent-runtime      | `OPENAI_API_KEY`            | Required for LLM                       |
| wallet-engine      | `SOLANA_RPC_URL`            | Optional; default devnet               |
| transaction-engine | `SOLANA_RPC_URL`            | Optional                               |
| defi-integration   | `SOLANA_RPC_URL`            | Optional                               |
| api-gateway        | `API_KEYS`                  | Comma-separated keys for `/api/*`      |
| dashboard          | `NEXT_PUBLIC_API_URL`       | Public URL of api-gateway (for client) |

Internal URLs (api-gateway → backends, dashboard server → api-gateway) are set in `render.yaml` and use Render's private hostnames (e.g. `http://agent-runtime:3001`). No copy-paste of secrets into the repo; use Render's env UI or `sync: false`.

See `.env.production.example` for a reference list of variable names.

---

## Migrations in deploy pipeline

For any deployment (including Render), run migrations **before** or at first start of app services that use the database.

**From repo root (e.g. CI or one-off shell):**

```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname bun run scripts/run-migrations.ts
```

Or use the turbo script directly:

```bash
DATABASE_URL=postgresql://... bun run db:migrate
```

On **Render**, run migrations as a one-off **Shell** command in the dashboard (using the Postgres `DATABASE_URL` from the same Blueprint), or add a **Background Worker** that runs `bun run scripts/run-migrations.ts` once at deploy. See the "Full cloud (Render)" section above for the full flow.

---

## Checklist before production

- [ ] Use a **production** Postgres and Redis (managed or secured).
- [ ] Set strong secrets: `POSTGRES_PASSWORD`, any API keys, `OPENAI_API_KEY`, etc.
- [ ] Enforce **HTTPS** for dashboard and all backend URLs.
- [ ] Ensure **API key auth** is required for all proxy routes (already implemented; keep `x-api-key` or `Authorization: Bearer`).
- [ ] Consider **Turnkey** or another HSM for key storage instead of the local provider.
- [ ] Point `SOLANA_RPC_URL` (and optional `HELIUS_API_KEY`) to a production RPC; switch `SOLANA_NETWORK` only when ready (e.g. mainnet).
- [ ] Run `bun run build` and `bun run test` before deploying.

---

## CI (GitHub Actions)

On push/PR to `main`, the workflow runs:

- Lint, typecheck, tests, and full build.

There is **no automatic deploy** step. To deploy, use one of the options above and trigger it from your own pipeline (e.g. deploy on push to `main` via a second workflow or your host’s CI).

---

## Kubernetes / Terraform

`infrastructure/kubernetes/` and `infrastructure/terraform/` exist as placeholders (e.g. `.gitkeep` only). For production at scale you would add:

- **Kubernetes:** manifests or Helm charts for each service, Postgres/Redis (or external), and the dashboard.
- **Terraform:** modules for the cluster, DB, Redis, and optionally DNS/TLS.

You can copy patterns from the Docker Compose env vars and service list when defining those.
