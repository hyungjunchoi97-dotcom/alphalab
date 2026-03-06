"use client";

import { useState } from "react";
import { useLang } from "@/lib/LangContext";
import AppHeader from "@/components/AppHeader";
import { FOMO_IDEAS, VALUE_IDEAS, HIGH52_KR, HIGH52_US, type IdeaItem } from "@/lib/ideas.mock";

const CARD =
  "rounded-[12px] border border-card-border bg-card-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3)]";
const TH =
  "pb-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted";
const TD = "py-1.5";

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
};

function ChgPct({ v }: { v: number }) {
  return (
    <span className={v >= 0 ? "text-gain" : "text-loss"}>
      {v >= 0 ? "+" : ""}
      {v.toFixed(2)}%
    </span>
  );
}

export default function IdeasPage() {
  const { t } = useLang();
  const [tab, setTab] = useState<"fomo" | "value" | "high52">("fomo");
  const [high52Market, setHigh52Market] = useState<"KR" | "US">("KR");
  const [filter5d, setFilter5d] = useState(false);
  const [selected, setSelected] = useState<IdeaItem | null>(null);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rawIdeas =
    tab === "fomo"
      ? FOMO_IDEAS
      : tab === "value"
        ? VALUE_IDEAS
        : high52Market === "KR"
          ? HIGH52_KR
          : HIGH52_US;

  const ideas =
    tab === "high52" && filter5d
      ? rawIdeas.filter((i) => i.metrics.chg5d > 10)
      : rawIdeas;

  const handleSelect = (item: IdeaItem) => {
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
          headlines: selected.headlines,
          mode: tab === "high52" ? "high52" : tab,
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
        {/* Tab pills + sub-tabs + filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-px rounded bg-card-border p-px w-fit">
            {(["fomo", "value", "high52"] as const).map((tv) => (
              <button
                key={tv}
                onClick={() => {
                  setTab(tv);
                  setSelected(null);
                  setAiResult(null);
                  setError(null);
                  setFilter5d(false);
                }}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  tab === tv
                    ? "bg-accent text-white"
                    : "bg-card-bg text-muted hover:text-foreground"
                }`}
              >
                {tv === "fomo" ? "FOMO" : tv === "value" ? "VALUE" : "52W HIGH"}
              </button>
            ))}
          </div>

          {tab === "high52" && (
            <>
              <div className="flex gap-px rounded bg-card-border p-px w-fit">
                {(["KR", "US"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setHigh52Market(m);
                      setSelected(null);
                      setAiResult(null);
                      setError(null);
                    }}
                    className={`px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                      high52Market === m
                        ? "bg-accent text-white"
                        : "bg-card-bg text-muted hover:text-foreground"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-1.5 text-[10px] text-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filter5d}
                  onChange={(e) => setFilter5d(e.target.checked)}
                  className="accent-accent h-3 w-3"
                />
                Only 5D &gt; 10%
              </label>
            </>
          )}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          {/* Left: Ideas list */}
          <section className={`${CARD} lg:col-span-3`}>
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {tab === "fomo" ? "FOMO Ideas" : tab === "value" ? "Value-lite Ideas" : `52W High — ${high52Market}`}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className={TH}>Ticker</th>
                    <th className={TH}>Name</th>
                    <th className={`${TH} text-right`}>Price</th>
                    <th className={`${TH} text-right`}>Chg%</th>
                    <th className={TH}>Tag</th>
                  </tr>
                </thead>
                <tbody>
                  {ideas.map((item) => (
                    <tr
                      key={item.ticker}
                      onClick={() => handleSelect(item)}
                      className={`cursor-pointer border-b border-card-border/40 transition-colors ${
                        selected?.ticker === item.ticker
                          ? "bg-accent/10"
                          : "hover:bg-card-border/20"
                      }`}
                    >
                      <td className={`${TD} text-accent`}>{item.ticker}</td>
                      <td className={TD}>{item.name}</td>
                      <td className={`${TD} text-right tabular-nums`}>
                        {item.price.toLocaleString()}
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>
                        <ChgPct v={item.chgPct} />
                      </td>
                      <td className={TD}>
                        <span
                          className={`inline-block rounded px-1.5 py-px text-[9px] font-medium ${
                            TAG_COLORS[item.tag] || "bg-muted/20 text-muted"
                          }`}
                        >
                          {item.tag}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                Select a ticker from the list
              </p>
            ) : (
              <div className="space-y-3">
                {/* Ticker header */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-accent">
                      {selected.ticker}
                    </span>
                    <span className="ml-2 text-xs text-muted">
                      {selected.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">
                      ₩{selected.price.toLocaleString()}
                    </p>
                    <p className="text-[10px] tabular-nums">
                      <ChgPct v={selected.chgPct} />
                    </p>
                  </div>
                </div>

                {/* Metrics row */}
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["1D", selected.metrics.chg1d],
                      ["5D", selected.metrics.chg5d],
                      ["20D", selected.metrics.chg20d],
                    ] as const
                  ).map(([label, val]) => (
                    <div
                      key={label}
                      className="rounded border border-card-border/60 bg-background px-2.5 py-1.5"
                    >
                      <p className="text-[9px] uppercase tracking-wider text-muted">
                        {label}
                      </p>
                      <p className="mt-0.5 text-xs font-medium tabular-nums">
                        <ChgPct v={val} />
                      </p>
                    </div>
                  ))}
                </div>

                {/* Tag + badges */}
                <div className="flex flex-wrap gap-2 text-[10px]">
                  <span
                    className={`rounded px-1.5 py-px font-medium ${
                      TAG_COLORS[selected.tag] || "bg-muted/20 text-muted"
                    }`}
                  >
                    {selected.tag}
                  </span>
                  {selected.metrics.near52wHigh && (
                    <span className="rounded bg-gain/20 px-1.5 py-px font-medium text-gain">
                      Near 52W High
                    </span>
                  )}
                  {selected.metrics.volumeSpike && (
                    <span className="rounded bg-yellow-500/20 px-1.5 py-px font-medium text-yellow-400">
                      Vol Spike
                    </span>
                  )}
                </div>

                {/* Headlines */}
                {selected.headlines && selected.headlines.length > 0 && (
                  <div>
                    <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted">
                      Headlines
                    </p>
                    <ul className="space-y-0.5">
                      {selected.headlines.map((h, i) => (
                        <li
                          key={i}
                          className="text-[10px] leading-relaxed text-muted"
                        >
                          &bull; {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Explain button */}
                <button
                  onClick={handleExplain}
                  disabled={loading}
                  className="w-full rounded bg-accent px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {loading ? "Analyzing..." : "Explain move"}
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
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted">
                      AI Summary
                    </p>
                    <ul className="space-y-1">
                      {aiResult.bullets.map((b, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-1.5 text-xs leading-relaxed"
                        >
                          <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-accent" />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <div className="rounded border border-card-border/60 bg-background px-3 py-2">
                      <p className="text-[9px] uppercase tracking-wider text-muted">
                        Risk
                      </p>
                      <p className="mt-0.5 text-[10px] text-loss">
                        {aiResult.risk}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted">
                      <span>Confidence:</span>
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-card-border">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{
                            width: `${Math.round(aiResult.confidence * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="tabular-nums">
                        {Math.round(aiResult.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
