import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { XMLParser } from "fast-xml-parser";

interface MemCache {
  data: object;
  cachedAt: number;
}
const memCacheMap = new Map<string, MemCache>();
const MEM_TTL_MS = 30 * 60 * 1000; // 30분

export const runtime = "nodejs";
export const maxDuration = 60;

const MOLIT_KEY = process.env.MOLIT_API_KEY ?? "";

const ENDPOINT_DEV = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";
const ENDPOINT_STD = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";

// 자동 탐색 후보 월 (현재 기준 최근 6개월 동적 생성, 신고 지연 고려)
function getCandidateMonths(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}
const CANDIDATE_MONTHS = getCandidateMonths();

const SEOUL_DISTRICTS: { code: string; name: string }[] = [
  { code: "11110", name: "종로구" },
  { code: "11140", name: "중구" },
  { code: "11170", name: "용산구" },
  { code: "11200", name: "성동구" },
  { code: "11215", name: "광진구" },
  { code: "11230", name: "동대문구" },
  { code: "11260", name: "중랑구" },
  { code: "11290", name: "성북구" },
  { code: "11305", name: "강북구" },
  { code: "11320", name: "도봉구" },
  { code: "11350", name: "노원구" },
  { code: "11380", name: "은평구" },
  { code: "11410", name: "서대문구" },
  { code: "11440", name: "마포구" },
  { code: "11470", name: "양천구" },
  { code: "11500", name: "강서구" },
  { code: "11530", name: "구로구" },
  { code: "11545", name: "금천구" },
  { code: "11560", name: "영등포구" },
  { code: "11590", name: "동작구" },
  { code: "11620", name: "관악구" },
  { code: "11650", name: "서초구" },
  { code: "11680", name: "강남구" },
  { code: "11710", name: "송파구" },
  { code: "11740", name: "강동구" },
];

export interface Trade {
  date: string;
  district: string;
  dong: string;
  aptName: string;
  area: number;
  floor: number;
  price: number;        // 만원
  priceInBillion: number; // 억원 (소수점 1자리)
}

export interface DistrictStats {
  code: string;
  name: string;
  avgPrice: number;        // 만원
  avgPriceInBillion: number; // 억원 (소수점 1자리)
  count: number;
  change: number | null;
}

// ── Helpers ───────────────────────────────────────────────────

function parsePrice(raw: unknown): number {
  return parseInt(String(raw ?? "").replace(/,/g, "").trim(), 10) || 0;
}

function parseArea(raw: unknown): number {
  return parseFloat(String(raw ?? "")) || 0;
}

const xmlParser = new XMLParser({ ignoreAttributes: false, parseAttributeValue: true, parseTagValue: true });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractItems(parsed: any): any[] {
  const items = parsed?.response?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detectApiError(parsed: any): string | null {
  // OpenAPI 공통 에러 포맷
  const code1 = parsed?.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnReasonCode;
  if (code1) {
    const msg = parsed?.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnAuthMsg ?? "";
    return `errCode=${code1} authMsg=${msg}`;
  }
  // response.header 에러
  const code2 = parsed?.response?.header?.resultCode;
  if (code2 && String(code2) !== "00") {
    return `resultCode=${code2} msg=${parsed?.response?.header?.resultMsg ?? ""}`;
  }
  return null;
}

// ── Core fetch: 4가지 방법 순차 시도 ─────────────────────────

interface RawResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  httpStatus: number;
  contentType: string;
  rawPreview: string;
  endpoint: string;
  error: string | null;
}

