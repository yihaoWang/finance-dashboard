import { fetchWithRetry } from '../lib/http';

// TWSE MI_INDEX: table titled "漲跌證券數合計" contains advance/decline counts.
// Row[0] is "上漲(漲停)" and Row[1] is "下跌(跌停)".
// The count format is "7,046(406)" — extract the leading number before '('.
// ADR = advance count / decline count.
// Note: must NOT pass ?date= param to get real data (TWSE returns TypeScript interface when date param is present).

const TWSE_MI_INDEX =
  'https://www.twse.com.tw/rwd/zh/afterTrading/MI_INDEX?response=json';

const TWSE_HEADERS = {
  Accept: 'application/json',
  Referer: 'https://www.twse.com.tw/',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

type MiIndexTable = {
  title?: string;
  fields?: string[];
  data?: string[][];
};

type MiIndexResponse = {
  stat?: string;
  date?: string;
  tables?: MiIndexTable[];
};

const parseAdvDecCount = (raw: string): number => {
  // Format: "7,046(406)" — extract the leading number before '(' or end
  const cleaned = raw.replace(/,/g, '').split('(')[0]?.trim() ?? '';
  const v = Number(cleaned);
  return Number.isFinite(v) ? v : 0;
};

export interface BreadthADR {
  date: string;
  adr: number;
}

export const fetchBreadthADR = async (): Promise<BreadthADR> => {
  let res: Response;
  try {
    res = await fetchWithRetry(TWSE_MI_INDEX, { headers: TWSE_HEADERS });
  } catch (err) {
    console.warn('TWSE MI_INDEX fetch failed', err);
    throw err;
  }
  const json = (await res.json()) as MiIndexResponse;
  if (!Array.isArray(json.tables)) {
    throw new Error('MI_INDEX response missing tables array');
  }
  // Find the 漲跌證券數合計 table
  const breadthTable = json.tables.find((t) => t.title?.includes('漲跌'));
  if (breadthTable === undefined || !Array.isArray(breadthTable.data)) {
    throw new Error('breadth table not found in MI_INDEX response');
  }
  // Row 0: 上漲(漲停), Row 1: 下跌(跌停)
  const advRow = breadthTable.data[0];
  const decRow = breadthTable.data[1];
  if (advRow === undefined || decRow === undefined) {
    throw new Error('advance/decline rows missing');
  }
  // Column 1 is "整體市場" count
  const adv = parseAdvDecCount(advRow[1] ?? '0');
  const dec = parseAdvDecCount(decRow[1] ?? '0');
  if (dec === 0) throw new Error('decline count is zero, cannot compute ADR');
  const adr = Number((adv / dec).toFixed(2));

  // Convert TWSE date format "20260512" to ISO
  const rawDate = json.date ?? '';
  const isoDate =
    rawDate.length === 8
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      : new Date().toISOString().slice(0, 10);

  return { date: isoDate, adr };
};
