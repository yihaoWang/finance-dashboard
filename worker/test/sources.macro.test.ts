import { describe, it, expect, vi } from 'vitest';
import { fetchMacroBundle } from '../src/sources/macro';

const makePayload = (price: number, prevClose: number) => ({
  chart: {
    result: [{
      meta: {
        regularMarketPrice: price,
        chartPreviousClose: prevClose,
      },
    }],
  },
});

describe('fetchMacroBundle', () => {
  it('returns all 5 macros with correct shape', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(makePayload(4.32, 4.20)), { status: 200 })) // ^TNX
      .mockResolvedValueOnce(new Response(JSON.stringify(makePayload(18.5, 19.0)), { status: 200 })) // ^VIX
      .mockResolvedValueOnce(new Response(JSON.stringify(makePayload(5000, 4900)), { status: 200 })) // ^SOX
      .mockResolvedValueOnce(new Response(JSON.stringify(makePayload(104.5, 103.0)), { status: 200 })) // DX-Y
      .mockResolvedValueOnce(new Response(JSON.stringify(makePayload(32.5, 32.0)), { status: 200 })); // TWD=X

    const bundle = await fetchMacroBundle({ fetcher });

    expect(bundle.us10y).not.toBeNull();
    expect(bundle.us10y!.value).toBeCloseTo(4.32, 4);
    expect(bundle.vix).not.toBeNull();
    expect(bundle.vix!.value).toBe(18.5);
    expect(bundle.sox).not.toBeNull();
    expect(bundle.sox!.value).toBe(5000);
    expect(bundle.dxy).not.toBeNull();
    expect(bundle.twd).not.toBeNull();
  });

  it('passes ^TNX value as-is (Yahoo already returns yield as %)', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(makePayload(4.32, 4.30)), { status: 200 })) // ^TNX
      .mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(makePayload(100, 100)), { status: 200 })),
      );

    const bundle = await fetchMacroBundle({ fetcher });
    expect(bundle.us10y!.value).toBeCloseTo(4.32, 4);
  });

  it('sets null for failed symbols and continues', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error('network_error')) // ^TNX fails
      .mockResolvedValue(new Response(JSON.stringify(makePayload(18.5, 19.0)), { status: 200 }));

    const bundle = await fetchMacroBundle({ fetcher });
    expect(bundle.us10y).toBeNull();
    expect(bundle.vix).not.toBeNull();
  });

  it('computes changePct correctly', async () => {
    const fetcher = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(makePayload(110, 100)), { status: 200 })),
    );

    const bundle = await fetchMacroBundle({ fetcher });
    // VIX changePct: (110 - 100) / 100 * 100 = 10%
    expect(bundle.vix!.changePct).toBeCloseTo(10, 4);
  });
});
