import { NextResponse } from "next/server";

export const runtime = "nodejs";

const FRED_API_KEY = process.env.FRED_API_KEY;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

interface FxPair {
  id: string;
  label: string;
  labelKr: string;
  flag: string;
  fredId: string;
  convert?: "invert" | "cross"; // invert = 1/x, cross = multiply by DEXKOUS
}

const FX_PAIRS: FxPair[] = [
  { id: "USDKRW", label: "USD/KRW", labelKr: "원달러", flag: "\u{1F1FA}\u{1F1F8}", fredId: "DEXKOUS" },
  { id: "JPYKRW", label: "JPY/KRW", labelKr: "엔원", flag: "\u{1F1EF}\u{1F1F5}", fredId: "DEXJPUS", convert: "cross" },
  { id: "CNYKRW", label: "CNY/KRW", labelKr: "위안원", flag: "\u{1F1E8}\u{1F1F3}", fredId: "DEXCHUS", convert: "cross" },
  { id: "EURKRW", label: "EUR/KRW", labelKr: "유로원", flag: "\u{1F1EA}\u{1F1FA}", fredId: "DEXUSEU", convert: "cross" },
  { id: "USDCHF", label: "USD/CHF", labelKr: "달러프랑", flag: "\u{1F1E8}\u{1F1ED}", fredId: "DEXSZUS" },
];

interface FxResult {
  id: string;
  label: string;
  labelKr: string;
  flag: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  sparkline: number[];
}

interface CacheEntry {
  data: FxResult[];
  cachedAt: number;
}

let cache: CacheEntry | null = null;

async function fetchFredSeries(seriesId: string, limit = 90): Promise<{ date: string; value: number }[]> {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=${limit}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.observations || [])
    .filter((o: { value: string }) => o.value !== ".")
    .map((o: { date: string; value: string }) => ({ date: o.date, value: parseFloat(o.value) }))
    .filter((o: { value: number }) => !isNaN(o.value))
    .reverse(); // oldest first
}

export async function GET() {
  if (!FRED_API_KEY) {
    return NextResponse.json({ ok: false, error: "FRED_API_KEY not configured" }, { status: 500 });
  }

  if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
    return NextResponse.json({ ok: true, data: cache.data });
  }

  try {
    // Fetch all series including DEXKOUS for cross rates
    const allIds = [...new Set(FX_PAIRS.map(p => p.fredId))];
    const results = await Promise.allSettled(allIds.map(id => fetchFredSeries(id)));
    const seriesMap = new Map<string, { date: string; value: number }[]>();
    allIds.forEach((id, i) => {
      seriesMap.set(id, results[i].status === "fulfilled" ? results[i].value : []);
    });

    const krwData = seriesMap.get("DEXKOUS") || [];
    const krwMap = new Map(krwData.map(o => [o.date, o.value]));

    const fxResults: FxResult[] = [];

    for (const pair of FX_PAIRS) {
      const raw = seriesMap.get(pair.fredId) || [];
      if (raw.length < 2) continue;

      let converted: { date: string; value: number }[];

      if (pair.convert === "cross") {
        // Cross rate: KRW per unit of foreign currency
        // DEXJPUS = USD/JPY → KRW/JPY = DEXKOUS / DEXJPUS
        // DEXCHUS = USD/CNY → KRW/CNY = DEXKOUS / DEXCHUS
        // DEXUSEU = EUR/USD → KRW/EUR = DEXKOUS * DEXUSEU
        converted = [];
        for (const o of raw) {
          const krw = krwMap.get(o.date);
          if (krw === undefined) continue;
          let val: number;
          if (pair.fredId === "DEXUSEU") {
            // EUR/USD → KRW/EUR = KRW/USD * USD/EUR... wait
            // DEXUSEU = USD per EUR, so KRW/EUR = DEXKOUS * DEXUSEU... no
            // DEXUSEU is actually EUR in USD. So 1 EUR = DEXUSEU USD.
            // KRW per EUR = DEXKOUS * DEXUSEU
            val = krw * o.value;
          } else {
            // DEXJPUS = JPY per USD, DEXCHUS = CNY per USD
            // KRW per JPY = DEXKOUS / DEXJPUS
            // KRW per CNY = DEXKOUS / DEXCHUS
            val = krw / o.value;
          }
          converted.push({ date: o.date, value: Math.round(val * 100) / 100 });
        }
      } else {
        converted = raw;
      }

      if (converted.length < 2) continue;

      const current = converted[converted.length - 1].value;
      const previous = converted[converted.length - 2].value;
      const change = current - previous;
      const changePercent = previous !== 0 ? (change / Math.abs(previous)) * 100 : 0;

      // Last 7 data points for sparkline
      const spark = converted.slice(-7).map(o => o.value);

      fxResults.push({
        id: pair.id,
        label: pair.label,
        labelKr: pair.labelKr,
        flag: pair.flag,
        current: Math.round(current * 100) / 100,
        previous: Math.round(previous * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        sparkline: spark,
      });
    }

    cache = { data: fxResults, cachedAt: Date.now() };
    return NextResponse.json({ ok: true, data: fxResults }, {
      headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=1800" },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
