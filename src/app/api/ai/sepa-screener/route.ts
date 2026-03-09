import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── Types ──────────────────────────────────────────────────────
interface ScreenerResult {
  symbol: string;
  name: string;
  market: "KR" | "US";
  price: number;
  change_pct: number;
  score: number;
  stage: "STAGE_2";
  base_depth_pct: number;
  weeks_in_base: number;
  volume_ratio: number;
  dist_from_52w_high_pct: number;
  ma_alignment: boolean;
}

const CACHE_TTL_HOURS = 4;

// ── KR Top 50 symbols ──────────────────────────────────────────
const KR_SYMBOLS: [string, string][] = [
  ["005930.KS", "삼성전자"], ["000660.KS", "SK하이닉스"], ["373220.KS", "LG에너지솔루션"],
  ["207940.KS", "삼성바이오로직스"], ["006400.KS", "삼성SDI"], ["051910.KS", "LG화학"],
  ["005380.KS", "현대차"], ["000270.KS", "기아"], ["035420.KS", "NAVER"],
  ["035720.KS", "카카오"], ["105560.KS", "KB금융"], ["068270.KS", "셀트리온"],
  ["003670.KS", "포스코퓨처엠"], ["028260.KS", "삼성물산"], ["012330.KS", "현대모비스"],
  ["066570.KS", "LG전자"], ["034020.KS", "두산에너빌리티"], ["259960.KS", "크래프톤"],
  ["009540.KS", "한국조선해양"], ["352820.KS", "하이브"], ["138040.KS", "메리츠금융지주"],
  ["329180.KS", "현대중공업"], ["267260.KS", "HD현대"], ["047810.KS", "한국항공우주"],
  ["042700.KS", "한미반도체"], ["005490.KS", "POSCO홀딩스"], ["011070.KS", "LG이노텍"],
  ["042660.KS", "한화오션"], ["272210.KS", "한화시스템"], ["003230.KS", "삼양식품"],
  ["247540.KS", "에코프로비엠"], ["383220.KS", "F&F"], ["112610.KS", "씨에스윈드"],
  ["402340.KS", "SK스퀘어"], ["326030.KS", "SK바이오팜"], ["010620.KS", "현대미포조선"],
  ["009150.KS", "삼성전기"], ["086520.KQ", "에코프로"], ["196170.KQ", "알테오젠"],
  ["028300.KQ", "HLB"], ["328130.KQ", "루닛"], ["039030.KQ", "이오테크닉스"],
  ["058470.KQ", "리노공업"], ["403870.KQ", "HPSP"], ["022100.KQ", "포스코DX"],
  ["214150.KQ", "클래시스"], ["141080.KQ", "레고켐바이오"], ["299030.KQ", "하나마이크론"],
  ["064760.KQ", "티씨케이"], ["240810.KQ", "원익IPS"],
];

