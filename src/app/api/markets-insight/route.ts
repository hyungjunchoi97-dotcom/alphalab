import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const cacheMap = new Map<string, { insight: string; cachedAt: number }>();

const MARKET_PROMPTS: Record<string, { system: string; context: string }> = {
  KR: {
    system: "You are a senior equity strategist at Goldman Sachs covering Korean equities. Write in Korean.",
    context: "한국 반도체 사이클, KOSPI/KOSDAQ 동향, 외국인 수급, 원달러 환율 영향을 중심으로 한국 시장 현황을 분석하세요.",
  },
  US: {
    system: "You are a senior macro strategist at Goldman Sachs covering US markets. Write in Korean.",
    context: "미국 연준 금리 정책, 인플레이션 동향, S&P500/NASDAQ 밸류에이션, VIX 수준, 달러 인덱스를 중심으로 미국 시장 현황을 분석하세요.",
  },
  JP: {
    system: "You are a senior strategist at Goldman Sachs covering Japanese markets. Write in Korean.",
    context: "일본은행(BOJ) 금리 정책, 엔화 방향성, 닛케이225 동향, 일본 수출기업 실적 전망을 중심으로 일본 시장 현황을 분석하세요.",
  },
  BR: {
    system: "You are a senior EM strategist at Goldman Sachs covering Brazilian markets. Write in Korean.",
    context: "브라질 셀릭 금리, 헤알화 환율, 국채 투자 매력도, Bovespa 동향, 한국 투자자 관점의 브라질 국채 투자 리스크/리턴을 분석하세요.",
  },
};

export async function POST(req: Request) {
  let body: { market?: string; data?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const market = (body.market || "KR").toUpperCase();
  const extraData = body.data || "";

  const cached = cacheMap.get(market);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return NextResponse.json({ ok: true, insight: cached.insight, source: "cache" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const prompts = MARKET_PROMPTS[market];
  if (!prompts) {
    return NextResponse.json({ ok: false, error: `Unknown market: ${market}` }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const message = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: `${prompts.system}

Rules:
- 3-4 sentences max
- Goldman Sachs morning note tone
- Use terms like '확인', '시사', '전망', '주목'
- No emojis, no markdown
- Plain text only
- Reference specific data points when available`,
        messages: [{
          role: "user",
          content: `${prompts.context}\n\n${extraData ? `Current data:\n${extraData}` : "Use your current knowledge of market conditions as of today."}\n\nWrite the market insight now.`,
        }],
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const insight = message.content[0].type === "text" ? message.content[0].text : "";
    cacheMap.set(market, { insight, cachedAt: Date.now() });

    return NextResponse.json({ ok: true, insight, source: "live" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[markets-insight] ${market} error:`, msg);

    const stale = cacheMap.get(market);
    if (stale) {
      return NextResponse.json({ ok: true, insight: stale.insight, source: "stale" });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
