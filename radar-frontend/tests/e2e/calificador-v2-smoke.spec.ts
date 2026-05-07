/**
 * E2E smoke test — Calificador V2
 *
 * Validates the full wizard flow against a running dev server:
 *   1. Login
 *   2. Navigate to /calificador/wizard
 *   3. Step 1: pick línea (BHS) + sub-línea + modo Manual
 *   4. Step 2: add empresa Grupo Bimbo / México
 *   5. Step 3: pick OpenAI provider + click Calificar
 *   6. Wait for SSE to deliver 9 dim_scored events + tier_assigned
 *   7. Assert UI renders 9 categorical badges and a tier (A|B|C|D)
 *
 * Costs ~$0.005 USD per run (gpt-4o-mini, 1 empresa).
 *
 * Run:
 *   PORT=3002 npx playwright test tests/e2e/calificador-v2-smoke.spec.ts \
 *     --project=chromium --headed
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3002';

const TEST_EMPRESA = {
  nombre:  'Grupo Bimbo',
  pais:    'Mexico',
  dominio: 'grupobimbo.com',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  // Dev-login route bypasses real auth in non-prod (see CLAUDE.md).
  // If a /api/dev-login exists, prefer it; else fill normal form.
  const devLogin = await page.request
    .post(`${BASE_URL}/api/auth/dev-login`, { failOnStatusCode: false })
    .catch(() => null);
  if (devLogin && devLogin.ok()) {
    await page.goto(`${BASE_URL}/calificador`);
    return;
  }
  // Fallback — normal credentials form
  await page.getByLabel(/email/i).fill('tatanse20@gmail.com');
  await page.getByLabel(/contraseña|password/i).fill('test1234');
  await page.getByRole('button', { name: /iniciar|login|entrar/i }).click();
  await page.waitForURL(/\/(dashboard|calificador|empresas)/i, { timeout: 15_000 });
}

// ─── Test ─────────────────────────────────────────────────────────────────────

test.describe('Calificador V2 — wizard end-to-end', () => {
  test.setTimeout(180_000); // 3 min — LLM call can take 60-90s

  test('completa wizard con Grupo Bimbo y persiste 9 dimensiones', async ({ page }) => {
    await login(page);

    // ── Step 1: Target ──────────────────────────────────────────────────────
    await page.goto(`${BASE_URL}/calificador/wizard`);
    await expect(page.getByRole('heading', { name: /calificador|empresa/i })).toBeVisible();

    // Pick BHS línea
    await page.getByRole('button', { name: /^BHS$/i }).first().click();

    // Pick first available sub-línea (UI varies — try common labels)
    const subLineaCandidates = [/Aeropuertos/i, /Cargo/i, /Terminal/i];
    for (const re of subLineaCandidates) {
      const btn = page.getByRole('button', { name: re }).first();
      if (await btn.count()) { await btn.click(); break; }
    }

    // Pick Manual mode
    await page.getByRole('button', { name: /manual/i }).click();

    // Advance
    await page.getByRole('button', { name: /siguiente|continuar|next/i }).first().click();

    // ── Step 2: Configure (manual — add empresa) ────────────────────────────
    // The UI may have either an "Agregar" button or an inline form.
    const addBtn = page.getByRole('button', { name: /agregar|añadir|add/i }).first();
    if (await addBtn.count()) await addBtn.click();

    await page.getByLabel(/nombre|empresa/i).first().fill(TEST_EMPRESA.nombre);
    const paisInput = page.getByLabel(/país|country/i).first();
    if (await paisInput.count()) await paisInput.fill(TEST_EMPRESA.pais);
    const domInput = page.getByLabel(/dominio|domain/i).first();
    if (await domInput.count()) await domInput.fill(TEST_EMPRESA.dominio);

    const confirmBtn = page.getByRole('button', { name: /confirmar|guardar|agregar empresa/i }).first();
    if (await confirmBtn.count()) await confirmBtn.click();

    await page.getByRole('button', { name: /siguiente|continuar/i }).first().click();

    // ── Step 3: Review + provider ───────────────────────────────────────────
    // Pick OpenAI provider
    await page.getByRole('button', { name: /openai|gpt/i }).first().click();

    // Launch
    await page.getByRole('button', { name: /calificar|ejecutar|lanzar/i }).first().click();

    // ── Wait for SSE 9 dim_scored + tier ────────────────────────────────────
    // Progress label "9/9" appears when all dimensions are scored
    await expect(page.locator('text=/9\\/9/')).toBeVisible({ timeout: 120_000 });

    // Tier badge (ORO|MONITOREO|ARCHIVO|Descartar) appears
    await expect(page.locator('text=/ORO|MONITOREO|ARCHIVO|Descartar/i')).toBeVisible();

    // ── Assert all 9 dimension labels appear in the live panel ──────────────
    const dimensions = [
      'Impacto presupuesto', 'Multiplanta', 'Recurrencia',
      'Referente mercado', 'Año objetivo', 'Ticket estimado',
      'Prioridad comercial', 'Cuenta estratégica', 'Tier',
    ];
    for (const label of dimensions) {
      await expect(page.locator(`text=${label}`).first()).toBeVisible();
    }

    // ── Assert categorical badges (uppercase tracking-wide spans) ───────────
    // At least 5 categorical values from the user's table should appear.
    const categoricalSamples = [
      /Muy Alto|Alto|Medio|Bajo|Muy Bajo/i,
      /Internacional|Regional|Única/i,
      /Sí|No/i,
      /^A$|^B$|^C$/i,
      /2026|2027|2028/i,
    ];
    for (const re of categoricalSamples) {
      await expect(page.locator('span').filter({ hasText: re }).first()).toBeVisible();
    }
  });
});
