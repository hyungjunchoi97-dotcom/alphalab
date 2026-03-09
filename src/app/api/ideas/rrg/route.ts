import { NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

export const runtime = "nodejs";

// ── Sector ETF definitions ───────────────────────────────────

interface SectorDef {
  ticker: string;
  symbol: string; // Yahoo Finance symbol
  name: string;
  nameKr: string;
  color: string;
  market: "KR" | "US";
}

const KR_SECTORS: SectorDef[] = [
  { ticker: "091160", symbol: "091160.KS", name: "Semiconductors", nameKr: "반도체", color: "#3b82f6", market: "KR" },
  { ticker: "091170", symbol: "091170.KS", name: "Banks", nameKr: "은행", color: "#14b8a6", market: "KR" },
  { ticker: "091180", symbol: "091180.KS", name: "Automotive", nameKr: "자동차", color: "#9ca3af", market: "KR" },
  { ticker: "140710", symbol: "140710.KS", name: "Transport", nameKr: "운송", color: "#eab308", market: "KR" },
  { ticker: "244580", symbol: "244580.KS", name: "Biotech", nameKr: "바이오", color: "#22c55e", market: "KR" },
  { ticker: "117680", symbol: "117680.KS", name: "Steel", nameKr: "철강", color: "#6b7280", market: "KR" },
  { ticker: "266370", symbol: "266370.KS", name: "Chemicals", nameKr: "화학", color: "#f97316", market: "KR" },
  { ticker: "139250", symbol: "139250.KS", name: "IT", nameKr: "IT", color: "#a855f7", market: "KR" },
  { ticker: "227560", symbol: "227560.KS", name: "Consumer", nameKr: "소비재", color: "#ef4444", market: "KR" },
  { ticker: "117700", symbol: "117700.KS", name: "Construction", nameKr: "건설", color: "#92400e", market: "KR" },
];

const US_SECTORS: SectorDef[] = [
  { ticker: "XLK", symbol: "XLK", name: "Technology", nameKr: "기술", color: "#3b82f6", market: "US" },
  { ticker: "XLF", symbol: "XLF", name: "Financial", nameKr: "금융", color: "#60a5fa", market: "US" },
  { ticker: "XLE", symbol: "XLE", name: "Energy", nameKr: "에너지", color: "#f97316", market: "US" },
  { ticker: "XLV", symbol: "XLV", name: "Healthcare", nameKr: "헬스케어", color: "#ef4444", market: "US" },
  { ticker: "XLI", symbol: "XLI", name: "Industrial", nameKr: "산업재", color: "#9ca3af", market: "US" },
  { ticker: "XLB", symbol: "XLB", name: "Materials", nameKr: "소재", color: "#92400e", market: "US" },
  { ticker: "XLP", symbol: "XLP", name: "Staples", nameKr: "필수소비재", color: "#22c55e", market: "US" },
  { ticker: "XLY", symbol: "XLY", name: "Discretionary", nameKr: "임의소비재", color: "#eab308", market: "US" },
  { ticker: "XLU", symbol: "XLU", name: "Utilities", nameKr: "유틸리티", color: "#c084fc", market: "US" },
];

const KR_BENCHMARK = { symbol: "^KS11", name: "KOSPI" };
const US_BENCHMARK = { symbol: "SPY", name: "S&P 500" };

// ── Cache ────────────────────────────────────────────────────

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cache: { data: Record<string, any>; cachedAt: number } | null = null;

// ── Yahoo Finance fetcher ────────────────────────────────────

async function fetchWeeklyCloses(symbol: string): Promise<number[] | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=6mo&interval=1wk`;
    const res = await fetchWithTimeout(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    }, 8000);
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;
    const closes: number[] = [];
    const quote = result.indicators?.quote?.[0];
    if (!quote?.close) return null;
    for (const c of quote.close) {
      if (c != null && c > 0) closes.push(c);
    }
    // Drop the last entry if it duplicates the previous (incomplete current week)
    if (closes.length >= 2 && closes[closes.length - 1] === closes[closes.length - 2]) {
      closes.pop();
    }
    return closes.length >= 12 ? closes : null;
  } catch {
    return null;
  }
}

// ── JdK RS-Ratio / RS-Momentum calculation ───────────────────

function sma(arr: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    if (i < period - 1) {
      result.push(arr[i]); // not enough data, use raw
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += arr[j];
      result.push(sum / period);
    }
  }
  return result;
}

interface RRGPoint {
  week: number;
  rsRatio: number;
  rsMomentum: number;
}

function calculateRRG(sectorCloses: number[], benchmarkCloses: number[]): RRGPoint[] {
  const len = Math.min(sectorCloses.length, benchmarkCloses.length);
  if (len < 12) return [];

  // Use last `len` items aligned
  const sc = sectorCloses.slice(-len);
  const bc = benchmarkCloses.slice(-len);

  // 1. RS = sector / benchmark (normalized)
  const rs: number[] = [];
  for (let i = 0; i < len; i++) {
    rs.push(sc[i] / bc[i]);
  }

  // 2. RS-Ratio = 100 + ((RS / SMA(RS, 10)) - 1) * 100
  const rsSma10 = sma(rs, 10);
  const rsRatio: number[] = [];
  for (let i = 0; i < len; i++) {
    rsRatio.push(100 + ((rs[i] / rsSma10[i]) - 1) * 100);
  }

  // 3. RS-Momentum = 100 + ((RS-Ratio / SMA(RS-Ratio, 4)) - 1) * 100
  const ratioSma4 = sma(rsRatio, 4);
  const rsMomentum: number[] = [];
  for (let i = 0; i < len; i++) {
    rsMomentum.push(100 + ((rsRatio[i] / ratioSma4[i]) - 1) * 100);
  }

  // Return last 12 weeks of data points
  const points: RRGPoint[] = [];
  const startIdx = Math.max(0, len - 12);
  for (let i = startIdx; i < len; i++) {
    points.push({
      week: i - startIdx,
      rsRatio: Math.round(rsRatio[i] * 100) / 100,
      rsMomentum: Math.round(rsMomentum[i] * 100) / 100,
    });
  }
  return points;
}

function getQuadrant(rsRatio: number, rsMomentum: number): "leading" | "improving" | "lagging" | "weakening" {
  if (rsRatio >= 100 && rsMomentum >= 100) return "leading";
  if (rsRatio < 100 && rsMomentum >= 100) return "improving";
  if (rsRatio < 100 && rsMomentum < 100) return "lagging";
  return "weakening";
}

// ── Fetch all sectors ────────────────────────────────────────

interface SectorRRGResult {
  ticker: string;
  name: string;
  nameKr: string;
  color: string;
  market: "KR" | "US";
  trail: RRGPoint[];
  current: RRGPoint;
  quadrant: "leading" | "improving" | "lagging" | "weakening";
  chg5d: number;
}

async function fetchAllSectors(
  sectors: SectorDef[],
  benchmarkSymbol: string
): Promise<SectorRRGResult[]> {
  const benchmarkCloses = await fetchWeeklyCloses(benchmarkSymbol);
  if (!benchmarkCloses) return [];

  const results = await Promise.allSettled(
    sectors.map(async (s) => {
      const closes = await fetchWeeklyCloses(s.symbol);
      if (!closes) return null;

      const trail = calculateRRG(closes, benchmarkCloses);
      if (trail.length === 0) return null;

      const current = trail[trail.length - 1];
      const quadrant = getQuadrant(current.rsRatio, current.rsMomentum);

      // 5-day (1 week) return
      const chg5d = closes.length >= 2
        ? Math.round(((closes[closes.length - 1] / closes[closes.length - 2]) - 1) * 10000) / 100
        : 0;

      return {
        ticker: s.ticker,
        name: s.name,
        nameKr: s.nameKr,
        color: s.color,
        market: s.market,
        trail,
        current,
        quadrant,
        chg5d,
      };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<SectorRRGResult | null> => r.status === "fulfilled")
    .map(r => r.value)
    .filter((s): s is SectorRRGResult => s !== null);
}

// ── Route handler ────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
      return NextResponse.json({ ...cache.data, source: "cache" });
    }

    const [krSectors, usSectors] = await Promise.all([
      fetchAllSectors(KR_SECTORS, KR_BENCHMARK.symbol),
      fetchAllSectors(US_SECTORS, US_BENCHMARK.symbol),
    ]);

    const responseData = {
      ok: true,
      kr: krSectors,
      us: usSectors,
      asOf: new Date().toISOString(),
    };

    cache = { data: responseData, cachedAt: Date.now() };
    return NextResponse.json({ ...responseData, source: "live" }, {
      headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=1800" },
    });
  } catch (err) {
    if (cache) return NextResponse.json({ ...cache.data, source: "stale" });
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
