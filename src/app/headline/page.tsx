"use client";

import { useState, useEffect, useCallback } from "react";
import AppHeader from "@/components/AppHeader";

interface Message {
  id: number;
  channel: string;
  channelTitle: string;
  text: string;
  date: number;
  link: string;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

async function translateText(text: string): Promise<string> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const json = await res.json();
    return json[0].map((item: [string]) => item[0]).join("");
  } catch {
    return "번역 실패";
  }
}

function HeadlineCard({ msg }: { msg: Message }) {
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [showKr, setShowKr] = useState(false);

  const handleTranslate = async () => {
    if (translated) {
      setShowKr(!showKr);
      return;
    }
    setTranslating(true);
    const result = await translateText(msg.text);
    setTranslated(result);
    setShowKr(true);
    setTranslating(false);
  };

  return (
    <div
      style={{
        borderBottom: "1px solid #1a1a1a",
        padding: "12px 16px",
        transition: "background 0.1s",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "#111")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>🚨 Bloomberg</span>
        <span style={{ fontSize: 10, color: "#555", fontFamily: "monospace" }}>{timeAgo(msg.date)}</span>
      </div>

      <p style={{
        fontSize: 14,
        color: "#e0e0e0",
        lineHeight: 1.7,
        margin: 0,
        fontFamily: "monospace",
      }}>
        {msg.text}
      </p>

      {showKr && translated && (
        <p style={{
          fontSize: 15,
          color: "#ffffff",
          lineHeight: 1.8,
          fontWeight: 500,
          margin: "8px 0 0",
          background: "#0d1117",
          padding: "10px 14px",
          borderRadius: 6,
          borderLeft: "3px solid #f59e0b",
        }}>
          {translated}
        </p>
      )}

      <button
        onClick={handleTranslate}
        style={{
          marginTop: 8,
          fontSize: 12,
          color: translating ? "#9ca3af" : showKr ? "#6b7280" : "#f59e0b",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        {translating ? "번역 중..." : showKr ? "원문 보기" : "🇰🇷 한국어 번역"}
      </button>
    </div>
  );
}

export default function HeadlinePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [oldestId, setOldestId] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [visibleCount, setVisibleCount] = useState(20);

  const fetchInitial = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/telegram/feed?channel=WalterBloomberg");
      const json = await res.json();
      if (json.ok) {
        const msgs: Message[] = json.messages || [];
        setMessages(msgs);
        if (msgs.length > 0) {
          setOldestId(Math.min(...msgs.map(m => m.id)));
        }
        setHasMore(msgs.length >= 15);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!oldestId || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/telegram/feed?channel=WalterBloomberg&before=${oldestId}`);
      const json = await res.json();
      if (json.ok) {
        const older: Message[] = json.messages || [];
        if (older.length === 0) {
          setHasMore(false);
        } else {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMsgs = older.filter(m => !existingIds.has(m.id));
            return [...prev, ...newMsgs].sort((a, b) => b.date - a.date);
          });
          setOldestId(Math.min(...older.map(m => m.id)));
          setHasMore(older.length >= 15);
        }
      }
    } finally {
      setLoadingMore(false);
    }
  }, [oldestId, loadingMore]);

  useEffect(() => { fetchInitial(); }, [fetchInitial]);

  const displayed = messages.slice(0, visibleCount);
  const canShowMore = visibleCount < messages.length;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e0e0e0" }}>
      <AppHeader active="headline" />
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "0 0 40px" }}>
        {/* Header */}
        <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid #1a1a1a" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#ef4444", fontFamily: "monospace" }}>
              HEADLINE
            </span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "#555", fontFamily: "monospace" }}>
              {messages.length}
            </span>
          </div>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0" }}>
            글로벌 속보
          </p>
        </div>

        {/* Messages */}
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#555", fontSize: 13 }}>로딩 중...</div>
        ) : (
          <>
            {displayed.map(msg => (
              <HeadlineCard key={msg.id} msg={msg} />
            ))}

            {canShowMore && (
              <button
                onClick={() => setVisibleCount(v => v + 20)}
                style={{
                  width: "100%", padding: "12px", background: "none",
                  border: "none", borderTop: "1px solid #1a1a1a",
                  color: "#f59e0b", fontSize: 12, cursor: "pointer",
                }}
              >
                더 보기 ({messages.length - visibleCount}개 남음)
              </button>
            )}

            {!canShowMore && hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  width: "100%", padding: "12px", background: "none",
                  border: "none", borderTop: "1px solid #1a1a1a",
                  color: "#60a5fa", fontSize: 12, cursor: "pointer",
                  opacity: loadingMore ? 0.5 : 1,
                }}
              >
                {loadingMore ? "불러오는 중..." : "이전 헤드라인 더 보기"}
              </button>
            )}

            {!hasMore && !canShowMore && (
              <div style={{ padding: 20, textAlign: "center", color: "#333", fontSize: 11 }}>
                모든 헤드라인을 불러왔습니다
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
