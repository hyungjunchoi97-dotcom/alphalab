"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
  "강남구", "서초구", "용산구", "송파구", "성동구", "마포구", "광진구", "양천구", "영등포구", "강동구",
  "동작구", "종로구", "중구",
  "서대문구", "강서구", "동대문구", "성북구", "은평구", "관악구",
  "노원구", "구로구", "중랑구", "금천구", "강북구", "도봉구",
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

/* ── News Item Type ── */
interface NewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
}

/* ── Main Component ── */
export default function TierListClient({ embedded = false }: { embedded?: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(12);
  const [fetched, setFetched] = useState(false);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);

  useEffect(() => {
    if (fetched) return;
    setLoading(true);
    fetch("/api/realestate/landmarks?range=60")
      .then(res => res.json())
      .then(j => { if (j.ok) setLandmarks(j.landmarks ?? []); setFetched(true); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetched]);

  useEffect(() => {
    fetch("/api/realestate/news?district=서울&limit=15")
      .then(res => res.json())
      .then(j => { if (j.ok) setNews(j.news ?? []); })
      .catch(() => {})
      .finally(() => setNewsLoading(false));
  }, []);

  const handleSelect = useCallback((district: string) => {
    if (!AVAILABLE_DISTRICTS.has(district)) return;
    setSelected(prev => prev === district ? null : district);
  }, []);

  const cutoffDate = useMemo(() => {
    if (range >= 60) return null; // show all
    const d = new Date();
    d.setMonth(d.getMonth() - range);
    return d.toISOString().slice(0, 10);
  }, [range]);

  const filteredLandmarks = useMemo(() => {
    if (!selected) return [];
    return landmarks
      .filter(lm => lm.district === selected)
      .map(lm => {
        if (!cutoffDate) return lm;
        const trades = lm.trades.filter(t => t.date >= cutoffDate);
        return { ...lm, trades };
      });
  }, [landmarks, selected, cutoffDate]);

  const tierColor = selected ? TIER_COLORS[getTierForDistrict(selected)] : "#f59e0b";

  return (
    <div style={{ background: embedded ? "transparent" : "#080c12", minHeight: embedded ? "auto" : "100vh", color: "#e0e0e0" }}>
      {!embedded && <AppHeader active="/realestate" />}
      <div style={{ maxWidth: 1800, margin: "0 auto", padding: embedded ? "14px" : "16px 16px 40px" }}>
        {/* Title */}
        <div style={{ ...S, fontSize: 13, fontWeight: 700, color: "#e0e0e0", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>
          Seoul Apartment Tier List
        </div>

        <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Left: Tier Pyramid */}
          <div style={{ flex: "0 0 45%", minWidth: 500 }}>
            {TIERS.map(({ tier, districts }, ti) => {
              const color = TIER_COLORS[tier];
              const widthPcts = [30, 42, 55, 68, 82, 100];
              const widthPct = widthPcts[ti];
              return (
                <div key={tier} style={{ display: "flex", alignItems: "center", marginBottom: 3 }}>
                  {/* Tier label outside pyramid */}
                  <div style={{
                    ...S, fontSize: 30, fontWeight: 900, color,
                    width: 44, textAlign: "center", flexShrink: 0, marginRight: 10,
                  }}>
                    {tier}
                  </div>

                  {/* Pyramid row */}
                  <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
                    <div style={{
                      width: `${widthPct}%`, minHeight: 64,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      gap: 6, flexWrap: "wrap",
                      padding: "16px 16px",
                      background: `linear-gradient(90deg, ${color}30 0%, ${color}18 40%, transparent 100%)`,
                      borderLeft: `3px solid ${color}`,
                      borderBottom: `1px solid ${color}15`,
                      position: "relative",
                    }}>
                      {districts.map(d => {
                        const available = AVAILABLE_DISTRICTS.has(d);
                        const isActive = selected === d;
                        return (
                          <button
                            key={d}
                            onClick={() => handleSelect(d)}
                            disabled={!available}
                            style={{
                              ...S, fontSize: 13, padding: "6px 14px",
                              borderRadius: 2,
                              border: `1px solid ${available ? color : "#333"}`,
                              background: isActive ? color : available ? `${color}20` : "#1a1a1a",
                              color: isActive ? "#000" : available ? "#e0e0e0" : "#3a3a3a",
                              fontWeight: isActive ? 700 : 400,
                              cursor: available ? "pointer" : "not-allowed",
                              opacity: available ? 1 : 0.3,
                              transition: "background 0.15s, color 0.15s",
                              whiteSpace: "nowrap",
                            }}
                            onMouseEnter={e => {
                              if (available && !isActive) {
                                e.currentTarget.style.background = color;
                                e.currentTarget.style.color = "#000";
                                e.currentTarget.style.fontWeight = "700";
                              }
                            }}
                            onMouseLeave={e => {
                              if (available && !isActive) {
                                e.currentTarget.style.background = `${color}20`;
                                e.currentTarget.style.color = "#e0e0e0";
                                e.currentTarget.style.fontWeight = "400";
                              }
                            }}
                          >
                            {!available && "\uD83D\uDD12 "}{d}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
            {/* ── Seoul Real Estate News (below pyramid) ── */}
            <div style={{ marginTop: 24 }}>
              <div style={{
                ...S, fontSize: 11, fontWeight: 700, color: "#666",
                letterSpacing: "0.12em", textTransform: "uppercase",
                paddingBottom: 8, marginBottom: 12,
                borderBottom: "1px solid #1e1e1e",
              }}>
                서울 부동산 뉴스
              </div>

              {newsLoading ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0" }}>
                  <svg
                    style={{ width: 14, height: 14, color: "#f59e0b" }}
                    className="animate-spin"
                    viewBox="0 0 24 24" fill="none"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M12 2a10 10 0 019.8 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  <span style={{ ...S, fontSize: 10, color: "#555" }}>뉴스 로딩 중...</span>
                </div>
              ) : news.length === 0 ? (
                <div style={{ ...S, fontSize: 10, color: "#444", padding: "12px 0" }}>
                  뉴스를 불러올 수 없습니다
                </div>
              ) : (
                <div>
                  {news.map((item, i) => (
                    <a
                      key={i}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex", alignItems: "baseline", gap: 8,
                        padding: "7px 0",
                        borderBottom: "1px solid #111",
                        textDecoration: "none",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "#0e0e0e";
                        const t = e.currentTarget.querySelector("[data-title]") as HTMLElement;
                        if (t) t.style.color = "#fbbf24";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "transparent";
                        const t = e.currentTarget.querySelector("[data-title]") as HTMLElement;
                        if (t) t.style.color = "#e0e0e0";
                      }}
                    >
                      <span style={{ ...S, fontSize: 10, color: "#f59e0b", flexShrink: 0, width: 18, textAlign: "right", fontWeight: 600 }}>
                        {i + 1}
                      </span>
                      <span data-title="" style={{ fontSize: 13, color: "#e0e0e0", flex: 1, transition: "color 0.15s", lineHeight: 1.4 }}>
                        {item.title}
                      </span>
                      {item.source && (
                        <span style={{ ...S, fontSize: 9, color: "#555", flexShrink: 0 }}>
                          {item.source}
                        </span>
                      )}
                      <span style={{ ...S, fontSize: 9, color: "#444", flexShrink: 0 }}>
                        {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : ""}
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Landmark detail panel */}
          <div style={{ flex: "1 1 520px", minWidth: 320 }}>
            {/* Range selector */}
            <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
              {([
                { label: "1Y", r: 12 },
                { label: "3Y", r: 36 },
                { label: "5Y", r: 60 },
              ] as const).map(({ label, r }) => (
                <button
                  key={label}
                  onClick={() => setRange(r)}
                  disabled={loading}
                  style={{
                    ...S, fontSize: 10, padding: "3px 10px", cursor: "pointer",
                    border: `1px solid ${range === r ? "#f59e0b" : "#333"}`,
                    background: range === r ? "#f59e0b" : "#1a1a1a",
                    color: range === r ? "#000" : "#666",
                    fontWeight: range === r ? 700 : 400,
                  }}
                >{label}</button>
              ))}
            </div>

            {selected ? (
              loading ? (
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: "80px 0", border: "1px solid #1e1e1e", background: "#0a0a0a",
                }}>
                  <svg
                    style={{ width: 36, height: 36, color: "#f59e0b", marginBottom: 16 }}
                    className="animate-spin"
                    viewBox="0 0 24 24" fill="none"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M12 2a10 10 0 019.8 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  <div style={{ ...S, fontSize: 13, color: "#e0e0e0", fontWeight: 600, marginBottom: 6 }}>
                    부동산 실거래 데이터를 불러오는 중입니다...
                  </div>
                  <div style={{ ...S, fontSize: 11, color: "#555" }}>
                    API 데이터 호출에 최대 1분 정도 소요될 수 있습니다
                  </div>
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
