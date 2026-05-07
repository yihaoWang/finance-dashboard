import { describe, it, expect } from 'vitest';
import { classifySentiment } from '../src/lib/sentiment';

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
