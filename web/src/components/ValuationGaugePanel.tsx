import type { ReactNode } from 'react';
import type { ValuationGauge, ValuationVerdict } from '@fd/shared';
import { useValuationGauge } from '../hooks/useValuationGauge';
import { SectionCard } from './SectionCard';
import { InfoTooltip } from './InfoTooltip';

const METHODOLOGY = (
  <div className="space-y-2">
    <div className="font-semibold text-slate-900">如何計算？</div>
    <div>
      四個獨立估值方法各算一個合理價區間，依「可信度」加權聚合成綜合區間，把現價對照到區間落點判斷
      <span className="font-mono">便宜 / 合理偏低 / 合理偏高 / 昂貴</span>。
    </div>
    <div className="space-y-1 pt-1">
      <div>
        <span className="font-semibold">ROE 法</span>：BPS × (1+ROE)<sup>5~10</sup>，ROE 取近 5 年 p25~p75。
      </div>
      <div>
        <span className="font-semibold">EPS 法</span>：EPS × PE 區間（優先用自身 5 年 p25~p75，否則同業 ±20%）。
      </div>
      <div>
        <span className="font-semibold">股利法</span>：現金股利 ÷ 殖利率區間（市場常見 3~6%）。
      </div>
      <div>
        <span className="font-semibold">淨值法</span>：BPS × PB 區間。
      </div>
    </div>
    <div className="pt-1 text-slate-500">
      可信度由各方法資料的穩定性 + 分歧度推算。綜合可信度 &lt;60% 表示各方法看法不一致，需審慎參考。
    </div>
  </div>
);

const METHOD_HELP: Record<string, ReactNode> = {
  ROE: (
    <div className="space-y-2">
      <div className="font-semibold">ROE 法（複利成長）</div>
      <div>
        <span className="font-mono">合理價 = BPS × (1 + ROE)<sup>N</sup></span>
      </div>
      <div>
        BPS 從最新財報的股東權益 / 流通股數推得；ROE 取近 5 年的第 25 至 75 百分位作為合理區間；N 取 5（保守）到 10（樂觀）年。
      </div>
      <div className="text-slate-500">
        可信度＝ 1 − ROE 的變異係數（CV）。ROE 越穩定可信度越高，適合用在獲利穩定的成熟公司。
      </div>
    </div>
  ),
  EPS: (
    <div className="space-y-2">
      <div className="font-semibold">EPS 法（本益比）</div>
      <div>
        <span className="font-mono">合理價 = TTM EPS × PE 區間</span>
      </div>
      <div>
        近四季 EPS 加總，乘上「自身過去 5 年 PE 的 p25~p75」；若樣本不足則回退到「同業平均 PE ±20%」。
      </div>
      <div className="text-slate-500">
        可信度＝ EPS 年增率穩定度 × 0.7 + 同業樣本數 × 0.3。EPS 波動大或同業樣本少時可信度會降低。
      </div>
    </div>
  ),
  股利: (
    <div className="space-y-2">
      <div className="font-semibold">股利法（殖利率還原）</div>
      <div>
        <span className="font-mono">合理價 = 現金股利 ÷ 殖利率區間</span>
      </div>
      <div>
        以市場常見殖利率 3%~6% 作為合理區間反推合理價。意義：「以領股利的角度看，你願意付多少錢？」
      </div>
      <div className="text-slate-500">
        對成長股不適用：殖利率低於 2% 時這個方法會說「昂貴」，是 feature 不是 bug，
        綜合評估會自動降低它的權重。
      </div>
    </div>
  ),
  淨值: (
    <div className="space-y-2">
      <div className="font-semibold">淨值法（PB 比）</div>
      <div>
        <span className="font-mono">合理價 = BPS × PB 區間</span>
      </div>
      <div>
        當前 PB 上下 30% 作為合理區間。適合用在資產密集、淨值與股價連動高的產業（金融、營建）。
      </div>
      <div className="text-slate-500">
        可信度＝ BPS 成長穩定度。對成長股（PB 遠高於同業歷史均值）參考價值較低。
      </div>
    </div>
  ),
};

const VERDICT_COLOR: Record<ValuationVerdict, string> = {
  便宜: 'text-cyan-600 bg-cyan-50 border-cyan-300',
  合理偏低: 'text-emerald-700 bg-emerald-50 border-emerald-300',
  合理偏高: 'text-slate-600 bg-slate-100 border-slate-300',
  昂貴: 'text-orange-700 bg-orange-50 border-orange-300',
};

const fmt = (n: number): string =>
  n >= 1000 ? n.toFixed(0) : n >= 100 ? n.toFixed(1) : n.toFixed(2);

// angle: 180° = left end, 90° = top, 0° = right end
const valueToAngle = (v: number, min: number, max: number): number => {
  const t = Math.max(0, Math.min(1, (v - min) / (max - min)));
  return 180 - t * 180;
};

// polar with SVG y-down. angle in degrees: 0=right, 90=up, 180=left.
const polar = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
};

