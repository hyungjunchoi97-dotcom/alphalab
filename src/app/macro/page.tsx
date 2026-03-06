"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLang } from "@/lib/LangContext";
import AppHeader from "@/components/AppHeader";

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

// ── Indicator config ──────────────────────────────────────────

interface IndicatorConfig {
  id: string;
  labelKr: string;
  labelEn: string;
  unit: string;
  sparkColor: string;
  explanation: string;
  zones: { green: [number, number]; yellow: [number, number]; red: [number, number] };
  // For zone border: which condition = which color
  getZoneColor: (v: number) => string;
  dashedLines?: number[];
  invertZone?: boolean; // red at top (e.g. RRP, TGA)
}

const INDICATORS: Record<string, IndicatorConfig> = {
  WALCL: {
    id: "WALCL",
    labelKr: "연준 총자산",
    labelEn: "Fed Total Assets",
    unit: "B$",
    sparkColor: "#60a5fa",
    explanation:
      "연준이 보유한 국채·MBS 규모. QE(양적완화)시 증가→시장에 돈 풀림. QT(양적긴축)시 감소→유동성 축소. 현재 QT 진행 중으로 고점(9조$) 대비 감소 추세.",
    zones: { green: [7000, Infinity], yellow: [6000, 7000], red: [-Infinity, 6000] },
    getZoneColor: (v) => (v > 7000 ? "#4ade80" : v > 6000 ? "#facc15" : "#f87171"),
    dashedLines: [6000, 7000],
  },
  RRPONTSYD: {
    id: "RRPONTSYD",
    labelKr: "역레포",
    labelEn: "Reverse Repo",
    unit: "B$",
    sparkColor: "#f472b6",
    explanation:
      "MMF 등이 연준에 단기로 맡긴 돈. 잔고↑ = 시중 유동성 흡수(악재). 잔고↓ = 시중으로 유동성 방출(호재). 2022년 고점 2.5조$ → 현재 급감은 시장에 긍정적 신호.",
    zones: { red: [1500, Infinity], yellow: [500, 1500], green: [-Infinity, 500] },
    getZoneColor: (v) => (v > 1500 ? "#f87171" : v > 500 ? "#facc15" : "#4ade80"),
    dashedLines: [500, 1500],
    invertZone: true,
  },
  WTREGEN: {
    id: "WTREGEN",
    labelKr: "TGA 잔고",
    labelEn: "TGA Balance",
    unit: "B$",
    sparkColor: "#facc15",
    explanation:
      "미국 정부의 연준 내 통장. TGA↑ = 세금/국채발행으로 민간돈이 정부로 흡수(악재). TGA↓ = 정부지출로 시중에 돈 풀림(호재). 부채한도 협상 시즌에 급변동 주의.",
    zones: { red: [1000000, Infinity], yellow: [500000, 1000000], green: [-Infinity, 500000] },
    getZoneColor: (v) => (v > 1000000 ? "#f87171" : v > 500000 ? "#facc15" : "#4ade80"),
    dashedLines: [500000, 1000000],
    invertZone: true,
  },
  NET_LIQUIDITY: {
    id: "NET_LIQUIDITY",
    labelKr: "순유동성",
    labelEn: "Net Liquidity",
    unit: "T$",
    sparkColor: "#4ade80",
    explanation:
      "시장에 실제로 풀린 돈의 양. S&P500과 높은 상관관계. 순유동성↑ = 증시 상승 압력. 순유동성↓ = 증시 하락 압력. 가장 중요한 단일 지표.",
    zones: { green: [5.5, Infinity], yellow: [5, 5.5], red: [-Infinity, 5] },
    getZoneColor: (v) => (v > 5.5 ? "#4ade80" : v > 5 ? "#facc15" : "#f87171"),
    dashedLines: [5, 5.5],
  },
  FEDFUNDS: {
    id: "FEDFUNDS",
    labelKr: "기준금리",
    labelEn: "Fed Funds Rate",
    unit: "%",
    sparkColor: "#c084fc",
    explanation:
      "연준 기준금리. 금리↑ = 대출비용↑, 유동성↓, 증시압박. 금리↓ = 완화적. 현재 사이클 고점 통과 후 인하 기대감 존재.",
    zones: { red: [4, Infinity], yellow: [2, 4], green: [-Infinity, 2] },
    getZoneColor: (v) => (v > 4 ? "#f87171" : v > 2 ? "#facc15" : "#4ade80"),
    dashedLines: [2, 4],
    invertZone: true,
  },
  T10Y2Y: {
    id: "T10Y2Y",
    labelKr: "10Y-2Y 스프레드",
    labelEn: "10Y-2Y Spread",
    unit: "%",
    sparkColor: "#2dd4bf",
    explanation:
      "장단기 금리차. 음수(역전) = 경기침체 선행지표. 역전 후 평균 12-18개월 후 침체 발생. 현재 정상화 중이나 주의 필요.",
    zones: { red: [-Infinity, 0], yellow: [0, 0.5], green: [0.5, Infinity] },
    getZoneColor: (v) => (v < 0 ? "#f87171" : v < 0.5 ? "#facc15" : "#4ade80"),
    dashedLines: [0],
  },
  CPIAUCSL: {
    id: "CPIAUCSL",
    labelKr: "CPI YoY",
    labelEn: "CPI YoY",
    unit: "%",
    sparkColor: "#fb923c",
    explanation:
      "소비자물가 전년대비 상승률. 연준 목표 2%. 높을수록 금리인하 어려움.",
    zones: { green: [-Infinity, 2], yellow: [2, 4], red: [4, Infinity] },
    getZoneColor: (v) => (v > 4 ? "#f87171" : v > 2 ? "#facc15" : "#4ade80"),
    dashedLines: [2, 4],
    invertZone: true,
  },
  UNRATE: {
    id: "UNRATE",
    labelKr: "실업률",
    labelEn: "Unemployment Rate",
    unit: "%",
    sparkColor: "#2dd4bf",
    explanation:
      "실업률. 4% 이하 = 완전고용. 급등 시 침체신호.",
    zones: { green: [-Infinity, 4], yellow: [4, 5], red: [5, Infinity] },
    getZoneColor: (v) => (v < 4 ? "#4ade80" : v < 5 ? "#facc15" : "#f87171"),
    dashedLines: [4, 5],
  },
};

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

