"use client";

import { useState } from "react";

export type TrendDay = { label: string; full: string; in: number; out: number };

const W = 720, H = 240, PAD = { top: 12, right: 8, bottom: 28, left: 36 };
const BAR = 14, GAP = 2;

// ปัดสเกลแกน Y เป็นเลขกลม ๆ (1, 2, 5 × 10^n)
function niceStep(max: number) {
  const raw = Math.max(1, max) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
}

// แท่งมุมบนโค้ง 4px ฐานเหลี่ยม
function barPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return "";
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function TrendChart({ days }: { days: TrendDay[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const step = niceStep(Math.max(...days.map((d) => Math.max(d.in, d.out))));
  const top = step * 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step);
  const plotW = W - PAD.left - PAD.right, plotH = H - PAD.top - PAD.bottom;
  const band = plotW / days.length;
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const h = hover === null ? null : days[hover];

  return (
    <div className="trend">
      <div className="trend-legend" aria-hidden="true">
        <span><i style={{ background: "var(--series-in)" }} />รับเข้า</span>
        <span><i style={{ background: "var(--series-out)" }} />เบิกออก</span>
      </div>
      <div className="trend-plot" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="จำนวนรายการรับเข้าและเบิกออกรายวัน 14 วันล่าสุด">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line-2)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="trend-tick">{t}</text>
            </g>
          ))}
          {days.map((d, i) => {
            const cx = PAD.left + band * i + band / 2;
            return (
              <g key={d.full}>
                {hover === i && <rect x={cx - band / 2} y={PAD.top} width={band} height={plotH} fill="var(--soft)" />}
                <path d={barPath(cx - BAR - GAP / 2, y(d.in), BAR, PAD.top + plotH - y(d.in))} fill="var(--series-in)" />
                <path d={barPath(cx + GAP / 2, y(d.out), BAR, PAD.top + plotH - y(d.out))} fill="var(--series-out)" />
                {(i % 2 === days.length % 2 || days.length <= 7) && (
                  <text x={cx} y={H - 8} textAnchor="middle" className="trend-tick">{d.label}</text>
                )}
                <rect
                  x={cx - band / 2} y={PAD.top} width={band} height={plotH} fill="transparent"
                  tabIndex={0} aria-label={`${d.full}: รับเข้า ${d.in} เบิกออก ${d.out}`}
                  onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                />
              </g>
            );
          })}
          <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--line)" strokeWidth={1} />
        </svg>
        {h && hover !== null && (
          <div
            className="trend-tip"
            style={{ left: `${((PAD.left + band * hover + band / 2) / W) * 100}%`, top: `${(y(Math.max(h.in, h.out)) / H) * 100}%` }}
          >
            <b>{h.full}</b>
            <span><i style={{ background: "var(--series-in)" }} />รับเข้า {h.in} รายการ</span>
            <span><i style={{ background: "var(--series-out)" }} />เบิกออก {h.out} รายการ</span>
          </div>
        )}
      </div>
      <details className="trend-table">
        <summary>ดูเป็นตาราง</summary>
        <table className="table">
          <thead><tr><th>วันที่</th><th className="num">รับเข้า</th><th className="num">เบิกออก</th></tr></thead>
          <tbody>
            {days.map((d) => <tr key={d.full}><td>{d.full}</td><td className="num">{d.in}</td><td className="num">{d.out}</td></tr>)}
          </tbody>
        </table>
      </details>
    </div>
  );
}
