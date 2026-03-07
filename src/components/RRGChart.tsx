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
    emoji: "\uD83D\uDFE2",
    en: "Leading", kr: "강세 유지",
    descEn: "Strong and getting stronger → Hold/add",
    descKr: "강하고 계속 강해짐 → 보유/추가매수",
    actionEn: "Buy interest", actionKr: "매수 관심",
    color: "#22c55e", bg: "rgba(16,185,129,0.15)",
    border: "border-green-500/20", bgCard: "bg-green-500/5",
  },
  improving: {
    emoji: "\uD83D\uDFE1",
    en: "Improving", kr: "강세 전환",
    descEn: "Was weak, now turning strong → Consider early buy",
    descKr: "약했지만 강해지는 중 → 매수 검토 타이밍",
    actionEn: "Monitoring", actionKr: "모니터링",
    color: "#eab308", bg: "rgba(234,179,8,0.15)",
    border: "border-yellow-500/20", bgCard: "bg-yellow-500/5",
  },
  weakening: {
    emoji: "\uD83D\uDFE0",
    en: "Weakening", kr: "약세 전환",
    descEn: "Was strong, now turning weak → Take profits",
    descKr: "강했지만 약해지는 중 → 차익실현 고려",
    actionEn: "Reduce", actionKr: "비중 축소",
    color: "#f97316", bg: "rgba(249,115,22,0.15)",
    border: "border-orange-500/20", bgCard: "bg-orange-500/5",
  },
  lagging: {
    emoji: "\uD83D\uDD34",
    en: "Lagging", kr: "약세 유지",
    descEn: "Weak and getting weaker → Avoid buying",
    descKr: "약하고 계속 약해짐 → 매수 피할 것",
    actionEn: "Avoid", actionKr: "매수 자제",
    color: "#ef4444", bg: "rgba(239,68,68,0.15)",
    border: "border-red-500/20", bgCard: "bg-red-500/5",
  },
};

const QUADRANT_ORDER: Quadrant[] = ["leading", "improving", "weakening", "lagging"];

const ACTION_HEADERS = {
  leading: { en: "Sectors to watch (Leading)", kr: "지금 주목할 섹터 (강세 유지)" },
  improving: { en: "Early-buy candidates (Improving)", kr: "선취매 후보 (강세 전환)" },
  weakening: { en: "Take-profit candidates (Weakening)", kr: "차익실현 고려 (약세 전환)" },
  lagging: { en: "Sectors to avoid (Lagging)", kr: "회피 섹터 (약세 유지)" },
};

// ── Auto summary generator ──────────────────────────────────

function generateSummary(sectors: SectorData[], lang: "en" | "kr"): string {
  const grouped: Record<Quadrant, SectorData[]> = { leading: [], improving: [], lagging: [], weakening: [] };
  for (const s of sectors) grouped[s.quadrant].push(s);

  const name = (s: SectorData) => lang === "kr" ? s.nameKr : s.name;

  const parts: string[] = [];

  if (grouped.leading.length > 0) {
    const names = grouped.leading.slice(0, 3).map(name).join("·");
    parts.push(lang === "kr" ? `${names} 강세 유지` : `${names} leading`);
  }
  if (grouped.lagging.length > 0) {
    const names = grouped.lagging.slice(0, 3).map(name).join("·");
    parts.push(lang === "kr" ? `${names} 약세` : `${names} lagging`);
  }
  if (grouped.improving.length > 0) {
    const names = grouped.improving.slice(0, 2).map(name).join("·");
    parts.push(lang === "kr" ? `주목할 전환 섹터: ${names}` : `Watch: ${names} improving`);
  }

  if (parts.length === 0) return lang === "kr" ? "데이터 분석 중..." : "Analyzing data...";
  return parts.join(" | ");
}

// ── Tooltip interpretation ──────────────────────────────────

