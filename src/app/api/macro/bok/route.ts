import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface BokObservation {
  TIME: string;
  DATA_VALUE: string;
}

interface SeriesResult {
  id: string;
  label: string;
  unit: string;
  observations: { date: string; value: number }[];
  latest: number;
  previous: number;
  change: number;
}

interface CacheEntry {
  data: Record<string, SeriesResult>;
  liveUsdKrw: number | null;
  cachedAt: number;
}

const BOK_API_KEY = process.env.BOK_API_KEY;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
let cache: CacheEntry | null = null;

// BOK stat codes - we'll fetch monthly data for last 5 years
const SERIES = [
  {
    id: "BASE_RATE",
    statCode: "722Y001",
    itemCode1: "0101000",
    label: "한국 기준금리",
    labelEn: "BOK Base Rate",
    unit: "%",
    cycle: "M",
  },
  {
    id: "KR_CPI",
    statCode: "901Y009",
    itemCode1: "0",
    label: "소비자물가지수",
    labelEn: "Korea CPI",
    unit: "index",
    cycle: "M",
  },
  {
    id: "USDKRW",
    statCode: "731Y001",
    itemCode1: "0000001",
    label: "원달러 환율",
    labelEn: "USD/KRW",
    unit: "KRW",
    cycle: "M",
  },
];

async function fetchBokSeries(
  statCode: string,
  itemCode1: string,
  cycle: string
): Promise<BokObservation[]> {
  // Build date range: last 5 years
  const now = new Date();
  const startYear = now.getFullYear() - 5;
  const startDate = `${startYear}01`;
  const endDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;

  const url = `https://ecos.bok.or.kr/api/StatisticSearch/${BOK_API_KEY}/json/kr/1/300/${statCode}/${cycle}/${startDate}/${endDate}/${itemCode1}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.error(`[bok] ${statCode} HTTP ${res.status}`);
      return [];
    }
    const json = await res.json();
    const rows = json?.StatisticSearch?.row;
    if (!Array.isArray(rows)) {
      console.error(`[bok] ${statCode} no rows`, JSON.stringify(json).slice(0, 200));
      return [];
    }
    return rows;
  } catch (err) {
    console.error(`[bok] Error fetching ${statCode}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

// ── Live USD/KRW from Yahoo Finance (same source as ticker bar) ──

async function fetchLiveUsdKrw(): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/KRW%3DX?interval=1d&range=5d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;

    // Use regularMarketPrice for most current value
    const price = result.meta?.regularMarketPrice;
    if (price != null && !isNaN(price)) return Math.round(price * 100) / 100;

    // Fallback: last non-null close
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || [];
    for (let i = closes.length - 1; i >= 0; i--) {
      if (closes[i] != null && !isNaN(closes[i]!)) return Math.round(closes[i]! * 100) / 100;
    }
    return null;
  } catch {
    return null;
  }
}

function toBokDate(time: string): string {
  // BOK TIME format: "202401" or "2024Q1" → convert to "2024-01"
  if (time.length === 6) {
    return `${time.slice(0, 4)}-${time.slice(4, 6)}`;
  }
  return time;
}

function toSeriesResult(
  id: string,
  label: string,
  unit: string,
  obs: BokObservation[]
): SeriesResult {
  const parsed = obs
    .map((o) => ({ date: toBokDate(o.TIME), value: parseFloat(o.DATA_VALUE) }))
    .filter((o) => !isNaN(o.value))
    .sort((a, b) => a.date.localeCompare(b.date));

  const latest = parsed.length > 0 ? parsed[parsed.length - 1].value : 0;
  const previous = parsed.length > 1 ? parsed[parsed.length - 2].value : latest;

  return { id, label, unit, observations: parsed, latest, previous, change: latest - previous };
}

export async function GET(request: NextRequest) {
  if (!BOK_API_KEY) {
    return NextResponse.json({ ok: false, error: "BOK_API_KEY not configured" }, { status: 500 });
  }

  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";

  if (!forceRefresh && cache && Date.now() - cache.cachedAt < CACHE_TTL) {
    return NextResponse.json({
      ok: true,
      series: cache.data,
      liveUsdKrw: cache.liveUsdKrw,
      updatedAt: new Date(cache.cachedAt).toISOString(),
    });
  }

  try {
    // Fetch BOK series and live USD/KRW in parallel
    const [bokResults, liveUsdKrw] = await Promise.all([
      Promise.allSettled(SERIES.map((s) => fetchBokSeries(s.statCode, s.itemCode1, s.cycle))),
      fetchLiveUsdKrw(),
    ]);

    const seriesMap: Record<string, SeriesResult> = {};
    for (let i = 0; i < SERIES.length; i++) {
      const r = bokResults[i];
      const obs = r.status === "fulfilled" ? r.value : [];
      seriesMap[SERIES[i].id] = toSeriesResult(SERIES[i].id, SERIES[i].label, SERIES[i].unit, obs);
    }

    // Override USDKRW latest with live Yahoo Finance value if available
    if (liveUsdKrw != null && seriesMap["USDKRW"]) {
      seriesMap["USDKRW"].latest = liveUsdKrw;
    }

    // Compute KR CPI YoY %
    const krCpiObs = seriesMap["KR_CPI"]?.observations || [];
    if (krCpiObs.length > 12) {
      const yoyObs: { date: string; value: number }[] = [];
      for (let i = 12; i < krCpiObs.length; i++) {
        const cur = krCpiObs[i].value;
        const prev = krCpiObs[i - 12].value;
        if (prev > 0) {
          yoyObs.push({ date: krCpiObs[i].date, value: parseFloat(((cur / prev - 1) * 100).toFixed(2)) });
        }
      }
      const yoyLatest = yoyObs.length > 0 ? yoyObs[yoyObs.length - 1].value : 0;
      const yoyPrev = yoyObs.length > 1 ? yoyObs[yoyObs.length - 2].value : yoyLatest;
      seriesMap["KR_CPI_YOY"] = {
        id: "KR_CPI_YOY",
        label: "한국 CPI YoY",
        unit: "%",
        observations: yoyObs,
        latest: yoyLatest,
        previous: yoyPrev,
        change: yoyLatest - yoyPrev,
      };
    }

    const now = Date.now();
    cache = { data: seriesMap, liveUsdKrw, cachedAt: now };

    return NextResponse.json({
      ok: true,
      series: seriesMap,
      liveUsdKrw,
      updatedAt: new Date(now).toISOString(),
    }, {
      headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600" },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
