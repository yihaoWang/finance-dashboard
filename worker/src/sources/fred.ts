import { fetchWithRetry } from '../lib/http';
import { kvGetJson, kvPutJson } from '../cache/kv';

export type FredObservation = { latest: number; prev: number; date: string } | null;

export type FredSnapshot = {
  dgs10: FredObservation;
  cpi: FredObservation;
  pce: FredObservation;
  unrate: FredObservation;
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

export const fetchFredSnapshot = async (
  env: { KV: KVNamespace; FRED_API_KEY?: string },
  opts: Opts = {},
): Promise<FredSnapshot> => {
  const nullSnapshot: FredSnapshot = { dgs10: null, cpi: null, pce: null, unrate: null };

  const cached = await kvGetJson<FredSnapshot>(env.KV, KV_KEY);
  if (cached !== null) return cached;

  const apiKey = env.FRED_API_KEY;
  if (!apiKey) {
    console.warn('FRED_API_KEY is not set — returning null snapshot');
    return nullSnapshot;
  }

  const [dgs10Result, cpiResult, pceResult, unrateResult] = await Promise.allSettled([
    fetchSeries('DGS10', apiKey, opts),
    fetchSeries('CPIAUCSL', apiKey, opts),
    fetchSeries('PCEPI', apiKey, opts),
    fetchSeries('UNRATE', apiKey, opts),
  ]);

  const snapshot: FredSnapshot = {
    dgs10: dgs10Result.status === 'fulfilled' ? dgs10Result.value : null,
    cpi: cpiResult.status === 'fulfilled' ? cpiResult.value : null,
    pce: pceResult.status === 'fulfilled' ? pceResult.value : null,
    unrate: unrateResult.status === 'fulfilled' ? unrateResult.value : null,
  };

  await kvPutJson(env.KV, KV_KEY, snapshot, TTL);
  return snapshot;
};
