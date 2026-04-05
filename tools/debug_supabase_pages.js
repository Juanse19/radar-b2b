const { chromium } = require('playwright');
const STUDIO = 'https://supabase.valparaiso.cafe';

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  const pages = [
    '/project/default/settings/postgrest',
    '/project/default/database/postgrest',
    '/project/default/integrations/data_api/overview',
  ];

  for (const path of pages) {
    await page.goto(STUDIO + path, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(2000);
    const name = path.replace(/\//g, '_').replace(/^_/, '');
    await page.screenshot({ path: `.tmp/${name}.png`, fullPage: true });
    console.log(`Screenshot: .tmp/${name}.png  (URL: ${page.url()})`);

    // Log all input fields
    const inputs = await page.$$('input, textarea');
    for (const inp of inputs) {
      const id = await inp.getAttribute('id') || '';
      const val = await inp.inputValue().catch(() => '');
      const placeholder = await inp.getAttribute('placeholder') || '';
      console.log(`  Input: id="${id}" val="${val.substring(0,80)}" placeholder="${placeholder}"`);
    }
  }

  await browser.close();
}
main().catch(e => console.error(e.message));
