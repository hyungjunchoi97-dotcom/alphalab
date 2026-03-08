"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLang } from "@/lib/LangContext";

// ── Types ────────────────────────────────────────────────────

interface RRGPoint { week: number; rsRatio: number; rsMomentum: number }

interface SectorData {
  ticker: string;
  name: string;
  nameKr: string;
  color: string;
  market: "KR" | "US";
  trail: RRGPoint[];
  current: RRGPoint;
  quadrant: "leading" | "improving" | "lagging" | "weakening";
  chg5d: number;
}

interface SectorStockData {
  ticker: string;
  name: string;
  price: number;
  chgPct: number;
}

type Quadrant = "leading" | "improving" | "lagging" | "weakening";

const CARD = "rounded-[12px] border border-card-border bg-card-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3)]";

const Q = {
  leading: {
    en: "Leading", kr: "강세 유지",
    descEn: "RS-Ratio > 100, RS-Momentum > 100 — Relative strength advantage sustained",
    descKr: "상대강도 우위 지속 — 비중 유지",
    actionEn: "Overweight", actionKr: "Overweight",
    color: "#22c55e", bg: "rgba(16,185,129,0.08)",
    border: "border-[#1a2a1a]", bgCard: "bg-[#0a120a]",
  },
  improving: {
    en: "Improving", kr: "강세 전환",
    descEn: "RS-Ratio < 100, RS-Momentum > 100 — Relative strength recovery signal",
    descKr: "상대강도 개선 구간 — 비중 확대 검토",
    actionEn: "Upgrade", actionKr: "비중 확대",
    color: "#eab308", bg: "rgba(234,179,8,0.08)",
    border: "border-[#2a2a1a]", bgCard: "bg-[#12120a]",
  },
  weakening: {
    en: "Weakening", kr: "약세 전환",
    descEn: "RS-Ratio > 100, RS-Momentum < 100 — Relative strength peaking out",
    descKr: "상대강도 피크아웃 신호 — 비중 조정",
    actionEn: "Downgrade", actionKr: "비중 축소",
    color: "#f97316", bg: "rgba(249,115,22,0.08)",
    border: "border-[#2a1a0a]", bgCard: "bg-[#120d0a]",
  },
  lagging: {
    en: "Lagging", kr: "약세 유지",
    descEn: "RS-Ratio < 100, RS-Momentum < 100 — Relative strength deficit sustained",
    descKr: "상대강도 열위 지속 — 비중 축소",
    actionEn: "Underweight", actionKr: "Underweight",
    color: "#ef4444", bg: "rgba(239,68,68,0.08)",
    border: "border-[#2a1a1a]", bgCard: "bg-[#120a0a]",
  },
};

const QUADRANT_ORDER: Quadrant[] = ["leading", "improving", "weakening", "lagging"];

const QUADRANT_SUMMARY: Record<Quadrant, { kr: string; en: string }> = {
  leading: { kr: "강세 유지 — 비중 확대 고려", en: "Strength sustained — consider overweight" },
  improving: { kr: "강세 전환 중 — 진입 모니터링", en: "Turning bullish — monitor entry" },
  weakening: { kr: "약세 전환 중 — 비중 축소 고려", en: "Turning bearish — consider trimming" },
  lagging: { kr: "약세 유지 — 관망", en: "Weakness sustained — stay cautious" },
};

// ── Sector → Representative stocks mapping (KR) ──────────────

const KR_SECTOR_STOCKS: Record<string, string[]> = {
  "091160": ["005930", "000660", "042700", "240810", "056490"], // 반도체
  "244580": ["207940", "068270", "128940", "326030", "091990"], // 바이오
  "266370": ["051910", "096770", "009830", "010950", "011170"], // 화학
  "139250": ["035420", "035720", "259960", "047050", "034220"], // IT
  "140710": ["011200", "003490", "028670", "086280", "000120"], // 운송
  "227560": ["005380", "012330", "000270", "021240", "009150"], // 소비재
  "117700": ["000720", "006360", "047040", "034300", "028260"], // 건설
  "091170": ["105560", "055550", "086790", "316140", "138930"], // 은행
  "091180": ["005380", "012330", "000270", "064960", "204320"], // 자동차
  "117680": ["005490", "004020", "001230", "058430", "004990"], // 철강
};

// ── Sparkline SVG component ──────────────────────────────────

function MiniSparkline({ trail, color }: { trail: RRGPoint[]; color: string }) {
  const pts = trail.slice(-5);
  if (pts.length < 2) return null;
  const moms = pts.map(p => p.rsMomentum);
  const min = Math.min(...moms);
  const max = Math.max(...moms);
  const range = max - min || 1;
  const w = 36, h = 14;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      {moms.map((v, i) => {
        const barH = Math.max(2, ((v - min) / range) * (h - 2));
        const barW = (w - (moms.length - 1) * 1) / moms.length;
        return (
          <rect
            key={i}
            x={i * (barW + 1)}
            y={h - barH}
            width={barW}
            height={barH}
            fill={color}
            opacity={0.3 + (i / moms.length) * 0.7}
            rx={1}
          />
        );
      })}
    </svg>
  );
}

// ── Auto summary generator ──────────────────────────────────

function generateSummary(sectors: SectorData[], lang: "en" | "kr"): string {
  const grouped: Record<Quadrant, SectorData[]> = { leading: [], improving: [], lagging: [], weakening: [] };
  for (const s of sectors) grouped[s.quadrant].push(s);

  const name = (s: SectorData) => lang === "kr" ? s.nameKr : s.name;

  const parts: string[] = [];

  if (grouped.leading.length > 0) {
    const names = grouped.leading.slice(0, 3).map(name).join(" / ");
    parts.push(`OVERWEIGHT  ${names}`);
  }
  if (grouped.lagging.length > 0) {
    const names = grouped.lagging.slice(0, 3).map(name).join(" / ");
    parts.push(`UNDERWEIGHT  ${names}`);
  }
  if (grouped.improving.length > 0) {
    const names = grouped.improving.slice(0, 2).map(name).join(" / ");
    parts.push(`WATCH  ${names}`);
  }

  if (parts.length === 0) return lang === "kr" ? "Analyzing..." : "Analyzing...";
  return parts.join("   |   ");
}

