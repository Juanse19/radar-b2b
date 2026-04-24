import { test, expect, Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'juancamilo@matec.com.co');
  await page.fill('input[type="password"]', 'Matec2026!');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });
}

test('Calificación — página carga correctamente', async ({ page }) => {
  await login(page);
  await page.goto('/calificacion');
  await page.waitForLoadState('networkidle');
  const h1 = await page.locator('h1').first().textContent();
  console.log('✅ Calificación heading:', h1?.trim());
  await page.screenshot({ path: 'tests/e2e/test-results/calificacion.png', fullPage: true });
  expect(page.url()).not.toContain('/login');
  expect(h1?.trim()).toBe('Calificación');
});

test('Calificación — nav link visible', async ({ page }) => {
  await login(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const calLink = page.locator('a[href="/calificacion"]');
  await expect(calLink).toBeVisible();
  console.log('✅ Nav link Calificación visible');
});
