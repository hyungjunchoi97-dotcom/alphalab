"use client";

import { useState, useEffect, useCallback } from "react";
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

// ── Component ─────────────────────────────────────────────────

export default function NewsList() {
  const { lang } = useLang();
  const [activeTab, setActiveTab] = useState("breaking");
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNews = useCallback(async (tab: Tab) => {
    setLoading(true);
    try {
      let url: string;
      if (tab.type === "us") {
        url = "/api/news";
      } else {
        url = `/api/news/kr?category=${tab.category || "breaking"}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      if (json.news) setNews(json.news);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const tab = TABS.find((t) => t.key === activeTab) || TABS[0];
    fetchNews(tab);
  }, [activeTab, fetchNews]);

  const handleTabClick = (key: string) => {
    if (key !== activeTab) {
      setActiveTab(key);
      setNews([]);
    }
  };

  return (
    <div>
      {/* Tabs */}
      <div className="mb-3 flex gap-px overflow-x-auto rounded bg-card-border/50 p-px">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabClick(tab.key)}
            className={`shrink-0 px-3 py-1.5 text-[11px] font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-accent text-white"
                : "bg-card-bg text-muted hover:text-foreground"
            }`}
          >
            {lang === "kr" ? tab.labelKr : tab.labelEn}
          </button>
        ))}
      </div>

      {/* News list */}
      <div className="min-h-[200px]">
        {loading && news.length === 0 && (
          <div className="space-y-0">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse border-b border-card-border/20 py-2">
                <div className="h-3.5 w-full rounded bg-card-border/30" />
                <div className="mt-1 flex gap-2">
                  <div className="h-2.5 w-16 rounded bg-card-border/20" />
                  <div className="h-2.5 w-8 rounded bg-card-border/20" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && news.length === 0 && (
          <p className="py-6 text-center text-[10px] text-muted">
            {lang === "kr" ? "뉴스를 불러올 수 없습니다" : "No news available"}
          </p>
        )}

        {news.slice(0, 10).map((item) => (
          <a
            key={item.id}
            href={item.url}
            target={item.url !== "#" ? "_blank" : undefined}
            rel={item.url !== "#" ? "noopener noreferrer" : undefined}
            className="flex items-start gap-3 border-b border-card-border/20 py-2 transition-colors hover:bg-card-border/10"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs leading-tight line-clamp-2">{item.headline}</p>
              <div className="mt-0.5 flex items-center gap-2 text-[9px] text-muted">
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
