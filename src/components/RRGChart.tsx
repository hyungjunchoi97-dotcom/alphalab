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
  current: { rsRatio: number; rsMomentum: number };
  quadrant: "leading" | "improving" | "lagging" | "weakening";
  chg5d: number;
}

const CARD = "rounded-[12px] border border-card-border bg-card-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3)]";

const QUADRANT_LABELS = {
  leading: { en: "LEADING", kr: "강세 유지", color: "#22c55e", bg: "rgba(16,185,129,0.08)" },
  improving: { en: "IMPROVING", kr: "강세 전환", color: "#eab308", bg: "rgba(234,179,8,0.08)" },
  lagging: { en: "LAGGING", kr: "약세 유지", color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
  weakening: { en: "WEAKENING", kr: "약세 전환", color: "#f97316", bg: "rgba(249,115,22,0.08)" },
};

const QUADRANT_TIPS = {
  leading: { en: "Strong vs benchmark, momentum rising. Hold/add.", kr: "벤치마크 대비 강하고 강도 상승 중. 비중 유지/확대." },
  improving: { en: "Turning from weak to strong. Early buy.", kr: "약세에서 강세로 전환 중. 선제적 매수 고려." },
  lagging: { en: "Weak vs benchmark, momentum falling. Reduce.", kr: "벤치마크 대비 약하고 약화 중. 비중 축소." },
  weakening: { en: "Turning from strong to weak. Take profit.", kr: "강세에서 약세로 전환 중. 차익실현 고려." },
};

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

  const W = 700, H = 500;
  const PAD = { top: 40, right: 40, bottom: 40, left: 50 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Auto range: find min/max across all current + trail points
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
    const xPad = Math.max((xHi - xLo) * 0.15, 0.5);
    const yPad = Math.max((yHi - yLo) * 0.15, 0.5);
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
        {/* Quadrant backgrounds */}
        {/* Top-right: leading */}
        <rect x={cx100} y={PAD.top} width={PAD.left + plotW - cx100 + PAD.right} height={cy100 - PAD.top} fill={QUADRANT_LABELS.leading.bg} />
        {/* Top-left: improving */}
        <rect x={0} y={PAD.top} width={cx100} height={cy100 - PAD.top} fill={QUADRANT_LABELS.improving.bg} />
        {/* Bottom-left: lagging */}
        <rect x={0} y={cy100} width={cx100} height={PAD.top + plotH - cy100 + PAD.bottom} fill={QUADRANT_LABELS.lagging.bg} />
        {/* Bottom-right: weakening */}
        <rect x={cx100} y={cy100} width={PAD.left + plotW - cx100 + PAD.right} height={PAD.top + plotH - cy100 + PAD.bottom} fill={QUADRANT_LABELS.weakening.bg} />

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

        {/* Quadrant labels */}
        <text x={cx100 + 8} y={PAD.top + 16} fill={QUADRANT_LABELS.leading.color} fontSize={11} fontWeight="600" opacity={0.6}>
          {lang === "kr" ? QUADRANT_LABELS.leading.kr : QUADRANT_LABELS.leading.en}
        </text>
        <text x={PAD.left + 8} y={PAD.top + 16} fill={QUADRANT_LABELS.improving.color} fontSize={11} fontWeight="600" opacity={0.6}>
          {lang === "kr" ? QUADRANT_LABELS.improving.kr : QUADRANT_LABELS.improving.en}
        </text>
        <text x={PAD.left + 8} y={PAD.top + plotH - 8} fill={QUADRANT_LABELS.lagging.color} fontSize={11} fontWeight="600" opacity={0.6}>
          {lang === "kr" ? QUADRANT_LABELS.lagging.kr : QUADRANT_LABELS.lagging.en}
        </text>
        <text x={cx100 + 8} y={PAD.top + plotH - 8} fill={QUADRANT_LABELS.weakening.color} fontSize={11} fontWeight="600" opacity={0.6}>
          {lang === "kr" ? QUADRANT_LABELS.weakening.kr : QUADRANT_LABELS.weakening.en}
        </text>

        {/* Axis labels */}
        <text x={PAD.left + plotW / 2} y={H - 4} textAnchor="middle" fill="#9ca3af" fontSize={10}>RS-Ratio</text>
        <text x={12} y={PAD.top + plotH / 2} textAnchor="middle" fill="#9ca3af" fontSize={10} transform={`rotate(-90, 12, ${PAD.top + plotH / 2})`}>RS-Momentum</text>

        {/* Sector trails and bubbles */}
        {sectors.map((s) => {
          const pts = s.trail.slice(-trailWeeks);
          const isHighlighted = highlighted === s.ticker;
          const dimmed = highlighted !== null && !isHighlighted;
          const opacity = dimmed ? 0.15 : 1;

          return (
            <g key={s.ticker} opacity={opacity}>
              {/* Trail line */}
              {pts.length > 1 && (
                <polyline
                  points={pts.map(p => `${scaleX(p.rsRatio)},${scaleY(p.rsMomentum)}`).join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={1.5}
                  strokeOpacity={0.5}
                />
              )}
              {/* Trail dots (fading) */}
              {pts.slice(0, -1).map((p, i) => (
                <circle
                  key={i}
                  cx={scaleX(p.rsRatio)}
                  cy={scaleY(p.rsMomentum)}
                  r={2 + (i / pts.length) * 2}
                  fill={s.color}
                  opacity={0.2 + (i / pts.length) * 0.4}
                />
              ))}
              {/* Current bubble */}
              <circle
                cx={scaleX(s.current.rsRatio)}
                cy={scaleY(s.current.rsMomentum)}
                r={isHighlighted ? 18 : 14}
                fill={s.color}
                fillOpacity={0.25}
                stroke={s.color}
                strokeWidth={isHighlighted ? 2.5 : 1.5}
                className="cursor-pointer transition-all"
                onMouseEnter={(e) => {
                  onHover(s.ticker);
                  const rect = svgRef.current?.getBoundingClientRect();
                  if (rect) {
                    setTooltip({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      sector: s,
                    });
                  }
                }}
                onMouseLeave={() => { onHover(null); setTooltip(null); }}
                onClick={() => onClick(s.ticker)}
              />
              {/* Label */}
              <text
                x={scaleX(s.current.rsRatio)}
                y={scaleY(s.current.rsMomentum) + 3.5}
                textAnchor="middle"
                fill="#e5e7eb"
                fontSize={8}
                fontWeight="600"
                pointerEvents="none"
              >
                {lang === "kr" ? s.nameKr : s.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 rounded-lg border border-card-border bg-[#111820] px-3 py-2 shadow-xl"
          style={{ left: Math.min(tooltip.x + 12, 500), top: tooltip.y - 10 }}
        >
          <p className="text-xs font-semibold" style={{ color: tooltip.sector.color }}>
            {lang === "kr" ? tooltip.sector.nameKr : tooltip.sector.name}
          </p>
          <div className="mt-1 space-y-0.5 text-[10px]">
            <p className="text-muted">RS-Ratio: <span className="text-foreground tabular-nums">{tooltip.sector.current.rsRatio.toFixed(2)}</span></p>
            <p className="text-muted">RS-Momentum: <span className="text-foreground tabular-nums">{tooltip.sector.current.rsMomentum.toFixed(2)}</span></p>
            <p className="text-muted">
              {lang === "kr" ? "현재 국면" : "Phase"}:{" "}
              <span style={{ color: QUADRANT_LABELS[tooltip.sector.quadrant].color }}>
                {lang === "kr" ? QUADRANT_LABELS[tooltip.sector.quadrant].kr : QUADRANT_LABELS[tooltip.sector.quadrant].en}
              </span>
            </p>
            <p className="text-muted">
              {lang === "kr" ? "주간 수익률" : "1W Return"}:{" "}
              <span className={tooltip.sector.chg5d >= 0 ? "text-gain" : "text-loss"}>
                {tooltip.sector.chg5d >= 0 ? "+" : ""}{tooltip.sector.chg5d.toFixed(1)}%
              </span>
            </p>
            <p className="mt-1 text-[9px] italic text-muted/70">
              {lang === "kr"
                ? QUADRANT_TIPS[tooltip.sector.quadrant].kr
                : QUADRANT_TIPS[tooltip.sector.quadrant].en}
            </p>
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
  const [krData, setKrData] = useState<SectorData[]>([]);
  const [usData, setUsData] = useState<SectorData[]>([]);
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
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sectors = market === "KR" ? krData : usData;

  // Group by quadrant
  const grouped = useMemo(() => {
    const g: Record<string, SectorData[]> = { leading: [], improving: [], lagging: [], weakening: [] };
    for (const s of sectors) g[s.quadrant].push(s);
    return g;
  }, [sectors]);

  // Animation: progressive trail reveal
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
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Market toggle */}
        <div className="flex gap-px rounded bg-card-border p-px">
          {(["KR", "US"] as const).map(m => (
            <button
              key={m}
              onClick={() => setMarket(m)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                market === m ? "bg-accent text-white" : "bg-card-bg text-muted hover:text-foreground"
              }`}
            >
              {m === "KR" ? (lang === "kr" ? "KR 섹터" : "KR Sectors") : (lang === "kr" ? "US 섹터" : "US Sectors")}
            </button>
          ))}
        </div>

        {/* Trail length */}
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

        {/* Play button */}
        <button
          onClick={togglePlay}
          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
            playing ? "bg-loss/20 text-loss" : "bg-accent/20 text-accent"
          }`}
        >
          {playing ? (lang === "kr" ? "정지" : "Stop") : (lang === "kr" ? "애니메이션" : "Animate")}
        </button>
      </div>

      {/* Main chart + sidebar */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        {/* Chart — 3 cols */}
        <div className={`${CARD} lg:col-span-3`}>
          <RRGScatterPlot
            sectors={playing ? animatedSectors : sectors}
            highlighted={highlighted}
            onHover={setHighlighted}
            onClick={(t) => setHighlighted(h => h === t ? null : t)}
            trailWeeks={trailWeeks}
            lang={lang}
          />
        </div>

        {/* Sidebar — 1 col */}
        <div className={`${CARD} space-y-4`}>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            {lang === "kr" ? "국면별 섹터" : "Sectors by Phase"}
          </h3>

          {(["leading", "improving", "weakening", "lagging"] as const).map(q => (
            <div key={q}>
              <div className="mb-1 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: QUADRANT_LABELS[q].color }} />
                <span className="text-[10px] font-semibold" style={{ color: QUADRANT_LABELS[q].color }}>
                  {lang === "kr" ? QUADRANT_LABELS[q].kr : QUADRANT_LABELS[q].en}
                </span>
              </div>
              {grouped[q].length === 0 ? (
                <p className="text-[9px] text-muted/50 ml-3.5">-</p>
              ) : (
                <ul className="space-y-0.5 ml-3.5">
                  {grouped[q].map(s => (
                    <li
                      key={s.ticker}
                      className={`flex items-center justify-between rounded px-1.5 py-0.5 text-[10px] cursor-pointer transition-colors ${
                        highlighted === s.ticker ? "bg-card-border" : "hover:bg-card-border/40"
                      }`}
                      onMouseEnter={() => setHighlighted(s.ticker)}
                      onMouseLeave={() => setHighlighted(null)}
                      onClick={() => setHighlighted(h => h === s.ticker ? null : s.ticker)}
                    >
                      <span>{lang === "kr" ? s.nameKr : s.name}</span>
                      <span className={`tabular-nums ${s.chg5d >= 0 ? "text-gain" : "text-loss"}`}>
                        {s.chg5d >= 0 ? "+" : ""}{s.chg5d.toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Explanation card */}
      <div className={CARD}>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
          {lang === "kr" ? "섹터 로테이션 맵 (RRG) 읽는 법" : "How to Read the RRG"}
        </h3>
        <div className="text-xs leading-relaxed text-muted space-y-1.5">
          {lang === "kr" ? (
            <>
              <p>RRG(Relative Rotation Graph)는 각 섹터의 상대강도와 모멘텀을 동시에 시각화합니다.</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="rounded border border-card-border/40 px-2.5 py-1.5">
                  <span className="font-semibold" style={{ color: QUADRANT_LABELS.leading.color }}>강세(Leading)</span>
                  <p className="mt-0.5 text-[10px]">벤치마크 대비 강하고, 그 강도가 더 강해지는 중. 비중 유지/확대.</p>
                </div>
                <div className="rounded border border-card-border/40 px-2.5 py-1.5">
                  <span className="font-semibold" style={{ color: QUADRANT_LABELS.improving.color }}>개선(Improving)</span>
                  <p className="mt-0.5 text-[10px]">약세에서 강세로 전환 중. 선제적 매수 고려.</p>
                </div>
                <div className="rounded border border-card-border/40 px-2.5 py-1.5">
                  <span className="font-semibold" style={{ color: QUADRANT_LABELS.lagging.color }}>약세(Lagging)</span>
                  <p className="mt-0.5 text-[10px]">벤치마크 대비 약하고, 더 약해지는 중. 비중 축소.</p>
                </div>
                <div className="rounded border border-card-border/40 px-2.5 py-1.5">
                  <span className="font-semibold" style={{ color: QUADRANT_LABELS.weakening.color }}>둔화(Weakening)</span>
                  <p className="mt-0.5 text-[10px]">강세에서 약세로 전환 중. 차익실현 고려.</p>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-muted/70">
                일반적으로 섹터는 시계 반대 방향으로 순환합니다: 개선 → 강세 → 둔화 → 약세 → 개선
              </p>
            </>
          ) : (
            <>
              <p>The Relative Rotation Graph (RRG) visualizes relative strength and momentum of each sector simultaneously.</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="rounded border border-card-border/40 px-2.5 py-1.5">
                  <span className="font-semibold" style={{ color: QUADRANT_LABELS.leading.color }}>Leading</span>
                  <p className="mt-0.5 text-[10px]">Strong relative to benchmark, momentum rising. Hold/add positions.</p>
                </div>
                <div className="rounded border border-card-border/40 px-2.5 py-1.5">
                  <span className="font-semibold" style={{ color: QUADRANT_LABELS.improving.color }}>Improving</span>
                  <p className="mt-0.5 text-[10px]">Turning from weak to strong. Consider early entry.</p>
                </div>
                <div className="rounded border border-card-border/40 px-2.5 py-1.5">
                  <span className="font-semibold" style={{ color: QUADRANT_LABELS.lagging.color }}>Lagging</span>
                  <p className="mt-0.5 text-[10px]">Weak relative to benchmark, weakening further. Reduce exposure.</p>
                </div>
                <div className="rounded border border-card-border/40 px-2.5 py-1.5">
                  <span className="font-semibold" style={{ color: QUADRANT_LABELS.weakening.color }}>Weakening</span>
                  <p className="mt-0.5 text-[10px]">Turning from strong to weak. Consider taking profits.</p>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-muted/70">
                Sectors typically rotate counter-clockwise: Improving → Leading → Weakening → Lagging → Improving
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
