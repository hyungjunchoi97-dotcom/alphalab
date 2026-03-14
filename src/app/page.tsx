"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useLang } from "@/lib/LangContext";
import AppHeader from "@/components/AppHeader";

const HeatmapTreemap = dynamic(() => import("@/components/HeatmapTreemap"), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-[#1a1a1a] h-full rounded" />,
});

// ── Types ────────────────────────────────────────────────────

interface QuoteResult {
  price: number;
  changePct: number;
}

interface FearGreedData {
  score: number;
  rating: string;
}

interface TelegramMessage {
  id: number;
  channel: string;
  channelTitle: string;
  text: string;
  date: number;
  link: string;
}

// ── 7 Key Indices ────────────────────────────────────────────

const KEY_INDICES = [
  { label: "S&P500", symbol: "^GSPC", apiLabel: "S&P 500", key: "sp500" },
  { label: "KOSPI", symbol: "^KS11", apiLabel: "KOSPI", key: "kospi" },
  { label: "KOSDAQ", symbol: "^KQ11", apiLabel: "KOSDAQ", key: "kosdaq" },
  { label: "USD/KRW", symbol: "KRW=X", apiLabel: "USD/KRW", key: "usdkrw" },
  { label: "WTI", symbol: "CL=F", apiLabel: "WTI Oil", key: "wti" },
  { label: "Gold", symbol: "GC=F", apiLabel: "Gold", key: "gold" },
  { label: "BTC", symbol: "BTC-USD", apiLabel: "Bitcoin", key: "btc" },
];

