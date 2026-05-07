import { describe, it, expect, vi } from 'vitest';
import { fetchYahooNews } from '../src/sources/yahoo-news';

const makeNewsItem = (overrides: Record<string, unknown> = {}) => ({
  uuid: 'uuid-1',
  title: '台積電訂單看好，利多消息',
  publisher: 'Yahoo Finance',
  link: 'https://finance.yahoo.com/article/1',
  providerPublishTime: 1714521600,
  type: 'STORY',
  ...overrides,
});

const makePayload = (news: unknown[]) => ({
  explains: [],
  count: news.length,
  quotes: [],
  news,
});

describe('fetchYahooNews', () => {
  it('parses news items from search response', async () => {
    const item = makeNewsItem();
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(makePayload([item])), { status: 200 }),
    );
    const result = await fetchYahooNews('2330', { fetcher });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: item.title,
      publisher: item.publisher,
      link: item.link,
      publishedAt: item.providerPublishTime * 1000,
    });
  });

  it('filters out non-STORY type items', async () => {
    const story = makeNewsItem({ type: 'STORY' });
    const video = makeNewsItem({ type: 'VIDEO', uuid: 'uuid-2' });
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(makePayload([story, video])), { status: 200 }),
    );
    const result = await fetchYahooNews('2330', { fetcher });
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe(story.title);
  });

  it('sorts by publishedAt descending', async () => {
    const older = makeNewsItem({ uuid: 'old', providerPublishTime: 1714521600 });
    const newer = makeNewsItem({ uuid: 'new', providerPublishTime: 1714608000 });
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(makePayload([older, newer])), { status: 200 }),
    );
    const result = await fetchYahooNews('2330', { fetcher });
    expect(result[0].publishedAt).toBe(1714608000 * 1000);
    expect(result[1].publishedAt).toBe(1714521600 * 1000);
  });

  it('caps results at 15 items', async () => {
    const items = Array.from({ length: 20 }, (_, i) => makeNewsItem({ uuid: `uuid-${i}`, providerPublishTime: 1714521600 + i }));
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(makePayload(items)), { status: 200 }),
    );
    const result = await fetchYahooNews('2330', { fetcher });
    expect(result.length).toBeLessThanOrEqual(15);
  });

  it('appends .TW suffix when not present', async () => {
    let capturedUrl = '';
    const fetcher = vi.fn().mockImplementation((url: string) => {
      capturedUrl = url;
      return Promise.resolve(new Response(JSON.stringify(makePayload([])), { status: 200 }));
    });
    await fetchYahooNews('2330', { fetcher });
    expect(capturedUrl).toContain('2330.TW');
  });

  it('returns empty array when news key is missing', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ explains: [], count: 0, quotes: [] }), { status: 200 }),
    );
    const result = await fetchYahooNews('2330', { fetcher });
    expect(result).toEqual([]);
  });
});
