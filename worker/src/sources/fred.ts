import { fetchWithRetry } from '../lib/http';
import { kvGetJson, kvPutJson } from '../cache/kv';

export type FredObservation = { latest: number; prev: number; date: string } | null;

export type FredSnapshot = {
  dgs10: FredObservation;
  cpi: FredObservation;
  pce: FredObservation;
  unrate: FredObservation;
  fedFunds: FredObservation;
  nfpChange: FredObservation;
  gdpYoy: FredObservation;
  pmi: FredObservation;
  ppi: FredObservation;
  umcsent: FredObservation;
};

type FredApiResponse = {
  observations: Array<{ date: string; value: string }>;
};

const KV_KEY = 'fred:snapshot';
const TTL = 6 * 3600;

const BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';

type Opts = { fetcher?: typeof fetch };

const parseSeries = (raw: FredApiResponse): FredObservation => {
  const valid = raw.observations.filter((o) => o.value !== '.' && o.value !== '');
  const first = valid[0];
  const second = valid[1];
  if (!first) return null;
  const latestVal = Number(first.value);
  const prevVal = second !== undefined ? Number(second.value) : latestVal;
  if (!Number.isFinite(latestVal)) return null;
  return {
    latest: latestVal,
    prev: Number.isFinite(prevVal) ? prevVal : latestVal,
    date: first.date,
  };
};

const fetchSeries = async (
  seriesId: string,
  apiKey: string,
  opts: Opts,
): Promise<FredObservation> => {
  const url = `${BASE_URL}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=2`;
  const res = await fetchWithRetry(
    url,
    { headers: { Accept: 'application/json' } },
    opts.fetcher !== undefined ? { fetcher: opts.fetcher } : {},
  );
  const json = (await res.json()) as FredApiResponse;
  return parseSeries(json);
};

const yoyPct = (newest: number, yearAgo: number): number =>
  yearAgo === 0 ? 0 : ((newest - yearAgo) / yearAgo) * 100;

const fetchYoySeries = async (
  seriesId: string,
  apiKey: string,
  opts: Opts,
): Promise<FredObservation> => {
  const url = `${BASE_URL}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=13`;
  const res = await fetchWithRetry(
    url,
    { headers: { Accept: 'application/json' } },
    opts.fetcher !== undefined ? { fetcher: opts.fetcher } : {},
  );
  const json = (await res.json()) as FredApiResponse;
  const valid = json.observations.filter((o) => o.value !== '.' && o.value !== '');
  if (valid.length < 13) return null;
  const latest = Number(valid[0].value);
  const yearAgo = Number(valid[12].value);
  const prevLatest = Number(valid[1].value);
  const prevYearAgo = Number(valid[13] !== undefined ? valid[13].value : valid[12].value);
  if (!Number.isFinite(latest) || !Number.isFinite(yearAgo)) return null;
  return {
    latest: yoyPct(latest, yearAgo),
    prev: yoyPct(prevLatest, prevYearAgo),
    date: valid[0].date,
  };
};

const fetchNfpChange = async (
  apiKey: string,
  opts: Opts,
): Promise<FredObservation> => {
  const url = `${BASE_URL}?series_id=PAYEMS&api_key=${apiKey}&file_type=json&sort_order=desc&limit=2`;
  const res = await fetchWithRetry(
    url,
    { headers: { Accept: 'application/json' } },
    opts.fetcher !== undefined ? { fetcher: opts.fetcher } : {},
  );
  const json = (await res.json()) as FredApiResponse;
  const valid = json.observations.filter((o) => o.value !== '.' && o.value !== '');
  if (valid.length < 2) return null;
  const current = Number(valid[0].value);
  const previous = Number(valid[1].value);
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  // PAYEMS is in thousands — MoM diff already in thousands
  return {
    latest: current - previous,
    prev: previous,
    date: valid[0].date,
  };
};

export const fetchFredSnapshot = async (
  env: { KV: KVNamespace; FRED_API_KEY?: string },
  opts: Opts = {},
): Promise<FredSnapshot> => {
  const nullSnapshot: FredSnapshot = {
    dgs10: null,
    cpi: null,
    pce: null,
    unrate: null,
    fedFunds: null,
    nfpChange: null,
    gdpYoy: null,
    pmi: null,
    ppi: null,
    umcsent: null,
  };

  const cached = await kvGetJson<FredSnapshot>(env.KV, KV_KEY);
  if (cached !== null) return cached;

  const apiKey = env.FRED_API_KEY;
  if (!apiKey) {
    console.warn('FRED_API_KEY is not set — returning null snapshot');
    return nullSnapshot;
  }

  const [
    dgs10Result,
    cpiResult,
    pceResult,
    unrateResult,
    fedFundsResult,
    nfpResult,
    gdpResult,
    pmiResult,
    ppiResult,
    umcsentResult,
  ] = await Promise.allSettled([
    fetchSeries('DGS10', apiKey, opts),
    fetchYoySeries('CPIAUCSL', apiKey, opts),
    fetchYoySeries('PCEPI', apiKey, opts),
    fetchSeries('UNRATE', apiKey, opts),
    fetchSeries('FEDFUNDS', apiKey, opts),
    fetchNfpChange(apiKey, opts),
    fetchSeries('A191RL1Q225SBEA', apiKey, opts),
    fetchSeries('NAPM', apiKey, opts),
    fetchYoySeries('PPIACO', apiKey, opts),
    fetchSeries('UMCSENT', apiKey, opts),
  ]);

  const resolve = (r: PromiseSettledResult<FredObservation>): FredObservation =>
    r.status === 'fulfilled' ? r.value : null;

  const snapshot: FredSnapshot = {
    dgs10: resolve(dgs10Result),
    cpi: resolve(cpiResult),
    pce: resolve(pceResult),
    unrate: resolve(unrateResult),
    fedFunds: resolve(fedFundsResult),
    nfpChange: resolve(nfpResult),
    gdpYoy: resolve(gdpResult),
    pmi: resolve(pmiResult),
    ppi: resolve(ppiResult),
    umcsent: resolve(umcsentResult),
  };

  await kvPutJson(env.KV, KV_KEY, snapshot, TTL);
  return snapshot;
};
