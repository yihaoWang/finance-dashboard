import type { Env } from './index';
import { runDigestPipeline } from './lib/digest-runner';
import { upsertEvents } from './cache/d1-events';
import { fetchEconomicEvents } from './sources/events';

const WATCHLIST = ['2330', '2454', '2317', '3008', '2308'];

export const scheduled: ExportedHandlerScheduledHandler<Env> = async (_event, env, ctx) => {
  ctx.waitUntil(
    (async (): Promise<void> => {
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
