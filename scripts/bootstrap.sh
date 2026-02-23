#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/infrastructure/docker/docker-compose.yml"

cd "$ROOT_DIR"

echo "=== SolAgent Bootstrap ==="
echo ""

# Check for .env
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "No .env found — copying from .env.example"
    cp .env.example .env
    echo "Please edit .env with your API keys, then re-run this script."
    exit 1
  else
    echo "ERROR: No .env or .env.example found."
    exit 1
  fi
fi

# Load .env into current shell so child processes inherit the vars
set -a
source .env
set +a

# Install dependencies
echo "[1/4] Installing dependencies..."
bun install

# Start infrastructure
echo "[2/4] Starting infrastructure (PostgreSQL, Redis)..."
docker compose -f "$COMPOSE_FILE" up -d postgres redis

echo "Waiting for PostgreSQL..."
until docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U solagent > /dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL is ready."

echo "Waiting for Redis..."
until docker compose -f "$COMPOSE_FILE" exec -T redis valkey-cli ping > /dev/null 2>&1; do
  sleep 1
done
echo "Redis is ready."

# Run migrations
echo "[3/4] Running database migrations..."
(cd packages/db && bun run src/migrate.ts)

# Seed database
echo "[4/4] Seeding database..."
(cd packages/db && bun run src/seed.ts)

echo ""
echo "=== Bootstrap Complete ==="
echo ""
echo "Infrastructure is running. Start services with:"
echo ""
echo "  bun run dev              # all services via turbo"
echo ""
echo "Or start individually:"
echo "  cd services/agent-runtime    && bun dev"
echo "  cd services/wallet-engine    && bun dev"
echo "  cd services/transaction-engine && bun dev"
echo "  cd apps/api-gateway          && bun dev"
echo "  cd apps/dashboard            && bun dev"
echo ""
echo "To also run services in Docker:"
echo "  docker compose -f infrastructure/docker/docker-compose.yml \\"
echo "                 -f infrastructure/docker/docker-compose.services.yml up -d"
echo ""
