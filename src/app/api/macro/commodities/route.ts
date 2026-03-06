import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

interface CommodityConfig {
  id: string;
  label: string;
  labelKr: string;
  unit: string;
  category: "energy" | "precious" | "industrial";
  yahooId: string;
  tooltipKr: string;
  tooltipEn: string;
}

const COMMODITIES: CommodityConfig[] = [
  {
    id: "WTI", label: "WTI Crude Oil", labelKr: "WTI 원유",
    unit: "$/bbl", category: "energy", yahooId: "CL=F",
    tooltipKr: "한국 에너지 수입 핵심 지표",
    tooltipEn: "Key indicator for Korea's energy imports",
  },
  {
    id: "NATGAS", label: "Natural Gas", labelKr: "천연가스",
    unit: "$/MMBtu", category: "energy", yahooId: "NG=F",
    tooltipKr: "LNG 수입국 한국 직접 영향",
    tooltipEn: "Direct impact on Korea as major LNG importer",
  },
  {
    id: "GOLD", label: "Gold", labelKr: "금",
    unit: "$/oz", category: "precious", yahooId: "GC=F",
    tooltipKr: "안전자산 수요 지표",
    tooltipEn: "Safe haven demand indicator",
  },
  {
    id: "SILVER", label: "Silver", labelKr: "은",
    unit: "$/oz", category: "precious", yahooId: "SI=F",
    tooltipKr: "산업용+귀금속 이중 수요",
    tooltipEn: "Dual demand: industrial + precious metal",
  },
  {
    id: "COPPER", label: "Copper", labelKr: "구리",
    unit: "$/lb", category: "industrial", yahooId: "HG=F",
    tooltipKr: "글로벌 경기 선행지표 (닥터 쿠퍼)",
    tooltipEn: "Global economic leading indicator (Dr. Copper)",
  },
];

interface CommodityResult {
  id: string;
  label: string;
  labelKr: string;
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

interface YahooChartData {
  price: number;
  prevClose: number;
  sparkline: number[];
  weekAgoPrice: number;
}

async function fetchYahooChart(symbol: string): Promise<YahooChartData | null> {
  try {
    // Use 1mo range with 1d interval to get sparkline + proper previous close
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`;
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
    const prevClose = meta?.previousClose ?? 0;

    // Extract closing prices for sparkline
    const closes: number[] = result.indicators?.quote?.[0]?.close || [];
    const validCloses = closes.filter((c: number | null) => c != null && !isNaN(c)) as number[];

    // Last 7 trading days for sparkline
    const spark = validCloses.slice(-7);
    if (spark.length > 0 && price > 0) {
      spark[spark.length - 1] = price; // Update last with real-time
    }

    // Week ago price (5 trading days back)
    const weekAgoPrice = validCloses.length >= 6 ? validCloses[validCloses.length - 6] : prevClose;

    return { price, prevClose, sparkline: spark, weekAgoPrice };
  } catch {
    return null;
  }
}

export async function GET() {
  if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
    return NextResponse.json({ ok: true, data: cache.data });
  }

  try {
    const results = await Promise.allSettled(
      COMMODITIES.map(c => fetchYahooChart(c.yahooId))
    );

    const commodityResults: CommodityResult[] = [];

    for (let i = 0; i < COMMODITIES.length; i++) {
      const cfg = COMMODITIES[i];
      const r = results[i];
      const yahoo = r.status === "fulfilled" ? r.value : null;

      if (!yahoo || yahoo.price <= 0) continue;

      const current = yahoo.price;
      const previous = yahoo.prevClose > 0 ? yahoo.prevClose : current;
      const change = current - previous;
      const changePercent = previous !== 0 ? (change / Math.abs(previous)) * 100 : 0;

      const weekAgo = yahoo.weekAgoPrice > 0 ? yahoo.weekAgoPrice : previous;
      const weekChange = current - weekAgo;
      const weekChangePercent = weekAgo !== 0 ? (weekChange / Math.abs(weekAgo)) * 100 : 0;

      commodityResults.push({
        id: cfg.id,
        label: cfg.label,
        labelKr: cfg.labelKr,
        unit: cfg.unit,
        category: cfg.category,
        current: Math.round(current * 100) / 100,
        previous: Math.round(previous * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        weekAgo: Math.round(weekAgo * 100) / 100,
        weekChange: Math.round(weekChange * 100) / 100,
        weekChangePercent: Math.round(weekChangePercent * 100) / 100,
        sparkline: yahoo.sparkline,
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