async function fetchDistrictRaw(code: string, dealYmd: string): Promise<RawResult> {
  // 방법 A: URLSearchParams (자동 인코딩)
  const makeA = (ep: string) => {
    const p = new URLSearchParams({ serviceKey: MOLIT_KEY, LAWD_CD: code, DEAL_YMD: dealYmd, numOfRows: "1000", pageNo: "1" });
    return `${ep}?${p.toString()}`;
  };
  // 방법 B: 직접 문자열 연결 (디코딩된 키 그대로)
  const makeB = (ep: string) =>
    `${ep}?serviceKey=${MOLIT_KEY}&LAWD_CD=${code}&DEAL_YMD=${dealYmd}&numOfRows=1000&pageNo=1`;

  const attempts = [
    { url: makeA(ENDPOINT_DEV), label: "DEV+URLParams" },
    { url: makeB(ENDPOINT_DEV), label: "DEV+concat" },
    { url: makeA(ENDPOINT_STD), label: "STD+URLParams" },
    { url: makeB(ENDPOINT_STD), label: "STD+concat" },
  ];

  let last: RawResult = { items: [], httpStatus: 0, contentType: "", rawPreview: "", endpoint: "", error: "no attempt ran" };

  for (const { url, label } of attempts) {
    const safeUrl = url.replace(MOLIT_KEY, "HIDDEN");
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { Accept: "application/xml, text/xml, */*" },
      });
      const rawText = await res.text();
      const rawPreview = rawText.slice(0, 1000);
      const contentType = res.headers.get("content-type") ?? "";

      console.log(`[부동산API] ${label} ${code} ${dealYmd} → HTTP ${res.status} | ${safeUrl}`);
      console.log(`[부동산API] preview: ${rawPreview.slice(0, 200)}`);

      const parsed = xmlParser.parse(rawText);
      const apiErr = detectApiError(parsed);

      if (apiErr) {
        console.error(`[부동산API] API 에러 (${label}): ${apiErr}`);
        last = { items: [], httpStatus: res.status, contentType, rawPreview, endpoint: label, error: apiErr };
        continue;
      }

      const items = extractItems(parsed);
      console.log(`[부동산API] items: ${items.length}개 (${label})`);

      // 200 + 에러 없음 → 성공 (items 0개여도 해당 월 거래 없음으로 처리)
      if (res.status === 200) {
        return { items, httpStatus: res.status, contentType, rawPreview, endpoint: label, error: null };
      }

      last = { items, httpStatus: res.status, contentType, rawPreview, endpoint: label, error: `HTTP ${res.status}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[부동산API] 예외 (${label}) ${code} ${dealYmd}: ${msg}`);
      last = { items: [], httpStatus: 0, contentType: "", rawPreview: "", endpoint: label, error: msg };
    }
  }

  return last;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchDistrict(code: string, dealYmd: string): Promise<any[]> {
  return (await fetchDistrictRaw(code, dealYmd)).items;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tradeFromItem(item: any, district: { code: string; name: string }, monthLabel: string): Trade | null {
  const price = parsePrice(item.dealAmount);
  if (price <= 0) return null;
  const yr = String(item.dealYear ?? "").trim() || monthLabel.slice(0, 4);
  const mo = String(item.dealMonth ?? "").trim().padStart(2, "0") || monthLabel.slice(4, 6);
  const dy = String(item.dealDay ?? "").trim().padStart(2, "0") || "01";
  return {
    date: `${yr}-${mo}-${dy}`,
    district: district.name,
    dong: String(item.umdNm ?? "").trim(),
    aptName: String(item.aptNm ?? "").trim(),
    area: parseArea(item.excluUseAr),
    floor: parseInt(String(item.floor ?? "0").trim(), 10) || 0,
    price,
    priceInBillion: Math.round(price / 1000) / 10,
  };
}

// ── Auto-select month: 강남구 probe ──────────────────────────
async function detectBestMonth(): Promise<string> {
  for (const ym of CANDIDATE_MONTHS) {
    const r = await fetchDistrictRaw("11680", ym);
    if (r.error === null && r.httpStatus === 200) {
      console.log(`[부동산API] 자동 선택 월: ${ym} (items: ${r.items.length})`);
      return ym;
    }
  }
  console.warn(`[부동산API] 모든 후보 월 실패 → fallback: ${CANDIDATE_MONTHS[0]}`);
  return CANDIDATE_MONTHS[0];
}

// ── GET ───────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const isDebug = sp.get("debug") === "true";
  const refresh = sp.get("refresh") === "true";
  const ymParam = sp.get("ym");

  // ── DEBUG 모드 ─────────────────────────────────────────────
  if (isDebug) {
    const results: Record<string, unknown> = {
      debug: true,
      keyConfigured: MOLIT_KEY.length > 0,
      keyLength: MOLIT_KEY.length,
      candidateMonths: CANDIDATE_MONTHS,
    };

    // 강남구로 각 후보 월 순서대로 시도
    for (const ym of ymParam ? [ymParam] : CANDIDATE_MONTHS) {
      const r = await fetchDistrictRaw("11680", ym);
      const uniqueDealDays = [...new Set(r.items.map((it: Record<string, unknown>) => String(it.dealDay ?? "")))].sort();
      results[`ym_${ym}`] = {
        httpStatus: r.httpStatus,
        contentType: r.contentType,
        endpoint: r.endpoint,
        error: r.error,
        itemCount: r.items.length,
        uniqueDealDays,
        rawPreview: r.rawPreview,
        firstItem: r.items[0] ?? null,
      };
      // 성공하면 이후 월은 생략
      if (r.error === null && r.httpStatus === 200) break;
    }

    return NextResponse.json(results);
  }

  // ── Normal 모드 ────────────────────────────────────────────

  // 월 결정
  let dealYmd = ymParam ?? "";
  if (!dealYmd) {
    dealYmd = await detectBestMonth();
  }

  const cacheKey = `realestate_seoul_${dealYmd}`;

  // ── In-memory cache (fastest) ──────────────────────────
  const memEntry = memCacheMap.get(cacheKey);
  if (!refresh && memEntry && Date.now() - memEntry.cachedAt < MEM_TTL_MS) {
    return NextResponse.json({ ok: true, ...memEntry.data, cached: true }, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" },
    });
  }
  const TTL_MS = 24 * 60 * 60 * 1000;

  // 캐시 확인
  if (!refresh) {
    try {
      const { data: cached } = await supabaseAdmin
        .from("legend_screener_cache")
        .select("results, created_at")
        .eq("cache_key", cacheKey)
        .single();
      if (cached) {
        const age = Date.now() - new Date(cached.created_at).getTime();
        if (age < TTL_MS) {
          const result = cached.results as object;
          memCacheMap.set(cacheKey, { data: result, cachedAt: Date.now() - age });
          return NextResponse.json({ ok: true, ...result, cached: true }, {
            headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" },
          });
        }
      }
    } catch {
      // cache miss
    }
  }

  // 이전 월 (전월 대비 계산용)
  const yr = parseInt(dealYmd.slice(0, 4), 10);
  const mo = parseInt(dealYmd.slice(4, 6), 10);
  const prevD = new Date(yr, mo - 2, 1);
  const prevYmd = `${prevD.getFullYear()}${String(prevD.getMonth() + 1).padStart(2, "0")}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchAll = (month: string): Promise<any[][]> =>
    Promise.all(SEOUL_DISTRICTS.map((d) => fetchDistrict(d.code, month)));

  const [currResults, prevResults] = await Promise.all([fetchAll(dealYmd), fetchAll(prevYmd)]);

  // sggCd 기반 집계 (인덱스 매핑 대신 실제 코드 기준)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildPriceMap = (results: any[][]): Record<string, number[]> => {
    const map: Record<string, number[]> = {};
    for (const items of results) {
      for (const item of items) {
        const code = String(item.sggCd ?? "").trim().padStart(5, "0");
        const price = parsePrice(item.dealAmount);
        if (code && price > 0) {
          if (!map[code]) map[code] = [];
          map[code].push(price);
        }
      }
    }
    return map;
  };

  const currMap = buildPriceMap(currResults);
  const prevMap = buildPriceMap(prevResults);

  const districtStats: DistrictStats[] = SEOUL_DISTRICTS.map((d) => {
    const currPrices = currMap[d.code] ?? [];
    const prevPrices = prevMap[d.code] ?? [];
    const median = (arr: number[]) => {
      if (!arr.length) return 0;
      const s = [...arr].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
    };
    const currAvg = median(currPrices);
    const prevAvg = median(prevPrices);
    const change = currAvg > 0 && prevAvg > 0
      ? Math.round(((currAvg - prevAvg) / prevAvg) * 1000) / 10
      : null;
    const avgPrice = Math.round(currAvg > 0 ? currAvg : prevAvg);
    return {
      code: d.code,
      name: d.name,
      avgPrice,
      avgPriceInBillion: Math.round(avgPrice / 1000) / 10,
      count: currPrices.length > 0 ? currPrices.length : prevPrices.length,
      change,
    };
  });

  // 구 코드 → 구 정보 매핑
  const districtByCode = new Map(SEOUL_DISTRICTS.map((d) => [d.code, d]));

  const allTrades: Trade[] = [];
  for (const items of currResults) {
    for (const item of items) {
      const code = String(item.sggCd ?? "").trim().padStart(5, "0");
      const d = districtByCode.get(code);
      if (!d) continue;
      const t = tradeFromItem(item, d, dealYmd);
      if (t) allTrades.push(t);
    }
  }

  // 구별 top 20 → 합산 후 가격순 (모든 구 대표성 확보)
  const byDistrict = new Map<string, Trade[]>();
  for (const t of allTrades) {
    if (!byDistrict.has(t.district)) byDistrict.set(t.district, []);
    byDistrict.get(t.district)!.push(t);
  }
  const recentTrades: Trade[] = [];
  for (const trades of byDistrict.values()) {
    trades.sort((a, b) => b.price - a.price);
    recentTrades.push(...trades.slice(0, 20));
  }
  recentTrades.sort((a, b) => b.price - a.price);

  // 구별 상세 통계 (districtStatsMap)
  const districtStatsMap: Record<string, { count: number; avgPrice: number; topDeals: { name: string; dong: string; area: number; floor: number; date: string; price: number }[] }> = {};
  for (const d of SEOUL_DISTRICTS) {
    const trades = byDistrict.get(d.name) ?? [];
    const prices = currMap[d.code] ?? [];
    const avg = prices.length ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length) : 0;
    districtStatsMap[d.name] = {
      count: trades.length,
      avgPrice: avg,
      topDeals: trades.slice(0, 20).map(t => ({ name: t.aptName, dong: t.dong, area: t.area, floor: t.floor, date: t.date, price: t.price })),
    };
  }

  // 전월 구별 거래건수
  const prevDistrictStatsMap: Record<string, { count: number }> = {};
  for (const d of SEOUL_DISTRICTS) {
    const prevPrices = prevMap[d.code] ?? [];
    prevDistrictStatsMap[d.name] = { count: prevPrices.length };
  }

  const validCount = districtStats.filter((d) => d.avgPrice > 0).length;
  console.log(`[부동산API] 결과: ${dealYmd} | ${validCount}/25 구 | 거래 ${allTrades.length}건`);

  const payload = { districts: districtStats, recentTrades, districtStatsMap, prevDistrictStatsMap, updatedAt: new Date().toISOString(), dealYmd };

  // 메모리 캐시 저장
  memCacheMap.set(cacheKey, { data: payload, cachedAt: Date.now() });

  // Only cache if sufficient data (at least 10 districts with avgPrice > 0)
  if (validCount >= 10) {
    try {
      await supabaseAdmin.from("legend_screener_cache").delete().eq("cache_key", cacheKey);
      await supabaseAdmin.from("legend_screener_cache").insert({
        cache_key: cacheKey,
        results: payload,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[부동산API] 캐시 저장 실패:", err);
    }
  } else {
    console.warn(`[부동산API] 캐시 스킵: validCount=${validCount} (<10)`);
  }

  return NextResponse.json({ ok: true, ...payload, cached: false });
}
