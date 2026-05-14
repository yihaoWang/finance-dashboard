import { describe, it, expect } from 'vitest';
import { computePeace } from '../src/lib/peace';
import type { AnnualFinancialRow, FiveYearFinancials } from '@fd/shared';

const makeRow = (year: number, overrides: Partial<AnnualFinancialRow> = {}): AnnualFinancialRow => ({
  year,
  revenue: 1_000_000,
  grossProfit: 500_000,
  operatingIncome: 300_000,
  netIncome: 250_000,
  eps: 10,
  ocf: 280_000,
  icf: -50_000,
  fcf: 200_000,
  fcfCf: -30_000,
  totalAssets: 2_000_000,
  totalEquity: 1_500_000,
  totalDebt: 200_000,
  currentAssets: 800_000,
  currentLiabilities: 300_000,
  incomeTaxExpense: 50_000,
  pretaxIncome: 300_000,
  capex: 80_000,
  ...overrides,
});

const makeFiveYears = (overrides: Partial<AnnualFinancialRow>[] = []): FiveYearFinancials => ({
  symbol: '2330',
  rows: [2019, 2020, 2021, 2022, 2023].map((y, i) => makeRow(y, overrides[i] ?? {})),
  fetchedAt: Date.now(),
});

describe('computePeace - healthy stock', () => {
  it('returns 16 criteria', () => {
    const data = makeFiveYears();
    const bundle = computePeace(data, 9.5, ['無形資產'], ['S 科技風險']);
    expect(bundle.criteria).toHaveLength(16);
  });

  it('all criteria have a non-empty detail string', () => {
    const data = makeFiveYears();
    const bundle = computePeace(data, 9.5, [], []);
    for (const c of bundle.criteria) {
      expect(typeof c.detail).toBe('string');
      expect(c.detail.length).toBeGreaterThan(0);
    }
  });

  it('null-data criteria also have a non-empty detail string', () => {
    const emptyData: FiveYearFinancials = { symbol: '0000', rows: [], fetchedAt: Date.now() };
    const bundle = computePeace(emptyData, 9.5, [], []);
    for (const c of bundle.criteria) {
      expect(typeof c.detail).toBe('string');
      expect(c.detail.length).toBeGreaterThan(0);
    }
  });

  it('score and total are correct', () => {
    const data = makeFiveYears();
    const bundle = computePeace(data, 9.5, [], []);
    expect(bundle.total).toBe(16);
    expect(bundle.score).toBeGreaterThanOrEqual(0);
    expect(bundle.score).toBeLessThanOrEqual(16);
  });

  it('passes most criteria for a healthy stock', () => {
    const data = makeFiveYears();
    const bundle = computePeace(data, 9.5, [], []);
    // A perfectly healthy stock should pass at least 10 criteria
    expect(bundle.score).toBeGreaterThanOrEqual(10);
  });

  it('includes moat and risk tags', () => {
    const data = makeFiveYears();
    const bundle = computePeace(data, 9.5, ['無形資產', '成本優勢'], ['S 科技風險']);
    expect(bundle.moat).toEqual(['無形資產', '成本優勢']);
    expect(bundle.risk).toEqual(['S 科技風險']);
  });

  it('includes wacc in output', () => {
    const data = makeFiveYears();
    const bundle = computePeace(data, 9.5, [], []);
    expect(bundle.wacc).toBe(9.5);
  });
});

describe('computePeace - EPS checks', () => {
  it('fails #4 when EPS has a year below zero', () => {
    const data = makeFiveYears([{}, {}, { eps: -1 }, {}, {}]);
    const bundle = computePeace(data, 9.5, [], []);
    const c4 = bundle.criteria.find((c) => c.id === 4);
    expect(c4?.passed).toBe(false);
  });

  it('fails #4 when EPS drops > 10% in one year', () => {
    // Year-over-year drop of eps from 10 → 8 is 20%, which exceeds 10% threshold
    const data = makeFiveYears([{}, {}, { eps: 10 }, { eps: 8 }, {}]);
    const bundle = computePeace(data, 9.5, [], []);
    const c4 = bundle.criteria.find((c) => c.id === 4);
    expect(c4?.passed).toBe(false);
  });

  it('passes #4 when EPS is consistently positive and stable', () => {
    const data = makeFiveYears();
    const bundle = computePeace(data, 9.5, [], []);
    const c4 = bundle.criteria.find((c) => c.id === 4);
    expect(c4?.passed).toBe(true);
  });
});

