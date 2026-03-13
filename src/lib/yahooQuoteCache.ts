// Shared in-memory Yahoo Finance quote cache
// Prevents duplicate fetches from /api/ticker and /api/news-run/market

const CACHE_TTL = 60_000; // 60 seconds

interface CachedQuote {
  price: number;
  change: number;
  changePct: number;
  cachedAt: number;
}

const cache = new Map<string, CachedQuote>();

function normalize(symbol: string): string {
  return decodeURIComponent(symbol).toUpperCase().trim();
}

export function getYahooCache(symbol: string): { price: number; change: number; changePct: number } | null {
  const entry = cache.get(normalize(symbol));
  if (entry && Date.now() - entry.cachedAt < CACHE_TTL) {
    return { price: entry.price, change: entry.change, changePct: entry.changePct };
  }
  return null;
}

export function setYahooCache(symbol: string, price: number, change: number, changePct: number): void {
  cache.set(normalize(symbol), { price, change, changePct, cachedAt: Date.now() });
}
