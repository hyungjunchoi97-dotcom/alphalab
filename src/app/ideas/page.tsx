"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useLang } from "@/lib/LangContext";
import { messages } from "@/lib/i18n";
import AppHeader from "@/components/AppHeader";
import AiAnalysisPanel from "@/components/AiAnalysisPanel";

const RRGChart = dynamic(() => import("@/components/RRGChart"), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-[#1a1a1a] h-[500px] rounded" />,
});

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
  "HIGH DIV": "bg-amber-500/20 text-amber-400",
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

// ── Legend Screener types ────────────────────────────────────
interface ScreenerItem {
  symbol: string;
  name: string;
  price: number;
  change_pct: number;
  per: number | null;
  epsYoY: number | null;
  epsQoQ: number | null;
  revYoY: number | null;
  distFromHigh: number | null;
}

interface ScreenerFilters {
  per?: number;
  epsYoY?: number;
  epsQoQ?: number;
  revYoY?: number;
  nearHigh?: number;
}

type FilterKey = keyof ScreenerFilters;

const FILTER_CARDS: { key: FilterKey; label: string; labelKr: string; options: { label: string; value: number }[] }[] = [
  { key: "per", label: "PER", labelKr: "PER", options: [{ label: "< 10", value: 10 }, { label: "< 20", value: 20 }, { label: "< 30", value: 30 }] },
  { key: "epsYoY", label: "EPS YoY", labelKr: "EPS YoY", options: [{ label: "10%+", value: 10 }, { label: "25%+", value: 25 }, { label: "50%+", value: 50 }] },
  { key: "epsQoQ", label: "EPS QoQ", labelKr: "EPS QoQ", options: [{ label: "10%+", value: 10 }, { label: "25%+", value: 25 }, { label: "50%+", value: 50 }] },
  { key: "revYoY", label: "Rev YoY", labelKr: "매출 YoY", options: [{ label: "10%+", value: 10 }, { label: "25%+", value: 25 }, { label: "50%+", value: 50 }] },
  { key: "nearHigh", label: "52W High", labelKr: "52주 신고가", options: [{ label: "20%", value: 20 }, { label: "10%", value: 10 }, { label: "5%", value: 5 }] },
];

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

// ── Financials Tab ───────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FinData = any;

interface FinRow {
  label: string;
  key: string;
  isHeader?: boolean;
  isYoY?: boolean;
  indent?: boolean;
  ratio?: boolean;
}

const IS_ROWS_US: FinRow[] = [
  { label: "finRevenue", key: "revenue", isHeader: true },
  { label: "finGrowthYoY", key: "revenue_yoy", isYoY: true, indent: true },
  { label: "finGrossProfit", key: "grossProfit", indent: true },
  { label: "finOperatingIncome", key: "operatingIncome", isHeader: true },
  { label: "finGrowthYoY", key: "operatingIncome_yoy", isYoY: true, indent: true },
  { label: "finEBITDA", key: "ebitda", indent: true },
  { label: "finNetIncome", key: "netIncome", isHeader: true },
  { label: "finGrowthYoY", key: "netIncome_yoy", isYoY: true, indent: true },
  { label: "finEPS", key: "eps", indent: true },
];

const BS_ROWS_US: FinRow[] = [
  { label: "finTotalAssets", key: "totalAssets", isHeader: true },
  { label: "finTotalDebt", key: "totalDebt", indent: true },
  { label: "finCash", key: "cashAndCashEquivalents", indent: true },
  { label: "finTotalEquity", key: "totalStockholdersEquity", isHeader: true },
  { label: "finDebtEquity", key: "debtEquity", indent: true, ratio: true },
];

const CF_ROWS_US: FinRow[] = [
  { label: "finOperatingCF", key: "operatingCashFlow", isHeader: true },
  { label: "finInvestingCF", key: "netCashUsedForInvestingActivites", indent: true },
  { label: "finFinancingCF", key: "netCashUsedProvidedByFinancingActivities", indent: true },
  { label: "finFCF", key: "freeCashFlow", isHeader: true },
];

const IS_ROWS_KR: FinRow[] = [
  { label: "finRevenue", key: "매출액", isHeader: true },
  { label: "finGrowthYoY", key: "매출액_yoy", isYoY: true, indent: true },
  { label: "finGrossProfit", key: "매출총이익", indent: true },
  { label: "finOperatingIncome", key: "영업이익", isHeader: true },
  { label: "finGrowthYoY", key: "영업이익_yoy", isYoY: true, indent: true },
  { label: "finNetIncome", key: "당기순이익", isHeader: true },
  { label: "finGrowthYoY", key: "당기순이익_yoy", isYoY: true, indent: true },
];

