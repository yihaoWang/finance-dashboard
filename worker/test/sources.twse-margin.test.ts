import { describe, it, expect, vi } from 'vitest';
import { fetchTwseMargin, fetchTwseForeignHolding } from '../src/sources/twse-margin';

const makeMarginResponse = (stat: string, rows: string[][]): string =>
  JSON.stringify({
    stat,
    date: '20260506',
    tables: [
      {
        title: '信用交易統計',
        fields: ['項目', '買進', '賣出', '現金(券)償還', '前日餘額', '今日餘額'],
        data: [['融資(交易單位)', '1', '2', '3', '4', '5']],
      },
      {
        title: '融資融券彙總 (全部)',
        fields: [
          '代號', '名稱',
          '買進', '賣出', '現金償還', '前日餘額', '今日餘額', '次一營業日限額',
          '買進', '賣出', '現券償還', '前日餘額', '今日餘額', '次一營業日限額',
          '資券互抵', '註記',
        ],
        data: rows,
      },
    ],
  });

const makeForeignResponse = (stat: string, rows: Array<Array<string | number>>): string =>
  JSON.stringify({
    stat,
    date: '20260506',
    selectType: 'ALLBUT0999',
    title: '外資及陸資投資持股統計',
    hints: '單位:股',
    fields: [
      '證券代號', '證券名稱', '國際證券編碼', '發行股數',
      '外資及陸資尚可投資股數', '全體外資及陸資持有股數',
      '外資及陸資尚可投資比率', '全體外資及陸資持股比率',
      '外資及陸資共用法令投資上限比率', '陸資法令投資上限比率',
      '與前日異動原因(註)', '最近一次上市公司申報外資及陸資持股異動日期',
    ],
    data: rows,
    total: rows.length,
  });

const make2330MarginRow = (): string[] => [
  '2330', '台積電',
  '822', '1,396', '40',
  '28,298', '27,684', '6,400,000',  // idx 5 = prev, 6 = today financing
  '0', '0', '0',
  '2,700', '2,608', '6,400,000',    // idx 11 = prev, 12 = today short
  '92', ' ',
];

const make2330ForeignRow = (): Array<string | number> => [
  '2330', '台積電', 'TW0002330008', '25,932,524,521',
  '7,610,100,000', '18,322,424,521',
  32.07, 70.64,
  '100.00', '100.00', '', '115/04/28',
];

const makeKv = () => ({
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
});

describe('fetchTwseMargin', () => {
  it('parses financing and short balances for a known symbol', async () => {
    const kv = makeKv() as unknown as KVNamespace;
    const fetcher = vi.fn().mockResolvedValue(
      new Response(makeMarginResponse('OK', [make2330MarginRow()]), { status: 200 }),
    );

    const result = await fetchTwseMargin(kv, '2330', { fetcher });

    expect(result).not.toBeNull();
    expect(result!.financingBalance).toBe(27684);
    expect(result!.shortBalance).toBe(2608);
    expect(result!.date).toBe('20260506');
  });

  it('returns null for unknown symbol', async () => {
    const kv = makeKv() as unknown as KVNamespace;
    const fetcher = vi.fn().mockResolvedValue(
      new Response(makeMarginResponse('OK', [make2330MarginRow()]), { status: 200 }),
    );

    const result = await fetchTwseMargin(kv, '9999', { fetcher });
    expect(result).toBeNull();
  });

  it('returns null when stat is not OK', async () => {
    const kv = makeKv() as unknown as KVNamespace;
    const fetcher = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ stat: 'No Data', tables: [] }), { status: 200 })),
    );

    const result = await fetchTwseMargin(kv, '2330', { fetcher });
    expect(result).toBeNull();
  });

  it('uses cached map from KV', async () => {
    const cachedMap = {
      '2330': { date: '20260506', financingBalance: 27684, shortBalance: 2608 },
    };
    const kv = {
      get: vi.fn().mockResolvedValue(JSON.stringify(cachedMap)),
      put: vi.fn().mockResolvedValue(undefined),
    } as unknown as KVNamespace;
    const fetcher = vi.fn();

    const result = await fetchTwseMargin(kv, '2330', { fetcher });
    expect(result!.financingBalance).toBe(27684);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('fetchTwseForeignHolding', () => {
  it('parses foreign holding pct for a known symbol', async () => {
    const kv = makeKv() as unknown as KVNamespace;
    const fetcher = vi.fn().mockResolvedValue(
      new Response(makeForeignResponse('OK', [make2330ForeignRow()]), { status: 200 }),
    );

    const result = await fetchTwseForeignHolding(kv, '2330', { fetcher });

    expect(result).not.toBeNull();
    expect(result!.holdingPct).toBe(70.64);
    expect(result!.date).toBe('20260506');
  });

  it('returns null for unknown symbol', async () => {
    const kv = makeKv() as unknown as KVNamespace;
    const fetcher = vi.fn().mockResolvedValue(
      new Response(makeForeignResponse('OK', [make2330ForeignRow()]), { status: 200 }),
    );

    const result = await fetchTwseForeignHolding(kv, '9999', { fetcher });
    expect(result).toBeNull();
  });

  it('returns null when stat is not OK', async () => {
    const kv = makeKv() as unknown as KVNamespace;
    const fetcher = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ stat: 'No Data', data: [], fields: [] }), { status: 200 })),
    );

    const result = await fetchTwseForeignHolding(kv, '2330', { fetcher });
    expect(result).toBeNull();
  });

  it('retries previous business days until data is found', async () => {
    const kv = makeKv() as unknown as KVNamespace;
    const makeEmpty = () =>
      new Response(JSON.stringify({ stat: 'No Data', data: [], fields: [] }), { status: 200 });
    const makeData = () =>
      new Response(makeForeignResponse('OK', [make2330ForeignRow()]), { status: 200 });

    const fetcher = vi.fn()
      .mockResolvedValueOnce(makeEmpty())
      .mockResolvedValueOnce(makeEmpty())
      .mockResolvedValueOnce(makeData());

    const result = await fetchTwseForeignHolding(kv, '2330', { fetcher });
    expect(result).not.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