// ── US S&P100 + NASDAQ100 deduped (~130) ───────────────────────
const US_SYMBOLS: [string, string][] = [
  ["AAPL", "Apple"], ["MSFT", "Microsoft"], ["GOOGL", "Alphabet"], ["AMZN", "Amazon"],
  ["NVDA", "NVIDIA"], ["META", "Meta Platforms"], ["TSLA", "Tesla"], ["BRK-B", "Berkshire Hathaway"],
  ["UNH", "UnitedHealth"], ["JNJ", "Johnson & Johnson"], ["XOM", "Exxon Mobil"],
  ["JPM", "JPMorgan Chase"], ["V", "Visa"], ["PG", "Procter & Gamble"], ["MA", "Mastercard"],
  ["AVGO", "Broadcom"], ["HD", "Home Depot"], ["CVX", "Chevron"], ["MRK", "Merck"],
  ["ABBV", "AbbVie"], ["LLY", "Eli Lilly"], ["PEP", "PepsiCo"], ["KO", "Coca-Cola"],
  ["COST", "Costco"], ["ADBE", "Adobe"], ["WMT", "Walmart"], ["MCD", "McDonald's"],
  ["CSCO", "Cisco"], ["CRM", "Salesforce"], ["ACN", "Accenture"], ["ABT", "Abbott"],
  ["TMO", "Thermo Fisher"], ["DHR", "Danaher"], ["LIN", "Linde"], ["NFLX", "Netflix"],
  ["AMD", "AMD"], ["ORCL", "Oracle"], ["TXN", "Texas Instruments"], ["INTC", "Intel"],
  ["QCOM", "Qualcomm"], ["INTU", "Intuit"], ["LOW", "Lowe's"], ["AMGN", "Amgen"],
  ["SPGI", "S&P Global"], ["BA", "Boeing"], ["CAT", "Caterpillar"], ["GS", "Goldman Sachs"],
  ["BLK", "BlackRock"], ["AXP", "American Express"], ["DE", "Deere"], ["RTX", "RTX Corp"],
  ["ISRG", "Intuitive Surgical"], ["GILD", "Gilead"], ["SYK", "Stryker"],
  ["BKNG", "Booking Holdings"], ["VRTX", "Vertex Pharma"], ["REGN", "Regeneron"],
  ["LRCX", "Lam Research"], ["AMAT", "Applied Materials"], ["PANW", "Palo Alto Networks"],
  ["KLAC", "KLA Corp"], ["SNPS", "Synopsys"], ["CDNS", "Cadence"], ["MRVL", "Marvell Tech"],
  ["FTNT", "Fortinet"], ["CRWD", "CrowdStrike"], ["ABNB", "Airbnb"], ["DDOG", "Datadog"],
  ["NET", "Cloudflare"], ["NOW", "ServiceNow"], ["ARM", "Arm Holdings"], ["PLTR", "Palantir"],
  ["SMCI", "Super Micro"], ["COIN", "Coinbase"], ["MELI", "MercadoLibre"],
  ["SHOP", "Shopify"], ["UBER", "Uber"], ["GEV", "GE Vernova"],
  ["ON", "ON Semi"], ["MPWR", "Monolithic Power"], ["ANET", "Arista Networks"],
  ["FICO", "Fair Isaac"], ["LMT", "Lockheed Martin"], ["GD", "General Dynamics"],
  ["ETN", "Eaton"], ["PH", "Parker Hannifin"], ["GE", "GE Aerospace"],
  ["CTAS", "Cintas"], ["AZO", "AutoZone"], ["ORLY", "O'Reilly Auto"],
  ["BSX", "Boston Scientific"], ["DXCM", "Dexcom"], ["IDXX", "IDEXX"],
  ["MU", "Micron"], ["NXPI", "NXP Semi"], ["DELL", "Dell"],
  ["CMG", "Chipotle"], ["LULU", "Lululemon"], ["SBUX", "Starbucks"],
  ["NEE", "NextEra Energy"], ["ICE", "Intercontinental Exchange"], ["CME", "CME Group"],
  ["SCHW", "Charles Schwab"], ["MS", "Morgan Stanley"], ["BAC", "Bank of America"],
  ["WFC", "Wells Fargo"], ["PYPL", "PayPal"], ["SHW", "Sherwin-Williams"],
  ["FCX", "Freeport-McMoRan"], ["NEM", "Newmont"], ["HON", "Honeywell"],
  ["APD", "Air Products"], ["ECL", "Ecolab"], ["MSCI", "MSCI"],
  ["MCO", "Moody's"], ["ADP", "ADP"], ["WM", "Waste Management"],
  ["PLD", "Prologis"], ["AMT", "American Tower"], ["EQIX", "Equinix"],
  ["WELL", "Welltower"], ["TER", "Teradyne"], ["MNST", "Monster Beverage"],
  ["CPRT", "Copart"], ["ODFL", "Old Dominion"], ["TTD", "Trade Desk"],
  ["HUBS", "HubSpot"], ["VEEV", "Veeva Systems"], ["MDB", "MongoDB"],
  ["DASH", "DoorDash"], ["SOFI", "SoFi"], ["HOOD", "Robinhood"],
  ["LI", "Li Auto"],
];

