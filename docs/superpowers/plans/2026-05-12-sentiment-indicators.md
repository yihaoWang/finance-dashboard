# Sentiment Indicators Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 台股 sentiment / 籌碼 indicators to Tickr (fear-greed + margin maintenance + short/long ratio + institutional 5d + foreign futures OI + breadth ADR + options PCR) with 10-year dynamic percentile and named historical landmarks, then integrate into digest `action_plan`.

**Architecture:** New D1 table `sentiment_history` stores 10y daily series for 7 indicators. New sources for TAIFEX (futures OI + PCR) and TWSE breadth. A `sentiment.ts` lib computes percentile + nearest landmark + composite fear-greed. New `/api/sentiment` route follows existing KV→D1→fetch cache pattern. Frontend adds `SentimentPanel` with `FearGreedGauge` + 6 `SentimentCard`s. Digest prompt builder ingests indicators and emits `action_plan` referencing them.

**Tech Stack:** Cloudflare Workers (Hono), D1, KV, React + Vite, vitest, RTL.

**Reference spec:** `docs/superpowers/specs/2026-05-12-sentiment-indicators-design.md`

**Conventions (from CLAUDE.md):**
- Arrow functions only; `Promise<T>` returns; `unknown` in catch; no `any`; merged exports; no empty catch
- Worker source adapters use `lib/http.ts` `fetchWithRetry`
- Route handlers use KV → D1 → fetch three-layer cache pattern (see `routes/macro.ts`)
- Shared types in `shared/src/types.ts`
- D1 schema changes via new migration only (no in-place edits)

---

## File Structure

**Create:**
- `worker/migrations/0006_sentiment_history.sql`
- `worker/src/sources/taifex.ts` — fetch foreign futures OI + options PCR
- `worker/src/sources/twse-breadth.ts` — fetch advance/decline counts → ADR
- `worker/src/data/historical-landmarks.ts` — hardcoded named events per indicator
- `worker/src/lib/sentiment.ts` — `computePercentile`, `findNearestLandmark`, `computeFearGreed`, `classifyZone`
- `worker/src/cache/d1-sentiment.ts` — D1 read/write helpers for `sentiment_history`
- `worker/src/routes/sentiment.ts` — `GET /api/sentiment`
- `worker/test/sources.taifex.test.ts`
- `worker/test/sources.twse-breadth.test.ts`
- `worker/test/lib.sentiment.test.ts`
- `worker/test/routes.sentiment.test.ts`
- `scripts/backfill-sentiment-history.ts` — one-shot 10y backfill
- `web/src/hooks/useSentiment.ts`
- `web/src/components/SentimentPanel.tsx`
- `web/src/components/FearGreedGauge.tsx`
- `web/src/components/SentimentCard.tsx`

**Modify:**
- `shared/src/types.ts` — add `SentimentIndicator`, `SentimentBundle`, `LandmarkPoint`, `FearGreedSnapshot`, `IndicatorKey`, `SentimentZone`
- `worker/src/index.ts` — mount `/api/sentiment` route
- `worker/src/cron.ts` — append daily sentiment value to D1
- `worker/src/routes/digest.ts` — inject `<sentiment>` block into prompt; require `action_plan` to reference indicators
- `web/src/pages/DashboardPage.tsx` — embed `<SentimentPanel/>` between `MacroPanel` and `AnalysisPanels`

---

## Task 1: D1 migration + types

**Files:**
- Create: `worker/migrations/0006_sentiment_history.sql`
- Modify: `shared/src/types.ts`

- [ ] **Step 1: Write migration**

`worker/migrations/0006_sentiment_history.sql`:
```sql
CREATE TABLE IF NOT EXISTS sentiment_history (
  indicator TEXT NOT NULL,
  date TEXT NOT NULL,
  value REAL NOT NULL,
  PRIMARY KEY (indicator, date)
);
CREATE INDEX IF NOT EXISTS idx_sentiment_indicator_date
  ON sentiment_history(indicator, date DESC);
```

- [ ] **Step 2: Add shared types**

Append to `shared/src/types.ts`:
```ts
export type IndicatorKey =
  | 'margin_maintenance'
  | 'short_long_ratio'
  | 'institutional_5d'
  | 'foreign_futures_oi'
  | 'breadth_adr'
  | 'options_pcr';

export type SentimentZone = 'healthy' | 'neutral' | 'caution' | 'danger';

export interface LandmarkPoint {
  event: string;
  value: number;
  date: string;
}

export interface SentimentIndicator {
  key: IndicatorKey;
  label: string;
  value: number;
  unit: string;
  change5d: number;
  percentile: number;
  zone: SentimentZone;
  nearestLandmark: (LandmarkPoint & { distance: number }) | null;
  landmarks: LandmarkPoint[];
  explanation: string;
}

export interface FearGreedSnapshot {
  value: number;
  label: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';
  percentile: number;
}

export interface SentimentBundle {
  fearGreed: FearGreedSnapshot;
  indicators: SentimentIndicator[];
  updatedAt: string;
}
```

