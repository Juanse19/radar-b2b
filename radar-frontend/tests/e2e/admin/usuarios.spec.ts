import { test, expect } from '@playwright/test';

/**
 * E2E tests for Admin Usuarios module.
 *
 * Smoke/structural tests validate that the login wall is enforced
 * and that the login UI is consistent. Authenticated tests are skipped
 * since no TEST_EMAIL / TEST_PASSWORD env vars are configured for CI.
 *
 * To enable authenticated tests locally:
 *   TEST_EMAIL=admin@matec.com.co TEST_PASSWORD=<pass> npx playwright test
 */

test.describe('Admin Usuarios — protección de ruta', () => {
  test('acceso a /admin/usuarios sin auth redirige a /login', async ({ page }) => {
    await page.goto('/admin/usuarios');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page tiene formulario correcto al redirigir desde /admin/usuarios', async ({
    page,
  }) => {
    await page.goto('/admin/usuarios');
    // After redirect we should land on login with a working form
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});

test.describe('Admin Usuarios — tests autenticados', () => {
  // Skip if no test credentials are provided in environment
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
    // Wait for redirect away from login page
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
  }

  test('muestra tabla de usuarios con encabezados correctos', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!);
    await page.goto('/admin/usuarios');

    // Table headers defined in AdminUsuariosPage
    await expect(page.locator('text=Nombre')).toBeVisible();
    await expect(page.locator('text=Email')).toBeVisible();
    await expect(page.locator('text=Rol')).toBeVisible();
    await expect(page.locator('text=Estado')).toBeVisible();
    await expect(page.locator('text=Creado')).toBeVisible();
  });

  test('botón "Crear usuario" abre el dialog de creación', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!);
    await page.goto('/admin/usuarios');

    await page.click('text=Crear usuario');

    // Dialog should appear with the correct title
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await expect(dialog.locator('text=Crear usuario')).toBeVisible();

    // Form fields inside the dialog
    await expect(dialog.locator('input[placeholder*="Paola Vaquero"]')).toBeVisible();
    await expect(dialog.locator('input[type="email"]')).toBeVisible();
    await expect(dialog.locator('input[type="password"]')).toBeVisible();
  });

  test('dialog de crear usuario cierra al presionar Cancelar', async ({ page }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!);
    await page.goto('/admin/usuarios');

    await page.click('text=Crear usuario');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    await dialog.locator('text=Cancelar').click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });

  test('botón Crear usuario en dialog queda deshabilitado con campos vacíos', async ({
    page,
  }) => {
    await loginAs(page, process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!);
    await page.goto('/admin/usuarios');

    await page.click('text=Crear usuario');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // The submit button inside the dialog is disabled when form is invalid
    // (isValid requires nombre + email + password.length >= 8)
    const submitInDialog = dialog.locator('button[type="submit"]');
    await expect(submitInDialog).toBeDisabled();
  });
});
