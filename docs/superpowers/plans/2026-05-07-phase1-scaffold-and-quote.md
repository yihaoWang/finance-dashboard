# Phase 1: Scaffold + Quote + KPI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Cloudflare Workers + Pages project with D1/KV, fetch live Yahoo Finance quotes, compute moving-average / deviation indicators, and render a dashboard page showing a stock's price + 6 KPI cards end-to-end.

**Architecture:** Monorepo with `worker/` (Hono API on Cloudflare Workers) and `web/` (React + Vite + Tailwind + shadcn). Shared TypeScript types in `shared/`. D1 stores `daily_prices` history; KV caches the `quote:{symbol}` payload with 60s TTL. Yahoo Finance is the only data source in this phase.

**Tech Stack:** TypeScript, Hono, Cloudflare Workers, D1, KV, Vite, React, Tailwind CSS, shadcn/ui, TanStack Query, Vitest, wrangler.

---

## File Structure

```
finance_dashboard/
  package.json                 # workspace root
  pnpm-workspace.yaml
  tsconfig.base.json
  .gitignore
  wrangler.toml                # worker config (D1 + KV bindings)
  shared/
    package.json
    src/
      types.ts                 # Quote, KpiBundle, ApiResponse<T>
  worker/
    package.json
    tsconfig.json
    src/
      index.ts                 # Hono app + route registration
      routes/
        stock.ts               # /api/stock/:symbol routes
        health.ts              # /api/health
      sources/
        yahoo.ts               # Yahoo Finance fetch + parse
      cache/
        kv.ts                  # KV get/set with TTL helpers
        d1.ts                  # daily_prices upsert + query
      indicators/
        ma.ts                  # simple moving average
        deviation.ts           # 月線乖離率
        percentile.ts          # historical percentile rank
      lib/
        symbol.ts              # validateSymbol (4-6 alnum)
        http.ts                # fetchWithRetry
    test/
      indicators.ma.test.ts
      indicators.deviation.test.ts
      indicators.percentile.test.ts
      lib.symbol.test.ts
      sources.yahoo.test.ts
      cache.kv.test.ts
      routes.stock.test.ts
    migrations/
      0001_init.sql
  web/
    package.json
    vite.config.ts
    tsconfig.json
    index.html
    tailwind.config.ts
    postcss.config.js
    src/
      main.tsx
      App.tsx
      lib/
        api.ts                 # fetcher + base URL
      hooks/
        useStock.ts            # TanStack Query hook
      components/
        Hero.tsx               # 股價 + 漲跌
        KpiGrid.tsx             # 6 卡
        KpiCard.tsx
      pages/
        StockDetail.tsx
      styles.css
```

---

## Task 1: Workspace Scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.editorconfig`

- [ ] **Step 1: Initialize git and write root package.json**

Create `package.json`:

```json
{
  "name": "finance-dashboard",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev:worker": "pnpm --filter worker dev",
    "dev:web": "pnpm --filter web dev",
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck"
  },
  "packageManager": "pnpm@9.12.0",
  "devDependencies": {
    "typescript": "5.6.3"
  }
}
```

- [ ] **Step 2: Write workspace + tsconfig + ignore files**

`pnpm-workspace.yaml`:

```yaml
packages:
  - shared
  - worker
  - web
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx"
  }
}
```

`.gitignore`:

```
node_modules
dist
.wrangler
.dev.vars
*.log
.DS_Store
```

- [ ] **Step 3: Run install and verify workspace**

Run: `pnpm install`
Expected: completes without packages (workspace empty so far) or warnings only.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore
git commit -m "chore: scaffold monorepo workspace"
```

---

## Task 2: Shared Types Package

**Files:**
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Create: `shared/src/types.ts`

- [ ] **Step 1: Create shared package**

`shared/package.json`:

```json
{
  "name": "@fd/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/types.ts",
  "exports": { ".": "./src/types.ts" }
}
```

`shared/tsconfig.json`:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist" },
  "include": ["src/**/*"]
}
```

- [ ] **Step 2: Define types**

`shared/src/types.ts`:

```ts
export type Quote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  marketCap: number | null;
  high52w: number | null;
  low52w: number | null;
  updatedAt: number;
};

export type Kpi = {
  pe: number | null;
  forwardPe: number | null;
  ttmEps: number | null;
  grossMargin: number | null;
  monthlyRevenueYoy: number | null;
  ma20Deviation: number | null;
};

export type StockBundle = { quote: Quote; kpi: Kpi };

export type Freshness = {
  source: 'kv' | 'd1' | 'fetch';
  ageSeconds: number;
};

export type ApiResponse<T> = {
  data: T;
  freshness: Freshness;
  warnings?: string[];
};
```

- [ ] **Step 3: Commit**

```bash
git add shared
git commit -m "feat(shared): add core types"
```

---

## Task 3: Worker Package + Hono Health Endpoint

**Files:**
- Create: `worker/package.json`
- Create: `worker/tsconfig.json`
- Create: `worker/wrangler.toml`
- Create: `worker/src/index.ts`
- Create: `worker/src/routes/health.ts`
- Create: `worker/test/routes.health.test.ts`

- [ ] **Step 1: Create worker package**

`worker/package.json`:

```json
{
  "name": "worker",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "hono": "4.6.10",
    "@fd/shared": "workspace:*"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "4.20241106.0",
    "@cloudflare/vitest-pool-workers": "0.5.30",
    "vitest": "2.1.4",
    "wrangler": "3.84.1"
  }
}
```

