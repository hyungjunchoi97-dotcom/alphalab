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

// ── KST market-hours-aware cache ────────────────────────────

interface CacheEntry {
  data: { topValue: MoverItem[]; topGainers: MoverItem[]; topLosers: MoverItem[]; totalGainers: number; totalLosers: number };
  cachedAt: number;
  asOf: string;
  fetchedAtISO: string;
}

let cached: CacheEntry | null = null;

function getKstNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

function isKstMarketOpen(): boolean {
  const kst = getKstNow();
  const day = kst.getDay();
  if (day === 0 || day === 6) return false; // weekend
  const h = kst.getHours();
  const m = kst.getMinutes();
  const mins = h * 60 + m;
  return mins >= 540 && mins <= 930; // 09:00 ~ 15:30
}

function getCacheTTL(): number {
  if (isKstMarketOpen()) return 5 * 60 * 1000; // 5 minutes during market hours
  // After close: cache until next 09:00 KST
  const kst = getKstNow();
  const next9am = new Date(kst);
  next9am.setHours(9, 0, 0, 0);
  if (kst.getHours() >= 9) next9am.setDate(next9am.getDate() + 1);
  // Skip weekends
  const day = next9am.getDay();
  if (day === 0) next9am.setDate(next9am.getDate() + 1);
  else if (day === 6) next9am.setDate(next9am.getDate() + 2);
  return Math.max(next9am.getTime() - kst.getTime(), 60 * 60 * 1000); // at least 1 hour
}

