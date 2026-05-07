import { describe, it, expect } from 'vitest';
import { percentileRank } from '../src/indicators/percentile';

describe('percentileRank', () => {
  it('returns 0 for value below all', () => {
    expect(percentileRank(0, [1, 2, 3, 4, 5])).toBe(0);
  });
  it('returns 100 for value at or above all', () => {
    expect(percentileRank(5, [1, 2, 3, 4, 5])).toBe(100);
  });
  it('returns mid percentile', () => {
    expect(percentileRank(3, [1, 2, 3, 4, 5])).toBe(60);
  });
  it('returns null for empty series', () => {
    expect(percentileRank(3, [])).toBeNull();
  });
});
