import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

interface CommodityConfig {
  id: string;
  label: string;
  labelKr: string;
  unit: string;
  category: "energy" | "precious" | "industrial" | "battery";
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
    id: "BRENT", label: "Brent Crude", labelKr: "브렌트유",
    unit: "$/bbl", category: "energy", yahooId: "BZ=F",
    tooltipKr: "국제 원유 벤치마크 (유럽/아시아)",
    tooltipEn: "International crude oil benchmark (Europe/Asia)",
  },
  {
    id: "NATGAS", label: "Natural Gas", labelKr: "천연가스",
    unit: "$/MMBtu", category: "energy", yahooId: "NG=F",
    tooltipKr: "LNG 수입국 한국 직접 영향",
    tooltipEn: "Direct impact on Korea as major LNG importer",
  },
  {
    id: "GASOLINE", label: "Gasoline (RBOB)", labelKr: "휘발유",
    unit: "$/gal", category: "energy", yahooId: "RB=F",
    tooltipKr: "정유업종 마진 및 소비자 물가 영향",
    tooltipEn: "Refining margins and consumer price indicator",
  },
  {
    id: "URANIUM", label: "Uranium ETF (URA)", labelKr: "우라늄",
    unit: "$/share", category: "energy", yahooId: "URA",
    tooltipKr: "원전 연료 핵심 소재 (SMR/원전 르네상스)",
    tooltipEn: "Nuclear fuel key material (SMR/nuclear renaissance)",
  },
  {
    id: "LNG_PROXY", label: "LNG (Cheniere)", labelKr: "LNG",
    unit: "$", category: "energy", yahooId: "LNG",
    tooltipKr: "LNG 수출 대표 기업 (천연가스 프록시)",
    tooltipEn: "Leading LNG exporter (natural gas proxy)",
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
    id: "PALLADIUM", label: "Palladium", labelKr: "팔라듐",
    unit: "$/oz", category: "precious", yahooId: "PA=F",
    tooltipKr: "자동차 배기가스 촉매 핵심 소재",
    tooltipEn: "Key material for automotive catalytic converters",
  },
  {
    id: "COPPER", label: "Copper", labelKr: "구리",
    unit: "$/lb", category: "industrial", yahooId: "HG=F",
    tooltipKr: "글로벌 경기 선행지표 (닥터 쿠퍼)",
    tooltipEn: "Global economic leading indicator (Dr. Copper)",
  },
  {
    id: "ALUMINUM", label: "Aluminum", labelKr: "알루미늄",
    unit: "$/ton", category: "industrial", yahooId: "ALI=F",
    tooltipKr: "경량화 트렌드 핵심 소재 (자동차/항공)",
    tooltipEn: "Key lightweight material (auto/aerospace)",
  },
  {
    id: "NICKEL", label: "Nickel", labelKr: "니켈",
    unit: "$/ton", category: "industrial", yahooId: "NI=F",
    tooltipKr: "스테인리스강 및 배터리 핵심 소재",
    tooltipEn: "Key material for stainless steel and batteries",
  },
  {
    id: "LITHIUM", label: "Lithium ETF (LIT)", labelKr: "리튬",
    unit: "$", category: "battery", yahooId: "LIT",
    tooltipKr: "2차전지 핵심 소재 (EV/ESS 수요)",
    tooltipEn: "Key battery material (EV/ESS demand)",
  },
  {
    id: "RAREEARTH", label: "Rare Earth ETF (REMX)", labelKr: "희토류 ETF",
    unit: "$", category: "battery", yahooId: "REMX",
    tooltipKr: "전기차/방산 핵심 희토류 소재",
    tooltipEn: "Critical rare earth materials for EV/defense",
  },
  {
    id: "COBALT", label: "Cobalt (VALE proxy)", labelKr: "코발트",
    unit: "$", category: "battery", yahooId: "VALE",
    tooltipKr: "배터리 핵심 소재 (VALE 프록시)",
    tooltipEn: "Key battery material (VALE mining proxy)",
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
