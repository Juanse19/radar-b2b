/**
 * E2E tests for the Escanear wizard — "Señales" tab
 *
 * Covered flows:
 *   ES-01  Navigate to /escanear, click tab "Señales" — Step 1 shows line cards
 *   ES-02  Select a line (Intralogística) — "Siguiente" button becomes enabled
 *   ES-03  Click "Siguiente" → Step 2 appears with countries section
 *   ES-04  Select at least one country (Colombia) — "Siguiente" becomes enabled
 *   ES-05  Click "Siguiente" → Step 3 appears with provider selection
 *   ES-06  Select provider "OpenAI" — card shows selected state
 *   ES-07  "Ejecutar Modo Señales" button is visible in Step 3
 *   ES-08  "Atrás" from Step 3 goes to Step 2; from Step 2 goes to Step 1
 *
 * Architecture notes
 * ------------------
 * - The Señales wizard is rendered via SenalesScanForm → Wizard({ agentMode: "signals" })
 * - The Wizard component uses useWizardState which is URL-driven (step, line, paises, etc.)
 * - Signals mode has NO mode card in Step 1 (only line cards)
 * - Step 2 signals mode shows: Fuentes, Palabras clave, Países objetivo, Máx señales
 * - Step 3 signals mode shows: Resumen, Proveedor IA, Ejecutar Modo Señales button
 * - "Siguiente" is ONLY enabled when: step1 needs !!state.line; step2 needs paises.length > 0
 * - The tab switch uses ?tab=senales in the URL (AgentModeTabs component)
 *
 * Auth
 * ----
 * All tests call /api/dev-login (NODE_ENV=development only route) to obtain
 * the session cookie before navigating to protected pages.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function devLogin(page: Page): Promise<void> {
  const res = await page.request.get('/api/dev-login');
  if (!res.ok()) {
    throw new Error(`dev-login failed: ${res.status()} — ensure NODE_ENV=development`);
  }
}

async function gotoEscanear(page: Page): Promise<void> {
  await page.goto('/escanear');
  await page.waitForLoadState('networkidle');
  // Wait for Suspense/lazy rendering to settle
  await page.waitForTimeout(500);
}

/**
 * Click the "Señales" tab and wait for it to become active.
 */
async function clickSenalesTab(page: Page): Promise<void> {
  // The tab has role="tab" and contains the text "Señales"
  const tab = page.getByRole('tab', { name: /Señales/i });
  await tab.waitFor({ state: 'visible', timeout: 5_000 });
  await tab.click();
  // Wait for URL to update to ?tab=senales
  await page.waitForURL(/tab=senales/, { timeout: 5_000 }).catch(() => null);
  await page.waitForTimeout(400);
}

/**
 * Click a line card in Step 1 of the Señales wizard.
 */
async function clickLineCard(page: Page, lineName: string): Promise<void> {
  const btn = page.locator('button[aria-pressed]', { hasText: new RegExp(`^${lineName}`, 'i') }).first();
  await btn.waitFor({ state: 'visible', timeout: 5_000 });
  await btn.click();
  await page.waitForTimeout(300);
}

/**
 * Click the "Siguiente" button (shared nav button at the bottom of the Wizard).
 */
async function clickSiguiente(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: /Siguiente/i });
  await btn.waitFor({ state: 'visible', timeout: 5_000 });
  await btn.click();
  await page.waitForTimeout(400);
}

/**
 * Click the "Atrás" button.
 */
async function clickAtras(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: /Atrás/i });
  await btn.waitFor({ state: 'visible', timeout: 5_000 });
  await btn.click();
  await page.waitForTimeout(400);
}

// ---------------------------------------------------------------------------
// ES-01: Navigate to /escanear, click tab "Señales" — Step 1 shows line cards
// ---------------------------------------------------------------------------

test.describe('ES: Señales tab — navigation', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
    await gotoEscanear(page);
  });

  test('ES-01 · Clicking tab "Señales" shows Step 1 with line cards', async ({ page }) => {
    await clickSenalesTab(page);

    // Line cards should be visible — at least one of the 3 lines (BHS, Intralogística, Cartón)
    const lines = ['BHS', 'Intralogística', 'Cartón'];
    let lineFound = false;
    for (const l of lines) {
      if (
        await page
          .locator('button[aria-pressed]', { hasText: new RegExp(`^${l}`, 'i') })
          .first()
          .isVisible({ timeout: 3_000 })
          .catch(() => false)
      ) {
        lineFound = true;
        break;
      }
    }
    expect(lineFound, 'At least one line card should be visible in Señales Step 1').toBe(true);

    // Signals mode should NOT show mode cards (Automático / Manual)
    const modeCardVisible =
      await page.locator('[role="button"]', { hasText: /^Manual$/i }).first().isVisible({ timeout: 1_500 }).catch(() => false) ||
      await page.locator('[role="button"]', { hasText: /^Automático$/i }).first().isVisible({ timeout: 1_500 }).catch(() => false);
    expect(modeCardVisible, 'Mode cards (Manual/Automático) should NOT appear in Señales Step 1').toBe(false);

    await page.screenshot({ path: 'test-results/ES-01-senales-step1.png' });
  });
});

