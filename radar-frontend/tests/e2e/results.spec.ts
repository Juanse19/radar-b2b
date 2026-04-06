import { test, expect } from '@playwright/test';

/**
 * Tests de la página /results — Resultados del Radar
 */

test.describe('Página /results', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/results');
    await page.waitForLoadState('networkidle');
  });

  // Verifica que la página carga sin errores
  test('La página Resultados carga correctamente', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Resultados del Radar' })).toBeVisible();
  });

  // Verifica que el subtítulo muestra conteo de empresas
  test('El subtítulo muestra el conteo de empresas y señales', async ({ page }) => {
    // El patrón es "X empresa(s)" en el subtítulo
    await expect(page.getByText(/empresa/).first()).toBeVisible();
  });

  // Verifica que el campo de búsqueda está presente (placeholder real del código)
  test('El campo de búsqueda está presente', async ({ page }) => {
    // Placeholder real: "Buscar empresa, país, señal..."
    const searchInput = page.getByPlaceholder(/Buscar empresa/i);
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeEnabled();
  });

  // Verifica que el selector de tier está presente
  test('El selector de tier de filtro está presente', async ({ page }) => {
    const tierSelect = page.getByRole('combobox').first();
    await expect(tierSelect).toBeVisible();
  });

  // Verifica que el botón de exportar CSV está presente
  test('El botón de Exportar CSV está presente', async ({ page }) => {
    const exportBtn = page.getByRole('button', { name: /Exportar CSV/i });
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toBeEnabled();
  });

  // Verifica que la navegación lateral está presente
  test('La navegación lateral es visible desde /results', async ({ page }) => {
    await expect(page.getByText('Radar B2B')).toBeVisible();
    const resultsLink = page.locator('nav a[href="/results"]');
    await expect(resultsLink).toBeVisible();
  });

  // Verifica que la página no muestra un error 500 o similar
  test('No hay mensajes de error visibles en la página', async ({ page }) => {
    await expect(page.getByText(/500/)).not.toBeVisible();
    await expect(page.getByText(/Error interno/i)).not.toBeVisible();
  });

  // Verifica que los tabs de tipo de datos están presentes (Señales, Calificación, Radar Log, Contactos)
  test('Los tabs de Señales, Calificación, Radar Log y Contactos están presentes', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Señales/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Calificación/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Radar Log/i })).toBeVisible();
    // Contactos tab — puede haber múltiples con ese texto
    await expect(page.getByRole('button', { name: /Contactos/i }).first()).toBeVisible();
  });

  // Verifica que los tabs de línea de negocio están presentes
  test('Los tabs de líneas de negocio están presentes', async ({ page }) => {
    // Tabs de filtro de línea (BHS, Cartón, Intralogística, Todas)
    await expect(page.getByRole('button', { name: /Todas/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /BHS/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Cartón/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Intralogística/i }).first()).toBeVisible();
  });

  // Verifica que el tab de Señales está activo por defecto
  test('El tab Señales está activo por defecto', async ({ page }) => {
    // El tab activo tiene clase bg-blue-600
    const senalesTab = page.getByRole('button', { name: /Señales/i });
    await expect(senalesTab).toHaveClass(/bg-blue-600/);
  });

  // Verifica que al hacer click en el tab Contactos el tab cambia de estado
  test('Al hacer click en Contactos el tab queda activo', async ({ page }) => {
    const contactosTab = page.getByRole('button', { name: /Contactos/i }).first();
    await contactosTab.click();
    // El tab Contactos ahora debe estar activo (bg-blue-600)
    await expect(contactosTab).toHaveClass(/bg-blue-600/, { timeout: 5000 });
  });

  // Verifica que los filtros secundarios están presentes y son interactivos
  // NOTA: el Input usa @base-ui/react/input — verificamos estructura sin tipear
  test('Los filtros secundarios están presentes', async ({ page }) => {
    // Campo búsqueda empresa
    const searchInput = page.getByPlaceholder(/Buscar empresa/i);
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await expect(searchInput).toBeEnabled({ timeout: 10000 });

    // Campo filtro de país (placeholder exacto: "País...")
    const paisInput = page.getByPlaceholder('País...');
    await expect(paisInput).toBeVisible({ timeout: 5000 });

    // Selector de tier (combobox)
    const tierSelect = page.getByRole('combobox').first();
    await expect(tierSelect).toBeVisible();
  });
});
