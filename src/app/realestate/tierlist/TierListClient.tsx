"use client";

import { useState, useMemo, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
} from "recharts";
import AppHeader from "@/components/AppHeader";

/* ── Types ── */
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

/* ── Constants ── */
const S: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" };

const TIER_COLORS: Record<string, string> = {
  S: "#f59e0b",
  A: "#ef4444",
  B: "#8b5cf6",
  C: "#3b82f6",
  D: "#22c55e",
  E: "#6b7280",
};

const TIERS: { tier: string; districts: string[] }[] = [
  { tier: "S", districts: ["강남구", "서초구"] },
  { tier: "A", districts: ["용산구", "송파구"] },
  { tier: "B", districts: ["성동구", "마포구", "광진구", "양천구"] },
  { tier: "C", districts: ["영등포구", "강동구", "동작구", "중구", "종로구"] },
  { tier: "D", districts: ["서대문구", "강서구", "동대문구", "성북구", "은평구", "관악구"] },
  { tier: "E", districts: ["노원구", "구로구", "중랑구", "금천구", "강북구", "도봉구"] },
];

const AVAILABLE_DISTRICTS = new Set([
  "강남구", "서초구", "용산구", "송파구", "성동구", "마포구", "광진구", "양천구", "영등포구",
]);

/* ── Helpers ── */
function toPyeong(sqm: number): number {
  return Math.round(sqm * 0.3025);
}

function getTierForDistrict(district: string): string {
  for (const t of TIERS) {
    if (t.districts.includes(district)) return t.tier;
  }
  return "E";
}

/* ── MiniTooltip (same as LandmarkView) ── */
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

