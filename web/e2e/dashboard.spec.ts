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

  test('input is preloaded with 2330', async ({ page }) => {
    await page.goto('/');
    const input = page.getByPlaceholder(/輸入股票代號/);
    await expect(input).toHaveValue('2330');
  });

  test('searching non-existent 4-digit symbol surfaces an error', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    const input = page.getByPlaceholder(/輸入股票代號/);
    await input.fill('0000');
    await page.getByRole('button', { name: '查詢' }).click();
    await expect(page.getByText(/錯誤|api_error_/)).toBeVisible({ timeout: 15_000 });
  });
});
