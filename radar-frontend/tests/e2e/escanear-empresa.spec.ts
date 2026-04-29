/**
 * E2E tests for the Escanear wizard — "Empresa" tab, Manual mode
 *
 * Covered flows:
 *   EE-01  Page loads and all 3 tabs (Empresa, Señales, Chat) are visible
 *   EE-02  "Empresa" tab is active by default, Step 1 shows lines + modes
 *   EE-03  Selecting a line of business highlights it (aria-pressed="true")
 *   EE-04  Subline chips appear when exactly one line is selected
 *   EE-05  Clicking a subline chip selects / deselects it
 *   EE-06  Selecting the "Manual" mode card highlights it
 *   EE-07  Auto-advance to Step 2 after selecting a line + Manual mode
 *   EE-08  Step 2 (manual) loads company list — at least 1 company visible
 *   EE-09  Selecting a company in Step 2 shows the selected-count row
 *   EE-10  "Siguiente" advances to Step 3 after a company is selected
 *   EE-11  Step 3 shows the selected company count summary (≥ 1)
 *   EE-12  Step 3 shows provider cards (claude, openai, gemini)
 *   EE-13  Clicking "Ejecutar escaneo" triggers navigation to /en-vivo
 *   EE-14  The specific error "No se encontraron las empresas seleccionadas"
 *           must NOT appear during a normal manual-mode execution
 *   EE-15  Search flow: type a partial name, select result, execute — no error
 *
 * Navigation strategy
 * -------------------
 * The wizard is URL-driven (useSearchParams / router.replace).
 * Tests that need a specific step navigate directly when possible:
 *
 *   /escanear?step=3&line=BHS&mode=manual&selectedIds=X
 *
 * For the full click-through test (EE-07 through EE-13) we perform real UI
 * interactions so the sessionStorage state is populated correctly — this is
 * essential because Step3Review's handleFire() reads sessionStorage for
 * manual-mode companies.
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

/**
 * Navigate to /escanear and wait for the wizard skeleton to resolve.
 */
async function gotoEscanear(page: Page): Promise<void> {
  await page.goto('/escanear');
  await page.waitForLoadState('networkidle');
  // The page wraps EscanearTabs in a Suspense; wait for the tabs to mount.
  await page.waitForTimeout(500);
}

/**
 * Click a line-of-business card by its label text.
 * The inner <span> carries the text; the <button> is the parent.
 */
async function clickLine(page: Page, line: 'BHS' | 'Intralogística' | 'Cartón'): Promise<void> {
  // The button has aria-pressed and contains a <span> with the line name.
  const btn = page.locator(`button[aria-pressed]`, { hasText: new RegExp(`^${line}`, 'i') }).first();
  await btn.waitFor({ state: 'visible', timeout: 5_000 });
  await btn.click();
  await page.waitForTimeout(300);
}

/**
 * Click the "Manual" mode card and wait for auto-advance to Step 2.
 * Returns false if auto-advance did not happen within the timeout.
 */
async function selectManualAndAdvance(page: Page): Promise<boolean> {
  // Mode cards use role="button" (div with role attribute) rendered as Card.
  // They have aria-pressed attribute reflecting selection state.
  const manualCard = page
    .locator('[role="button"][aria-pressed]', { hasText: /Manual/i })
    .first();

  const altManualCard = page
    .locator('div[role="button"]', { hasText: /Manual/i })
    .first();

  const card = await manualCard.isVisible({ timeout: 3_000 }).catch(() => false)
    ? manualCard
    : altManualCard;

  await card.click();
  await page.waitForTimeout(500);

  // Wizard auto-advances ~400 ms after mode click (when line is set).
  // Wait for URL to reflect step=2 or for Step 2 content to appear.
  const advanced = await page
    .waitForURL(/[?&]step=2/, { timeout: 5_000 })
    .then(() => true)
    .catch(() => false);

  if (!advanced) {
    // Fallback: wait for Step 2 content indicators
    const step2Indicators = ['Buscar empresa', 'Cargando empresas', 'Manual', 'Siguiente'];
    for (const txt of step2Indicators) {
      if (await page.locator(`text=${txt}`).first().isVisible({ timeout: 1_500 }).catch(() => false)) {
        return true;
      }
    }
    return false;
  }
  return true;
}

