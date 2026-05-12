import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBreadthADR } from '../src/sources/twse-breadth';

beforeEach(() => vi.restoreAllMocks());

describe('fetchBreadthADR', () => {
  it('returns advance/decline ratio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        date: '20260512',
        data: [['上漲', '600'], ['下跌', '300']],
      }),
    }));
    const out = await fetchBreadthADR();
    expect(out.adr).toBe(2);
    expect(out.date).toBe('2026-05-12');
  });
});
