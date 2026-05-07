import { describe, it, expect } from 'vitest';
import { validateSymbol } from '../src/lib/symbol';

describe('validateSymbol', () => {
  it('accepts 4-digit numeric', () => {
    expect(validateSymbol('2330')).toBe('2330');
  });
  it('accepts 6-digit alphanumeric', () => {
    expect(validateSymbol('00878B')).toBe('00878B');
  });
  it('uppercases letters', () => {
    expect(validateSymbol('00878b')).toBe('00878B');
  });
  it('rejects too short', () => {
    expect(() => validateSymbol('23')).toThrow('invalid_symbol');
  });
  it('rejects too long', () => {
    expect(() => validateSymbol('2330000')).toThrow('invalid_symbol');
  });
  it('rejects non-alnum', () => {
    expect(() => validateSymbol('23-30')).toThrow('invalid_symbol');
  });
  it('rejects path traversal', () => {
    expect(() => validateSymbol('../etc')).toThrow('invalid_symbol');
  });
});
