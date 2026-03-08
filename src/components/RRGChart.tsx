"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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

// ── SVG RRG Scatter Plot ─────────────────────────────────────

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

  const W = 700, H = 520;
  const PAD = { top: 40, right: 40, bottom: 40, left: 50 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const TRAIL_DISPLAY = 4;

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
    const xPad = Math.max((xHi - xLo) * 0.2, 0.8);
    const yPad = Math.max((yHi - yLo) * 0.2, 0.8);
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

  // Collision detection: offset overlapping bubbles
  const bubblePositions = useMemo(() => {
    const BASE_R = 14; // 40% smaller (was 23)
    const positions = sectors.map(s => ({
      ticker: s.ticker,
      x: scaleX(s.current.rsRatio),
      y: scaleY(s.current.rsMomentum),
      ox: 0, // offset x
      oy: 0, // offset y
    }));
    // Simple collision resolution: push apart overlapping bubbles
    for (let iter = 0; iter < 5; iter++) {
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const a = positions[i], b = positions[j];
          const dx = (a.x + a.ox) - (b.x + b.ox);
          const dy = (a.y + a.oy) - (b.y + b.oy);
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = BASE_R * 2.5; // minimum distance between centers
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

  return (
    <div className="relative">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Quadrant backgrounds */}
        <rect x={cx100} y={PAD.top} width={PAD.left + plotW - cx100 + PAD.right} height={cy100 - PAD.top} fill={Q.leading.bg} />
        <rect x={0} y={PAD.top} width={cx100} height={cy100 - PAD.top} fill={Q.improving.bg} />
        <rect x={0} y={cy100} width={cx100} height={PAD.top + plotH - cy100 + PAD.bottom} fill={Q.lagging.bg} />
        <rect x={cx100} y={cy100} width={PAD.left + plotW - cx100 + PAD.right} height={PAD.top + plotH - cy100 + PAD.bottom} fill={Q.weakening.bg} />

        {/* Grid lines */}
        {[...Array(5)].map((_, i) => {
          const xv = xMin + ((xMax - xMin) * i) / 4;
          const yv = yMin + ((yMax - yMin) * i) / 4;
          return (
            <g key={i}>
              <line x1={scaleX(xv)} y1={PAD.top} x2={scaleX(xv)} y2={PAD.top + plotH} stroke="#1a1f28" strokeDasharray="3 3" />
              <line x1={PAD.left} y1={scaleY(yv)} x2={PAD.left + plotW} y2={scaleY(yv)} stroke="#1a1f28" strokeDasharray="3 3" />
              <text x={scaleX(xv)} y={PAD.top + plotH + 16} textAnchor="middle" fill="#555" fontSize={9} fontFamily="ui-monospace, monospace">{xv.toFixed(1)}</text>
              <text x={PAD.left - 8} y={scaleY(yv) + 3} textAnchor="end" fill="#555" fontSize={9} fontFamily="ui-monospace, monospace">{yv.toFixed(1)}</text>
            </g>
          );
        })}

        {/* Center crosshair */}
        <line x1={cx100} y1={PAD.top} x2={cx100} y2={PAD.top + plotH} stroke="#2a3040" strokeWidth={1.5} />
        <line x1={PAD.left} y1={cy100} x2={PAD.left + plotW} y2={cy100} stroke="#2a3040" strokeWidth={1.5} />

        {/* Quadrant labels */}
        <text x={cx100 + 8} y={PAD.top + 18} fill={Q.leading.color} fontSize={12} fontWeight="700" opacity={0.5} fontFamily="ui-sans-serif, system-ui, sans-serif">
          Leading
        </text>
        <text x={PAD.left + 8} y={PAD.top + 18} fill={Q.improving.color} fontSize={12} fontWeight="700" opacity={0.5} fontFamily="ui-sans-serif, system-ui, sans-serif">
          Improving
        </text>
        <text x={PAD.left + 8} y={PAD.top + plotH - 8} fill={Q.lagging.color} fontSize={12} fontWeight="700" opacity={0.5} fontFamily="ui-sans-serif, system-ui, sans-serif">
          Lagging
        </text>
        <text x={cx100 + 8} y={PAD.top + plotH - 8} fill={Q.weakening.color} fontSize={12} fontWeight="700" opacity={0.5} fontFamily="ui-sans-serif, system-ui, sans-serif">
          Weakening
        </text>

        {/* Axis labels */}
        <text x={PAD.left + plotW / 2} y={H - 4} textAnchor="middle" fill="#666" fontSize={10} fontFamily="ui-sans-serif, system-ui, sans-serif">
          RS-Ratio ({lang === "kr" ? "상대강도" : "Relative Strength"})
        </text>
        <text x={12} y={PAD.top + plotH / 2} textAnchor="middle" fill="#666" fontSize={10} fontFamily="ui-sans-serif, system-ui, sans-serif" transform={`rotate(-90, 12, ${PAD.top + plotH / 2})`}>
          RS-Momentum ({lang === "kr" ? "모멘텀" : "Momentum"})
        </text>

        {/* Arrow markers */}
        <defs>
          {sectors.map(s => (
            <marker key={`arrow-${s.ticker}`} id={`arrow-${s.ticker}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={s.color} />
            </marker>
          ))}
        </defs>

        {/* Sector trails and bubbles */}
        {sectors.map((s) => {
          const allPts = s.trail.slice(-trailWeeks);
          const pts = allPts.slice(-TRAIL_DISPLAY);
          const isHighlighted = highlighted === s.ticker;
          const dimmed = highlighted !== null && !isHighlighted;
          const opacity = dimmed ? 0.12 : 1;
          const r = isHighlighted ? 18 : 14; // 40% smaller
          const offset = bubblePositions.get(s.ticker) || { ox: 0, oy: 0 };
          const bx = scaleX(s.current.rsRatio) + offset.ox;
          const by = scaleY(s.current.rsMomentum) + offset.oy;

          return (
            <g key={s.ticker} opacity={opacity}>
              {/* Trail line with arrow */}
              {pts.length > 1 && (
                <polyline
                  points={pts.map(p => `${scaleX(p.rsRatio)},${scaleY(p.rsMomentum)}`).join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={1.5}
                  strokeOpacity={0.5}
                  markerEnd={`url(#arrow-${s.ticker})`}
                />
              )}
              {/* Trail dots */}
              {pts.slice(0, -1).map((p, i) => (
                <circle
                  key={i}
                  cx={scaleX(p.rsRatio)}
                  cy={scaleY(p.rsMomentum)}
                  r={2 + (i / pts.length) * 1.5}
                  fill={s.color}
                  opacity={0.25 + (i / pts.length) * 0.45}
                />
              ))}
              {/* Current bubble */}
              <circle
                cx={bx}
                cy={by}
                r={r}
                fill={s.color}
                fillOpacity={0.15}
                stroke={s.color}
                strokeWidth={isHighlighted ? 2 : 1}
                className="cursor-pointer transition-all"
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
              {/* Sector name — only on hover */}
              {isHighlighted && (
                <text
                  x={bx}
                  y={by - r - 4}
                  textAnchor="middle"
                  fill="#e0e0e0"
                  fontSize={10}
                  fontWeight="600"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                  pointerEvents="none"
                >
                  {lang === "kr" ? s.nameKr : s.name}
                </text>
              )}
              {/* % change inside bubble */}
              <text
                x={bx}
                y={by + 3}
                textAnchor="middle"
                fill={s.chg5d >= 0 ? "#4ade80" : "#f87171"}
                fontSize={isHighlighted ? 9 : 7}
                fontWeight="700"
                fontFamily="ui-monospace, monospace"
                pointerEvents="none"
              >
                {s.chg5d >= 0 ? "+" : ""}{s.chg5d.toFixed(1)}%
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 rounded border border-[#2a2a2a] bg-[#0d0d0d] px-4 py-3 shadow-2xl"
          style={{
            left: Math.min(tooltip.x + 14, 420),
            top: Math.max(tooltip.y - 20, 0),
            minWidth: 260,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: tooltip.sector.color }} />
            <span className="text-[13px] font-semibold text-foreground">
              {lang === "kr" ? tooltip.sector.nameKr : tooltip.sector.name}
            </span>
          </div>
          <div className="border-t border-[#222] pt-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#666]">{lang === "kr" ? "현재 위치" : "Phase"}</span>
              <span className="font-mono font-medium" style={{ color: Q[tooltip.sector.quadrant].color }}>
                {Q[tooltip.sector.quadrant].en} / {Q[tooltip.sector.quadrant].kr}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#666]">RS-Ratio</span>
              <span className="font-mono font-medium text-foreground">
                {tooltip.sector.current.rsRatio.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#666]">RS-Momentum</span>
              <span className="font-mono font-medium text-foreground">
                {tooltip.sector.current.rsMomentum.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#666]">{lang === "kr" ? "5일 수익률" : "5D Return"}</span>
              <span className={`font-mono font-semibold ${tooltip.sector.chg5d >= 0 ? "text-gain" : "text-loss"}`}>
                {tooltip.sector.chg5d >= 0 ? "+" : ""}{tooltip.sector.chg5d.toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="mt-2 border-t border-[#222] pt-2">
            <p className="text-[10px] text-[#888] leading-relaxed">
              {getInterpretation(tooltip.sector, lang)}
            </p>
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
          {/* METHODOLOGY */}
          <div>
            <h4 className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#555] mb-2">
              METHODOLOGY
            </h4>
            <p className="text-[11px] text-[#999] leading-relaxed">
              {lang === "kr"
                ? "RRG는 각 섹터의 상대강도(RS-Ratio)와 그 변화율(RS-Momentum)을 2차원 평면에 시각화한 지표입니다. 단순 수익률이 아닌 벤치마크 대비 상대적 포지셔닝과 방향성을 동시에 파악할 수 있어, 섹터 로테이션 전략 수립 시 활용됩니다."
                : "RRG visualizes each sector's relative strength (RS-Ratio) and its rate of change (RS-Momentum) on a two-dimensional plane. Unlike simple returns, it captures both relative positioning versus benchmark and directional momentum, making it a standard tool for sector rotation strategy."}
            </p>
          </div>

          {/* HOW TO READ */}
          <div>
            <h4 className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#555] mb-2">
              HOW TO READ
            </h4>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex gap-3 py-1.5 border-b border-[#151515]">
                <span className="shrink-0 font-mono text-[#555] w-24">X-Axis</span>
                <span className="text-[#999]">
                  <span className="text-[#ccc] font-medium">RS-Ratio</span> — {lang === "kr" ? "벤치마크 대비 상대강도. 100 기준, 초과 시 시장 대비 강세." : "Relative strength vs benchmark. 100 = neutral, above = outperforming."}
                </span>
              </div>
              <div className="flex gap-3 py-1.5 border-b border-[#151515]">
                <span className="shrink-0 font-mono text-[#555] w-24">Y-Axis</span>
                <span className="text-[#999]">
                  <span className="text-[#ccc] font-medium">RS-Momentum</span> — {lang === "kr" ? "상대강도의 변화율. 100 초과 시 강도 개선 중." : "Rate of change in RS. Above 100 = strength improving."}
                </span>
              </div>
              <div className="flex gap-3 py-1.5">
                <span className="shrink-0 font-mono text-[#555] w-24">Trail</span>
                <span className="text-[#999]">
                  {lang === "kr" ? "최근 4주 이동 경로. 시계 방향 순환이 일반적 패턴." : "Last 4 weeks path. Clockwise rotation is the typical pattern."}
                </span>
              </div>
            </div>
          </div>

          {/* QUADRANT DEFINITIONS */}
          <div>
            <h4 className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#555] mb-2">
              QUADRANT DEFINITIONS
            </h4>
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
                        <span className="font-medium" style={{ color: Q[q].color }}>
                          {Q[q].en} / {Q[q].kr}
                        </span>
                      </div>
                    </td>
                    <td className="py-1.5 font-mono text-[#888]">
                      {q === "leading" || q === "weakening" ? "> 100" : "< 100"}
                    </td>
                    <td className="py-1.5 font-mono text-[#888]">
                      {q === "leading" || q === "improving" ? "> 100" : "< 100"}
                    </td>
                    <td className="py-1.5 text-[#888]">
                      {lang === "kr" ? Q[q].descKr : Q[q].descEn}
                    </td>
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

// ── Main RRG Component ───────────────────────────────────────

export default function RRGChart() {
  const { lang } = useLang();
  const [market, setMarket] = useState<"KR" | "US">("KR");
  const [trailWeeks, setTrailWeeks] = useState(8);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [krData, setKrData] = useState<SectorData[]>([]);
  const [usData, setUsData] = useState<SectorData[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [animFrame, setAnimFrame] = useState(0);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    }, 1200); // 2x slower animation (was 600ms)
  };

  useEffect(() => {
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, []);

  const handleBubbleClick = (ticker: string) => {
    setSelectedSector(prev => prev === ticker ? null : ticker);
    setHighlighted(prev => prev === ticker ? null : ticker);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#333] border-t-[#888]" />
        <span className="ml-3 text-xs text-[#555] font-mono">{lang === "kr" ? "Loading RRG data..." : "Loading RRG data..."}</span>
      </div>
    );
  }

  if (sectors.length === 0) {
    return <div className="py-16 text-center text-[#555] text-xs font-mono">No data available</div>;
  }

  return (
    <div className="space-y-3">
      {/* Methodology Panel */}
      <RRGInfoPanel lang={lang} />

      {/* Summary bar */}
      <div className="rounded border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-2">
        <p className="text-[11px] font-mono text-[#888] tracking-wide">
          <span className="text-[#555] mr-2">{lang === "kr" ? "CURRENT SECTOR POSITIONING" : "CURRENT SECTOR POSITIONING"}</span>
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

        <div className="flex gap-px rounded bg-card-border p-px">
          {[4, 8, 12].map(w => (
            <button
              key={w}
              onClick={() => setTrailWeeks(w)}
              className={`px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                trailWeeks === w ? "bg-accent text-white" : "bg-card-bg text-muted hover:text-foreground"
              }`}
            >
              {w}{lang === "kr" ? "주" : "W"}
            </button>
          ))}
        </div>

        <button
          onClick={togglePlay}
          className={`rounded px-3 py-1 text-xs font-mono font-medium transition-colors ${
            playing ? "bg-loss/20 text-loss" : "bg-[#1a1a1a] text-[#888] hover:text-foreground"
          }`}
        >
          {playing ? "STOP" : "REPLAY"}
        </button>

        {asOf && (
          <span className="ml-auto text-[9px] text-[#444] font-mono tabular-nums">
            {new Date(asOf).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Main layout: 60% chart / 40% quadrant table */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        {/* LEFT: RRG Chart (60%) */}
        <div className={`${CARD} lg:col-span-3`}>
          <RRGScatterPlot
            sectors={playing ? animatedSectors : sectors}
            highlighted={highlighted}
            onHover={setHighlighted}
            onClick={handleBubbleClick}
            trailWeeks={trailWeeks}
            lang={lang}
          />
        </div>

        {/* RIGHT: Quadrant Cards (40%) — PRIMARY */}
        <div className="lg:col-span-2 space-y-3">
          {QUADRANT_ORDER.map(q => {
            const qMeta = Q[q];
            const items = grouped[q];
            const headerBg = q === "leading" ? "bg-green-900/60" : q === "improving" ? "bg-blue-900/60" : q === "weakening" ? "bg-yellow-900/60" : "bg-red-900/60";
            const headerBorder = q === "leading" ? "border-green-500/50" : q === "improving" ? "border-blue-500/50" : q === "weakening" ? "border-yellow-500/50" : "border-red-500/50";

            return (
              <div key={q} className={`rounded-lg border overflow-hidden ${qMeta.border}`} style={{ background: "#0d0d0d" }}>
                {/* Colored header */}
                <div className={`${headerBg} border-b ${headerBorder} px-4 py-2.5 flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: qMeta.color }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: qMeta.color }}>
                      {qMeta.en}
                    </span>
                    <span className="text-[10px] text-[#888]">
                      / {qMeta.kr}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#555]">
                    {items.length} {lang === "kr" ? "섹터" : "sectors"}
                  </span>
                </div>

                {/* Sector rows */}
                <div className="px-1">
                  {items.length === 0 ? (
                    <p className="text-xs text-[#333] py-3 px-3 font-mono">—</p>
                  ) : (
                    items.map(s => {
                      // Determine upgrade/downgrade: compare momentum direction
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
                          className={`flex items-center justify-between rounded px-3 py-2 cursor-pointer transition-colors ${
                            highlighted === s.ticker ? "bg-[#1a1a1a]" : "hover:bg-[#111]"
                          }`}
                          onMouseEnter={() => setHighlighted(s.ticker)}
                          onMouseLeave={() => setHighlighted(null)}
                          onClick={() => handleBubbleClick(s.ticker)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-[#ddd]">
                              {lang === "kr" ? s.nameKr : s.name}
                            </span>
                            {badge && (
                              <span className={`rounded px-1.5 py-0.5 text-[8px] font-bold tracking-wider ${
                                badge === "UPGRADE"
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-red-500/20 text-red-400"
                              }`}>
                                {badge}
                              </span>
                            )}
                          </div>
                          <span className={`font-mono tabular-nums text-[12px] font-semibold ${s.chg5d >= 0 ? "text-gain" : "text-loss"}`}>
                            {s.chg5d >= 0 ? "+" : ""}{s.chg5d.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Summary line */}
                <div className="border-t border-[#1a1a1a] px-4 py-2">
                  <p className="text-[10px] text-[#555] italic">
                    {lang === "kr" ? QUADRANT_SUMMARY[q].kr : QUADRANT_SUMMARY[q].en}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected sector detail */}
      {selectedSector && (() => {
        const s = sectors.find(sec => sec.ticker === selectedSector);
        if (!s) return null;
        return (
          <div className="rounded border border-[#1a1a1a] bg-[#0a0a0a] p-4">
            <div className="mb-3 flex items-center gap-3">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              <h3 className="text-sm font-semibold text-[#ccc]">
                {lang === "kr" ? s.nameKr : s.name}
              </h3>
              <span className={`font-mono text-xs tabular-nums font-medium ${s.chg5d >= 0 ? "text-gain" : "text-loss"}`}>
                {s.chg5d >= 0 ? "+" : ""}{s.chg5d.toFixed(1)}%
              </span>
              <span className="font-mono text-[9px] font-medium uppercase" style={{ color: Q[s.quadrant].color }}>
                {Q[s.quadrant].en} / {Q[s.quadrant].kr}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded border border-[#1a1a1a] px-3 py-2">
                <p className="text-[9px] uppercase tracking-wider text-[#555] font-mono">RS-Ratio</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums font-mono text-[#ccc]">{s.current.rsRatio.toFixed(2)}</p>
                <p className="text-[9px] text-[#555]">
                  {s.current.rsRatio >= 100 ? "+" : ""}{(s.current.rsRatio - 100).toFixed(1)} vs benchmark
                </p>
              </div>
              <div className="rounded border border-[#1a1a1a] px-3 py-2">
                <p className="text-[9px] uppercase tracking-wider text-[#555] font-mono">RS-Momentum</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums font-mono text-[#ccc]">{s.current.rsMomentum.toFixed(2)}</p>
                <p className="text-[9px] text-[#555]">
                  {s.current.rsMomentum >= 100 ? (lang === "kr" ? "모멘텀 상승" : "Momentum rising") : (lang === "kr" ? "모멘텀 하락" : "Momentum falling")}
                </p>
              </div>
            </div>
            <div className="mt-3 rounded border border-[#151515] bg-[#080808] px-3 py-2">
              <p className="text-[10px] text-[#888] leading-relaxed">
                {getInterpretation(s, lang)}
              </p>
              <p className="mt-1 text-[9px] text-[#444] font-mono">
                ETF: {s.ticker}{s.market === "KR" ? ".KS" : ""} | {trailWeeks}W trail
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
