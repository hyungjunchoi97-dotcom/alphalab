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

// ── Yahoo Finance fallback ───────────────────────────────────

const YAHOO_KR_SYMBOLS: { symbol: string; name: string }[] = [
  // KOSPI major
  { symbol: "005930.KS", name: "삼성전자" }, { symbol: "000660.KS", name: "SK하이닉스" },
  { symbol: "373220.KS", name: "LG에너지솔루션" }, { symbol: "207940.KS", name: "삼성바이오로직스" },
  { symbol: "005380.KS", name: "현대차" }, { symbol: "000270.KS", name: "기아" },
  { symbol: "068270.KS", name: "셀트리온" }, { symbol: "035420.KS", name: "NAVER" },
  { symbol: "035720.KS", name: "카카오" }, { symbol: "051910.KS", name: "LG화학" },
  { symbol: "006400.KS", name: "삼성SDI" }, { symbol: "005490.KS", name: "POSCO홀딩스" },
  { symbol: "055550.KS", name: "신한지주" }, { symbol: "105560.KS", name: "KB금융" },
  { symbol: "086790.KS", name: "하나금융지주" }, { symbol: "316140.KS", name: "우리금융지주" },
  { symbol: "012330.KS", name: "현대모비스" }, { symbol: "066570.KS", name: "LG전자" },
  { symbol: "034730.KS", name: "SK" }, { symbol: "096770.KS", name: "SK이노베이션" },
  { symbol: "017670.KS", name: "SK텔레콤" }, { symbol: "030200.KS", name: "KT" },
  { symbol: "018260.KS", name: "삼성SDS" }, { symbol: "009150.KS", name: "삼성전기" },
  { symbol: "028260.KS", name: "삼성물산" }, { symbol: "032830.KS", name: "삼성생명" },
  { symbol: "003550.KS", name: "LG" }, { symbol: "034020.KS", name: "두산에너빌리티" },
  { symbol: "010130.KS", name: "고려아연" }, { symbol: "010140.KS", name: "삼성중공업" },
  { symbol: "042660.KS", name: "한화오션" }, { symbol: "000100.KS", name: "유한양행" },
  { symbol: "003670.KS", name: "포스코퓨처엠" }, { symbol: "259960.KS", name: "크래프톤" },
  { symbol: "352820.KS", name: "하이브" }, { symbol: "011200.KS", name: "HMM" },
  { symbol: "047050.KS", name: "포스코인터내셔널" }, { symbol: "000810.KS", name: "삼성화재" },
  { symbol: "036570.KS", name: "엔씨소프트" }, { symbol: "033780.KS", name: "KT&G" },
  { symbol: "015760.KS", name: "한국전력" }, { symbol: "034220.KS", name: "LG디스플레이" },
  { symbol: "003490.KS", name: "대한항공" }, { symbol: "012450.KS", name: "한화에어로스페이스" },
  { symbol: "009540.KS", name: "한국조선해양" }, { symbol: "329180.KS", name: "HD현대중공업" },
  { symbol: "267250.KS", name: "HD현대" }, { symbol: "010950.KS", name: "S-Oil" },
  { symbol: "011170.KS", name: "롯데케미칼" }, { symbol: "004020.KS", name: "현대제철" },
  { symbol: "000720.KS", name: "현대건설" }, { symbol: "032640.KS", name: "LG유플러스" },
  { symbol: "006800.KS", name: "미래에셋증권" }, { symbol: "138040.KS", name: "메리츠금융지주" },
  { symbol: "036460.KS", name: "한국가스공사" }, { symbol: "011790.KS", name: "SKC" },
  { symbol: "402340.KS", name: "SK스퀘어" }, { symbol: "326030.KS", name: "SK바이오팜" },
  { symbol: "090430.KS", name: "아모레퍼시픽" }, { symbol: "051900.KS", name: "LG생활건강" },
  // KOSDAQ major
  { symbol: "247540.KQ", name: "에코프로비엠" }, { symbol: "086520.KQ", name: "에코프로" },
  { symbol: "042700.KQ", name: "한미반도체" }, { symbol: "403870.KQ", name: "HPSP" },
  { symbol: "196170.KQ", name: "알테오젠" }, { symbol: "058470.KQ", name: "리노공업" },
  { symbol: "263750.KQ", name: "펄어비스" }, { symbol: "293490.KQ", name: "카카오게임즈" },
  { symbol: "145020.KQ", name: "휴젤" }, { symbol: "112040.KQ", name: "위메이드" },
  { symbol: "357780.KQ", name: "솔브레인" }, { symbol: "039030.KQ", name: "이오테크닉스" },
  { symbol: "041510.KQ", name: "에스엠" }, { symbol: "035900.KQ", name: "JYP Ent." },
  { symbol: "036930.KQ", name: "주성엔지니어링" }, { symbol: "009520.KQ", name: "포스코엠텍" },
  { symbol: "067310.KQ", name: "하나마이크론" }, { symbol: "095340.KQ", name: "ISC" },
  { symbol: "383220.KQ", name: "F&F" }, { symbol: "377300.KQ", name: "카카오페이" },
  { symbol: "240810.KQ", name: "원익IPS" }, { symbol: "137310.KQ", name: "에스디바이오센서" },
  { symbol: "028300.KQ", name: "HLB" }, { symbol: "323410.KQ", name: "카카오뱅크" },
  { symbol: "068760.KQ", name: "셀트리온제약" }, { symbol: "095700.KQ", name: "제넥신" },
  { symbol: "298380.KQ", name: "에이비엘바이오" }, { symbol: "389030.KQ", name: "지누스" },
  { symbol: "078600.KQ", name: "대주전자재료" }, { symbol: "299030.KQ", name: "하나기술" },
];

