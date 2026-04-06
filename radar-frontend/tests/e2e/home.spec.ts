import { test, expect } from '@playwright/test';

/**
 * Tests de la página / (Dashboard/Home)
 */

test.describe('Página / (Dashboard)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  // Verifica que la página carga correctamente
  test('La página Dashboard carga sin errores', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Señales de inversión B2B — Matec')).toBeVisible();
  });

  // Verifica que el sidebar de navegación está presente
  test('La navegación lateral está presente', async ({ page }) => {
    await expect(page.getByText('Radar B2B')).toBeVisible();
    await expect(page.getByText('Matec · Señales de Inversión')).toBeVisible();
  });

  // Verifica que el link de Dashboard está en la navegación
  test('El link de Dashboard está activo en la navegación', async ({ page }) => {
    const dashboardLink = page.getByRole('link', { name: /Dashboard/i });
    await expect(dashboardLink).toBeVisible();
  });

  // Verifica que el link de Escanear está en la navegación y funciona
  test('El link de Escanear navega a /scan', async ({ page }) => {
    const scanLink = page.locator('nav a[href="/scan"]');
    await expect(scanLink).toBeVisible();

    await Promise.all([
      page.waitForURL('**/scan'),
      scanLink.click(),
    ]);

    // Verifica que estamos en /scan
    expect(page.url()).toContain('/scan');
    await expect(page.getByRole('heading', { name: 'Lanzar Escaneo' })).toBeVisible({ timeout: 10000 });
  });

  // Verifica que el link de Resultados navega correctamente
  test('El link de Resultados navega a /results', async ({ page }) => {
    const resultsLink = page.locator('nav a[href="/results"]');
    await expect(resultsLink).toBeVisible();

    await Promise.all([
      page.waitForURL('**/results'),
      resultsLink.click(),
    ]);

    expect(page.url()).toContain('/results');
    await expect(page.getByRole('heading', { name: 'Resultados del Radar' })).toBeVisible({ timeout: 10000 });
  });

  // Verifica que el link de Cronograma navega correctamente
  test('El link de Cronograma navega a /schedule', async ({ page }) => {
    const scheduleLink = page.locator('nav a[href="/schedule"]');
    await expect(scheduleLink).toBeVisible();

    await Promise.all([
      page.waitForURL('**/schedule'),
      scheduleLink.click(),
    ]);

    expect(page.url()).toContain('/schedule');
  });

  // Verifica que los KPIs están presentes en el dashboard (labels reales del KPIGrid)
  test('Los KPIs de señales ORO, empresas escaneadas y contactos están visibles', async ({ page }) => {
    await expect(page.getByText('Señales ORO activas')).toBeVisible();
    await expect(page.getByText('Empresas escaneadas')).toBeVisible();
    await expect(page.getByText('Contactos extraídos')).toBeVisible();
  });

  // Verifica que el botón de escaneo rápido está presente
  test('El botón de Escaneo rápido está presente', async ({ page }) => {
    const quickScanBtn = page.getByRole('button', { name: /Escaneo rápido/i });
    await expect(quickScanBtn).toBeVisible();
    await expect(quickScanBtn).toBeEnabled();
  });

  // Verifica que la sección de señales ORO existe (título real del card)
  // Usa first() porque "Señales ORO" aparece en múltiples elementos (KPI + card)
  test('La sección de Señales ORO está presente', async ({ page }) => {
    await expect(page.getByText(/Señales ORO/).first()).toBeVisible();
  });

  // Verifica que los links de navegación están todos presentes
  test('Todos los links de navegación están presentes', async ({ page }) => {
    await expect(page.locator('nav a[href="/"]')).toBeVisible();
    await expect(page.locator('nav a[href="/scan"]')).toBeVisible();
    await expect(page.locator('nav a[href="/schedule"]')).toBeVisible();
    await expect(page.locator('nav a[href="/results"]')).toBeVisible();
    await expect(page.locator('nav a[href="/empresas"]')).toBeVisible();
    await expect(page.locator('nav a[href="/contactos"]')).toBeVisible();
  });
});
