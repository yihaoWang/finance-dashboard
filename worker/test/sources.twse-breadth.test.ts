import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBreadthADR } from '../src/sources/twse-breadth';

beforeEach(() => vi.restoreAllMocks());

describe('fetchBreadthADR', () => {
  it('returns advance/decline ratio from TWSE MI_INDEX 漲跌證券數合計 table', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          stat: 'OK',
          date: '20260512',
          tables: [
            {},
            {},
            {},
            {},
            {},
            {},
            { title: '大盤統計資訊', data: [] },
            {
              title: '漲跌證券數合計',
              fields: ['類型', '整體市場', '股票'],
              data: [
                ['上漲(漲停)', '600(10)', '300'],
                ['下跌(跌停)', '300(2)', '150'],
                ['持平', '50', '20'],
              ],
            },
          ],
        }),
      }),
    );
    const out = await fetchBreadthADR();
    expect(out.adr).toBe(2); // 600 / 300 = 2
    expect(out.date).toBe('2026-05-12');
  });
});
