import { fetchWithRetry } from '../lib/http';

const TAIFEX_FOREIGN_FUTURES =
  'https://www.taifex.com.tw/cht/3/futContractsDateDown';
const TAIFEX_OPTIONS_PCR =
  'https://www.taifex.com.tw/cht/3/pcRatioDown';

const normalizeDate = (raw: string): string => raw.replace(/\//g, '-');

export interface ForeignFuturesOI {
  date: string;
  netOi: number;
}

export const fetchForeignFuturesOI = async (): Promise<ForeignFuturesOI> => {
  const res = await fetchWithRetry(TAIFEX_FOREIGN_FUTURES);
  const text = await res.text();
  const lines = text.trim().split('\n').slice(1);
  for (const line of lines) {
    const cols = line.split(',');
    if (cols[1]?.trim() === '外資') {
      const longOi = Number(cols[2]);
      const shortOi = Number(cols[3]);
      return { date: normalizeDate(cols[0].trim()), netOi: longOi - shortOi };
    }
  }
  throw new Error('foreign futures row not found');
};

export interface OptionsPCR {
  date: string;
  pcr: number;
}

export const fetchOptionsPCR = async (): Promise<OptionsPCR> => {
  const res = await fetchWithRetry(TAIFEX_OPTIONS_PCR);
  const text = await res.text();
  const lines = text.trim().split('\n').slice(1);
  const first = lines[0];
  if (!first) throw new Error('empty PCR response');
  const cols = first.split(',');
  const put = Number(cols[1]);
  const call = Number(cols[2]);
  return { date: normalizeDate(cols[0].trim()), pcr: put / call };
};
