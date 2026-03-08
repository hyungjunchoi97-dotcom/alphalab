"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useLang } from "@/lib/LangContext";
import AppHeader from "@/components/AppHeader";
import RRGChart from "@/components/RRGChart";

const CARD =
  "rounded-[12px] border border-card-border bg-card-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3)]";
const TH =
  "pb-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted";
const TD = "py-1.5";

// ── Types ────────────────────────────────────────────────────

interface FomoItem {
  ticker: string;
  name: string;
  price: number;
  chgPct: number;
  tag: string;
  volumeRatio: number;
  volume: number;
  metrics: { chg1d: number; chg5d: number; chg20d: number; near52wHigh: boolean; volumeSpike: boolean; tradingValue: number };
}

interface AiResult {
  bullets: string[];
  risk: string;
  confidence: number;
}

type SignalFilter = "ALL" | "VOLUME SPIKE" | "BREAKOUT" | "MOMO";
type MarketFilter = "KR" | "US";

const SIGNAL_FILTERS: SignalFilter[] = ["ALL", "VOLUME SPIKE", "BREAKOUT", "MOMO"];

const SIGNAL_TOOLTIPS: Record<string, string> = {
  "VOLUME SPIKE": "평균 대비 3배 이상 거래량 급증. 기관/세력 개입 가능성",
  "BREAKOUT": "최근 20일 고점 돌파. 신규 상승 추세 시작 신호",
  "MOMO": "가격과 거래량 동반 상승. 추세 추종 매매 포착",
};

const SIGNAL_BORDER_COLOR: Record<string, string> = {
  "VOLUME SPIKE": "border-l-yellow-500",
  "BREAKOUT": "border-l-blue-500",
  "MOMO": "border-l-green-500",
};

const TAG_COLORS: Record<string, string> = {
  "52W HIGH": "bg-gain/20 text-gain",
  MOMO: "bg-accent/20 text-accent",
  "VOLUME SPIKE": "bg-yellow-500/20 text-yellow-400",
  PULLBACK: "bg-purple-500/20 text-purple-400",
  BREAKOUT: "bg-teal-500/20 text-teal-400",
  VALUE: "bg-blue-500/20 text-blue-400",
  "LOW PER": "bg-cyan-500/20 text-cyan-400",
  "HIGH DIV": "bg-green-500/20 text-green-400",
};

function ChgPct({ v }: { v: number }) {
  return (
    <span className={v >= 0 ? "text-gain" : "text-loss"}>
      {v >= 0 ? "+" : ""}
      {v.toFixed(2)}%
    </span>
  );
}

function formatVol(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(0) + "K";
  return v.toLocaleString();
}

// ── Tooltip icon ────────────────────────────────────────────

