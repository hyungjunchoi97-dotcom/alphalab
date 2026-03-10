"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLang } from "@/lib/LangContext";
import { messages } from "@/lib/i18n";
import AppHeader from "@/components/AppHeader";
import {
  BarChart, Bar, XAxis, LabelList, ResponsiveContainer,
  LineChart, Line, Tooltip, CartesianGrid,
  AreaChart, Area,
  PieChart, Pie, Cell,
} from "recharts";
import { sankey, sankeyLinkHorizontal, SankeyNode, SankeyLink } from "d3-sankey";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface QuarterData { [key: string]: any }

interface PriceTarget {
  consensus: number | null;
  high: number | null;
  low: number | null;
  median: number | null;
}

interface ProfileInfo {
  sector: string | null;
  industry: string | null;
  description: string | null;
  ceo: string | null;
  employees: number | null;
  country: string | null;
  ipoDate: string | null;
  beta: number | null;
}

interface NextEarnings {
  date: string | null;
  epsEstimate: number | null;
}

interface InstitutionalHolder {
  holder: string | null;
  shares: number | null;
  pct: number | null;
  value: number | null;
  change: number | null;
}

interface InsiderTrade {
  date: string | null;
  name: string | null;
  title: string | null;
  type: string | null;
  shares: number | null;
  value: number | null;
}

