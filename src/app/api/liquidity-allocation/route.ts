import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 60;

const anthropic = new Anthropic();
const ONE_DAY = 24 * 60 * 60 * 1000;

function stripCitations(text: string): string {
  return text.replace(/<\/?cite[^>]*>/g, "");
}

// POST: receive indicators + regime from client (no self-referencing)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { indicators, regime } = body;

    if (!indicators || !regime || indicators.length < 4) {
      return NextResponse.json({ ok: false, error: "Missing indicators/regime" }, { status: 400 });
    }

    const allocationCacheKey = "fed_liquidity_allocation";

    // 1. Check cache (24h, invalidated on regime change)
    try {
      const { data: cached } = await supabaseAdmin
        .from("liquidity_allocation_cache")
        .select("*")
        .eq("cache_key", allocationCacheKey)
        .maybeSingle();

      if (cached && Date.now() - new Date(cached.updated_at).getTime() < ONE_DAY && cached.regime === regime.label) {
        return NextResponse.json({ ok: true, allocation: cached.allocation, regime: regime.label, cached: true });
      }
    } catch { /* table may not exist */ }

    // 2. Generate allocation with Claude
    const trendStr = (ind: { trend: string }) => ind.trend === "up" ? "increasing" : ind.trend === "down" ? "decreasing" : "flat";

    const prompt = `You are a global macro portfolio strategist.
Current Fed liquidity data:
- Fed Balance Sheet: ${indicators[0].displayValue} (trend: ${trendStr(indicators[0])}, status: ${indicators[0].status})
- RRP: ${indicators[1].displayValue} (trend: ${trendStr(indicators[1])}, status: ${indicators[1].status})
- TGA: ${indicators[2].displayValue} (trend: ${trendStr(indicators[2])}, status: ${indicators[2].status})
- Bank Reserves: ${indicators[3].displayValue} (trend: ${trendStr(indicators[3])}, status: ${indicators[3].status})
- Liquidity Regime: ${regime.label} (score: ${regime.score}/100)

Based on this liquidity environment, recommend asset allocation for a Korean retail investor.
Assets: 주식(Stocks), 원자재(Commodities), 현금(Cash), 채권(Bonds)
Total must equal 100%.

Respond in JSON only (no markdown code blocks):
{
  "stocks": { "pct": number, "direction": "OVERWEIGHT"|"NEUTRAL"|"UNDERWEIGHT", "reason": "Korean, max 20 chars" },
  "commodities": { "pct": number, "direction": "OVERWEIGHT"|"NEUTRAL"|"UNDERWEIGHT", "reason": "Korean, max 20 chars" },
  "cash": { "pct": number, "direction": "OVERWEIGHT"|"NEUTRAL"|"UNDERWEIGHT", "reason": "Korean, max 20 chars" },
  "bonds": { "pct": number, "direction": "OVERWEIGHT"|"NEUTRAL"|"UNDERWEIGHT", "reason": "Korean, max 20 chars" },
  "rationale": ["3-4 bullet strings in Korean explaining the allocation logic"]
}`;

    const res = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    let text = "";
    for (const block of res.content) {
      if (block.type === "text") text += block.text;
    }
    text = stripCitations(text.replace(/```json|```/g, "").trim());
    const allocation = JSON.parse(text);

    // 3. Cache
    try {
      await supabaseAdmin.from("liquidity_allocation_cache").upsert({
        cache_key: allocationCacheKey,
        allocation,
        regime: regime.label,
        updated_at: new Date().toISOString(),
      }, { onConflict: "cache_key" });
    } catch { /* ok */ }

    return NextResponse.json({ ok: true, allocation, regime: regime.label, cached: false });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
