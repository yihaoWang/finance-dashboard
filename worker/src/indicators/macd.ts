import { ema } from './ema';
// Returns MACD = EMA12 - EMA26 (raw line). Signal/histogram require iterative EMA9 of MACD; for V1 we just return the MACD line plus a binary trend signal.
export type MacdResult = { macd: number | null; signal: 'bullish' | 'bearish' | 'neutral' };
export const macd = (closes: number[]): MacdResult => {
  const e12 = ema(closes, 12);
  const e26 = ema(closes, 26);
  if (e12 === null || e26 === null) return { macd: null, signal: 'neutral' };
  const m = e12 - e26;
  const signal = m > 0.5 ? 'bullish' : m < -0.5 ? 'bearish' : 'neutral';
  return { macd: m, signal };
};
