import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 60;

const anthropic = new Anthropic();
const FRED_API_KEY = process.env.FRED_API_KEY;
const ONE_DAY = 24 * 60 * 60 * 1000;

// ── Types ──────────────────────────────────────────────────
interface IndicatorResult {
  id: string;
  label: string;
  labelKr: string;
  value: number;
  displayValue: string;
  trend: "up" | "down" | "flat";
  change: number;
  changePercent: number;
  status: string;
  statusLevel: "normal" | "warning" | "critical";
}

// ── Fallback data (updated periodically) ───────────────────
const FALLBACK: Record<string, { latest: number; previous: number }> = {
  WALCL:     { latest: 6_724_000, previous: 6_730_000 },   // millions
  RRPONTSYD: { latest: 58,       previous: 62 },            // billions
  WTREGEN:   { latest: 842_000,  previous: 830_000 },       // millions
  WRESBAL:   { latest: 3_180_000, previous: 3_200_000 },    // millions
};

// ── Direct FRED fetch ──────────────────────────────────────
interface FredObs { date: string; value: string }

async function fetchFredSeries(seriesId: string): Promise<{ latest: number; previous: number } | null> {
  if (!FRED_API_KEY) {
    console.error("[Liquidity] FRED_API_KEY not set");
    return null;
  }
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=5`;
    console.log(`[Liquidity] Fetching FRED ${seriesId}...`);
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.error(`[Liquidity] FRED ${seriesId} HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    const obs: FredObs[] = (json.observations || []).filter((o: FredObs) => o.value !== ".");
    if (obs.length < 1) return null;

    const latest = parseFloat(obs[0].value);
    const previous = obs.length > 1 ? parseFloat(obs[1].value) : latest;
    if (isNaN(latest)) return null;

    console.log(`[Liquidity] FRED ${seriesId} = ${latest}`);
    return { latest, previous };
  } catch (e) {
    console.error(`[Liquidity] FRED ${seriesId} failed:`, e);
    return null;
  }
}