// ---------------------------------------------------------------------------
// ES-02 / ES-03: Line selection + advance to Step 2
// ---------------------------------------------------------------------------

test.describe('ES: Step 1 — line selection and advance', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
    await gotoEscanear(page);
    await clickSenalesTab(page);
  });

  test('ES-02 · Selecting "Intralogística" enables the "Siguiente" button', async ({ page }) => {
    // Before selecting: "Siguiente" should be disabled
    const siguienteBtn = page.getByRole('button', { name: /Siguiente/i });
    await siguienteBtn.waitFor({ state: 'visible', timeout: 5_000 });
    const disabledBefore = await siguienteBtn.isDisabled({ timeout: 2_000 });
    expect(disabledBefore, '"Siguiente" should be disabled before line selection').toBe(true);

    // Select Intralogística
    await clickLineCard(page, 'Intralogística');

    // Now "Siguiente" should be enabled
    const enabledAfter = await siguienteBtn.isEnabled({ timeout: 3_000 });
    expect(enabledAfter, '"Siguiente" should be enabled after selecting a line').toBe(true);

    await page.screenshot({ path: 'test-results/ES-02-intralogistica-selected.png' });
  });

  test('ES-03 · Clicking "Siguiente" after line selection shows Step 2 with countries', async ({ page }) => {
    await clickLineCard(page, 'Intralogística');
    await clickSiguiente(page);

    // Step 2 in signals mode shows "Países objetivo" label
    const paisesLabel = page.getByText(/Países objetivo/i).first();
    const labelVisible = await paisesLabel.isVisible({ timeout: 5_000 }).catch(() => false);

    // Also check for country buttons (Colombia, México, etc.)
    const colombiaBtn = page.locator('button', { hasText: /^Colombia$/i }).first();
    const countryVisible = await colombiaBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    await page.screenshot({ path: 'test-results/ES-03-step2-countries.png' });
    expect(labelVisible || countryVisible, 'Step 2 should show Países objetivo section with country buttons').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ES-04 / ES-05: Country selection + advance to Step 3
// ---------------------------------------------------------------------------

test.describe('ES: Step 2 — country selection and advance', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
    await gotoEscanear(page);
    await clickSenalesTab(page);
    // Navigate to Step 2: select line then click Siguiente
    await clickLineCard(page, 'Intralogística');
    await clickSiguiente(page);
    // Wait for Step 2 to render
    await page.waitForTimeout(400);
  });

  test('ES-04 · Selecting "Colombia" enables the "Siguiente" button', async ({ page }) => {
    // Before selecting a country: "Siguiente" should be disabled
    const siguienteBtn = page.getByRole('button', { name: /Siguiente/i });
    await siguienteBtn.waitFor({ state: 'visible', timeout: 5_000 });
    const disabledBefore = await siguienteBtn.isDisabled({ timeout: 2_000 });
    expect(disabledBefore, '"Siguiente" should be disabled before country selection').toBe(true);

    // Click "Colombia" country button
    const colombiaBtn = page.locator('button', { hasText: /^Colombia$/i }).first();
    await colombiaBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await colombiaBtn.click();
    await page.waitForTimeout(300);

    // Now "Siguiente" should be enabled
    const enabledAfter = await siguienteBtn.isEnabled({ timeout: 3_000 });
    expect(enabledAfter, '"Siguiente" should be enabled after selecting a country').toBe(true);

    await page.screenshot({ path: 'test-results/ES-04-colombia-selected.png' });
  });

  test('ES-05 · Clicking "Siguiente" after country selection shows Step 3 with provider cards', async ({ page }) => {
    // Select Colombia
    const colombiaBtn = page.locator('button', { hasText: /^Colombia$/i }).first();
    await colombiaBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await colombiaBtn.click();
    await page.waitForTimeout(300);

    await clickSiguiente(page);

    // Step 3 signals mode shows "Proveedor IA" label
    const providerLabel = page.getByText(/Proveedor IA/i).first();
    const labelVisible = await providerLabel.isVisible({ timeout: 5_000 }).catch(() => false);

    // Also check for at least one provider button (claude, openai, gemini)
    let providerBtnFound = false;
    for (const p of ['claude', 'openai', 'gemini']) {
      if (
        await page
          .locator('button[type="button"]', { hasText: new RegExp(p, 'i') })
          .first()
          .isVisible({ timeout: 3_000 })
          .catch(() => false)
      ) {
        providerBtnFound = true;
        break;
      }
    }

    await page.screenshot({ path: 'test-results/ES-05-step3-providers.png' });
    expect(labelVisible || providerBtnFound, 'Step 3 should show Proveedor IA section with provider buttons').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ES-06 / ES-07: Provider selection and Ejecutar button in Step 3
// ---------------------------------------------------------------------------

test.describe('ES: Step 3 — provider selection and execute button', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
    // Navigate directly to Step 3 via URL for speed
    // ?tab=senales switches to Señales tab
    // ?step=3&line=Intralogística puts the wizard at Step 3
    // ?paises=Colombia satisfies the paises requirement
    await page.goto('/escanear?tab=senales&step=3&line=Intralog%C3%ADstica&paises=Colombia');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
  });

  test('ES-06 · Selecting provider "OpenAI" shows selected state on the card', async ({ page }) => {
    // Wait for provider cards to load (they fetch from /api/admin/api-keys)
    const openaiBtn = page.locator('button[type="button"]', { hasText: /openai/i }).first();
    const visible = await openaiBtn.isVisible({ timeout: 8_000 }).catch(() => false);
    if (!visible) {
      test.skip(true, 'OpenAI provider card not found — may depend on DB config, skipping');
      return;
    }

    await openaiBtn.click();
    await page.waitForTimeout(300);

    // After clicking, OpenAI card should show active state
    // Active state: class includes border-primary + ring-2
    const cls = await openaiBtn.getAttribute('class') ?? '';
    const isActive =
      cls.includes('border-primary') ||
      cls.includes('ring-2') ||
      cls.includes('bg-primary');

    // Also look for the checkmark inside the button (aria-hidden span)
    const checkmark = openaiBtn.locator('span[aria-hidden]');
    const checkmarkVisible = await checkmark.isVisible({ timeout: 1_000 }).catch(() => false);

    await page.screenshot({ path: 'test-results/ES-06-openai-selected.png' });
    expect(isActive || checkmarkVisible, 'OpenAI provider card should show selected state after click').toBe(true);
  });

  test('ES-07 · "Ejecutar Modo Señales" button is visible in Step 3', async ({ page }) => {
    // The button text is "Ejecutar Modo Señales" (with Radar icon prefix)
    const ejecutarBtn = page.locator('button', { hasText: /Ejecutar Modo Señales/i }).first();
    const visible = await ejecutarBtn.isVisible({ timeout: 8_000 }).catch(() => false);

    await page.screenshot({ path: 'test-results/ES-07-ejecutar-visible.png' });
    expect(visible, '"Ejecutar Modo Señales" button should be visible in Step 3').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ES-08: "Atrás" navigation — Step 3 → Step 2 → Step 1
// ---------------------------------------------------------------------------

test.describe('ES: Navigation — Atrás from Steps 3 and 2', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
    await gotoEscanear(page);
    await clickSenalesTab(page);
  });

  test('ES-08 · "Atrás" from Step 3 returns to Step 2; from Step 2 returns to Step 1', async ({ page }) => {
    // ── Navigate to Step 3 via click-through ──
    // Step 1: select line
    await clickLineCard(page, 'Intralogística');
    await clickSiguiente(page);

    // Step 2: select country + advance
    const colombiaBtn = page.locator('button', { hasText: /^Colombia$/i }).first();
    await colombiaBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await colombiaBtn.click();
    await page.waitForTimeout(300);
    await clickSiguiente(page);

    // Confirm Step 3 is showing (Proveedor IA or Ejecutar button)
    const step3Visible =
      await page.getByText(/Proveedor IA/i).first().isVisible({ timeout: 5_000 }).catch(() => false) ||
      await page.locator('button', { hasText: /Ejecutar Modo Señales/i }).first().isVisible({ timeout: 5_000 }).catch(() => false);
    expect(step3Visible, 'Should be on Step 3 before testing Atrás').toBe(true);

    // ── Click Atrás from Step 3 → should go to Step 2 ──
    await clickAtras(page);

    // Step 2 shows "Países objetivo"
    const step2Visible =
      await page.getByText(/Países objetivo/i).first().isVisible({ timeout: 5_000 }).catch(() => false) ||
      await page.locator('button', { hasText: /^Colombia$/i }).first().isVisible({ timeout: 3_000 }).catch(() => false);

    await page.screenshot({ path: 'test-results/ES-08-back-to-step2.png' });
    expect(step2Visible, '"Atrás" from Step 3 should return to Step 2 (Países objetivo visible)').toBe(true);

    // ── Click Atrás from Step 2 → should go to Step 1 ──
    await clickAtras(page);

    // Step 1 shows line cards
    const step1Visible =
      await page.locator('button[aria-pressed]', { hasText: /Intralog/i }).first().isVisible({ timeout: 5_000 }).catch(() => false) ||
      await page.getByText(/Línea de negocio/i).first().isVisible({ timeout: 3_000 }).catch(() => false);

    await page.screenshot({ path: 'test-results/ES-08-back-to-step1.png' });
    expect(step1Visible, '"Atrás" from Step 2 should return to Step 1 (line cards visible)').toBe(true);
  });
});
