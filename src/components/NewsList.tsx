"use client";

import { useState, useEffect, useMemo } from "react";
import { useLang } from "@/lib/LangContext";

interface NewsItem {
  id: string;
  headline: string;
  source: string;
  url: string;
  datetime: number;
  symbol?: string;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// ── Keyword extraction for trending topics ────────────────────

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "up", "about", "into", "through", "during",
  "and", "or", "but", "not", "this", "that", "it", "its", "be", "has", "have",
  "had", "do", "does", "did", "will", "would", "could", "should", "may",
  "can", "than", "as", "so", "if", "no", "all", "each", "more", "after",
  "before", "between", "new", "says", "said", "report", "reports", "year",
  // Korean stop words
  "위", "이", "가", "을", "를", "의", "에", "에서", "는", "은", "도", "로",
  "된", "한", "및", "대", "등", "수", "것", "중", "후", "전", "년", "월",
]);

function extractKeywords(headlines: string[]): string[] {
  const freq = new Map<string, number>();

  for (const h of headlines) {
    // Split by spaces and special chars, filter short/stop words
    const words = h
      .replace(/["""''·…\-–—,.:;!?()[\]{}]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .map((w) => w.replace(/['"]$/g, ""));

    // Also extract 2-gram Korean compound words
    const seen = new Set<string>();
    for (const w of words) {
      const lower = w.toLowerCase();
      if (STOP_WORDS.has(lower) || lower.length < 2) continue;
      if (seen.has(lower)) continue;
      seen.add(lower);
      freq.set(lower, (freq.get(lower) || 0) + 1);
    }
  }

  return [...freq.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

// ── News column component ─────────────────────────────────────

function NewsColumn({
  flag,
  label,
  news,
  filterKeyword,
}: {
  flag: string;
  label: string;
  news: NewsItem[];
  filterKeyword: string | null;
}) {
  const filtered = filterKeyword
    ? news.filter((n) => n.headline.toLowerCase().includes(filterKeyword.toLowerCase()))
    : news;

  const display = filtered.slice(0, 6);

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-sm">{flag}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          {label}
        </span>
      </div>
      <div className="space-y-0">
        {display.length === 0 && (
          <p className="py-2 text-[10px] text-muted">Loading...</p>
        )}
        {display.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target={item.url !== "#" ? "_blank" : undefined}
            rel={item.url !== "#" ? "noopener noreferrer" : undefined}
            className="block border-b border-card-border/20 py-1.5 transition-colors hover:bg-card-border/10"
          >
            <p className="truncate text-xs leading-tight">{item.headline}</p>
            <div className="mt-0.5 flex items-center gap-2 text-[9px] text-muted">
              <span>{item.source}</span>
              <span>{timeAgo(item.datetime)}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function NewsList() {
  const { lang } = useLang();
  const [krNews, setKrNews] = useState<NewsItem[]>([]);
  const [usNews, setUsNews] = useState<NewsItem[]>([]);
  const [filterKeyword, setFilterKeyword] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/news/kr")
      .then((r) => r.json())
      .then((j) => { if (j.news) setKrNews(j.news); })
      .catch(() => {});

    fetch("/api/news")
      .then((r) => r.json())
      .then((j) => { if (j.news) setUsNews(j.news); })
      .catch(() => {});
  }, []);

  const trendingKeywords = useMemo(() => {
    const allHeadlines = [...krNews, ...usNews].map((n) => n.headline);
    return extractKeywords(allHeadlines);
  }, [krNews, usNews]);

  return (
    <div>
      {/* Trending topics bar */}
      {trendingKeywords.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold text-muted">
            {lang === "kr" ? "핵심 이슈" : "Trending"}
          </span>
          {trendingKeywords.map((kw) => (
            <button
              key={kw}
              onClick={() => setFilterKeyword(filterKeyword === kw ? null : kw)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                filterKeyword === kw
                  ? "bg-accent text-white"
                  : "bg-card-border/40 text-muted hover:bg-card-border/60 hover:text-foreground"
              }`}
            >
              {kw}
            </button>
          ))}
          {filterKeyword && (
            <button
              onClick={() => setFilterKeyword(null)}
              className="text-[9px] text-muted hover:text-foreground"
            >
              {lang === "kr" ? "초기화" : "Clear"}
            </button>
          )}
        </div>
      )}

      {/* Split KR / US columns */}
      <div className="flex gap-4">
        <NewsColumn
          flag="\uD83C\uDDF0\uD83C\uDDF7"
          label={lang === "kr" ? "한국 뉴스" : "Korea News"}
          news={krNews}
          filterKeyword={filterKeyword}
        />
        <div className="w-px shrink-0 bg-card-border/30" />
        <NewsColumn
          flag="\uD83C\uDDFA\uD83C\uDDF8"
          label={lang === "kr" ? "해외 뉴스" : "US News"}
          news={usNews}
          filterKeyword={filterKeyword}
        />
      </div>
    </div>
  );
}
