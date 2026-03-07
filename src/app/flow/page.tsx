"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from "recharts";
import { useLang } from "@/lib/LangContext";
import AppHeader from "@/components/AppHeader";

const CARD = "rounded-[12px] border border-card-border bg-card-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3)]";
const TH = "pb-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted";
const TD = "py-1.5";

// ── Types ────────────────────────────────────────────────────

interface NetFlowDay { date: string; individual: number; foreign: number; institution: number }
interface NetBuyRow { side: "foreign" | "institution"; ticker: string; name: string; netBuy: number; price: number; chgPct: number }
interface TradingValueRow { ticker: string; name: string; tradingValue: number; price: number; chgPct: number }
interface AvgCostRow { ticker: string; name: string; foreignAvgCost: number; lastPrice: number; distancePct: number }
interface DivergenceRow { ticker: string; name: string; reason: string; foreignStreakDays: number; priceTrend: "up" | "down" | "flat" }
interface SectorFlowRow { sector: string; netBuy: number }
interface CumulativeRow { rank: number; ticker: string; name: string; cum5d: number; cum20d: number; cum60d: number; trend: "up" | "down" | "flat" }
interface CumulativeInvestorFlow { date: string; foreign: number; institution: number; individual: number }
interface CreditBalanceDay { date: string; balance: number; dangerZone: number }
interface ShortLendingDay { date: string; balance: number }
interface TopShortStock { ticker: string; name: string; shortBalance: number; sellDays: number; chgPct: number }
interface ProgramTradingDay { date: string; arbitrage: number; nonArbitrage: number; total: number }

interface FlowData {
  netFlowSeries: NetFlowDay[];
  topNetBuy: NetBuyRow[];
  topTradingValue: TradingValueRow[];
  avgCostEstimate: AvgCostRow[];
  divergenceCandidates: DivergenceRow[];
  sectorFlow: SectorFlowRow[];
  cumulativeForeignBuy: CumulativeRow[];
  cumulativeInvestorFlow: CumulativeInvestorFlow[];
  creditBalanceSeries: CreditBalanceDay[];
  shortLendingSeries: ShortLendingDay[];
  topShortStocks: TopShortStock[];
  programTradingSeries: ProgramTradingDay[];
  asOf: string;
  source: string;
}

// ── Helpers ──────────────────────────────────────────────────

function fmtKRW(v: number) {
  const abs = Math.abs(v);
  if (abs >= 10000) return `₩${(v / 10000).toFixed(1)}조`;
  return `₩${v.toLocaleString()}억`;
}

function fmtShortKRW(v: number) {
  return `${v.toLocaleString()}억`;
}

function fmtPrice(v: number) {
  if (v >= 1000) return v.toLocaleString();
  return String(v);
}

function SectionDot({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {title}
      </h2>
      {hint && (
        <span className="group relative cursor-help">
          <span className="text-[10px] text-muted/60 hover:text-muted">&#9432;</span>
          <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-[#1a2332] px-2 py-1 text-[10px] text-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            {hint}
          </span>
        </span>
      )}
    </div>
  );
}

function ChgPct({ v }: { v: number }) {
  return (
    <span className={v >= 0 ? "text-gain" : "text-loss"}>
      {v >= 0 ? "+" : ""}
      {v.toFixed(2)}%
    </span>
  );
}

function EstBadge() {
  return <span className="ml-1.5 rounded bg-yellow-500/10 px-1 py-px text-[9px] text-yellow-500/80">추정치</span>;
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "#111820",
    border: "1px solid #1f2a37",
    borderRadius: 6,
    fontSize: 11,
    color: "#e5e7eb",
  },
  itemStyle: { color: "#9ca3af" },
};

const TAB_BTN = (active: boolean) =>
  `px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
    active ? "bg-accent text-white" : "bg-card-bg text-muted hover:text-foreground"
  }`;

// ── Main page ────────────────────────────────────────────────

