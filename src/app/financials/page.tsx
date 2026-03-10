"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLang } from "@/lib/LangContext";
import { messages } from "@/lib/i18n";
import AppHeader from "@/components/AppHeader";
import AiAnalysisPanel from "@/components/AiAnalysisPanel";

interface QuarterData {
  label: string;
  revenue: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
}

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

// ── Formatters ──────────────────────────────────────────────

function fmtNum(v: number | null, isKR: boolean): string {
  if (v == null) return "—";
  // KR: already in KRW from DART, convert to 억원
  const val = isKR ? v / 1e8 : v; // US: already in $M from API
  const abs = Math.abs(val);
  const formatted = abs.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return val < 0 ? `(${formatted})` : formatted;
}

function fmtMarketCap(v: number | null, isKR: boolean): string {
  if (v == null) return "—";
  // Already converted: KR=억원, US=$M
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
    setShowDropdown(false);
    setSearchResults([]);
    fetchFinancials(r.ticker, r.market);
  };

  const isKR = finData?.market === "KR";
  const unit = isKR ? t.finUnit : "$M";
  const quarterly = finData?.quarterly || [];

  const ROWS: { label: string; key: keyof QuarterData }[] = [
    { label: t.finRevenue, key: "revenue" },
    { label: t.finOperatingIncome, key: "operatingIncome" },
    { label: t.finNetIncome, key: "netIncome" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="financials" />

      <main className="mx-auto max-w-[1400px] px-4 py-4 space-y-4">
        {/* Title */}
        <h1 className="text-sm font-bold" style={{ color: "#e8e8e8" }}>
          {t.finFinancials}
        </h1>

        {/* Search */}
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
                  {lang === "kr" ? "시가총액" : "Mkt Cap"}: {fmtMarketCap(finData.marketCap, !!isKR)} {unit}
                </div>
              )}
            </div>

            {/* Quarterly Income Statement Table */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#6b7280" }}>
                  {t.finQuarterly} {t.finIS}
                </span>
                <span className="text-[9px] font-mono" style={{ color: "#555" }}>
                  {unit}
                </span>
              </div>

              {quarterly.length === 0 ? (
                <div className="py-8 text-center text-[11px]" style={{ color: "#555" }}>{t.finNoData}</div>
              ) : (
                <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid #222" }}>
                  <table className="w-full font-mono text-[11px]" style={{ background: "#080c12" }}>
                    <thead>
                      <tr style={{ background: "#0d1117", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
                        <th
                          className="sticky left-0 z-10 py-2 pl-3 pr-4 text-left text-[10px] font-medium uppercase tracking-wider"
                          style={{ background: "#0d1117", color: "#6b7280", width: "180px", minWidth: "180px" }}
                        >
                          &nbsp;
                        </th>
                        {quarterly.map((q, i) => (
                          <th
                            key={i}
                            className="py-2 px-3 text-right text-[10px] font-medium uppercase tracking-wider"
                            style={{ color: "#6b7280", minWidth: "100px" }}
                          >
                            {q.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ROWS.map((row) => (
                        <tr
                          key={row.key}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                            background: row.key === "revenue" || row.key === "netIncome" ? "rgba(255,255,255,0.03)" : "transparent",
                          }}
                        >
                          <td
                            className="sticky left-0 z-10 py-1.5 pl-3 pr-4 text-left whitespace-nowrap font-medium"
                            style={{
                              background: "#080c12",
                              color: row.key === "revenue" || row.key === "netIncome" ? "#e8e8e8" : "#9ca3af",
                            }}
                          >
                            {row.label}
                          </td>
                          {quarterly.map((q, ci) => {
                            const val = q[row.key] as number | null;
                            return (
                              <td
                                key={ci}
                                className="py-1.5 px-3 text-right tabular-nums"
                                style={{
                                  color: val != null && val < 0 ? "#f87171"
                                    : row.key === "revenue" || row.key === "netIncome" ? "#e8e8e8" : "#9ca3af",
                                }}
                              >
                                {fmtNum(val, !!isKR)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {/* OPM row */}
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td
                          className="sticky left-0 z-10 py-1.5 pl-3 pr-4 text-left whitespace-nowrap"
                          style={{ background: "#080c12", color: "#6b7280", paddingLeft: "28px", fontSize: "10px" }}
                        >
                          OPM
                        </td>
                        {quarterly.map((q, ci) => {
                          const opm = q.revenue && q.operatingIncome ? (q.operatingIncome / q.revenue) * 100 : null;
                          return (
                            <td
                              key={ci}
                              className="py-1.5 px-3 text-right tabular-nums"
                              style={{ fontSize: "10px", color: opm != null && opm < 0 ? "#f87171" : "#6b7280" }}
                            >
                              {opm != null ? `${opm.toFixed(1)}%` : "—"}
                            </td>
                          );
                        })}
                      </tr>
                      {/* NPM row */}
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td
                          className="sticky left-0 z-10 py-1.5 pl-3 pr-4 text-left whitespace-nowrap"
                          style={{ background: "#080c12", color: "#6b7280", paddingLeft: "28px", fontSize: "10px" }}
                        >
                          NPM
                        </td>
                        {quarterly.map((q, ci) => {
                          const npm = q.revenue && q.netIncome ? (q.netIncome / q.revenue) * 100 : null;
                          return (
                            <td
                              key={ci}
                              className="py-1.5 px-3 text-right tabular-nums"
                              style={{ fontSize: "10px", color: npm != null && npm < 0 ? "#f87171" : "#6b7280" }}
                            >
                              {npm != null ? `${npm.toFixed(1)}%` : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* AI Analysis */}
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
