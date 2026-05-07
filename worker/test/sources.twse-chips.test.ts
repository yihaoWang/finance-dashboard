import { describe, it, expect, vi } from 'vitest';
import { fetchTwseChips } from '../src/sources/twse-chips';

const makeT86Response = (stat: string, rows: string[][]): string =>
  JSON.stringify({
    stat,
    date: '20260507',
    fields: [
      '證券代號', '證券名稱',
      '外陸資買進股數(不含外資自營商)', '外陸資賣出股數(不含外資自營商)',
      '外陸資買賣超股數(不含外資自營商)',
      '外資自營商買進股數', '外資自營商賣出股數', '外資自營商買賣超股數',
      '投信買進股數', '投信賣出股數', '投信買賣超股數',
      '自營商買賣超股數',
      '自營商買進股數(自行買賣)', '自營商賣出股數(自行買賣)', '自營商買賣超股數(自行買賣)',
      '自營商買進股數(避險)', '自營商賣出股數(避險)', '自營商買賣超股數(避險)',
      '三大法人買賣超股數',
    ],
    data: rows,
    hints: '單位：股',
    notes: [],
    selectType: 'ALLBUT0999',
    total: rows.length,
  });

const make2330Row = (): string[] => [
  '2330', '台積電            ',
  '100,000,000', '20,000,000', '80,000,000', // foreign buy/sell/net (idx 2,3,4)
  '0', '0', '0',                               // foreign dealer buy/sell/net (idx 5,6,7)
  '500,000', '100,000', '400,000',             // trust buy/sell/net (idx 8,9,10)
  '-1,200,000',                                // dealer net (idx 11)
  '3,000,000', '2,000,000', '1,000,000',
  '4,000,000', '5,200,000', '-1,200,000',
  '79,200,000',
];

const makeKv = () => ({
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
});

describe('fetchTwseChips', () => {
  it('parses foreign, trust, and dealer net correctly for a known symbol', async () => {
    const kv = makeKv() as unknown as KVNamespace;
    const fetcher = vi.fn().mockResolvedValue(
      new Response(makeT86Response('OK', [make2330Row()]), { status: 200 }),
    );

    const result = await fetchTwseChips(kv, '2330', { fetcher });

    expect(result).not.toBeNull();
    expect(result!.code).toBe('2330');
    expect(result!.date).toBe('20260507');
    expect(result!.foreignNet).toBe(80_000_000);
    expect(result!.trustNet).toBe(400_000);
    expect(result!.dealerNet).toBe(-1_200_000);
  });

  it('returns null for an unknown symbol', async () => {
    const kv = makeKv() as unknown as KVNamespace;
    const fetcher = vi.fn().mockResolvedValue(
      new Response(makeT86Response('OK', [make2330Row()]), { status: 200 }),
    );

    const result = await fetchTwseChips(kv, '9999', { fetcher });
    expect(result).toBeNull();
  });

  it('returns null when stat is not OK (market closed / empty)', async () => {
    const kv = makeKv() as unknown as KVNamespace;
    const makeEmpty = () =>
      new Response(JSON.stringify({ stat: 'No Data', date: '', data: [], fields: [] }), { status: 200 });
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(makeEmpty()));

    const result = await fetchTwseChips(kv, '2330', { fetcher });
    expect(result).toBeNull();
  });

  it('retries previous business days until data is found', async () => {
    const kv = makeKv() as unknown as KVNamespace;
    const makeEmpty = () =>
      new Response(JSON.stringify({ stat: 'No Data', date: '', data: [], fields: [] }), { status: 200 });
    const makeData = () => new Response(makeT86Response('OK', [make2330Row()]), { status: 200 });

    const fetcher = vi.fn()
      .mockResolvedValueOnce(makeEmpty())
      .mockResolvedValueOnce(makeEmpty())
      .mockResolvedValueOnce(makeData());

    const result = await fetchTwseChips(kv, '2330', { fetcher });
    expect(result).not.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('uses cached map from KV on second call', async () => {
    const cachedMap = {
      '2330': { code: '2330', date: '20260506', foreignNet: 1000, trustNet: 200, dealerNet: -50 },
    };
    const kv = {
      get: vi.fn().mockResolvedValue(JSON.stringify(cachedMap)),
      put: vi.fn().mockResolvedValue(undefined),
    } as unknown as KVNamespace;
    const fetcher = vi.fn();

    const result = await fetchTwseChips(kv, '2330', { fetcher });
    expect(result!.foreignNet).toBe(1000);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
