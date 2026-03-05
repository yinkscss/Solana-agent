#!/usr/bin/env bun
/**
 * Trigger deploys for all SolAgent services on Render via the Render API.
 * Requires RENDER_API_KEY. Optionally set RENDER_SERVICE_NAMES (comma-separated) to deploy only those.
 *
 * Usage: RENDER_API_KEY=rnd_xxx bun run scripts/render-trigger-deploys.ts
 */
const API_BASE = 'https://api.render.com/v1';
const SERVICE_NAMES = [
  'agent-runtime',
  'wallet-engine',
  'policy-engine',
  'transaction-engine',
  'defi-integration',
  'notification',
  'api-gateway',
  'dashboard',
];

async function main() {
  const apiKey = process.env.RENDER_API_KEY;
  if (!apiKey) {
    console.error('Set RENDER_API_KEY to trigger deploys.');
    process.exit(1);
  }

  const filterNames = process.env.RENDER_SERVICE_NAMES
    ? process.env.RENDER_SERVICE_NAMES.split(',').map((s) => s.trim())
    : SERVICE_NAMES;

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  // List services (paginated)
  const services: { id: string; name?: string }[] = [];
  let page = 1;
  const limit = 100;
  while (true) {
    const res = await fetch(`${API_BASE}/services?limit=${limit}&page=${page}`, { headers });
    if (!res.ok) {
      console.error('List services failed:', res.status, await res.text());
      process.exit(1);
    }
    const raw = (await res.json()) as
      | { id: string; name?: string }[]
      | { services?: { id: string; name?: string }[] };
    const data = Array.isArray(raw) ? raw : (raw?.services ?? []);
    if (data.length === 0) break;
    services.push(...data);
    if (data.length < limit) break;
    page++;
  }

  const byName = new Map(services.map((s) => [s.name ?? '', s]));
  let triggered = 0;
  for (const name of filterNames) {
    const svc = byName.get(name);
    if (!svc) {
      console.warn(`Service not found: ${name}`);
      continue;
    }
    const deployRes = await fetch(`${API_BASE}/services/${svc.id}/deploys`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    if (!deployRes.ok) {
      console.error(`Deploy ${name} failed:`, deployRes.status, await deployRes.text());
      continue;
    }
    console.log(`Triggered deploy: ${name}`);
    triggered++;
  }
  console.log(`Done. Triggered ${triggered} deploy(s).`);
  process.exit(triggered === 0 ? 1 : 0);
}

main();
