import { fetchWithRetry } from '../lib/http';
import type { EventCategory, EventImpact, EventItem } from '@fd/shared';

type Opts = { fetcher?: typeof fetch };

type FFEvent = {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
};

const FF_THIS_WEEK = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const FF_NEXT_WEEK = 'https://nfs.faireconomy.media/ff_calendar_nextweek.json';

const KEYWORD_CATEGORY: Array<[RegExp, EventCategory]> = [
  [/FOMC|Federal Funds|Fed Chair|Powell/i, 'fomc'],
  [/CPI|PPI|Inflation|PCE/i, 'cpi'],
  [/Non-Farm|NFP|Unemployment|Jobless|Payroll|JOLTS/i, 'employment'],
  [/GDP/i, 'gdp'],
  [/Rate Decision|Rate Statement|Interest Rate|BOJ|ECB|BOE/i, 'central_bank'],
];

const classify = (title: string): EventCategory => {
  for (const [re, cat] of KEYWORD_CATEGORY) {
    if (re.test(title)) return cat;
  }
  return 'other';
};

const normalizeImpact = (raw: string): EventImpact => {
  const v = raw.toLowerCase();
  if (v === 'high') return 'high';
  if (v === 'medium') return 'medium';
  return 'low';
};

const stableId = (country: string, title: string, ts: number): string => {
  const slug = `${country}-${title}-${ts}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-');
  return slug.slice(0, 120);
};

const fetchFFWeek = async (url: string, opts: Opts): Promise<FFEvent[]> => {
  const res = await fetchWithRetry(
    url,
    { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; FinanceDashboard/0.1)' } },
    { fetcher: opts.fetcher },
  );
  return (await res.json()) as FFEvent[];
};

export const fetchEconomicEvents = async (opts: Opts = {}): Promise<EventItem[]> => {
  const [thisWeek, nextWeek] = await Promise.allSettled([
    fetchFFWeek(FF_THIS_WEEK, opts),
    fetchFFWeek(FF_NEXT_WEEK, opts),
  ]);
  const raw: FFEvent[] = [];
  if (thisWeek.status === 'fulfilled') raw.push(...thisWeek.value);
  if (nextWeek.status === 'fulfilled') raw.push(...nextWeek.value);

  const items: EventItem[] = [];
  for (const ev of raw) {
    if (!ev?.date || !ev?.title) continue;
    const ts = Date.parse(ev.date);
    if (Number.isNaN(ts)) continue;
    const country = (ev.country ?? '').toUpperCase();
    if (!['USD', 'CNY', 'EUR', 'JPY', 'TWD', 'GBP'].includes(country)) continue;
    const category = classify(ev.title);
    const impact = normalizeImpact(ev.impact ?? '');
    if (impact === 'low' && category === 'other') continue;
    items.push({
      id: stableId(country, ev.title, ts),
      eventTime: ts,
      category,
      title: ev.title,
      country,
      impact,
      source: 'forexfactory',
      url: null,
      forecast: ev.forecast || null,
      previous: ev.previous || null,
      actual: null,
    });
  }
  items.sort((a, b) => a.eventTime - b.eventTime);
  return items;
};
