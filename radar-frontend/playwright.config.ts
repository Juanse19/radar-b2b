import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de Playwright para tests e2e del Radar B2B frontend.
 * El dev server ya está corriendo en http://localhost:3000
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  timeout: 30000,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3001',
    trace: 'on-first-retry',
    headless: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Puerto puede ser 3000 (default) o 3001 (si 3000 estaba ocupado)
  // Usar BASE_URL env var para flexibilidad: BASE_URL=http://localhost:3001 npx playwright test
});