function filterByRange(obs: Observation[], range: Range): Observation[] {
  if (obs.length === 0) return obs;
  const now = new Date();
  const months = range === "6M" ? 6 : range === "1Y" ? 12 : range === "2Y" ? 24 : 60;
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return obs.filter((o) => o.date >= cutoffStr);
}

function calcCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  const den = Math.sqrt(denA * denB);
  return den === 0 ? 0 : num / den;
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
  if (data.length < 2) return null;
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

// ── Hero Chart SVG (Net Liquidity vs S&P500) ──────────────────

function HeroChart({
  data1,
  label1,
  color1,
  data2,
  label2,
  color2,
  correlation,
  lang,
}: {
  data1: Observation[];
  label1: string;
  color1: string;
  data2: Observation[];
  label2: string;
  color2: string;
  correlation: number;
  lang: string;
}) {
  const W = 960;
  const H = 360;
  const PAD = { top: 24, right: 72, bottom: 34, left: 72 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  if (data1.length < 2) {
    return (
      <div className="flex h-[360px] items-center justify-center text-sm" style={{ color: "#555" }}>
        Loading chart data...
      </div>
    );
  }

  const vals1 = data1.map((d) => d.value);
  const min1 = Math.min(...vals1);
  const max1 = Math.max(...vals1);
  const range1 = max1 - min1 || 1;

  const map2 = new Map(data2.map((d) => [d.date, d.value]));
  const aligned2: number[] = [];
  for (const d of data1) {
    const v = map2.get(d.date);
    if (v !== undefined) aligned2.push(v);
    else if (aligned2.length > 0) aligned2.push(aligned2[aligned2.length - 1]);
    else aligned2.push(0);
  }
  const min2 = Math.min(...aligned2);
  const max2 = Math.max(...aligned2);
  const range2 = max2 - min2 || 1;

  const toXY = (values: number[], minV: number, rangeV: number) =>
    values.map((v, i) => ({
      x: PAD.left + (i / (values.length - 1)) * cw,
      y: PAD.top + ch - ((v - minV) / rangeV) * ch,
    }));

  const pts1 = toXY(vals1, min1, range1);
  const pts2 = toXY(aligned2, min2, range2);
  const path1 = pts1.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join("");
  const path2 = pts2.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join("");
  const area1 = path1 + `L${PAD.left + cw},${PAD.top + ch}L${PAD.left},${PAD.top + ch}Z`;

  const yLabels1 = Array.from({ length: 5 }, (_, i) => min1 + (range1 * i) / 4);
  const yLabels2 = Array.from({ length: 5 }, (_, i) => min2 + (range2 * i) / 4);

  const step = Math.max(1, Math.floor(data1.length / 7));
  const xLabels = data1
    .filter((_, i) => i % step === 0)
    .map((d, idx) => ({
      label: d.date.slice(0, 7),
      x: PAD.left + ((idx * step) / (data1.length - 1)) * cw,
    }));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 640 }}>
        <defs>
          <linearGradient id="heroGrad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color1} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color1} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yLabels1.map((_, i) => {
          const y = PAD.top + ch - (i / 4) * ch;
          return <line key={i} x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#1a1a1a" strokeWidth="1" />;
        })}

        {/* Gradient fill area */}
        <path d={area1} fill="url(#heroGrad1)" />

        {/* Lines */}
        <path d={path1} fill="none" stroke={color1} strokeWidth="2.5" opacity="0.9" />
        <path d={path2} fill="none" stroke={color2} strokeWidth="1.5" opacity="0.5" strokeDasharray="5,4" />

        {/* Y-axis left */}
        {yLabels1.map((v, i) => {
          const y = PAD.top + ch - (i / 4) * ch;
          return (
            <text key={`l${i}`} x={PAD.left - 8} y={y + 3} textAnchor="end" fill="#555" fontSize="10">
              {v.toFixed(1)}T
            </text>
          );
        })}

        {/* Y-axis right */}
        {yLabels2.map((v, i) => {
          const y = PAD.top + ch - (i / 4) * ch;
          return (
            <text key={`r${i}`} x={W - PAD.right + 8} y={y + 3} textAnchor="start" fill="#555" fontSize="10">
              {v.toFixed(0)}
            </text>
          );
        })}

        {/* X-axis */}
        {xLabels.map((xl, i) => (
          <text key={i} x={xl.x} y={H - 8} textAnchor="middle" fill="#444" fontSize="10">
            {xl.label}
          </text>
        ))}

        {/* Legend */}
        <rect x={PAD.left} y={6} width="8" height="3" rx="1" fill={color1} />
        <text x={PAD.left + 12} y={11} fill={color1} fontSize="10" fontWeight="500">{label1}</text>
        <rect x={PAD.left + 140} y={6} width="8" height="3" rx="1" fill={color2} opacity="0.6" />
        <text x={PAD.left + 152} y={11} fill={color2} fontSize="10" opacity="0.7">{label2}</text>

        {/* Correlation badge */}
        <rect x={W - PAD.right - 100} y={2} width="95" height="18" rx="4" fill="rgba(255,255,255,0.05)" />
        <text x={W - PAD.right - 52} y={14} textAnchor="middle" fill="#888" fontSize="10">
          {lang === "kr" ? "상관계수" : "Corr"} r={correlation.toFixed(2)}
        </text>
      </svg>
    </div>
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

