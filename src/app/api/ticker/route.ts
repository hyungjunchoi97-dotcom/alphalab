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
  changePct: number | null;
}

const MARKET_SYMBOLS: Omit<MarketItem, "value" | "changePct">[] = [
  // Indexes
  { type: "INDEX", label: "S&P 500", symbol: "^GSPC" },
  { type: "INDEX", label: "NASDAQ", symbol: "^IXIC" },
  { type: "INDEX", label: "DOW", symbol: "^DJI" },
  { type: "INDEX", label: "KOSPI", symbol: "^KS11" },
  { type: "INDEX", label: "KOSDAQ", symbol: "^KQ11" },
  { type: "INDEX", label: "NIKKEI", symbol: "^N225" },
  { type: "INDEX", label: "HSI", symbol: "^HSI" },
  { type: "INDEX", label: "Shanghai", symbol: "000001.SS" },
  // FX
  { type: "FX", label: "USD/KRW", symbol: "KRW=X" },
  { type: "FX", label: "USD/JPY", symbol: "JPY=X" },
  { type: "FX", label: "EUR/USD", symbol: "EURUSD=X" },
  { type: "FX", label: "GBP/USD", symbol: "GBPUSD=X" },
  // Commodities
  { type: "COM", label: "Gold", symbol: "GC=F" },
  { type: "COM", label: "Silver", symbol: "SI=F" },
  { type: "COM", label: "WTI Oil", symbol: "CL=F" },
  { type: "COM", label: "Brent Oil", symbol: "BZ=F" },
  { type: "COM", label: "Natural Gas", symbol: "NG=F" },
  { type: "COM", label: "Copper", symbol: "HG=F" },
  // Crypto
  { type: "CRYPTO", label: "Bitcoin", symbol: "BTC-USD" },
  { type: "CRYPTO", label: "Ethereum", symbol: "ETH-USD" },
  // Bonds
  { type: "BOND", label: "US 10Y", symbol: "^TNX" },
  // Volatility
  { type: "INDEX", label: "VIX", symbol: "^VIX" },
  { type: "FX", label: "DXY", symbol: "DX-Y.NYB" },
];

// ── Cache ───────────────────────────────────────────────────

const MARKET_CACHE_TTL = 60_000; // 60 seconds

interface Cache<T> {
  data: T;
  cachedAt: number;
}

let marketCache: Cache<MarketItem[]> | null = null;

// ── Yahoo Finance fetcher ───────────────────────────────────

async function fetchYahooQuote(symbol: string): Promise<{ price: number; changePct: number } | null> {
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
    return { price, changePct };
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
      headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      market: marketCache?.data ?? [],
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
