import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const FMP_KEY = process.env.FMP_API_KEY!;
const STABLE = "https://financialmodelingprep.com/stable";
const CACHE_KEY = "macro_commodities_fmp_stable";
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min

interface MemCache { data: CommodityResult[]; cachedAt: number }
let memCache: MemCache | null = null;

interface CommodityConfig {
  id: string;
  symbol: string;          // primary FMP stable symbol
  fallback?: string;       // fallback symbol if primary returns no price
  yahooSymbol?: string;    // Yahoo Finance symbol (overrides FMP when set)
  labelKr: string;
  label: string;
  unit: string;
  category: string;
  tooltipKr: string;
  tooltipEn: string;
}

const COMMODITIES: CommodityConfig[] = [
  // Energy
  { id: "OIL_WTI",   symbol: "WTIUSD", fallback: "USO", labelKr: "WTI 원유",  label: "WTI Crude Oil",      unit: "$/bbl",   category: "energy",    tooltipKr: "한국 에너지 수입 핵심 지표",        tooltipEn: "Key indicator for Korea's energy imports" },
  { id: "OIL_BRENT", symbol: "BZUSD",  labelKr: "브렌트유",   label: "Brent Crude Oil",    unit: "$/bbl",   category: "energy",    tooltipKr: "글로벌 원유 기준가",                tooltipEn: "Global oil benchmark" },
  { id: "GAS",       symbol: "NGUSD",  fallback: "UNG", labelKr: "천연가스",   label: "Natural Gas",        unit: "$/MMBtu", category: "energy",    tooltipKr: "LNG 수입국 한국 직접 영향",         tooltipEn: "Direct impact on Korea LNG imports" },
  { id: "URANIUM",   symbol: "URA",    labelKr: "우라늄",     label: "Uranium ETF (URA)",  unit: "$/share", category: "energy",    tooltipKr: "원전 연료 (SMR/원전 르네상스)",      tooltipEn: "Nuclear fuel (SMR renaissance)" },
  // Precious
  { id: "GOLD",      symbol: "GCUSD",  labelKr: "금",         label: "Gold Futures",       unit: "$/oz",    category: "precious",  tooltipKr: "안전자산 수요 지표",                tooltipEn: "Safe haven demand indicator" },
  { id: "SILVER",    symbol: "SIUSD",  labelKr: "은",         label: "Silver Futures",     unit: "$/oz",    category: "precious",  tooltipKr: "산업용+귀금속 이중 수요",            tooltipEn: "Dual industrial + precious demand" },
  // Industrial
  { id: "COPPER",    symbol: "HGUSD",  fallback: "COPX", labelKr: "구리", label: "Copper Futures", unit: "$/lb",   category: "industrial", tooltipKr: "글로벌 경기 선행지표 (닥터 쿠퍼)", tooltipEn: "Global economic leading indicator" },
  { id: "ALUMINUM",  symbol: "ALUSD",  fallback: "JJU",  labelKr: "알루미늄", label: "Aluminum", unit: "$/t",    category: "industrial", tooltipKr: "경량화 트렌드 핵심 소재",           tooltipEn: "Key lightweight material (auto/aero)" },
  { id: "WHEAT",     symbol: "ZMUSD",  fallback: "WEAT", labelKr: "밀",   label: "Wheat Futures",  unit: "¢/bu",  category: "industrial", tooltipKr: "식량 안보 지표",                   tooltipEn: "Food security indicator" },
  { id: "COAL",      symbol: "BTU",    labelKr: "석탄",   label: "Coal (Peabody BTU)",  unit: "$/share", category: "industrial", tooltipKr: "화력발전 연료 프록시",              tooltipEn: "Thermal coal proxy (Peabody Energy)" },
  // Battery
  { id: "LITHIUM",   symbol: "LTHM",   labelKr: "리튬",   label: "Lithium (LTHM)",      unit: "$/share", category: "battery",   tooltipKr: "2차전지 핵심 소재 (EV/ESS)",        tooltipEn: "Key battery material (EV/ESS demand)" },
  { id: "NICKEL",    symbol: "NIKUSD", fallback: "JJN",  labelKr: "니켈", label: "Nickel Futures", unit: "$/t",    category: "battery",   tooltipKr: "배터리·스테인리스 핵심 소재",       tooltipEn: "Key battery & stainless steel material" },
];

export interface HistoryPoint { date: string; close: number }

export interface CommodityResult {
  id: string;
  symbol: string;
  label: string;
  labelKr: string;
  unit: string;
  category: string;
  price: number;
  change: number;
  changePercent: number;
  prevClose: number;
  high52w: number | null;
  low52w: number | null;
  history: HistoryPoint[];
  tooltipKr: string;
  tooltipEn: string;
}

