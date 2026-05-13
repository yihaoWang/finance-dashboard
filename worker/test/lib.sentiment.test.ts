import { describe, it, expect } from 'vitest';
import { classifySentiment, computePercentile, findNearestLandmark, classifyZone, computeFearGreed } from '../src/lib/sentiment';
import { HISTORICAL_LANDMARKS } from '../src/data/historical-landmarks';

describe('classifySentiment', () => {
  it('returns positive for bullish keywords', () => {
    expect(classifySentiment('台積電看好，訂單增加，亮眼表現')).toBe('positive');
  });

  it('returns positive for single positive keyword', () => {
    expect(classifySentiment('獲利大幅成長')).toBe('positive');
  });

  it('returns negative for bearish keywords', () => {
    expect(classifySentiment('台積電下修，砍單衰退，股價大跌')).toBe('negative');
  });

  it('returns negative for single negative keyword', () => {
    expect(classifySentiment('台積電遭到降評')).toBe('negative');
  });

  it('returns neutral when no keywords match', () => {
    expect(classifySentiment('台積電今日股價持平')).toBe('neutral');
  });

  it('returns neutral when positive and negative counts are equal', () => {
    expect(classifySentiment('看好但有利空疑慮')).toBe('neutral');
  });

  it('returns positive when positive outweighs negative', () => {
    expect(classifySentiment('看好且獲利增加，雖有利空但整體亮眼')).toBe('positive');
  });

  it('handles 關稅 as negative', () => {
    expect(classifySentiment('美國對台灣加徵關稅')).toBe('negative');
  });

  it('handles 創新高 as positive', () => {
    expect(classifySentiment('股價創新高')).toBe('positive');
  });
});

describe('computePercentile', () => {
  it('returns 0 for value below all history', () => {
    expect(computePercentile([100, 120, 140, 160], 50)).toBe(0);
  });
  it('returns 100 for value above all history', () => {
    expect(computePercentile([100, 120, 140, 160], 200)).toBe(100);
  });
  it('returns ~50 for median value', () => {
    expect(computePercentile([100, 120, 140, 160], 130)).toBeGreaterThanOrEqual(40);
    expect(computePercentile([100, 120, 140, 160], 130)).toBeLessThanOrEqual(60);
  });
  it('returns 0 for empty history', () => {
    expect(computePercentile([], 100)).toBe(0);
  });
});

describe('findNearestLandmark', () => {
  it('returns the landmark closest in value', () => {
    // margin_maintenance landmarks now use a ~97.5–101.8 scale (ratio ×100)
    const result = findNearestLandmark(HISTORICAL_LANDMARKS.margin_maintenance, 100);
    expect(result?.event).toBe('2023 反彈（融資回溫）');
    expect(result?.distance).toBeCloseTo(0.5, 1);
  });
  it('returns null for empty landmarks', () => {
    expect(findNearestLandmark([], 100)).toBeNull();
  });
});

describe('classifyZone (margin_maintenance: higher=healthier)', () => {
  it('danger when percentile < 15', () => {
    expect(classifyZone('margin_maintenance', 10)).toBe('danger');
  });
  it('caution when 15 <= p < 35', () => {
    expect(classifyZone('margin_maintenance', 25)).toBe('caution');
  });
  it('healthy when p >= 65', () => {
    expect(classifyZone('margin_maintenance', 80)).toBe('healthy');
  });
});

describe('computeFearGreed', () => {
  it('returns 0-100 numeric score with label', () => {
    const out = computeFearGreed({
      breadthAdrPercentile: 20,
      foreignFuturesOiPercentile: 25,
      institutional5dPercentile: 30,
      marginBalancePercentile: 40,
      marginMaintenancePercentile: 20,
      optionsPcrPercentile: 75,
      shortLongRatioPercentile: 80,
    });
    expect(out.value).toBeGreaterThanOrEqual(0);
    expect(out.value).toBeLessThanOrEqual(100);
    expect(['Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed']).toContain(out.label);
  });
});