- [ ] **Step 3: Apply migration locally**

Run:
```bash
pnpm --filter worker exec wrangler d1 migrations apply tickr --local
```
Expected: `0006_sentiment_history.sql` applied.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter web typecheck && pnpm --filter worker exec tsc --noEmit`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add worker/migrations/0006_sentiment_history.sql shared/src/types.ts
git commit -m "feat(sentiment): D1 migration + shared types"
```

---

## Task 2: Historical landmarks data

**Files:**
- Create: `worker/src/data/historical-landmarks.ts`

- [ ] **Step 1: Write landmarks file**

`worker/src/data/historical-landmarks.ts`:
```ts
import type { IndicatorKey, LandmarkPoint } from '@fd/shared';

export const HISTORICAL_LANDMARKS: Record<IndicatorKey, LandmarkPoint[]> = {
  margin_maintenance: [
    { event: '2008 金融海嘯底', value: 118, date: '2008-11-21' },
    { event: 'COVID-19 急跌底', value: 135, date: '2020-03-19' },
    { event: '2022 升息熊市底', value: 138, date: '2022-10-25' },
    { event: '2024 多頭高點', value: 168, date: '2024-07-11' },
  ],
  short_long_ratio: [
    { event: '2008 金融海嘯', value: 0.8, date: '2008-10-28' },
    { event: '2020 COVID', value: 1.2, date: '2020-03-19' },
    { event: '2022 熊市底', value: 2.1, date: '2022-10-25' },
    { event: '2024 多頭高點', value: 4.5, date: '2024-07-11' },
  ],
  institutional_5d: [
    { event: '2020 COVID 急跌', value: -1500, date: '2020-03-19' },
    { event: '2022 熊市底', value: -1200, date: '2022-10-25' },
    { event: '2024 多頭高點', value: 1800, date: '2024-07-11' },
  ],
  foreign_futures_oi: [
    { event: '2008 海嘯', value: -45000, date: '2008-11-21' },
    { event: '2020 COVID', value: -38000, date: '2020-03-19' },
    { event: '2022 熊市底', value: -35000, date: '2022-10-25' },
    { event: '2024 多頭高點', value: 32000, date: '2024-07-11' },
  ],
  breadth_adr: [
    { event: '2020 COVID 急跌', value: 0.18, date: '2020-03-19' },
    { event: '2022 熊市底', value: 0.25, date: '2022-10-25' },
    { event: '2024 多頭高點', value: 2.8, date: '2024-07-11' },
  ],
  options_pcr: [
    { event: '2020 COVID 急跌', value: 1.85, date: '2020-03-19' },
    { event: '2022 熊市底', value: 1.62, date: '2022-10-25' },
    { event: '2024 多頭高點', value: 0.65, date: '2024-07-11' },
  ],
};
```

Note: values are documented approximations sourced from TWSE / TAIFEX historical disclosures; refine during backfill review.

- [ ] **Step 2: Commit**

```bash
git add worker/src/data/historical-landmarks.ts
git commit -m "feat(sentiment): historical landmark anchors"
```

---

## Task 3: Sentiment lib — percentile + landmark + zone

**Files:**
- Create: `worker/src/lib/sentiment.ts`, `worker/test/lib.sentiment.test.ts`

- [ ] **Step 1: Write failing tests**

`worker/test/lib.sentiment.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computePercentile, findNearestLandmark, classifyZone, computeFearGreed } from '../src/lib/sentiment';
import { HISTORICAL_LANDMARKS } from '../src/data/historical-landmarks';

describe('computePercentile', () => {
  it('returns 0 for value below all history', () => {
    expect(computePercentile([100, 120, 140, 160], 50)).toBe(0);
  });
  it('returns 100 for value above all history', () => {
    expect(computePercentile([100, 120, 140, 160], 200)).toBe(100);
  });
  it('returns ~50 for median value', () => {
    expect(computePercentile([100, 120, 140, 160], 130)).toBeGreaterThanOrEqual(40);
    expect(computePercentile([100, 120, 140, 160], 130)).toBeLessThanOrEqual(60);
  });
  it('returns 0 for empty history', () => {
    expect(computePercentile([], 100)).toBe(0);
  });
});

describe('findNearestLandmark', () => {
  it('returns the landmark closest in value', () => {
    const result = findNearestLandmark(HISTORICAL_LANDMARKS.margin_maintenance, 140);
    expect(result?.event).toBe('2022 升息熊市底');
    expect(result?.distance).toBe(2);
  });
  it('returns null for empty landmarks', () => {
    expect(findNearestLandmark([], 100)).toBeNull();
  });
});

describe('classifyZone (margin_maintenance: lower = worse)', () => {
  it('danger when percentile < 15', () => {
    expect(classifyZone('margin_maintenance', 10)).toBe('danger');
  });
  it('caution when 15 <= p < 35', () => {
    expect(classifyZone('margin_maintenance', 25)).toBe('caution');
  });
  it('healthy when p >= 65 and indicator favors high values', () => {
    expect(classifyZone('margin_maintenance', 80)).toBe('healthy');
  });
});

describe('computeFearGreed', () => {
  it('returns 0-100 numeric score', () => {
    const out = computeFearGreed({
      marginMaintenancePercentile: 20,
      shortLongRatioPercentile: 80,
      institutional5dPercentile: 30,
      foreignFuturesOiPercentile: 25,
      breadthAdrPercentile: 20,
      optionsPcrPercentile: 75,
    });
    expect(out.value).toBeGreaterThanOrEqual(0);
    expect(out.value).toBeLessThanOrEqual(100);
    expect(['Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed']).toContain(out.label);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `pnpm --filter worker test lib.sentiment`
Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implement**

`worker/src/lib/sentiment.ts`:
```ts
import type { IndicatorKey, LandmarkPoint, SentimentZone, FearGreedSnapshot } from '@fd/shared';

