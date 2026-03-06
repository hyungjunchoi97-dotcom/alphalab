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

// ── Guru avatars / colors ─────────────────────────────────────

const GURU_META: Record<string, { initials: string; bg: string; accent: string }> = {
  berkshire: { initials: "WB", bg: "#1a1a2e", accent: "#60a5fa" },
  druckenmiller: { initials: "SD", bg: "#1a2e1a", accent: "#34d399" },
  ark: { initials: "CW", bg: "#2e1a2e", accent: "#c084fc" },
  ackman: { initials: "BA", bg: "#2e2a1a", accent: "#fbbf24" },
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

// ── Sparkline bar chart for weight ────────────────────────────

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

  const selected = gurus.find((g) => g.id === selectedId) || null;
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
              ? "SEC 13F 공시 기반 상위 투자자 포트폴리오 추적"
              : "Track top investor portfolios via SEC 13F filings"}
          </p>
        </div>

        {/* Guru Cards */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#666" }}>
            <div style={{ fontSize: 14 }}>{lang === "kr" ? "데이터 로딩중..." : "Loading data..."}</div>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 16,
                marginBottom: 32,
              }}
            >
              {gurus.map((guru) => {
                const m = GURU_META[guru.id] || { initials: "??", bg: "#1a1a1a", accent: "#888" };
                const isSelected = selectedId === guru.id;
                return (
                  <button
                    key={guru.id}
                    onClick={() => {
                      setSelectedId(isSelected ? null : guru.id);
                      setTab("holdings");
                    }}
                    style={{
                      background: isSelected ? m.bg : "#111",
                      border: `1px solid ${isSelected ? m.accent : "#222"}`,
                      borderRadius: 12,
                      padding: 20,
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      outline: "none",
                    }}
                  >
                    {/* Avatar + Info */}
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          background: `linear-gradient(135deg, ${m.accent}33, ${m.accent}11)`,
                          border: `2px solid ${m.accent}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                          fontWeight: 700,
                          color: m.accent,
                          flexShrink: 0,
                        }}
                      >
                        {m.initials}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{guru.name}</div>
                        <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{guru.fund}</div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#666", marginBottom: 2 }}>
                          {lang === "kr" ? "총 자산" : "AUM"}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: m.accent }}>
                          {guru.totalValue > 0 ? formatValue(guru.totalValue) : "N/A"}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#666", marginBottom: 2 }}>
                          {lang === "kr" ? "종목 수" : "Holdings"}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>
                          {guru.holdings.length}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#666", marginBottom: 2 }}>
                          {lang === "kr" ? "공시일" : "Filed"}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#aaa" }}>
                          {guru.lastFiled || "—"}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Portfolio Detail */}
            {selected && meta && (
              <div
                style={{
                  background: "#111",
                  border: `1px solid ${meta.accent}33`,
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {/* Detail Header */}
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: `1px solid #222`,
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
                    </div>
                  </div>

                  {/* Tabs */}
                  <div style={{ display: "flex", gap: 4 }}>
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
                                style={{
                                  fontSize: 11,
                                  color: meta.accent,
                                  textDecoration: "none",
                                  opacity: 0.7,
                                }}
                              >
                                →
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* Changes Tab - Placeholder until we have QoQ data */
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
                  <span>
                    {lang === "kr" ? "출처: SEC EDGAR 13F 공시" : "Source: SEC EDGAR 13F Filings"}
                  </span>
                  <span>
                    {lang === "kr" ? "공시일" : "Filed"}: {selected.lastFiled || "—"}
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
