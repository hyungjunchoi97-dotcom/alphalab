import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface AnalyzeBody {
  image: string; // base64 data URL
  ticker: string;
  timeframe: string;
  userPrompt: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  let body: AnalyzeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { image, ticker, timeframe, userPrompt } = body;
  if (!image || !ticker || !timeframe || !userPrompt) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields (image, ticker, timeframe, userPrompt)" },
      { status: 400 }
    );
  }

  // Extract base64 data and media type from data URL
  const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) {
    return NextResponse.json(
      { ok: false, error: "Invalid image data URL" },
      { status: 400 }
    );
  }
  const mediaType = match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  const base64Data = match[2];

  const prompt = `Return ONLY valid JSON (no markdown, no code fences):
{
  "entry": "price level",
  "stop": "price level",
  "targets": ["TP1", "TP2", "TP3"],
  "thesis": "2-3 sentence analysis",
  "invalidation": "condition that invalidates the trade",
  "scenarios": {
    "bullish": "brief bullish scenario",
    "bearish": "brief bearish scenario"
  },
  "confidence": 0.0-1.0
}

Ticker: ${ticker}
Timeframe: ${timeframe}

User Strategy Prompt:
${userPrompt}

Analyze the uploaded chart accordingly.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    const raw =
      message.content[0].type === "text" ? message.content[0].text : "";

    try {
      const data = JSON.parse(raw);
      return NextResponse.json({ ok: true, data, raw });
    } catch {
      return NextResponse.json({ ok: false, raw });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
