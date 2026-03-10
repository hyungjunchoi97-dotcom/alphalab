"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLang } from "@/lib/LangContext";
import { messages } from "@/lib/i18n";
import AppHeader from "@/components/AppHeader";
import { BarChart, Bar, XAxis, Cell, LabelList, ResponsiveContainer } from "recharts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface QuarterData { [key: string]: any }

interface FinResponse {
  market: "KR" | "US";
  ticker: string;
  marketCap: number | null;
  price: number | null;
  quarterly: QuarterData[];
}

interface TickerResult {
  ticker: string;
  name: string;
  nameEn: string;
  market: "KR" | "US";
  exchange: string;
}

type TabKey = "pl" | "bs" | "cf";
type PeriodKey = "quarterly" | "annual";

interface RowDef {
  label: string;
  key: string;
  isMargin?: boolean;
  isRatio?: boolean;
  isBold?: boolean;
  indent?: boolean;
  isRed?: boolean;
}

// ── Formatters ──────────────────────────────────────────────

function fmtNum(v: number | null, isKR: boolean): string {
  if (v == null) return "—";
  const val = isKR ? v / 1e8 : v;
  const abs = Math.abs(val);
  const formatted = abs.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return val < 0 ? `(${formatted})` : formatted;
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}%`;
}

function fmtEps(v: number | null): string {
  if (v == null) return "—";
  return v.toFixed(2);
}

function fmtRatio(v: number | null): string {
  if (v == null) return "—";
  return v.toFixed(2);
}

function fmtMarketCap(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtPrice(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Page ────────────────────────────────────────────────────

export default function FinancialsPage() {
  const { lang } = useLang();
  const t = messages[lang as "en" | "kr"] || messages.en;

  const [query, setQuery] = useState("");
  const [finData, setFinData] = useState<FinResponse | null>(null);
  const [finLoading, setFinLoading] = useState(false);
  const [finError, setFinError] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("pl");
  const [period, setPeriod] = useState<PeriodKey>("quarterly");

  // Track selected ticker/market for re-fetch on period change
  const selectedRef = useRef<{ ticker: string; market: string } | null>(null);

  // Search dropdown
  const [searchResults, setSearchResults] = useState<TickerResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  const fetchFinancials = useCallback(async (tk: string, mk: string, pd: PeriodKey) => {
    if (!tk.trim()) return;
    setFinLoading(true);
    setFinError("");
    setFinData(null);
    try {
      const res = await fetch(`/api/financials?ticker=${encodeURIComponent(tk.trim())}&market=${mk}&period=${pd}`);
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
    setShowDropdown(false);
    setSearchResults([]);
    selectedRef.current = { ticker: r.ticker, market: r.market };
    fetchFinancials(r.ticker, r.market, period);
  };

  const handlePeriodChange = (pd: PeriodKey) => {
    setPeriod(pd);
    if (selectedRef.current) {
      fetchFinancials(selectedRef.current.ticker, selectedRef.current.market, pd);
    }
  };

  const isKR = finData?.market === "KR";
  const unit = isKR ? t.finUnit : "$M";
  const quarterly = finData?.quarterly || [];
  const growthLabel = period === "annual" ? "YoY %" : "QoQ %";

  // ── Row definitions per tab ──────────────────────────────

  const PL_ROWS: RowDef[] = [
    { label: "Revenue", key: "revenue", isBold: true },
    { label: growthLabel, key: "revenueGrowth", isMargin: true, indent: true },
    { label: "Cost of Revenue", key: "costOfRevenue", indent: true },
    { label: "Gross Profit", key: "grossProfit", isBold: true },
    { label: "Gross Margin", key: "grossMargin", isMargin: true, indent: true },
    { label: "R&D Expense", key: "rdExpense", indent: true },
    { label: "SG&A", key: "sgaExpense", indent: true },
    { label: "Operating Income", key: "operatingIncome", isBold: true },
    { label: "OPM", key: "operatingMargin", isMargin: true, indent: true },
    { label: "Interest Expense", key: "interestExpense", indent: true },
    { label: "Income Tax", key: "incomeTaxExpense", indent: true },
    { label: "Net Income", key: "netIncome", isBold: true },
    { label: "NPM", key: "netMargin", isMargin: true, indent: true },
    { label: "EBITDA", key: "ebitda" },
    { label: "EPS (Diluted)", key: "eps" },
  ];

  const BS_ROWS: RowDef[] = [
    { label: "Total Assets", key: "totalAssets", isBold: true },
    { label: "Cash & Equivalents", key: "cash", indent: true },
    { label: "Short-term Investments", key: "shortTermInvestments", indent: true },
    { label: "Long-term Investments", key: "longTermInvestments", indent: true },
    { label: "Goodwill", key: "goodwill", indent: true },
    { label: "Intangible Assets", key: "intangibleAssets", indent: true },
    { label: "Total Liabilities", key: "totalLiabilities", isBold: true },
    { label: "Short-term Debt", key: "shortTermDebt", indent: true },
    { label: "Long-term Debt", key: "longTermDebt", indent: true },
    { label: "Total Equity", key: "totalEquity", isBold: true },
    { label: "Net Debt", key: "netDebt" },
    { label: "Debt/Equity", key: "debtToEquity", isRatio: true },
    { label: "Current Ratio", key: "currentRatio", isRatio: true },
  ];

  const CF_ROWS: RowDef[] = [
    { label: "Operating Cash Flow", key: "operatingCF", isBold: true },
    { label: "Stock-Based Comp", key: "sbc", indent: true },
    { label: "Chg in Working Capital", key: "changeInWorkingCapital", indent: true },
    { label: "Capital Expenditure", key: "capex", isRed: true },
    { label: "Free Cash Flow", key: "fcf", isBold: true },
    { label: "Investing CF", key: "investingCF" },
    { label: "Financing CF", key: "financingCF" },
    { label: "Dividends Paid", key: "dividendsPaid" },
  ];

  const TABS: { key: TabKey; label: string; rows: RowDef[] }[] = [
    { key: "pl", label: "P&L", rows: PL_ROWS },
    { key: "bs", label: "B/S", rows: BS_ROWS },
    { key: "cf", label: "C/F", rows: CF_ROWS },
  ];

  const currentRows = TABS.find((tb) => tb.key === activeTab)?.rows || PL_ROWS;

  // ── Render cell value ────────────────────────────────────

  function renderCell(q: QuarterData, row: RowDef): { text: string; color: string } {
    const val = q[row.key] as number | null;
    if (row.isMargin) {
      return {
        text: fmtPct(val),
        color: val == null ? "#4b5563" : val < 0 ? "#f87171" : "#4ade80",
      };
    }
    if (row.isRatio) {
      return {
        text: row.key === "debtToEquity" ? fmtPct(val) : fmtRatio(val),
        color: val == null ? "#4b5563" : "#9ca3af",
      };
    }
    if (row.key === "eps") {
      return {
        text: fmtEps(val),
        color: val != null && val < 0 ? "#f87171" : "#9ca3af",
      };
    }
    if (row.isRed) {
      return {
        text: fmtNum(val, !!isKR),
        color: "#f87171",
      };
    }
    return {
      text: fmtNum(val, !!isKR),
      color: val != null && val < 0 ? "#f87171" : row.isBold ? "#e8e8e8" : "#9ca3af",
    };
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="financials" />

      <main className="mx-auto max-w-[1400px] px-4 py-4 space-y-4">
        {/* Title */}
        <h1 className="text-sm font-bold" style={{ color: "#e8e8e8" }}>
          {t.finFinancials}
        </h1>

        {/* Search + Period toggle */}
        <div className="flex flex-wrap items-start gap-4">
          <div ref={dropdownRef} className="relative w-full max-w-lg">
            <input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
              placeholder={lang === "kr" ? "회사명(영문) 또는 종목코드 (예: Samsung, AAPL, 005930.KS)" : "Company name or ticker (e.g. Samsung, AAPL, 005930.KS)"}
              className="w-full rounded border px-3 py-2 text-sm font-mono outline-none transition-colors focus:border-amber-400/50"
              style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)", color: "#e8e8e8" }}
            />
            <p className="text-[11px] mt-1" style={{ color: "#6b7280" }}>
              {lang === "kr"
                ? "한국 주식: 영문명 또는 종목코드 입력 (예: 005930.KS, 000660.KS)"
                : "Korean stocks: enter English name or code (e.g. 005930.KS, 000660.KS)"}
            </p>
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

          {/* Period toggle */}
          <div className="flex rounded overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            {(["annual", "quarterly"] as PeriodKey[]).map((pd) => (
              <button
                key={pd}
                onClick={() => handlePeriodChange(pd)}
                className="px-3 py-1.5 text-[10px] font-bold font-mono uppercase tracking-wider transition-colors"
                style={{
                  color: period === pd ? "#fbbf24" : "#6b7280",
                  background: period === pd ? "rgba(251,191,36,0.08)" : "transparent",
                }}
              >
                {pd === "annual" ? "Annual" : "Quarterly"}
              </button>
            ))}
          </div>
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

        {/* Data */}
        {finData && !finLoading && (
          <>
            {/* Header: ticker + market data */}
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <span className="text-lg font-bold font-mono" style={{ color: "#e8e8e8" }}>
                  {finData.ticker}
                </span>
                <span
                  className="ml-2 rounded px-1.5 py-0.5 text-[9px] font-bold"
                  style={{
                    background: isKR ? "rgba(96,165,250,0.12)" : "rgba(251,191,36,0.12)",
                    color: isKR ? "#60a5fa" : "#fbbf24",
                  }}
                >
                  {finData.market}
                </span>
              </div>
              {finData.price != null && (
                <div className="text-sm font-mono" style={{ color: "#9ca3af" }}>
                  {isKR ? "₩" : "$"}{fmtPrice(finData.price)}
                </div>
              )}
              {finData.marketCap != null && (
                <div className="text-[11px] font-mono" style={{ color: "#6b7280" }}>
                  {lang === "kr" ? "시가총액" : "Mkt Cap"}: {fmtMarketCap(finData.marketCap)} {unit}
                </div>
              )}
            </div>

            {/* Tab bar */}
            <div className="flex gap-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {TABS.map((tb) => (
                <button
                  key={tb.key}
                  onClick={() => setActiveTab(tb.key)}
                  className="px-4 py-1.5 text-[11px] font-bold font-mono tracking-wider transition-colors"
                  style={{
                    color: activeTab === tb.key ? "#fbbf24" : "#6b7280",
                    borderBottom: activeTab === tb.key ? "2px solid #fbbf24" : "2px solid transparent",
                    background: activeTab === tb.key ? "rgba(251,191,36,0.04)" : "transparent",
                  }}
                >
                  {tb.label}
                </button>
              ))}
            </div>

            {/* P&L KPI Cards */}
            {activeTab === "pl" && quarterly.length > 0 && (() => {
              const latest = quarterly[quarterly.length - 1];
              const prev = quarterly.length >= 2 ? quarterly[quarterly.length - 2] : null;
              const revYoY = latest?.revenueGrowth as number | null;
              const oiCur = latest?.operatingIncome as number | null;
              const oiPrev = prev?.operatingIncome as number | null;
              const oiYoY = oiCur != null && oiPrev != null && oiPrev !== 0
                ? Math.round(((oiCur - oiPrev) / Math.abs(oiPrev)) * 10000) / 100
                : null;
              const opm = latest?.operatingMargin as number | null;
              const kpiColor = (v: number | null) => v == null ? "#4b5563" : v < 0 ? "#f87171" : "#4ade80";
              return (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="text-[10px]" style={{ color: "#6b7280" }}>Revenue {period === "annual" ? "YoY" : "QoQ"}</div>
                    <div className="text-lg font-mono" style={{ color: kpiColor(revYoY) }}>{revYoY != null ? `${revYoY > 0 ? "+" : ""}${revYoY.toFixed(1)}%` : "—"}</div>
                  </div>
                  <div className="rounded p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="text-[10px]" style={{ color: "#6b7280" }}>Op. Income {period === "annual" ? "YoY" : "QoQ"}</div>
                    <div className="text-lg font-mono" style={{ color: kpiColor(oiYoY) }}>{oiYoY != null ? `${oiYoY > 0 ? "+" : ""}${oiYoY.toFixed(1)}%` : "—"}</div>
                  </div>
                  <div className="rounded p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="text-[10px]" style={{ color: "#6b7280" }}>OPM (Latest)</div>
                    <div className="text-lg font-mono" style={{ color: kpiColor(opm) }}>{opm != null ? `${opm.toFixed(1)}%` : "—"}</div>
                  </div>
                </div>
              );
            })()}

            {/* Table */}
            {quarterly.length === 0 ? (
              <div className="py-8 text-center text-[11px]" style={{ color: "#555" }}>{t.finNoData}</div>
            ) : (
              <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid #222" }}>
                <table className="w-full font-mono text-xs" style={{ background: "#080c12" }}>
                  <thead>
                    <tr style={{ background: "#0d1117", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
                      <th
                        className="sticky left-0 z-10 py-2 pl-3 pr-4 text-left text-[10px] font-medium uppercase tracking-wider"
                        style={{ background: "#0d1117", color: "#6b7280", width: "192px", minWidth: "192px" }}
                      >
                        <span className="text-xs font-mono" style={{ color: "rgba(251,191,36,0.7)" }}>{unit}</span>
                      </th>
                      {quarterly.map((q, i) => (
                        <th
                          key={i}
                          className="py-2 px-3 text-right text-[10px] font-medium uppercase tracking-wider"
                          style={{ color: "#6b7280", minWidth: "110px" }}
                        >
                          {q.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.map((row) => (
                      <tr
                        key={row.key}
                        className="transition-colors hover:bg-white/[0.02]"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                      >
                        <td
                          className="sticky left-0 z-10 py-1.5 pl-3 pr-4 text-left whitespace-nowrap"
                          style={{
                            background: "#0d1117",
                            color: row.isBold ? "#e8e8e8" : "#9ca3af",
                            fontWeight: row.isBold ? 500 : 400,
                            paddingLeft: row.indent ? "28px" : "12px",
                            fontSize: row.isMargin || row.isRatio ? "10px" : "11px",
                          }}
                        >
                          {row.label}
                        </td>
                        {quarterly.map((q, ci) => {
                          const { text, color } = renderCell(q, row);
                          return (
                            <td
                              key={ci}
                              className="py-1.5 px-3 text-right tabular-nums"
                              style={{
                                color,
                                fontSize: row.isMargin || row.isRatio ? "10px" : "11px",
                              }}
                            >
                              {text}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* C/F Capex Bar Chart */}
            {activeTab === "cf" && quarterly.length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] mb-2" style={{ color: "#6b7280" }}>Capital Expenditure</div>
                <div style={{ width: "100%", height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={quarterly.map((q) => ({ label: q.label, capex: q.capex as number | null }))} barCategoryGap="20%">
                      <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                      <Bar dataKey="capex" radius={[2, 2, 0, 0]}>
                        <LabelList
                          dataKey="capex"
                          position="top"
                          style={{ fill: "#9ca3af", fontSize: 9, fontFamily: "monospace" }}
                          formatter={(v: number | null) => v != null ? (isKR ? Math.round(v / 1e8).toLocaleString() : v.toLocaleString()) : ""}
                        />
                        {quarterly.map((q, i) => (
                          <Cell key={i} fill={(q.capex as number) >= 0 ? "#f59e0b" : "#f87171"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!finData && !finLoading && !finError && (
          <div className="py-20 text-center">
            <p className="text-[11px]" style={{ color: "#555" }}>
              {lang === "kr" ? "종목을 검색하여 재무제표를 확인하세요" : "Search a ticker to view financial statements"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
