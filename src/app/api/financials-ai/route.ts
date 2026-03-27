import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });

export async function POST(req: NextRequest) {
  try {
    const { ticker, market, financialData } = await req.json();

    if (!ticker || !financialData) {
      return NextResponse.json({ ok: false, error: "ticker and financialData required" }, { status: 400 });
    }

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: `You are a senior equity analyst at a top-tier investment bank.
Analyze the provided financial statements and return a structured JSON analysis.
Be concise, data-driven, and professional. Use specific numbers from the data.
Respond in Korean if market is KR, English if market is US.
Return ONLY valid JSON, no markdown.`,
      messages: [
        {
          role: "user",
          content: `Analyze these financial statements for ${ticker} (${market || "US"}):
${JSON.stringify(financialData)}

Return JSON:
{
  "summary": "3-4 sentences. Overall financial health assessment with key metrics.",
  "profitability": { "rating": "Strong|Moderate|Weak", "analysis": "2-3 sentences with specific numbers." },
  "growth": { "rating": "Accelerating|Stable|Declining", "analysis": "2-3 sentences YoY trend." },
  "financial_health": { "rating": "Solid|Adequate|Stretched", "analysis": "2-3 sentences on leverage/liquidity." },
  "cashflow": { "rating": "Strong|Moderate|Weak", "analysis": "2-3 sentences FCF quality." },
  "risks": ["risk1", "risk2", "risk3"],
  "investment_view": { "stance": "Positive|Neutral|Cautious", "rationale": "2-3 sentences." }
}`,
        },
      ],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const analysis = JSON.parse(text);

    return NextResponse.json({ ok: true, analysis });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
