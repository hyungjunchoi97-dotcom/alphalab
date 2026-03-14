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
  { district: "강남구", code: "11680", keywords: [{ include: "현대", exclude: "신현대", label: "압구정현대" }, "래미안대치팰리스", "도곡렉슬", "은마", "청담자이", "래미안블레스티지", "타워팰리스2", "개포자이프레지던스", "디에이치아너힐즈", "래미안라클래시"] },
  { district: "서초구", code: "11650", keywords: ["아크로리버파크", "래미안퍼스티지", "래미안서초에스티지S", "반포자이", "래미안원베일리", { include: "래미안 리더스원", label: "래미안리더스원" }, { include: "아크로리버뷰신반포", label: "아크로리버뷰" }, "반포리체", "신반포자이", "서초푸르지오써밋"] },
  { district: "송파구", code: "11710", keywords: ["잠실엘스", "헬리오시티", "파크리오", "갤러리아팰리스", "아시아선수촌", { include: "올림픽훼밀", label: "올림픽훼밀리타운" }] },
  { district: "용산구", code: "11170", keywords: ["용산파크타워", "한남더힐", { include: "한강(대우)", label: "한강대우" }, "한가람", "용산시티파크", { include: "현대맨숀", label: "이촌동현대" }, "신동아"] },
  { district: "성동구", code: "11200", keywords: ["트리마제", "서울숲더샵", "서울숲푸르지오", "옥수하이츠", { include: "래미안 옥수 리버젠", label: "래미안옥수리버젠" }, "서울숲리버뷰자이", { include: "센트라스", label: "왕십리센트라스" }, "금호자이"] },
  { district: "마포구", code: "11440", keywords: ["마포래미안푸르지오", "마포그랑자이", "한강밤섬자이", "마포현대", "공덕자이", { include: "래미안아트리체", label: "마포래미안아트리체" }, { include: "신촌숲", label: "신촌숲아이파크" }, { include: "염리삼성", label: "염리삼성래미안" }] },
  { district: "강동구", code: "11740", keywords: ["고덕그라시움", "고덕아르테온", "고덕숲아이파크", "강동헤리티지자이", "래미안솔베뉴", { include: "센트럴아이파크", label: "고덕센트럴아이파크" }, { include: "롯데캐슬", label: "강동롯데캐슬" }, { include: "천호", label: "천호현대" }, { include: "성내", label: "성내삼익" }] },
  { district: "광진구", code: "11215", keywords: ["더샵스타시티", "광진트라팰리스", "e편한세상광진", { include: "자양", label: "자양동현대" }, "구의현대"] },
  { district: "양천구", code: "11470", keywords: ["목동신시가지7", "목동신시가지9", "하이페리온2", "목동신시가지1", "목동신시가지13", { include: "트라팰리스이스턴", label: "트라팰리스이스턴에비뉴" }] },
  { district: "영등포구", code: "11560", keywords: ["브라이튼여의도", { include: "시범", label: "여의도시범" }, { include: "리첸시아", label: "여의도자이" }, { include: "광장", label: "광장아파트" }, { include: "미성", label: "여의도미성" }, { include: "대교", label: "영등포대교" }, { include: "삼부", label: "여의도삼부" }, { include: "한양", label: "여의도한양" }] },
  // C티어
  { district: "동작구", code: "11590", keywords: ["흑석한강센트레빌", "이수브라운스톤", { include: "상도", label: "상도래미안" }, { include: "흑석", label: "흑석자이" }, { include: "센트레빌", label: "동작역센트레빌" }] },
  { district: "종로구", code: "11110", keywords: ["경희궁자이", "창신쌍용", { include: "혜화", label: "혜화동현대" }, { include: "평창", label: "평창동현대" }, { include: "부암", label: "부암동현대" }] },
  { district: "중구", code: "11140", keywords: ["남산타운", { include: "신당", label: "신당동삼성" }, { include: "황학", label: "황학동벽산" }, { include: "중림", label: "중림동삼성" }, { include: "을지", label: "을지한국" }] },
  // D티어
  { district: "서대문구", code: "11380", keywords: [{ include: "파크뷰자이", label: "DMC파크뷰자이" }, { include: "가재울", label: "가재울뉴타운3구역" }, { include: "홍제원", label: "홍제원아이파크" }, { include: "남가좌", label: "남가좌삼성" }, { include: "북가좌", label: "북가좌6단지" }] },
  { district: "강서구", code: "11500", keywords: ["마곡엠밸리7단지", "마곡엠밸리8단지", { include: "염창", label: "염창동한신" }, { include: "가양", label: "가양대림" }, { include: "내발산", label: "내발산동현대" }] },
  { district: "동대문구", code: "11230", keywords: ["휘경SK뷰", "전농SK", "래미안위브", "한양수자인", { include: "이문", label: "이문힐스테이트" }] },
  { district: "성북구", code: "11290", keywords: [{ include: "길음", label: "길음역롯데캐슬" }, "돈암현대", { include: "한신한진", label: "한신한진" }, { include: "정릉", label: "정릉SK뷰" }, { include: "석관", label: "석관두산" }] },
  { district: "은평구", code: "11350", keywords: [{ include: "녹번", label: "녹번역e편한세상캐슬" }, { include: "불광", label: "불광미성" }, { include: "응암", label: "응암현대" }, { include: "진관", label: "진관래미안" }, { include: "구산", label: "구산현대" }] },
  { district: "관악구", code: "11620", keywords: [{ include: "봉천", label: "봉천현대" }, "신림현대", { include: "관악산", label: "관악산LH" }, { include: "서울대", label: "서울대벽산" }, { include: "하이츠", label: "중앙하이츠빌" }] },
  // E티어
  { district: "노원구", code: "11410", keywords: [{ include: "상계주공", label: "상계주공3단지" }, { include: "중계청구", label: "중계청구" }, { include: "하계", label: "하계현대2차" }, { include: "공릉", label: "공릉삼성" }, { include: "월계", label: "월계시영" }] },
  { district: "구로구", code: "11530", keywords: ["구로자이", { include: "개봉", label: "개봉주공" }, { include: "오류", label: "오류동현대" }, { include: "궁동", label: "궁동한신" }, "구로두산위브"] },
  { district: "중랑구", code: "11260", keywords: ["면목한신", { include: "신내", label: "신내3단지" }, { include: "묵동", label: "묵동신성" }, { include: "상봉", label: "상봉래미안" }, { include: "면목", label: "면목동한양" }] },
  { district: "금천구", code: "11545", keywords: [{ include: "독산", label: "독산래미안" }, { include: "시흥", label: "시흥한신" }, { include: "롯데캐슬골드", label: "금천롯데캐슬골드클래스" }, "독산현대", { include: "가산", label: "가산현대" }] },
  { district: "강북구", code: "11090", keywords: [{ include: "미아", label: "미아동래미안" }, { include: "수유", label: "수유현대" }, { include: "우이", label: "우이신설현대" }, { include: "번동", label: "번동주공" }, { include: "수유벽산", label: "수유벽산" }] },
  { district: "도봉구", code: "11320", keywords: [{ include: "창동주공", label: "창동주공17단지" }, { include: "방학", label: "방학현대" }, { include: "도봉", label: "도봉현대" }, { include: "쌍문", label: "쌍문현대" }, { include: "방학래미안", label: "방학래미안" }] },
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
  const range = 60; // always fetch 5Y
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";
  const cacheKey = "realestate_landmarks_v1_60";

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