function fmtPrice(price: number, key: string): string {
  if (key === "btc") return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (key === "usdkrw") return price.toFixed(1);
  if (key === "kospi" || key === "kosdaq") return price.toFixed(2);
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function tileBg(chg: number): string {
  if (chg > 0) return chg >= 2 ? "#0a4a0a" : chg >= 1 ? "#0d3d0d" : "#123312";
  if (chg < 0) return chg <= -2 ? "#4a0a0a" : chg <= -1 ? "#3d0d0d" : "#331212";
  return "#1a1a1a";
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

function FearGreedMini({ score, lang }: { score: number; lang: "en" | "kr" }) {
  const W = 140;
  const H = 78;
  const cx = W / 2;
  const cy = 66;
  const r = 52;

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
    const innerR = r - 10;
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
  const needleLen = r - 6;
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
      <div className="flex items-center gap-1.5 -mt-1">
        <span className="text-base font-bold tabular-nums font-mono text-white">{score}</span>
        <span className="text-[9px] font-semibold" style={{ color: fgColor(score) }}>
          {fgLabel(score, lang)}
        </span>
      </div>
      <span className="text-[7px] text-[#444] font-mono">Fear &amp; Greed</span>
    </div>
  );
}

// ── Telegram helpers ─────────────────────────────────────────

const CHANNEL_COLORS: Record<string, string> = {
  bumgore: "#60a5fa",
  Yeouido_Lab: "#4ade80",
  YeouidoStory2: "#2dd4bf",
  corevalue: "#c084fc",
  bzcftel: "#fb923c",
  slowstockT: "#f472b6",
  pef_news: "#f87171",
  decoded_narratives: "#facc15",
  NittanyLionLand: "#818cf8",
  hedgehara: "#22d3ee",
  aetherjapanresearch: "#34d399",
  daegurr: "#a78bfa",
};

function timeAgo(ts: number): string {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// ── Main ────────────────────────────────────────────────────

export default function Home() {
  const { lang } = useLang();

  // 7 key indices
  const [indices, setIndices] = useState<Record<string, QuoteResult | null>>({});
  const [indicesLoading, setIndicesLoading] = useState(true);

  // Fear & Greed
  const [fearGreed, setFearGreed] = useState<FearGreedData | null>(null);

  // Telegram feed
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const telegramInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch ticker data
  const fetchTicker = useCallback(async () => {
    try {
      const res = await fetch("/api/ticker");
      const json = await res.json();
      if (!json.ok && !json.market) return;
      const map: Record<string, QuoteResult | null> = {};
      for (const m of json.market ?? []) {
        const idx = KEY_INDICES.find((k) => k.apiLabel === m.label);
        if (idx) {
          map[idx.key] = { price: m.value ?? 0, changePct: m.changePct ?? 0 };
        }
      }
      setIndices(map);
    } catch { /* silent */ } finally {
      setIndicesLoading(false);
    }
  }, []);

  // Fetch Fear & Greed
  const fetchFG = useCallback(async () => {
    try {
      const res = await fetch("/api/macro/fear-greed");
      const json = await res.json();
      if (json.ok && json.data) {
        setFearGreed({ score: json.data.score, rating: json.data.rating ?? "" });
      }
    } catch { /* silent */ }
  }, []);

  // Fetch Telegram feed
  const fetchTelegram = useCallback(async () => {
    try {
      const res = await fetch("/api/telegram/feed");
      const json = await res.json();
      if (json.ok) {
        setMessages(json.messages || []);
      }
    } catch { /* silent */ } finally {
      setTelegramLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTicker();
    fetchFG();
    fetchTelegram();
    const tickerIv = setInterval(fetchTicker, 60_000);
    telegramInterval.current = setInterval(fetchTelegram, 3 * 60_000);
    return () => {
      clearInterval(tickerIv);
      if (telegramInterval.current) clearInterval(telegramInterval.current);
    };
  }, [fetchTicker, fetchFG, fetchTelegram]);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <AppHeader active="dashboard" />

      <main className="flex-1 min-h-0 mx-auto w-full max-w-[1400px] px-3 py-2">
        <div className="grid grid-cols-2 gap-2 h-full">
          {/* ── Left: KR Heatmap ── */}
          <section className="min-h-0 rounded-lg border border-card-border bg-card-bg p-3 shadow-[0_1px_2px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col">
            <div className="flex-1 min-h-0">
              <HeatmapTreemap />
            </div>
          </section>

          {/* ── Right: Indices + Telegram ── */}
          <div className="flex flex-col gap-2 min-h-0">
            {/* 7 Key Indices + Fear & Greed */}
            <section className="shrink-0 rounded-lg border border-card-border bg-card-bg p-3 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
              <div className="flex items-start gap-3">
                {/* Indices grid */}
                <div className="flex-1 min-w-0">
                  {indicesLoading ? (
                    <div className="grid grid-cols-4 gap-1">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="animate-pulse rounded bg-[#1a1a1a] h-[52px]" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-1">
                      {KEY_INDICES.map((idx) => {
                        const q = indices[idx.key];
                        if (!q) {
                          return (
                            <div key={idx.key} className="h-[52px] rounded bg-[#111] flex flex-col items-center justify-center">
                              <span className="text-[9px] text-[#444]">{idx.label}</span>
                              <span className="text-[9px] text-[#333]">—</span>
                            </div>
                          );
                        }
                        const chg = q.changePct;
                        return (
                          <div
                            key={idx.key}
                            className="h-[52px] rounded flex flex-col items-center justify-center"
                            style={{ background: tileBg(chg) }}
                          >
                            <span className="text-[9px] text-gray-400 leading-none">{idx.label}</span>
                            <span className="text-xs font-bold tabular-nums font-mono text-white mt-0.5 leading-none">
                              {fmtPrice(q.price, idx.key)}
                            </span>
                            <span className={`text-[10px] font-medium tabular-nums font-mono mt-0.5 leading-none ${chg >= 0 ? "text-green-400" : "text-red-400"}`}>
                              {chg >= 0 ? "+" : ""}{chg.toFixed(2)}%
                            </span>
                          </div>
                        );
                      })}
                      {/* 8th cell: empty for 4-col alignment */}
                      <div className="h-[52px]" />
                    </div>
                  )}
                </div>

                {/* Fear & Greed */}
                {fearGreed && fearGreed.score > 0 && (
                  <div className="shrink-0">
                    <FearGreedMini score={fearGreed.score} lang={lang} />
                  </div>
                )}
              </div>
            </section>

            {/* Telegram Feed */}
            <section className="flex-1 min-h-0 rounded-lg border border-card-border bg-card-bg p-3 shadow-[0_1px_2px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col">
              <div className="mb-2 flex items-center gap-2 shrink-0">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="#60a5fa">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
                <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {lang === "kr" ? "텔레그램 피드" : "Telegram Feed"}
                </h2>
                <span className="text-[9px] font-mono text-[#444] ml-auto">
                  {messages.length > 0 ? `${messages.length}` : ""}
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-500">
                {telegramLoading && messages.length === 0 && (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-3 w-20 rounded bg-[#1a1a1a] mb-1" />
                        <div className="h-3 w-full rounded bg-[#151515]" />
                      </div>
                    ))}
                  </div>
                )}

                {!telegramLoading && messages.length === 0 && (
                  <div className="text-center text-[10px] text-[#444] py-8">
                    {lang === "kr" ? "메시지가 없습니다" : "No messages"}
                  </div>
                )}

                {messages.map((msg) => {
                  const chColor = CHANNEL_COLORS[msg.channel] || "#888";
                  return (
                    <div
                      key={`${msg.channel}-${msg.id}`}
                      className="py-2.5 border-b border-[#1a1a1a] last:border-b-0"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[10px] font-bold"
                          style={{ color: chColor }}
                        >
                          {msg.channelTitle}
                        </span>
                        <span className="text-[9px] text-[#555] font-mono">
                          {timeAgo(msg.date)}
                        </span>
                        <a
                          href={msg.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-[9px] text-[#555] hover:text-amber-400 transition-colors"
                        >
                          {lang === "kr" ? "원문" : "Link"} &rarr;
                        </a>
                      </div>
                      <p className="text-[11px] text-[#ccc] leading-relaxed line-clamp-3 whitespace-pre-wrap">
                        {msg.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
