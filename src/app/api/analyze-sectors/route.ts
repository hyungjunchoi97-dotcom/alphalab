import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// ── Cache ────────────────────────────────────────────────────

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const cacheMap = new Map<string, { analysis: string; cachedAt: number }>();

// ── Types ────────────────────────────────────────────────────

interface SectorInput {
  name: string;
  nameKr: string;
  quadrant: string;
  rsRatio: number;
  rsMomentum: number;
  chg5d: number;
}

// ── Route handler ────────────────────────────────────────────

export async function POST(req: Request) {
  let body: { market?: string; sectors?: SectorInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const market = body.market || "KR";
  const sectors = body.sectors;

  if (!sectors || !Array.isArray(sectors) || sectors.length === 0) {
    return NextResponse.json({ ok: false, error: "No sector data provided" }, { status: 400 });
  }

  // Check cache
  const cached = cacheMap.get(market);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return NextResponse.json({ ok: true, analysis: cached.analysis, market, source: "cache" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    // Build sector data summary for Claude
    const sectorSummary = sectors.map((s) => {
      return `${s.nameKr}(${s.name}): Quadrant=${s.quadrant}, RS-Ratio=${s.rsRatio.toFixed(2)}, RS-Momentum=${s.rsMomentum.toFixed(2)}, 5D Chg=${s.chg5d >= 0 ? "+" : ""}${s.chg5d.toFixed(2)}%`;
    }).join("\n");

    const systemPrompt = `You are a senior equity strategist at Goldman Sachs. Write a concise sector rotation analysis in Korean based on the RRG (Relative Rotation Graph) data provided.

Format:
- First sentence: What RRG is and what it shows (one sentence only, assume reader is somewhat familiar)
- 2-3 sentences: Current notable sector movements and what they signal
- 1 sentence: Key actionable insight for Korean investors

Style rules:
- Institutional tone, no emojis
- Use terms like '확인', '시사', '전망', '포착'
- Max 5 sentences total
- Reference specific sectors by name
- Sound like a Goldman Sachs morning note
- Return plain text only, no markdown formatting`;

    const userPrompt = `Market: ${market === "KR" ? "한국 KOSPI 섹터 ETF" : "US S&P 500 Sector ETFs"}
Analysis Period: 8 weeks trailing

Current Sector Positions:
${sectorSummary}

Write the sector rotation analysis now.`;

    const client = new Anthropic({ apiKey });

    // 30 second timeout via AbortController
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const message = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const analysis = message.content[0].type === "text" ? message.content[0].text : "";

    // Update cache
    cacheMap.set(market, { analysis, cachedAt: Date.now() });

    return NextResponse.json({ ok: true, analysis, market, source: "live" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[analyze-sectors] Error:", msg);

    // Return stale cache if available
    const stale = cacheMap.get(market);
    if (stale) {
      return NextResponse.json({ ok: true, analysis: stale.analysis, market, source: "stale" });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