function getInterpretation(s: SectorData, lang: "en" | "kr"): string {
  const ratio = s.current.rsRatio;
  const mom = s.current.rsMomentum;
  const strong = ratio >= 100;
  const rising = mom >= 100;

  if (lang === "kr") {
    if (strong && rising) return "현재 시장 대비 강하며 모멘텀도 상승 중. 단기 매수 유효.";
    if (!strong && rising) return "시장 대비 약하지만 반등 조짐. 선취매 검토 가능.";
    if (strong && !rising) return "시장 대비 강하나 모멘텀 둔화 중. 차익실현 고려.";
    return "시장 대비 약하고 모멘텀도 하락 중. 매수 자제 권장.";
  }
  if (strong && rising) return "Strong vs market with rising momentum. Buy signal valid.";
  if (!strong && rising) return "Weak but rebounding. Consider early positioning.";
  if (strong && !rising) return "Strong but momentum fading. Consider taking profits.";
  return "Weak with declining momentum. Avoid buying.";
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

  // Only show last 4 weeks of trail
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

  return (
    <div className="relative">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Quadrant backgrounds - stronger opacity */}
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
              <line x1={scaleX(xv)} y1={PAD.top} x2={scaleX(xv)} y2={PAD.top + plotH} stroke="#1f2a37" strokeDasharray="3 3" />
              <line x1={PAD.left} y1={scaleY(yv)} x2={PAD.left + plotW} y2={scaleY(yv)} stroke="#1f2a37" strokeDasharray="3 3" />
              <text x={scaleX(xv)} y={PAD.top + plotH + 16} textAnchor="middle" fill="#6b7280" fontSize={9}>{xv.toFixed(1)}</text>
              <text x={PAD.left - 8} y={scaleY(yv) + 3} textAnchor="end" fill="#6b7280" fontSize={9}>{yv.toFixed(1)}</text>
            </g>
          );
        })}

        {/* Center crosshair */}
        <line x1={cx100} y1={PAD.top} x2={cx100} y2={PAD.top + plotH} stroke="#374151" strokeWidth={1.5} />
        <line x1={PAD.left} y1={cy100} x2={PAD.left + plotW} y2={cy100} stroke="#374151" strokeWidth={1.5} />

        {/* Quadrant labels - 16px font */}
        <text x={cx100 + 8} y={PAD.top + 20} fill={Q.leading.color} fontSize={16} fontWeight="700" opacity={0.8}>
          {Q.leading.emoji} {lang === "kr" ? Q.leading.kr : Q.leading.en}
        </text>
        <text x={PAD.left + 8} y={PAD.top + 20} fill={Q.improving.color} fontSize={16} fontWeight="700" opacity={0.8}>
          {Q.improving.emoji} {lang === "kr" ? Q.improving.kr : Q.improving.en}
        </text>
        <text x={PAD.left + 8} y={PAD.top + plotH - 8} fill={Q.lagging.color} fontSize={16} fontWeight="700" opacity={0.8}>
          {Q.lagging.emoji} {lang === "kr" ? Q.lagging.kr : Q.lagging.en}
        </text>
        <text x={cx100 + 8} y={PAD.top + plotH - 8} fill={Q.weakening.color} fontSize={16} fontWeight="700" opacity={0.8}>
          {Q.weakening.emoji} {lang === "kr" ? Q.weakening.kr : Q.weakening.en}
        </text>

        {/* Axis labels */}
        <text x={PAD.left + plotW / 2} y={H - 4} textAnchor="middle" fill="#9ca3af" fontSize={10}>
          RS-Ratio ({lang === "kr" ? "상대강도" : "Relative Strength"})
        </text>
        <text x={12} y={PAD.top + plotH / 2} textAnchor="middle" fill="#9ca3af" fontSize={10} transform={`rotate(-90, 12, ${PAD.top + plotH / 2})`}>
          RS-Momentum ({lang === "kr" ? "모멘텀" : "Momentum"})
        </text>

        {/* Arrow marker */}
        <defs>
          {sectors.map(s => (
            <marker key={`arrow-${s.ticker}`} id={`arrow-${s.ticker}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
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
          // 30% larger bubbles: base 23 -> 23, highlighted 29
          const r = isHighlighted ? 29 : 23;

          return (
            <g key={s.ticker} opacity={opacity}>
              {/* Trail line with arrow */}
              {pts.length > 1 && (
                <polyline
                  points={pts.map(p => `${scaleX(p.rsRatio)},${scaleY(p.rsMomentum)}`).join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeOpacity={0.6}
                  markerEnd={`url(#arrow-${s.ticker})`}
                />
              )}
              {/* Trail dots (fading) */}
              {pts.slice(0, -1).map((p, i) => (
                <circle
                  key={i}
                  cx={scaleX(p.rsRatio)}
                  cy={scaleY(p.rsMomentum)}
                  r={3 + (i / pts.length) * 2}
                  fill={s.color}
                  opacity={0.25 + (i / pts.length) * 0.45}
                />
              ))}
              {/* Current bubble */}
              <circle
                cx={scaleX(s.current.rsRatio)}
                cy={scaleY(s.current.rsMomentum)}
                r={r}
                fill={s.color}
                fillOpacity={0.25}
                stroke={s.color}
                strokeWidth={isHighlighted ? 2.5 : 1.5}
                className="cursor-pointer transition-all"
                onMouseEnter={(e) => {
                  onHover(s.ticker);
                  const rect = svgRef.current?.getBoundingClientRect();
                  if (rect) {
                    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, sector: s });
                  }
                }}
                onMouseMove={(e) => {
                  const rect = svgRef.current?.getBoundingClientRect();
                  if (rect) {
                    setTooltip(prev => prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
                  }
                }}
                onMouseLeave={() => { onHover(null); setTooltip(null); }}
                onClick={() => onClick(s.ticker)}
              />
              {/* Sector name ABOVE bubble (outside) */}
              <text
                x={scaleX(s.current.rsRatio)}
                y={scaleY(s.current.rsMomentum) - r - 5}
                textAnchor="middle"
                fill="#e5e7eb"
                fontSize={isHighlighted ? 11 : 9}
                fontWeight="700"
                pointerEvents="none"
              >
                {lang === "kr" ? s.nameKr : s.name}
              </text>
              {/* % change inside bubble */}
              <text
                x={scaleX(s.current.rsRatio)}
                y={scaleY(s.current.rsMomentum) + 4}
                textAnchor="middle"
                fill={s.chg5d >= 0 ? "#4ade80" : "#f87171"}
                fontSize={isHighlighted ? 11 : 9}
                fontWeight="700"
                pointerEvents="none"
              >
                {s.chg5d >= 0 ? "+" : ""}{s.chg5d.toFixed(1)}%
              </text>
            </g>
          );
        })}
      </svg>

      {/* Enhanced Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 rounded-lg border border-card-border bg-[#111820] px-3.5 py-2.5 shadow-xl"
          style={{
            left: Math.min(tooltip.x + 14, 480),
            top: Math.max(tooltip.y - 20, 0),
            minWidth: 220,
          }}
        >
          <p className="text-[13px] font-bold" style={{ color: tooltip.sector.color }}>
            {lang === "kr" ? tooltip.sector.nameKr : tooltip.sector.name}
          </p>
          <div className="mt-1.5 space-y-1 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="text-muted">{lang === "kr" ? "현재 위치:" : "Phase:"}</span>
              <span className="rounded px-1.5 py-px text-[10px] font-semibold" style={{ color: Q[tooltip.sector.quadrant].color, background: Q[tooltip.sector.quadrant].bg }}>
                {lang === "kr" ? Q[tooltip.sector.quadrant].kr + " 구간" : Q[tooltip.sector.quadrant].en}
              </span>
            </div>
            <p className="text-muted">
              RS-Ratio: <span className="text-foreground tabular-nums font-medium">{tooltip.sector.current.rsRatio.toFixed(2)}</span>
              <span className="ml-1 text-[9px] text-muted/70">
                ({lang === "kr"
                  ? `시장보다 ${Math.abs(tooltip.sector.current.rsRatio - 100).toFixed(1)}% ${tooltip.sector.current.rsRatio >= 100 ? "강함" : "약함"}`
                  : `${Math.abs(tooltip.sector.current.rsRatio - 100).toFixed(1)}% ${tooltip.sector.current.rsRatio >= 100 ? "above" : "below"} market`})
              </span>
            </p>
            <p className="text-muted">
              RS-Momentum: <span className="text-foreground tabular-nums font-medium">{tooltip.sector.current.rsMomentum.toFixed(2)}</span>
              <span className="ml-1 text-[9px] text-muted/70">
                ({lang === "kr"
                  ? `강도 ${tooltip.sector.current.rsMomentum >= 100 ? "증가 중" : "감소 중"}`
                  : `Momentum ${tooltip.sector.current.rsMomentum >= 100 ? "rising" : "falling"}`})
              </span>
            </p>
            <p className="text-muted">
              {lang === "kr" ? "5일 등락률:" : "5D Return:"}{" "}
              <span className={`font-semibold ${tooltip.sector.chg5d >= 0 ? "text-gain" : "text-loss"}`}>
                {tooltip.sector.chg5d >= 0 ? "+" : ""}{tooltip.sector.chg5d.toFixed(2)}%
              </span>
            </p>
            <div className="mt-1.5 border-t border-card-border/40 pt-1.5">
              <p className="text-[10px] italic" style={{ color: Q[tooltip.sector.quadrant].color }}>
                {getInterpretation(tooltip.sector, lang)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Collapsible Info Panel ───────────────────────────────────

function RRGInfoPanel({ lang }: { lang: "en" | "kr" }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`${CARD} border-accent/20`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-sm font-semibold text-accent">
          {lang === "kr" ? "RRG 차트란?" : "What is an RRG Chart?"}
        </span>
        <span className="text-muted text-lg transition-transform" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
          ▼
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          {/* Section A */}
          <div>
            <h4 className="text-xs font-bold mb-2" style={{ color: "#e8e8e8" }}>
              {lang === "kr" ? "이 차트가 왜 유의미한가?" : "Why is this chart meaningful?"}
            </h4>
            <ul className="space-y-1.5 text-[11px] text-muted">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-accent">•</span>
                {lang === "kr"
                  ? "주식 시장에서 어떤 섹터에 돈이 몰리는지 파악하는 게 수익의 핵심입니다"
                  : "Identifying which sectors attract money flow is key to returns"}
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-accent">•</span>
                {lang === "kr"
                  ? "RRG는 단순 등락률이 아닌, 시장 대비 상대강도와 그 방향성을 동시에 보여줍니다"
                  : "RRG shows relative strength vs market AND its direction simultaneously"}
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-accent">•</span>
                {lang === "kr"
                  ? "펀드매니저와 기관투자자들이 섹터 로테이션 타이밍을 잡을 때 실제로 사용하는 차트입니다"
                  : "Fund managers and institutional investors use this chart for sector rotation timing"}
              </li>
            </ul>
          </div>

          {/* Section B */}
          <div>
            <h4 className="text-xs font-bold mb-2" style={{ color: "#e8e8e8" }}>
              {lang === "kr" ? "어떻게 읽는 건가요?" : "How to read it?"}
            </h4>
            <div className="space-y-2 text-[11px]">
              <div className="flex items-start gap-2 rounded border border-card-border/40 px-3 py-2">
                <span className="shrink-0 font-mono text-accent font-bold">X</span>
                <div>
                  <span className="font-semibold text-foreground">RS-Ratio</span>
                  <span className="text-muted ml-1">
                    {lang === "kr"
                      ? "— 시장 대비 강한가 약한가 (100 기준, 높을수록 강함)"
                      : "— Stronger or weaker vs market (100 = benchmark, higher = stronger)"}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded border border-card-border/40 px-3 py-2">
                <span className="shrink-0 font-mono text-accent font-bold">Y</span>
                <div>
                  <span className="font-semibold text-foreground">RS-Momentum</span>
                  <span className="text-muted ml-1">
                    {lang === "kr"
                      ? "— 강도가 강해지는 중인가 약해지는 중인가 (100 기준)"
                      : "— Is strength increasing or decreasing (100 = neutral)"}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded border border-card-border/40 px-3 py-2">
                <span className="shrink-0 text-accent font-bold">→</span>
                <div>
                  <span className="font-semibold text-foreground">{lang === "kr" ? "꼬리(Trail)" : "Trail"}</span>
                  <span className="text-muted ml-1">
                    {lang === "kr"
                      ? "— 최근 4주간의 이동 경로 → 방향이 중요"
                      : "— Last 4 weeks movement path → direction matters"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section C - 2x2 Grid */}
          <div>
            <h4 className="text-xs font-bold mb-2" style={{ color: "#e8e8e8" }}>
              {lang === "kr" ? "4분면 해석" : "Quadrant Interpretation"}
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg p-3" style={{ background: Q.improving.bg, border: `1px solid ${Q.improving.color}33` }}>
                <div className="flex items-center gap-1 mb-1">
                  <span>{Q.improving.emoji}</span>
                  <span className="text-xs font-bold" style={{ color: Q.improving.color }}>
                    {lang === "kr" ? "강세 전환" : "Improving"}
                  </span>
                </div>
                <p className="text-[10px] text-muted">
                  {lang === "kr" ? "약했지만 강해지는 중" : "Was weak, getting stronger"}
                </p>
                <p className="text-[10px] font-semibold mt-1" style={{ color: Q.improving.color }}>
                  → {lang === "kr" ? "매수 검토 타이밍" : "Consider buying"}
                </p>
              </div>
              <div className="rounded-lg p-3" style={{ background: Q.leading.bg, border: `1px solid ${Q.leading.color}33` }}>
                <div className="flex items-center gap-1 mb-1">
                  <span>{Q.leading.emoji}</span>
                  <span className="text-xs font-bold" style={{ color: Q.leading.color }}>
                    {lang === "kr" ? "강세 유지" : "Leading"}
                  </span>
                </div>
                <p className="text-[10px] text-muted">
                  {lang === "kr" ? "강하고 계속 강해짐" : "Strong and getting stronger"}
                </p>
                <p className="text-[10px] font-semibold mt-1" style={{ color: Q.leading.color }}>
                  → {lang === "kr" ? "보유/추가매수" : "Hold/Add"}
                </p>
              </div>
              <div className="rounded-lg p-3" style={{ background: Q.lagging.bg, border: `1px solid ${Q.lagging.color}33` }}>
                <div className="flex items-center gap-1 mb-1">
                  <span>{Q.lagging.emoji}</span>
                  <span className="text-xs font-bold" style={{ color: Q.lagging.color }}>
                    {lang === "kr" ? "약세 유지" : "Lagging"}
                  </span>
                </div>
                <p className="text-[10px] text-muted">
                  {lang === "kr" ? "약하고 계속 약해짐" : "Weak and getting weaker"}
                </p>
                <p className="text-[10px] font-semibold mt-1" style={{ color: Q.lagging.color }}>
                  → {lang === "kr" ? "매수 피할 것" : "Avoid buying"}
                </p>
              </div>
              <div className="rounded-lg p-3" style={{ background: Q.weakening.bg, border: `1px solid ${Q.weakening.color}33` }}>
                <div className="flex items-center gap-1 mb-1">
                  <span>{Q.weakening.emoji}</span>
                  <span className="text-xs font-bold" style={{ color: Q.weakening.color }}>
                    {lang === "kr" ? "약세 전환" : "Weakening"}
                  </span>
                </div>
                <p className="text-[10px] text-muted">
                  {lang === "kr" ? "강했지만 약해지는 중" : "Was strong, now weakening"}
                </p>
                <p className="text-[10px] font-semibold mt-1" style={{ color: Q.weakening.color }}>
                  → {lang === "kr" ? "차익실현 고려" : "Take profits"}
                </p>
              </div>
            </div>
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
    }, 600);
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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <span className="ml-3 text-sm text-muted">{lang === "kr" ? "RRG 데이터 로딩 중..." : "Loading RRG data..."}</span>
      </div>
    );
  }

  if (sectors.length === 0) {
    return <div className="py-16 text-center text-muted text-sm">{lang === "kr" ? "데이터 없음" : "No data available"}</div>;
  }

  return (
    <div className="space-y-3">
      {/* 1. Collapsible Info Panel */}
      <RRGInfoPanel lang={lang} />

      {/* 2. Summary bar - always visible */}
      <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-2.5">
        <p className="text-sm font-medium">
          <span className="mr-1.5">📍</span>
          <span className="text-muted">{lang === "kr" ? "현재 요약:" : "Summary:"}</span>{" "}
          <span className="text-foreground">{summary}</span>
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
          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
            playing ? "bg-loss/20 text-loss" : "bg-accent/20 text-accent"
          }`}
        >
          {playing ? (lang === "kr" ? "정지" : "Stop") : (lang === "kr" ? "재생" : "Play")}
        </button>

        {asOf && (
          <span className="ml-auto text-[9px] text-muted/60 tabular-nums">
            {lang === "kr" ? "업데이트" : "Updated"}: {new Date(asOf).toLocaleString(lang === "kr" ? "ko-KR" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Main chart + sidebar */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        {/* Chart — 3 cols */}
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

        {/* Sidebar — Action Cards */}
        <div className="space-y-2">
          {QUADRANT_ORDER.map(q => (
            <div key={q} className={`rounded-[12px] border ${Q[q].border} ${Q[q].bgCard} p-3`}>
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="text-sm">{Q[q].emoji}</span>
                <span className="text-[10px] font-bold" style={{ color: Q[q].color }}>
                  {lang === "kr" ? ACTION_HEADERS[q].kr : ACTION_HEADERS[q].en}
                </span>
              </div>
              {grouped[q].length === 0 ? (
                <p className="text-[9px] text-muted/50 ml-5">
                  {lang === "kr" ? "해당 섹터 없음" : "No sectors"}
                </p>
              ) : (
                <div className="space-y-1 ml-0.5">
                  {grouped[q].map(s => (
                    <div
                      key={s.ticker}
                      className={`flex items-center justify-between rounded px-2 py-1 text-[11px] cursor-pointer transition-colors ${
                        highlighted === s.ticker ? "bg-card-border/60" : "hover:bg-card-border/30"
                      }`}
                      onMouseEnter={() => setHighlighted(s.ticker)}
                      onMouseLeave={() => setHighlighted(null)}
                      onClick={() => handleBubbleClick(s.ticker)}
                    >
                      <span className="font-medium">{lang === "kr" ? s.nameKr : s.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`tabular-nums font-semibold ${s.chg5d >= 0 ? "text-gain" : "text-loss"}`}>
                          {s.chg5d >= 0 ? "+" : ""}{s.chg5d.toFixed(1)}%
                        </span>
                        <span className="text-[9px] text-muted/70">
                          {lang === "kr" ? Q[q].actionKr : Q[q].actionEn}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Selected sector detail */}
      {selectedSector && (() => {
        const s = sectors.find(sec => sec.ticker === selectedSector);
        if (!s) return null;
        return (
          <div className={CARD}>
            <div className="mb-3 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
              <h3 className="text-sm font-semibold">
                {lang === "kr" ? s.nameKr : s.name} {lang === "kr" ? "섹터 상세" : "Sector Detail"}
              </h3>
              <span className={`text-xs tabular-nums font-medium ${s.chg5d >= 0 ? "text-gain" : "text-loss"}`}>
                {s.chg5d >= 0 ? "+" : ""}{s.chg5d.toFixed(1)}%
              </span>
              <span className="rounded px-1.5 py-px text-[9px] font-medium" style={{ color: Q[s.quadrant].color, background: Q[s.quadrant].bg }}>
                {lang === "kr" ? Q[s.quadrant].kr : Q[s.quadrant].en}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded border border-card-border/40 px-3 py-2">
                <p className="text-[9px] uppercase tracking-wider text-muted">RS-Ratio</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums">{s.current.rsRatio.toFixed(2)}</p>
                <p className="text-[9px] text-muted">{s.current.rsRatio >= 100 ? (lang === "kr" ? "벤치마크 대비 강세" : "Above benchmark") : (lang === "kr" ? "벤치마크 대비 약세" : "Below benchmark")}</p>
              </div>
              <div className="rounded border border-card-border/40 px-3 py-2">
                <p className="text-[9px] uppercase tracking-wider text-muted">RS-Momentum</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums">{s.current.rsMomentum.toFixed(2)}</p>
                <p className="text-[9px] text-muted">{s.current.rsMomentum >= 100 ? (lang === "kr" ? "모멘텀 상승 중" : "Momentum rising") : (lang === "kr" ? "모멘텀 하락 중" : "Momentum falling")}</p>
              </div>
            </div>
            <div className="mt-3 rounded border border-card-border/30 bg-background px-3 py-2">
              <p className="text-[10px] font-medium" style={{ color: Q[s.quadrant].color }}>
                {getInterpretation(s, lang)}
              </p>
              <p className="mt-1 text-[10px] text-muted">
                ETF: {s.ticker}{s.market === "KR" ? ".KS" : ""} | {lang === "kr" ? `${trailWeeks}주 트레일` : `${trailWeeks}-week trail`}
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
