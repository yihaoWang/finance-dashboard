import { fetchWithRetry } from '../lib/http';
import { kvGetJson, kvPutJson } from '../cache/kv';

export type FearGreed = {
  value: number;
  classification: string;
  timestamp: string;
};

const KV_KEY = 'cnn:feargreed';
const TTL = 6 * 3600;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15';

type Resp = {
  fear_and_greed?: {
    score?: number;
    rating?: string;
    timestamp?: string;
  };
};

export const fetchFearGreed = async (
  kv: KVNamespace,
): Promise<FearGreed | null> => {
  const cached = await kvGetJson<FearGreed>(kv, KV_KEY);
  if (cached !== null) return cached;

  try {
    const res = await fetchWithRetry(
      'https://production.dataviz.cnn.io/index/fearandgreed/graphdata',
      { headers: { 'User-Agent': UA, Accept: 'application/json', Origin: 'https://edition.cnn.com' } },
    );
    const json = (await res.json()) as Resp;
    const fg = json.fear_and_greed;
    if (!fg || typeof fg.score !== 'number') return null;
    const out: FearGreed = {
      value: Math.round(fg.score),
      classification: fg.rating ?? '',
      timestamp: fg.timestamp ?? new Date().toISOString(),
    };
    await kvPutJson(kv, KV_KEY, out, TTL);
    return out;
  } catch (err) {
    console.warn('[cnn-feargreed] fetch failed', err);
    return null;
  }
};
