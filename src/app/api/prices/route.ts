import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// ── Types ─────────────────────────────────────────────────────

interface PriceEntry {
  close: number;
  asOfISO: string;
}

interface CacheEntry {
  data: PriceEntry;
  cachedAt: number;
}

// ── In-memory cache (TTL = 60s) ──────────────────────────────

const CACHE_TTL = 60 * 1000;
const cache = new Map<string, CacheEntry>();

function getCached(symbol: string): PriceEntry | null {
  const entry = cache.get(symbol);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL) {
    cache.delete(symbol);
    return null;
  }
  return entry.data;
}

function setCache(symbol: string, data: PriceEntry): void {
  cache.set(symbol, { data, cachedAt: Date.now() });
}

// ── Mock provider ─────────────────────────────────────────────
// Generates deterministic prices from symbol name.
// Replace this function body with a real API call later.

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function mockPrice(symbol: string): PriceEntry {
  const h = hashString(symbol);
  // Generate a price range based on typical market:
  // KR-style symbols (contain digits or .KS/.KQ) → 10,000–500,000 KRW range
  // US-style → 20–500 USD range
  // JP-style (.T) → 500–50,000 JPY range
  // Commodity/other → 50–3,000 USD range
  let base: number;
  if (/\d{6}/.test(symbol) || /\.K[SQ]$/i.test(symbol)) {
    base = 10000 + (h % 490000);
  } else if (/\.T$/i.test(symbol)) {
    base = 500 + (h % 49500);
  } else if (/^[A-Z]{1,5}$/.test(symbol)) {
    base = 20 + (h % 480);
  } else {
    base = 50 + (h % 2950);
  }

  // Add a small daily fluctuation (±3%) seeded by date
  const today = new Date().toISOString().slice(0, 10);
  const dayHash = hashString(symbol + today);
  const pctChange = ((dayHash % 600) - 300) / 10000; // ±3%
  const close = Math.round(base * (1 + pctChange) * 100) / 100;

  return {
    close,
    asOfISO: new Date().toISOString(),
  };
}

// ── Yahoo Finance fetch ──────────────────────────────────────

async function fetchYahooPrice(symbol: string): Promise<PriceEntry | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "project-stockmarket/1.0" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (typeof price !== "number" || !isFinite(price)) return null;
    return {
      close: Math.round(price * 100) / 100,
      asOfISO: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ── Route handler ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { symbols?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { symbols } = body;
  if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Missing or empty symbols array" },
      { status: 400 }
    );
  }

  // Cap at 50 symbols per request
  const requested = symbols.slice(0, 50);
  const prices: Record<string, PriceEntry> = {};

  await Promise.all(
    requested.map(async (sym) => {
      const s = String(sym).trim().toUpperCase();
      if (!s) return;

      const cached = getCached(s);
      if (cached) {
        prices[s] = cached;
        return;
      }

      const live = await fetchYahooPrice(s);
      const data = live ?? mockPrice(s);
      setCache(s, data);
      prices[s] = data;
    })
  );

  return NextResponse.json({ ok: true, prices }, {
    headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
  });
}
