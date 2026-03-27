import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

const anthropic = new Anthropic();

export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.has("force");

    // 1. Check Supabase cache (24h TTL)
    if (!force) {
      try {
        const { data: cached } = await supabaseAdmin
          .from("usd_hegemony_cache")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (cached) {
          const age = Date.now() - new Date(cached.created_at).getTime();
          if (age < 24 * 60 * 60 * 1000) {
            return NextResponse.json({
              ok: true,
              data: cached.brief,
              cached: true,
              generatedAt: cached.created_at,
            });
          }
        }
      } catch {
        /* table may not exist yet */
      }
    }

    // 2. Fetch news context (5s timeout)
    let newsContext = "";
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 5000);
      const newsRes = await fetch(`${baseUrl}/api/news/geopolitical`, { signal: ac.signal });
      clearTimeout(timer);
      const newsData = await newsRes.json();
      if (newsData.ok) {
        newsContext = newsData.items
          .slice(0, 10)
          .map((item: { source: string; title: string }) => `[${item.source}] ${item.title}`)
          .join("\n");
      }
    } catch {
      /* ignore */
    }

    // 3. Generate with Claude
    const today = new Date().toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });

    const prompt = `You are a senior macro strategist specializing in reserve currency dynamics and sovereign debt markets (Bridgewater / BIS caliber).
Write in precise, institutional research note style. No casual language, no hedging qualifiers, no filler.
Date: ${today}

Recent headlines:
${newsContext || "(No live feed — base analysis on prevailing conditions)"}

Return ONLY valid JSON (no markdown code blocks). Bilingual: Korean + English.

{
  "stressLevel": "LOW or ELEVATED or CRITICAL",
  "analysis": "3-4 sentences. Current dollar hegemony stress assessment: US debt/GDP trajectory, Fed-Treasury policy tension, foreign central bank reserve diversification pace, BRICS settlement alternatives progress. Reference specific data points (DXY level, 10Y yield, debt/GDP ratio). Institutional precision. (Korean)",
  "analysisEN": "Same in English",
  "criticalWatch": [
    {"trigger": "Specific threshold or event to monitor (Korean)", "triggerEN": "Same in English", "threshold": "Quantitative threshold value (e.g. DXY < 95, 10Y > 5.5%, debt/GDP > 130%)"},
    {"trigger": "Second trigger (Korean)", "triggerEN": "Same in English", "threshold": "Threshold value"}
  ],
  "drukView": "One sentence: Luke Gromen / Jeff Snider style — global dollar liquidity conditions, eurodollar stress, collateral quality. (Korean)",
  "drukViewEN": "Same in English",
  "zeihanView": "One sentence: Peter Zeihan style — structural geopolitical dollar demand from US naval hegemony, energy trade denomination, demographic advantage. (Korean)",
  "zeihanViewEN": "Same in English"
}

CRITICAL:
- stressLevel must be exactly "LOW", "ELEVATED", or "CRITICAL"
- Reference real data points and current levels
- Korean text in formal institutional register
- All analysis must reflect conditions as of ${today}`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const data = JSON.parse(text.replace(/```json|```/g, "").trim());

    // 4. Cache in Supabase
    try {
      await supabaseAdmin.from("usd_hegemony_cache").insert({
        brief: data,
        created_at: new Date().toISOString(),
      });
    } catch {
      /* table may not exist */
    }

    return NextResponse.json({
      ok: true,
      data,
      cached: false,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
