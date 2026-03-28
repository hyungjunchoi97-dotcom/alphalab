import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 60;

const BOT_USER_ID = process.env.BOT_USER_ID ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://thealphalabs.net";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!BOT_USER_ID) {
    return NextResponse.json({ ok: false, error: "BOT_USER_ID not configured" }, { status: 500 });
  }

  try {
    // 1. Fetch Walter Bloomberg headlines
    const res = await fetch(`${APP_URL}/api/telegram/feed?channel=WalterBloomberg`, {
      signal: AbortSignal.timeout(30000),
    });
    const json = await res.json();
    if (!json.ok) {
      return NextResponse.json({ ok: false, error: "Failed to fetch telegram feed" }, { status: 502 });
    }

    // 2. Filter last 12 hours
    const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
    const messages = (json.messages ?? [])
      .filter((m: { date: number; text: string }) => m.date > twelveHoursAgo && m.text.length > 10)
      .slice(0, 40);

    if (messages.length < 3) {
      return NextResponse.json({ ok: true, message: "Not enough headlines" });
    }

    // 3. Build prompt
    const headlines = messages
      .map((m: { text: string }) => m.text.replace(/\(@WalterBloomberg\)/g, "").trim().slice(0, 300))
      .join("\n");

    const prompt = `너는 글로벌 매크로 투자 전문 애널리스트임. 아래 블룸버그 속보를 바탕으로 한국 개인투자자를 위한 심층 데일리 리포트를 작성해줘.

[헤드라인 목록]
${headlines}

---

[작성 규칙]

1. 아래 카테고리 중 헤드라인에 실제로 등장한 것만 섹션 구성. 없는 카테고리는 절대 만들지 말 것.

카테고리:
- 🇺🇸 미국 정치/트럼프
- 🌍 지정학/분쟁
- 📊 경제지표
- 🏦 연준/금리
- 📈 시장/자산가격
- 🪙 크립토
- ⚡ 기타 속보

2. 각 섹션 작성 방식:
- 단순 사실 나열 금지. 각 섹션당 해당 뉴스의 배경, 의미, 한국 시장/투자자 관점에서의 시사점까지 포함해서 3~5줄로 작성
- 음슴체 사용 (~함, ~보임, ~임, ~한 상황임, ~할 가능성 있음)
- 숫자/수치가 있으면 반드시 포함

3. 섹션이 1~2개뿐일 경우: 해당 섹션을 6~8줄로 더 깊게 분석

4. 마지막에 [오늘의 핵심 요약] 섹션 추가:
- 오늘 가장 중요한 뉴스 2~3개를 한 줄씩 bullet로 정리
- 한국 투자자 관점 코멘트 1줄

5. 맨 마지막 줄: "📌 출처: Bloomberg (@WalterBloomberg) | AlphaLab 자동 리포트"

6. 총 글자수 800~1200자. 투자 권유 절대 금지. AI 냄새 나는 문장 금지. 다른 설명 없이 본문만 출력.`;

    // 4. Call Claude Haiku
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      return NextResponse.json({ ok: false, error: "Claude API error" }, { status: 502 });
    }

    const claudeJson = await claudeRes.json();
    const content: string = claudeJson.content?.[0]?.text ?? "";

    if (!content.trim()) {
      return NextResponse.json({ ok: false, error: "Empty response from Claude" }, { status: 502 });
    }

    // 5. Generate title with KST time
    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const yyyy = kst.getUTCFullYear();
    const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(kst.getUTCDate()).padStart(2, "0");
    const title = `데일리 리포트 ${yyyy}년 ${mm}월 ${dd}일`;

    // 6. Insert post
    const { data, error } = await supabaseAdmin.from("posts").insert({
      title,
      content: content.trim(),
      category: "news_run",
      user_id: BOT_USER_ID,
      author_nickname: "AlphaLab",
      author_email: null,
      is_bot: true,
    }).select("id").single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, postId: data?.id, title });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Unknown",
    }, { status: 500 });
  }
}
