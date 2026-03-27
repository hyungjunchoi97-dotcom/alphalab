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
    // 1. Fetch Walter Bloomberg messages from last 24h
    const res = await fetch(`${APP_URL}/api/telegram/feed?channel=WalterBloomberg`, {
      signal: AbortSignal.timeout(30000),
    });
    const json = await res.json();
    if (!json.ok) {
      return NextResponse.json({ ok: false, error: "Failed to fetch telegram feed" }, { status: 502 });
    }

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const messages = (json.messages ?? [])
      .filter((m: { date: number; text: string }) => m.date > oneDayAgo && m.text.length > 10)
      .slice(0, 30);

    if (messages.length === 0) {
      return NextResponse.json({ ok: true, message: "No messages in last 24h" });
    }

    // 2. Build prompt
    const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
    const newsText = messages
      .map((m: { text: string }, i: number) => `${i + 1}. ${m.text.slice(0, 300)}`)
      .join("\n\n");

    const prompt = `너는 AlphaLab 글로벌 뉴스 요약 봇임.
아래는 오늘 Walter Bloomberg 텔레그램 채널에서 수집한 글로벌 뉴스 헤드라인들임.

[뉴스 원문]
${newsText}

[작성 조건]
- 음슴체 사용 (~임, ~함, ~보임)
- 투자자 관점에서 핵심만 요약
- AI 느낌 나는 문장 금지
- 이모지 적절히 사용
- 섹션 구분: 지정학/전쟁, 미국 경제/연준, 시장/주식, 크립토, 기타

[글 구조]
제목: ${today} 글로벌 마켓 브리핑

본문:
1. 📌 핵심 요약 (3줄 이내)
2. 🌍 지정학/전쟁
3. 🇺🇸 미국 경제/연준
4. 📈 시장/주식
5. ₿ 크립토
6. 💡 투자 시사점 (2-3줄)

마지막 줄: "자세한 글로벌 속보는 AlphaLab 헤드라인 탭에서 확인 가능함"

다른 설명 없이 제목과 본문만 출력할 것.`;

    // 3. Call Claude Haiku
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
    const titleMatch = raw.match(/제목:\s*(.+)/);
    const bodyMatch = raw.match(/본문:\s*([\s\S]+)/);
    const title = titleMatch?.[1]?.trim() ?? `${today} 글로벌 마켓 브리핑`;
    const content = bodyMatch?.[1]?.trim() ?? raw.trim();

    // 4. Insert post to community
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
