import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 60;

const FMP_KEY = process.env.FMP_API_KEY!;
const CACHE_KEY = "wall_st_consensus_all";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// Working FMP stable endpoints (v3/v4 are legacy and blocked)
const FMP_BASE = "https://financialmodelingprep.com/stable";

// Hardcoded 50 S&P500 large cap fallback (used when IVV snapshot not in Supabase)
const FALLBACK_SYMBOLS = [
  "AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","BRK-B","AVGO","JPM",
  "LLY","UNH","XOM","JNJ","V","PG","MA","HD","COST","MRK",
  "ABBV","CVX","CRM","BAC","PEP","KO","WMT","TMO","ACN","MCD",
  "CSCO","ABT","NFLX","AMD","ADBE","DHR","NKE","TXN","ORCL","QCOM",
  "PM","AMGN","UPS","HON","IBM","CAT","GS","SBUX","PLTR","COIN",
];

// Extra symbols always included beyond IVV top 100
const EXTRA_SYMBOLS = ["PLTR","COIN","RBLX","HOOD","SNAP","UBER","DASH","ABNB","DKNG","SOFI"];

export interface ConsensusItem {
  symbol: string;
  name: string;
  sector: string;
  price: number | null;
  targetConsensus: number | null;
  targetHigh: number | null;
  targetLow: number | null;
  upside: number | null;
  analystCount: number;
  rating: string;
}

async function fetchJSON(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error(`[wall-st-consensus] HTTP ${res.status} for ${url}`);
      return null;
    }
    const json = await res.json();
    // Detect legacy error response
    if (json && typeof json === "object" && !Array.isArray(json) && "Error Message" in (json as object)) {
      console.error(`[wall-st-consensus] FMP error: ${(json as { "Error Message": string })["Error Message"].slice(0, 80)}`);
      return null;
    }
    return json;
  } catch (err) {
    console.error(`[wall-st-consensus] fetch error for ${url}:`, err);
    return null;
  }
}

// overallScore: 5=Strong Buy, 4=Buy, 3=Hold, 2=Sell, 1=Strong Sell
function scoreToRating(score: number): string {
  if (score >= 4.5) return "Strong Buy";
  if (score >= 3.5) return "Buy";
  if (score >= 2.5) return "Hold";
  if (score >= 1.5) return "Sell";
  return "Strong Sell";
}