interface GradesSummary {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

interface RecentGrade {
  date: string | null;
  firm: string | null;
  fromGrade: string | null;
  toGrade: string | null;
  action: string | null;
}

interface EarningsSurprise {
  date: string | null;
  actual: number | null;
  estimated: number | null;
}

interface PricePoint {
  date: string | null;
  close: number | null;
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
  profile?: ProfileInfo | null;
  nextEarnings?: NextEarnings | null;
  insider?: InsiderTrade[];
  institutional?: InstitutionalHolder[];
  gradesSummary?: GradesSummary | null;
  recentGrades?: RecentGrade[];
  earningsSurprises?: EarningsSurprise[];
  priceHistory?: PricePoint[];
}

interface TickerResult {
  ticker: string;
  name: string;
  nameEn: string;
  market: "KR" | "US";
  exchange: string;
}

type TabKey = "overview" | "pl" | "bs" | "cf" | "keyMetrics" | "valuation" | "ownership" | "breakdown";
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
  group?: string; // accordion group key (parent bold row key)
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

// ── i18n labels ─────────────────────────────────────────────
const FIN_I18N = {
  en: {
    // tabs
    overview: "OVERVIEW", pl: "P&L", bs: "B/S", cf: "C/F",
    keyMetrics: "KEY METRICS", valuation: "VALUATION", ownership: "OWNERSHIP", breakdown: "BREAKDOWN",
    // sections
    bsHealth: "Balance Sheet Health", analystRatings: "Analyst Ratings",
    currentPrice: "Current Price", wallStTarget: "Wall St. Target", upside: "Upside",
    nextEarnings: "NEXT EARNINGS",
    // overview KPI
    revenueYoY: "Revenue YoY", opIncomeYoY: "Op. Income YoY", netIncomeYoY: "Net Income YoY", fcfYoY: "FCF YoY",
    grossMargin: "Gross Margin", operatingMargin: "Operating Margin", netMargin: "Net Margin",
    // health badges
    debtEquity: "Debt / Equity", currentRatio: "Current Ratio",
    interestCoverage: "Interest Coverage", netDebtEbitda: "Net Debt / EBITDA",
    // P&L rows
    revenue: "Revenue", costOfRevenue: "Cost of Revenue", grossProfit: "Gross Profit",
    grossMarginRow: "Gross Margin", rdExpense: "R&D Expense", sga: "SG&A",
    operatingIncome: "Operating Income", opm: "OPM", interestExpense: "Interest Expense",
    incomeTax: "Income Tax", netIncome: "Net Income", npm: "NPM",
    ebitda: "EBITDA", epsDiluted: "EPS (Diluted)",
    // B/S headers & rows
    assets: "ASSETS", totalCurrentAssets: "Total Current Assets", cashEquiv: "Cash & Equivalents",
    shortTermInv: "Short-term Investments", accountsReceivable: "Accounts Receivable",
    inventory: "Inventory", otherCurrentAssets: "Other Current Assets",
    totalNonCurrentAssets: "Total Non-Current Assets", ppeNet: "PP&E Net",
    longTermInv: "Long-term Investments", goodwill: "Goodwill", otherNonCurrent: "Other Non-Current",
    totalAssets: "Total Assets",
    liabilities: "LIABILITIES", totalCurrentLiab: "Total Current Liabilities",
    accountsPayable: "Accounts Payable", shortTermDebt: "Short-term Debt",
    deferredRevenue: "Deferred Revenue", otherCurrentLiab: "Other Current Liabilities",
    totalNonCurrentLiab: "Total Non-Current Liabilities", longTermDebt: "Long-term Debt",
    otherNonCurrentLiab: "Other Non-Current Liabilities", totalLiabilities: "Total Liabilities",
    equity: "EQUITY", commonStock: "Common Stock", retainedEarnings: "Retained Earnings",
    totalEquity: "Total Equity",
    bsKeyMetrics: "KEY METRICS", netDebt: "Net Debt", debtToEquity: "Debt/Equity",
    currentRatioRow: "Current Ratio", totalInvestments: "Total Investments",
    // C/F rows
    operatingCF: "Operating Cash Flow", sbc: "Stock-Based Comp",
    chgWorkingCapital: "Chg in Working Capital", capex: "Capital Expenditure",
    fcf: "Free Cash Flow", investingCF: "Investing CF", financingCF: "Financing CF",
    dividendsPaid: "Dividends Paid",
    // misc
    expandAll: "EXPAND ALL", collapseAll: "COLLAPSE ALL",
    mktCap: "Mkt Cap", employees: "Employees",
    instOwnership: "Institutional Ownership", insiderTrading: "Insider Trading",
    earningsSurprise: "Earnings Surprise",
    revenueQoQ: "Revenue", opIncomeQoQ: "Op. Income", opmLatest: "OPM (Latest)",
    comingSoonKR: "Coming soon for Korean stocks",
    capexLabel: "Capital Expenditure",
    noData: "No data",
    // valuation rows
    valPe: "P/E", valPb: "P/B", valEvEbitda: "EV/EBITDA", valPs: "P/S",
    valEvRevenue: "EV/Revenue", valPeg: "PEG", valPocf: "P/OCF", valPfcf: "P/FCF",
    valDivYield: "Dividend Yield",
    priceChart: "PRICE CHART",
    searchPlaceholder: "Company name or ticker (e.g. Samsung, AAPL, 005930.KS)",
    searchHint: "Korean stocks: enter English name or code (e.g. 005930.KS, 000660.KS)",
    searchEmpty: "Search a ticker to view financial statements",
  },
  kr: {
    overview: "개요", pl: "손익", bs: "재무상태", cf: "현금흐름",
    keyMetrics: "핵심지표", valuation: "밸류에이션", ownership: "소유구조", breakdown: "브레이크다운",
    bsHealth: "재무건전성", analystRatings: "애널리스트 평가",
    currentPrice: "현재가", wallStTarget: "목표주가", upside: "상승여력",
    nextEarnings: "다음 실적발표",
    revenueYoY: "매출 YoY", opIncomeYoY: "영업이익 YoY", netIncomeYoY: "순이익 YoY", fcfYoY: "FCF YoY",
    grossMargin: "매출총이익률", operatingMargin: "영업이익률", netMargin: "순이익률",
    debtEquity: "부채비율", currentRatio: "유동비율",
    interestCoverage: "이자보상배율", netDebtEbitda: "순부채/EBITDA",
    revenue: "매출액", costOfRevenue: "매출원가", grossProfit: "매출총이익",
    grossMarginRow: "매출총이익률", rdExpense: "연구개발비", sga: "판관비",
    operatingIncome: "영업이익", opm: "영업이익률", interestExpense: "이자비용",
    incomeTax: "법인세", netIncome: "당기순이익", npm: "순이익률",
    ebitda: "EBITDA", epsDiluted: "EPS (희석)",
    assets: "자산", totalCurrentAssets: "유동자산 합계", cashEquiv: "현금 및 현금성자산",
    shortTermInv: "단기투자자산", accountsReceivable: "매출채권",
    inventory: "재고자산", otherCurrentAssets: "기타유동자산",
    totalNonCurrentAssets: "비유동자산 합계", ppeNet: "유형자산(순)",
    longTermInv: "장기투자자산", goodwill: "영업권", otherNonCurrent: "기타비유동자산",
    totalAssets: "자산 총계",
    liabilities: "부채", totalCurrentLiab: "유동부채 합계",
    accountsPayable: "매입채무", shortTermDebt: "단기차입금",
    deferredRevenue: "선수수익", otherCurrentLiab: "기타유동부채",
    totalNonCurrentLiab: "비유동부채 합계", longTermDebt: "장기차입금",
    otherNonCurrentLiab: "기타비유동부채", totalLiabilities: "부채 총계",
    equity: "자본", commonStock: "보통주", retainedEarnings: "이익잉여금",
    totalEquity: "자본 총계",
    bsKeyMetrics: "핵심지표", netDebt: "순부채", debtToEquity: "부채비율",
    currentRatioRow: "유동비율", totalInvestments: "총 투자자산",
    operatingCF: "영업현금흐름", sbc: "주식보상비용",
    chgWorkingCapital: "운전자본 변동", capex: "자본적지출",
    fcf: "잉여현금흐름", investingCF: "투자현금흐름", financingCF: "재무현금흐름",
    dividendsPaid: "배당금 지급",
    expandAll: "전체 펼치기", collapseAll: "전체 접기",
    mktCap: "시가총액", employees: "직원수",
    instOwnership: "기관 보유현황", insiderTrading: "내부자 거래",
    earningsSurprise: "어닝 서프라이즈",
    revenueQoQ: "매출", opIncomeQoQ: "영업이익", opmLatest: "영업이익률 (최근)",
    comingSoonKR: "한국 종목은 준비 중입니다",
    capexLabel: "자본적지출",
    noData: "데이터 없음",
    valPe: "P/E", valPb: "P/B", valEvEbitda: "EV/EBITDA", valPs: "P/S",
    valEvRevenue: "EV/매출", valPeg: "PEG", valPocf: "P/OCF", valPfcf: "P/FCF",
    valDivYield: "배당수익률",
    priceChart: "주가 차트",
    searchPlaceholder: "회사명(영문) 또는 종목코드 (예: Samsung, AAPL, 005930.KS)",
    searchHint: "한국 주식: 영문명 또는 종목코드 입력 (예: 005930.KS, 000660.KS)",
    searchEmpty: "종목을 검색하여 재무제표를 확인하세요",
  },
} as const;

export default function FinancialsPage() {
  const { lang } = useLang();
  const t = messages[lang as "en" | "kr"] || messages.en;
  const isKO = lang === "kr";
  const f = FIN_I18N[isKO ? "kr" : "en"];

  const [query, setQuery] = useState("");
  const [finData, setFinData] = useState<FinResponse | null>(null);
  const [finLoading, setFinLoading] = useState(false);
  const [finError, setFinError] = useState("");
  const [loadingMarket, setLoadingMarket] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [period, setPeriod] = useState<PeriodKey>("quarterly");
  const [breakdownIdx, setBreakdownIdx] = useState(-1); // -1 = latest
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [priceRange, setPriceRange] = useState<"1M" | "3M" | "6M" | "1Y">("1Y");

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
    setLoadingMarket(mk);
    try {
      const url = mk === "KR"
        ? `/api/financials/kr?symbol=${encodeURIComponent(tk.trim())}&period=${pd}`
        : `/api/financials?ticker=${encodeURIComponent(tk.trim())}&market=${mk}&period=${pd}`;
      const res = await fetch(url);
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
    { label: f.revenue, key: "revenue", isBold: true },
    { label: growthLabel, key: "revenueGrowth", isMargin: true, indent: true, group: "revenue" },
    { label: f.costOfRevenue, key: "costOfRevenue", indent: true, group: "revenue" },
    { label: f.grossProfit, key: "grossProfit", isBold: true },
    { label: f.grossMarginRow, key: "grossMargin", isMargin: true, indent: true, group: "grossProfit" },
    { label: f.rdExpense, key: "rdExpense", indent: true, group: "grossProfit" },
    { label: f.sga, key: "sgaExpense", indent: true, group: "grossProfit" },
    { label: f.operatingIncome, key: "operatingIncome", isBold: true },
    { label: f.opm, key: "operatingMargin", isMargin: true, indent: true, group: "operatingIncome" },
    { label: f.interestExpense, key: "interestExpense", indent: true, group: "operatingIncome" },
    { label: f.incomeTax, key: "incomeTaxExpense", indent: true, group: "operatingIncome" },
    { label: f.netIncome, key: "netIncome", isBold: true },
    { label: f.npm, key: "netMargin", isMargin: true, indent: true, group: "netIncome" },
    { label: f.ebitda, key: "ebitda", isBold: true },
    { label: f.epsDiluted, key: "eps", isBold: true },
  ];

  // P&L accordion: which bold keys have children
  const PL_GROUPS = new Set(PL_ROWS.filter(r => r.group).map(r => r.group!));

  const toggleExpanded = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleAllExpanded = () => {
    if (expanded.size >= PL_GROUPS.size) {
      setExpanded(new Set());
    } else {
      setExpanded(new Set(PL_GROUPS));
    }
  };

  const BS_ROWS: RowDef[] = [
    { label: f.assets, key: "_assets_header", isSectionHeader: true },
    { label: f.totalCurrentAssets, key: "totalCurrentAssets", isBold: true },
    { label: f.cashEquiv, key: "cash", indent: true },
    { label: f.shortTermInv, key: "shortTermInvestments", indent: true },
    { label: f.accountsReceivable, key: "accountsReceivable", indent: true },
    { label: f.inventory, key: "inventory", indent: true },
    { label: f.otherCurrentAssets, key: "otherCurrentAssets", indent: true },
    { label: f.totalNonCurrentAssets, key: "totalNonCurrentAssets", isBold: true },
    { label: f.ppeNet, key: "ppeNet", indent: true },
    { label: f.longTermInv, key: "longTermInvestments", indent: true },
    { label: f.goodwill, key: "goodwill", indent: true },
    { label: f.otherNonCurrent, key: "otherNonCurrent", indent: true },
    { label: f.totalAssets, key: "totalAssets", isBold: true, isTotal: true },
    { label: f.liabilities, key: "_liab_header", isSectionHeader: true },
    { label: f.totalCurrentLiab, key: "totalCurrentLiabilities", isBold: true },
    { label: f.accountsPayable, key: "accountPayables", indent: true },
    { label: f.shortTermDebt, key: "shortTermDebt", indent: true },
    { label: f.deferredRevenue, key: "deferredRevenue", indent: true },
    { label: f.otherCurrentLiab, key: "otherCurrentLiabilities", indent: true },
    { label: f.totalNonCurrentLiab, key: "totalNonCurrentLiabilities", isBold: true },
    { label: f.longTermDebt, key: "longTermDebt", indent: true },
    { label: f.otherNonCurrentLiab, key: "otherNonCurrentLiabilities", indent: true },
    { label: f.totalLiabilities, key: "totalLiabilities", isBold: true, isTotal: true },
    { label: f.equity, key: "_equity_header", isSectionHeader: true },
    { label: f.commonStock, key: "commonStock", indent: true },
    { label: f.retainedEarnings, key: "retainedEarnings", indent: true },
    { label: f.totalEquity, key: "totalEquity", isBold: true, isTotal: true },
    { label: f.bsKeyMetrics, key: "_metrics_header", isSectionHeader: true },
    { label: f.netDebt, key: "netDebt" },
    { label: f.debtToEquity, key: "debtToEquity", isRatio: true },
    { label: f.currentRatioRow, key: "currentRatio", isRatio: true },
    { label: f.totalInvestments, key: "totalInvestments" },
  ];

  const CF_ROWS: RowDef[] = [
    { label: f.operatingCF, key: "operatingCF", isBold: true },
    { label: f.sbc, key: "sbc", indent: true },
    { label: f.chgWorkingCapital, key: "changeInWorkingCapital", indent: true },
    { label: f.capex, key: "capex", isRed: true },
    { label: f.fcf, key: "fcf", isBold: true },
    { label: f.investingCF, key: "investingCF" },
    { label: f.financingCF, key: "financingCF" },
    { label: f.dividendsPaid, key: "dividendsPaid" },
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
    { label: f.valPe, key: "pe", isRatio: true },
    { label: f.valPb, key: "pb", isRatio: true },
    { label: f.valEvEbitda, key: "evEbitda", isRatio: true },
    { label: f.valPs, key: "ps", isRatio: true },
    { label: f.valEvRevenue, key: "evRevenue", isRatio: true },
    { label: f.valPeg, key: "peg", isRatio: true },
    { label: f.valPocf, key: "pOcf", isRatio: true },
    { label: f.valPfcf, key: "pFcf", isRatio: true },
    { label: f.valDivYield, key: "dividendYield", isMargin: true },
  ];

  const TABLE_TABS: { key: TabKey; label: string; rows: RowDef[]; data?: QuarterData[] }[] = [
    { key: "pl", label: f.pl, rows: PL_ROWS },
    { key: "bs", label: f.bs, rows: BS_ROWS },
    { key: "cf", label: f.cf, rows: CF_ROWS },
    { key: "keyMetrics", label: f.keyMetrics, rows: KM_ROWS, data: keyMetrics },
    { key: "valuation", label: f.valuation, rows: VAL_ROWS, data: valuation },
  ];

  const ALL_TABS: { key: TabKey; label: string }[] = [
    { key: "overview", label: f.overview },
    ...TABLE_TABS,
    { key: "ownership", label: f.ownership },
    { key: "breakdown", label: f.breakdown },
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

  function renderTable(rows: RowDef[], data: QuarterData[], showUnit?: boolean, isPL?: boolean) {
    if (data.length === 0) return <div className="py-8 text-center text-[11px]" style={{ color: "#555" }}>{t.finNoData}</div>;
    return (
      <div className="fin-table overflow-x-auto rounded-lg" style={{ border: "1px solid #222", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
        <table className="w-full font-mono text-xs" style={{ background: "#080c12" }}>
          <thead>
            <tr style={{ background: "#0d1117", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
              <th
                className="sticky left-0 z-10 py-2 pl-3 pr-4 text-left text-[10px] font-medium uppercase tracking-wider"
                style={{ background: "#0d1117", color: "#6b7280", width: "192px", minWidth: "192px" }}
              >
                <div className="flex items-center justify-between">
                  {showUnit && <span className="text-xs font-mono" style={{ color: "rgba(251,191,36,0.7)" }}>{unit}</span>}
                  {isPL && (
                    <button onClick={toggleAllExpanded} className="text-[10px] font-mono cursor-pointer ml-auto" style={{ color: "#6b7280" }}>
                      {expanded.size >= PL_GROUPS.size ? f.collapseAll : f.expandAll}
                    </button>
                  )}
                </div>
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
              // P&L accordion: hide child rows when parent is collapsed
              if (isPL && row.group && !expanded.has(row.group)) return null;

              const isAccordionParent = isPL && row.isBold && PL_GROUPS.has(row.key);

              return (
                <tr key={row.key} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: row.isTotal ? "2px solid rgba(255,255,255,0.1)" : "1px solid rgba(255,255,255,0.04)" }}>
                  <td
                    className={`sticky left-0 z-10 py-1.5 pl-3 pr-4 text-left whitespace-nowrap${isAccordionParent ? " cursor-pointer select-none" : ""}`}
                    style={{
                      background: "#0d1117",
                      color: row.isTotal ? "#ffffff" : row.isBold ? "#e8e8e8" : "#9ca3af",
                      fontWeight: row.isBold || row.isTotal ? 600 : 400,
                      paddingLeft: row.indent ? "28px" : "12px",
                      fontSize: row.isMargin || row.isRatio ? "11px" : "12px",
                    }}
                    onClick={isAccordionParent ? () => toggleExpanded(row.key) : undefined}
                  >
                    {isAccordionParent && (
                      <span className="inline-block w-3 text-[8px]" style={{ color: "#4b5563" }}>
                        {expanded.has(row.key) ? "▼" : "▶"}
                      </span>
                    )}
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

    // Use up to last 5 periods for sparkline area charts
    const sparkData = quarterly.slice(-5);

    const yoy = (cur: number | null, prv: number | null) =>
      cur != null && prv != null && prv !== 0 ? Math.round(((cur - prv) / Math.abs(prv)) * 1000) / 10 : null;

    // Build YoY % series for sparkline
    const yoySeries = (key: string) => quarterly.slice(-5).map((q, i, arr) => {
      const prevQ = i > 0 ? arr[i - 1] : quarterly[quarterly.length - 5 - 1] ?? null;
      return { label: q.label, yoy: prevQ ? yoy(q[key], prevQ[key]) : null };
    });

    const ovKpis: { label: string; key: string; val: number | null; prev: number | null; yoyVal: number | null; yoyData: { label: string; yoy: number | null }[] }[] = [
      { label: f.revenueYoY, key: "revenue", val: latest?.revenue, prev: prev?.revenue, yoyVal: yoy(latest?.revenue, prev?.revenue), yoyData: yoySeries("revenue") },
      { label: f.opIncomeYoY, key: "operatingIncome", val: latest?.operatingIncome, prev: prev?.operatingIncome, yoyVal: yoy(latest?.operatingIncome, prev?.operatingIncome), yoyData: yoySeries("operatingIncome") },
      { label: f.netIncomeYoY, key: "netIncome", val: latest?.netIncome, prev: prev?.netIncome, yoyVal: yoy(latest?.netIncome, prev?.netIncome), yoyData: yoySeries("netIncome") },
      { label: f.fcfYoY, key: "fcf", val: latest?.fcf, prev: prev?.fcf, yoyVal: yoy(latest?.fcf, prev?.fcf), yoyData: yoySeries("fcf") },
    ];
    const ovMargins: { label: string; key: string; val: number | null; prev: number | null; source?: QuarterData[] }[] = [
      { label: f.grossMargin, key: "grossMargin", val: latest?.grossMargin, prev: prev?.grossMargin },
      { label: f.operatingMargin, key: "operatingMargin", val: latest?.operatingMargin, prev: prev?.operatingMargin },
      { label: f.netMargin, key: "netMargin", val: latest?.netMargin, prev: prev?.netMargin },
      { label: "ROE", key: "roe", val: keyMetrics.length > 0 ? keyMetrics[keyMetrics.length - 1]?.roe : null, prev: keyMetrics.length > 1 ? keyMetrics[keyMetrics.length - 2]?.roe : null, source: keyMetrics.slice(-5) },
    ];

    return (
      <div className="space-y-4">
        {/* Company Profile */}
        {finData?.profile && (
          <div className="rounded p-5" style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-start justify-between gap-8">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  {finData.profile.sector && <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "#6b7280" }}>{finData.profile.sector}</span>}
                  {finData.profile.sector && finData.profile.industry && <span style={{ color: "#374151" }}>·</span>}
                  {finData.profile.industry && <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "#6b7280" }}>{finData.profile.industry}</span>}
                </div>
                {finData.profile.description && (
                  <p className="text-sm leading-relaxed line-clamp-3" style={{ color: "#9ca3af" }}>{finData.profile.description}</p>
                )}
              </div>
              <div className="text-right text-xs font-mono shrink-0 space-y-1" style={{ color: "#6b7280" }}>
                {finData.profile.ceo && <div>CEO <span style={{ color: "#d1d5db" }}>{finData.profile.ceo}</span></div>}
                {finData.profile.employees != null && <div>{f.employees} <span style={{ color: "#d1d5db" }}>{finData.profile.employees.toLocaleString()}</span></div>}
                {finData.profile.country && <div>HQ <span style={{ color: "#d1d5db" }}>{finData.profile.country}</span></div>}
                {finData.profile.ipoDate && <div>IPO <span style={{ color: "#d1d5db" }}>{finData.profile.ipoDate}</span></div>}
                {finData.profile.beta != null && <div>β <span style={{ color: "#d1d5db" }}>{finData.profile.beta.toFixed(2)}</span></div>}
              </div>
            </div>
            {finData.nextEarnings && (
              <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "#fbbf24" }}>{f.nextEarnings}</span>
                <span className="text-xs font-mono" style={{ color: "#d1d5db" }}>{finData.nextEarnings.date}</span>
                {finData.nextEarnings.epsEstimate != null && (
                  <span className="text-xs font-mono" style={{ color: "#6b7280" }}>EPS est. ${finData.nextEarnings.epsEstimate.toFixed(2)}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Analyst Ratings */}
        {!isKR && finData?.gradesSummary && (() => {
          const gs = finData.gradesSummary!;
          const total = gs.strongBuy + gs.buy + gs.hold + gs.sell + gs.strongSell;
          if (total === 0) return null;
          const pieData = [
            { name: "Strong Buy", value: gs.strongBuy, color: "#10b981" },
            { name: "Buy", value: gs.buy, color: "#34d399" },
            { name: "Hold", value: gs.hold, color: "#f59e0b" },
            { name: "Sell", value: gs.sell, color: "#f87171" },
            { name: "Strong Sell", value: gs.strongSell, color: "#ef4444" },
          ].filter(d => d.value > 0);
          const recentGrades = (finData.recentGrades || []).slice(0, 3);
          return (
            <div className="rounded p-5 mb-2" style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="text-[10px] uppercase tracking-widest mb-3" style={{ color: "rgba(251,191,36,0.6)" }}>{f.analystRatings}</div>
              <div className="flex items-start gap-8">
                {/* Donut */}
                <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={55} strokeWidth={0}>
                        {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-lg font-mono font-semibold" style={{ color: "#f3f4f6" }}>{total}</div>
                      <div className="text-[8px] uppercase tracking-widest" style={{ color: "#6b7280" }}>Analysts</div>
                    </div>
                  </div>
                </div>
                {/* Distribution + Recent */}
                <div className="flex-1 min-w-0">
                  <div className="space-y-1.5 mb-3">
                    {[
                      { label: "Strong Buy", val: gs.strongBuy, color: "#10b981" },
                      { label: "Buy", val: gs.buy, color: "#34d399" },
                      { label: "Hold", val: gs.hold, color: "#f59e0b" },
                      { label: "Sell", val: gs.sell, color: "#f87171" },
                      { label: "Strong Sell", val: gs.strongSell, color: "#ef4444" },
                    ].map(r => (
                      <div key={r.label} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono w-20 shrink-0" style={{ color: "#9ca3af" }}>{r.label}</span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                          <div className="h-full rounded-full" style={{ width: `${total > 0 ? (r.val / total) * 100 : 0}%`, background: r.color }} />
                        </div>
                        <span className="text-[10px] font-mono w-6 text-right" style={{ color: "#6b7280" }}>{r.val}</span>
                      </div>
                    ))}
                  </div>
                  {recentGrades.length > 0 && (
                    <div className="space-y-1">
                      {recentGrades.map((g, i) => {
                        const isUp = g.action?.toLowerCase().includes("upgrade");
                        const isDown = g.action?.toLowerCase().includes("downgrade");
                        return (
                          <div key={i} className="text-[10px] font-mono flex items-center gap-1.5 flex-wrap" style={{ color: "#6b7280" }}>
                            <span>{g.date}</span>
                            <span style={{ color: "#9ca3af" }}>·</span>
                            <span style={{ color: "#d1d5db" }}>{g.firm}</span>
                            {g.fromGrade && g.toGrade && (
                              <>
                                <span style={{ color: "#9ca3af" }}>·</span>
                                <span>{g.fromGrade} → {g.toGrade}</span>
                              </>
                            )}
                            {g.action && (
                              <span className="rounded px-1 py-0.5 text-[8px] font-bold" style={{
                                background: isUp ? "rgba(74,222,128,0.1)" : isDown ? "rgba(248,113,113,0.1)" : "rgba(107,114,128,0.1)",
                                color: isUp ? "#4ade80" : isDown ? "#f87171" : "#9ca3af",
                              }}>{g.action}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Row 1: Revenue/OI/NI/FCF */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ovKpis.map((k) => (
            <div key={k.label} className="rounded p-3" style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "#6b7280" }}>{k.label}</div>
              <div className="text-3xl font-mono font-semibold mt-1" style={{ color: k.yoyVal == null ? "#4b5563" : k.yoyVal < 0 ? "#f87171" : "#4ade80" }}>
                {k.yoyVal != null ? `${k.yoyVal > 0 ? "+" : ""}${k.yoyVal.toFixed(1)}%` : "—"}
              </div>
              <div className="text-sm font-mono mt-0.5" style={{ color: "#6b7280" }}>
                {k.val != null ? fmtNum(k.val, !!isKR) : "—"} {k.val != null ? (isKR ? t.finUnit : "$M") : ""}
              </div>
              <div className="mt-1">
                <ResponsiveContainer width={200} height={50}>
                  <AreaChart data={k.yoyData}>
                    <Area type="monotone" dataKey="yoy" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={1.5} isAnimationActive={false} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>

        {/* Row 2: Margins + ROE */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {ovMargins.map((k) => {
            const diff = chgPp(k.val, k.prev);
            const chartData = k.source || sparkData;
            return (
              <div key={k.label} className="rounded p-3" style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-[10px] uppercase tracking-widest" style={{ color: "#6b7280" }}>{k.label}</div>
                <div className="text-2xl font-mono font-semibold mt-1" style={{ color: k.val != null && k.val < 0 ? "#f87171" : "#f3f4f6" }}>
                  {k.val != null ? `${k.val.toFixed(1)}%` : "—"}
                </div>
                <div className="text-[11px] font-mono mt-0.5" style={{ color: kpiColor(diff) }}>
                  {diff != null ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}pp` : "—"}
                </div>
                <div className="mt-1">
                  <ResponsiveContainer width={200} height={50}>
                    <AreaChart data={chartData}>
                      <Area type="monotone" dataKey={k.key} stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={1.5} isAnimationActive={false} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>

        {/* Balance Sheet Health */}
        <div>
          <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "rgba(251,191,36,0.6)" }}>{f.bsHealth}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {healthBadge(f.debtEquity, latest?.debtToEquity != null ? latest.debtToEquity / 100 : null, [0, 0.8], [0.8, 1.5])}
            {healthBadge(f.currentRatio, latest?.currentRatio, [1.5, 999], [1, 1.5])}
            {healthBadge(f.interestCoverage, keyMetrics.length > 0 ? keyMetrics[keyMetrics.length - 1]?.interestCoverage : null, [5, 9999], [2, 5])}
            {healthBadge(f.netDebtEbitda, keyMetrics.length > 0 ? keyMetrics[keyMetrics.length - 1]?.netDebtToEbitda : null, [-999, 2], [2, 4])}
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
      { key: "pOcf", label: "P/OCF", color: "#14b8a6" },
      { key: "pFcf", label: "P/FCF", color: "#f472b6" },
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

  // ── Ownership tab ──────────────────────────────────────────

  function renderOwnership() {
    if (isKR) {
      return (
        <div className="py-12 text-center">
          <div className="text-[11px] font-mono" style={{ color: "#4b5563" }}>{f.comingSoonKR}</div>
        </div>
      );
    }

    const institutional = finData?.institutional || [];
    const insider = finData?.insider || [];

    return (
      <div className="space-y-6">
        {/* Institutional Ownership */}
        <div>
          <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "rgba(251,191,36,0.6)" }}>{f.instOwnership}</div>
          {institutional.length === 0 ? (
            <div className="py-6 text-center text-[11px]" style={{ color: "#4b5563" }}>No institutional data available</div>
          ) : (
            <div className="fin-table overflow-x-auto rounded-lg" style={{ border: "1px solid #222" }}>
              <table className="w-full font-mono text-xs" style={{ background: "#080c12" }}>
                <thead>
                  <tr style={{ background: "#0d1117", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
                    <th className="py-2 pl-3 pr-4 text-left text-[10px] font-medium uppercase tracking-wider" style={{ color: "#6b7280" }}>Holder</th>
                    <th className="py-2 px-4 text-right text-[10px] font-medium uppercase tracking-wider" style={{ color: "#6b7280" }}>Shares</th>
                    <th className="py-2 px-4 text-right text-[10px] font-medium uppercase tracking-wider" style={{ color: "#6b7280" }}>%</th>
                    <th className="py-2 px-4 text-right text-[10px] font-medium uppercase tracking-wider" style={{ color: "#6b7280" }}>Value</th>
                    <th className="py-2 px-4 text-right text-[10px] font-medium uppercase tracking-wider" style={{ color: "#6b7280" }}>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {institutional.map((h, i) => (
                    <tr key={i} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td className="py-1.5 pl-3 pr-4 text-left" style={{ color: "#e8e8e8", fontSize: "12px" }}>{h.holder ?? "—"}</td>
                      <td className="py-1.5 px-4 text-right tabular-nums" style={{ color: "#f3f4f6", fontSize: "12px" }}>{h.shares != null ? h.shares.toLocaleString() : "—"}</td>
                      <td className="py-1.5 px-4 text-right tabular-nums" style={{ color: "#9ca3af", fontSize: "11px" }}>{h.pct != null ? `${h.pct.toFixed(2)}%` : "—"}</td>
                      <td className="py-1.5 px-4 text-right tabular-nums" style={{ color: "#f3f4f6", fontSize: "12px" }}>{h.value != null ? `$${Math.round(h.value / 1e6).toLocaleString()}M` : "—"}</td>
                      <td className="py-1.5 px-4 text-right tabular-nums" style={{ color: h.change != null && h.change > 0 ? "#4ade80" : h.change != null && h.change < 0 ? "#f87171" : "#6b7280", fontSize: "12px" }}>
                        {h.change != null ? `${h.change > 0 ? "▲" : h.change < 0 ? "▼" : ""}${Math.abs(h.change).toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Insider Trading */}
        <div>
          <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "rgba(251,191,36,0.6)" }}>{f.insiderTrading}</div>
          {insider.length === 0 ? (
            <div className="py-6 text-center text-[11px]" style={{ color: "#4b5563" }}>No insider trading data available</div>
          ) : (
            <div className="fin-table overflow-x-auto rounded-lg" style={{ border: "1px solid #222" }}>
              <table className="w-full font-mono text-xs" style={{ background: "#080c12" }}>
                <thead>
                  <tr style={{ background: "#0d1117", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
                    <th className="py-2 pl-3 pr-4 text-left text-[10px] font-medium uppercase tracking-wider" style={{ color: "#6b7280" }}>Date</th>
                    <th className="py-2 px-4 text-left text-[10px] font-medium uppercase tracking-wider" style={{ color: "#6b7280" }}>Insider</th>
                    <th className="py-2 px-4 text-left text-[10px] font-medium uppercase tracking-wider" style={{ color: "#6b7280" }}>Title</th>
                    <th className="py-2 px-4 text-center text-[10px] font-medium uppercase tracking-wider" style={{ color: "#6b7280" }}>Type</th>
                    <th className="py-2 px-4 text-right text-[10px] font-medium uppercase tracking-wider" style={{ color: "#6b7280" }}>Shares</th>
                    <th className="py-2 px-4 text-right text-[10px] font-medium uppercase tracking-wider" style={{ color: "#6b7280" }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {insider.map((t, i) => {
                    const isBuy = t.type?.toLowerCase().includes("purchase") || t.type?.toLowerCase().includes("buy") || t.type?.toLowerCase() === "p-purchase";
                    const isSell = t.type?.toLowerCase().includes("sale") || t.type?.toLowerCase().includes("sell") || t.type?.toLowerCase() === "s-sale";
                    return (
                      <tr key={i} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td className="py-1.5 pl-3 pr-4 text-left" style={{ color: "#9ca3af", fontSize: "11px" }}>{t.date ?? "—"}</td>
                        <td className="py-1.5 px-4 text-left" style={{ color: "#e8e8e8", fontSize: "12px" }}>{t.name ?? "—"}</td>
                        <td className="py-1.5 px-4 text-left" style={{ color: "#6b7280", fontSize: "11px" }}>{t.title ?? "—"}</td>
                        <td className="py-1.5 px-4 text-center">
                          <span className="inline-block rounded px-1.5 py-0.5 text-[9px] font-bold" style={{
                            background: isBuy ? "rgba(74,222,128,0.1)" : isSell ? "rgba(248,113,113,0.1)" : "rgba(107,114,128,0.1)",
                            color: isBuy ? "#4ade80" : isSell ? "#f87171" : "#6b7280",
                          }}>
                            {isBuy ? "BUY" : isSell ? "SELL" : (t.type ?? "—")}
                          </span>
                        </td>
                        <td className="py-1.5 px-4 text-right tabular-nums" style={{ color: "#f3f4f6", fontSize: "12px" }}>{t.shares != null ? Math.abs(t.shares).toLocaleString() : "—"}</td>
                        <td className="py-1.5 px-4 text-right tabular-nums" style={{ color: "#f3f4f6", fontSize: "12px" }}>{t.value != null ? `$${Math.abs(t.value).toLocaleString()}` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Breakdown (Sankey) tab ─────────────────────────────────

  function fmtSankey(v: number): string {
    const abs = Math.abs(v);
    if (isKR) {
      const oku = abs / 1e8;
      return oku >= 10000 ? `${(oku / 10000).toFixed(1)}조` : `${Math.round(oku).toLocaleString()}억`;
    }
    return abs >= 1000 ? `$${(abs / 1000).toFixed(1)}B` : `$${Math.round(abs).toLocaleString()}M`;
  }

  function renderBreakdown() {
    if (quarterly.length === 0) return null;
    const idx = breakdownIdx < 0 || breakdownIdx >= quarterly.length ? quarterly.length - 1 : breakdownIdx;
    const q = quarterly[idx];

    const revenue = q.revenue as number | null;
    const cogs = q.costOfRevenue as number | null;
    const grossProfit = q.grossProfit as number | null;
    const opIncome = q.operatingIncome as number | null;
    const taxExp = q.incomeTaxExpense as number | null;
    const intExp = q.interestExpense as number | null;
    const ni = q.netIncome as number | null;

    if (revenue == null || revenue <= 0) {
      return <div className="py-8 text-center text-[11px]" style={{ color: "#555" }}>No breakdown data for this period</div>;
    }

    // Build nodes & links
    type N = { name: string; color: string };
    type L = { source: number; target: number; value: number };
    const nodes: N[] = [];
    const links: L[] = [];
    const addNode = (name: string, color: string) => { nodes.push({ name, color }); return nodes.length - 1; };

    const iRev = addNode("Revenue", "#10b981");
    const iCogs = addNode("COGS", "#f87171");
    const iGP = addNode("Gross Profit", "#10b981");

    const gpVal = grossProfit ?? (cogs != null ? revenue - cogs : revenue * 0.6);
    const cogsVal = cogs ?? revenue - gpVal;

    links.push({ source: iRev, target: iCogs, value: Math.abs(cogsVal) });
    links.push({ source: iRev, target: iGP, value: Math.abs(gpVal) });

    const iOpex = addNode("OpEx", "#f87171");
    const iOI = addNode("Operating Income", opIncome != null && opIncome >= 0 ? "#10b981" : "#f87171");

    const oiVal = opIncome ?? gpVal * 0.3;
    const opexVal = Math.abs(gpVal) - oiVal;

    if (opexVal > 0) links.push({ source: iGP, target: iOpex, value: Math.abs(opexVal) });
    links.push({ source: iGP, target: iOI, value: Math.abs(oiVal) });

    if (oiVal > 0) {
      const taxVal = taxExp != null ? Math.abs(taxExp) : Math.abs(oiVal) * 0.2;
      const intVal = intExp != null ? Math.abs(intExp) : 0;
      const niVal = ni != null ? Math.abs(ni) : Math.abs(oiVal) - taxVal - intVal;
      const nonOpVal = Math.max(0, Math.abs(oiVal) - taxVal - niVal);

      const iTax = addNode("Tax", "#f87171");
      const iNI = addNode("Net Income", ni != null && ni >= 0 ? "#10b981" : "#f87171");

      links.push({ source: iOI, target: iTax, value: taxVal });
      links.push({ source: iOI, target: iNI, value: niVal });
      if (nonOpVal > 0) {
        const iNonOp = addNode("Non-Op / Other", "#f87171");
        links.push({ source: iOI, target: iNonOp, value: nonOpVal });
      }
    }

    // Sankey layout
    const W = 800;
    const H = 480;
    const PAD = { top: 20, right: 160, bottom: 20, left: 20 };

    interface SN { name: string; color: string }
    interface SL { source: number; target: number; value: number }

    const sk = sankey<SN, SL>()
      .nodeWidth(18)
      .nodePadding(24)
      .nodeAlign((node: SankeyNode<SN, SL>) => {
        const n = node as SankeyNode<SN, SL> & { depth?: number };
        return n.depth ?? 0;
      })
      .extent([[PAD.left, PAD.top], [W - PAD.right, H - PAD.bottom]]);

    const { nodes: sNodes, links: sLinks } = sk({
      nodes: nodes.map(n => ({ ...n })),
      links: links.map(l => ({ ...l })),
    });

    const linkPath = sankeyLinkHorizontal();

    return (
      <div className="space-y-3">
        {/* Year selector */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest" style={{ color: "#6b7280" }}>Period</span>
          <select
            value={idx}
            onChange={(e) => setBreakdownIdx(Number(e.target.value))}
            className="rounded px-2 py-1 text-[11px] font-mono outline-none"
            style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", color: "#e8e8e8" }}
          >
            {quarterly.map((qq, i) => (
              <option key={i} value={i}>{qq.label}</option>
            ))}
          </select>
        </div>

        {/* Sankey SVG */}
        <div className="overflow-x-auto rounded" style={{ background: "#080c12", border: "1px solid rgba(255,255,255,0.08)" }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", minHeight: 480, maxHeight: 560 }}>
            {/* Links */}
            {sLinks.map((link, i) => {
              const srcNode = link.source as SankeyNode<SN, SL>;
              return (
                <path
                  key={`link-${i}`}
                  d={linkPath(link as unknown as SankeyLink<SN, SL>) || ""}
                  fill="none"
                  stroke={srcNode.color || "#555"}
                  strokeOpacity={0.3}
                  strokeWidth={Math.max(1, (link as unknown as { width?: number }).width ?? 1)}
                />
              );
            })}

            {/* Nodes */}
            {sNodes.map((node, i) => {
              const x0 = (node as unknown as { x0: number }).x0;
              const x1 = (node as unknown as { x1: number }).x1;
              const y0 = (node as unknown as { y0: number }).y0;
              const y1 = (node as unknown as { y1: number }).y1;
              const sn = node as unknown as SN;
              const val = (node as unknown as { value?: number }).value ?? 0;
              return (
                <g key={`node-${i}`}>
                  <rect
                    x={x0} y={y0}
                    width={x1 - x0} height={Math.max(1, y1 - y0)}
                    fill={sn.color || "#555"}
                    rx={2}
                  />
                  <text
                    x={x1 + 8} y={(y0 + y1) / 2}
                    dy="0.35em"
                    fill="#e5e7eb"
                    fontSize={11}
                    fontFamily="monospace"
                  >
                    {sn.name}
                  </text>
                  <text
                    x={x1 + 8} y={(y0 + y1) / 2 + 14}
                    dy="0.35em"
                    fill="#9ca3af"
                    fontSize={10}
                    fontFamily="monospace"
                  >
                    {fmtSankey(val)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <style>{`
        .fin-table::-webkit-scrollbar { height: 3px; }
        .fin-table::-webkit-scrollbar-track { background: transparent; }
        .fin-table::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 999px; }
        .fin-table::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
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
              placeholder={f.searchPlaceholder}
              className="w-full rounded border px-3 py-2 text-sm font-mono outline-none transition-colors focus:border-amber-400/50"
              style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)", color: "#e8e8e8" }}
            />
            <p className="text-[11px] mt-1" style={{ color: "#6b7280" }}>
              {f.searchHint}
            </p>
            {showDropdown && (
              <div className="absolute z-50 mt-1 w-full overflow-hidden rounded" style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)" }}>
                {searchLoading ? (
                  <div className="px-3 py-3 text-[11px] animate-pulse" style={{ color: "#6b7280" }}>{isKO ? "검색중..." : "Searching..."}</div>
                ) : searchResults.length === 0 ? (
                  <div className="px-3 py-3 text-[11px]" style={{ color: "#4b5563" }}>{isKO ? "결과 없음" : "No results found"}</div>
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

        {finLoading && (
          loadingMarket === "KR" ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="w-5 h-5 border border-amber-400/50 border-t-amber-400 rounded-full animate-spin" />
              <p className="text-sm text-gray-400 font-mono">FETCHING DART DATA...</p>
              <p className="text-xs text-gray-600 font-mono text-center">
                처음 조회하는 종목은 20-30초 소요될 수 있습니다.<br/>
                이후 동일 종목은 즉시 로드됩니다.
              </p>
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="text-[11px] animate-pulse" style={{ color: "#555" }}>{t.finLoading}</div>
            </div>
          )
        )}
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
                  {f.mktCap}: {fmtMarketCap(finData.marketCap)} {unit}
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
              return (
                <div className="flex items-center gap-8 rounded p-4" style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest" style={{ color: "#6b7280" }}>{f.currentPrice}</div>
                    <div className="text-2xl font-mono font-semibold" style={{ color: "#ffffff" }}>${price.toFixed(2)}</div>
                  </div>
                  <div className="text-xl" style={{ color: "#4b5563" }}>→</div>
                  <div>
                    <div className="text-[10px] uppercase tracking-widest" style={{ color: "#6b7280" }}>{f.wallStTarget}</div>
                    <div className="text-2xl font-mono font-semibold" style={{ color: "#fbbf24" }}>${consensus.toFixed(2)}</div>
                  </div>
                  <div className="ml-2">
                    <div className="text-[10px] uppercase tracking-widest" style={{ color: "#6b7280" }}>{f.upside}</div>
                    <div className="text-2xl font-mono font-semibold" style={{ color: upside >= 0 ? "#4ade80" : "#f87171" }}>
                      {upside >= 0 ? "+" : ""}{upside.toFixed(1)}%
                    </div>
                  </div>
                  <div className="ml-auto text-right text-xs font-mono" style={{ color: "#6b7280" }}>
                    <div>H: ${high.toFixed(0)}</div>
                    {median != null && <div>M: ${median.toFixed(0)}</div>}
                    <div>L: ${low.toFixed(0)}</div>
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
                    <div className="text-[10px]" style={{ color: "#6b7280" }}>{f.revenueQoQ} {period === "annual" ? "YoY" : "QoQ"}</div>
                    <div className="text-lg font-mono" style={{ color: kpiColor(revYoY) }}>{revYoY != null ? `${revYoY > 0 ? "+" : ""}${revYoY.toFixed(1)}%` : "—"}</div>
                  </div>
                  <div className="rounded p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="text-[10px]" style={{ color: "#6b7280" }}>{f.opIncomeQoQ} {period === "annual" ? "YoY" : "QoQ"}</div>
                    <div className="text-lg font-mono" style={{ color: kpiColor(oiYoY) }}>{oiYoY != null ? `${oiYoY > 0 ? "+" : ""}${oiYoY.toFixed(1)}%` : "—"}</div>
                  </div>
                  <div className="rounded p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="text-[10px]" style={{ color: "#6b7280" }}>{f.opmLatest}</div>
                    <div className="text-lg font-mono" style={{ color: kpiColor(opm) }}>{opm != null ? `${opm.toFixed(1)}%` : "—"}</div>
                  </div>
                </div>
              );
            })()}

            {/* Price Chart (P&L tab) */}
            {activeTab === "pl" && (() => {
              const allPriceData = (finData?.priceHistory || []).filter(
                (p): p is { date: string; close: number } => p.date != null && p.close != null
              );
              if (allPriceData.length < 2) return null;
              const rangeDays = priceRange === "1M" ? 30 : priceRange === "3M" ? 90 : priceRange === "6M" ? 180 : 365;
              const filtered = allPriceData.slice(-rangeDays);
              if (filtered.length < 2) return null;
              const first = filtered[0].close;
              const last = filtered[filtered.length - 1].close;
              const periodReturn = first ? ((last - first) / first) * 100 : 0;
              return (
                <div className="mb-4 rounded" style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", padding: "16px" }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "#6b7280" }}>{f.priceChart}</span>
                    <div className="flex gap-1">
                      {(["1M", "3M", "6M", "1Y"] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setPriceRange(r)}
                          className="text-[10px] font-mono px-2 py-0.5"
                          style={{
                            color: priceRange === r ? "#fbbf24" : "#4b5563",
                            borderBottom: priceRange === r ? "1px solid #fbbf24" : "1px solid transparent",
                          }}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs font-mono" style={{ color: periodReturn >= 0 ? "#4ade80" : "#f87171" }}>
                      {periodReturn >= 0 ? "+" : ""}{periodReturn.toFixed(1)}%
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={130}>
                    <AreaChart data={filtered}>
                      <defs>
                        <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#4b5563", fontFamily: "monospace" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                      <Tooltip
                        contentStyle={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, fontFamily: "monospace" }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(v: any) => [`$${Number(v).toFixed(2)}`, "Price"]}
                      />
                      <Area type="monotone" dataKey="close" stroke="#f59e0b" strokeWidth={1.5} fill="url(#priceGrad)" dot={false} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}

            {(activeTab === "pl" || activeTab === "bs" || activeTab === "cf") && renderTable(currentRows, currentData, activeTab !== "bs" || true, activeTab === "pl")}

            {/* Earnings Surprise (P&L tab, US only) */}
            {activeTab === "pl" && !isKR && (() => {
              const surprises = finData?.earningsSurprises || [];
              if (surprises.length === 0) return null;
              const chartData = surprises.map(e => {
                const pct = e.actual != null && e.estimated != null && e.estimated !== 0
                  ? Math.round(((e.actual - e.estimated) / Math.abs(e.estimated)) * 1000) / 10 : null;
                const d = e.date ?? "";
                const year = d.slice(0, 4);
                const month = parseInt(d.slice(5, 7) || "0");
                const qLabel = month <= 3 ? "Q1" : month <= 6 ? "Q2" : month <= 9 ? "Q3" : "Q4";
                return { label: `${year} ${qLabel}`, actual: e.actual, estimated: e.estimated, surprise: pct };
              });
              return (
                <div className="mt-4">
                  <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#6b7280" }}>{f.earningsSurprise}</div>
                  <div className="rounded p-3" style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ width: "100%", height: 180 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} barCategoryGap="20%">
                          <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, fontSize: 10, fontFamily: "monospace" }}
                            labelStyle={{ color: "#9ca3af" }}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            formatter={(value: any, name: any) => {
                              const v = value as number | null;
                              if (name === "surprise") return [v != null ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%` : "—", "Surprise"];
                              return [v != null ? `$${v.toFixed(2)}` : "—", name === "actual" ? "Actual EPS" : "Est. EPS"];
                            }}
                          />
                          <Bar dataKey="surprise" radius={[2, 2, 0, 0]}>
                            {chartData.map((d, i) => (
                              <Cell key={i} fill={d.surprise != null && d.surprise >= 0 ? "#10b981" : "#ef4444"} />
                            ))}
                            <LabelList dataKey="surprise" position="top" style={{ fill: "#9ca3af", fontSize: 9, fontFamily: "monospace" }}
                              formatter={(v: unknown) => { const n = v as number | null; return n != null ? `${n > 0 ? "+" : ""}${n.toFixed(1)}%` : ""; }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              );
            })()}

            {activeTab === "keyMetrics" && renderKeyMetricsTab()}
            {activeTab === "valuation" && renderValuationTab()}

            {activeTab === "ownership" && renderOwnership()}

            {activeTab === "breakdown" && renderBreakdown()}

            {/* C/F Capex Bar Chart */}
            {activeTab === "cf" && quarterly.length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] mb-2" style={{ color: "#6b7280" }}>{f.capexLabel}</div>
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
              {f.searchEmpty}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
