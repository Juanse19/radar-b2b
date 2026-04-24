import { test, expect, Page } from '@playwright/test';

const EMAIL = 'juancamilo@matec.com.co';
const PASS  = 'Matec2026!';

async function login(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });
}

async function setTheme(page: Page, theme: 'dark' | 'light') {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, theme);
  await page.waitForTimeout(200);
}

const MODULES = [
  { name: 'dashboard', path: '/' },
  { name: 'scan', path: '/scan' },
  { name: 'results', path: '/results' },
  { name: 'contactos', path: '/contactos' },
  { name: 'schedule', path: '/schedule' },
  { name: 'admin-empresas', path: '/admin/empresas' },
  { name: 'admin-usuarios', path: '/admin/usuarios' },
  { name: 'admin-lineas', path: '/admin/lineas' },
  { name: 'admin-fuentes', path: '/admin/fuentes' },
];

test.describe('Visual regression — todos los módulos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const mod of MODULES) {
    test(`${mod.name} — dark mode`, async ({ page }) => {
      await page.goto(mod.path);
      await page.waitForLoadState('networkidle');
      await setTheme(page, 'dark');

      // Check h1 or h2 exists and is visible
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible({ timeout: 5000 });

      // Check no horizontal overflow
      const hasOverflow = await page.evaluate(() => document.body.scrollWidth > document.body.clientWidth + 10);
      expect(hasOverflow, `Horizontal overflow in ${mod.path}`).toBe(false);

      await page.screenshot({
        path: `tests/e2e/test-results/visual-${mod.name}-dark.png`,
        fullPage: true
      });
      expect(page.url()).not.toContain('/login');
    });

    test(`${mod.name} — light mode`, async ({ page }) => {
      await page.goto(mod.path);
      await page.waitForLoadState('networkidle');
      await setTheme(page, 'light');

      // Check h1 or h2 exists and is visible
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible({ timeout: 5000 });

      await page.screenshot({
        path: `tests/e2e/test-results/visual-${mod.name}-light.png`,
        fullPage: true
      });
    });
  }
});
