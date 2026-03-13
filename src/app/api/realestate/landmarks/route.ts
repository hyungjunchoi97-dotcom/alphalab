import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { XMLParser } from "fast-xml-parser";

export const runtime = "nodejs";
export const maxDuration = 60;

const MOLIT_KEY = process.env.MOLIT_API_KEY ?? "";
const ENDPOINT_DEV = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev";
const ENDPOINT_STD = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type KeywordRule = string | { include: string; exclude?: string; label: string };

const LANDMARKS: { district: string; code: string; keywords: KeywordRule[] }[] = [
  { district: "강남구", code: "11680", keywords: [{ include: "현대", exclude: "신현대", label: "압구정현대" }, "래미안대치팰리스", "도곡렉슬"] },
  { district: "서초구", code: "11650", keywords: ["아크로리버파크", "래미안퍼스티지", "래미안서초에스티지S"] },
  { district: "송파구", code: "11710", keywords: ["잠실엘스", "헬리오시티", "파크리오", "갤러리아팰리스", "아시아선수촌", { include: "올림픽훼밀", label: "올림픽훼밀리타운" }] },
  { district: "용산구", code: "11170", keywords: ["용산파크타워", "한남더힐", { include: "한강(대우)", label: "한강대우" }] },
  { district: "성동구", code: "11200", keywords: ["트리마제", "서울숲더샵", "서울숲푸르지오"] },
  { district: "마포구", code: "11440", keywords: ["마포래미안푸르지오", "마포그랑자이", "한강밤섬자이"] },
  { district: "강동구", code: "11740", keywords: ["고덕그라시움", "올림픽파크포레온"] },
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchDistrict(code: string, dealYmd: string): Promise<any[]> {
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
      return extractItems(parsed);
    } catch { continue; }
  }
  return [];
}

interface LandmarkTrade {
  date: string;
  floor: number;
  area: number;
  price: number;
  priceInBillion: number;
  aptName: string;
}

interface LandmarkResult {
  name: string;
  district: string;
  trades: LandmarkTrade[];
}

export async function GET(request: NextRequest) {
  const range = Math.min(parseInt(request.nextUrl.searchParams.get("range") ?? "6", 10) || 6, 36);
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";
  const cacheKey = `realestate_landmarks_v1_${range}`;

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

  // Fetch all items per district across 6 months
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const districtItems: Record<string, any[]> = {};
  const uniqueCodes = [...new Set(LANDMARKS.map(l => l.code))];

  for (const code of uniqueCodes) {
    districtItems[code] = [];
  }

  // Batch by 3 months
  for (let i = 0; i < months.length; i += 3) {
    const batch = months.slice(i, i + 3);
    await Promise.all(
      batch.map(async (ym) => {
        const results = await Promise.all(
          uniqueCodes.map(code => fetchDistrict(code, ym))
        );
        uniqueCodes.forEach((code, idx) => {
          districtItems[code].push(...results[idx]);
        });
      })
    );
  }

  // Filter by landmark keywords
  const landmarks: LandmarkResult[] = [];

  for (const { district, code, keywords } of LANDMARKS) {
    for (const rule of keywords) {
      const isObj = typeof rule === "object";
      const includeStr = isObj ? rule.include : rule;
      const excludeStr = isObj ? rule.exclude : undefined;
      const label = isObj ? rule.label : rule;
      const items = districtItems[code] ?? [];
      const matched = items.filter(item => {
        const aptName = String(item.aptNm ?? "").trim();
        if (!aptName.includes(includeStr)) return false;
        if (excludeStr && aptName.includes(excludeStr)) return false;
        return true;
      });

      const trades: LandmarkTrade[] = matched
        .map(item => {
          const price = parseInt(String(item.dealAmount ?? "").replace(/,/g, "").trim(), 10);
          if (price <= 0) return null;
          const yr = String(item.dealYear ?? "").trim();
          const mo = String(item.dealMonth ?? "").trim().padStart(2, "0");
          const dy = String(item.dealDay ?? "").trim().padStart(2, "0");
          return {
            date: `${yr}-${mo}-${dy}`,
            floor: parseInt(String(item.floor ?? "0").trim(), 10) || 0,
            area: parseFloat(String(item.excluUseAr ?? "0")) || 0,
            price,
            priceInBillion: Math.round(price / 1000) / 10,
            aptName: String(item.aptNm ?? "").trim(),
          };
        })
        .filter((t): t is LandmarkTrade => t !== null)
        .sort((a, b) => b.date.localeCompare(a.date) || b.price - a.price);

      landmarks.push({ name: label, district, trades });
    }
  }

  const payload = { landmarks };

  try {
    await supabaseAdmin.from("legend_screener_cache").delete().eq("cache_key", cacheKey);
    await supabaseAdmin.from("legend_screener_cache").insert({
      cache_key: cacheKey,
      results: payload,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[landmarks] cache write failed:", err);
  }

  return NextResponse.json({ ok: true, ...payload, cached: false });
}
