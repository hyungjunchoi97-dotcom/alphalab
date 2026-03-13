import { NextResponse } from "next/server";
import { getYahooCache, setYahooCache } from "@/lib/yahooQuoteCache";

export const runtime = "nodejs";

// ── Fear & Greed in-memory cache (1h TTL) ──────────────────
interface FGCache { score: number; rating: string; fetchedAt: number }
let fgCache: FGCache | null = null;
const FG_TTL = 60 * 60 * 1000; // 1 hour

function fgRatingFromScore(score: number): string {
  if (score <= 25) return "Extreme Fear";
  if (score <= 45) return "Fear";
  if (score <= 55) return "Neutral";
  if (score <= 75) return "Greed";
  return "Extreme Greed";
}

async function fetchFearGreed(): Promise<{ score: number; rating: string; fgFetchedAt: string }> {
  if (fgCache && Date.now() - fgCache.fetchedAt < FG_TTL) {
    return { score: fgCache.score, rating: fgCache.rating, fgFetchedAt: new Date(fgCache.fetchedAt).toISOString() };
  }
  try {
    const res = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://edition.cnn.com/",
        "Origin": "https://edition.cnn.com",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    const rawScore = json?.fear_and_greed?.score ?? 0;
    const score = Math.round(Number(rawScore));
    const rating = fgRatingFromScore(score);
    const now = Date.now();
    if (score > 0) fgCache = { score, rating, fetchedAt: now };
    console.log(`[news-run/market] F&G fetched: score=${score} rating=${rating}`);
    return { score, rating, fgFetchedAt: new Date(now).toISOString() };
  } catch (err) {
    console.error("[news-run/market] Fear & Greed fetch failed:", err);
    if (fgCache) return { score: fgCache.score, rating: fgCache.rating, fgFetchedAt: new Date(fgCache.fetchedAt).toISOString() };
    return { score: 0, rating: "", fgFetchedAt: new Date().toISOString() };
  }
}

// ── Yahoo Finance symbols ───────────────────────────────────
const YAHOO_MAP: Record<string, string> = {
  sp500: "%5EGSPC",
  nasdaq: "%5EIXIC",
  dow: "%5EDJI",
  kospi: "%5EKS11",
  kosdaq: "%5EKQ11",
  usdkrw: "USDKRW%3DX",
  dxy: "DX-Y.NYB",
  gold: "GC%3DF",
  silver: "SI%3DF",
  wti: "CL%3DF",
  btc: "BTC-USD",
  eth: "ETH-USD",
  tenYear: "%5ETNX",
  vix: "%5EVIX",
  copper: "HG%3DF",
};

interface QuoteResult {
  price: number;
  change: number;
  changePct: number;
}

async function fetchYahoo(symbol: string): Promise<QuoteResult | null> {
  const cached = getYahooCache(symbol);
  if (cached) return cached;
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=2d&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result?.meta) return null;
    const meta = result.meta;

    const closes = (result.indicators?.quote?.[0]?.close ?? []).filter(
      (v: number | null) => v !== null && v !== undefined
    );
    const price = meta.regularMarketPrice ?? (closes.length > 0 ? closes[closes.length - 1] : 0);
    const prevClose = closes.length >= 2 ? closes[closes.length - 2] : 0;
    const change = prevClose ? price - prevClose : 0;
    const changePct = prevClose ? (change / prevClose) * 100 : 0;

    const result2 = {
      price: Math.round(price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
    };
    setYahooCache(symbol, result2.price, result2.change, result2.changePct);
    return result2;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const keys = Object.keys(YAHOO_MAP);

    const [quotesArr, fg] = await Promise.all([
      Promise.all(keys.map((k) => fetchYahoo(YAHOO_MAP[k]))),
      fetchFearGreed(),
    ]);

    const quotes: Record<string, QuoteResult | null> = {};
    keys.forEach((k, i) => {
      if (!quotesArr[i]) console.error(`[news-run/market] Yahoo fetch failed for: ${k} (${YAHOO_MAP[k]})`);
      quotes[k] = quotesArr[i];
    });

    const data = {
      ...quotes,
      fearGreed: { score: fg.score, rating: fg.rating },
      fgFetchedAt: fg.fgFetchedAt,
      asOf: new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, data }, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
