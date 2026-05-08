import { describe, it, expect, vi } from 'vitest';
import { fetchEconomicEvents } from '../src/sources/events';

const sample = [
  {
    title: 'FOMC Statement',
    country: 'USD',
    date: '2026-06-17T18:00:00-04:00',
    impact: 'High',
    forecast: '4.25%',
    previous: '4.50%',
  },
  {
    title: 'CPI m/m',
    country: 'USD',
    date: '2026-06-12T08:30:00-04:00',
    impact: 'High',
    forecast: '0.2%',
    previous: '0.3%',
  },
  {
    title: 'Retail Sales m/m',
    country: 'GBP',
    date: '2026-06-15T02:00:00-04:00',
    impact: 'Low',
    forecast: '',
    previous: '',
  },
  {
    title: 'Some Brazilian Index',
    country: 'BRL',
    date: '2026-06-10T08:00:00-04:00',
    impact: 'High',
    forecast: '',
    previous: '',
  },
];

describe('fetchEconomicEvents', () => {
  it('classifies categories and filters low-impact others', async () => {
    const fetcher = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(sample), { status: 200 })),
    );
    const items = await fetchEconomicEvents({ fetcher });
    const titles = items.map((i) => i.title);
    expect(titles).toContain('FOMC Statement');
    expect(titles).toContain('CPI m/m');
    // BRL filtered out (not in supported countries)
    expect(items.find((i) => i.country === 'BRL')).toBeUndefined();
    // GBP retail sales is "low + other" → filtered
    expect(items.find((i) => i.title === 'Retail Sales m/m')).toBeUndefined();

    const fomc = items.find((i) => i.title === 'FOMC Statement')!;
    expect(fomc.category).toBe('fomc');
    expect(fomc.impact).toBe('high');
    expect(fomc.forecast).toBe('4.25%');
    expect(fomc.id).toMatch(/usd-fomc-statement/);

    const cpi = items.find((i) => i.title === 'CPI m/m')!;
    expect(cpi.category).toBe('cpi');
  });

  it('sorts by event time ascending', async () => {
    const fetcher = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(sample), { status: 200 })),
    );
    const items = await fetchEconomicEvents({ fetcher });
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1];
      const curr = items[i];
      if (!prev || !curr) continue;
      expect(curr.eventTime).toBeGreaterThanOrEqual(prev.eventTime);
    }
  });
});
