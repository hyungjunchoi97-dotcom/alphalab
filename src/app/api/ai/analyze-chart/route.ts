import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are an expert technical analyst. Analyze the provided chart image and return STRICT JSON only — no markdown, no code fences, no extra text.

## Analysis Requirements

**Entry**: Provide an exact price level. Explain WHY this level (e.g. "breakout above resistance", "retest of support", "pullback to EMA").

**Stop Loss**: Exact price level. Include the % distance from entry (e.g. "$142.50 (-3.2% from entry)").

**Targets**: Three take-profit levels with risk/reward ratio for each:
- TP1: Conservative target (e.g. "1:1.5 R:R")
- TP2: Moderate target (e.g. "1:2.5 R:R")
- TP3: Extended target (e.g. "1:4 R:R")

**Thesis**: 2-3 sentences MAX. Reference specific patterns (e.g. "bull flag", "inverse H&S", "ascending triangle") and indicators visible on the chart (e.g. "RSI divergence", "MACD crossover", "volume spike").

**Invalidation**: The exact price level that proves the setup wrong and why (e.g. "Below $140 — breaks the ascending trendline from March lows").

**Key Levels**: Identify the nearest support and resistance levels visible on the chart.

**Risk/Reward**: Overall risk/reward ratio for the primary target (TP2).

**Confidence**: Score from 0-100 based on:
- Pattern clarity (is the pattern well-formed?)
- Volume confirmation (does volume support the move?)
- Trend alignment (is the setup aligned with the higher timeframe trend?)

**Scenarios**: Bullish and bearish outcomes with specific price targets and catalysts.

## JSON Schema (match exactly)
{
  "entry": "string — exact price with reasoning",
  "stopLoss": "string — exact price with % distance",
  "targets": { "tp1": "string — price + R:R", "tp2": "string — price + R:R", "tp3": "string — price + R:R" },
  "thesis": "string — 2-3 sentences, specific patterns/indicators",
  "invalidation": "string — exact price + why it invalidates",
  "confidence": number (0-100),
  "keyLevels": { "support": "string", "resistance": "string" },
  "riskReward": "string — e.g. 1:2.5",
  "scenarios": { "bullish": "string", "bearish": "string" }
}

If any field is unclear from the chart, provide your best-effort estimate and note uncertainty in the thesis.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Expected multipart/form-data" },
      { status: 400 }
    );
  }

  const imageFile = formData.get("image") as File | null;
  if (!imageFile || !imageFile.type.startsWith("image/")) {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid image file" },
      { status: 400 }
    );
  }

  const prompt = (formData.get("prompt") as string) || "";
  const stockName = (formData.get("stockName") as string) || "";
  const timeframe = (formData.get("timeframe") as string) || "";
  const lang = (formData.get("lang") as string) || "en";

  const buffer = Buffer.from(await imageFile.arrayBuffer());
  const base64Data = buffer.toString("base64");
  const mediaType = imageFile.type as
    | "image/jpeg"
    | "image/png"
    | "image/gif"
    | "image/webp";

  const userText = [
    stockName && `Stock: ${stockName}`,
    timeframe && `Timeframe: ${timeframe}`,
    prompt && `Additional context: ${prompt}`,
    "Analyze the chart and respond with strict JSON only.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      temperature: 0.2,
      system: lang === "kr"
        ? SYSTEM_PROMPT + "\n\nIMPORTANT: Respond entirely in Korean. All string values in the JSON (entry, stopLoss, targets, thesis, invalidation, scenarios, keyLevels, riskReward) must be written in Korean."
        : SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64Data },
            },
            { type: "text", text: userText },
          ],
        },
      ],
    });

    const raw =
      message.content[0].type === "text" ? message.content[0].text : "";

    try {
      const data = JSON.parse(raw);
      return NextResponse.json({ ok: true, data });
    } catch {
      return NextResponse.json(
        { ok: false, error: "Failed to parse AI JSON response", raw },
        { status: 502 }
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
