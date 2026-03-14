import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 30;

const KIS_APP_KEY = process.env.KIS_APP_KEY ?? "";
const KIS_APP_SECRET = process.env.KIS_APP_SECRET ?? "";
const KIS_BASE = "https://openapi.koreainvestment.com:9443";

const KR_ETF_LIST = [
  { code: "396500", name: "TIGER 차이나전기차SOLACTIVE" },
  { code: "091160", name: "KODEX 반도체" },
  { code: "305720", name: "KODEX 2차전지산업" },
  { code: "441680", name: "KODEX 반도체TOP10" },
  { code: "396510", name: "TIGER Fn반도체TOP10" },
  { code: "411600", name: "KODEX K-방산" },
  { code: "465580", name: "TIGER 조선TOP10" },
  { code: "400010", name: "삼성 KoAct 국내액티브" },
  { code: "451170", name: "TIMEFOLIO Korea플러스배당액티브" },
  { code: "364970", name: "TIMEFOLIO 글로벌AI인공지능액티브" },
];

const CACHE_KEY = "kr_etf_holdings_v1";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

// In-memory token cache
let tokenCache: { token: string; expiresAt: number } | null = null;

async function getKisToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  const res = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: KIS_APP_KEY,
      appsecret: KIS_APP_SECRET,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`KIS token error: ${res.status}`);
  const data = await res.json();
  const token = data.access_token as string;
  tokenCache = { token, expiresAt: Date.now() + 55 * 60 * 1000 };
  return token;
}

interface Holding {
  rank: number;
  code: string;
  name: string;
  weight: number;
  price: number;
  chgPct: number;
}

async function fetchHoldings(token: string, etfCode: string): Promise<Holding[]> {
  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: "J",
    FID_INPUT_ISCD: etfCode,
    FID_COND_SCR_DIV_CODE: "11216",
  });
  const res = await fetch(
    `${KIS_BASE}/uapi/etfetn/v1/quotations/inquire-component-stock-price?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        appkey: KIS_APP_KEY,
        appsecret: KIS_APP_SECRET,
        tr_id: "FHKST121600C0",
        custtype: "P",
      },
      signal: AbortSignal.timeout(10000),
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  const items = data.output2;
  if (!Array.isArray(items)) return [];

  return items
    .filter((item: Record<string, string>) => item.hts_kor_isnm && item.stck_shrn_iscd)
    .map((item: Record<string, string>, idx: number) => ({
      rank: idx + 1,
      code: item.stck_shrn_iscd,
      name: item.hts_kor_isnm,
      weight: parseFloat(item.etf_cnfg_issu_rlim || "0"),
      price: parseInt(item.stck_prpr || "0", 10),
      chgPct: parseFloat(item.prdy_ctrt || "0"),
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
    const token = await getKisToken();

    // Fetch all ETFs sequentially to avoid rate limits
    const etfs: { code: string; name: string; holdings: Holding[] }[] = [];
    for (const etf of KR_ETF_LIST) {
      const holdings = await fetchHoldings(token, etf.code);
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
