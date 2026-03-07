import { NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

export const runtime = "nodejs";

// ── Types ─────────────────────────────────────────────────────

interface StockDef {
  ticker: string;
  symbol: string; // Yahoo Finance symbol
  name: string;
  nameKr?: string;
  sector: string;
  sectorKr: string;
  capWeight: number;
}

interface StockResult {
  ticker: string;
  name: string;
  nameKr?: string;
  cap: number;
  chg: number;
  price: string;
}

interface SectorResult {
  name: string;
  nameKr: string;
  stocks: StockResult[];
}

// ── US Stock definitions ──────────────────────────────────────

const US_STOCKS: StockDef[] = [
  // Technology
  { ticker: "AAPL", symbol: "AAPL", name: "Apple", sector: "Technology", sectorKr: "기술", capWeight: 300 },
  { ticker: "MSFT", symbol: "MSFT", name: "Microsoft", sector: "Technology", sectorKr: "기술", capWeight: 280 },
  { ticker: "NVDA", symbol: "NVDA", name: "NVIDIA", sector: "Technology", sectorKr: "기술", capWeight: 250 },
  { ticker: "AVGO", symbol: "AVGO", name: "Broadcom", sector: "Technology", sectorKr: "기술", capWeight: 80 },
  { ticker: "ORCL", symbol: "ORCL", name: "Oracle", sector: "Technology", sectorKr: "기술", capWeight: 50 },
  { ticker: "CRM", symbol: "CRM", name: "Salesforce", sector: "Technology", sectorKr: "기술", capWeight: 35 },
  { ticker: "AMD", symbol: "AMD", name: "AMD", sector: "Technology", sectorKr: "기술", capWeight: 30 },
  { ticker: "INTC", symbol: "INTC", name: "Intel", sector: "Technology", sectorKr: "기술", capWeight: 18 },
  // Communication
  { ticker: "GOOGL", symbol: "GOOGL", name: "Alphabet", sector: "Communication", sectorKr: "커뮤니케이션", capWeight: 200 },
  { ticker: "META", symbol: "META", name: "Meta", sector: "Communication", sectorKr: "커뮤니케이션", capWeight: 150 },
  { ticker: "NFLX", symbol: "NFLX", name: "Netflix", sector: "Communication", sectorKr: "커뮤니케이션", capWeight: 40 },
  { ticker: "DIS", symbol: "DIS", name: "Disney", sector: "Communication", sectorKr: "커뮤니케이션", capWeight: 25 },
  { ticker: "CMCSA", symbol: "CMCSA", name: "Comcast", sector: "Communication", sectorKr: "커뮤니케이션", capWeight: 18 },
  // Consumer
  { ticker: "AMZN", symbol: "AMZN", name: "Amazon", sector: "Consumer", sectorKr: "소비재", capWeight: 200 },
  { ticker: "TSLA", symbol: "TSLA", name: "Tesla", sector: "Consumer", sectorKr: "소비재", capWeight: 85 },
  { ticker: "WMT", symbol: "WMT", name: "Walmart", sector: "Consumer", sectorKr: "소비재", capWeight: 50 },
  { ticker: "HD", symbol: "HD", name: "Home Depot", sector: "Consumer", sectorKr: "소비재", capWeight: 40 },
  { ticker: "COST", symbol: "COST", name: "Costco", sector: "Consumer", sectorKr: "소비재", capWeight: 38 },
  { ticker: "MCD", symbol: "MCD", name: "McDonald's", sector: "Consumer", sectorKr: "소비재", capWeight: 30 },
  { ticker: "NKE", symbol: "NKE", name: "Nike", sector: "Consumer", sectorKr: "소비재", capWeight: 18 },
  // Financial
  { ticker: "BRK-B", symbol: "BRK-B", name: "Berkshire", sector: "Financial", sectorKr: "금융", capWeight: 90 },
  { ticker: "JPM", symbol: "JPM", name: "JP Morgan", sector: "Financial", sectorKr: "금융", capWeight: 70 },
  { ticker: "V", symbol: "V", name: "Visa", sector: "Financial", sectorKr: "금융", capWeight: 55 },
  { ticker: "MA", symbol: "MA", name: "Mastercard", sector: "Financial", sectorKr: "금융", capWeight: 45 },
  { ticker: "BAC", symbol: "BAC", name: "BofA", sector: "Financial", sectorKr: "금융", capWeight: 30 },
  { ticker: "GS", symbol: "GS", name: "Goldman", sector: "Financial", sectorKr: "금융", capWeight: 20 },
  { ticker: "WFC", symbol: "WFC", name: "Wells Fargo", sector: "Financial", sectorKr: "금융", capWeight: 22 },
  // Healthcare
  { ticker: "LLY", symbol: "LLY", name: "Eli Lilly", sector: "Healthcare", sectorKr: "헬스케어", capWeight: 80 },
  { ticker: "UNH", symbol: "UNH", name: "UnitedHealth", sector: "Healthcare", sectorKr: "헬스케어", capWeight: 60 },
  { ticker: "JNJ", symbol: "JNJ", name: "J&J", sector: "Healthcare", sectorKr: "헬스케어", capWeight: 45 },
  { ticker: "ABBV", symbol: "ABBV", name: "AbbVie", sector: "Healthcare", sectorKr: "헬스케어", capWeight: 35 },
  { ticker: "MRK", symbol: "MRK", name: "Merck", sector: "Healthcare", sectorKr: "헬스케어", capWeight: 30 },
  { ticker: "PFE", symbol: "PFE", name: "Pfizer", sector: "Healthcare", sectorKr: "헬스케어", capWeight: 20 },
  // Energy
  { ticker: "XOM", symbol: "XOM", name: "Exxon", sector: "Energy", sectorKr: "에너지", capWeight: 50 },
  { ticker: "CVX", symbol: "CVX", name: "Chevron", sector: "Energy", sectorKr: "에너지", capWeight: 35 },
  { ticker: "COP", symbol: "COP", name: "ConocoPhillips", sector: "Energy", sectorKr: "에너지", capWeight: 18 },
  { ticker: "EOG", symbol: "EOG", name: "EOG Resources", sector: "Energy", sectorKr: "에너지", capWeight: 12 },
  // Industrial
  { ticker: "GE", symbol: "GE", name: "GE Aero", sector: "Industrial", sectorKr: "산업재", capWeight: 30 },
  { ticker: "CAT", symbol: "CAT", name: "Caterpillar", sector: "Industrial", sectorKr: "산업재", capWeight: 25 },
  { ticker: "RTX", symbol: "RTX", name: "RTX", sector: "Industrial", sectorKr: "산업재", capWeight: 20 },
  { ticker: "BA", symbol: "BA", name: "Boeing", sector: "Industrial", sectorKr: "산업재", capWeight: 15 },
];

// ── JP Stock definitions ──────────────────────────────────────

const JP_STOCKS: StockDef[] = [
  // Automotive
  { ticker: "7203", symbol: "7203.T", name: "Toyota", nameKr: "도요타", sector: "Automotive", sectorKr: "자동차", capWeight: 300 },
  { ticker: "7267", symbol: "7267.T", name: "Honda", nameKr: "혼다", sector: "Automotive", sectorKr: "자동차", capWeight: 60 },
  { ticker: "7974", symbol: "7974.T", name: "Nintendo", nameKr: "닌텐도", sector: "Automotive", sectorKr: "게임/자동차", capWeight: 80 },
  { ticker: "7201", symbol: "7201.T", name: "Nissan", nameKr: "닛산", sector: "Automotive", sectorKr: "자동차", capWeight: 15 },
  // Technology
  { ticker: "6758", symbol: "6758.T", name: "Sony", nameKr: "소니", sector: "Technology", sectorKr: "기술", capWeight: 150 },
  { ticker: "6861", symbol: "6861.T", name: "Keyence", nameKr: "키엔스", sector: "Technology", sectorKr: "기술", capWeight: 130 },
  { ticker: "6857", symbol: "6857.T", name: "Advantest", nameKr: "어드밴테스트", sector: "Technology", sectorKr: "기술", capWeight: 45 },
  { ticker: "6501", symbol: "6501.T", name: "Hitachi", nameKr: "히타치", sector: "Technology", sectorKr: "기술", capWeight: 60 },
  { ticker: "6954", symbol: "6954.T", name: "Fanuc", nameKr: "화낙", sector: "Technology", sectorKr: "기술", capWeight: 40 },
  { ticker: "6902", symbol: "6902.T", name: "Denso", nameKr: "덴소", sector: "Technology", sectorKr: "기술", capWeight: 35 },
  // Finance
  { ticker: "8306", symbol: "8306.T", name: "MUFG", nameKr: "미쓰비시UFJ", sector: "Finance", sectorKr: "금융", capWeight: 100 },
  { ticker: "8316", symbol: "8316.T", name: "SMFG", nameKr: "미쓰이스미토모", sector: "Finance", sectorKr: "금융", capWeight: 60 },
  { ticker: "8035", symbol: "8035.T", name: "Tokyo Electron", nameKr: "도쿄일렉트론", sector: "Finance", sectorKr: "반도체장비", capWeight: 90 },
  // Telecom & Consumer
  { ticker: "9984", symbol: "9984.T", name: "SoftBank", nameKr: "소프트뱅크", sector: "Telecom", sectorKr: "통신", capWeight: 80 },
  { ticker: "9432", symbol: "9432.T", name: "NTT", nameKr: "NTT", sector: "Telecom", sectorKr: "통신", capWeight: 60 },
  { ticker: "9433", symbol: "9433.T", name: "KDDI", nameKr: "KDDI", sector: "Telecom", sectorKr: "통신", capWeight: 45 },
  { ticker: "9983", symbol: "9983.T", name: "Fast Retailing", nameKr: "패스트리테일링", sector: "Consumer", sectorKr: "소비재", capWeight: 100 },
  // Industrial & Healthcare
  { ticker: "7741", symbol: "7741.T", name: "HOYA", nameKr: "호야", sector: "Industrial", sectorKr: "산업재", capWeight: 50 },
  { ticker: "4063", symbol: "4063.T", name: "Shin-Etsu", nameKr: "신에츠화학", sector: "Industrial", sectorKr: "산업재", capWeight: 55 },
  { ticker: "6367", symbol: "6367.T", name: "Daikin", nameKr: "다이킨", sector: "Industrial", sectorKr: "산업재", capWeight: 45 },
  { ticker: "4519", symbol: "4519.T", name: "Chugai Pharma", nameKr: "추가이제약", sector: "Healthcare", sectorKr: "헬스케어", capWeight: 50 },
  { ticker: "4502", symbol: "4502.T", name: "Takeda", nameKr: "다케다", sector: "Healthcare", sectorKr: "헬스케어", capWeight: 45 },
  { ticker: "4568", symbol: "4568.T", name: "Daiichi Sankyo", nameKr: "다이이치산쿄", sector: "Healthcare", sectorKr: "헬스케어", capWeight: 70 },
];

// ── Cache ─────────────────────────────────────────────────────

const CACHE_TTL = 60_000; // 60 seconds

interface CacheEntry {
  sectors: SectorResult[];
  asOf: string;
  cachedAt: number;
}

let usCache: CacheEntry | null = null;
let jpCache: CacheEntry | null = null;

// ── Yahoo Finance fetcher ─────────────────────────────────────

async function fetchYahooQuote(symbol: string): Promise<{ price: number; changePct: number; marketCap: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const res = await fetchWithTimeout(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    }, 8000);
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price = meta?.regularMarketPrice;
    if (price == null) return null;

    const prevClose = meta?.chartPreviousClose ?? meta?.previousClose;
    const changePct = prevClose && prevClose > 0
      ? ((price - prevClose) / prevClose) * 100
      : 0;

    return { price, changePct: Math.round(changePct * 100) / 100, marketCap: 0 };
  } catch {
    return null;
  }
}

