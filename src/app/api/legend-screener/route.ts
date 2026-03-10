import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 60;

const FMP_KEY = process.env.FMP_API_KEY;
const FMP_BASE = "https://financialmodelingprep.com/stable";
const CACHE_TTL_HOURS = 24;

// ── S&P 100 ────────────────────────────────────────────────────
const SP100 = [
  "AAPL","MSFT","NVDA","AMZN","GOOGL","META","BRK-B","LLY","AVGO","TSLA",
  "JPM","UNH","V","XOM","MA","COST","HD","PG","JNJ","ABBV",
  "BAC","MRK","KO","CVX","CRM","NFLX","AMD","PEP","TMO","ACN",
  "MCD","ADBE","LIN","DHR","WMT","TXN","NEE","PM","MS","ORCL",
  "AMGN","RTX","GE","HON","QCOM","UPS","IBM","INTU","CAT","SPGI",
  "DE","GS","BLK","ISRG","MDLZ","AXP","GILD","ADI","VRTX","PLD",
  "SYK","REGN","LRCX","NOW","MMC","ZTS","BSX","ETN","MO","KLAC",
  "CI","CME","AON","MCO","SHW","DUK","SO","PGR","TGT","SCHW",
  "HUM","ELV","ICE","APD","ITW","NSC","FDX","EMR","PSA","WM",
  "ROP","MAR","MCHP","AIG","TFC","USB","MMM","COP","OXY",
];

// ── Types ──────────────────────────────────────────────────────
interface ScreenerResult {
  symbol: string;
  name: string;
  price: number;
  change_pct: number;
  per: number | null;
  epsYoY: number | null;
  epsQoQ: number | null;
  revYoY: number | null;
  distFromHigh: number | null;
}

interface Filters {
  per?: number;
  epsYoY?: number;
  epsQoQ?: number;
  revYoY?: number;
  nearHigh?: number;
}