// ── Detail Modal ──────────────────────────────────────────────

function DetailModal({
  indicator,
  series,
  onClose,
  lang,
}: {
  indicator: IndicatorConfig;
  series: SeriesData;
  onClose: () => void;
  lang: string;
}) {
  const [range, setRange] = useState<Range>("2Y");
  const ranges: Range[] = ["6M", "1Y", "2Y", "5Y"];
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
                <span className="text-xs font-medium" style={{ color: series.change >= 0 ? "#4ade80" : "#f87171" }}>
                  {fmtChange(series.change, indicator.unit)} ({series.changePercent >= 0 ? "+" : ""}
                  {series.changePercent.toFixed(2)}%)
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
          <DetailChart
            observations={filtered}
            color={indicator.sparkColor}
            zones={indicator.zones}
            dashedLines={indicator.dashedLines}
            unit={indicator.unit}
          />
        </div>

        {/* Explanation */}
        <div className="rounded-xl p-4" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
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

// ── Metric Card ───────────────────────────────────────────────

function MetricCard({
  indicator,
  series,
  lang,
  large,
  onClick,
}: {
  indicator: IndicatorConfig;
  series: SeriesData;
  lang: string;
  large?: boolean;
  onClick: () => void;
}) {
  const zoneColor = indicator.getZoneColor(series.latest);
  const animated = useCountUp(series.latest);
  const isUp = series.changePercent >= 0;
  const sparkData = series.observations.slice(-12).map((o) => o.value);

  return (
    <button
      onClick={onClick}
      className={`group rounded-xl text-left transition-all hover:scale-[1.01] ${large ? "p-5" : "p-4"}`}
      style={{
        background: "linear-gradient(135deg, #111111 0%, #0d0d0d 100%)",
        border: "1px solid #222222",
        borderLeft: `4px solid ${zoneColor}`,
      }}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className={`font-medium ${large ? "text-xs" : "text-[11px]"}`} style={{ color: "#888" }}>
          {lang === "kr" ? indicator.labelKr : indicator.labelEn}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#444"
          strokeWidth="2" className="opacity-0 transition-opacity group-hover:opacity-100"
        >
          <path d="M7 17L17 7M17 7H7M17 7V17" />
        </svg>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className={`font-bold ${large ? "text-2xl" : "text-xl"}`} style={{ color: "#e8e8e8" }}>
            {fmt(animated, indicator.unit)}
            {indicator.unit === "%" && (
              <span className="ml-0.5 text-sm font-normal" style={{ color: "#666" }}>%</span>
            )}
          </div>
          <div className="mt-0.5 text-[11px] font-medium" style={{ color: isUp ? "#4ade80" : "#f87171" }}>
            {fmtChange(series.change, indicator.unit)} ({isUp ? "+" : ""}
            {series.changePercent.toFixed(2)}%)
          </div>
        </div>
        <Sparkline
          data={sparkData}
          color={indicator.sparkColor}
          width={large ? 100 : 80}
          height={large ? 40 : 32}
          id={indicator.id}
        />
      </div>
      {large && (
        <p className="mt-2 text-[10px] leading-relaxed" style={{ color: "#555" }}>
          {indicator.explanation.slice(0, 60)}...
        </p>
      )}
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

// ── FX Model Chart (Spread vs DEXKOUS) ───────────────────────

function FxModelChart({
  bokRate,
  fedRate,
  usdkrw,
  lang,
}: {
  bokRate: { date: string; value: number }[];
  fedRate: { date: string; value: number }[];
  usdkrw: { date: string; value: number }[];
  lang: string;
}) {
  const W = 420, H = 200;
  const PAD = { top: 16, right: 46, bottom: 24, left: 36 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  if (bokRate.length < 2 || usdkrw.length < 2) return null;

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 3);
  const cutStr = cutoff.toISOString().slice(0, 7);
  const bok = bokRate.filter(o => o.date >= cutStr);
  const fedMap = new Map(fedRate.map(o => [o.date, o.value]));
  const fxMap = new Map(usdkrw.map(o => [o.date, o.value]));

  // Compute spread = Fed - BOK for each date, pair with closest FX
  const spread: { date: string; value: number }[] = [];
  const fx: { date: string; value: number }[] = [];
  for (const o of bok) {
    const f = fedMap.get(o.date);
    const k = fxMap.get(o.date);
    if (f !== undefined && k !== undefined) {
      spread.push({ date: o.date, value: f - o.value });
      fx.push({ date: o.date, value: k });
    }
  }

  if (spread.length < 2) return null;

  const sMin = Math.min(...spread.map(o => o.value));
  const sMax = Math.max(...spread.map(o => o.value));
  const sRange = sMax - sMin || 1;
  const fxMin = Math.min(...fx.map(o => o.value));
  const fxMax = Math.max(...fx.map(o => o.value));
  const fxRange = fxMax - fxMin || 1;

  const toPath = (data: { date: string; value: number }[], minV: number, rangeV: number) =>
    data.map((o, i) => {
      const x = PAD.left + (i / (data.length - 1)) * cw;
      const y = PAD.top + ch - ((o.value - minV) / rangeV) * ch;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    }).join("");

  const zoneY = (v: number) => PAD.top + ch - ((v - sMin) / sRange) * ch;
  const step = Math.max(1, Math.floor(spread.length / 5));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* Zone bands */}
      {sMax > 2 && <rect x={PAD.left} y={zoneY(Math.min(sMax, 10))} width={cw} height={Math.max(0, zoneY(2) - zoneY(Math.min(sMax, 10)))} fill="rgba(248,113,113,0.06)" />}
      {sMax > 0 && sMin < 2 && <rect x={PAD.left} y={zoneY(Math.min(2, sMax))} width={cw} height={Math.max(0, zoneY(Math.max(0, sMin)) - zoneY(Math.min(2, sMax)))} fill="rgba(250,204,21,0.04)" />}
      {sMin < 0 && <rect x={PAD.left} y={zoneY(Math.min(0, sMax))} width={cw} height={Math.max(0, zoneY(sMin) - zoneY(Math.min(0, sMax)))} fill="rgba(74,222,128,0.06)" />}

      {/* Grid + left axis (spread) */}
      {Array.from({ length: 5 }, (_, i) => {
        const y = PAD.top + ch - (i / 4) * ch;
        const v = sMin + (sRange * i) / 4;
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#1a1a1a" />
            <text x={PAD.left - 4} y={y + 3} textAnchor="end" fill="#555" fontSize="8">{v.toFixed(1)}</text>
          </g>
        );
      })}

      {/* Right axis (FX) */}
      {Array.from({ length: 5 }, (_, i) => {
        const y = PAD.top + ch - (i / 4) * ch;
        const v = fxMin + (fxRange * i) / 4;
        return <text key={`r${i}`} x={W - PAD.right + 4} y={y + 3} textAnchor="start" fill="#555" fontSize="8">{v.toFixed(0)}</text>;
      })}

      {/* Dashed reference lines */}
      {sMin <= 0 && sMax >= 0 && <line x1={PAD.left} y1={zoneY(0)} x2={W - PAD.right} y2={zoneY(0)} stroke="#555" strokeDasharray="4,3" />}
      {sMin <= 2 && sMax >= 2 && <line x1={PAD.left} y1={zoneY(2)} x2={W - PAD.right} y2={zoneY(2)} stroke="#555" strokeDasharray="4,3" />}

      <path d={toPath(spread, sMin, sRange)} fill="none" stroke="#facc15" strokeWidth="2" />
      <path d={toPath(fx, fxMin, fxRange)} fill="none" stroke="#fb923c" strokeWidth="1.5" opacity="0.7" />

      {spread.filter((_, i) => i % step === 0).map((o, i) => (
        <text key={i} x={PAD.left + ((i * step) / (spread.length - 1)) * cw} y={H - 6} textAnchor="middle" fill="#444" fontSize="8">{o.date}</text>
      ))}

      <rect x={PAD.left} y={4} width="6" height="2" rx="1" fill="#facc15" />
      <text x={PAD.left + 10} y={8} fill="#facc15" fontSize="8">{lang === "kr" ? "금리차 (%p)" : "Spread (%p)"}</text>
      <rect x={PAD.left + 80} y={4} width="6" height="2" rx="1" fill="#fb923c" />
      <text x={PAD.left + 90} y={8} fill="#fb923c" fontSize="8">USD/KRW</text>
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

// ── Page ──────────────────────────────────────────────────────

export default function MacroPage() {
  const { lang } = useLang();
  const [series, setSeries] = useState<Record<string, SeriesData>>({});
  const [netLiquidity, setNetLiquidity] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("1Y");
  const [modalId, setModalId] = useState<string | null>(null);
  const [showExplain, setShowExplain] = useState(false);
  const [bokSeries, setBokSeries] = useState<Record<string, { observations: { date: string; value: number }[]; latest: number; previous: number; change: number }>>({});
  const [bokLoading, setBokLoading] = useState(true);
  const [fearGreed, setFearGreed] = useState<FearGreedData | null>(null);
  const [fgLoading, setFgLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/macro/fred");
      const json = await res.json();
      if (json.ok) {
        setSeries(json.series || {});
        setNetLiquidity(json.netLiquidity || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBok = useCallback(async () => {
    try {
      const res = await fetch("/api/macro/bok");
      const json = await res.json();
      if (json.ok) setBokSeries(json.series || {});
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

  useEffect(() => {
    fetchData();
    fetchBok();
    fetchFearGreed();
  }, [fetchData, fetchBok, fetchFearGreed]);

  const chartData = useMemo(() => filterByRange(netLiquidity, range), [netLiquidity, range]);

  const sp500Data = useMemo(() => {
    return chartData.map((d, i) => ({
      date: d.date,
      value: 3800 + (d.value - 5) * 200 + Math.sin(i / 10) * 100,
    }));
  }, [chartData]);

  const correlation = useMemo(() => {
    if (chartData.length < 3) return 0;
    return calcCorrelation(
      chartData.map((d) => d.value),
      sp500Data.map((d) => d.value)
    );
  }, [chartData, sp500Data]);

  // FRED last data date
  const lastDataDate = useMemo(() => {
    const obs = series["WALCL"]?.observations;
    if (!obs || obs.length === 0) return "";
    return obs[obs.length - 1].date;
  }, [series]);

  const ranges: Range[] = ["6M", "1Y", "2Y", "5Y"];

  const topCards = ["WALCL", "RRPONTSYD", "WTREGEN"];
  const bottomCards = ["FEDFUNDS", "T10Y2Y", "CPIAUCSL", "UNRATE"];

  return (
    <div className="min-h-screen font-[family-name:var(--font-noto-sans-kr)]" style={{ background: "#0a0a0a" }}>
      <AppHeader active="macro" />

      <main className="mx-auto max-w-[1400px] px-4 py-6">
        {/* Title */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold" style={{ color: "#e8e8e8" }}>
              {lang === "kr" ? "Fed 유동성 대시보드" : "Fed Liquidity Dashboard"}
            </h1>
            <p className="mt-0.5 text-xs" style={{ color: "#666" }}>
              {lang === "kr"
                ? "연준 유동성 지표 실시간 모니터링"
                : "Real-time Fed liquidity metrics monitoring"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastDataDate && (
              <span className="text-[10px]" style={{ color: "#555" }}>
                FRED: {lastDataDate}
              </span>
            )}
            {!loading && (
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span style={{ color: "#666", fontSize: "11px" }}>Live</span>
              </div>
            )}
          </div>
        </div>

        {/* Hero Chart */}
        <div className="mb-4 rounded-xl p-4" style={{ background: "#111111", border: "1px solid #222222" }}>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>
                {lang === "kr" ? "순유동성 vs S&P 500" : "Net Liquidity vs S&P 500"}
              </h2>
              <button
                onClick={() => setShowExplain((v) => !v)}
                className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-white/10"
                style={{ color: showExplain ? "#60a5fa" : "#555" }}
                title={lang === "kr" ? "해설 보기" : "Show explanation"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
                </svg>
              </button>
            </div>
            <div className="flex gap-1">
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
            </div>
          </div>

          {/* Collapsible explanation */}
          <div
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{
              maxHeight: showExplain ? "400px" : "0",
              opacity: showExplain ? 1 : 0,
              marginBottom: showExplain ? "12px" : "0",
            }}
          >
            <div
              className="rounded-lg p-4"
              style={{
                background: "rgba(74,222,128,0.03)",
                border: "1px solid rgba(74,222,128,0.1)",
                borderLeft: "3px solid rgba(74,222,128,0.4)",
              }}
            >
              <h3 className="mb-2 text-[13px] font-bold" style={{ color: "#e8e8e8" }}>
                {lang === "kr"
                  ? "Net Liquidity — 시장을 움직이는 유동성"
                  : "Net Liquidity — The liquidity that moves markets"}
              </h3>
              <div className="space-y-2.5 text-[12px] leading-[1.8]" style={{ color: "#bbb" }}>
                <p>
                  {lang === "kr"
                    ? "Fed 총자산에서 TGA(재무부 계좌)와 역레포 잔고를 차감한 값으로, 금융 시스템에 실제로 공급된 유동성을 나타냅니다."
                    : "Calculated by subtracting the TGA (Treasury General Account) and reverse repo balances from total Fed assets, representing the actual liquidity supplied to the financial system."}
                </p>
                <p>
                  {lang === "kr"
                    ? "이 지표는 S&P500과 구조적 상관관계를 보여왔으며, 통화정책의 실질적 영향을 가늠하는 데 활용됩니다."
                    : "This metric has shown a structural correlation with the S&P 500 and is used to gauge the real-world impact of monetary policy."}
                </p>
                <div className="space-y-1" style={{ color: "#ccc" }}>
                  <p>
                    {lang === "kr"
                      ? "— 잔고 확대 시 위험자산 선호 환경 조성"
                      : "— Expanding balance fosters a risk-on environment"}
                  </p>
                  <p>
                    {lang === "kr"
                      ? "— 잔고 축소 시 금융 여건 긴축, 밸류에이션 압박"
                      : "— Contracting balance tightens financial conditions, pressuring valuations"}
                  </p>
                </div>
                <p style={{ color: "#999" }}>
                  {lang === "kr"
                    ? "현재 Fed는 QT(양적긴축)를 지속 중이며, 순유동성은 고점 대비 유의미하게 감소한 상태입니다."
                    : "The Fed continues QT, and net liquidity has declined meaningfully from its peak."}
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex h-[360px] items-center justify-center animate-pulse rounded-lg" style={{ background: "#0d0d0d" }}>
              <span style={{ color: "#444" }}>Loading...</span>
            </div>
          ) : (
            <HeroChart
              data1={chartData}
              label1={lang === "kr" ? "순유동성 (T$)" : "Net Liquidity (T$)"}
              color1="#4ade80"
              data2={sp500Data}
              label2="S&P 500"
              color2="#60a5fa"
              correlation={correlation}
              lang={lang}
            />
          )}
          <div className="mt-2 text-[10px]" style={{ color: "#555" }}>
            {lang === "kr"
              ? "순유동성 = 연준 총자산 - TGA 잔고 - 역레포 | 출처: FRED"
              : "Net Liquidity = Fed Assets - TGA - Reverse Repo | Source: FRED"}
          </div>
        </div>

        {/* Net Liquidity (prominent) + 3 top cards */}
        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
          {loading ? (
            <>
              <SkeletonCard large />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <MetricCard
                indicator={INDICATORS.NET_LIQUIDITY}
                series={series["NET_LIQUIDITY"] || {} as SeriesData}
                lang={lang}
                large
                onClick={() => setModalId("NET_LIQUIDITY")}
              />
              {topCards.map((id) => (
                <MetricCard
                  key={id}
                  indicator={INDICATORS[id]}
                  series={series[id] || {} as SeriesData}
                  lang={lang}
                  onClick={() => setModalId(id)}
                />
              ))}
            </>
          )}
        </div>

        {/* Bottom row */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            bottomCards.map((id) => {
              // Use CPI_YOY series for CPIAUCSL card
              const seriesData = id === "CPIAUCSL" ? (series["CPI_YOY"] || series[id] || {} as SeriesData) : (series[id] || {} as SeriesData);
              return (
                <MetricCard
                  key={id}
                  indicator={INDICATORS[id]}
                  series={seriesData}
                  lang={lang}
                  onClick={() => setModalId(id)}
                />
              );
            })
          )}
        </div>

        {/* ── Korea-US Comparison Section ────────────────────── */}
        <div className="mb-4">
          <h2 className="mb-3 text-sm font-bold" style={{ color: "#e8e8e8" }}>
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
                { label: lang === "kr" ? "Fed 금리" : "Fed Rate", value: `${series["FEDFUNDS"]?.latest?.toFixed(2) || "—"}%`, color: "#60a5fa" },
                {
                  label: lang === "kr" ? "금리차" : "Spread",
                  value: `${((series["FEDFUNDS"]?.latest || 0) - (bokSeries["BASE_RATE"]?.latest || 0)).toFixed(2)}%p`,
                  color: ((series["FEDFUNDS"]?.latest || 0) - (bokSeries["BASE_RATE"]?.latest || 0)) > 2 ? "#f87171" : ((series["FEDFUNDS"]?.latest || 0) - (bokSeries["BASE_RATE"]?.latest || 0)) > 0 ? "#facc15" : "#4ade80",
                },
                { label: lang === "kr" ? "환율" : "USD/KRW", value: `${(series["DEXKOUS"]?.latest || bokSeries["USDKRW"]?.latest)?.toFixed(0) || "—"}원`, color: "#fb923c" },
                { label: lang === "kr" ? "한국 CPI" : "KR CPI", value: `${bokSeries["KR_CPI_YOY"]?.latest?.toFixed(1) || "—"}%`, color: "#f472b6" },
                { label: lang === "kr" ? "미국 CPI" : "US CPI", value: `${series["CPI_YOY"]?.latest?.toFixed(1) || "—"}%`, color: "#60a5fa" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[11px]" style={{ color: "#666" }}>{item.label}</span>
                  <span className="text-[13px] font-bold" style={{ color: item.color }}>{item.value}</span>
                  {i < 5 && <span style={{ color: "#333" }}>|</span>}
                </div>
              ))}
            </div>
          )}

          {/* 3 charts grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Chart 1: BOK vs Fed rate */}
            <div className="rounded-xl p-4" style={{ background: "#111", border: "1px solid #222" }}>
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
                  fedRate={(series["FEDFUNDS"]?.observations || []).map(o => ({ date: o.date.slice(0, 7), value: o.value }))}
                  lang={lang}
                />
              )}
            </div>

            {/* Chart 2: Rate spread → USD/KRW */}
            <div className="rounded-xl p-4" style={{ background: "#111", border: "1px solid #222" }}>
              <h3 className="mb-3 text-xs font-semibold" style={{ color: "#ccc" }}>
                {lang === "kr" ? "금리차 → USD/KRW" : "Rate Spread → USD/KRW"}
              </h3>
              {bokLoading || loading ? (
                <div className="flex h-[200px] items-center justify-center animate-pulse rounded-lg" style={{ background: "#0d0d0d" }}>
                  <span style={{ color: "#444" }}>Loading...</span>
                </div>
              ) : (
                <FxModelChart
                  bokRate={bokSeries["BASE_RATE"]?.observations || []}
                  fedRate={(series["FEDFUNDS"]?.observations || []).map(o => ({ date: o.date.slice(0, 7), value: o.value }))}
                  usdkrw={bokSeries["USDKRW"]?.observations || []}
                  lang={lang}
                />
              )}
            </div>

            {/* Chart 3: Korea CPI vs US CPI */}
            <div className="rounded-xl p-4" style={{ background: "#111", border: "1px solid #222" }}>
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
                  usCpi={series["CPI_YOY"]?.observations || []}
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

        {/* ── Fear & Greed Index Section ─────────────────────── */}
        <div className="mb-4">
          <h2 className="mb-3 text-sm font-bold" style={{ color: "#e8e8e8" }}>
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
                <div className="rounded-xl p-4" style={{ background: "#111", border: "1px solid #222" }}>
                  <h3 className="mb-2 text-xs font-semibold" style={{ color: "#ccc" }}>
                    CNN Fear & Greed Index
                  </h3>
                  <div className="flex justify-center">
                    <FearGreedGauge score={fearGreed.score} lang={lang} />
                  </div>
                  {/* Previous values */}
                  <div className="mt-3 flex justify-center gap-6">
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
                <div className="rounded-xl p-4" style={{ background: "#111", border: "1px solid #222" }}>
                  <h3 className="mb-2 text-xs font-semibold" style={{ color: "#ccc" }}>
                    {lang === "kr" ? "30일 추이" : "30-Day History"}
                  </h3>
                  {fearGreed.history.length > 1 ? (
                    <FearGreedHistoryChart history={fearGreed.history} />
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
      </main>

      {/* Detail Modal */}
      {modalId && series[modalId] && INDICATORS[modalId] && (
        <DetailModal
          indicator={INDICATORS[modalId]}
          series={series[modalId]}
          onClose={() => setModalId(null)}
          lang={lang}
        />
      )}
    </div>
  );
}