describe('computePeace - cash flow checks', () => {
  it('fails #8 when OCF is negative', () => {
    const data = makeFiveYears([{}, {}, { ocf: -10_000, fcf: -90_000 }, {}, {}]);
    const bundle = computePeace(data, 9.5, [], []);
    const c8 = bundle.criteria.find((c) => c.id === 8);
    expect(c8?.passed).toBe(false);
  });

  it('passes #10 when OCF/NetIncome > 0.8', () => {
    // OCF=280_000, netIncome=250_000 → ratio=1.12 > 0.8
    const data = makeFiveYears();
    const bundle = computePeace(data, 9.5, [], []);
    const c10 = bundle.criteria.find((c) => c.id === 10);
    expect(c10?.passed).toBe(true);
    expect(c10?.value).toBeCloseTo(1.12, 1);
  });

  it('fails #10 when OCF/NetIncome < 0.8', () => {
    const data = makeFiveYears([{}, {}, {}, {}, { ocf: 100_000, netIncome: 250_000 }]);
    const bundle = computePeace(data, 9.5, [], []);
    const c10 = bundle.criteria.find((c) => c.id === 10);
    expect(c10?.passed).toBe(false);
  });
});

describe('computePeace - balance sheet checks', () => {
  it('fails #11 D/E when debt/equity > 0.5', () => {
    const data = makeFiveYears([{}, {}, {}, {}, { totalDebt: 1_000_000, totalEquity: 1_500_000 }]);
    const bundle = computePeace(data, 9.5, [], []);
    const c11 = bundle.criteria.find((c) => c.id === 11);
    expect(c11?.passed).toBe(false);
  });

  it('passes #11 D/E when debt/equity < 0.5', () => {
    const data = makeFiveYears();
    const bundle = computePeace(data, 9.5, [], []);
    const c11 = bundle.criteria.find((c) => c.id === 11);
    // 200_000 / 1_500_000 ≈ 0.133 < 0.5
    expect(c11?.passed).toBe(true);
  });
});

describe('computePeace - ROE check', () => {
  it('fails #14 when ROE < 15%', () => {
    // netIncome=250_000, equity=5_000_000 → ROE=5%
    const data = makeFiveYears([{}, {}, {}, {}, { netIncome: 250_000, totalEquity: 5_000_000 }]);
    const bundle = computePeace(data, 9.5, [], []);
    const c14 = bundle.criteria.find((c) => c.id === 14);
    expect(c14?.passed).toBe(false);
  });

  it('passes #14 when ROE > 15% for all years', () => {
    const data = makeFiveYears();
    const bundle = computePeace(data, 9.5, [], []);
    const c14 = bundle.criteria.find((c) => c.id === 14);
    // netIncome=250_000, equity=1_500_000 → ROE≈16.7% > 15%
    expect(c14?.passed).toBe(true);
  });
});

describe('computePeace - ROIC vs WACC', () => {
  it('passes #16 when ROIC > WACC', () => {
    // operatingIncome=300_000, taxRate=50_000/300_000≈16.7%
    // NOPAT≈250_000, investedCapital=1_500_000+200_000=1_700_000
    // ROIC≈14.7% > 9.5% WACC → pass
    const data = makeFiveYears();
    const bundle = computePeace(data, 9.5, [], []);
    const c16 = bundle.criteria.find((c) => c.id === 16);
    expect(c16?.passed).toBe(true);
  });

  it('fails #16 when WACC is very high', () => {
    const data = makeFiveYears();
    const bundle = computePeace(data, 30, [], []);
    const c16 = bundle.criteria.find((c) => c.id === 16);
    expect(c16?.passed).toBe(false);
  });
});

describe('computePeace - null data handling', () => {
  it('returns passed=null for criteria when data is missing', () => {
    const emptyData: FiveYearFinancials = { symbol: '0000', rows: [], fetchedAt: Date.now() };
    const bundle = computePeace(emptyData, 9.5, [], []);
    for (const c of bundle.criteria) {
      expect(c.passed).toBeNull();
    }
  });

  it('score is 0 when no data', () => {
    const emptyData: FiveYearFinancials = { symbol: '0000', rows: [], fetchedAt: Date.now() };
    const bundle = computePeace(emptyData, 9.5, [], []);
    expect(bundle.score).toBe(0);
  });
});

describe('computePeace - priority items', () => {
  it('marks exactly 6 criteria as priority', () => {
    const data = makeFiveYears();
    const bundle = computePeace(data, 9.5, [], []);
    const priorities = bundle.criteria.filter((c) => c.priority);
    expect(priorities).toHaveLength(6);
  });

  it('priority IDs are 4, 7, 8, 10, 11, 14', () => {
    const data = makeFiveYears();
    const bundle = computePeace(data, 9.5, [], []);
    const priorityIds = bundle.criteria.filter((c) => c.priority).map((c) => c.id).sort((a, b) => a - b);
    expect(priorityIds).toEqual([4, 7, 8, 10, 11, 14]);
  });
});