// ── FMP helper ─────────────────────────────────────────────────
async function fmpGet<T>(path: string): Promise<T | null> {
  try {
    const url = `${FMP_BASE}${path}${path.includes("?") ? "&" : "?"}apikey=${FMP_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Per-symbol data fetch ──────────────────────────────────────
interface KeyMetric { returnOnEquity?: number }
interface RatioItem { netProfitMargin?: number; debtToEquityRatio?: number; priceToEarningsRatio?: number }
interface IncomeStmt { revenue?: number; eps?: number }
interface QuoteItem { symbol?: string; price?: number; changesPercentage?: number; name?: string; yearHigh?: number }

interface StockData {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  per: number | null;
  epsYoY: number | null;
  epsQoQ: number | null;
  revYoY: number | null;
  distFromHigh: number | null;
}

async function fetchStockData(symbol: string): Promise<StockData | null> {
  const [ratios, incomeAnn, incomeQ, quote] = await Promise.all([
    fmpGet<RatioItem[]>(`/ratios?symbol=${symbol}&period=annual&limit=1`),
    fmpGet<IncomeStmt[]>(`/income-statement?symbol=${symbol}&period=annual&limit=2`),
    fmpGet<IncomeStmt[]>(`/income-statement?symbol=${symbol}&period=quarter&limit=2`),
    fmpGet<QuoteItem[]>(`/quote?symbol=${symbol}`),
  ]);

  const q = Array.isArray(quote) ? quote[0] : null;
  if (!q?.price) return null;

  const r = Array.isArray(ratios) ? ratios[0] : null;
  const annArr = Array.isArray(incomeAnn) ? incomeAnn : [];
  const qArr = Array.isArray(incomeQ) ? incomeQ : [];

  // P/E from ratios
  const per = r?.priceToEarningsRatio ?? null;

  // Annual YoY: incomeAnn[0] = latest, incomeAnn[1] = previous
  let epsYoY: number | null = null;
  let revYoY: number | null = null;
  if (annArr.length >= 2) {
    const cur = annArr[0];
    const prev = annArr[1];
    if (prev.eps && prev.eps > 0 && cur.eps != null) {
      epsYoY = ((cur.eps - prev.eps) / Math.abs(prev.eps)) * 100;
    }
    if (prev.revenue && prev.revenue > 0 && cur.revenue != null) {
      revYoY = ((cur.revenue - prev.revenue) / Math.abs(prev.revenue)) * 100;
    }
  }

  // Quarterly QoQ EPS
  let epsQoQ: number | null = null;
  if (qArr.length >= 2) {
    const cur = qArr[0];
    const prev = qArr[1];
    if (prev.eps && prev.eps > 0 && cur.eps != null) {
      epsQoQ = ((cur.eps - prev.eps) / Math.abs(prev.eps)) * 100;
    }
  }

  // Distance from 52-week high
  const yearHigh = q.yearHigh ?? 0;
  const distFromHigh = yearHigh > 0 ? ((yearHigh - q.price) / yearHigh) * 100 : null;

  return {
    symbol,
    name: q.name || symbol,
    price: q.price,
    changePct: q.changesPercentage ?? 0,
    per,
    epsYoY: epsYoY != null ? Math.round(epsYoY * 10) / 10 : null,
    epsQoQ: epsQoQ != null ? Math.round(epsQoQ * 10) / 10 : null,
    revYoY: revYoY != null ? Math.round(revYoY * 10) / 10 : null,
    distFromHigh: distFromHigh != null ? Math.round(distFromHigh * 10) / 10 : null,
  };
}

// ── Filter + Screen ────────────────────────────────────────────
function matchFilters(d: StockData, f: Filters): boolean {
  if (f.per != null && (d.per == null || d.per > f.per || d.per <= 0)) return false;
  if (f.epsYoY != null && (d.epsYoY == null || d.epsYoY < f.epsYoY)) return false;
  if (f.epsQoQ != null && (d.epsQoQ == null || d.epsQoQ < f.epsQoQ)) return false;
  if (f.revYoY != null && (d.revYoY == null || d.revYoY < f.revYoY)) return false;
  if (f.nearHigh != null && (d.distFromHigh == null || d.distFromHigh > f.nearHigh)) return false;
  return true;
}

async function runScreen(filters: Filters): Promise<ScreenerResult[]> {
  const results: ScreenerResult[] = [];
  const BATCH = 10;

  for (let i = 0; i < SP100.length; i += BATCH) {
    const batch = SP100.slice(i, i + BATCH);
    const batchData = await Promise.all(batch.map((sym) => fetchStockData(sym)));
    await new Promise(r => setTimeout(r, 300));

    for (const d of batchData) {
      if (!d) continue;
      if (!matchFilters(d, filters)) continue;
      results.push({
        symbol: d.symbol,
        name: d.name,
        price: d.price,
        change_pct: d.changePct,
        per: d.per != null ? Math.round(d.per * 10) / 10 : null,
        epsYoY: d.epsYoY,
        epsQoQ: d.epsQoQ,
        revYoY: d.revYoY,
        distFromHigh: d.distFromHigh,
      });
    }
  }

  return results.sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0));
}

// ── In-memory fallback cache ───────────────────────────────────
const memCache = new Map<string, { results: ScreenerResult[]; at: number }>();

// ── GET handler ────────────────────────────────────────────────
function buildCacheKey(f: Filters): string {
  const parts = ["screener"];
  if (f.per != null) parts.push(`per${f.per}`);
  if (f.epsYoY != null) parts.push(`epsYoY${f.epsYoY}`);
  if (f.epsQoQ != null) parts.push(`epsQoQ${f.epsQoQ}`);
  if (f.revYoY != null) parts.push(`revYoY${f.revYoY}`);
  if (f.nearHigh != null) parts.push(`nearHigh${f.nearHigh}`);
  return parts.join("_");
}

export async function GET(request: NextRequest) {
  if (!FMP_KEY) {
    return NextResponse.json({ ok: false, error: "FMP_API_KEY not configured" }, { status: 500 });
  }

  const sp = request.nextUrl.searchParams;
  const refresh = sp.get("refresh") === "true";

  const filters: Filters = {};
  const perVal = sp.get("per");
  const epsYoYVal = sp.get("epsYoY");
  const epsQoQVal = sp.get("epsQoQ");
  const revYoYVal = sp.get("revYoY");
  const nearHighVal = sp.get("nearHigh");

  if (perVal) filters.per = Number(perVal);
  if (epsYoYVal) filters.epsYoY = Number(epsYoYVal);
  if (epsQoQVal) filters.epsQoQ = Number(epsQoQVal);
  if (revYoYVal) filters.revYoY = Number(revYoYVal);
  if (nearHighVal) filters.nearHigh = Number(nearHighVal);

  // Must have at least one filter
  if (Object.keys(filters).length === 0) {
    return NextResponse.json({ ok: false, error: "At least one filter required (per, epsYoY, epsQoQ, revYoY, nearHigh)" }, { status: 400 });
  }

  const cacheKey = buildCacheKey(filters);

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
          });
        }
      }
    } catch {
      const mem = memCache.get(cacheKey);
      if (mem && (Date.now() - mem.at) < CACHE_TTL_HOURS * 60 * 60 * 1000) {
        return NextResponse.json({
          ok: true,
          results: mem.results,
          cached: true,
          updated_at: new Date(mem.at).toISOString(),
        });
      }
    }
  }

  try {
    const results = await runScreen(filters);

    // Save to cache
    memCache.set(cacheKey, { results, at: Date.now() });
    try {
      await supabaseAdmin.from("legend_screener_cache").delete().eq("cache_key", cacheKey);
      await supabaseAdmin.from("legend_screener_cache").insert({
        cache_key: cacheKey,
        results,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[legend-screener] Cache write error:", err);
    }

    return NextResponse.json({
      ok: true,
      results,
      cached: false,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
