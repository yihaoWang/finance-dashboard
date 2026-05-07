import { describe, it, expect } from 'vitest';
import { deviation } from '../src/indicators/deviation';

describe('deviation', () => {
  it('returns percent above MA', () => {
    expect(deviation(110, 100)).toBeCloseTo(10);
  });
  it('returns negative percent below MA', () => {
    expect(deviation(90, 100)).toBeCloseTo(-10);
  });
  it('returns 0 when equal', () => {
    expect(deviation(100, 100)).toBe(0);
  });
  it('returns null when ma is null', () => {
    expect(deviation(100, null)).toBeNull();
  });
  it('returns null when ma is 0', () => {
    expect(deviation(100, 0)).toBeNull();
  });
});
