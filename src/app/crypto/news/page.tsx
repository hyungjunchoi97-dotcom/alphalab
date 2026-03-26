"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import AppHeader from "@/components/AppHeader";

interface NewsItem {
  id: number;
  title: string;
  titleKr?: string;
  url: string;
  source: string;
  publishedAt: string;
  currencies: string[];
}

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

const PAGE_SIZE = 20;

export default function CryptoNewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);

  const fetchNews = useCallback(async (offset: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/crypto/news?offset=${offset}&limit=${PAGE_SIZE}`);
      const json = await res.json();
      if (json.ok) {
        const items: NewsItem[] = json.news ?? [];
        if (append) {
          setNews(prev => {
            const ids = new Set(prev.map(n => n.id));
            const unique = items.filter(n => !ids.has(n.id));
            return [...prev, ...unique];
          });
        } else {
          setNews(items);
        }
        setHasMore(json.hasMore ?? false);
        offsetRef.current = offset + items.length;
      }
    } catch { /* */ }
    finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial load + auto-refresh
  useEffect(() => {
    fetchNews(0, false);
    const iv = setInterval(() => {
      offsetRef.current = 0;
      fetchNews(0, false);
    }, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [fetchNews]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchNews(offsetRef.current, true);
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, fetchNews]);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e0e0e0" }}>
      <AppHeader active="crypto" />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px" }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ ...S, fontSize: 15, fontWeight: 700, color: "#f59e0b" }}>
            크립토 핫 뉴스
          </h1>
          <p style={{ ...S, fontSize: 11, color: "#4b5563", marginTop: 2 }}>
            Real-time crypto news aggregation
          </p>
        </div>

        {/* News list */}
        {loading ? (
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ padding: "14px 16px", borderBottom: "1px solid #1f2937" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ height: 10, width: 60, background: "#1a1a1a", borderRadius: 3 }} />
                  <div style={{ height: 10, width: 24, background: "#1a1a1a", borderRadius: 3 }} />
                </div>
                <div style={{ height: 14, width: "85%", background: "#1a1a1a", borderRadius: 3, marginBottom: 6 }} />
                <div style={{ height: 12, width: "60%", background: "#151515", borderRadius: 3 }} />
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <div style={{
            background: "#111", border: "1px solid #1f2937", borderRadius: 8,
            padding: "40px 16px", textAlign: "center", ...S, fontSize: 12, color: "#6b7280",
          }}>
            뉴스 데이터 없음
          </div>
        ) : (
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8 }}>
            {news.map((n, i) => (
              <a
                key={n.id}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block", padding: "14px 16px",
                  borderBottom: i < news.length - 1 ? "1px solid #1f2937" : "none",
                  textDecoration: "none", transition: "background 0.15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                {/* Top row: source + time */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {n.source && (
                      <span style={{
                        ...S, fontSize: 10, fontWeight: 600,
                        color: "#f59e0b", background: "rgba(245,158,11,0.1)",
                        padding: "2px 7px", borderRadius: 3,
                      }}>
                        {n.source}
                      </span>
                    )}
                  </div>
                  <span style={{ ...S, fontSize: 10, color: "#4b5563", flexShrink: 0 }}>
                    {timeAgo(n.publishedAt)}
                  </span>
                </div>

                {/* Title */}
                <div style={{ ...S, fontSize: 13, color: "#e0e0e0", lineHeight: 1.6 }}>
                  {n.title}
                </div>

                {/* Korean translation */}
                {n.titleKr && (
                  <div style={{ ...S, fontSize: 11, color: "#6b7280", lineHeight: 1.5, marginTop: 3 }}>
                    {n.titleKr}
                  </div>
                )}
              </a>
            ))}

            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} style={{ height: 1 }} />

            {/* Loading more indicator */}
            {loadingMore && (
              <div style={{ padding: "16px", textAlign: "center", ...S, fontSize: 11, color: "#6b7280" }}>
                로딩 중...
              </div>
            )}

            {/* End of list */}
            {!hasMore && news.length > 0 && (
              <div style={{ padding: "16px", textAlign: "center", ...S, fontSize: 11, color: "#4b5563", borderTop: "1px solid #1f2937" }}>
                모든 뉴스를 불러왔습니다
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