function formatPrice(price: number, market: "us" | "jp"): string {
  if (market === "jp") {
    return "¥" + Math.round(price).toLocaleString("ja-JP");
  }
  return "$" + price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function fetchMarketData(stocks: StockDef[], market: "us" | "jp"): Promise<SectorResult[]> {
  const results = await Promise.allSettled(
    stocks.map(async (s) => {
      const quote = await fetchYahooQuote(s.symbol);
      return { def: s, quote };
    })
  );

  // Group by sector
  const sectorMap = new Map<string, { name: string; nameKr: string; stocks: StockResult[] }>();

  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const { def, quote } = r.value;

    if (!sectorMap.has(def.sector)) {
      sectorMap.set(def.sector, { name: def.sector, nameKr: def.sectorKr, stocks: [] });
    }

    const sector = sectorMap.get(def.sector)!;
    sector.stocks.push({
      ticker: def.ticker,
      name: def.name,
      nameKr: def.nameKr,
      cap: def.capWeight,
      chg: quote?.changePct ?? 0,
      price: quote ? formatPrice(quote.price, market) : "—",
    });
  }

  // Sort sectors by total cap weight descending
  return Array.from(sectorMap.values()).sort(
    (a, b) => b.stocks.reduce((s, st) => s + st.cap, 0) - a.stocks.reduce((s, st) => s + st.cap, 0)
  );
}

// ── Route handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const market = searchParams.get("market")?.toLowerCase() ?? "us";

  if (market !== "us" && market !== "jp") {
    return NextResponse.json({ ok: false, error: "market must be 'us' or 'jp'" }, { status: 400 });
  }

  const cache = market === "us" ? usCache : jpCache;

  try {
    if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
      return NextResponse.json({ ok: true, sectors: cache.sectors, asOf: cache.asOf, source: "cache" });
    }

    const stocks = market === "us" ? US_STOCKS : JP_STOCKS;
    const sectors = await fetchMarketData(stocks, market);

    const entry: CacheEntry = {
      sectors,
      asOf: new Date().toISOString(),
      cachedAt: Date.now(),
    };

    if (market === "us") usCache = entry;
    else jpCache = entry;

    return NextResponse.json({ ok: true, sectors, asOf: entry.asOf, source: "live" });
  } catch (err) {
    // Return stale cache on error
    if (cache) {
      return NextResponse.json({ ok: true, sectors: cache.sectors, asOf: cache.asOf, source: "stale-cache" });
    }
    return NextResponse.json(
      { ok: false, sectors: [], error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
