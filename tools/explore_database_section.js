const { chromium } = require('playwright');
const STUDIO = 'https://supabase.valparaiso.cafe';

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(STUDIO + '/project/default/database/schemas', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);

  console.log('\n=== DATABASE SECTION LINKS ===');
  const links = await page.$$('a');
  for (const link of links) {
    const href = await link.getAttribute('href') || '';
    const text = (await link.textContent() || '').trim().replace(/\s+/g, ' ');
    if (text && href && href.includes('/database')) {
      console.log(`  "${text}" → ${href}`);
    }
  }

  // Navigate to each database sub-section
  const dbPaths = [
    '/project/default/database/schemas',
    '/project/default/database/tables',
    '/project/default/database/views',
    '/project/default/database/functions',
    '/project/default/database/triggers',
    '/project/default/database/publications',
    '/project/default/database/roles',
    '/project/default/database/replication',
    '/project/default/database/indexes',
    '/project/default/database/extensions',
    '/project/default/database/api',
    '/project/default/database/config',
  ];

  for (const p of dbPaths) {
    await page.goto(STUDIO + p, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const url = page.url();
    const bodyText = await page.$eval('body', el => el.innerText).catch(() => '');
    const hasSchemaContent = bodyText.toLowerCase().includes('exposed') ||
                             bodyText.toLowerCase().includes('db_schema') ||
                             bodyText.toLowerCase().includes('extra search');

    if (!bodyText.includes('404') && !bodyText.includes("couldn't find")) {
      console.log(`\n✅ ${url}`);
      if (hasSchemaContent) {
        console.log('  ⭐ CONTIENE CONFIGURACIÓN DE SCHEMAS!');
        await page.screenshot({ path: '.tmp/SCHEMA_FOUND.png', fullPage: true });
      }
      console.log('  Body preview:', bodyText.substring(0, 100).replace(/\n/g, ' '));
    }
  }

  await browser.close();
}
main().catch(e => console.error(e.message));
