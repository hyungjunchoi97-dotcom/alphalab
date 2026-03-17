"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
}

const REFRESH_INTERVAL = 3 * 60 * 1000; // 3 minutes

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

function truncateUrl(url: string, max: number = 50): string {
  if (url.length <= max) return url;
  return url.slice(0, max) + "...";
}

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
          className="text-sm text-blue-400 hover:text-blue-300 underline break-all"
        >
          {truncateUrl(part)}
        </a>
      );
    }
    return part;
  });
}

const MAX_LINES = 5;

function MessageText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = text.split("\n");
  const isLong = lines.length > MAX_LINES;

  const displayText = isLong && !expanded
    ? lines.slice(0, MAX_LINES).join("\n")
    : text;

  return (
    <div>
      <p
        className="whitespace-pre-wrap text-sm text-gray-100 leading-relaxed"
      >
        {linkifyText(displayText)}
        {isLong && !expanded && (
          <span style={{ color: "#555" }}>...</span>
        )}
      </p>
      {isLong && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="mt-1.5 text-[11px] font-medium transition-colors hover:opacity-80"
          style={{ color: "#60a5fa" }}
        >
          {expanded ? "접기 ▲" : "더 보기 ▼"}
        </button>
      )}
    </div>
  );
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
  const [channelSidebarOpen, setChannelSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pagination state per channel
  const [oldestIds, setOldestIds] = useState<Record<string, number | null>>({});
  const [hasMoreMap, setHasMoreMap] = useState<Record<string, boolean>>({});
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/telegram/feed");
      const json = await res.json();
      if (json.ok) {
        const msgs: TelegramMessage[] = json.messages || [];
        setAllMessages(msgs);
        if (json.channels) setChannels(json.channels);
        setLastUpdate(Date.now());
        setCountdown(REFRESH_INTERVAL / 1000);

        // Compute initial oldestId per channel
        const ids: Record<string, number | null> = {};
        const more: Record<string, boolean> = {};
        for (const m of msgs) {
          if (ids[m.channel] === undefined || (m.id < (ids[m.channel] ?? Infinity))) {
            ids[m.channel] = m.id;
          }
        }
        // Assume more pages exist initially
        for (const ch of (json.channels || [])) {
          more[ch.username] = true;
        }
        setOldestIds(ids);
        setHasMoreMap(more);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOlderMessages = useCallback(async (channel: string) => {
    const before = oldestIds[channel];
    if (!before || loadingMore) return;

    setLoadingMore(true);
    try {
      const res = await fetch(`/api/telegram/feed?channel=${channel}&before=${before}`);
      const json = await res.json();
      if (json.ok) {
        const older: TelegramMessage[] = json.messages || [];
        if (older.length === 0 || older.length < 15) {
          setHasMoreMap((prev) => ({ ...prev, [channel]: false }));
        }
        if (older.length > 0) {
          setAllMessages((prev) => {
            const existingIds = new Set(prev.map((m) => `${m.channel}-${m.id}`));
            const newMsgs = older.filter((m) => !existingIds.has(`${m.channel}-${m.id}`));
            return [...prev, ...newMsgs].sort((a, b) => b.date - a.date);
          });
          const newOldest = Math.min(...older.map((m) => m.id));
          setOldestIds((prev) => ({ ...prev, [channel]: newOldest }));
        }
      }
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  }, [oldestIds, loadingMore]);

  // Load older messages for ALL channels (전체보기 tab)
  const loadOlderAllChannels = useCallback(async () => {
    if (loadingMore) return;
    const targets = channels.filter((ch) => hasMoreMap[ch.username] && oldestIds[ch.username]);
    if (targets.length === 0) return;

    setLoadingMore(true);
    try {
      const results = await Promise.allSettled(
        targets.map(async (ch) => {
          const before = oldestIds[ch.username];
          if (!before) return { channel: ch.username, messages: [] as TelegramMessage[], count: 0 };
          const res = await fetch(`/api/telegram/feed?channel=${ch.username}&before=${before}`);
          const json = await res.json();
          const msgs: TelegramMessage[] = json.ok ? json.messages || [] : [];
          return { channel: ch.username, messages: msgs, count: msgs.length };
        })
      );

      const newMoreMap: Record<string, boolean> = {};
      const newOldestIds: Record<string, number> = {};
      let allOlder: TelegramMessage[] = [];

      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        const { channel: ch, messages: msgs, count } = r.value;
        if (count === 0 || count < 15) {
          newMoreMap[ch] = false;
        }
        if (msgs.length > 0) {
          allOlder = [...allOlder, ...msgs];
          newOldestIds[ch] = Math.min(...msgs.map((m) => m.id));
        }
      }

      if (allOlder.length > 0) {
        setAllMessages((prev) => {
          const existingIds = new Set(prev.map((m) => `${m.channel}-${m.id}`));
          const newMsgs = allOlder.filter((m) => !existingIds.has(`${m.channel}-${m.id}`));
          return [...prev, ...newMsgs].sort((a, b) => b.date - a.date);
        });
      }

      setHasMoreMap((prev) => ({ ...prev, ...newMoreMap }));
      setOldestIds((prev) => ({ ...prev, ...newOldestIds }));
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  }, [channels, hasMoreMap, oldestIds, loadingMore]);

  // Whether "all channels" still has more to load
  const hasMoreAll = useMemo(() => {
    return channels.some((ch) => hasMoreMap[ch.username] && oldestIds[ch.username]);
  }, [channels, hasMoreMap, oldestIds]);

  // IntersectionObserver for auto-loading in individual channel tabs
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Track whether sentinel-based fetch should fire (set after render)
  const canFetchMoreRef = useRef(false);

  useEffect(() => {
    if (!activeChannel) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && canFetchMoreRef.current && !loadingMore) {
          loadOlderMessages(activeChannel);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [activeChannel, loadingMore, loadOlderMessages]);

  // Auto-refresh every 3 minutes
  useEffect(() => {
    setLoading(true);
    fetchFeed();
    const id = setInterval(fetchFeed, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchFeed]);

  // Countdown timer
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [lastUpdate]);

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

  // Keep ref in sync so the IntersectionObserver callback can read it
  canFetchMoreRef.current = !!(activeChannel && !hasMore && hasMoreMap[activeChannel] && !loadingMore);

  const channelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of allMessages) {
      counts.set(m.channel, (counts.get(m.channel) || 0) + 1);
    }
    return counts;
  }, [allMessages]);

  // Channels with 0 messages after fetch
  const emptyChannels = useMemo(() => {
    if (loading || allMessages.length === 0) return new Set<string>();
    const set = new Set<string>();
    for (const ch of channels) {
      if (!channelCounts.has(ch.username) || channelCounts.get(ch.username) === 0) {
        set.add(ch.username);
      }
    }
    return set;
  }, [channels, channelCounts, loading, allMessages]);

  const countdownDisplay = countdown > 0
    ? `${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")}`
    : "0:00";

  return (
    <div className="min-h-screen font-[family-name:var(--font-noto-sans-kr)]" style={{ background: "#0a0a0a" }}>
      <AppHeader active="telegram" />

      <main className="w-full px-0 py-0">
        {/* Last updated bar */}
        {lastUpdate && (
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-[#f59e0b] animate-pulse" />
                <span className="text-xs text-gray-400">
                  {lang === "kr" ? "마지막 업데이트" : "Last updated"}: {formatTime(lastUpdate)}
                </span>
              </div>
              <span className="text-xs text-gray-400 tabular-nums">
                {lang === "kr" ? `다음 새로고침: ${countdownDisplay}` : `Next refresh: ${countdownDisplay}`}
              </span>
            </div>
            <button
              onClick={() => {
                setLoading(true);
                fetchFeed();
              }}
              className="text-xs bg-gray-800 text-gray-200 px-3 py-1 rounded hover:bg-gray-700 transition-colors"
            >
              {lang === "kr" ? "새로고침" : "Refresh"}
            </button>
          </div>
        )}

        <div className="flex gap-0">
          {/* Left sidebar */}
          <aside className={`hidden md:block shrink-0 transition-all duration-200 ${channelSidebarOpen ? "w-56" : "w-0 overflow-hidden"} border-r border-[#1e1e1e]`}>
            <div className="sticky top-4 rounded-xl p-3 overflow-y-auto max-h-[calc(100vh-120px)] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-track]:bg-transparent" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
              <button
                onClick={() => setActiveChannel(null)}
                className={`w-full rounded-lg py-2.5 px-3 text-left transition-colors ${
                  activeChannel === null
                    ? "bg-gray-800 border-l-2 border-yellow-500 text-white font-semibold text-sm"
                    : "border-l-2 border-transparent text-sm font-medium text-gray-200 hover:bg-gray-800/50"
                }`}
              >
                <span className="flex items-center justify-between">
                  <span>{lang === "kr" ? "전체보기" : "All Channels"}</span>
                  <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full">{allMessages.length}</span>
                </span>
              </button>

              <div className="mt-2 space-y-0.5">
                {channels.map((ch) => {
                  const isActive = activeChannel === ch.username;
                  const isEmpty = emptyChannels.has(ch.username);
                  return (
                    <button
                      key={ch.username}
                      onClick={() => setActiveChannel(ch.username)}
                      className={`w-full rounded-lg py-2.5 px-3 text-left transition-all ${
                        isActive
                          ? "bg-gray-800 border-l-2 border-yellow-500 text-white font-semibold text-sm"
                          : `border-l-2 border-transparent text-sm font-medium hover:bg-gray-800/50 ${isEmpty ? "text-gray-600 line-through" : "text-gray-200"}`
                      }`}
                    >
                      <span className="flex items-center justify-between">
                        <span>{ch.title}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${isEmpty ? "bg-gray-800 text-gray-600" : "bg-gray-700 text-gray-300"}`}>
                          {channelCounts.get(ch.username) || 0}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Main feed */}
          <div className="min-w-0 flex-1 px-4 py-4">
            {/* Channel sidebar toggle */}
            <button
              onClick={() => setChannelSidebarOpen(v => !v)}
              className="hidden md:flex items-center gap-1 px-3 py-1.5 text-xs text-[#666] hover:text-white transition-colors mb-3"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={channelSidebarOpen ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
              </svg>
              {channelSidebarOpen ? (lang === "kr" ? "채널 숨기기" : "Hide channels") : (lang === "kr" ? "채널 보기" : "Show channels")}
            </button>
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
              {channels.map((ch) => (
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
              ))}
            </div>

            {/* Feed header */}
            <div
              className="mb-0 flex items-center gap-2 rounded-t-xl px-5 py-3"
              style={{ background: "#111111", borderBottom: "1px solid #222222", border: "1px solid #222222" }}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#60a5fa">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
              <h2 className="text-base font-semibold text-white">
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
              className="max-h-[calc(100vh-220px)] overflow-y-auto rounded-b-xl [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-track]:bg-transparent"
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
                <div className="py-16 text-center" style={{ color: "#555" }}>
                  <p className="text-sm">
                    {activeChannel && emptyChannels.has(activeChannel)
                      ? (lang === "kr" ? "채널 비공개 또는 접근 불가" : "Channel is private or inaccessible")
                      : (lang === "kr" ? "메시지가 없습니다" : "No messages found")}
                  </p>
                </div>
              )}

              {displayMessages.map((msg) => (
                  <div
                    key={`${msg.channel}-${msg.id}`}
                    className="border border-gray-800 rounded-lg p-4 mb-3 mx-3 mt-3 bg-gray-900 hover:bg-[#1a1f2e] transition-colors"
                  >
                    <div className="mb-2 flex items-center gap-2.5">
                      <span className="text-sm font-bold text-yellow-400">
                        {msg.channelTitle}
                      </span>
                      <span className="text-xs text-gray-400">
                        {msg.date ? timeAgo(msg.date) : ""}
                      </span>
                      <a
                        href={msg.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-xs text-yellow-500 hover:text-yellow-400 transition-colors"
                      >
                        {lang === "kr" ? "원문" : "Link"} &rarr;
                      </a>
                    </div>
                    <MessageText text={msg.text} />
                    {msg.imageUrl && (
                      <div className="mt-3">
                        <img
                          src={msg.imageUrl}
                          alt=""
                          loading="lazy"
                          onClick={() => window.open(msg.imageUrl, "_blank")}
                          className="cursor-zoom-in rounded-lg object-cover transition-opacity hover:opacity-90"
                          style={{
                            maxHeight: "300px",
                            maxWidth: "100%",
                            border: "1px solid #222222",
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}

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

              {/* Individual channel: auto-load via IntersectionObserver */}
              {activeChannel && !hasMore && hasMoreMap[activeChannel] && (
                <>
                  {loadingMore && (
                    <div className="text-[11px] text-gray-600 text-center py-4 animate-pulse">
                      Loading...
                    </div>
                  )}
                  <div ref={sentinelRef} className="h-1" />
                </>
              )}

              {/* All channels: manual "이전 메시지 보기" button */}
              {!activeChannel && !hasMore && hasMoreAll && (
                <button
                  onClick={loadOlderAllChannels}
                  disabled={loadingMore}
                  className="w-full py-4 text-center text-[12px] font-medium transition-colors hover:bg-white/5 disabled:opacity-40"
                  style={{ color: "#60a5fa", borderTop: "1px solid #222222" }}
                >
                  {loadingMore
                    ? (lang === "kr" ? "불러오는 중..." : "Loading...")
                    : (lang === "kr" ? "이전 메시지 보기" : "Load older messages")}
                </button>
              )}

              {/* End of feed indicator */}
              {!hasMore && ((activeChannel && !hasMoreMap[activeChannel]) || (!activeChannel && !hasMoreAll)) && filteredMessages.length > 0 && (
                <div className="py-4 text-center text-[11px]" style={{ color: "#333" }}>
                  {lang === "kr" ? "모든 메시지를 불러왔습니다" : "All messages loaded"}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
