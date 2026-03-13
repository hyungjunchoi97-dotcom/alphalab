"use client";

import { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
} from "recharts";

interface LandmarkTrade {
  date: string;
  floor: number;
  area: number;
  price: number;
  priceInBillion: number;
}

interface Landmark {
  name: string;
  district: string;
  trades: LandmarkTrade[];
}

const S: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" };
const DISTRICT_ORDER = ["강남구", "서초구", "송파구", "용산구", "성동구", "마포구"];

function toPyeong(sqm: number): number {
  return Math.round(sqm * 0.3025);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MiniTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#111", border: "1px solid #2a2a2a",
      padding: "4px 8px", ...S, fontSize: 10, color: "#e0e0e0",
    }}>
      <div style={{ color: "#555", fontSize: 9 }}>{label}</div>
      <div style={{ color: "#f59e0b", fontWeight: 600 }}>{payload[0].value.toFixed(1)}억</div>
    </div>
  );
}

function LandmarkCard({ lm }: { lm: Landmark }) {
  const [selectedPyeong, setSelectedPyeong] = useState<number | null>(null);

  const uniquePyeongs = useMemo(() => {
    const set = new Set<number>();
    for (const t of lm.trades) set.add(toPyeong(t.area));
    return [...set].sort((a, b) => a - b);
  }, [lm.trades]);

  const filteredTrades = useMemo(() => {
    if (selectedPyeong == null) return lm.trades;
    return lm.trades.filter(t => {
      const p = toPyeong(t.area);
      return Math.abs(t.area - (selectedPyeong / 0.3025)) <= 3;
    });
  }, [lm.trades, selectedPyeong]);

  // Monthly aggregation for chart: average price per month
  const chartData = useMemo(() => {
    const byMonth = new Map<string, number[]>();
    for (const t of filteredTrades) {
      const ym = t.date.slice(0, 7); // "YYYY-MM"
      if (!byMonth.has(ym)) byMonth.set(ym, []);
      byMonth.get(ym)!.push(t.priceInBillion);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, prices]) => ({
        month: ym.slice(2).replace("-", "."), // "YY.MM"
        price: Math.round((prices.reduce((s, p) => s + p, 0) / prices.length) * 10) / 10,
      }));
  }, [filteredTrades]);

  const latest = filteredTrades[0];

  return (
    <div style={{
      background: "#0e0e0e", border: "1px solid #1e1e1e",
      padding: 12, display: "flex", flexDirection: "column",
    }}>
      {/* Card header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontFamily: "'IBM Plex Sans KR', sans-serif", fontWeight: 700, color: "#f59e0b" }}>
          {lm.name}
        </div>
        {latest && (
          <div style={{ fontSize: 18, ...S, fontWeight: 700, color: "#e0e0e0" }}>
            {latest.priceInBillion}억
          </div>
        )}
      </div>

      {/* Area filter buttons */}
      {uniquePyeongs.length > 1 && (
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 6, flexShrink: 0 }}>
          <button
            onClick={() => setSelectedPyeong(null)}
            style={{
              ...S, fontSize: 9, padding: "1px 5px", cursor: "pointer",
              border: "1px solid #333",
              background: selectedPyeong == null ? "#f59e0b" : "#1a1a1a",
              color: selectedPyeong == null ? "#000" : "#666",
              fontWeight: selectedPyeong == null ? 700 : 400,
            }}
          >전체</button>
          {uniquePyeongs.map(p => (
            <button
              key={p}
              onClick={() => setSelectedPyeong(prev => prev === p ? null : p)}
              style={{
                ...S, fontSize: 9, padding: "1px 5px", cursor: "pointer",
                border: "1px solid #333",
                background: selectedPyeong === p ? "#f59e0b" : "#1a1a1a",
                color: selectedPyeong === p ? "#000" : "#666",
                fontWeight: selectedPyeong === p ? 700 : 400,
              }}
            >{p}평</button>
          ))}
        </div>
      )}

      {/* Trades table */}
      {filteredTrades.length > 0 ? (
        <div style={{ height: 160, overflowY: "auto", flexShrink: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, ...S }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e1e1e", position: "sticky", top: 0, background: "#0e0e0e" }}>
                {["날짜", "면적", "층", "가격"].map(h => (
                  <th key={h} style={{ padding: "4px 4px", color: "#444", fontWeight: 400, textAlign: h === "가격" ? "right" : "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map((t, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #141414" }}>
                  <td style={{ padding: "3px 4px", color: "#888" }}>{t.date}</td>
                  <td style={{ padding: "3px 4px", color: "#888" }}>{t.area.toFixed(0)}㎡</td>
                  <td style={{ padding: "3px 4px", color: "#888" }}>{t.floor}F</td>
                  <td style={{ padding: "3px 4px", color: "#e0e0e0", fontWeight: 600, textAlign: "right" }}>{t.priceInBillion}억</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", ...S, fontSize: 10, color: "#333" }}>
          거래 내역 없음
        </div>
      )}

      {/* Mini price chart */}
      {chartData.length >= 2 && (
        <div style={{ height: 120, marginTop: 6, flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 2 }}>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 9, fill: "#555", fontFamily: "'IBM Plex Mono', monospace" }}
                axisLine={{ stroke: "#1e1e1e" }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={v => `${v}`}
                tick={{ fontSize: 9, fill: "#555", fontFamily: "'IBM Plex Mono', monospace" }}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              <Tooltip content={<MiniTooltip />} />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#f59e0b"
                strokeWidth={1.5}
                dot={{ r: 3, fill: "#f59e0b" }}
                activeDot={{ r: 4, fill: "#f59e0b" }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function LandmarkView() {
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLandmarks = (refresh = false) => {
    setLoading(true);
    fetch(`/api/realestate/landmarks${refresh ? "?refresh=true" : ""}`)
      .then(r => r.json())
      .then(j => { if (j.ok) setLandmarks(j.landmarks ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchLandmarks(); }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, Landmark[]>();
    for (const d of DISTRICT_ORDER) map.set(d, []);
    for (const lm of landmarks) {
      const arr = map.get(lm.district);
      if (arr) arr.push(lm);
      else map.set(lm.district, [lm]);
    }
    return DISTRICT_ORDER.filter(d => (map.get(d)?.length ?? 0) > 0).map(d => ({
      district: d,
      items: map.get(d)!,
    }));
  }, [landmarks]);

  return (
    <div style={{ padding: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ ...S, fontSize: 12, fontWeight: 700, color: "#e0e0e0", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          랜드마크 아파트 실거래
        </div>
        <button
          onClick={() => fetchLandmarks(true)}
          disabled={loading}
          style={{ ...S, background: "#161616", border: "1px solid #2a2a2a", color: "#3a3a3a", fontSize: 11, padding: "3px 10px", cursor: "pointer" }}
        >
          {loading ? "…" : "↻"}
        </button>
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} style={{ height: 420, background: "#0e0e0e", border: "1px solid #1e1e1e" }} />
          ))}
        </div>
      ) : grouped.length > 0 ? (
        <div>
          {grouped.map((group, gi) => (
            <div key={group.district}>
              {/* District header */}
              <div style={{
                padding: "12px 0 6px 4px",
                borderBottom: "1px solid #f59e0b",
                marginTop: gi === 0 ? 0 : 24,
              }}>
                <span style={{ fontSize: 13, fontFamily: "'IBM Plex Sans KR', sans-serif", fontWeight: 700, color: "#ffffff" }}>
                  {group.district}
                </span>
              </div>

              {/* Cards grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 10 }}>
                {group.items.map(lm => (
                  <LandmarkCard key={`${lm.district}-${lm.name}`} lm={lm} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...S, fontSize: 11, color: "#333", padding: "40px 0", textAlign: "center" }}>랜드마크 데이터 없음</div>
      )}
    </div>
  );
}