`worker/tsconfig.json`:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"],
    "lib": ["ES2022"]
  },
  "include": ["src/**/*", "test/**/*"]
}
```

`worker/wrangler.toml`:

```toml
name = "finance-dashboard-worker"
main = "src/index.ts"
compatibility_date = "2024-11-06"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "finance_dashboard"
database_id = "REPLACE_AFTER_CREATE"

[[kv_namespaces]]
binding = "KV"
id = "REPLACE_AFTER_CREATE"
```

- [ ] **Step 2: Write the failing test for /api/health**

`worker/test/routes.health.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });
});
```

`worker/vitest.config.ts`:

```ts
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
      },
    },
  },
});
```

- [ ] **Step 3: Run test, verify it fails**

Run: `pnpm --filter worker test`
Expected: FAIL — `Cannot find module '../src/index'`.

- [ ] **Step 4: Implement Hono app**

`worker/src/routes/health.ts`:

```ts
import { Hono } from 'hono';

export const health = new Hono();

health.get('/', (c) => c.json({ status: 'ok' }));
```

`worker/src/index.ts`:

```ts
import { Hono } from 'hono';
import { health } from './routes/health';

export type Env = {
  DB: D1Database;
  KV: KVNamespace;
  YAHOO_USER_AGENT?: string;
};

const app = new Hono<{ Bindings: Env }>();

app.route('/api/health', health);

export default app;
```

- [ ] **Step 5: Run test, verify pass**

Run: `pnpm --filter worker test`
Expected: PASS — 1 test passed.

- [ ] **Step 6: Commit**

```bash
git add worker
git commit -m "feat(worker): hono app with health endpoint"
```

---

## Task 4: Symbol Validator

**Files:**
- Create: `worker/src/lib/symbol.ts`
- Create: `worker/test/lib.symbol.test.ts`

- [ ] **Step 1: Write failing tests**

`worker/test/lib.symbol.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateSymbol } from '../src/lib/symbol';