export function getCacheState(): "empty" | "fresh" | "stale" {
  if (!cached) return "empty";
  return Date.now() - cached.cachedAt < getCacheTTL() ? "fresh" : "stale";
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
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay();
  const hour = kst.getUTCHours();

  // Weekend → previous Friday
  if (day === 0) kst.setUTCDate(kst.getUTCDate() - 2);
  else if (day === 6) kst.setUTCDate(kst.getUTCDate() - 1);
  // Weekday before 9 AM KST → previous business day (market not open yet)
  else if (hour < 9) kst.setUTCDate(kst.getUTCDate() - 1);
  // Weekday 9 AM+ KST → use today (market open or already closed)

  // Ensure adjusted date is not weekend
  const adjusted = kst.getUTCDay();
  if (adjusted === 0) kst.setUTCDate(kst.getUTCDate() - 2);
  else if (adjusted === 6) kst.setUTCDate(kst.getUTCDate() - 1);

  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

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

// No filtering of extreme % changes — include 상한가(+30%) and 하한가(-30%)
function processRows(rows: KrxStockRow[]): {
  topValue: MoverItem[];
  topGainers: MoverItem[];
  topLosers: MoverItem[];
  totalGainers: number;
  totalLosers: number;
} {
  const valid = rows.filter(
    (r) =>
      parseKrxNumber(r.TDD_CLSPRC) > 0 && parseKrxNumber(r.ACC_TRDVOL) > 0
  );

  const byValue = [...valid]
    .sort((a, b) => parseKrxNumber(b.ACC_TRDVAL) - parseKrxNumber(a.ACC_TRDVAL))
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

// ── Fetch single market from KRX (try both endpoints) ───────

async function fetchMarketDataDbg(
  apiKey: string,
  endpoint: string,
  basDd: string
): Promise<KrxStockRow[] | null> {
  const url = `https://data-dbg.krx.co.kr/svc/apis/sto/${endpoint}?basDd=${basDd}`;
  const res = await fetchWithTimeout(url, {
    method: "GET",
    headers: {
      AUTH_KEY: apiKey,
      Accept: "application/json",
      "User-Agent": "alphalab/1.0",
    },
  }, 10000);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`KRX-DBG ${endpoint} returned ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  const rows: KrxStockRow[] = json.OutBlock_1;
  if (!rows || !Array.isArray(rows) || rows.length === 0) return null;
  return rows;
}

async function fetchMarketOpenApi(
  apiKey: string,
  endpoint: string,
  basDd: string
): Promise<KrxStockRow[] | null> {
  const url = `https://openapi.krx.co.kr/contents/OPP/APIS/sto/${endpoint}`;
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
  }, 10000);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`KRX-OPP ${endpoint} returned ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  const rows: KrxStockRow[] = json.OutBlock_1;
  if (!rows || !Array.isArray(rows) || rows.length === 0) return null;
  return rows;
}

// Try data-dbg first, then openapi fallback
async function fetchMarket(
  apiKey: string,
  endpoint: string,
  basDd: string
): Promise<KrxStockRow[] | null> {
  try {
    const rows = await fetchMarketDataDbg(apiKey, endpoint, basDd);
    if (rows && rows.length > 0) return rows;
  } catch (e) {
  }

  try {
    const rows = await fetchMarketOpenApi(apiKey, endpoint, basDd);
    if (rows && rows.length > 0) return rows;
  } catch (e) {
  }

  return null;
}

// ── Fetch from KRX (KOSPI + KOSDAQ, with holiday retry) ──

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
    throw new Error(`KRX API key missing — checked: ${KRX_ENV_NAMES.join(", ")}`);
  }
  const apiKey = resolved.key;

  const startDate = getBusinessDate();
  let lastError = "";

  for (let attempt = 0; attempt < 5; attempt++) {
    const basDd = attempt === 0 ? startDate : subtractDays(startDate, attempt);

    const [kospiRows, kosdaqRows] = await Promise.all([
      fetchMarket(apiKey, "stk_bydd_trd", basDd).catch(() => null),
      fetchMarket(apiKey, "ksq_bydd_trd", basDd).catch(() => null),
    ]);

    const allRows = [...(kospiRows || []), ...(kosdaqRows || [])];

    if (allRows.length === 0) {
      lastError = `KRX empty data for ${basDd}`;
      continue;
    }

    const data = processRows(allRows);

    return {
      ...data,
      asOf: basDd,
      message:
        attempt > 0
          ? `KRX empty on first date; used ${basDd} (tried ${attempt + 1} dates)`
          : undefined,
    };
  }

  throw new Error(lastError || "No data from KRX API after 5 date retries");
}

// ── Yahoo Finance fallback ───────────────────────────────────

const YAHOO_KR_SYMBOLS: { symbol: string; name: string }[] = [
  // ── KOSPI (120+) ──────────────────────────────────────────
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
  { symbol: "009830.KS", name: "한화솔루션" }, { symbol: "161390.KS", name: "한국타이어앤테크놀로지" },
  { symbol: "006260.KS", name: "LS" }, { symbol: "271560.KS", name: "오리온" },
  { symbol: "078930.KS", name: "GS" }, { symbol: "021240.KS", name: "코웨이" },
  { symbol: "302440.KS", name: "SK바이오사이언스" }, { symbol: "180640.KS", name: "한진칼" },
  { symbol: "097950.KS", name: "CJ제일제당" }, { symbol: "005830.KS", name: "DB손해보험" },
  { symbol: "000880.KS", name: "한화" }, { symbol: "003410.KS", name: "쌍용C&E" },
  { symbol: "004990.KS", name: "롯데지주" }, { symbol: "139480.KS", name: "이마트" },
  { symbol: "030000.KS", name: "제일기획" }, { symbol: "069500.KS", name: "KODEX 200" },
  { symbol: "016360.KS", name: "삼성증권" }, { symbol: "002790.KS", name: "아모레G" },
  { symbol: "035250.KS", name: "강원랜드" }, { symbol: "088350.KS", name: "한화생명" },
  { symbol: "001570.KS", name: "금양" }, { symbol: "010620.KS", name: "현대미포조선" },
  { symbol: "006360.KS", name: "GS건설" }, { symbol: "001040.KS", name: "CJ" },
  { symbol: "004170.KS", name: "신세계" }, { symbol: "241560.KS", name: "두산밥캣" },
  { symbol: "005940.KS", name: "NH투자증권" }, { symbol: "071050.KS", name: "한국금융지주" },
  { symbol: "008770.KS", name: "호텔신라" }, { symbol: "039490.KS", name: "키움증권" },
  { symbol: "000150.KS", name: "두산" }, { symbol: "003240.KS", name: "태광산업" },
  { symbol: "002380.KS", name: "KCC" }, { symbol: "011070.KS", name: "LG이노텍" },
  { symbol: "016800.KS", name: "퍼시스" }, { symbol: "001450.KS", name: "현대해상" },
  { symbol: "000990.KS", name: "DB하이텍" }, { symbol: "024110.KS", name: "기업은행" },
  { symbol: "051600.KS", name: "한전KPS" }, { symbol: "007070.KS", name: "GS리테일" },
  { symbol: "005387.KS", name: "현대차2우B" }, { symbol: "008930.KS", name: "한미사이언스" },
  { symbol: "002270.KS", name: "롯데제과" }, { symbol: "009240.KS", name: "한샘" },
  { symbol: "028050.KS", name: "삼성엔지니어링" }, { symbol: "064350.KS", name: "현대로템" },
  { symbol: "361610.KS", name: "SK아이이테크놀로지" }, { symbol: "006110.KS", name: "삼아알미늄" },
  { symbol: "047810.KS", name: "한국항공우주" }, { symbol: "272210.KS", name: "한화시스템" },
  { symbol: "082740.KS", name: "HSD엔진" }, { symbol: "011780.KS", name: "금호석유" },
  { symbol: "005850.KS", name: "에스엘" }, { symbol: "003620.KS", name: "쌍용차" },
  { symbol: "004800.KS", name: "효성" }, { symbol: "007310.KS", name: "오뚜기" },
  { symbol: "026960.KS", name: "동서" }, { symbol: "003030.KS", name: "세아제강" },
  { symbol: "000120.KS", name: "CJ대한통운" }, { symbol: "192820.KS", name: "코스맥스" },
  { symbol: "018880.KS", name: "한온시스템" }, { symbol: "005180.KS", name: "빙그레" },
  // ── KOSDAQ (80+) ──────────────────────────────────────────
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
  { symbol: "005290.KQ", name: "동진쎄미켐" }, { symbol: "060310.KQ", name: "3S" },
  { symbol: "214150.KQ", name: "클래시스" }, { symbol: "140860.KQ", name: "파크시스템스" },
  { symbol: "222080.KQ", name: "씨아이에스" }, { symbol: "031310.KQ", name: "아이즈비전" },
  { symbol: "064760.KQ", name: "티씨케이" }, { symbol: "038460.KQ", name: "바이오스마트" },
  { symbol: "950160.KQ", name: "코오롱티슈진" }, { symbol: "340570.KQ", name: "티앤엘" },
  { symbol: "217190.KQ", name: "제너셈" }, { symbol: "108320.KQ", name: "LX세미콘" },
  { symbol: "131970.KQ", name: "테스나" }, { symbol: "053800.KQ", name: "안랩" },
  { symbol: "078340.KQ", name: "컴투스" }, { symbol: "251270.KQ", name: "넷마블" },
  { symbol: "352480.KQ", name: "씨이랩" }, { symbol: "033640.KQ", name: "네패스" },
  { symbol: "256840.KQ", name: "한국비엔씨" }, { symbol: "141080.KQ", name: "리가켐바이오" },
  { symbol: "060280.KQ", name: "큐렉소" }, { symbol: "950210.KQ", name: "프레스티지바이오파마" },
  { symbol: "226330.KQ", name: "신테카바이오" }, { symbol: "046890.KQ", name: "서울반도체" },
  { symbol: "200710.KQ", name: "에이디테크놀로지" }, { symbol: "237690.KQ", name: "에스티팜" },
  { symbol: "317870.KQ", name: "엔바이오니아" }, { symbol: "039200.KQ", name: "오스코텍" },
  { symbol: "086900.KQ", name: "메디톡스" }, { symbol: "330860.KQ", name: "네이처셀" },
  { symbol: "091990.KQ", name: "셀트리온헬스케어" }, { symbol: "347890.KQ", name: "엠투아이" },
  { symbol: "194480.KQ", name: "데브시스터즈" }, { symbol: "043150.KQ", name: "바텍" },
  { symbol: "065680.KQ", name: "우주일렉트로" }, { symbol: "223250.KQ", name: "드림씨아이에스" },
  { symbol: "048260.KQ", name: "오스템임플란트" }, { symbol: "099190.KQ", name: "아이센스" },
  { symbol: "090460.KQ", name: "비에이치" }, { symbol: "066970.KQ", name: "엘앤에프" },
  { symbol: "178920.KQ", name: "PI첨단소재" }, { symbol: "122870.KQ", name: "와이지엔터테인먼트" },
  { symbol: "032500.KQ", name: "케이엠더블유" }, { symbol: "036540.KQ", name: "SFA반도체" },
  { symbol: "241710.KQ", name: "코스메카코리아" }, { symbol: "253450.KQ", name: "스튜디오드래곤" },
  { symbol: "182360.KQ", name: "큐브엔터" }, { symbol: "348210.KQ", name: "넥스틴" },
  { symbol: "091590.KQ", name: "남화토건" }, { symbol: "083310.KQ", name: "엘오티베큠" },
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
    return { code, name, price: Math.round(price), changeRate, volume, tradingValue: Math.round(price * volume) };
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
  const marketOpen = isKstMarketOpen();
  const cacheTTL = getCacheTTL();
  console.log("[KRX movers] businessDate:", asOfDefault, "now:", now, "marketOpen:", marketOpen, "cacheTTL:", Math.round(cacheTTL / 60000), "min");

  try {
    if (cached && Date.now() - cached.cachedAt < cacheTTL) {
      return NextResponse.json({
        ok: true,
        ...cached.data,
        source: "cache",
        asOf: cached.asOf,
        fetchedAtISO: cached.fetchedAtISO,
        isMarketOpen: marketOpen,
      });
    }

    let result: { topValue: MoverItem[]; topGainers: MoverItem[]; topLosers: MoverItem[]; totalGainers: number; totalLosers: number; asOf: string; message?: string };
    let source = "krx";

    const resolved = resolveKrxKey();
    if (resolved) {
      try {
        result = await fetchFromKrx();
      } catch {
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
    const cacheSeconds = marketOpen ? 120 : 1800;
    return NextResponse.json({
      ok: true,
      ...cached.data,
      source,
      asOf: result.asOf,
      fetchedAtISO,
      message: result.message,
      isMarketOpen: marketOpen,
    }, {
      headers: { "Cache-Control": `s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}` },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (cached) {
      return NextResponse.json({
        ok: true,
        ...cached.data,
        source: "stale-cache",
        asOf: cached.asOf,
        fetchedAtISO: now,
        message,
        isMarketOpen: marketOpen,
      });
    }

    return NextResponse.json(
      { ok: false, topGainers: [], topLosers: [], topValue: [], totalGainers: 0, totalLosers: 0, source: "error", asOf: asOfDefault, fetchedAtISO: now, message, isMarketOpen: marketOpen },
      { status: 500 }
    );
  }
}
