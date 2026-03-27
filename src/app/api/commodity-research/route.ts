import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

const anthropic = new Anthropic();

export const maxDuration = 60;

// Map commodity keys to Yahoo Finance ticker IDs used by /api/macro/commodities
const COMMODITY_YAHOO_MAP: Record<string, string> = {
  OIL: "WTI",
  GAS: "NATGAS",
  GOLD: "GOLD",
  COPPER: "COPPER",
  LITHIUM: "LITHIUM",
  NICKEL: "NICKEL",
  SILVER: "SILVER",
  COAL: "COAL",
  URANIUM: "URANIUM",
  ALUMINUM: "ALUMINUM",
  WHEAT: "WHEAT",
};

const COMMODITY_NAMES: Record<string, string> = {
  OIL: "Crude Oil (WTI)",
  GAS: "Natural Gas (Henry Hub)",
  GOLD: "Gold",
  COPPER: "Copper",
  LITHIUM: "Lithium (LIT ETF proxy)",
  NICKEL: "Nickel",
  SILVER: "Silver",
  COAL: "Coal (Newcastle)",
  URANIUM: "Uranium (U3O8 spot)",
  ALUMINUM: "Aluminum (LME)",
  WHEAT: "Wheat (CBOT front month)",
};

const ONE_DAY = 24 * 60 * 60 * 1000;

// Strip citation tags from Claude web_search responses
function stripCitations(obj: Record<string, unknown>): Record<string, unknown> {
  const clean = { ...obj };
  for (const key of Object.keys(clean)) {
    const val = clean[key];
    if (typeof val === "string") {
      clean[key] = val.replace(/<\/?cite[^>]*>/g, "");
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      clean[key] = stripCitations(val as Record<string, unknown>);
    }
  }
  return clean;
}

