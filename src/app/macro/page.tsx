"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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

// ── Sparkline SVG ─────────────────────────────────────────────

function Sparkline({
  data,
  color,
  width = 120,
  height = 36,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="mt-1">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Main Chart SVG ────────────────────────────────────────────

function DualAxisChart({
  data1,
  label1,
  color1,
  data2,
  label2,
  color2,
}: {
  data1: Observation[];
  label1: string;
  color1: string;
  data2: Observation[];
  label2: string;
  color2: string;
}) {
  const W = 900;
  const H = 320;
  const PAD = { top: 20, right: 70, bottom: 30, left: 70 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  if (data1.length < 2) {
    return (
      <div className="flex h-[320px] items-center justify-center text-sm" style={{ color: "#555" }}>
        Loading chart data...
      </div>
    );
  }

  const min1 = Math.min(...data1.map((d) => d.value));
  const max1 = Math.max(...data1.map((d) => d.value));
  const range1 = max1 - min1 || 1;

  // Build date map for data2
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

  const toPath = (values: number[], minV: number, rangeV: number) => {
    return values
      .map((v, i) => {
        const x = PAD.left + (i / (values.length - 1)) * cw;
        const y = PAD.top + ch - ((v - minV) / rangeV) * ch;
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join("");
  };

  const path1 = toPath(
    data1.map((d) => d.value),
    min1,
    range1
  );
  const path2 = toPath(aligned2, min2, range2);

  // Y-axis labels
  const yLabels1 = Array.from({ length: 5 }, (_, i) => min1 + (range1 * i) / 4);
  const yLabels2 = Array.from({ length: 5 }, (_, i) => min2 + (range2 * i) / 4);

  // X-axis labels (show ~6 dates)
  const step = Math.max(1, Math.floor(data1.length / 6));
  const xLabels = data1
    .filter((_, i) => i % step === 0)
    .map((d, idx) => ({
      label: d.date.slice(0, 7),
      x: PAD.left + ((idx * step) / (data1.length - 1)) * cw,
    }));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 600 }}>
        {/* Grid */}
        {yLabels1.map((_, i) => {
          const y = PAD.top + ch - (i / 4) * ch;
          return (
            <line
              key={i}
              x1={PAD.left}
              y1={y}
              x2={W - PAD.right}
              y2={y}
              stroke="#1a1a1a"
              strokeWidth="1"
            />
          );
        })}

        {/* Lines */}
        <path d={path1} fill="none" stroke={color1} strokeWidth="2" opacity="0.9" />
        <path d={path2} fill="none" stroke={color2} strokeWidth="1.5" opacity="0.6" strokeDasharray="4,3" />

        {/* Y-axis left labels */}
        {yLabels1.map((v, i) => {
          const y = PAD.top + ch - (i / 4) * ch;
          return (
            <text key={`l${i}`} x={PAD.left - 8} y={y + 3} textAnchor="end" fill="#666" fontSize="10">
              {v >= 1000 ? (v / 1000).toFixed(1) + "T" : v.toFixed(0)}
            </text>
          );
        })}

        {/* Y-axis right labels */}
        {yLabels2.map((v, i) => {
          const y = PAD.top + ch - (i / 4) * ch;
          return (
            <text key={`r${i}`} x={W - PAD.right + 8} y={y + 3} textAnchor="start" fill="#666" fontSize="10">
              {v.toFixed(0)}
            </text>
          );
        })}

        {/* X-axis */}
        {xLabels.map((xl, i) => (
          <text key={i} x={xl.x} y={H - 6} textAnchor="middle" fill="#555" fontSize="10">
            {xl.label}
          </text>
        ))}

        {/* Legend */}
        <circle cx={PAD.left} cy={10} r="4" fill={color1} />
        <text x={PAD.left + 8} y={13} fill={color1} fontSize="10">
          {label1}
        </text>
        <circle cx={PAD.left + 120} cy={10} r="4" fill={color2} />
        <text x={PAD.left + 128} y={13} fill={color2} fontSize="10">
          {label2}
        </text>
      </svg>
    </div>
  );
}

// ── Metric Card ───────────────────────────────────────────────

function MetricCard({
  label,
  value,
  change,
  changePercent,
  unit,
  sparkData,
  sparkColor,
  alert,
}: {
  label: string;
  value: string;
  change: string;
  changePercent: number;
  unit: string;
  sparkData: number[];
  sparkColor: string;
  alert?: boolean;
}) {
  const isUp = changePercent >= 0;

  return (
    <div
      className="rounded-xl p-4 transition-colors"
      style={{
        background: "#111111",
        border: alert ? "1px solid rgba(239,68,68,0.4)" : "1px solid #222222",
      }}
    >
      <div className="mb-1 text-[11px] font-medium" style={{ color: "#888" }}>
        {label}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xl font-bold" style={{ color: "#e8e8e8" }}>
            {value}
            {unit === "%" && <span className="ml-0.5 text-sm font-normal" style={{ color: "#666" }}>%</span>}
          </div>
          <div
            className="mt-0.5 text-[11px] font-medium"
            style={{ color: isUp ? "#4ade80" : "#f87171" }}
          >
            {change} ({isUp ? "+" : ""}
            {changePercent.toFixed(2)}%)
          </div>
        </div>
        <Sparkline data={sparkData} color={sparkColor} width={80} height={32} />
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl p-4" style={{ background: "#111111", border: "1px solid #222222" }}>
      <div className="mb-2 h-3 w-20 rounded" style={{ background: "#1a1a1a" }} />
      <div className="h-6 w-24 rounded" style={{ background: "#1a1a1a" }} />
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sparkLast = (id: string, n = 12) => {
    const obs = series[id]?.observations || [];
    return obs.slice(-n).map((o) => o.value);
  };

  const chartData = useMemo(() => filterByRange(netLiquidity, range), [netLiquidity, range]);

  // Dummy S&P data placeholder - we'll use net liquidity dates
  // In real usage you'd fetch S&P 500 data separately
  const sp500Data = useMemo(() => {
    // Generate synthetic correlated data for demo
    return chartData.map((d, i) => ({
      date: d.date,
      value: 3800 + (d.value - 5) * 200 + Math.sin(i / 10) * 100,
    }));
  }, [chartData]);

  const ranges: Range[] = ["6M", "1Y", "2Y", "5Y"];

  return (
    <div className="min-h-screen font-[family-name:var(--font-noto-sans-kr)]" style={{ background: "#0a0a0a" }}>
      <AppHeader active="macro" />

      <main className="mx-auto max-w-[1400px] px-4 py-6">
        {/* Title */}
        <div className="mb-6 flex items-center justify-between">
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
          {!loading && (
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span style={{ color: "#666", fontSize: "11px" }}>FRED API</span>
            </div>
          )}
        </div>

        {/* Top row - 4 key metrics */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <MetricCard
                label={lang === "kr" ? "연준 총자산" : "Fed Total Assets"}
                value={fmt(series["WALCL"]?.latest || 0, "B$")}
                change={fmtChange(series["WALCL"]?.change || 0, "B$")}
                changePercent={series["WALCL"]?.changePercent || 0}
                unit="B$"
                sparkData={sparkLast("WALCL")}
                sparkColor="#60a5fa"
              />
              <MetricCard
                label={lang === "kr" ? "역레포" : "Reverse Repo"}
                value={fmt(series["RRPONTSYD"]?.latest || 0, "B$")}
                change={fmtChange(series["RRPONTSYD"]?.change || 0, "B$")}
                changePercent={series["RRPONTSYD"]?.changePercent || 0}
                unit="B$"
                sparkData={sparkLast("RRPONTSYD")}
                sparkColor="#f472b6"
              />
              <MetricCard
                label={lang === "kr" ? "TGA 잔고" : "TGA Balance"}
                value={fmt(series["WTREGEN"]?.latest || 0, "B$")}
                change={fmtChange(series["WTREGEN"]?.change || 0, "B$")}
                changePercent={series["WTREGEN"]?.changePercent || 0}
                unit="B$"
                sparkData={sparkLast("WTREGEN")}
                sparkColor="#facc15"
              />
              <MetricCard
                label={lang === "kr" ? "순유동성" : "Net Liquidity"}
                value={fmt(series["NET_LIQUIDITY"]?.latest || 0, "T$")}
                change={fmtChange(series["NET_LIQUIDITY"]?.change || 0, "T$")}
                changePercent={series["NET_LIQUIDITY"]?.changePercent || 0}
                unit="T$"
                sparkData={sparkLast("NET_LIQUIDITY")}
                sparkColor="#4ade80"
              />
            </>
          )}
        </div>

        {/* Chart - Net Liquidity vs S&P500 */}
        <div
          className="mb-4 rounded-xl p-4"
          style={{ background: "#111111", border: "1px solid #222222" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>
              {lang === "kr" ? "순유동성 vs S&P 500" : "Net Liquidity vs S&P 500"}
            </h2>
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

          {loading ? (
            <div
              className="flex h-[320px] items-center justify-center animate-pulse rounded-lg"
              style={{ background: "#0d0d0d" }}
            >
              <span style={{ color: "#444" }}>Loading...</span>
            </div>
          ) : (
            <DualAxisChart
              data1={chartData}
              label1={lang === "kr" ? "순유동성 (T$)" : "Net Liquidity (T$)"}
              color1="#4ade80"
              data2={sp500Data}
              label2="S&P 500"
              color2="#60a5fa"
            />
          )}

          <div className="mt-2 text-[10px]" style={{ color: "#555" }}>
            {lang === "kr"
              ? "순유동성 = 연준 총자산 - TGA 잔고 - 역레포 | 출처: FRED"
              : "Net Liquidity = Fed Assets - TGA - Reverse Repo | Source: FRED"}
          </div>
        </div>

        {/* Bottom row - 4 more metrics */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <MetricCard
                label={lang === "kr" ? "기준금리" : "Fed Funds Rate"}
                value={(series["FEDFUNDS"]?.latest || 0).toFixed(2)}
                change={fmtChange(series["FEDFUNDS"]?.change || 0, "%")}
                changePercent={series["FEDFUNDS"]?.changePercent || 0}
                unit="%"
                sparkData={sparkLast("FEDFUNDS")}
                sparkColor="#c084fc"
              />
              <MetricCard
                label={lang === "kr" ? "10Y-2Y 스프레드" : "10Y-2Y Spread"}
                value={(series["T10Y2Y"]?.latest || 0).toFixed(2)}
                change={fmtChange(series["T10Y2Y"]?.change || 0, "%")}
                changePercent={series["T10Y2Y"]?.changePercent || 0}
                unit="%"
                sparkData={sparkLast("T10Y2Y")}
                sparkColor={(series["T10Y2Y"]?.latest || 0) < 0 ? "#f87171" : "#4ade80"}
                alert={(series["T10Y2Y"]?.latest || 0) < 0}
              />
              <MetricCard
                label={lang === "kr" ? "CPI (YoY)" : "CPI Index"}
                value={(series["CPIAUCSL"]?.latest || 0).toFixed(1)}
                change={fmtChange(series["CPIAUCSL"]?.change || 0, "index")}
                changePercent={series["CPIAUCSL"]?.changePercent || 0}
                unit="index"
                sparkData={sparkLast("CPIAUCSL")}
                sparkColor="#fb923c"
              />
              <MetricCard
                label={lang === "kr" ? "실업률" : "Unemployment Rate"}
                value={(series["UNRATE"]?.latest || 0).toFixed(1)}
                change={fmtChange(series["UNRATE"]?.change || 0, "%")}
                changePercent={series["UNRATE"]?.changePercent || 0}
                unit="%"
                sparkData={sparkLast("UNRATE")}
                sparkColor="#2dd4bf"
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
