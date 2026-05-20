import { test } from '@playwright/test';

test('valuation gauge screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/stock?symbol=2330');
  await page.waitForSelector('#valuation-gauge', { timeout: 30000 });
  // wait for the SVG bands to render
  await page.waitForSelector('#valuation-gauge svg path', { timeout: 30000 });
  await page.waitForTimeout(1500);
  const card = page.locator('#valuation-gauge');
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: 'e2e/_out/gauge.png' });
  await page.screenshot({ path: 'e2e/_out/full.png', fullPage: false });
});