// ── Yahoo Finance data fetcher (2s timeout) ────────────────────
interface DailyBar {
  date: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

async function fetchChart(symbol: string): Promise<DailyBar[]> {
  const now = Math.floor(Date.now() / 1000);
  const oneYearAgo = now - 365 * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${oneYearAgo}&period2=${now}&interval=1d`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    clearTimeout(timeout);

    if (!res.ok) return [];
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return [];

    const timestamps = result.timestamp || [];
    const q = result.indicators?.quote?.[0];
    if (!q) return [];

    const bars: DailyBar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (q.close?.[i] != null && q.volume?.[i] != null) {
        bars.push({
          date: timestamps[i],
          open: q.open?.[i] ?? q.close[i],
          high: q.high?.[i] ?? q.close[i],
          low: q.low?.[i] ?? q.close[i],
          close: q.close[i],
          volume: q.volume[i],
        });
      }
    }
    return bars;
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

// ── Screening logic ────────────────────────────────────────────
function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// Diagnostic counters (reset per scan)
interface ScanDiag {
  fetch_ok: number;
  fetch_fail: number;
  too_few_bars: number;
  filter1_pass: number;
  filter2_pass: number;
  filter3_pass: number;
  filter4_pass: number;
  filter5_pass: number;
  samples: { symbol: string; bars: number; price?: number; ma50?: number; ma150?: number; failed_at?: string }[];
}

function newDiag(): ScanDiag {
  return { fetch_ok: 0, fetch_fail: 0, too_few_bars: 0, filter1_pass: 0, filter2_pass: 0, filter3_pass: 0, filter4_pass: 0, filter5_pass: 0, samples: [] };
}

function screenStock(
  symbol: string,
  name: string,
  market: "KR" | "US",
  bars: DailyBar[],
  indexBars: DailyBar[],
  diag?: ScanDiag
): ScreenerResult | null {
  const addSample = diag && diag.samples.length < 10;

  if (bars.length < 150) {
    if (diag) diag.too_few_bars++;
    if (addSample) diag.samples.push({ symbol, bars: bars.length, failed_at: "too_few_bars" });
    return null;
  }

  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const n = closes.length;
  const price = closes[n - 1];
  const ma50 = avg(closes.slice(-50));
  const ma150 = avg(closes.slice(-150));

  // FILTER 1: Stage 2 (Weinstein)
  if (price <= ma150) {
    if (addSample) diag.samples.push({ symbol, bars: n, price, ma50, ma150, failed_at: "filter1_price<=ma150" });
    return null;
  }
  const ma150_20ago = avg(closes.slice(-170, -20));
  if (ma150 <= ma150_20ago) {
    if (addSample) diag.samples.push({ symbol, bars: n, price, ma50, ma150, failed_at: "filter1_ma150_not_rising" });
    return null;
  }
  if (diag) diag.filter1_pass++;

  // FILTER 2: 52-week position
  const lookback = Math.min(n, 252);
  const high52w = Math.max(...highs.slice(-lookback));
  const low52w = Math.min(...lows.slice(-lookback));
  const distFromHigh = (high52w - price) / high52w;
  const distFromLow = (price - low52w) / low52w;
  if (distFromHigh > 0.25) {
    if (addSample) diag.samples.push({ symbol, bars: n, price, ma50, ma150, failed_at: `filter2_far_from_high(${(distFromHigh * 100).toFixed(1)}%)` });
    return null;
  }
  if (distFromLow < 0.30) {
    if (addSample) diag.samples.push({ symbol, bars: n, price, ma50, ma150, failed_at: `filter2_close_to_low(${(distFromLow * 100).toFixed(1)}%)` });
    return null;
  }
  if (diag) diag.filter2_pass++;

  // FILTER 3: Base formation
  const baseDays = 50;
  const baseSlice = closes.slice(-baseDays);
  const baseHigh = Math.max(...baseSlice);
  const baseLow = Math.min(...baseSlice);
  const baseDepth = (baseHigh - baseLow) / baseHigh;
  if (baseDepth > 0.20) {
    if (addSample) diag.samples.push({ symbol, bars: n, price, ma50, ma150, failed_at: `filter3_deep_base(${(baseDepth * 100).toFixed(1)}%)` });
    return null;
  }
  const recentHigh = Math.max(...highs.slice(-15));
  if (recentHigh >= high52w) {
    if (addSample) diag.samples.push({ symbol, bars: n, price, ma50, ma150, failed_at: "filter3_new_high" });
    return null;
  }
  if (diag) diag.filter3_pass++;

  // FILTER 4: Volume contraction
  const vol10 = avg(volumes.slice(-10));
  const vol50 = avg(volumes.slice(-50));
  const volRatio = vol50 > 0 ? vol10 / vol50 : 1;
  if (volRatio >= 1.0) {
    if (addSample) diag.samples.push({ symbol, bars: n, price, ma50, ma150, failed_at: `filter4_vol_expanding(${volRatio.toFixed(2)}x)` });
    return null;
  }
  if (diag) diag.filter4_pass++;

  // FILTER 5: MA alignment
  const ma200 = n >= 200 ? avg(closes.slice(-200)) : ma150;
  if (!(ma50 > ma150 && ma150 > ma200)) {
    if (addSample) diag.samples.push({ symbol, bars: n, price, ma50, ma150, failed_at: "filter5_ma_misaligned" });
    return null;
  }
  if (diag) diag.filter5_pass++;

  // SCORING (0-10)
  let score = 0;
  if (distFromHigh <= 0.10) score += 2;
  if (baseDepth < 0.10) score += 2;
  if (volRatio < 0.7) score += 2;
  const ma50_20ago = avg(closes.slice(-70, -20));
  const ma200_20ago = n >= 220 ? avg(closes.slice(-220, -20)) : ma150_20ago;
  if (ma50 > ma50_20ago && ma150 > ma150_20ago && ma200 > ma200_20ago) score += 2;
  if (indexBars.length >= 63 && bars.length >= 63) {
    const stockReturn = (closes[n - 1] - closes[n - 63]) / closes[n - 63];
    const idxCloses = indexBars.map((b) => b.close);
    const idxN = idxCloses.length;
    const idxReturn = (idxCloses[idxN - 1] - idxCloses[idxN - 63]) / idxCloses[idxN - 63];
    if (stockReturn > idxReturn) score += 1;
  }
  if (price > ma50 && ma50 > ma50_20ago) score += 1;

  let weeksInBase = 0;
  for (let i = n - 1; i >= Math.max(0, n - 100); i--) {
    const rangeHigh = Math.max(...closes.slice(i, n));
    const rangeLow = Math.min(...closes.slice(i, n));
    if ((rangeHigh - rangeLow) / rangeHigh <= 0.20) {
      weeksInBase = Math.round((n - i) / 5);
    } else {
      break;
    }
  }

  const change_pct = n >= 2 ? ((price - closes[n - 2]) / closes[n - 2]) * 100 : 0;

  return {
    symbol: symbol.replace(".KS", "").replace(".KQ", ""),
    name,
    market,
    price: Math.round(price * 100) / 100,
    change_pct: Math.round(change_pct * 100) / 100,
    score,
    stage: "STAGE_2",
    base_depth_pct: Math.round(baseDepth * 1000) / 10,
    weeks_in_base: Math.max(weeksInBase, 1),
    volume_ratio: Math.round(volRatio * 100) / 100,
    dist_from_52w_high_pct: Math.round(distFromHigh * 1000) / 10,
    ma_alignment: true,
  };
}

// ── Process batch (20 concurrent) ──────────────────────────────
async function processBatch(
  symbols: [string, string][],
  market: "KR" | "US",
  indexBars: DailyBar[],
  diag: ScanDiag
): Promise<ScreenerResult[]> {
  const results: ScreenerResult[] = [];
  const CONCURRENCY = 20;

  for (let i = 0; i < symbols.length; i += CONCURRENCY) {
    const batch = symbols.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async ([sym, name]) => {
        try {
          const bars = await fetchChart(sym);
          if (bars.length > 0) {
            diag.fetch_ok++;
            return screenStock(sym, name, market, bars, indexBars, diag);
          } else {
            diag.fetch_fail++;
          }
        } catch {
          diag.fetch_fail++;
        }
        return null;
      })
    );
    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }

  return results;
}

// ── Supabase persistent cache ─────────────────────────────────
async function getCachedResults(market: string): Promise<{ data: ScreenerResult[]; ts: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("sepa_screener_cache")
    .select("results, created_at")
    .eq("market", market)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  const ageMs = Date.now() - new Date(data.created_at).getTime();
  if (ageMs > CACHE_TTL_HOURS * 60 * 60 * 1000) return null;

  return { data: data.results as ScreenerResult[], ts: data.created_at };
}

async function setCachedResults(market: string, results: ScreenerResult[]): Promise<void> {
  // Delete old row for this market, then insert fresh
  await supabaseAdmin
    .from("sepa_screener_cache")
    .delete()
    .eq("market", market);

  await supabaseAdmin
    .from("sepa_screener_cache")
    .insert({ market, results, created_at: new Date().toISOString() });
}

// ── GET handler ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const market = (searchParams.get("market") || "ALL").toUpperCase();
    const refresh = searchParams.get("refresh") === "true";

    const totalScanned = (market !== "US" ? KR_SYMBOLS.length : 0) + (market !== "KR" ? US_SYMBOLS.length : 0);

    // Check Supabase persistent cache
    if (!refresh) {
      const cached = await getCachedResults(market);
      if (cached) {
        return NextResponse.json({
          ok: true,
          results: cached.data,
          cached: true,
          updated_at: cached.ts,
          stats: { kr_scanned: market !== "US" ? KR_SYMBOLS.length : 0, us_scanned: market !== "KR" ? US_SYMBOLS.length : 0, total_scanned: totalScanned, passed: cached.data.length },
        });
      }
    }

    // Fetch index data for RS calculation
    const [kospiIndex, spyIndex] = await Promise.all([
      market !== "US" ? fetchChart("^KS11") : Promise.resolve([]),
      market !== "KR" ? fetchChart("^GSPC") : Promise.resolve([]),
    ]);

    // Process KR and US in parallel (20 concurrent per market)
    const krDiag = newDiag();
    const usDiag = newDiag();
    const [krResults, usResults] = await Promise.all([
      market !== "US" ? processBatch(KR_SYMBOLS, "KR", kospiIndex, krDiag) : Promise.resolve([]),
      market !== "KR" ? processBatch(US_SYMBOLS, "US", spyIndex, usDiag) : Promise.resolve([]),
    ]);

    const all = [...krResults, ...usResults]
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    const now = new Date().toISOString();

    // Save to Supabase cache
    await setCachedResults(market, all);

    // Build diagnostics
    const diag: Record<string, unknown> = {};
    if (market !== "US") {
      diag.kr = {
        total: KR_SYMBOLS.length,
        fetch_ok: krDiag.fetch_ok,
        fetch_fail: krDiag.fetch_fail,
        too_few_bars: krDiag.too_few_bars,
        filter1_pass: krDiag.filter1_pass,
        filter2_pass: krDiag.filter2_pass,
        filter3_pass: krDiag.filter3_pass,
        filter4_pass: krDiag.filter4_pass,
        filter5_pass: krDiag.filter5_pass,
        passed: krResults.length,
        kospi_index_bars: kospiIndex.length,
        samples: krDiag.samples,
      };
    }
    if (market !== "KR") {
      diag.us = {
        total: US_SYMBOLS.length,
        fetch_ok: usDiag.fetch_ok,
        fetch_fail: usDiag.fetch_fail,
        too_few_bars: usDiag.too_few_bars,
        filter1_pass: usDiag.filter1_pass,
        filter2_pass: usDiag.filter2_pass,
        filter3_pass: usDiag.filter3_pass,
        filter4_pass: usDiag.filter4_pass,
        filter5_pass: usDiag.filter5_pass,
        passed: usResults.length,
        sp500_index_bars: spyIndex.length,
        samples: usDiag.samples,
      };
    }

    return NextResponse.json({
      ok: true,
      results: all,
      cached: false,
      updated_at: now,
      stats: { kr_scanned: market !== "US" ? KR_SYMBOLS.length : 0, us_scanned: market !== "KR" ? US_SYMBOLS.length : 0, total_scanned: totalScanned, passed: all.length },
      diagnostics: diag,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