const BS_ROWS_KR: FinRow[] = [
  { label: "finTotalAssets", key: "자산총계", isHeader: true },
  { label: "finTotalDebt", key: "부채총계", indent: true },
  { label: "finCash", key: "현금및현금성자산", indent: true },
  { label: "finTotalEquity", key: "자본총계", isHeader: true },
  { label: "finDebtEquity", key: "debtEquity", indent: true, ratio: true },
];

const CF_ROWS_KR: FinRow[] = [
  { label: "finOperatingCF", key: "영업활동으로인한현금흐름", isHeader: true },
  { label: "finInvestingCF", key: "투자활동으로인한현금흐름", indent: true },
  { label: "finFinancingCF", key: "재무활동으로인한현금흐름", indent: true },
];

function fmtFinNum(v: number | null | undefined, isRatio?: boolean): string {
  if (v == null || isNaN(v)) return "—";
  if (isRatio) return v.toFixed(2);
  const abs = Math.abs(v);
  const formatted = abs >= 1e9
    ? (abs / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 })
    : abs >= 1e6
    ? (abs / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 })
    : abs.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return v < 0 ? `(${formatted})` : formatted;
}

function fmtKrNum(v: number | null | undefined, isRatio?: boolean): string {
  if (v == null || isNaN(v)) return "—";
  if (isRatio) return v.toFixed(2);
  // DART returns raw KRW — convert to 억원
  const inEok = v / 1e8;
  const abs = Math.abs(inEok);
  const formatted = abs.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return v < 0 ? `(${formatted})` : formatted;
}

