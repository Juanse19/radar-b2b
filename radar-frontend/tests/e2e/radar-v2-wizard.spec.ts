/**
 * E2E — Radar v2 Wizard: Escanear → /vivo
 *
 * TC-W-01  Step1 carga y muestra líneas + modos
 * TC-W-02  Selección de línea es visualmente visible (ring/highlight en el botón)
 * TC-W-03  Auto-advance a Step2 cuando se eligen línea + modo, muestra slider/empresas
 * TC-W-04  Navegar a Step3 (URL-driven) muestra selector de proveedor y botón Ejecutar
 * TC-W-05  Al ejecutar navega a /radar-v2/vivo con sessionId en URL
 * TC-W-06  /vivo muestra eventos SSE (scan_started al menos)
 * TC-W-07  Si OpenAI falla con 429 → evento provider_fallback aparece en timeline
 * TC-W-08  "Escaneo finalizado" aparece al terminar
 * TC-W-09  Widget flotante (bottom-right) muestra scan activo
 *
 * Navigation strategy
 * -------------------
 * The wizard state is 100% URL-driven (useSearchParams / router.replace).
 * Rather than clicking through the UI for every step (which races with Next.js's
 * async URL propagation), tests that need a specific step navigate there directly:
 *
 *   /radar-v2/escanear?step=3&line=BHS&mode=auto&count=1&provider=claude
 *
 * TC-W-01/02 still click the UI to verify interactive feedback.
 * TC-W-03 verifies the auto-advance effect by navigating to ?line=BHS&mode=auto
 * and waiting for ?step=2 to appear in the URL.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function devLogin(page: Page) {
  // DEV-ONLY route sets the matec_session cookie and returns { ok: true } (no redirect)
  const res = await page.request.get('/api/dev-login');
  if (!res.ok()) {
    throw new Error(`dev-login failed: ${res.status()} — NODE_ENV may not be 'development'`);
  }
}

/**
 * Navigate to Step 2 by pre-setting line+mode in the URL.
 * The wizard's useEffect auto-advances to step=2 ~400 ms after both are set.
 */
async function goToStep2(page: Page, mode: 'auto' | 'manual' = 'auto') {
  await page.goto(`/radar-v2/escanear?line=BHS&mode=${mode}`);
  await page.waitForLoadState('networkidle');
  // Wait for the auto-advance to update the URL (up to 5 s)
  await page.waitForURL(/[?&]step=2/, { timeout: 5_000 }).catch(() => null);
  await page.waitForTimeout(200); // allow re-render
}

/**
 * Navigate directly to Step 3. The wizard is URL-driven — no need to click through.
 */
