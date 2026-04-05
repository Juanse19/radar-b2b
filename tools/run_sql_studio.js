/**
 * run_sql_studio.js
 * Ejecuta SQL directamente en el editor SQL de Supabase Studio via Playwright.
 * Agrega 'radar' a los schemas expuestos de PostgREST.
 */
const { chromium } = require('playwright');

const STUDIO   = 'https://supabase.valparaiso.cafe';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjIyMDAwMDAwMDB9.vmRZjbfVld0zl_n0g50Rvy7RMgsOa_h2lJQ9OcmZFU4';

const SQL_TO_RUN = `ALTER ROLE authenticator SET pgrst.db_schemas TO 'public, storage, graphql_public, matec_invoices, financiero, rec_humanos, radar';
NOTIFY pgrst, 'reload config';`;

async function main() {
  console.log('Iniciando Playwright...');
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  // Navegar al SQL Editor
  console.log('Navegando al SQL Editor...');
  await page.goto(STUDIO + '/project/default/sql/new', { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '.tmp/sql_editor_loaded.png' });
  console.log('URL:', page.url());

  // Esperar a que el editor esté listo (Monaco editor)
  console.log('Esperando editor Monaco...');
  try {
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });
    console.log('Editor Monaco encontrado.');
  } catch {
    console.log('Monaco no encontrado, buscando textarea...');
  }

  await page.waitForTimeout(2000);

  // Intentar varios métodos para ingresar SQL en Monaco editor
  let sqlEntered = false;

  // Método 1: Click en el editor y usar teclado
  try {
    const editor = await page.$('.monaco-editor .view-lines');
    if (editor) {
      await editor.click();
      await page.waitForTimeout(500);
      // Seleccionar todo y reemplazar
      await page.keyboard.press('Control+a');
      await page.waitForTimeout(200);
      await page.keyboard.type(SQL_TO_RUN);
      sqlEntered = true;
      console.log('SQL ingresado via Monaco click.');
    }
  } catch (e) {
    console.log('Método 1 falló:', e.message.substring(0, 60));
  }

  // Método 2: Usar el clipboard
  if (!sqlEntered) {
    try {
      await page.evaluate((sql) => {
        navigator.clipboard.writeText(sql).catch(() => {});
      }, SQL_TO_RUN);

      const editor = await page.$('.monaco-editor');
      if (editor) {
        await editor.click();
        await page.keyboard.press('Control+a');
        await page.keyboard.press('Control+v');
        sqlEntered = true;
        console.log('SQL ingresado via clipboard.');
      }
    } catch (e) {
      console.log('Método 2 falló:', e.message.substring(0, 60));
    }
  }

  // Método 3: Via textarea si existe
  if (!sqlEntered) {
    const textarea = await page.$('textarea');
    if (textarea) {
      await textarea.click({ clickCount: 3 });
      await textarea.fill(SQL_TO_RUN);
      sqlEntered = true;
      console.log('SQL ingresado via textarea.');
    }
  }

  // Método 4: via JavaScript directo en el editor
  if (!sqlEntered) {
    try {
      const result = await page.evaluate((sql) => {
        // Monaco editor API
        const editors = window.monaco?.editor?.getEditors?.();
        if (editors && editors.length > 0) {
          const model = editors[0].getModel();
          model.setValue(sql);
          return 'monaco_api';
        }
        return null;
      }, SQL_TO_RUN);
      if (result) {
        sqlEntered = true;
        console.log(`SQL ingresado via ${result}.`);
      }
    } catch (e) {
      console.log('Método 4 falló:', e.message.substring(0, 60));
    }
  }

  await page.screenshot({ path: '.tmp/sql_entered.png' });

  if (!sqlEntered) {
    console.log('\n❌ No pude ingresar el SQL automáticamente.');
    console.log('El browser está abierto. Por favor:');
    console.log('1. Abre el SQL Editor en Supabase Studio');
    console.log('2. Pega este SQL:');
    console.log('   ' + SQL_TO_RUN.replace(/\n/g, '\n   '));
    console.log('3. Haz click en Run');
    await page.waitForTimeout(30000); // Esperar que el usuario lo haga manualmente
    await browser.close();
    return;
  }

  // Ejecutar el SQL
  console.log('\nEjecutando SQL...');
  await page.waitForTimeout(500);

  // Buscar botón Run/Execute
  const runSelectors = [
    'button:has-text("Run")',
    'button:has-text("Execute")',
    'button:has-text("▶")',
    '[data-testid="run-query-button"]',
    'button[title*="Run"]',
  ];

  let ran = false;
  for (const sel of runSelectors) {
    try {
      const btn = await page.$(sel);
      if (btn) {
        const text = await btn.textContent();
        console.log(`Clickeando botón: "${text?.trim()}"`);
        await btn.click();
        ran = true;
        break;
      }
    } catch { continue; }
  }

  if (!ran) {
    // Intentar Ctrl+Enter
    console.log('Intentando Ctrl+Enter...');
    await page.keyboard.press('Control+Enter');
    ran = true;
  }

  // Esperar resultados
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '.tmp/sql_result.png', fullPage: true });
  console.log('Screenshot de resultado: .tmp/sql_result.png');

  // Verificar en el resultado
  const resultText = await page.$eval('body', el => el.innerText).catch(() => '');
  if (resultText.toLowerCase().includes('success') || resultText.toLowerCase().includes('1 row') || resultText.toLowerCase().includes('0 rows')) {
    console.log('\n✅ SQL ejecutado exitosamente.');
  } else {
    const errorLines = resultText.split('\n').filter(l => l.toLowerCase().includes('error'));
    if (errorLines.length > 0) {
      console.log('\n⚠️  Posible error:', errorLines[0]);
    } else {
      console.log('\nResultado desconocido. Verificando via API...');
    }
  }

  await browser.close();

  // Verificar via API
  await new Promise(r => setTimeout(r, 2000)); // Dar tiempo a PostgREST para recargar

  console.log('\nVerificando schema radar via REST API...');
  const res = await fetch(`${STUDIO}/rest/v1/empresas?limit=1`, {
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Accept-Profile': 'radar',
    }
  });

  if (res.ok) {
    console.log('🎉 ¡ÉXITO! Schema "radar" ahora está expuesto en PostgREST.');
    console.log('Puedes correr: node tools/import_empresas.js "C:/Users/Juan/Downloads/empresas.csv"');
  } else {
    const body = await res.text();
    console.log(`HTTP ${res.status}: ${body.substring(0, 200)}`);
    if (body.includes('reload')) {
      console.log('PostgREST necesita reiniciarse. El ALTER ROLE fue aplicado pero PostgREST no lo leyó aún.');
    }
  }
}

main().catch(e => {
  console.error('\nERROR:', e.message);
  process.exit(1);
});
