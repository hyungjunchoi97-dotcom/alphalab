"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/lib/LangContext";
import AppHeader from "@/components/AppHeader";

// ── Types ─────────────────────────────────────────────────────

interface Holding {
  ticker: string;
  company: string;
  shares: number;
  value: number;
  weight: number;
}

interface GuruData {
  id: string;
  name: string;
  fund: string;
  cik: string;
  holdings: Holding[];
  totalValue: number;
  lastFiled: string;
}

// ── Categories ────────────────────────────────────────────────

interface Category {
  id: string;
  labelKr: string;
  labelEn: string;
  guruIds: string[];
  accent: string;
}

const CATEGORIES: Category[] = [
  { id: "value", labelKr: "가치투자", labelEn: "Value", guruIds: ["berkshire", "pabrai", "burry", "einhorn", "klarman"], accent: "#60a5fa" },
  { id: "macro", labelKr: "매크로/글로벌", labelEn: "Macro/Global", guruIds: ["druckenmiller", "tepper", "cohen", "englander"], accent: "#34d399" },
  { id: "growth", labelKr: "성장/테크", labelEn: "Growth/Tech", guruIds: ["ark", "coleman", "halvorsen", "twosigma"], accent: "#c084fc" },
  { id: "activist", labelKr: "행동주의", labelEn: "Activist", guruIds: ["ackman", "griffin"], accent: "#fbbf24" },
];

// ── Guru meta (initials, colors, style tag) ───────────────────

interface GuruMeta {
  initials: string;
  accent: string;
  styleKr: string;
  styleEn: string;
}

const GURU_META: Record<string, GuruMeta> = {
  // Value
  berkshire: { initials: "WB", accent: "#60a5fa", styleKr: "집중 가치투자", styleEn: "Concentrated Value" },
  pabrai: { initials: "MP", accent: "#60a5fa", styleKr: "딥밸류", styleEn: "Deep Value" },
  burry: { initials: "MB", accent: "#60a5fa", styleKr: "역발상 가치투자", styleEn: "Contrarian Value" },
  einhorn: { initials: "DE", accent: "#60a5fa", styleKr: "밸류 숏셀러", styleEn: "Value Short Seller" },
  klarman: { initials: "SK", accent: "#60a5fa", styleKr: "안전마진 가치투자", styleEn: "Margin of Safety" },
  // Macro
  druckenmiller: { initials: "SD", accent: "#34d399", styleKr: "매크로 트레이딩", styleEn: "Macro Trading" },
  tepper: { initials: "DT", accent: "#34d399", styleKr: "이벤트 드리븐", styleEn: "Event Driven" },
  cohen: { initials: "SC", accent: "#34d399", styleKr: "퀀트 멀티전략", styleEn: "Quant Multi-Strategy" },
  englander: { initials: "IE", accent: "#34d399", styleKr: "멀티매니저", styleEn: "Multi-Manager" },
  // Growth
  ark: { initials: "CW", accent: "#c084fc", styleKr: "파괴적 혁신", styleEn: "Disruptive Innovation" },
  coleman: { initials: "CC", accent: "#c084fc", styleKr: "글로벌 테크", styleEn: "Global Tech" },
  halvorsen: { initials: "AH", accent: "#c084fc", styleKr: "롱숏 펀더멘털", styleEn: "Long/Short Fundamental" },
  twosigma: { initials: "2Σ", accent: "#c084fc", styleKr: "퀀트 시스템", styleEn: "Quant Systematic" },
  // Activist
  ackman: { initials: "BA", accent: "#fbbf24", styleKr: "행동주의 집중투자", styleEn: "Activist Concentrated" },
  griffin: { initials: "KG", accent: "#fbbf24", styleKr: "마켓메이킹 멀티전략", styleEn: "Market Making Multi-Strategy" },
};

function formatValue(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}B`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}M`;
  return `$${v}K`;
}

