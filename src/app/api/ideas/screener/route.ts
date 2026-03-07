import { NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

export const runtime = "nodejs";

// ── Top KOSPI/KOSDAQ stock list ──────────────────────────────

interface StockDef {
  ticker: string;
  symbol: string; // Yahoo Finance symbol
  name: string;
  market: "KR" | "US";
}

const KR_STOCKS: StockDef[] = [
  { ticker: "005930", symbol: "005930.KS", name: "Samsung Elec", market: "KR" },
  { ticker: "000660", symbol: "000660.KS", name: "SK Hynix", market: "KR" },
  { ticker: "373220", symbol: "373220.KS", name: "LG Energy", market: "KR" },
  { ticker: "035420", symbol: "035420.KS", name: "NAVER", market: "KR" },
  { ticker: "051910", symbol: "051910.KS", name: "LG Chem", market: "KR" },
  { ticker: "006400", symbol: "006400.KS", name: "Samsung SDI", market: "KR" },
  { ticker: "068270", symbol: "068270.KS", name: "Celltrion", market: "KR" },
  { ticker: "035720", symbol: "035720.KS", name: "Kakao", market: "KR" },
  { ticker: "105560", symbol: "105560.KS", name: "KB Financial", market: "KR" },
  { ticker: "055550", symbol: "055550.KS", name: "Shinhan FG", market: "KR" },
  { ticker: "086790", symbol: "086790.KS", name: "Hana Financial", market: "KR" },
  { ticker: "012330", symbol: "012330.KS", name: "Hyundai Mobis", market: "KR" },
  { ticker: "028260", symbol: "028260.KS", name: "Samsung C&T", market: "KR" },
  { ticker: "003670", symbol: "003670.KS", name: "Posco Future M", market: "KR" },
  { ticker: "066570", symbol: "066570.KS", name: "LG Electronics", market: "KR" },
  { ticker: "096770", symbol: "096770.KS", name: "SK Innovation", market: "KR" },
  { ticker: "034020", symbol: "034020.KS", name: "Doosan Enerbility", market: "KR" },
  { ticker: "009540", symbol: "009540.KS", name: "HD Korea Shipbldg", market: "KR" },
  { ticker: "017670", symbol: "017670.KS", name: "SK Telecom", market: "KR" },
  { ticker: "036570", symbol: "036570.KS", name: "NCsoft", market: "KR" },
  { ticker: "247540", symbol: "247540.KS", name: "Ecopro BM", market: "KR" },
  { ticker: "003490", symbol: "003490.KS", name: "Korean Air", market: "KR" },
  { ticker: "010130", symbol: "010130.KS", name: "Korea Zinc", market: "KR" },
  { ticker: "034730", symbol: "034730.KS", name: "SK Inc", market: "KR" },
  { ticker: "003550", symbol: "003550.KS", name: "LG", market: "KR" },
  { ticker: "009150", symbol: "009150.KS", name: "Samsung Electro", market: "KR" },
  { ticker: "012450", symbol: "012450.KS", name: "Hanwha Aerospace", market: "KR" },
  { ticker: "000270", symbol: "000270.KS", name: "Kia", market: "KR" },
  { ticker: "005380", symbol: "005380.KS", name: "Hyundai Motor", market: "KR" },
  { ticker: "000810", symbol: "000810.KS", name: "Samsung Fire", market: "KR" },
  { ticker: "032830", symbol: "032830.KS", name: "Samsung Life", market: "KR" },
  { ticker: "011200", symbol: "011200.KS", name: "HMM", market: "KR" },
  { ticker: "042700", symbol: "042700.KS", name: "Hanmi Semi", market: "KR" },
  { ticker: "005490", symbol: "005490.KS", name: "POSCO Holdings", market: "KR" },
  { ticker: "018260", symbol: "018260.KS", name: "Samsung SDS", market: "KR" },
  { ticker: "010950", symbol: "010950.KS", name: "S-Oil", market: "KR" },
  { ticker: "030200", symbol: "030200.KS", name: "KT", market: "KR" },
  { ticker: "033780", symbol: "033780.KS", name: "KT&G", market: "KR" },
  { ticker: "015760", symbol: "015760.KS", name: "Korea Elec Power", market: "KR" },
  { ticker: "326030", symbol: "326030.KS", name: "SK Biopharm", market: "KR" },
  { ticker: "352820", symbol: "352820.KS", name: "Hive", market: "KR" },
  { ticker: "263750", symbol: "263750.KS", name: "Pearl Abyss", market: "KR" },
  { ticker: "259960", symbol: "259960.KS", name: "Krafton", market: "KR" },
  { ticker: "377300", symbol: "377300.KS", name: "Kakao Pay", market: "KR" },
  { ticker: "035900", symbol: "035900.KS", name: "JYP Ent", market: "KR" },
  { ticker: "041510", symbol: "041510.KQ", name: "SM Ent", market: "KR" },
  { ticker: "086520", symbol: "086520.KQ", name: "Ecopro", market: "KR" },
  { ticker: "403870", symbol: "403870.KQ", name: "HPSP", market: "KR" },
  { ticker: "196170", symbol: "196170.KQ", name: "Alteogen", market: "KR" },
  { ticker: "293490", symbol: "293490.KQ", name: "Caway", market: "KR" },
];

const US_STOCKS: StockDef[] = [
  { ticker: "NVDA", symbol: "NVDA", name: "NVIDIA", market: "US" },
  { ticker: "AAPL", symbol: "AAPL", name: "Apple", market: "US" },
  { ticker: "MSFT", symbol: "MSFT", name: "Microsoft", market: "US" },
  { ticker: "GOOGL", symbol: "GOOGL", name: "Alphabet", market: "US" },
  { ticker: "AMZN", symbol: "AMZN", name: "Amazon", market: "US" },
  { ticker: "META", symbol: "META", name: "Meta Platforms", market: "US" },
  { ticker: "TSLA", symbol: "TSLA", name: "Tesla", market: "US" },
  { ticker: "AVGO", symbol: "AVGO", name: "Broadcom", market: "US" },
  { ticker: "LLY", symbol: "LLY", name: "Eli Lilly", market: "US" },
  { ticker: "JPM", symbol: "JPM", name: "JPMorgan Chase", market: "US" },
  { ticker: "V", symbol: "V", name: "Visa", market: "US" },
  { ticker: "UNH", symbol: "UNH", name: "UnitedHealth", market: "US" },
  { ticker: "COST", symbol: "COST", name: "Costco", market: "US" },
  { ticker: "NFLX", symbol: "NFLX", name: "Netflix", market: "US" },
  { ticker: "AMD", symbol: "AMD", name: "AMD", market: "US" },
  { ticker: "PLTR", symbol: "PLTR", name: "Palantir", market: "US" },
  { ticker: "ANET", symbol: "ANET", name: "Arista Networks", market: "US" },
  { ticker: "PANW", symbol: "PANW", name: "Palo Alto Networks", market: "US" },
  { ticker: "UBER", symbol: "UBER", name: "Uber", market: "US" },
  { ticker: "CRM", symbol: "CRM", name: "Salesforce", market: "US" },
  { ticker: "GE", symbol: "GE", name: "GE Aerospace", market: "US" },
  { ticker: "BA", symbol: "BA", name: "Boeing", market: "US" },
  { ticker: "DIS", symbol: "DIS", name: "Disney", market: "US" },
  { ticker: "INTC", symbol: "INTC", name: "Intel", market: "US" },
  { ticker: "COIN", symbol: "COIN", name: "Coinbase", market: "US" },
  { ticker: "SNOW", symbol: "SNOW", name: "Snowflake", market: "US" },
  { ticker: "SHOP", symbol: "SHOP", name: "Shopify", market: "US" },
  { ticker: "SQ", symbol: "SQ", name: "Block", market: "US" },
  { ticker: "MRVL", symbol: "MRVL", name: "Marvell Tech", market: "US" },
  { ticker: "ARM", symbol: "ARM", name: "Arm Holdings", market: "US" },
];

// ── Cache ────────────────────────────────────────────────────

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cache: { data: any; cachedAt: number } | null = null;

// ── Yahoo Finance fetcher ────────────────────────────────────

interface StockData {
  ticker: string;
  name: string;
  market: "KR" | "US";
  price: number;
  chgPct: number;
  chg1d: number;
  chg5d: number;
  chg20d: number;
  volume: number;
  avgVolume20d: number;
  volumeRatio: number;
  fiftyTwoWeekHigh: number;
  distTo52wHigh: number;
  near52wHigh: boolean;
}

async function fetchStockData(stock: StockDef): Promise<StockData | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(stock.symbol)}?range=3mo&interval=1d`;
    const res = await fetchWithTimeout(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    }, 8000);
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];
    if (!quote?.close || !quote?.volume) return null;

    const closes: number[] = [];
    const volumes: number[] = [];
    for (let i = 0; i < quote.close.length; i++) {
      if (quote.close[i] != null && quote.close[i] > 0) {
        closes.push(quote.close[i]);
        volumes.push(quote.volume[i] || 0);
      }
    }

    if (closes.length < 22) return null;

    const price = closes[closes.length - 1];
    const prevClose = closes[closes.length - 2];
    const chg1d = ((price - prevClose) / prevClose) * 100;
    const price5d = closes[Math.max(0, closes.length - 6)];
    const chg5d = ((price - price5d) / price5d) * 100;
    const price20d = closes[Math.max(0, closes.length - 21)];
    const chg20d = ((price - price20d) / price20d) * 100;

    const todayVol = volumes[volumes.length - 1];
    const last20Vol = volumes.slice(-21, -1);
    const avgVol20 = last20Vol.length > 0 ? last20Vol.reduce((a, b) => a + b, 0) / last20Vol.length : 1;
    const volumeRatio = avgVol20 > 0 ? todayVol / avgVol20 : 1;

    const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh || Math.max(...closes);
    const distTo52wHigh = fiftyTwoWeekHigh > 0 ? ((price / fiftyTwoWeekHigh) - 1) * 100 : 0;

    return {
      ticker: stock.ticker,
      name: stock.name,
      market: stock.market,
      price: Math.round(price * 100) / 100,
      chgPct: Math.round(chg1d * 100) / 100,
      chg1d: Math.round(chg1d * 100) / 100,
      chg5d: Math.round(chg5d * 100) / 100,
      chg20d: Math.round(chg20d * 100) / 100,
      volume: todayVol,
      avgVolume20d: Math.round(avgVol20),
      volumeRatio: Math.round(volumeRatio * 100) / 100,
      fiftyTwoWeekHigh,
      distTo52wHigh: Math.round(distTo52wHigh * 100) / 100,
      near52wHigh: distTo52wHigh >= -3,
    };
  } catch {
    return null;
  }
}

// ── Screening logic ──────────────────────────────────────────

function toIdea(s: StockData, tag: string) {
  return {
    ticker: s.ticker,
    name: s.name,
    price: s.price,
    chgPct: s.chgPct,
    tag,
    metrics: {
      chg1d: s.chg1d,
      chg5d: s.chg5d,
      chg20d: s.chg20d,
      near52wHigh: s.near52wHigh,
      volumeSpike: s.volumeRatio >= 2,
      tradingValue: 0,
    },
  };
}

function screenFomo(stocks: StockData[]) {
  // FOMO: sort by volume spike ratio (today vol / 20d avg vol), descending
  return [...stocks]
    .filter(s => s.volumeRatio > 1)
    .sort((a, b) => b.volumeRatio - a.volumeRatio)
    .slice(0, 20)
    .map(s => {
      let tag = "MOMO";
      if (s.volumeRatio >= 2.5) tag = "VOLUME SPIKE";
      else if (s.near52wHigh) tag = "52W HIGH";
      else if (s.chg5d > 5) tag = "BREAKOUT";
      return toIdea(s, tag);
    });
}

function screenValue(stocks: StockData[]) {
  // VALUE: stocks with negative 20D chg (pullback) but positive 1D (bounce starting)
  return [...stocks]
    .filter(s => s.chg20d < -3)
    .sort((a, b) => a.chg20d - b.chg20d)
    .slice(0, 20)
    .map(s => {
      const tag = s.chg1d > 0 ? "BREAKOUT" : "PULLBACK";
      return toIdea(s, tag);
    });
}

function screenHigh52(stocks: StockData[]) {
  // 52W HIGH: stocks within 3% of 52-week high
  return [...stocks]
    .filter(s => s.distTo52wHigh >= -3)
    .sort((a, b) => b.distTo52wHigh - a.distTo52wHigh)
    .slice(0, 60)
    .map(s => toIdea(s, "52W HIGH"));
}

// ── Route handler ────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
      return NextResponse.json({ ...cache.data, source: "cache" });
    }

    const allStocks = [...KR_STOCKS, ...US_STOCKS];

    const results = await Promise.allSettled(
      allStocks.map(s => fetchStockData(s))
    );

    const stocks: StockData[] = results
      .filter((r): r is PromiseFulfilledResult<StockData | null> => r.status === "fulfilled")
      .map(r => r.value)
      .filter((s): s is StockData => s !== null);

    const krStocks = stocks.filter(s => s.market === "KR");
    const usStocks = stocks.filter(s => s.market === "US");

    const responseData = {
      ok: true,
      fomo: screenFomo(stocks),
      value: screenValue(stocks),
      high52kr: screenHigh52(krStocks),
      high52us: screenHigh52(usStocks),
      totalStocks: stocks.length,
      asOf: new Date().toISOString(),
    };

    cache = { data: responseData, cachedAt: Date.now() };
    return NextResponse.json({ ...responseData, source: "live" });
  } catch (err) {
    if (cache) return NextResponse.json({ ...cache.data, source: "stale" });
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
