import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ ok: false, error: "text required" }, { status: 400 });
    }

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: "Translate the following English text to Korean concisely. Return only the translated text, no explanations.",
      messages: [{ role: "user", content: text }],
    });

    const translated =
      msg.content[0].type === "text" ? msg.content[0].text : "";

    return NextResponse.json({ ok: true, translated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
