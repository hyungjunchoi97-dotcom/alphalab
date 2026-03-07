"use client";

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

export default function Home() {
  const { t, lang } = useLang();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="dashboard" />

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
