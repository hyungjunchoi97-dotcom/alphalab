import { NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

export const runtime = "nodejs";

// ── Definitions ─────────────────────────────────────────────

interface MarketItem {
  type: "INDEX" | "FX" | "COM";
  label: string;
  symbol: string;
  value: number | null;
  changePct: number | null;
}

interface NewsItem {
  type: "NEWS";
  label: string;
}

const MARKET_SYMBOLS: Omit<MarketItem, "value" | "changePct">[] = [
  { type: "INDEX", label: "KOSPI", symbol: "^KS11" },
  { type: "INDEX", label: "KOSDAQ", symbol: "^KQ11" },
  { type: "INDEX", label: "S&P 500", symbol: "^GSPC" },
  { type: "INDEX", label: "NASDAQ", symbol: "^IXIC" },
  { type: "FX", label: "USD/KRW", symbol: "KRW=X" },
  { type: "COM", label: "Gold", symbol: "GC=F" },
  { type: "COM", label: "WTI Oil", symbol: "CL=F" },
  { type: "COM", label: "Bitcoin", symbol: "BTC-USD" },
];

// ── Cache ───────────────────────────────────────────────────

const MARKET_CACHE_TTL = 60_000; // 60 seconds
const NEWS_CACHE_TTL = 5 * 60_000; // 5 minutes

interface Cache<T> {
  data: T;
  cachedAt: number;
}

let marketCache: Cache<MarketItem[]> | null = null;
let newsCache: Cache<NewsItem[]> | null = null;

// ── Yahoo Finance fetcher ───────────────────────────────────

async function fetchYahooQuote(symbol: string): Promise<{ price: number; changePct: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const res = await fetchWithTimeout(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    }, 8000);
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price = meta?.regularMarketPrice;
    if (price == null) return null;

    // Calculate change% from previous close
    const prevClose = meta?.chartPreviousClose ?? meta?.previousClose;
    const changePct = prevClose && prevClose > 0
      ? ((price - prevClose) / prevClose) * 100
      : 0;

    return { price, changePct };
  } catch {
    return null;
  }
}

async function fetchAllMarketData(): Promise<MarketItem[]> {
  const results = await Promise.allSettled(
    MARKET_SYMBOLS.map(async (s) => {
      const quote = await fetchYahooQuote(s.symbol);
      return {
        type: s.type,
        label: s.label,
        symbol: s.symbol,
        value: quote?.price ?? null,
        changePct: quote?.changePct != null ? Math.round(quote.changePct * 100) / 100 : null,
      } as MarketItem;
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<MarketItem> => r.status === "fulfilled")
    .map((r) => r.value);
}

// ── Google News RSS fetcher ─────────────────────────────────

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function extractTitles(xml: string, limit: number): string[] {
  const titles: string[] = [];
  // Skip the first <title> which is the feed title
  const regex = /<item[^>]*>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/g;
  let match;
  while ((match = regex.exec(xml)) !== null && titles.length < limit) {
    let title = stripHtml(match[1]).trim();
    if (title.length > 80) title = title.slice(0, 77) + "...";
    if (title) titles.push(title);
  }
  return titles;
}

async function fetchNewsHeadlines(): Promise<NewsItem[]> {
  const feeds = [
    "https://news.google.com/rss/search?q=stock+market+economy+fed&hl=en&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=%EC%BD%94%EC%8A%A4%ED%94%BC+%EC%A6%9D%EC%8B%9C+%EA%B2%BD%EC%A0%9C&hl=ko&gl=KR&ceid=KR:ko",
  ];

  const results = await Promise.allSettled(
    feeds.map(async (url) => {
      const res = await fetchWithTimeout(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      }, 8000);
      if (!res.ok) return [];
      const xml = await res.text();
      return extractTitles(xml, 5);
    })
  );

  const allTitles: string[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") allTitles.push(...r.value);
  }

  return allTitles.map((title) => ({ type: "NEWS" as const, label: title }));
}

// ── Route handler ───────────────────────────────────────────

export async function GET() {
  try {
    // Fetch market data (cached 60s)
    let market: MarketItem[];
    if (marketCache && Date.now() - marketCache.cachedAt < MARKET_CACHE_TTL) {
      market = marketCache.data;
    } else {
      market = await fetchAllMarketData();
      if (market.length > 0) {
        marketCache = { data: market, cachedAt: Date.now() };
      } else if (marketCache) {
        market = marketCache.data; // fallback to stale
      }
    }

    // Fetch news (cached 5min)
    let news: NewsItem[];
    if (newsCache && Date.now() - newsCache.cachedAt < NEWS_CACHE_TTL) {
      news = newsCache.data;
    } else {
      news = await fetchNewsHeadlines();
      if (news.length > 0) {
        newsCache = { data: news, cachedAt: Date.now() };
      } else if (newsCache) {
        news = newsCache.data; // fallback to stale
      } else {
        news = [];
      }
    }

    return NextResponse.json({
      ok: true,
      market,
      news,
      asOf: new Date().toISOString(),
    });
  } catch (err) {
    // Return stale cache on error
    return NextResponse.json({
      ok: false,
      market: marketCache?.data ?? [],
      news: newsCache?.data ?? [],
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
