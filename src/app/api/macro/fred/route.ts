import { NextResponse } from "next/server";

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
  { id: "T10Y2Y", label: "10Y-2Y Spread", unit: "%" },
  { id: "CPIAUCSL", label: "CPI", unit: "index" },
  { id: "UNRATE", label: "Unemployment Rate", unit: "%" },
];

// ── Fetch helper ──────────────────────────────────────────────

async function fetchSeries(seriesId: string): Promise<FredObservation[]> {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=260`;
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

export async function GET() {
  if (!FRED_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "FRED_API_KEY not configured" },
      { status: 500 }
    );
  }

  if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
    return NextResponse.json({ ok: true, series: cache.data, netLiquidity: cache.netLiquidity });
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

    cache = { data: seriesMap, netLiquidity, cachedAt: Date.now() };

    return NextResponse.json({ ok: true, series: seriesMap, netLiquidity });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
