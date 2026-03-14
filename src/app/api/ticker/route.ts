import { NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { setYahooCache } from "@/lib/yahooQuoteCache";

export const runtime = "nodejs";

// ── Definitions ─────────────────────────────────────────────

const FMP_KEY = process.env.FMP_API_KEY || "";

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

// ── Symbol mappings ─────────────────────────────────────────

// Yahoo → FMP symbol mapping for quote endpoint
const YAHOO_TO_FMP: Record<string, string> = {
  "BTC-USD": "BTCUSD",
  "ETH-USD": "ETHUSD",
  "GC=F": "GCUSD",
  "SI=F": "SIUSD",
  "CL=F": "CLUSD",
  "BZ=F": "BZUSD",
  "NG=F": "NGUSD",
  "HG=F": "HGUSD",
};

// Yahoo → FMP forex ticker mapping
const YAHOO_FX_TO_FMP: Record<string, string> = {
  "KRW=X": "USDKRW",
  "JPY=X": "USDJPY",
  "EURUSD=X": "EURUSD",
  "GBPUSD=X": "GBPUSD",
};

// Symbols that use Yahoo v8 closes (Asian indexes + DXY)
const YAHOO_CLOSES_SET = new Set(["^KS11", "^KQ11", "^N225", "^HSI", "000001.SS", "DX-Y.NYB"]);

// ── Cache ───────────────────────────────────────────────────

const MARKET_CACHE_TTL = 60_000;

interface Cache<T> {
  data: T;
  cachedAt: number;
}

let marketCache: Cache<MarketItem[]> | null = null;

// ── FMP quote batch fetcher ─────────────────────────────────

async function fetchFMPQuoteBatch(
  fmpSymbols: string[]
): Promise<Map<string, { price: number; changePct: number }>> {
  const map = new Map<string, { price: number; changePct: number }>();
  if (fmpSymbols.length === 0 || !FMP_KEY) return map;
  try {
    const url = `https://financialmodelingprep.com/api/v3/quote/${fmpSymbols.join(",")}?apikey=${FMP_KEY}`;
    const res = await fetchWithTimeout(url, {}, 10000);
    if (!res.ok) return map;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = await res.json();
    if (!Array.isArray(data)) return map;
    for (const item of data) {
      if (item.symbol && item.price != null) {
        map.set(item.symbol, {
          price: item.price,
          changePct: Math.round((item.changesPercentage ?? 0) * 100) / 100,
        });
      }
    }
  } catch { /* silent */ }
  return map;
}

// ── FMP forex fetcher ───────────────────────────────────────

async function fetchFMPForex(): Promise<Map<string, { price: number; changePct: number }>> {
  const map = new Map<string, { price: number; changePct: number }>();
  if (!FMP_KEY) return map;
  try {
    const url = `https://financialmodelingprep.com/api/v3/fx?apikey=${FMP_KEY}`;
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) return map;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = await res.json();
    if (!Array.isArray(data)) return map;
    for (const item of data) {
      if (item.ticker) {
        const mid = item.bid && item.ask ? (item.bid + item.ask) / 2 : item.bid || item.ask || 0;
        map.set(item.ticker, {
          price: mid,
          changePct: Math.round((item.changesPercentage ?? item.changes ?? 0) * 100) / 100,
        });
      }
    }
  } catch { /* silent */ }
  return map;
}

// ── Yahoo v8 closes fetcher (Asian indexes) ─────────────────

async function fetchYahooCloses(symbol: string): Promise<{ price: number; changePct: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const res = await fetchWithTimeout(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    }, 8000);
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;

    const closes: number[] = (result.indicators?.quote?.[0]?.close || []).filter(Boolean);
    if (closes.length < 2) return null;

    const curr = closes[closes.length - 1];
    const prev = closes[closes.length - 2];
    const changePct = prev > 0 ? ((curr - prev) / prev) * 100 : 0;

    const change = curr - prev;
    setYahooCache(symbol, curr, change, changePct);

    return { price: curr, changePct: Math.round(changePct * 100) / 100 };
  } catch {
    return null;
  }
}

// ── Fetch all market data ───────────────────────────────────

async function fetchAllMarketData(): Promise<MarketItem[]> {
  // Categorize symbols into 3 groups
  type SymDef = Omit<MarketItem, "value" | "changePct">;
  const fmpGroup: { def: SymDef; fmpSymbol: string }[] = [];
  const fxGroup: { def: SymDef; fmpTicker: string }[] = [];
  const yahooGroup: SymDef[] = [];

  for (const s of MARKET_SYMBOLS) {
    if (YAHOO_CLOSES_SET.has(s.symbol)) {
      yahooGroup.push(s);
    } else if (s.type === "FX" && YAHOO_FX_TO_FMP[s.symbol]) {
      fxGroup.push({ def: s, fmpTicker: YAHOO_FX_TO_FMP[s.symbol] });
    } else {
      const fmpSym = YAHOO_TO_FMP[s.symbol] || s.symbol;
      fmpGroup.push({ def: s, fmpSymbol: fmpSym });
    }
  }

  // Fetch all 3 groups in parallel
  const [fmpResult, fxResult, ...yahooResults] = await Promise.allSettled([
    fetchFMPQuoteBatch(fmpGroup.map(g => g.fmpSymbol)),
    fetchFMPForex(),
    ...yahooGroup.map(s => fetchYahooCloses(s.symbol)),
  ]);

  const fmpMap = fmpResult.status === "fulfilled" ? fmpResult.value : new Map<string, { price: number; changePct: number }>();
  const fxMap = fxResult.status === "fulfilled" ? fxResult.value : new Map<string, { price: number; changePct: number }>();

  const items: MarketItem[] = [];

  // FMP group results
  for (const { def, fmpSymbol } of fmpGroup) {
    const q = fmpMap.get(fmpSymbol);
    items.push({
      type: def.type,
      label: def.label,
      symbol: def.symbol,
      value: q?.price ?? null,
      changePct: q?.changePct ?? null,
    });
  }

  // FX group results
  for (const { def, fmpTicker } of fxGroup) {
    const q = fxMap.get(fmpTicker);
    items.push({
      type: def.type,
      label: def.label,
      symbol: def.symbol,
      value: q?.price ?? null,
      changePct: q?.changePct ?? null,
    });
  }

  // Yahoo closes group results
  for (let i = 0; i < yahooGroup.length; i++) {
    const def = yahooGroup[i];
    const r = yahooResults[i];
    const q = r?.status === "fulfilled" ? r.value : null;
    items.push({
      type: def.type,
      label: def.label,
      symbol: def.symbol,
      value: q?.price ?? null,
      changePct: q?.changePct ?? null,
    });
  }

  return items;
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