/* ── LandmarkCard (copied from LandmarkView) ── */
function LandmarkCard({ lm, accentColor }: { lm: Landmark; accentColor: string }) {
  const [selectedPyeong, setSelectedPyeong] = useState<number | null>(null);

  const uniquePyeongs = useMemo(() => {
    const set = new Set<number>();
    for (const t of lm.trades) set.add(toPyeong(t.area));
    return [...set].sort((a, b) => a - b);
  }, [lm.trades]);

  const filteredTrades = useMemo(() => {
    if (selectedPyeong == null) return lm.trades;
    return lm.trades.filter(t =>
      Math.abs(t.area - (selectedPyeong / 0.3025)) <= 3
    );
  }, [lm.trades, selectedPyeong]);

  const chartData = useMemo(() => {
    const byMonth = new Map<string, number[]>();
    for (const t of filteredTrades) {
      const ym = t.date.slice(0, 7);
      if (!byMonth.has(ym)) byMonth.set(ym, []);
      byMonth.get(ym)!.push(t.priceInBillion);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, prices]) => ({
        month: ym.slice(2).replace("-", "."),
        price: Math.round((prices.reduce((s, p) => s + p, 0) / prices.length) * 10) / 10,
      }));
  }, [filteredTrades]);

  const latest = filteredTrades[0];

  return (
    <div style={{
      background: "#0e0e0e", border: "1px solid #1e1e1e",
      padding: 12, display: "flex", flexDirection: "column",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontFamily: "'IBM Plex Sans KR', sans-serif", fontWeight: 700, color: accentColor }}>
          {lm.name}
        </div>
        {latest && (
          <div style={{ fontSize: 18, ...S, fontWeight: 700, color: "#e0e0e0" }}>
            {latest.priceInBillion}억
          </div>
        )}
      </div>

      {uniquePyeongs.length > 1 && (
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 6, flexShrink: 0 }}>
          <button
            onClick={() => setSelectedPyeong(null)}
            style={{
              ...S, fontSize: 9, padding: "1px 5px", cursor: "pointer",
              border: "1px solid #333",
              background: selectedPyeong == null ? accentColor : "#1a1a1a",
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
                background: selectedPyeong === p ? accentColor : "#1a1a1a",
                color: selectedPyeong === p ? "#000" : "#666",
                fontWeight: selectedPyeong === p ? 700 : 400,
              }}
            >{p}평</button>
          ))}
        </div>
      )}

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
                stroke={accentColor}
                strokeWidth={1.5}
                dot={{ r: 3, fill: accentColor }}
                activeDot={{ r: 4, fill: accentColor }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ── */
export default function TierListClient({ embedded = false }: { embedded?: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchLandmarks = useCallback(() => {
    if (fetched) return;
    setLoading(true);
    fetch("/api/realestate/landmarks?range=12")
      .then(r => r.json())
      .then(j => { if (j.ok) setLandmarks(j.landmarks ?? []); setFetched(true); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetched]);

  const handleSelect = useCallback((district: string) => {
    if (!AVAILABLE_DISTRICTS.has(district)) return;
    setSelected(prev => prev === district ? null : district);
    fetchLandmarks();
  }, [fetchLandmarks]);

  const filteredLandmarks = useMemo(() => {
    if (!selected) return [];
    return landmarks.filter(lm => lm.district === selected);
  }, [landmarks, selected]);

  const tierColor = selected ? TIER_COLORS[getTierForDistrict(selected)] : "#f59e0b";

  return (
    <div style={{ background: embedded ? "transparent" : "#080c12", minHeight: embedded ? "auto" : "100vh", color: "#e0e0e0" }}>
      {!embedded && <AppHeader active="/realestate" />}
      <div style={{ maxWidth: 1800, margin: "0 auto", padding: embedded ? "14px" : "16px 16px 40px" }}>
        {/* Title */}
        <div style={{ ...S, fontSize: 13, fontWeight: 700, color: "#e0e0e0", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>
          Seoul Apartment Tier List
        </div>

        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Left: Tier Pyramid */}
          <div style={{ flex: "1 1 520px", minWidth: 320 }}>
            {TIERS.map(({ tier, districts }) => {
              const color = TIER_COLORS[tier];
              return (
                <div key={tier} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 0",
                  borderBottom: "1px solid #141414",
                }}>
                  {/* Tier label */}
                  <div style={{
                    ...S, fontSize: 20, fontWeight: 800, color,
                    width: 36, textAlign: "center", flexShrink: 0,
                  }}>
                    {tier}
                  </div>

                  {/* District chips */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {districts.map(d => {
                      const available = AVAILABLE_DISTRICTS.has(d);
                      const isActive = selected === d;
                      return (
                        <button
                          key={d}
                          onClick={() => handleSelect(d)}
                          disabled={!available}
                          style={{
                            ...S, fontSize: 13, padding: "4px 12px",
                            borderRadius: 4,
                            border: `1px solid ${available ? color : "#1e1e1e"}`,
                            background: isActive ? color : "#1a1a1a",
                            color: isActive ? "#000" : available ? "#e0e0e0" : "#3a3a3a",
                            fontWeight: isActive ? 700 : 400,
                            cursor: available ? "pointer" : "default",
                            opacity: available ? 1 : 0.5,
                            transition: "background 0.15s, color 0.15s",
                          }}
                          onMouseEnter={e => {
                            if (available && !isActive) {
                              e.currentTarget.style.background = color;
                              e.currentTarget.style.color = "#000";
                            }
                          }}
                          onMouseLeave={e => {
                            if (available && !isActive) {
                              e.currentTarget.style.background = "#1a1a1a";
                              e.currentTarget.style.color = "#e0e0e0";
                            }
                          }}
                        >
                          {d}{!available && " \uD83D\uDD12"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Landmark detail panel */}
          <div style={{ flex: "1 1 520px", minWidth: 320 }}>
            {selected ? (
              loading ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} style={{ height: 380, background: "#0e0e0e", border: "1px solid #1e1e1e", borderRadius: 2 }} />
                  ))}
                </div>
              ) : filteredLandmarks.length > 0 ? (
                <div>
                  <div style={{
                    ...S, fontSize: 12, fontWeight: 700, color: tierColor,
                    letterSpacing: "0.08em", textTransform: "uppercase",
                    paddingBottom: 8, marginBottom: 12,
                    borderBottom: `1px solid ${tierColor}40`,
                  }}>
                    {selected} 랜드마크 실거래
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                    {filteredLandmarks.map(lm => (
                      <LandmarkCard key={`${lm.district}-${lm.name}`} lm={lm} accentColor={tierColor} />
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{
                  ...S, fontSize: 11, color: "#333",
                  padding: "60px 0", textAlign: "center",
                  border: "1px solid #1e1e1e", background: "#0a0a0a",
                }}>
                  {selected}의 랜드마크 데이터 없음
                </div>
              )
            ) : (
              <div style={{
                ...S, fontSize: 11, color: "#333",
                padding: "60px 0", textAlign: "center",
                border: "1px solid #1e1e1e", background: "#0a0a0a",
              }}>
                구를 선택하면 랜드마크 실거래 데이터를 확인할 수 있습니다
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