async function fetchConsensusItem(symbol: string, idx: number): Promise<ConsensusItem | null> {
  const [profileData, targetData, ratingData] = await Promise.all([
    fetchJSON(`${FMP_BASE}/profile?symbol=${symbol}&apikey=${FMP_KEY}`),
    fetchJSON(`${FMP_BASE}/price-target-summary?symbol=${symbol}&apikey=${FMP_KEY}`),
    fetchJSON(`${FMP_BASE}/ratings-snapshot?symbol=${symbol}&apikey=${FMP_KEY}`),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = Array.isArray(profileData) ? (profileData[0] as any) : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const target = Array.isArray(targetData) ? (targetData[0] as any) : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ratingSnap = Array.isArray(ratingData) ? (ratingData[0] as any) : null;

  if (idx < 3) {
    console.log(`[wall-st-consensus] Sample[${idx}] ${symbol}:`, {
      profilePrice: profile?.price,
      profileName: profile?.companyName ?? profile?.name,
      profileSector: profile?.sector,
      targetLastMonth: target?.lastMonthAvgPriceTarget,
      targetLastMonthCount: target?.lastMonthCount,
      targetLastQuarter: target?.lastQuarterAvgPriceTarget,
      targetLastQuarterCount: target?.lastQuarterCount,
      ratingScore: ratingSnap?.overallScore,
      ratingLabel: ratingSnap?.rating,
    });
  }

  if (!profile && !target) {
    console.error(`[wall-st-consensus] No data at all for ${symbol}`);
    return null;
  }

  const price: number | null = profile?.price ?? null;

  // Prefer lastMonth if it has data, else lastQuarter, else lastYear
  const targetConsensus: number | null = (() => {
    if (target?.lastMonthCount > 0 && target?.lastMonthAvgPriceTarget > 0) return target.lastMonthAvgPriceTarget;
    if (target?.lastQuarterCount > 0 && target?.lastQuarterAvgPriceTarget > 0) return target.lastQuarterAvgPriceTarget;
    if (target?.lastYearCount > 0 && target?.lastYearAvgPriceTarget > 0) return target.lastYearAvgPriceTarget;
    return null;
  })();

  const analystCount: number = (() => {
    if (target?.lastMonthCount > 0) return target.lastMonthCount;
    if (target?.lastQuarterCount > 0) return target.lastQuarterCount;
    return 0;
  })();

  const upside = price && targetConsensus
    ? Math.round(((targetConsensus - price) / price) * 1000) / 10
    : null;

  const overallScore: number = ratingSnap?.overallScore ?? 0;
  const rating = overallScore > 0 ? scoreToRating(overallScore) : "N/A";

  return {
    symbol,
    name: profile?.companyName ?? profile?.name ?? symbol,
    sector: profile?.sector ?? "",
    price,
    targetConsensus: targetConsensus ? Math.round(targetConsensus * 100) / 100 : null,
    targetHigh: null,   // not available in stable API
    targetLow: null,    // not available in stable API
    upside,
    analystCount,
    rating,
  };
}

export async function GET(request: NextRequest) {
  try {
    const refresh = request.nextUrl.searchParams.get("refresh") === "true";

    // 1. Check cache (unless refresh requested)
    if (!refresh) {
      const { data: cached } = await supabaseAdmin
        .from("legend_screener_cache")
        .select("results, created_at")
        .eq("cache_key", CACHE_KEY)
        .single();

      if (cached) {
        const age = Date.now() - new Date(cached.created_at).getTime();
        if (age < CACHE_TTL_MS) {
          console.log(`[wall-st-consensus] Cache hit, age=${Math.round(age / 60000)}min`);
          return NextResponse.json({
            ok: true,
            items: cached.results,
            cached: true,
            updatedAt: cached.created_at,
          });
        }
      }
    }

    // 2. Get IVV top 100 from Supabase etf_holdings_snapshot
    let symbols: string[] = [];
    try {
      const { data: latestDate } = await supabaseAdmin
        .from("etf_holdings_snapshot")
        .select("snapshot_date")
        .eq("etf_ticker", "IVV")
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .single();

      if (latestDate) {
        const { data: holdings } = await supabaseAdmin
          .from("etf_holdings_snapshot")
          .select("symbol")
          .eq("etf_ticker", "IVV")
          .eq("snapshot_date", latestDate.snapshot_date)
          .order("weight", { ascending: false, nullsFirst: false })
          .limit(100);
        symbols = (holdings ?? []).map((h) => h.symbol);
        console.log(`[wall-st-consensus] IVV snapshot: ${symbols.length} symbols from ${latestDate.snapshot_date}`);
      }
    } catch (err) {
      console.error(`[wall-st-consensus] Supabase IVV query failed:`, err);
    }

    // Fallback to hardcoded list
    if (symbols.length === 0) {
      console.log(`[wall-st-consensus] Using hardcoded fallback list (${FALLBACK_SYMBOLS.length} symbols)`);
      symbols = FALLBACK_SYMBOLS;
    }

    // Merge with extra symbols (deduplicate)
    const allSymbols = [...new Set([...symbols, ...EXTRA_SYMBOLS])];
    console.log(`[wall-st-consensus] Fetching ${allSymbols.length} symbols`);

    // 3. Batch fetch in groups of 10
    const results: ConsensusItem[] = [];
    const BATCH_SIZE = 10;
    for (let i = 0; i < allSymbols.length; i += BATCH_SIZE) {
      const batch = allSymbols.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((sym, j) => fetchConsensusItem(sym, i + j))
      );
      const valid = batchResults.filter((r): r is ConsensusItem => r !== null);
      results.push(...valid);
      console.log(`[wall-st-consensus] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${valid.length}/${batch.length} ok`);
    }

    console.log(`[wall-st-consensus] Total results: ${results.length}/${allSymbols.length}`);

    // Filter: only include symbols with at least a price OR a target
    const filtered = results.filter((r) => r.price !== null || r.targetConsensus !== null);

    // Sort by upside% descending (nulls last)
    filtered.sort((a, b) => {
      if (a.upside == null && b.upside == null) return 0;
      if (a.upside == null) return 1;
      if (b.upside == null) return -1;
      return b.upside - a.upside;
    });

    // 4. Cache result
    try {
      await supabaseAdmin.from("legend_screener_cache").delete().eq("cache_key", CACHE_KEY);
      await supabaseAdmin.from("legend_screener_cache").insert({
        cache_key: CACHE_KEY,
        results: filtered,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[wall-st-consensus] Cache write failed:", err);
    }

    return NextResponse.json({
      ok: true,
      items: filtered,
      total: allSymbols.length,
      cached: false,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[wall-st-consensus] Top-level error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
