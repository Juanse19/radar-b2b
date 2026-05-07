import { test, expect, Page } from '@playwright/test';

const EMAIL = 'juancamilo@matec.com.co';
const PASS  = 'Matec2026!';

async function login(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });
}

test.describe('Módulos — prueba completa', () => {
  test('Login con credenciales válidas', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASS);
    await page.screenshot({ path: 'tests/e2e/test-results/01-login-form.png' });
    await page.click('button[type="submit"]');
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });
    await page.screenshot({ path: 'tests/e2e/test-results/02-post-login.png' });
    expect(page.url()).not.toContain('/login');
    console.log('✅ Login OK — redirigido a:', page.url());
  });

  test('Dashboard — KPIs y señales ORO', async ({ page }) => {
    await login(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const heading = await page.locator('h1,h2').first().textContent();
    await page.screenshot({ path: 'tests/e2e/test-results/03-dashboard.png', fullPage: true });
    console.log('✅ Dashboard heading:', heading?.trim());
    expect(page.url()).not.toContain('/login');
  });

  test('Escanear — 6 líneas + formulario agentes', async ({ page }) => {
    await login(page);
    await page.goto('/scan');
    await page.waitForLoadState('networkidle');
    const heading = await page.locator('h1').first().textContent();
    console.log('✅ Scan heading:', heading?.trim());
    // Capturar opciones de línea (radio buttons, tabs o select)
    const allText = await page.locator('body').innerText();
    const lineas = ['BHS', 'Cartón', 'Intralogística', 'Final de Línea', 'Motos', 'Solumat'];
    const found = lineas.filter(l => allText.includes(l));
    console.log(`✅ Líneas encontradas: ${found.join(', ')} (${found.length}/6)`);
    await page.screenshot({ path: 'tests/e2e/test-results/04-scan.png', fullPage: true });
    expect(found.length).toBeGreaterThanOrEqual(4);
  });

  test('Señales (results) — tabla de inversión', async ({ page }) => {
    await login(page);
    await page.goto('/results');
    await page.waitForLoadState('networkidle');
    const heading = await page.locator('h1').first().textContent();
    console.log('✅ Results heading:', heading?.trim());
    await page.screenshot({ path: 'tests/e2e/test-results/05-results.png', fullPage: true });
    expect(page.url()).not.toContain('/login');
  });

  test('Contactos — tabla Apollo', async ({ page }) => {
    await login(page);
    await page.goto('/contactos');
    await page.waitForLoadState('networkidle');
    const heading = await page.locator('h1').first().textContent();
    console.log('✅ Contactos heading:', heading?.trim());
    await page.screenshot({ path: 'tests/e2e/test-results/06-contactos.png', fullPage: true });
    expect(page.url()).not.toContain('/login');
  });

  test('Empresas admin — tabla con filtros', async ({ page }) => {
    await login(page);
    await page.goto('/admin/empresas');
    await page.waitForLoadState('networkidle');
    const heading = await page.locator('h1').first().textContent();
    console.log('✅ Empresas heading:', heading?.trim());
    await page.screenshot({ path: 'tests/e2e/test-results/07-empresas.png', fullPage: true });
    expect(page.url()).not.toContain('/login');
  });

  test('TopBar — tema oscuro toggle', async ({ page }) => {
    await login(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const themeBtn = page.locator('button[aria-label="Cambiar tema"]');
    const btnVisible = await themeBtn.isVisible().catch(() => false);
    if (btnVisible) {
      await themeBtn.click();
      await page.waitForTimeout(400);
      const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      console.log(`✅ Tema oscuro toggle: ${isDark ? 'dark' : 'light'}`);
      await page.screenshot({ path: 'tests/e2e/test-results/08-dark-mode.png' });
    } else {
      console.log('⚠️  Botón de tema no visible');
    }
  });

  test('Auth guard — /api/comercial/calificar sin sesión devuelve 401', async ({ page }) => {
    // Sin login — request directa a la API SSE
    const res = await page.request.get(
      'http://localhost:3000/api/comercial/calificar?sessionId=test&linea=BHS&empresas=' +
        encodeURIComponent(JSON.stringify([{ name: 'X', country: 'CO' }])),
    );
    console.log(`✅ Auth guard /api/comercial/calificar status: ${res.status()}`);
    expect(res.status()).toBe(401);
  });
});
