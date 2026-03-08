import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are a professional technical analyst trained in Mark Minervini (SEPA/VCP), William O'Neil (CAN SLIM), and Stan Weinstein (Stage Analysis). Analyze the chart with institutional precision.

ANALYSIS FRAMEWORK:

1. STAGE ANALYSIS (Weinstein):
- Stage 1: Basing below flat 30W MA → avoid
- Stage 2: Advancing above rising 30W MA → only stage to buy
- Stage 3: Topping, choppy near highs → reduce/avoid
- Stage 4: Declining below falling 30W MA → short only

2. BASE PATTERN (O'Neil/Minervini):
Identify: Cup with Handle (min 7W), Flat Base (min 5W, <15% depth), VCP - Volatility Contraction Pattern (series of contractions with decreasing volume each time, e.g. 25%→15%→8%), Double Bottom, IPO Base, or No Valid Base.
Record: pattern name, depth %, duration in weeks, number of VCP contractions.

3. PIVOT POINT: Exact buy point — base high, handle high, or early entry at mid-handle.

4. VOLUME:
- CONSTRUCTIVE: drying up in base (bullish)
- BREAKOUT_VOLUME: +40% above avg on breakout day (O'Neil rule)
- CLIMACTIC: abnormally high on extended move (warning)
- WEAK: low volume breakout (invalid)

5. MOVING AVERAGES: Price vs 10W/30W MA. Bullish alignment = 10W > 30W and both rising.

6. SIGNAL:
- BUY: Stage 2 + valid base + clear pivot + constructive/breakout volume
- HOLD: Stage 1/3, incomplete base, or extended <5% past pivot
- SELL: Stage 3/4, climactic volume, or breakdown

7. PRICE LEVELS (Minervini hard rules):
- Entry: at or just above pivot
- Stop: 7-8% below entry OR below base low (whichever is tighter)
- Target: minimum 2.5x risk (stop 7% below = target minimum +17.5%)
- BUY rule: target MUST be > entry MUST be > stop. Absolute. No exceptions.
- SELL rule: target MUST be < entry MUST be < stop. No exceptions.

8. CONVICTION:
- HIGH: Stage 2 + clean VCP or flat base + volume drying in base + clear pivot
- MEDIUM: Stage 2 but messy base or unclear MA
- LOW: mixed signals, extended, or <5 weeks base

Return ONLY valid JSON, no other text:
{
  "signal": "BUY"|"HOLD"|"SELL",
  "stage": "STAGE_1"|"STAGE_2"|"STAGE_3"|"STAGE_4"|null (null if MA lines not visible),
  "pattern": "패턴명 (한국어)",
  "pattern_detail": "base depth%, weeks, VCP contraction count",
  "volume_character": "CONSTRUCTIVE"|"BREAKOUT_VOLUME"|"CLIMACTIC"|"WEAK"|null (null if volume bars not visible),
  "pivot": number,
  "entry": number,
  "target": number,
  "stop": number,
  "rr_ratio": number,
  "interpretation": "3-4 sentences Korean, Goldman Sachs tone. State: stage, pattern quality, volume character, exact trading plan. No hedging.",
  "conviction": "LOW"|"MEDIUM"|"HIGH",
  "minervini_score": number (0-10)
}`;

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
      max_tokens: 1500,
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

      let data = {
        signal: parsed.signal ?? "HOLD",
        stage: parsed.stage ?? null,
        pattern: parsed.pattern ?? "",
        pattern_detail: parsed.pattern_detail ?? "",
        volume_character: parsed.volume_character ?? null,
        pivot: typeof parsed.pivot === "number" ? parsed.pivot : null,
        entry: typeof parsed.entry === "number" ? parsed.entry : null,
        target: typeof parsed.target === "number" ? parsed.target : null,
        stop: typeof parsed.stop === "number" ? parsed.stop : null,
        rr_ratio: typeof parsed.rr_ratio === "number" ? parsed.rr_ratio : null,
        interpretation: parsed.interpretation ?? "",
        conviction: parsed.conviction ?? "MEDIUM",
        minervini_score: typeof parsed.minervini_score === "number" ? parsed.minervini_score : null,
      };

      // Server-side validation
      const { signal, entry, target, stop } = data;
      let valid = true;

      if (entry != null && target != null && stop != null) {
        if (signal === "BUY" && !(target > entry && entry > stop)) {
          valid = false;
        }
        if (signal === "SELL" && !(target < entry && entry < stop)) {
          valid = false;
        }

        // Recalculate R/R ratio
        const risk = Math.abs(entry - stop);
        const reward = Math.abs(target - entry);
        if (risk > 0) {
          data.rr_ratio = Math.round((reward / risk) * 100) / 100;
          if (data.rr_ratio < 1.5) {
            valid = false;
          }
        } else {
          valid = false;
        }
      }

      if (!valid) {
        data = {
          ...data,
          signal: "HOLD",
          interpretation: "가격 레벨 검증 실패 — 명확한 셋업이 확인되지 않습니다.",
          conviction: "LOW",
        };
      }

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
