#!/usr/bin/env bun
/**
 * One script: run migrations (if DATABASE_URL), trigger Render deploys (if RENDER_API_KEY), run smoke test (if RENDER_DASHBOARD_URL).
 * Use after connecting the repo to Render and applying the Blueprint once.
 *
 * Usage:
 *   DATABASE_URL=... bun run scripts/render-deploy-and-test.ts
 *   RENDER_API_KEY=... bun run scripts/render-deploy-and-test.ts
 *   RENDER_DASHBOARD_URL=... RENDER_API_GATEWAY_URL=... bun run scripts/render-deploy-and-test.ts
 *   (Or set all and run once.)
 */
const ROOT = import.meta.dir + '/..';

async function run(args: string[], env?: Record<string, string>) {
  const proc = Bun.spawn(['bun', 'run', ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`Exit ${code}`);
}

async function main() {
  const steps: string[] = [];

  if (process.env.DATABASE_URL) {
    steps.push('Migrations');
    await run(['scripts/run-migrations.ts']);
  }

  if (process.env.RENDER_API_KEY) {
    steps.push('Trigger deploys');
    await run(['scripts/render-trigger-deploys.ts']);
  }

  const dashboard = process.env.RENDER_DASHBOARD_URL ?? '';
  const apiGateway = process.env.RENDER_API_GATEWAY_URL ?? '';
  if (dashboard || apiGateway) {
    steps.push('Smoke test');
    await run(['scripts/smoke-test-deployed.ts', dashboard, apiGateway]);
  }

  if (steps.length === 0) {
    console.error(
      'Set at least one of: DATABASE_URL, RENDER_API_KEY, or (RENDER_DASHBOARD_URL and/or RENDER_API_GATEWAY_URL)',
    );
    process.exit(1);
  }
  console.log('Done:', steps.join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
