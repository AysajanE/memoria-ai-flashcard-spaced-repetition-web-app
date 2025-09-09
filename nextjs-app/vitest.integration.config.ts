import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['__tests__/**/*.integration.test.ts'],
    globals: true,
    setupFiles: ['__tests__/setup.ts'],
    // Integration tests may take longer
    testTimeout: 30000,
    // Retry flaky integration tests
    retry: 2,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});