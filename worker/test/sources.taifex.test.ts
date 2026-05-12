import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchForeignFuturesOI, fetchOptionsPCR } from '../src/sources/taifex';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('fetchForeignFuturesOI', () => {
  it('parses net OI for foreign institutional traders', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '日期,身份別,多方未平倉口數,空方未平倉口數\n2026/05/12,外資,50000,18000\n',
    }));
    const out = await fetchForeignFuturesOI();
    expect(out.netOi).toBe(32000);
    expect(out.date).toBe('2026-05-12');
  });
});

describe('fetchOptionsPCR', () => {
  it('parses put/call ratio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '日期,賣權成交量,買權成交量\n2026/05/12,180000,150000\n',
    }));
    const out = await fetchOptionsPCR();
    expect(out.pcr).toBeCloseTo(1.2, 2);
  });
});
