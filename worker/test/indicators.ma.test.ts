import { describe, it, expect } from 'vitest';
import { sma } from '../src/indicators/ma';

describe('sma', () => {
  it('computes simple moving average for window', () => {
    expect(sma([1, 2, 3, 4, 5], 5)).toBe(3);
  });
  it('uses last N values when series longer than window', () => {
    expect(sma([10, 1, 2, 3, 4, 5], 5)).toBe(3);
  });
  it('returns null when series shorter than window', () => {
    expect(sma([1, 2, 3], 5)).toBeNull();
  });
  it('returns null on empty', () => {
    expect(sma([], 5)).toBeNull();
  });
});
