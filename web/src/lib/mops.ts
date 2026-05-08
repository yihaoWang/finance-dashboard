const irMap: Record<string, string> = {
  '2308': 'https://www.deltaww.com/zh-TW/investor-overview',
  '2317': 'https://www.honhai.com/zh-tw/investor-relations',
  '2330': 'https://www.tsmc.com/chinese/investorRelations',
  '2454': 'https://www.mediatek.tw/about/investor-relations',
  '3008': 'https://www.largan.com.tw/zh/investor/financial.aspx',
};

export const mopsLinks = (symbol: string) => ({
  irPage: irMap[symbol] ?? `https://mops.twse.com.tw/mops/web/t05st02?step=1&co_id=${symbol}`,
  latestQuarterReport: `https://mops.twse.com.tw/mops/web/t164sb01?step=1&firstin=1&off=1&queryName=co_id&inpuType=co_id&TYPEK=all&isnew=true&co_id=${symbol}`,
  legalPresentations: `https://mops.twse.com.tw/mops/web/t100sb02_1?step=1&firstin=1&co_id=${symbol}`,
  reportsList: `https://mops.twse.com.tw/mops/web/t05st02?step=1&co_id=${symbol}`,
});
