"use client";

import { useState, useEffect, useCallback } from "react";
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

interface ValueItem {
  ticker: string;
  name: string;
  price: number;
  chgPct: number;
  tag: string;
  per: number | null;
  pbr: number | null;
  roe: number | null;
  divYield: number | null;
  metrics: { chg1d: number; chg5d: number; chg20d: number; near52wHigh: boolean; volumeSpike: boolean; tradingValue: number };
}

type AnyItem = FomoItem | ValueItem;

interface AiResult {
  bullets: string[];
  risk: string;
  confidence: number;
}

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
        {items.map((item) => (
          <tr
            key={item.ticker}
            onClick={() => onSelect(item)}
            className={`cursor-pointer border-b border-card-border/40 transition-colors ${
              selected === item.ticker ? "bg-accent/10" : "hover:bg-card-border/20"
            }`}
          >
            <td className={`${TD} text-accent`}>{item.ticker}</td>
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
        ))}
      </tbody>
    </table>
  );
}

function ValueTable({ items, selected, onSelect, lang }: { items: ValueItem[]; selected: string | null; onSelect: (item: ValueItem) => void; lang: "en" | "kr" }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-card-border">
          <th className={TH}>Ticker</th>
          <th className={TH}>Name</th>
          <th className={`${TH} text-right`}>Price</th>
          <th className={`${TH} text-right`}>PER</th>
          <th className={`${TH} text-right`}>ROE</th>
          <th className={`${TH} text-right`}>{lang === "kr" ? "배당률" : "Div%"}</th>
          <th className={TH}>Tag</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr
            key={item.ticker}
            onClick={() => onSelect(item)}
            className={`cursor-pointer border-b border-card-border/40 transition-colors ${
              selected === item.ticker ? "bg-accent/10" : "hover:bg-card-border/20"
            }`}
          >
            <td className={`${TD} text-accent`}>{item.ticker}</td>
            <td className={TD}>{item.name}</td>
            <td className={`${TD} text-right tabular-nums`}>{item.price.toLocaleString()}</td>
            <td className={`${TD} text-right tabular-nums ${item.per && item.per < 10 ? "text-gain font-medium" : "text-muted"}`}>
              {item.per != null ? item.per.toFixed(1) : "—"}
            </td>
            <td className={`${TD} text-right tabular-nums ${item.roe && item.roe > 15 ? "text-gain" : "text-muted"}`}>
              {item.roe != null ? `${item.roe.toFixed(1)}%` : "—"}
            </td>
            <td className={`${TD} text-right tabular-nums ${item.divYield && item.divYield > 3 ? "text-gain" : "text-muted"}`}>
              {item.divYield != null ? `${item.divYield.toFixed(1)}%` : "—"}
            </td>
            <td className={TD}>
              <span className={`inline-block rounded px-1.5 py-px text-[9px] font-medium ${TAG_COLORS[item.tag] || "bg-muted/20 text-muted"}`}>
                {item.tag}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Main page ────────────────────────────────────────────────

export default function IdeasPage() {
  const { t, lang } = useLang();
  const [tab, setTab] = useState<"rotation" | "fomo" | "value">("rotation");
  const [selected, setSelected] = useState<AnyItem | null>(null);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCount, setShowCount] = useState(20);

  // Data
  const [fomoIdeas, setFomoIdeas] = useState<FomoItem[]>([]);
  const [valueIdeas, setValueIdeas] = useState<ValueItem[]>([]);
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
        setFomoIdeas(json.fomo || []);
        setValueIdeas(json.value || []);
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

  const handleSelect = (item: AnyItem) => {
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
            {(["rotation", "fomo", "value"] as const).map((tv) => (
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
                {tv === "rotation" ? (lang === "kr" ? "섹터 로테이션" : "Sector Rotation") : tv === "fomo" ? "FOMO" : "VALUE"}
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

        {/* Two-column layout */}
        {tab !== "rotation" && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            {/* Left: Ideas list */}
            <section className={`${CARD} lg:col-span-3`}>
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {tab === "fomo"
                    ? (lang === "kr" ? "FOMO 스크리너 — 거래량 급증" : "FOMO Screener — Volume Surge")
                    : (lang === "kr" ? "VALUE 스크리너 — 저PER·고배당" : "VALUE Screener — Low PER / High Div")}
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
                  {tab === "fomo" && (
                    <>
                      {fomoIdeas.length === 0 ? (
                        <p className="py-8 text-center text-[10px] text-muted">{lang === "kr" ? "해당 종목 없음" : "No stocks match"}</p>
                      ) : (
                        <FomoTable items={fomoIdeas} selected={selected?.ticker ?? null} onSelect={handleSelect} lang={lang} />
                      )}
                    </>
                  )}
                  {tab === "value" && (
                    <>
                      {valueIdeas.length === 0 ? (
                        <p className="py-8 text-center text-[10px] text-muted">{lang === "kr" ? "해당 종목 없음" : "No stocks match"}</p>
                      ) : (
                        <ValueTable items={valueIdeas} selected={selected?.ticker ?? null} onSelect={handleSelect} lang={lang} />
                      )}
                    </>
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

                  {/* Metrics row (value tab only - fomo has PRICE MOMENTUM section) */}
                  {tab === "value" && (
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          ["1D", selected.metrics.chg1d],
                          ["5D", selected.metrics.chg5d],
                          ["20D", selected.metrics.chg20d],
                        ] as const
                      ).map(([label, val]) => (
                        <div key={label} className="rounded border border-card-border/60 bg-background px-2.5 py-1.5">
                          <p className="text-[9px] uppercase tracking-wider text-muted">{label}</p>
                          <p className="mt-0.5 text-xs font-medium tabular-nums"><ChgPct v={val} /></p>
                        </div>
                      ))}
                    </div>
                  )}

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
                          <div className="flex items-center justify-between text-[11px] mb-1.5">
                            <span className="text-[#888]">{lang === "kr" ? "거래량 급증" : "Volume Surge"}</span>
                            <span className="font-mono font-bold text-white">{volRatio.toFixed(1)}x {lang === "kr" ? "평균 대비" : "vs avg"}</span>
                          </div>
                          <div className="relative h-2 w-full overflow-hidden rounded-sm bg-[#1e1e1e]">
                            <div
                              className={`absolute inset-y-0 left-0 rounded-sm ${volRatio >= 5 ? "bg-yellow-400" : volRatio >= 3 ? "bg-gain" : "bg-accent"}`}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                          <div className="mt-2.5 space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-[#666]">{lang === "kr" ? "오늘 거래량" : "Today Volume"}</span>
                              <span className="font-mono text-white">{formatVol(fomo.volume)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-[#666]">{lang === "kr" ? "평균 거래량 (20D)" : "Avg Volume (20D)"}</span>
                              <span className="font-mono text-[#888]">{formatVol(avgVol)}</span>
                            </div>
                          </div>
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
                  {tab === "value" && "per" in selected && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded border border-card-border/60 bg-background px-2.5 py-1.5">
                        <p className="text-[9px] uppercase tracking-wider text-muted">PER</p>
                        <p className={`mt-0.5 text-xs font-medium tabular-nums ${(selected as ValueItem).per && (selected as ValueItem).per! < 10 ? "text-gain" : ""}`}>
                          {(selected as ValueItem).per != null ? (selected as ValueItem).per!.toFixed(1) : "—"}
                        </p>
                      </div>
                      <div className="rounded border border-card-border/60 bg-background px-2.5 py-1.5">
                        <p className="text-[9px] uppercase tracking-wider text-muted">ROE</p>
                        <p className="mt-0.5 text-xs font-medium tabular-nums">
                          {(selected as ValueItem).roe != null ? `${(selected as ValueItem).roe!.toFixed(1)}%` : "—"}
                        </p>
                      </div>
                      <div className="rounded border border-card-border/60 bg-background px-2.5 py-1.5">
                        <p className="text-[9px] uppercase tracking-wider text-muted">PBR</p>
                        <p className="mt-0.5 text-xs font-medium tabular-nums">
                          {(selected as ValueItem).pbr != null ? (selected as ValueItem).pbr!.toFixed(2) : "—"}
                        </p>
                      </div>
                      <div className="rounded border border-card-border/60 bg-background px-2.5 py-1.5">
                        <p className="text-[9px] uppercase tracking-wider text-muted">{lang === "kr" ? "배당수익률" : "Div Yield"}</p>
                        <p className={`mt-0.5 text-xs font-medium tabular-nums ${(selected as ValueItem).divYield && (selected as ValueItem).divYield! > 3 ? "text-gain" : ""}`}>
                          {(selected as ValueItem).divYield != null ? `${(selected as ValueItem).divYield!.toFixed(1)}%` : "—"}
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Tag + badges (value tab only - fomo has integrated badges) */}
                  {tab === "value" && (
                    <div className="flex flex-wrap gap-2 text-[10px]">
                      <span className={`rounded px-1.5 py-px font-medium ${TAG_COLORS[selected.tag] || "bg-muted/20 text-muted"}`}>
                        {selected.tag}
                      </span>
                      {selected.metrics.near52wHigh && (
                        <span className="rounded bg-gain/20 px-1.5 py-px font-medium text-gain">Near 52W High</span>
                      )}
                      {selected.metrics.volumeSpike && (
                        <span className="rounded bg-yellow-500/20 px-1.5 py-px font-medium text-yellow-400">Vol Spike</span>
                      )}
                    </div>
                  )}

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
