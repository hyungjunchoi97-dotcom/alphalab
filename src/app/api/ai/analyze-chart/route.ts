import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `You are an expert trend-following trader and chart analyst.
Analyze the uploaded chart image using the following framework.
Respond in Korean. Be direct and concise — no fluff.

## STEP 1: 추세 구조 파악 (Trend Structure)
- 현재 추세 방향: 상승 / 하락 / 횡보
- 고점·저점 구조: 고고저고(HH/HL) 상승 또는 저고저저(LH/LL) 하락 여부
- 주요 이동평균선 위치 (20MA, 50MA, 200MA 보이는 경우): 가격이 어디에 위치하는가
- 추세 강도: 강함 / 보통 / 약함

## STEP 2: 거래량 분석 (Volume Analysis)
- 최근 거래량이 평균 대비 증가/감소 여부
- 상승 시 거래량 vs 하락 시 거래량 비교
- 거래량 클라이맥스 또는 드라이업(dry-up) 패턴 존재 여부
- 거래량이 추세를 확인하는가, 아니면 발산(divergence)하는가

## STEP 3: 핵심 지지·저항 (Support & Resistance)
- 주요 지지선 가격대 (1~2개)
- 주요 저항선 가격대 (1~2개)
- 현재 가격의 위치 (지지·저항 사이 어디쯤인가)

## STEP 4: 추세추종 관점 진입 판단
- 현재 진입 가능한 셋업인가: YES / NO / WAIT
- YES라면: 진입 근거, 손절 기준, 1차 목표가
- NO/WAIT라면: 어떤 조건이 충족되면 진입 가능한가
- 추세추종 관점에서 가장 주목할 포인트 한 줄 요약

## 출력 형식
각 STEP을 명확히 구분해서 출력.
수치나 가격대가 차트에서 읽히면 구체적으로 언급.
불확실한 부분은 솔직하게 "확인 불가"로 표기.
분석은 간결하고 실용적으로. 500자 이내로 마무리.`;

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
            { type: "text", text: "이 차트를 분석해주세요." },
          ],
        },
      ],
    });

    const raw =
      message.content[0].type === "text" ? message.content[0].text : "";

    if (!raw.trim()) {
      return NextResponse.json(
        { ok: false, error: "AI가 빈 응답을 반환했습니다" },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, data: raw });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
