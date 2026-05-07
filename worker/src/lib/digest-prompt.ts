import type { FredSnapshot } from '../sources/fred';
import type { TwseBwibbu } from '../sources/twse';
import type { ChipDaily } from '../sources/twse-chips';
import type { NewsItem } from '../sources/yahoo-news';
import type { YahooQuote } from '../sources/yahoo';

export const SYSTEM_PROMPT = `你是一位專業的台股與總體經濟分析助理，擅長整合硬數據與市場情緒，提供清晰、客觀的每日投資摘要。

請嚴格按照以下三段式格式輸出，每段 100~200 字：

## 硬數據
（列出關鍵數字：利率、通膨、三大法人買賣超、個股漲跌幅、本益比等，**只能引用 user message 中提供的數字，禁止編造**）

## 框架解讀
（從總體經濟與產業角度解讀這些數字的意義：趨勢方向、支撐或壓力來源、與歷史比較）

## 情緒
（評估市場或個股的短期情緒：外資態度、新聞標題情緒、多空力道，給出簡短的情緒傾向結論）

注意事項：
- 每段嚴格以 ## 硬數據、## 框架解讀、## 情緒 開頭
- 不要在結尾加「免責聲明」或「以上僅供參考」
- 不要編造任何未在 user message 中出現的數字或事件
- 使用繁體中文`;

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