// ── Tooltip interpretation ──────────────────────────────────

function getInterpretation(s: SectorData, lang: "en" | "kr"): string {
  const strong = s.current.rsRatio >= 100;
  const rising = s.current.rsMomentum >= 100;

  if (lang === "kr") {
    if (strong && rising) return "벤치마크 대비 상대강도 우위 + 모멘텀 상승. 비중 유지 유효.";
    if (!strong && rising) return "상대강도 열위이나 개선 추세. 비중 확대 검토 가능.";
    if (strong && !rising) return "상대강도 우위이나 모멘텀 둔화. 비중 조정 검토.";
    return "상대강도 열위 + 모멘텀 하락. 비중 축소 권장.";
  }
  if (strong && rising) return "Above-benchmark RS with rising momentum. Maintain overweight.";
  if (!strong && rising) return "Below-benchmark but improving. Consider upgrading allocation.";
  if (strong && !rising) return "Above-benchmark but momentum fading. Consider trimming.";
  return "Below-benchmark with declining momentum. Underweight recommended.";
}

// ── Catmull-Rom spline helper ─────────────────────────────────

function catmullRomPath(points: { x: number; y: number }[], tension = 0.5): string {
  if (points.length < 2) return "";
  if (points.length === 2) return `M${points[0].x},${points[0].y}L${points[1].x},${points[1].y}`;

  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];

    const cp1x = p1.x + (p2.x - p0.x) * tension / 3;
    const cp1y = p1.y + (p2.y - p0.y) * tension / 3;
    const cp2x = p2.x - (p3.x - p1.x) * tension / 3;
    const cp2y = p2.y - (p3.y - p1.y) * tension / 3;

    d += `C${cp1x},${cp1y},${cp2x},${cp2y},${p2.x},${p2.y}`;
  }
  return d;
}

// ── SVG RRG Scatter Plot (Professional) ──────────────────────

