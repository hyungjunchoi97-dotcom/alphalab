"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { useLang } from "@/lib/LangContext";
import AppHeader from "@/components/AppHeader";
import ShareButton from "@/components/ShareButton";

const HeatmapTreemap = dynamic(() => import("@/components/HeatmapTreemap"), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-[#1a1a1a] h-full rounded" />,
});

// ── Types ────────────────────────────────────────────────────

interface QuoteResult {
  price: number;
  changePct: number;
}

interface TelegramMessage {
  id: number;
  channel: string;
  channelTitle: string;
  text: string;
  date: number;
  link: string;
  imageUrl?: string;
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
  dntjd0903: "#f43f5e",
  dancoininvestor: "#06b6d4",
  survival_DoPB: "#e879f9",
  yieldnspread: "#84cc16",
  Barbarian_Global_Tech: "#fb923c",
};

function renderTextWithLinks(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          className="text-amber-400 underline break-all hover:text-amber-300"
        >{part}</a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
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
    fetchTelegram();
    const tickerIv = setInterval(fetchTicker, 60_000);
    telegramInterval.current = setInterval(fetchTelegram, 3 * 60_000);
    return () => {
      clearInterval(tickerIv);
      if (telegramInterval.current) clearInterval(telegramInterval.current);
    };
  }, [fetchTicker, fetchTelegram]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader active="dashboard" />

      <main className="flex-1 w-full px-3 py-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:h-[calc(100vh-60px)]">
          {/* ── Left: KR Heatmap ── */}
          <section className="h-[420px] md:h-auto md:min-h-0 rounded-lg border border-card-border bg-card-bg p-3 shadow-[0_1px_2px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col">
            <div className="flex-1 min-h-0">
              <HeatmapTreemap />
            </div>
          </section>

          {/* ── Right: Indices + Telegram ── */}
          <div className="flex flex-col gap-2 md:min-h-0 md:h-full">
            {/* 7 Key Indices — single row */}
            <section className="shrink-0 rounded-lg border border-card-border bg-card-bg px-2 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
              {indicesLoading ? (
                <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="animate-pulse rounded bg-[#1a1a1a] h-[48px]" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
                  {KEY_INDICES.map((idx) => {
                    const q = indices[idx.key];
                    if (!q) {
                      return (
                        <div key={idx.key} className="h-[48px] rounded bg-[#111] flex flex-col items-center justify-center">
                          <span className="text-[10px] text-[#444]">{idx.label}</span>
                          <span className="text-[10px] text-[#333]">—</span>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={idx.key}
                        className="h-[52px] rounded flex flex-col items-center justify-center px-1 bg-[#111]"
                      >
                        <span style={{ fontSize: 10, color: "#9ca3af", lineHeight: 1 }}>{idx.label}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: "#ffffff", marginTop: 2, lineHeight: 1 }}>
                          {fmtPrice(q.price, idx.key)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Telegram Feed */}
            <section className="h-[500px] md:flex-1 md:min-h-0 rounded-lg border border-card-border bg-card-bg p-3 shadow-[0_1px_2px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col">
              <div className="mb-2 flex items-center gap-2 shrink-0">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="#60a5fa">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {lang === "kr" ? "텔레그램 피드" : "Telegram Feed"}
                </h2>
                <span className="text-[10px] font-mono text-[#555] ml-auto">
                  {messages.length > 0 ? `${messages.length}` : ""}
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-500">
                {telegramLoading && messages.length === 0 && (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-3 w-24 rounded bg-[#1a1a1a] mb-1.5" />
                        <div className="h-4 w-full rounded bg-[#151515]" />
                      </div>
                    ))}
                  </div>
                )}

                {!telegramLoading && messages.length === 0 && (
                  <div className="text-center text-xs text-[#555] py-8">
                    {lang === "kr" ? "메시지가 없습니다" : "No messages"}
                  </div>
                )}

                {messages.map((msg) => {
                  const chColor = CHANNEL_COLORS[msg.channel] || "#888";
                  return (
                    <div
                      key={`${msg.channel}-${msg.id}`}
                      className="py-3 border-b border-[#222] last:border-b-0"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className="text-xs font-bold"
                          style={{ color: chColor }}
                        >
                          {msg.channelTitle}
                        </span>
                        <span className="text-[10px] text-[#999] font-mono">
                          {timeAgo(msg.date)}
                        </span>
                      </div>
                      {msg.imageUrl && (
                        <img
                          src={msg.imageUrl}
                          alt=""
                          className="mb-2 rounded max-h-48 w-auto object-cover"
                          loading="lazy"
                        />
                      )}
                      <p className="text-sm text-[#e0e0e0] leading-relaxed whitespace-pre-wrap">
                        {renderTextWithLinks(msg.text)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </main>
      <ShareButton title="AlphaLab 대시보드" description="실시간 주식 히트맵, 매크로 지표, 텔레그램 피드" />
    </div>
  );
}
