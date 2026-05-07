import type { Env } from '../index';
import type { DigestBundle, DigestScope, DigestSource } from '@fd/shared';
import { fetchFredSnapshot } from '../sources/fred';
import { fetchTwseBwibbu } from '../sources/twse';
import { fetchTwseChips } from '../sources/twse-chips';
import { fetchYahooNews } from '../sources/yahoo-news';
import { fetchYahooQuote } from '../sources/yahoo';
import { SYSTEM_PROMPT, buildPrompt, parseSections } from './digest-prompt';
import { upsertDigest } from '../cache/d1-digests';

export type RunArgs = { scope: DigestScope; symbol: string };

export type DigestPayload = {
  system: string;
  user: string;
  sources: DigestSource[];
  scope: DigestScope;
  symbol: string;
  date: string;
};

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const MARKET_NEWS_SYMBOLS = ['2330', '2454'];

export const gatherDigestPayload = async (
  env: Pick<Env, 'KV' | 'FRED_API_KEY'>,
  args: RunArgs,
): Promise<DigestPayload> => {
  const { scope, symbol } = args;
  const date = new Date().toISOString().slice(0, 10);
  const now = Date.now();

  const sources: DigestSource[] = [];

  // Fetch all data in parallel
  const newsSymbol = scope === 'stock' ? symbol : (MARKET_NEWS_SYMBOLS[0] ?? '2330');

  const [fredResult, twseMarketResult, chipsResult, newsResult, quoteResult] =
    await Promise.allSettled([
      fetchFredSnapshot(env),
      fetchTwseBwibbu(env.KV, scope === 'market' ? 'Y9999' : symbol),
      scope === 'stock' ? fetchTwseChips(env.KV, symbol) : Promise.resolve(null),
      fetchYahooNews(newsSymbol),
      scope === 'stock' ? fetchYahooQuote(symbol) : Promise.resolve(null),
    ]);

  const fred = fredResult.status === 'fulfilled' ? fredResult.value : null;
  const twseMarket = twseMarketResult.status === 'fulfilled' ? twseMarketResult.value : null;
  const chips = chipsResult.status === 'fulfilled' ? chipsResult.value : null;
  const news = newsResult.status === 'fulfilled' ? newsResult.value : [];
  const quote = quoteResult.status === 'fulfilled' ? quoteResult.value : null;

  // Collect sources
  sources.push({
    name: 'FRED DGS10',
    url: 'https://api.stlouisfed.org/fred/series/observations?series_id=DGS10',
    timestamp: now,
  });
  sources.push({
    name: 'TWSE BWIBBU',
    url: 'https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_d',
    timestamp: now,
  });
  if (scope === 'stock') {
    sources.push({
      name: `Yahoo News ${symbol}`,
      url: `https://tw.stock.yahoo.com/rss?s=${symbol}.TW`,
      timestamp: now,
    });
    sources.push({
      name: `Yahoo Quote ${symbol}`,
      url: `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.TW`,
      timestamp: now,
    });
    sources.push({
      name: 'TWSE T86 Chips',
      url: 'https://www.twse.com.tw/rwd/zh/fund/T86',
      timestamp: now,
    });
  } else {
    sources.push({
      name: 'Yahoo News Market',
      url: `https://tw.stock.yahoo.com/rss?s=${newsSymbol}.TW`,
      timestamp: now,
    });
  }

  const user = buildPrompt({ scope, symbol, date, fred, twseMarket, chips, news: news ?? [], quote });

  return { system: SYSTEM_PROMPT, user, sources, scope, symbol, date };
};

export const runDigestPipeline = async (env: Env, args: RunArgs): Promise<DigestBundle> => {
  const payload = await gatherDigestPayload(env, args);
  const { system, user, sources, scope, symbol, date } = payload;
  const now = Date.now();

  // Call Workers AI
  const aiResponse = await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: 1024,
  });

  const responseText = (aiResponse as { response: string }).response ?? '';

  // Parse sections
  const sections = parseSections(responseText);

  // Upsert into D1
  const bundle: DigestBundle = {
    date,
    scope,
    symbol,
    sections,
    sources,
    model: MODEL,
    createdAt: now,
  };

  await upsertDigest(env.DB, bundle);

  return bundle;
};