function formatShares(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function WeightBar({ weight, color }: { weight: number; color: string }) {
  return (
    <div style={{ width: 60, height: 8, background: "#222", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(weight, 100)}%`, height: "100%", background: color, borderRadius: 4 }} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function GurusPage() {
  const { lang } = useLang();
  const [gurus, setGurus] = useState<GuruData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"holdings" | "changes">("holdings");

  useEffect(() => {
    fetch("/api/gurus/holdings")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setGurus(d.gurus);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const guruMap = new Map(gurus.map((g) => [g.id, g]));
  const selected = selectedId ? guruMap.get(selectedId) || null : null;
  const meta = selectedId ? GURU_META[selectedId] : null;

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", color: "#e5e5e5" }}>
      <AppHeader active="gurus" />

      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 16px" }}>
        {/* Title */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>
            {lang === "kr" ? "슈퍼 투자자 포트폴리오" : "Super Investor Portfolios"}
          </h2>
          <p style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
            {lang === "kr"
              ? "SEC 13F 공시 기반 15인의 슈퍼 투자자 포트폴리오 추적"
              : "Track 15 super investor portfolios via SEC 13F filings"}
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#666" }}>
            <div style={{ fontSize: 14 }}>{lang === "kr" ? "15명의 구루 데이터 로딩중..." : "Loading 15 guru portfolios..."}</div>
          </div>
        ) : (
          <>
            {/* Category sections */}
            {CATEGORIES.map((cat) => (
              <div key={cat.id} style={{ marginBottom: 28 }}>
                {/* Category header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 3, height: 18, borderRadius: 2, background: cat.accent }} />
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "#e8e8e8", margin: 0 }}>
                    {lang === "kr" ? cat.labelKr : cat.labelEn}
                  </h3>
                  <span style={{ fontSize: 11, color: "#555" }}>({cat.guruIds.length})</span>
                </div>

                {/* Guru cards grid - 4 columns */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 12,
                  }}
                  className="guru-grid"
                >
                  {cat.guruIds.map((gid) => {
                    const guru = guruMap.get(gid);
                    const m = GURU_META[gid] || { initials: "??", accent: "#888", styleKr: "", styleEn: "" };
                    const isSelected = selectedId === gid;
                    return (
                      <button
                        key={gid}
                        onClick={() => {
                          setSelectedId(isSelected ? null : gid);
                          setTab("holdings");
                        }}
                        style={{
                          background: isSelected ? `${m.accent}08` : "#111",
                          border: `1px solid ${isSelected ? m.accent : "#222"}`,
                          borderRadius: 10,
                          padding: 16,
                          textAlign: "left",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          outline: "none",
                        }}
                      >
                        {/* Top row: avatar + name */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: "50%",
                              background: `linear-gradient(135deg, ${m.accent}33, ${m.accent}11)`,
                              border: `2px solid ${m.accent}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 14,
                              fontWeight: 700,
                              color: m.accent,
                              flexShrink: 0,
                            }}
                          >
                            {m.initials}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {guru?.name || gid}
                            </div>
                            <div style={{ fontSize: 11, color: "#666", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {guru?.fund || ""}
                            </div>
                          </div>
                        </div>

                        {/* Style tag */}
                        <div
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 10,
                            fontWeight: 500,
                            background: `${m.accent}15`,
                            color: m.accent,
                            marginBottom: 10,
                          }}
                        >
                          {lang === "kr" ? m.styleKr : m.styleEn}
                        </div>

                        {/* Recent filing badge */}
                        {(() => {
                          if (!guru?.lastFiled) return null;
                          const filed = new Date(guru.lastFiled);
                          const now = new Date();
                          const diffDays = Math.floor((now.getTime() - filed.getTime()) / (1000 * 60 * 60 * 24));
                          if (diffDays > 30) return null;
                          return (
                            <div
                              style={{
                                display: "inline-block",
                                padding: "2px 6px",
                                borderRadius: 4,
                                fontSize: 9,
                                fontWeight: 600,
                                background: "#22c55e22",
                                color: "#22c55e",
                                marginBottom: 6,
                              }}
                            >
                              {lang === "kr" ? "최근 변동" : "Recently Updated"}
                            </div>
                          );
                        })()}

                        {/* Stats row */}
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                          <div>
                            <div style={{ fontSize: 10, color: "#555" }}>{lang === "kr" ? "AUM" : "AUM"}</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: m.accent }}>
                              {guru && guru.totalValue > 0 ? formatValue(guru.totalValue) : "N/A"}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: "#555" }}>{lang === "kr" ? "종목" : "Holdings"}</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#ccc" }}>
                              {guru?.holdings.length || 0}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: "#555" }}>{lang === "kr" ? "공시" : "Filed"}</div>
                            <div style={{ fontSize: 11, fontWeight: 500, color: "#888" }}>
                              {guru?.lastFiled?.slice(5) || "—"}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Portfolio Detail */}
            {selected && meta && (
              <div
                style={{
                  background: "#111",
                  border: `1px solid ${meta.accent}33`,
                  borderRadius: 12,
                  overflow: "hidden",
                  marginTop: 8,
                }}
              >
                {/* Detail Header */}
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid #222",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: `${meta.accent}22`,
                        border: `2px solid ${meta.accent}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: meta.accent,
                      }}
                    >
                      {meta.initials}
                    </div>
                    <div>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{selected.name}</span>
                      <span style={{ fontSize: 12, color: "#888", marginLeft: 8 }}>{selected.fund}</span>
                      <span
                        style={{
                          marginLeft: 8,
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 500,
                          background: `${meta.accent}15`,
                          color: meta.accent,
                        }}
                      >
                        {lang === "kr" ? meta.styleKr : meta.styleEn}
                      </span>
                    </div>
                  </div>

                  {/* Tabs + Close */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {(["holdings", "changes"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTab(t)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 500,
                          border: "none",
                          cursor: "pointer",
                          background: tab === t ? meta.accent : "#222",
                          color: tab === t ? "#000" : "#aaa",
                          transition: "all 0.15s",
                        }}
                      >
                        {t === "holdings"
                          ? lang === "kr" ? "보유 종목" : "Holdings"
                          : lang === "kr" ? "변동사항" : "Changes"}
                      </button>
                    ))}
                    <button
                      onClick={() => setSelectedId(null)}
                      style={{
                        marginLeft: 8,
                        padding: "4px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        border: "none",
                        cursor: "pointer",
                        background: "#222",
                        color: "#888",
                      }}
                    >
                      X
                    </button>
                  </div>
                </div>

                {/* Table */}
                {tab === "holdings" ? (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #222" }}>
                          <th style={{ padding: "10px 16px", textAlign: "left", color: "#666", fontWeight: 500, fontSize: 11 }}>#</th>
                          <th style={{ padding: "10px 16px", textAlign: "left", color: "#666", fontWeight: 500, fontSize: 11 }}>
                            {lang === "kr" ? "종목" : "Company"}
                          </th>
                          <th style={{ padding: "10px 16px", textAlign: "right", color: "#666", fontWeight: 500, fontSize: 11 }}>
                            {lang === "kr" ? "주식 수" : "Shares"}
                          </th>
                          <th style={{ padding: "10px 16px", textAlign: "right", color: "#666", fontWeight: 500, fontSize: 11 }}>
                            {lang === "kr" ? "가치" : "Value"}
                          </th>
                          <th style={{ padding: "10px 16px", textAlign: "right", color: "#666", fontWeight: 500, fontSize: 11 }}>
                            {lang === "kr" ? "비중" : "Weight"}
                          </th>
                          <th style={{ padding: "10px 16px", textAlign: "center", color: "#666", fontWeight: 500, fontSize: 11 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.holdings.map((h, i) => (
                          <tr
                            key={`${h.company}-${i}`}
                            style={{
                              borderBottom: "1px solid #1a1a1a",
                              transition: "background 0.15s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            <td style={{ padding: "10px 16px", color: "#555", fontSize: 12 }}>{i + 1}</td>
                            <td style={{ padding: "10px 16px" }}>
                              <a
                                href={`/ideas?ticker=${encodeURIComponent(h.ticker || h.company)}`}
                                style={{ textDecoration: "none" }}
                              >
                                <div style={{ fontWeight: 600, color: "#fff" }}>
                                  {h.ticker || "—"}
                                </div>
                                <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>{h.company}</div>
                              </a>
                            </td>
                            <td style={{ padding: "10px 16px", textAlign: "right", color: "#ccc" }}>
                              {formatShares(h.shares)}
                            </td>
                            <td style={{ padding: "10px 16px", textAlign: "right", color: "#fff", fontWeight: 500 }}>
                              {formatValue(h.value)}
                            </td>
                            <td style={{ padding: "10px 16px", textAlign: "right" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                                <span style={{ color: meta.accent, fontWeight: 600, fontSize: 12 }}>
                                  {h.weight.toFixed(1)}%
                                </span>
                                <WeightBar weight={h.weight} color={meta.accent} />
                              </div>
                            </td>
                            <td style={{ padding: "10px 16px", textAlign: "center" }}>
                              <a
                                href={`/ideas?ticker=${encodeURIComponent(h.ticker || h.company)}`}
                                style={{ fontSize: 11, color: meta.accent, textDecoration: "none", opacity: 0.7 }}
                              >
                                {"→"}
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: "40px 20px", textAlign: "center", color: "#666" }}>
                    <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ display: "inline-block" }}>
                        <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M7 16l4-8 4 4 5-9" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                      {lang === "kr" ? "분기별 변동 분석" : "Quarterly Change Analysis"}
                    </div>
                    <div style={{ fontSize: 12 }}>
                      {lang === "kr"
                        ? "다음 13F 공시 후 이전 분기 대비 변동사항이 표시됩니다."
                        : "Changes compared to previous quarter will appear after the next 13F filing."}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div
                  style={{
                    padding: "12px 20px",
                    borderTop: "1px solid #1a1a1a",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 11,
                    color: "#666",
                  }}
                >
                  <span>{lang === "kr" ? "출처: SEC EDGAR 13F 공시" : "Source: SEC EDGAR 13F Filings"}</span>
                  <span>{lang === "kr" ? "공시일" : "Filed"}: {selected.lastFiled || "—"}</span>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Responsive grid CSS */}
      <style>{`
        @media (max-width: 1024px) {
          .guru-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 768px) {
          .guru-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .guru-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