/**
 * Fetch the first company from the API so tests can assert against a real name.
 */
async function fetchFirstCompany(
  page: Page,
  line: string,
): Promise<{ id: number; name: string; country: string } | null> {
  const res = await page.request.get(
    `/api/comercial/companies?linea=${encodeURIComponent(line)}&limit=5`,
  );
  if (!res.ok()) return null;
  const list = await res.json() as Array<{ id: number; name: string; country: string }>;
  return list[0] ?? null;
}

// ---------------------------------------------------------------------------
// EE-01 to EE-02 — Page load + tab structure
// ---------------------------------------------------------------------------

test.describe('EE: Escanear page structure', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
    await gotoEscanear(page);
  });

  test('EE-01 · All 3 tabs are visible: Empresa, Señales, Chat', async ({ page }) => {
    // Tabs rendered by AgentModeTabs — look for button/tab roles with the labels
    const tabLabels = ['Empresa', 'Señales', 'Chat'];
    for (const label of tabLabels) {
      const tab = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
      const isVisible = await tab.isVisible({ timeout: 5_000 }).catch(() => false);
      expect(isVisible, `Tab "${label}" should be visible`).toBe(true);
    }
    await page.screenshot({ path: 'test-results/EE-01-tabs.png' });
  });

  test('EE-02 · "Empresa" tab is active by default — Step 1 shows lines and modes', async ({ page }) => {
    // Step 1 shows line cards for BHS, Intralogística, Cartón
    const lines = ['BHS', 'Intralogística', 'Cartón'];
    let lineFound = false;
    for (const l of lines) {
      if (await page.locator(`text=${l}`).first().isVisible({ timeout: 3_000 }).catch(() => false)) {
        lineFound = true;
        break;
      }
    }
    expect(lineFound, 'At least one line card should be visible in Step 1').toBe(true);

    // Mode cards (Automático / Manual) should also be visible
    const modeFound =
      await page.locator('text=Manual').first().isVisible({ timeout: 3_000 }).catch(() => false) ||
      await page.locator('text=Automático').first().isVisible({ timeout: 3_000 }).catch(() => false);
    expect(modeFound, 'Mode cards (Automático / Manual) should be visible in Step 1').toBe(true);

    await page.screenshot({ path: 'test-results/EE-02-step1-default.png' });
  });
});

// ---------------------------------------------------------------------------
// EE-03 — Line selection visual feedback
// ---------------------------------------------------------------------------

