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

    const prompt = `너는 글로벌 매크로 투자 리포트를 작성하는 AlphaLab 분석 봇임.

아래는 최근 12시간 블룸버그 속보 헤드라인 목록임:

${headlines}

---

[작성 규칙]

1. 헤드라인을 분석해서 아래 카테고리 중 실제로 등장한 것만 골라서 섹션을 구성할 것. 없는 카테고리는 절대 만들지 말 것.

카테고리 목록:
- 🇺🇸 미국 정치/트럼프 (트럼프 발언, 행정명령, 대통령 관련)
- 🌍 지정학/분쟁 (이란, 러시아, 중동, NATO, 우크라이나 등)
- 📊 경제지표 (고용, 물가, 소비, 주택, GDP 등)
- 🏦 연준/금리 (Fed, 금리, 테이퍼링, FOMC 관련)
- 📈 시장/자산가격 (주가지수, 채권, 달러, 원자재)
- 🪙 크립토 (비트코인, 이더리움, 알트코인)
- ⚡ 기타 속보 (자연재해, 사건사고, 기타 돌발)

2. 각 섹션은 2~3줄로 핵심만 요약. 음슴체 사용 (~함, ~보임, ~임, ~한 상황임)

3. 섹션이 1개뿐일 경우: 해당 섹션만 집중적으로 4~5줄로 확장해서 작성할 것

4. 마지막 줄은 항상: "📌 출처: Bloomberg (@WalterBloomberg) | AlphaLab 자동 리포트"

5. 총 글자수 500~800자 유지

6. 투자 권유 절대 금지. AI 냄새 나는 문장 금지. 다른 설명 없이 본문만 출력.`;

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
        max_tokens: 1500,
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
    const hh = String(kst.getUTCHours()).padStart(2, "0");
    const title = `BBG_REPORT_${yyyy}${mm}${dd}_${hh}`;

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
