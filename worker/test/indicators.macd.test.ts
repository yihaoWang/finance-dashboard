import { describe, it, expect } from 'vitest';
import { macd } from '../src/indicators/macd';

describe('macd', () => {
  it('returns null macd and neutral signal when series < 26', () => {
    const closes = Array(25).fill(100);
    const result = macd(closes);
    expect(result.macd).toBeNull();
    expect(result.signal).toBe('neutral');
  });

  it('returns object with signal when series >= 26', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i * 0.5);
    const result = macd(closes);
    expect(result.macd).not.toBeNull();
    expect(['bullish', 'bearish', 'neutral']).toContain(result.signal);
  });

  it('returns bullish signal for strongly uptrending series', () => {
    // Strongly rising: EMA12 > EMA26 by more than 0.5
    const closes = Array.from({ length: 60 }, (_, i) => 100 + i * 2);
    const result = macd(closes);
    expect(result.signal).toBe('bullish');
  });

  it('returns bearish signal for strongly downtrending series', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 200 - i * 2);
    const result = macd(closes);
    expect(result.signal).toBe('bearish');
  });
});
