"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLang } from "@/lib/LangContext";
import { messages } from "@/lib/i18n";
import AppHeader from "@/components/AppHeader";
import {
  BarChart, Bar, XAxis, LabelList, ResponsiveContainer,
  LineChart, Line, Tooltip,
} from "recharts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface QuarterData { [key: string]: any }

interface PriceTarget {
  consensus: number | null;
  high: number | null;
  low: number | null;
  median: number | null;
}

interface FinResponse {
  market: "KR" | "US";
  ticker: string;
  marketCap: number | null;
  price: number | null;
  priceTarget?: PriceTarget | null;
  quarterly: QuarterData[];
  keyMetrics?: QuarterData[];
  valuation?: QuarterData[];
}

interface TickerResult {
  ticker: string;
  name: string;
  nameEn: string;
  market: "KR" | "US";
  exchange: string;
}

type TabKey = "overview" | "pl" | "bs" | "cf" | "keyMetrics" | "valuation";
type PeriodKey = "quarterly" | "annual";

interface RowDef {
  label: string;
  key: string;
  isMargin?: boolean;
  isRatio?: boolean;
  isBold?: boolean;
  indent?: boolean;
  isRed?: boolean;
  isSectionHeader?: boolean;
  isTotal?: boolean;
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

// ── Helpers ─────────────────────────────────────────────────

function chgPct(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
}

function chgPp(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null) return null;
  return Math.round((cur - prev) * 10) / 10;
}

const kpiColor = (v: number | null) => v == null ? "#4b5563" : v < 0 ? "#f87171" : "#4ade80";
const kpiArrow = (v: number | null) => v == null ? "" : v > 0 ? "▲" : v < 0 ? "▼" : "";

// ── Badge helpers ───────────────────────────────────────────

function healthBadge(label: string, value: number | null, good: [number, number], watch: [number, number]) {
  let status = "—";
  let bg = "#1f2937";
  let fg = "#6b7280";
  if (value != null) {
    if (value >= good[0] && value <= good[1]) {
      status = "Good"; bg = "rgba(74,222,128,0.1)"; fg = "#4ade80";
    } else if (value >= watch[0] && value <= watch[1]) {
      status = "Watch"; bg = "rgba(251,191,36,0.1)"; fg = "#fbbf24";
    } else {
      status = "Risk"; bg = "rgba(248,113,113,0.1)"; fg = "#f87171";
    }
  }
  return (
    <div className="rounded p-3" style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#6b7280" }}>{label}</div>
      <div className="text-base font-mono font-semibold" style={{ color: "#f3f4f6" }}>
        {value != null ? fmtRatio(value) : "—"}
      </div>
      <span
        className="inline-block mt-1 rounded px-1.5 py-0.5 text-[9px] font-bold"
        style={{ background: bg, color: fg }}
      >
        {status}
      </span>
    </div>
  );
}

// ── Sparkline ───────────────────────────────────────────────

