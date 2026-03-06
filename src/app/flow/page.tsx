"use client";

import { useState, useMemo } from "react";
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
} from "recharts";
import { useLang } from "@/lib/LangContext";
import AppHeader from "@/components/AppHeader";
import {
  NET_FLOW_SERIES,
  TOP_NET_BUY,
  TOP_TRADING_VALUE,
  AVG_COST_ESTIMATE,
  DIVERGENCE_CANDIDATES,
} from "@/lib/flow.mock";

const CARD = "rounded-[12px] border border-card-border bg-card-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3)]";
const TH = "pb-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted";
const TD = "py-1.5";

function fmtKRW(v: number) {
  const abs = Math.abs(v);
  if (abs >= 10000) return `₩${(v / 10000).toFixed(1)}조`;
  return `₩${v.toLocaleString()}억`;
}

function fmtShortKRW(v: number) {
  return `${v.toLocaleString()}억`;
}

function SectionDot({ title }: { title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {title}
      </h2>
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

// ─── Main page ────────────────────────────────────────────────

export default function FlowPage() {
  const { t } = useLang();
  const [chartMode, setChartMode] = useState<"daily" | "cumulative">("daily");
  const [netBuyTab, setNetBuyTab] = useState<"foreign" | "institution">("foreign");

  const cumulativeData = useMemo(() => {
    let ci = 0, cf = 0, cinst = 0;
    return NET_FLOW_SERIES.map((d) => {
      ci += d.individual;
      cf += d.foreign;
      cinst += d.institution;
      return { date: d.date, individual: ci, foreign: cf, institution: cinst };
    });
  }, []);

  const chartData = chartMode === "daily" ? NET_FLOW_SERIES : cumulativeData;

  const filteredNetBuy = TOP_NET_BUY.filter((r) => r.side === netBuyTab);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="flow" />

      <main className="mx-auto max-w-[1400px] px-4 py-4 space-y-3">
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
                  <button
                    key={m}
                    onClick={() => setChartMode(m)}
                    className={`px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                      chartMode === m
                        ? "bg-accent text-white"
                        : "bg-card-bg text-muted hover:text-foreground"
                    }`}
                  >
                    {m === "daily" ? "Daily" : "Cumulative"}
                  </button>
                ))}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={280}>
              {chartMode === "daily" ? (
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2a37" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: "#9ca3af" }}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#9ca3af" }}
                    tickFormatter={(v: number) => fmtShortKRW(v)}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(value, name) => [typeof value === "number" ? fmtShortKRW(value) : value, name]}
                    labelFormatter={(l) => String(l)}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 10, color: "#9ca3af" }}
                    iconSize={8}
                  />
                  <Bar dataKey="individual" name="Individual" fill="#60a5fa" stackId="a" />
                  <Bar dataKey="foreign" name="Foreign" fill="#22c55e" stackId="a" />
                  <Bar dataKey="institution" name="Institution" fill="#f59e0b" stackId="a" />
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2a37" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: "#9ca3af" }}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#9ca3af" }}
                    tickFormatter={(v: number) => fmtShortKRW(v)}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(value, name) => [typeof value === "number" ? fmtShortKRW(value) : value, name]}
                    labelFormatter={(l) => String(l)}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 10, color: "#9ca3af" }}
                    iconSize={8}
                  />
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
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Top Net Buy
                  </h2>
                </div>
                <div className="flex gap-px rounded bg-card-border p-px">
                  {(["foreign", "institution"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setNetBuyTab(s)}
                      className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                        netBuyTab === s
                          ? "bg-accent text-white"
                          : "bg-card-bg text-muted hover:text-foreground"
                      }`}
                    >
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
                      <td className={`${TD} text-right tabular-nums`}>{r.price.toLocaleString()}</td>
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
                  {TOP_TRADING_VALUE.map((r) => (
                    <tr key={r.ticker} className="border-b border-card-border/40 hover:bg-card-border/20">
                      <td className={`${TD} text-accent`}>{r.ticker}</td>
                      <td className={TD}>{r.name}</td>
                      <td className={`${TD} text-right tabular-nums`}>{fmtKRW(r.tradingValue)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{r.price.toLocaleString()}</td>
                      <td className={`${TD} text-right tabular-nums`}><ChgPct v={r.chgPct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </section>
          </div>
        </div>

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
                {AVG_COST_ESTIMATE.map((r) => (
                  <tr key={r.ticker} className="border-b border-card-border/40 hover:bg-card-border/20">
                    <td className={`${TD} text-accent`}>{r.ticker}</td>
                    <td className={TD}>{r.name}</td>
                    <td className={`${TD} text-right tabular-nums`}>{r.foreignAvgCost.toLocaleString()}</td>
                    <td className={`${TD} text-right tabular-nums`}>{r.lastPrice.toLocaleString()}</td>
                    <td className={`${TD} text-right tabular-nums`}>
                      <ChgPct v={r.distancePct} />
                    </td>
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
                {DIVERGENCE_CANDIDATES.map((r) => (
                  <tr key={r.ticker} className="border-b border-card-border/40 hover:bg-card-border/20">
                    <td className={`${TD} text-accent`}>{r.ticker}</td>
                    <td className={TD}>{r.name}</td>
                    <td className={`${TD} text-muted`}>{r.reason}</td>
                    <td className={`${TD} text-right`}>
                      <span className={`inline-block rounded px-1.5 py-px text-[10px] font-medium ${
                        r.foreignStreakDays > 0
                          ? "bg-gain/20 text-gain"
                          : "bg-loss/20 text-loss"
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
      </main>
    </div>
  );
}
