"use client";

import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import AppHeader from "@/components/AppHeader";

// ── Types ────────────────────────────────────────────────────

interface HoldingRow { name: string; holdings: number; usdValue: number; country?: string }
interface SupplyData {
  btcPrice: number;
  currentBlock: number;
  blocksRemaining: number;
  estimatedDays: number;
  estimatedDate: string;
  totalMined: number;
  totalSupply: number;
  btcDominance: number;
  supply: {
    etfTotal: number;
    etfs: HoldingRow[];
    corporateTotal: number;
    companies: HoldingRow[];
    exchangeTotal: number;
    exchanges: HoldingRow[];
    satoshiHoldings: number;
    lostBtc: number;
  };
}

interface OnchainData {
  difficulty: {
    progressPercent: number; difficultyChange: number; remainingBlocks: number;
    estimatedRetargetDate: number; previousRetarget: number;
    currentDifficulty: number; currentHashrate: number;
    hashrates: { timestamp: number; avgHashrate: number }[];
  };
  fees: { fastestFee: number; halfHourFee: number; hourFee: number; economyFee: number };
  market: {
    ath: number; athDate: string; athChangePercent: number;
    circulatingSupply: number; maxSupply: number;
    priceHistory: { date: string; price: number }[];
  };
}

// ── Style ────────────────────────────────────────────────────

const S: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" };

