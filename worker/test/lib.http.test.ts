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