export default function FlowPage() {
  const { t } = useLang();
  const [chartMode, setChartMode] = useState<"daily" | "cumulative">("daily");
  const [netBuyTab, setNetBuyTab] = useState<"foreign" | "institution">("foreign");
  const [cumPeriod, setCumPeriod] = useState<5 | 20 | 60>(20);
  const [data, setData] = useState<FlowData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/flow")
      .then(r => r.json())
      .then(json => { if (json.ok) setData(json); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cumulativeData = useMemo(() => {
    if (!data) return [];
    let ci = 0, cf = 0, cinst = 0;
    return data.netFlowSeries.map((d) => {
      ci += d.individual;
      cf += d.foreign;
      cinst += d.institution;
      return { date: d.date, individual: ci, foreign: cf, institution: cinst };
    });
  }, [data]);

  // Cumulative investor flow sliced by period
  const cumInvestorData = useMemo(() => {
    if (!data?.cumulativeInvestorFlow) return [];
    const all = data.cumulativeInvestorFlow;
    const sliced = all.slice(-cumPeriod);
    if (sliced.length === 0) return [];
    // Re-zero to start of period
    const base = { foreign: sliced[0].foreign, institution: sliced[0].institution, individual: sliced[0].individual };
    return sliced.map(d => ({
      date: d.date,
      foreign: d.foreign - base.foreign,
      institution: d.institution - base.institution,
      individual: d.individual - base.individual,
    }));
  }, [data, cumPeriod]);

  const chartData = chartMode === "daily" ? (data?.netFlowSeries || []) : cumulativeData;
  const filteredNetBuy = (data?.topNetBuy || []).filter((r) => r.side === netBuyTab);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader active="flow" />
        <main className="mx-auto max-w-[1400px] px-4 py-4">
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span className="ml-3 text-sm text-muted">Loading flow data...</span>
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader active="flow" />
        <main className="mx-auto max-w-[1400px] px-4 py-4">
          <div className="py-20 text-center text-muted">Failed to load flow data</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="flow" />

      <main className="mx-auto max-w-[1400px] px-4 py-4 space-y-3">
        {/* Source badge */}
        <div className="flex items-center gap-2 text-[10px] text-muted">
          <span className="rounded bg-card-border px-1.5 py-0.5">
            {data.source === "live" ? "LIVE" : data.source === "cache" ? "CACHED" : "STALE"}
          </span>
          <span>기준일: {data.asOf}</span>
          <span className="opacity-50">Yahoo Finance 기반 추정치</span>
        </div>

        {/* Row 1: Chart + right stack */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          {/* Investor Net Flow Chart — spans 3 cols */}
          <section className={`${CARD} lg:col-span-3`}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Investor Net Flow (30D)
                </h2>
              </div>
              <div className="flex gap-px rounded bg-card-border p-px">
                {(["daily", "cumulative"] as const).map((m) => (
                  <button key={m} onClick={() => setChartMode(m)} className={TAB_BTN(chartMode === m)}>
                    {m === "daily" ? "Daily" : "Cumulative"}
                  </button>
                ))}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={280}>
              {chartMode === "daily" ? (
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2a37" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => fmtShortKRW(v)} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(value, name) => [typeof value === "number" ? fmtShortKRW(value) : value, name]} labelFormatter={(l) => String(l)} />
                  <Legend wrapperStyle={{ fontSize: 10, color: "#9ca3af" }} iconSize={8} />
                  <Bar dataKey="individual" name="Individual" fill="#60a5fa" stackId="a" />
                  <Bar dataKey="foreign" name="Foreign" fill="#22c55e" stackId="a" />
                  <Bar dataKey="institution" name="Institution" fill="#f59e0b" stackId="a" />
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2a37" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => fmtShortKRW(v)} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(value, name) => [typeof value === "number" ? fmtShortKRW(value) : value, name]} labelFormatter={(l) => String(l)} />
                  <Legend wrapperStyle={{ fontSize: 10, color: "#9ca3af" }} iconSize={8} />
                  <Line dataKey="individual" name="Individual" stroke="#60a5fa" dot={false} strokeWidth={1.5} />
                  <Line dataKey="foreign" name="Foreign" stroke="#22c55e" dot={false} strokeWidth={1.5} />
                  <Line dataKey="institution" name="Institution" stroke="#f59e0b" dot={false} strokeWidth={1.5} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </section>

          {/* Right stack: Top Net Buy + Top Trading Value */}
          <div className="space-y-3 lg:col-span-2">
            {/* Top Net Buy */}
            <section className={CARD}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Top Net Buy</h2>
                </div>
                <div className="flex gap-px rounded bg-card-border p-px">
                  {(["foreign", "institution"] as const).map((s) => (
                    <button key={s} onClick={() => setNetBuyTab(s)} className={TAB_BTN(netBuyTab === s)}>
                      {s === "foreign" ? "Foreign" : "Institution"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-card-border">
                      <th className={TH}>Ticker</th>
                      <th className={TH}>Name</th>
                      <th className={`${TH} text-right`}>Net Buy</th>
                      <th className={`${TH} text-right`}>Price</th>
                      <th className={`${TH} text-right`}>Chg%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNetBuy.map((r) => (
                      <tr key={r.ticker} className="border-b border-card-border/40 hover:bg-card-border/20">
                        <td className={`${TD} text-accent`}>{r.ticker}</td>
                        <td className={TD}>{r.name}</td>
                        <td className={`${TD} text-right tabular-nums`}>{fmtKRW(r.netBuy)}</td>
                        <td className={`${TD} text-right tabular-nums`}>{fmtPrice(r.price)}</td>
                        <td className={`${TD} text-right tabular-nums`}><ChgPct v={r.chgPct} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Top Trading Value */}
            <section className={CARD}>
              <SectionDot title="Top Trading Value" />
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-card-border">
                      <th className={TH}>Ticker</th>
                      <th className={TH}>Name</th>
                      <th className={`${TH} text-right`}>Value</th>
                      <th className={`${TH} text-right`}>Price</th>
                      <th className={`${TH} text-right`}>Chg%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topTradingValue.map((r) => (
                      <tr key={r.ticker} className="border-b border-card-border/40 hover:bg-card-border/20">
                        <td className={`${TD} text-accent`}>{r.ticker}</td>
                        <td className={TD}>{r.name}</td>
                        <td className={`${TD} text-right tabular-nums`}>{fmtKRW(r.tradingValue)}</td>
                        <td className={`${TD} text-right tabular-nums`}>{fmtPrice(r.price)}</td>
                        <td className={`${TD} text-right tabular-nums`}><ChgPct v={r.chgPct} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>

        {/* ── NEW: Row 1.5 — 투자자별 누적 순매수 ──────────────── */}
        <section className={CARD}>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SectionDot title="투자자별 누적 순매수" />
              <EstBadge />
            </div>
            <div className="flex gap-px rounded bg-card-border p-px">
              {([5, 20, 60] as const).map((p) => (
                <button key={p} onClick={() => setCumPeriod(p)} className={TAB_BTN(cumPeriod === p)}>
                  {p}일
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={cumInvestorData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2a37" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => fmtShortKRW(v)} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(value, name) => [typeof value === "number" ? fmtShortKRW(value) : value, name]} labelFormatter={(l) => String(l)} />
              <Legend wrapperStyle={{ fontSize: 10, color: "#9ca3af" }} iconSize={8} />
              <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3" />
              <Line dataKey="foreign" name="외국인" stroke="#22c55e" dot={false} strokeWidth={2} />
              <Line dataKey="institution" name="기관" stroke="#60a5fa" dot={false} strokeWidth={2} />
              <Line dataKey="individual" name="개인" stroke="#f59e0b" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </section>

        {/* ── NEW: Row 1.75 — 신용잔고 & 대차잔고 ──────────────── */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* LEFT: 신용잔고 (Credit Balance) */}
          <section className={CARD}>
            <SectionDot
              title="신용잔고 추이"
              hint="신용잔고 급증 = 매수 과열 신호, 조정 가능성"
            />
            <div className="mb-1 flex items-center gap-1">
              <EstBadge />
              <span className="text-[9px] text-muted/50">가격·거래량 기반 추정</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.creditBalanceSeries} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2a37" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `${(v / 10000).toFixed(1)}조`} domain={["auto", "auto"]} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(value, name) => [typeof value === "number" ? fmtShortKRW(value) : value, name]} labelFormatter={(l) => String(l)} />
                <ReferenceLine y={data.creditBalanceSeries[0]?.dangerZone || 25000} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "과열 구간", fill: "#ef4444", fontSize: 9, position: "right" }} />
                <Line dataKey="balance" name="신용잔고" stroke="#f59e0b" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </section>

          {/* RIGHT: 대차잔고 (Short Lending Balance) */}
          <section className={CARD}>
            <SectionDot
              title="대차잔고 추이"
              hint="대차잔고 증가 = 공매도 증가 예고, 하락 압력"
            />
            <div className="mb-1 flex items-center gap-1">
              <EstBadge />
              <span className="text-[9px] text-muted/50">외국인 매도 패턴 기반 추정</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.shortLendingSeries} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2a37" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `${(v / 10000).toFixed(1)}조`} domain={["auto", "auto"]} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(value, name) => [typeof value === "number" ? fmtShortKRW(value) : value, name]} labelFormatter={(l) => String(l)} />
                <Line dataKey="balance" name="대차잔고" stroke="#a78bfa" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>

            {/* Top 5 종목별 대차잔고 mini table */}
            <div className="mt-3 border-t border-card-border pt-2">
              <p className="mb-1.5 text-[10px] font-medium text-muted">종목별 대차잔고 TOP 5</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-card-border/50">
                    <th className={TH}>종목</th>
                    <th className={`${TH} text-right`}>추정 잔고</th>
                    <th className={`${TH} text-right`}>매도일</th>
                    <th className={`${TH} text-right`}>등락</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topShortStocks.map((s) => (
                    <tr key={s.ticker} className="border-b border-card-border/30">
                      <td className={`${TD} text-accent`}>{s.name}</td>
                      <td className={`${TD} text-right tabular-nums`}>{fmtShortKRW(s.shortBalance)}</td>
                      <td className={`${TD} text-right tabular-nums text-muted`}>{s.sellDays}/10일</td>
                      <td className={`${TD} text-right tabular-nums`}><ChgPct v={s.chgPct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* ── NEW: Row 1.85 — 프로그램 매매 ──────────────────── */}
        <section className={CARD}>
          <div className="mb-1 flex items-center gap-2">
            <SectionDot
              title="프로그램 매매 (30D)"
              hint="프로그램 매수 우위 = 기관 자금 유입 신호"
            />
            <EstBadge />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.programTradingSeries} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2a37" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => fmtShortKRW(v)} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(value, name) => [typeof value === "number" ? fmtShortKRW(value) : value, name]} labelFormatter={(l) => String(l)} />
              <Legend wrapperStyle={{ fontSize: 10, color: "#9ca3af" }} iconSize={8} />
              <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3" />
              <Bar dataKey="arbitrage" name="차익거래" fill="#6366f1" stackId="prog" />
              <Bar dataKey="nonArbitrage" name="비차익거래" fill="#06b6d4" stackId="prog" />
            </BarChart>
          </ResponsiveContainer>
        </section>

        {/* Row 2: Avg Cost + Divergence */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Foreign Avg Cost */}
          <section className={CARD}>
            <SectionDot title="Foreign Avg Cost (est.)" />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className={TH}>Ticker</th>
                    <th className={TH}>Name</th>
                    <th className={`${TH} text-right`}>Avg Cost</th>
                    <th className={`${TH} text-right`}>Last</th>
                    <th className={`${TH} text-right`}>Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {data.avgCostEstimate.map((r) => (
                    <tr key={r.ticker} className="border-b border-card-border/40 hover:bg-card-border/20">
                      <td className={`${TD} text-accent`}>{r.ticker}</td>
                      <td className={TD}>{r.name}</td>
                      <td className={`${TD} text-right tabular-nums`}>{fmtPrice(r.foreignAvgCost)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{fmtPrice(r.lastPrice)}</td>
                      <td className={`${TD} text-right tabular-nums`}><ChgPct v={r.distancePct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Divergence Watchlist */}
          <section className={CARD}>
            <SectionDot title="Divergence Watchlist" />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className={TH}>Ticker</th>
                    <th className={TH}>Name</th>
                    <th className={TH}>Signal</th>
                    <th className={`${TH} text-right`}>Streak</th>
                    <th className={`${TH} text-right`}>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {data.divergenceCandidates.map((r) => (
                    <tr key={r.ticker} className="border-b border-card-border/40 hover:bg-card-border/20">
                      <td className={`${TD} text-accent`}>{r.ticker}</td>
                      <td className={TD}>{r.name}</td>
                      <td className={`${TD} text-muted`}>{r.reason}</td>
                      <td className={`${TD} text-right`}>
                        <span className={`inline-block rounded px-1.5 py-px text-[10px] font-medium ${
                          r.foreignStreakDays > 0 ? "bg-gain/20 text-gain" : "bg-loss/20 text-loss"
                        }`}>
                          {r.foreignStreakDays > 0 ? "+" : ""}{r.foreignStreakDays}d
                        </span>
                      </td>
                      <td className={`${TD} text-right`}>
                        <span className={`text-[10px] font-medium ${
                          r.priceTrend === "up" ? "text-gain" : r.priceTrend === "down" ? "text-loss" : "text-muted"
                        }`}>
                          {r.priceTrend === "up" ? "▲" : r.priceTrend === "down" ? "▼" : "—"} {r.priceTrend}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Row 3: Sector Flow + Cumulative Foreign Buy */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Section A: 섹터별 외국인 순매수 */}
          <section className={CARD}>
            <SectionDot title="섹터별 외국인 순매수" />
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.sectorFlow}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2a37" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => fmtShortKRW(v)} />
                <YAxis type="category" dataKey="sector" tick={{ fontSize: 10, fill: "#e5e7eb" }} width={85} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(value) => [typeof value === "number" ? fmtShortKRW(value) : value, "순매수"]} />
                <Bar dataKey="netBuy" name="순매수" radius={[0, 4, 4, 0]}>
                  {data.sectorFlow.map((entry, index) => (
                    <Cell key={index} fill={entry.netBuy >= 0 ? "#22c55e" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>

          {/* Section B: 외국인 누적 순매수 TOP10 */}
          <section className={CARD}>
            <SectionDot title="외국인 누적 순매수 TOP10" />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className={TH}>#</th>
                    <th className={TH}>종목</th>
                    <th className={`${TH} text-right`}>5일</th>
                    <th className={`${TH} text-right`}>20일</th>
                    <th className={`${TH} text-right`}>60일</th>
                    <th className={`${TH} text-center`}>추세</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cumulativeForeignBuy.map((r) => (
                    <tr key={r.ticker} className="border-b border-card-border/40 hover:bg-card-border/20">
                      <td className={`${TD} text-muted`}>{r.rank}</td>
                      <td className={TD}>{r.name}</td>
                      <td className={`${TD} text-right tabular-nums ${r.cum5d >= 0 ? "text-gain" : "text-loss"}`}>
                        {r.cum5d >= 0 ? "+" : ""}{fmtShortKRW(r.cum5d)}
                      </td>
                      <td className={`${TD} text-right tabular-nums ${r.cum20d >= 0 ? "text-gain" : "text-loss"}`}>
                        {r.cum20d >= 0 ? "+" : ""}{fmtShortKRW(r.cum20d)}
                      </td>
                      <td className={`${TD} text-right tabular-nums ${r.cum60d >= 0 ? "text-gain" : "text-loss"}`}>
                        {r.cum60d >= 0 ? "+" : ""}{fmtShortKRW(r.cum60d)}
                      </td>
                      <td className={`${TD} text-center`}>
                        <span className={`text-sm ${
                          r.trend === "up" ? "text-gain" : r.trend === "down" ? "text-loss" : "text-muted"
                        }`}>
                          {r.trend === "up" ? "▲" : r.trend === "down" ? "▼" : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
