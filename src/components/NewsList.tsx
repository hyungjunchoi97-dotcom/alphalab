"use client";

import { useState, useEffect } from "react";

interface NewsItem {
  id: string;
  headline: string;
  source: string;
  url: string;
  datetime: number;
  symbol: string;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NewsList({ symbols }: { symbols?: string[] }) {
  const [news, setNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    const url = symbols && symbols.length > 0
      ? `/api/news?symbols=${symbols.join(",")}`
      : "/api/news";
    fetch(url)
      .then((r) => r.json())
      .then((j) => { if (j.ok || j.news) setNews(j.news); })
      .catch(() => {});
  }, [symbols]);

  if (news.length === 0) {
    return <p className="py-3 text-center text-[10px] text-muted">Loading news...</p>;
  }

  return (
    <div>
      {news.map((item) => (
        <a
          key={item.id}
          href={item.url}
          target={item.url !== "#" ? "_blank" : undefined}
          rel={item.url !== "#" ? "noopener noreferrer" : undefined}
          className="flex items-center gap-3 border-b border-card-border/30 py-2 transition-colors hover:bg-card-border/15"
        >
          <span className="w-14 shrink-0 text-[10px] font-medium text-accent">
            {item.symbol}
          </span>
          <p className="min-w-0 flex-1 truncate text-xs">{item.headline}</p>
          <span className="shrink-0 text-[10px] text-muted">
            {item.source}
          </span>
          <span className="w-12 shrink-0 text-right text-[10px] text-muted/60">
            {timeAgo(item.datetime)}
          </span>
        </a>
      ))}
    </div>
  );
}
