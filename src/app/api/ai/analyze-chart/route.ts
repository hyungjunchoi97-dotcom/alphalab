import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are an institutional-grade technical analyst. Analyze the provided chart image and return STRICT JSON only — no markdown, no code fences, no extra text.

## JSON Schema (match exactly)
{
  "assessment": "BUY" | "HOLD" | "SELL",
  "pattern": {
    "nameEn": "string — English pattern name (e.g. Ascending Triangle)",
    "nameKr": "string — Korean pattern name (e.g. 상승 삼각형)",
    "interpretation": "string — one-line Korean interpretation of the pattern"
  },
  "entry": "string — exact entry price (numbers only, e.g. 52,400)",
  "target": "string — exact target price",
  "stopLoss": "string — exact stop-loss price",
  "entryPercent": "string — % change from current price (e.g. +2.1%)",
  "targetPercent": "string — % change from entry (e.g. +10.7%)",
  "stopLossPercent": "string — % change from entry (e.g. -5.0%)",
  "conviction": number (0-100),
  "convictionLabel": "HIGH" | "MEDIUM" | "LOW"
}

## Rules
- assessment: BUY if bullish setup, SELL if bearish setup, HOLD if neutral/unclear
- conviction: 70+ = HIGH, 40-69 = MEDIUM, below 40 = LOW
- All prices should be formatted with commas for readability
- Pattern interpretation must be in Korean, one sentence max
- Be specific about price levels based on what you see in the chart`;

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

  const lang = (formData.get("lang") as string) || "en";

  const buffer = Buffer.from(await imageFile.arrayBuffer());
  const base64Data = buffer.toString("base64");
  const mediaType = imageFile.type as
    | "image/jpeg"
    | "image/png"
    | "image/gif"
    | "image/webp";

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64Data },
            },
            { type: "text", text: "Analyze the chart and respond with strict JSON only." },
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
