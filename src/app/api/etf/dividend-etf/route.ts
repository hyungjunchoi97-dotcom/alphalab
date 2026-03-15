import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 30;

const DIV_ETF_LIST = [
  { code: "441800", name: "TIME Korea플러스배당액티브" },
  { code: "0052D0", name: "TIGER 코리아배당다우존스" },
  { code: "495230", name: "KoAct 코리아밸류업액티브" },
  { code: "496080", name: "TIGER 코리아밸류업" },
  { code: "0153X0", name: "PLUS 미국고배당주액티브" },
  { code: "475380", name: "RISE 글로벌리얼티인컴" },
  { code: "0138D0", name: "RISE 동학개미" },
  { code: "161510", name: "KODEX 고배당" },
  { code: "211560", name: "TIGER 배당성장" },
  { code: "266160", name: "KODEX 배당성장" },
];

const CACHE_KEY = "div_etf_holdings_v1";
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
    const etfs: { code: string; name: string; holdings: Holding[] }[] = [];
    for (const etf of DIV_ETF_LIST) {
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
    console.error("[dividend-etf]", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch dividend ETF holdings" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
