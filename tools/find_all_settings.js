const { chromium } = require('playwright');
const STUDIO = 'https://supabase.valparaiso.cafe';

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  // Navigate to Project Settings page and list all nav links
  await page.goto(STUDIO + '/project/default/settings/log-drains', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2000);

  // Get ALL links on the page
  console.log('\n=== ALL LINKS ON SETTINGS PAGE ===');
  const links = await page.$$('a');
  for (const link of links) {
    const href = await link.getAttribute('href') || '';
    const text = (await link.textContent() || '').trim().replace(/\s+/g, ' ');
    if (text && href) {
      console.log(`  "${text}" → ${href}`);
    }
  }

  // Take full page screenshot
  await page.screenshot({ path: '.tmp/settings_full.png', fullPage: true });
  console.log('\nScreenshot: .tmp/settings_full.png');

  // Navigate to each settings sub-section we find
  const settingsLinks = [];
  for (const link of links) {
    const href = await link.getAttribute('href') || '';
    if (href.includes('/settings') || href.includes('/project-settings')) {
      settingsLinks.push(href);
    }
  }

  console.log('\n=== SETTINGS LINKS FOUND ===');
  for (const href of settingsLinks) {
    console.log(' ', href);
    await page.goto(STUDIO + href, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const title = await page.title();
    const url = page.url();

    // Look for schema-related content
    const bodyText = await page.$eval('body', el => el.innerText || '').catch(() => '');
    if (bodyText.toLowerCase().includes('schema') || bodyText.toLowerCase().includes('postgrest') || bodyText.toLowerCase().includes('exposed')) {
      console.log(`  ✅ FOUND SCHEMA SETTINGS AT: ${url}`);
      await page.screenshot({ path: `.tmp/SCHEMA_SETTINGS.png`, fullPage: true });
    }
  }

  await browser.close();
}
main().catch(e => console.error(e.message));
