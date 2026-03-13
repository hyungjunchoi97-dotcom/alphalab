"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useLang } from "@/lib/LangContext";
import AppHeader from "@/components/AppHeader";
import type { MarketData } from "@/components/MarketOverview";

const MarketOverview = dynamic(() => import("@/components/MarketOverview"), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-[#1a1a1a] h-[110px] rounded" />,
});
const HeatmapTreemap = dynamic(() => import("@/components/HeatmapTreemap"), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-[#1a1a1a] h-full rounded" />,
});
const NewsList = dynamic(() => import("@/components/NewsList"), {
  loading: () => <div className="animate-pulse bg-[#1a1a1a] h-full rounded" />,
});
const MarketCalendar = dynamic(() => import("@/components/MarketCalendar"), {
  loading: () => <div className="animate-pulse bg-[#1a1a1a] h-full rounded" />,
});

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
      <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        {title}
      </h2>
    </div>
  );
}

// ── Fear & Greed mini gauge ─────────────────────────────────

function fgLabel(score: number, lang: "en" | "kr"): string {
  if (lang === "kr") {
    if (score >= 75) return "극도의 탐욕";
    if (score >= 55) return "탐욕";
    if (score >= 45) return "중립";
    if (score >= 25) return "공포";
    return "극도의 공포";
  }
  if (score >= 75) return "Extreme Greed";
  if (score >= 55) return "Greed";
  if (score >= 45) return "Neutral";
  if (score >= 25) return "Fear";
  return "Extreme Fear";
}

function fgColor(score: number): string {
  if (score >= 75) return "#16a34a";
  if (score >= 55) return "#65a30d";
  if (score >= 45) return "#eab308";
  if (score >= 25) return "#ea580c";
  return "#dc2626";
}

function FearGreedMini({ score, lang, fgFetchedAt }: { score: number; lang: "en" | "kr"; fgFetchedAt?: string }) {
  const W = 160;
  const H = 90;
  const cx = W / 2;
  const cy = 76;
  const r = 60;

  const zones = [
    { start: 180, end: 135, color: "#dc2626" },
    { start: 135, end: 99, color: "#ea580c" },
    { start: 99, end: 81, color: "#eab308" },
    { start: 81, end: 45, color: "#65a30d" },
    { start: 45, end: 0, color: "#16a34a" },
  ];

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const arcPath = (startDeg: number, endDeg: number) => {
    const outerR = r;
    const innerR = r - 12;
    const sR = toRad(startDeg);
    const eR = toRad(endDeg);
    const x1 = cx + outerR * Math.cos(sR), y1 = cy - outerR * Math.sin(sR);
    const x2 = cx + outerR * Math.cos(eR), y2 = cy - outerR * Math.sin(eR);
    const x3 = cx + innerR * Math.cos(eR), y3 = cy - innerR * Math.sin(eR);
    const x4 = cx + innerR * Math.cos(sR), y4 = cy - innerR * Math.sin(sR);
    const sweep = startDeg - endDeg > 180 ? 1 : 0;
    return `M${x1},${y1} A${outerR},${outerR} 0 ${sweep} 0 ${x2},${y2} L${x3},${y3} A${innerR},${innerR} 0 ${sweep} 1 ${x4},${y4} Z`;
  };

  const needleAngle = 180 - (score / 100) * 180;
  const needleRad = toRad(needleAngle);
  const needleLen = r - 8;
  const nx = cx + needleLen * Math.cos(needleRad);
  const ny = cy - needleLen * Math.sin(needleRad);

  return (
    <div className="flex flex-col items-center">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {zones.map((z, i) => (
          <path key={i} d={arcPath(z.start, z.end)} fill={z.color} opacity={0.6} />
        ))}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={3} fill="#fff" />
        <circle cx={cx} cy={cy} r={1.5} fill="#080c12" />
      </svg>
      <div className="flex items-center gap-2 -mt-2">
        <span className="text-lg font-bold tabular-nums font-mono text-white">{score}</span>
        <span className="text-[10px] font-semibold" style={{ color: fgColor(score) }}>
          {fgLabel(score, lang)}
        </span>
      </div>
      <span className="text-[8px] text-[#444] font-mono">Fear &amp; Greed Index</span>
      {fgFetchedAt && (() => {
        const diffMin = Math.round((Date.now() - new Date(fgFetchedAt).getTime()) / 60000);
        return (
          <span className="text-[8px] font-mono" style={{ color: "#333" }}>
            {diffMin < 2 ? "방금 업데이트" : `${diffMin}분 전 업데이트`}
          </span>
        );
      })()}
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────

export default function Home() {
  const { t, lang } = useLang();
  const [marketData, setMarketData] = useState<MarketData | null>(null);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <AppHeader active="dashboard" />

      <main className="flex-1 min-h-0 mx-auto w-full max-w-[1400px] px-3 py-2">
        <div className="grid grid-cols-2 gap-2 h-full">
          {/* Left column */}
          <div className="flex flex-col gap-2 min-h-0">
            {/* 주요 지수 히트맵 + Fear & Greed */}
            <section className="shrink-0 rounded-lg border border-card-border bg-card-bg p-3 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
              <SectionHeader title={lang === "kr" ? "주요 지수" : "Market Overview"} />
              <div className="flex gap-3 items-start">
                <div className="flex-1 min-w-0">
                  <MarketOverview onData={setMarketData} />
                </div>
                {marketData?.fearGreed && marketData.fearGreed.score > 0 && (
                  <div className="shrink-0">
                    <FearGreedMini score={marketData.fearGreed.score} lang={lang} fgFetchedAt={marketData.fgFetchedAt} />
                  </div>
                )}
              </div>
            </section>

            {/* 시장 히트맵 — fills remaining */}
            <section className="flex-1 min-h-0 rounded-lg border border-card-border bg-card-bg p-3 shadow-[0_1px_2px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col">
              <SectionHeader title={t("marketHeatmap")} />
              <div className="flex-1 min-h-0">
                <HeatmapTreemap />
              </div>
            </section>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-2 min-h-0">
            {/* 시장 뉴스 — fills remaining */}
            <section className="flex-1 min-h-0 rounded-lg border border-card-border bg-card-bg p-3 shadow-[0_1px_2px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col">
              <SectionHeader title={lang === "kr" ? "시장 뉴스" : "Market News"} />
              <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-500">
                <NewsList />
              </div>
            </section>

            {/* 시장 캘린더 — fixed height */}
            <section className="shrink-0 rounded-lg border border-card-border bg-card-bg p-3 shadow-[0_1px_2px_rgba(0,0,0,0.3)] overflow-hidden" style={{ height: 280 }}>
              <SectionHeader title={t("marketCalendar")} />
              <div className="h-[calc(100%-24px)] overflow-y-auto scroll-smooth [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-500">
                <MarketCalendar />
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