function RRGScatterPlot({
  sectors,
  highlighted,
  onHover,
  onClick,
  trailWeeks,
  lang,
}: {
  sectors: SectorData[];
  highlighted: string | null;
  onHover: (ticker: string | null) => void;
  onClick: (ticker: string) => void;
  trailWeeks: number;
  lang: "en" | "kr";
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; sector: SectorData } | null>(null);

  const W = 760, H = 560;
  const PAD = { top: 50, right: 30, bottom: 50, left: 55 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const TRAIL_DISPLAY = 8;
  const BASE_R = 10;

  // Quadrant background colors
  const QBG = {
    leading: "#0d2818",
    improving: "#0d1829",
    weakening: "#1a1a0d",
    lagging: "#1a0d0d",
  };

  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    let xLo = 99, xHi = 101, yLo = 99, yHi = 101;
    for (const s of sectors) {
      const pts = s.trail.slice(-trailWeeks);
      for (const p of pts) {
        xLo = Math.min(xLo, p.rsRatio);
        xHi = Math.max(xHi, p.rsRatio);
        yLo = Math.min(yLo, p.rsMomentum);
        yHi = Math.max(yHi, p.rsMomentum);
      }
    }
    const xPad = Math.max((xHi - xLo) * 0.25, 0.8);
    const yPad = Math.max((yHi - yLo) * 0.25, 0.8);
    return {
      xMin: Math.floor((xLo - xPad) * 10) / 10,
      xMax: Math.ceil((xHi + xPad) * 10) / 10,
      yMin: Math.floor((yLo - yPad) * 10) / 10,
      yMax: Math.ceil((yHi + yPad) * 10) / 10,
    };
  }, [sectors, trailWeeks]);

  const scaleX = (v: number) => PAD.left + ((v - xMin) / (xMax - xMin)) * plotW;
  const scaleY = (v: number) => PAD.top + ((yMax - v) / (yMax - yMin)) * plotH;

  const cx100 = scaleX(100);
  const cy100 = scaleY(100);

  // Collision detection for overlapping bubbles
  const bubblePositions = useMemo(() => {
    const positions = sectors.map(s => ({
      ticker: s.ticker,
      x: scaleX(s.current.rsRatio),
      y: scaleY(s.current.rsMomentum),
      ox: 0,
      oy: 0,
    }));
    for (let iter = 0; iter < 6; iter++) {
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const a = positions[i], b = positions[j];
          const dx = (a.x + a.ox) - (b.x + b.ox);
          const dy = (a.y + a.oy) - (b.y + b.oy);
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = BASE_R * 2.4;
          if (dist < minDist && dist > 0) {
            const push = (minDist - dist) / 2;
            const nx = dx / dist, ny = dy / dist;
            a.ox += nx * push;
            a.oy += ny * push;
            b.ox -= nx * push;
            b.oy -= ny * push;
          }
        }
      }
    }
    return new Map(positions.map(p => [p.ticker, { ox: p.ox, oy: p.oy }]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectors, xMin, xMax, yMin, yMax]);

  // Build legend items
  const legendItems = sectors.map(s => ({
    ticker: s.ticker,
    label: lang === "kr" ? s.nameKr : s.name,
    color: s.color,
  }));

  return (
    <div className="relative">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ background: "#0a0f0a" }}>
        {/* Quadrant backgrounds */}
        <rect x={cx100} y={PAD.top} width={PAD.left + plotW - cx100 + PAD.right} height={cy100 - PAD.top} fill={QBG.leading} />
        <rect x={0} y={PAD.top} width={cx100} height={cy100 - PAD.top} fill={QBG.improving} />
        <rect x={0} y={cy100} width={cx100} height={PAD.top + plotH - cy100 + PAD.bottom} fill={QBG.lagging} />
        <rect x={cx100} y={cy100} width={PAD.left + plotW - cx100 + PAD.right} height={PAD.top + plotH - cy100 + PAD.bottom} fill={QBG.weakening} />

        {/* Subtle grid lines */}
        {[...Array(7)].map((_, i) => {
          const xv = xMin + ((xMax - xMin) * i) / 6;
          const yv = yMin + ((yMax - yMin) * i) / 6;
          return (
            <g key={`grid-${i}`}>
              <line x1={scaleX(xv)} y1={PAD.top} x2={scaleX(xv)} y2={PAD.top + plotH} stroke="rgba(255,255,255,0.08)" />
              <line x1={PAD.left} y1={scaleY(yv)} x2={PAD.left + plotW} y2={scaleY(yv)} stroke="rgba(255,255,255,0.08)" />
            </g>
          );
        })}

        {/* Axis tick labels */}
        {[...Array(7)].map((_, i) => {
          const xv = xMin + ((xMax - xMin) * i) / 6;
          const yv = yMin + ((yMax - yMin) * i) / 6;
          return (
            <g key={`tick-${i}`}>
              <text x={scaleX(xv)} y={PAD.top + plotH + 18} textAnchor="middle" fill="#666" fontSize={9} fontFamily="ui-monospace, monospace">{xv.toFixed(1)}</text>
              <text x={PAD.left - 10} y={scaleY(yv) + 3} textAnchor="end" fill="#666" fontSize={9} fontFamily="ui-monospace, monospace">{yv.toFixed(1)}</text>
            </g>
          );
        })}

        {/* Center divider lines (100,100) — dashed white */}
        <line x1={cx100} y1={PAD.top} x2={cx100} y2={PAD.top + plotH} stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeDasharray="6 4" />
        <line x1={PAD.left} y1={cy100} x2={PAD.left + plotW} y2={cy100} stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeDasharray="6 4" />

        {/* "100" labels on dividers */}
        <text x={cx100} y={PAD.top - 6} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={9} fontFamily="ui-monospace, monospace">100</text>
        <text x={PAD.left - 10} y={cy100 + 3} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize={9} fontFamily="ui-monospace, monospace">100</text>

        {/* Quadrant labels */}
        <text x={PAD.left + plotW - 8} y={PAD.top + 18} textAnchor="end" fill="#22c55e" fontSize={11} fontWeight="600" opacity={0.6} fontFamily="ui-sans-serif, system-ui, sans-serif">Leading</text>
        <text x={PAD.left + 8} y={PAD.top + 18} textAnchor="start" fill="#60a5fa" fontSize={11} fontWeight="600" opacity={0.6} fontFamily="ui-sans-serif, system-ui, sans-serif">Improving</text>
        <text x={PAD.left + 8} y={PAD.top + plotH - 8} textAnchor="start" fill="#ef4444" fontSize={11} fontWeight="600" opacity={0.6} fontFamily="ui-sans-serif, system-ui, sans-serif">Lagging</text>
        <text x={PAD.left + plotW - 8} y={PAD.top + plotH - 8} textAnchor="end" fill="#f97316" fontSize={11} fontWeight="600" opacity={0.6} fontFamily="ui-sans-serif, system-ui, sans-serif">Weakening</text>

        {/* X-axis label */}
        <text x={PAD.left + plotW / 2} y={H - 6} textAnchor="middle" fill="#888" fontSize={11} fontWeight="500" fontFamily="ui-sans-serif, system-ui, sans-serif">
          Relative Strength (%)
        </text>
        {/* Y-axis label */}
        <text x={14} y={PAD.top + plotH / 2} textAnchor="middle" fill="#888" fontSize={11} fontWeight="500" fontFamily="ui-sans-serif, system-ui, sans-serif" transform={`rotate(-90, 14, ${PAD.top + plotH / 2})`}>
          RS Momentum
        </text>

        {/* Trail paths — smooth Catmull-Rom splines with tapering segments */}
        {sectors.map((s) => {
          const pts = s.trail.slice(-TRAIL_DISPLAY);
          const isHighlighted = highlighted === s.ticker;
          const dimmed = highlighted !== null && !isHighlighted;
          if (pts.length < 2 || dimmed) return null;

          // Build tapering trail segments (thicker toward present)
          const mapped = pts.map(p => ({ x: scaleX(p.rsRatio), y: scaleY(p.rsMomentum) }));
          const segments: React.ReactNode[] = [];
          for (let i = 0; i < mapped.length - 1; i++) {
            const t = i / (mapped.length - 1);
            const sw = 0.5 + t * 2; // 0.5 → 2.5
            const op = 0.3 + t * 0.5; // 0.3 → 0.8
            segments.push(
              <line
                key={`seg-${s.ticker}-${i}`}
                x1={mapped[i].x} y1={mapped[i].y}
                x2={mapped[i + 1].x} y2={mapped[i + 1].y}
                stroke={s.color}
                strokeWidth={sw}
                strokeOpacity={op}
                strokeLinecap="round"
              />
            );
          }

          // Smooth spline overlay
          const splinePath = catmullRomPath(mapped, 0.4);

          return (
            <g key={`trail-${s.ticker}`}>
              {segments}
              <path
                d={splinePath}
                fill="none"
                stroke={s.color}
                strokeWidth={1.2}
                strokeOpacity={isHighlighted ? 0.9 : 0.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Trail dots */}
              {mapped.slice(0, -1).map((p, i) => {
                const t = i / mapped.length;
                return (
                  <circle
                    key={`dot-${s.ticker}-${i}`}
                    cx={p.x} cy={p.y}
                    r={1.5 + t * 1.5}
                    fill={s.color}
                    opacity={0.3 + t * 0.4}
                  />
                );
              })}
            </g>
          );
        })}

        {/* Bubbles */}
        {sectors.map((s) => {
          const isHighlighted = highlighted === s.ticker;
          const dimmed = highlighted !== null && !isHighlighted;
          const opacity = dimmed ? 0.15 : 1;
          const r = isHighlighted ? 14 : BASE_R;
          const offset = bubblePositions.get(s.ticker) || { ox: 0, oy: 0 };
          const bx = scaleX(s.current.rsRatio) + offset.ox;
          const by = scaleY(s.current.rsMomentum) + offset.oy;

          return (
            <g key={`bubble-${s.ticker}`} opacity={opacity} style={{ transition: "opacity 0.2s" }}>
              {/* Glow on hover */}
              {isHighlighted && (
                <circle cx={bx} cy={by} r={r + 4} fill={s.color} fillOpacity={0.15} />
              )}
              {/* Solid dot */}
              <circle
                cx={bx} cy={by} r={r}
                fill={s.color} fillOpacity={isHighlighted ? 0.9 : 0.75}
                className="cursor-pointer"
                onMouseEnter={(e) => {
                  onHover(s.ticker);
                  const rect = svgRef.current?.getBoundingClientRect();
                  if (rect) setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, sector: s });
                }}
                onMouseMove={(e) => {
                  const rect = svgRef.current?.getBoundingClientRect();
                  if (rect) setTooltip(prev => prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
                }}
                onMouseLeave={() => { onHover(null); setTooltip(null); }}
                onClick={() => onClick(s.ticker)}
              />
            </g>
          );
        })}

        {/* Top legend */}
        {(() => {
          const legendW = 12;
          const itemGap = 6;
          const items = legendItems;
          const totalW = items.reduce((acc, item) => acc + legendW + 4 + item.label.length * 5.5 + itemGap, 0);
          let curX = (W - totalW) / 2;
          const legendY = 14;
          return items.map(item => {
            const x = curX;
            curX += legendW + 4 + item.label.length * 5.5 + itemGap;
            return (
              <g key={`legend-${item.ticker}`}
                className="cursor-pointer"
                onMouseEnter={() => onHover(item.ticker)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onClick(item.ticker)}
                opacity={highlighted && highlighted !== item.ticker ? 0.3 : 1}
              >
                <circle cx={x + 4} cy={legendY} r={3.5} fill={item.color} />
                <text x={x + 12} y={legendY + 3} fill="#ccc" fontSize={9} fontWeight="500" fontFamily="ui-sans-serif, system-ui, sans-serif">
                  {item.label}
                </text>
              </g>
            );
          });
        })()}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 rounded-lg border border-[#333] bg-[#111] px-4 py-3 shadow-2xl"
          style={{ left: Math.min(tooltip.x + 16, 460), top: Math.max(tooltip.y - 24, 0), minWidth: 240 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: tooltip.sector.color }} />
            <span className="text-[13px] font-bold text-white">
              {lang === "kr" ? tooltip.sector.nameKr : tooltip.sector.name}
            </span>
            <span className="ml-auto font-mono text-[11px] font-semibold" style={{ color: Q[tooltip.sector.quadrant].color }}>
              {Q[tooltip.sector.quadrant].en}
            </span>
          </div>
          <div className="border-t border-[#2a2a2a] pt-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#888]">RS-Ratio</span>
              <span className="font-mono font-semibold text-white">{tooltip.sector.current.rsRatio.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#888]">RS-Momentum</span>
              <span className="font-mono font-semibold text-white">{tooltip.sector.current.rsMomentum.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#888]">{lang === "kr" ? "주간 수익률" : "Weekly Chg"}</span>
              <span className={`font-mono font-bold ${tooltip.sector.chg5d >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}`}>
                {tooltip.sector.chg5d >= 0 ? "+" : ""}{tooltip.sector.chg5d.toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="mt-2 border-t border-[#2a2a2a] pt-2">
            <p className="text-[10px] text-[#999] leading-relaxed">{getInterpretation(tooltip.sector, lang)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Methodology Panel ────────────────────────────────────────

function RRGInfoPanel({ lang }: { lang: "en" | "kr" }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded border border-[#1a1a1a] bg-[#0a0a0a]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-xs font-semibold tracking-wider text-[#888]">
          {lang === "kr" ? "Relative Rotation Graph (RRG) — 방법론" : "Relative Rotation Graph (RRG) — Methodology"}
        </span>
        <span className="text-[10px] text-[#555] font-mono">
          {open ? "[-]" : "[+]"}
        </span>
      </button>

      {open && (
        <div className="border-t border-[#1a1a1a] px-4 pb-4 pt-3 space-y-5">
          <div>
            <h4 className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#555] mb-2">METHODOLOGY</h4>
            <p className="text-[11px] text-[#999] leading-relaxed">
              {lang === "kr"
                ? "RRG는 각 섹터의 상대강도(RS-Ratio)와 그 변화율(RS-Momentum)을 2차원 평면에 시각화한 지표입니다. 단순 수익률이 아닌 벤치마크 대비 상대적 포지셔닝과 방향성을 동시에 파악할 수 있어, 섹터 로테이션 전략 수립 시 활용됩니다."
                : "RRG visualizes each sector's relative strength (RS-Ratio) and its rate of change (RS-Momentum) on a two-dimensional plane. Unlike simple returns, it captures both relative positioning versus benchmark and directional momentum, making it a standard tool for sector rotation strategy."}
            </p>
          </div>
          <div>
            <h4 className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#555] mb-2">HOW TO READ</h4>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex gap-3 py-1.5 border-b border-[#151515]">
                <span className="shrink-0 font-mono text-[#555] w-24">X-Axis</span>
                <span className="text-[#999]"><span className="text-[#ccc] font-medium">RS-Ratio</span> — {lang === "kr" ? "벤치마크 대비 상대강도. 100 기준, 초과 시 시장 대비 강세." : "Relative strength vs benchmark. 100 = neutral, above = outperforming."}</span>
              </div>
              <div className="flex gap-3 py-1.5 border-b border-[#151515]">
                <span className="shrink-0 font-mono text-[#555] w-24">Y-Axis</span>
                <span className="text-[#999]"><span className="text-[#ccc] font-medium">RS-Momentum</span> — {lang === "kr" ? "상대강도의 변화율. 100 초과 시 강도 개선 중." : "Rate of change in RS. Above 100 = strength improving."}</span>
              </div>
              <div className="flex gap-3 py-1.5">
                <span className="shrink-0 font-mono text-[#555] w-24">Trail</span>
                <span className="text-[#999]">{lang === "kr" ? "최근 4주 이동 경로. 시계 방향 순환이 일반적 패턴." : "Last 4 weeks path. Clockwise rotation is the typical pattern."}</span>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#555] mb-2">QUADRANT DEFINITIONS</h4>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[#222]">
                  <th className="text-left py-1.5 font-mono text-[#555] font-medium w-28">{lang === "kr" ? "구간" : "Quadrant"}</th>
                  <th className="text-left py-1.5 font-mono text-[#555] font-medium w-28">RS-Ratio</th>
                  <th className="text-left py-1.5 font-mono text-[#555] font-medium w-28">RS-Mom</th>
                  <th className="text-left py-1.5 font-mono text-[#555] font-medium">{lang === "kr" ? "포지셔닝" : "Positioning"}</th>
                </tr>
              </thead>
              <tbody>
                {QUADRANT_ORDER.map(q => (
                  <tr key={q} className="border-b border-[#151515]">
                    <td className="py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-sm" style={{ background: Q[q].color }} />
                        <span className="font-medium" style={{ color: Q[q].color }}>{Q[q].en} / {Q[q].kr}</span>
                      </div>
                    </td>
                    <td className="py-1.5 font-mono text-[#888]">{q === "leading" || q === "weakening" ? "> 100" : "< 100"}</td>
                    <td className="py-1.5 font-mono text-[#888]">{q === "leading" || q === "improving" ? "> 100" : "< 100"}</td>
                    <td className="py-1.5 text-[#888]">{lang === "kr" ? Q[q].descKr : Q[q].descEn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sector Detail Panel ──────────────────────────────────────

function SectorDetailPanel({
  sector,
  lang,
  trailWeeks,
}: {
  sector: SectorData;
  lang: "en" | "kr";
  trailWeeks: number;
}) {
  const [stocks, setStocks] = useState<SectorStockData[]>([]);
  const [stocksLoading, setStocksLoading] = useState(false);

  // Fetch representative stocks data
  useEffect(() => {
    if (sector.market !== "KR") {
      setStocks([]);
      return;
    }
    const tickers = KR_SECTOR_STOCKS[sector.ticker];
    if (!tickers || tickers.length === 0) {
      setStocks([]);
      return;
    }

    setStocksLoading(true);
    const symbols = tickers.map(t => `${t}.KS`);

    Promise.all(
      symbols.map(sym =>
        fetch(`/api/prices?symbol=${sym}`)
          .then(r => r.json())
          .then(json => {
            if (json.ok && json.data) {
              return {
                ticker: sym.replace(".KS", ""),
                name: json.data.name || sym,
                price: json.data.price || 0,
                chgPct: json.data.chgPct || 0,
              } as SectorStockData;
            }
            return null;
          })
          .catch(() => null)
      )
    ).then(results => {
      setStocks(results.filter((r): r is SectorStockData => r !== null));
      setStocksLoading(false);
    });
  }, [sector.ticker, sector.market]);

  const isImproving = sector.quadrant === "improving";

  return (
    <div className="rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] p-5 space-y-4">
      {/* A) Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ background: sector.color }} />
        <h3 className="text-base font-bold text-[#e0e0e0]">
          {lang === "kr" ? sector.nameKr : sector.name}
        </h3>
        <span className="font-mono text-xs font-bold uppercase px-2 py-0.5 rounded" style={{ color: Q[sector.quadrant].color, background: `${Q[sector.quadrant].color}15` }}>
          {Q[sector.quadrant].en}
        </span>
        <span className={`font-mono text-sm font-semibold ${sector.chg5d >= 0 ? "text-gain" : "text-loss"}`}>
          {sector.chg5d >= 0 ? "+" : ""}{sector.chg5d.toFixed(1)}%
        </span>
      </div>

      {/* B) Improving insight box */}
      {isImproving && (
        <div className="rounded-lg border border-blue-400/40 bg-blue-950/50 px-4 py-3">
          <p className="text-[12px] font-medium text-blue-300">
            {lang === "kr"
              ? "Lagging → Improving 전환 감지. 모멘텀 상승 초기 구간. 선제 진입 고려."
              : "Lagging → Improving transition detected. Early momentum recovery. Consider early entry."}
          </p>
        </div>
      )}

      {/* RS metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded border border-[#1a1a1a] px-3 py-2">
          <p className="text-[9px] uppercase tracking-wider text-[#555] font-mono">RS-Ratio</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums font-mono text-[#ccc]">{sector.current.rsRatio.toFixed(2)}</p>
          <p className="text-[9px] text-[#555]">
            {sector.current.rsRatio >= 100 ? "+" : ""}{(sector.current.rsRatio - 100).toFixed(1)} vs benchmark
          </p>
        </div>
        <div className="rounded border border-[#1a1a1a] px-3 py-2">
          <p className="text-[9px] uppercase tracking-wider text-[#555] font-mono">RS-Momentum</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums font-mono text-[#ccc]">{sector.current.rsMomentum.toFixed(2)}</p>
          <p className="text-[9px] text-[#555]">
            {sector.current.rsMomentum >= 100 ? (lang === "kr" ? "모멘텀 상승" : "Momentum rising") : (lang === "kr" ? "모멘텀 하락" : "Momentum falling")}
          </p>
        </div>
      </div>

      {/* Interpretation */}
      <div className="rounded border border-[#151515] bg-[#080808] px-3 py-2">
        <p className="text-[10px] text-[#888] leading-relaxed">{getInterpretation(sector, lang)}</p>
      </div>

      {/* ETF Debug Info */}
      <div className="rounded border border-[#1a1a1a] bg-[#080808] px-4 py-3 space-y-2">
        <h4 className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#555]">
          ETF DEBUG INFO
        </h4>
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="text-[#666]">Ticker</span>
            <span className="font-mono font-medium text-[#ccc]">
              {sector.ticker}{sector.market === "KR" ? ".KS" : ""}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#666]">Market</span>
            <span className="font-mono font-medium text-[#ccc]">{sector.market}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#666]">{lang === "kr" ? "분석 기간" : "Trail Period"}</span>
            <span className="font-mono font-medium text-[#ccc]">{trailWeeks}W ({sector.trail.length} data points)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#666]">{lang === "kr" ? "5일 수익률" : "5D Return"}</span>
            <span className={`font-mono font-semibold ${sector.chg5d >= 0 ? "text-gain" : "text-loss"}`}>
              {sector.chg5d >= 0 ? "+" : ""}{sector.chg5d.toFixed(2)}%
            </span>
          </div>

          {/* RS change over selected period */}
          {(() => {
            const trailPts = sector.trail.slice(-trailWeeks);
            if (trailPts.length < 2) return null;
            const first = trailPts[0];
            const last = trailPts[trailPts.length - 1];
            const ratioDelta = last.rsRatio - first.rsRatio;
            const momDelta = last.rsMomentum - first.rsMomentum;
            return (
              <>
                <div className="border-t border-[#151515] mt-1 pt-1.5">
                  <p className="text-[9px] uppercase tracking-wider text-[#444] mb-1">
                    {trailWeeks}W RS CHANGE
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#666]">RS-Ratio {lang === "kr" ? "변화" : "Delta"}</span>
                  <span className={`font-mono font-semibold ${ratioDelta >= 0 ? "text-gain" : "text-loss"}`}>
                    {ratioDelta >= 0 ? "+" : ""}{ratioDelta.toFixed(2)}
                    <span className="text-[#555] ml-1 font-normal">({first.rsRatio.toFixed(1)} → {last.rsRatio.toFixed(1)})</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#666]">RS-Mom {lang === "kr" ? "변화" : "Delta"}</span>
                  <span className={`font-mono font-semibold ${momDelta >= 0 ? "text-gain" : "text-loss"}`}>
                    {momDelta >= 0 ? "+" : ""}{momDelta.toFixed(2)}
                    <span className="text-[#555] ml-1 font-normal">({first.rsMomentum.toFixed(1)} → {last.rsMomentum.toFixed(1)})</span>
                  </span>
                </div>
              </>
            );
          })()}

          {/* Trail data points */}
          <div className="border-t border-[#151515] mt-1 pt-1.5">
            <p className="text-[9px] uppercase tracking-wider text-[#444] mb-1">
              TRAIL DATA ({lang === "kr" ? "최근" : "Recent"} {Math.min(trailWeeks, sector.trail.length)} {lang === "kr" ? "주" : "weeks"})
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="border-b border-[#1a1a1a]">
                  <th className="text-left py-1 text-[#555] font-medium">Wk</th>
                  <th className="text-right py-1 text-[#555] font-medium">RS-Ratio</th>
                  <th className="text-right py-1 text-[#555] font-medium">RS-Mom</th>
                  <th className="text-right py-1 text-[#555] font-medium">{lang === "kr" ? "구간" : "Quad"}</th>
                </tr>
              </thead>
              <tbody>
                {sector.trail.slice(-trailWeeks).map((pt, i) => {
                  const qd = pt.rsRatio >= 100
                    ? (pt.rsMomentum >= 100 ? "L" : "W")
                    : (pt.rsMomentum >= 100 ? "I" : "G");
                  const qdColor = qd === "L" ? "#22c55e" : qd === "I" ? "#eab308" : qd === "W" ? "#f97316" : "#ef4444";
                  return (
                    <tr key={i} className="border-b border-[#111]">
                      <td className="py-0.5 text-[#666]">W{pt.week}</td>
                      <td className="py-0.5 text-right text-[#aaa]">{pt.rsRatio.toFixed(2)}</td>
                      <td className="py-0.5 text-right text-[#aaa]">{pt.rsMomentum.toFixed(2)}</td>
                      <td className="py-0.5 text-right font-bold" style={{ color: qdColor }}>{qd}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* D) Representative stocks */}
      {sector.market === "KR" && KR_SECTOR_STOCKS[sector.ticker] && (
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#555] mb-2">
            {lang === "kr" ? "대표 종목" : "REPRESENTATIVE STOCKS"}
          </h4>
          {stocksLoading ? (
            <div className="flex items-center gap-2 py-3">
              <div className="h-3 w-3 animate-spin rounded-full border border-[#333] border-t-[#888]" />
              <span className="text-[10px] text-[#555]">Loading...</span>
            </div>
          ) : stocks.length === 0 ? (
            <p className="text-[10px] text-[#333] py-2 font-mono">—</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1a1a1a]">
                  <th className="text-left py-1.5 text-[9px] uppercase tracking-wider text-[#555] font-medium">Ticker</th>
                  <th className="text-left py-1.5 text-[9px] uppercase tracking-wider text-[#555] font-medium">Name</th>
                  <th className="text-right py-1.5 text-[9px] uppercase tracking-wider text-[#555] font-medium">Price</th>
                  <th className="text-right py-1.5 text-[9px] uppercase tracking-wider text-[#555] font-medium">Chg%</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map(st => (
                  <tr key={st.ticker} className="border-b border-[#111]">
                    <td className="py-1.5 font-mono font-medium text-accent">{st.ticker}</td>
                    <td className="py-1.5 text-[#888]">{st.name}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums text-[#ccc]">{st.price.toLocaleString()}</td>
                    <td className={`py-1.5 text-right font-mono tabular-nums font-medium ${st.chgPct >= 0 ? "text-gain" : "text-loss"}`}>
                      {st.chgPct >= 0 ? "+" : ""}{st.chgPct.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main RRG Component ───────────────────────────────────────

export default function RRGChart() {
  const { lang } = useLang();
  const [market, setMarket] = useState<"KR" | "US">("KR");
  const trailWeeks = 8;
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [krData, setKrData] = useState<SectorData[]>([]);
  const [usData, setUsData] = useState<SectorData[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [animFrame, setAnimFrame] = useState(0);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [chartOpen, setChartOpen] = useState(false); // collapsed by default
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch("/api/ideas/rrg")
      .then(r => r.json())
      .then(json => {
        if (json.ok) {
          setKrData(json.kr || []);
          setUsData(json.us || []);
          if (json.asOf) setAsOf(json.asOf);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fetch AI analysis when market changes and data is available
  useEffect(() => {
    const hasData = market === "KR" ? krData.length > 0 : usData.length > 0;
    if (!hasData) return;

    const currentSectors = market === "KR" ? krData : usData;
    setAiLoading(true);
    setAiAnalysis(null);
    fetch("/api/analyze-sectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        market,
        sectors: currentSectors.map(s => ({
          name: s.name,
          nameKr: s.nameKr,
          quadrant: s.quadrant,
          rsRatio: s.current.rsRatio,
          rsMomentum: s.current.rsMomentum,
          chg5d: s.chg5d,
        })),
      }),
    })
      .then(r => r.json())
      .then(json => {
        if (json.ok && json.analysis) setAiAnalysis(json.analysis);
      })
      .catch(() => {})
      .finally(() => setAiLoading(false));
  }, [market, krData, usData]);

  const sectors = market === "KR" ? krData : usData;

  const grouped = useMemo(() => {
    const g: Record<string, SectorData[]> = { leading: [], improving: [], lagging: [], weakening: [] };
    for (const s of sectors) g[s.quadrant].push(s);
    return g;
  }, [sectors]);

  const summary = useMemo(() => generateSummary(sectors, lang), [sectors, lang]);

  const animatedSectors = useMemo(() => {
    if (!playing) return sectors;
    return sectors.map(s => ({
      ...s,
      trail: s.trail.slice(0, Math.min(animFrame + 1, s.trail.length)),
      current: s.trail[Math.min(animFrame, s.trail.length - 1)] || s.current,
    }));
  }, [sectors, playing, animFrame]);

  const togglePlay = () => {
    if (playing) {
      if (animRef.current) clearInterval(animRef.current);
      animRef.current = null;
      setPlaying(false);
      setAnimFrame(0);
      return;
    }
    setPlaying(true);
    setAnimFrame(0);
    const maxFrames = Math.max(...sectors.map(s => s.trail.length));
    let frame = 0;
    animRef.current = setInterval(() => {
      frame++;
      if (frame >= maxFrames) {
        if (animRef.current) clearInterval(animRef.current);
        animRef.current = null;
        setPlaying(false);
        setAnimFrame(0);
        return;
      }
      setAnimFrame(frame);
    }, 1200);
  };

  useEffect(() => {
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, []);

  const handleSectorClick = useCallback((ticker: string) => {
    setSelectedSector(prev => prev === ticker ? null : ticker);
    setHighlighted(prev => prev === ticker ? null : ticker);
  }, []);

  const selectedSectorData = useMemo(() => {
    if (!selectedSector) return null;
    return sectors.find(s => s.ticker === selectedSector) || null;
  }, [selectedSector, sectors]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#333] border-t-[#888]" />
        <span className="ml-3 text-xs text-[#555] font-mono">Loading RRG data...</span>
      </div>
    );
  }

  if (sectors.length === 0) {
    return <div className="py-16 text-center text-[#555] text-xs font-mono">No data available</div>;
  }

  // Build quadrant card renderer
  const renderQuadrantCard = (q: Quadrant) => {
    const qMeta = Q[q];
    const items = grouped[q];
    const isImproving = q === "improving";
    const headerBg = q === "leading" ? "bg-green-900/60" : q === "improving" ? "bg-blue-900/60" : q === "weakening" ? "bg-yellow-900/60" : "bg-red-900/60";
    const headerBorder = q === "leading" ? "border-green-500/50" : q === "improving" ? "border-blue-500/50" : q === "weakening" ? "border-yellow-500/50" : "border-red-500/50";

    return (
      <div
        key={q}
        className={`rounded-lg border overflow-hidden ${qMeta.border} ${isImproving && items.length > 0 ? "ring-1 ring-blue-400/30 animate-pulse-border" : ""}`}
        style={{ background: "#0d0d0d" }}
      >
        {/* Colored header */}
        <div className={`${headerBg} border-b ${headerBorder} px-4 py-3 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: qMeta.color }} />
            <span className="text-sm font-bold uppercase tracking-wider" style={{ color: qMeta.color }}>
              {qMeta.en}
            </span>
            <span className="text-xs text-[#888]">/ {qMeta.kr}</span>
          </div>
          <span className="text-[11px] font-mono text-[#555]">
            {items.length} {lang === "kr" ? "섹터" : "sectors"}
          </span>
        </div>

        {/* Sector rows */}
        <div className="px-1">
          {items.length === 0 ? (
            <p className="text-xs text-[#333] py-4 px-3 font-mono">—</p>
          ) : (
            items.map(s => {
              const prevPt = s.trail.length >= 2 ? s.trail[s.trail.length - 2] : null;
              let badge: "UPGRADE" | "DOWNGRADE" | null = null;
              if (prevPt) {
                const momDelta = s.current.rsMomentum - prevPt.rsMomentum;
                if (momDelta > 0.3) badge = "UPGRADE";
                else if (momDelta < -0.3) badge = "DOWNGRADE";
              }

              return (
                <div
                  key={s.ticker}
                  className={`flex items-center justify-between rounded px-3 py-2.5 cursor-pointer transition-colors ${
                    selectedSector === s.ticker ? "bg-[#1a1a1a] ring-1 ring-[#333]" : highlighted === s.ticker ? "bg-[#151515]" : "hover:bg-[#111]"
                  }`}
                  onMouseEnter={() => setHighlighted(s.ticker)}
                  onMouseLeave={() => setHighlighted(null)}
                  onClick={() => handleSectorClick(s.ticker)}
                >
                  <div className="flex items-center gap-3">
                    <MiniSparkline trail={s.trail} color={s.color} />
                    <span className="text-[14px] font-medium text-[#ddd]">
                      {lang === "kr" ? s.nameKr : s.name}
                    </span>
                    {badge && (
                      <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wider ${
                        badge === "UPGRADE" ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"
                      }`}>
                        {badge}
                      </span>
                    )}
                  </div>
                  <span className={`font-mono tabular-nums text-[13px] font-semibold ${s.chg5d >= 0 ? "text-gain" : "text-loss"}`}>
                    {s.chg5d >= 0 ? "+" : ""}{s.chg5d.toFixed(1)}%
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Summary line */}
        <div className="border-t border-[#1a1a1a] px-4 py-2">
          <p className="text-[11px] text-[#555] italic">
            {lang === "kr" ? QUADRANT_SUMMARY[q].kr : QUADRANT_SUMMARY[q].en}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* AI Sector Analysis Panel */}
      <div className="rounded border border-[#222] bg-[#0d0d0d] p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left: Analysis text (70%) */}
          <div className="lg:w-[70%]">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-1">
              SECTOR ANALYSIS
            </h3>
            <p className="text-[10px] text-[#555] mb-3 font-mono">
              AI-Generated · {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {market === "KR" ? "KR" : "US"} 8W RRG {lang === "kr" ? "기반" : "based"}
            </p>
            {aiLoading ? (
              <div className="flex items-center gap-2 py-3">
                <div className="h-3 w-3 animate-spin rounded-full border border-[#333] border-t-amber-400" />
                <span className="text-[11px] text-[#555] font-mono">Generating analysis...</span>
              </div>
            ) : aiAnalysis ? (
              <p className="text-[12px] text-[#bbb] leading-relaxed">{aiAnalysis}</p>
            ) : (
              <p className="text-[11px] text-[#444] italic">
                {lang === "kr" ? "분석 데이터를 불러오는 중입니다." : "Loading analysis data."}
              </p>
            )}
          </div>

          {/* Right: Quadrant legend (30%) */}
          <div className="lg:w-[30%] lg:border-l lg:border-[#222] lg:pl-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#555] mb-2">
              {lang === "kr" ? "RRG 4분면" : "RRG QUADRANTS"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded border border-[#1a2a1a] bg-[#0a120a] px-2.5 py-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="inline-block h-2 w-2 rounded-sm bg-[#22c55e]" />
                  <span className="text-[10px] font-semibold text-[#22c55e]">Leading</span>
                </div>
                <p className="text-[9px] text-[#666]">{lang === "kr" ? "강세 유지" : "Strength sustained"}</p>
              </div>
              <div className="rounded border border-[#2a2a1a] bg-[#12120a] px-2.5 py-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="inline-block h-2 w-2 rounded-sm bg-[#eab308]" />
                  <span className="text-[10px] font-semibold text-[#eab308]">Improving</span>
                </div>
                <p className="text-[9px] text-[#666]">{lang === "kr" ? "강세 전환" : "Turning bullish"}</p>
              </div>
              <div className="rounded border border-[#2a1a0a] bg-[#120d0a] px-2.5 py-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="inline-block h-2 w-2 rounded-sm bg-[#f97316]" />
                  <span className="text-[10px] font-semibold text-[#f97316]">Weakening</span>
                </div>
                <p className="text-[9px] text-[#666]">{lang === "kr" ? "약세 전환" : "Turning bearish"}</p>
              </div>
              <div className="rounded border border-[#2a1a1a] bg-[#120a0a] px-2.5 py-2">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="inline-block h-2 w-2 rounded-sm bg-[#ef4444]" />
                  <span className="text-[10px] font-semibold text-[#ef4444]">Lagging</span>
                </div>
                <p className="text-[9px] text-[#666]">{lang === "kr" ? "약세 유지" : "Weakness sustained"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Methodology Panel */}
      <RRGInfoPanel lang={lang} />

      {/* Summary bar */}
      <div className="rounded border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-2">
        <p className="text-[11px] font-mono text-[#888] tracking-wide">
          <span className="text-[#555] mr-2">CURRENT SECTOR POSITIONING</span>
          <span className="text-[#ccc]">{summary}</span>
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-px rounded bg-card-border p-px">
          {(["KR", "US"] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMarket(m); setSelectedSector(null); }}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                market === m ? "bg-accent text-white" : "bg-card-bg text-muted hover:text-foreground"
              }`}
            >
              {m === "KR" ? (lang === "kr" ? "KR 섹터" : "KR Sectors") : (lang === "kr" ? "US 섹터" : "US Sectors")}
            </button>
          ))}
        </div>

        {/* Chart toggle */}
        <button
          onClick={() => setChartOpen(!chartOpen)}
          className="rounded px-3 py-1 text-xs font-medium transition-colors bg-[#1a1a1a] text-[#888] hover:text-foreground"
        >
          {chartOpen
            ? (lang === "kr" ? "차트 숨기기 ▲" : "Hide Chart ▲")
            : (lang === "kr" ? "차트 보기 ▼" : "Show Chart ▼")}
        </button>

        {chartOpen && (
          <button
            onClick={togglePlay}
            className={`rounded px-3 py-1 text-xs font-mono font-medium transition-colors ${
              playing ? "bg-loss/20 text-loss" : "bg-[#1a1a1a] text-[#888] hover:text-foreground"
            }`}
          >
            {playing ? "STOP" : "REPLAY"}
          </button>
        )}

        {asOf && (
          <span className="ml-auto text-[9px] text-[#444] font-mono tabular-nums">
            {new Date(asOf).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Collapsible RRG Chart */}
      {chartOpen && (
        <div className={CARD}>
          <RRGScatterPlot
            sectors={playing ? animatedSectors : sectors}
            highlighted={highlighted}
            onHover={setHighlighted}
            onClick={handleSectorClick}
            trailWeeks={trailWeeks}
            lang={lang}
          />
        </div>
      )}

      {/* Quadrant cards — 2-column grid when chart collapsed */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Left column: LEADING + IMPROVING */}
        <div className="space-y-3">
          {renderQuadrantCard("leading")}
          {renderQuadrantCard("improving")}
        </div>
        {/* Right column: WEAKENING + LAGGING */}
        <div className="space-y-3">
          {renderQuadrantCard("weakening")}
          {renderQuadrantCard("lagging")}
        </div>
      </div>

      {/* Selected sector detail panel */}
      {selectedSectorData && (
        <SectorDetailPanel
          sector={selectedSectorData}
          lang={lang}
          trailWeeks={trailWeeks}
        />
      )}

      {/* Improving card pulse animation */}
      <style>{`
        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 0 0 0 rgba(96, 165, 250, 0); }
          50% { box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.15); }
        }
        .animate-pulse-border {
          animation: pulse-border 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
