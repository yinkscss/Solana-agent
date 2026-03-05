#!/usr/bin/env bun
/**
 * Post-deploy smoke test. Hits health/readiness and optionally one API request.
 * Exits 0 only if all checks pass.
 *
 * Usage:
 *   bun run scripts/smoke-test-deployed.ts <dashboard_url> [api_gateway_url]
 *   API_KEY=your-key bun run scripts/smoke-test-deployed.ts <dashboard_url> [api_gateway_url]
 *
 * Example (Render):
 *   bun run scripts/smoke-test-deployed.ts https://dashboard-xxx.onrender.com https://api-gateway-xxx.onrender.com
 */
const TIMEOUT_MS = 15_000;

async function fetchOk(url: string, options?: RequestInit): Promise<boolean> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res.ok;
  } catch (e) {
    console.error(`  Request failed: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const dashboardUrl = process.argv[2]?.replace(/\/$/, '');
  const apiGatewayUrl = process.argv[3]?.replace(/\/$/, '');
  if (!dashboardUrl && !apiGatewayUrl) {
    console.error(
      'Usage: bun run scripts/smoke-test-deployed.ts <dashboard_url> [api_gateway_url]',
    );
    process.exit(1);
  }

  let failed = 0;

  if (dashboardUrl) {
    process.stdout.write(`Checking dashboard ${dashboardUrl} ... `);
    const ok = await fetchOk(`${dashboardUrl}/`);
    if (ok) {
      console.log('OK');
    } else {
      console.log('FAIL');
      failed++;
    }
  }

  if (apiGatewayUrl) {
    process.stdout.write(`Checking api-gateway ${apiGatewayUrl}/health ... `);
    const ok = await fetchOk(`${apiGatewayUrl}/health`);
    if (ok) {
      console.log('OK');
    } else {
      console.log('FAIL');
      failed++;
    }

    const apiKey = process.env.API_KEY ?? process.env.API_KEYS?.split(',')[0]?.trim();
    if (apiKey && apiGatewayUrl) {
      process.stdout.write('Checking api-gateway /api/v1/agents (with API key) ... ');
      const ok = await fetchOk(`${apiGatewayUrl}/api/v1/agents`, {
        headers: { 'x-api-key': apiKey },
      });
      if (ok) {
        console.log('OK');
      } else {
        console.log('FAIL');
        failed++;
      }
    }
  }

  if (failed > 0) {
    console.error(`\nSmoke test failed: ${failed} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nSmoke test passed.');
  process.exit(0);
}

main();
