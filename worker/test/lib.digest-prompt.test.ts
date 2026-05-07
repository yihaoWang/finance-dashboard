import { describe, it, expect } from 'vitest';
import { buildPrompt, parseSections, SYSTEM_PROMPT } from '../src/lib/digest-prompt';

const FRED_SNAPSHOT = {
  dgs10: { latest: 4.36, prev: 4.42, date: '2026-05-06' },
  cpi: { latest: 315.2, prev: 314.5, date: '2026-04-01' },
  pce: { latest: 128.4, prev: 128.0, date: '2026-04-01' },
  unrate: { latest: 4.2, prev: 4.1, date: '2026-04-01' },
};

describe('SYSTEM_PROMPT', () => {
  it('contains required section markers', () => {
    expect(SYSTEM_PROMPT).toContain('## 硬數據');
    expect(SYSTEM_PROMPT).toContain('## 框架解讀');
    expect(SYSTEM_PROMPT).toContain('## 情緒');
  });
});

describe('buildPrompt', () => {
  it('contains date and scope for market prompt', () => {
    const prompt = buildPrompt({
      scope: 'market',
      symbol: 'market',
      date: '2026-05-07',
      fred: FRED_SNAPSHOT,
      twseMarket: null,
      chips: null,
      news: [],
      quote: null,
    });
    expect(prompt).toContain('2026-05-07');
    expect(prompt).toContain('大盤總覽');
    expect(prompt).toContain('4.36');
    expect(prompt).toContain('DGS10');
  });

  it('contains symbol and quote data for stock prompt', () => {
    const prompt = buildPrompt({
      scope: 'stock',
      symbol: '2330',
      date: '2026-05-07',
      fred: FRED_SNAPSHOT,
      twseMarket: null,
      chips: {
        code: '2330',
        date: '20260507',
        foreignNet: 12345,
        trustNet: -500,
        dealerNet: 200,
      },
      news: [{ title: '台積電大漲', publisher: 'Yahoo', publishedAt: Date.now(), link: 'http://x' }],
      quote: {
        symbol: '2330',
        name: '台積電',
        price: 1085,
        change: 15,
        changePct: 1.40,
        volume: 100000,
        marketCap: null,
        high52w: 1200,
        low52w: 700,
        pe: 27.4,
        forwardPe: 21.8,
        ttmEps: 39.62,
      },
    });
    expect(prompt).toContain('2330');
    expect(prompt).toContain('台積電大漲');
    expect(prompt).toContain('12,345');
    expect(prompt).toContain('1085');
  });

  it('handles null fred gracefully', () => {
    const prompt = buildPrompt({
      scope: 'market',
      symbol: 'market',
      date: '2026-05-07',
      fred: null,
      twseMarket: null,
      chips: null,
      news: [],
      quote: null,
    });
    expect(prompt).toContain('FRED 數據暫不可用');
  });
});

describe('parseSections', () => {
  it('parses full 3-section output', () => {
    const text = `## 硬數據\n美國10年期殖利率 4.36%，CPI 315.2。\n\n## 框架解讀\n利率偏高，市場觀望。\n\n## 情緒\n外資小幅買超，情緒中性偏謹慎。`;
    const sections = parseSections(text);
    expect(sections.hard_data).toContain('4.36%');
    expect(sections.framework).toContain('觀望');
    expect(sections.sentiment).toContain('外資');
  });

  it('handles whitespace around markers', () => {
    const text = `##  硬數據  \n數據A。\n##框架解讀\n解讀B。\n## 情緒\n情緒C。`;
    const sections = parseSections(text);
    expect(sections.hard_data).toContain('數據A');
    expect(sections.framework).toContain('解讀B');
    expect(sections.sentiment).toContain('情緒C');
  });

  it('returns empty strings for missing sections', () => {
    const text = `## 硬數據\n只有一段。`;
    const sections = parseSections(text);
    expect(sections.hard_data).toContain('只有一段');
    expect(sections.framework).toBe('');
    expect(sections.sentiment).toBe('');
  });

  it('returns empty strings for empty text', () => {
    const sections = parseSections('');
    expect(sections.hard_data).toBe('');
    expect(sections.framework).toBe('');
    expect(sections.sentiment).toBe('');
  });
});
