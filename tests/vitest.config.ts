import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['e2e/**/*.test.ts', 'devnet/**/*.test.ts'],
    testTimeout: 15000,
  },
});
