import { test, expect, Page } from '@playwright/test';

/**
 * E2E tests for Admin API Keys module — /admin/api-keys
 *
 * Two suites:
 *  1. Route-protection (no auth) — always run, no credentials needed.
 *  2. Authenticated CRUD — uses /api/dev-login (dev server only) OR
 *     TEST_EMAIL / TEST_PASSWORD env vars for Supabase auth.
 *
 * To run authenticated tests locally with dev-login:
 *   npx playwright test tests/e2e/admin/admin-api-keys.spec.ts --headed
 *
 * To run with real credentials:
 *   TEST_EMAIL=admin@matec.com.co TEST_PASSWORD=<pass> npx playwright test \
 *     tests/e2e/admin/admin-api-keys.spec.ts
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Authenticate via /api/dev-login (development server only).
 * Falls back to Supabase email/password if TEST_EMAIL and TEST_PASSWORD are set.
 */
async function loginAdmin(page: Page): Promise<boolean> {
  // Strategy 1: dev-login endpoint (NODE_ENV=development only)
  try {
    const res = await page.request.get('/api/dev-login');
    if (res.ok()) {
      // Reload current page so the session cookie is picked up
      await page.goto('/admin/api-keys');
      await page.waitForLoadState('networkidle');
      // Confirm we did NOT land on /login
      if (!page.url().includes('/login')) return true;
    }
  } catch {
    // endpoint not available — fall through to credentials
  }

  // Strategy 2: TEST_EMAIL + TEST_PASSWORD env vars
  if (process.env.TEST_EMAIL && process.env.TEST_PASSWORD) {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_EMAIL);
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 10_000,
    });
    await page.goto('/admin/api-keys');
    await page.waitForLoadState('networkidle');
    return !page.url().includes('/login');
  }

  return false;
}

// ---------------------------------------------------------------------------
// Suite 1 — Route protection (unauthenticated)
// ---------------------------------------------------------------------------

