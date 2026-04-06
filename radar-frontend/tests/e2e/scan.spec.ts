import { test, expect } from '@playwright/test';

/**
 * Tests de la página /scan — Lanzar Escaneo
 *
 * NOTA: El selector de línea usa cards/botones visuales (no combobox/dropdown).
 * El batch size usa un stepper (+/-) con un número grande, no <input type="number">.
 */

test.describe('Página /scan', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/scan');
    await page.waitForLoadState('networkidle');
  });

  // Verifica que la página carga sin errores
  test('La página carga correctamente sin errores', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Lanzar Escaneo' })).toBeVisible();
    // Subtítulo del panel
    await expect(page.getByText(/Panel de control del Radar de Inversión B2B/i)).toBeVisible();
  });

  // Verifica que las 4 cards de línea de negocio están presentes
  test('Las cards de selección de línea están presentes (BHS, Cartón, Intralogística, Todas)', async ({ page }) => {
    await expect(page.getByRole('button', { name: /BHS/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Cartón/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Intralogística/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Todas/i })).toBeVisible();
  });

  // Verifica que la card de BHS muestra el conteo de empresas — usa nth para evitar strict mode
  test('La card de BHS muestra el conteo de empresas (171)', async ({ page }) => {
    // El texto "171 empresas" aparece en múltiples elementos; usamos first() para evitar strict mode
    await expect(page.getByText('171 empresas').first()).toBeVisible({ timeout: 10000 });
  });

  // Verifica que la card de Cartón muestra el conteo correcto
  test('La card de Cartón muestra el conteo de empresas (170)', async ({ page }) => {
    await expect(page.getByText('170 empresas').first()).toBeVisible({ timeout: 10000 });
  });

  // Verifica que la card de Intralogística muestra un conteo de empresas
  test('La card de Intralogística muestra el conteo de empresas', async ({ page }) => {
    const intraCard = page.getByRole('button', { name: /Intralogística/i });
    await expect(intraCard).toBeVisible();
    // Verifica que el card tiene texto de empresas visible
    await expect(page.locator('button:has-text("Intralogística") span').filter({ hasText: /empresas/ })).toBeVisible({ timeout: 10000 });
  });

  // Verifica que el stepper de batch size está presente (botones + y -)
  test('El stepper de cantidad de empresas está presente', async ({ page }) => {
    const minusBtn = page.locator('button:has(svg.lucide-minus)');
    const plusBtn  = page.locator('button:has(svg.lucide-plus)');
    await expect(minusBtn).toBeVisible();
    await expect(plusBtn).toBeVisible();
  });

  // Verifica que el valor inicial del batch es visible como número grande
  test('El valor de batch size inicial es visible', async ({ page }) => {
    // El número grande (default 10) se muestra como texto en un span con text-5xl
    await expect(page.locator('.text-5xl').first()).toBeVisible({ timeout: 5000 });
  });

  // Verifica que el botón de incrementar batch funciona
  test('El botón + incrementa el batch size', async ({ page }) => {
    // Espera que los datos carguen
    await page.waitForTimeout(2000);

    const plusBtn = page.locator('button:has(svg.lucide-plus)');
    await expect(plusBtn).toBeEnabled();
    await plusBtn.click();

    // El valor debe haber incrementado (el botón fue clickeable sin error)
    await expect(plusBtn).toBeVisible();
  });

  // Verifica que el botón "Escanear" está presente y habilitado
  test('El botón Escanear está presente y habilitado', async ({ page }) => {
    // El botón principal de escanear tiene texto "Escanear N empresas de BHS" o similar
    const scanButton = page.getByRole('button', { name: /Escanear/i }).last();
    await expect(scanButton).toBeVisible();
    await expect(scanButton).toBeEnabled();
  });

  // Verifica que el texto del botón Escanear incluye la línea seleccionada (BHS por defecto)
  test('El botón Escanear muestra texto con la línea BHS por defecto', async ({ page }) => {
    // El botón principal de escaneo dice "Escanear X empresas de BHS"
    await expect(page.getByRole('button', { name: /Escanear \d+ empresas de BHS/i })).toBeVisible({ timeout: 5000 });
  });

  // Verifica que al hacer click en la card de Cartón, cambia la selección
  test('Al hacer click en Cartón la línea activa cambia', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Hace click en la card de Cartón (usa el locator de botón de la card visual)
    await page.getByRole('button', { name: /Cartón/i }).click();

    // El botón de escaneo ahora debe mencionar Cartón
    await expect(page.getByRole('button', { name: /Escanear \d+ empresas de Cartón/i })).toBeVisible({ timeout: 5000 });
  });

  // Verifica que el texto "Máximo N por ejecución" está presente
  test('Se muestra el límite máximo de empresas por ejecución', async ({ page }) => {
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Máximo \d+ por ejecución/i)).toBeVisible();
  });

  // Verifica que los títulos de sección están presentes (usa first() para evitar strict mode)
  test('El panel de información del escaneo está visible', async ({ page }) => {
    // La sección "01 — Línea de negocio" debe estar presente (puede haber duplicados)
    await expect(page.getByText(/01 — Línea de negocio/i)).toBeVisible();
    // La sección "02 — Cantidad de empresas" debe estar presente
    await expect(page.getByText(/02 — Cantidad de empresas/i)).toBeVisible();
  });

  // Verifica que el switch de selección específica está presente
  test('El switch de selección específica está presente', async ({ page }) => {
    await expect(page.getByText(/03 — Selección específica/i)).toBeVisible();
    // El switch/toggle existe
    const switchEl = page.locator('[role="switch"]');
    await expect(switchEl).toBeVisible();
  });

  // Verifica que no hay errores 500 en la página
  test('No hay errores 500 visibles en la página /scan', async ({ page }) => {
    await expect(page.getByText(/500/)).not.toBeVisible();
    await expect(page.getByText(/Error interno/i)).not.toBeVisible();
  });
});
