import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// ── Types ─────────────────────────────────────────────────────

interface FredObservation {
  date: string;
  value: string;
}

interface SeriesData {
  id: string;
  label: string;
  unit: string;
  observations: { date: string; value: number }[];
  latest: number;
  previous: number;
  change: number;
  changePercent: number;
}

interface CacheEntry {
  data: Record<string, SeriesData>;
  netLiquidity: { date: string; value: number }[];
  sp500: { date: string; value: number }[];
  cachedAt: number;
}

// ── Config ────────────────────────────────────────────────────

const FRED_API_KEY = process.env.FRED_API_KEY;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
let cache: CacheEntry | null = null;

const SERIES = [
  { id: "WALCL", label: "Fed Total Assets", unit: "B$" },
  { id: "RRPONTSYD", label: "Reverse Repo", unit: "B$" },
  { id: "WTREGEN", label: "TGA Balance", unit: "B$" },
  { id: "WRESBAL", label: "Bank Reserves", unit: "B$" },
  { id: "FEDFUNDS", label: "Fed Funds Rate", unit: "%" },
  { id: "DGS10", label: "10Y Treasury Yield", unit: "%" },
  { id: "T10Y2Y", label: "10Y-2Y Spread", unit: "%" },
  { id: "T10Y3M", label: "10Y-3M Spread", unit: "%" },
  { id: "BAMLH0A0HYM2", label: "HY Spread", unit: "%" },
  { id: "CPIAUCSL", label: "CPI", unit: "index" },
  { id: "UNRATE", label: "Unemployment Rate", unit: "%" },
  { id: "DEXKOUS", label: "USD/KRW", unit: "KRW" },
  { id: "M2SL", label: "M2 Money Supply", unit: "B$" },
  { id: "SOFR", label: "SOFR Rate", unit: "%" },
];

// ── Fetch helper ──────────────────────────────────────────────

async function fetchSeries(seriesId: string): Promise<FredObservation[]> {
  // Daily series need 1500 obs for 5Y; monthly series need fewer but still enough
  const limit = ["T10Y2Y", "T10Y3M", "BAMLH0A0HYM2", "FEDFUNDS", "DEXKOUS", "SOFR"].includes(seriesId) ? 1500 : 500;
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=${limit}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    console.error(`[fred] ${seriesId} HTTP ${res.status}`);
    return [];
  }
  const json = await res.json();
  return (json.observations || []).filter(
    (o: FredObservation) => o.value !== "."
  );
}

function toSeriesData(
  id: string,
  label: string,
  unit: string,
  obs: FredObservation[]
): SeriesData {
  const parsed = obs
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
    .filter((o) => !isNaN(o.value))
    .reverse(); // oldest first

  const latest = parsed.length > 0 ? parsed[parsed.length - 1].value : 0;
  const previous = parsed.length > 1 ? parsed[parsed.length - 2].value : latest;
  const change = latest - previous;
  const changePercent = previous !== 0 ? (change / Math.abs(previous)) * 100 : 0;

  return { id, label, unit, observations: parsed, latest, previous, change, changePercent };
}

// ── S&P500 fetch from Yahoo Finance ──────────────────────────

