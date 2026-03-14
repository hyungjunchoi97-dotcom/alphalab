import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 30;

const KR_ETF_LIST = [
  { code: "091160", name: "KODEX 반도체" },
  { code: "396500", name: "TIGER 반도체TOP10" },
  { code: "305720", name: "KODEX 2차전지산업" },
  { code: "364970", name: "TIGER 글로벌AI액티브" },
  { code: "466940", name: "TIGER 우주항공&방산플러스TOP10" },
  { code: "494670", name: "TIGER 조선TOP10" },
  { code: "462900", name: "KoAct 바이오헬스케어액티브" },
  { code: "465330", name: "RISE 2차전지TOP10" },
  { code: "476850", name: "KoAct 삼성그룹액티브" },
  { code: "482030", name: "KoAct 반도체&2차전지핵심소재액티브" },
];

const CACHE_KEY = "kr_etf_holdings_v1";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

interface Holding {
  rank: number;
  code: string;
  name: string;
  weight: number;
}

async function fetchHoldings(etfCode: string): Promise<Holding[]> {
  const res = await fetch(
    `https://m.stock.naver.com/api/etf/${etfCode}/constituent?limit=50`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AlphaLab/1.0; +https://thealphalabs.net)",
      },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!res.ok) { console.error("[Naver ETF] HTTP", res.status, etfCode); return []; }
  const data = await res.json();
  const items = data.result;
  if (!Array.isArray(items)) return [];

  return items
    .filter((item: Record<string, string | number>) => item.itemName && item.itemCode)
    .map((item: Record<string, string | number>, idx: number) => ({
      rank: idx + 1,
      code: String(item.itemCode),
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
    const etfs: { code: string; name: string; holdings: Holding[] }[] = [];
    for (const etf of KR_ETF_LIST) {
      const holdings = await fetchHoldings(etf.code);
      etfs.push({ code: etf.code, name: etf.name, holdings });
    }

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
