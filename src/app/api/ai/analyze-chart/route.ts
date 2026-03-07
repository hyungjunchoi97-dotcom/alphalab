import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are an expert technical analyst. Analyze the provided chart image and return STRICT JSON only — no markdown, no code fences, no extra text.

## Analysis Requirements

**Entry**: Exact price level with brief reasoning (e.g. "52,400 — breakout above descending wedge resistance").

**Stop Loss**: Exact price level with % distance from entry (e.g. "49,800 (-5.0% from entry)").

**Target**: Single take-profit level with risk/reward ratio (e.g. "58,000 (1:2.3 R:R)").

**Thesis**: 2-4 sentences of clean, professional technical analysis. Reference specific patterns and indicators visible on the chart. Be concise and actionable.

**Confidence**: Score from 0-100 based on pattern clarity, volume confirmation, and trend alignment.

**Key Levels**: Nearest support and resistance levels visible on the chart.

**Risk/Reward**: Overall risk/reward ratio for the target.

## JSON Schema (match exactly)
{
  "entry": "string — exact price with reasoning",
  "stopLoss": "string — exact price with % distance",
  "target": "string — price + R:R ratio",
  "thesis": "string — 2-4 sentences, specific patterns/indicators",
  "confidence": number (0-100),
  "keyLevels": { "support": "string", "resistance": "string" },
  "riskReward": "string — e.g. 1:2.3"
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
      max_tokens: 1000,
      temperature: 0.2,
      system: lang === "kr"
        ? SYSTEM_PROMPT + "\n\nIMPORTANT: Respond entirely in Korean. All string values in the JSON must be written in Korean."
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