function fmtUsd(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function Skel({ h = 20, w = "100%" }: { h?: number; w?: string | number }) {
  return <div className="animate-pulse rounded" style={{ height: h, width: w, background: "#1a1a1a" }} />;
}

// ── Section Title ────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ borderLeft: "3px solid #f59e0b", paddingLeft: 10, margin: "24px 0 12px" }}>
      <h2 style={{ ...S, fontSize: 15, fontWeight: 700, color: "#ffffff" }}>{children}</h2>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────

type CryptoTab = "supply" | "news";

export default function CryptoClient() {
  const [activeTab, setActiveTab] = useState<CryptoTab>("supply");
  const [supply, setSupply] = useState<SupplyData | null>(null);
  const [supplyLoading, setSupplyLoading] = useState(true);
  const [expandedSegment, setExpandedSegment] = useState<string | null>(null);
  const [onchain, setOnchain] = useState<OnchainData | null>(null);
  const [onchainLoading, setOnchainLoading] = useState(true);

  // Fetch supply
  useEffect(() => {
    fetch("/api/crypto/supply")
      .then(r => r.json())
      .then(j => { if (j.ok) setSupply(j); })
      .catch(() => {})
      .finally(() => setSupplyLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/crypto/onchain").then(r => r.json()).then(j => { if (j.ok) setOnchain(j); }).catch(() => {}).finally(() => setOnchainLoading(false));
  }, []);

  const d = supply;
  const sp = d?.supply;
  const btcP = d?.btcPrice ?? 0;

  // Distribution segments
  const circulation = d && sp
    ? Math.max(0, d.totalMined - sp.etfTotal - sp.corporateTotal - sp.exchangeTotal - sp.satoshiHoldings - sp.lostBtc)
    : 0;
  const unmined = d ? d.totalSupply - d.totalMined : 0;

  const segments = sp ? [
    { label: "ETF", amount: sp.etfTotal, color: "#3b82f6" },
    { label: "상장사", amount: sp.corporateTotal, color: "#f59e0b" },
    { label: "거래소", amount: sp.exchangeTotal, color: "#8b5cf6" },
    { label: "사토시 추정", amount: sp.satoshiHoldings, color: "#6b7280" },
    { label: "분실 추정", amount: sp.lostBtc, color: "#374151" },
    { label: "유통/기타", amount: circulation, color: "#16a34a" },
    { label: "미채굴", amount: unmined, color: "#111827" },
  ] : [];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap');` }} />
      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f0f0f0" }}>
        <AppHeader active="crypto" />

        {/* Tab bar */}
        <div style={{ borderBottom: "1px solid #1f2937", background: "#0d1117" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px", display: "flex", gap: 0 }}>
            {([
              { key: "supply" as CryptoTab, label: "비트코인 공급" },
              { key: "news" as CryptoTab, label: "뉴스" },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  ...S, fontSize: 12, fontWeight: 600, padding: "10px 16px",
                  background: "transparent", border: "none", cursor: "pointer",
                  color: activeTab === tab.key ? "#f59e0b" : "#6b7280",
                  borderBottom: activeTab === tab.key ? "2px solid #f59e0b" : "2px solid transparent",
                  transition: "all 0.15s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* News tab */}
        {activeTab === "news" && <WellsCryptoFeed />}

        {/* Supply tab */}
        {activeTab === "supply" && (
        <main style={{ padding: "12px 16px", maxWidth: 1200, margin: "0 auto" }}>

          <h1 style={{ ...S, fontSize: 18, fontWeight: 700, color: "#ffffff", marginBottom: 16 }}>
            <span style={{ color: "#f59e0b" }}>BITCOIN</span> SUPPLY
          </h1>

          {/* ══════════ Section 1: Halving Countdown ══════════ */}
          <SectionTitle>다음 비트코인 반감기</SectionTitle>
          <div style={{ background: "#111", border: "1px solid #2a3441", borderRadius: 8, padding: 20, marginBottom: 20 }}>
            {supplyLoading || !d ? (
              <div><Skel h={24} w={300} /><div style={{ marginTop: 12 }}><Skel h={16} /></div><div style={{ marginTop: 12 }}><Skel h={80} /></div></div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "start" }}>
                {/* Left: progress */}
                <div>
                  {/* Progress bar */}
                  <div style={{ ...S, fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>
                    블록 {d.currentBlock.toLocaleString()} / 1,050,000
                  </div>
                  <div style={{ width: "100%", height: 12, background: "#2a3441", borderRadius: 6, overflow: "hidden", marginBottom: 16 }}>
                    <div style={{ width: `${(d.currentBlock / 1050000) * 100}%`, height: "100%", background: "#f59e0b", borderRadius: 6 }} />
                  </div>
                  {/* Big number */}
                  <div style={{ ...S, fontSize: 32, fontWeight: 700, color: "#f59e0b", lineHeight: 1.2 }}>
                    {d.blocksRemaining.toLocaleString()} <span style={{ fontSize: 16, color: "#b0b8c8" }}>블록 남음</span>
                  </div>
                  <div style={{ ...S, fontSize: 13, color: "#9ca3af", marginTop: 6 }}>
                    약 {d.estimatedDays.toLocaleString()}일 후
                    {" / "}
                    {new Date(d.estimatedDate).getFullYear()}년 {new Date(d.estimatedDate).getMonth() + 1}월
                  </div>
                  {/* Explanation */}
                  <div style={{ ...S, fontSize: 12, color: "#9ca3af", marginTop: 14, lineHeight: 1.8 }}>
                    반감기마다 채굴 보상이 절반으로 줄어 신규 공급이 감소합니다. 역사적으로 반감기 후 12~18개월 내 가격 급등이 발생했습니다.
                  </div>
                </div>
                {/* Right: info boxes */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 180 }}>
                  {[
                    { label: "현재 보상", value: "3.125 BTC/블록" },
                    { label: "다음 보상", value: "1.5625 BTC/블록" },
                    { label: "역대 반감기", value: "2012 / 2016 / 2020 / 2024" },
                  ].map(b => (
                    <div key={b.label} style={{ background: "#0a0a0a", border: "1px solid #2a3441", borderRadius: 6, padding: "8px 12px" }}>
                      <div style={{ ...S, fontSize: 11, color: "#9ca3af", textTransform: "uppercase", marginBottom: 3 }}>{b.label}</div>
                      <div style={{ ...S, fontSize: 13, fontWeight: 600, color: "#ffffff" }}>{b.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ══════════ Section 2: 21M Supply ══════════ */}
          <SectionTitle>비트코인 21M 수급 구조</SectionTitle>

          {/* Summary stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
            {[
              { label: "채굴 완료", value: d ? `${d.totalMined.toLocaleString()} BTC` : null, sub: d ? `${(d.totalMined / 21000000 * 100).toFixed(1)}%` : null },
              { label: "미채굴 잔량", value: d ? `${unmined.toLocaleString()} BTC` : null },
              { label: "BTC 도미넌스", value: d ? `${d.btcDominance.toFixed(1)}%` : null },
              { label: "현재 BTC 가격", value: d ? `$${d.btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : null },
            ].map(c => (
              <div key={c.label} style={{ background: "#111", border: "1px solid #2a3441", borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ ...S, fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{c.label}</div>
                {supplyLoading || !c.value ? <Skel h={24} w={100} /> : (
                  <div>
                    <span style={{ ...S, fontSize: 20, fontWeight: 700, color: "#ffffff" }}>{c.value}</span>
                    {c.sub && <span style={{ ...S, fontSize: 13, color: "#f59e0b", marginLeft: 6 }}>{c.sub}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Distribution bar */}
          {!supplyLoading && sp && (
            <div style={{ background: "#111", border: "1px solid #2a3441", borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ ...S, fontSize: 13, fontWeight: 700, color: "#f0f0f0", marginBottom: 10 }}>21M BTC 분포</div>
              <div style={{ display: "flex", width: "100%", height: 40, borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
                {segments.map(seg => {
                  const pct = (seg.amount / 21000000) * 100;
                  if (pct < 0.3) return null;
                  const isActive = expandedSegment === seg.label;
                  return (
                    <div
                      key={seg.label}
                      onClick={() => setExpandedSegment(isActive ? null : seg.label)}
                      style={{
                        width: `${pct}%`, height: "100%",
                        background: seg.color,
                        border: seg.label === "미채굴" ? "1px solid #374151" : "none",
                        borderBottom: isActive ? "3px solid white" : "none",
                        minWidth: pct > 1 ? 2 : 0,
                        cursor: "pointer",
                        opacity: expandedSegment && !isActive ? 0.5 : 1,
                        transition: "opacity 0.15s",
                        position: "relative",
                      }}
                      title={`${seg.label}: ${seg.amount.toLocaleString()} BTC (${pct.toFixed(1)}%)`}
                    >
                      {pct >= 3 && (
                        <span style={{
                          position: "absolute", top: "50%", left: "50%",
                          transform: "translate(-50%, -50%)",
                          fontSize: 9, fontWeight: 700,
                          color: "rgba(255,255,255,0.9)",
                          whiteSpace: "nowrap", pointerEvents: "none",
                          fontFamily: "'IBM Plex Mono', monospace",
                          textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                        }}>
                          {pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Legend */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
                {segments.map(seg => {
                  const isActive = expandedSegment === seg.label;
                  return (
                    <div
                      key={seg.label}
                      onClick={() => setExpandedSegment(isActive ? null : seg.label)}
                      style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: seg.color, border: seg.label === "미채굴" ? "1px solid #374151" : "none", flexShrink: 0 }} />
                      <span style={{ ...S, fontSize: 12, color: isActive ? "#f0f0f0" : "#b0b8c8" }}>
                        {seg.label} {seg.amount.toLocaleString()} BTC ({((seg.amount / 21000000) * 100).toFixed(1)}%)
                        {isActive ? " ▲" : ""}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Expandable detail panel */}
              {expandedSegment && sp && (
                <div style={{ marginTop: 16, borderTop: "1px solid #2a3441", paddingTop: 16 }}>
                  {expandedSegment === "ETF" && (
                    <SegmentDetail
                      title="ETF 기관 보유 현황"
                      color="#3b82f6"
                      description="블랙록, 피델리티 등 자산운용사가 비트코인 현물 ETF를 통해 보유 중인 BTC입니다. 기관 투자자의 수요를 반영하며 2024년 1월 승인 이후 급격히 증가했습니다."
                      rows={sp.etfs.map(e => ({ name: e.name, amount: e.holdings, usdValue: e.usdValue }))}
                      total={sp.etfTotal}
                      btcPrice={btcP}
                    />
                  )}
                  {expandedSegment === "상장사" && (
                    <SegmentDetail
                      title="상장사 BTC 보유 현황"
                      color="#f59e0b"
                      description="재무 전략의 일환으로 BTC를 보유하는 상장 기업들입니다. Strategy(구 MicroStrategy)가 최대 보유자이며, 기업 재무 다각화 트렌드를 이끌고 있습니다."
                      rows={sp.companies.map(c => ({ name: c.name, amount: c.holdings, usdValue: c.usdValue, country: c.country }))}
                      total={sp.corporateTotal}
                      btcPrice={btcP}
                    />
                  )}
                  {expandedSegment === "거래소" && (
                    <SegmentDetail
                      title="주요 거래소 추정 보유량"
                      color="#8b5cf6"
                      description="거래소가 고객 자산 보관 목적으로 보유하는 BTC입니다. 공개 지갑 분석 기반 추정치이며 실제와 다를 수 있습니다. 거래소 잔고 감소는 장기 보유 신호로 해석됩니다."
                      rows={sp.exchanges.map(e => ({ name: e.name, amount: e.holdings, usdValue: e.usdValue }))}
                      total={sp.exchangeTotal}
                      btcPrice={btcP}
                      note="* 공개 지갑 기반 추정치"
                    />
                  )}
                  {expandedSegment === "사토시 추정" && (
                    <div>
                      <div style={{ ...S, fontSize: 13, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>사토시 나카모토 추정 보유량</div>
                      <div style={{ ...S, fontSize: 13, color: "#b0b8c8", lineHeight: 1.8, marginBottom: 12 }}>
                        비트코인 창시자 사토시 나카모토가 초기 채굴을 통해 보유한 것으로 추정되는 약 110만 BTC입니다.
                        이 지갑들은 비트코인 탄생 이후 한 번도 움직인 적이 없습니다.
                        사토시의 정체는 밝혀지지 않았으며, 해당 BTC는 사실상 영구 동결 상태로 간주됩니다.
                      </div>
                      <div style={{ background: "#0a0a0a", border: "1px solid #2a3441", borderRadius: 6, padding: "12px 16px" }}>
                        {[
                          { label: "추정 보유량", value: "~1,100,000 BTC" },
                          { label: "USD 추정 가치", value: fmtUsd(1100000 * btcP) },
                          { label: "마지막 이동", value: "기록 없음 (2009년 이후)" },
                        ].map((row, i) => (
                          <div key={row.label} style={{ display: "flex", justifyContent: "space-between", marginTop: i > 0 ? 8 : 0 }}>
                            <span style={{ ...S, fontSize: 13, color: "#b0b8c8" }}>{row.label}</span>
                            <span style={{ ...S, fontSize: 13, fontWeight: 700, color: "#9ca3af" }}>{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {expandedSegment === "분실 추정" && (
                    <div>
                      <div style={{ ...S, fontSize: 13, fontWeight: 700, color: "#9ca3af", marginBottom: 8 }}>분실 추정 BTC</div>
                      <div style={{ ...S, fontSize: 13, color: "#b0b8c8", lineHeight: 1.8, marginBottom: 12 }}>
                        초기 채굴자들의 하드드라이브 분실, 사망, 키 망각 등으로 영구적으로 접근 불가능해진 BTC입니다.
                        Chainalysis 추정 기준 약 370만 BTC가 10년 이상 미이동 상태입니다.
                        분실 BTC는 실질 유통량을 줄여 희소성을 높이는 효과가 있습니다.
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {[
                          { label: "10년 이상 미이동", value: "~3,700,000 BTC" },
                          { label: "Chainalysis 추정", value: "290~380만 BTC" },
                          { label: "James Howells (매립지)", value: "7,500 BTC" },
                          { label: "실질 유통 공급 감소 효과", value: "총 공급의 ~17.6%" },
                        ].map(row => (
                          <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#0a0a0a", border: "1px solid #2a3441", borderRadius: 6 }}>
                            <span style={{ ...S, fontSize: 13, color: "#b0b8c8" }}>{row.label}</span>
                            <span style={{ ...S, fontSize: 13, color: "#9ca3af" }}>{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {expandedSegment === "유통/기타" && (
                    <div>
                      <div style={{ ...S, fontSize: 13, fontWeight: 700, color: "#16a34a", marginBottom: 8 }}>유통 중인 BTC (개인/소규모 보유)</div>
                      <div style={{ ...S, fontSize: 13, color: "#b0b8c8", lineHeight: 1.8, marginBottom: 12 }}>
                        ETF, 상장사, 거래소, 사토시 추정분을 제외한 나머지로 개인 투자자, 소규모 기관, VC, 펀드 등이 보유 중인 BTC입니다.
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {[
                          { label: "추정 보유량", value: `${circulation.toLocaleString()} BTC` },
                          { label: "전체 대비", value: `${((circulation / 21000000) * 100).toFixed(1)}%` },
                          { label: "USD 추정", value: fmtUsd(circulation * btcP) },
                        ].map(s => (
                          <div key={s.label} style={{ flex: 1, minWidth: 120, padding: "10px 14px", background: "#0a0a0a", border: "1px solid #2a3441", borderRadius: 6 }}>
                            <div style={{ ...S, fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>{s.label}</div>
                            <div style={{ ...S, fontSize: 15, fontWeight: 700, color: "#16a34a" }}>{s.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {expandedSegment === "미채굴" && (
                    <div>
                      <div style={{ ...S, fontSize: 13, fontWeight: 700, color: "#b0b8c8", marginBottom: 8 }}>미채굴 BTC</div>
                      <div style={{ ...S, fontSize: 13, color: "#b0b8c8", lineHeight: 1.8 }}>
                        아직 채굴되지 않은 BTC입니다. 약 4년마다 반감기를 거쳐 채굴 보상이 절반으로 줄어들며, 2140년경 21,000,000 BTC 공급이 완료될 예정입니다.
                      </div>
                      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                        {[
                          { label: "미채굴 잔량", value: `${unmined.toLocaleString()} BTC` },
                          { label: "전체 대비", value: `${((unmined / 21000000) * 100).toFixed(1)}%` },
                          { label: "완료 예정", value: "~2140년" },
                        ].map(s => (
                          <div key={s.label} style={{ flex: 1, minWidth: 120, padding: "10px 14px", background: "#0a0a0a", border: "1px solid #2a3441", borderRadius: 6 }}>
                            <div style={{ ...S, fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>{s.label}</div>
                            <div style={{ ...S, fontSize: 15, fontWeight: 700, color: "#b0b8c8" }}>{s.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════════ Section 3: Holders Tables ══════════ */}
          <SectionTitle>주요 보유자 현황</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12, marginBottom: 20 }}>
            {/* ETF */}
            <HolderTable
              title="ETF 보유 현황"
              loading={supplyLoading}
              rows={sp?.etfs ?? []}
              btcPrice={btcP}
              total={sp?.etfTotal ?? 0}
              showRank={false}
            />
            {/* Companies */}
            <HolderTable
              title="상장사 보유 현황"
              loading={supplyLoading}
              rows={sp?.companies ?? []}
              btcPrice={btcP}
              total={sp?.corporateTotal ?? 0}
              showRank
            />
            {/* Exchanges */}
            <HolderTable
              title="거래소 추정 보유"
              loading={supplyLoading}
              rows={sp?.exchanges ?? []}
              btcPrice={btcP}
              total={sp?.exchangeTotal ?? 0}
              showRank={false}
              note="* 공개 지갑 기반 추정치"
            />
          </div>

          {/* ══════════ Section: On-chain Data ══════════ */}
          <SectionTitle>온체인 데이터</SectionTitle>

          {/* Row 1: 4 metric cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 16 }}>
            {/* Difficulty */}
            <div style={{ background: "#111", border: "1px solid #2a3441", borderRadius: 8, padding: 16 }}>
              <div style={{ ...S, fontSize: 11, color: "#9ca3af", textTransform: "uppercase", marginBottom: 8 }}>채굴 난이도</div>
              {onchainLoading || !onchain ? <Skel h={60} /> : (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                    <span style={{ ...S, fontSize: 22, fontWeight: 700, color: "#f0f0f0" }}>
                      {(onchain.difficulty.currentDifficulty / 1e12).toFixed(1)}T
                    </span>
                    <span style={{
                      ...S, fontSize: 12, fontWeight: 600,
                      color: onchain.difficulty.difficultyChange >= 0 ? "#4ade80" : "#f87171",
                    }}>
                      {onchain.difficulty.difficultyChange >= 0 ? "+" : ""}{onchain.difficulty.difficultyChange.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ ...S, fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>
                    다음 조정까지 {onchain.difficulty.remainingBlocks.toLocaleString()}블록
                  </div>
                  <div style={{ width: "100%", height: 6, background: "#1f2937", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${onchain.difficulty.progressPercent}%`, height: "100%", background: "#f59e0b", borderRadius: 3 }} />
                  </div>
                </>
              )}
            </div>

            {/* Hashrate */}
            <div style={{ background: "#111", border: "1px solid #2a3441", borderRadius: 8, padding: 16 }}>
              <div style={{ ...S, fontSize: 11, color: "#9ca3af", textTransform: "uppercase", marginBottom: 8 }}>해시레이트</div>
              {onchainLoading || !onchain ? <Skel h={60} /> : (
                <>
                  <div style={{ ...S, fontSize: 22, fontWeight: 700, color: "#f0f0f0", marginBottom: 4 }}>
                    {(onchain.difficulty.currentHashrate / 1e18).toFixed(1)} EH/s
                  </div>
                  <div style={{ ...S, fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>네트워크 보안 지표</div>
                  {onchain.difficulty.hashrates.length > 1 && (
                    <ResponsiveContainer width="100%" height={50}>
                      <LineChart data={onchain.difficulty.hashrates.map(h => ({ v: h.avgHashrate / 1e18 }))}>
                        <Line type="monotone" dataKey="v" stroke="#f59e0b" strokeWidth={1.2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </>
              )}
            </div>

            {/* Fees */}
            <div style={{ background: "#111", border: "1px solid #2a3441", borderRadius: 8, padding: 16 }}>
              <div style={{ ...S, fontSize: 11, color: "#9ca3af", textTransform: "uppercase", marginBottom: 8 }}>트랜잭션 수수료</div>
              {onchainLoading || !onchain ? <Skel h={60} /> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    { label: "빠름", val: onchain.fees.fastestFee },
                    { label: "보통", val: onchain.fees.halfHourFee },
                    { label: "느림", val: onchain.fees.hourFee },
                  ].map(f => (
                    <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ ...S, fontSize: 12, color: "#b0b8c8" }}>{f.label}</span>
                      <span style={{
                        ...S, fontSize: 13, fontWeight: 600,
                        color: f.val > 20 ? "#f87171" : f.val > 10 ? "#f59e0b" : "#4ade80",
                      }}>
                        {f.val} sat/vB
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Market */}
            <div style={{ background: "#111", border: "1px solid #2a3441", borderRadius: 8, padding: 16 }}>
              <div style={{ ...S, fontSize: 11, color: "#9ca3af", textTransform: "uppercase", marginBottom: 8 }}>시장 지표</div>
              {onchainLoading || !onchain ? <Skel h={60} /> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ ...S, fontSize: 12, color: "#b0b8c8" }}>ATH</span>
                    <span style={{ ...S, fontSize: 13, fontWeight: 700, color: "#f0f0f0" }}>${onchain.market.ath.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ ...S, fontSize: 12, color: "#b0b8c8" }}>ATH 대비</span>
                    <span style={{ ...S, fontSize: 12, color: onchain.market.athChangePercent >= 0 ? "#4ade80" : "#f87171" }}>{onchain.market.athChangePercent.toFixed(1)}%</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ ...S, fontSize: 12, color: "#b0b8c8" }}>ATH 날짜</span>
                    <span style={{ ...S, fontSize: 12, color: "#9ca3af" }}>{onchain.market.athDate.slice(0, 10).replace(/-/g, ".")}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ ...S, fontSize: 12, color: "#b0b8c8" }}>유통량</span>
                    <span style={{ ...S, fontSize: 12, color: "#9ca3af" }}>{onchain.market.circulatingSupply.toLocaleString()} BTC</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: BTC 1Y price chart */}
          {!onchainLoading && onchain && onchain.market.priceHistory.length > 1 && (
            <div style={{ background: "#111", border: "1px solid #2a3441", borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ ...S, fontSize: 13, fontWeight: 700, color: "#f0f0f0", marginBottom: 12 }}>Bitcoin 1년 가격 추이</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={onchain.market.priceHistory} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date" tick={{ fill: "#666", fontSize: 10 }} tickLine={false}
                    axisLine={{ stroke: "#1f2937" }} interval={7} minTickGap={30}
                  />
                  <YAxis
                    tick={{ fill: "#666", fontSize: 10 }} tickLine={false} axisLine={false} width={50}
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
                  />
                  <Tooltip
                    contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 6, fontSize: 11, fontFamily: "'IBM Plex Mono', monospace" }}
                    labelStyle={{ color: "#9ca3af" }}
                    formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, "Price"]}
                    labelFormatter={(d) => String(d)}
                  />
                  <Line type="monotone" dataKey="price" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

        </main>
        )}
      </div>
    </>
  );
}

// ── SegmentDetail ────────────────────────────────────────────

function SegmentDetail({ title, color, description, rows, total, btcPrice, note }: {
  title: string; color: string; description: string;
  rows: { name: string; amount: number; usdValue: number; country?: string }[];
  total: number; btcPrice: number; note?: string;
}) {
  const hasCountry = rows.some(r => r.country !== undefined);
  return (
    <div>
      <div style={{ ...S, fontSize: 13, fontWeight: 700, color, marginBottom: 8 }}>{title}</div>
      <div style={{ ...S, fontSize: 13, color: "#b0b8c8", lineHeight: 1.8, marginBottom: 12 }}>{description}</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", ...S, fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #2a3441" }}>
              <th style={{ padding: "6px 8px", textAlign: "left", color: "#9ca3af", fontSize: 11, fontWeight: 600 }}>이름</th>
              {hasCountry && <th style={{ padding: "6px 8px", textAlign: "left", color: "#9ca3af", fontSize: 11 }}>국가</th>}
              <th style={{ padding: "6px 8px", textAlign: "right", color: "#9ca3af", fontSize: 11, fontWeight: 600 }}>보유량</th>
              <th style={{ padding: "6px 8px", textAlign: "right", color: "#9ca3af", fontSize: 11, fontWeight: 600 }}>USD 가치</th>
              <th style={{ padding: "6px 8px", textAlign: "right", color: "#9ca3af", fontSize: 11, fontWeight: 600 }}>비율</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #111" }}>
                <td style={{ padding: "7px 8px", color: "#f0f0f0" }}>{r.name}</td>
                {hasCountry && <td style={{ padding: "7px 8px", color: "#9ca3af", fontSize: 13 }}>{r.country || "-"}</td>}
                <td style={{ padding: "7px 8px", textAlign: "right", color, fontWeight: 600 }}>{r.amount.toLocaleString()}</td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: "#c8cdd6" }}>{fmtUsd(r.usdValue)}</td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: "#9ca3af", fontSize: 13 }}>{((r.amount / 21000000) * 100).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "1px solid #2a3441" }}>
              <td colSpan={hasCountry ? 2 : 1} style={{ padding: "7px 8px", color: "#b0b8c8", fontWeight: 700 }}>합계</td>
              <td style={{ padding: "7px 8px", textAlign: "right", color, fontWeight: 700 }}>{total.toLocaleString()}</td>
              <td style={{ padding: "7px 8px", textAlign: "right", color: "#c8cdd6", fontWeight: 700 }}>{fmtUsd(total * btcPrice)}</td>
              <td style={{ padding: "7px 8px", textAlign: "right", color: "#9ca3af", fontWeight: 700 }}>{((total / 21000000) * 100).toFixed(1)}%</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {note && <div style={{ ...S, fontSize: 12, color: "#9ca3af", marginTop: 8 }}>{note}</div>}
    </div>
  );
}

// ── HolderTable ──────────────────────────────────────────────

function HolderTable({ title, loading, rows, btcPrice, total, showRank, note }: {
  title: string;
  loading: boolean;
  rows: HoldingRow[];
  btcPrice: number;
  total: number;
  showRank: boolean;
  note?: string;
}) {
  return (
    <div style={{ background: "#111", border: "1px solid #2a3441", borderRadius: 8, padding: 16 }}>
      <div style={{ ...S, fontSize: 13, fontWeight: 700, color: "#f0f0f0", marginBottom: 10 }}>{title}</div>
      {loading ? (
        <div>{Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ marginBottom: 8 }}><Skel h={14} /></div>)}</div>
      ) : (
        <>
          {/* Header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: showRank ? "28px 1fr 90px 90px" : "1fr 90px 90px",
            padding: "4px 0", borderBottom: "1px solid #2a3441",
          }}>
            {showRank && <div style={{ ...S, fontSize: 12, color: "#9ca3af" }}>#</div>}
            <div style={{ ...S, fontSize: 12, color: "#9ca3af", textTransform: "uppercase" }}>{showRank ? "기업명" : "이름"}</div>
            <div style={{ ...S, fontSize: 12, color: "#9ca3af", textTransform: "uppercase", textAlign: "right" }}>보유량</div>
            <div style={{ ...S, fontSize: 12, color: "#9ca3af", textTransform: "uppercase", textAlign: "right" }}>USD 가치</div>
          </div>
          {/* Rows */}
          {rows.map((r, i) => (
            <div key={r.name} style={{
              display: "grid",
              gridTemplateColumns: showRank ? "28px 1fr 90px 90px" : "1fr 90px 90px",
              padding: "8px 0", borderBottom: "1px solid #1a1a1a",
            }}>
              {showRank && <div style={{ ...S, fontSize: 13, color: "#9ca3af" }}>{i + 1}</div>}
              <div style={{ ...S, fontSize: 13, color: "#f0f0f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
              <div style={{ ...S, fontSize: 13, color: "#f59e0b", textAlign: "right" }}>{r.holdings.toLocaleString()}</div>
              <div style={{ ...S, fontSize: 13, color: "#c8cdd6", textAlign: "right" }}>{fmtUsd(r.usdValue || r.holdings * btcPrice)}</div>
            </div>
          ))}
          {/* Footer */}
          <div style={{
            display: "grid",
            gridTemplateColumns: showRank ? "28px 1fr 90px 90px" : "1fr 90px 90px",
            padding: "8px 0", borderTop: "1px solid #2a3441",
          }}>
            {showRank && <div />}
            <div style={{ ...S, fontSize: 13, fontWeight: 700, color: "#f0f0f0" }}>합계</div>
            <div style={{ ...S, fontSize: 13, fontWeight: 700, color: "#f59e0b", textAlign: "right" }}>{total.toLocaleString()}</div>
            <div style={{ ...S, fontSize: 13, fontWeight: 700, color: "#c8cdd6", textAlign: "right" }}>{fmtUsd(total * btcPrice)}</div>
          </div>
          {note && <div style={{ ...S, fontSize: 12, color: "#9ca3af", marginTop: 6 }}>{note}</div>}
        </>
      )}
    </div>
  );
}

// ── NewsTab ─────────────────────────────────────────────────

// ── Wells Crypto Telegram Feed ──────────────────────────────

interface TgMsg {
  id: number;
  channel: string;
  channelTitle: string;
  text: string;
  date: number;
  link: string;
  imageUrl?: string;
}

function tgTimeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

async function translateToKo(text: string): Promise<string> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ko&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const json = await res.json();
    return json[0].map((i: [string]) => i[0]).join("");
  } catch {
    return "번역 실패";
  }
}

function TgCard({ msg }: { msg: TgMsg }) {
  const [expanded, setExpanded] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [showKr, setShowKr] = useState(false);

  const lines = msg.text.split("\n");
  const isLong = lines.length > 6;
  const displayText = !expanded && isLong ? lines.slice(0, 6).join("\n") + "..." : msg.text;

  const handleTranslate = async () => {
    if (translated) { setShowKr(!showKr); return; }
    setTranslating(true);
    const result = await translateToKo(msg.text);
    setTranslated(result);
    setShowKr(true);
    setTranslating(false);
  };

  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid #1f2937" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ ...S, fontSize: 11, fontWeight: 700, color: "#f59e0b" }}>Wells Crypto</span>
        <span style={{ ...S, fontSize: 10, color: "#555" }}>{tgTimeAgo(msg.date)}</span>
      </div>

      <p style={{ ...S, fontSize: 13, color: "#e0e0e0", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
        {displayText}
      </p>

      {isLong && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{ ...S, fontSize: 11, color: "#f59e0b", background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 4 }}
        >
          더보기
        </button>
      )}

      {msg.imageUrl && (
        <img
          src={msg.imageUrl}
          alt=""
          loading="lazy"
          style={{ maxWidth: "100%", borderRadius: 6, marginTop: 8, border: "1px solid #1a1a1a" }}
        />
      )}

      {showKr && translated && (
        <p style={{
          ...S, fontSize: 13, color: "#ffffff", lineHeight: 1.7, margin: "8px 0 0",
          background: "#0d1117", padding: "8px 12px", borderRadius: 6,
          borderLeft: "3px solid #f59e0b", whiteSpace: "pre-wrap",
        }}>
          {translated}
        </p>
      )}

      <button
        onClick={handleTranslate}
        style={{
          marginTop: 8, ...S, fontSize: 11,
          color: translating ? "#9ca3af" : showKr ? "#6b7280" : "#f59e0b",
          background: "none", border: "none", cursor: "pointer", padding: 0,
        }}
      >
        {translating ? "번역 중..." : showKr ? "원문 보기" : "🇰🇷 번역"}
      </button>
    </div>
  );
}

function WellsCryptoFeed() {
  const [messages, setMessages] = useState<TgMsg[]>([]);
  const [oldestId, setOldestId] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/telegram/channel?channel=wells_crypto")
      .then(r => r.json())
      .then(json => {
        if (json.ok) {
          setMessages(json.messages || []);
          setOldestId(json.oldestId ?? null);
          setHasMore(json.hasMore ?? false);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadMore = async () => {
    if (!oldestId || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/telegram/channel?channel=wells_crypto&before=${oldestId}`);
      const json = await res.json();
      if (json.ok) {
        const older: TgMsg[] = json.messages || [];
        if (older.length === 0) {
          setHasMore(false);
        } else {
          setMessages(prev => {
            const ids = new Set(prev.map(m => m.id));
            return [...prev, ...older.filter(m => !ids.has(m.id))];
          });
          setOldestId(json.oldestId ?? null);
          setHasMore(json.hasMore ?? false);
        }
      }
    } catch { /* */ }
    finally { setLoadingMore(false); }
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px" }}>
      <h2 style={{ ...S, fontSize: 15, fontWeight: 700, color: "#f59e0b", marginBottom: 16 }}>
        크립토 뉴스
      </h2>

      {loading ? (
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ padding: "14px 16px", borderBottom: "1px solid #1f2937" }}>
              <div style={{ height: 10, width: 80, background: "#1a1a1a", borderRadius: 3, marginBottom: 8 }} />
              <div style={{ height: 14, width: "90%", background: "#1a1a1a", borderRadius: 3, marginBottom: 6 }} />
              <div style={{ height: 14, width: "70%", background: "#151515", borderRadius: 3 }} />
            </div>
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "40px 16px", textAlign: "center", ...S, fontSize: 12, color: "#6b7280" }}>
          메시지 없음
        </div>
      ) : (
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8 }}>
          {messages.map(msg => (
            <TgCard key={msg.id} msg={msg} />
          ))}

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              style={{
                width: "100%", padding: "12px", background: "none",
                border: "none", borderTop: "1px solid #1f2937",
                color: "#60a5fa", ...S, fontSize: 12, cursor: "pointer",
                opacity: loadingMore ? 0.5 : 1,
              }}
            >
              {loadingMore ? "불러오는 중..." : "이전 글 더 보기"}
            </button>
          )}

          {!hasMore && messages.length > 0 && (
            <div style={{ padding: "16px", textAlign: "center", ...S, fontSize: 11, color: "#4b5563", borderTop: "1px solid #1f2937" }}>
              모든 메시지를 불러왔습니다
            </div>
          )}
        </div>
      )}
    </div>
  );
}
