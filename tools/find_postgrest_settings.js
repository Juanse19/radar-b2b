const { chromium } = require('playwright');
const STUDIO = 'https://supabase.valparaiso.cafe';

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(STUDIO + '/project/default', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);

  // Click on settings gear icon (bottom of sidebar)
  console.log('Clickeando Settings...');
  try {
    // Try clicking the gear icon at the bottom of sidebar
    await page.click('[href*="/settings"], a[href$="/settings"]', { timeout: 5000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '.tmp/settings_page.png', fullPage: true });
    console.log('Settings page URL:', page.url());
    console.log('Screenshot: .tmp/settings_page.png');

    // Log all links in the settings sidebar
    const links = await page.$$('a');
    for (const link of links) {
      const href = await link.getAttribute('href') || '';
      const text = (await link.textContent() || '').trim();
      if (href.includes('setting') || text.toLowerCase().includes('api') || text.toLowerCase().includes('schema') || text.toLowerCase().includes('postgrest')) {
        console.log(`  Link: "${text}" → ${href}`);
      }
    }
  } catch (e) {
    console.log('Error:', e.message.substring(0, 100));
    // Try navigating via keyboard shortcut search
    console.log('\nIntentando via búsqueda (⌘K)...');
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '.tmp/search_open.png' });

    // Search for "api settings"
    await page.keyboard.type('api settings');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '.tmp/search_results.png' });
  }

  await page.waitForTimeout(1000);

  // Try navigating to all possible setting paths and log what's accessible
  const paths = [
    '/project/default/settings/api',
    '/project/default/settings/general',
    '/project/default/settings/auth',
    '/project/default/settings/storage',
    '/project/default/settings/billing',
    '/project/default/project-settings/api',
    '/project/default/project-settings',
  ];

  for (const p of paths) {
    await page.goto(STUDIO + p, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => {});
    const url = page.url();
    if (!url.includes('404') && !url.includes('log-drains') && url !== STUDIO + '/') {
      const title = await page.title();
      console.log(`✅ Accessible: ${url} (${title})`);
      await page.screenshot({ path: `.tmp/accessible_${p.replace(/\//g, '_')}.png` });
    }
  }

  await browser.close();
}
main().catch(e => console.error(e.message));
