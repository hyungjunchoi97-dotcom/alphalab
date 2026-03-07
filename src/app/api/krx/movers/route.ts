import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

export const runtime = "nodejs";

// ── Types ─────────────────────────────────────────────────────

interface KrxStockRow {
  BAS_DD: string;
  ISU_CD: string;
  ISU_NM: string;
  MKT_NM: string;
  SECT_TP_NM: string;
  TDD_CLSPRC: string;
  CMPPREVDD_PRC: string;
  FLUC_RT: string;
  TDD_OPNPRC: string;
  TDD_HGPRC: string;
  TDD_LWPRC: string;
  ACC_TRDVOL: string;
  ACC_TRDVAL: string;
  MKTCAP: string;
  LIST_SHRS: string;
}

interface MoverItem {
  code: string;
  name: string;
  price: number;
  changeRate: number;
  volume: number;
  tradingValue: number;
}

// ── In-memory cache (TTL = 10 min) ──────────────────────────

interface CacheEntry {
  data: { topValue: MoverItem[]; topGainers: MoverItem[]; topLosers: MoverItem[]; totalGainers: number; totalLosers: number };
  cachedAt: number;
  asOf: string;
  fetchedAtISO: string;
}

const CACHE_TTL = 5 * 60 * 1000;
let cached: CacheEntry | null = null;

// Exported for health endpoint
export function getCacheState(): "empty" | "fresh" | "stale" {
  if (!cached) return "empty";
  return Date.now() - cached.cachedAt < CACHE_TTL ? "fresh" : "stale";
}

export function getLastFetchAt(): string | undefined {
  return cached?.fetchedAtISO;
}

// ── KRX key resolution ──────────────────────────────────────

const KRX_ENV_NAMES = ["KRX_API_KEY", "KRX_AUTH_KEY", "AUTH_KEY", "KRX_KEY"] as const;

export function resolveKrxKey(): { key: string; envName: string } | null {
  for (const name of KRX_ENV_NAMES) {
    const val = process.env[name];
    if (val) return { key: val, envName: name };
  }
  return null;
}

// ── Helpers ──────────────────────────────────────────────────

function parseKrxNumber(s: string): number {
  return Number(s.replace(/,/g, "")) || 0;
}

