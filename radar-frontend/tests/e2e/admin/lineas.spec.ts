import { test, expect } from '@playwright/test';

/**
 * E2E tests for Admin Lineas module.
 *
 * Structural tests verify the auth wall is enforced.
 * Authenticated tests require TEST_EMAIL + TEST_PASSWORD env vars.
 */

test.describe('Admin Lineas — protección de ruta', () => {
  test('acceso a /admin/lineas sin auth redirige a /login', async ({ page }) => {
    await page.goto('/admin/lineas');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page muestra formulario correcto al redirigir desde /admin/lineas', async ({
    page,
  }) => {
    await page.goto('/admin/lineas');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Iniciar sesión');
  });
});

test.describe('Admin Lineas — tests autenticados', () => {
  const hasTestCredentials =
    !!process.env.TEST_EMAIL && !!process.env.TEST_PASSWORD;

  test.skip(!hasTestCredentials, 'Requiere TEST_EMAIL y TEST_PASSWORD en el entorno');

  async function loginAs(
    page: Parameters<Parameters<typeof test>[1]>[0],
    email: string,
    password: string,
  ) {
    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
  }

  test('muestra encabezado "Líneas de negocio"', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!);
    await page.goto('/admin/lineas');
    await expect(page.locator('h1')).toContainText('Líneas de negocio');
  });

  test('muestra botón "Nueva línea"', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!);
    await page.goto('/admin/lineas');
    await expect(page.locator('text=Nueva línea')).toBeVisible();
  });

  test('botón "Nueva línea" abre el dialog de creación', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!);
    await page.goto('/admin/lineas');

    await page.click('text=Nueva línea');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await expect(dialog.locator('text=Nueva línea de negocio')).toBeVisible();
  });

  test('tabla de líneas tiene columnas correctas', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!);
    await page.goto('/admin/lineas');

    // Wait for loading spinner to disappear (data fetched)
    await page.waitForSelector('table', { timeout: 8000 });

    // Column headers rendered as <th> elements
    await expect(page.locator('th', { hasText: 'Nombre' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Descripción' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Color' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Orden' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Activa' })).toBeVisible();
  });
});
