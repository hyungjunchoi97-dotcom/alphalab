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
    // 1. Fetch Walter Bloomberg messages from last 12h
    const res = await fetch(`${APP_URL}/api/telegram/feed?channel=WalterBloomberg`, {
      signal: AbortSignal.timeout(30000),
    });
    const json = await res.json();
    if (!json.ok) {
      return NextResponse.json({ ok: false, error: "Failed to fetch telegram feed" }, { status: 502 });
    }

    const now = Date.now();
    const twelveHoursAgo = now - 12 * 60 * 60 * 1000;

    const messages = (json.messages ?? [])
      .filter((m: { date: number; text: string }) => m.date > twelveHoursAgo && m.text.length > 10)
      .slice(0, 40);

    if (messages.length === 0) {
      return NextResponse.json({ ok: true, message: "No messages in last 12h" });
    }

    // 2. Build news text
    const newsText = messages
      .map((m: { text: string }, i: number) => `${i + 1}. ${m.text.replace(/\(@WalterBloomberg\)/g, "").trim().slice(0, 300)}`)
      .join("\n\n");

    // 3. Determine AM/PM
    const kstHour = new Date().getUTCHours() + 9;
    const timeLabel = kstHour < 12 ? "오전" : "오후";
    const today = new Date().toLocaleDateString("ko-KR", {
      year: "numeric", month: "2-digit", day: "2-digit"
    }).replace(/\. /g, ".").replace(/\.$/, "");

    const prompt = `너는 글로벌 금융 시장 전문 애널리스트임.
아래는 지난 12시간 동안 Walter Bloomberg 텔레그램에서 수집한 글로벌 속보 헤드라인들임.

[헤드라인 목록]
${newsText}

[작성 규칙]
- 음슴체 사용 (~임, ~함, ~보임, ~한 상황임)
- 투자자 관점에서 핵심만 간결하게
- 감탄사/AI 느낌 문장 금지
- 이모지 섹션별 1개씩만
- 중복/유사 뉴스는 합쳐서 하나로 요약
- 각 섹션에 해당 뉴스 없으면 해당 섹션 완전히 생략

[출력 구조 - 해당 내용 없는 섹션은 생략할 것]
제목: ${today} ${timeLabel} 글로벌 마켓 브리핑

📌 핵심 요약
(가장 중요한 시장 이슈 3줄 이내)

🌍 지정학/전쟁
(지정학, 전쟁, 외교 관련 뉴스만. 없으면 이 섹션 전체 생략)

🇺🇸 미국 경제/연준
(금리, 고용, 물가, GDP, 연준 발언 등. 없으면 생략)

📈 주식/시장
(주요 지수, 섹터, 개별주 이슈. 없으면 생략)

₿ 크립토
(비트코인, 이더리움, 주요 알트 이슈. 없으면 생략)

💡 투자 시사점
(이 뉴스들이 시장에 미치는 영향 2-3줄)

마지막 줄: "자세한 속보는 AlphaLab 글로벌속보 탭에서 확인 가능함"

다른 설명 없이 제목과 본문만 출력할 것.`;

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
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      return NextResponse.json({ ok: false, error: "Claude API error" }, { status: 502 });
    }

    const claudeJson = await claudeRes.json();
    const raw: string = claudeJson.content?.[0]?.text ?? "";

    // Parse title and content
    const lines = raw.trim().split("\n");
    const titleLine = lines.find(l => l.startsWith("제목:"));
    const title = titleLine?.replace("제목:", "").trim() ?? `${today} ${timeLabel} 글로벌 마켓 브리핑`;
    const content = raw.replace(titleLine ?? "", "").trim();

    // 5. Insert post to community as news_run
    const { data, error } = await supabaseAdmin.from("posts").insert({
      title,
      content,
      category: "news_run",
      user_id: BOT_USER_ID,
      author_nickname: "AlphaLab",
      is_bot: true,
    }).select("id").single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, postId: data?.id, title, newsCount: messages.length });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Unknown",
    }, { status: 500 });
  }
}