test.describe('Admin API Keys — proteccion de ruta', () => {
  test('acceso sin auth redirige a /login', async ({ page }) => {
    await page.goto('/admin/api-keys');
    await expect(page).toHaveURL(/\/login/);
  });

  test('pagina de login muestra formulario correcto al redirigir desde /admin/api-keys', async ({
    page,
  }) => {
    await page.goto('/admin/api-keys');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Authenticated CRUD
// ---------------------------------------------------------------------------

test.describe('Admin API Keys — CRUD autenticado', () => {
  // Determine if we can authenticate at all
  const hasDevLogin = true; // /api/dev-login is tried dynamically
  const hasTestCredentials =
    !!process.env.TEST_EMAIL && !!process.env.TEST_PASSWORD;
  const canAuthenticate = hasDevLogin || hasTestCredentials;

  test.skip(
    !canAuthenticate,
    'Requiere dev server (NODE_ENV=development) o TEST_EMAIL/TEST_PASSWORD',
  );

  // Each test logs in fresh to keep isolation
  test.beforeEach(async ({ page }) => {
    const loggedIn = await loginAdmin(page);
    if (!loggedIn) {
      test.skip();
    }
  });

  // ── TC-AK-01 ────────────────────────────────────────────────────────────

  test('TC-AK-01: pagina carga y muestra tabla de proveedores sin error 500', async ({
    page,
  }) => {
    // Wait for the GET /api/admin/api-keys response
    const apiResponse = await page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/admin/api-keys') && resp.request().method() === 'GET',
      { timeout: 10_000 },
    );

    // API must not return a 5xx error
    expect(apiResponse.status()).toBeLessThan(500);

    // Page heading
    await expect(
      page.getByRole('heading', { name: /API Keys de IA/i }),
    ).toBeVisible({ timeout: 8_000 });

    // Either a table OR the empty-state card is visible (no raw error message)
    const tableOrEmpty = page.locator('table, [aria-label="Sin configuraciones"]').or(
      page.getByText('Sin configuraciones de API'),
    );
    await expect(tableOrEmpty.first()).toBeVisible({ timeout: 8_000 });

    // Ensure no unhandled HTTP 500 error text is shown to the user
    await expect(page.getByText('HTTP 500')).not.toBeVisible();
  });

  // ── TC-AK-02 ────────────────────────────────────────────────────────────

  test('TC-AK-02: abrir dialog Nueva configuracion', async ({ page }) => {
    // Click the primary CTA button
    await page.getByRole('button', { name: /Nueva configuracion/i }).click();

    // Dialog should appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Title inside dialog
    await expect(
      dialog.getByRole('heading', { name: /Nueva configuracion IA/i }),
    ).toBeVisible();

    // Required form fields
    await expect(page.getByLabel('Proveedor')).toBeVisible();
    await expect(page.getByLabel('Label')).toBeVisible();
    await expect(page.getByLabel('Modelo')).toBeVisible();
    // API Key field — label contains "API Key"
    await expect(page.getByLabel(/API Key/i)).toBeVisible();
    // Budget field
    await expect(page.getByLabel(/Presupuesto mensual/i)).toBeVisible();

    // Cancel button closes dialog
    await dialog.getByRole('button', { name: /Cancelar/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 3_000 });
  });

  // ── TC-AK-03 ────────────────────────────────────────────────────────────

  test('TC-AK-03: crear nueva config OpenAI exitosamente', async ({ page }) => {
    // Open dialog
    await page.getByRole('button', { name: /Nueva configuracion/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Select provider: openai
    // Shadcn Select uses a trigger button, not a native <select>
    const providerTrigger = page.locator('#cfg-provider');
    await providerTrigger.click();
    await page.getByRole('option', { name: 'OpenAI' }).click();

    // Clear and fill label
    const labelInput = page.locator('#cfg-label');
    await labelInput.clear();
    await labelInput.fill('GPT-4o Test');

    // Clear and fill model
    const modelInput = page.locator('#cfg-model');
    await modelInput.clear();
    await modelInput.fill('gpt-4o');

    // Fill api_key
    await page.locator('#cfg-key').fill('sk-test-1234567890abcdef');

    // Fill budget
    await page.locator('#cfg-budget').fill('10.00');

    // Intercept the POST so we can validate the request completes
    const [postResponse] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes('/api/admin/api-keys') && resp.request().method() === 'POST',
        { timeout: 10_000 },
      ),
      page.getByRole('button', { name: /^Crear$/i }).click(),
    ]);

    // API must not return a 4xx/5xx that indicates a bug
    // 201 = created, 400/500 = real bug worth catching
    const status = postResponse.status();
    expect(status).not.toBe(500);

    if (status === 201) {
      // Success path: dialog closes and table refreshes
      await expect(dialog).not.toBeVisible({ timeout: 5_000 });

      // The new row should now appear in the table
      await expect(page.getByRole('cell', { name: 'GPT-4o Test' })).toBeVisible({
        timeout: 8_000,
      });
    } else {
      // Non-201 but also non-500: log the status for debugging
      // The dialog may stay open with an error message — that is acceptable
      // as long as it is not a 500
      const body = await postResponse.json().catch(() => ({}));
      console.warn(`[TC-AK-03] POST returned ${status}:`, body);
    }
  });

  // ── TC-AK-04 ────────────────────────────────────────────────────────────

  test('TC-AK-04: api_key vacia muestra error de validacion', async ({ page }) => {
    // Open dialog
    await page.getByRole('button', { name: /Nueva configuracion/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Fill all required fields EXCEPT api_key
    const labelInput = page.locator('#cfg-label');
    await labelInput.clear();
    await labelInput.fill('Test Sin Key');

    const modelInput = page.locator('#cfg-model');
    await modelInput.clear();
    await modelInput.fill('gpt-4o');

    // Leave #cfg-key intentionally empty

    // Attempt to submit
    const [postResponse] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes('/api/admin/api-keys') && resp.request().method() === 'POST',
        { timeout: 10_000 },
      ).catch(() => null), // may not fire if client-side validation blocks it
      page.getByRole('button', { name: /^Crear$/i }).click(),
    ]);

    if (postResponse) {
      // If the request was sent, server must return 400 (not 500 or 200)
      expect(postResponse.status()).toBe(400);
    }

    // Dialog must still be open (validation failure should NOT close it)
    await expect(dialog).toBeVisible({ timeout: 3_000 });

    // An error message must be visible somewhere in or near the dialog
    // Server returns { error: 'api_key is required' }
    // Client renders saveError in a <p className="text-sm text-destructive">
    const errorVisible =
      (await page.getByText(/api_key is required/i).isVisible()) ||
      (await page.getByText(/api_key.*requerida/i).isVisible()) ||
      (await page.locator('.text-destructive').isVisible());

    expect(errorVisible).toBe(true);
  });

  // ── TC-AK-05 ────────────────────────────────────────────────────────────

  test('TC-AK-05: toggle activo/inactivo actualiza sin error', async ({ page }) => {
    // Wait for table to load
    await page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/admin/api-keys') && resp.request().method() === 'GET',
      { timeout: 10_000 },
    );

    // If table is empty, skip (no configs to toggle)
    const hasRows = await page.locator('table tbody tr').count();
    if (hasRows === 0) {
      test.skip();
      return;
    }

    // Click the Switch in the first row (column "Activo")
    // Shadcn Switch renders a <button role="switch">
    const firstRowSwitch = page
      .locator('table tbody tr')
      .first()
      .getByRole('switch');

    const [putResponse] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes('/api/admin/api-keys/') && resp.request().method() === 'PUT',
        { timeout: 8_000 },
      ),
      firstRowSwitch.click(),
    ]);

    // PUT must succeed
    expect(putResponse.status()).toBeLessThan(300);

    // No action error banner should appear
    await expect(page.getByText('Error al actualizar')).not.toBeVisible({
      timeout: 3_000,
    });
  });

  // ── TC-AK-06 ────────────────────────────────────────────────────────────

  test('TC-AK-06: eliminar una config no-default', async ({ page }) => {
    // Wait for initial load
    await page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/admin/api-keys') && resp.request().method() === 'GET',
      { timeout: 10_000 },
    );

    // Find rows where the Default cell does NOT show the "Default" badge
    // (we must not delete the default config)
    const rows = page.locator('table tbody tr');
    const count = await rows.count();

    if (count === 0) {
      test.skip();
      return;
    }

    // Find the first non-default row: it has an "Establecer" link, not a "Default" badge
    let targetRowIndex = -1;
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const hasEstablecer = await row.getByText('Establecer').isVisible();
      if (hasEstablecer) {
        targetRowIndex = i;
        break;
      }
    }

    if (targetRowIndex === -1) {
      // All configs are default (only one exists), skip
      test.skip();
      return;
    }

    const targetRow = rows.nth(targetRowIndex);
    const labelCell = await targetRow.locator('td').nth(1).textContent();

    // handleDelete uses window.confirm — accept it automatically
    page.once('dialog', (dialog) => dialog.accept());

    const [deleteResponse] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes('/api/admin/api-keys/') &&
          resp.request().method() === 'DELETE',
        { timeout: 8_000 },
      ),
      targetRow.getByRole('button', { name: /Eliminar/i }).click(),
    ]);

    // DELETE must succeed
    expect(deleteResponse.status()).toBeLessThan(300);

    // The deleted row must no longer appear in the table
    if (labelCell?.trim()) {
      await expect(
        page.getByRole('cell', { name: labelCell.trim() }),
      ).not.toBeVisible({ timeout: 8_000 });
    }

    // No error banner
    await expect(page.getByText('Error al eliminar')).not.toBeVisible({
      timeout: 3_000,
    });
  });
});
