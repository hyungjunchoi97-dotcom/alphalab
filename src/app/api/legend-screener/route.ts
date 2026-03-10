import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 60;

const FMP_KEY = process.env.FMP_API_KEY;
const FMP_BASE = "https://financialmodelingprep.com/stable";
const CACHE_TTL_HOURS = 24;

// ── Types ──────────────────────────────────────────────────────
interface LegendResult {
  symbol: string;
  name: string;
  market: "US";
  price: number;
  change_pct: number;
  score: number;
  max_score: number;
  criteria: { label: string; value: string; passed: boolean }[];
}

type GuruKey = "buffett" | "oneil" | "lynch" | "druckenmiller";

// ── FMP helpers ────────────────────────────────────────────────
async function fmpGet<T>(path: string): Promise<T | null> {
  try {
    const url = `${FMP_BASE}${path}${path.includes("?") ? "&" : "?"}apikey=${FMP_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Phase 1: FMP screener with built-in filters per guru ──────
interface ScreenerItem {
  symbol: string;
  companyName?: string;
  price?: number;
  changesPercentage?: number;
  marketCap?: number;
}

async function getPreFilteredSymbols(guru: GuruKey): Promise<ScreenerItem[]> {
  let params = "exchange=NYSE,NASDAQ&isActivelyTrading=true&marketCapMoreThan=2000000000";

  switch (guru) {
    case "buffett":
      // ROE > 15%, NPM > 10%, low debt
      params += "&returnOnEquityMoreThan=15&netProfitMarginMoreThan=10&limit=50";
      break;
    case "oneil":
      // High growth, actively trading
      params += "&revenueGrowthMoreThan=20&limit=60";
      break;
    case "lynch":
      // Reasonable PE, some growth, low debt
      params += "&peRatioLessThan=20&revenueGrowthMoreThan=10&limit=60";
      break;
    case "druckenmiller":
      // High revenue growth (momentum)
      params += "&revenueGrowthMoreThan=20&limit=60";
      break;
  }

  const data = await fmpGet<ScreenerItem[]>(`/stock-screener?${params}`);
  if (!data || !Array.isArray(data)) return [];
  return data;
}

// ── Phase 2: Detailed screening for top candidates ─────────────

async function detailBuffett(symbol: string, name: string, prePrice: number, preChg: number): Promise<LegendResult | null> {
  const [ratios, income] = await Promise.all([
    fmpGet<{ roe?: number; debtEquityRatio?: number; netProfitMargin?: number }[]>(`/financial-ratios/${symbol}?period=annual&limit=1`),
    fmpGet<{ eps?: number }[]>(`/income-statement/${symbol}?period=annual&limit=5`),
  ]);

  const r = Array.isArray(ratios) ? ratios[0] : null;
  if (!r) return null;

  const roe = r.roe != null ? r.roe * 100 : null;
  const debtEq = r.debtEquityRatio ?? null;
  const npm = r.netProfitMargin != null ? r.netProfitMargin * 100 : null;

  const epsList = Array.isArray(income) ? income.map((i) => i.eps ?? 0).reverse() : [];
  let epsGrowing = false;
  if (epsList.length >= 4) {
    epsGrowing = epsList.slice(-3).every((v, i, a) => i === 0 || v > a[i - 1]);
  }

  const criteria: LegendResult["criteria"] = [
    { label: "ROE > 15%", value: roe != null ? `${roe.toFixed(1)}%` : "N/A", passed: roe != null && roe > 15 },
    { label: "D/E < 0.5", value: debtEq != null ? debtEq.toFixed(2) : "N/A", passed: debtEq != null && debtEq < 0.5 },
    { label: "NPM > 10%", value: npm != null ? `${npm.toFixed(1)}%` : "N/A", passed: npm != null && npm > 10 },
    { label: "EPS 3Y Growth", value: epsGrowing ? "Yes" : "No", passed: epsGrowing },
  ];

  const score = criteria.filter((c) => c.passed).length;
  if (score < 2) return null;

  return { symbol, name, market: "US", price: prePrice, change_pct: preChg, score, max_score: 4, criteria };
}

async function detailOneil(symbol: string, name: string, prePrice: number, preChg: number): Promise<LegendResult | null> {
  const [income, quote] = await Promise.all([
    fmpGet<{ eps?: number }[]>(`/income-statement/${symbol}?period=quarter&limit=8`),
    fmpGet<{ price?: number; changesPercentage?: number; yearHigh?: number }[]>(`/quote/${symbol}`),
  ]);

  const q = Array.isArray(quote) ? quote[0] : null;
  const price = q?.price ?? prePrice;
  const yearHigh = q?.yearHigh ?? 0;

  const epsList = Array.isArray(income) ? income.map((i) => i.eps ?? 0).reverse() : [];
  let epsQoQ = 0;
  if (epsList.length >= 2) {
    const prev = epsList[epsList.length - 2];
    const cur = epsList[epsList.length - 1];
    if (prev > 0) epsQoQ = ((cur - prev) / prev) * 100;
  }

  const distFromHigh = yearHigh > 0 ? ((yearHigh - price) / yearHigh) * 100 : 100;

  const criteria: LegendResult["criteria"] = [
    { label: "EPS QoQ +25%", value: `${epsQoQ.toFixed(1)}%`, passed: epsQoQ >= 25 },
    { label: "Near 52W High", value: `${distFromHigh.toFixed(1)}% off`, passed: distFromHigh <= 10 },
  ];

  const score = criteria.filter((c) => c.passed).length;
  if (score < 1) return null;

  return { symbol, name, market: "US", price, change_pct: q?.changesPercentage ?? preChg, score, max_score: 2, criteria };
}

async function detailLynch(symbol: string, name: string, prePrice: number, preChg: number): Promise<LegendResult | null> {
  const ratios = await fmpGet<{ priceEarningsToGrowthRatio?: number; debtEquityRatio?: number }[]>(
    `/financial-ratios/${symbol}?period=annual&limit=1`
  );

  const r = Array.isArray(ratios) ? ratios[0] : null;
  if (!r) return null;

  const peg = r.priceEarningsToGrowthRatio ?? null;
  const debtEq = r.debtEquityRatio ?? null;

  const criteria: LegendResult["criteria"] = [
    { label: "PEG < 1", value: peg != null ? peg.toFixed(2) : "N/A", passed: peg != null && peg > 0 && peg < 1 },
    { label: "Low D/E", value: debtEq != null ? debtEq.toFixed(2) : "N/A", passed: debtEq != null && debtEq < 1 },
  ];

  const score = criteria.filter((c) => c.passed).length;
  if (score < 1) return null;

  return { symbol, name, market: "US", price: prePrice, change_pct: preChg, score, max_score: 2, criteria };
}

async function detailDruckenmiller(symbol: string, name: string, prePrice: number, preChg: number): Promise<LegendResult | null> {
  const [quote, growth] = await Promise.all([
    fmpGet<{ price?: number; changesPercentage?: number; yearHigh?: number }[]>(`/quote/${symbol}`),
    fmpGet<{ revenueGrowth?: number }[]>(`/financial-growth/${symbol}?period=annual&limit=1`),
  ]);

  const q = Array.isArray(quote) ? quote[0] : null;
  const g = Array.isArray(growth) ? growth[0] : null;

  const price = q?.price ?? prePrice;
  const yearHigh = q?.yearHigh ?? 0;
  const distFromHigh = yearHigh > 0 ? ((yearHigh - price) / yearHigh) * 100 : 100;
  const revGrowth = g?.revenueGrowth != null ? g.revenueGrowth * 100 : null;

  const criteria: LegendResult["criteria"] = [
    { label: "Near 52W High", value: `${distFromHigh.toFixed(1)}% off`, passed: distFromHigh <= 5 },
    { label: "Rev Growth >20%", value: revGrowth != null ? `${revGrowth.toFixed(1)}%` : "N/A", passed: revGrowth != null && revGrowth > 20 },
  ];

  const score = criteria.filter((c) => c.passed).length;
  if (score < 1) return null;

  return { symbol, name, market: "US", price, change_pct: q?.changesPercentage ?? preChg, score, max_score: 2, criteria };
}

// ── Two-phase screening ───────────────────────────────────────

async function runScreen(guru: GuruKey): Promise<LegendResult[]> {
  // Phase 1: Get pre-filtered candidates from FMP screener (1 API call)
  const candidates = await getPreFilteredSymbols(guru);
  if (candidates.length === 0) return [];

  // Take top 25 candidates for detailed screening
  const top = candidates.slice(0, 25);

  // Phase 2: Detailed screening in parallel batches of 10
  const BATCH = 10;
  const results: LegendResult[] = [];

  for (let i = 0; i < top.length; i += BATCH) {
    const batch = top.slice(i, i + BATCH);
    const promises = batch.map(async (item) => {
      const sym = item.symbol;
      const name = item.companyName || sym;
      const price = item.price ?? 0;
      const chg = item.changesPercentage ?? 0;
      try {
        switch (guru) {
          case "buffett": return await detailBuffett(sym, name, price, chg);
          case "oneil": return await detailOneil(sym, name, price, chg);
          case "lynch": return await detailLynch(sym, name, price, chg);
          case "druckenmiller": return await detailDruckenmiller(sym, name, price, chg);
        }
      } catch {
        return null;
      }
    });
    const batchResults = await Promise.all(promises);
    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }

  return results
    .sort((a, b) => b.score - a.score || b.change_pct - a.change_pct)
    .slice(0, 30);
}

// ── In-memory fallback cache ───────────────────────────────────
const memCache = new Map<string, { results: LegendResult[]; at: number }>();

// ── GET handler ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!FMP_KEY) {
    return NextResponse.json({ ok: false, error: "FMP_API_KEY not configured" }, { status: 500 });
  }

  const guru = (request.nextUrl.searchParams.get("guru") || "buffett") as GuruKey;
  const refresh = request.nextUrl.searchParams.get("refresh") === "true";

  if (!["buffett", "oneil", "lynch", "druckenmiller"].includes(guru)) {
    return NextResponse.json({ ok: false, error: "Invalid guru" }, { status: 400 });
  }

  const cacheKey = `legend_${guru}_US`;

  // Check cache (Supabase first, then in-memory fallback)
  if (!refresh) {
    try {
      const { data } = await supabaseAdmin
        .from("legend_screener_cache")
        .select("results, created_at")
        .eq("cache_key", cacheKey)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        const age = (Date.now() - new Date(data.created_at).getTime()) / (1000 * 60 * 60);
        if (age < CACHE_TTL_HOURS) {
          return NextResponse.json({
            ok: true,
            results: data.results,
            cached: true,
            updated_at: data.created_at,
            stats: { scanned: 0, passed: Array.isArray(data.results) ? data.results.length : 0 },
          });
        }
      }
    } catch {
      // Supabase cache miss — try in-memory
      const mem = memCache.get(cacheKey);
      if (mem && (Date.now() - mem.at) < CACHE_TTL_HOURS * 60 * 60 * 1000) {
        return NextResponse.json({
          ok: true,
          results: mem.results,
          cached: true,
          updated_at: new Date(mem.at).toISOString(),
          stats: { scanned: 0, passed: mem.results.length },
        });
      }
    }
  }

  try {
    const results = await runScreen(guru);

    // Save to cache (Supabase + in-memory fallback)
    memCache.set(cacheKey, { results, at: Date.now() });
    try {
      await supabaseAdmin.from("legend_screener_cache").delete().eq("cache_key", cacheKey);
      await supabaseAdmin.from("legend_screener_cache").insert({
        cache_key: cacheKey,
        results,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[legend-screener] Cache write error (using in-memory fallback):", err);
    }

    return NextResponse.json({
      ok: true,
      results,
      cached: false,
      updated_at: new Date().toISOString(),
      stats: { scanned: 25, passed: results.length },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
