import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are an institutional-grade technical analyst. Analyze the chart image and return ONLY a valid JSON object with no markdown, no explanation:
{
  "signal": "BUY" | "HOLD" | "SELL",
  "pattern": { "english": "string", "korean": "string" },
  "interpretation": "string (Korean, max 30 chars, professional tone like Goldman Sachs)",
  "entry": { "price": number|null, "target": number|null, "targetPct": number|null, "stopLoss": number|null, "stopLossPct": number|null },
  "conviction": "HIGH" | "MEDIUM" | "LOW"
}
Base analysis purely on technical patterns, support/resistance, volume, momentum. If exact prices cannot be determined, set entry fields to null.`;

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
      const parsed = JSON.parse(raw);
      const data = {
        signal: parsed.signal ?? "HOLD",
        pattern: {
          english: parsed.pattern?.english ?? "",
          korean: parsed.pattern?.korean ?? "",
        },
        interpretation: parsed.interpretation ?? "",
        entry: {
          price: parsed.entry?.price ?? null,
          target: parsed.entry?.target ?? null,
          targetPct: parsed.entry?.targetPct ?? null,
          stopLoss: parsed.entry?.stopLoss ?? null,
          stopLossPct: parsed.entry?.stopLossPct ?? null,
        },
        conviction: parsed.conviction ?? "MEDIUM",
      };
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
