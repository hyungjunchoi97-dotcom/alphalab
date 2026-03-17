"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  ReferenceArea,
} from "recharts";
import dynamic from "next/dynamic";
import { useLang } from "@/lib/LangContext";
import AppHeader from "@/components/AppHeader";
import MacroProContent from "@/components/MacroProContent";

const LiquidityDashboard = dynamic(() => import("@/components/LiquidityDashboard"), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-[#111] h-96 rounded-xl" />,
});

const RRGChart = dynamic(() => import("@/components/RRGChart"), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-[#111] h-[500px] rounded-xl" />,
});

// ── Types ─────────────────────────────────────────────────────

interface Observation {
  date: string;
  value: number;
}

interface SeriesData {
  id: string;
  label: string;
  unit: string;
  observations: Observation[];
  latest: number;
  previous: number;
  change: number;
  changePercent: number;
}

type Range = "6M" | "1Y" | "2Y" | "5Y";

interface FearGreedData {
  score: number;
  rating: string;
  previousClose: number;
  oneWeekAgo: number;
  oneMonthAgo: number;
  history: { date: string; score: number }[];
}

interface FxData {
  id: string;
  label: string;
  labelKr: string;
  flag: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  sparkline: number[];
}

interface CommodityData {
  id: string;
  label: string;
  labelKr: string;
  unit: string;
  category: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  weekAgo: number;
  weekChange: number;
  weekChangePercent: number;
  sparkline: number[];
  tooltipKr: string;
  tooltipEn: string;
}

// ── Indicator config ──────────────────────────────────────────

interface IndicatorConfig {
  id: string;
  seriesKey: string; // key in FRED series map
  labelKr: string;
  labelEn: string;
  unit: string;
  sparkColor: string;
  explanation: string;
  zones: { green: [number, number]; yellow: [number, number]; red: [number, number] };
  getZoneColor: (v: number) => string;
  dashedLines?: number[];
  invertZone?: boolean;
  getStatus: (v: number) => { label: string; labelKr: string };
  getInterpretation: (status: string) => string;
  negativeIsRed?: boolean; // special: show red when value < 0
}

const INDICATORS: Record<string, IndicatorConfig> = {
  FEDFUNDS: {
    id: "FEDFUNDS", seriesKey: "FEDFUNDS",
    labelKr: "기준금리", labelEn: "Fed Funds Rate", unit: "%", sparkColor: "#60a5fa",
    explanation: "연준 기준금리. 금리↑ = 대출비용↑, 유동성↓, 증시압박.",
    zones: { red: [4.5, Infinity], yellow: [3, 4.5], green: [-Infinity, 3] },
    getZoneColor: (v) => (v > 4.5 ? "#f87171" : v > 3 ? "#facc15" : "#4ade80"),
    dashedLines: [3, 4.5], invertZone: true,
    getStatus: (v) => v > 4.5 ? { label: "RESTRICTIVE", labelKr: "긴축" } : v >= 3 ? { label: "NEUTRAL", labelKr: "중립" } : { label: "ACCOMMODATIVE", labelKr: "완화" },
    getInterpretation: (s) => s === "RESTRICTIVE" ? "긴축 유지 중. 고금리 장기화 압박." : s === "NEUTRAL" ? "중립 구간. 인하 사이클 진입 여부 주목." : "완화적 환경. 유동성 공급 우호적.",
  },
  CPIAUCSL: {
    id: "CPIAUCSL", seriesKey: "CPI_YOY",
    labelKr: "CPI YoY", labelEn: "CPI YoY", unit: "%", sparkColor: "#fb923c",
    explanation: "소비자물가 전년대비 상승률. 연준 목표 2%.",
    zones: { green: [-Infinity, 2], yellow: [2, 3], red: [3, Infinity] },
    getZoneColor: (v) => (v > 3 ? "#f87171" : v > 2 ? "#facc15" : "#4ade80"),
    dashedLines: [2, 3], invertZone: true,
    getStatus: (v) => v > 3 ? { label: "HIGH", labelKr: "높음" } : v >= 2 ? { label: "TARGET", labelKr: "목표" } : { label: "LOW", labelKr: "낮음" },
    getInterpretation: (s) => s === "HIGH" ? "목표치 상회. 추가 긴축 가능성." : s === "TARGET" ? "목표 수준. 금리 정상화 진행 중." : "디플레 우려. 경기 부양 여지.",
  },
  UNRATE: {
    id: "UNRATE", seriesKey: "UNRATE",
    labelKr: "실업률", labelEn: "Unemployment Rate", unit: "%", sparkColor: "#a78bfa",
    explanation: "실업률. 4% 이하 = 완전고용. 급등 시 침체신호.",
    zones: { green: [-Infinity, 4], yellow: [4, 5], red: [5, Infinity] },
    getZoneColor: (v) => (v < 4 ? "#4ade80" : v < 5 ? "#facc15" : "#f87171"),
    dashedLines: [4, 5],
    getStatus: (v) => v < 4 ? { label: "TIGHT", labelKr: "과열" } : v <= 5 ? { label: "NORMAL", labelKr: "정상" } : { label: "RISING", labelKr: "상승" },
    getInterpretation: (s) => s === "TIGHT" ? "노동시장 과열. 임금 인플레 압력." : s === "NORMAL" ? "고용 안정. 연착륙 시나리오 유효." : "고용 악화. 경기 침체 신호 주시.",
  },
  T10Y3M: {
    id: "T10Y3M", seriesKey: "T10Y3M",
    labelKr: "10Y-3M 금리차", labelEn: "10Y-3M Spread", unit: "%", sparkColor: "#34d399",
    explanation: "장단기 금리차. 역전(음수) = 경기침체 선행 지표.",
    zones: { red: [-Infinity, 0], yellow: [0, 1], green: [1, Infinity] },
    getZoneColor: (v) => (v < 0 ? "#f87171" : v < 1 ? "#facc15" : "#4ade80"),
    dashedLines: [0], negativeIsRed: true,
    getStatus: (v) => v < 0 ? { label: "INVERSION", labelKr: "역전 ⚠" } : v <= 1 ? { label: "FLAT", labelKr: "평탄" } : { label: "NORMAL", labelKr: "정상" },
    getInterpretation: (s) => s === "INVERSION" ? "⚠ 장단기 역전. 역사적 경기침체 선행 지표." : s === "FLAT" ? "금리차 축소. 경기 둔화 경계 구간." : "정상 커브. 경기 확장 우호적.",
  },
  BAMLH0A0HYM2: {
    id: "BAMLH0A0HYM2", seriesKey: "BAMLH0A0HYM2",
    labelKr: "HY 스프레드", labelEn: "HY Spread", unit: "%", sparkColor: "#f87171",
    explanation: "하이일드 채권 스프레드. 신용 리스크 지표.",
    zones: { green: [-Infinity, 3], yellow: [3, 5], red: [5, Infinity] },
    getZoneColor: (v) => (v > 5 ? "#f87171" : v > 3 ? "#facc15" : "#4ade80"),
    dashedLines: [3, 5], invertZone: true,
    getStatus: (v) => v < 3 ? { label: "LOW RISK", labelKr: "안정" } : v <= 5 ? { label: "MODERATE", labelKr: "주의" } : { label: "HIGH RISK", labelKr: "위험 ⚠" },
    getInterpretation: (s) => s === "LOW RISK" ? "신용 시장 안정. 위험 선호 환경." : s === "MODERATE" ? "스프레드 확대 중. 기업 부도 리스크 주시." : "⚠ 신용 경색 신호. 위험자산 회피 구간.",
  },
  VIX: {
    id: "VIX", seriesKey: "VIX",
    labelKr: "VIX 공포지수", labelEn: "VIX Index", unit: "pts", sparkColor: "#facc15",
    explanation: "시장 변동성 지수. 공포 심리 지표.",
    zones: { green: [-Infinity, 15], yellow: [15, 25], red: [25, Infinity] },
    getZoneColor: (v) => (v > 35 ? "#f87171" : v > 25 ? "#fb923c" : v > 15 ? "#facc15" : "#4ade80"),
    dashedLines: [15, 25],
    getStatus: (v) => v > 35 ? { label: "FEAR", labelKr: "공포 ⚠" } : v > 25 ? { label: "ELEVATED", labelKr: "불안" } : v > 15 ? { label: "NORMAL", labelKr: "보통" } : { label: "COMPLACENT", labelKr: "안일" },
    getInterpretation: (s) => s === "COMPLACENT" ? "시장 과신 구간. 역발상 주의." : s === "NORMAL" ? "정상 변동성. 시장 균형 상태." : s === "ELEVATED" ? "불안 고조. 변동성 확대 대비." : "⚠ 극단적 공포. 역사적 매수 기회 구간.",
  },
};

const INDICATOR_ORDER = ["FEDFUNDS", "CPIAUCSL", "UNRATE", "T10Y3M", "BAMLH0A0HYM2", "VIX"];
type CardRange = "3M" | "6M" | "1Y" | "3Y" | "5Y";
const CARD_RANGES: CardRange[] = ["3M", "6M", "1Y", "3Y", "5Y"];
const CARD_RANGE_MONTHS: Record<CardRange, number> = { "3M": 3, "6M": 6, "1Y": 12, "3Y": 36, "5Y": 60 };

// ── Helpers ───────────────────────────────────────────────────

function fmt(v: number, unit: string): string {
  if (unit === "%" || unit === "index") return v.toFixed(2);
  if (unit === "T$") return v.toFixed(2) + "T";
  if (unit === "B$") {
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(2) + "T";
    return v.toFixed(0) + "B";
  }
  return v.toFixed(2);
}

function fmtChange(v: number, unit: string): string {
  const sign = v >= 0 ? "+" : "";
  if (unit === "%" || unit === "index") return sign + v.toFixed(2);
  if (unit === "T$") return sign + v.toFixed(2) + "T";
  if (unit === "B$") {
    if (Math.abs(v) >= 100) return sign + (v / 1000).toFixed(2) + "T";
    return sign + v.toFixed(1) + "B";
  }
  return sign + v.toFixed(2);
}

function filterByRange(obs: Observation[] | undefined, range: Range): Observation[] {
  if (!obs || obs.length === 0) return obs ?? [];
  const now = new Date();
  const months = range === "6M" ? 6 : range === "1Y" ? 12 : range === "2Y" ? 24 : 60;
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return obs.filter((o) => o.date >= cutoffStr);
}

// ── Count-up hook ─────────────────────────────────────────────

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    if (target === 0) return;
    const start = prevRef.current;
    const diff = target - start;
    const startTime = performance.now();

    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out
      setValue(start + diff * eased);
      if (progress < 1) requestAnimationFrame(step);
      else prevRef.current = target;
    }

    requestAnimationFrame(step);
  }, [target, duration]);

  return value;
}

