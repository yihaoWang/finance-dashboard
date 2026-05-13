import type { IndicatorKey, SentimentIndicator } from '@fd/shared';

const INDICATOR_DESCRIPTIONS: Record<IndicatorKey, string> = {
  margin_maintenance:
    '散戶融資情緒的代理指標。這裡定義為「今日總融資餘額 ÷ 昨日 ×100」。>100 代表融資擴張（散戶積極加碼）、<100 代表融資縮減（散戶撤退）。極端高點常出現在多頭末期；極端低點常見於恐慌賣壓後。',
  short_long_ratio:
    '券資比 = 融券餘額 ÷ 融資餘額 ×100。數值高代表看空力道強（軋空潛力）；數值低代表融資籌碼相對穩定、空方退潮。台股長期區間約 0.5–5%。',
  institutional_5d:
    '外資 + 投信 + 自營商過去 5 個交易日合計買賣超（億元）。正值 = 法人加碼、負值 = 法人賣壓。連續正且金額放大常伴隨指數續創高，連續大幅負值常見於急跌段。',
  foreign_futures_oi:
    '台指期（TX）總未平倉口數。OI 持續放大代表多空雙方持續加碼，趨勢方常見於延伸期；OI 萎縮常見於整理或恐慌出場後。注意這是總 OI 不是外資淨多空（後者需要付費資料源）。',
  breadth_adr:
    '當日整體市場「上漲家數 ÷ 下跌家數」。>1 = 多頭氣氛（漲多於跌）、<1 = 跌多漲少。連續低於 0.5 常見於急殺末段，常用來判斷大盤是否「真強」（避免少數權值股拉抬假象）。',
  options_pcr:
    'Put 成交量 ÷ Call 成交量。常被視為「反向指標」：>1.5 代表散戶極度悲觀，常見於底部；<0.7 代表過度樂觀，常見於頂部。台指選擇權 PCR 長期中位約 1.0。',
};

const ZONE_BG: Record<SentimentIndicator['zone'], string> = {
  healthy: 'bg-emerald-500/10 border-emerald-500/40',
  neutral: 'bg-slate-500/10 border-slate-500/40',
  caution: 'bg-amber-500/10 border-amber-500/40',
  danger: 'bg-red-500/10 border-red-500/40',
};

const ZONE_DOT: Record<SentimentIndicator['zone'], string> = {
  healthy: 'bg-emerald-400',
  neutral: 'bg-slate-400',
  caution: 'bg-amber-400',
  danger: 'bg-red-400',
};

interface Props { indicator: SentimentIndicator; }

export const SentimentCard = ({ indicator }: Props) => {
  const change = indicator.change5d;
  const changeStr = `${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}`;
  return (
    <div className={`rounded-lg border p-4 ${ZONE_BG[indicator.zone]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-slate-300">{indicator.label}</span>
          <span
            title={INDICATOR_DESCRIPTIONS[indicator.key]}
            className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-500 text-[10px] font-semibold text-slate-400 hover:border-slate-300 hover:text-slate-200"
            aria-label={`${indicator.label} 說明`}
          >
            i
          </span>
        </div>
        <span className={`h-2 w-2 rounded-full ${ZONE_DOT[indicator.zone]}`} />
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-slate-100">
          {indicator.value}
          <span className="ml-0.5 text-sm text-slate-400">{indicator.unit}</span>
        </span>
        <span className="text-xs text-slate-400">{changeStr} (5D)</span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded bg-slate-800">
        <div className="h-full rounded bg-slate-400" style={{ width: `${indicator.percentile}%` }} />
      </div>
      <div className="mt-1 text-xs text-slate-500">歷史百分位 {indicator.percentile}</div>
      <div className="mt-2 text-xs text-slate-300">{indicator.explanation}</div>
      {indicator.landmarks.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
          {indicator.landmarks.map((lm) => (
            <li key={`${lm.event}-${lm.date}`}>• {lm.event} {lm.value}{indicator.unit}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