async function fetchYahooQuote(symbol: string, name: string): Promise<MoverItem | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`;
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0" } }, 6000);
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose;
    if (!price || price === 0 || !prevClose) return null;
    const changeRate = Math.round(((price - prevClose) / prevClose) * 10000) / 100;
    const quote = result.indicators?.quote?.[0];
    const volume = quote?.volume?.[0] || 0;
    const code = symbol.replace(/\.(KS|KQ)$/, "");
    return {
      code,
      name,
      price: Math.round(price),
      changeRate,
      volume,
      tradingValue: Math.round(price * volume),
    };
  } catch {
    return null;
  }
}

async function fetchFromYahoo(): Promise<{
  topValue: MoverItem[];
  topGainers: MoverItem[];
  topLosers: MoverItem[];
  totalGainers: number;
  totalLosers: number;
  asOf: string;
}> {
  // Fetch all in parallel (v8/finance/chart is reliable)
  const results = await Promise.allSettled(
    YAHOO_KR_SYMBOLS.map(s => fetchYahooQuote(s.symbol, s.name))
  );

  const allItems: MoverItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) allItems.push(r.value);
  }

  if (allItems.length === 0) throw new Error("Yahoo Finance returned no KR quotes");

  const gainers = allItems.filter(m => m.changeRate > 0);
  const losers = allItems.filter(m => m.changeRate < 0);

  const topGainers = [...gainers].sort((a, b) => b.changeRate - a.changeRate);
  const topLosers = [...losers].sort((a, b) => a.changeRate - b.changeRate);
  const topValue = [...allItems].sort((a, b) => b.tradingValue - a.tradingValue).slice(0, 10);

  return {
    topValue,
    topGainers,
    topLosers,
    totalGainers: gainers.length,
    totalLosers: losers.length,
    asOf: getBusinessDate(),
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
        source: cached.fetchedAtISO ? "cache" : "cache",
        asOf: cached.asOf,
        fetchedAtISO: cached.fetchedAtISO,
      });
    }

    // Try KRX first, then Yahoo Finance fallback
    let result: { topValue: MoverItem[]; topGainers: MoverItem[]; topLosers: MoverItem[]; totalGainers: number; totalLosers: number; asOf: string; message?: string };
    let source = "krx";

    const resolved = resolveKrxKey();
    if (resolved) {
      try {
        result = await fetchFromKrx();
      } catch (krxErr) {
        console.log(`[KRX] Failed: ${krxErr instanceof Error ? krxErr.message : krxErr}, trying Yahoo Finance fallback`);
        result = await fetchFromYahoo();
        source = "yahoo";
      }
    } else {
      result = await fetchFromYahoo();
      source = "yahoo";
    }

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
      ...cached.data,
      source,
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

    return NextResponse.json(
      { ok: false, topGainers: [], topLosers: [], topValue: [], totalGainers: 0, totalLosers: 0, source: "error", asOf: asOfDefault, fetchedAtISO: now, message },
      { status: 500 }
    );
  }
}
