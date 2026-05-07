import { fetchWithRetry } from '../lib/http';

export type NewsItem = {
  title: string;
  publisher: string;
  publishedAt: number;
  link: string;
};

type Opts = { fetcher?: typeof fetch };
const UA = 'Mozilla/5.0 (compatible; FinanceDashboard/0.1)';

const TITLE_RE = /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/g;
const LINK_RE = /<link>([\s\S]*?)<\/link>/g;
const PUBDATE_RE = /<pubDate>([\s\S]*?)<\/pubDate>/g;
const SOURCE_RE = /<source[^>]*>([\s\S]*?)<\/source>/g;

const matchAll = (xml: string, re: RegExp): string[] => {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1].trim());
  }
  return out;
};

export const fetchYahooNews = async (
  symbol: string,
  opts: Opts = {},
): Promise<NewsItem[]> => {
  const url = `https://tw.stock.yahoo.com/rss?s=${symbol}.TW`;
  const res = await fetchWithRetry(
    url,
    { headers: { 'User-Agent': UA, Accept: 'application/rss+xml,application/xml;q=0.9,*/*;q=0.8' } },
    { fetcher: opts.fetcher },
  );
  const xml = await res.text();

  // First title/link belong to <channel>; the rest belong to items.
  const titles = matchAll(xml, TITLE_RE);
  const links = matchAll(xml, LINK_RE);
  const dates = matchAll(xml, PUBDATE_RE);
  const sources = matchAll(xml, SOURCE_RE);

  // TITLE_RE only matches CDATA titles — channel title is plain text, so all
  // matched titles are item titles already.
  const itemTitles = titles;
  // Channel + image each have a <link>; items follow after. Take the last N
  // where N = itemTitles.length to align with item titles.
  const itemLinks = links.slice(-itemTitles.length);

  return itemTitles
    .map((title, i): NewsItem => ({
      title,
      publisher: sources[i] ?? 'Yahoo奇摩股市',
      publishedAt: dates[i] ? Date.parse(dates[i]) : Date.now(),
      link: itemLinks[i] ?? '',
    }))
    .filter((n) => n.title && n.link)
    .slice(0, 15);
};
