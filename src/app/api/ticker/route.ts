import { NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { getYahooCache, setYahooCache } from "@/lib/yahooQuoteCache";

export const runtime = "nodejs";

// ── Definitions ─────────────────────────────────────────────

interface MarketItem {
  type: "INDEX" | "FX" | "COM" | "CRYPTO" | "BOND";
  label: string;
  symbol: string;
  value: number | null;
  change: number | null;
  changePct: number | null;
}

const MARKET_SYMBOLS: Omit<MarketItem, "value" | "change" | "changePct">[] = [
  { type: "INDEX", label: "S&P 500", symbol: "^GSPC" },
  { type: "INDEX", label: "KOSPI", symbol: "^KS11" },
  { type: "INDEX", label: "KOSDAQ", symbol: "^KQ11" },
  { type: "FX", label: "USD/KRW", symbol: "KRW=X" },
  { type: "FX", label: "JPY/KRW", symbol: "JPYKRW=X" },
  { type: "FX", label: "EUR/KRW", symbol: "EURKRW=X" },
  { type: "FX", label: "GBP/KRW", symbol: "GBPKRW=X" },
  { type: "COM", label: "Gold", symbol: "GC=F" },
  { type: "COM", label: "WTI Oil", symbol: "CL=F" },
  { type: "CRYPTO", label: "Bitcoin", symbol: "BTC-USD" },
  { type: "CRYPTO", label: "Ethereum", symbol: "ETH-USD" },
];

// ── Cache ───────────────────────────────────────────────────

const MARKET_CACHE_TTL = 60_000; // 60 seconds

interface Cache<T> {
  data: T;
  cachedAt: number;
}

let marketCache: Cache<MarketItem[]> | null = null;

// ── Yahoo Finance fetcher ───────────────────────────────────

async function fetchYahooQuote(symbol: string): Promise<{ price: number; change: number; changePct: number } | null> {
  const cached = getYahooCache(symbol);
  if (cached) return cached;
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
    const changePct = meta?.regularMarketChangePercent != null
      ? meta.regularMarketChangePercent
      : (() => {
          const prevClose = meta?.chartPreviousClose ?? meta?.regularMarketPreviousClose ?? meta?.previousClose;
          return prevClose && prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
        })();
    const prevClose = meta?.chartPreviousClose ?? meta?.regularMarketPreviousClose ?? meta?.previousClose;
    const change = prevClose ? price - prevClose : 0;
    setYahooCache(symbol, price, change, changePct);
    return { price, change, changePct };
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
        change: quote?.change != null ? Math.round(quote.change * 100) / 100 : null,
        changePct: quote?.changePct != null ? Math.round(quote.changePct * 100) / 100 : null,
      } as MarketItem;
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<MarketItem> => r.status === "fulfilled")
    .map((r) => r.value);
}

// ── Route handler ───────────────────────────────────────────

export async function GET() {
  try {
    let market: MarketItem[];
    if (marketCache && Date.now() - marketCache.cachedAt < MARKET_CACHE_TTL) {
      market = marketCache.data;
    } else {
      market = await fetchAllMarketData();
      if (market.length > 0) {
        marketCache = { data: market, cachedAt: Date.now() };
      } else if (marketCache) {
        market = marketCache.data;
      }
    }

    return NextResponse.json({
      ok: true,
      market,
      asOf: new Date().toISOString(),
    }, {
      headers: { "Cache-Control": "no-store, no-cache" },
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      market: marketCache?.data ?? [],
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