export const computePercentile = (history: number[], value: number): number => {
  if (history.length === 0) return 0;
  const sorted = [...history].sort((a, b) => a - b);
  let below = 0;
  for (const v of sorted) {
    if (v < value) below += 1;
    else break;
  }
  return Math.round((below / sorted.length) * 100);
};

export const findNearestLandmark = (
  landmarks: LandmarkPoint[],
  value: number,
): (LandmarkPoint & { distance: number }) | null => {
  if (landmarks.length === 0) return null;
  let best = landmarks[0];
  let bestDist = Math.abs(landmarks[0].value - value);
  for (const lm of landmarks.slice(1)) {
    const d = Math.abs(lm.value - value);
    if (d < bestDist) {
      best = lm;
      bestDist = d;
    }
  }
  return { ...best, distance: Number(bestDist.toFixed(2)) };
};

const HIGHER_IS_HEALTHIER: Record<IndicatorKey, boolean> = {
  margin_maintenance: true,
  short_long_ratio: false,
  institutional_5d: true,
  foreign_futures_oi: true,
  breadth_adr: true,
  options_pcr: false,
};

export const classifyZone = (key: IndicatorKey, percentile: number): SentimentZone => {
  const higherHealthier = HIGHER_IS_HEALTHIER[key];
  const p = higherHealthier ? percentile : 100 - percentile;
  if (p < 15) return 'danger';
  if (p < 35) return 'caution';
  if (p < 65) return 'neutral';
  return 'healthy';
};

interface FearGreedInputs {
  marginMaintenancePercentile: number;
  shortLongRatioPercentile: number;
  institutional5dPercentile: number;
  foreignFuturesOiPercentile: number;
  breadthAdrPercentile: number;
  optionsPcrPercentile: number;
}

export const computeFearGreed = (inputs: FearGreedInputs): FearGreedSnapshot => {
  const greedScore =
    inputs.marginMaintenancePercentile * 0.2 +
    (100 - inputs.shortLongRatioPercentile) * 0.15 +
    inputs.institutional5dPercentile * 0.2 +
    inputs.foreignFuturesOiPercentile * 0.15 +
    inputs.breadthAdrPercentile * 0.15 +
    (100 - inputs.optionsPcrPercentile) * 0.15;
  const value = Math.round(greedScore);
  const label: FearGreedSnapshot['label'] =
    value < 20 ? 'Extreme Fear'
    : value < 45 ? 'Fear'
    : value < 55 ? 'Neutral'
    : value < 80 ? 'Greed'
    : 'Extreme Greed';
  return { value, label, percentile: value };
};
```

- [ ] **Step 4: Run, expect pass**

Run: `pnpm --filter worker test lib.sentiment`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add worker/src/lib/sentiment.ts worker/test/lib.sentiment.test.ts
git commit -m "feat(sentiment): percentile, landmark, zone, fear-greed lib"
```

---

## Task 4: D1 cache helper

**Files:**
- Create: `worker/src/cache/d1-sentiment.ts`

- [ ] **Step 1: Implement (no separate test — covered by route integration)**

`worker/src/cache/d1-sentiment.ts`:
```ts
import type { IndicatorKey } from '@fd/shared';

export interface SentimentRow {
  date: string;
  value: number;
}

export const getHistory = async (
  db: D1Database,
  indicator: IndicatorKey,
  days: number = 365 * 10,
): Promise<SentimentRow[]> => {
  const result = await db
    .prepare(
      'SELECT date, value FROM sentiment_history WHERE indicator = ?1 ORDER BY date DESC LIMIT ?2',
    )
    .bind(indicator, days)
    .all<SentimentRow>();
  return result.results ?? [];
};

export const insertDailyValue = async (
  db: D1Database,
  indicator: IndicatorKey,
  date: string,
  value: number,
): Promise<void> => {
  await db
    .prepare(
      'INSERT OR REPLACE INTO sentiment_history (indicator, date, value) VALUES (?1, ?2, ?3)',
    )
    .bind(indicator, date, value)
    .run();
};
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter worker exec tsc --noEmit
git add worker/src/cache/d1-sentiment.ts
git commit -m "feat(sentiment): D1 history read/write helpers"
```

