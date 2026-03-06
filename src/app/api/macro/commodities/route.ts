import { NextResponse } from "next/server";

export const runtime = "nodejs";

const FRED_API_KEY = process.env.FRED_API_KEY;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

interface CommodityConfig {
  id: string;
  label: string;
  labelKr: string;
  emoji: string;
  unit: string;
  category: "energy" | "precious" | "industrial";
  fredId: string;
  yahooId: string;
  tooltipKr: string;
  tooltipEn: string;
}

const COMMODITIES: CommodityConfig[] = [
  {
    id: "WTI", label: "WTI Crude Oil", labelKr: "WTI \uC6D0\uC720",
    emoji: "\u{1F6E2}\uFE0F", unit: "$/bbl", category: "energy",
    fredId: "DCOILWTICO", yahooId: "CL=F",
    tooltipKr: "\uD55C\uAD6D \uC5D0\uB108\uC9C0 \uC218\uC785 \uD575\uC2EC \uC9C0\uD45C",
    tooltipEn: "Key indicator for Korea's energy imports",
  },
  {
    id: "NATGAS", label: "Natural Gas", labelKr: "\uCC9C\uC5F0\uAC00\uC2A4",
    emoji: "\u{1F525}", unit: "$/MMBtu", category: "energy",
    fredId: "PNGASEUUSDM", yahooId: "NG=F",
    tooltipKr: "LNG \uC218\uC785\uAD6D \uD55C\uAD6D \uC9C1\uC811 \uC601\uD5A5",
    tooltipEn: "Direct impact on Korea as major LNG importer",
  },
  {
    id: "GOLD", label: "Gold", labelKr: "\uAE08",
    emoji: "\u{1F947}", unit: "$/oz", category: "precious",
    fredId: "GOLDAMGBD228NLBM", yahooId: "GC=F",
    tooltipKr: "\uC548\uC804\uC790\uC0B0 \uC218\uC694 \uC9C0\uD45C",
    tooltipEn: "Safe haven demand indicator",
  },
  {
    id: "SILVER", label: "Silver", labelKr: "\uC740",
    emoji: "\u{1FA99}", unit: "$/oz", category: "precious",
    fredId: "PSILVERUSDM", yahooId: "SI=F",
    tooltipKr: "\uC0B0\uC5C5\uC6A9+\uADC0\uAE08\uC18D \uC774\uC911 \uC218\uC694",
    tooltipEn: "Dual demand: industrial + precious metal",
  },
  {
    id: "COPPER", label: "Copper", labelKr: "\uAD6C\uB9AC",
    emoji: "\u{1F6E0}\uFE0F", unit: "$/lb", category: "industrial",
    fredId: "PCOPPUSDM", yahooId: "HG=F",
    tooltipKr: "\uAE00\uB85C\uBC8C \uACBD\uAE30 \uC120\uD589\uC9C0\uD45C (\uB2E5\uD130 \uCFE0\uD37C)",
    tooltipEn: "Global economic leading indicator (Dr. Copper)",
  },
];

interface CommodityResult {
  id: string;
  label: string;
  labelKr: string;
  emoji: string;
  unit: string;
  category: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  weekAgo: number;
  weekChange: number;
  weekChangePercent: number;
  sparkline: number[];
  tooltipKr: string;
  tooltipEn: string;
}

interface CacheEntry {
  data: CommodityResult[];
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

async function fetchYahooQuote(symbol: string): Promise<{ price: number; prevClose: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=7d&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json.chart?.result?.[0]?.meta;
    if (!meta) return null;
    return {
      price: meta.regularMarketPrice ?? 0,
      prevClose: meta.chartPreviousClose ?? meta.previousClose ?? 0,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  if (!FRED_API_KEY) {
    return NextResponse.json({ ok: false, error: "FRED_API_KEY not configured" }, { status: 500 });
  }

  if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
    return NextResponse.json({ ok: true, data: cache.data });
  }

  try {
    // Fetch FRED + Yahoo in parallel
    const [fredResults, yahooResults] = await Promise.all([
      Promise.allSettled(COMMODITIES.map(c => fetchFredSeries(c.fredId))),
      Promise.allSettled(COMMODITIES.map(c => fetchYahooQuote(c.yahooId))),
    ]);

    const commodityResults: CommodityResult[] = [];

    for (let i = 0; i < COMMODITIES.length; i++) {
      const cfg = COMMODITIES[i];
      const fredR = fredResults[i];
      const yahooR = yahooResults[i];
      const fred = fredR.status === "fulfilled" ? fredR.value : [];
      const yahoo = yahooR.status === "fulfilled" ? yahooR.value : null;

      // Use Yahoo for real-time price if available, otherwise FRED
      let current: number;
      let previous: number;

      if (yahoo && yahoo.price > 0) {
        current = yahoo.price;
        previous = yahoo.prevClose > 0 ? yahoo.prevClose : (fred.length > 1 ? fred[fred.length - 2].value : current);
      } else if (fred.length >= 2) {
        current = fred[fred.length - 1].value;
        previous = fred[fred.length - 2].value;
      } else {
        continue;
      }

      const change = current - previous;
      const changePercent = previous !== 0 ? (change / Math.abs(previous)) * 100 : 0;

      // Week ago from FRED data
      const weekAgo = fred.length >= 6 ? fred[fred.length - 6].value : previous;
      const weekChange = current - weekAgo;
      const weekChangePercent = weekAgo !== 0 ? (weekChange / Math.abs(weekAgo)) * 100 : 0;

      // Sparkline from last 7 FRED data points
      const sparkline = fred.slice(-7).map(o => o.value);
      // If we have yahoo real-time, append it
      if (yahoo && yahoo.price > 0 && sparkline.length > 0) {
        sparkline[sparkline.length - 1] = yahoo.price;
      }

      commodityResults.push({
        id: cfg.id,
        label: cfg.label,
        labelKr: cfg.labelKr,
        emoji: cfg.emoji,
        unit: cfg.unit,
        category: cfg.category,
        current: Math.round(current * 100) / 100,
        previous: Math.round(previous * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        weekAgo: Math.round(weekAgo * 100) / 100,
        weekChange: Math.round(weekChange * 100) / 100,
        weekChangePercent: Math.round(weekChangePercent * 100) / 100,
        sparkline,
        tooltipKr: cfg.tooltipKr,
        tooltipEn: cfg.tooltipEn,
      });
    }

    cache = { data: commodityResults, cachedAt: Date.now() };
    return NextResponse.json({ ok: true, data: commodityResults });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
