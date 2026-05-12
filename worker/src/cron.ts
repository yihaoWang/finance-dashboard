import type { Env } from './index';
import { runDigestPipeline } from './lib/digest-runner';
import { upsertEvents } from './cache/d1-events';
import { fetchEconomicEvents } from './sources/events';
import { fetchForeignFuturesOI, fetchOptionsPCR } from './sources/taifex';
import { fetchBreadthADR } from './sources/twse-breadth';
import { fetchMarginMaintenanceDaily, fetchShortLongRatioDaily } from './sources/twse-margin';
import { fetchInstitutional5dDaily } from './sources/twse-chips';
import { insertDailyValue } from './cache/d1-sentiment';
import type { IndicatorKey } from '@fd/shared';

const WATCHLIST = ['2330', '2454', '2317', '3008', '2308'];

const runSentimentDaily = async (env: Env): Promise<void> => {
  const tasks: Array<{
    key: IndicatorKey;
    fetcher: () => Promise<{ date: string; value: number }>;
  }> = [
    { key: 'margin_maintenance', fetcher: fetchMarginMaintenanceDaily },
    { key: 'short_long_ratio', fetcher: fetchShortLongRatioDaily },
    { key: 'institutional_5d', fetcher: fetchInstitutional5dDaily },
    {
      key: 'foreign_futures_oi',
      fetcher: async () => {
        const r = await fetchForeignFuturesOI();
        return { date: r.date, value: r.netOi };
      },
    },
    {
      key: 'breadth_adr',
      fetcher: async () => {
        const r = await fetchBreadthADR();
        return { date: r.date, value: r.adr };
      },
    },
    {
      key: 'options_pcr',
      fetcher: async () => {
        const r = await fetchOptionsPCR();
        return { date: r.date, value: r.pcr };
      },
    },
  ];
  for (const t of tasks) {
    try {
      const { date, value } = await t.fetcher();
      await insertDailyValue(env.DB, t.key, date, value);
    } catch (error) {
      console.warn('sentiment daily failed', t.key, error);
    }
  }
  await env.KV.delete('sentiment:bundle');
};

export const scheduled: ExportedHandlerScheduledHandler<Env> = async (_event, env, ctx) => {
  ctx.waitUntil(
    (async (): Promise<void> => {
      try {
        await runSentimentDaily(env);
      } catch (err) {
        console.error('sentiment daily pipeline failed', err);
      }

      try {
        const items = await fetchEconomicEvents();
        await upsertEvents(env.DB, items, Date.now());
      } catch (err) {
        console.error('events refresh failed', err);
      }

      try {
        await runDigestPipeline(env, { scope: 'market', symbol: 'market' });
      } catch (err) {
        console.error('digest pipeline failed for market', err);
      }

      for (const symbol of WATCHLIST) {
        try {
          await runDigestPipeline(env, { scope: 'stock', symbol });
        } catch (err) {
          console.error('digest pipeline failed for symbol', symbol, err);
        }
      }
    })(),
  );
};
