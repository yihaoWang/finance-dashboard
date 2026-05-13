import type { IndicatorKey, LandmarkPoint, SentimentZone, FearGreedSnapshot } from '@fd/shared';

export const computePercentile = (history: number[], value: number): number => {
  if (history.length === 0) return 0;
  const sorted = [...history].sort((a, b) => a - b);
  let below = 0;
  for (const v of sorted) {
    if (v < value) below += 1;
    else break;
  }
  return Math.round((below / sorted.length) * 100);
};

export const findNearestLandmark = (
  landmarks: LandmarkPoint[],
  value: number,
): (LandmarkPoint & { distance: number }) | null => {
  if (landmarks.length === 0) return null;
  let best = landmarks[0];
  let bestDist = Math.abs(landmarks[0].value - value);
  for (const lm of landmarks.slice(1)) {
    const d = Math.abs(lm.value - value);
    if (d < bestDist) {
      best = lm;
      bestDist = d;
    }
  }
  return { ...best, distance: Number(bestDist.toFixed(2)) };
};

const HIGHER_IS_HEALTHIER: Record<IndicatorKey, boolean> = {
  breadth_adr: true,
  foreign_futures_oi: true,
  institutional_5d: true,
  // Higher margin balance = more retail leverage = caution (contrarian bearish signal)
  margin_balance: false,
  margin_maintenance: true,
  options_pcr: false,
  short_long_ratio: false,
};

export const classifyZone = (key: IndicatorKey, percentile: number): SentimentZone => {
  const higherHealthier = HIGHER_IS_HEALTHIER[key];
  const p = higherHealthier ? percentile : 100 - percentile;
  if (p < 15) return 'danger';
  if (p < 35) return 'caution';
  if (p < 65) return 'neutral';
  return 'healthy';
};

interface FearGreedInputs {
  breadthAdrPercentile: number;
  foreignFuturesOiPercentile: number;
  institutional5dPercentile: number;
  // Higher margin balance = more retail leverage = greedy signal
  marginBalancePercentile: number;
  marginMaintenancePercentile: number;
  optionsPcrPercentile: number;
  shortLongRatioPercentile: number;
}

export const computeFearGreed = (inputs: FearGreedInputs): FearGreedSnapshot => {
  // Weights (sum = 1.0):
  //   marginMaintenance  0.15
  //   marginBalance      0.15  (higher balance = more leverage = greedy)
  //   shortLongRatio     0.12  (inverted: higher ratio = less greedy)
  //   institutional5d    0.18
  //   foreignFuturesOi   0.12
  //   breadthAdr         0.13
  //   optionsPcr         0.15  (inverted: higher PCR = fear = less greedy)
  const greedScore =
    inputs.marginMaintenancePercentile * 0.15 +
    inputs.marginBalancePercentile * 0.15 +
    (100 - inputs.shortLongRatioPercentile) * 0.12 +
    inputs.institutional5dPercentile * 0.18 +
    inputs.foreignFuturesOiPercentile * 0.12 +
    inputs.breadthAdrPercentile * 0.13 +
    (100 - inputs.optionsPcrPercentile) * 0.15;
  const value = Math.round(greedScore);
  const label: FearGreedSnapshot['label'] =
    value < 20 ? 'Extreme Fear'
    : value < 45 ? 'Fear'
    : value < 55 ? 'Neutral'
    : value < 80 ? 'Greed'
    : 'Extreme Greed';
  return { value, label, percentile: value };
};

const POSITIVE = [
  '上修', '上調', '看好', '利多', '創新高', '突破', '成長', '受惠', '訂單', '增加',
  '優於預期', '大漲', '飆漲', '搶單', '升評', '加碼', '回升', '轉強', '亮眼', '優異',
  '獲利', '雙位數成長', '正面', '加持', '受益', '布局',
];

const NEGATIVE = [
  '下修', '下調', '看淡', '利空', '創新低', '跌破', '衰退', '砍單', '減少', '失利',
  '不如預期', '大跌', '崩跌', '裁員', '虧損', '降評', '減碼', '回落', '轉弱', '疲弱',
  '警示', '違約', '訴訟', '罰款', '出走', '流失', '空襲', '關稅', '出口管制',
];

export type Sentiment = 'positive' | 'negative' | 'neutral';

export const classifySentiment = (text: string): Sentiment => {
  let pos = 0;
  let neg = 0;
  for (const w of POSITIVE) if (text.includes(w)) pos++;
  for (const w of NEGATIVE) if (text.includes(w)) neg++;
  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
};
