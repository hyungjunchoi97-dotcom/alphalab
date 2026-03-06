"use client";

import NewsList from "@/components/NewsList";
import { useLang } from "@/lib/LangContext";
import AppHeader from "@/components/AppHeader";

export default function PortfolioPage() {
  const { t } = useLang();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="portfolio" />

      <main className="mx-auto max-w-[1400px] px-4 py-4 space-y-3">
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
          <NewsList />
        </section>
      </main>
    </div>
  );
}