// ── Quote fetch (single symbol via stable/quote) ──────────────
async function fetchQuote(symbol: string): Promise<{ price: number; change: number; changePercent: number; prevClose: number; high52w: number | null; low52w: number | null } | null> {
  try {
    const url = `${STABLE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${FMP_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      console.warn(`[commodities] quote HTTP ${res.status} for ${symbol}`);
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    const arr = Array.isArray(json) ? json : [];
    const item = arr[0];
    if (!item) return null;
    const price = Number(item.price ?? 0);
    if (price <= 0) return null;
    return {
      price,
      change: Number(item.change ?? 0),
      changePercent: Number(item.changePercentage ?? item.changesPercentage ?? 0),
      prevClose: Number(item.previousClose ?? price),
      high52w: item.yearHigh != null ? Number(item.yearHigh) : null,
      low52w:  item.yearLow  != null ? Number(item.yearLow)  : null,
    };
  } catch (err) {
    console.warn(`[commodities] quote exception for ${symbol}:`, err);
    return null;
  }
}

// ── Historical EOD (30-day sparkline) ─────────────────────────
async function fetchHistory(symbol: string): Promise<HistoryPoint[]> {
  try {
    const to   = new Date();
    const from = new Date(to.getTime() - 32 * 86400000);
    const fmt  = (d: Date) => d.toISOString().slice(0, 10);
    const url  = `${STABLE}/historical-price-eod/light?symbol=${encodeURIComponent(symbol)}&from=${fmt(from)}&to=${fmt(to)}&apikey=${FMP_KEY}`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    // Response is array of { date, close } or { date, open, close, ... }
    const arr: { date: string; close: number }[] = Array.isArray(json)
      ? json
      : Array.isArray(json?.historical)
        ? json.historical
        : [];
    return arr
      .filter((h) => h.close > 0)
      .map((h) => ({ date: h.date, close: h.close }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  } catch {
    return [];
  }
}

// ── Yahoo Finance (WTI/Gas 전용) ───────────────────────────────
const YAHOO_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; AlphaLab/1.0)" };

async function fetchYahooQuote(yahooSym: string): Promise<{ price: number; change: number; changePercent: number; prevClose: number; high52w: number | null; low52w: number | null } | null> {
  try {
    const fields = "regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,fiftyTwoWeekHigh,fiftyTwoWeekLow";
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSym)}&fields=${fields}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: YAHOO_HEADERS });
    if (!res.ok) {
      console.warn(`[commodities] Yahoo quote HTTP ${res.status} for ${yahooSym}`);
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    const item = json?.quoteResponse?.result?.[0];
    if (!item) return null;
    const price = Number(item.regularMarketPrice ?? 0);
    if (price <= 0) return null;
    return {
      price,
      change: Number(item.regularMarketChange ?? 0),
      changePercent: Number(item.regularMarketChangePercent ?? 0),
      prevClose: Number(item.regularMarketPreviousClose ?? price),
      high52w: item.fiftyTwoWeekHigh != null ? Number(item.fiftyTwoWeekHigh) : null,
      low52w:  item.fiftyTwoWeekLow  != null ? Number(item.fiftyTwoWeekLow)  : null,
    };
  } catch (err) {
    console.warn(`[commodities] Yahoo quote exception for ${yahooSym}:`, err);
    return null;
  }
}

async function fetchYahooHistory(yahooSym: string): Promise<HistoryPoint[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=1d&range=1mo`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: YAHOO_HEADERS });
    if (!res.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return [];
    const timestamps: number[] = result.timestamp ?? [];
    const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];
    return timestamps
      .map((ts, i) => ({ date: new Date(ts * 1000).toISOString().slice(0, 10), close: closes[i] }))
      .filter((h) => h.close > 0)
      .slice(-30);
  } catch {
    return [];
  }
}

