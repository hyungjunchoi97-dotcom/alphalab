import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { XMLParser } from "fast-xml-parser";

export const runtime = "nodejs";
export const maxDuration = 60;

const MOLIT_KEY = process.env.MOLIT_API_KEY ?? "";
const ENDPOINT_STD = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";
const CANDIDATE_MONTHS = ["202502", "202501", "202412", "202411", "202410", "202409"];

export interface ProvinceStats {
  geoCode: string;        // GeoJSON 시도 코드 (e.g., "11"=서울)
  name: string;
  avgPrice: number;       // 만원
  avgPriceInBillion: number;
  count: number;
  change: number | null;
}

// GeoJSON code → { name, representative LAWD_CD }
const PROVINCES = [
  { geoCode: "11", name: "서울",   lawdCd: "11110" },
  { geoCode: "21", name: "부산",   lawdCd: "26110" },
  { geoCode: "22", name: "대구",   lawdCd: "27110" },
  { geoCode: "23", name: "인천",   lawdCd: "28110" },
  { geoCode: "24", name: "광주",   lawdCd: "29110" },
  { geoCode: "25", name: "대전",   lawdCd: "30110" },
  { geoCode: "26", name: "울산",   lawdCd: "31110" },
  { geoCode: "29", name: "세종",   lawdCd: "36110" },
  { geoCode: "31", name: "경기",   lawdCd: "41110" },
  { geoCode: "32", name: "강원",   lawdCd: "42110" },
  { geoCode: "33", name: "충북",   lawdCd: "43110" },
  { geoCode: "34", name: "충남",   lawdCd: "44130" },
  { geoCode: "35", name: "전북",   lawdCd: "45111" },
  { geoCode: "36", name: "전남",   lawdCd: "46110" },
  { geoCode: "37", name: "경북",   lawdCd: "47110" },
  { geoCode: "38", name: "경남",   lawdCd: "48120" },
  { geoCode: "39", name: "제주",   lawdCd: "50110" },
];

function parsePrice(raw: unknown): number {
  return parseInt(String(raw ?? "").replace(/,/g, "").trim(), 10) || 0;
}

const xmlParser = new XMLParser({ ignoreAttributes: false, parseTagValue: true });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractItems(parsed: any): any[] {
  const items = parsed?.response?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detectApiError(parsed: any): string | null {
  const code1 = parsed?.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnReasonCode;
  if (code1) return `errCode=${code1}`;
  const code2 = parsed?.response?.header?.resultCode;
  if (code2 && String(code2) !== "00") return `resultCode=${code2}`;
  return null;
}

async function fetchProvince(lawdCd: string, dealYmd: string): Promise<number[]> {
  const makeUrl = (concat: boolean) =>
    concat
      ? `${ENDPOINT_STD}?serviceKey=${MOLIT_KEY}&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&numOfRows=100&pageNo=1`
      : `${ENDPOINT_STD}?${new URLSearchParams({ serviceKey: MOLIT_KEY, LAWD_CD: lawdCd, DEAL_YMD: dealYmd, numOfRows: "100", pageNo: "1" }).toString()}`;

  for (const concat of [false, true]) {
    try {
      const res = await fetch(makeUrl(concat), {
        signal: AbortSignal.timeout(12000),
        headers: { Accept: "application/xml, text/xml, */*" },
      });
      if (!res.ok) continue;
      const rawText = await res.text();
      const parsed = xmlParser.parse(rawText);
      if (detectApiError(parsed)) continue;
      const items = extractItems(parsed);
      return items.map((item) => parsePrice(item.dealAmount)).filter((p) => p > 0);
    } catch {
      continue;
    }
  }
  return [];
}

async function detectBestMonth(): Promise<string> {
  for (const ym of CANDIDATE_MONTHS) {
    const prices = await fetchProvince("11110", ym);
    if (prices.length > 0) return ym;
  }
  return CANDIDATE_MONTHS[0];
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const refresh = sp.get("refresh") === "true";
  const ymParam = sp.get("ym");

  let dealYmd = ymParam ?? "";
  if (!dealYmd) dealYmd = await detectBestMonth();

  const cacheKey = `realestate_korea_${dealYmd}`;
  const TTL_MS = 24 * 60 * 60 * 1000;

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
          return NextResponse.json({ ok: true, ...(cached.results as object), cached: true });
        }
      }
    } catch { /* cache miss */ }
  }

  const yr = parseInt(dealYmd.slice(0, 4), 10);
  const mo = parseInt(dealYmd.slice(4, 6), 10);
  const prevD = new Date(yr, mo - 2, 1);
  const prevYmd = `${prevD.getFullYear()}${String(prevD.getMonth() + 1).padStart(2, "0")}`;

  const [currAll, prevAll] = await Promise.all([
    Promise.all(PROVINCES.map((p) => fetchProvince(p.lawdCd, dealYmd))),
    Promise.all(PROVINCES.map((p) => fetchProvince(p.lawdCd, prevYmd))),
  ]);

  const avgOf = (prices: number[]) =>
    prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;

  const provinces: ProvinceStats[] = PROVINCES.map((p, i) => {
    const currAvg = avgOf(currAll[i]);
    const prevAvg = avgOf(prevAll[i]);
    const change =
      currAvg > 0 && prevAvg > 0
        ? Math.round(((currAvg - prevAvg) / prevAvg) * 1000) / 10
        : null;
    const avgPrice = Math.round(currAvg > 0 ? currAvg : prevAvg);
    return {
      geoCode: p.geoCode,
      name: p.name,
      avgPrice,
      avgPriceInBillion: Math.round(avgPrice / 1000) / 10,
      count: (currAll[i].length > 0 ? currAll[i] : prevAll[i]).length,
      change,
    };
  });

  console.log(`[부동산Korea] ${dealYmd} | ${provinces.filter((p) => p.avgPrice > 0).length}/17 시도`);

  const payload = { provinces, updatedAt: new Date().toISOString(), dealYmd };

  try {
    await supabaseAdmin.from("legend_screener_cache").delete().eq("cache_key", cacheKey);
    await supabaseAdmin.from("legend_screener_cache").insert({
      cache_key: cacheKey,
      results: payload,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[부동산Korea] 캐시 저장 실패:", err);
  }

  return NextResponse.json({ ok: true, ...payload, cached: false });
}
