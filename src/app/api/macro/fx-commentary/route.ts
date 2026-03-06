import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

interface CacheEntry {
  text: string;
  cachedAt: number;
}

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
let cache: CacheEntry | null = null;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
    return NextResponse.json({ ok: true, commentary: cache.text });
  }

  try {
    const body = await req.json();
    const { usdkrw, spread, vix, krCpi, usCpi } = body;

    const client = new Anthropic({ apiKey });

    const prompt = `당신은 Goldman Sachs FX 애널리스트입니다. 다음 데이터를 바탕으로 향후 1개월 원달러 환율 방향성을 간결하고 전문적으로 분석해주세요. 3-4문장으로 핵심만.

현재 데이터:
- USD/KRW: ${usdkrw}원
- 한미 금리차 (Fed - KR): ${spread}%p
- VIX: ${vix}
- 한국 CPI YoY: ${krCpi}%
- 미국 CPI YoY: ${usCpi}%`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    cache = { text, cachedAt: Date.now() };
    return NextResponse.json({ ok: true, commentary: text });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
