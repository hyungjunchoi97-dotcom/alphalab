"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLang } from "@/lib/LangContext";

interface NewsItem {
  id: string;
  headline: string;
  source: string;
  url: string;
  datetime: number;
  symbol?: string;
}

// ── Tab definitions ───────────────────────────────────────────

interface Tab {
  key: string;
  labelEn: string;
  labelKr: string;
  type: "kr" | "us";
  category?: string;
}

const TABS: Tab[] = [
  { key: "breaking", labelEn: "Breaking", labelKr: "속보", type: "kr", category: "breaking" },
  { key: "stocks", labelEn: "Stocks", labelKr: "주식", type: "kr", category: "stocks" },
  { key: "economy", labelEn: "Economy", labelKr: "경제", type: "kr", category: "economy" },
  { key: "global", labelEn: "Global", labelKr: "해외", type: "us" },
  { key: "politics", labelEn: "Politics", labelKr: "정치", type: "kr", category: "politics" },
];

// ── Helpers ───────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function updatedAgoKr(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "방금 업데이트";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전 업데이트`;
  return `${Math.floor(diff / 3600)}시간 전 업데이트`;
}

// ── Component ─────────────────────────────────────────────────

const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

export default function NewsList() {
  const { lang } = useLang();
  const [activeTab, setActiveTab] = useState("breaking");
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNews = useCallback(async (tab: Tab, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const url = tab.type === "us"
        ? "/api/news"
        : `/api/news/kr?category=${tab.category || "breaking"}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.news) {
        setNews(json.news);
        setLastFetched(Date.now());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on tab change
  useEffect(() => {
    const tab = TABS.find((t) => t.key === activeTab) || TABS[0];
    fetchNews(tab);

    // Auto-refresh every 5 min for the active tab
    if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    autoRefreshRef.current = setInterval(() => {
      fetchNews(tab, true /* silent */);
    }, AUTO_REFRESH_MS);

    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [activeTab, fetchNews]);

  const handleTabClick = (key: string) => {
    if (key !== activeTab) {
      setActiveTab(key);
      setNews([]);
    }
  };

  return (
    <div>
      {/* Tabs + timestamp */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex gap-px overflow-x-auto rounded bg-card-border/50 p-px flex-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabClick(tab.key)}
              className={`flex-1 text-center px-3 py-1.5 text-[11px] font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-accent text-white"
                  : "bg-card-bg text-muted hover:text-foreground"
              }`}
            >
              {lang === "kr" ? tab.labelKr : tab.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Last updated */}
      {lastFetched && (
        <div className="mb-1.5 text-right">
          <span className="text-[9px]" style={{ color: "#555" }}>
            {lang === "kr" ? updatedAgoKr(lastFetched) : `Updated ${timeAgo(lastFetched)} ago`}
          </span>
        </div>
      )}

      {/* News list */}
      <div>
        {loading && news.length === 0 && (
          <div className="space-y-0">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="animate-pulse border-b border-card-border/20 py-1.5">
                <div className="h-3 w-full rounded bg-card-border/30" />
              </div>
            ))}
          </div>
        )}

        {!loading && news.length === 0 && (
          <p className="py-4 text-center text-[10px] text-muted">
            {lang === "kr" ? "뉴스를 불러올 수 없습니다" : "No news available"}
          </p>
        )}

        {news.slice(0, 12).map((item) => (
          <a
            key={item.id}
            href={item.url}
            target={item.url !== "#" ? "_blank" : undefined}
            rel={item.url !== "#" ? "noopener noreferrer" : undefined}
            className="flex items-start gap-2 border-b border-card-border/20 py-1.5 transition-colors hover:bg-card-border/10"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-snug line-clamp-1">{item.headline}</p>
              <div className="flex items-center gap-2 text-[9px] text-muted">
                <span>{item.source}</span>
                <span>{timeAgo(item.datetime)}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
