"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useLang } from "@/lib/LangContext";
import AppHeader from "@/components/AppHeader";

interface TelegramMessage {
  id: number;
  channel: string;
  channelTitle: string;
  text: string;
  date: number;
  link: string;
  imageUrl?: string;
}

interface Channel {
  username: string;
  title: string;
  category?: string;
}

const CATEGORIES = [
  { key: "kr_invest", label: "한국 투자", labelEn: "KR Investment" },
  { key: "kr_news", label: "한국 뉴스", labelEn: "KR News" },
  { key: "global", label: "글로벌", labelEn: "Global" },
];

function timeAgo(ts: number): string {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function formatTime(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const CHANNEL_COLORS: Record<string, { bg: string; text: string }> = {
  bumgore: { bg: "rgba(59,130,246,0.15)", text: "#60a5fa" },
  Yeouido_Lab: { bg: "rgba(34,197,94,0.15)", text: "#4ade80" },
  YeouidoStory2: { bg: "rgba(20,184,166,0.15)", text: "#2dd4bf" },
  corevalue: { bg: "rgba(168,85,247,0.15)", text: "#c084fc" },
  bzcftel: { bg: "rgba(249,115,22,0.15)", text: "#fb923c" },
  slowstockT: { bg: "rgba(236,72,153,0.15)", text: "#f472b6" },
  pef_news: { bg: "rgba(239,68,68,0.15)", text: "#f87171" },
  decoded_narratives: { bg: "rgba(234,179,8,0.15)", text: "#facc15" },
  NittanyLionLand: { bg: "rgba(99,102,241,0.15)", text: "#818cf8" },
  hedgehara: { bg: "rgba(6,182,212,0.15)", text: "#22d3ee" },
  aetherjapanresearch: { bg: "rgba(16,185,129,0.15)", text: "#34d399" },
  daegurr: { bg: "rgba(139,92,246,0.15)", text: "#a78bfa" },
};

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

function linkifyText(text: string) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0;
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ color: "#60a5fa" }}
          className="underline decoration-blue-400/30 hover:decoration-blue-400/60 break-all"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

function SkeletonMessage() {
  return (
    <div className="animate-pulse px-5 py-4" style={{ borderBottom: "1px solid #222222" }}>
      <div className="mb-2 flex items-center gap-2">
        <div className="h-5 w-20 rounded" style={{ background: "#222" }} />
        <div className="h-4 w-12 rounded" style={{ background: "#1a1a1a" }} />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-full rounded" style={{ background: "#1a1a1a" }} />
        <div className="h-4 w-3/4 rounded" style={{ background: "#1a1a1a" }} />
      </div>
    </div>
  );
}

const PAGE_SIZE = 20;

