import { fetchWithRetry } from '../lib/http';
import { finMindToken } from '../lib/finmind-token';

export type YahooKeyStats = {
  trailingPE: number | null;
  forwardPE: number | null;
  pegRatio: number | null;
  trailingEps: number | null;
  forwardEps: number | null;
  earningsGrowth: number | null;
};

const NULL_STATS: YahooKeyStats = {
  trailingPE: null,
  forwardPE: null,
  pegRatio: null,
  trailingEps: null,
  forwardEps: null,
  earningsGrowth: null,
};

type FinMindPerRow = { date: string; stock_id: string; PER: number; PBR: number; dividend_yield: number };
type FinMindResp = { msg: string; status: number; data: FinMindPerRow[] };

const fetchTwPer = async (
  symbol: string,
  opts: { fetcher?: typeof fetch } = {},
): Promise<YahooKeyStats> => {
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
  const url = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPER&data_id=${symbol}&start_date=${start}&end_date=${today}&token=${finMindToken()}`;
  try {
    const res = await fetchWithRetry(
      url,
      { headers: { Accept: 'application/json' } },
      opts.fetcher !== undefined ? { fetcher: opts.fetcher } : {},
    );
    const json = (await res.json()) as FinMindResp;
    if (json.status !== 200 || !Array.isArray(json.data) || json.data.length === 0) return NULL_STATS;
    const latest = json.data[json.data.length - 1];
    if (!latest) return NULL_STATS;
    const pe = Number.isFinite(latest.PER) && latest.PER > 0 ? latest.PER : null;
    return { ...NULL_STATS, trailingPE: pe };
  } catch (err) {
    console.warn('[finmind PER] fetch failed', symbol, err);
    return NULL_STATS;
  }
};

// symbolKey accepts either bare TW ticker (e.g. '2330') or full Yahoo symbol like '^GSPC'.
// For TW symbols, uses FinMind TaiwanStockPER (Yahoo v10 quoteSummary now requires crumb auth).
// For non-TW (indexes/US stocks), returns null stats — needs a different source.
export const fetchYahooKeyStats = async (
  symbolKey: string,
  opts: { fetcher?: typeof fetch } = {},
): Promise<YahooKeyStats> => {
  const isTwBare = /^[0-9]{4,6}$/.test(symbolKey);
  if (isTwBare) return fetchTwPer(symbolKey, opts);
  return NULL_STATS;
};
