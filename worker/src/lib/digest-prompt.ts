import type { FredSnapshot } from '../sources/fred';
import type { TwseBwibbu } from '../sources/twse';
import type { ChipDaily } from '../sources/twse-chips';
import type { NewsItem } from '../sources/yahoo-news';
import type { YahooQuote } from '../sources/yahoo';

export const SYSTEM_PROMPT = `你是一位專業的台股與總體經濟分析助理，整合硬數據與新聞情緒，提供客觀的每日投資摘要。

【嚴格規則 — 違反任一條視為失敗回答】
1. 禁止編造任何事件、人物、公司動作。所有事件必須能在 user message 的【近24小時新聞標題】列表中找到對應標題。
2. 禁止使用 user message 中沒出現過的數字。所有百分比、金額、買賣超皆須引自 user message。
3. 禁止使用「裁員」「訴訟」「下修」「上修」「警告」「醜聞」「弊案」等詞，除非新聞標題中真的出現對應字眼。
4. 如果某段資料不足，請直接寫「資料不足，未見明顯事件」，不要硬湊。
5. 禁止結尾免責聲明、禁止使用條列符號（- 或 *），純散文段落即可。
6. 全部使用繁體中文。

【輸出格式 — 三段，每段 100~200 字，必須以下列標題開頭】

## 硬數據
複述 user message 中提供的關鍵數字（利率、通膨、估值、漲跌、買賣超），不加自己的判斷。

## 框架解讀
僅就上面數字的意義做解讀（高估值代表什麼、外資買超在市場處於什麼位置、利率走向對台股的影響）。如果有引用具體事件，必須是新聞標題列表中真實出現的。

## 情緒
評估短期市場情緒，僅根據新聞標題的整體語氣與量價方向。`;

type BuildPromptArgs = {
  scope: 'market' | 'stock';
  symbol: string;
  date: string;
  fred: FredSnapshot | null;
  twseMarket: TwseBwibbu | null;
  chips: ChipDaily | null;
  news: NewsItem[];
  quote: YahooQuote | null;
};

export const buildPrompt = (args: BuildPromptArgs): string => {
  const { scope, symbol, date, fred, twseMarket, chips, news, quote } = args;

  const lines: string[] = [];
  lines.push(`日期：${date}`);
  lines.push(`分析範圍：${scope === 'market' ? '大盤總覽' : `個股 ${symbol}`}`);
  lines.push('');

  // FRED macro data
  lines.push('【總體經濟指標（FRED）】');
  if (fred) {
    if (fred.dgs10) {
      lines.push(`美國10年期公債殖利率 (DGS10)：${fred.dgs10.latest}%（前期 ${fred.dgs10.prev}%，${fred.dgs10.date}）`);
    }
    if (fred.cpi) {
      lines.push(`美國CPI (CPIAUCSL)：${fred.cpi.latest}（前期 ${fred.cpi.prev}，${fred.cpi.date}）`);
    }
    if (fred.pce) {
      lines.push(`美國PCE (PCEPI)：${fred.pce.latest}（前期 ${fred.pce.prev}，${fred.pce.date}）`);
    }
    if (fred.unrate) {
      lines.push(`美國失業率 (UNRATE)：${fred.unrate.latest}%（前期 ${fred.unrate.prev}%，${fred.unrate.date}）`);
    }
  } else {
    lines.push('（FRED 數據暫不可用）');
  }
  lines.push('');

  // TWSE market
  if (twseMarket) {
    lines.push('【台股大盤 BWIBBU】');
    lines.push(`代碼：${twseMarket.code}，名稱：${twseMarket.name}`);
    if (twseMarket.pe !== null) lines.push(`本益比 (P/E)：${twseMarket.pe}`);
    if (twseMarket.pb !== null) lines.push(`股價淨值比 (P/B)：${twseMarket.pb}`);
    if (twseMarket.dividendYield !== null) lines.push(`殖利率：${twseMarket.dividendYield}%`);
    lines.push('');
  }

  // Individual stock quote
  if (scope === 'stock' && quote) {
    lines.push(`【個股報價 ${symbol}】`);
    lines.push(`名稱：${quote.name}`);
    lines.push(`現價：${quote.price}，漲跌：${quote.change > 0 ? '+' : ''}${quote.change.toFixed(2)} (${quote.changePct > 0 ? '+' : ''}${quote.changePct.toFixed(2)}%)`);
    if (quote.pe !== null) lines.push(`本益比 (P/E)：${quote.pe}`);
    if (quote.forwardPe !== null) lines.push(`預期本益比：${quote.forwardPe}`);
    if (quote.high52w !== null) lines.push(`52週高點：${quote.high52w}`);
    if (quote.low52w !== null) lines.push(`52週低點：${quote.low52w}`);
    lines.push('');
  }

  // Three major institutional investors (chips)
  if (chips) {
    lines.push(`【三大法人買賣超（${chips.date}）】`);
    lines.push(`外資：${chips.foreignNet > 0 ? '+' : ''}${chips.foreignNet.toLocaleString()} 張`);
    lines.push(`投信：${chips.trustNet > 0 ? '+' : ''}${chips.trustNet.toLocaleString()} 張`);
    lines.push(`自營商：${chips.dealerNet > 0 ? '+' : ''}${chips.dealerNet.toLocaleString()} 張`);
    lines.push('');
  }

  // News headlines
  if (news.length > 0) {
    lines.push('【近24小時新聞標題】');
    news.slice(0, 15).forEach((item, i) => {
      lines.push(`${i + 1}. ${item.title}`);
    });
    lines.push('');
  }

  return lines.join('\n');
};

export const parseSections = (text: string): { hard_data: string; framework: string; sentiment: string } => {
  const normalize = (s: string): string => s.replace(/\s+/g, ' ').trim();

  const hdMatch = text.match(/##\s*硬數據([\s\S]*?)(?=##\s*框架解讀|##\s*情緒|$)/);
  const fwMatch = text.match(/##\s*框架解讀([\s\S]*?)(?=##\s*硬數據|##\s*情緒|$)/);
  const stMatch = text.match(/##\s*情緒([\s\S]*?)(?=##\s*硬數據|##\s*框架解讀|$)/);

  return {
    hard_data: hdMatch?.[1] !== undefined ? normalize(hdMatch[1]) : '',
    framework: fwMatch?.[1] !== undefined ? normalize(fwMatch[1]) : '',
    sentiment: stMatch?.[1] !== undefined ? normalize(stMatch[1]) : '',
  };
};