function Sparkline({ data, dataKey, color = "#fbbf24" }: { data: QuarterData[]; dataKey: string; color?: string }) {
  const filtered = data.filter((d) => d[dataKey] != null);
  if (filtered.length < 2) return <span style={{ color: "#4b5563" }}>—</span>;
  return (
    <ResponsiveContainer width={80} height={24}>
      <LineChart data={filtered}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Page ────────────────────────────────────────────────────

export default function FinancialsPage() {
  const { lang } = useLang();
  const t = messages[lang as "en" | "kr"] || messages.en;

  const [query, setQuery] = useState("");
  const [finData, setFinData] = useState<FinResponse | null>(null);
  const [finLoading, setFinLoading] = useState(false);
  const [finError, setFinError] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [period, setPeriod] = useState<PeriodKey>("quarterly");

  const selectedRef = useRef<{ ticker: string; market: string } | null>(null);
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
  const keyMetrics = finData?.keyMetrics || [];
  const valuation = finData?.valuation || [];
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
    { label: "ASSETS", key: "_assets_header", isSectionHeader: true },
    { label: "Total Current Assets", key: "totalCurrentAssets", isBold: true },
    { label: "Cash & Equivalents", key: "cash", indent: true },
    { label: "Short-term Investments", key: "shortTermInvestments", indent: true },
    { label: "Accounts Receivable", key: "accountsReceivable", indent: true },
    { label: "Inventory", key: "inventory", indent: true },
    { label: "Other Current Assets", key: "otherCurrentAssets", indent: true },
    { label: "Total Non-Current Assets", key: "totalNonCurrentAssets", isBold: true },
    { label: "PP&E Net", key: "ppeNet", indent: true },
    { label: "Long-term Investments", key: "longTermInvestments", indent: true },
    { label: "Goodwill", key: "goodwill", indent: true },
    { label: "Other Non-Current", key: "otherNonCurrent", indent: true },
    { label: "Total Assets", key: "totalAssets", isBold: true, isTotal: true },
    { label: "LIABILITIES", key: "_liab_header", isSectionHeader: true },
    { label: "Total Current Liabilities", key: "totalCurrentLiabilities", isBold: true },
    { label: "Accounts Payable", key: "accountPayables", indent: true },
    { label: "Short-term Debt", key: "shortTermDebt", indent: true },
    { label: "Deferred Revenue", key: "deferredRevenue", indent: true },
    { label: "Other Current Liabilities", key: "otherCurrentLiabilities", indent: true },
    { label: "Total Non-Current Liabilities", key: "totalNonCurrentLiabilities", isBold: true },
    { label: "Long-term Debt", key: "longTermDebt", indent: true },
    { label: "Other Non-Current Liabilities", key: "otherNonCurrentLiabilities", indent: true },
    { label: "Total Liabilities", key: "totalLiabilities", isBold: true, isTotal: true },
    { label: "EQUITY", key: "_equity_header", isSectionHeader: true },
    { label: "Common Stock", key: "commonStock", indent: true },
    { label: "Retained Earnings", key: "retainedEarnings", indent: true },
    { label: "Total Equity", key: "totalEquity", isBold: true, isTotal: true },
    { label: "KEY METRICS", key: "_metrics_header", isSectionHeader: true },
    { label: "Net Debt", key: "netDebt" },
    { label: "Debt/Equity", key: "debtToEquity", isRatio: true },
    { label: "Current Ratio", key: "currentRatio", isRatio: true },
    { label: "Total Investments", key: "totalInvestments" },
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

  const KM_ROWS: RowDef[] = [
    { label: "ROE", key: "roe", isMargin: true },
    { label: "ROIC", key: "roic", isMargin: true },
    { label: "ROA", key: "roa", isMargin: true },
    { label: "FCF Yield", key: "fcfYield", isMargin: true },
    { label: "Earnings Yield", key: "eps", isMargin: true },
    { label: "Rev / Share", key: "revenuePerShare", isRatio: true },
    { label: "NI / Share", key: "netIncomePerShare", isRatio: true },
    { label: "Interest Coverage", key: "interestCoverage", isRatio: true },
    { label: "Net Debt / EBITDA", key: "netDebtToEbitda", isRatio: true },
  ];

  const VAL_ROWS: RowDef[] = [
    { label: "P/E", key: "pe", isRatio: true },
    { label: "P/B", key: "pb", isRatio: true },
    { label: "EV/EBITDA", key: "evEbitda", isRatio: true },
    { label: "P/S", key: "ps", isRatio: true },
    { label: "EV/Revenue", key: "evRevenue", isRatio: true },
    { label: "PEG", key: "peg", isRatio: true },
    { label: "Dividend Yield", key: "dividendYield", isMargin: true },
  ];

  const TABLE_TABS: { key: TabKey; label: string; rows: RowDef[]; data?: QuarterData[] }[] = [
    { key: "pl", label: "P&L", rows: PL_ROWS },
    { key: "bs", label: "B/S", rows: BS_ROWS },
    { key: "cf", label: "C/F", rows: CF_ROWS },
    { key: "keyMetrics", label: "KEY METRICS", rows: KM_ROWS, data: keyMetrics },
    { key: "valuation", label: "VALUATION", rows: VAL_ROWS, data: valuation },
  ];

  const ALL_TABS: { key: TabKey; label: string }[] = [
    { key: "overview", label: "OVERVIEW" },
    ...TABLE_TABS,
  ];

  const activeTableTab = TABLE_TABS.find((tb) => tb.key === activeTab);
  const currentRows = activeTableTab?.rows || [];
  const currentData = activeTableTab?.data || quarterly;

  // ── Render cell value ────────────────────────────────────

  function renderCell(q: QuarterData, row: RowDef): { text: string; color: string; fontWeight?: number } {
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
        color: val == null ? "#4b5563" : "#f3f4f6",
      };
    }
    if (row.key === "eps") {
      return {
        text: fmtEps(val),
        color: val != null && val < 0 ? "#f87171" : "#f3f4f6",
      };
    }
    if (row.isRed) {
      return {
        text: fmtNum(val, !!isKR),
        color: "#f87171",
      };
    }
    const neg = val != null && val < 0;
    return {
      text: fmtNum(val, !!isKR),
      color: neg ? "#f87171" : row.isBold ? "#ffffff" : "#f3f4f6",
      fontWeight: row.isBold ? 600 : undefined,
    };
  }

  // ── Render standard table ────────────────────────────────

  function renderTable(rows: RowDef[], data: QuarterData[], showUnit?: boolean) {
    if (data.length === 0) return <div className="py-8 text-center text-[11px]" style={{ color: "#555" }}>{t.finNoData}</div>;
    return (
      <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid #222" }}>
        <table className="w-full font-mono text-xs" style={{ background: "#080c12" }}>
          <thead>
            <tr style={{ background: "#0d1117", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
              <th
                className="sticky left-0 z-10 py-2 pl-3 pr-4 text-left text-[10px] font-medium uppercase tracking-wider"
                style={{ background: "#0d1117", color: "#6b7280", width: "192px", minWidth: "192px" }}
              >
                {showUnit && <span className="text-xs font-mono" style={{ color: "rgba(251,191,36,0.7)" }}>{unit}</span>}
              </th>
              {data.map((q, i) => (
                <th key={i} className="py-2 px-4 text-right text-[10px] font-medium uppercase tracking-wider" style={{ color: "#6b7280", minWidth: "120px" }}>
                  {q.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.isSectionHeader) {
                return (
                  <tr key={row.key} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <td className="sticky left-0 z-10 pt-4 pb-1 pl-3 pr-4 text-left whitespace-nowrap text-[10px] font-bold uppercase tracking-wider" style={{ background: "#0d1117", color: "rgba(251,191,36,0.6)" }}>
                      {row.label}
                    </td>
                    {data.map((_, ci) => <td key={ci} className="pt-4 pb-1" />)}
                  </tr>
                );
              }
              return (
                <tr key={row.key} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: row.isTotal ? "2px solid rgba(255,255,255,0.1)" : "1px solid rgba(255,255,255,0.04)" }}>
                  <td className="sticky left-0 z-10 py-1.5 pl-3 pr-4 text-left whitespace-nowrap" style={{
                    background: "#0d1117",
                    color: row.isTotal ? "#ffffff" : row.isBold ? "#e8e8e8" : "#9ca3af",
                    fontWeight: row.isBold || row.isTotal ? 600 : 400,
                    paddingLeft: row.indent ? "28px" : "12px",
                    fontSize: row.isMargin || row.isRatio ? "11px" : "12px",
                  }}>
                    {row.label}
                  </td>
                  {data.map((q, ci) => {
                    const { text, color, fontWeight } = renderCell(q, row);
                    return (
                      <td key={ci} className="py-1.5 px-4 text-right tabular-nums" style={{
                        color: row.isTotal ? "#ffffff" : color,
                        fontWeight: row.isTotal ? 600 : fontWeight,
                        fontSize: row.isMargin || row.isRatio ? "11px" : "13px",
                        letterSpacing: "0.01em",
                      }}>
                        {text}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Overview tab ─────────────────────────────────────────

  function renderOverview() {
    if (quarterly.length === 0) return null;
    const latest = quarterly[quarterly.length - 1];
    const prev = quarterly.length >= 2 ? quarterly[quarterly.length - 2] : null;

    const ovKpis = [
      { label: "Revenue", val: latest?.revenue, prev: prev?.revenue, isMoney: true },
      { label: "Operating Income", val: latest?.operatingIncome, prev: prev?.operatingIncome, isMoney: true },
      { label: "Net Income", val: latest?.netIncome, prev: prev?.netIncome, isMoney: true },
      { label: "Free Cash Flow", val: latest?.fcf, prev: prev?.fcf, isMoney: true },
    ];
    const ovMargins = [
      { label: "Gross Margin", val: latest?.grossMargin, prev: prev?.grossMargin },
      { label: "Operating Margin", val: latest?.operatingMargin, prev: prev?.operatingMargin },
      { label: "Net Margin", val: latest?.netMargin, prev: prev?.netMargin },
      { label: "ROE", val: keyMetrics.length > 0 ? keyMetrics[keyMetrics.length - 1]?.roe : null, prev: keyMetrics.length > 1 ? keyMetrics[keyMetrics.length - 2]?.roe : null },
    ];

    return (
      <div className="space-y-4">
        {/* Row 1: Revenue/OI/NI/FCF */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ovKpis.map((k) => {
            const change = k.isMoney ? chgPct(k.val, k.prev) : chgPp(k.val, k.prev);
            return (
              <div key={k.label} className="rounded p-3" style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-[10px] uppercase tracking-widest" style={{ color: "#6b7280" }}>{k.label}</div>
                <div className="text-base font-mono font-semibold mt-0.5" style={{ color: "#f3f4f6" }}>
                  {k.val != null ? fmtNum(k.val, !!isKR) : "—"}
                </div>
                <div className="text-[11px] font-mono mt-0.5" style={{ color: kpiColor(change) }}>
                  {change != null ? `${kpiArrow(change)} ${change > 0 ? "+" : ""}${change.toFixed(1)}%` : "—"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Row 2: Margins + ROE */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ovMargins.map((k) => {
            const diff = chgPp(k.val, k.prev);
            return (
              <div key={k.label} className="rounded p-3" style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-[10px] uppercase tracking-widest" style={{ color: "#6b7280" }}>{k.label}</div>
                <div className="text-base font-mono font-semibold mt-0.5" style={{ color: k.val != null && k.val < 0 ? "#f87171" : "#f3f4f6" }}>
                  {k.val != null ? `${k.val.toFixed(1)}%` : "—"}
                </div>
                <div className="text-[11px] font-mono mt-0.5" style={{ color: kpiColor(diff) }}>
                  {diff != null ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}pp` : "—"}
                </div>
              </div>
            );
          })}
        </div>

        {/* Balance Sheet Health */}
        <div>
          <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "rgba(251,191,36,0.6)" }}>Balance Sheet Health</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {healthBadge("Debt / Equity", latest?.debtToEquity != null ? latest.debtToEquity / 100 : null, [0, 0.8], [0.8, 1.5])}
            {healthBadge("Current Ratio", latest?.currentRatio, [1.5, 999], [1, 1.5])}
            {healthBadge("Interest Coverage", keyMetrics.length > 0 ? keyMetrics[keyMetrics.length - 1]?.interestCoverage : null, [5, 9999], [2, 5])}
            {healthBadge("Net Debt / EBITDA", keyMetrics.length > 0 ? keyMetrics[keyMetrics.length - 1]?.netDebtToEbitda : null, [-999, 2], [2, 4])}
          </div>
        </div>
      </div>
    );
  }

  // ── Key Metrics sparkline table ──────────────────────────

  function renderKeyMetricsTab() {
    if (keyMetrics.length === 0) return <div className="py-8 text-center text-[11px]" style={{ color: "#555" }}>No key metrics data available</div>;
    return (
      <div className="space-y-4">
        {renderTable(KM_ROWS, keyMetrics)}
        {/* Sparklines */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "ROE", key: "roe", color: "#4ade80" },
            { label: "ROIC", key: "roic", color: "#60a5fa" },
            { label: "ROA", key: "roa", color: "#c084fc" },
            { label: "FCF Yield", key: "fcfYield", color: "#fbbf24" },
            { label: "Earnings Yield", key: "eps", color: "#f87171" },
          ].map((s) => (
            <div key={s.key} className="rounded p-2.5" style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: "#6b7280" }}>{s.label}</div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono" style={{ color: "#f3f4f6" }}>
                  {keyMetrics.length > 0 ? fmtPct(keyMetrics[keyMetrics.length - 1]?.[s.key]) : "—"}
                </span>
                <Sparkline data={keyMetrics} dataKey={s.key} color={s.color} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Valuation tab with chart ─────────────────────────────

  function renderValuationTab() {
    if (valuation.length === 0) return <div className="py-8 text-center text-[11px]" style={{ color: "#555" }}>No valuation data available</div>;
    const valLines = [
      { key: "pe", label: "P/E", color: "#fbbf24" },
      { key: "pb", label: "P/B", color: "#4ade80" },
      { key: "evEbitda", label: "EV/EBITDA", color: "#60a5fa" },
      { key: "ps", label: "P/S", color: "#c084fc" },
      { key: "evRevenue", label: "EV/Rev", color: "#f87171" },
    ];
    return (
      <div className="space-y-4">
        {renderTable(VAL_ROWS, valuation)}
        {/* Multi-line chart */}
        <div className="rounded p-3" style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex flex-wrap gap-3 mb-2">
            {valLines.map((l) => (
              <span key={l.key} className="text-[9px] font-mono flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: l.color }} />
                <span style={{ color: "#9ca3af" }}>{l.label}</span>
              </span>
            ))}
          </div>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={valuation}>
                <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, fontSize: 10, fontFamily: "monospace" }}
                  labelStyle={{ color: "#9ca3af" }}
                />
                {valLines.map((l) => (
                  <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={1.5} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="financials" />

      <main className="mx-auto max-w-[1400px] px-4 py-4 space-y-4">
        <h1 className="text-sm font-bold" style={{ color: "#e8e8e8" }}>{t.finFinancials}</h1>

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
              {lang === "kr" ? "한국 주식: 영문명 또는 종목코드 입력 (예: 005930.KS, 000660.KS)" : "Korean stocks: enter English name or code (e.g. 005930.KS, 000660.KS)"}
            </p>
            {showDropdown && (
              <div className="absolute z-50 mt-1 w-full overflow-hidden rounded" style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)" }}>
                {searchLoading ? (
                  <div className="px-3 py-3 text-[11px] animate-pulse" style={{ color: "#6b7280" }}>{lang === "kr" ? "검색중..." : "Searching..."}</div>
                ) : searchResults.length === 0 ? (
                  <div className="px-3 py-3 text-[11px]" style={{ color: "#4b5563" }}>{lang === "kr" ? "결과 없음" : "No results found"}</div>
                ) : (
                  searchResults.map((r) => (
                    <button key={`${r.market}-${r.ticker}`} onClick={() => selectResult(r)} className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-white/5">
                      <div>
                        <span className="text-sm" style={{ color: "#e8e8e8" }}>{r.name}</span>
                        <span className="ml-2 text-[10px]" style={{ color: "#6b7280" }}>{r.exchange}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px]" style={{ color: "#fbbf24" }}>{r.ticker}</span>
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{
                          background: r.market === "KR" ? "rgba(96,165,250,0.12)" : "rgba(251,191,36,0.12)",
                          color: r.market === "KR" ? "#60a5fa" : "#fbbf24",
                        }}>{r.market}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex rounded overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            {(["annual", "quarterly"] as PeriodKey[]).map((pd) => (
              <button key={pd} onClick={() => handlePeriodChange(pd)} className="px-3 py-1.5 text-[10px] font-bold font-mono uppercase tracking-wider transition-colors" style={{
                color: period === pd ? "#fbbf24" : "#6b7280",
                background: period === pd ? "rgba(251,191,36,0.08)" : "transparent",
              }}>
                {pd === "annual" ? "Annual" : "Quarterly"}
              </button>
            ))}
          </div>
        </div>

        {finLoading && <div className="py-12 text-center text-[11px] animate-pulse" style={{ color: "#555" }}>{t.finLoading}</div>}
        {finError && <div className="py-8 text-center text-[11px]" style={{ color: "#f87171" }}>{finError}</div>}

        {finData && !finLoading && (
          <>
            {/* Header */}
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <span className="text-lg font-bold font-mono" style={{ color: "#e8e8e8" }}>{finData.ticker}</span>
                <span className="ml-2 rounded px-1.5 py-0.5 text-[9px] font-bold" style={{
                  background: isKR ? "rgba(96,165,250,0.12)" : "rgba(251,191,36,0.12)",
                  color: isKR ? "#60a5fa" : "#fbbf24",
                }}>{finData.market}</span>
              </div>
              {finData.price != null && (
                <div className="text-sm font-mono" style={{ color: "#9ca3af" }}>{isKR ? "₩" : "$"}{fmtPrice(finData.price)}</div>
              )}
              {finData.marketCap != null && (
                <div className="text-[11px] font-mono" style={{ color: "#6b7280" }}>
                  {lang === "kr" ? "시가총액" : "Mkt Cap"}: {fmtMarketCap(finData.marketCap)} {unit}
                </div>
              )}
            </div>

            {/* Price Target */}
            {finData.priceTarget && finData.price != null && (() => {
              const pt = finData.priceTarget;
              const price = finData.price!;
              const consensus = pt.consensus;
              const high = pt.high;
              const low = pt.low;
              const median = pt.median;
              if (consensus == null || high == null || low == null) return null;
              const upside = Math.round(((consensus - price) / price) * 1000) / 10;
              const range = high - low;
              const pricePct = range > 0 ? Math.max(0, Math.min(100, ((price - low) / range) * 100)) : 50;
              return (
                <div className="flex flex-wrap gap-6 items-center rounded p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="shrink-0">
                    <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#6b7280" }}>Wall St. Consensus</div>
                    <div className="text-base font-mono font-medium" style={{ color: "#e8e8e8" }}>${consensus.toFixed(2)}</div>
                    <div className="text-xs font-mono" style={{ color: upside >= 0 ? "#4ade80" : "#f87171" }}>{upside >= 0 ? "+" : ""}{upside.toFixed(1)}%</div>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative h-6 flex items-center">
                      <div className="absolute inset-x-0 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
                      <div className="absolute h-1.5 rounded-full" style={{ left: 0, width: `${pricePct}%`, background: "rgba(251,191,36,0.2)" }} />
                      <div className="absolute w-0.5 h-4 rounded-full" style={{ left: `${pricePct}%`, background: "#f59e0b", transform: "translateX(-50%)" }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] font-mono" style={{ color: "#6b7280" }}>${low.toFixed(0)}</span>
                      <span className="text-[9px] font-mono" style={{ color: "#f59e0b" }}>Current ${price.toFixed(2)}</span>
                      <span className="text-[9px] font-mono" style={{ color: "#6b7280" }}>${high.toFixed(0)}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right space-y-0.5">
                    <div className="text-xs font-mono" style={{ color: "#9ca3af" }}>High: <span style={{ color: "#e8e8e8" }}>${high.toFixed(0)}</span></div>
                    {median != null && <div className="text-xs font-mono" style={{ color: "#9ca3af" }}>Median: <span style={{ color: "#e8e8e8" }}>${median.toFixed(0)}</span></div>}
                    <div className="text-xs font-mono" style={{ color: "#9ca3af" }}>Low: <span style={{ color: "#e8e8e8" }}>${low.toFixed(0)}</span></div>
                    <div className="text-[9px] mt-1" style={{ color: "#4b5563" }}>Source: Wall Street Analyst Consensus</div>
                  </div>
                </div>
              );
            })()}

            {/* Tab bar */}
            <div className="flex gap-0 overflow-x-auto" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {ALL_TABS.map((tb) => (
                <button
                  key={tb.key}
                  onClick={() => setActiveTab(tb.key)}
                  className="px-3 py-1.5 text-[10px] font-bold font-mono tracking-wider transition-colors whitespace-nowrap"
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

            {/* Tab content */}
            {activeTab === "overview" && renderOverview()}

            {activeTab === "pl" && quarterly.length > 0 && (() => {
              const latest = quarterly[quarterly.length - 1];
              const prev = quarterly.length >= 2 ? quarterly[quarterly.length - 2] : null;
              const revYoY = latest?.revenueGrowth as number | null;
              const oiCur = latest?.operatingIncome as number | null;
              const oiPrev = prev?.operatingIncome as number | null;
              const oiYoY = oiCur != null && oiPrev != null && oiPrev !== 0
                ? Math.round(((oiCur - oiPrev) / Math.abs(oiPrev)) * 10000) / 100 : null;
              const opm = latest?.operatingMargin as number | null;
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

            {(activeTab === "pl" || activeTab === "bs" || activeTab === "cf") && renderTable(currentRows, currentData, activeTab !== "bs" || true)}

            {activeTab === "keyMetrics" && renderKeyMetricsTab()}
            {activeTab === "valuation" && renderValuationTab()}

            {/* C/F Capex Bar Chart */}
            {activeTab === "cf" && quarterly.length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] mb-2" style={{ color: "#6b7280" }}>Capital Expenditure</div>
                <div style={{ width: "100%", height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={quarterly.map((q) => ({ label: q.label, capex: q.capex != null ? Math.abs(q.capex as number) : null }))} barCategoryGap="20%">
                      <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                      <Bar dataKey="capex" radius={[2, 2, 0, 0]} fill="#f59e0b">
                        <LabelList dataKey="capex" position="top" style={{ fill: "#9ca3af", fontSize: 9, fontFamily: "monospace" }}
                          formatter={(v: unknown) => { const n = v as number | null; return n != null ? (isKR ? Math.round(n / 1e8).toLocaleString() : n.toLocaleString()) : ""; }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}

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
