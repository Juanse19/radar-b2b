/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // 'node' environment: sin DOM, sin dependencias ESM problemáticas
    // Los tests actuales son de lógica pura (rotación, fechas, filtros) — no necesitan browser
    environment: 'node',
    globals: true,
    exclude: ['**/node_modules/**', '**/tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
});
