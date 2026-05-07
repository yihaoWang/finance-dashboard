import { describe, it, expect } from 'vitest';
import { supportResistance } from '../src/indicators/range';

describe('supportResistance', () => {
  it('returns null when closes < window', () => {
    expect(supportResistance(Array(19).fill(100), 20)).toBeNull();
  });

  it('returns min and max of last 20 bars', () => {
    const closes = Array.from({ length: 30 }, (_, i) => i + 1);
    // last 20: 11..30, support=11, resistance=30
    const result = supportResistance(closes, 20);
    expect(result).not.toBeNull();
    expect(result!.support).toBe(11);
    expect(result!.resistance).toBe(30);
  });

  it('uses default window of 20', () => {
    const closes = Array.from({ length: 25 }, (_, i) => i + 1);
    const result = supportResistance(closes);
    expect(result).not.toBeNull();
    expect(result!.support).toBe(6);
    expect(result!.resistance).toBe(25);
  });

  it('returns equal support and resistance for flat series', () => {
    const closes = Array(20).fill(500);
    const result = supportResistance(closes, 20);
    expect(result!.support).toBe(500);
    expect(result!.resistance).toBe(500);
  });
});