export function getBusinessDate(): string {
  const now = new Date();
  // KST = UTC + 9
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay();
  const hour = kst.getUTCHours();

  // Before market close (~16:00 KST), use previous business day
  // Weekend: Sat=6, Sun=0
  if (day === 0) kst.setUTCDate(kst.getUTCDate() - 2); // Sun → Fri
  else if (day === 6) kst.setUTCDate(kst.getUTCDate() - 1); // Sat → Fri
  else if (hour < 16) kst.setUTCDate(kst.getUTCDate() - 1); // Before close → prev day

  // Check again for weekend (if prev day is Sun)
  const adjusted = kst.getUTCDay();
  if (adjusted === 0) kst.setUTCDate(kst.getUTCDate() - 2);
  else if (adjusted === 6) kst.setUTCDate(kst.getUTCDate() - 1);

  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** Subtract N calendar days from a YYYYMMDD string */
function subtractDays(yyyymmdd: string, n: number): string {
  const y = parseInt(yyyymmdd.slice(0, 4));
  const m = parseInt(yyyymmdd.slice(4, 6)) - 1;
  const d = parseInt(yyyymmdd.slice(6, 8));
  const dt = new Date(Date.UTC(y, m, d));
  dt.setUTCDate(dt.getUTCDate() - n);
  const ry = dt.getUTCFullYear();
  const rm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const rd = String(dt.getUTCDate()).padStart(2, "0");
  return `${ry}${rm}${rd}`;
}

function toMoverItem(row: KrxStockRow): MoverItem {
  return {
    code: row.ISU_CD,
    name: row.ISU_NM,
    price: parseKrxNumber(row.TDD_CLSPRC),
    changeRate: parseFloat(row.FLUC_RT) || 0,
    volume: parseKrxNumber(row.ACC_TRDVOL),
    tradingValue: parseKrxNumber(row.ACC_TRDVAL),
  };
}

function processRows(rows: KrxStockRow[]): {
  topValue: MoverItem[];
  topGainers: MoverItem[];
  topLosers: MoverItem[];
  totalGainers: number;
  totalLosers: number;
} {
  const valid = rows.filter(
    (r) =>
      parseKrxNumber(r.TDD_CLSPRC) > 0 && parseKrxNumber(r.ACC_TRDVAL) > 0
  );

  const byValue = [...valid]
    .sort(
      (a, b) =>
        parseKrxNumber(b.ACC_TRDVAL) - parseKrxNumber(a.ACC_TRDVAL)
    )
    .slice(0, 10)
    .map(toMoverItem);

  const gainers = valid.filter((r) => parseFloat(r.FLUC_RT) > 0);
  const losers = valid.filter((r) => parseFloat(r.FLUC_RT) < 0);

  const byGain = [...gainers]
    .sort((a, b) => parseFloat(b.FLUC_RT) - parseFloat(a.FLUC_RT))
    .map(toMoverItem);

  const byLoss = [...losers]
    .sort((a, b) => parseFloat(a.FLUC_RT) - parseFloat(b.FLUC_RT))
    .map(toMoverItem);

  return { topValue: byValue, topGainers: byGain, topLosers: byLoss, totalGainers: gainers.length, totalLosers: losers.length };
}

// ── Fetch single market from KRX ─────────────────────────────

async function fetchMarket(
  apiKey: string,
  endpoint: string,
  basDd: string
): Promise<KrxStockRow[] | null> {
  const url = `https://openapi.krx.co.kr/contents/OPP/APIS/sto/${endpoint}`;

  console.log(`[KRX] POST ${url} basDd=${basDd}`);
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      auth_key: apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "alphalab/1.0",
    },
    body: JSON.stringify({ basDd }),
    redirect: "follow",
  });
  console.log(`[KRX] Response ${endpoint} status=${res.status}`);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const hint = body.length > 200 ? body.slice(0, 200) + "…" : body;
    throw new Error(`KRX ${endpoint} returned ${res.status}: ${hint}`);
  }

  const json = await res.json();
  const rows: KrxStockRow[] = json.OutBlock_1;
  if (!rows || !Array.isArray(rows) || rows.length === 0) return null;
  return rows;
}

// ── Fetch from KRX Open API (KOSPI + KOSDAQ, with holiday retry) ──

async function fetchFromKrx(): Promise<{
  topValue: MoverItem[];
  topGainers: MoverItem[];
  topLosers: MoverItem[];
  totalGainers: number;
  totalLosers: number;
  asOf: string;
  message?: string;
}> {
  const resolved = resolveKrxKey();
  if (!resolved) {
    throw new Error(
      `KRX API key missing — checked: ${KRX_ENV_NAMES.join(", ")}`
    );
  }
  const apiKey = resolved.key;

  const startDate = getBusinessDate();
  let lastError = "";

  // Retry up to 5 previous days to handle holidays
  for (let attempt = 0; attempt < 5; attempt++) {
    const basDd = attempt === 0 ? startDate : subtractDays(startDate, attempt);

    // Fetch KOSPI (stk_bydd_trd) and KOSDAQ (ksq_bydd_trd) in parallel
    const [kospiRows, kosdaqRows] = await Promise.all([
      fetchMarket(apiKey, "stk_bydd_trd", basDd).catch(() => null),
      fetchMarket(apiKey, "ksq_bydd_trd", basDd).catch(() => null),
    ]);

    const allRows = [...(kospiRows || []), ...(kosdaqRows || [])];

    if (allRows.length === 0) {
      lastError = `KRX empty data for ${basDd}`;
      continue; // try previous day
    }

    const data = processRows(allRows);

    return {
      ...data,
      asOf: basDd,
      message:
        attempt > 0
          ? `KRX empty data; fallback to ${basDd} (tried ${attempt + 1} dates)`
          : undefined,
    };
  }

  throw new Error(lastError || "No data from KRX API after 5 date retries");
}

// ── Mock fallback ───────────────────────────────────────────

