import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface FearGreedResult {
  score: number;
  rating: string;
  previousClose: number;
  oneWeekAgo: number;
  oneMonthAgo: number;
  history: { date: string; score: number }[];
}

interface CacheEntry {
  data: FearGreedResult;
  cachedAt: number;
}

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
let cache: CacheEntry | null = null;

function getRating(score: number): string {
  if (score <= 25) return "Extreme Fear";
  if (score <= 45) return "Fear";
  if (score <= 55) return "Neutral";
  if (score <= 75) return "Greed";
  return "Extreme Greed";
}

export async function GET() {
  if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
    return NextResponse.json({ ok: true, data: cache.data });
  }

  try {
    const res = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error(`[fear-greed] HTTP ${res.status}`);
      return NextResponse.json({ ok: false, error: `CNN API HTTP ${res.status}` }, { status: 502 });
    }

    const json = await res.json();

    const fg = json.fear_and_greed;
    const score = Math.round(fg?.score ?? 0);
    const previousClose = Math.round(fg?.previous_close ?? 0);
    const oneWeekAgo = Math.round(fg?.previous_1_week ?? 0);
    const oneMonthAgo = Math.round(fg?.previous_1_month ?? 0);
    const rating = getRating(score);

    // Extract historical timeline data
    const history: { date: string; score: number }[] = [];
    const timeline = json.fear_and_greed_historical?.data;
    if (Array.isArray(timeline)) {
      for (const point of timeline) {
        const ts = point.x;
        const val = point.y;
        if (typeof ts === "number" && typeof val === "number") {
          const d = new Date(ts);
          history.push({
            date: d.toISOString().slice(0, 10),
            score: Math.round(val),
          });
        }
      }
      // Keep last 30 days
      history.sort((a, b) => a.date.localeCompare(b.date));
      if (history.length > 30) {
        history.splice(0, history.length - 30);
      }
    }

    const result: FearGreedResult = {
      score,
      rating,
      previousClose,
      oneWeekAgo,
      oneMonthAgo,
      history,
    };

    cache = { data: result, cachedAt: Date.now() };
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
