import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface ExplainBody {
  ticker: string;
  name: string;
  price: number;
  chgPct: number;
  metrics: {
    chg1d: number;
    chg5d: number;
    chg20d: number;
    near52wHigh: boolean;
    volumeSpike: boolean;
    tradingValue: number;
  };
  headlines?: string[];
  mode: "fomo" | "value" | "high52";
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, raw: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  let body: ExplainBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, raw: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { ticker, name, price, chgPct, metrics, headlines, mode } = body;
  if (!ticker || !name || price == null || chgPct == null || !metrics || !mode) {
    return NextResponse.json(
      { ok: false, raw: "Missing required fields" },
      { status: 400 }
    );
  }

  const headlineBlock =
    headlines && headlines.length > 0
      ? `Recent headlines:\n${headlines.map((h) => `- ${h}`).join("\n")}`
      : "No headlines available.";

  const prompt = `You are a concise Korean stock market analyst. Given data about ${name} (${ticker}), explain why this stock is moving or notable.

Mode: ${mode === "fomo" ? "FOMO/Momentum" : mode === "high52" ? "52-week high breakout analysis" : "Value-lite/Pullback recovery"}
Price: ₩${price.toLocaleString()} (${chgPct >= 0 ? "+" : ""}${chgPct}%)
1D: ${metrics.chg1d >= 0 ? "+" : ""}${metrics.chg1d}% | 5D: ${metrics.chg5d >= 0 ? "+" : ""}${metrics.chg5d}% | 20D: ${metrics.chg20d >= 0 ? "+" : ""}${metrics.chg20d}%
Near 52W high: ${metrics.near52wHigh ? "Yes" : "No"}
Volume spike: ${metrics.volumeSpike ? "Yes" : "No"}
Trading value: ₩${metrics.tradingValue.toLocaleString()}억

${headlineBlock}

Return ONLY valid JSON (no markdown, no code fences):
{"bullets":["...","...","..."],"risk":"one-line risk note","confidence":0.0-1.0}

Rules:
- Max 3 bullets, each <=120 chars
- If insufficient info, explain likely drivers and set confidence low
- Base analysis only on the provided data and headlines`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
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
    return NextResponse.json({ ok: false, raw: msg }, { status: 500 });
  }
}
