"use client";

import { useState, useEffect, useCallback } from "react";
import { useLang } from "@/lib/LangContext";
import AppHeader from "@/components/AppHeader";

interface TelegramMessage {
  id: number;
  channel: string;
  channelTitle: string;
  text: string;
  date: number;
  link: string;
}

interface Channel {
  username: string;
  title: string;
}

function timeAgo(ts: number): string {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// Channel color mapping
const CHANNEL_COLORS: Record<string, string> = {
  bumgore: "bg-blue-500/20 text-blue-400",
  Yeouido_Lab: "bg-emerald-500/20 text-emerald-400",
  YeouidoStory2: "bg-purple-500/20 text-purple-400",
  corevalue: "bg-orange-500/20 text-orange-400",
  bzcftel: "bg-pink-500/20 text-pink-400",
  slowstockT: "bg-cyan-500/20 text-cyan-400",
  pef_news: "bg-amber-500/20 text-amber-400",
  decoded_narratives: "bg-indigo-500/20 text-indigo-400",
};

function SkeletonMessage() {
  return (
    <div className="animate-pulse border-b border-card-border/20 py-3 px-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-4 w-16 rounded bg-card-border/40" />
        <div className="h-3 w-10 rounded bg-card-border/30" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-full rounded bg-card-border/30" />
        <div className="h-3 w-3/4 rounded bg-card-border/30" />
      </div>
    </div>
  );
}

export default function TelegramPage() {
  const { lang } = useLang();
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  const fetchFeed = useCallback(async () => {
    try {
      const url = activeChannel
        ? `/api/telegram/feed?channel=${activeChannel}`
        : "/api/telegram/feed";
      const res = await fetch(url);
      const json = await res.json();
      if (json.ok) {
        setMessages(json.messages || []);
        if (json.channels) setChannels(json.channels);
        setLastUpdate(Date.now());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [activeChannel]);

  useEffect(() => {
    setLoading(true);
    fetchFeed();
    const id = setInterval(fetchFeed, 5 * 60 * 1000); // 5min refresh
    return () => clearInterval(id);
  }, [fetchFeed]);

  const filteredMessages = activeChannel
    ? messages.filter((m) => m.channel === activeChannel)
    : messages;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="telegram" />

      <main className="mx-auto max-w-[1400px] px-4 py-4">
        <div className="flex gap-4">
          {/* Left sidebar — channel list */}
          <aside className="hidden w-56 shrink-0 md:block">
            <div className="sticky top-4 rounded-[12px] border border-card-border bg-card-bg p-3 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
              <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted">
                {lang === "kr" ? "채널 목록" : "Channels"}
              </h2>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveChannel(null)}
                  className={`w-full rounded px-3 py-2 text-left text-xs transition-colors ${
                    activeChannel === null
                      ? "bg-accent/15 font-medium text-accent"
                      : "text-muted hover:bg-card-border/30 hover:text-foreground"
                  }`}
                >
                  {lang === "kr" ? "전체보기" : "All Channels"}
                </button>
                {channels.map((ch) => (
                  <button
                    key={ch.username}
                    onClick={() => setActiveChannel(ch.username)}
                    className={`w-full rounded px-3 py-2 text-left text-xs transition-colors ${
                      activeChannel === ch.username
                        ? "bg-accent/15 font-medium text-accent"
                        : "text-muted hover:bg-card-border/30 hover:text-foreground"
                    }`}
                  >
                    <span className="mr-1.5 text-[10px]">@</span>
                    {ch.title}
                  </button>
                ))}
              </div>

              {lastUpdate && (
                <div className="mt-4 border-t border-card-border/30 pt-2 text-[9px] text-muted/50">
                  {lang === "kr" ? "마지막 업데이트" : "Last updated"}: {timeAgo(lastUpdate)}
                </div>
              )}
            </div>
          </aside>

          {/* Main feed */}
          <div className="min-w-0 flex-1">
            {/* Mobile channel tabs */}
            <div className="mb-3 flex gap-1 overflow-x-auto md:hidden">
              <button
                onClick={() => setActiveChannel(null)}
                className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-medium transition-colors ${
                  activeChannel === null
                    ? "bg-accent text-white"
                    : "bg-card-border/40 text-muted"
                }`}
              >
                {lang === "kr" ? "전체" : "All"}
              </button>
              {channels.map((ch) => (
                <button
                  key={ch.username}
                  onClick={() => setActiveChannel(ch.username)}
                  className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-medium transition-colors ${
                    activeChannel === ch.username
                      ? "bg-accent text-white"
                      : "bg-card-border/40 text-muted"
                  }`}
                >
                  {ch.title}
                </button>
              ))}
            </div>

            <div className="rounded-[12px] border border-card-border bg-card-bg shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-card-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                  <h2 className="text-xs font-semibold">
                    {activeChannel
                      ? channels.find((c) => c.username === activeChannel)?.title || activeChannel
                      : lang === "kr" ? "텔레그램 피드" : "Telegram Feed"}
                  </h2>
                  <span className="rounded-full bg-card-border/40 px-2 py-0.5 text-[9px] text-muted">
                    {filteredMessages.length} {lang === "kr" ? "개" : "msgs"}
                  </span>
                </div>
                <button
                  onClick={() => { setLoading(true); fetchFeed(); }}
                  className="rounded px-2 py-1 text-[10px] text-muted transition-colors hover:bg-card-border/30 hover:text-foreground"
                >
                  {lang === "kr" ? "새로고침" : "Refresh"}
                </button>
              </div>

              {/* Messages */}
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
                {loading && messages.length === 0 && (
                  <>
                    <SkeletonMessage />
                    <SkeletonMessage />
                    <SkeletonMessage />
                    <SkeletonMessage />
                    <SkeletonMessage />
                  </>
                )}

                {!loading && filteredMessages.length === 0 && (
                  <div className="py-12 text-center text-xs text-muted">
                    {lang === "kr" ? "메시지가 없습니다" : "No messages found"}
                  </div>
                )}

                {filteredMessages.map((msg) => (
                  <a
                    key={`${msg.channel}-${msg.id}`}
                    href={msg.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border-b border-card-border/20 px-4 py-3 transition-colors hover:bg-card-border/10"
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                          CHANNEL_COLORS[msg.channel] || "bg-card-border/40 text-muted"
                        }`}
                      >
                        {msg.channelTitle}
                      </span>
                      <span className="text-[9px] text-muted/50">
                        {msg.date ? timeAgo(msg.date) : ""}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                      {msg.text}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