// Ring segment from startDeg (larger angle, left side) to endDeg (smaller angle, right side).
// Visually goes clockwise (left → top → right) so outer arc sweep=0, inner return sweep=1
// in SVG's flipped-y coordinate system (drawing clockwise on screen = sweep flag 0 when y is flipped).
const ringSegmentPath = (
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number,
): string => {
  const o1 = polar(cx, cy, rOuter, startDeg);
  const o2 = polar(cx, cy, rOuter, endDeg);
  const i2 = polar(cx, cy, rInner, endDeg);
  const i1 = polar(cx, cy, rInner, startDeg);
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${rOuter} ${rOuter} 0 0 1 ${o2.x} ${o2.y}`,
    `L ${i2.x} ${i2.y}`,
    `A ${rInner} ${rInner} 0 0 0 ${i1.x} ${i1.y}`,
    'Z',
  ].join(' ');
};

const Gauge = ({ gauge }: { gauge: ValuationGauge }) => {
  const allLows = gauge.methods.map((m) => m.low);
  const allHighs = gauge.methods.map((m) => m.high);
  const min = Math.min(...allLows, gauge.price);
  const max = Math.max(...allHighs, gauge.price);
  const pad = (max - min) * 0.05;
  const axisMin = min - pad;
  const axisMax = max + pad;

  const { low, high } = gauge.composite;
  const mid = (low + high) / 2;

  const aLow = valueToAngle(low, axisMin, axisMax);
  const aMid = valueToAngle(mid, axisMin, axisMax);
  const aHigh = valueToAngle(high, axisMin, axisMax);
  const aPrice = valueToAngle(gauge.price, axisMin, axisMax);

  // viewBox 360 × 210
  const cx = 180;
  const cy = 175;
  const rOuter = 145;
  const rInner = 100;

  const bands = [
    { start: 180, end: aLow, fill: '#0e7490', textFill: '#ffffff', label: '便宜' },
    { start: aLow, end: aMid, fill: '#a7f3d0', textFill: '#065f46', label: '合理偏低' },
    { start: aMid, end: aHigh, fill: '#cbd5e1', textFill: '#334155', label: '合理偏高' },
    { start: aHigh, end: 0, fill: '#c2410c', textFill: '#ffffff', label: '昂貴' },
  ];

  const pointerTip = polar(cx, cy, rOuter - 6, aPrice);
  const labelR = (rOuter + rInner) / 2;
  const labelPos = (start: number, end: number) => polar(cx, cy, labelR, (start + end) / 2);

  const anchorFor = (a: number): 'start' | 'middle' | 'end' =>
    a > 120 ? 'end' : a < 60 ? 'start' : 'middle';
  const boundary = [
    { a: aLow, v: low, anchor: anchorFor(aLow) },
    { a: aHigh, v: high, anchor: anchorFor(aHigh) },
  ];

  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: 400 }}>
      <svg viewBox="0 0 360 210" className="w-full block" aria-label="估值儀表">
        {bands.map((b) =>
          b.start - b.end < 0.5 ? null : (
            <path
              key={b.label}
              d={ringSegmentPath(cx, cy, rOuter, rInner, b.start, b.end)}
              fill={b.fill}
            />
          ),
        )}
        {bands.map((b) => {
          if (b.start - b.end < 22) return null;
          const p = labelPos(b.start, b.end);
          return (
            <text
              key={`l-${b.label}`}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="11"
              fontWeight="600"
              letterSpacing="0.5"
              fill={b.textFill}
            >
              {b.label}
            </text>
          );
        })}

        {/* axis min/max */}
        <text x={cx - rOuter} y={cy + 16} fontSize="10" fill="#94a3b8" textAnchor="middle">
          {fmt(axisMin)}
        </text>
        <text x={cx + rOuter} y={cy + 16} fontSize="10" fill="#94a3b8" textAnchor="middle">
          {fmt(axisMax)}
        </text>

        {/* boundary tick lines + labels */}
        {boundary.map(({ a, v, anchor }) => {
          const t1 = polar(cx, cy, rOuter, a);
          const t2 = polar(cx, cy, rOuter + 4, a);
          const tl = polar(cx, cy, rOuter + 14, a);
          return (
            <g key={`b-${v}`}>
              <line
                x1={t1.x}
                y1={t1.y}
                x2={t2.x}
                y2={t2.y}
                stroke="#64748b"
                strokeWidth="1"
              />
              <text
                x={tl.x}
                y={tl.y}
                fontSize="10"
                fill="#64748b"
                textAnchor={anchor}
                dominantBaseline="middle"
              >
                {fmt(v)}
              </text>
            </g>
          );
        })}

        {/* needle */}
        <line
          x1={cx}
          y1={cy}
          x2={pointerTip.x}
          y2={pointerTip.y}
          stroke="#0f172a"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="5" fill="#0f172a" />
        <circle cx={cx} cy={cy} r="2" fill="#ffffff" />

        {/* verdict label in the hollow under the ring */}
        <text
          x={cx}
          y={cy - 22}
          fontSize="13"
          fontWeight="700"
          fill="#0f172a"
          textAnchor="middle"
        >
          {gauge.composite.verdict}
        </text>
      </svg>
    </div>
  );
};

export const ValuationGaugePanel = ({ symbol }: { symbol: string }) => {
  const { data, isLoading, error } = useValuationGauge(symbol);

  return (
    <SectionCard
      id="valuation-gauge"
      title={
        <span className="inline-flex items-center gap-2">
          估值評價
          <InfoTooltip width={360}>{METHODOLOGY}</InfoTooltip>
        </span>
      }
      subtitle="四種估值方法的綜合判讀"
      storageKey={`valuation-gauge:${symbol}`}
    >
      {isLoading && <div className="text-sm text-slate-500">載入中…</div>}
      {error && <div className="text-sm text-amber-600">估值資料不足</div>}
      {data?.data && (
        <div className="space-y-5">
          <div className="grid md:grid-cols-[minmax(0,1fr)_420px] gap-6 items-center">
            <Summary gauge={data.data} />
            <Gauge gauge={data.data} />
          </div>
          <MethodTable gauge={data.data} />
          <Disclaimer gauge={data.data} />
        </div>
      )}
    </SectionCard>
  );
};

const Summary = ({ gauge }: { gauge: ValuationGauge }) => {
  const { composite, price } = gauge;
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-xs uppercase tracking-wider text-slate-500">綜合判讀</span>
        <span
          className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${VERDICT_COLOR[composite.verdict]}`}
        >
          {composite.verdict}
        </span>
        <span className="text-xs text-slate-500">
          可信度 <span className="font-mono font-semibold text-slate-700">{(composite.confidence * 100).toFixed(0)}%</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
          <div className="text-[11px] text-slate-500">現價</div>
          <div className="font-mono text-base font-semibold text-slate-900">{fmt(price)}</div>
        </div>
        <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
          <div className="text-[11px] text-slate-500">基本面合理區間</div>
          <div className="font-mono text-base font-semibold">
            <span className="text-cyan-700">{fmt(composite.low)}</span>
            <span className="text-slate-400 mx-1">–</span>
            <span className="text-orange-700">{fmt(composite.high)}</span>
          </div>
        </div>
      </div>
      {composite.confidence < 0.6 && (
        <div className="text-xs text-amber-700 leading-relaxed">
          ＊ 各方法分歧較大，請審慎參考。
        </div>
      )}
    </div>
  );
};