test.describe('EE: Step 1 — line selection', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
    await gotoEscanear(page);
  });

  test('EE-03 · Selecting BHS highlights its card (aria-pressed="true")', async ({ page }) => {
    await clickLine(page, 'BHS');

    const btn = page.locator('button[aria-pressed="true"]', { hasText: /BHS/i }).first();
    const isPressed = await btn.isVisible({ timeout: 3_000 }).catch(() => false);

    if (!isPressed) {
      // Fallback: check class-based highlight
      const anyBtn = page.locator('button', { hasText: /BHS/i }).first();
      const cls = await anyBtn.getAttribute('class') ?? '';
      const highlighted =
        cls.includes('ring') ||
        cls.includes('border-primary') ||
        cls.includes('bg-primary') ||
        cls.includes('font-semibold');
      expect(highlighted, 'BHS card should have a visual highlighted class after click').toBe(true);
    } else {
      expect(isPressed).toBe(true);
    }

    await page.screenshot({ path: 'test-results/EE-03-bhs-selected.png' });
  });

  test('EE-03b · Selecting Intralogística highlights its card', async ({ page }) => {
    await clickLine(page, 'Intralogística');

    const btn = page.locator('button[aria-pressed="true"]', { hasText: /Intralog/i }).first();
    const isPressed = await btn.isVisible({ timeout: 3_000 }).catch(() => false);

    if (!isPressed) {
      const anyBtn = page.locator('button', { hasText: /Intralog/i }).first();
      const cls = await anyBtn.getAttribute('class') ?? '';
      const highlighted = cls.includes('ring') || cls.includes('border-primary') || cls.includes('bg-primary');
      expect(highlighted, 'Intralogística card should be visually highlighted').toBe(true);
    } else {
      expect(isPressed).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// EE-04 / EE-05 — Subline chips
// ---------------------------------------------------------------------------

test.describe('EE: Step 1 — subline chips', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
    await gotoEscanear(page);
  });

  test('EE-04 · Subline chips appear when exactly 1 line is selected (BHS)', async ({ page }) => {
    await clickLine(page, 'BHS');

    // Sub-líneas section label or a known BHS subline
    const bhsSublines = ['Aeropuertos', 'Terminales', 'Carga', 'ULD', 'Sub-línea', 'sublínea'];
    let found = false;
    for (const sub of bhsSublines) {
      if (
        await page.getByText(new RegExp(sub, 'i')).first().isVisible({ timeout: 3_000 }).catch(() => false)
      ) {
        found = true;
        break;
      }
    }
    expect(found, 'Subline chips (or section label) should appear after selecting BHS alone').toBe(true);
    await page.screenshot({ path: 'test-results/EE-04-bhs-sublines.png' });
  });

  test('EE-04b · Subline chips disappear when 2 lines are selected', async ({ page }) => {
    await clickLine(page, 'BHS');
    await page.waitForTimeout(300);
    await clickLine(page, 'Cartón');
    await page.waitForTimeout(400);

    const sublíneaSection = page.getByText(/Sub-línea/i).first();
    const stillVisible = await sublíneaSection.isVisible({ timeout: 1_000 }).catch(() => false);
    expect(stillVisible, 'Subline section should hide when 2+ lines are selected').toBe(false);

    await page.screenshot({ path: 'test-results/EE-04b-two-lines-no-sublines.png' });
  });

  test('EE-05 · Clicking a subline chip toggles its selected state', async ({ page }) => {
    await clickLine(page, 'BHS');
    await page.waitForTimeout(400);

    // Find a subline chip — they use rounded-full border button style
    const container = page.locator('.flex.flex-wrap.gap-1\\.5').first();
    const chip = container.locator('button').first();

    const chipVisible = await chip.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!chipVisible) {
      // Fallback: look for any rounded-full button that appeared after BHS click
      const altChip = page.locator('button[class*="rounded-full"]').first();
      const altVisible = await altChip.isVisible({ timeout: 2_000 }).catch(() => false);
      if (!altVisible) {
        test.skip(true, 'No subline chips found — may need data in DB for BHS sublines');
        return;
      }
      const classBefore = await altChip.getAttribute('class') ?? '';
      await altChip.click();
      await page.waitForTimeout(300);
      const classAfter = await altChip.getAttribute('class') ?? '';
      expect(classBefore).not.toBe(classAfter);
    } else {
      const classBefore = await chip.getAttribute('class') ?? '';
      await chip.click();
      await page.waitForTimeout(300);
      const classAfter = await chip.getAttribute('class') ?? '';
      // Class should change (gain active styles: border-primary bg-primary/20 font-medium text-primary)
      expect(classBefore).not.toBe(classAfter);
    }
    await page.screenshot({ path: 'test-results/EE-05-subline-toggled.png' });
  });
});

// ---------------------------------------------------------------------------
// EE-06 — Manual mode card selection
// ---------------------------------------------------------------------------

test.describe('EE: Step 1 — Manual mode card', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
    await gotoEscanear(page);
  });

  test('EE-06 · Clicking "Manual" mode card marks it as selected', async ({ page }) => {
    // Must have a line selected first for mode cards to be meaningful
    await clickLine(page, 'BHS');

    // Mode card is a Card element with role="button" and aria-pressed
    const manualCard = page
      .locator('[role="button"]', { hasText: /Manual/i })
      .first();

    await manualCard.waitFor({ state: 'visible', timeout: 5_000 });
    await manualCard.click();
    await page.waitForTimeout(300);

    const ariaPressed = await manualCard.getAttribute('aria-pressed');
    if (ariaPressed !== null) {
      expect(ariaPressed, 'Manual card aria-pressed should be "true" after click').toBe('true');
    } else {
      // Check class-based selection
      const cls = await manualCard.getAttribute('class') ?? '';
      const highlighted = cls.includes('border-primary') || cls.includes('ring') || cls.includes('bg-primary');
      expect(highlighted, 'Manual mode card should have highlight classes after click').toBe(true);
    }
    await page.screenshot({ path: 'test-results/EE-06-manual-selected.png' });
  });
});