function fmtYoY(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function computeYoY(data: FinData[], key: string): (number | null)[] {
  return data.map((d, i) => {
    if (i >= data.length - 1) return null;
    const cur = d[key];
    const prev = data[i + 1]?.[key];
    if (cur == null || prev == null || prev === 0) return null;
    return ((cur - prev) / Math.abs(prev)) * 100;
  });
}

function compute5YAvg(data: FinData[], key: string): number | null {
  const yoy = computeYoY(data, key).filter((v): v is number => v != null);
  if (yoy.length === 0) return null;
  return yoy.reduce((a, b) => a + b, 0) / yoy.length;
}

interface TickerResult {
  ticker: string;
  name: string;
  nameEn: string;
  market: "KR" | "US";
  exchange: string;
}

function FinancialsTab({ lang }: { lang: string }) {
  const t = messages[lang as "en" | "kr"] || messages.en;
  const [query, setQuery] = useState("");
  const [selectedTicker, setSelectedTicker] = useState("");
  const [market, setMarket] = useState<"US" | "KR">("US");
  const [period, setPeriod] = useState<"annual" | "quarterly">("annual");
  const [sheet, setSheet] = useState<"IS" | "BS" | "CF">("IS");
  const [finData, setFinData] = useState<FinData | null>(null);
  const [finLoading, setFinLoading] = useState(false);
  const [finError, setFinError] = useState("");

  // Search dropdown state
  const [searchResults, setSearchResults] = useState<TickerResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced search
  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      setShowDropdown(true);
      try {
        const res = await fetch(`/api/search-ticker?q=${encodeURIComponent(val.trim())}&limit=8`);
        const json = await res.json();
        setSearchResults(json.ok ? json.results || [] : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const fetchFinancials = useCallback(async (tk: string, mk: string) => {
    if (!tk.trim()) return;
    setFinLoading(true);
    setFinError("");
    setFinData(null);
    try {
      const res = await fetch(`/api/financials?ticker=${encodeURIComponent(tk.trim())}&market=${mk}`);
      const json = await res.json();
      if (json.ok) setFinData(json.data);
      else setFinError(json.error || "Error");
    } catch {
      setFinError("Network error");
    } finally {
      setFinLoading(false);
    }
  }, []);

  const selectResult = (r: TickerResult) => {
    setQuery(`${r.ticker} — ${r.name}`);
    setSelectedTicker(r.ticker);
    setMarket(r.market);
    setShowDropdown(false);
    setSearchResults([]);
    fetchFinancials(r.ticker, r.market);
  };

  // Get data for current view
  const currentData: FinData[] = finData
    ? (period === "annual" ? finData.annual : finData.quarterly)?.[
        sheet === "IS" ? "incomeStatement" : sheet === "BS" ? "balanceSheet" : "cashFlow"
      ] || []
    : [];

  const isKR = market === "KR";
  const rows = sheet === "IS"
    ? (isKR ? IS_ROWS_KR : IS_ROWS_US)
    : sheet === "BS"
    ? (isKR ? BS_ROWS_KR : BS_ROWS_US)
    : (isKR ? CF_ROWS_KR : CF_ROWS_US);

  const fmt = isKR ? fmtKrNum : fmtFinNum;

  // Column headers
  const columns: string[] = currentData.map((d: FinData) => {
    if (d.period) return d.period;
    if (d.calendarYear) return `${d.calendarYear}`;
    if (d.year) return `${d.year}`;
    if (d.date) return d.date.substring(0, 4);
    return "—";
  });

  // Precompute YoY values
  const yoyCache: Record<string, (number | null)[]> = {};
  for (const row of rows) {
    if (row.isYoY) {
      const baseKey = row.key.replace("_yoy", "");
      yoyCache[row.key] = computeYoY(currentData, baseKey);
    }
  }

  // 5Y Avg growth for annual
  const show5YAvg = period === "annual" && currentData.length >= 2;

  return (
    <div className="space-y-3">
      {/* Search bar with autocomplete */}
      <div ref={dropdownRef} className="relative w-full max-w-lg">
        <input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
          placeholder={lang === "kr" ? "종목명 또는 티커 검색..." : "Search ticker or company name..."}
          className="w-full rounded border px-3 py-2 text-sm font-mono outline-none transition-colors focus:border-amber-400/50"
          style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)", color: "#e8e8e8" }}
        />
        {showDropdown && (
          <div
            className="absolute z-50 mt-1 w-full overflow-hidden rounded"
            style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            {searchLoading ? (
              <div className="px-3 py-3 text-[11px] animate-pulse" style={{ color: "#6b7280" }}>
                {lang === "kr" ? "검색중..." : "Searching..."}
              </div>
            ) : searchResults.length === 0 ? (
              <div className="px-3 py-3 text-[11px]" style={{ color: "#4b5563" }}>
                {lang === "kr" ? "결과 없음" : "No results found"}
              </div>
            ) : (
              searchResults.map((r) => (
                <button
                  key={`${r.market}-${r.ticker}`}
                  onClick={() => selectResult(r)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-white/5"
                >
                  <div>
                    <span className="text-sm" style={{ color: "#e8e8e8" }}>{r.name}</span>
                    <span className="ml-2 text-[10px]" style={{ color: "#6b7280" }}>{r.exchange}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px]" style={{ color: "#fbbf24" }}>{r.ticker}</span>
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                      style={{
                        background: r.market === "KR" ? "rgba(96,165,250,0.12)" : "rgba(251,191,36,0.12)",
                        color: r.market === "KR" ? "#60a5fa" : "#fbbf24",
                      }}
                    >
                      {r.market}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Loading */}
      {finLoading && (
        <div className="py-12 text-center text-[11px] animate-pulse" style={{ color: "#555" }}>
          {t.finLoading}
        </div>
      )}

      {/* Error */}
      {finError && (
        <div className="py-8 text-center text-[11px]" style={{ color: "#f87171" }}>{finError}</div>
      )}

      {/* Table */}
      {finData && !finLoading && (
        <>
          {/* Controls: Period + Sheet toggles */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-px rounded bg-card-border p-px">
              {(["annual", "quarterly"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 text-[11px] font-mono font-medium tracking-widest transition-colors ${
                    period === p ? "bg-white/10 text-white" : "bg-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {p === "annual" ? t.finAnnual : t.finQuarterly}
                </button>
              ))}
            </div>
            <div className="flex gap-px rounded bg-card-border p-px">
              {(["IS", "BS", "CF"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSheet(s)}
                  className={`px-3 py-1 text-[11px] font-mono font-medium tracking-widest transition-colors ${
                    sheet === s ? "bg-white/10 text-white" : "bg-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {s === "IS" ? t.finIS : s === "BS" ? t.finBS : t.finCF}
                </button>
              ))}
            </div>
            <span className="ml-auto text-[9px] font-mono" style={{ color: "#555" }}>
              {t.finUnit}
            </span>
          </div>

          {currentData.length === 0 ? (
            <div className="py-8 text-center text-[11px]" style={{ color: "#555" }}>{t.finNoData}</div>
          ) : (
            <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid #222" }}>
              <table className="w-full font-mono text-[11px]" style={{ background: "#080c12" }}>
                <thead>
                  <tr style={{ background: "#0d1117", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
                    <th
                      className="sticky left-0 z-10 py-2 pl-3 pr-4 text-left text-[10px] font-medium uppercase tracking-wider"
                      style={{ background: "#0d1117", color: "#6b7280", width: "208px", minWidth: "208px" }}
                    >
                      &nbsp;
                    </th>
                    {columns.map((col, i) => (
                      <th
                        key={i}
                        className="py-2 px-3 text-right text-[10px] font-medium uppercase tracking-wider"
                        style={{ color: "#6b7280", minWidth: "90px" }}
                      >
                        {col}
                      </th>
                    ))}
                    {show5YAvg && (
                      <th
                        className="py-2 px-3 text-right text-[10px] font-medium uppercase tracking-wider"
                        style={{ color: "#6b7280", minWidth: "90px" }}
                      >
                        {t.fin5YAvg}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isYoY = row.isYoY;
                    const label = t[row.label as keyof typeof t] || row.label;

                    return (
                      <tr
                        key={row.key}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          background: row.isHeader ? "rgba(255,255,255,0.03)" : "transparent",
                        }}
                      >
                        {/* Label cell */}
                        <td
                          className="sticky left-0 z-10 py-1.5 pl-3 pr-4 text-left whitespace-nowrap"
                          style={{
                            background: "#080c12",
                            color: isYoY ? "#4b5563" : row.isHeader ? "#e8e8e8" : "#9ca3af",
                            fontWeight: row.isHeader ? 500 : 400,
                            paddingLeft: row.indent || isYoY ? "28px" : "12px",
                            fontSize: isYoY ? "10px" : "11px",
                          }}
                        >
                          {label}
                        </td>

                        {/* Data cells */}
                        {currentData.map((d: FinData, ci: number) => {
                          if (isYoY) {
                            const yoyVal = yoyCache[row.key]?.[ci];
                            return (
                              <td
                                key={ci}
                                className="py-1.5 px-3 text-right tabular-nums"
                                style={{
                                  fontSize: "10px",
                                  color: yoyVal == null ? "#4b5563" : yoyVal >= 0 ? "#4ade80" : "#ef4444",
                                }}
                              >
                                {fmtYoY(yoyVal)}
                              </td>
                            );
                          }

                          // For ratio rows, compute from data
                          if (row.ratio && row.key === "debtEquity") {
                            const debt = isKR ? d["부채총계"] : d.totalDebt;
                            const equity = isKR ? d["자본총계"] : d.totalStockholdersEquity;
                            const ratio = debt && equity && equity !== 0 ? debt / equity : null;
                            return (
                              <td
                                key={ci}
                                className="py-1.5 px-3 text-right tabular-nums"
                                style={{ color: ratio != null && ratio > 2 ? "#f87171" : "#9ca3af" }}
                              >
                                {ratio != null ? ratio.toFixed(2) : "—"}
                              </td>
                            );
                          }

                          const val = d[row.key];
                          const numVal = typeof val === "number" ? val : typeof val === "string" ? parseFloat(val.replace(/,/g, "")) : null;

                          return (
                            <td
                              key={ci}
                              className="py-1.5 px-3 text-right tabular-nums"
                              style={{
                                color: numVal != null && numVal < 0 ? "#f87171" : row.isHeader ? "#e8e8e8" : "#9ca3af",
                              }}
                            >
                              {fmt(numVal, row.ratio)}
                            </td>
                          );
                        })}

                        {/* 5Y Avg column */}
                        {show5YAvg && (
                          <td
                            className="py-1.5 px-3 text-right tabular-nums"
                            style={{ fontSize: isYoY ? "10px" : "11px" }}
                          >
                            {isYoY ? (() => {
                              const baseKey = row.key.replace("_yoy", "");
                              const avg = compute5YAvg(currentData, baseKey);
                              return (
                                <span style={{ color: avg == null ? "#4b5563" : avg >= 0 ? "#4ade80" : "#ef4444" }}>
                                  {fmtYoY(avg)}
                                </span>
                              );
                            })() : <span style={{ color: "#4b5563" }}>—</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* AI Analysis Panel */}
          <div className="mt-4 rounded-lg p-4" style={{ background: "#0d1117", border: "1px solid #222" }}>
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#6b7280" }}>
              AI ANALYSIS
            </h3>
            <AiAnalysisPanel
              ticker={finData.ticker}
              market={finData.market}
              financialData={finData}
              lang={lang}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────

export default function IdeasPage() {
  const { t, lang } = useLang();
  const [tab, setTab] = useState<"fomo" | "legend" | "rotation" | "financials">("fomo");
  const [selected, setSelected] = useState<FomoItem | null>(null);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Financials for detail panel
  const [detailFin, setDetailFin] = useState<{
    market: string;
    ticker: string;
    marketCap: number | null;
    price: number | null;
    quarterly: { label: string; revenue: number | null; operatingIncome: number | null; netIncome: number | null }[];
  } | null>(null);
  const [detailFinLoading, setDetailFinLoading] = useState(false);
  const [detailFinError, setDetailFinError] = useState(false);
  const [showCount, setShowCount] = useState(20);

  // Signal filter
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("ALL");

  // Legend screener state (filter-based)
  const [scrFilters, setScrFilters] = useState<ScreenerFilters>({});
  const [scrResults, setScrResults] = useState<ScreenerItem[]>([]);
  const [scrLoading, setScrLoading] = useState(false);
  const [scrError, setScrError] = useState<string | null>(null);
  const [scrUpdatedAt, setScrUpdatedAt] = useState<string | null>(null);
  const [scrCached, setScrCached] = useState(false);
  const [legendSelected, setLegendSelected] = useState<string | null>(null);

  // Data
  const [fomoKr, setFomoKr] = useState<FomoItem[]>([]);
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

  const fetchScreenerFiltered = useCallback(async (filters: ScreenerFilters, refresh = false) => {
    // Need at least one filter
    if (Object.keys(filters).length === 0) return;
    setScrLoading(true);
    setScrError(null);
    try {
      const params = new URLSearchParams();
      if (filters.per != null) params.set("per", String(filters.per));
      if (filters.epsYoY != null) params.set("epsYoY", String(filters.epsYoY));
      if (filters.epsQoQ != null) params.set("epsQoQ", String(filters.epsQoQ));
      if (filters.revYoY != null) params.set("revYoY", String(filters.revYoY));
      if (filters.nearHigh != null) params.set("nearHigh", String(filters.nearHigh));
      if (refresh) params.set("refresh", "true");
      const res = await fetch(`/api/legend-screener?${params.toString()}`);
      const json = await res.json();
      if (json.ok) {
        setScrResults(json.results || []);
        setScrUpdatedAt(json.updated_at);
        setScrCached(json.cached ?? false);
      } else {
        setScrError(json.error || "Failed to fetch screener");
      }
    } catch (err) {
      setScrError(err instanceof Error ? err.message : "Network error");
    } finally {
      setScrLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScreener();
  }, [fetchScreener]);

  // Auto-fetch when filters change
  useEffect(() => {
    if (tab === "legend" && Object.keys(scrFilters).length > 0) {
      fetchScreenerFiltered(scrFilters);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, scrFilters]);

  // Reset show count when switching tabs
  useEffect(() => {
    setShowCount(20);
  }, [tab]);

  // Filtered items
  const fomoItems = fomoKr;

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
        default: return `FOMO 스크리너 — KR ${count}개 종목`;
      }
    }
    switch (signalFilter) {
      case "VOLUME SPIKE": return `Volume Spike — KR ${count} stocks`;
      case "BREAKOUT": return `Breakout Signal — KR ${count} stocks`;
      case "MOMO": return `Momentum Rising — KR ${count} stocks`;
      default: return `FOMO Screener — KR ${count} stocks`;
    }
  }, [signalFilter, filteredFomo.length, lang]);

  const handleSelect = (item: FomoItem) => {
    setSelected(item);
    setAiResult(null);
    setError(null);
    // Auto-fetch financials
    setDetailFin(null);
    setDetailFinError(false);
    setDetailFinLoading(true);
    fetch(`/api/financials?ticker=${encodeURIComponent(item.ticker)}&market=KR`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setDetailFin(json.data);
        else setDetailFinError(true);
      })
      .catch(() => setDetailFinError(true))
      .finally(() => setDetailFinLoading(false));
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="ideas" />

      <main className="mx-auto max-w-[1400px] px-4 py-4 space-y-3">
        {/* Tab pills + sub-tabs */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-px rounded bg-card-border p-px w-fit">
            {(["fomo", "legend", "rotation", "financials"] as const).map((tv) => (
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
                {tv === "fomo" ? "FOMO" : tv === "legend" ? (lang === "kr" ? "대가 스크리너" : "Legend Screener") : tv === "rotation" ? (lang === "kr" ? "섹터 로테이션" : "Sector Rotation") : (lang === "kr" ? "재무제표" : "Financials")}
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

        {/* Financials tab */}
        {tab === "financials" && <FinancialsTab lang={lang} />}

        {/* Legend Screener tab — filter-based */}
        {tab === "legend" && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            {/* Left: Filters + List */}
            <section className={`${CARD} lg:col-span-3`}>
              {/* Filter cards */}
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {FILTER_CARDS.map((fc) => (
                  <div key={fc.key} className="rounded border border-card-border/60 bg-[#0d1117] p-2.5">
                    <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-muted/70">
                      {lang === "kr" ? fc.labelKr : fc.label}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {fc.options.map((opt) => {
                        const isActive = scrFilters[fc.key] === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => {
                              setScrFilters((prev) => {
                                const next = { ...prev };
                                if (isActive) {
                                  delete next[fc.key];
                                } else {
                                  next[fc.key] = opt.value;
                                }
                                return next;
                              });
                              setLegendSelected(null);
                            }}
                            className={`rounded px-2 py-0.5 text-[10px] font-mono font-medium transition-colors ${
                              isActive
                                ? "bg-accent text-white"
                                : "bg-card-border/40 text-muted hover:text-foreground hover:bg-card-border/70"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Active filters summary + refresh */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {lang === "kr" ? "스크리너 결과" : "Screener Results"} — {scrResults.length} {lang === "kr" ? "종목" : "stocks"}
                  </h2>
                </div>
                <button
                  onClick={() => fetchScreenerFiltered(scrFilters, true)}
                  disabled={scrLoading || Object.keys(scrFilters).length === 0}
                  className="px-3 py-1 text-[10px] font-mono text-muted border border-card-border hover:text-foreground transition-colors disabled:opacity-30"
                >
                  {scrLoading ? "SCANNING..." : "REFRESH"}
                </button>
              </div>

              {/* No filter selected */}
              {Object.keys(scrFilters).length === 0 && !scrLoading && (
                <p className="py-8 text-center text-[10px] text-muted">
                  {lang === "kr" ? "필터를 1개 이상 선택하세요" : "Select at least one filter above"}
                </p>
              )}

              {/* Loading */}
              {scrLoading && (
                <div className="space-y-0">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5 border-b border-card-border/20">
                      <div className="h-3 w-16 rounded bg-card-border/30 animate-pulse" />
                      <div className="h-3 w-28 rounded bg-card-border/20 animate-pulse" />
                      <div className="ml-auto h-3 w-14 rounded bg-card-border/20 animate-pulse" />
                      <div className="h-3 w-12 rounded bg-card-border/20 animate-pulse" />
                    </div>
                  ))}
                </div>
              )}

              {/* Error */}
              {scrError && !scrLoading && (
                <div className="py-8 text-center">
                  <p className="text-[10px] text-loss">{scrError}</p>
                  <button
                    onClick={() => fetchScreenerFiltered(scrFilters, true)}
                    className="mt-2 rounded bg-accent/20 px-3 py-1 text-[10px] text-accent hover:bg-accent/30"
                  >
                    {lang === "kr" ? "다시 시도" : "Retry"}
                  </button>
                </div>
              )}

              {/* Results table */}
              {!scrLoading && !scrError && scrResults.length > 0 && Object.keys(scrFilters).length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-card-border">
                        <th className={TH}>Symbol</th>
                        <th className={TH}>Name</th>
                        <th className={`${TH} text-right`}>Price</th>
                        <th className={`${TH} text-right`}>Chg%</th>
                        <th className={`${TH} text-right`}>PER</th>
                        <th className={`${TH} text-right`}>EPS YoY</th>
                        <th className={`${TH} text-right`}>EPS QoQ</th>
                        <th className={`${TH} text-right`}>Rev YoY</th>
                        <th className={`${TH} text-right`}>{lang === "kr" ? "신고가대비" : "vs High"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scrResults.map((r) => (
                        <tr
                          key={r.symbol}
                          onClick={() => setLegendSelected(legendSelected === r.symbol ? null : r.symbol)}
                          className={`cursor-pointer border-b border-card-border/40 transition-colors ${
                            legendSelected === r.symbol ? "bg-accent/10" : "hover:bg-card-border/20"
                          }`}
                        >
                          <td className={`${TD} pl-2 text-accent font-medium`}>{r.symbol}</td>
                          <td className={`${TD} text-muted truncate max-w-[120px]`}>{r.name}</td>
                          <td className={`${TD} text-right tabular-nums`}>{r.price.toFixed(2)}</td>
                          <td className={`${TD} text-right tabular-nums`}><ChgPct v={r.change_pct} /></td>
                          <td className={`${TD} text-right tabular-nums text-muted`}>{r.per != null ? r.per.toFixed(1) : "—"}</td>
                          <td className={`${TD} text-right tabular-nums ${r.epsYoY != null && r.epsYoY > 0 ? "text-gain" : "text-muted"}`}>
                            {r.epsYoY != null ? `${r.epsYoY > 0 ? "+" : ""}${r.epsYoY.toFixed(1)}%` : "—"}
                          </td>
                          <td className={`${TD} text-right tabular-nums ${r.epsQoQ != null && r.epsQoQ > 0 ? "text-gain" : "text-muted"}`}>
                            {r.epsQoQ != null ? `${r.epsQoQ > 0 ? "+" : ""}${r.epsQoQ.toFixed(1)}%` : "—"}
                          </td>
                          <td className={`${TD} text-right tabular-nums ${r.revYoY != null && r.revYoY > 0 ? "text-gain" : "text-muted"}`}>
                            {r.revYoY != null ? `${r.revYoY > 0 ? "+" : ""}${r.revYoY.toFixed(1)}%` : "—"}
                          </td>
                          <td className={`${TD} text-right tabular-nums text-muted`}>
                            {r.distFromHigh != null ? `-${r.distFromHigh.toFixed(1)}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Empty results */}
              {!scrLoading && !scrError && scrResults.length === 0 && Object.keys(scrFilters).length > 0 && (
                <p className="py-8 text-center text-[10px] text-muted">
                  {lang === "kr" ? "조건 충족 종목 없음" : "No stocks match criteria"}
                </p>
              )}

              {/* Footer */}
              {scrUpdatedAt && !scrLoading && (
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-card-border/40">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-muted/50">
                      S&P 100 · {scrResults.length} passed
                    </span>
                    {scrCached && (
                      <span className="text-[9px] font-mono text-amber-500/50">CACHED</span>
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-muted/50">
                    Updated {new Date(scrUpdatedAt).toLocaleString()}
                  </span>
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

              {!legendSelected ? (
                <p className="py-8 text-center text-[10px] text-muted">
                  {lang === "kr" ? "목록에서 종목을 선택하세요" : "Select a stock from the list"}
                </p>
              ) : (() => {
                const item = scrResults.find((r) => r.symbol === legendSelected);
                if (!item) return null;
                return (
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-accent">{item.symbol}</span>
                        <span className="ml-2 text-xs text-muted">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums">{item.price.toFixed(2)}</p>
                        <p className="text-[10px] tabular-nums"><ChgPct v={item.change_pct} /></p>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="border-b border-[#1e1e1e] pb-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-[#555] mb-2.5">
                        FUNDAMENTALS
                      </p>
                      <div className="space-y-2">
                        {([
                          ["PER", item.per != null ? item.per.toFixed(1) : "—"],
                          ["EPS YoY", item.epsYoY != null ? `${item.epsYoY > 0 ? "+" : ""}${item.epsYoY.toFixed(1)}%` : "—"],
                          ["EPS QoQ", item.epsQoQ != null ? `${item.epsQoQ > 0 ? "+" : ""}${item.epsQoQ.toFixed(1)}%` : "—"],
                          ["Rev YoY", item.revYoY != null ? `${item.revYoY > 0 ? "+" : ""}${item.revYoY.toFixed(1)}%` : "—"],
                          [lang === "kr" ? "52주 신고가 대비" : "vs 52W High", item.distFromHigh != null ? `-${item.distFromHigh.toFixed(1)}%` : "—"],
                        ] as const).map(([label, val]) => (
                          <div key={label} className="flex items-center justify-between">
                            <span className="text-[11px] text-[#888]">{label}</span>
                            <span className="text-[11px] font-mono text-foreground">{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Chart analysis link */}
                    <a
                      href="/ai-trading"
                      className="block w-full rounded bg-accent px-4 py-1.5 text-xs font-medium text-white text-center transition-opacity hover:opacity-90"
                    >
                      {lang === "kr" ? "AI 차트 분석" : "AI Chart Analysis"}
                    </a>
                  </div>
                );
              })()}
            </section>
          </div>
        )}

        {/* Two-column layout (FOMO only) */}
        {tab === "fomo" && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            {/* Left: Ideas list */}
            <section className={`${CARD} lg:col-span-3`}>
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
                  {/* Financials section */}
                  {detailFinLoading && (
                    <div className="border-t border-white/10 pt-4 mt-4">
                      <p className="text-xs animate-pulse" style={{ color: "#555" }}>Loading...</p>
                    </div>
                  )}
                  {detailFin && !detailFinLoading && (() => {
                    const isKR = detailFin.market === "KR";
                    const unit = isKR ? (lang === "kr" ? "억원" : "KRW 100M") : "$M";
                    const q = detailFin.quarterly || [];
                    // Market cap display
                    const mcap = detailFin.marketCap;
                    let mcapStr = "—";
                    if (mcap != null) {
                      if (isKR) {
                        const jo = Math.floor(mcap / 10000);
                        const eok = mcap % 10000;
                        mcapStr = jo > 0
                          ? `${jo}조 ${eok.toLocaleString()}억원`
                          : `${eok.toLocaleString()}억원`;
                      } else {
                        mcapStr = mcap >= 1000 ? `$${(mcap / 1000).toFixed(1)}B` : `$${mcap.toLocaleString()}M`;
                      }
                    }
                    const fmtVal = (v: number | null) => {
                      if (v == null) return "—";
                      const val = isKR ? v / 1e8 : v;
                      const abs = Math.abs(val);
                      const f = abs.toLocaleString(undefined, { maximumFractionDigits: 0 });
                      return val < 0 ? `(${f})` : f;
                    };
                    return (
                      <div className="border-t border-white/10 pt-4 mt-4 space-y-3">
                        {/* Market cap */}
                        <div>
                          <span className="text-[10px]" style={{ color: "#6b7280" }}>
                            {lang === "kr" ? "시가총액" : "Market Cap"}
                          </span>
                          <p className="text-sm font-mono" style={{ color: "#e8e8e8" }}>{mcapStr}</p>
                        </div>
                        {/* Quarterly table */}
                        {q.length > 0 && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#6b7280" }}>
                              {lang === "kr" ? "FINANCIALS · 최근 4분기" : "FINANCIALS · Last 4Q"}
                            </p>
                            <div className="overflow-x-auto rounded" style={{ border: "1px solid #222" }}>
                              <table className="w-full font-mono text-xs" style={{ background: "#080c12" }}>
                                <thead>
                                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                                    <th className="py-1.5 pl-2 pr-3 text-left text-[9px] font-medium uppercase tracking-wider" style={{ color: "#6b7280" }}>&nbsp;</th>
                                    {q.map((qi, i) => (
                                      <th key={i} className="py-1.5 px-2 text-right text-[9px] font-medium uppercase tracking-wider" style={{ color: "#6b7280" }}>
                                        {qi.label}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {/* Revenue */}
                                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.03)" }}>
                                    <td className="py-1 pl-2 pr-3 text-[10px] font-medium" style={{ color: "#e8e8e8" }}>
                                      {lang === "kr" ? "매출액" : "Revenue"}
                                    </td>
                                    {q.map((qi, i) => (
                                      <td key={i} className="py-1 px-2 text-right tabular-nums" style={{ color: qi.revenue != null && qi.revenue < 0 ? "#f87171" : "#e8e8e8" }}>
                                        {fmtVal(qi.revenue)}
                                      </td>
                                    ))}
                                  </tr>
                                  {/* Operating Income */}
                                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                    <td className="py-1 pl-2 pr-3 text-[10px]" style={{ color: "#9ca3af" }}>
                                      {lang === "kr" ? "영업이익" : "Operating Income"}
                                    </td>
                                    {q.map((qi, i) => (
                                      <td key={i} className="py-1 px-2 text-right tabular-nums" style={{ color: qi.operatingIncome != null && qi.operatingIncome < 0 ? "#f87171" : "#9ca3af" }}>
                                        {fmtVal(qi.operatingIncome)}
                                      </td>
                                    ))}
                                  </tr>
                                  {/* OP QoQ */}
                                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                    <td className="py-1 pl-4 pr-3 text-[9px]" style={{ color: "#555" }}>
                                      {lang === "kr" ? "영업이익 QoQ" : "OP QoQ"}
                                    </td>
                                    {q.map((qi, i) => {
                                      if (i === 0) return <td key={i} className="py-1 px-2 text-right text-[9px]" style={{ color: "#555" }}>—</td>;
                                      const cur = qi.operatingIncome;
                                      const prev = q[i - 1].operatingIncome;
                                      const qoq = cur != null && prev != null && prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : null;
                                      return (
                                        <td key={i} className="py-1 px-2 text-right tabular-nums text-[9px]" style={{ color: qoq == null ? "#555" : qoq >= 0 ? "#4ade80" : "#f87171" }}>
                                          {qoq != null ? `${qoq >= 0 ? "+" : ""}${qoq.toFixed(1)}%` : "—"}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                  {/* OPM */}
                                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                    <td className="py-1 pl-4 pr-3 text-[9px]" style={{ color: "#555" }}>
                                      {lang === "kr" ? "영업이익률%" : "OP Margin"}
                                    </td>
                                    {q.map((qi, i) => {
                                      const opm = qi.revenue && qi.operatingIncome ? (qi.operatingIncome / qi.revenue) * 100 : null;
                                      return (
                                        <td key={i} className="py-1 px-2 text-right tabular-nums text-[9px]" style={{ color: opm != null && opm < 0 ? "#f87171" : "#555" }}>
                                          {opm != null ? `${opm.toFixed(1)}%` : "—"}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                  {/* Net Income */}
                                  <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                                    <td className="py-1 pl-2 pr-3 text-[10px] font-medium" style={{ color: "#e8e8e8" }}>
                                      {lang === "kr" ? "당기순이익" : "Net Income"}
                                    </td>
                                    {q.map((qi, i) => (
                                      <td key={i} className="py-1 px-2 text-right tabular-nums" style={{ color: qi.netIncome != null && qi.netIncome < 0 ? "#f87171" : "#e8e8e8" }}>
                                        {fmtVal(qi.netIncome)}
                                      </td>
                                    ))}
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                            <p className="mt-1 text-[9px] text-right" style={{ color: "#555" }}>{unit}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
