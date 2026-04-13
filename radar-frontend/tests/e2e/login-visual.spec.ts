import { test } from '@playwright/test';

test('Login — visual light y dark mode', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Modo claro
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tests/e2e/test-results/login-light.png', fullPage: false });

  // Modo oscuro
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tests/e2e/test-results/login-dark.png', fullPage: false });
});

test('Dashboard — visual light y dark mode (autenticado)', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('input[type="email"]', 'juancamilo@matec.com.co');
  await page.fill('input[type="password"]', 'Matec2026!');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });

  // Dashboard light
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tests/e2e/test-results/dashboard-light.png', fullPage: false });

  // Dashboard dark
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tests/e2e/test-results/dashboard-dark.png', fullPage: false });

  // Scan light
  await page.goto('/scan');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tests/e2e/test-results/scan-light.png', fullPage: false });

  // Scan dark
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tests/e2e/test-results/scan-dark.png', fullPage: false });
});
