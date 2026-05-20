import { test, expect } from '@playwright/test';

test('all i tooltips stay within viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/stock?symbol=2330');
  await page.waitForSelector('#analysis', { timeout: 30000 });
  await page.waitForSelector('#valuation-gauge', { timeout: 30000 });
  await page.waitForTimeout(1500);

  // Find every "i" icon — both MetricLabel style (in #analysis) and ValuationGaugePanel style.
  // MetricLabel: <span class="...inline-flex...">i</span>  inside a wrapping span with onMouseEnter
  // ValuationGaugePanel: <span class="...rounded-full bg-slate-200...">i</span>
  const icons = await page
    .locator('span')
    .filter({ hasText: /^i$/ })
    .filter({ has: page.locator(':scope') })
    .all();
  console.log(`Found ${icons.length} i icons`);

  const vw = 1440;
  const issues: string[] = [];
  let idx = 0;
  for (const icon of icons) {
    idx++;
    const box = await icon.boundingBox();
    if (!box || box.width < 6) continue; // not visible
    await icon.scrollIntoViewIfNeeded();
    await icon.hover();
    await page.waitForTimeout(150);

    // any element with mt-1 absolute popover?
    const pop = page.locator('span.absolute.z-50, span.absolute.top-full').first();
    if (await pop.count() > 0) {
      const pbox = await pop.boundingBox();
      if (pbox) {
        const overflowLeft = pbox.x < 0;
        const overflowRight = pbox.x + pbox.width > vw;
        if (overflowLeft || overflowRight) {
          issues.push(`icon#${idx} at (${box.x.toFixed(0)},${box.y.toFixed(0)}): tooltip box=(${pbox.x.toFixed(0)}, w=${pbox.width.toFixed(0)})  L=${overflowLeft} R=${overflowRight}`);
        }
      }
    }
    // unhover
    await page.mouse.move(0, 0);
    await page.waitForTimeout(80);
  }

  console.log('issues:', issues);
  expect(issues, issues.join('\n')).toEqual([]);
});
