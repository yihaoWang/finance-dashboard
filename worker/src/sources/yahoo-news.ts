import { fetchWithRetry } from '../lib/http';

export type NewsItem = {
  title: string;
  publisher: string;
  publishedAt: number; // unix ms
  link: string;
};

type YahooNewsRaw = {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number; // unix seconds
  type: string;
};

type YahooSearchResponse = {
  news: YahooNewsRaw[];
};

type Opts = { fetcher?: typeof fetch; userAgent?: string };

const DEFAULT_UA = 'Mozilla/5.0 (compatible; FinanceDashboard/0.1)';

export const fetchYahooNews = async (
  symbol: string,
  opts: Opts = {},
): Promise<NewsItem[]> => {
  const query = symbol.endsWith('.TW') ? symbol : `${symbol}.TW`;
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=20&quotesCount=0`;
  const res = await fetchWithRetry(
    url,
    {
      headers: {
        'User-Agent': opts.userAgent ?? DEFAULT_UA,
        'Accept': 'application/json',
      },
    },
    { fetcher: opts.fetcher },
  );
  const json = await res.json() as YahooSearchResponse;
  const news = json.news ?? [];
  return news
    .filter((n) => n.type === 'STORY')
    .map((n) => ({
      title: n.title,
      publisher: n.publisher,
      publishedAt: n.providerPublishTime * 1000,
      link: n.link,
    }))
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, 15);
};
