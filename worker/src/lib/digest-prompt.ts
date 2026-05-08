import type { Insight } from '@fd/shared';
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

【分析框架 — 解讀數據時請優先套用以下視角】

當前市場處於 AI 軍備競賽主導的循環中，傳統總經數據（就業、PMI、利率）對盤勢的解釋力下降，主要驅動力轉為以下幾條結構性主軸：

A. AI capex 擴張動能：雲端四巨頭（Google / Amazon / Microsoft / Meta）與 Oracle 的資本支出指引是當前股市最重要的先行指標；任一家下修都是反轉訊號。
B. 台韓供應鏈結構性重估：MSCI 新興市場指數中台韓占比已達 30–40%，台股、韓股、費半的同步性極高；觀察費半、SOXX、三星、SK 海力士走勢做為台股權值股先行訊號。
C. HBM 與記憶體超級循環：與消費電子循環脫鉤，廠商簽 3–5 年長約；DRAM/HBM 現貨價、月營收 YoY 是核心追蹤項。
D. 估值循環依賴風險：雲端巨頭「其他收入」中含大量 AI 新創持股估值上修的帳面收益；OpenAI、Anthropic 占四大雲端訂單可能達 40–50%；這是牛市加速器、也是反轉時的反向放大器。
E. 個股護城河差異：晶圓代工（台積電）的稀缺性高於演算法或模型公司；判讀個股時優先評估「十年後是否仍是必需供應商」。
F. 多空主敘事對立：多方主敘事為「算力永遠供不應求 = 不會泡沫」；反向訊號為「OpenAI/Anthropic 開始降價或解除算力限制」、新創估值停滯、capex 指引下修。
G. 行為面警示：牛市持續越久，散戶風險偏好越易失真；當資料顯示槓桿、融資餘額、散戶情緒過熱時應提醒自律。

【輸出格式 — 四段，每段 100~250 字，必須以下列標題開頭】

## 硬數據
複述 user message 中提供的關鍵數字（利率、通膨、估值、漲跌、買賣超），不加自己的判斷。

## 框架解讀
套用上述 A–G 框架解讀今日數據與外部觀點的意義。優先回答：本日訊號落在 AI capex 動能、台韓重估、HBM 循環、估值循環、個股護城河、多空主敘事、行為面 之中的哪幾條主軸？如果 user message 中有【外部觀點】段落，請整合其主敘事與驗證 / 反向訊號做交叉比對。引用事件必須來自新聞標題列表或外部觀點，禁止編造。

## 操作建議
給出短中期（1 週至 1 季）可執行的操作建議，須具備：(1) 方向（加碼 / 持有 / 減碼 / 觀望）；(2) 條件式觸發（明確點位、指標水位或事件，例：費半跌破 200 日均線、外資連 5 日賣超、Anthropic 估值停滯）；(3) 風險控制（停損條件或部位上限）。所有點位、百分比必須引用 user message 中的數字，不得自行虛構。如果資料不足以給出方向，請寫「資料不足，建議觀望」並說明缺什麼。

## 情緒
評估短期市場情緒，根據新聞標題的整體語氣、量價方向、外部觀點的傾向、以及框架 F、G 的反向訊號是否浮現。`;

type BuildPromptArgs = {
  scope: 'market' | 'stock';
  symbol: string;
  date: string;
  fred: FredSnapshot | null;
  twseMarket: TwseBwibbu | null;
  chips: ChipDaily | null;
  news: NewsItem[];
  quote: YahooQuote | null;
  insights?: Insight[];
};

export const buildPrompt = (args: BuildPromptArgs): string => {
  const { scope, symbol, date, fred, twseMarket, chips, news, quote, insights } = args;

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

  // External insights (from podcasts / YouTube transcripts)
  if (insights && insights.length > 0) {
    lines.push('【外部觀點（近期 podcast / YouTube）】');
    insights.slice(0, 8).forEach((it, i) => {
      const dateStr = new Date(it.publishedAt).toISOString().slice(0, 10);
      lines.push(`${i + 1}. [${it.source} · ${dateStr}] ${it.episodeTitle}`);
      lines.push(`   主敘事：${it.mainThesis}`);
      if (it.validationSignals.length > 0) {
        lines.push(`   驗證指標：${it.validationSignals.join('；')}`);
      }
      if (it.reversalSignals.length > 0) {
        lines.push(`   反向訊號：${it.reversalSignals.join('；')}`);
      }
      if (it.frameworkTags.length > 0) {
        lines.push(`   對應框架：${it.frameworkTags.join(', ')}`);
      }
      if (it.actionHorizon !== null && it.actionSuggestion !== null) {
        lines.push(`   作者建議（${it.actionHorizon}）：${it.actionSuggestion}`);
      }
    });
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

export const parseSections = (
  text: string,
): { hard_data: string; framework: string; action_plan: string; sentiment: string } => {
  const normalize = (s: string): string => s.replace(/\s+/g, ' ').trim();
  const stop = '(?=##\\s*硬數據|##\\s*框架解讀|##\\s*操作建議|##\\s*情緒|$)';

  const hdMatch = text.match(new RegExp(`##\\s*硬數據([\\s\\S]*?)${stop}`));
  const fwMatch = text.match(new RegExp(`##\\s*框架解讀([\\s\\S]*?)${stop}`));
  const apMatch = text.match(new RegExp(`##\\s*操作建議([\\s\\S]*?)${stop}`));
  const stMatch = text.match(new RegExp(`##\\s*情緒([\\s\\S]*?)${stop}`));

  return {
    hard_data: hdMatch?.[1] !== undefined ? normalize(hdMatch[1]) : '',
    framework: fwMatch?.[1] !== undefined ? normalize(fwMatch[1]) : '',
    action_plan: apMatch?.[1] !== undefined ? normalize(apMatch[1]) : '',
    sentiment: stMatch?.[1] !== undefined ? normalize(stMatch[1]) : '',
  };
};