// ── Fetch single commodity (primary → fallback) ───────────────
async function fetchCommodity(cfg: CommodityConfig): Promise<CommodityResult> {
  let quote;
  let usedSymbol = cfg.symbol;

  if (cfg.yahooSymbol) {
    // Yahoo Finance 우선 (WTI, Gas)
    quote = await fetchYahooQuote(cfg.yahooSymbol);
    if (quote) {
      const history = await fetchYahooHistory(cfg.yahooSymbol);
      const ok = quote.price > 0;
      console.log(`[commodities] ${cfg.id} (Yahoo:${cfg.yahooSymbol}): ${ok ? `price=${quote.price} chg%=${quote.changePercent.toFixed(2)}` : "NO DATA"}`);
      return {
        id: cfg.id, symbol: cfg.yahooSymbol, label: cfg.label, labelKr: cfg.labelKr,
        unit: cfg.unit, category: cfg.category,
        price:         Math.round(quote.price         * 100) / 100,
        change:        Math.round(quote.change        * 100) / 100,
        changePercent: Math.round(quote.changePercent * 100) / 100,
        prevClose:     Math.round(quote.prevClose     * 100) / 100,
        high52w: quote.high52w != null ? Math.round(quote.high52w * 100) / 100 : null,
        low52w:  quote.low52w  != null ? Math.round(quote.low52w  * 100) / 100 : null,
        history, tooltipKr: cfg.tooltipKr, tooltipEn: cfg.tooltipEn,
      };
    }
    console.warn(`[commodities] ${cfg.id}: Yahoo fallback to FMP`);
    // Yahoo 실패 시 FMP로 폴백
  }

  quote = await fetchQuote(cfg.symbol);

  if (!quote && cfg.fallback) {
    console.log(`[commodities] ${cfg.id}: primary ${cfg.symbol} failed, trying fallback ${cfg.fallback}`);
    quote = await fetchQuote(cfg.fallback);
    if (quote) usedSymbol = cfg.fallback;
  }

  const history = cfg.yahooSymbol
    ? await fetchYahooHistory(cfg.yahooSymbol)
    : await fetchHistory(usedSymbol);

  const ok = quote && quote.price > 0;
  console.log(`[commodities] ${cfg.id} (${usedSymbol}): ${ok ? `price=${quote!.price} chg%=${quote!.changePercent.toFixed(2)}` : "NO DATA"}`);

  return {
    id: cfg.id,
    symbol: usedSymbol,
    label: cfg.label,
    labelKr: cfg.labelKr,
    unit: cfg.unit,
    category: cfg.category,
    price:         ok ? Math.round(quote!.price         * 100) / 100 : 0,
    change:        ok ? Math.round(quote!.change        * 100) / 100 : 0,
    changePercent: ok ? Math.round(quote!.changePercent * 100) / 100 : 0,
    prevClose:     ok ? Math.round(quote!.prevClose     * 100) / 100 : 0,
    high52w:       ok && quote!.high52w != null ? Math.round(quote!.high52w * 100) / 100 : null,
    low52w:        ok && quote!.low52w  != null ? Math.round(quote!.low52w  * 100) / 100 : null,
    history,
    tooltipKr: cfg.tooltipKr,
    tooltipEn: cfg.tooltipEn,
  };
}

export async function GET() {
  // In-memory cache
  if (memCache && Date.now() - memCache.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({ ok: true, data: memCache.data }, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
    });
  }

  // Supabase cache
  try {
    const { data: cached } = await supabaseAdmin
      .from("legend_screener_cache")
      .select("results, created_at")
      .eq("cache_key", CACHE_KEY)
      .single();
    if (cached) {
      const age = Date.now() - new Date(cached.created_at).getTime();
      if (age < CACHE_TTL_MS) {
        const results = cached.results as CommodityResult[];
        memCache = { data: results, cachedAt: Date.now() - age };
        return NextResponse.json({ ok: true, data: results }, {
          headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
        });
      }
    }
  } catch {
    // cache miss
  }

  // Fetch all in parallel (each has its own fallback)
  const settled = await Promise.allSettled(COMMODITIES.map(fetchCommodity));
  const results: CommodityResult[] = settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : {
          id: COMMODITIES[i].id,
          symbol: COMMODITIES[i].symbol,
          label: COMMODITIES[i].label,
          labelKr: COMMODITIES[i].labelKr,
          unit: COMMODITIES[i].unit,
          category: COMMODITIES[i].category,
          price: 0, change: 0, changePercent: 0, prevClose: 0,
          high52w: null, low52w: null, history: [],
          tooltipKr: COMMODITIES[i].tooltipKr,
          tooltipEn: COMMODITIES[i].tooltipEn,
        }
  );

  const successCount = results.filter((r) => r.price > 0).length;
  console.log(`[commodities] 완료: ${successCount}/${COMMODITIES.length} 성공`);

  if (successCount === 0) {
    return NextResponse.json({ ok: false, error: "No commodity data available" }, { status: 502 });
  }

  memCache = { data: results, cachedAt: Date.now() };
  try {
    await supabaseAdmin.from("legend_screener_cache").delete().eq("cache_key", CACHE_KEY);
    await supabaseAdmin.from("legend_screener_cache").insert({
      cache_key: CACHE_KEY,
      results,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[commodities] Supabase cache write failed:", err);
  }

  return NextResponse.json({ ok: true, data: results }, {
    headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
  });
}
