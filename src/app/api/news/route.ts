import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// ── Types ─────────────────────────────────────────────────────

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
  symbol: string;
}

interface CacheEntry {
  data: NewsItem[];
  cachedAt: number;
}

// ── In-memory cache (TTL = 15 min) ────────────────────────────

const CACHE_TTL = 15 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function getCached(key: string): NewsItem[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: NewsItem[]): void {
  cache.set(key, { data, cachedAt: Date.now() });
}

// ── Mock news ─────────────────────────────────────────────────

function mockNews(): NewsItem[] {
  const now = Date.now();
  return [
    { id: "m1", headline: "NVIDIA Reports Record Data Center Revenue in Q4", summary: "", source: "Reuters", url: "#", datetime: now - 2 * 3600000, symbol: "NVDA" },
    { id: "m2", headline: "Samsung Unveils Next-Gen HBM4 Memory for AI Chips", summary: "", source: "Bloomberg", url: "#", datetime: now - 3 * 3600000, symbol: "005930" },
    { id: "m3", headline: "Apple Vision Pro 2 Expected to Launch in Late 2026", summary: "", source: "WSJ", url: "#", datetime: now - 5 * 3600000, symbol: "AAPL" },
    { id: "m4", headline: "Toyota Accelerates Solid-State Battery Development Timeline", summary: "", source: "Nikkei", url: "#", datetime: now - 6 * 3600000, symbol: "7203" },
    { id: "m5", headline: "Microsoft Azure AI Revenue Grows 40% Year-over-Year", summary: "", source: "CNBC", url: "#", datetime: now - 8 * 3600000, symbol: "MSFT" },
    { id: "m6", headline: "Fed Signals Potential Rate Cuts in Second Half of 2026", summary: "", source: "Reuters", url: "#", datetime: now - 10 * 3600000, symbol: "MACRO" },
  ];
}

// ── XML helpers (no dependencies) ─────────────────────────────

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const m = xml.match(re);
  if (!m) return "";
  return (m[1] ?? m[2] ?? "").trim();
}

function parseRssItems(xml: string): Array<{ title: string; link: string; pubDate: string }> {
  const items: Array<{ title: string; link: string; pubDate: string }> = [];
  const parts = xml.split("<item>");
  // Skip first split (before first <item>)
  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i].split("</item>")[0];
    const title = extractTag(chunk, "title");
    const link = extractTag(chunk, "link");
    const pubDate = extractTag(chunk, "pubDate");
    if (title) items.push({ title, link, pubDate });
  }
  return items;
}

// ── Yahoo Finance RSS fetch ───────────────────────────────────

const RSS_FEEDS = [
  { url: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=AAPL,MSFT,NVDA&region=US&lang=en-US", defaultSymbol: "US" },
  { url: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=005930.KS,000660.KS&region=KR&lang=ko-KR", defaultSymbol: "KR" },
];

async function fetchRssFeed(feedUrl: string, defaultSymbol: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "project-stockmarket/1.0" },
    });
    console.log("[news] RSS fetch", feedUrl.slice(0, 80), "status:", res.status);
    if (!res.ok) return [];
    const xml = await res.text();
    const items = parseRssItems(xml);
    return items.map((item, idx) => {
      // Try to extract symbol from the link URL (e.g. ...?s=AAPL)
      const symMatch = item.link.match(/[?&]s=([^&]+)/);
      const symbol = symMatch ? decodeURIComponent(symMatch[1]).split(",")[0] : defaultSymbol;
      return {
        id: `rss-${defaultSymbol}-${idx}-${item.pubDate}`,
        headline: item.title,
        summary: "",
        source: "Yahoo Finance",
        url: item.link || "#",
        datetime: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
        symbol,
      };
    });
  } catch (err) {
    console.log("[news] RSS error:", err instanceof Error ? err.message : err);
    return [];
  }
}

async function fetchSymbolRss(symbols: string[]): Promise<NewsItem[]> {
  const feedUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${symbols.map(encodeURIComponent).join(",")}&region=US&lang=en-US`;
  return fetchRssFeed(feedUrl, symbols[0] || "");
}

// ── Route handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbolsParam = searchParams.get("symbols");

    if (symbolsParam) {
      // Company news for specific symbols via RSS
      const symbols = symbolsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);
      const cacheKey = `company:${symbols.sort().join(",")}`;
      const cached = getCached(cacheKey);
      if (cached) return NextResponse.json({ ok: true, news: cached });

      let news = await fetchSymbolRss(symbols);
      news = news.sort((a, b) => b.datetime - a.datetime).slice(0, 20);

      if (news.length === 0) news = mockNews();
      setCache(cacheKey, news);
      return NextResponse.json({ ok: true, news });
    }

    // General market news from default RSS feeds
    const cached = getCached("general");
    if (cached) return NextResponse.json({ ok: true, news: cached });

    const results = await Promise.all(
      RSS_FEEDS.map((f) => fetchRssFeed(f.url, f.defaultSymbol))
    );
    let news = results.flat().sort((a, b) => b.datetime - a.datetime).slice(0, 15);

    if (news.length === 0) news = mockNews();
    setCache("general", news);
    return NextResponse.json({ ok: true, news });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error", news: mockNews() },
      { status: 500 }
    );
  }
}