const MethodTable = ({ gauge }: { gauge: ValuationGauge }) => {
  const rows = [
    {
      label: '綜合評估',
      low: gauge.composite.low,
      high: gauge.composite.high,
      verdict: gauge.composite.verdict,
      confidence: gauge.composite.confidence,
      note: null as string | null,
      bold: true,
    },
    ...gauge.methods.map((m) => ({
      label: `${m.method}法`,
      methodKey: m.method,
      low: m.low,
      high: m.high,
      verdict: m.verdict,
      confidence: m.confidence,
      note: m.note,
      bold: false,
    })),
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500 border-b border-slate-200">
            <th className="text-left py-2 font-normal">評價方法</th>
            <th className="text-left py-2 font-normal">合理區間</th>
            <th className="text-left py-2 font-normal">評價結果</th>
            <th className="text-right py-2 font-normal">可信度</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={`border-b border-slate-100 ${r.bold ? 'bg-slate-50' : ''}`}>
              <td className={`py-2 ${r.bold ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                <div className="inline-flex items-center gap-1.5">
                  <span>{r.label}</span>
                  {'methodKey' in r && METHOD_HELP[r.methodKey] && (
                    <InfoTooltip>{METHOD_HELP[r.methodKey]}</InfoTooltip>
                  )}
                </div>
                {r.note && <div className="text-[11px] text-slate-500 mt-0.5">{r.note}</div>}
              </td>
              <td className="py-2 font-mono text-slate-700">
                <span className="text-cyan-700">{fmt(r.low)}</span>
                <span className="text-slate-400 mx-1">–</span>
                <span className="text-orange-700">{fmt(r.high)}</span>
              </td>
              <td className="py-2">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs border ${VERDICT_COLOR[r.verdict]}`}
                >
                  {r.verdict}
                </span>
              </td>
              <td className="py-2 text-right font-mono text-slate-700">
                {(r.confidence * 100).toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Disclaimer = ({ gauge }: { gauge: ValuationGauge }) => {
  const dividend = gauge.methods.find((m) => m.method === '股利');
  if (!dividend) return null;
  const ratio = gauge.price / dividend.high;
  if (ratio < 2) return null;
  return (
    <div className="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
      ＊ 股利法區間 ({fmt(dividend.low)}–{fmt(dividend.high)}) 與現價落差大，因為這檔股票
      殖利率偏低、不適合用配息角度評估；綜合評估時此方法權重已自動降低。
    </div>
  );
};
