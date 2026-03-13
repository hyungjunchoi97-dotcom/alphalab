import { NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

export const runtime = "nodejs";

// ── Types ─────────────────────────────────────────────────────

interface StockDef {
  ticker: string;
  name: string;
  nameKr: string;
  sector: string;
  sectorKr: string;
  capWeight: number; // relative weight within sector
}

interface StockResult {
  ticker: string;
  name: string;
  nameKr: string;
  cap: number;
  chg: number;
  price: string;
}

interface SectorResult {
  name: string;
  nameKr: string;
  stocks: StockResult[];
}

// ── Stock definitions by sector ───────────────────────────────

const STOCKS: StockDef[] = [
  // Semiconductors
  { ticker: "005930", name: "Samsung", nameKr: "삼성전자", sector: "Semiconductors", sectorKr: "반도체", capWeight: 350 },
  { ticker: "000660", name: "SK Hynix", nameKr: "SK하이닉스", sector: "Semiconductors", sectorKr: "반도체", capWeight: 120 },
  { ticker: "042700", name: "Hanmi Semi", nameKr: "한미반도체", sector: "Semiconductors", sectorKr: "반도체", capWeight: 15 },
  { ticker: "009150", name: "Samsung Electro", nameKr: "삼성전기", sector: "Semiconductors", sectorKr: "반도체", capWeight: 12 },
  // Finance
  { ticker: "055550", name: "Shinhan FG", nameKr: "신한지주", sector: "Finance", sectorKr: "금융", capWeight: 25 },
  { ticker: "105560", name: "KB Financial", nameKr: "KB금융", sector: "Finance", sectorKr: "금융", capWeight: 28 },
  { ticker: "086790", name: "Hana FG", nameKr: "하나금융", sector: "Finance", sectorKr: "금융", capWeight: 18 },
  { ticker: "316140", name: "Woori FG", nameKr: "우리금융", sector: "Finance", sectorKr: "금융", capWeight: 12 },
  { ticker: "024110", name: "Industrial BK", nameKr: "기업은행", sector: "Finance", sectorKr: "금융", capWeight: 10 },
  { ticker: "000810", name: "Samsung Fire", nameKr: "삼성화재", sector: "Finance", sectorKr: "금융", capWeight: 14 },
  { ticker: "032830", name: "Samsung Life", nameKr: "삼성생명", sector: "Finance", sectorKr: "금융", capWeight: 12 },
  // Automotive
  { ticker: "005380", name: "Hyundai Motor", nameKr: "현대차", sector: "Automotive", sectorKr: "자동차", capWeight: 55 },
  { ticker: "000270", name: "Kia", nameKr: "기아", sector: "Automotive", sectorKr: "자동차", capWeight: 40 },
  { ticker: "012330", name: "Hyundai Mobis", nameKr: "현대모비스", sector: "Automotive", sectorKr: "자동차", capWeight: 20 },
  { ticker: "086280", name: "Hyundai Glovis", nameKr: "현대글로비스", sector: "Automotive", sectorKr: "자동차", capWeight: 10 },
  { ticker: "161390", name: "Hankook Tire", nameKr: "한국타이어", sector: "Automotive", sectorKr: "자동차", capWeight: 8 },
  // Chemicals/Battery
  { ticker: "051910", name: "LG Chem", nameKr: "LG화학", sector: "Chemicals", sectorKr: "화학/2차전지", capWeight: 30 },
  { ticker: "006400", name: "Samsung SDI", nameKr: "삼성SDI", sector: "Chemicals", sectorKr: "화학/2차전지", capWeight: 25 },
  { ticker: "096770", name: "SK Innovation", nameKr: "SK이노베이션", sector: "Chemicals", sectorKr: "화학/2차전지", capWeight: 12 },
  { ticker: "247540", name: "Ecopro BM", nameKr: "에코프로비엠", sector: "Chemicals", sectorKr: "화학/2차전지", capWeight: 10 },
  { ticker: "011170", name: "Lotte Chemical", nameKr: "롯데케미칼", sector: "Chemicals", sectorKr: "화학/2차전지", capWeight: 6 },
  { ticker: "009830", name: "Hanwha Sol", nameKr: "한화솔루션", sector: "Chemicals", sectorKr: "화학/2차전지", capWeight: 8 },
  // IT/Internet
  { ticker: "035420", name: "Naver", nameKr: "네이버", sector: "IT/Internet", sectorKr: "IT", capWeight: 45 },
  { ticker: "035720", name: "Kakao", nameKr: "카카오", sector: "IT/Internet", sectorKr: "IT", capWeight: 25 },
  { ticker: "018260", name: "Samsung SDS", nameKr: "삼성에스디에스", sector: "IT/Internet", sectorKr: "IT", capWeight: 12 },
  // Bio/Pharma
  { ticker: "068270", name: "Celltrion", nameKr: "셀트리온", sector: "Bio/Pharma", sectorKr: "바이오", capWeight: 35 },
  { ticker: "207940", name: "Samsung Bio", nameKr: "삼성바이오로직스", sector: "Bio/Pharma", sectorKr: "바이오", capWeight: 50 },
  { ticker: "000100", name: "Yuhan", nameKr: "유한양행", sector: "Bio/Pharma", sectorKr: "바이오", capWeight: 12 },
  // Industrial/Shipbuilding
  { ticker: "005490", name: "POSCO", nameKr: "포스코홀딩스", sector: "Industrial", sectorKr: "철강/조선", capWeight: 30 },
  { ticker: "042660", name: "Hanwha Ocean", nameKr: "한화오션", sector: "Industrial", sectorKr: "철강/조선", capWeight: 15 },
  { ticker: "010140", name: "Samsung Heavy", nameKr: "삼성중공업", sector: "Industrial", sectorKr: "철강/조선", capWeight: 10 },
  { ticker: "003490", name: "Korean Air", nameKr: "대한항공", sector: "Industrial", sectorKr: "철강/조선", capWeight: 12 },
  // Consumer/Telecom
  { ticker: "034730", name: "SK", nameKr: "SK", sector: "Consumer", sectorKr: "소비재/통신", capWeight: 15 },
  { ticker: "003550", name: "LG", nameKr: "LG", sector: "Consumer", sectorKr: "소비재/통신", capWeight: 14 },
  { ticker: "066570", name: "LG Elec", nameKr: "LG전자", sector: "Consumer", sectorKr: "소비재/통신", capWeight: 12 },
  { ticker: "017670", name: "SK Telecom", nameKr: "SK텔레콤", sector: "Consumer", sectorKr: "소비재/통신", capWeight: 14 },
  { ticker: "030200", name: "KT", nameKr: "KT", sector: "Consumer", sectorKr: "소비재/통신", capWeight: 10 },
  { ticker: "028260", name: "Samsung C&T", nameKr: "삼성물산", sector: "Consumer", sectorKr: "소비재/통신", capWeight: 12 },
  { ticker: "010950", name: "S-Oil", nameKr: "S-Oil", sector: "Consumer", sectorKr: "소비재/통신", capWeight: 8 },
  // Entertainment
  { ticker: "259960", name: "Krafton", nameKr: "크래프톤", sector: "Entertainment", sectorKr: "엔터/게임", capWeight: 18 },
  { ticker: "352820", name: "Hybe", nameKr: "하이브", sector: "Entertainment", sectorKr: "엔터/게임", capWeight: 12 },
  { ticker: "036570", name: "NC Soft", nameKr: "엔씨소프트", sector: "Entertainment", sectorKr: "엔터/게임", capWeight: 10 },
  { ticker: "251270", name: "Netmarble", nameKr: "넷마블", sector: "Entertainment", sectorKr: "엔터/게임", capWeight: 6 },
  { ticker: "041510", name: "SM Ent", nameKr: "에스엠", sector: "Entertainment", sectorKr: "엔터/게임", capWeight: 5 },
  { ticker: "035900", name: "JYP Ent", nameKr: "JYP Ent", sector: "Entertainment", sectorKr: "엔터/게임", capWeight: 5 },
];

// ── Cache ─────────────────────────────────────────────────────

const CACHE_TTL = 60 * 1000;
let cache: { data: SectorResult[]; cachedAt: number; asOf: string } | null = null;

// ── Yahoo Finance fetcher ─────────────────────────────────────

async function fetchYahooQuote(ticker: string): Promise<{ price: number; chg: number } | null> {
  const symbol = `${ticker}.KS`;
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`;
    const res = await fetchWithTimeout(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    }, 6000);
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const price = meta.regularMarketPrice || 0;
    const prevClose = meta.regularMarketPreviousClose || meta.previousClose || meta.chartPreviousClose || price;
    const chg = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

    return { price, chg: Math.round(chg * 100) / 100 };
  } catch {
    return null;
  }
}

// ── Fetch all stocks ──────────────────────────────────────────

async function fetchAllStocks(): Promise<SectorResult[]> {
  const results = await Promise.allSettled(
    STOCKS.map(async (s) => {
      const quote = await fetchYahooQuote(s.ticker);
      return {
        ticker: s.ticker,
        name: s.name,
        nameKr: s.nameKr,
        sector: s.sector,
        sectorKr: s.sectorKr,
        cap: s.capWeight,
        chg: quote?.chg ?? 0,
        price: quote?.price
          ? quote.price.toLocaleString("ko-KR")
          : "—",
      };
    })
  );

  // Group by sector
  const sectorMap = new Map<string, { nameKr: string; stocks: StockResult[] }>();

  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const s = r.value;
    if (!sectorMap.has(s.sector)) {
      sectorMap.set(s.sector, { nameKr: s.sectorKr, stocks: [] });
    }
    sectorMap.get(s.sector)!.stocks.push({
      ticker: s.ticker,
      name: s.name,
      nameKr: s.nameKr,
      cap: s.cap,
      chg: s.chg,
      price: s.price,
    });
  }

  const sectors: SectorResult[] = [];
  for (const [name, data] of sectorMap) {
    sectors.push({ name, nameKr: data.nameKr, stocks: data.stocks });
  }

  return sectors;
}

// ── Route handler ─────────────────────────────────────────────

export async function GET() {
  try {
    if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
      return NextResponse.json({ ok: true, sectors: cache.data, asOf: cache.asOf, source: "cache" });
    }

    const sectors = await fetchAllStocks();
    const asOf = new Date().toISOString();
    cache = { data: sectors, cachedAt: Date.now(), asOf };

    return NextResponse.json({ ok: true, sectors, asOf, source: "live" });
  } catch (err) {
    // Serve stale cache
    if (cache) {
      return NextResponse.json({ ok: true, sectors: cache.data, asOf: cache.asOf, source: "stale" });
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
