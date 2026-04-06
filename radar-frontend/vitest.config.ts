/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // 'node' environment: sin DOM, sin dependencias ESM problemáticas
    // Los tests actuales son de lógica pura (rotación, fechas, filtros) — no necesitan browser
    environment: 'node',
    globals: true,
    // Set DATABASE_URL before any module is loaded so PrismaClient picks it up
    env: {
      DATABASE_URL:
        'file:C:/Users/Juan/Documents/Agentic Workflows/clients/radar-frontend/prisma/dev.db',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
});
