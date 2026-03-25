import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 60;

const BOT_USER_ID = process.env.BOT_USER_ID ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://alphalab-kappa.vercel.app";

interface FomoItem {
  ticker: string;
  name: string;
  nameKr: string;
  price: number;
  chgPct: number;
  tag: string;
  volumeRatio: number;
  metrics: {
    chg1d: number;
    chg5d: number;
    chg20d: number;
    near52wHigh: boolean;
  };
}

function buildPrompt(item: FomoItem): string {
  return `너는 AlphaLab 투자 커뮤니티의 데이터 분석 봇임.
아래 종목 데이터를 기반으로 커뮤니티 분석 게시글을 작성해줘.

[종목 데이터]
- 종목명: ${item.nameKr} (${item.ticker})
- 현재가: ${item.price}원
- 등락률: ${item.chgPct}%
- 거래량 비율: 평균 대비 ${item.volumeRatio.toFixed(1)}배
- 시그널: ${item.tag}
- 1일 변화: ${item.metrics.chg1d}% / 5일: ${item.metrics.chg5d}% / 20일: ${item.metrics.chg20d}%
- 52주 신고가 여부: ${item.metrics.near52wHigh ? "예" : "아니오"}

[문체 조건]
- 음슴체 사용 (~함, ~보임, ~한 상황임)
- 자연스럽고 약간 거친 개인 투자자 느낌
- "..." 자연스럽게 섞기
- 투자 권유 절대 금지
- AI 느낌 나는 문장 금지
- 모르면 "확인 필요해 보임"으로 처리

[글 구조]
1. 제목 (30자 이내, 종목명 + 핵심 포인트)
2. 본문 (300~500자):
   - 오늘 수급 특징 (거래량 급증 이유 추정)
   - 가격 흐름 해석 (1일/5일/20일 흐름)
   - 주목해야 할 포인트 2~3개
   - 리스크 한 줄
   - 마지막 줄: "자세한 데이터는 AlphaLab FOMO 스크리너에서 확인 가능함"

[출력 형식]
제목: (제목만)
본문: (본문만)

다른 설명 없이 제목과 본문만 출력할 것.`;
}

async function generatePost(item: FomoItem): Promise<{ title: string; content: string }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: buildPrompt(item) }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const raw: string = json.content?.[0]?.text ?? "";

  // Parse "제목: ..." and "본문: ..."
  const titleMatch = raw.match(/제목:\s*(.+)/);
  const bodyMatch = raw.match(/본문:\s*([\s\S]+)/);

  const title = titleMatch?.[1]?.trim() ?? `${item.nameKr} 거래량 급증 분석`;
  const content = bodyMatch?.[1]?.trim() ?? raw.trim();

  return { title, content };
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!BOT_USER_ID) {
    return NextResponse.json({ ok: false, error: "BOT_USER_ID not configured" }, { status: 500 });
  }

  const results: { ticker: string; status: string; error?: string; postId?: string }[] = [];

  try {
    // Fetch KR screener data
    const screenerRes = await fetch(`${APP_URL}/api/ideas/screener`, {
      signal: AbortSignal.timeout(30000),
    });
    const screenerJson = await screenerRes.json();

    if (!screenerJson.ok && !screenerJson.fomoKr) {
      return NextResponse.json({ ok: false, error: "Failed to fetch screener data" }, { status: 502 });
    }

    const fomoKr: FomoItem[] = screenerJson.fomoKr ?? [];

    // Filter VOLUME SPIKE, sort by volumeRatio desc, take top 3
    const targets = fomoKr
      .filter((item) => item.tag === "VOLUME SPIKE")
      .sort((a, b) => b.volumeRatio - a.volumeRatio)
      .slice(0, 3);

    if (targets.length === 0) {
      return NextResponse.json({ ok: true, message: "No VOLUME SPIKE stocks found", results });
    }

    // Generate and insert posts sequentially
    for (const item of targets) {
      try {
        const { title, content } = await generatePost(item);

        const { data, error } = await supabaseAdmin.from("posts").insert({
          title,
          content,
          category: "stock_discussion",
          subcategory: "domestic",
          symbol: item.ticker,
          user_id: BOT_USER_ID,
          author_nickname: "AlphaLab",
          is_bot: true,
        }).select("id").single();

        if (error) {
          results.push({ ticker: item.ticker, status: "db_error", error: error.message });
        } else {
          results.push({ ticker: item.ticker, status: "ok", postId: data?.id });
        }
      } catch (e) {
        results.push({
          ticker: item.ticker,
          status: "error",
          error: e instanceof Error ? e.message : "Unknown",
        });
      }
    }

    return NextResponse.json({ ok: true, count: results.filter(r => r.status === "ok").length, results });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Unknown",
      results,
    }, { status: 500 });
  }
}
