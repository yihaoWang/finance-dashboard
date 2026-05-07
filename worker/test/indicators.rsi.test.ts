import { describe, it, expect } from 'vitest';
import { rsi } from '../src/indicators/rsi';

describe('rsi', () => {
  it('returns null when series too short', () => {
    expect(rsi(Array(14).fill(100))).toBeNull();
  });

  it('returns value in [0, 100] for typical series', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 10);
    const result = rsi(closes);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThanOrEqual(0);
    expect(result!).toBeLessThanOrEqual(100);
  });

  it('returns 100 when there are no losses (all gains)', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(rsi(closes)).toBe(100);
  });

  it('returns a low value for a consistently falling series', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 200 - i * 5);
    const result = rsi(closes);
    expect(result).not.toBeNull();
    expect(result!).toBeLessThan(30);
  });

  it('returns a known approximate value for a flat-then-up sequence', () => {
    // All gains → RSI = 100
    const closes = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
    expect(rsi(closes, 14)).toBe(100);
  });
});
