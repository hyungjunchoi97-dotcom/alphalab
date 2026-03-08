import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// ── Cache ────────────────────────────────────────────────────

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
let cache: { data: { analysis: string; market: string }; cachedAt: number; market: string } | null = null;

// ── Types ────────────────────────────────────────────────────

interface SectorData {
  ticker: string;
  name: string;
  nameKr: string;
  quadrant: string;
  current: { rsRatio: number; rsMomentum: number };
  chg5d: number;
}

// ── Route handler ────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const market = searchParams.get("market") || "KR";

  // Check cache
  if (cache && cache.market === market && Date.now() - cache.cachedAt < CACHE_TTL) {
    return NextResponse.json({ ok: true, ...cache.data, source: "cache" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    // Fetch RRG data from internal API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    const rrgRes = await fetch(`${baseUrl}/api/ideas/rrg`, {
      headers: { "Content-Type": "application/json" },
    });
    const rrgJson = await rrgRes.json();

    if (!rrgJson.ok) {
      return NextResponse.json({ ok: false, error: "Failed to fetch RRG data" }, { status: 500 });
    }

    const sectors: SectorData[] = market === "KR" ? rrgJson.kr : rrgJson.us;
    if (!sectors || sectors.length === 0) {
      return NextResponse.json({ ok: false, error: "No sector data available" }, { status: 500 });
    }

    // Build sector data summary for Claude
    const sectorSummary = sectors.map((s) => {
      return `${s.nameKr}(${s.name}): Quadrant=${s.quadrant}, RS-Ratio=${s.current.rsRatio.toFixed(2)}, RS-Momentum=${s.current.rsMomentum.toFixed(2)}, 5D Chg=${s.chg5d >= 0 ? "+" : ""}${s.chg5d.toFixed(2)}%`;
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
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const analysis = message.content[0].type === "text" ? message.content[0].text : "";

    const result = { analysis, market };
    cache = { data: result, cachedAt: Date.now(), market };

    return NextResponse.json({ ok: true, ...result, source: "live" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (cache) {
      return NextResponse.json({ ok: true, ...cache.data, source: "stale" });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