---

## Task 5: TAIFEX source (foreign futures OI + options PCR)

**Files:**
- Create: `worker/src/sources/taifex.ts`, `worker/test/sources.taifex.test.ts`

- [ ] **Step 1: Write failing tests**

`worker/test/sources.taifex.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchForeignFuturesOI, fetchOptionsPCR } from '../src/sources/taifex';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('fetchForeignFuturesOI', () => {
  it('parses net OI for foreign institutional traders', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '日期,身份別,多方未平倉口數,空方未平倉口數\n2026/05/12,外資,50000,18000\n',
    }));
    const out = await fetchForeignFuturesOI();
    expect(out.netOi).toBe(32000);
    expect(out.date).toBe('2026-05-12');
  });
});

describe('fetchOptionsPCR', () => {
  it('parses put/call ratio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '日期,賣權成交量,買權成交量\n2026/05/12,180000,150000\n',
    }));
    const out = await fetchOptionsPCR();
    expect(out.pcr).toBeCloseTo(1.2, 2);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `pnpm --filter worker test sources.taifex`
Expected: FAIL.

- [ ] **Step 3: Implement**

`worker/src/sources/taifex.ts`:
```ts
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
```

Note: TAIFEX endpoint paths/columns may differ — implementer should verify against live TAIFEX OpenAPI docs and adjust parsing. Tests provide the contract.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter worker test sources.taifex`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add worker/src/sources/taifex.ts worker/test/sources.taifex.test.ts
git commit -m "feat(sentiment): TAIFEX source (foreign futures OI + options PCR)"
```

---

## Task 6: TWSE breadth source (advance/decline → ADR)

**Files:**
- Create: `worker/src/sources/twse-breadth.ts`, `worker/test/sources.twse-breadth.test.ts`

- [ ] **Step 1: Write failing test**

`worker/test/sources.twse-breadth.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBreadthADR } from '../src/sources/twse-breadth';

beforeEach(() => vi.restoreAllMocks());

describe('fetchBreadthADR', () => {
  it('returns advance/decline ratio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        date: '20260512',
        data: [['上漲', '600'], ['下跌', '300']],
      }),
    }));
    const out = await fetchBreadthADR();
    expect(out.adr).toBe(2);
    expect(out.date).toBe('2026-05-12');
  });
});
```

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement**

`worker/src/sources/twse-breadth.ts`:
```ts
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
```

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter worker test sources.twse-breadth
git add worker/src/sources/twse-breadth.ts worker/test/sources.twse-breadth.test.ts
git commit -m "feat(sentiment): TWSE breadth ADR source"
```

---

## Task 7: Backfill script (10y historical data)

**Files:**
- Create: `scripts/backfill-sentiment-history.ts`

- [ ] **Step 1: Implement**

`scripts/backfill-sentiment-history.ts`:
```ts
/**
 * One-shot backfill: 10 years of daily values for 6 indicators into D1 sentiment_history.
 *
 * Usage:
 *   WORKER_URL=https://tickr.example.com D1_TOKEN=... \
 *     pnpm tsx scripts/backfill-sentiment-history.ts
 *
 * Source pacing: throttle each TWSE/TAIFEX endpoint to 1 req/sec to stay polite.
 */
import type { IndicatorKey } from '@fd/shared';

const START = new Date(Date.now() - 365 * 10 * 86400_000);
const END = new Date();
const INDICATORS: IndicatorKey[] = [
  'margin_maintenance',
  'short_long_ratio',
  'institutional_5d',
  'foreign_futures_oi',
  'breadth_adr',
  'options_pcr',
];

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isoDates = (): string[] => {
  const out: string[] = [];
  for (let d = new Date(START); d <= END; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day === 0 || day === 6) continue;
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
};

const fetchDailyValue = async (
  indicator: IndicatorKey,
  date: string,
): Promise<number | null> => {
  // Each indicator has its own monthly endpoint; this is the dispatcher.
  // Implementer fills the actual TWSE / TAIFEX URL per indicator inline here.
  // Returns null when no trading day or data unavailable.
  throw new Error(`fetchDailyValue not implemented for ${indicator} @ ${date}`);
};

const writeRow = async (
  indicator: IndicatorKey,
  date: string,
  value: number,
): Promise<void> => {
  const url = `${process.env.WORKER_URL}/api/admin/sentiment-backfill`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.D1_TOKEN}`,
    },
    body: JSON.stringify({ indicator, date, value }),
  });
  if (!res.ok) {
    throw new Error(`write failed ${indicator} ${date}: ${res.status}`);
  }
};