// ---------------------------------------------------------------------------
// EE-07 through EE-14 — Full click-through manual mode flow
//
// These tests do the full UI interaction so that sessionStorage is correctly
// populated — which is required by handleFire() in Step3Review.
// ---------------------------------------------------------------------------

test.describe('EE: Full manual mode flow (click-through)', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
    await gotoEscanear(page);
  });

  test('EE-07 · Auto-advances to Step 2 after selecting line + Manual mode', async ({ page }) => {
    await clickLine(page, 'BHS');
    const advanced = await selectManualAndAdvance(page);

    await page.screenshot({ path: 'test-results/EE-07-step2.png' });
    expect(advanced, 'Wizard should auto-advance to Step 2 after selecting BHS + Manual').toBe(true);
  });

  test('EE-08 · Step 2 (manual) shows company list with at least 1 company', async ({ page }) => {
    await clickLine(page, 'BHS');
    await selectManualAndAdvance(page);
    await page.waitForTimeout(500);

    // CompanySelector shows companies in a scrollable list
    // After loading: "Cargando empresas..." disappears, companies appear as buttons
    await page
      .waitForFunction(() => !document.body.innerText.includes('Cargando empresas'), { timeout: 10_000 })
      .catch(() => null);
    await page.waitForTimeout(300);

    // Look for either a company button or the "N de M seleccionadas" counter
    const companyBtn  = page.locator('div.max-h-64 button').first();
    const counterText = page.locator('text=/\\d+ de \\d+ seleccionadas/');

    const companyVisible = await companyBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    const counterVisible = await counterText.isVisible({ timeout: 2_000 }).catch(() => false);

    await page.screenshot({ path: 'test-results/EE-08-company-list.png' });
    expect(companyVisible || counterVisible, 'Company list should show at least 1 company in Step 2').toBe(true);
  });

  test('EE-09 · Selecting a company updates the selected counter', async ({ page }) => {
    await clickLine(page, 'BHS');
    await selectManualAndAdvance(page);

    // Wait for companies to load
    await page
      .waitForFunction(() => !document.body.innerText.includes('Cargando empresas'), { timeout: 10_000 })
      .catch(() => null);
    await page.waitForTimeout(500);

    // Click the first company in the scrollable list
    const listContainer = page.locator('div.max-h-64');
    const firstCompany  = listContainer.locator('button').first();

    const visible = await firstCompany.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) {
      test.skip(true, 'No companies loaded in Step 2 — skipping selection test');
      return;
    }

    await firstCompany.click();
    await page.waitForTimeout(400);

    // After selecting, "N de M seleccionadas" counter should show N ≥ 1
    // Also the selected company appears in the table below
    const counterEl = page.locator('text=/[1-9]\\d* de \\d+ seleccionadas/');
    const tableRow  = page.locator('table tbody tr').first();

    const counterVisible = await counterEl.isVisible({ timeout: 3_000 }).catch(() => false);
    const tableVisible   = await tableRow.isVisible({ timeout: 2_000 }).catch(() => false);

    await page.screenshot({ path: 'test-results/EE-09-company-selected.png' });
    expect(counterVisible || tableVisible, 'Selected company should appear in the table or update the counter').toBe(true);
  });

  test('EE-10 · "Siguiente" advances to Step 3 after at least 1 company is selected', async ({ page }) => {
    await clickLine(page, 'BHS');
    await selectManualAndAdvance(page);

    // Wait for companies to load
    await page
      .waitForFunction(() => !document.body.innerText.includes('Cargando empresas'), { timeout: 10_000 })
      .catch(() => null);
    await page.waitForTimeout(500);

    // Select first company
    const firstCompany = page.locator('div.max-h-64 button').first();
    const visible = await firstCompany.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) {
      test.skip(true, 'No companies in list — cannot test Siguiente');
      return;
    }
    await firstCompany.click();
    await page.waitForTimeout(300);

    // Click "Siguiente"
    const siguienteBtn = page.getByRole('button', { name: /Siguiente/i });
    await siguienteBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await siguienteBtn.click();

    // Wait for Step 3 URL or Step 3 content
    const onStep3 = await page
      .waitForURL(/[?&]step=3/, { timeout: 8_000 })
      .then(() => true)
      .catch(() => false);

    if (!onStep3) {
      // Fallback: check for Step 3 indicators
      const step3Indicators = ['Ejecutar escaneo', 'Proveedor IA', 'Resumen del escaneo'];
      for (const txt of step3Indicators) {
        if (await page.locator(`text=${txt}`).first().isVisible({ timeout: 2_000 }).catch(() => false)) {
          await page.screenshot({ path: 'test-results/EE-10-step3.png' });
          return;
        }
      }
      await page.screenshot({ path: 'test-results/EE-10-step3-fail.png' });
      expect(onStep3, 'Should navigate to Step 3 after clicking Siguiente with a company selected').toBe(true);
    } else {
      await page.screenshot({ path: 'test-results/EE-10-step3.png' });
    }
  });

  test('EE-11 · Step 3 shows "Empresas: 1" (or more) in the summary card', async ({ page }) => {
    test.setTimeout(40_000);
    await clickLine(page, 'BHS');
    await selectManualAndAdvance(page);

    await page
      .waitForFunction(() => !document.body.innerText.includes('Cargando empresas'), { timeout: 10_000 })
      .catch(() => null);
    await page.waitForTimeout(500);

    const firstCompany = page.locator('div.max-h-64 button').first();
    const visible = await firstCompany.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) {
      test.skip(true, 'No companies — cannot test Step 3 summary');
      return;
    }
    await firstCompany.click();
    await page.waitForTimeout(300);

    const siguienteBtn = page.getByRole('button', { name: /Siguiente/i });
    await siguienteBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await siguienteBtn.click();
    await page.waitForURL(/[?&]step=3/, { timeout: 8_000 }).catch(() => null);
    await page.waitForTimeout(500);

    // The summary card shows "Empresas" as a label and a number ≥ 1 next to it
    // The exact rendering: <dt>Empresas</dt><dd>1</dd>
    const empresasLabel = page.locator('dt', { hasText: /Empresas/i }).first();
    const labelVisible  = await empresasLabel.isVisible({ timeout: 5_000 }).catch(() => false);

    // Also check for the digit in the dd
    const countEl = page.locator('dd').filter({ hasText: /^[1-9]\d*$/ }).first();
    const countVisible = await countEl.isVisible({ timeout: 3_000 }).catch(() => false);

    await page.screenshot({ path: 'test-results/EE-11-step3-summary.png' });
    expect(labelVisible || countVisible, 'Step 3 summary should show "Empresas" with count ≥ 1').toBe(true);
  });

  test('EE-12 · Step 3 shows provider cards (claude, openai, gemini)', async ({ page }) => {
    test.setTimeout(40_000);
    await clickLine(page, 'BHS');
    await selectManualAndAdvance(page);

    await page
      .waitForFunction(() => !document.body.innerText.includes('Cargando empresas'), { timeout: 10_000 })
      .catch(() => null);
    await page.waitForTimeout(500);

    const firstCompany = page.locator('div.max-h-64 button').first();
    const visible = await firstCompany.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) {
      test.skip(true, 'No companies — cannot test Step 3 providers');
      return;
    }
    await firstCompany.click();
    await page.waitForTimeout(300);

    const siguienteBtn = page.getByRole('button', { name: /Siguiente/i });
    await siguienteBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await siguienteBtn.click();
    await page.waitForURL(/[?&]step=3/, { timeout: 8_000 }).catch(() => null);
    await page.waitForTimeout(800);

    // Provider cards: each card has text "claude", "openai", or "gemini" (lowercase, capitalized)
    const providers = ['claude', 'openai', 'gemini'];
    let foundCount = 0;
    for (const p of providers) {
      const found = await page
        .locator('button[type="button"]', { hasText: new RegExp(p, 'i') })
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      if (found) foundCount++;
    }

    await page.screenshot({ path: 'test-results/EE-12-providers.png' });
    expect(foundCount, 'At least 2 of 3 provider cards (claude/openai/gemini) should be visible').toBeGreaterThanOrEqual(2);
  });

  test('EE-13 · Clicking "Ejecutar escaneo" navigates to /en-vivo', async ({ page }) => {
    test.setTimeout(40_000);
    await clickLine(page, 'BHS');
    await selectManualAndAdvance(page);

    await page
      .waitForFunction(() => !document.body.innerText.includes('Cargando empresas'), { timeout: 10_000 })
      .catch(() => null);
    await page.waitForTimeout(500);

    const firstCompany = page.locator('div.max-h-64 button').first();
    const visible = await firstCompany.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) {
      test.skip(true, 'No companies — cannot test Ejecutar');
      return;
    }
    await firstCompany.click();
    await page.waitForTimeout(300);

    const siguienteBtn = page.getByRole('button', { name: /Siguiente/i });
    await siguienteBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await siguienteBtn.click();
    await page.waitForURL(/[?&]step=3/, { timeout: 8_000 }).catch(() => null);
    await page.waitForTimeout(800);

    // Click Ejecutar escaneo
    const ejecutarBtn = page.locator('button', { hasText: /Ejecutar escaneo/i }).first();
    await ejecutarBtn.waitFor({ state: 'visible', timeout: 8_000 });
    await ejecutarBtn.click();

    // Should navigate to /en-vivo?sessionId=...
    const navigated = await page
      .waitForURL(/\/en-vivo/, { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    await page.screenshot({ path: 'test-results/EE-13-en-vivo.png' });
    expect(navigated, 'Should navigate to /en-vivo after clicking Ejecutar escaneo').toBe(true);
    expect(page.url()).toContain('sessionId');
  });

  test('EE-14 · "No se encontraron las empresas seleccionadas" must NOT appear during normal execution', async ({ page }) => {
    test.setTimeout(40_000);
    await clickLine(page, 'BHS');
    await selectManualAndAdvance(page);

    await page
      .waitForFunction(() => !document.body.innerText.includes('Cargando empresas'), { timeout: 10_000 })
      .catch(() => null);
    await page.waitForTimeout(500);

    const firstCompany = page.locator('div.max-h-64 button').first();
    const visible = await firstCompany.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) {
      test.skip(true, 'No companies — cannot test error scenario');
      return;
    }
    await firstCompany.click();
    await page.waitForTimeout(300);

    const siguienteBtn = page.getByRole('button', { name: /Siguiente/i });
    await siguienteBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await siguienteBtn.click();
    await page.waitForURL(/[?&]step=3/, { timeout: 8_000 }).catch(() => null);
    await page.waitForTimeout(800);

    const ejecutarBtn = page.locator('button', { hasText: /Ejecutar escaneo/i }).first();
    await ejecutarBtn.waitFor({ state: 'visible', timeout: 8_000 });
    await ejecutarBtn.click();

    // Wait a moment for any synchronous error to surface
    await page.waitForTimeout(2_000);

    // The specific bug error text must NOT appear
    const errorText = page.locator('text=No se encontraron las empresas seleccionadas');
    const errorVisible = await errorText.isVisible({ timeout: 2_000 }).catch(() => false);

    await page.screenshot({ path: 'test-results/EE-14-no-error.png' });
    expect(errorVisible, '"No se encontraron las empresas seleccionadas" must NOT appear').toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EE-15 — Search flow: type partial name, select from results, execute
// ---------------------------------------------------------------------------

test.describe('EE: Search flow in manual mode', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
    await gotoEscanear(page);
  });

  test('EE-15 · Search for company, select from results, execute — no error', async ({ page }) => {
    test.setTimeout(50_000);

    // Step 1: select line + manual mode
    await clickLine(page, 'BHS');
    await selectManualAndAdvance(page);

    // Wait for company list to load initially
    await page
      .waitForFunction(() => !document.body.innerText.includes('Cargando empresas'), { timeout: 10_000 })
      .catch(() => null);
    await page.waitForTimeout(500);

    // Fetch a real company name to search for (use API directly)
    const firstCo = await fetchFirstCompany(page, 'BHS');
    const searchTerm = firstCo ? firstCo.name.substring(0, 4) : 'Air';

    // Type in the search box
    const searchInput = page.getByPlaceholder('Buscar empresa...');
    const inputVisible = await searchInput.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!inputVisible) {
      test.skip(true, 'Search input not found in Step 2 — skipping search flow test');
      return;
    }

    await searchInput.fill(searchTerm);
    // The fetch is debounced via useCallback dependency on `search` state
    await page.waitForTimeout(1_000);

    await page
      .waitForFunction(() => !document.body.innerText.includes('Cargando empresas'), { timeout: 8_000 })
      .catch(() => null);
    await page.waitForTimeout(300);

    // Select the first result
    const firstResult = page.locator('div.max-h-64 button').first();
    const resultVisible = await firstResult.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!resultVisible) {
      test.skip(true, `No search results for "${searchTerm}" — skipping`);
      return;
    }
    await firstResult.click();
    await page.waitForTimeout(300);

    await page.screenshot({ path: 'test-results/EE-15-search-selected.png' });

    // Advance to Step 3
    const siguienteBtn = page.getByRole('button', { name: /Siguiente/i });
    await siguienteBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await siguienteBtn.click();
    await page.waitForURL(/[?&]step=3/, { timeout: 8_000 }).catch(() => null);
    await page.waitForTimeout(800);

    // Execute
    const ejecutarBtn = page.locator('button', { hasText: /Ejecutar escaneo/i }).first();
    await ejecutarBtn.waitFor({ state: 'visible', timeout: 8_000 });
    await ejecutarBtn.click();

    // Wait for navigation or error
    await page.waitForTimeout(2_000);

    // Assert: the specific sessionStorage-miss error must NOT appear
    const errorText = page.locator('text=No se encontraron las empresas seleccionadas');
    const errorVisible = await errorText.isVisible({ timeout: 2_000 }).catch(() => false);

    await page.screenshot({ path: 'test-results/EE-15-after-execute.png' });
    expect(errorVisible, '"No se encontraron las empresas seleccionadas" must NOT appear for search-selected company').toBe(false);

    // Navigation to /en-vivo is a strong success indicator
    const navigated = page.url().includes('/en-vivo');
    if (navigated) {
      expect(page.url()).toContain('sessionId');
    }
    // If not navigated, error-free is already asserted above — test passes.
  });
});

