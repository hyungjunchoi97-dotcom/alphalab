import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 30;

const KR_ETF_LIST = [
  { code: "091160", name: "KODEX 반도체" },
  { code: "396500", name: "TIGER 반도체TOP10" },
  { code: "305720", name: "KODEX 2차전지산업" },
  { code: "364970", name: "TIGER 글로벌AI액티브" },
  { code: "463250", name: "TIGER K방산&우주" },
  { code: "494670", name: "TIGER 조선TOP10" },
  { code: "462900", name: "KoAct 바이오헬스케어액티브" },
  { code: "465330", name: "RISE 2차전지TOP10" },
  { code: "476850", name: "KoAct 삼성그룹액티브" },
  { code: "482030", name: "KoAct 반도체&2차전지핵심소재액티브" },
  { code: "0162Y0", name: "TIME 코스닥액티브" },
  { code: "385720", name: "TIME 코스피액티브" },
  { code: "456600", name: "TIME 글로벌AI인공지능액티브" },
  { code: "0163Y0", name: "KoAct 코스닥액티브" },
  { code: "495230", name: "KoAct 코리아밸류업액티브" },
  { code: "487130", name: "KoAct AI인프라액티브" },
  { code: "0150K0", name: "KoAct 수소전력ESS인프라액티브" },
  { code: "0132D0", name: "KoAct 글로벌K컬처밸류체인액티브" },
  { code: "496080", name: "TIGER 코리아밸류업" },
  { code: "471780", name: "TIGER 코리아테크액티브" },
  { code: "0138D0", name: "RISE 동학개미" },
  { code: "140570", name: "RISE 수출주" },
  { code: "253280", name: "RISE 헬스케어" },
  { code: "427120", name: "RISE AI플랫폼" },
  { code: "469070", name: "RISE AI&로봇" },
  { code: "475380", name: "RISE 글로벌리얼티인컴" },
  { code: "0127R0", name: "RISE 미국AI클라우드인프라" },
  { code: "445290", name: "KODEX 로봇액티브" },
  { code: "445150", name: "KODEX 친환경조선해운액티브" },
  { code: "444200", name: "SOL 코리아메가테크액티브" },
  { code: "385510", name: "KODEX 신재생에너지액티브" },
  { code: "474590", name: "WON 반도체밸류체인액티브" },
  { code: "494220", name: "UNICORN SK하이닉스밸류체인액티브" },
];

const CACHE_KEY = "kr_etf_holdings_v12";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

interface Holding {
  rank: number;
  code: string;
  name: string;
  weight: number;
}

async function fetchHoldings(etfCode: string): Promise<Holding[]> {
  const res = await fetch(
    `https://m.stock.naver.com/api/etf/${etfCode}/constituent?limit=100`,
    {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AlphaLab/1.0; +https://thealphalabs.net)" },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!res.ok) { console.error("[Naver ETF] HTTP", res.status, etfCode); return []; }
  const data = await res.json();
  const items = data.result;
  if (!Array.isArray(items)) return [];
  return items
    .filter((item: Record<string, string | number>) => item.itemName)
    .map((item: Record<string, string | number>, idx: number) => ({
      rank: idx + 1,
      code: String(item.itemCode || item.reutersCode || ""),
      name: String(item.itemName),
      weight: parseFloat(String(item.constituentWeight ?? "0")),
    }))
    .filter((h: Holding) => h.weight > 0)
    .sort((a: Holding, b: Holding) => b.weight - a.weight);
}

export async function GET(request: Request) {
  const forceRefresh = new URL(request.url).searchParams.get("refresh") === "true";
  // Check cache
  try {
    if (forceRefresh) {
      await supabaseAdmin.from("legend_screener_cache").delete().eq("cache_key", CACHE_KEY);
    }
    const { data: cached } = await supabaseAdmin
      .from("legend_screener_cache")
      .select("results, created_at")
      .eq("cache_key", CACHE_KEY)
      .single();
    if (cached) {
      const age = Date.now() - new Date(cached.created_at).getTime();
      if (age < CACHE_TTL_MS) {
        return NextResponse.json(
          { ok: true, ...(cached.results as object), cached: true },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
    }
  } catch { /* cache miss */ }

  try {
    const results = await Promise.all(
      KR_ETF_LIST.map(async (etf) => {
        const holdings = await fetchHoldings(etf.code);
        return { code: etf.code, name: etf.name, holdings };
      })
    );
    const etfs = results;

    const payload = { etfs };

    // Save cache
    try {
      await supabaseAdmin.from("legend_screener_cache").delete().eq("cache_key", CACHE_KEY);
      await supabaseAdmin.from("legend_screener_cache").insert({
        cache_key: CACHE_KEY,
        results: payload,
        created_at: new Date().toISOString(),
      });
    } catch { /* ignore cache write error */ }

    return NextResponse.json(
      { ok: true, ...payload, cached: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[kr-etf-holdings]", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch KR ETF holdings" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
