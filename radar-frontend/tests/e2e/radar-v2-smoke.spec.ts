/**
 * E2E Smoke Tests — Radar v2 Production Flows
 *
 * TC-SMOKE-01  /comercial/escanear carga sin errores
 * TC-SMOKE-02  Wizard step 1 permite seleccionar línea BHS
 * TC-SMOKE-03  Wizard step 1 permite seleccionar modo Automático
 * TC-SMOKE-04  El wizard avanza al step 2 con "Continuar" (auto-advance)
 * TC-SMOKE-05  Step 3 muestra estimado de costo o loading state
 * TC-SMOKE-06  El proveedor Claude aparece como opción en step 3
 * TC-SMOKE-07  /comercial/resultados carga sin errores 500
 * TC-SMOKE-08  /comercial/metricas carga sin errores
 * TC-SMOKE-09  El breadcrumb muestra "Radar v2" en las sub-páginas
 *
 * These tests NEVER launch a real scan — they only verify UI rendering
 * and navigation, consuming zero AI provider tokens.
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Auth helper — mirrors the pattern used in comercial-wizard.spec.ts
// ---------------------------------------------------------------------------

async function devLogin(page: Page) {
  const res = await page.request.get('/api/dev-login');
  if (!res.ok()) {
    throw new Error(
      `dev-login failed: ${res.status()} — NODE_ENV may not be 'development'`,
    );
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('Radar v2 — Smoke Tests (producción)', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
  });

  // ── TC-SMOKE-01 ────────────────────────────────────────────────────────────
  test(
    'TC-SMOKE-01 · /comercial/escanear carga sin errores',
    async ({ page }) => {
      const response = await page.goto('/escanear');
      await page.waitForLoadState('networkidle', { timeout: 10_000 });

      // Must not be a 500 error page
      expect(response?.status() ?? 200).toBeLessThan(500);

      // The page should render something meaningful (not a blank body)
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.trim().length).toBeGreaterThan(10);

      await page.screenshot({ path: 'test-results/TC-SMOKE-01-escanear.png' });
    },
  );

  // ── TC-SMOKE-02 ────────────────────────────────────────────────────────────
  test(
    'TC-SMOKE-02 · Wizard step 1 permite seleccionar línea BHS',
    async ({ page }) => {
      await page.goto('/escanear');
      await page.waitForLoadState('networkidle', { timeout: 10_000 });

      // Find the BHS chip and click it
      const bhsText = page.locator('text=BHS').first();
      await expect(bhsText).toBeVisible({ timeout: 8_000 });
      await bhsText.click();
      await page.waitForTimeout(300);

      // After clicking, the button parent should be highlighted:
      // aria-pressed=true OR ring/border-primary CSS classes
      const btn = bhsText.locator('xpath=..');
      const ariaPressed = await btn.getAttribute('aria-pressed').catch(() => '');
      const cls = await btn.getAttribute('class').catch(() => '');

      const isHighlighted =
        ariaPressed === 'true' ||
        (cls?.includes('ring') ?? false) ||
        (cls?.includes('border-primary') ?? false) ||
        (cls?.includes('bg-primary') ?? false) ||
        (cls?.includes('font-semibold') ?? false);

      expect(
        isHighlighted,
        'BHS button debe verse seleccionado tras el click',
      ).toBe(true);

      await page.screenshot({ path: 'test-results/TC-SMOKE-02-bhs-selected.png' });
    },
  );

  // ── TC-SMOKE-03 ────────────────────────────────────────────────────────────
  test(
    'TC-SMOKE-03 · Wizard step 1 permite seleccionar modo Automático',
    async ({ page }) => {
      await page.goto('/escanear');
      await page.waitForLoadState('networkidle', { timeout: 10_000 });

      // Look for any text that represents the Automatic mode option
      const modeTexts = ['Automático', 'Automatico', 'Auto'];
      let modeElement = null;
      for (const label of modeTexts) {
        const el = page.locator(`text=${label}`).first();
        if (await el.isVisible({ timeout: 3_000 }).catch(() => false)) {
          modeElement = el;
          break;
        }
      }

      expect(modeElement, 'El modo Automático debe existir en step 1').not.toBeNull();

      await modeElement!.click();
      await page.waitForTimeout(300);

      // After clicking, the button (or its parent) should be selected
      const parentBtn = modeElement!.locator('xpath=..');
      const ariaPressed = await parentBtn.getAttribute('aria-pressed').catch(() => '');
      const cls = await parentBtn.getAttribute('class').catch(() => '');

      const isSelected =
        ariaPressed === 'true' ||
        (cls?.includes('ring') ?? false) ||
        (cls?.includes('border-primary') ?? false) ||
        (cls?.includes('bg-primary') ?? false) ||
        (cls?.includes('font-semibold') ?? false);

      expect(
        isSelected,
        'El modo Automático debe verse seleccionado tras el click',
      ).toBe(true);

      await page.screenshot({
        path: 'test-results/TC-SMOKE-03-mode-auto-selected.png',
      });
    },
  );

  // ── TC-SMOKE-04 ────────────────────────────────────────────────────────────
  test(
    'TC-SMOKE-04 · El wizard avanza al step 2 tras seleccionar línea y modo',
    async ({ page }) => {
      // Navigate with line+mode pre-set so the wizard auto-advances to step=2
      await page.goto('/escanear?line=BHS&mode=auto');
      await page.waitForLoadState('networkidle', { timeout: 10_000 });

      // The wizard useEffect should push step=2 into the URL within ~1 s
      await page.waitForURL(/[?&]step=2/, { timeout: 6_000 }).catch(() => null);

      // Accept either: URL contains step=2 OR step-2 content is visible
      const currentUrl = page.url();
      const urlHasStep2 = currentUrl.includes('step=2');

      const step2Indicators = [
        'empresas a escanear',
        'empresa a escanear',
        'Siguiente',
        'Configure',
        'Fuentes',
        'Keywords',
      ];
      let step2ContentFound = false;
      for (const text of step2Indicators) {
        if (
          await page
            .locator(`text=${text}`)
            .first()
            .isVisible({ timeout: 2_000 })
            .catch(() => false)
        ) {
          step2ContentFound = true;
          break;
        }
      }

      await page.screenshot({ path: 'test-results/TC-SMOKE-04-step2.png' });
      expect(
        urlHasStep2 || step2ContentFound,
        'El wizard debe avanzar al step 2 automáticamente',
      ).toBe(true);
    },
  );

  // ── TC-SMOKE-05 ────────────────────────────────────────────────────────────
  test(
    'TC-SMOKE-05 · Step 3 muestra estimado de costo o loading state',
    async ({ page }) => {
      await page.goto(
        '/escanear?step=3&line=BHS&mode=auto&count=1&provider=claude',
      );
      await page.waitForLoadState('networkidle', { timeout: 10_000 });
      await page.waitForTimeout(500);

      // Cost estimate section: either a loading spinner or actual cost data
      const costIndicators = [
        'Calculando',          // loading state text (Loader2 spinner)
        'Estimación de costo', // card header (Step3Review)
        'Costo estimado',      // row label inside estimate
        'Presupuesto',         // budget row / slider label
        'Tokens',              // token count rows
        'Sin datos',           // empty state text
      ];

      let costSectionFound = false;
      for (const text of costIndicators) {
        if (
          await page
            .locator(`text=${text}`)
            .first()
            .isVisible({ timeout: 3_000 })
            .catch(() => false)
        ) {
          costSectionFound = true;
          break;
        }
      }

      await page.screenshot({
        path: 'test-results/TC-SMOKE-05-cost-estimate.png',
      });
      expect(
        costSectionFound,
        'Step 3 debe mostrar la sección de estimación de costo (loading o datos)',
      ).toBe(true);
    },
  );

  // ── TC-SMOKE-06 ────────────────────────────────────────────────────────────
  test(
    'TC-SMOKE-06 · El proveedor Claude aparece como opción en step 3',
    async ({ page }) => {
      await page.goto(
        '/escanear?step=3&line=BHS&mode=auto&count=1&provider=claude',
      );
      await page.waitForLoadState('networkidle', { timeout: 10_000 });
      await page.waitForTimeout(500);

      // Claude appears either as a chip button (FALLBACK_PROVIDERS) or from API
      const claudeVariants = ['claude', 'Claude'];
      let claudeFound = false;
      for (const variant of claudeVariants) {
        if (
          await page
            .locator(`text=${variant}`)
            .first()
            .isVisible({ timeout: 4_000 })
            .catch(() => false)
        ) {
          claudeFound = true;
          break;
        }
      }

      await page.screenshot({
        path: 'test-results/TC-SMOKE-06-claude-provider.png',
      });
      expect(claudeFound, 'Claude debe aparecer como proveedor en step 3').toBe(true);
    },
  );

  // ── TC-SMOKE-07 ────────────────────────────────────────────────────────────
  test(
    'TC-SMOKE-07 · /comercial/resultados carga sin errores 500',
    async ({ page }) => {
      const response = await page.goto('/resultados');
      await page.waitForLoadState('networkidle', { timeout: 10_000 });

      // Must not be a server error
      expect(response?.status() ?? 200).toBeLessThan(500);

      // Page should render content — not a blank or minimal error page
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.trim().length).toBeGreaterThan(10);

      // Should not display a raw 500 / Internal Server Error message
      const rawErrorVisible = await page
        .locator('text=Internal Server Error')
        .first()
        .isVisible()
        .catch(() => false);
      expect(rawErrorVisible).toBe(false);

      await page.screenshot({
        path: 'test-results/TC-SMOKE-07-resultados.png',
      });
    },
  );

  // ── TC-SMOKE-08 ────────────────────────────────────────────────────────────
  test(
    'TC-SMOKE-08 · /comercial/metricas carga sin errores',
    async ({ page }) => {
      const response = await page.goto('/metricas');
      await page.waitForLoadState('networkidle', { timeout: 10_000 });

      expect(response?.status() ?? 200).toBeLessThan(500);

      const bodyText = await page.locator('body').innerText();
      expect(bodyText.trim().length).toBeGreaterThan(10);

      // The metrics page renders either KPI cards, a loading skeleton, or an
      // empty-state message — all are valid; we just reject hard errors.
      const rawErrorVisible = await page
        .locator('text=Internal Server Error')
        .first()
        .isVisible()
        .catch(() => false);
      expect(rawErrorVisible).toBe(false);

      await page.screenshot({
        path: 'test-results/TC-SMOKE-08-metricas.png',
      });
    },
  );

  // ── TC-SMOKE-09 ────────────────────────────────────────────────────────────
  test(
    'TC-SMOKE-09 · El breadcrumb o sidebar muestra "Radar v2" en sub-páginas',
    async ({ page }) => {
      // Use domcontentloaded instead of networkidle — the escanear page keeps
      // background fetch/SSE connections open that prevent networkidle from firing.
      await page.goto('/escanear');
      await page.waitForLoadState('domcontentloaded');

      // Wait for the React hydration to render the breadcrumb / sidebar nav.
      // "Radar v2" appears in two places:
      //   1. The breadcrumb nav inside ComercialLayout  (link text "Radar v2")
      //   2. The sidebar collapsible button            (button text "Radar v2")
      // Either location satisfies the test.
      const radarV2El = page.locator('text=Radar v2').first();
      const isVisible = await radarV2El
        .isVisible({ timeout: 8_000 })
        .catch(() => false);

      await page.screenshot({
        path: 'test-results/TC-SMOKE-09-comercial-nav.png',
      });
      expect(
        isVisible,
        '"Radar v2" debe aparecer en el breadcrumb o en el sidebar',
      ).toBe(true);
    },
  );
});
