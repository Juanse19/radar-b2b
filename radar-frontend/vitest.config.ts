/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Playwright e2e tests run with `npx playwright test`, not Vitest
    exclude: [
      '**/node_modules/**',
      '**/tests/e2e/**',
      '**/*.spec.ts',
    ],
    env: {
      DATABASE_URL:
        'file:C:/Users/Juan/Documents/Agentic Workflows/clients/radar-frontend/prisma/dev.db',
    },
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
});
