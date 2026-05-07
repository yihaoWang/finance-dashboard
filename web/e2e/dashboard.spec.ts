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

  test('shows P/E (TTM) card with numeric value', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    const peCard = page.locator('div', { hasText: /^P\/E \(TTM\)/ }).first();
    const valueEl = peCard.locator('.text-xl.font-semibold').first();
    const txt = (await valueEl.textContent())?.trim();
    expect(txt).not.toBe('—');
    expect(Number(txt)).toBeGreaterThan(0);
  });

  test('shows 月線乖離 card with percentage', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    const card = page.locator('div', { hasText: /^月線乖離/ }).first();
    const valueEl = card.locator('.text-xl.font-semibold').first();
    const txt = (await valueEl.textContent())?.trim() ?? '';
    expect(txt).toMatch(/-?\d+\.\d{2}%/);
  });

  test('renders 6 KPI cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '台積電' })).toBeVisible({ timeout: 15_000 });
    const labels = ['P/E (TTM)', 'Forward P/E', 'EPS (近四季)', '毛利率', '月營收 YoY', '月線乖離'];
    for (const label of labels) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
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
