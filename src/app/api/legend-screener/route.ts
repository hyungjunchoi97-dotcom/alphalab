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
interface StockData {
  symbol: string;
  // key-metrics
  roe?: number;
  npm?: number;
  de?: number;
  pe?: number;
  // quote
  price: number;
  changePct: number;
  name: string;
  // income-statement derived
  epsYoY?: number;
  revYoY?: number;
}

interface KeyMetric {
  returnOnEquity?: number;
}

interface RatioItem {
  netProfitMargin?: number;
  debtToEquityRatio?: number;
  priceToEarningsRatio?: number;
}

interface IncomeStmt {
  revenue?: number;
  eps?: number;
}

interface QuoteItem {
  symbol?: string;
  price?: number;
  changesPercentage?: number;
  name?: string;
}

async function fetchStockData(symbol: string): Promise<StockData | null> {
  const [metrics, ratios, income, quote] = await Promise.all([
    fmpGet<KeyMetric[]>(`/key-metrics?symbol=${symbol}&period=annual&limit=1`),
    fmpGet<RatioItem[]>(`/ratios?symbol=${symbol}&period=annual&limit=1`),
    fmpGet<IncomeStmt[]>(`/income-statement?symbol=${symbol}&period=annual&limit=2`),
    fmpGet<QuoteItem[]>(`/quote?symbol=${symbol}`),
  ]);

  const q = Array.isArray(quote) ? quote[0] : null;
  if (symbol === "AAPL") console.log("[DEBUG AAPL]", JSON.stringify({m: metrics?.[0]?.returnOnEquity, r: ratios?.[0]?.netProfitMargin, q: q?.price}));
  if (!q?.price) return null;

  const m = Array.isArray(metrics) ? metrics[0] : null;
  const r = Array.isArray(ratios) ? ratios[0] : null;
  const incArr = Array.isArray(income) ? income : [];

  // DEBUG: AAPL only
  if (symbol === "AAPL") {
    console.log("[DEBUG AAPL] key-metrics:", JSON.stringify(m));
    console.log("[DEBUG AAPL] ratios:", JSON.stringify(r));
    console.log("[DEBUG AAPL] income-statement:", JSON.stringify(incArr));
    console.log("[DEBUG AAPL] quote:", JSON.stringify(q));
  }

  // YoY growth: income[0] = latest, income[1] = previous year
  let epsYoY: number | undefined;
  let revYoY: number | undefined;
  if (incArr.length >= 2) {
    const cur = incArr[0];
    const prev = incArr[1];
    if (prev.eps && prev.eps > 0 && cur.eps != null) {
      epsYoY = ((cur.eps - prev.eps) / Math.abs(prev.eps)) * 100;
    }
    if (prev.revenue && prev.revenue > 0 && cur.revenue != null) {
      revYoY = ((cur.revenue - prev.revenue) / Math.abs(prev.revenue)) * 100;
    }
  }

  return {
    symbol,
    roe: m?.returnOnEquity,
    npm: r?.netProfitMargin,
    de: r?.debtToEquityRatio,
    pe: r?.priceToEarningsRatio,
    price: q.price,
    changePct: q.changesPercentage ?? 0,
    name: q.name || symbol,
    epsYoY,
    revYoY,
  };
}

// ── Criteria builders ──────────────────────────────────────────
const pct = (v: number | undefined) => (v != null ? v * 100 : null);
const fmtPct = (v: number | null) => (v != null ? `${v.toFixed(1)}%` : "N/A");

function buildCriteria(guru: GuruKey, d: StockData): LegendResult["criteria"] {
  const roe = pct(d.roe);
  const npm = pct(d.npm);
  const de = d.de;
  const pe = d.pe;
  const revG = d.revYoY;
  const epsG = d.epsYoY;

  switch (guru) {
    case "buffett":
      return [
        { label: "ROE > 15%", value: fmtPct(roe), passed: roe != null && roe > 15 },
        { label: "NPM > 10%", value: fmtPct(npm), passed: npm != null && npm > 10 },
        { label: "D/E < 2.0", value: de != null ? de.toFixed(2) : "N/A", passed: de != null && de < 2.0 },
        { label: "EPS YoY Growth", value: fmtPct(epsG ?? null), passed: epsG != null && epsG > 0 },
      ];
    case "oneil":
      return [
        { label: "EPS YoY > 25%", value: fmtPct(epsG ?? null), passed: epsG != null && epsG > 25 },
        { label: "Rev YoY > 20%", value: fmtPct(revG ?? null), passed: revG != null && revG > 20 },
        { label: "Price > $15", value: `$${d.price.toFixed(2)}`, passed: d.price > 15 },
      ];
    case "lynch":
      return [
        { label: "P/E 5–20", value: pe != null ? pe.toFixed(1) : "N/A", passed: pe != null && pe > 5 && pe < 20 },
        { label: "Rev YoY > 10%", value: fmtPct(revG ?? null), passed: revG != null && revG > 10 },
        { label: "D/E < 1", value: de != null ? de.toFixed(2) : "N/A", passed: de != null && de < 1 },
      ];
    case "druckenmiller":
      return [
        { label: "Rev YoY > 20%", value: fmtPct(revG ?? null), passed: revG != null && revG > 20 },
        { label: "EPS YoY > 15%", value: fmtPct(epsG ?? null), passed: epsG != null && epsG > 15 },
        { label: "ROE > 10%", value: fmtPct(roe), passed: roe != null && roe > 10 },
      ];
  }
}

// ── Screen runner ──────────────────────────────────────────────
async function runScreen(guru: GuruKey): Promise<LegendResult[]> {
  const results: LegendResult[] = [];
  const BATCH = 10;

  for (let i = 0; i < SP100.length; i += BATCH) {
    const batch = SP100.slice(i, i + BATCH);
    const batchData = await Promise.all(batch.map((sym) => fetchStockData(sym)));
    await new Promise(r => setTimeout(r, 300));

    for (const d of batchData) {
      if (!d) continue;
      const criteria = buildCriteria(guru, d);
      const score = criteria.filter((c) => c.passed).length;
      const minScore = guru === "buffett" ? 3 : 2;
      if (score < minScore) continue;
      results.push({
        symbol: d.symbol,
        name: d.name,
        market: "US",
        price: d.price,
        change_pct: d.changePct,
        score,
        max_score: criteria.length,
        criteria,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score || b.change_pct - a.change_pct);
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
            stats: { scanned: SP100.length, passed: Array.isArray(data.results) ? data.results.length : 0 },
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
          stats: { scanned: SP100.length, passed: mem.results.length },
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
      stats: { scanned: SP100.length, passed: results.length },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
