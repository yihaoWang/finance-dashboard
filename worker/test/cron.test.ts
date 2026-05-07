import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env, applyD1Migrations } from 'cloudflare:test';
import * as digestRunner from '../src/lib/digest-runner';
import { scheduled } from '../src/cron';
import type { Env } from '../src/index';
import type { DigestBundle } from 'shared/src/types';

const TODAY = new Date().toISOString().slice(0, 10);

const makeBundle = (scope: 'market' | 'stock', symbol: string): DigestBundle => ({
  date: TODAY,
  scope,
  symbol,
  sections: { hard_data: 'hd', framework: 'fw', sentiment: 'st' },
  sources: [],
  model: '@cf/meta/llama-3.1-8b-instruct',
  createdAt: Date.now(),
});

describe('scheduled cron handler', () => {
  beforeEach(async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    vi.restoreAllMocks();
  });

  it('calls runDigestPipeline 6 times (1 market + 5 stocks)', async () => {
    const spy = vi.spyOn(digestRunner, 'runDigestPipeline').mockImplementation(
      async (_e, { scope, symbol }) => makeBundle(scope, symbol),
    );

    const testEnv: Env = {
      ...env,
      AI: { run: vi.fn() } as unknown as Ai,
      FRED_API_KEY: 'test-key',
    };

    const mockCtx: ExecutionContext = {
      waitUntil: (p: Promise<unknown>) => { void p; },
      passThroughOnException: () => undefined,
      abort: () => undefined,
    };

    const mockEvent = {} as ScheduledEvent;

    await new Promise<void>((resolve) => {
      const ctx: ExecutionContext = {
        waitUntil: (p: Promise<unknown>) => {
          p.then(resolve).catch(resolve);
        },
        passThroughOnException: mockCtx.passThroughOnException,
        abort: mockCtx.abort,
      };
      scheduled(mockEvent, testEnv, ctx);
    });

    expect(spy).toHaveBeenCalledTimes(6);
    expect(spy).toHaveBeenCalledWith(testEnv, { scope: 'market', symbol: 'market' });
    expect(spy).toHaveBeenCalledWith(testEnv, { scope: 'stock', symbol: '2330' });
    expect(spy).toHaveBeenCalledWith(testEnv, { scope: 'stock', symbol: '2454' });
    expect(spy).toHaveBeenCalledWith(testEnv, { scope: 'stock', symbol: '2317' });
    expect(spy).toHaveBeenCalledWith(testEnv, { scope: 'stock', symbol: '3008' });
    expect(spy).toHaveBeenCalledWith(testEnv, { scope: 'stock', symbol: '2308' });
  });

  it('continues processing when one pipeline fails', async () => {
    let callCount = 0;
    vi.spyOn(digestRunner, 'runDigestPipeline').mockImplementation(
      async (_e, { scope, symbol }) => {
        callCount++;
        if (symbol === '2330') throw new Error('simulated failure');
        return makeBundle(scope, symbol);
      },
    );

    const testEnv: Env = {
      ...env,
      AI: { run: vi.fn() } as unknown as Ai,
      FRED_API_KEY: 'test-key',
    };

    await new Promise<void>((resolve) => {
      const ctx: ExecutionContext = {
        waitUntil: (p: Promise<unknown>) => {
          p.then(resolve).catch(resolve);
        },
        passThroughOnException: () => undefined,
        abort: () => undefined,
      };
      scheduled({} as ScheduledEvent, testEnv, ctx);
    });

    // All 6 should be attempted even though 2330 threw
    expect(callCount).toBe(6);
  });
});