// Cache key helper
function cacheKey(commodityId: string) {
  return `commodity_research_${commodityId}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const commodity = searchParams.get("commodity")?.toUpperCase() || "";
    const force = searchParams.has("force");

    if (!COMMODITY_NAMES[commodity]) {
      return NextResponse.json({ ok: false, error: "Invalid commodity" }, { status: 400 });
    }

    // One-time purge: ?purge clears ALL cache rows
    if (searchParams.has("purge")) {
      try {
        const { count } = await supabaseAdmin
          .from("commodity_research_cache")
          .delete({ count: "exact" })
          .neq("commodity", "__never_match__"); // delete all rows
        console.log(`[CommodityResearch] PURGE: deleted ${count ?? 0} total cache rows`);
        return NextResponse.json({ ok: true, purged: count ?? 0 });
      } catch (e) {
        return NextResponse.json({ ok: false, error: `Purge failed: ${e}` }, { status: 500 });
      }
    }

    // 1. Fetch current price from /api/macro/commodities
    let currentPrice = 0;
    let changePercent = 0;
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 10000);
      const res = await fetch(`${baseUrl}/api/macro/commodities`, { signal: ac.signal });
      clearTimeout(timer);
      const json = await res.json();
      if (json.ok) {
        const yahooId = COMMODITY_YAHOO_MAP[commodity];
        const item = json.data?.find((d: { id: string }) => d.id === yahooId);
        if (item) {
          currentPrice = item.current;
          changePercent = item.changePercent;
        }
      }
    } catch {
      /* continue without price */
    }

    console.log(`[CommodityResearch] Request for commodity=${commodity}`);

    // 2. Check Supabase cache (24h TTL, keyed by commodity)
    let cachedScenarios = null;
    let cachedPrice = 0;
    let cacheAge = Infinity;
    let cachedCommodityId: string | null = null;

    if (!force) {
      try {
        const ck = cacheKey(commodity);
        const { data: cached, error: cacheErr } = await supabaseAdmin
          .from("commodity_research_cache")
          .select("*")
          .eq("commodity", ck)
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();

        if (cacheErr) {
          console.log(`[CommodityResearch] Cache miss for ${commodity}: ${cacheErr.message}`);
        } else if (cached) {
          cachedCommodityId = cached.commodity;
          cacheAge = Date.now() - new Date(cached.updated_at).getTime();
          cachedScenarios = cached.scenarios_json;
          cachedPrice = cached.price_at_update || 0;
          console.log(`[CommodityResearch] Cache hit: requested=${commodity} cached=${cachedCommodityId} age=${Math.round(cacheAge / 60000)}min`);

          // Safety check: if cached row commodity doesn't match request, discard
          if (cachedCommodityId !== ck) {
            console.warn(`[CommodityResearch] MISMATCH: requested=${ck} but got cached=${cachedCommodityId} — discarding`);
            cachedScenarios = null;
            cachedCommodityId = null;
          }
        }
      } catch {
        console.log(`[CommodityResearch] Cache table may not exist for ${commodity}`);
      }
    } else {
      console.log(`[CommodityResearch] Force refresh for ${commodity}, skipping cache`);
    }

    // 3. Determine if we need to regenerate scenarios
    const priceChangeSinceCached = cachedPrice > 0 && currentPrice > 0
      ? Math.abs((currentPrice - cachedPrice) / cachedPrice * 100)
      : 0;
    const priceAlert = priceChangeSinceCached >= 10;
    const needsRefresh = force || !cachedScenarios || cacheAge > ONE_DAY || priceAlert;

    if (!needsRefresh && cachedScenarios) {
      console.log(`[CommodityResearch] Returning cached data for ${commodity}`);
      return NextResponse.json({
        ok: true,
        commodity,
        scenarios: cachedScenarios,
        currentPrice,
        changePercent,
        priceAlert: false,
        cached: true,
      });
    }

    console.log(`[CommodityResearch] Generating fresh scenarios for ${commodity} (force=${force} cacheAge=${Math.round(cacheAge / 60000)}min priceAlert=${priceAlert})`);

    // 4. Generate scenarios with Claude + web_search
    const name = COMMODITY_NAMES[commodity];
    const priceStr = currentPrice > 0 ? `$${currentPrice}` : "unavailable";
    const changeStr = currentPrice > 0 ? `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%` : "N/A";

    const now = new Date();
    const monthYear = now.toLocaleString("en-US", { month: "long", year: "numeric" });

    const prompt = `You are a Goldman Sachs Global Commodities MD writing an internal strategy note.

First, search for: '${name} price outlook ${monthYear} key driver'
Identify the SINGLE most important current price driver right now.

Then generate 3 scenarios based on THAT specific driver only.

Commodity: ${name}
CURRENT MARKET PRICE: ${priceStr}
24h change: ${changeStr}
${priceAlert ? `ALERT: Price moved ${priceChangeSinceCached.toFixed(1)}% since last update.` : ""}

Return ONLY valid JSON (no markdown code blocks). Write in Korean (institutional register).

{
  "current_driver": {
    "headline": "10 words max, the key issue e.g. 'Iran-US escalation risk'",
    "context": "2 sentences max explaining why this is THE driver right now"
  },
  "bull": {
    "trigger": "1 sentence: specific event that causes this scenario",
    "outcome": "1 sentence: direct price/market consequence",
    "price_target": "specific price target range relative to current ${priceStr}",
    "korea_play": "1 sentence: specific Korean stocks/sectors"
  },
  "base": {
    "trigger": "1 sentence",
    "outcome": "1 sentence",
    "price_target": "specific price target range around current ${priceStr}",
    "korea_play": "1 sentence"
  },
  "bear": {
    "trigger": "1 sentence",
    "outcome": "1 sentence",
    "price_target": "specific price target range below current ${priceStr}",
    "korea_play": "1 sentence"
  }
}

IMPORTANT: You are analyzing ${name} only. Do not reference any other commodity.

Rules:
- Each trigger/outcome: 1 sentence maximum, no exceptions
- No generic text. Every sentence must reference the current_driver
- Tone: GS internal memo, zero hedging language
- Price targets must be relative to current price: ${priceStr}
- Korean text in formal institutional research register
- No disclaimers`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: prompt }],
    });

    // Extract text from response (may contain tool_use + text blocks)
    let text = "";
    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
      }
    }
    const rawScenarios = JSON.parse(text.replace(/```json|```/g, "").trim());
    const scenarios = stripCitations(rawScenarios);

    // 5. Cache in Supabase (delete old rows for THIS commodity, then insert fresh)
    const ckWrite = cacheKey(commodity);
    try {
      const { count: deletedCount } = await supabaseAdmin
        .from("commodity_research_cache")
        .delete({ count: "exact" })
        .eq("commodity", ckWrite);
      console.log(`[CommodityResearch] Deleted ${deletedCount ?? 0} old cache rows for ${ckWrite}`);

      const { error: insertErr } = await supabaseAdmin.from("commodity_research_cache").insert({
        commodity: ckWrite,
        scenarios_json: scenarios,
        price_at_update: currentPrice,
        change_pct: changePercent,
        price_alert: priceAlert,
        updated_at: new Date().toISOString(),
      });
      if (insertErr) {
        console.error(`[CommodityResearch] Cache insert failed for ${commodity}:`, insertErr.message);
      } else {
        console.log(`[CommodityResearch] Cached fresh scenarios for ${commodity}`);
      }
    } catch {
      console.log(`[CommodityResearch] Cache table may not exist`);
    }

    return NextResponse.json({
      ok: true,
      commodity,
      scenarios,
      currentPrice,
      changePercent,
      priceAlert,
      cached: false,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
