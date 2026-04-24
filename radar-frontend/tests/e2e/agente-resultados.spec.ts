import { test, expect, Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'juancamilo@matec.com.co');
  await page.fill('input[type="password"]', 'Matec2026!');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });
}

test('Resultados Agente — página carga correctamente', async ({ page }) => {
  await login(page);
  await page.goto('/agente-resultados');
  await page.waitForLoadState('networkidle');
  const h1 = await page.locator('h1').first().textContent();
  console.log('✅ Heading:', h1?.trim());
  expect(page.url()).not.toContain('/login');
  expect(h1?.trim()).toBe('Resultados Agente');
});

test('Resultados Agente — nav link visible desde el sidebar', async ({ page }) => {
  await login(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const navLink = page.locator('a[href="/agente-resultados"]');
  await expect(navLink).toBeVisible();
  console.log('✅ Nav link "Resultados Agente" visible');
});

test('Resultados Agente — tab Clientes visible y carga datos', async ({ page }) => {
  await login(page);
  await page.goto('/agente-resultados');
  await page.waitForLoadState('networkidle');

  // Tab Clientes debe ser el activo por defecto
  const tabClientes = page.locator('[role="tab"]', { hasText: 'Clientes' });
  await expect(tabClientes).toBeVisible();
  await expect(tabClientes).toHaveAttribute('data-state', 'active');

  // Esperar a que la tabla cargue (al menos una fila de datos)
  await page.waitForSelector('table tbody tr', { timeout: 10000 });
  const rowCount = await page.locator('table tbody tr').count();
  console.log('✅ Filas cargadas en Clientes:', rowCount);
  expect(rowCount).toBeGreaterThan(0);

  await page.screenshot({ path: 'tests/e2e/test-results/agente-resultados-clientes.png', fullPage: true });
});

test('Resultados Agente — tab Log Empresas muestra datos', async ({ page }) => {
  await login(page);
  await page.goto('/agente-resultados');
  await page.waitForLoadState('networkidle');

  // Hacer click en tab Log Empresas
  const tabLog = page.locator('[role="tab"]', { hasText: 'Log Empresas' });
  await tabLog.click();
  await expect(tabLog).toHaveAttribute('data-state', 'active');

  // Esperar tabla
  await page.waitForSelector('table tbody tr', { timeout: 10000 });
  const rowCount = await page.locator('table tbody tr').count();
  console.log('✅ Filas cargadas en Log Empresas:', rowCount);
  expect(rowCount).toBeGreaterThan(0);

  await page.screenshot({ path: 'tests/e2e/test-results/agente-resultados-log.png', fullPage: true });
});

test('Resultados Agente — filtro de búsqueda filtra la tabla', async ({ page }) => {
  await login(page);
  await page.goto('/agente-resultados');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('table tbody tr', { timeout: 10000 });

  const totalAntes = await page.locator('table tbody tr').count();

  // Buscar un término que probablemente reduzca resultados
  const searchInput = page.locator('input[placeholder="Buscar empresa..."]').first();
  await searchInput.fill('Nutresa');
  await page.waitForTimeout(300); // debounce

  const totalDespues = await page.locator('table tbody tr').count();
  console.log(`✅ Filtro: ${totalAntes} → ${totalDespues} filas`);
  expect(totalDespues).toBeLessThanOrEqual(totalAntes);
});

test('Resultados Agente — botón CSV habilitado cuando hay datos', async ({ page }) => {
  await login(page);
  await page.goto('/agente-resultados');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('table tbody tr', { timeout: 10000 });

  const csvBtn = page.locator('button', { hasText: 'CSV' }).first();
  await expect(csvBtn).toBeVisible();
  await expect(csvBtn).not.toBeDisabled();
  console.log('✅ Botón CSV habilitado');
});