function TooltipIcon({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative ml-1 inline-flex cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-card-border text-[8px] text-muted">?</span>
      {show && (
        <span className="absolute bottom-full left-1/2 z-50 mb-1.5 w-48 -translate-x-1/2 rounded border border-card-border bg-card-bg px-2.5 py-1.5 text-[10px] leading-relaxed text-muted shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}

// ── Per-tab tables ──────────────────────────────────────────

function FomoTable({ items, selected, onSelect, lang }: { items: FomoItem[]; selected: string | null; onSelect: (item: FomoItem) => void; lang: "en" | "kr" }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-card-border">
          <th className={TH}>Ticker</th>
          <th className={TH}>Name</th>
          <th className={`${TH} text-right`}>Price</th>
          <th className={`${TH} text-right`}>Chg%</th>
          <th className={`${TH} text-right`}>{lang === "kr" ? "거래량비" : "Vol Ratio"}</th>
          <th className={TH}>Tag</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const borderClass = SIGNAL_BORDER_COLOR[item.tag] || "border-l-transparent";
          return (
            <tr
              key={item.ticker}
              onClick={() => onSelect(item)}
              className={`cursor-pointer border-b border-card-border/40 border-l-2 transition-colors ${borderClass} ${
                selected === item.ticker ? "bg-accent/10" : "hover:bg-card-border/20"
              }`}
            >
              <td className={`${TD} pl-2 text-accent`}>{item.ticker}</td>
              <td className={TD}>{item.name}</td>
              <td className={`${TD} text-right tabular-nums`}>{item.price.toLocaleString()}</td>
              <td className={`${TD} text-right tabular-nums`}><ChgPct v={item.chgPct} /></td>
              <td className={`${TD} text-right tabular-nums font-medium ${item.volumeRatio >= 2 ? "text-yellow-400" : "text-muted"}`}>
                {item.volumeRatio.toFixed(1)}x
              </td>
              <td className={TD}>
                <span className={`inline-block rounded px-1.5 py-px text-[9px] font-medium ${TAG_COLORS[item.tag] || "bg-muted/20 text-muted"}`}>
                  {item.tag}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Main page ────────────────────────────────────────────────

export default function IdeasPage() {
  const { t, lang } = useLang();
  const [tab, setTab] = useState<"fomo" | "rotation">("fomo");
  const [selected, setSelected] = useState<FomoItem | null>(null);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCount, setShowCount] = useState(20);

  // Market & signal filter
  const [market, setMarket] = useState<MarketFilter>("KR");
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("ALL");

  // Data
  const [fomoKr, setFomoKr] = useState<FomoItem[]>([]);
  const [fomoUs, setFomoUs] = useState<FomoItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [totalStocks, setTotalStocks] = useState(0);

  const fetchScreener = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      const res = await fetch("/api/ideas/screener");
      const json = await res.json();
      if (json.ok) {
        setFomoKr(json.fomoKr || json.fomo || []);
        setFomoUs(json.fomoUs || []);
        if (json.asOf) setAsOf(json.asOf);
        setTotalStocks(json.totalStocks || 0);
      } else {
        setDataError(json.error || "Failed to load screener data");
      }
    } catch (err) {
      setDataError(err instanceof Error ? err.message : "Network error");
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScreener();
  }, [fetchScreener]);

  // Reset show count when switching tabs
  useEffect(() => {
    setShowCount(20);
  }, [tab]);

  // Filtered items
  const fomoItems = market === "KR" ? fomoKr : fomoUs;

  const filteredFomo = useMemo(() => {
    let items = fomoItems;
    if (signalFilter !== "ALL") {
      items = items.filter((i) => i.tag === signalFilter);
    }
    return [...items].sort((a, b) => b.volumeRatio - a.volumeRatio);
  }, [fomoItems, signalFilter]);

  // Signal counts for badges
  const signalCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of SIGNAL_FILTERS) {
      if (f === "ALL") {
        counts[f] = fomoItems.length;
      } else {
        counts[f] = fomoItems.filter((i) => i.tag === f).length;
      }
    }
    return counts;
  }, [fomoItems]);

  // Dynamic section header
  const sectionHeader = useMemo(() => {
    const count = filteredFomo.length;
    if (lang === "kr") {
      switch (signalFilter) {
        case "VOLUME SPIKE": return `거래량 폭증 — ${count}개 종목`;
        case "BREAKOUT": return `돌파 매수 신호 — ${count}개 종목`;
        case "MOMO": return `모멘텀 상승 — ${count}개 종목`;
        default: return `FOMO 스크리너 — ${count}개 종목`;
      }
    }
    switch (signalFilter) {
      case "VOLUME SPIKE": return `Volume Spike — ${count} stocks`;
      case "BREAKOUT": return `Breakout Signal — ${count} stocks`;
      case "MOMO": return `Momentum Rising — ${count} stocks`;
      default: return `FOMO Screener — ${count} stocks`;
    }
  }, [signalFilter, filteredFomo.length, lang]);

  const handleSelect = (item: FomoItem) => {
    setSelected(item);
    setAiResult(null);
    setError(null);
  };

  const handleExplain = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    setAiResult(null);

    try {
      const res = await fetch("/api/ideas/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: selected.ticker,
          name: selected.name,
          price: selected.price,
          chgPct: selected.chgPct,
          metrics: selected.metrics,
          mode: tab,
        }),
      });

      const json = await res.json();
      if (json.ok && json.data) {
        setAiResult(json.data);
      } else {
        setError(json.raw || "Failed to parse AI response");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="ideas" />

      <main className="mx-auto max-w-[1400px] px-4 py-4 space-y-3">
        {/* Tab pills + sub-tabs */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-px rounded bg-card-border p-px w-fit">
            {(["fomo", "rotation"] as const).map((tv) => (
              <button
                key={tv}
                onClick={() => {
                  setTab(tv);
                  setSelected(null);
                  setAiResult(null);
                  setError(null);
                }}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  tab === tv
                    ? "bg-accent text-white"
                    : "bg-card-bg text-muted hover:text-foreground"
                }`}
              >
                {tv === "fomo" ? "FOMO" : (lang === "kr" ? "섹터 로테이션" : "Sector Rotation")}
              </button>
            ))}
          </div>

          {/* Last updated */}
          {asOf && (
            <span className="ml-auto text-[9px] text-muted/60 tabular-nums">
              {lang === "kr" ? "마지막 업데이트" : "Updated"}: {new Date(asOf).toLocaleString(lang === "kr" ? "ko-KR" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              {totalStocks > 0 && <span className="ml-1">({totalStocks} stocks)</span>}
            </span>
          )}
        </div>

        {/* Rotation tab */}
        {tab === "rotation" && <RRGChart />}

        {/* Two-column layout (FOMO only) */}
        {tab === "fomo" && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            {/* Left: Ideas list */}
            <section className={`${CARD} lg:col-span-3`}>
              {/* KR / US toggle */}
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <div className="flex gap-px rounded bg-card-border p-px w-fit">
                  {(["KR", "US"] as MarketFilter[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setMarket(m);
                        setSelected(null);
                        setAiResult(null);
                        setSignalFilter("ALL");
                      }}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        market === m
                          ? "bg-accent text-white"
                          : "bg-card-bg text-muted hover:text-foreground"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Signal filter tabs */}
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                {SIGNAL_FILTERS.map((sf) => (
                  <button
                    key={sf}
                    onClick={() => {
                      setSignalFilter(sf);
                      setSelected(null);
                      setAiResult(null);
                    }}
                    className={`flex items-center gap-1 rounded px-2.5 py-1 text-[10px] font-medium transition-colors ${
                      signalFilter === sf
                        ? "bg-accent text-white"
                        : "bg-card-border/50 text-muted hover:text-foreground"
                    }`}
                  >
                    {sf}
                    <span className={`rounded px-1 py-px text-[8px] tabular-nums ${
                      signalFilter === sf ? "bg-white/20" : "bg-card-border"
                    }`}>
                      {signalCounts[sf] || 0}
                    </span>
                    {sf !== "ALL" && SIGNAL_TOOLTIPS[sf] && (
                      <TooltipIcon text={SIGNAL_TOOLTIPS[sf]} />
                    )}
                  </button>
                ))}
              </div>

              {/* Section header */}
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {sectionHeader}
                </h2>
              </div>

              {dataLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  <span className="ml-2 text-xs text-muted">
                    {lang === "kr" ? "데이터 로딩 중..." : "Loading screener data..."}
                  </span>
                </div>
              ) : dataError ? (
                <div className="py-8 text-center">
                  <p className="text-[10px] text-loss">{dataError}</p>
                  <button
                    onClick={fetchScreener}
                    className="mt-2 rounded bg-accent/20 px-3 py-1 text-[10px] text-accent hover:bg-accent/30"
                  >
                    {lang === "kr" ? "다시 시도" : "Retry"}
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {filteredFomo.length === 0 ? (
                    <p className="py-8 text-center text-[10px] text-muted">{lang === "kr" ? "해당 종목 없음" : "No stocks match"}</p>
                  ) : (
                    <FomoTable items={filteredFomo} selected={selected?.ticker ?? null} onSelect={handleSelect} lang={lang} />
                  )}
                </div>
              )}
            </section>

            {/* Right: Detail panel */}
            <section className={`${CARD} lg:col-span-2`}>
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Detail
                </h2>
              </div>

              {!selected ? (
                <p className="py-8 text-center text-[10px] text-muted">
                  {lang === "kr" ? "목록에서 종목을 선택하세요" : "Select a ticker from the list"}
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Ticker header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-accent">{selected.ticker}</span>
                      <span className="ml-2 text-xs text-muted">{selected.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums">{selected.price.toLocaleString()}</p>
                      <p className="text-[10px] tabular-nums"><ChgPct v={selected.chgPct} /></p>
                    </div>
                  </div>

                  {/* FOMO detail: Goldman Sachs style */}
                  {tab === "fomo" && "volumeRatio" in selected && (() => {
                    const fomo = selected as FomoItem;
                    const volRatio = fomo.volumeRatio;
                    const barPct = Math.min(volRatio / 10 * 100, 100);
                    const avgVol = volRatio > 0 ? fomo.volume / volRatio : 0;
                    const signalTag = fomo.tag;
                    const signalExplanations: Record<string, { kr: string; en: string }> = {
                      "VOLUME SPIKE": { kr: `평균 대비 ${volRatio.toFixed(0)}배 이상 거래량. 기관/세력 개입 가능성`, en: `Volume surged ${volRatio.toFixed(0)}x above average. Possible institutional activity` },
                      "BREAKOUT": { kr: "최근 20일 고점 돌파. 신규 상승 추세 시작 신호", en: "Broke above 20-day high. New uptrend initiation signal" },
                      "MOMO": { kr: "가격과 거래량 모두 상승. 추세 추종 매매 포착", en: "Price and volume both rising. Trend-following signal detected" },
                      "52W HIGH": { kr: "52주 최고가 경신. 강한 상승 추세 확인", en: "52-week high reached. Strong uptrend confirmed" },
                      "PULLBACK": { kr: "단기 조정 후 반등 시도. 저점 매수 기회 탐색", en: "Rebound attempt after pullback. Potential dip-buy opportunity" },
                    };
                    const explanation = signalExplanations[signalTag] || { kr: "복합 시그널 감지", en: "Composite signal detected" };
                    return (
                      <div className="space-y-0">
                        {/* WHY THIS IS A FOMO SIGNAL */}
                        <div className="border-b border-[#1e1e1e] py-3">
                          <p className="text-xs font-semibold uppercase tracking-widest text-[#555] mb-2.5">
                            WHY THIS IS A FOMO SIGNAL
                          </p>
                          <p className="text-sm text-[#aaa] leading-relaxed">
                            {lang === "kr"
                              ? volRatio >= 5
                                ? <>평소 대비 <span className="font-mono font-bold text-white">{volRatio.toFixed(1)}배</span> 거래량 폭증 — 기관/세력 대량 개입 가능성</>
                                : volRatio >= 3
                                ? <>20일 평균 대비 <span className="font-mono font-bold text-white">{volRatio.toFixed(1)}배</span> 거래량 급증 — 단기 강한 수급 유입</>
                                : volRatio >= 2
                                ? <>20일 평균 대비 <span className="font-mono font-bold text-white">{volRatio.toFixed(1)}배</span> 거래량 증가 — 평소보다 {volRatio.toFixed(1)}배 많은 거래 발생</>
                                : <>20일 평균 대비 <span className="font-mono font-bold text-white">{volRatio.toFixed(1)}배</span> 수준 — 거래량 소폭 증가</>
                              : volRatio >= 5
                                ? <>Volume surged <span className="font-mono font-bold text-white">{volRatio.toFixed(1)}x</span> above average — possible institutional activity</>
                                : volRatio >= 3
                                ? <>Volume spiked <span className="font-mono font-bold text-white">{volRatio.toFixed(1)}x</span> vs 20D avg — strong inflow detected</>
                                : volRatio >= 2
                                ? <>Volume rose <span className="font-mono font-bold text-white">{volRatio.toFixed(1)}x</span> vs 20D avg — trading {volRatio.toFixed(1)}x more than usual</>
                                : <>Volume at <span className="font-mono font-bold text-white">{volRatio.toFixed(1)}x</span> vs 20D avg — slight increase</>
                            }
                          </p>
                          <div className="relative h-2 w-full overflow-hidden rounded-sm bg-[#1e1e1e] mt-2.5">
                            <div
                              className={`absolute inset-y-0 left-0 rounded-sm ${volRatio >= 5 ? "bg-yellow-400" : volRatio >= 3 ? "bg-gain" : "bg-accent"}`}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                          <p className="mt-2 text-[10px] text-[#666]">
                            {lang === "kr"
                              ? <>오늘 <span className="font-mono text-white">{formatVol(fomo.volume)}</span>주 거래 / 20일 평균 <span className="font-mono text-[#888]">{formatVol(avgVol)}</span>주</>
                              : <>Today <span className="font-mono text-white">{formatVol(fomo.volume)}</span> / 20D avg <span className="font-mono text-[#888]">{formatVol(avgVol)}</span></>
                            }
                          </p>
                        </div>

                        {/* PRICE MOMENTUM */}
                        <div className="border-b border-[#1e1e1e] py-3">
                          <p className="text-xs font-semibold uppercase tracking-widest text-[#555] mb-2.5">
                            PRICE MOMENTUM
                          </p>
                          <div className="space-y-1.5">
                            {([["1D", selected.metrics.chg1d], ["5D", selected.metrics.chg5d], ["20D", selected.metrics.chg20d]] as const).map(([label, val]) => (
                              <div key={label} className="flex items-center justify-between">
                                <span className="w-8 text-[10px] font-mono text-[#666]">{label}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[10px] ${val >= 0 ? "text-gain" : "text-loss"}`}>
                                    {val >= 0 ? "\u25B2" : "\u25BC"}
                                  </span>
                                  <span className={`font-mono text-[11px] font-medium tabular-nums ${val >= 0 ? "text-gain" : "text-loss"}`}>
                                    {val >= 0 ? "+" : ""}{val.toFixed(2)}%
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* SIGNAL TYPE */}
                        <div className="py-3">
                          <p className="text-xs font-semibold uppercase tracking-widest text-[#555] mb-2.5">
                            SIGNAL TYPE
                          </p>
                          <div className="flex items-start gap-2.5">
                            <span className={`shrink-0 rounded px-2 py-0.5 text-[9px] font-bold ${TAG_COLORS[signalTag] || "bg-muted/20 text-muted"}`}>
                              {signalTag}
                            </span>
                            <p className="text-[10px] leading-relaxed text-[#888]">
                              {lang === "kr" ? explanation.kr : explanation.en}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  {/* Explain button */}
                  <button
                    onClick={handleExplain}
                    disabled={loading}
                    className="w-full rounded bg-accent px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {loading
                      ? (lang === "kr" ? "분석 중..." : "Analyzing...")
                      : (lang === "kr" ? "AI 분석" : "Explain move")}
                  </button>

                  {/* Error */}
                  {error && (
                    <div className="rounded border border-loss/30 bg-loss/10 px-3 py-2 text-[10px] text-loss">
                      {error}
                    </div>
                  )}

                  {/* AI Result */}
                  {aiResult && (
                    <div className="space-y-2">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">AI Summary</p>
                      <ul className="space-y-1">
                        {aiResult.bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs leading-relaxed">
                            <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-accent" />
                            {b}
                          </li>
                        ))}
                      </ul>
                      <div className="rounded border border-card-border/60 bg-background px-3 py-2">
                        <p className="text-[9px] uppercase tracking-wider text-muted">Risk</p>
                        <p className="mt-0.5 text-[10px] text-loss">{aiResult.risk}</p>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted">
                        <span>Confidence:</span>
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-card-border">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(aiResult.confidence * 100)}%` }} />
                        </div>
                        <span className="tabular-nums">{Math.round(aiResult.confidence * 100)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
