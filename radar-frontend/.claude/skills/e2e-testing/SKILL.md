---
description: "Skill for writing end-to-end tests with Playwright"
---

# E2E Testing Skill — Playwright

## Role
You are a senior QA engineer specializing in end-to-end browser tests for Next.js applications using **Playwright**.

## Stack
- **Runner:** Playwright Test (`@playwright/test`)
- **Config:** `playwright.config.ts`
- **Browsers:** Chromium (default), optionally Firefox/WebKit
- **Base URL:** `http://localhost:3000` (dev server must be running)

## Commands
```bash
npx playwright test                          # run all e2e tests
npx playwright test tests/e2e/my-test.spec.ts  # single file
npx playwright test --ui                     # visual test runner
npx playwright test --headed                 # see the browser
npx playwright show-report                   # view HTML report
```

## Test File Conventions
- Place tests in `tests/e2e/`
- Name: `<feature>.spec.ts` (always `.spec.ts` for e2e)
- Screenshots go to `tests/e2e/test-results/`

## Patterns

### Login helper (reusable)
```typescript
import { Page } from '@playwright/test';

async function login(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'juancamilo@matec.com.co');
  await page.fill('input[type="password"]', 'Matec2026!');
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 });
}
```

### Page load test
```typescript
import { test, expect } from '@playwright/test';

test('page loads correctly', async ({ page }) => {
  await login(page);
  await page.goto('/my-page');
  await page.waitForLoadState('networkidle');

  const h1 = await page.locator('h1').first().textContent();
  expect(h1?.trim()).toBe('Expected Title');
  expect(page.url()).not.toContain('/login');
});
```

### Navigation test
```typescript
test('nav link visible in sidebar', async ({ page }) => {
  await login(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const navLink = page.locator('a[href="/my-page"]');
  await expect(navLink).toBeVisible();
});
```

### Table data test
```typescript
test('table loads data', async ({ page }) => {
  await login(page);
  await page.goto('/my-page');
  await page.waitForSelector('table tbody tr', { timeout: 10000 });

  const rowCount = await page.locator('table tbody tr').count();
  expect(rowCount).toBeGreaterThan(0);
});
```

### Filter test
```typescript
test('search filter works', async ({ page }) => {
  await login(page);
  await page.goto('/my-page');
  await page.waitForSelector('table tbody tr', { timeout: 10000 });

  const totalBefore = await page.locator('table tbody tr').count();
  await page.fill('input[placeholder*="Buscar"]', 'search term');
  await page.waitForTimeout(300); // debounce
  const totalAfter = await page.locator('table tbody tr').count();

  expect(totalAfter).toBeLessThanOrEqual(totalBefore);
});
```

### Screenshot capture
```typescript
test('visual snapshot', async ({ page }) => {
  await login(page);
  await page.goto('/my-page');
  await page.waitForLoadState('networkidle');
  await page.screenshot({
    path: 'tests/e2e/test-results/my-page.png',
    fullPage: true,
  });
});
```

## Rules
1. **Always login first** — all protected pages need authentication via the `login()` helper
2. **Wait for network** — use `waitForLoadState('networkidle')` after navigation
3. **Wait for data** — use `waitForSelector('table tbody tr', { timeout: 10000 })` before asserting on table data
4. **Use role selectors** — prefer `page.locator('[role="tab"]', { hasText: 'X' })` over CSS classes
5. **Screenshot on verification** — save screenshots for visual evidence in `tests/e2e/test-results/`
6. **No hardcoded waits** — prefer `waitForSelector` or `waitForURL` over `waitForTimeout` (except debounce)
7. **Test user flows** — e2e tests should simulate real user journeys, not unit-test individual components
8. **Clean up** — don't modify data in tests; if you must, undo it in `afterAll`
9. **Parallelism** — each test should be independent; don't rely on test order
10. **Login credentials** — use the test account: `juancamilo@matec.com.co` / `Matec2026!`
