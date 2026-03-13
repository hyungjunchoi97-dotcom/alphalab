"use client";

import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

// Vivid neon colors per district
const NEON_COLORS = [
  '#ff3b3b','#ff8c00','#ffd700','#00ff88','#00cfff','#bf5fff','#ff69b4','#ff6347','#7fff00','#00bfff',
  '#ff1493','#adff2f','#ff4500','#1e90ff','#ff00ff','#00ff7f','#ff6600','#ffff00','#00ffff','#ff0055',
  '#39ff14','#ff9900','#0affef','#ff2d55','#ccff00',
];
const DISTRICT_NAMES_ORDER = [
  "강남구","서초구","송파구","용산구","마포구","성동구","광진구","동작구","영등포구","강서구",
  "양천구","구로구","금천구","관악구","동대문구","중랑구","성북구","강북구","도봉구","노원구",
  "은평구","서대문구","종로구","중구","강동구",
];
const DISTRICT_COLORS: Record<string, string> = Object.fromEntries(
  DISTRICT_NAMES_ORDER.map((name, i) => [name, NEON_COLORS[i % NEON_COLORS.length]])
);

const TOP5 = new Set(["강남구", "서초구", "송파구", "용산구", "마포구"]);

const PERIODS = [
  { label: "1Y", range: 12 },
  { label: "3Y", range: 36 },
  { label: "5Y", range: 60 },
] as const;

interface Props {
  months: string[];
  districts: Record<string, (number | null)[]>;
  districtVolumes: Record<string, (number | null)[]>;
  selectedDistrict: string | null;
  onSelect: (name: string) => void;
  range: number;
  onRangeChange: (range: number) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, unit = "억" }: any) {
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
          <span style={{ color: "#e0e0e0", fontWeight: 600 }}>{unit === "억" ? `${e.value.toFixed(1)}억` : `${e.value}건`}</span>
        </div>
      ))}
    </div>
  );
}

export default function PriceChart({ months, districts, districtVolumes, selectedDistrict, onSelect, range, onRangeChange }: Props) {
  const [pinned, setPinned] = useState<Set<string>>(new Set());

  const districtNames = useMemo(() => Object.keys(districts), [districts]);

  const chartData = useMemo(() =>
    months.map((m, i) => {
      const row: Record<string, string | number | null> = { month: m };
      for (const name of districtNames) {
        row[name] = districts[name]?.[i] ?? null;
      }
      return row;
    }),
    [months, districtNames, districts]
  );

  const volumeData = useMemo(() =>
    months.map((m, i) => {
      const row: Record<string, string | number | null> = { month: m };
      for (const name of districtNames) {
        row[name] = districtVolumes[name]?.[i] ?? null;
      }
      // Aggregated total for "전체" mode
      let total = 0;
      let hasAny = false;
      for (const name of districtNames) {
        const v = districtVolumes[name]?.[i];
        if (v != null) { total += v; hasAny = true; }
      }
      row["서울 전체"] = hasAny ? total : null;
      return row;
    }),
    [months, districtNames, districtVolumes]
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
    <div style={{ background: "#0a0a0a", height: "100%" }}>
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
          {PERIODS.map(({ label, range: r }) => (
            <button
              key={label}
              onClick={() => onRangeChange(r)}
              style={{
                ...btnBase,
                border: `1px solid ${range === r ? "#f59e0b60" : "#1e1e1e"}`,
                background: range === r ? "#f59e0b12" : "#0e0e0e",
                color: range === r ? "#f59e0b" : "#3a3a3a",
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* Price chart title */}
      <div style={{
        padding: "8px 12px 4px 12px",
        fontSize: 11, fontFamily: "'IBM Plex Mono', monospace",
        color: "#999",
      }}>
        지역별 평균가 추이
      </div>
      {/* Price chart */}
      <div style={{ height: 250, padding: "2px 4px 4px 0" }}>
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
              const color = DISTRICT_COLORS[name] ?? "#666";
              return (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: isHighlit ? 4 : 2, fill: color }}
                  opacity={1}
                  connectNulls
                  onClick={() => onSelect(name)}
                  style={{ cursor: "pointer" }}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Volume chart */}
      {Object.keys(districtVolumes).length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{
            padding: "6px 12px 2px",
            fontSize: 11, fontFamily: "'IBM Plex Mono', monospace",
            color: "#f59e0b", fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", borderTop: "1px solid #1e1e1e",
          }}>
            지역별 거래량 추이
          </div>
          <div style={{ height: 180, padding: "2px 4px 4px 0" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={volumeData} margin={{ top: 2, right: 12, left: 0, bottom: 2 }}>
                <CartesianGrid stroke="#161616" strokeDasharray="0" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#ffffff", fontFamily: "'IBM Plex Mono', monospace" }}
                  axisLine={{ stroke: "#1e1e1e" }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `${v}`}
                  tick={{ fontSize: 12, fill: "#ffffff", fontFamily: "'IBM Plex Mono', monospace" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<ChartTooltip unit="건" />} />
                {pinned.size === 0 ? (
                  <Line
                    key="서울 전체"
                    type="monotone"
                    dataKey="서울 전체"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3, fill: "#f59e0b" }}
                    connectNulls
                  />
                ) : (
                  activeNames.map(name => {
                    const isHighlit = name === highlighted;
                    const color = DISTRICT_COLORS[name] ?? "#666";
                    return (
                      <Line
                        key={name}
                        type="monotone"
                        dataKey={name}
                        stroke={color}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: isHighlit ? 4 : 2, fill: color }}
                        opacity={1}
                        connectNulls
                        onClick={() => onSelect(name)}
                        style={{ cursor: "pointer" }}
                      />
                    );
                  })
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