async function fetchSP500(): Promise<{ date: string; value: number }[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=5y&interval=1wk`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return [];

    const timestamps: number[] = result.timestamp || [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];
    const data: { date: string; value: number }[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (close == null || isNaN(close)) continue;
      const d = new Date(timestamps[i] * 1000);
      const dateStr = d.toISOString().slice(0, 10);
      data.push({ date: dateStr, value: Math.round(close * 100) / 100 });
    }

    return data;
  } catch {
    return [];
  }
}

// ── VIX fetch from Yahoo Finance ─────────────────────────────

async function fetchVIX(): Promise<SeriesData> {
  const empty: SeriesData = { id: "VIX", label: "VIX", unit: "pts", observations: [], latest: 0, previous: 0, change: 0, changePercent: 0 };
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?range=5y&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return empty;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return empty;

    const timestamps: number[] = result.timestamp || [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];
    const observations: { date: string; value: number }[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (close == null || isNaN(close)) continue;
      const d = new Date(timestamps[i] * 1000);
      observations.push({ date: d.toISOString().slice(0, 10), value: Math.round(close * 100) / 100 });
    }

    if (observations.length === 0) return empty;
    const latest = observations[observations.length - 1].value;
    const previous = observations.length > 1 ? observations[observations.length - 2].value : latest;
    const change = latest - previous;
    const changePercent = previous !== 0 ? (change / Math.abs(previous)) * 100 : 0;

    return { id: "VIX", label: "VIX", unit: "pts", observations, latest, previous, change, changePercent };
  } catch {
    return empty;
  }
}

// ── DXY fetch from Yahoo Finance ─────────────────────────────

async function fetchDXYSeries(): Promise<SeriesData> {
  const empty: SeriesData = { id: "DXY", label: "DXY", unit: "pts", observations: [], latest: 0, previous: 0, change: 0, changePercent: 0 };
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?range=5y&interval=1wk`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return empty;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return empty;

    const timestamps: number[] = result.timestamp || [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];
    const observations: { date: string; value: number }[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (close == null || isNaN(close)) continue;
      const d = new Date(timestamps[i] * 1000);
      observations.push({ date: d.toISOString().slice(0, 10), value: Math.round(close * 100) / 100 });
    }

    if (observations.length === 0) return empty;
    const latest = observations[observations.length - 1].value;
    const previous = observations.length > 1 ? observations[observations.length - 2].value : latest;
    const change = latest - previous;
    const changePercent = previous !== 0 ? (change / Math.abs(previous)) * 100 : 0;

    return { id: "DXY", label: "DXY", unit: "pts", observations, latest, previous, change, changePercent };
  } catch {
    return empty;
  }
}

// ── Net Liquidity calculation ────────────────────────────────

function calcNetLiquidity(
  assets: SeriesData,
  tga: SeriesData,
  rrp: SeriesData
): { date: string; value: number }[] {
  // Build date maps
  const tgaMap = new Map(tga.observations.map((o) => [o.date, o.value]));
  const rrpMap = new Map(rrp.observations.map((o) => [o.date, o.value]));

  const result: { date: string; value: number }[] = [];
  let lastTga = 0;
  let lastRrp = 0;

  for (const obs of assets.observations) {
    const t = tgaMap.get(obs.date) ?? lastTga;
    const r = rrpMap.get(obs.date) ?? lastRrp;
    lastTga = t;
    lastRrp = r;

    // WALCL is in millions, WTREGEN in millions, RRPONTSYD in billions
    // Normalize: convert all to billions
    const assetsB = obs.value / 1000; // millions -> billions
    const tgaB = t / 1000; // millions -> billions
    const rrpB = r; // already billions

    result.push({
      date: obs.date,
      value: Math.round((assetsB - tgaB - rrpB) * 100) / 100,
    });
  }

  return result;
}

