import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/config/**'],
    },
  },
  resolve: {
    alias: {
      '@solagent/common': resolve(__dirname, '../../packages/common/src'),
      '@solagent/db': resolve(__dirname, '../../packages/db/src'),
      '@solagent/events': resolve(__dirname, '../../packages/events/src'),
    },
  },
});
