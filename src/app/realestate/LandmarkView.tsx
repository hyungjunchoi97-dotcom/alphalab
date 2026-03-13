"use client";

import { useState, useEffect } from "react";

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
            <div key={i} style={{ height: 320, background: "#0e0e0e", border: "1px solid #1e1e1e" }} />
          ))}
        </div>
      ) : landmarks.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {landmarks.map(lm => {
            const latest = lm.trades[0];
            return (
              <div key={`${lm.district}-${lm.name}`} style={{
                height: 320, background: "#0e0e0e", border: "1px solid #1e1e1e",
                padding: 12, display: "flex", flexDirection: "column",
              }}>
                {/* Card header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, flexShrink: 0 }}>
                  <div>
                    <div style={{ fontSize: 14, fontFamily: "'IBM Plex Sans KR', sans-serif", fontWeight: 700, color: "#f59e0b" }}>
                      {lm.name}
                    </div>
                    <div style={{ fontSize: 10, ...S, color: "#999", marginTop: 2 }}>{lm.district}</div>
                  </div>
                  {latest && (
                    <div style={{ fontSize: 18, ...S, fontWeight: 700, color: "#e0e0e0" }}>
                      {latest.priceInBillion}억
                    </div>
                  )}
                </div>

                {/* Scrollable trades table */}
                {lm.trades.length > 0 ? (
                  <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, ...S }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #1e1e1e", position: "sticky", top: 0, background: "#0e0e0e" }}>
                          {["날짜", "면적", "층", "가격"].map(h => (
                            <th key={h} style={{ padding: "4px 4px", color: "#444", fontWeight: 400, textAlign: h === "가격" ? "right" : "left" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {lm.trades.map((t, i) => (
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
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", ...S, fontSize: 10, color: "#333" }}>
                    거래 내역 없음
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ ...S, fontSize: 11, color: "#333", padding: "40px 0", textAlign: "center" }}>랜드마크 데이터 없음</div>
      )}
    </div>
  );
}
