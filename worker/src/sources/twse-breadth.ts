import { fetchWithRetry } from '../lib/http';

const TWSE_BREADTH = 'https://www.twse.com.tw/rwd/zh/afterTrading/BWIBBU_d?response=json';

interface TwseBreadthRow {
  date: string;
  data: [string, string][];
}

const toIso = (yyyymmdd: string): string =>
  `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;

export interface BreadthADR {
  date: string;
  adr: number;
}

export const fetchBreadthADR = async (): Promise<BreadthADR> => {
  const res = await fetchWithRetry(TWSE_BREADTH);
  const json = (await res.json()) as TwseBreadthRow;
  const advRow = json.data.find((r) => r[0] === '上漲');
  const decRow = json.data.find((r) => r[0] === '下跌');
  if (!advRow || !decRow) throw new Error('breadth rows not found');
  const adv = Number(advRow[1].replace(/,/g, ''));
  const dec = Number(decRow[1].replace(/,/g, ''));
  return { date: toIso(json.date), adr: Number((adv / dec).toFixed(2)) };
};
