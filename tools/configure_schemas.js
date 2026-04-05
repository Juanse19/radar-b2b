/**
 * configure_schemas.js
 * Navega a Database > Settings en Supabase Studio y agrega 'radar' a exposed schemas.
 */
const { chromium } = require('playwright');
const STUDIO = 'https://supabase.valparaiso.cafe';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjIyMDAwMDAwMDB9.vmRZjbfVld0zl_n0g50Rvy7RMgsOa_h2lJQ9OcmZFU4';

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  console.log('Navegando a Database → Settings...');
  await page.goto(STUDIO + '/project/default/database/settings', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);

  const url = page.url();
  console.log('URL:', url);

  await page.screenshot({ path: '.tmp/db_settings.png', fullPage: true });
  console.log('Screenshot: .tmp/db_settings.png');

  // Log todos los inputs
  console.log('\n=== INPUTS EN LA PÁGINA ===');
  const inputs = await page.$$('input, textarea');
  for (const inp of inputs) {
    const id    = await inp.getAttribute('id') || '';
    const name  = await inp.getAttribute('name') || '';
    const val   = await inp.inputValue().catch(() => '');
    const ph    = await inp.getAttribute('placeholder') || '';
    console.log(`  Input id="${id}" name="${name}" val="${val.substring(0,80)}" placeholder="${ph}"`);
  }

  // Log todos los textos que mencionen schema o postgrest
  console.log('\n=== TEXTO RELEVANTE EN LA PÁGINA ===');
  const bodyText = await page.$eval('body', el => el.innerText).catch(() => '');
  const lines = bodyText.split('\n').filter(l => {
    const lower = l.toLowerCase();
    return lower.includes('schema') || lower.includes('postgrest') ||
           lower.includes('exposed') || lower.includes('extra search') ||
           lower.includes('db_schema');
  });
  lines.forEach(l => console.log(' ', l.trim()));

  // Buscar input que contenga schema o lista de schemas
  let schemaInput = null;
  for (const inp of inputs) {
    const val = await inp.inputValue().catch(() => '');
    const id  = await inp.getAttribute('id') || '';
    const ph  = await inp.getAttribute('placeholder') || '';
    if (
      val.includes('public') ||
      id.toLowerCase().includes('schema') ||
      ph.toLowerCase().includes('schema')
    ) {
      schemaInput = inp;
      console.log(`\nInput de schemas encontrado: id="${id}" val="${val}"`);
      break;
    }
  }

  if (!schemaInput) {
    console.log('\n❌ No encontré campo de schemas en /database/settings');
    await browser.close();
    return;
  }

  // Actualizar el valor
  const currentValue = await schemaInput.inputValue();
  if (currentValue.includes('radar')) {
    console.log('\n✅ "radar" ya está incluido.');
    await browser.close();
    return;
  }

  const newValue = currentValue
    ? `${currentValue.replace(/,?\s*$/, '')}, radar`
    : 'public, storage, graphql_public, matec_invoices, financiero, rec_humanos, radar';

  console.log(`\nActualizando: "${currentValue}" → "${newValue}"`);
  await schemaInput.click({ clickCount: 3 });
  await page.keyboard.press('Control+a');
  await schemaInput.fill(newValue);
  await page.waitForTimeout(500);

  // Guardar
  const saveBtn = await page.$('button:has-text("Save"), button:has-text("Update"), button:has-text("Apply")');
  if (saveBtn) {
    const text = await saveBtn.textContent();
    console.log(`Guardando con botón: "${text?.trim()}"`);
    await saveBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '.tmp/db_settings_saved.png', fullPage: true });
    console.log('✅ Guardado. Screenshot: .tmp/db_settings_saved.png');
  } else {
    // Buscar cualquier botón submit
    const btns = await page.$$('button[type="submit"], button');
    console.log(`\nBotones disponibles:`);
    for (const btn of btns) {
      const t = (await btn.textContent() || '').trim();
      if (t) console.log(`  "${t}"`);
    }
  }

  await browser.close();

  // Verificar
  console.log('\nVerificando...');
  const res = await fetch(`${STUDIO}/rest/v1/empresas?limit=1`, {
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Accept-Profile': 'radar',
    }
  });
  console.log(`API test: HTTP ${res.status} ${res.ok ? '✅ FUNCIONA' : await res.text().then(t => t.substring(0, 100))}`);
}

main().catch(e => console.error('ERROR:', e.message));
