#!/usr/bin/env bun
/**
 * Run DB migrations against the database given by DATABASE_URL.
 * Use in deploy pipeline or as a Render one-off / Background Worker.
 *
 * Usage: DATABASE_URL=postgresql://... bun run scripts/run-migrations.ts
 */
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const proc = Bun.spawn(['bun', 'run', 'db:migrate'], {
  stdio: 'inherit',
  cwd: import.meta.dir + '/..',
});

const exitCode = await proc.exited;
process.exit(exitCode);
