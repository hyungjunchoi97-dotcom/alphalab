"use client";

import { useState, useEffect, useCallback } from "react";
import AppHeader from "@/components/AppHeader";

interface NewsItem {
  id: number;
  title: string;
  titleKr?: string;
  url: string;
  source: string;
  publishedAt: string;
  currencies: string[];
  votes: { positive: number; negative: number; important: number };
}

type Filter = "all" | "BTC" | "ETH" | "alt";

const S: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function CryptoNewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch("/api/crypto/news");
      const json = await res.json();
      if (json.ok) setNews(json.news ?? []);
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchNews();
    const iv = setInterval(fetchNews, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [fetchNews]);

  const filtered = news.filter(n => {
    if (filter === "all") return true;
    if (filter === "BTC") return n.currencies.includes("BTC");
    if (filter === "ETH") return n.currencies.includes("ETH");
    // alt = has currencies but NOT BTC or ETH only
    return n.currencies.length > 0 && !n.currencies.every(c => c === "BTC" || c === "ETH");
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e0e0e0" }}>
      <AppHeader active="crypto" />
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px" }}>
        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ ...S, fontSize: 15, fontWeight: 700, color: "#f59e0b" }}>
            크립토 뉴스
          </h1>
          <p style={{ ...S, fontSize: 11, color: "#6b7280", marginTop: 2 }}>
            CryptoPanic via real-time aggregation
          </p>
        </div>

        {/* Filter tabs */}
        <div style={{
          display: "flex", gap: 4, marginBottom: 16, padding: 4,
          background: "#111", border: "1px solid #1f2937", borderRadius: 8,
          width: "fit-content",
        }}>
          {([
            { key: "all" as Filter, label: "전체" },
            { key: "BTC" as Filter, label: "BTC" },
            { key: "ETH" as Filter, label: "ETH" },
            { key: "alt" as Filter, label: "알트코인" },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                ...S, fontSize: 11, fontWeight: 500, padding: "5px 14px",
                borderRadius: 6, border: "none", cursor: "pointer",
                background: filter === tab.key ? "rgba(255,255,255,0.08)" : "transparent",
                color: filter === tab.key ? "#e0e0e0" : "#6b7280",
                transition: "all 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
          <span style={{ ...S, fontSize: 10, color: "#4b5563", marginLeft: 8, alignSelf: "center" }}>
            {filtered.length}
          </span>
        </div>

        {/* News list */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8 }}>
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ padding: "14px 16px", borderBottom: "1px solid #1f2937" }}>
                <div style={{ height: 10, width: 60, background: "#1a1a1a", borderRadius: 3, marginBottom: 8 }} />
                <div style={{ height: 14, width: "80%", background: "#1a1a1a", borderRadius: 3, marginBottom: 6 }} />
                <div style={{ height: 10, width: "50%", background: "#151515", borderRadius: 3 }} />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center", ...S, fontSize: 12, color: "#6b7280" }}>
              뉴스 데이터 없음
            </div>
          ) : (
            filtered.map((n, i) => (
              <a
                key={n.id}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block", padding: "14px 16px",
                  borderBottom: i < filtered.length - 1 ? "1px solid #1f2937" : "none",
                  textDecoration: "none", transition: "background 0.15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                {/* Top: source + currencies + time */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
                  {n.source && (
                    <span style={{
                      ...S, fontSize: 10, fontWeight: 600,
                      color: "#f59e0b", background: "rgba(245,158,11,0.1)",
                      padding: "1px 6px", borderRadius: 3,
                    }}>
                      {n.source}
                    </span>
                  )}
                  {n.currencies.map(c => (
                    <span key={c} style={{
                      ...S, fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 3,
                      background: c === "BTC" ? "rgba(247,147,26,0.15)" : c === "ETH" ? "rgba(98,126,234,0.15)" : "rgba(255,255,255,0.06)",
                      color: c === "BTC" ? "#f7931a" : c === "ETH" ? "#627eea" : "#9ca3af",
                    }}>
                      {c}
                    </span>
                  ))}
                  <span style={{ ...S, fontSize: 10, color: "#4b5563", marginLeft: "auto", flexShrink: 0 }}>
                    {timeAgo(n.publishedAt)}
                  </span>
                </div>

                {/* Title */}
                <div style={{ ...S, fontSize: 13, color: "#e0e0e0", lineHeight: 1.5 }}>{n.title}</div>

                {/* Korean translation */}
                {n.titleKr && (
                  <div style={{ ...S, fontSize: 11, color: "#9ca3af", lineHeight: 1.4, marginTop: 3 }}>{n.titleKr}</div>
                )}

                {/* Votes */}
                {(n.votes.positive > 0 || n.votes.important > 0) && (
                  <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
                    {n.votes.positive > 0 && (
                      <span style={{ ...S, fontSize: 10, color: "#4ade80" }}>+{n.votes.positive}</span>
                    )}
                    {n.votes.negative > 0 && (
                      <span style={{ ...S, fontSize: 10, color: "#f87171" }}>-{n.votes.negative}</span>
                    )}
                    {n.votes.important > 0 && (
                      <span style={{ ...S, fontSize: 10, color: "#f59e0b" }}>important {n.votes.important}</span>
                    )}
                  </div>
                )}
              </a>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
