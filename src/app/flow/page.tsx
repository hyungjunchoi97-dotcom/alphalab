"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
import type { MessageKey } from "@/lib/i18n";
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

function ChgPct({ v }: { v: number }) {
  return (
    <span className={v >= 0 ? "text-gain" : "text-loss"}>
      {v >= 0 ? "+" : ""}{v.toFixed(2)}%
    </span>
  );
}

function EstBadge({ label }: { label: string }) {
  return <span className="ml-1.5 rounded bg-yellow-500/10 px-1 py-px text-[9px] text-yellow-500/80">{label}</span>;
}

function DateBadge({ label }: { label: string }) {
  return <span className="text-[9px] text-muted/60">{label}</span>;
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

// ── Section header ───────────────────────────────────────────

function SectionDot({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h2>
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

// ── Click detail popup ───────────────────────────────────────

function BarDetailPopup({ data, onClose, t }: { data: NetFlowDay; onClose: () => void; t: (k: MessageKey) => string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="rounded-xl border border-card-border bg-card-bg p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t("flowDate")}: {data.date}</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground text-lg leading-none">&times;</button>
        </div>
        <table className="text-xs">
          <tbody>
            <tr>
              <td className="pr-4 py-1 text-muted">{t("flowForeign")}</td>
              <td className={`py-1 tabular-nums font-medium ${data.foreign >= 0 ? "text-gain" : "text-loss"}`}>
                {data.foreign >= 0 ? "+" : ""}{fmtShortKRW(data.foreign)}
              </td>
            </tr>
            <tr>
              <td className="pr-4 py-1 text-muted">{t("flowInstitution")}</td>
              <td className={`py-1 tabular-nums font-medium ${data.institution >= 0 ? "text-gain" : "text-loss"}`}>
                {data.institution >= 0 ? "+" : ""}{fmtShortKRW(data.institution)}
              </td>
            </tr>
            <tr>
              <td className="pr-4 py-1 text-muted">{t("flowIndividual")}</td>
              <td className={`py-1 tabular-nums font-medium ${data.individual >= 0 ? "text-gain" : "text-loss"}`}>
                {data.individual >= 0 ? "+" : ""}{fmtShortKRW(data.individual)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────

export default function FlowPage() {
  const { t, lang } = useLang();
  const [chartMode, setChartMode] = useState<"daily" | "cumulative">("daily");
  const [netBuyTab, setNetBuyTab] = useState<"foreign" | "institution">("foreign");
  const [cumPeriod, setCumPeriod] = useState<5 | 20 | 60>(20);
  const [dateRange, setDateRange] = useState<number>(30);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<FlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clickedBar, setClickedBar] = useState<NetFlowDay | null>(null);

  useEffect(() => {
    fetch("/api/flow")
      .then(r => r.json())
      .then(json => { if (json.ok) setData(json); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Apply date range filter to net flow series
  const filteredNetFlow = useMemo(() => {
    if (!data) return [];
    const series = data.netFlowSeries;
    // Custom date range
    if (customFrom && customTo) {
      return series.filter(d => d.date >= customFrom && d.date <= customTo);
    }
    // Preset day count
    return series.slice(-dateRange);
  }, [data, dateRange, customFrom, customTo]);

  const cumulativeData = useMemo(() => {
    let ci = 0, cf = 0, cinst = 0;
    return filteredNetFlow.map((d) => {
      ci += d.individual;
      cf += d.foreign;
      cinst += d.institution;
      return { date: d.date, individual: ci, foreign: cf, institution: cinst };
    });
  }, [filteredNetFlow]);

  const cumInvestorData = useMemo(() => {
    if (!data?.cumulativeInvestorFlow) return [];
    const all = data.cumulativeInvestorFlow;
    const sliced = all.slice(-cumPeriod);
    if (sliced.length === 0) return [];
    const base = { foreign: sliced[0].foreign, institution: sliced[0].institution, individual: sliced[0].individual };
    return sliced.map(d => ({
      date: d.date,
      foreign: d.foreign - base.foreign,
      institution: d.institution - base.institution,
      individual: d.individual - base.individual,
    }));
  }, [data, cumPeriod]);

  const chartData = chartMode === "daily" ? filteredNetFlow : cumulativeData;
  const filteredNetBuy = (data?.topNetBuy || []).filter((r) => r.side === netBuyTab);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBarClick = useCallback((payload: any) => {
    if (payload?.activePayload?.[0]?.payload) {
      setClickedBar(payload.activePayload[0].payload as NetFlowDay);
    }
  }, []);

  const applyCustomRange = useCallback(() => {
    if (customFrom && customTo) {
      setDateRange(0); // signal custom mode
    }
  }, [customFrom, customTo]);

  const selectPresetRange = useCallback((days: number) => {
    setDateRange(days);
    setCustomFrom("");
    setCustomTo("");
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader active="flow" />
        <main className="mx-auto max-w-[1400px] px-4 py-4">
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span className="ml-3 text-sm text-muted">{t("flowLoading")}</span>
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
          <div className="py-20 text-center text-muted">{t("flowFailed")}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="flow" />

      {/* Click detail popup */}
      {clickedBar && <BarDetailPopup data={clickedBar} onClose={() => setClickedBar(null)} t={t} />}

      <main className="mx-auto max-w-[1400px] px-4 py-4 space-y-3">
        {/* Source badge */}
        <div className="flex items-center gap-2 text-[10px] text-muted">
          <span className="rounded bg-card-border px-1.5 py-0.5">
            {data.source === "live" ? "LIVE" : data.source === "cache" ? "CACHED" : "STALE"}
          </span>
          <span>{t("flowBasisDate")}: {data.asOf}</span>
          <span className="opacity-50">{t("flowYahooNote")}</span>
        </div>

        {/* Row 1: Chart + right stack */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          {/* Investor Net Flow Chart — spans 3 cols */}
          <section className={`${CARD} lg:col-span-3`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {t("flowInvestorNetFlow")}
                </h2>
              </div>
              <div className="flex gap-px rounded bg-card-border p-px">
                <button onClick={() => setChartMode("daily")} className={TAB_BTN(chartMode === "daily")}>{t("flowDaily")}</button>
                <button onClick={() => setChartMode("cumulative")} className={TAB_BTN(chartMode === "cumulative")}>{t("flowCumulative")}</button>
              </div>
            </div>

            {/* Date range selector */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="flex gap-px rounded bg-card-border p-px">
                {[5, 10, 30, 60, 90].map(d => (
                  <button
                    key={d}
                    onClick={() => selectPresetRange(d)}
                    className={TAB_BTN(dateRange === d && !customFrom)}
                  >
                    {d}{t("flowDays")}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 text-[10px]">
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="rounded border border-card-border bg-card-bg px-1.5 py-0.5 text-[10px] text-foreground"
                />
                <span className="text-muted">~</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="rounded border border-card-border bg-card-bg px-1.5 py-0.5 text-[10px] text-foreground"
                />
                <button
                  onClick={applyCustomRange}
                  className="rounded bg-accent px-2 py-0.5 text-[10px] text-white hover:bg-accent/80"
                >
                  OK
                </button>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={280}>
              {chartMode === "daily" ? (
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} onClick={handleBarClick}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2a37" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => fmtShortKRW(v)} />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(value, name) => [typeof value === "number" ? fmtShortKRW(value) : value, name]}
                    labelFormatter={(l) => String(l)}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, color: "#9ca3af" }} iconSize={8} />
                  <Bar dataKey="individual" name={t("flowIndividual")} fill="#60a5fa" stackId="a" cursor="pointer" />
                  <Bar dataKey="foreign" name={t("flowForeign")} fill="#22c55e" stackId="a" cursor="pointer" />
                  <Bar dataKey="institution" name={t("flowInstitution")} fill="#f59e0b" stackId="a" cursor="pointer" />
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2a37" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => fmtShortKRW(v)} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(value, name) => [typeof value === "number" ? fmtShortKRW(value) : value, name]} labelFormatter={(l) => String(l)} />
                  <Legend wrapperStyle={{ fontSize: 10, color: "#9ca3af" }} iconSize={8} />
                  <Line dataKey="individual" name={t("flowIndividual")} stroke="#60a5fa" dot={false} strokeWidth={1.5} />
                  <Line dataKey="foreign" name={t("flowForeign")} stroke="#22c55e" dot={false} strokeWidth={1.5} />
                  <Line dataKey="institution" name={t("flowInstitution")} stroke="#f59e0b" dot={false} strokeWidth={1.5} />
                </LineChart>
              )}
            </ResponsiveContainer>
            <p className="mt-1 text-[9px] text-muted/40 text-right">* {chartMode === "daily" ? t("flowDaily") : t("flowCumulative")} | {filteredNetFlow.length}{t("flowDays")}</p>
          </section>

          {/* Right stack: Top Net Buy + Top Trading Value */}
          <div className="space-y-3 lg:col-span-2">
            {/* Top Net Buy */}
            <section className={CARD}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{t("flowTopNetBuy")}</h2>
                </div>
                <div className="flex gap-px rounded bg-card-border p-px">
                  <button onClick={() => setNetBuyTab("foreign")} className={TAB_BTN(netBuyTab === "foreign")}>{t("flowForeign")}</button>
                  <button onClick={() => setNetBuyTab("institution")} className={TAB_BTN(netBuyTab === "institution")}>{t("flowInstitution")}</button>
                </div>
              </div>
              <DateBadge label={`${t("flowBasisDate")}: ${data.asOf} (${t("flowToday")})`} />
              <div className="overflow-x-auto mt-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-card-border">
                      <th className={TH}>{t("flowTicker")}</th>
                      <th className={TH}>{t("flowName")}</th>
                      <th className={`${TH} text-right`}>{t("flowNetBuy")}</th>
                      <th className={`${TH} text-right`}>{t("flowPrice")}</th>
                      <th className={`${TH} text-right`}>{t("flowChg")}</th>
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
              <SectionDot title={t("flowTopTradingValue")} />
              <DateBadge label={`${t("flowBasisDate")}: ${data.asOf}`} />
              <div className="overflow-x-auto mt-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-card-border">
                      <th className={TH}>{t("flowTicker")}</th>
                      <th className={TH}>{t("flowName")}</th>
                      <th className={`${TH} text-right`}>{t("flowValue")}</th>
                      <th className={`${TH} text-right`}>{t("flowPrice")}</th>
                      <th className={`${TH} text-right`}>{t("flowChg")}</th>
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

        {/* ── 투자자별 누적 순매수 ──────────────────────────────── */}
        <section className={CARD}>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SectionDot title={t("flowCumInvestor")} />
              <EstBadge label={t("flowEstimated")} />
            </div>
            <div className="flex gap-px rounded bg-card-border p-px">
              {([5, 20, 60] as const).map((p) => (
                <button key={p} onClick={() => setCumPeriod(p)} className={TAB_BTN(cumPeriod === p)}>
                  {p}{t("flowDays")}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={500}>
            <LineChart data={cumInvestorData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2a37" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => fmtShortKRW(v)} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(value, name) => [typeof value === "number" ? fmtShortKRW(value) : value, name]} labelFormatter={(l) => String(l)} />
              <Legend wrapperStyle={{ fontSize: 10, color: "#9ca3af" }} iconSize={8} />
              <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3" />
              <Line dataKey="foreign" name={t("flowForeign")} stroke="#22c55e" dot={false} strokeWidth={2} />
              <Line dataKey="institution" name={t("flowInstitution")} stroke="#60a5fa" dot={false} strokeWidth={2} />
              <Line dataKey="individual" name={t("flowIndividual")} stroke="#f59e0b" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </section>

        {/* ── 신용잔고 & 대차잔고 ──────────────────────────────── */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* LEFT: 신용잔고 */}
          <section className={CARD}>
            <SectionDot title={t("flowCreditBalance")} hint={t("flowCreditHint")} />
            <div className="mb-1 flex items-center gap-1">
              <EstBadge label={t("flowEstimated")} />
              <span className="text-[9px] text-muted/50">{t("flowCreditEstNote")}</span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.creditBalanceSeries} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2a37" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `${(v / 10000).toFixed(1)}조`} domain={["auto", "auto"]} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(value, name) => [typeof value === "number" ? fmtShortKRW(value) : value, name]} labelFormatter={(l) => String(l)} />
                <ReferenceLine
                  y={data.creditBalanceSeries[0]?.dangerZone || 25000}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: t("flowOverheatZone"), fill: "#ef4444", fontSize: 9, position: "right" }}
                />
                <Line dataKey="balance" name={t("flowCreditBalance")} stroke="#f59e0b" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
            {/* Signal interpretation */}
            <div className="mt-3 space-y-2 border-t border-card-border pt-3">
              <div className="rounded border border-yellow-500/20 bg-yellow-500/5 px-3 py-2">
                <p className="text-[10px] font-medium text-yellow-400">{lang === "kr" ? "현재 신호" : "Current Signal"}</p>
                <p className="mt-0.5 text-[10px] text-muted">
                  {(() => {
                    const series = data.creditBalanceSeries;
                    if (series.length < 2) return "—";
                    const latest = series[series.length - 1];
                    const prev = series[series.length - 2];
                    const trend = latest.balance > prev.balance;
                    const nearDanger = latest.balance >= latest.dangerZone * 0.95;
                    if (nearDanger) return lang === "kr" ? "신용잔고가 과열 구간에 근접. 조정 가능성 높음." : "Credit balance near danger zone. Correction risk elevated.";
                    if (trend) return lang === "kr" ? "신용잔고 증가 중. 매수 레버리지 확대 구간." : "Credit balance rising. Leveraged buying expanding.";
                    return lang === "kr" ? "신용잔고 감소 중. 디레버리징 진행." : "Credit balance declining. Deleveraging in progress.";
                  })()}
                </p>
              </div>
            </div>
          </section>

          {/* RIGHT: 대차잔고 */}
          <section className={CARD}>
            <SectionDot title={t("flowShortLending")} hint={t("flowShortHint")} />
            <div className="mb-1 flex items-center gap-1">
              <EstBadge label={t("flowEstimated")} />
              <span className="text-[9px] text-muted/50">{t("flowShortEstNote")}</span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.shortLendingSeries} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2a37" />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => `${(v / 10000).toFixed(1)}조`} domain={["auto", "auto"]} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(value, name) => [typeof value === "number" ? fmtShortKRW(value) : value, name]} labelFormatter={(l) => String(l)} />
                <Line dataKey="balance" name={t("flowShortLending")} stroke="#a78bfa" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 border-t border-card-border pt-2">
              <p className="mb-1.5 text-[10px] font-medium text-muted">{t("flowShortTop5")}</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-card-border/50">
                    <th className={TH}>{t("flowStock")}</th>
                    <th className={`${TH} text-right`}>{t("flowEstBalance")}</th>
                    <th className={`${TH} text-right`}>{t("flowSellDays")}</th>
                    <th className={`${TH} text-right`}>{t("flowChg")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topShortStocks.map((s) => (
                    <tr key={s.ticker} className="border-b border-card-border/30">
                      <td className={`${TD} text-accent`}>{s.name}</td>
                      <td className={`${TD} text-right tabular-nums`}>{fmtShortKRW(s.shortBalance)}</td>
                      <td className={`${TD} text-right tabular-nums text-muted`}>{s.sellDays}/10{t("flowDays")}</td>
                      <td className={`${TD} text-right tabular-nums`}><ChgPct v={s.chgPct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Signal interpretation */}
            <div className="mt-3 space-y-2 border-t border-card-border pt-3">
              <div className="rounded border border-purple-500/20 bg-purple-500/5 px-3 py-2">
                <p className="text-[10px] font-medium text-purple-400">{lang === "kr" ? "공매도 현황" : "Short Selling Status"}</p>
                <p className="mt-0.5 text-[10px] text-muted">
                  {(() => {
                    const series = data.shortLendingSeries;
                    if (series.length < 5) return "—";
                    const recent5 = series.slice(-5);
                    const avg = recent5.reduce((s, d) => s + d.balance, 0) / 5;
                    const latest = series[series.length - 1].balance;
                    if (latest > avg * 1.05) return lang === "kr" ? "대차잔고 증가 추세. 공매도 압력 확대 중." : "Short lending rising. Short-selling pressure increasing.";
                    if (latest < avg * 0.95) return lang === "kr" ? "대차잔고 감소 추세. 공매도 청산 진행." : "Short lending declining. Short covering in progress.";
                    return lang === "kr" ? "대차잔고 횡보 구간. 중립적 신호." : "Short lending flat. Neutral signal.";
                  })()}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* ── 프로그램 매매 ────────────────────────────────────── */}
        <section className={CARD}>
          <div className="mb-1 flex items-center gap-2">
            <SectionDot title={t("flowProgramTrading")} hint={t("flowProgramHint")} />
            <EstBadge label={t("flowEstimated")} />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.programTradingSeries} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2a37" />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => fmtShortKRW(v)} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(value, name) => [typeof value === "number" ? fmtShortKRW(value) : value, name]} labelFormatter={(l) => String(l)} />
              <Legend wrapperStyle={{ fontSize: 10, color: "#9ca3af" }} iconSize={8} />
              <ReferenceLine y={0} stroke="#374151" strokeDasharray="3 3" />
              <Bar dataKey="arbitrage" name={t("flowArbitrage")} fill="#6366f1" stackId="prog" />
              <Bar dataKey="nonArbitrage" name={t("flowNonArbitrage")} fill="#06b6d4" stackId="prog" />
            </BarChart>
          </ResponsiveContainer>
        </section>

        {/* Row 2: Avg Cost + Divergence */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Foreign Avg Cost */}
          <section className={CARD}>
            <SectionDot title={t("flowAvgCost")} />
            <DateBadge label={t("flowRecent60d")} />
            <div className="overflow-x-auto mt-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className={TH}>{t("flowTicker")}</th>
                    <th className={TH}>{t("flowName")}</th>
                    <th className={`${TH} text-right`}>{t("flowAvgCostCol")}</th>
                    <th className={`${TH} text-right`}>{t("flowLast")}</th>
                    <th className={`${TH} text-right`}>{t("flowGap")}</th>
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
            <SectionDot title={t("flowDivergence")} />
            <DateBadge label={`${t("flowBasisDate")}: ${data.asOf}`} />
            <div className="overflow-x-auto mt-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className={TH}>{t("flowTicker")}</th>
                    <th className={TH}>{t("flowName")}</th>
                    <th className={TH}>{t("flowSignal")}</th>
                    <th className={`${TH} text-right`}>{t("flowStreak")}</th>
                    <th className={`${TH} text-right`}>{t("flowTrend")}</th>
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
          <section className={CARD}>
            <SectionDot title={t("flowSectorNetBuy")} />
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.sectorFlow} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2a37" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: "#9ca3af" }} tickFormatter={(v: number) => fmtShortKRW(v)} />
                <YAxis type="category" dataKey="sector" tick={{ fontSize: 10, fill: "#e5e7eb" }} width={85} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(value) => [typeof value === "number" ? fmtShortKRW(value) : value, t("flowNetBuyLabel")]} />
                <Bar dataKey="netBuy" name={t("flowNetBuyLabel")} radius={[0, 4, 4, 0]}>
                  {data.sectorFlow.map((entry, index) => (
                    <Cell key={index} fill={entry.netBuy >= 0 ? "#22c55e" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className={CARD}>
            <SectionDot title={t("flowCumForeignTop10")} />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className={TH}>#</th>
                    <th className={TH}>{t("flowStock")}</th>
                    <th className={`${TH} text-right`}>5{t("flowDays")}</th>
                    <th className={`${TH} text-right`}>20{t("flowDays")}</th>
                    <th className={`${TH} text-right`}>60{t("flowDays")}</th>
                    <th className={`${TH} text-center`}>{t("flowTrend")}</th>
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
