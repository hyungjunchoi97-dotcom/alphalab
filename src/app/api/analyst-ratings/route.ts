import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const FMP_KEY = process.env.FMP_API_KEY || "";

interface CacheEntry {
  data: AnalystData;
  cachedAt: number;
}

interface AnalystData {
  consensus: string; // "Buy" | "Hold" | "Sell" | "Strong Buy" | "Strong Sell"
  targetConsensus: number;
  targetHigh: number;
  targetLow: number;
  analystCount: number;
  buyCount: number;
  holdCount: number;
  sellCount: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol");
    if (!symbol) return NextResponse.json({ ok: false, error: "symbol required" }, { status: 400 });
    if (!FMP_KEY) return NextResponse.json({ ok: false, error: "FMP_API_KEY not configured" }, { status: 500 });

    const key = symbol.toUpperCase();
    const cached = cache.get(key);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      return NextResponse.json({ ok: true, data: cached.data });
    }

    // Fetch both endpoints in parallel
    const [recRes, targetRes] = await Promise.all([
      fetch(`https://financialmodelingprep.com/api/v3/analyst-stock-recommendations/${key}?limit=30&apikey=${FMP_KEY}`, { signal: AbortSignal.timeout(10000) }),
      fetch(`https://financialmodelingprep.com/api/v3/price-target-consensus/${key}?apikey=${FMP_KEY}`, { signal: AbortSignal.timeout(10000) }),
    ]);

    // Parse recommendations
    let buyCount = 0, holdCount = 0, sellCount = 0;
    if (recRes.ok) {
      const recs = await recRes.json();
      if (Array.isArray(recs)) {
        for (const r of recs) {
          buyCount += (r.analystRatingsbuy || 0) + (r.analystRatingsStrongBuy || 0);
          holdCount += (r.analystRatingsHold || 0);
          sellCount += (r.analystRatingsSell || 0) + (r.analystRatingsStrongSell || 0);
          break; // only use most recent
        }
      }
    }

    // Parse price target consensus
    let targetConsensus = 0, targetHigh = 0, targetLow = 0;
    if (targetRes.ok) {
      const targets = await targetRes.json();
      if (Array.isArray(targets) && targets.length > 0) {
        const t = targets[0];
        targetConsensus = t.targetConsensus || 0;
        targetHigh = t.targetHigh || 0;
        targetLow = t.targetLow || 0;
      }
    }

    const total = buyCount + holdCount + sellCount;
    let consensus = "Hold";
    if (total > 0) {
      const buyPct = buyCount / total;
      const sellPct = sellCount / total;
      if (buyPct >= 0.6) consensus = "Buy";
      else if (sellPct >= 0.4) consensus = "Sell";
    }

    const data: AnalystData = {
      consensus,
      targetConsensus,
      targetHigh,
      targetLow,
      analystCount: total,
      buyCount,
      holdCount,
      sellCount,
    };

    cache.set(key, { data, cachedAt: Date.now() });

    return NextResponse.json({ ok: true, data }, {
      headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=7200" },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown" }, { status: 500 });
  }
}
