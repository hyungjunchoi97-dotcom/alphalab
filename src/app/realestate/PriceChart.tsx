"use client";

import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

// Saturated distinct colors per district
const DISTRICT_COLORS: Record<string, string> = {
  "강남구": "#ef4444",
  "서초구": "#3b82f6",
  "송파구": "#22c55e",
  "용산구": "#f59e0b",
  "마포구": "#a855f7",
  "성동구": "#06b6d4",
  "광진구": "#f97316",
  "동작구": "#84cc16",
  "영등포구": "#ec4899",
  "강서구": "#14b8a6",
  "양천구": "#eab308",
  "구로구": "#6366f1",
  "금천구": "#8b5cf6",
  "관악구": "#10b981",
  "동대문구": "#f43f5e",
  "중랑구": "#0ea5e9",
  "성북구": "#a3a3a3",
  "강북구": "#64748b",
  "도봉구": "#dc2626",
  "노원구": "#16a34a",
  "은평구": "#2563eb",
  "서대문구": "#d97706",
  "종로구": "#9333ea",
  "중구": "#0891b2",
  "강동구": "#ca8a04",
};

const TOP5 = new Set(["강남구", "서초구", "송파구", "용산구", "마포구"]);

const PERIODS = [
  { label: "1M", n: 1 },
  { label: "3M", n: 3 },
  { label: "6M", n: 6 },
  { label: "12M", n: 12 },
] as const;

interface Props {
  months: string[];
  districts: Record<string, (number | null)[]>;
  selectedDistrict: string | null;
  onSelect: (name: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload]
    .filter((e: { value: number | null }) => e.value != null)
    .sort((a: { value: number }, b: { value: number }) => b.value - a.value)
    .slice(0, 10);
  return (
    <div style={{
      background: "#111", border: "1px solid #2a2a2a",
      padding: "8px 12px", fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 11, color: "#e0e0e0", minWidth: 130,
      maxHeight: 260, overflowY: "auto",
    }}>
      <div style={{ color: "#444", marginBottom: 5, fontSize: 10 }}>{label}</div>
      {sorted.map((e: { color: string; name: string; value: number }) => (
        <div key={e.name} style={{ display: "flex", justifyContent: "space-between", gap: 14, marginBottom: 2 }}>
          <span style={{ color: e.color }}>{e.name.replace("구", "")}</span>
          <span style={{ color: "#e0e0e0", fontWeight: 600 }}>{e.value.toFixed(1)}억</span>
        </div>
      ))}
    </div>
  );
}

export default function PriceChart({ months, districts, selectedDistrict, onSelect }: Props) {
  const [period, setPeriod] = useState<1 | 3 | 6 | 12>(12);
  const [pinned, setPinned] = useState<Set<string>>(new Set());

  const districtNames = useMemo(() => Object.keys(districts), [districts]);
  const sliced = months.slice(-period);
  const startIdx = months.length - period;

  const chartData = useMemo(() =>
    sliced.map((m, i) => {
      const row: Record<string, string | number | null> = { month: m };
      for (const name of districtNames) {
        row[name] = districts[name]?.[startIdx + i] ?? null;
      }
      return row;
    }),
    [sliced, districtNames, districts, startIdx]
  );

  const highlighted = selectedDistrict ?? (pinned.size === 1 ? [...pinned][0] : null);
  const activeNames = pinned.size === 0
    ? districtNames
    : districtNames.filter(n => pinned.has(n) || n === selectedDistrict);

  function togglePin(name: string) {
    setPinned(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  const btnBase: React.CSSProperties = {
    padding: "1px 6px", fontSize: 9, cursor: "pointer",
    fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.3px",
    border: "1px solid #1e1e1e", background: "#0e0e0e", color: "#444",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#0a0a0a" }}>
      {/* Controls */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "5px 12px", borderBottom: "1px solid #1e1e1e", flexShrink: 0,
      }}>
        {/* District tags */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, flex: 1, minWidth: 0 }}>
          <button
            onClick={() => setPinned(new Set())}
            style={{
              ...btnBase,
              background: pinned.size === 0 ? "#f59e0b" : "#141414",
              color: pinned.size === 0 ? "#000" : "#555",
              border: "1px solid #2a2a2a",
            }}
          >전체</button>
          {districtNames.map(name => {
            const isPinned = pinned.has(name);
            const isHighlit = name === highlighted;
            const color = DISTRICT_COLORS[name] ?? "#666";
            return (
              <button
                key={name}
                onClick={() => togglePin(name)}
                style={{
                  ...btnBase,
                  border: `1px solid ${isPinned || isHighlit ? color + "80" : "#1e1e1e"}`,
                  background: isPinned ? color + "20" : isHighlit ? color + "10" : "#0e0e0e",
                  color: isPinned ? color : isHighlit ? color : "#3a3a3a",
                }}
              >
                {name.replace("구", "")}
                {isPinned && <span style={{ marginLeft: 2, opacity: 0.5 }}>×</span>}
              </button>
            );
          })}
        </div>

        {/* Period buttons */}
        <div style={{ display: "flex", gap: 2, flexShrink: 0, marginLeft: 10 }}>
          {PERIODS.map(({ label, n }) => (
            <button
              key={label}
              onClick={() => setPeriod(n as 1 | 3 | 6 | 12)}
              style={{
                ...btnBase,
                border: `1px solid ${period === n ? "#f59e0b60" : "#1e1e1e"}`,
                background: period === n ? "#f59e0b12" : "#0e0e0e",
                color: period === n ? "#f59e0b" : "#3a3a3a",
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ flex: 1, minHeight: 0, padding: "6px 4px 4px 0" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 2, right: 12, left: 0, bottom: 2 }}>
            <CartesianGrid stroke="#161616" strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "#ffffff", fontFamily: "'IBM Plex Mono', monospace" }}
              axisLine={{ stroke: "#1e1e1e" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${v}억`}
              tick={{ fontSize: 12, fill: "#ffffff", fontFamily: "'IBM Plex Mono', monospace" }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<ChartTooltip />} />
            {activeNames.map(name => {
              const isHighlit = name === highlighted;
              const isDimmed = highlighted != null && !isHighlit;
              const color = DISTRICT_COLORS[name] ?? "#666";
              return (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={color}
                  strokeWidth={isHighlit || TOP5.has(name) ? 2.5 : 2}
                  dot={false}
                  activeDot={{ r: isHighlit ? 4 : 2, fill: color }}
                  opacity={isDimmed ? 0.15 : 1}
                  connectNulls
                  onClick={() => onSelect(name)}
                  style={{ cursor: "pointer" }}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
