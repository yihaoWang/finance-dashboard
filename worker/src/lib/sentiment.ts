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
