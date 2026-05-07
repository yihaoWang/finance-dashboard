import { describe, it, expect, vi } from 'vitest';
import { fetchYahooNews } from '../src/sources/yahoo-news';

const SAMPLE_RSS = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel>
<title>Yahoo股市 - 最新新聞</title>
<link>https://tw.stock.yahoo.com/</link>
<image><title>Yahoo股市</title><url>x</url><link>https://tw.stock.yahoo.com/</link></image>
<item>
  <title><![CDATA[外資加碼台積電]]></title>
  <link>https://tw.stock.yahoo.com/news/foo</link>
  <pubDate>Thu, 07 May 2026 06:00:00 +0800</pubDate>
  <source url="https://x">Yahoo奇摩股市</source>
</item>
<item>
  <title><![CDATA[投信減碼科技股]]></title>
  <link>https://tw.stock.yahoo.com/news/bar</link>
  <pubDate>Thu, 07 May 2026 05:00:00 +0800</pubDate>
  <source url="https://x">經濟日報</source>
</item>
</channel></rss>`;

describe('fetchYahooNews (RSS)', () => {
  it('parses RSS items skipping channel header', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(SAMPLE_RSS, { status: 200 }));
    const items = await fetchYahooNews('2330', { fetcher });
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('外資加碼台積電');
    expect(items[0].link).toContain('foo');
    expect(items[0].publisher).toBe('Yahoo奇摩股市');
    expect(items[0].publishedAt).toBeGreaterThan(0);
    expect(items[1].title).toBe('投信減碼科技股');
  });
});