// ── Fetch M2SL with YoY computation ─────────────────────────
async function fetchM2YoY(): Promise<{ latest: number; previous: number; yoyPct: number; prevYoyPct: number } | null> {
  if (!FRED_API_KEY) return null;
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=M2SL&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=15`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const json = await res.json();
    const obs: FredObs[] = (json.observations || []).filter((o: FredObs) => o.value !== ".").reverse();
    if (obs.length < 13) return null;
    const latest = parseFloat(obs[obs.length - 1].value);
    const yearAgo = parseFloat(obs[obs.length - 13].value);
    const previous = parseFloat(obs[obs.length - 2].value);
    const twoYearsAgo = obs.length >= 14 ? parseFloat(obs[obs.length - 14].value) : yearAgo;
    if (isNaN(latest) || isNaN(yearAgo) || yearAgo === 0) return null;
    const yoyPct = ((latest / yearAgo) - 1) * 100;
    const prevYoyPct = previous && twoYearsAgo ? ((previous / twoYearsAgo) - 1) * 100 : yoyPct;
    return { latest, previous, yoyPct: Math.round(yoyPct * 100) / 100, prevYoyPct: Math.round(prevYoyPct * 100) / 100 };
  } catch { return null; }
}

// ── Fetch DXY from Yahoo Finance ─────────────────────────────
async function fetchDXY(): Promise<{ latest: number; previous: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1d&range=5d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;
    const price = result.meta?.regularMarketPrice;
    const prevClose = result.meta?.chartPreviousClose ?? result.meta?.previousClose;
    if (price == null || isNaN(price)) return null;
    return { latest: Math.round(price * 100) / 100, previous: prevClose != null ? Math.round(prevClose * 100) / 100 : price };
  } catch { return null; }
}

// ── Status badge logic ─────────────────────────────────────
function getWALCLStatus(valueT: number): { status: string; statusLevel: "normal" | "warning" | "critical" } {
  if (valueT > 7.5) return { status: "EXPANDING", statusLevel: "normal" };
  if (valueT >= 6.5) return { status: "NEUTRAL", statusLevel: "warning" };
  return { status: "QT ACTIVE", statusLevel: "critical" };
}

function getRRPStatus(valueB: number): { status: string; statusLevel: "normal" | "warning" | "critical" } {
  if (valueB > 500) return { status: "BUFFER RICH", statusLevel: "normal" };
  if (valueB >= 100) return { status: "DRAINING", statusLevel: "warning" };
  return { status: "NEAR ZERO", statusLevel: "critical" };
}

function getTGAStatus(valueB: number): { status: string; statusLevel: "normal" | "warning" | "critical" } {
  if (valueB < 300) return { status: "INJECTING", statusLevel: "normal" };
  if (valueB <= 700) return { status: "NEUTRAL", statusLevel: "warning" };
  return { status: "ABSORBING", statusLevel: "critical" };
}

function getRESStatus(valueT: number): { status: string; statusLevel: "normal" | "warning" | "critical" } {
  if (valueT > 3.5) return { status: "AMPLE", statusLevel: "normal" };
  if (valueT >= 2.5) return { status: "ADEQUATE", statusLevel: "warning" };
  return { status: "TIGHTENING", statusLevel: "critical" };
}

// ── Regime calculation ─────────────────────────────────────
function calcRegime(indicators: IndicatorResult[]): { score: number; label: string; level: "easing" | "neutral" | "tightening" | "crisis" } {
  let score = 0;
  for (const ind of indicators) {
    score += ind.statusLevel === "normal" ? 25 : ind.statusLevel === "warning" ? 15 : 5;
  }
  if (score >= 75) return { score, label: "EASING", level: "easing" };
  if (score >= 50) return { score, label: "NEUTRAL", level: "neutral" };
  if (score >= 25) return { score, label: "TIGHTENING", level: "tightening" };
  return { score, label: "CRISIS", level: "crisis" };
}

// ── Format helpers ─────────────────────────────────────────
function formatTrillions(millions: number): string {
  const t = millions / 1_000_000;
  return `$${t.toFixed(2)}T`;
}
function formatBillions(billions: number): string {
  if (billions >= 1000) return `$${(billions / 1000).toFixed(2)}T`;
  return `$${billions.toFixed(0)}B`;
}

function stripCitations(text: string): string {
  return text.replace(/<\/?cite[^>]*>/g, "");
}

// ── Main handler ───────────────────────────────────────────
export async function GET() {
  try {
    // 1. Fetch FRED data directly (no self-referencing)
    const seriesIds = ["WALCL", "RRPONTSYD", "WTREGEN", "WRESBAL"] as const;
    const results = await Promise.allSettled(seriesIds.map((id) => fetchFredSeries(id)));

    let useFallback = false;
    const raw: Record<string, { latest: number; previous: number }> = {};

    for (let i = 0; i < seriesIds.length; i++) {
      const r = results[i];
      const id = seriesIds[i];
      if (r.status === "fulfilled" && r.value) {
        raw[id] = r.value;
      } else {
        console.warn(`[Liquidity] Using fallback for ${id}`);
        raw[id] = FALLBACK[id];
        useFallback = true;
      }
    }

    // WALCL, WTREGEN, WRESBAL are in millions; RRPONTSYD is in billions
    const walclT = raw.WALCL.latest / 1_000_000;
    const rrpB = raw.RRPONTSYD.latest;
    const tgaB = raw.WTREGEN.latest / 1000;
    const resT = raw.WRESBAL.latest / 1_000_000;

    const mkChange = (r: { latest: number; previous: number }) => ({
      change: r.latest - r.previous,
      changePercent: r.previous !== 0 ? ((r.latest - r.previous) / Math.abs(r.previous)) * 100 : 0,
    });

    const indicators: IndicatorResult[] = [
      {
        id: "WALCL", label: "Fed Balance Sheet", labelKr: "연준 대차대조표",
        value: raw.WALCL.latest, displayValue: formatTrillions(raw.WALCL.latest),
        trend: mkChange(raw.WALCL).change > 0 ? "up" : mkChange(raw.WALCL).change < 0 ? "down" : "flat",
        ...mkChange(raw.WALCL), ...getWALCLStatus(walclT),
      },
      {
        id: "RRPONTSYD", label: "Reverse Repo (RRP)", labelKr: "역레포 (RRP)",
        value: raw.RRPONTSYD.latest, displayValue: formatBillions(rrpB),
        trend: mkChange(raw.RRPONTSYD).change > 0 ? "up" : mkChange(raw.RRPONTSYD).change < 0 ? "down" : "flat",
        ...mkChange(raw.RRPONTSYD), ...getRRPStatus(rrpB),
      },
      {
        id: "WTREGEN", label: "TGA Balance", labelKr: "재무부 일반계좌 (TGA)",
        value: raw.WTREGEN.latest, displayValue: formatBillions(tgaB),
        trend: mkChange(raw.WTREGEN).change > 0 ? "up" : mkChange(raw.WTREGEN).change < 0 ? "down" : "flat",
        ...mkChange(raw.WTREGEN), ...getTGAStatus(tgaB),
      },
      {
        id: "WRESBAL", label: "Bank Reserves", labelKr: "은행 지급준비금",
        value: raw.WRESBAL.latest, displayValue: formatTrillions(raw.WRESBAL.latest),
        trend: mkChange(raw.WRESBAL).change > 0 ? "up" : mkChange(raw.WRESBAL).change < 0 ? "down" : "flat",
        ...mkChange(raw.WRESBAL), ...getRESStatus(resT),
      },
    ];

    const regime = calcRegime(indicators);

    // 1b. Fetch extended indicators (M2, SOFR, HY spread, DXY) in parallel
    const [m2Result, sofrResult, fedfundsResult, hyResult, dxyResult] = await Promise.allSettled([
      fetchM2YoY(),
      fetchFredSeries("SOFR"),
      fetchFredSeries("FEDFUNDS"),
      fetchFredSeries("BAMLH0A0HYM2"),
      fetchDXY(),
    ]);

    const extendedIndicators: IndicatorResult[] = [];

    // M2 YoY
    const m2 = m2Result.status === "fulfilled" ? m2Result.value : null;
    if (m2) {
      const yoy = m2.yoyPct;
      const prevYoy = m2.prevYoyPct;
      const st = yoy > 8 ? { status: "EXPANDING", statusLevel: "normal" as const }
        : yoy > 3 ? { status: "NORMAL", statusLevel: "normal" as const }
        : yoy > 0 ? { status: "SLOWING", statusLevel: "warning" as const }
        : { status: "CONTRACTION", statusLevel: "critical" as const };
      extendedIndicators.push({
        id: "M2_YOY", label: "M2 Growth YoY", labelKr: "M2 증가율",
        value: yoy, displayValue: `${yoy.toFixed(1)}%`,
        trend: yoy > prevYoy ? "up" : yoy < prevYoy ? "down" : "flat",
        change: Math.round((yoy - prevYoy) * 100) / 100,
        changePercent: prevYoy !== 0 ? Math.round(((yoy - prevYoy) / Math.abs(prevYoy)) * 10000) / 100 : 0,
        ...st,
      });
    }

    // SOFR Spread (SOFR - Fed Funds, in basis points)
    const sofr = sofrResult.status === "fulfilled" ? sofrResult.value : null;
    const ff = fedfundsResult.status === "fulfilled" ? fedfundsResult.value : null;
    if (sofr && ff) {
      const spreadBp = Math.round((sofr.latest - ff.latest) * 100);
      const prevSpreadBp = Math.round((sofr.previous - ff.previous) * 100);
      const st = Math.abs(spreadBp) < 10 ? { status: "NORMAL", statusLevel: "normal" as const }
        : Math.abs(spreadBp) <= 25 ? { status: "ELEVATED", statusLevel: "warning" as const }
        : { status: "STRESS", statusLevel: "critical" as const };
      extendedIndicators.push({
        id: "SOFR_SPREAD", label: "SOFR Spread", labelKr: "SOFR 스프레드",
        value: spreadBp, displayValue: `${spreadBp}bp`,
        trend: spreadBp > prevSpreadBp ? "up" : spreadBp < prevSpreadBp ? "down" : "flat",
        change: spreadBp - prevSpreadBp,
        changePercent: prevSpreadBp !== 0 ? ((spreadBp - prevSpreadBp) / Math.abs(prevSpreadBp)) * 100 : 0,
        ...st,
      });
    }

    // HY Spread (BAMLH0A0HYM2 OAS — proxy for credit stress)
    const hy = hyResult.status === "fulfilled" ? hyResult.value : null;
    if (hy) {
      const st = hy.latest < 3 ? { status: "NORMAL", statusLevel: "normal" as const }
        : hy.latest <= 5 ? { status: "ELEVATED", statusLevel: "warning" as const }
        : { status: "STRESS", statusLevel: "critical" as const };
      extendedIndicators.push({
        id: "HY_SPREAD", label: "HY Credit Spread", labelKr: "HY 신용 스프레드",
        value: hy.latest, displayValue: `${hy.latest.toFixed(2)}%`,
        trend: mkChange(hy).change > 0 ? "up" : mkChange(hy).change < 0 ? "down" : "flat",
        ...mkChange(hy), ...st,
      });
    }

    // DXY
    const dxy = dxyResult.status === "fulfilled" ? dxyResult.value : null;
    if (dxy) {
      const st = dxy.latest > 106 ? { status: "STRONG", statusLevel: "critical" as const }
        : dxy.latest > 100 ? { status: "ELEVATED", statusLevel: "warning" as const }
        : dxy.latest > 95 ? { status: "NEUTRAL", statusLevel: "normal" as const }
        : { status: "WEAK", statusLevel: "normal" as const };
      extendedIndicators.push({
        id: "DXY", label: "Dollar Index", labelKr: "DXY 달러",
        value: dxy.latest, displayValue: `${dxy.latest.toFixed(1)}`,
        trend: mkChange(dxy).change > 0 ? "up" : mkChange(dxy).change < 0 ? "down" : "flat",
        ...mkChange(dxy), ...st,
      });
    }

    // 2. AI Assessment (cached 24h in Supabase) — skip if using fallback
    let aiAssessment: string | null = null;
    const aiCacheKey = "fed_liquidity_assessment";

    if (!useFallback) {
      try {
        const { data: cached } = await supabaseAdmin
          .from("liquidity_ai_cache")
          .select("*")
          .eq("cache_key", aiCacheKey)
          .maybeSingle();

        if (cached && Date.now() - new Date(cached.updated_at).getTime() < ONE_DAY && cached.regime === regime.label) {
          aiAssessment = cached.content;
        }
      } catch { /* table may not exist */ }

      if (!aiAssessment) {
        try {
          const trendStr = (ind: IndicatorResult) => ind.trend === "up" ? "증가 중" : ind.trend === "down" ? "감소 중" : "보합";
          const prompt = `You are a Fed liquidity analyst following 성상현(Sung Sang-hyun)'s framework (Fed Balance Sheet → RRP buffer → TGA direction → Bank Reserves as the final result).

Given these values:
- Fed Balance Sheet (WALCL): ${indicators[0].displayValue} (${trendStr(indicators[0])}, ${indicators[0].status})
- Reverse Repo (RRP): ${indicators[1].displayValue} (${trendStr(indicators[1])}, ${indicators[1].status})
- TGA Balance: ${indicators[2].displayValue} (${trendStr(indicators[2])}, ${indicators[2].status})
- Bank Reserves: ${indicators[3].displayValue} (${trendStr(indicators[3])}, ${indicators[3].status})
- Liquidity Regime: ${regime.label} (score: ${regime.score}/100)

Write 2-3 sentences explaining the current liquidity regime and what to watch. Be specific about numbers. Write in Korean. No disclaimers.`;

          const res = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 500,
            messages: [{ role: "user", content: prompt }],
          });

          let text = "";
          for (const block of res.content) {
            if (block.type === "text") text += block.text;
          }
          aiAssessment = stripCitations(text.trim());

          try {
            await supabaseAdmin.from("liquidity_ai_cache").upsert({
              cache_key: aiCacheKey,
              content: aiAssessment,
              regime: regime.label,
              updated_at: new Date().toISOString(),
            }, { onConflict: "cache_key" });
          } catch { /* ok */ }
        } catch (e) {
          console.error("[Liquidity] AI assessment failed:", e);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      indicators,
      extendedIndicators,
      regime,
      aiAssessment,
      stale: useFallback,
      updatedAt: new Date().toISOString(),
    }, {
      headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600" },
    });
  } catch (err) {
    // NEVER return error — always return fallback data
    console.error("[Liquidity] Fatal error, returning fallback:", err);

    const fallbackIndicators: IndicatorResult[] = [
      { id: "WALCL", label: "Fed Balance Sheet", labelKr: "연준 대차대조표", value: 6_724_000, displayValue: "$6.72T", trend: "down", change: -6000, changePercent: -0.09, status: "NEUTRAL", statusLevel: "warning" },
      { id: "RRPONTSYD", label: "Reverse Repo (RRP)", labelKr: "역레포 (RRP)", value: 58, displayValue: "$58B", trend: "down", change: -4, changePercent: -6.5, status: "NEAR ZERO", statusLevel: "critical" },
      { id: "WTREGEN", label: "TGA Balance", labelKr: "재무부 일반계좌 (TGA)", value: 842_000, displayValue: "$842B", trend: "up", change: 12000, changePercent: 1.4, status: "ABSORBING", statusLevel: "critical" },
      { id: "WRESBAL", label: "Bank Reserves", labelKr: "은행 지급준비금", value: 3_180_000, displayValue: "$3.18T", trend: "down", change: -20000, changePercent: -0.63, status: "ADEQUATE", statusLevel: "warning" },
    ];

    return NextResponse.json({
      ok: true,
      indicators: fallbackIndicators,
      regime: { score: 40, label: "TIGHTENING", level: "tightening" as const },
      aiAssessment: null,
      stale: true,
      updatedAt: new Date().toISOString(),
    });
  }
}