// ── Sparkline SVG with gradient ───────────────────────────────

function Sparkline({
  data,
  color,
  width = 120,
  height = 36,
  id,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  id?: string;
}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * (height - 4) - 2,
  }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join("");
  const areaPath = linePath + `L${width},${height}L0,${height}Z`;
  const gradId = `sg-${id || Math.random().toString(36).slice(2)}`;

  return (
    <svg width={width} height={height} className="mt-1">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}


// ── Detail Modal Chart ────────────────────────────────────────

function DetailChart({
  observations,
  color,
  zones,
  dashedLines,
  unit,
}: {
  observations: Observation[];
  color: string;
  zones: { green: [number, number]; yellow: [number, number]; red: [number, number] };
  dashedLines?: number[];
  unit: string;
}) {
  const W = 900;
  const H = 300;
  const PAD = { top: 16, right: 50, bottom: 30, left: 60 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  if (observations.length < 2) return null;

  const vals = observations.map((d) => d.value);
  const dataMin = Math.min(...vals);
  const dataMax = Math.max(...vals);

  // Extend range to include dashed lines
  let rangeMin = dataMin;
  let rangeMax = dataMax;
  if (dashedLines) {
    for (const dl of dashedLines) {
      if (dl < rangeMin) rangeMin = dl - (dataMax - dataMin) * 0.1;
      if (dl > rangeMax) rangeMax = dl + (dataMax - dataMin) * 0.1;
    }
  }
  const range = rangeMax - rangeMin || 1;

  const toY = (v: number) => PAD.top + ch - ((v - rangeMin) / range) * ch;

  const pts = vals.map((v, i) => ({
    x: PAD.left + (i / (vals.length - 1)) * cw,
    y: toY(v),
  }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join("");
  const areaPath = linePath + `L${PAD.left + cw},${PAD.top + ch}L${PAD.left},${PAD.top + ch}Z`;

  // Zone bands
  const zoneBands = [
    { range: zones.green, color: "rgba(74,222,128,0.06)" },
    { range: zones.yellow, color: "rgba(250,204,21,0.06)" },
    { range: zones.red, color: "rgba(248,113,113,0.06)" },
  ];

  const fmtVal = (v: number) => {
    if (unit === "B$") return v >= 1000 ? (v / 1000).toFixed(1) + "T" : v.toFixed(0) + "B";
    if (unit === "T$") return v.toFixed(1) + "T";
    return v.toFixed(2);
  };

  const step = Math.max(1, Math.floor(observations.length / 8));
  const xLabels = observations
    .filter((_, i) => i % step === 0)
    .map((d, idx) => ({
      label: d.date.slice(0, 7),
      x: PAD.left + ((idx * step) / (observations.length - 1)) * cw,
    }));

  const yLabels = Array.from({ length: 5 }, (_, i) => rangeMin + (range * i) / 4);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="detailGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Zone bands */}
      {zoneBands.map((band, i) => {
        const y1 = Math.max(PAD.top, toY(Math.min(band.range[1], rangeMax)));
        const y2 = Math.min(PAD.top + ch, toY(Math.max(band.range[0], rangeMin)));
        if (y2 <= y1) return null;
        return <rect key={i} x={PAD.left} y={y1} width={cw} height={y2 - y1} fill={band.color} />;
      })}

      {/* Grid */}
      {yLabels.map((_, i) => {
        const y = PAD.top + ch - (i / 4) * ch;
        return <line key={i} x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#1a1a1a" strokeWidth="1" />;
      })}

      {/* Dashed reference lines */}
      {dashedLines?.map((dl) => {
        const y = toY(dl);
        if (y < PAD.top || y > PAD.top + ch) return null;
        return (
          <g key={dl}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#555" strokeWidth="1" strokeDasharray="6,4" />
            <text x={W - PAD.right + 4} y={y + 3} fill="#777" fontSize="9">{fmtVal(dl)}</text>
          </g>
        );
      })}

      {/* Area + line */}
      <path d={areaPath} fill="url(#detailGrad)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />

      {/* Y-axis */}
      {yLabels.map((v, i) => {
        const y = PAD.top + ch - (i / 4) * ch;
        return (
          <text key={i} x={PAD.left - 6} y={y + 3} textAnchor="end" fill="#555" fontSize="9">
            {fmtVal(v)}
          </text>
        );
      })}

      {/* X-axis */}
      {xLabels.map((xl, i) => (
        <text key={i} x={xl.x} y={H - 8} textAnchor="middle" fill="#444" fontSize="9">
          {xl.label}
        </text>
      ))}
    </svg>
  );
}

// ── Macro Bar Chart (CPI YoY / Unemployment) ────────────────

interface BarChartConfig {
  colorFn: (v: number) => string;
  refLines: { value: number; label: string; labelKr: string; color: string }[];
  tooltipLabel: string;
  tooltipLabelKr: string;
  minY?: number;
}

const CPI_BAR_CONFIG: BarChartConfig = {
  colorFn: (v) => (v > 3 ? "#f87171" : v >= 2 ? "#fb923c" : "#4ade80"),
  refLines: [{ value: 2, label: "Target 2%", labelKr: "목표 2%", color: "#facc15" }],
  tooltipLabel: "CPI",
  tooltipLabelKr: "CPI",
  minY: 0,
};

const UNRATE_BAR_CONFIG: BarChartConfig = {
  colorFn: (v) => (v > 5 ? "#f87171" : v >= 4 ? "#fb923c" : "#4ade80"),
  refLines: [
    { value: 4, label: "Full Employment 4%", labelKr: "완전고용 4%", color: "#facc15" },
    { value: 5, label: "Warning 5%", labelKr: "경고 5%", color: "#f87171" },
  ],
  tooltipLabel: "Unemployment",
  tooltipLabelKr: "실업률",
  minY: 0,
};

function MacroBarChart({
  observations,
  lang,
  config,
}: {
  observations: Observation[];
  lang: string;
  config: BarChartConfig;
}) {
  const W = 900;
  const H = 300;
  const PAD = { top: 16, right: 70, bottom: 30, left: 50 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  if (observations.length < 2) return null;

  const vals = observations.map((d) => d.value);
  const dataMin = Math.min(...vals, config.minY ?? 0);
  const dataMax = Math.max(...vals, ...config.refLines.map(r => r.value + 0.5));
  const rangeY = dataMax - dataMin || 1;
  const toY = (v: number) => PAD.top + ch - ((v - dataMin) / rangeY) * ch;
  const zeroY = toY(config.minY ?? 0);
  const barW = Math.max(2, (cw / observations.length) * 0.7);
  const gap = cw / observations.length;

  const yLabels = Array.from({ length: 5 }, (_, i) => dataMin + (rangeY * i) / 4);
  const step = Math.max(1, Math.floor(observations.length / 10));

  const [hovered, setHovered] = useState<{ idx: number; x: number; y: number } | null>(null);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* Y-axis grid */}
      {yLabels.map((v, i) => {
        const y = PAD.top + ch - (i / 4) * ch;
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#1a1a1a" strokeWidth="1" />
            <text x={PAD.left - 6} y={y + 3} textAnchor="end" fill="#555" fontSize="9">{v.toFixed(1)}%</text>
          </g>
        );
      })}

      {/* Reference lines */}
      {config.refLines.map((ref) => {
        if (dataMin > ref.value || dataMax < ref.value) return null;
        return (
          <g key={ref.value}>
            <line x1={PAD.left} y1={toY(ref.value)} x2={W - PAD.right} y2={toY(ref.value)} stroke={ref.color} strokeWidth="1.5" strokeDasharray="6,4" />
            <text x={W - PAD.right + 4} y={toY(ref.value) + 3} fill={ref.color} fontSize="9">
              {lang === "kr" ? ref.labelKr : ref.label}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {observations.map((obs, i) => {
        const x = PAD.left + i * gap + (gap - barW) / 2;
        const y = obs.value >= (config.minY ?? 0) ? toY(obs.value) : zeroY;
        const h = Math.abs(toY(obs.value) - zeroY);
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(1, h)}
              fill={config.colorFn(obs.value)}
              opacity={hovered?.idx === i ? 1 : 0.85}
              rx={1}
            />
            <rect
              x={PAD.left + i * gap}
              y={PAD.top}
              width={gap}
              height={ch}
              fill="transparent"
              onMouseEnter={() => {
                setHovered({ idx: i, x: x + barW / 2, y: toY(obs.value) - 8 });
              }}
              onMouseLeave={() => setHovered(null)}
            />
          </g>
        );
      })}

      {/* X-axis labels */}
      {observations.filter((_, i) => i % step === 0).map((obs, idx) => (
        <text key={idx} x={PAD.left + (idx * step) * gap + gap / 2} y={H - 8} textAnchor="middle" fill="#444" fontSize="8">
          {obs.date.slice(0, 7)}
        </text>
      ))}

      {/* Tooltip */}
      {hovered && (() => {
        const obs = observations[hovered.idx];
        const label = lang === "kr" ? config.tooltipLabelKr : config.tooltipLabel;
        const txt = `${obs.date.slice(0, 7)}: ${label} ${obs.value.toFixed(1)}%`;
        const txtW = txt.length * 6 + 16;
        return (
          <g>
            <rect
              x={Math.max(PAD.left, Math.min(hovered.x - txtW / 2, W - PAD.right - txtW))}
              y={hovered.y - 26}
              width={txtW}
              height={22}
              rx={4}
              fill="#1a1a1a"
              stroke="#333"
            />
            <text
              x={Math.max(PAD.left + txtW / 2, Math.min(hovered.x, W - PAD.right - txtW / 2))}
              y={hovered.y - 12}
              textAnchor="middle"
              fill="#e8e8e8"
              fontSize="10"
              fontWeight="600"
            >
              {txt}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

// ── Detail Modal ──────────────────────────────────────────────

function DetailModal({
  indicator,
  series,
  onClose,
  lang,
  barChartConfig,
}: {
  indicator: IndicatorConfig;
  series: SeriesData;
  onClose: () => void;
  lang: string;
  barChartConfig?: BarChartConfig;
}) {
  const [range, setRange] = useState<Range>("2Y");
  const barRanges: Range[] = ["1Y", "2Y", "5Y"];
  const defaultRanges: Range[] = ["6M", "1Y", "2Y", "5Y"];
  const ranges = barChartConfig ? barRanges : defaultRanges;
  const filtered = useMemo(
    () => filterByRange(series.observations, range),
    [series.observations, range]
  );
  const zoneColor = indicator.getZoneColor(series.latest);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[900px] rounded-2xl p-6"
        style={{ background: "#0d0d0d", border: "1px solid #222" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 rounded-full" style={{ background: zoneColor }} />
            <div>
              <h2 className="text-base font-bold" style={{ color: "#e8e8e8" }}>
                {lang === "kr" ? indicator.labelKr : indicator.labelEn}
              </h2>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="text-lg font-bold" style={{ color: "#e8e8e8" }}>
                  {fmt(series.latest, indicator.unit)}
                </span>
                <span className="text-xs font-medium" style={{ color: (series.change ?? 0) >= 0 ? "#4ade80" : "#f87171" }}>
                  {fmtChange(series.change ?? 0, indicator.unit)} ({(series.changePercent ?? 0) >= 0 ? "+" : ""}
                  {(series.changePercent ?? 0).toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {ranges.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className="rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors"
                style={{
                  background: range === r ? "rgba(96,165,250,0.15)" : "transparent",
                  color: range === r ? "#60a5fa" : "#666",
                  border: range === r ? "1px solid rgba(96,165,250,0.3)" : "1px solid #222",
                }}
              >
                {r}
              </button>
            ))}
            <button
              onClick={onClose}
              className="ml-2 rounded-md p-1.5 transition-colors hover:bg-white/10"
              style={{ color: "#888" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Chart */}
        <div className="mb-4 rounded-xl p-3" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
          {barChartConfig ? (
            <MacroBarChart observations={filtered} lang={lang} config={barChartConfig} />
          ) : (
            <DetailChart
              observations={filtered}
              color={indicator.sparkColor}
              zones={indicator.zones}
              dashedLines={indicator.dashedLines}
              unit={indicator.unit}
            />
          )}
        </div>

        {/* Explanation */}
        <div className="rounded-xl p-3 sm:p-4" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#666" }}>
            {lang === "kr" ? "해설" : "Analysis"}
          </div>
          <p className="text-[13px] leading-[1.8]" style={{ color: "#ccc" }}>
            {indicator.explanation}
          </p>
          <div className="mt-3 flex gap-3">
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#4ade80" }} />
              <span style={{ color: "#888" }}>{lang === "kr" ? "안전" : "Safe"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#facc15" }} />
              <span style={{ color: "#888" }}>{lang === "kr" ? "주의" : "Caution"}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#f87171" }} />
              <span style={{ color: "#888" }}>{lang === "kr" ? "위험" : "Danger"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sparkline Area (full-width chart for cards) ──────────────

function CardSparkline({ data, id, color = "#60a5fa" }: { data: { date: string; value: number }[] | undefined; id: string; color?: string }) {
  if (!data || data.length < 2) return <div className="h-[100px]" />;
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const W = 400, H = 100, PAD = 8;
  const pts = vals.map((v, i) => ({
    x: PAD + (i / (vals.length - 1)) * (W - PAD * 2),
    y: PAD + (H - PAD * 2) - ((v - min) / range) * (H - PAD * 2),
  }));
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join("");
  const areaPath = linePath + `L${pts[pts.length - 1].x},${H - PAD}L${pts[0].x},${H - PAD}Z`;
  const gradId = `cs-${id}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[100px] w-full">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity="0.15" />
          <stop offset="95%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity="0.8" />
    </svg>
  );
}

// ── Metric Card (Bloomberg monochrome) ───────────────────────

function MetricCard({
  indicator,
  series,
  lang,
  onClick,
}: {
  indicator: IndicatorConfig;
  series: SeriesData;
  lang: string;
  onClick: () => void;
}) {
  const animated = useCountUp(series.latest ?? 0);
  const isUp = (series.changePercent ?? 0) >= 0;
  const status = indicator.getStatus(series.latest ?? 0);
  const interpretation = indicator.getInterpretation(status.label);
  const valueColor = indicator.negativeIsRed && (series.latest ?? 0) < 0 ? "#ef4444" : "#e8e8e8";

  return (
    <button
      onClick={onClick}
      className="group flex flex-col rounded-lg text-left transition-all hover:border-white/20"
      style={{
        background: "#0f0f0f",
        border: "1px solid #2a2a2a",
        borderLeft: `3px solid ${valueColor}`,
        padding: "14px 16px",
        minHeight: "200px",
      }}
    >
      {/* Header: label + status + % badge */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold tracking-wide" style={{ color: "#cccccc" }}>
            {lang === "kr" ? indicator.labelKr : indicator.labelEn}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#888" }}>
            {lang === "kr" ? status.labelKr : status.label}
          </span>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-xs font-mono font-medium"
          style={{
            background: isUp ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            color: isUp ? "#4ade80" : "#f87171",
            border: `1px solid ${isUp ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          }}
        >
          {isUp ? "+" : ""}{(series.changePercent ?? 0).toFixed(2)}%
        </span>
      </div>

      {/* Value */}
      <div>
        <div className="text-2xl font-bold tabular-nums" style={{ color: valueColor }}>
          {fmt(animated, indicator.unit)}
          {indicator.unit === "%" && (
            <span className="ml-0.5 text-sm font-normal" style={{ color: "#555" }}>%</span>
          )}
          {indicator.unit === "pts" && (
            <span className="ml-0.5 text-[11px] font-normal" style={{ color: "#555" }}>pts</span>
          )}
        </div>
        <div className="mt-0.5 text-xs font-medium tabular-nums" style={{ color: "#888" }}>
          {fmtChange(series.change ?? 0, indicator.unit)}
        </div>
      </div>

      {/* Sparkline — full width, fills remaining space */}
      <div className="mt-2 flex-1 w-full">
        <CardSparkline data={series.observations ?? []} id={indicator.id} color={indicator.sparkColor} />
      </div>

      {/* Interpretation */}
      <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "#777" }}>
        {interpretation}
      </p>
    </button>
  );
}

// ── Korea-US Rate Chart ───────────────────────────────────────

function KrUsRateChart({
  bokRate,
  fedRate,
  lang,
}: {
  bokRate: { date: string; value: number }[];
  fedRate: { date: string; value: number }[];
  lang: string;
}) {
  const W = 420, H = 200;
  const PAD = { top: 16, right: 40, bottom: 24, left: 36 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  if (bokRate.length < 2) return null;

  // Align on common dates (last 3 years)
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 3);
  const cutStr = cutoff.toISOString().slice(0, 7);
  const bok = bokRate.filter(o => o.date >= cutStr);
  const fedMap = new Map(fedRate.map(o => [o.date, o.value]));

  const allVals = [...bok.map(o => o.value)];
  for (const o of bok) { const v = fedMap.get(o.date); if (v !== undefined) allVals.push(v); }
  const min = Math.min(...allVals, 0);
  const max = Math.max(...allVals);
  const range = max - min || 1;

  const toPath = (data: { date: string; value: number }[]) =>
    data.map((o, i) => {
      const x = PAD.left + (i / (data.length - 1)) * cw;
      const y = PAD.top + ch - ((o.value - min) / range) * ch;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    }).join("");

  const fedAligned = bok.map(o => ({ date: o.date, value: fedMap.get(o.date) ?? 0 }));

  const yLabels = Array.from({ length: 5 }, (_, i) => min + (range * i) / 4);
  const step = Math.max(1, Math.floor(bok.length / 5));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {yLabels.map((v, i) => {
        const y = PAD.top + ch - (i / 4) * ch;
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#1a1a1a" />
            <text x={PAD.left - 4} y={y + 3} textAnchor="end" fill="#555" fontSize="9">{v.toFixed(1)}</text>
          </g>
        );
      })}
      <path d={toPath(bok)} fill="none" stroke="#f472b6" strokeWidth="2" />
      <path d={toPath(fedAligned)} fill="none" stroke="#60a5fa" strokeWidth="2" />
      {bok.filter((_, i) => i % step === 0).map((o, i) => (
        <text key={i} x={PAD.left + ((i * step) / (bok.length - 1)) * cw} y={H - 6} textAnchor="middle" fill="#444" fontSize="8">{o.date}</text>
      ))}
      <rect x={PAD.left} y={4} width="6" height="2" rx="1" fill="#f472b6" />
      <text x={PAD.left + 10} y={8} fill="#f472b6" fontSize="8">{lang === "kr" ? "한국" : "BOK"}</text>
      <rect x={PAD.left + 50} y={4} width="6" height="2" rx="1" fill="#60a5fa" />
      <text x={PAD.left + 60} y={8} fill="#60a5fa" fontSize="8">Fed</text>
    </svg>
  );
}


// ── CPI Comparison Chart ──────────────────────────────────────

function CpiComparisonChart({
  krCpi,
  usCpi,
  lang,
}: {
  krCpi: { date: string; value: number }[];
  usCpi: { date: string; value: number }[];
  lang: string;
}) {
  const W = 420, H = 200;
  const PAD = { top: 16, right: 40, bottom: 24, left: 36 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  if (krCpi.length < 2 && usCpi.length < 2) return null;

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 3);
  const cutStr = cutoff.toISOString().slice(0, 7);
  const kr = krCpi.filter(o => o.date >= cutStr);
  const usMap = new Map(usCpi.map(o => [o.date.slice(0, 7), o.value]));

  // Build aligned data
  const aligned: { date: string; krV: number; usV: number | null }[] = [];
  for (const o of kr) {
    const u = usMap.get(o.date);
    aligned.push({ date: o.date, krV: o.value, usV: u ?? null });
  }

  if (aligned.length < 2) return null;

  const allVals = [...aligned.map(o => o.krV), ...aligned.filter(o => o.usV !== null).map(o => o.usV as number)];
  const min = Math.min(...allVals, 0);
  const max = Math.max(...allVals);
  const range = max - min || 1;

  const toPath = (data: { x: number; y: number }[]) =>
    data.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join("");

  const krPoints = aligned.map((o, i) => ({
    x: PAD.left + (i / (aligned.length - 1)) * cw,
    y: PAD.top + ch - ((o.krV - min) / range) * ch,
  }));

  const usPoints = aligned
    .map((o, i) => o.usV !== null ? ({
      x: PAD.left + (i / (aligned.length - 1)) * cw,
      y: PAD.top + ch - ((o.usV - min) / range) * ch,
    }) : null)
    .filter((p): p is { x: number; y: number } => p !== null);

  const yLabels = Array.from({ length: 5 }, (_, i) => min + (range * i) / 4);
  const step = Math.max(1, Math.floor(aligned.length / 5));

  // 2% target line
  const target2Y = PAD.top + ch - ((2 - min) / range) * ch;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {yLabels.map((v, i) => {
        const y = PAD.top + ch - (i / 4) * ch;
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#1a1a1a" />
            <text x={PAD.left - 4} y={y + 3} textAnchor="end" fill="#555" fontSize="9">{v.toFixed(1)}%</text>
          </g>
        );
      })}
      {/* 2% target dashed line */}
      {min <= 2 && max >= 2 && (
        <line x1={PAD.left} y1={target2Y} x2={W - PAD.right} y2={target2Y} stroke="#4ade80" strokeDasharray="4,3" opacity="0.5" />
      )}
      <path d={toPath(krPoints)} fill="none" stroke="#f472b6" strokeWidth="2" />
      {usPoints.length > 1 && <path d={toPath(usPoints)} fill="none" stroke="#60a5fa" strokeWidth="2" />}
      {aligned.filter((_, i) => i % step === 0).map((o, i) => (
        <text key={i} x={PAD.left + ((i * step) / (aligned.length - 1)) * cw} y={H - 6} textAnchor="middle" fill="#444" fontSize="8">{o.date}</text>
      ))}
      <rect x={PAD.left} y={4} width="6" height="2" rx="1" fill="#f472b6" />
      <text x={PAD.left + 10} y={8} fill="#f472b6" fontSize="8">{lang === "kr" ? "한국 CPI" : "Korea CPI"}</text>
      <rect x={PAD.left + 60} y={4} width="6" height="2" rx="1" fill="#60a5fa" />
      <text x={PAD.left + 70} y={8} fill="#60a5fa" fontSize="8">{lang === "kr" ? "미국 CPI" : "US CPI"}</text>
      {min <= 2 && max >= 2 && (
        <text x={W - PAD.right - 2} y={target2Y - 4} textAnchor="end" fill="#4ade80" fontSize="7" opacity="0.7">Target 2%</text>
      )}
    </svg>
  );
}

// ── Fear & Greed helpers ─────────────────────────────────────

function fgColor(score: number): string {
  if (score <= 25) return "#ef4444";
  if (score <= 45) return "#f97316";
  if (score <= 55) return "#eab308";
  if (score <= 75) return "#84cc16";
  return "#22c55e";
}

function fgLabelKr(score: number): string {
  if (score <= 25) return "극도 공포";
  if (score <= 45) return "공포";
  if (score <= 55) return "중립";
  if (score <= 75) return "탐욕";
  return "극도 탐욕";
}

function fgLabelEn(score: number): string {
  if (score <= 25) return "Extreme Fear";
  if (score <= 45) return "Fear";
  if (score <= 55) return "Neutral";
  if (score <= 75) return "Greed";
  return "Extreme Greed";
}

// ── Fear & Greed Gauge (speedometer) ─────────────────────────

function FearGreedGauge({ score, lang }: { score: number; lang: string }) {
  const W = 280, H = 170;
  const cx = W / 2, cy = 140;
  const r = 110;
  // Arc from 180° to 0° (left to right)
  const startAngle = Math.PI;
  const endAngle = 0;
  const needleAngle = startAngle - (score / 100) * Math.PI;

  // Gradient arcs: 5 zones
  const zones = [
    { from: 0, to: 25, color: "#ef4444" },
    { from: 25, to: 45, color: "#f97316" },
    { from: 45, to: 55, color: "#eab308" },
    { from: 55, to: 75, color: "#84cc16" },
    { from: 75, to: 100, color: "#22c55e" },
  ];

  const arcPath = (s: number, e: number) => {
    const a1 = startAngle - (s / 100) * Math.PI;
    const a2 = startAngle - (e / 100) * Math.PI;
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy - r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy - r * Math.sin(a2);
    const largeArc = (a1 - a2) > Math.PI ? 1 : 0;
    return `M${x1},${y1} A${r},${r} 0 ${largeArc} 0 ${x2},${y2}`;
  };

  const nx = cx + (r - 20) * Math.cos(needleAngle);
  const ny = cy - (r - 20) * Math.sin(needleAngle);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxWidth: 280 }}>
      {/* Zone arcs */}
      {zones.map((z, i) => (
        <path key={i} d={arcPath(z.from, z.to)} fill="none" stroke={z.color} strokeWidth="18" strokeLinecap="butt" opacity="0.7" />
      ))}
      {/* Needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e8e8e8" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill="#e8e8e8" />
      {/* Score text */}
      <text x={cx} y={cy - 30} textAnchor="middle" fill={fgColor(score)} fontSize="36" fontWeight="800">{score}</text>
      <text x={cx} y={cy - 10} textAnchor="middle" fill={fgColor(score)} fontSize="13" fontWeight="600">
        {lang === "kr" ? fgLabelKr(score) : fgLabelEn(score)}
      </text>
      {/* Min/Max labels */}
      <text x={cx - r + 5} y={cy + 14} textAnchor="middle" fill="#555" fontSize="9">0</text>
      <text x={cx + r - 5} y={cy + 14} textAnchor="middle" fill="#555" fontSize="9">100</text>
    </svg>
  );
}

// ── Fear & Greed History Chart ───────────────────────────────

function FearGreedHistoryChart({ history }: { history: { date: string; score: number }[] }) {
  const W = 420, H = 200;
  const PAD = { top: 12, right: 16, bottom: 24, left: 32 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  if (history.length < 2) return null;

  const toX = (i: number) => PAD.left + (i / (history.length - 1)) * cw;
  const toY = (v: number) => PAD.top + ch - (v / 100) * ch;

  const linePath = history.map((p, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(p.score)}`).join("");
  const last = history[history.length - 1];
  const step = Math.max(1, Math.floor(history.length / 5));

  // Zone bands
  const zones = [
    { from: 0, to: 25, color: "rgba(239,68,68,0.08)" },
    { from: 25, to: 45, color: "rgba(249,115,22,0.06)" },
    { from: 45, to: 55, color: "rgba(234,179,8,0.05)" },
    { from: 55, to: 75, color: "rgba(132,204,22,0.06)" },
    { from: 75, to: 100, color: "rgba(34,197,94,0.08)" },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* Zone bands */}
      {zones.map((z, i) => (
        <rect key={i} x={PAD.left} y={toY(z.to)} width={cw} height={toY(z.from) - toY(z.to)} fill={z.color} />
      ))}
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={PAD.left} y1={toY(v)} x2={W - PAD.right} y2={toY(v)} stroke="#1a1a1a" />
          <text x={PAD.left - 4} y={toY(v) + 3} textAnchor="end" fill="#555" fontSize="9">{v}</text>
        </g>
      ))}
      {/* Line */}
      <path d={linePath} fill="none" stroke="#e8e8e8" strokeWidth="2" />
      {/* Current dot */}
      <circle cx={toX(history.length - 1)} cy={toY(last.score)} r="4" fill={fgColor(last.score)} stroke="#111" strokeWidth="1.5" />
      {/* X labels */}
      {history.filter((_, i) => i % step === 0).map((p, idx) => (
        <text key={idx} x={toX(idx * step)} y={H - 6} textAnchor="middle" fill="#444" fontSize="8">{p.date.slice(5)}</text>
      ))}
    </svg>
  );
}

function SkeletonCard({ large }: { large?: boolean }) {
  return (
    <div
      className={`animate-pulse rounded-xl ${large ? "p-5" : "p-4"}`}
      style={{ background: "#111111", border: "1px solid #222222", borderLeft: "4px solid #333" }}
    >
      <div className="mb-2 h-3 w-20 rounded" style={{ background: "#1a1a1a" }} />
      <div className={`${large ? "h-8" : "h-6"} w-24 rounded`} style={{ background: "#1a1a1a" }} />
      <div className="mt-2 h-3 w-16 rounded" style={{ background: "#1a1a1a" }} />
    </div>
  );
}

// ── Mini Sparkline ───────────────────────────────────────────

function MiniSparkline({ data, color, width = 80, height = 28 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  }).join("");
  return (
    <svg width={width} height={height} className="shrink-0">
      <path d={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// ── FX 3-Month Chart Modal ──────────────────────────────────

function FxChartModal({
  pair,
  onClose,
  lang,
}: {
  pair: FxData;
  onClose: () => void;
  lang: string;
}) {
  const [history, setHistory] = useState<{ date: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // We'll use the sparkline data we have + fetch extended from FRED via the fx endpoint
        // For now, show sparkline data as a placeholder
        // Actually let's just show what we have - the sparkline is 7 points
        // We can display it larger
        const sl = pair.sparkline ?? [];
        setHistory(sl.map((v, i) => ({ date: `D-${sl.length - 1 - i}`, value: v })));
      } catch { /* */ } finally {
        setLoading(false);
      }
    })();
  }, [pair]);

  const W = 400, H = 200;
  const PAD = { top: 16, right: 12, bottom: 24, left: 50 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  const min = history.length > 0 ? Math.min(...history.map(o => o.value)) : 0;
  const max = history.length > 0 ? Math.max(...history.map(o => o.value)) : 1;
  const range = max - min || 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl p-5" style={{ background: "#111", border: "1px solid #333" }} onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold" style={{ color: "#e8e8e8" }}>
            {pair.flag} {lang === "kr" ? pair.labelKr : pair.label}
          </h3>
          <button onClick={onClose} className="text-muted hover:text-foreground text-lg">&times;</button>
        </div>
        {loading ? (
          <div className="flex h-[200px] items-center justify-center"><span style={{ color: "#444" }}>Loading...</span></div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {Array.from({ length: 5 }, (_, i) => {
              const y = PAD.top + ch - (i / 4) * ch;
              const v = min + (range * i) / 4;
              return (
                <g key={i}>
                  <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#1a1a1a" />
                  <text x={PAD.left - 4} y={y + 3} textAnchor="end" fill="#555" fontSize="9">{v.toFixed(v >= 100 ? 0 : 2)}</text>
                </g>
              );
            })}
            {history.length > 1 && (
              <path
                d={history.map((o, i) => {
                  const x = PAD.left + (i / (history.length - 1)) * cw;
                  const y = PAD.top + ch - ((o.value - min) / range) * ch;
                  return `${i === 0 ? "M" : "L"}${x},${y}`;
                }).join("")}
                fill="none"
                stroke="#60a5fa"
                strokeWidth="2"
              />
            )}
            {history.filter((_, i) => i % Math.max(1, Math.floor(history.length / 6)) === 0).map((o, idx) => {
              const step = Math.max(1, Math.floor(history.length / 6));
              const i = idx * step;
              return (
                <text key={idx} x={PAD.left + (i / (history.length - 1)) * cw} y={H - 6} textAnchor="middle" fill="#444" fontSize="8">{o.date}</text>
              );
            })}
          </svg>
        )}
        <div className="mt-2 text-center text-[11px]" style={{ color: "#666" }}>
          {lang === "kr" ? "최근 데이터 기준" : "Based on recent data"}
        </div>
      </div>
    </div>
  );
}

// ── PER Chart ─────────────────────────────────────────────────

type PeRange = "1Y" | "3Y" | "5Y" | "MAX";
const PE_RANGES: PeRange[] = ["1Y", "3Y", "5Y", "MAX"];

interface PeEntry {
  date: string;
  pe: number;
}

function filterPeByRange(data: PeEntry[], range: PeRange): PeEntry[] {
  if (range === "MAX") return data;
  const months = range === "1Y" ? 12 : range === "3Y" ? 36 : 60;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutStr = cutoff.toISOString().slice(0, 10);
  return data.filter((d) => d.date >= cutStr);
}

function getPeStatus(pe: number): { label: string; color: string } {
  if (pe > 25) return { label: "고평가", color: "#f87171" };
  if (pe >= 15) return { label: "적정", color: "#facc15" };
  return { label: "저평가", color: "#4ade80" };
}

function PERChart({
  title,
  data,
  lang,
}: {
  title: string;
  data: PeEntry[];
  lang: string;
}) {
  const [range, setRange] = useState<PeRange>("5Y");
  const filtered = filterPeByRange(data, range);
  const current = filtered.length > 0 ? filtered[filtered.length - 1].pe : null;
  const avg = filtered.length > 0 ? Math.round((filtered.reduce((s, d) => s + d.pe, 0) / filtered.length) * 10) / 10 : null;
  const status = current != null ? getPeStatus(current) : null;

  // Thin out data for performance (max 300 pts)
  const step = Math.max(1, Math.floor(filtered.length / 300));
  const chartData = filtered.filter((_, i) => i % step === 0 || i === filtered.length - 1);

  const yMin = chartData.length > 0 ? Math.floor(Math.min(...chartData.map((d) => d.pe)) - 2) : 0;
  const yMax = chartData.length > 0 ? Math.ceil(Math.max(...chartData.map((d) => d.pe)) + 2) : 50;

  const xLabels = chartData
    .filter((_, i) => {
      const total = chartData.length;
      const step2 = Math.max(1, Math.floor(total / 5));
      return i % step2 === 0;
    })
    .map((d) => d.date.slice(0, 7));

  return (
    <div className="rounded-xl p-3 sm:p-4" style={{ background: "#111", border: "1px solid #222" }}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-semibold" style={{ color: "#ccc" }}>{title}</h3>
          {current != null && (
            <span className="text-xl font-bold tabular-nums" style={{ color: "#e8e8e8" }}>
              {current.toFixed(1)}x
            </span>
          )}
          {status && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
              style={{ background: `${status.color}22`, color: status.color, border: `1px solid ${status.color}55` }}
            >
              {status.label}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {PE_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="rounded px-2 py-0.5 text-[10px] font-medium transition-colors"
              style={{
                color: range === r ? "#e8e8e8" : "#555",
                borderBottom: range === r ? "1px solid #e8e8e8" : "1px solid transparent",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {chartData.length < 2 ? (
        <div className="flex h-[180px] items-center justify-center" style={{ color: "#555" }}>
          <span className="text-xs">{lang === "kr" ? "데이터 없음" : "No data"}</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            {/* Color zones */}
            <ReferenceArea y1={yMin} y2={15} fill="rgba(74,222,128,0.05)" />
            <ReferenceArea y1={15} y2={25} fill="rgba(250,204,21,0.03)" />
            <ReferenceArea y1={25} y2={yMax} fill="rgba(248,113,113,0.05)" />

            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => v.slice(0, 7)}
              ticks={xLabels}
              tick={{ fill: "#444", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fill: "#444", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={28}
              tickFormatter={(v: number) => `${v}x`}
            />
            <Tooltip
              contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, fontSize: 11 }}
              labelStyle={{ color: "#888" }}
              formatter={(value: number | undefined) => value != null ? [`${value.toFixed(1)}x`, lang === "kr" ? "현재 PER" : "P/E"] : ["—", lang === "kr" ? "현재 PER" : "P/E"]}
            />
            {/* Historical average dashed line */}
            {avg != null && (
              <ReferenceLine
                y={avg}
                stroke="#555"
                strokeDasharray="6 3"
                label={{ value: `${lang === "kr" ? "역사적 평균" : "Avg"} ${avg}x`, fill: "#666", fontSize: 9, position: "insideTopRight" }}
              />
            )}
            {/* Zone reference lines */}
            <ReferenceLine y={15} stroke="rgba(74,222,128,0.3)" strokeDasharray="4 3" />
            <ReferenceLine y={25} stroke="rgba(248,113,113,0.3)" strokeDasharray="4 3" />
            <Line
              type="monotone"
              dataKey="pe"
              stroke="#60a5fa"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: "#60a5fa" }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      <div className="mt-2 flex gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "#666" }}>
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#4ade80" }} />
          {lang === "kr" ? "저평가 (<15x)" : "Undervalued (<15x)"}
        </div>
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "#666" }}>
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#facc15" }} />
          {lang === "kr" ? "적정 (15-25x)" : "Fair (15-25x)"}
        </div>
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "#666" }}>
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#f87171" }} />
          {lang === "kr" ? "고평가 (>25x)" : "Overvalued (>25x)"}
        </div>
        {avg != null && (
          <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "#666" }}>
            <span className="inline-block h-[1px] w-4" style={{ background: "#555", borderTop: "1px dashed #555" }} />
            {lang === "kr" ? `역사적 평균 ${avg}x` : `Hist. Avg ${avg}x`}
          </div>
        )}
      </div>
    </div>
  );
}

// ── CAPE Chart ────────────────────────────────────────────────

type CapeRange = "5Y" | "10Y" | "30Y" | "MAX";
const CAPE_RANGES: CapeRange[] = ["5Y", "10Y", "30Y", "MAX"];

interface CapeEntry {
  date: string;
  cape: number;
}

function filterCapeByRange(data: CapeEntry[], range: CapeRange): CapeEntry[] {
  if (range === "MAX") return data;
  const years = range === "5Y" ? 5 : range === "10Y" ? 10 : 30;
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const cutStr = cutoff.toISOString().slice(0, 10);
  return data.filter((d) => d.date >= cutStr);
}

function getCapeStatus(cape: number): { label: string; color: string } {
  if (cape > 35) return { label: "버블 경고", color: "#f87171" };
  if (cape > 25) return { label: "고평가", color: "#fb923c" };
  if (cape >= 15) return { label: "적정", color: "#facc15" };
  return { label: "저평가", color: "#4ade80" };
}

function CAPEChart({
  data,
  average,
  lang,
}: {
  data: CapeEntry[];
  average: number | null;
  lang: string;
}) {
  const [range, setRange] = useState<CapeRange>("MAX");
  const filtered = filterCapeByRange(data, range);
  const current = filtered.length > 0 ? filtered[filtered.length - 1].cape : null;
  const localAvg = filtered.length > 0
    ? Math.round((filtered.reduce((s, d) => s + d.cape, 0) / filtered.length) * 10) / 10
    : null;
  const histAvg = average ?? localAvg;
  const status = current != null ? getCapeStatus(current) : null;
  const pctVsAvg = current != null && histAvg != null && histAvg > 0
    ? Math.round(((current - histAvg) / histAvg) * 1000) / 10
    : null;

  // Thin data for performance
  const step = Math.max(1, Math.floor(filtered.length / 400));
  const chartData = filtered.filter((_, i) => i % step === 0 || i === filtered.length - 1);

  const yMin = chartData.length > 0 ? Math.floor(Math.min(...chartData.map((d) => d.cape)) - 2) : 0;
  const yMax = chartData.length > 0 ? Math.ceil(Math.max(...chartData.map((d) => d.cape)) + 2) : 50;

  const xLabelCount = 7;
  const xStep = Math.max(1, Math.floor(chartData.length / xLabelCount));
  const xTicks = chartData.filter((_, i) => i % xStep === 0).map((d) => d.date);

  return (
    <div className="rounded-xl p-3 sm:p-4" style={{ background: "#111", border: "1px solid #222" }}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-xs font-semibold" style={{ color: "#ccc" }}>
            {lang === "kr" ? "실러 CAPE (경기조정 PER)" : "Shiller CAPE Ratio"}
          </h3>
          {current != null && (
            <span className="text-xl font-bold tabular-nums" style={{ color: "#e8e8e8" }}>
              {current.toFixed(1)}x
            </span>
          )}
          {status && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
              style={{ background: `${status.color}22`, color: status.color, border: `1px solid ${status.color}55` }}
            >
              {status.label}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {CAPE_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="rounded px-2 py-0.5 text-[10px] font-medium transition-colors"
              style={{
                color: range === r ? "#e8e8e8" : "#555",
                borderBottom: range === r ? "1px solid #e8e8e8" : "1px solid transparent",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {chartData.length < 2 ? (
        <div className="flex h-[220px] items-center justify-center" style={{ color: "#555" }}>
          <span className="text-xs">{lang === "kr" ? "데이터 없음" : "No data"}</span>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            {/* Color zones */}
            <ReferenceArea y1={yMin} y2={15} fill="rgba(74,222,128,0.05)" />
            <ReferenceArea y1={15} y2={25} fill="rgba(255,255,255,0.01)" />
            <ReferenceArea y1={25} y2={35} fill="rgba(251,146,60,0.05)" />
            <ReferenceArea y1={35} y2={yMax} fill="rgba(248,113,113,0.07)" />

            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
            <XAxis
              dataKey="date"
              ticks={xTicks}
              tickFormatter={(v: string) => v.slice(0, 7)}
              tick={{ fill: "#444", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fill: "#444", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={28}
              tickFormatter={(v: number) => `${v}x`}
            />
            <Tooltip
              contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, fontSize: 11 }}
              labelStyle={{ color: "#888" }}
              formatter={(value: number | undefined) => {
                if (value == null) return ["—", "CAPE"];
                const diff = histAvg != null && histAvg > 0
                  ? ` (평균 대비 ${value > histAvg ? "+" : ""}${Math.round(((value - histAvg) / histAvg) * 1000) / 10}%)`
                  : "";
                return [`${value.toFixed(1)}x${diff}`, lang === "kr" ? "실러 CAPE" : "Shiller CAPE"];
              }}
            />
            {/* Historical average */}
            {histAvg != null && (
              <ReferenceLine
                y={histAvg}
                stroke="#555"
                strokeDasharray="6 3"
                label={{ value: `${lang === "kr" ? "역사적 평균" : "Hist. Avg"} ${histAvg}x`, fill: "#666", fontSize: 9, position: "insideTopRight" }}
              />
            )}
            {/* Zone boundaries */}
            <ReferenceLine y={15} stroke="rgba(74,222,128,0.3)" strokeDasharray="4 3" />
            <ReferenceLine y={25} stroke="rgba(251,146,60,0.25)" strokeDasharray="4 3" />
            <ReferenceLine y={35} stroke="rgba(248,113,113,0.35)" strokeDasharray="4 3" />
            <Line
              type="monotone"
              dataKey="cape"
              stroke="#a78bfa"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: "#a78bfa" }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      <div className="mt-2 flex gap-4 flex-wrap">
        {[
          { color: "#4ade80", label: lang === "kr" ? "저평가 (<15x)" : "Undervalued (<15x)" },
          { color: "#facc15", label: lang === "kr" ? "적정 (15-25x)" : "Fair (15-25x)" },
          { color: "#fb923c", label: lang === "kr" ? "고평가 (25-35x)" : "Elevated (25-35x)" },
          { color: "#f87171", label: lang === "kr" ? "버블 경고 (>35x)" : "Bubble (>35x)" },
        ].map((z) => (
          <div key={z.label} className="flex items-center gap-1.5 text-[10px]" style={{ color: "#666" }}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: z.color }} />
            {z.label}
          </div>
        ))}
      </div>

      {/* Info box */}
      {current != null && histAvg != null && (
        <div
          className="mt-3 rounded-lg p-3"
          style={{ background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.12)", borderLeft: "3px solid rgba(167,139,250,0.3)" }}
        >
          <p className="text-[11px] leading-[1.7]" style={{ color: "#999" }}>
            {lang === "kr"
              ? `CAPE(실러 PER)는 인플레이션 조정 후 10년 평균 이익 기준 밸류에이션 지표입니다. 역사적 평균은 약 ${histAvg}배이며, 현재 ${current.toFixed(1)}배는 평균 대비 ${pctVsAvg != null ? (pctVsAvg > 0 ? "+" : "") + pctVsAvg + "%" : "—"} 수준입니다.`
              : `The CAPE (Shiller P/E) measures valuation using inflation-adjusted 10-year average earnings. The historical average is ~${histAvg}x; the current ${current.toFixed(1)}x is ${pctVsAvg != null ? (pctVsAvg > 0 ? "+" : "") + pctVsAvg + "% vs average" : "—"}.`}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

type MacroTab = "indicators" | "liquidity" | "rrg" | "commodities";

export default function MacroPage() {
  const { lang } = useLang();
  const [activeTab, setActiveTab] = useState<MacroTab>("indicators");
  const [seriesFull, setSeriesFull] = useState<Record<string, SeriesData>>({});
  const [loading, setLoading] = useState(true);
  const [cardRange, setCardRange] = useState<CardRange>("1Y");
  const [modalId, setModalId] = useState<string | null>(null);
  const [bokSeries, setBokSeries] = useState<Record<string, { observations: { date: string; value: number }[]; latest: number; previous: number; change: number }>>({});
  const [bokLoading, setBokLoading] = useState(true);
  const [fearGreed, setFearGreed] = useState<FearGreedData | null>(null);
  const [fgLoading, setFgLoading] = useState(true);
  const [fxData, setFxData] = useState<FxData[]>([]);
  const [fxLoading, setFxLoading] = useState(true);
  const [fxModal, setFxModal] = useState<FxData | null>(null);
  const [commodities, setCommodities] = useState<CommodityData[]>([]);
  const [comLoading, setComLoading] = useState(true);
  const [comTooltip, setComTooltip] = useState<string | null>(null);
  const [liveUsdKrw, setLiveUsdKrw] = useState<number | null>(null);
  const [comparisonUpdatedAt, setComparisonUpdatedAt] = useState<string>("");
  const [peData, setPeData] = useState<{ sp500: PeEntry[]; nasdaq: PeEntry[] } | null>(null);
  const [peLoading, setPeLoading] = useState(true);
  const [capeData, setCapeData] = useState<{ data: CapeEntry[]; current: number | null; average: number | null } | null>(null);
  const [capeLoading, setCapeLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/macro/fred");
      const json = await res.json();
      if (json.ok) {
        setSeriesFull(json.series || {});
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMarketPE = useCallback(async () => {
    try {
      const res = await fetch("/api/macro/market-pe");
      const json = await res.json();
      if (json.ok) {
        setPeData({ sp500: json.sp500 || [], nasdaq: json.nasdaq || [] });
      }
    } catch { /* silent */ } finally {
      setPeLoading(false);
    }
  }, []);

  const fetchCape = useCallback(async () => {
    try {
      const res = await fetch("/api/macro/cape");
      const json = await res.json();
      if (json.ok) {
        setCapeData({ data: json.data || [], current: json.current ?? null, average: json.average ?? null });
      }
    } catch { /* silent */ } finally {
      setCapeLoading(false);
    }
  }, []);

  const fetchBok = useCallback(async () => {
    try {
      const res = await fetch("/api/macro/bok");
      const json = await res.json();
      if (json.ok) {
        setBokSeries(json.series || {});
        if (json.liveUsdKrw != null) setLiveUsdKrw(json.liveUsdKrw);
        if (json.updatedAt) setComparisonUpdatedAt(json.updatedAt);
      }
    } catch { /* silent */ } finally {
      setBokLoading(false);
    }
  }, []);

  const fetchFearGreed = useCallback(async () => {
    try {
      const res = await fetch("/api/macro/fear-greed");
      const json = await res.json();
      if (json.ok) setFearGreed(json.data);
    } catch { /* silent */ } finally {
      setFgLoading(false);
    }
  }, []);

  const fxDataRef = useRef<FxData[]>([]);

  const fetchFx = useCallback(async () => {
    try {
      // 1. Load FRED baseline once (for sparklines + cross-rate history)
      if (fxDataRef.current.length === 0) {
        try {
          const fredRes = await fetch("/api/macro/fx");
          const fredJson = await fredRes.json();
          if (fredJson.ok && fredJson.data) {
            fxDataRef.current = fredJson.data;
          }
        } catch { /* FRED optional */ }
      }

      // 2. Fetch live rates from ticker API (same source as ticker tape)
      const tickerRes = await fetch("/api/ticker");
      const tickerJson = await tickerRes.json();
      if (!(tickerJson.ok || tickerJson.market) || !tickerJson.market) {
        // Ticker failed — fall back to FRED baseline if available
        if (fxDataRef.current.length > 0 && fxData.length === 0) {
          setFxData(fxDataRef.current);
        }
        return;
      }

      const fxItems = (tickerJson.market as { type: string; label: string; value: number | null; changePct: number | null }[])
        .filter((m) => m.type === "FX" && m.value != null);

      if (fxItems.length === 0) {
        if (fxDataRef.current.length > 0 && fxData.length === 0) {
          setFxData(fxDataRef.current);
        }
        return;
      }

      // Build live lookup
      const liveMap = new Map<string, { value: number; changePct: number }>();
      for (const item of fxItems) {
        liveMap.set(item.label, { value: item.value!, changePct: item.changePct ?? 0 });
      }

      const usdkrw = liveMap.get("USD/KRW");
      const usdjpy = liveMap.get("USD/JPY");
      const eurusd = liveMap.get("EUR/USD");

      if (fxDataRef.current.length > 0) {
        // Overlay live rates on FRED baseline (keeps sparklines)
        setFxData(fxDataRef.current.map((pair) => {
          if (pair.id === "USDKRW" && usdkrw) {
            const change = usdkrw.value - pair.previous;
            return { ...pair, current: usdkrw.value, change: Math.round(change * 100) / 100, changePercent: Math.round(usdkrw.changePct * 100) / 100 };
          }
          if (pair.id === "JPYKRW" && usdkrw && usdjpy) {
            const live = Math.round((usdkrw.value / usdjpy.value) * 100) / 100;
            const change = live - pair.previous;
            const pct = pair.previous !== 0 ? (change / Math.abs(pair.previous)) * 100 : 0;
            return { ...pair, current: live, change: Math.round(change * 100) / 100, changePercent: Math.round(pct * 100) / 100 };
          }
          if (pair.id === "EURKRW" && usdkrw && eurusd) {
            const live = Math.round(usdkrw.value * eurusd.value * 100) / 100;
            const change = live - pair.previous;
            const pct = pair.previous !== 0 ? (change / Math.abs(pair.previous)) * 100 : 0;
            return { ...pair, current: live, change: Math.round(change * 100) / 100, changePercent: Math.round(pct * 100) / 100 };
          }
          return pair;
        }));
      } else {
        // No FRED data — build FX cards purely from ticker
        const built: FxData[] = [];
        if (usdkrw) {
          built.push({ id: "USDKRW", label: "USD/KRW", labelKr: "원달러", flag: "\u{1F1FA}\u{1F1F8}", current: usdkrw.value, previous: 0, change: 0, changePercent: usdkrw.changePct, sparkline: [] });
        }
        if (usdkrw && usdjpy) {
          const val = Math.round((usdkrw.value / usdjpy.value) * 100) / 100;
          built.push({ id: "JPYKRW", label: "JPY/KRW", labelKr: "엔원", flag: "\u{1F1EF}\u{1F1F5}", current: val, previous: 0, change: 0, changePercent: 0, sparkline: [] });
        }
        if (usdkrw && eurusd) {
          const val = Math.round(usdkrw.value * eurusd.value * 100) / 100;
          built.push({ id: "EURKRW", label: "EUR/KRW", labelKr: "유로원", flag: "\u{1F1EA}\u{1F1FA}", current: val, previous: 0, change: 0, changePercent: 0, sparkline: [] });
        }
        if (built.length > 0) setFxData(built);
      }
    } catch { /* silent */ } finally {
      setFxLoading(false);
    }
  }, []);

  const fetchCommodities = useCallback(async () => {
    try {
      const res = await fetch("/api/macro/commodities");
      const json = await res.json();
      if (json.ok) setCommodities((json.data || []).map((d: Record<string, unknown>) => ({
        ...d,
        current: d.price ?? d.current,
        previous: d.prevClose ?? d.previous,
        sparkline: Array.isArray(d.history)
          ? (d.history as { date: string; close: number }[]).map(h => h.close)
          : [],
      })));
    } catch { /* silent */ } finally {
      setComLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchBok();
    fetchFearGreed();
    fetchFx();
    fetchCommodities();
    fetchMarketPE();
    fetchCape();
  }, [fetchData, fetchBok, fetchFearGreed, fetchFx, fetchCommodities, fetchMarketPE, fetchCape]);

  // Auto-refresh FX rates every 60 seconds (same interval as ticker tape)
  useEffect(() => {
    const id = setInterval(fetchFx, 60_000);
    return () => clearInterval(id);
  }, [fetchFx]);

  // Filter series observations by selected card range
  const series = useMemo(() => {
    const cutoffMonths = CARD_RANGE_MONTHS[cardRange];
    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth() - cutoffMonths, now.getDate());
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const filtered: Record<string, SeriesData> = {};
    for (const [key, sd] of Object.entries(seriesFull)) {
      const obs = sd.observations.filter((o) => o.date >= cutoffStr);
      filtered[key] = { ...sd, observations: obs };
    }
    return filtered;
  }, [seriesFull, cardRange]);

  return (
    <div className="min-h-screen font-[family-name:var(--font-noto-sans-kr)]" style={{ background: "#0a0a0a" }}>
      <AppHeader active="macro" />

      <main className="w-full px-2 sm:px-4 py-3 sm:py-6">
        {/* ── Tab Navigation ─────────────────────────────────── */}
        <div className="mb-4 sm:mb-6 flex gap-1 border-b overflow-x-auto scrollbar-none" style={{ borderColor: "#222" }}>
          {([
            { key: "indicators" as MacroTab, labelKr: "매크로 지표", labelEn: "Macro Indicators" },
            { key: "liquidity" as MacroTab, labelKr: "유동성", labelEn: "Liquidity" },
            { key: "rrg" as MacroTab, labelKr: "RRG", labelEn: "RRG" },
            { key: "commodities" as MacroTab, labelKr: "원자재", labelEn: "Commodities" },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition-colors relative whitespace-nowrap"
              style={{
                color: activeTab === tab.key ? "#f59e0b" : "#666",
                borderBottom: activeTab === tab.key ? "2px solid #f59e0b" : "2px solid transparent",
                marginBottom: "-1px",
              }}
            >
              {lang === "kr" ? tab.labelKr : tab.labelEn}
            </button>
          ))}
        </div>

        {/* ── Liquidity Tab ────────────────────────────────────── */}
        {activeTab === "liquidity" && <LiquidityDashboard />}

        {/* ── RRG Tab ──────────────────────────────────────────── */}
        {activeTab === "rrg" && <RRGChart />}

        {/* ── Commodities Tab ────────────────────────────────── */}
        {activeTab === "commodities" && <MacroProContent />}

        {/* ── Macro Indicators Tab ─────────────────────────────── */}
        {activeTab === "indicators" && (<>
        {/* ── Fear & Greed Index Section ─────────────────────── */}
        <div className="mb-4">
          <h2 className="mb-3 text-sm font-bold tracking-wider uppercase" style={{ color: "#aaaaaa" }}>
            {lang === "kr" ? "시장 심리 지수" : "Market Sentiment Index"}
          </h2>

          {fgLoading ? (
            <div className="flex h-[260px] items-center justify-center rounded-xl animate-pulse" style={{ background: "#111", border: "1px solid #222" }}>
              <span style={{ color: "#444" }}>{lang === "kr" ? "심리 지수 로딩중..." : "Loading sentiment data..."}</span>
            </div>
          ) : fearGreed ? (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Left: Gauge */}
                <div className="rounded-xl p-3 sm:p-4" style={{ background: "#111", border: "1px solid #222" }}>
                  <h3 className="mb-2 text-xs font-semibold" style={{ color: "#ccc" }}>
                    CNN Fear & Greed Index
                  </h3>
                  <div className="flex justify-center">
                    <FearGreedGauge score={fearGreed.score} lang={lang} />
                  </div>
                  {/* Previous values */}
                  <div className="mt-3 flex justify-center gap-3 sm:gap-6">
                    {[
                      { label: lang === "kr" ? "전일" : "Prev Close", value: fearGreed.previousClose },
                      { label: lang === "kr" ? "1주전" : "1W Ago", value: fearGreed.oneWeekAgo },
                      { label: lang === "kr" ? "1개월전" : "1M Ago", value: fearGreed.oneMonthAgo },
                    ].map((item, i) => (
                      <div key={i} className="text-center">
                        <div className="text-[10px]" style={{ color: "#666" }}>{item.label}</div>
                        <div className="text-sm font-bold" style={{ color: fgColor(item.value) }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: 30-day history */}
                <div className="rounded-xl p-3 sm:p-4" style={{ background: "#111", border: "1px solid #222" }}>
                  <h3 className="mb-2 text-xs font-semibold" style={{ color: "#ccc" }}>
                    {lang === "kr" ? "30일 추이" : "30-Day History"}
                  </h3>
                  {(fearGreed.history ?? []).length > 1 ? (
                    <FearGreedHistoryChart history={fearGreed.history ?? []} />
                  ) : (
                    <div className="flex h-[200px] items-center justify-center" style={{ color: "#555" }}>
                      <span className="text-xs">{lang === "kr" ? "히스토리 데이터 없음" : "No history data"}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Explanation */}
              <div
                className="mt-3 rounded-lg p-3"
                style={{ background: "rgba(234,179,8,0.03)", border: "1px solid rgba(234,179,8,0.1)", borderLeft: "3px solid rgba(234,179,8,0.3)" }}
              >
                <p className="text-[11px] leading-[1.7]" style={{ color: "#999" }}>
                  {lang === "kr"
                    ? "극도공포 구간은 역사적으로 매수 기회였으며, 극도탐욕 구간은 조정 경계 신호로 활용됩니다. CNN이 산출하는 7개 지표(모멘텀, 강도, 폭, 풋/콜 비율, 정크본드 수요, VIX, 안전자산 수요) 기반입니다."
                    : "Extreme Fear has historically been a buying opportunity, while Extreme Greed signals caution. Based on 7 CNN indicators: momentum, strength, breadth, put/call ratio, junk bond demand, VIX, and safe haven demand."}
                </p>
              </div>
            </>
          ) : (
            <div className="rounded-xl p-6 text-center" style={{ background: "#111", border: "1px solid #222" }}>
              <span className="text-xs" style={{ color: "#666" }}>
                {lang === "kr" ? "심리 지수 데이터를 불러올 수 없습니다." : "Unable to load sentiment data."}
              </span>
            </div>
          )}
        </div>

        {/* ── Macro Indicator Cards ────────────────────────── */}
        <div className="mb-6">
          {/* Time range selector */}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold" style={{ color: "#e8e8e8" }}>
              {lang === "kr" ? "매크로 지표" : "Macro Indicators"}
            </h2>
            <div className="flex gap-1">
              {CARD_RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setCardRange(r)}
                  className="rounded px-2 py-0.5 text-[11px] font-medium transition-colors"
                  style={{
                    color: cardRange === r ? "#e8e8e8" : "#555",
                    borderBottom: cardRange === r ? "1px solid #e8e8e8" : "1px solid transparent",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* 3×2 grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              INDICATOR_ORDER.map((id) => {
                const ind = INDICATORS[id];
                const sd = series[ind.seriesKey] || ({} as SeriesData);
                return (
                  <MetricCard
                    key={id}
                    indicator={ind}
                    series={sd}
                    lang={lang}
                    onClick={() => setModalId(id)}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* ── Market Valuation (PER) Section ─────────────────── */}
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-bold tracking-wider uppercase" style={{ color: "#aaaaaa" }}>
            {lang === "kr" ? "시장 밸류에이션 (PER)" : "Market Valuation (P/E Ratio)"}
          </h2>

          {peLoading ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-xl p-3 sm:p-4 animate-pulse" style={{ background: "#111", border: "1px solid #222" }}>
                  <div className="mb-3 flex items-center gap-3">
                    <div className="h-3 w-24 rounded" style={{ background: "#1a1a1a" }} />
                    <div className="h-6 w-14 rounded" style={{ background: "#1a1a1a" }} />
                  </div>
                  <div className="h-[180px] rounded-lg" style={{ background: "#0d0d0d" }} />
                </div>
              ))}
            </div>
          ) : peData ? (
            <div className={`grid grid-cols-1 gap-4 ${peData.nasdaq.length > 0 ? "lg:grid-cols-2" : ""}`}>
              <PERChart title="S&P 500 P/E" data={peData.sp500} lang={lang} />
              {peData.nasdaq.length > 0 && (
                <PERChart title="NASDAQ P/E" data={peData.nasdaq} lang={lang} />
              )}
            </div>
          ) : (
            <div className="rounded-xl p-6 text-center" style={{ background: "#111", border: "1px solid #222" }}>
              <span className="text-xs" style={{ color: "#666" }}>
                {lang === "kr" ? "PER 데이터를 불러올 수 없습니다." : "Unable to load P/E data."}
              </span>
            </div>
          )}

          {/* CAPE full-width below */}
          <div className="mt-4">
            {capeLoading ? (
              <div className="rounded-xl p-3 sm:p-4 animate-pulse" style={{ background: "#111", border: "1px solid #222" }}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-3 w-40 rounded" style={{ background: "#1a1a1a" }} />
                  <div className="h-6 w-14 rounded" style={{ background: "#1a1a1a" }} />
                </div>
                <div className="h-[220px] rounded-lg" style={{ background: "#0d0d0d" }} />
              </div>
            ) : capeData ? (
              <CAPEChart data={capeData.data} average={capeData.average} lang={lang} />
            ) : (
              <div className="rounded-xl p-6 text-center" style={{ background: "#111", border: "1px solid #222" }}>
                <span className="text-xs" style={{ color: "#666" }}>
                  {lang === "kr" ? "CAPE 데이터를 불러올 수 없습니다." : "Unable to load CAPE data."}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Korea-US Comparison Section ────────────────────── */}
        <div className="mb-4">
          <h2 className="mb-3 text-sm font-bold tracking-wider uppercase" style={{ color: "#aaaaaa" }}>
            {lang === "kr" ? "한미 비교" : "Korea-US Comparison"}
          </h2>

          {/* Summary bar */}
          {!bokLoading && !loading && (
            <div
              className="mb-4 flex flex-wrap items-center gap-4 rounded-lg px-4 py-3"
              style={{ background: "#111", border: "1px solid #222" }}
            >
              {[
                { label: lang === "kr" ? "한국 금리" : "BOK Rate", value: `${bokSeries["BASE_RATE"]?.latest?.toFixed(2) || "—"}%`, color: "#f472b6" },
                { label: lang === "kr" ? "Fed 금리" : "Fed Rate", value: `${seriesFull["FEDFUNDS"]?.latest?.toFixed(2) || "—"}%`, color: "#60a5fa" },
                {
                  label: lang === "kr" ? "금리차" : "Spread",
                  value: `${((seriesFull["FEDFUNDS"]?.latest || 0) - (bokSeries["BASE_RATE"]?.latest || 0)).toFixed(2)}%p`,
                  color: ((seriesFull["FEDFUNDS"]?.latest || 0) - (bokSeries["BASE_RATE"]?.latest || 0)) > 2 ? "#f87171" : ((seriesFull["FEDFUNDS"]?.latest || 0) - (bokSeries["BASE_RATE"]?.latest || 0)) > 0 ? "#facc15" : "#4ade80",
                },
                { label: lang === "kr" ? "환율" : "USD/KRW", value: `${(liveUsdKrw || seriesFull["DEXKOUS"]?.latest || bokSeries["USDKRW"]?.latest)?.toFixed(0) || "—"}원`, color: "#fb923c" },
                { label: lang === "kr" ? "한국 CPI" : "KR CPI", value: `${bokSeries["KR_CPI_YOY"]?.latest?.toFixed(1) || "—"}%`, color: "#f472b6" },
                { label: lang === "kr" ? "미국 CPI" : "US CPI", value: `${seriesFull["CPI_YOY"]?.latest?.toFixed(1) || "—"}%`, color: "#60a5fa" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[11px]" style={{ color: "#666" }}>{item.label}</span>
                  <span className="text-[13px] font-bold" style={{ color: item.color }}>{item.value}</span>
                  {i < 5 && <span style={{ color: "#333" }}>|</span>}
                </div>
              ))}
            </div>
          )}

          {/* Timestamp */}
          {comparisonUpdatedAt && (
            <div className="mb-3 text-right">
              <span className="text-[10px]" style={{ color: "#555" }}>
                {lang === "kr" ? "기준" : "As of"}:{" "}
                {(() => {
                  const d = new Date(comparisonUpdatedAt);
                  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
                  const yyyy = kst.getUTCFullYear();
                  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
                  const dd = String(kst.getUTCDate()).padStart(2, "0");
                  const hh = String(kst.getUTCHours()).padStart(2, "0");
                  const mi = String(kst.getUTCMinutes()).padStart(2, "0");
                  return `${yyyy}.${mm}.${dd} ${hh}:${mi} KST`;
                })()}
              </span>
            </div>
          )}

          {/* 3 charts grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Chart 1: BOK vs Fed rate */}
            <div className="rounded-xl p-3 sm:p-4" style={{ background: "#111", border: "1px solid #222" }}>
              <h3 className="mb-3 text-xs font-semibold" style={{ color: "#ccc" }}>
                {lang === "kr" ? "한국 vs Fed 기준금리" : "BOK vs Fed Funds Rate"}
              </h3>
              {bokLoading || loading ? (
                <div className="flex h-[200px] items-center justify-center animate-pulse rounded-lg" style={{ background: "#0d0d0d" }}>
                  <span style={{ color: "#444" }}>Loading...</span>
                </div>
              ) : (
                <KrUsRateChart
                  bokRate={bokSeries["BASE_RATE"]?.observations || []}
                  fedRate={(seriesFull["FEDFUNDS"]?.observations || []).map(o => ({ date: o.date.slice(0, 7), value: o.value }))}
                  lang={lang}
                />
              )}
            </div>

            {/* Chart 2: Korea CPI vs US CPI */}
            <div className="rounded-xl p-3 sm:p-4" style={{ background: "#111", border: "1px solid #222" }}>
              <h3 className="mb-3 text-xs font-semibold" style={{ color: "#ccc" }}>
                {lang === "kr" ? "한국 CPI vs 미국 CPI (YoY%)" : "Korea CPI vs US CPI (YoY%)"}
              </h3>
              {bokLoading || loading ? (
                <div className="flex h-[200px] items-center justify-center animate-pulse rounded-lg" style={{ background: "#0d0d0d" }}>
                  <span style={{ color: "#444" }}>Loading...</span>
                </div>
              ) : (
                <CpiComparisonChart
                  krCpi={bokSeries["KR_CPI_YOY"]?.observations || []}
                  usCpi={seriesFull["CPI_YOY"]?.observations || []}
                  lang={lang}
                />
              )}
            </div>
          </div>

          {/* Explanation */}
          <div
            className="mt-3 rounded-lg p-3"
            style={{ background: "rgba(96,165,250,0.03)", border: "1px solid rgba(96,165,250,0.1)", borderLeft: "3px solid rgba(96,165,250,0.3)" }}
          >
            <p className="text-[11px] leading-[1.7]" style={{ color: "#999" }}>
              {lang === "kr"
                ? "한미 금리차가 확대될수록 달러 강세·원화 약세 압력이 높아집니다. 금리차 >2%p = 원화약세 위험, 0~2%p = 중립, <0%p = 원화강세. CPI는 전년 동월 대비(YoY%) 기준이며, 양국 중앙은행 모두 2% 물가안정 목표를 운용합니다."
                : "A widening Korea-US rate differential increases pressure for KRW weakness. Spread >2%p = KRW weakness risk, 0-2%p = neutral, <0%p = KRW strength. CPI shown as YoY%; both central banks target 2% inflation."}
            </p>
          </div>
        </div>

        {/* ── FX Dashboard Section ─────────────────────────── */}
        <div className="mb-4">
          <h2 className="mb-3 text-sm font-bold tracking-wider uppercase" style={{ color: "#aaaaaa" }}>
            {lang === "kr" ? "주요 환율" : "Major Exchange Rates"}
          </h2>

          {fxLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-xl p-3 sm:p-4 animate-pulse" style={{ background: "#111", border: "1px solid #222" }}>
                  <div className="h-4 w-20 rounded" style={{ background: "#1a1a1a" }} />
                  <div className="mt-2 h-6 w-24 rounded" style={{ background: "#1a1a1a" }} />
                  <div className="mt-2 h-[28px] w-full rounded" style={{ background: "#1a1a1a" }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {fxData.map((pair) => {
                const tag = pair.id === "USDKRW" ? "USD" : pair.id === "JPYKRW" ? "JPY" : pair.id === "CNYKRW" ? "CNY" : pair.id === "EURKRW" ? "EUR" : "CHF";
                return (
                  <button
                    key={pair.id}
                    onClick={() => setFxModal(pair)}
                    className="rounded-xl p-3 sm:p-4 text-left transition-all hover:border-accent/40"
                    style={{ background: "#111", border: "1px solid #222" }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide"
                          style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", fontFamily: "monospace" }}
                        >
                          {tag}
                        </span>
                        <span className="text-[11px] font-medium" style={{ color: "#888" }}>
                          {lang === "kr" ? pair.labelKr : pair.label}
                        </span>
                      </div>
                      <span
                        className="rounded-full px-2.5 py-1 text-xs font-mono font-medium"
                        style={{
                          background: pair.changePercent > 0 ? "rgba(248,113,113,0.15)" : pair.changePercent < 0 ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.05)",
                          color: pair.changePercent > 0 ? "#f87171" : pair.changePercent < 0 ? "#4ade80" : "#888",
                          border: `1px solid ${pair.changePercent > 0 ? "rgba(248,113,113,0.3)" : pair.changePercent < 0 ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.1)"}`,
                        }}
                      >
                        {pair.changePercent > 0 ? "+" : ""}{pair.changePercent.toFixed(2)}%
                      </span>
                    </div>
                    <div className="mt-2 text-lg font-bold" style={{ color: "#e8e8e8" }}>
                      {pair?.current != null ? (pair.current >= 100 ? pair.current.toLocaleString(undefined, { maximumFractionDigits: 0 }) : pair.current.toFixed(4)) : "—"}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="text-[10px]" style={{ color: "#555" }}>
                        ({pair.change > 0 ? "+" : ""}{pair.change >= 100 ? pair.change.toFixed(0) : pair.change.toFixed(2)})
                      </span>
                    </div>
                    <div className="mt-2">
                      <MiniSparkline
                        data={pair.sparkline ?? []}
                        color={pair.changePercent >= 0 ? "#f87171" : "#4ade80"}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Commodities & Energy Section ────────────────────── */}
        <div className="mb-4">
          <h2 className="mb-3 text-sm font-bold tracking-wider uppercase" style={{ color: "#aaaaaa" }}>
            {lang === "kr" ? "원자재 & 에너지" : "Commodities & Energy"}
          </h2>

          {comLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-xl p-3 sm:p-4 animate-pulse" style={{ background: "#111", border: "1px solid #222" }}>
                  <div className="h-4 w-20 rounded" style={{ background: "#1a1a1a" }} />
                  <div className="mt-2 h-6 w-24 rounded" style={{ background: "#1a1a1a" }} />
                  <div className="mt-2 h-[28px] w-full rounded" style={{ background: "#1a1a1a" }} />
                </div>
              ))}
            </div>
          ) : (
            <>
              {(["energy", "precious", "industrial", "battery"] as const).map((cat) => {
                const items = commodities.filter(c => c.category === cat);
                if (items.length === 0) return null;
                const catLabel = cat === "energy"
                  ? (lang === "kr" ? "에너지" : "Energy")
                  : cat === "precious"
                  ? (lang === "kr" ? "귀금속" : "Precious Metals")
                  : cat === "industrial"
                  ? (lang === "kr" ? "산업금속" : "Industrial Metals")
                  : (lang === "kr" ? "배터리/EV" : "Battery/EV");
                const borderColor = cat === "energy" ? "#fb923c" : cat === "precious" ? "#facc15" : cat === "industrial" ? "#60a5fa" : "#a78bfa";
                return (
                  <div key={cat} className="mb-3">
                    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#666" }}>
                      {catLabel}
                    </h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((com) => (
                        <div
                          key={com.id}
                          className="group relative overflow-hidden rounded-xl p-3 sm:p-4"
                          style={{ background: "#111", border: "1px solid #222", borderLeft: `3px solid ${borderColor}` }}
                          onMouseEnter={() => setComTooltip(com.id)}
                          onMouseLeave={() => setComTooltip(null)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold" style={{ color: "#ccc" }}>
                              {lang === "kr" ? com.labelKr : com.label}
                            </span>
                            <span className="text-[10px]" style={{ color: "#555" }}>{com.unit}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="text-xl font-bold tabular-nums" style={{ color: "#e8e8e8" }}>
                              {com?.current != null ? `$${com.current.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                            </div>
                            <MiniSparkline
                              data={com.sparkline ?? []}
                              color={borderColor}
                              width={120}
                              height={40}
                            />
                          </div>
                          {/* Tooltip */}
                          {comTooltip === com.id && (
                            <div
                              className="absolute left-1/2 bottom-full z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg px-3 py-2 text-[10px]"
                              style={{ background: "#222", border: "1px solid #333", color: "#ccc" }}
                            >
                              {lang === "kr" ? com.tooltipKr : com.tooltipEn}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        </>)}
      </main>

      {/* FX Chart Modal */}
      {fxModal && <FxChartModal pair={fxModal} onClose={() => setFxModal(null)} lang={lang} />}

      {/* Detail Modal */}
      {modalId && INDICATORS[modalId] && (
        <DetailModal
          indicator={INDICATORS[modalId]}
          series={seriesFull[INDICATORS[modalId].seriesKey] || {} as SeriesData}
          onClose={() => setModalId(null)}
          lang={lang}
          barChartConfig={modalId === "CPIAUCSL" ? CPI_BAR_CONFIG : modalId === "UNRATE" ? UNRATE_BAR_CONFIG : undefined}
        />
      )}
    </div>
  );
}