export default function TelegramPage() {
  const { lang } = useLang();
  const [allMessages, setAllMessages] = useState<TelegramMessage[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/telegram/feed");
      const json = await res.json();
      if (json.ok) {
        setAllMessages(json.messages || []);
        if (json.channels) setChannels(json.channels);
        setLastUpdate(Date.now());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchFeed();
    const id = setInterval(fetchFeed, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchFeed]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeChannel]);

  const filteredMessages = useMemo(
    () =>
      activeChannel
        ? allMessages.filter((m) => m.channel === activeChannel)
        : allMessages,
    [allMessages, activeChannel]
  );

  const displayMessages = filteredMessages.slice(0, visibleCount);
  const hasMore = visibleCount < filteredMessages.length;

  const channelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of allMessages) {
      counts.set(m.channel, (counts.get(m.channel) || 0) + 1);
    }
    return counts;
  }, [allMessages]);

  return (
    <div className="min-h-screen font-[family-name:var(--font-noto-sans-kr)]" style={{ background: "#0a0a0a" }}>
      <AppHeader active="telegram" />

      <main className="mx-auto max-w-[1400px] px-4 py-4">
        {/* Last updated bar */}
        {lastUpdate && (
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span style={{ color: "#888888", fontSize: "12px" }}>
                {lang === "kr" ? "마지막 업데이트" : "Last updated"}: {formatTime(lastUpdate)}
              </span>
            </div>
            <button
              onClick={() => {
                setLoading(true);
                fetchFeed();
              }}
              className="rounded-md px-3 py-1 text-xs transition-colors hover:bg-white/5"
              style={{ color: "#60a5fa", border: "1px solid #222222" }}
            >
              {lang === "kr" ? "새로고침" : "Refresh"}
            </button>
          </div>
        )}

        <div className="flex gap-4">
          {/* Left sidebar */}
          <aside className="hidden w-56 shrink-0 md:block">
            <div className="sticky top-4 rounded-xl p-3" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
              <button
                onClick={() => setActiveChannel(null)}
                className="w-full rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors"
                style={{
                  background: activeChannel === null ? "rgba(96,165,250,0.1)" : "transparent",
                  color: activeChannel === null ? "#60a5fa" : "#888888",
                  borderLeft: activeChannel === null ? "2px solid #60a5fa" : "2px solid transparent",
                }}
              >
                <span className="flex items-center justify-between">
                  <span>{lang === "kr" ? "전체보기" : "All Channels"}</span>
                  <span style={{ fontSize: "10px", color: "#555" }}>{allMessages.length}</span>
                </span>
              </button>

              {CATEGORIES.map((cat) => {
                const catChannels = channels.filter((ch) => ch.category === cat.key);
                if (catChannels.length === 0) return null;
                return (
                  <div key={cat.key} className="mt-4">
                    <h3
                      className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: "#555555" }}
                    >
                      {lang === "kr" ? cat.label : cat.labelEn}
                    </h3>
                    <div className="space-y-0.5">
                      {catChannels.map((ch) => {
                        const isActive = activeChannel === ch.username;
                        const color = CHANNEL_COLORS[ch.username];
                        return (
                          <button
                            key={ch.username}
                            onClick={() => setActiveChannel(ch.username)}
                            className="w-full rounded-lg px-3 py-2 text-left text-[12px] transition-all"
                            style={{
                              background: isActive ? "rgba(96,165,250,0.08)" : "transparent",
                              color: isActive ? (color?.text || "#60a5fa") : "#777777",
                              borderLeft: isActive ? `2px solid ${color?.text || "#60a5fa"}` : "2px solid transparent",
                            }}
                          >
                            <span className="flex items-center justify-between">
                              <span>{ch.title}</span>
                              <span style={{ fontSize: "10px", color: "#444" }}>
                                {channelCounts.get(ch.username) || 0}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Main feed */}
          <div className="min-w-0 flex-1">
            {/* Mobile channel tabs */}
            <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 md:hidden">
              <button
                onClick={() => setActiveChannel(null)}
                className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors"
                style={{
                  background: activeChannel === null ? "#60a5fa" : "#1a1a1a",
                  color: activeChannel === null ? "#000" : "#888",
                  border: "1px solid #222222",
                }}
              >
                {lang === "kr" ? "전체" : "All"}
              </button>
              {CATEGORIES.map((cat) => {
                const catChannels = channels.filter((ch) => ch.category === cat.key);
                return catChannels.map((ch) => (
                  <button
                    key={ch.username}
                    onClick={() => setActiveChannel(ch.username)}
                    className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors"
                    style={{
                      background: activeChannel === ch.username ? "#60a5fa" : "#1a1a1a",
                      color: activeChannel === ch.username ? "#000" : "#888",
                      border: "1px solid #222222",
                    }}
                  >
                    {ch.title}
                  </button>
                ));
              })}
            </div>

            {/* Feed header */}
            <div
              className="mb-0 flex items-center gap-2 rounded-t-xl px-5 py-3"
              style={{ background: "#111111", borderBottom: "1px solid #222222", border: "1px solid #222222" }}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#60a5fa">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
              <h2 className="text-sm font-semibold" style={{ color: "#e8e8e8" }}>
                {activeChannel
                  ? channels.find((c) => c.username === activeChannel)?.title || activeChannel
                  : lang === "kr"
                    ? "텔레그램 피드"
                    : "Telegram Feed"}
              </h2>
              <span
                className="rounded-full px-2 py-0.5 text-[10px]"
                style={{ background: "#1a1a1a", color: "#888888" }}
              >
                {filteredMessages.length} {lang === "kr" ? "개" : "msgs"}
              </span>
            </div>

            {/* Messages */}
            <div
              className="max-h-[calc(100vh-220px)] overflow-y-auto rounded-b-xl"
              style={{ background: "#111111", border: "1px solid #222222", borderTop: "none" }}
            >
              {loading && allMessages.length === 0 && (
                <>
                  <SkeletonMessage />
                  <SkeletonMessage />
                  <SkeletonMessage />
                  <SkeletonMessage />
                  <SkeletonMessage />
                </>
              )}

              {!loading && filteredMessages.length === 0 && (
                <div className="py-16 text-center text-sm" style={{ color: "#555" }}>
                  {lang === "kr" ? "메시지가 없습니다" : "No messages found"}
                </div>
              )}

              {displayMessages.map((msg) => {
                const color = CHANNEL_COLORS[msg.channel];
                return (
                  <a
                    key={`${msg.channel}-${msg.id}`}
                    href={msg.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-5 py-4 transition-colors"
                    style={{ borderBottom: "1px solid #222222" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "#333333";
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "#222222";
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <div className="mb-2 flex items-center gap-2.5">
                      <span
                        className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          background: color?.bg || "rgba(120,120,120,0.15)",
                          color: color?.text || "#888",
                        }}
                      >
                        {msg.channelTitle}
                      </span>
                      <span style={{ fontSize: "11px", color: "#888888" }}>
                        {msg.date ? timeAgo(msg.date) : ""}
                      </span>
                    </div>
                    <p
                      className="whitespace-pre-wrap leading-[1.7]"
                      style={{ fontSize: "15px", color: "#e8e8e8" }}
                    >
                      {linkifyText(msg.text)}
                    </p>
                    {msg.imageUrl && (
                      <div className="mt-3">
                        <img
                          src={msg.imageUrl}
                          alt=""
                          loading="lazy"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.open(msg.imageUrl, "_blank");
                          }}
                          className="cursor-zoom-in rounded-lg object-cover transition-opacity hover:opacity-90"
                          style={{
                            maxHeight: "300px",
                            maxWidth: "100%",
                            border: "1px solid #222222",
                          }}
                        />
                      </div>
                    )}
                  </a>
                );
              })}

              {hasMore && (
                <button
                  onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                  className="w-full py-4 text-center text-[12px] font-medium transition-colors hover:bg-white/5"
                  style={{ color: "#60a5fa", borderTop: "1px solid #222222" }}
                >
                  {lang === "kr"
                    ? `더 보기 (${filteredMessages.length - visibleCount}개 남음)`
                    : `Load more (${filteredMessages.length - visibleCount} remaining)`}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
