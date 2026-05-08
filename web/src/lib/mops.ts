const irMap: Record<string, string> = {
  '2308': 'https://www.deltaww.com/zh-TW/investor-overview',
  '2317': 'https://www.honhai.com/zh-tw/investor-relations',
  '2330': 'https://www.tsmc.com/chinese/investorRelations',
  '2454': 'https://www.mediatek.tw/about/investor-relations',
  '3008': 'https://www.largan.com.tw/zh/investor/financial.aspx',
};

type Args = { symbol: string; year?: number; quarter?: number };

const rocYear = (year: number): string => String(year - 1911);
const seasonCode = (q: number): string => String(q).padStart(2, '0');

export const mopsLinks = ({ symbol, year, quarter }: Args) => {
  const base = 'https://mops.twse.com.tw/mops/web';

  // 季報（合併財務報告書 + 個體財報 + 會計師查核報告書 etc.）
  // t164sb01 接受 co_id + year（民國年） + season（01/02/03/04）— 預填後 MOPS 會直接列出該季所有檔案下載連結
  const quarterReport =
    year !== undefined && quarter !== undefined
      ? `${base}/t164sb01?step=1&firstin=1&off=1&queryName=co_id&inpuType=co_id&TYPEK=all&isnew=true&co_id=${symbol}&year=${rocYear(year)}&season=${seasonCode(quarter)}`
      : `${base}/t164sb01?step=1&firstin=1&off=1&queryName=co_id&inpuType=co_id&TYPEK=all&isnew=true&co_id=${symbol}`;

  // 法說會 — t100sb02_1 接受 co_id + YEAR（西元）
  const legalPresentations =
    year !== undefined
      ? `${base}/t100sb02_1?step=1&firstin=1&co_id=${symbol}&YEAR=${year}`
      : `${base}/t100sb02_1?step=1&firstin=1&co_id=${symbol}`;

  // 重大訊息 / 公司基本資料
  const reportsList = `${base}/t05st02?step=1&co_id=${symbol}`;

  // IR 官方頁
  const irPage = irMap[symbol] ?? reportsList;

  return { quarterReport, legalPresentations, reportsList, irPage };
};