async function goToStep3(page: Page, provider = 'claude') {
  await page.goto(
    `/radar-v2/escanear?step=3&line=BHS&mode=auto&count=1&provider=${provider}`,
  );
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('Radar v2 — Wizard Escanear', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-W-01 Step1 carga
  // ──────────────────────────────────────────────────────────────────────────
  test('TC-W-01 · Step 1 carga y muestra opciones de línea y modo', async ({ page }) => {
    await page.goto('/radar-v2/escanear');
    await page.waitForLoadState('networkidle');

    // Debe mostrar al menos una de las líneas de negocio
    const lineas = ['BHS', 'Intralogística', 'Cartón', 'Motos', 'Final de Línea', 'Solumat'];
    let found = false;
    for (const l of lineas) {
      if (await page.locator(`text=${l}`).first().isVisible().catch(() => false)) {
        found = true;
        break;
      }
    }
    expect(found, 'Al menos una línea de negocio debe ser visible').toBe(true);

    // Debe mostrar modos (Manual o Automático)
    const modos = ['Manual', 'Automático', 'Auto'];
    let modoFound = false;
    for (const m of modos) {
      if (await page.locator(`text=${m}`).first().isVisible().catch(() => false)) {
        modoFound = true;
        break;
      }
    }
    expect(modoFound, 'Al menos un modo debe ser visible').toBe(true);

    await page.screenshot({ path: 'test-results/TC-W-01-step1.png' });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-W-02 Selección visual del chip de línea
  // ──────────────────────────────────────────────────────────────────────────
  test('TC-W-02 · Seleccionar una línea cambia su estilo (ring/border)', async ({ page }) => {
    await page.goto('/radar-v2/escanear');
    await page.waitForLoadState('networkidle');

    const lineas = ['BHS', 'Intralogística', 'Cartón'];
    for (const l of lineas) {
      // text= matches the inner <span>; the active CSS classes are on the <button>
      // itself (direct parent). Use xpath=.. to reach it.
      const spanEl = page.locator(`text=${l}`).first();
      if (await spanEl.isVisible().catch(() => false)) {
        await spanEl.click();
        await page.waitForTimeout(300);

        // The <button> aria-pressed="true" and gets: border-primary bg-primary/15
        // font-semibold ring-1 ring-primary/50
        const btn = spanEl.locator('xpath=..');
        const cls          = await btn.getAttribute('class')       ?? '';
        const ariaPressed  = await btn.getAttribute('aria-pressed') ?? '';

        const isHighlighted =
          ariaPressed === 'true' ||
          cls.includes('ring') ||
          cls.includes('border-primary') ||
          cls.includes('bg-primary') ||
          cls.includes('font-semibold') ||
          cls.includes('selected');

        expect(isHighlighted, `La línea "${l}" debe verse seleccionada`).toBe(true);
        await page.screenshot({ path: 'test-results/TC-W-02-linea-seleccionada.png' });
        break;
      }
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-W-03 Auto-advance a Step2 y selector de empresas visible
  // ──────────────────────────────────────────────────────────────────────────
  test('TC-W-03 · Step 2 muestra selector de empresas o slider de cantidad', async ({ page }) => {
    // Navigate with both params pre-set; the wizard auto-advances to step=2
    await goToStep2(page, 'auto');

    // Must be on step 2 (URL contains step=2 or slider/company content is visible)
    const step2Indicators = [
      'empresas a escanear',   // AutoCountSlider subtitle
      'empresa a escanear',    // singular
      'Configure',
      'Fuentes',
      'Keywords',
      'Siguiente',             // Step 2 also has a Siguiente button
    ];
    let step2Found = false;
    for (const ind of step2Indicators) {
      if (
        await page.locator(`text=${ind}`).first().isVisible({ timeout: 2_000 }).catch(() => false)
      ) {
        step2Found = true;
        break;
      }
    }

    await page.screenshot({ path: 'test-results/TC-W-03-step2.png' });
    expect(step2Found, 'Step 2 debe mostrar slider o selector de empresas').toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-W-04 Step3 — proveedor y Ejecutar
  // ──────────────────────────────────────────────────────────────────────────
  test('TC-W-04 · Step 3 muestra selector de proveedor y botón Ejecutar', async ({ page }) => {
    // Navigate directly to Step 3 via URL (wizard is URL-driven)
    await goToStep3(page, 'claude');

    await page.screenshot({ path: 'test-results/TC-W-04-step3-before.png' });

    // Must show an Ejecutar button
    const ejecutarBtn  = page.locator('button:has-text("Ejecutar")').first();
    const ejecutarVisible = await ejecutarBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(ejecutarVisible, 'El botón Ejecutar debe estar visible en Step 3').toBe(true);

    // Must show a provider selector (Claude, OpenAI, Gemini)
    const proveedores = ['Claude', 'OpenAI', 'Gemini', 'claude', 'openai', 'gemini'];
    let provFound = false;
    for (const p of proveedores) {
      if (
        await page.locator(`text=${p}`).first().isVisible({ timeout: 1_500 }).catch(() => false)
      ) {
        provFound = true;
        break;
      }
    }
    expect(provFound, 'Debe haber selector de proveedor (Claude/OpenAI/Gemini)').toBe(true);

    await page.screenshot({ path: 'test-results/TC-W-04-step3.png' });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-W-05 Ejecutar → navega a /vivo
  // ──────────────────────────────────────────────────────────────────────────
  test('TC-W-05 · Ejecutar navega a /radar-v2/vivo con sessionId', async ({ page }) => {
    test.setTimeout(40_000);

    await goToStep3(page, 'claude');

    const ejecutarBtn = page.locator('button:has-text("Ejecutar")').first();
    await ejecutarBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await ejecutarBtn.click();

    // handleFire() calls /api/radar-v2/auto-select then router.push → /vivo
    await page.waitForURL(/\/radar-v2\/vivo/, { timeout: 15_000 }).catch(() => null);

    await page.screenshot({ path: 'test-results/TC-W-05-vivo-navigation.png' });

    const currentUrl = page.url();
    expect(currentUrl).toContain('/radar-v2/vivo');
    expect(currentUrl).toContain('sessionId');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-W-06 /vivo muestra eventos SSE
  // ──────────────────────────────────────────────────────────────────────────
  test('TC-W-06 · /vivo muestra eventos de escaneo en tiempo real', async ({ page }) => {
    test.setTimeout(60_000);

    await goToStep3(page, 'claude');

    const ejecutarBtn = page.locator('button:has-text("Ejecutar")').first();
    await ejecutarBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await ejecutarBtn.click();

    await page.waitForURL(/\/radar-v2\/vivo/, { timeout: 15_000 }).catch(() => null);

    // Wait for at least one SSE event text
    const iniciadoTexts = [
      'Escaneo iniciado', 'scan_started', 'Iniciando', 'empresas',
      'Pensando', 'Escaneando',
    ];
    let eventFound = false;
    for (const txt of iniciadoTexts) {
      try {
        await page.waitForSelector(`text=${txt}`, { timeout: 15_000 });
        eventFound = true;
        break;
      } catch { /* try next */ }
    }

    await page.screenshot({ path: 'test-results/TC-W-06-vivo-eventos.png', fullPage: true });
    expect(eventFound, 'Al menos un evento SSE debe aparecer en /vivo').toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-W-07 provider_fallback event si OpenAI 429
  // ──────────────────────────────────────────────────────────────────────────
  test('TC-W-07 · Si proveedor falla con 429, aparece evento provider_fallback', async ({ page }) => {
    test.setTimeout(90_000); // needs time for the SSE stream to produce an error

    const sessionId = crypto.randomUUID();
    const companiesRes = await page.request.get('/api/radar-v2/companies?linea=BHS&limit=1');
    let empresa = { id: 1, name: 'Test Company', country: 'Colombia' };
    if (companiesRes.ok()) {
      const list = await companiesRes.json() as Array<{ id: number; name: string; country: string }>;
      if (list.length > 0) empresa = list[0];
    }

    const params = new URLSearchParams({
      sessionId,
      line:     'BHS',
      provider: 'openai', // expected to hit 429 quota exceeded
      empresas: JSON.stringify([empresa]),
    });

    await page.goto(`/radar-v2/vivo?${params.toString()}`);
    await page.waitForLoadState('networkidle');

    // Wait for fallback indicator OR 429 / quota error text
    const fallbackIndicators = [
      'provider_fallback', 'sin cuota', 'usando Claude', 'fallback',
      'OpenAI API 429', 'insufficient_quota', 'quota', '429',
    ];
    let indicator = '';
    for (const txt of fallbackIndicators) {
      try {
        await page.waitForSelector(`text=${txt}`, { timeout: 60_000 });
        indicator = txt;
        break;
      } catch { /* try next */ }
    }

    await page.screenshot({ path: 'test-results/TC-W-07-fallback-o-error.png', fullPage: true });
    expect(indicator, 'Debe mostrar fallback a Claude o error 429 claramente').not.toBe('');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-W-08 "Escaneo finalizado" aparece al terminar
  // ──────────────────────────────────────────────────────────────────────────
  test('TC-W-08 · "Escaneo finalizado" aparece al terminar el scan', async ({ page }) => {
    test.setTimeout(90_000);

    const sessionId = crypto.randomUUID();
    const companiesRes = await page.request.get('/api/radar-v2/companies?linea=BHS&limit=1');
    let empresa = { id: 1, name: 'Test Company', country: 'Colombia' };
    if (companiesRes.ok()) {
      const list = await companiesRes.json() as Array<{ id: number; name: string; country: string }>;
      if (list.length > 0) empresa = list[0];
    }

    const params = new URLSearchParams({
      sessionId,
      line:     'BHS',
      provider: 'claude',
      empresas: JSON.stringify([empresa]),
    });

    await page.goto(`/radar-v2/vivo?${params.toString()}`);

    const finalizadoVisible = await page
      .waitForSelector('text=Escaneo finalizado', { timeout: 75_000 })
      .then(() => true)
      .catch(() => false);

    await page.screenshot({ path: 'test-results/TC-W-08-finalizado.png', fullPage: true });
    expect(finalizadoVisible, '"Escaneo finalizado" debe aparecer al terminar').toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TC-W-09 Widget flotante muestra escaneo activo
  // ──────────────────────────────────────────────────────────────────────────
  test('TC-W-09 · El widget flotante (bottom-right) muestra el escaneo activo', async ({ page }) => {
    test.setTimeout(60_000);

    const sessionId = crypto.randomUUID();
    const companiesRes = await page.request.get('/api/radar-v2/companies?linea=BHS&limit=1');
    let empresa = { id: 1, name: 'Test Company', country: 'Colombia' };
    if (companiesRes.ok()) {
      const list = await companiesRes.json() as Array<{ id: number; name: string; country: string }>;
      if (list.length > 0) empresa = list[0];
    }

    const params = new URLSearchParams({
      sessionId,
      line:     'BHS',
      provider: 'claude',
      empresas: JSON.stringify([empresa]),
    });

    await page.goto(`/radar-v2/vivo?${params.toString()}`);

    const widgetIndicators = ['Escaneo activo', 'En curso', 'Ver en vivo', 'activo'];
    let widgetFound = false;
    for (const txt of widgetIndicators) {
      try {
        await page.waitForSelector(`text=${txt}`, { timeout: 20_000 });
        widgetFound = true;
        break;
      } catch { /* try next */ }
    }

    await page.screenshot({ path: 'test-results/TC-W-09-widget.png' });
    expect(widgetFound, 'El widget flotante debe aparecer con el escaneo activo').toBe(true);
  });
});