function mockData(): { topValue: MoverItem[]; topGainers: MoverItem[]; topLosers: MoverItem[]; totalGainers: number; totalLosers: number } {
  return {
    topValue: [
      { code: "005930", name: "삼성전자", price: 72400, changeRate: 1.2, volume: 15234567, tradingValue: 1103938000000 },
      { code: "000660", name: "SK하이닉스", price: 198500, changeRate: -0.8, volume: 4512300, tradingValue: 895700000000 },
      { code: "373220", name: "LG에너지솔루션", price: 380000, changeRate: 2.1, volume: 1723400, tradingValue: 654890000000 },
      { code: "035420", name: "NAVER", price: 215000, changeRate: -1.5, volume: 2134500, tradingValue: 458900000000 },
      { code: "051910", name: "LG화학", price: 345000, changeRate: 0.3, volume: 1102300, tradingValue: 380290000000 },
    ],
    topGainers: [
      { code: "247540", name: "에코프로비엠", price: 152300, changeRate: 8.5, volume: 3456700, tradingValue: 526400000000 },
      { code: "086520", name: "에코프로", price: 89400, changeRate: 6.2, volume: 5678900, tradingValue: 507600000000 },
      { code: "042700", name: "한미반도체", price: 28600, changeRate: 5.8, volume: 8901200, tradingValue: 254700000000 },
      { code: "403870", name: "HPSP", price: 45100, changeRate: 4.9, volume: 2345600, tradingValue: 105800000000 },
      { code: "012450", name: "한화에어로스페이스", price: 186500, changeRate: 4.3, volume: 1890400, tradingValue: 352700000000 },
    ],
    topLosers: [
      { code: "035420", name: "NAVER", price: 215000, changeRate: -3.5, volume: 2134500, tradingValue: 458900000000 },
      { code: "000660", name: "SK하이닉스", price: 198500, changeRate: -2.8, volume: 4512300, tradingValue: 895700000000 },
      { code: "006400", name: "삼성SDI", price: 312000, changeRate: -2.1, volume: 890200, tradingValue: 278500000000 },
      { code: "068270", name: "셀트리온", price: 178000, changeRate: -1.7, volume: 1234500, tradingValue: 219800000000 },
      { code: "051910", name: "LG화학", price: 345000, changeRate: -1.3, volume: 1102300, tradingValue: 380290000000 },
    ],
    totalGainers: 520,
    totalLosers: 430,
  };
}

// ── Route handler ───────────────────────────────────────────

export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req);
  if (limited) return limited;

  const now = new Date().toISOString();
  const asOfDefault = getBusinessDate();
  const host = req.headers.get("host") ?? "(unknown)";

  try {
    // Return cache if fresh
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      return NextResponse.json({
        ok: true,
        ...cached.data,
        source: "live",
        asOf: cached.asOf,
        fetchedAtISO: cached.fetchedAtISO,
      });
    }

    const resolved = resolveKrxKey();
    if (!resolved) {
      const data = mockData();
      return NextResponse.json({
        ok: true,
        ...data,
        source: "mock",
        asOf: asOfDefault,
        fetchedAtISO: now,
        message: `KRX API key missing — checked: ${KRX_ENV_NAMES.join(", ")} (host: ${host})`,
      });
    }

    const result = await fetchFromKrx();
    const fetchedAtISO = new Date().toISOString();
    cached = {
      data: {
        topValue: result.topValue,
        topGainers: result.topGainers,
        topLosers: result.topLosers,
        totalGainers: result.totalGainers,
        totalLosers: result.totalLosers,
      },
      cachedAt: Date.now(),
      asOf: result.asOf,
      fetchedAtISO,
    };
    return NextResponse.json({
      ok: true,
      topValue: result.topValue,
      topGainers: result.topGainers,
      topLosers: result.topLosers,
      totalGainers: result.totalGainers,
      totalLosers: result.totalLosers,
      source: "live",
      asOf: result.asOf,
      fetchedAtISO,
      message: result.message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    // Serve stale cache if available
    if (cached) {
      return NextResponse.json({
        ok: true,
        ...cached.data,
        source: "stale-cache",
        asOf: cached.asOf,
        fetchedAtISO: now,
        message,
      });
    }

    // Fall back to mock data
    const data = mockData();
    return NextResponse.json({
      ok: false,
      ...data,
      source: "mock",
      asOf: asOfDefault,
      fetchedAtISO: now,
      message,
    });
  }
}