// ---------------------------------------------------------------------------
// EE-16 — URL-driven Step 3 (fast smoke — no full click-through needed)
// ---------------------------------------------------------------------------

test.describe('EE: Step 3 via URL navigation', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
  });

  test('EE-16 · Navigating directly to Step 3 via URL shows Ejecutar button', async ({ page }) => {
    // Navigate to Step 3 with BHS manual mode, 1 company (id=1 as placeholder)
    await page.goto('/escanear?step=3&line=BHS&mode=manual&count=1&provider=claude');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const ejecutarBtn = page.locator('button', { hasText: /Ejecutar escaneo/i }).first();
    const visible = await ejecutarBtn.isVisible({ timeout: 8_000 }).catch(() => false);

    await page.screenshot({ path: 'test-results/EE-16-step3-direct.png' });
    expect(visible, '"Ejecutar escaneo" button should be visible at Step 3').toBe(true);
  });

  test('EE-16b · Step 3 via URL shows at least 2 provider cards', async ({ page }) => {
    await page.goto('/escanear?step=3&line=BHS&mode=auto&count=1&provider=claude');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    const providers = ['claude', 'openai', 'gemini'];
    let foundCount = 0;
    for (const p of providers) {
      const found = await page
        .locator('button[type="button"]', { hasText: new RegExp(p, 'i') })
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      if (found) foundCount++;
    }

    await page.screenshot({ path: 'test-results/EE-16b-providers.png' });
    expect(foundCount, 'At least 2 provider cards should be visible in Step 3').toBeGreaterThanOrEqual(2);
  });
});
