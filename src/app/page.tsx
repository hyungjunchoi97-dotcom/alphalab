"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import HeatmapTreemap from "@/components/HeatmapTreemap";
import NewsList from "@/components/NewsList";
import KoreaMovers from "@/components/KoreaMovers";
import MarketCalendar from "@/components/MarketCalendar";
import { useLang } from "@/lib/LangContext";
import AppHeader from "@/components/AppHeader";

function SectionHeader({
  title,
  trailing,
}: {
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          {title}
        </h2>
      </div>
      {trailing}
    </div>
  );
}

interface IndexPrices {
  "^GSPC"?: { close: number };
  "^VIX"?: { close: number };
  "^KS11"?: { close: number };
}

export default function Home() {
  const { t, lang } = useLang();
  const [indices, setIndices] = useState<IndexPrices>({});
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [secondsAgo, setSecondsAgo] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchIndices = useCallback(() => {
    fetch("/api/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols: ["^VIX", "^GSPC", "^KS11"] }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setIndices(j.prices);
          setLastRefresh(Date.now());
        }
      })
      .catch(() => {});
  }, []);

  // Fetch on mount + every 60s
  useEffect(() => {
    fetchIndices();
    const id = setInterval(fetchIndices, 60_000);
    return () => clearInterval(id);
  }, [fetchIndices]);

  // Tick "seconds ago" counter every second
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsAgo(lastRefresh != null ? Math.floor((Date.now() - lastRefresh) / 1000) : null);
    }, 1_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [lastRefresh]);

  const sp500 = indices["^GSPC"]?.close;
  const vix = indices["^VIX"]?.close;
  const kospi = indices["^KS11"]?.close;
  const vixColor = vix == null ? "text-muted" : vix < 20 ? "text-gain" : vix <= 30 ? "text-yellow-400" : "text-loss";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="dashboard">
        {sp500 != null && (
          <span className="rounded border border-card-border bg-background px-2 py-0.5 text-[10px] text-muted">
            S&P500: <span className="font-medium text-foreground">{sp500.toLocaleString()}</span>
          </span>
        )}
        {vix != null && (
          <span className="rounded border border-card-border bg-background px-2 py-0.5 text-[10px] text-muted">
            VIX: <span className={`font-medium ${vixColor}`}>{vix.toFixed(1)}</span>
          </span>
        )}
        {kospi != null && (
          <span className="rounded border border-card-border bg-background px-2 py-0.5 text-[10px] text-muted">
            KOSPI: <span className="font-medium text-foreground">{kospi.toLocaleString()}</span>
          </span>
        )}
        <span className="rounded border border-card-border bg-background px-2 py-0.5 text-[10px] text-muted tabular-nums">
          Last refresh: {secondsAgo != null ? `${secondsAgo}s ago` : "\u2014"}
        </span>
      </AppHeader>

      <main className="mx-auto max-w-[1400px] px-4 py-3">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Left column */}
          <div className="space-y-3">
            <section className="rounded-[12px] border border-card-border bg-card-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
              <SectionHeader title={t("marketHeatmap")} />
              <HeatmapTreemap />
            </section>

            <section className="rounded-[12px] border border-card-border bg-card-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
              <SectionHeader title={t("koreaMovers")} />
              <KoreaMovers />
            </section>

          </div>

          {/* Right column */}
          <div className="space-y-3">
            <section className="rounded-[12px] border border-card-border bg-card-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
              <SectionHeader title={lang === "kr" ? "시장 뉴스" : "Market News"} />
              <NewsList />
            </section>

            <section className="rounded-[12px] border border-card-border bg-card-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
              <SectionHeader title={t("marketCalendar")} />
              <MarketCalendar />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
