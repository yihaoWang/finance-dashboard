const irMap: Record<string, string> = {
  '2308': 'https://www.deltaww.com/zh-TW/investor-overview',
  '2317': 'https://www.honhai.com/zh-tw/investor-relations',
  '2330': 'https://www.tsmc.com/chinese/investorRelations',
  '2454': 'https://www.mediatek.tw/about/investor-relations',
  '3008': 'https://www.largan.com.tw/zh/investor/financial.aspx',
};

type Args = { symbol: string; year?: number; quarter?: number };

// 公開資訊觀測站 (MOPS) 不接受直連 GET（需要 session/referer），點下去會跳「頁面無法執行」。
// 改成下列 100% bookmarkable 的真實財報來源：
// - Yahoo 財報：完整三大表 + 季度比較，直接 deep-link 可用
// - Goodinfo：詳細財報歷史分析
// - TWSE 公司資料頁：官方公司基本資料 + 重大訊息列表
// - IR 官網：公司投資人關係頁（手動維護的對應表）

export const mopsLinks = ({ symbol }: Args) => {
  const incomeStatement = `https://tw.stock.yahoo.com/quote/${symbol}.TW/income-statement`;
  const balanceSheet = `https://tw.stock.yahoo.com/quote/${symbol}.TW/balance-sheet`;
  const cashFlow = `https://tw.stock.yahoo.com/quote/${symbol}.TW/cash-flow-statement`;
  const goodinfo = `https://goodinfo.tw/tw/StockBzPerformance.asp?STOCK_ID=${symbol}`;
  const twseCompany = `https://www.twse.com.tw/zh/company/${symbol}`;
  const irPage = irMap[symbol] ?? twseCompany;

  return {
    quarterReport: incomeStatement,
    legalPresentations: goodinfo,
    reportsList: twseCompany,
    irPage,
    incomeStatement,
    balanceSheet,
    cashFlow,
  };
};
