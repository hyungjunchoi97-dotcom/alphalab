"use client";

import { useState, useEffect, useMemo } from "react";
import PortfolioSection from "@/components/PortfolioSection";
import NewsList from "@/components/NewsList";
import { useLang } from "@/lib/LangContext";
import AppHeader from "@/components/AppHeader";
import { useAuth } from "@/context/AuthContext";

export default function PortfolioPage() {
  const { t } = useLang();
  const { session } = useAuth();
  const [symbols, setSymbols] = useState<string[]>([]);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch("/api/portfolio", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((j) => {
        if (j.ok && j.holdings) {
          const syms = j.holdings.map((h: { symbol: string }) => h.symbol).filter(Boolean);
          setSymbols(syms);
        }
      })
      .catch(() => {});
  }, [session?.access_token]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableSymbols = useMemo(() => symbols, [symbols.join(",")]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="portfolio" />

      <main className="mx-auto max-w-[1400px] px-4 py-4 space-y-3">
        <section className="rounded-[12px] border border-card-border bg-card-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {t("portfolioAllocation")}
            </h2>
          </div>
          <PortfolioSection />
        </section>

        <section className="rounded-[12px] border border-card-border bg-card-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {t("portfolioNews")}
              </h2>
            </div>
            <span className="cursor-pointer text-[10px] text-accent hover:underline">
              {t("viewAll")}
            </span>
          </div>
          <NewsList symbols={stableSymbols.length > 0 ? stableSymbols : undefined} />
        </section>
      </main>
    </div>
  );
}
