/**
 * expose_radar_schema_playwright.js
 *
 * Abre Supabase Studio, encuentra la configuración de schemas expuestos,
 * agrega 'radar' y guarda.
 */

const { chromium } = require('playwright');

const STUDIO_URL = 'https://supabase.valparaiso.cafe';
const ANON_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjIyMDAwMDAwMDB9.vmRZjbfVld0zl_n0g50Rvy7RMgsOa_h2lJQ9OcmZFU4';

const CANDIDATE_URLS = [
  '/project/default/settings/api',
  '/project/default/settings/postgrest',
  '/project/default/database/postgrest',
  '/project/default/settings',
  '/project/default/settings/general',
];

async function tryFindSchemaInput(page) {
  // Esperar a que la página cargue contenido
  await page.waitForTimeout(2000);

  // Buscar inputs que mencionen schema
  const inputs = await page.$$('input, textarea');
  for (const input of inputs) {
    const id    = await input.getAttribute('id')    || '';
    const name  = await input.getAttribute('name')  || '';
    const placeholder = await input.getAttribute('placeholder') || '';
    const value = await input.inputValue().catch(() => '');
    if (
      id.toLowerCase().includes('schema') ||
      name.toLowerCase().includes('schema') ||
      placeholder.toLowerCase().includes('schema') ||
      (value && value.includes('public') && value.includes(','))
    ) {
      return input;
    }
  }

  // Buscar por texto cerca de "schema" o "exposed"
  const texts = await page.$$('p, label, span, h3, h4');
  for (const el of texts) {
    const text = (await el.textContent() || '').toLowerCase();
    if (text.includes('exposed schema') || text.includes('extra search path') || text.includes('db schema')) {
      // Buscar el input más cercano
      const parent = await el.evaluateHandle(n => n.parentElement?.parentElement || n.parentElement || n);
      const input  = await parent.$('input, textarea').catch(() => null);
      if (input) return input;
    }
  }

  return null;
}

async function main() {
  console.log('\nIniciando Playwright...');

  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const ctx     = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page    = await ctx.newPage();

  let schemaInput = null;
  let foundUrl    = null;

  // 1. Probar cada URL candidata
  for (const path of CANDIDATE_URLS) {
    const url = STUDIO_URL + path;
    console.log(`\nProbando: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1500);

      const currentUrl = page.url();
      console.log(`  → Redirigido a: ${currentUrl}`);

      schemaInput = await tryFindSchemaInput(page);
      if (schemaInput) {
        foundUrl = currentUrl;
        console.log(`  ✅ ¡Campo de schemas encontrado en: ${currentUrl}`);
        break;
      }
    } catch (e) {
      console.log(`  ⚠️  Error: ${e.message.substring(0, 60)}`);
    }
  }

  // 2. Si no encontró por URL directa, navegar via Settings icon
  if (!schemaInput) {
    console.log('\nNo encontré por URL directa. Navegando via icono Settings...');
    await page.goto(STUDIO_URL + '/project/default', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);

    // Buscar el icono de settings (engranaje) en el sidebar
    const settingsLinks = await page.$$('a[href*="settings"]');
    console.log(`  Encontré ${settingsLinks.length} links de settings`);

    for (const link of settingsLinks) {
      const href = await link.getAttribute('href') || '';
      console.log(`  Link: ${href}`);
    }

    // Hacer screenshot para diagnóstico
    await page.screenshot({ path: '.tmp/supabase_nav_debug.png', fullPage: false });
    console.log('  Screenshot guardado: .tmp/supabase_nav_debug.png');

    // Intentar click en Settings
    try {
      await page.click('a[href*="/settings"]', { timeout: 5000 });
      await page.waitForTimeout(2000);
      schemaInput = await tryFindSchemaInput(page);
    } catch (e) {
      console.log('  No encontré link de settings clickeable');
    }
  }

  // 3. Si aún no encontró, probar el SQL directo via fetch
  if (!schemaInput) {
    console.log('\n⚠️  No encontré el campo en la UI. Intentando via SQL directo...');
    await browser.close();

    // Intentar via REST con el anon key y una función RPC si existe
    const testRes = await fetch(
      `${STUDIO_URL}/rest/v1/rpc/expose_radar_schema`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: '{}',
      }
    );
    console.log(`  RPC test: HTTP ${testRes.status}`);

    console.log('\n=== SOLUCIÓN MANUAL ===');
    console.log('Corre este SQL en el editor SQL de Supabase Studio:');
    console.log('');
    console.log("ALTER ROLE authenticator SET pgrst.db_schemas TO 'public, storage, graphql_public, matec_invoices, financiero, rec_humanos, radar';");
    console.log("NOTIFY pgrst, 'reload config';");
    console.log('');
    console.log(`URL: ${STUDIO_URL}/project/default/sql/new`);
    return;
  }

  // 4. Tenemos el campo — leer, actualizar y guardar
  const currentValue = await schemaInput.inputValue();
  console.log(`\nValor actual del campo: "${currentValue}"`);

  if (currentValue.includes('radar')) {
    console.log('✅ "radar" ya está incluido. No se necesita cambio.');
    await browser.close();
    return;
  }

  const newValue = currentValue
    ? `${currentValue.replace(/,?\s*$/, '')}, radar`
    : 'public, storage, graphql_public, matec_invoices, financiero, rec_humanos, radar';

  console.log(`Escribiendo nuevo valor: "${newValue}"`);
  await schemaInput.click({ clickCount: 3 });
  await page.keyboard.press('Control+a');
  await schemaInput.fill(newValue);
  await page.waitForTimeout(500);

  // Buscar botón Save
  const saveBtn = await page.$('button:has-text("Save"), button:has-text("Update"), button[type="submit"]');
  if (saveBtn) {
    const btnText = await saveBtn.textContent();
    console.log(`Clickeando: "${btnText?.trim()}"`);
    await saveBtn.click();
    await page.waitForTimeout(2000);
    console.log('✅ Guardado.');
  } else {
    console.log('⚠️  No encontré botón Save. Enviando Enter...');
    await schemaInput.press('Enter');
    await page.waitForTimeout(2000);
  }

  await browser.close();

  // 5. Verificar
  console.log('\nVerificando que radar está expuesto...');
  const verifyRes = await fetch(
    `${STUDIO_URL}/rest/v1/empresas?limit=1`,
    {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Accept-Profile': 'radar',
      }
    }
  );

  if (verifyRes.ok) {
    console.log('✅ ¡Schema radar ahora está accesible via API!');
  } else {
    const body = await verifyRes.text();
    console.log(`HTTP ${verifyRes.status}: ${body.substring(0, 200)}`);
    console.log('\nSi ves "reload schema" en el error, PostgREST necesita reiniciarse.');
  }
}

main().catch(err => {
  console.error('\nERROR:', err.message);
  process.exit(1);
});
