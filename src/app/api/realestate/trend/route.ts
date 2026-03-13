import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { XMLParser } from "fast-xml-parser";

export const runtime = "nodejs";
export const maxDuration = 60;

const MOLIT_KEY = process.env.MOLIT_API_KEY ?? "";
const ENDPOINT_DEV = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";
const ENDPOINT_STD = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const SEOUL_DISTRICTS = [
  { code: "11110", name: "종로구" }, { code: "11140", name: "중구" },
  { code: "11170", name: "용산구" }, { code: "11200", name: "성동구" },
  { code: "11215", name: "광진구" }, { code: "11230", name: "동대문구" },
  { code: "11260", name: "중랑구" }, { code: "11290", name: "성북구" },
  { code: "11305", name: "강북구" }, { code: "11320", name: "도봉구" },
  { code: "11350", name: "노원구" }, { code: "11380", name: "은평구" },
  { code: "11410", name: "서대문구" }, { code: "11440", name: "마포구" },
  { code: "11470", name: "양천구" }, { code: "11500", name: "강서구" },
  { code: "11530", name: "구로구" }, { code: "11545", name: "금천구" },
  { code: "11560", name: "영등포구" }, { code: "11590", name: "동작구" },
  { code: "11620", name: "관악구" }, { code: "11650", name: "서초구" },
  { code: "11680", name: "강남구" }, { code: "11710", name: "송파구" },
  { code: "11740", name: "강동구" },
];

const xmlParser = new XMLParser({ ignoreAttributes: false, parseAttributeValue: true, parseTagValue: true });

function getMonths(count: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractItems(parsed: any): any[] {
  const items = parsed?.response?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasApiError(parsed: any): boolean {
  const code1 = parsed?.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnReasonCode;
  if (code1) return true;
  const code2 = parsed?.response?.header?.resultCode;
  if (code2 && String(code2) !== "00") return true;
  return false;
}

async function fetchDistrict(code: string, dealYmd: string): Promise<number[]> {
  const makeUrl = (ep: string) =>
    `${ep}?serviceKey=${MOLIT_KEY}&LAWD_CD=${code}&DEAL_YMD=${dealYmd}&numOfRows=1000&pageNo=1`;
  const urls = [makeUrl(ENDPOINT_DEV), makeUrl(ENDPOINT_STD)];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(12000),
        headers: { Accept: "application/xml, text/xml, */*" },
      });
      if (!res.ok) continue;
      const text = await res.text();
      const parsed = xmlParser.parse(text);
      if (hasApiError(parsed)) continue;
      const items = extractItems(parsed);
      return items
        .map(item => parseInt(String(item.dealAmount ?? "").replace(/,/g, "").trim(), 10))
        .filter(p => p > 0);
    } catch { continue; }
  }
  return [];
}

export async function GET(request: NextRequest) {
  const range = parseInt(request.nextUrl.searchParams.get("range") ?? "12", 10);
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";
  const cacheKey = `realestate_trend_v1_${range}`;

  // Cache check
  if (!forceRefresh) {
    try {
      const { data: cached } = await supabaseAdmin
        .from("legend_screener_cache")
        .select("results, created_at")
        .eq("cache_key", cacheKey)
        .single();
      if (cached) {
        const age = Date.now() - new Date(cached.created_at).getTime();
        if (age < CACHE_TTL_MS) {
          return NextResponse.json({ ok: true, ...(cached.results as object), cached: true });
        }
      }
    } catch { /* cache miss */ }
  }

  const months = getMonths(range);

  // Build priceMap: districtCode → { [ym]: number[] }
  const priceMap: Record<string, Record<string, number[]>> = {};
  for (const d of SEOUL_DISTRICTS) priceMap[d.code] = {};

  // Process in batches of 4 months to avoid rate limits
  const BATCH = 4;
  for (let i = 0; i < months.length; i += BATCH) {
    const batch = months.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (ym) => {
        const results = await Promise.all(
          SEOUL_DISTRICTS.map(d => fetchDistrict(d.code, ym))
        );
        SEOUL_DISTRICTS.forEach((d, idx) => {
          priceMap[d.code][ym] = results[idx];
        });
      })
    );
  }

  // Build response: districts[name] = array of median prices, districtVolumes[name] = array of trade counts
  const districts: Record<string, (number | null)[]> = {};
  const districtVolumes: Record<string, (number | null)[]> = {};
  for (const d of SEOUL_DISTRICTS) {
    districts[d.name] = months.map(ym => {
      const prices = priceMap[d.code][ym] ?? [];
      if (prices.length === 0) return null;
      const sorted = [...prices].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      return Math.round(median / 1000) / 10; // 억 단위 (소수점 1자리)
    });
    districtVolumes[d.name] = months.map(ym => {
      const prices = priceMap[d.code][ym] ?? [];
      return prices.length > 0 ? prices.length : null;
    });
  }

  // Month labels: "25.03" format
  const monthLabels = months.map(ym => `${ym.slice(2, 4)}.${ym.slice(4, 6)}`);

  const payload = { months: monthLabels, districts, districtVolumes };

  try {
    await supabaseAdmin.from("legend_screener_cache").delete().eq("cache_key", cacheKey);
    await supabaseAdmin.from("legend_screener_cache").insert({
      cache_key: cacheKey,
      results: payload,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[trend] cache write failed:", err);
  }

  return NextResponse.json({ ok: true, ...payload, cached: false });
}