// ── Route handler ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!FRED_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "FRED_API_KEY not configured" },
      { status: 500 }
    );
  }

  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";

  if (!forceRefresh && cache && Date.now() - cache.cachedAt < CACHE_TTL) {
    return NextResponse.json({ ok: true, series: cache.data, netLiquidity: cache.netLiquidity, sp500: cache.sp500, updatedAt: new Date(cache.cachedAt).toISOString() });
  }

  try {
    const results = await Promise.allSettled(
      SERIES.map((s) => fetchSeries(s.id))
    );

    const seriesMap: Record<string, SeriesData> = {};
    for (let i = 0; i < SERIES.length; i++) {
      const r = results[i];
      const obs = r.status === "fulfilled" ? r.value : [];
      seriesMap[SERIES[i].id] = toSeriesData(
        SERIES[i].id,
        SERIES[i].label,
        SERIES[i].unit,
        obs
      );
    }

    // Compute CPI YoY %
    const cpiObs = seriesMap["CPIAUCSL"]?.observations || [];
    if (cpiObs.length > 12) {
      const yoyObs: { date: string; value: number }[] = [];
      for (let i = 12; i < cpiObs.length; i++) {
        const cur = cpiObs[i].value;
        const prev = cpiObs[i - 12].value;
        if (prev > 0) {
          yoyObs.push({ date: cpiObs[i].date, value: parseFloat(((cur / prev - 1) * 100).toFixed(2)) });
        }
      }
      const yoyLatest = yoyObs.length > 0 ? yoyObs[yoyObs.length - 1].value : 0;
      const yoyPrev = yoyObs.length > 1 ? yoyObs[yoyObs.length - 2].value : yoyLatest;
      seriesMap["CPI_YOY"] = {
        id: "CPI_YOY",
        label: "CPI YoY",
        unit: "%",
        observations: yoyObs,
        latest: yoyLatest,
        previous: yoyPrev,
        change: yoyLatest - yoyPrev,
        changePercent: yoyPrev !== 0 ? ((yoyLatest - yoyPrev) / Math.abs(yoyPrev)) * 100 : 0,
      };
    }

    // Compute M2 YoY %
    const m2Obs = seriesMap["M2SL"]?.observations || [];
    if (m2Obs.length > 12) {
      const m2YoyObs: { date: string; value: number }[] = [];
      for (let i = 12; i < m2Obs.length; i++) {
        const cur = m2Obs[i].value;
        const prev = m2Obs[i - 12].value;
        if (prev > 0) {
          m2YoyObs.push({ date: m2Obs[i].date, value: parseFloat(((cur / prev - 1) * 100).toFixed(2)) });
        }
      }
      const m2Latest = m2YoyObs.length > 0 ? m2YoyObs[m2YoyObs.length - 1].value : 0;
      const m2Prev = m2YoyObs.length > 1 ? m2YoyObs[m2YoyObs.length - 2].value : m2Latest;
      seriesMap["M2_YOY"] = {
        id: "M2_YOY",
        label: "M2 YoY",
        unit: "%",
        observations: m2YoyObs,
        latest: m2Latest,
        previous: m2Prev,
        change: m2Latest - m2Prev,
        changePercent: m2Prev !== 0 ? ((m2Latest - m2Prev) / Math.abs(m2Prev)) * 100 : 0,
      };
    }

    // Compute SOFR spread (SOFR - FEDFUNDS) chart
    const sofrObs = seriesMap["SOFR"]?.observations || [];
    const ffObs = seriesMap["FEDFUNDS"]?.observations || [];
    if (sofrObs.length > 0 && ffObs.length > 0) {
      const ffMap = new Map(ffObs.map((o) => [o.date, o.value]));
      let lastFf = ffObs[ffObs.length - 1].value;
      const spreadObs: { date: string; value: number }[] = [];
      for (const o of sofrObs) {
        const ffVal = ffMap.get(o.date) ?? lastFf;
        lastFf = ffVal;
        spreadObs.push({ date: o.date, value: Math.round((o.value - ffVal) * 10000) / 100 }); // bp
      }
      const spLatest = spreadObs.length > 0 ? spreadObs[spreadObs.length - 1].value : 0;
      const spPrev = spreadObs.length > 1 ? spreadObs[spreadObs.length - 2].value : spLatest;
      seriesMap["SOFR_SPREAD"] = {
        id: "SOFR_SPREAD",
        label: "SOFR Spread",
        unit: "bp",
        observations: spreadObs,
        latest: spLatest,
        previous: spPrev,
        change: spLatest - spPrev,
        changePercent: spPrev !== 0 ? ((spLatest - spPrev) / Math.abs(spPrev)) * 100 : 0,
      };
    }

    const netLiquidity = calcNetLiquidity(
      seriesMap["WALCL"],
      seriesMap["WTREGEN"],
      seriesMap["RRPONTSYD"]
    );

    // Add net liquidity latest values to series map
    const nlLatest = netLiquidity.length > 0 ? netLiquidity[netLiquidity.length - 1].value : 0;
    const nlPrev = netLiquidity.length > 1 ? netLiquidity[netLiquidity.length - 2].value : nlLatest;
    seriesMap["NET_LIQUIDITY"] = {
      id: "NET_LIQUIDITY",
      label: "Net Liquidity",
      unit: "T$",
      observations: netLiquidity.map((o) => ({ date: o.date, value: o.value })),
      latest: nlLatest,
      previous: nlPrev,
      change: nlLatest - nlPrev,
      changePercent: nlPrev !== 0 ? ((nlLatest - nlPrev) / Math.abs(nlPrev)) * 100 : 0,
    };

    // Fetch S&P500, VIX, and DXY data
    const [sp500, vix, dxy] = await Promise.all([fetchSP500(), fetchVIX(), fetchDXYSeries()]);
    seriesMap["VIX"] = vix;
    seriesMap["DXY"] = dxy;

    cache = { data: seriesMap, netLiquidity, sp500, cachedAt: Date.now() };

    return NextResponse.json({ ok: true, series: seriesMap, netLiquidity, sp500, updatedAt: new Date(cache.cachedAt).toISOString() }, {
      headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600" },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