const main = async (): Promise<void> => {
  const dates = isoDates();
  for (const indicator of INDICATORS) {
    console.log(`[${indicator}] backfilling ${dates.length} days`);
    for (const date of dates) {
      try {
        const value = await fetchDailyValue(indicator, date);
        if (value !== null) await writeRow(indicator, date, value);
      } catch (error) {
        console.warn(`skip ${indicator} ${date}:`, error);
      }
      await sleep(1000);
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Note: actual `fetchDailyValue` per-indicator endpoints (TWSE monthly margin, TAIFEX historical CSV) are implemented inline during execution. Each must use `fetchWithRetry`-equivalent retry + 1s pacing.

- [ ] **Step 2: Add admin route + token check**

In `worker/src/index.ts`, mount `/api/admin/sentiment-backfill` guarded by `c.env.ADMIN_TOKEN`. Route inserts via `insertDailyValue`.

```ts
// worker/src/index.ts (excerpt)
import { insertDailyValue } from './cache/d1-sentiment';

app.post('/api/admin/sentiment-backfill', async (c) => {
  const auth = c.req.header('authorization');
  if (auth !== `Bearer ${c.env.ADMIN_TOKEN}`) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const { indicator, date, value } = await c.req.json<{
    indicator: import('@fd/shared').IndicatorKey;
    date: string;
    value: number;
  }>();
  await insertDailyValue(c.env.DB, indicator, date, value);
  return c.json({ ok: true });
});
```

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-sentiment-history.ts worker/src/index.ts
git commit -m "feat(sentiment): backfill script + admin backfill endpoint"
```

---

## Task 8: /api/sentiment route

**Files:**
- Create: `worker/src/routes/sentiment.ts`, `worker/test/routes.sentiment.test.ts`
- Modify: `worker/src/index.ts`

- [ ] **Step 1: Write failing test**

`worker/test/routes.sentiment.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { sentiment } from '../src/routes/sentiment';

describe('GET /api/sentiment', () => {
  it('returns SentimentBundle with 6 indicators + fearGreed', async () => {
    const fakeDb = {
      prepare: () => ({
        bind: () => ({
          all: async () => ({
            results: Array.from({ length: 100 }, (_, i) => ({
              date: `2024-01-${(i % 28) + 1}`,
              value: 130 + i,
            })),
          }),
          run: async () => undefined,
        }),
      }),
    };
    const fakeKv = { get: async () => null, put: async () => undefined };
    const app = new Hono();
    app.route('/api/sentiment', sentiment);
    const res = await app.request('/api/sentiment', {}, {
      DB: fakeDb,
      KV: fakeKv,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.indicators).toHaveLength(6);
    expect(body.data.fearGreed.value).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement route**

`worker/src/routes/sentiment.ts`:
```ts
import { Hono } from 'hono';
import type { Env } from '../index';
import type {
  ApiResponse,
  SentimentBundle,
  IndicatorKey,
  SentimentIndicator,
} from '@fd/shared';
import { kvGetJson, kvPutJson } from '../cache/kv';
import { getHistory } from '../cache/d1-sentiment';
import {
  computePercentile,
  findNearestLandmark,
  classifyZone,
  computeFearGreed,
} from '../lib/sentiment';
import { HISTORICAL_LANDMARKS } from '../data/historical-landmarks';

const TTL = 1800;
export const sentiment = new Hono<{ Bindings: Env }>();

const LABELS: Record<IndicatorKey, { label: string; unit: string }> = {
  margin_maintenance: { label: '融資維持率', unit: '%' },
  short_long_ratio: { label: '券資比', unit: '%' },
  institutional_5d: { label: '三大法人 5 日累計', unit: '億' },
  foreign_futures_oi: { label: '外資台指期淨未平倉', unit: '口' },
  breadth_adr: { label: '大盤騰落比 ADR', unit: '' },
  options_pcr: { label: '選擇權 PCR', unit: '' },
};

const buildIndicator = (
  key: IndicatorKey,
  history: { date: string; value: number }[],
): SentimentIndicator => {
  const values = history.map((r) => r.value);
  const current = values[0] ?? 0;
  const past5 = values[5] ?? current;
  const change5d = Number((current - past5).toFixed(2));
  const percentile = computePercentile(values, current);
  const landmarks = HISTORICAL_LANDMARKS[key];
  const nearestLandmark = findNearestLandmark(landmarks, current);
  const zone = classifyZone(key, percentile);
  const meta = LABELS[key];
  return {
    key,
    label: meta.label,
    value: current,
    unit: meta.unit,
    change5d,
    percentile,
    zone,
    nearestLandmark,
    landmarks,
    explanation: nearestLandmark
      ? `目前接近 ${nearestLandmark.event}（${nearestLandmark.value}${meta.unit}）`
      : `歷史百分位 ${percentile}`,
  };
};

sentiment.get('/', async (c) => {
  const cached = await kvGetJson<{ value: SentimentBundle; ts: number }>(
    c.env.KV,
    'sentiment:bundle',
  );
  if (cached) {
    const ageSeconds = Math.floor((Date.now() - cached.ts) / 1000);
    return c.json({
      data: cached.value,
      freshness: { source: 'kv', ageSeconds },
    } satisfies ApiResponse<SentimentBundle>);
  }
  const keys: IndicatorKey[] = [
    'margin_maintenance',
    'short_long_ratio',
    'institutional_5d',
    'foreign_futures_oi',
    'breadth_adr',
    'options_pcr',
  ];
  const indicators = await Promise.all(
    keys.map(async (k) => buildIndicator(k, await getHistory(c.env.DB, k))),
  );
  const fearGreed = computeFearGreed({
    marginMaintenancePercentile: indicators[0].percentile,
    shortLongRatioPercentile: indicators[1].percentile,
    institutional5dPercentile: indicators[2].percentile,
    foreignFuturesOiPercentile: indicators[3].percentile,
    breadthAdrPercentile: indicators[4].percentile,
    optionsPcrPercentile: indicators[5].percentile,
  });
  const bundle: SentimentBundle = {
    fearGreed,
    indicators,
    updatedAt: new Date().toISOString(),
  };
  await kvPutJson(
    c.env.KV,
    'sentiment:bundle',
    { value: bundle, ts: Date.now() },
    TTL,
  );
  return c.json({
    data: bundle,
    freshness: { source: 'fetch', ageSeconds: 0 },
  } satisfies ApiResponse<SentimentBundle>);
});
```

- [ ] **Step 4: Mount in `worker/src/index.ts`**

Add:
```ts
import { sentiment } from './routes/sentiment';
app.route('/api/sentiment', sentiment);
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm --filter worker test routes.sentiment && pnpm --filter worker exec tsc --noEmit`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add worker/src/routes/sentiment.ts worker/test/routes.sentiment.test.ts worker/src/index.ts
git commit -m "feat(sentiment): /api/sentiment route (KV cached, D1-backed)"
```

---

## Task 9: Cron — append daily values

**Files:**
- Modify: `worker/src/cron.ts`

- [ ] **Step 1: Add daily sentiment append**

Inside the daily handler in `worker/src/cron.ts`:
```ts
import { fetchForeignFuturesOI, fetchOptionsPCR } from './sources/taifex';
import { fetchBreadthADR } from './sources/twse-breadth';
import { fetchMarginMaintenance, fetchShortLongRatio } from './sources/twse-margin';
import { fetchInstitutional5d } from './sources/twse-chips';
import { insertDailyValue } from './cache/d1-sentiment';
import type { IndicatorKey } from '@fd/shared';

const runSentimentDaily = async (env: Env): Promise<void> => {
  const tasks: Array<{ key: IndicatorKey; fetcher: () => Promise<{ date: string; value: number }> }> = [
    { key: 'margin_maintenance', fetcher: async () => fetchMarginMaintenance() },
    { key: 'short_long_ratio', fetcher: async () => fetchShortLongRatio() },
    { key: 'institutional_5d', fetcher: async () => fetchInstitutional5d() },
    { key: 'foreign_futures_oi', fetcher: async () => {
      const r = await fetchForeignFuturesOI();
      return { date: r.date, value: r.netOi };
    }},
    { key: 'breadth_adr', fetcher: async () => {
      const r = await fetchBreadthADR();
      return { date: r.date, value: r.adr };
    }},
    { key: 'options_pcr', fetcher: async () => {
      const r = await fetchOptionsPCR();
      return { date: r.date, value: r.pcr };
    }},
  ];
  for (const t of tasks) {
    try {
      const { date, value } = await t.fetcher();
      await insertDailyValue(env.DB, t.key, date, value);
    } catch (error) {
      console.warn(`sentiment daily ${t.key} failed`, error);
    }
  }
  await env.KV.delete('sentiment:bundle');
};
```

Wire `runSentimentDaily(env)` into the existing daily cron `scheduled` handler.

Note: `fetchMarginMaintenance`, `fetchShortLongRatio`, `fetchInstitutional5d` may need thin wrappers if existing exports return broader bundles — add them in `twse-margin.ts` / `twse-chips.ts` with the simple `{ date, value }` shape if missing.

- [ ] **Step 2: Test daily helpers wire**

Run: `pnpm --filter worker test` — confirm 134 baseline + new tests still pass.

- [ ] **Step 3: Commit**

```bash
git add worker/src/cron.ts worker/src/sources/twse-margin.ts worker/src/sources/twse-chips.ts
git commit -m "feat(sentiment): daily cron appends sentiment_history"
```

---

## Task 10: Digest prompt — inject sentiment + require action_plan reference

**Files:**
- Modify: `worker/src/routes/digest.ts`

- [ ] **Step 1: Identify prompt builder**

Find the prompt-construction location in `worker/src/routes/digest.ts` (search for `action_plan` section).

- [ ] **Step 2: Fetch sentiment in digest pipeline**

Add helper:
```ts
import type { SentimentBundle } from '@fd/shared';

const formatSentimentForPrompt = (bundle: SentimentBundle): string => {
  const lines = bundle.indicators.map((ind) =>
    `- ${ind.label}: ${ind.value}${ind.unit} (5D ${ind.change5d >= 0 ? '+' : ''}${ind.change5d}, ` +
    `percentile ${ind.percentile}, zone=${ind.zone}` +
    (ind.nearestLandmark ? `, 接近「${ind.nearestLandmark.event}」` : '') +
    `)`,
  );
  return [
    `<sentiment>`,
    `Fear-Greed Index: ${bundle.fearGreed.value} (${bundle.fearGreed.label})`,
    ...lines,
    `</sentiment>`,
  ].join('\n');
};
```

In digest builder: fetch from internal route or cache (`kvGetJson('sentiment:bundle')`) and prepend the block to the user prompt. In the system/instruction prompt, add:

```
action_plan 段落必須結合 <sentiment> 區塊中至少 2 個指標，並引用接近的歷史事件作為定位（例：「融資維持率接近 2022 熊市底，可在 138 區間分批進場」）。
```

- [ ] **Step 3: Update parser if needed**

Confirm the existing `action_plan` parser still handles longer multi-line content. If a length cap exists, raise to 600 chars.

- [ ] **Step 4: Run worker tests**

Run: `pnpm --filter worker test digest`
Expected: pass (update mocked fixtures to include `sentiment:bundle` KV value if test mocks digest end-to-end).

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/digest.ts worker/test/
git commit -m "feat(digest): integrate sentiment indicators into action_plan prompt"
```

---

## Task 11: Frontend hook

**Files:**
- Create: `web/src/hooks/useSentiment.ts`

- [ ] **Step 1: Implement (pattern: `useNews`)**

`web/src/hooks/useSentiment.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import type { ApiResponse, SentimentBundle } from '@fd/shared';

const fetchSentiment = async (): Promise<SentimentBundle> => {
  const res = await fetch('/api/sentiment');
  if (!res.ok) throw new Error(`sentiment ${res.status}`);
  const body = (await res.json()) as ApiResponse<SentimentBundle>;
  return body.data;
};

export const useSentiment = () =>
  useQuery({
    queryKey: ['sentiment'],
    queryFn: fetchSentiment,
    staleTime: 5 * 60 * 1000,
  });
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter web typecheck
git add web/src/hooks/useSentiment.ts
git commit -m "feat(sentiment): useSentiment hook"
```

---

## Task 12: FearGreedGauge component

**Files:**
- Create: `web/src/components/FearGreedGauge.tsx`

- [ ] **Step 1: Implement**

`web/src/components/FearGreedGauge.tsx`:
```tsx
import type { FearGreedSnapshot } from '@fd/shared';

interface Props {
  snapshot: FearGreedSnapshot;
}

const zoneColor = (value: number): string => {
  if (value < 20) return '#dc2626';
  if (value < 45) return '#f97316';
  if (value < 55) return '#94a3b8';
  if (value < 80) return '#84cc16';
  return '#22c55e';
};

export const FearGreedGauge = ({ snapshot }: Props) => {
  const { value, label } = snapshot;
  const angle = (value / 100) * 180 - 90;
  const color = zoneColor(value);
  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 200 110" className="w-48">
        <path
          d="M 10 100 A 90 90 0 0 1 190 100"
          fill="none"
          stroke="#1f2937"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          d="M 10 100 A 90 90 0 0 1 190 100"
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * 283} 283`}
        />
        <line
          x1="100"
          y1="100"
          x2={100 + 80 * Math.cos(((angle - 90) * Math.PI) / 180)}
          y2={100 + 80 * Math.sin(((angle - 90) * Math.PI) / 180)}
          stroke="#f1f5f9"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="100" cy="100" r="5" fill="#f1f5f9" />
      </svg>
      <div className="text-center">
        <div className="text-3xl font-bold" style={{ color }}>
          {value}
        </div>
        <div className="text-sm text-slate-400">{label}</div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/FearGreedGauge.tsx
git commit -m "feat(sentiment): FearGreedGauge component"
```

---

## Task 13: SentimentCard component

**Files:**
- Create: `web/src/components/SentimentCard.tsx`

- [ ] **Step 1: Implement**

`web/src/components/SentimentCard.tsx`:
```tsx
import type { SentimentIndicator } from '@fd/shared';

const ZONE_BG: Record<SentimentIndicator['zone'], string> = {
  healthy: 'bg-emerald-500/10 border-emerald-500/40',
  neutral: 'bg-slate-500/10 border-slate-500/40',
  caution: 'bg-amber-500/10 border-amber-500/40',
  danger: 'bg-red-500/10 border-red-500/40',
};

const ZONE_DOT: Record<SentimentIndicator['zone'], string> = {
  healthy: 'bg-emerald-400',
  neutral: 'bg-slate-400',
  caution: 'bg-amber-400',
  danger: 'bg-red-400',
};

interface Props {
  indicator: SentimentIndicator;
}

export const SentimentCard = ({ indicator }: Props) => {
  const change = indicator.change5d;
  const changeStr = `${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}`;
  return (
    <div className={`rounded-lg border p-4 ${ZONE_BG[indicator.zone]}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-300">{indicator.label}</span>
        <span className={`h-2 w-2 rounded-full ${ZONE_DOT[indicator.zone]}`} />
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-slate-100">
          {indicator.value}
          <span className="ml-0.5 text-sm text-slate-400">{indicator.unit}</span>
        </span>
        <span className="text-xs text-slate-400">{changeStr} (5D)</span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded bg-slate-800">
        <div
          className="h-full rounded bg-slate-400"
          style={{ width: `${indicator.percentile}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-slate-500">
        歷史百分位 {indicator.percentile}
      </div>
      <div className="mt-2 text-xs text-slate-300">{indicator.explanation}</div>
      {indicator.landmarks.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
          {indicator.landmarks.map((lm) => (
            <li key={`${lm.event}-${lm.date}`}>
              • {lm.event} {lm.value}{indicator.unit}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/SentimentCard.tsx
git commit -m "feat(sentiment): SentimentCard component"
```

---

## Task 14: SentimentPanel + dashboard integration

**Files:**
- Create: `web/src/components/SentimentPanel.tsx`
- Modify: `web/src/pages/DashboardPage.tsx`

- [ ] **Step 1: SentimentPanel**

`web/src/components/SentimentPanel.tsx`:
```tsx
import { useSentiment } from '../hooks/useSentiment';
import { FearGreedGauge } from './FearGreedGauge';
import { SentimentCard } from './SentimentCard';

export const SentimentPanel = () => {
  const { data, isLoading, error } = useSentiment();
  if (isLoading) {
    return <div className="text-sm text-slate-500">載入市場情緒…</div>;
  }
  if (error || !data) {
    return <div className="text-sm text-red-400">市場情緒載入失敗</div>;
  }
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <h2 className="mb-4 text-lg font-semibold text-slate-100">市場情緒</h2>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[260px_1fr]">
        <FearGreedGauge snapshot={data.fearGreed} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.indicators.map((ind) => (
            <SentimentCard key={ind.key} indicator={ind} />
          ))}
        </div>
      </div>
    </section>
  );
};
```

- [ ] **Step 2: Embed in DashboardPage**

`web/src/pages/DashboardPage.tsx` — insert `<SentimentPanel />` between `MacroPanel` and `AnalysisPanels`:
```tsx
import { SentimentPanel } from '../components/SentimentPanel';
// ...
<MacroPanel />
<SentimentPanel />
<AnalysisPanels />
```

- [ ] **Step 3: Typecheck + build**

```bash
pnpm --filter web typecheck && pnpm --filter web build
```
Expected: green.

- [ ] **Step 4: Manual UI sanity**

Run `pnpm --filter worker dev` + `pnpm --filter web dev`, load `http://localhost:5173`, verify:
- Gauge renders with needle at fear-greed value
- 6 cards render with values, percentile bars, landmark lists
- Zone colors visible (red/amber/grey/green border)
- No console errors

- [ ] **Step 5: Commit**

```bash
git add web/src/components/SentimentPanel.tsx web/src/pages/DashboardPage.tsx
git commit -m "feat(sentiment): SentimentPanel + dashboard integration"
```

---

## Task 15: Deploy

- [ ] **Step 1: Apply migration to remote D1**

```bash
pnpm --filter worker exec wrangler d1 migrations apply tickr --remote
```

- [ ] **Step 2: Run backfill (one-shot)**

```bash
WORKER_URL=https://tickr-worker.example.com ADMIN_TOKEN=... \
  pnpm tsx scripts/backfill-sentiment-history.ts
```
Expected: ~15k rows inserted across 6 indicators.

Verify:
```bash
pnpm --filter worker exec wrangler d1 execute tickr --remote \
  --command "SELECT indicator, COUNT(*) FROM sentiment_history GROUP BY indicator"
```

- [ ] **Step 3: Deploy worker**

```bash
pnpm --filter worker exec wrangler deploy
```

- [ ] **Step 4: Verify endpoint**

```bash
curl -s https://tickr-worker.example.com/api/sentiment | jq '.data.indicators | length'
```
Expected: `6`.

- [ ] **Step 5: Deploy web**

```bash
pnpm --filter web build && \
  pnpm --filter web exec wrangler pages deploy dist --project-name=finance-dashboard --branch=main
```

- [ ] **Step 6: Smoke-test production**

Load production URL, verify SentimentPanel renders with real data and digest's next run includes `action_plan` referencing indicators.

- [ ] **Step 7: Final commit if any deploy-time tweaks**

```bash
git status
# commit any deploy fixes
```

---

## Out of Scope (per spec)

- Individual-stock sentiment (only index-level)
- Real-time streaming (daily cron + 5min stale)
- User-customizable indicator weights