describe('validateSymbol', () => {
  it('accepts 4-digit numeric', () => {
    expect(validateSymbol('2330')).toBe('2330');
  });
  it('accepts 6-digit alphanumeric', () => {
    expect(validateSymbol('00878B')).toBe('00878B');
  });
  it('uppercases letters', () => {
    expect(validateSymbol('00878b')).toBe('00878B');
  });
  it('rejects too short', () => {
    expect(() => validateSymbol('23')).toThrow('invalid_symbol');
  });
  it('rejects too long', () => {
    expect(() => validateSymbol('2330000')).toThrow('invalid_symbol');
  });
  it('rejects non-alnum', () => {
    expect(() => validateSymbol('23-30')).toThrow('invalid_symbol');
  });
  it('rejects path traversal', () => {
    expect(() => validateSymbol('../etc')).toThrow('invalid_symbol');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter worker test test/lib.symbol.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`worker/src/lib/symbol.ts`:

```ts
const PATTERN = /^[A-Z0-9]{4,6}$/;

export const validateSymbol = (input: string): string => {
  const upper = input.toUpperCase();
  if (!PATTERN.test(upper)) {
    throw new Error('invalid_symbol');
  }
  return upper;
};
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter worker test test/lib.symbol.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add worker/src/lib/symbol.ts worker/test/lib.symbol.test.ts
git commit -m "feat(worker): symbol validator with allowlist regex"
```

---

## Task 5: HTTP Helper with Retry

**Files:**
- Create: `worker/src/lib/http.ts`
- Create: `worker/test/lib.http.test.ts`

- [ ] **Step 1: Write failing tests**

`worker/test/lib.http.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { fetchWithRetry } from '../src/lib/http';

describe('fetchWithRetry', () => {
  it('returns first success', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const res = await fetchWithRetry('https://x', {}, { fetcher, maxAttempts: 3, baseDelayMs: 0 });
    expect(res.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('retries on 5xx then succeeds', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const res = await fetchWithRetry('https://x', {}, { fetcher, maxAttempts: 3, baseDelayMs: 0 });
    expect(res.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('throws after maxAttempts', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 500 }));
    await expect(
      fetchWithRetry('https://x', {}, { fetcher, maxAttempts: 2, baseDelayMs: 0 }),
    ).rejects.toThrow('fetch_failed');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not retry 4xx', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    await expect(
      fetchWithRetry('https://x', {}, { fetcher, maxAttempts: 3, baseDelayMs: 0 }),
    ).rejects.toThrow('fetch_failed');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter worker test test/lib.http.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`worker/src/lib/http.ts`:

```ts
type Options = {
  fetcher?: typeof fetch;
  maxAttempts?: number;
  baseDelayMs?: number;
};

export const fetchWithRetry = async (
  url: string,
  init: RequestInit = {},
  opts: Options = {},
): Promise<Response> => {
  const fetcher = opts.fetcher ?? fetch;
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelay = opts.baseDelayMs ?? 200;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetcher(url, init);
    if (res.ok) return res;
    if (res.status < 500) throw new Error('fetch_failed');
    if (attempt === maxAttempts) throw new Error('fetch_failed');
    await new Promise((r) => setTimeout(r, baseDelay * 2 ** (attempt - 1)));
  }
  throw new Error('fetch_failed');
};
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter worker test test/lib.http.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add worker/src/lib/http.ts worker/test/lib.http.test.ts
git commit -m "feat(worker): fetchWithRetry with 5xx backoff"
```

---

## Task 6: Indicator Lib — Moving Average

**Files:**
- Create: `worker/src/indicators/ma.ts`
- Create: `worker/test/indicators.ma.test.ts`

- [ ] **Step 1: Write failing tests**

`worker/test/indicators.ma.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sma } from '../src/indicators/ma';

describe('sma', () => {
  it('computes simple moving average for window', () => {
    expect(sma([1, 2, 3, 4, 5], 5)).toBe(3);
  });
  it('uses last N values when series longer than window', () => {
    expect(sma([10, 1, 2, 3, 4, 5], 5)).toBe(3);
  });
  it('returns null when series shorter than window', () => {
    expect(sma([1, 2, 3], 5)).toBeNull();
  });
  it('returns null on empty', () => {
    expect(sma([], 5)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter worker test test/indicators.ma.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`worker/src/indicators/ma.ts`:

```ts
export const sma = (series: number[], window: number): number | null => {
  if (series.length < window || window <= 0) return null;
  const slice = series.slice(-window);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / window;
};
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter worker test test/indicators.ma.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add worker/src/indicators/ma.ts worker/test/indicators.ma.test.ts
git commit -m "feat(worker): SMA indicator"
```

---

## Task 7: Indicator Lib — Deviation (乖離率)

**Files:**
- Create: `worker/src/indicators/deviation.ts`
- Create: `worker/test/indicators.deviation.test.ts`

- [ ] **Step 1: Write failing tests**

`worker/test/indicators.deviation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deviation } from '../src/indicators/deviation';

describe('deviation', () => {
  it('returns percent above MA', () => {
    expect(deviation(110, 100)).toBeCloseTo(10);
  });
  it('returns negative percent below MA', () => {
    expect(deviation(90, 100)).toBeCloseTo(-10);
  });
  it('returns 0 when equal', () => {
    expect(deviation(100, 100)).toBe(0);
  });
  it('returns null when ma is null', () => {
    expect(deviation(100, null)).toBeNull();
  });
  it('returns null when ma is 0', () => {
    expect(deviation(100, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter worker test test/indicators.deviation.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`worker/src/indicators/deviation.ts`:

```ts
export const deviation = (price: number, ma: number | null): number | null => {
  if (ma === null || ma === 0) return null;
  return ((price - ma) / ma) * 100;
};
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter worker test test/indicators.deviation.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add worker/src/indicators/deviation.ts worker/test/indicators.deviation.test.ts
git commit -m "feat(worker): deviation indicator (乖離率)"
```

---

## Task 8: Indicator Lib — Percentile Rank

**Files:**
- Create: `worker/src/indicators/percentile.ts`
- Create: `worker/test/indicators.percentile.test.ts`

- [ ] **Step 1: Write failing tests**

`worker/test/indicators.percentile.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { percentileRank } from '../src/indicators/percentile';

describe('percentileRank', () => {
  it('returns 0 for value below all', () => {
    expect(percentileRank(0, [1, 2, 3, 4, 5])).toBe(0);
  });
  it('returns 100 for value at or above all', () => {
    expect(percentileRank(5, [1, 2, 3, 4, 5])).toBe(100);
  });
  it('returns mid percentile', () => {
    expect(percentileRank(3, [1, 2, 3, 4, 5])).toBe(60);
  });
  it('returns null for empty series', () => {
    expect(percentileRank(3, [])).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter worker test test/indicators.percentile.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`worker/src/indicators/percentile.ts`:

```ts
export const percentileRank = (value: number, series: number[]): number | null => {
  if (series.length === 0) return null;
  const lessOrEqual = series.filter((s) => s <= value).length;
  return (lessOrEqual / series.length) * 100;
};
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter worker test test/indicators.percentile.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add worker/src/indicators/percentile.ts worker/test/indicators.percentile.test.ts
git commit -m "feat(worker): percentile rank indicator"
```

---

## Task 9: KV Cache Helper

**Files:**
- Create: `worker/src/cache/kv.ts`
- Create: `worker/test/cache.kv.test.ts`

- [ ] **Step 1: Write failing tests**

`worker/test/cache.kv.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { kvGetJson, kvPutJson } from '../src/cache/kv';

describe('kv json helpers', () => {
  it('round-trips json', async () => {
    await kvPutJson(env.KV, 'k1', { a: 1 }, 60);
    const out = await kvGetJson<{ a: number }>(env.KV, 'k1');
    expect(out).toEqual({ a: 1 });
  });
  it('returns null when missing', async () => {
    const out = await kvGetJson(env.KV, 'missing');
    expect(out).toBeNull();
  });
});
```

Update `worker/vitest.config.ts` to bind KV in tests by adding miniflare bindings:

```ts
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          kvNamespaces: ['KV'],
          d1Databases: ['DB'],
        },
      },
    },
  },
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter worker test test/cache.kv.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`worker/src/cache/kv.ts`:

```ts
export const kvGetJson = async <T>(kv: KVNamespace, key: string): Promise<T | null> => {
  const raw = await kv.get(key);
  if (raw === null) return null;
  return JSON.parse(raw) as T;
};

export const kvPutJson = async (
  kv: KVNamespace,
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> => {
  await kv.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
};
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter worker test test/cache.kv.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add worker/src/cache/kv.ts worker/test/cache.kv.test.ts worker/vitest.config.ts
git commit -m "feat(worker): KV json helpers"
```

---

## Task 10: D1 Schema + Migration + Daily Prices Helpers

**Files:**
- Create: `worker/migrations/0001_init.sql`
- Create: `worker/src/cache/d1.ts`
- Create: `worker/test/cache.d1.test.ts`

- [ ] **Step 1: Write migration**

`worker/migrations/0001_init.sql`:

```sql
CREATE TABLE IF NOT EXISTS stocks (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT,
  market TEXT,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS daily_prices (
  symbol TEXT NOT NULL,
  date TEXT NOT NULL,
  open REAL,
  high REAL,
  low REAL,
  close REAL,
  volume INTEGER,
  PRIMARY KEY (symbol, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_prices_symbol_date
  ON daily_prices(symbol, date DESC);
```

- [ ] **Step 2: Write failing tests**

`worker/test/cache.d1.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { env, applyD1Migrations } from 'cloudflare:test';
import { upsertDailyPrices, recentCloses } from '../src/cache/d1';

describe('daily_prices helpers', () => {
  beforeEach(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  });
  it('upserts and reads recent closes', async () => {
    await upsertDailyPrices(env.DB, '2330', [
      { date: '2026-05-01', open: 1, high: 2, low: 1, close: 1.5, volume: 100 },
      { date: '2026-05-02', open: 1.5, high: 2.5, low: 1.5, close: 2, volume: 200 },
    ]);
    const closes = await recentCloses(env.DB, '2330', 5);
    expect(closes).toEqual([2, 1.5]);
  });
  it('upsert overwrites same date', async () => {
    await upsertDailyPrices(env.DB, '2330', [
      { date: '2026-05-01', open: 1, high: 2, low: 1, close: 1.5, volume: 100 },
    ]);
    await upsertDailyPrices(env.DB, '2330', [
      { date: '2026-05-01', open: 1, high: 2, low: 1, close: 9.9, volume: 100 },
    ]);
    const closes = await recentCloses(env.DB, '2330', 5);
    expect(closes).toEqual([9.9]);
  });
});
```

Update `worker/wrangler.toml` to include migrations dir reference for tests:

```toml
[[migrations]]
tag = "v1"
new_tables = ["stocks", "daily_prices"]
```

Update `worker/vitest.config.ts` to load migrations:

```ts
import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config';
import path from 'node:path';

export default defineWorkersConfig(async () => {
  const migrationsPath = path.join(__dirname, 'migrations');
  const migrations = await readD1Migrations(migrationsPath);
  return {
    test: {
      poolOptions: {
        workers: {
          wrangler: { configPath: './wrangler.toml' },
          miniflare: {
            kvNamespaces: ['KV'],
            d1Databases: ['DB'],
            bindings: { TEST_MIGRATIONS: migrations },
          },
        },
      },
    },
  };
});
```

- [ ] **Step 3: Run, verify fail**

Run: `pnpm --filter worker test test/cache.d1.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

`worker/src/cache/d1.ts`:

```ts
export type DailyPrice = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export const upsertDailyPrices = async (
  db: D1Database,
  symbol: string,
  rows: DailyPrice[],
): Promise<void> => {
  if (rows.length === 0) return;
  const stmt = db.prepare(
    `INSERT INTO daily_prices(symbol,date,open,high,low,close,volume)
     VALUES(?,?,?,?,?,?,?)
     ON CONFLICT(symbol,date) DO UPDATE SET
       open=excluded.open,high=excluded.high,low=excluded.low,
       close=excluded.close,volume=excluded.volume`,
  );
  await db.batch(
    rows.map((r) => stmt.bind(symbol, r.date, r.open, r.high, r.low, r.close, r.volume)),
  );
};

export const recentCloses = async (
  db: D1Database,
  symbol: string,
  limit: number,
): Promise<number[]> => {
  const res = await db
    .prepare(
      `SELECT close FROM daily_prices WHERE symbol = ? ORDER BY date DESC LIMIT ?`,
    )
    .bind(symbol, limit)
    .all<{ close: number }>();
  return (res.results ?? []).map((r) => r.close);
};
```

- [ ] **Step 5: Run, verify pass**

Run: `pnpm --filter worker test test/cache.d1.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 6: Commit**

```bash
git add worker/migrations worker/src/cache/d1.ts worker/test/cache.d1.test.ts worker/wrangler.toml worker/vitest.config.ts
git commit -m "feat(worker): D1 schema + daily_prices helpers"
```

---

## Task 11: Yahoo Finance Source Adapter

**Files:**
- Create: `worker/src/sources/yahoo.ts`
- Create: `worker/test/sources.yahoo.test.ts`

- [ ] **Step 1: Write failing tests using injected fetcher**

`worker/test/sources.yahoo.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { fetchYahooQuote, fetchYahooHistory } from '../src/sources/yahoo';

const quotePayload = {
  quoteResponse: {
    result: [{
      symbol: '2330.TW',
      shortName: '台積電',
      regularMarketPrice: 1085,
      regularMarketChange: 15,
      regularMarketChangePercent: 1.42,
      regularMarketVolume: 42100000,
      marketCap: 28140000000000,
      fiftyTwoWeekHigh: 1120,
      fiftyTwoWeekLow: 720,
      trailingPE: 27.4,
      forwardPE: 21.8,
      epsTrailingTwelveMonths: 39.62,
    }],
  },
};

describe('fetchYahooQuote', () => {
  it('parses quote response', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(quotePayload), { status: 200 }),
    );
    const q = await fetchYahooQuote('2330', { fetcher });
    expect(q.symbol).toBe('2330');
    expect(q.name).toBe('台積電');
    expect(q.price).toBe(1085);
    expect(q.changePct).toBeCloseTo(1.42);
    expect(q.high52w).toBe(1120);
    expect(q.pe).toBe(27.4);
    expect(q.forwardPe).toBe(21.8);
    expect(q.ttmEps).toBeCloseTo(39.62);
  });
  it('throws not_found on empty result', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ quoteResponse: { result: [] } }), { status: 200 }),
    );
    await expect(fetchYahooQuote('9999', { fetcher })).rejects.toThrow('not_found');
  });
});

describe('fetchYahooHistory', () => {
  it('parses history response', async () => {
    const payload = {
      chart: {
        result: [{
          timestamp: [1714521600, 1714608000],
          indicators: {
            quote: [{
              open: [100, 101],
              high: [102, 103],
              low: [99, 100],
              close: [101, 102],
              volume: [1000, 1100],
            }],
          },
        }],
      },
    };
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 }),
    );
    const rows = await fetchYahooHistory('2330', '1mo', { fetcher });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ open: 100, close: 101, volume: 1000 });
    expect(rows[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter worker test test/sources.yahoo.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`worker/src/sources/yahoo.ts`:

```ts
import { fetchWithRetry } from '../lib/http';
import type { DailyPrice } from '../cache/d1';

export type YahooQuote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  marketCap: number | null;
  high52w: number | null;
  low52w: number | null;
  pe: number | null;
  forwardPe: number | null;
  ttmEps: number | null;
};

type Opts = { fetcher?: typeof fetch; userAgent?: string };

const DEFAULT_UA = 'Mozilla/5.0 (compatible; FinanceDashboard/0.1)';

const headers = (ua: string): HeadersInit => ({
  'User-Agent': ua,
  'Accept': 'application/json',
});

export const fetchYahooQuote = async (
  symbol: string,
  opts: Opts = {},
): Promise<YahooQuote> => {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}.TW`;
  const res = await fetchWithRetry(
    url,
    { headers: headers(opts.userAgent ?? DEFAULT_UA) },
    { fetcher: opts.fetcher },
  );
  const json = await res.json() as {
    quoteResponse: { result: Array<Record<string, unknown>> };
  };
  const r = json.quoteResponse.result[0];
  if (!r) throw new Error('not_found');
  const num = (k: string): number | null => {
    const v = r[k];
    return typeof v === 'number' ? v : null;
  };
  return {
    symbol,
    name: String(r.shortName ?? r.longName ?? symbol),
    price: num('regularMarketPrice') ?? 0,
    change: num('regularMarketChange') ?? 0,
    changePct: num('regularMarketChangePercent') ?? 0,
    volume: num('regularMarketVolume') ?? 0,
    marketCap: num('marketCap'),
    high52w: num('fiftyTwoWeekHigh'),
    low52w: num('fiftyTwoWeekLow'),
    pe: num('trailingPE'),
    forwardPe: num('forwardPE'),
    ttmEps: num('epsTrailingTwelveMonths'),
  };
};

export const fetchYahooHistory = async (
  symbol: string,
  range: '1mo' | '3mo' | '1y' | '5y',
  opts: Opts = {},
): Promise<DailyPrice[]> => {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.TW?range=${range}&interval=1d`;
  const res = await fetchWithRetry(
    url,
    { headers: headers(opts.userAgent ?? DEFAULT_UA) },
    { fetcher: opts.fetcher },
  );
  const json = await res.json() as {
    chart: { result: Array<{
      timestamp: number[];
      indicators: { quote: Array<{ open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] }> };
    }> };
  };
  const r = json.chart.result[0];
  if (!r) throw new Error('not_found');
  const q = r.indicators.quote[0];
  return r.timestamp.map((ts, i) => ({
    date: new Date(ts * 1000).toISOString().slice(0, 10),
    open: q.open[i] ?? 0,
    high: q.high[i] ?? 0,
    low: q.low[i] ?? 0,
    close: q.close[i] ?? 0,
    volume: q.volume[i] ?? 0,
  }));
};
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter worker test test/sources.yahoo.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add worker/src/sources/yahoo.ts worker/test/sources.yahoo.test.ts
git commit -m "feat(worker): yahoo finance quote + history adapter"
```

---

## Task 12: Stock Route — Wire It All Together

**Files:**
- Create: `worker/src/routes/stock.ts`
- Modify: `worker/src/index.ts`
- Create: `worker/test/routes.stock.test.ts`

- [ ] **Step 1: Write failing test**

`worker/test/routes.stock.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env, applyD1Migrations } from 'cloudflare:test';
import app from '../src/index';
import * as yahoo from '../src/sources/yahoo';

describe('GET /api/stock/:symbol', () => {
  beforeEach(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    vi.restoreAllMocks();
  });

  it('rejects invalid symbol', async () => {
    const res = await app.request('/api/stock/bad-id', {}, env);
    expect(res.status).toBe(400);
  });

  it('returns quote + kpi bundle', async () => {
    vi.spyOn(yahoo, 'fetchYahooQuote').mockResolvedValue({
      symbol: '2330', name: '台積電', price: 1085, change: 15, changePct: 1.42,
      volume: 100, marketCap: 1, high52w: 1120, low52w: 720,
      pe: 27.4, forwardPe: 21.8, ttmEps: 39.62,
    });
    vi.spyOn(yahoo, 'fetchYahooHistory').mockResolvedValue(
      Array.from({ length: 25 }, (_, i) => ({
        date: `2026-04-${String(i + 1).padStart(2, '0')}`,
        open: 1000 + i, high: 1010 + i, low: 990 + i, close: 1000 + i, volume: 1000,
      })),
    );

    const res = await app.request('/api/stock/2330', {}, env);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      data: { quote: { symbol: string; price: number }; kpi: { pe: number | null; ma20Deviation: number | null } };
      freshness: { source: string };
    };
    expect(body.data.quote.symbol).toBe('2330');
    expect(body.data.quote.price).toBe(1085);
    expect(body.data.kpi.pe).toBe(27.4);
    expect(body.data.kpi.ma20Deviation).not.toBeNull();
    expect(body.freshness.source).toBe('fetch');
  });

  it('serves cached quote on second call', async () => {
    const quoteSpy = vi.spyOn(yahoo, 'fetchYahooQuote').mockResolvedValue({
      symbol: '2330', name: '台積電', price: 1085, change: 15, changePct: 1.42,
      volume: 100, marketCap: 1, high52w: 1120, low52w: 720,
      pe: 27.4, forwardPe: 21.8, ttmEps: 39.62,
    });
    vi.spyOn(yahoo, 'fetchYahooHistory').mockResolvedValue([
      { date: '2026-05-01', open: 1, high: 2, low: 1, close: 1.5, volume: 100 },
    ]);

    await app.request('/api/stock/2330', {}, env);
    await app.request('/api/stock/2330', {}, env);
    expect(quoteSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter worker test test/routes.stock.test.ts`
Expected: FAIL — route not registered.

- [ ] **Step 3: Implement route**

`worker/src/routes/stock.ts`:

```ts
import { Hono } from 'hono';
import type { Env } from '../index';
import type { ApiResponse, StockBundle } from '@fd/shared';
import { validateSymbol } from '../lib/symbol';
import { kvGetJson, kvPutJson } from '../cache/kv';
import { upsertDailyPrices, recentCloses } from '../cache/d1';
import { fetchYahooQuote, fetchYahooHistory } from '../sources/yahoo';
import { sma } from '../indicators/ma';
import { deviation } from '../indicators/deviation';

const QUOTE_TTL = 60;

export const stock = new Hono<{ Bindings: Env }>();

stock.get('/:symbol', async (c) => {
  let symbol: string;
  try {
    symbol = validateSymbol(c.req.param('symbol'));
  } catch {
    return c.json({ error: 'invalid_symbol' }, 400);
  }

  const warnings: string[] = [];

  const cacheKey = `quote:${symbol}`;
  const cached = await kvGetJson<{ value: StockBundle; ts: number }>(c.env.KV, cacheKey);
  if (cached) {
    const ageSeconds = Math.floor((Date.now() - cached.ts) / 1000);
    const body: ApiResponse<StockBundle> = {
      data: cached.value,
      freshness: { source: 'kv', ageSeconds },
    };
    return c.json(body);
  }

  let quote;
  try {
    quote = await fetchYahooQuote(symbol);
  } catch (err) {
    console.warn(`yahoo quote failed for ${symbol}`, err);
    return c.json({ error: 'upstream_failed' }, 502);
  }

  let closes = await recentCloses(c.env.DB, symbol, 20);
  if (closes.length < 20) {
    try {
      const history = await fetchYahooHistory(symbol, '3mo');
      await upsertDailyPrices(c.env.DB, symbol, history);
      closes = await recentCloses(c.env.DB, symbol, 20);
    } catch (err) {
      console.warn(`yahoo history failed for ${symbol}`, err);
      warnings.push('history_unavailable');
    }
  }

  const ma20 = sma(closes, 20);
  const ma20Deviation = deviation(quote.price, ma20);

  const bundle: StockBundle = {
    quote: {
      symbol: quote.symbol,
      name: quote.name,
      price: quote.price,
      change: quote.change,
      changePct: quote.changePct,
      volume: quote.volume,
      marketCap: quote.marketCap,
      high52w: quote.high52w,
      low52w: quote.low52w,
      updatedAt: Date.now(),
    },
    kpi: {
      pe: quote.pe,
      forwardPe: quote.forwardPe,
      ttmEps: quote.ttmEps,
      grossMargin: null,
      monthlyRevenueYoy: null,
      ma20Deviation,
    },
  };

  await kvPutJson(c.env.KV, cacheKey, { value: bundle, ts: Date.now() }, QUOTE_TTL);

  const body: ApiResponse<StockBundle> = {
    data: bundle,
    freshness: { source: 'fetch', ageSeconds: 0 },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
  return c.json(body);
});
```

`worker/src/index.ts`:

```ts
import { Hono } from 'hono';
import { health } from './routes/health';
import { stock } from './routes/stock';

export type Env = {
  DB: D1Database;
  KV: KVNamespace;
  YAHOO_USER_AGENT?: string;
};

const app = new Hono<{ Bindings: Env }>();

app.route('/api/health', health);
app.route('/api/stock', stock);

export default app;
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter worker test`
Expected: PASS — all worker tests green.

- [ ] **Step 5: Commit**

```bash
git add worker/src/routes/stock.ts worker/src/index.ts worker/test/routes.stock.test.ts
git commit -m "feat(worker): /api/stock/:symbol endpoint with KV cache"
```

---

## Task 13: Cloudflare Resources Provisioning

**Files:**
- Modify: `worker/wrangler.toml`

- [ ] **Step 1: Create D1 database**

Run:

```bash
cd worker
npx wrangler d1 create finance_dashboard
```

Expected output: a `database_id` UUID. Copy it.

- [ ] **Step 2: Create KV namespace**

Run:

```bash
npx wrangler kv namespace create KV
```

Expected output: an `id`. Copy it.

- [ ] **Step 3: Update wrangler.toml**

Replace the `REPLACE_AFTER_CREATE` placeholders in `worker/wrangler.toml` with the real IDs from steps 1 & 2.

- [ ] **Step 4: Apply migrations to remote D1**

Run:

```bash
npx wrangler d1 migrations apply finance_dashboard --remote
```

Expected: "Migrations applied!"

- [ ] **Step 5: Commit**

```bash
git add worker/wrangler.toml
git commit -m "chore(worker): wire D1 + KV bindings"
```

---

## Task 14: Web Package Scaffold

**Files:**
- Create: `web/package.json`
- Create: `web/vite.config.ts`
- Create: `web/tsconfig.json`
- Create: `web/index.html`
- Create: `web/tailwind.config.ts`
- Create: `web/postcss.config.js`
- Create: `web/src/main.tsx`
- Create: `web/src/App.tsx`
- Create: `web/src/styles.css`

- [ ] **Step 1: Create web package**

`web/package.json`:

```json
{
  "name": "web",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@fd/shared": "workspace:*",
    "@tanstack/react-query": "5.59.0",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@types/react": "18.3.11",
    "@types/react-dom": "18.3.1",
    "@vitejs/plugin-react": "4.3.3",
    "autoprefixer": "10.4.20",
    "postcss": "8.4.47",
    "tailwindcss": "3.4.14",
    "vite": "5.4.10"
  }
}
```

`web/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
```

`web/tsconfig.json`:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  },
  "include": ["src/**/*"]
}
```

`web/index.html`:

```html
<!doctype html>
<html lang="zh-TW">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Finance Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`web/tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0a0a0b', 900: '#111113', 800: '#1a1a1d', 700: '#26262a' },
        accent: { DEFAULT: '#7c5cff', soft: '#a78bfa' },
        up: '#ef4444',
        down: '#10b981',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

`web/postcss.config.js`:

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

`web/src/styles.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body { @apply bg-ink-950 text-zinc-200; font-feature-settings: 'tnum'; }
.num { font-variant-numeric: tabular-nums; }
```

`web/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
```

`web/src/App.tsx`:

```tsx
import { useState } from 'react';
import { StockDetail } from './pages/StockDetail';

export const App = () => {
  const [symbol, setSymbol] = useState('2330');
  const [input, setInput] = useState('2330');

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      <header className="flex gap-3 mb-6">
        <input
          className="flex-1 max-w-md bg-ink-900 border border-ink-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="輸入股票代號（例：2330）"
        />
        <button
          type="button"
          onClick={() => setSymbol(input.trim().toUpperCase())}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm"
        >
          查詢
        </button>
      </header>
      <StockDetail symbol={symbol} />
    </div>
  );
};
```

- [ ] **Step 2: Install and verify build typechecks**

Run: `pnpm install && pnpm --filter web typecheck`
Expected: no type errors (some files referenced will exist in next tasks; for now stub `pages/StockDetail` to avoid red).

Add temporary `web/src/pages/StockDetail.tsx`:

```tsx
type Props = { symbol: string };
export const StockDetail = ({ symbol }: Props) => <div>{symbol}</div>;
```

Re-run typecheck — expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add web pnpm-lock.yaml
git commit -m "feat(web): vite + react + tailwind scaffold"
```

---

## Task 15: API Fetcher + useStock Hook

**Files:**
- Create: `web/src/lib/api.ts`
- Create: `web/src/hooks/useStock.ts`

- [ ] **Step 1: Implement API fetcher**

`web/src/lib/api.ts`:

```ts
import type { ApiResponse, StockBundle } from '@fd/shared';

export const fetchStock = async (symbol: string): Promise<ApiResponse<StockBundle>> => {
  const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`api_error_${res.status}: ${text}`);
  }
  return res.json() as Promise<ApiResponse<StockBundle>>;
};
```

- [ ] **Step 2: Implement useStock hook**

`web/src/hooks/useStock.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { fetchStock } from '../lib/api';

export const useStock = (symbol: string) => {
  return useQuery({
    queryKey: ['stock', symbol],
    queryFn: () => fetchStock(symbol),
    enabled: symbol.length >= 4,
  });
};
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib web/src/hooks
git commit -m "feat(web): API fetcher + useStock query hook"
```

---

## Task 16: Hero + KPI Components + Wire StockDetail Page

**Files:**
- Create: `web/src/components/Hero.tsx`
- Create: `web/src/components/KpiCard.tsx`
- Create: `web/src/components/KpiGrid.tsx`
- Modify: `web/src/pages/StockDetail.tsx`

- [ ] **Step 1: Implement Hero**

`web/src/components/Hero.tsx`:

```tsx
import type { Quote } from '@fd/shared';

type Props = { quote: Quote };

export const Hero = ({ quote }: Props) => {
  const isUp = quote.change >= 0;
  return (
    <section className="rounded-2xl bg-ink-900 border border-ink-700 p-6 mb-6">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-semibold text-zinc-100">{quote.name}</h1>
        <span className="text-zinc-500 num text-sm">{quote.symbol}</span>
      </div>
      <div className="flex items-baseline gap-3">
        <div className="text-5xl font-semibold num text-zinc-100">{quote.price.toFixed(2)}</div>
        <div className={`num text-lg ${isUp ? 'text-up' : 'text-down'}`}>
          {isUp ? '+' : ''}{quote.change.toFixed(2)} ({quote.changePct.toFixed(2)}%)
        </div>
      </div>
      <div className="text-xs text-zinc-500 mt-2 num">
        最後更新 {new Date(quote.updatedAt).toLocaleTimeString('zh-TW')}
      </div>
    </section>
  );
};
```

- [ ] **Step 2: Implement KpiCard + KpiGrid**

`web/src/components/KpiCard.tsx`:

```tsx
type Props = {
  label: string;
  value: number | null;
  unit?: string;
  digits?: number;
};

export const KpiCard = ({ label, value, unit, digits = 2 }: Props) => (
  <div className="rounded-xl bg-ink-900 border border-ink-700 p-4">
    <div className="text-xs text-zinc-500 mb-1">{label}</div>
    <div className="text-xl font-semibold num text-zinc-100">
      {value === null ? '—' : `${value.toFixed(digits)}${unit ?? ''}`}
    </div>
  </div>
);
```

`web/src/components/KpiGrid.tsx`:

```tsx
import type { Kpi } from '@fd/shared';
import { KpiCard } from './KpiCard';

type Props = { kpi: Kpi };

export const KpiGrid = ({ kpi }: Props) => (
  <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
    <KpiCard label="P/E (TTM)" value={kpi.pe} />
    <KpiCard label="Forward P/E" value={kpi.forwardPe} />
    <KpiCard label="EPS (近四季)" value={kpi.ttmEps} />
    <KpiCard label="毛利率" value={kpi.grossMargin} unit="%" />
    <KpiCard label="月營收 YoY" value={kpi.monthlyRevenueYoy} unit="%" />
    <KpiCard label="月線乖離" value={kpi.ma20Deviation} unit="%" />
  </section>
);
```

- [ ] **Step 3: Wire StockDetail**

`web/src/pages/StockDetail.tsx`:

```tsx
import { useStock } from '../hooks/useStock';
import { Hero } from '../components/Hero';
import { KpiGrid } from '../components/KpiGrid';

type Props = { symbol: string };

export const StockDetail = ({ symbol }: Props) => {
  const { data, isLoading, error } = useStock(symbol);

  if (isLoading) return <div className="text-zinc-500">載入中…</div>;
  if (error) return <div className="text-down">錯誤：{(error as Error).message}</div>;
  if (!data) return null;

  return (
    <>
      <Hero quote={data.data.quote} />
      <KpiGrid kpi={data.data.kpi} />
      {data.warnings && (
        <div className="mt-3 text-xs text-amber-400">
          注意：{data.warnings.join(', ')}
        </div>
      )}
    </>
  );
};
```

- [ ] **Step 4: Run dev locally and verify**

Open two terminals:

```bash
# terminal 1
pnpm --filter worker dev   # wrangler dev on :8787
# terminal 2
pnpm --filter web dev      # vite on :5173
```

Visit http://localhost:5173 — should show 2330 台積電 with current price and 6 KPI cards (some `—` for fields not yet implemented).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck`
Expected: PASS.

```bash
git add web/src
git commit -m "feat(web): Hero + KpiGrid + wired StockDetail"
```

---

## Task 17: Deploy to Cloudflare

**Files:** none (deploy only)

- [ ] **Step 1: Build web**

Run: `pnpm --filter web build`
Expected: `web/dist/` populated.

- [ ] **Step 2: Deploy worker**

Run: `pnpm --filter worker deploy`
Expected: deploy success URL like `https://finance-dashboard-worker.<account>.workers.dev`.

- [ ] **Step 3: Deploy web to Cloudflare Pages**

Run:

```bash
npx wrangler pages deploy web/dist --project-name=finance-dashboard
```

Expected: a `*.pages.dev` URL.

- [ ] **Step 4: Configure Pages → Worker proxy**

In Cloudflare dashboard, add a `_routes.json` to `web/dist/` so `/api/*` proxies to the worker. Add `web/public/_redirects`:

```
/api/*  https://finance-dashboard-worker.<account>.workers.dev/api/:splat  200
```

Re-deploy:

```bash
pnpm --filter web build
npx wrangler pages deploy web/dist --project-name=finance-dashboard
```

- [ ] **Step 5: Smoke test**

Visit the Pages URL, type `2330`, click 查詢. Expected: live quote + KPI cards from production.

- [ ] **Step 6: Commit**

```bash
git add web/public
git commit -m "chore: configure pages → worker api proxy and deploy"
```

---

## Phase 1 Done — Acceptance Criteria

- [ ] `pnpm test` passes (worker unit tests green)
- [ ] `pnpm typecheck` passes (worker + web)
- [ ] Local dev: enter `2330`, see live price and 6 KPI cards (4 populated, 2 `—`)
- [ ] Production Pages URL serves the same experience
- [ ] D1 contains rows in `daily_prices` after first lookup
- [ ] Second identical request hits KV cache (verifiable via `freshness.source === 'kv'`)

## Out of Scope (Phase 2 / 3)

- 月營收 / 財報（MOPS）
- 三大法人 / 融資融券（TWSE）
- 宏觀面板（FRED + Yahoo macro）
- 主圖區（K 線 + MA）
- 三欄底層（基本面 / 籌碼 / 技術）
- 名詞 tooltip + 字典
- 自選股
- 風險燈號
