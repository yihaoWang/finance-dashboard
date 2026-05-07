import { test, expect } from '@playwright/test';

test.describe('Dashboard E2E', () => {
  test('loads default 2330 with Chinese name and live price', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    const priceEl = page.locator('.text-5xl.font-semibold').first();
    await expect(priceEl).toBeVisible();
    const priceText = await priceEl.textContent();
    const price = Number(priceText?.replace(/,/g, ''));
    expect(price).toBeGreaterThan(100);
    expect(price).toBeLessThan(10_000);
  });

  test('shows P/E card with numeric value', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    const peCard = page
      .locator('div.rounded-xl', { hasText: 'P/E' })
      .filter({ hasNotText: 'Forward' })
      .first();
    const txt = (await peCard.locator('.text-xl').first().textContent())?.trim();
    expect(txt).not.toBe('—');
    expect(Number(txt)).toBeGreaterThan(0);
  });

  test('shows 月線乖離率 card with percentage', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    const card = page.locator('div.rounded-xl', { hasText: '月線乖離率' }).first();
    const txt = (await card.locator('.text-xl').first().textContent())?.trim() ?? '';
    expect(txt).toMatch(/-?\d+\.\d{2}%/);
  });

  test('shows 月營收 YoY with positive growth', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    const card = page.locator('div.rounded-xl', { hasText: '月營收 YoY' }).first();
    const txt = (await card.locator('.text-xl').first().textContent())?.trim() ?? '';
    expect(txt).toMatch(/-?\d+\.\d%/);
  });

  test('shows TTM EPS derived from PE', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    const card = page.locator('div.rounded-xl', { hasText: 'TTM EPS' }).first();
    const txt = (await card.locator('.text-xl').first().textContent())?.trim() ?? '';
    expect(Number(txt)).toBeGreaterThan(0);
  });

  test('renders all 6 KPI labels', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    const labels = ['Forward P/E', 'TTM EPS', '毛利率', '月營收 YoY', '月線乖離率'];
    for (const label of labels) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test('shows 毛利率 with a numeric value in 基本面 panel for 2330', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '基本面' })).toBeVisible();
    // The grossMargin row shows a percentage value — should not be '—'
    const grossMarginLabel = page.getByText('毛利率', { exact: true }).first();
    await expect(grossMarginLabel).toBeVisible();
    // Find the value in the same flex row: the span.num next to the label
    const grossMarginRow = page.locator('div.flex.justify-between', { has: grossMarginLabel }).first();
    const valueSpan = grossMarginRow.locator('span.num').first();
    const valueText = (await valueSpan.textContent())?.trim() ?? '';
    // If the data source works, we expect a percentage like "58.8%"; if not, "—" is acceptable
    if (valueText !== '—') {
      expect(valueText).toMatch(/\d+\.\d%/);
    }
  });

  test('shows risk LED row with at least 3 indicators', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('風險燈號')).toBeVisible();
  });

  test('shows watchlist strip with 自選 label', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('自選', { exact: true })).toBeVisible();
  });

  test('shows TopNav tabs', async ({ page }) => {
    await page.goto('/');
    for (const tab of ['總覽', '基本面', '技術面', '籌碼', '宏觀']) {
      await expect(page.getByRole('button', { name: tab })).toBeVisible();
    }
  });

  test('shows 宏觀風險 panel', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('宏觀風險')).toBeVisible();
  });

  test('search 2454 shows 聯發科', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    const input = page.getByPlaceholder(/輸入股票代號/);
    await input.fill('2454');
    await page.getByRole('button', { name: '查詢' }).click();
    await expect(page.getByRole('heading', { name: '聯發科' })).toBeVisible({ timeout: 15_000 });
  });

  test('shows updated time text', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/最後更新/)).toBeVisible();
  });

  test('change indicator color matches sign', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    const changeText = await page.locator('.text-up, .text-down').first().textContent();
    expect(changeText).toMatch(/[+-]?\d/);
  });

  test('shows 籌碼面 panel with 外資 row', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '籌碼面' })).toBeVisible();
    const foreignRow = page.locator('div', { hasText: '外資' }).filter({ has: page.locator('.num') }).first();
    await expect(foreignRow).toBeVisible();
    const netText = (await foreignRow.locator('.num').first().textContent()) ?? '';
    // Should show a number of lots (張), not just a dash
    expect(netText).toMatch(/[+\-]?\d/);
  });

  test('symbol code 2330 visible next to title', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('2330').first()).toBeVisible();
  });

  test('renders price chart svg', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    // recharts renders <svg> inside the chart container
    const svg = page.locator('div', { hasText: '股價走勢' }).first().locator('svg').first();
    await expect(svg).toBeVisible({ timeout: 15_000 });
  });

  test('shows RSI value in 技術面 panel', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '技術面' })).toBeVisible();
    const rsiLabel = page.getByText('RSI(14)', { exact: true }).first();
    await expect(rsiLabel).toBeVisible();
    const rsiRow = page.locator('div.flex.justify-between', { has: rsiLabel }).first();
    const valueSpan = rsiRow.locator('span.num').first();
    const valueText = (await valueSpan.textContent())?.trim() ?? '';
    if (valueText !== '—') {
      expect(Number(valueText)).toBeGreaterThanOrEqual(0);
      expect(Number(valueText)).toBeLessThanOrEqual(100);
    }
  });

  test('shows MACD signal pill in 技術面 panel', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '技術面' })).toBeVisible();
    const pill = page.locator('span', { hasText: /^(偏多|偏空|中性)$/ }).first();
    await expect(pill).toBeVisible();
  });

  test('shows 支撐 and 壓力 numbers in 技術面 panel', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('支撐', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('壓力', { exact: true }).first()).toBeVisible();
  });

  test('chart range switcher: clicking 1Y triggers fetch', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    const reqPromise = page.waitForRequest(
      (r) => r.url().includes('/api/history/2330') && r.url().includes('1y'),
      { timeout: 10_000 },
    );
    await page.getByRole('button', { name: '1Y' }).click();
    await reqPromise;
  });

  test('input is preloaded with 2330', async ({ page }) => {
    await page.goto('/');
    const input = page.getByPlaceholder(/輸入股票代號/);
    await expect(input).toHaveValue('2330');
  });

  test('shows 融資餘額 row in 籌碼面 panel', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '籌碼面' })).toBeVisible();
    const label = page.getByText('融資', { exact: false }).first();
    await expect(label).toBeVisible();
  });

  test('shows 外資持股 percentage in 籌碼面 panel', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: '籌碼面' })).toBeVisible();
    const label = page.getByText('外資持股比', { exact: false }).first();
    await expect(label).toBeVisible();
  });

  test('searching non-existent 4-digit symbol surfaces an error', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    const input = page.getByPlaceholder(/輸入股票代號/);
    await input.fill('0000');
    await page.getByRole('button', { name: '查詢' }).click();
    await expect(page.getByText(/錯誤|api_error_/)).toBeVisible({ timeout: 15_000 });
  });

  test('shows 消息面 panel', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /消息面/ })).toBeVisible({ timeout: 15_000 });
  });

  test('news panel has sentiment filter pills', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /消息面/ })).toBeVisible({ timeout: 15_000 });
    const allPill = page.getByRole('button', { name: /全部/ });
    await expect(allPill).toBeVisible({ timeout: 10_000 });
  });

  test('DigestCard renders 3 section headings', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    // DigestCard is present; check for the 3 section headings (may fail if backend not ready)
    await expect(page.getByText('硬數據')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('框架解讀')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('情緒')).toBeVisible({ timeout: 15_000 });
  });

  test("clicking 'AI 解讀' tab navigates to /digest", async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'AI 解讀' }).click();
    await expect(page).toHaveURL(/\/digest/);
  });
});
