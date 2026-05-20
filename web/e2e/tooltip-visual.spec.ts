import { test } from '@playwright/test';

test('tooltip visual on basic metric and valuation method', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/stock?symbol=2330');
  await page.waitForSelector('#analysis');
  await page.waitForTimeout(1500);

  // 1. 基本面 → 毛利率 i
  const grossMarginRow = page.locator('#analysis').locator('text=毛利率').first();
  await grossMarginRow.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const grossMarginIcon = grossMarginRow.locator('xpath=following-sibling::*[1]');
  await grossMarginIcon.hover({ force: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'e2e/_out/tt_grossmargin.png', fullPage: false });
  await page.mouse.move(0, 0);
  await page.waitForTimeout(150);

  // 2. 估值評價 → ROE 法 i
  const roeRow = page.locator('#valuation-gauge').locator('text=ROE法').first();
  await roeRow.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const roeIcon = roeRow.locator('xpath=following-sibling::*[1]');
  await roeIcon.hover({ force: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'e2e/_out/tt_roe.png', fullPage: false });
});
