import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 60;

const CACHE_TTL_HOURS = 1;

// ── Sector symbol lists ─────────────────────────────────────
const SECTORS: Record<string, string[]> = {
  tech: [
    "AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","AVGO","NFLX","AMD",
    "ADBE","QCOM","INTU","AMGN","TXN","ISRG","BKNG","VRTX","REGN","MU",
    "PANW","LRCX","KLAC","SNPS","CDNS","MELI","ORLY","ABNB","FTNT","CRWD",
    "CTAS","ROP","PAYX","ODFL","FAST","IDXX","DXCM","ZS","GEHC","CTSH",
    "ANSS","TEAM","ADP","EA","ROST","CPRT","WDAY","MRVL","NXPI","PYPL",
    "CSX","EBAY","DDOG","UBER","COIN","RBLX","SNAP","TTD","ROKU","HUBS",
    "OKTA","NOW","CRM","ORCL","IBM","INTC","AMAT","ASML","MCHP","ON",
    "SMCI","PCAR","NTAP","ANET","HPE","DELL","WDC","STX","KEYS","TER",
    "MKSI","ENTG","ONTO","CAMT","ACLS","UCTT","FORM","RMBS","WOLF","ALGM",
    "DIOD","VICR","MTSI","SITM","RELY",
  ],
  financial: [
    "JPM","BAC","WFC","GS","MS","BLK","SCHW","AXP","USB","PNC",
    "TFC","COF","BK","STT","NTRS","FITB","RF","HBAN","CFG","KEY",
    "MTB","ZION","CMA","ALLY","SYF","DFS","AIG","MET","PRU","AFL",
    "ALL","PGR","TRV","CB","MMC","AON","MCO","SPGI","ICE","CME",
    "NDAQ","CBOE","MKTX","LPLA","RJF","SF","PIPR","EVR","HLI","LAZ",
  ],
  healthcare: [
    "UNH","JNJ","LLY","ABBV","MRK","TMO","ABT","DHR","BMY","AMGN",
    "GILD","REGN","VRTX","ISRG","SYK","BSX","MDT","EW","ZBH","BAX",
    "BDX","RMD","HOLX","IDXX","IQV","CRL","PKI","NTRA","INCY","ALNY",
    "BMRN","SRPT","RARE","FOLD","ARWR","IONS","NTLA","BEAM","CRSP",
    "EDIT","TGTX","AGIO","IMVT","RCKT","PRAX","KROS",
  ],
  energy: [
    "XOM","CVX","COP","EOG","SLB","MPC","VLO","PSX","OXY","HES",
    "DVN","FANG","APA","MRO","HAL","BKR","NOV","HP","PTEN","RIG",
    "VAL","TDW","WHD","LBRT","OII","AROC","USAC","TELL","LNG","NFE",
    "SM","MTDR","VTLE","TALO","SWN","RRC","EQT","CNX","AR","CTRA",
    "MGY","VNOM","BSM","KRP","DINO","PBF","CLMT","REX","PARR",
  ],
  consumer: [
    "WMT","COST","TGT","HD","LOW","TJX","ROST","DLTR","DG","MCD",
    "SBUX","YUM","CMG","DPZ","QSR","TXRH","DENN","CAKE","NKE","LULU",
    "UAA","VFC","RL","PVH","HBI","CPRI","EL","ULTA","COTY","IPAR",
    "KO","PEP","MDLZ","HSY","K","GIS","CPB","MKC","SJM","CAG",
    "HRL","TSN","PPC","CALM",
  ],
};

// ── Types ───────────────────────────────────────────────────
interface FomoUsResult {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  volume: number;
  avgVolume: number;
  volumeRatio: number;
  tradingValue: number;
}

// ── Yahoo Finance fetch ─────────────────────────────────────
async function fetchYahooData(symbol: string): Promise<FomoUsResult | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=30d&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price = meta?.regularMarketPrice ?? 0;
    if (price <= 0) return null;

    const prevClose = meta?.chartPreviousClose ?? 0;
    const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
    const name = meta?.longName ?? meta?.shortName ?? symbol;

    // Volume data
    const volumes: number[] = result.indicators?.quote?.[0]?.volume || [];
    const validVols = volumes.filter((v: number | null) => v != null && v > 0) as number[];
    const todayVol = validVols.length > 0 ? validVols[validVols.length - 1] : 0;

    // Average volume from last 20 trading days (exclude today)
    const pastVols = validVols.length > 1 ? validVols.slice(0, -1).slice(-20) : [];
    const avgVolume = pastVols.length > 0
      ? pastVols.reduce((a, b) => a + b, 0) / pastVols.length
      : todayVol;

    const volumeRatio = avgVolume > 0 ? todayVol / avgVolume : 0;
    const tradingValue = price * todayVol;

    return {
      symbol,
      name,
      price: Math.round(price * 100) / 100,
      changePct: Math.round(changePct * 100) / 100,
      volume: todayVol,
      avgVolume: Math.round(avgVolume),
      volumeRatio: Math.round(volumeRatio * 100) / 100,
      tradingValue: Math.round(tradingValue),
    };
  } catch {
    return null;
  }
}

// ── In-memory fallback cache ────────────────────────────────
const memCache = new Map<string, { results: FomoUsResult[]; at: number }>();

// ── GET handler ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const sector = sp.get("sector") || "tech";
  const refresh = sp.get("refresh") === "true";

  const symbols = SECTORS[sector];
  if (!symbols) {
    return NextResponse.json(
      { ok: false, error: `Invalid sector: ${sector}. Valid: ${Object.keys(SECTORS).join(", ")}` },
      { status: 400 },
    );
  }

  const cacheKey = `fomo_us_${sector}`;

  // Check cache
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

  // Fetch fresh data
  try {
    const results: FomoUsResult[] = [];
    const BATCH = 10;

    for (let i = 0; i < symbols.length; i += BATCH) {
      const batch = symbols.slice(i, i + BATCH);
      const batchData = await Promise.all(batch.map(fetchYahooData));
      for (const d of batchData) {
        if (d) results.push(d);
      }
      if (i + BATCH < symbols.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // Sort by trading value descending
    results.sort((a, b) => b.tradingValue - a.tradingValue);

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
      console.error("[fomo-us] Cache write error:", err);
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
