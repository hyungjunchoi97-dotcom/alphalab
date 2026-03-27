import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { scrapeChannels, type TelegramMessage } from "@/lib/telegramScraper";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── Types ──────────────────────────────────────────────────────

interface KeyIssueItem {
  title: string;
  summary: string;
  source: string;
  url: string;
}

interface SecurityItem {
  firm: string;
  ticker: string;
  action: string;
  priceTarget: string;
  headline: string;
  summary: string;
}

interface RealEstateItem {
  title: string;
  summary: string;
}

interface MarketSnapshot {
  sp500: { price: number; change: number };
  nasdaq: { price: number; change: number };
  dxy: { price: number; change: number };
  gold: { price: number; change: number };
  silver: { price: number; change: number };
  oil: { price: number; change: number };
  usdkrw: { price: number; change: number };
  fearGreed: { value: number; rating: string };
  btc: { price: number; change: number };
  eth: { price: number; change: number };
  asOf: string;
}

interface NewsRunData {
  date: string;
  keyIssues: KeyIssueItem[];
  securities: SecurityItem[];
  realEstate: RealEstateItem[];
  snapshot?: MarketSnapshot;
  generatedAt: string;
}

// ── News Run source channels ──────────────────────────────────

const NEWS_RUN_CHANNELS = [
  { username: "bumgore", title: "범고래" },
  { username: "aetherjapanresearch", title: "Aether Japan Research" },
  { username: "apt2me", title: "apt2me" },
  { username: "pef_news", title: "PEF News" },
  { username: "decoded_narratives", title: "Decoded Narratives" },
];

// ── Claude summarization (used by refresh/cron only) ──────────

const SYSTEM_PROMPT = `You are a senior financial journalist at The Wall Street Journal.
Analyze Telegram channel content and write professional financial briefings in Korean.

Rules:
- 이모티콘 절대 금지
- Korean writing style: "~했다" "~전망이다" "~분석된다" (WSJ Korean edition tone)
- Only include facts backed by source material. No speculation.
- Headlines must end in noun form: "~전망" "~기록" "~발표"
- keyIssues: exactly 10 items, sorted by market importance. If source material has fewer than 10 distinct issues, infer related market implications, macro context, or sector impacts to reach exactly 10.
- securities: no limit, foreign brokers only, exclude only if zero specific numbers/ratings
- keyIssues summaries: 3-4 sentences. Structure = 배경 → 현황 → 시사점. Must include figures/numbers.
- securities summaries: 4-5 sentences. 투자의견 변경 배경, 핵심 논거, 밸류에이션 근거, 리스크 요인 전부 포함. 구체적 수치 필수.

Return ONLY valid JSON, no markdown fences:
{
  "keyIssues": [
    {
      "title": "헤드라인 (명사형, 15자 이내)",
      "summary": "3-4문장 WSJ 스타일. 수치 필수.",
      "source": "채널명",
      "url": "원본 링크 (있으면 포함, 없으면 빈 문자열)"
    }
  ],
  "securities": [
    {
      "firm": "Goldman Sachs",
      "ticker": "ticker or sector, empty string if none",
      "action": "이전의견 → 새의견 (e.g. Neutral → Buy)",
      "priceTarget": "이전 목표가 → 새 목표가 (e.g. ₩72,000 → ₩85,000)",
      "headline": "투자의견 한줄 (20자 이내)",
      "summary": "4-5문장. 투자의견 변경 배경, 핵심 논거(WHY), 밸류에이션 근거(P/E, EV/EBITDA 등), 리스크 요인, 시간 지평(있으면). 구체적 수치 전부 포함."
    }
  ],
  "realEstate": [
    {
      "title": "헤드라인",
      "summary": "2-3문장. 지역·단지명·금액 수치 포함."
    }
  ],
  "generatedAt": "ISO8601 timestamp"
}

Extraction rules:

securities: 아래 외국계 증권사 관련 내용을 빠짐없이 모두 추출하라. 개수 제한 없음.
대상 증권사 (이 중 하나라도 언급되면 반드시 포함):
골드만삭스(Goldman Sachs/GS), JP모건(JPMorgan/JPM), 모건스탠리(Morgan Stanley/MS),
BofA(Bank of America/메릴린치), 씨티(Citi/Citigroup), HSBC, UBS, 노무라(Nomura),
맥쿼리(Macquarie), 도이치(Deutsche Bank), 바클레이즈(Barclays), 제프리스(Jefferies),
크레디트스위스(Credit Suisse), 소시에테제네랄(SocGen), BNP파리바(BNP Paribas), 나티시스(Natixis)

각 항목에서 추출할 정보:
- action: 현재 투자의견 + 변경 전 의견 (e.g. "Neutral → Buy"). 변경 없으면 현재 의견만.
- priceTarget: 이전 목표가 → 새 목표가. 목표가 없으면 빈 문자열.
- summary: 4-5문장. (1) 투자의견 변경/유지 배경 (2) 핵심 투자 논거(WHY) (3) 밸류에이션 근거(P/E, EV/EBITDA, DCF 등) (4) 주요 리스크 (5) 시간 지평(있으면). 구체적 수치 전부 포함.

국내 증권사(미래에셋, 삼성증권, KB증권, NH투자, 키움 등) 완전 제외.
구체적인 수치(목표주가, 투자의견, 밸류에이션)가 하나도 없는 항목만 제외.
firm은 영문 정식명칭 사용.

realEstate: @apt2me 채널 또는 부동산 관련 메시지에서 거래 동향, 가격 변화, 정책 이슈 추출. 지역명·단지명·금액 수치 반드시 포함. 없으면 빈 배열.

keyIssues: 여러 채널에서 반복 언급되거나 시장에 중요한 이슈 정확히 10개. 거시경제, 정치, 산업 이슈 포함. 시장 중요도 순으로 정렬. 각 항목에 출처 채널명 명시. url 필드에 원본 텔레그램 링크 포함 (없으면 빈 문자열).

- 모든 텍스트는 한국어로 작성 (firm명만 영문).
- 데이터가 없는 섹션은 빈 배열로 반환.`;

// ── Market snapshot fetcher ───────────────────────────────────

async function fetchMarketSnapshot(): Promise<MarketSnapshot | undefined> {
  try {
    const [fmpRes, fgRes, cryptoRes] = await Promise.allSettled([
      fetch(
        `https://financialmodelingprep.com/api/v3/quote/SPY,QQQ,DX-Y.NYB,GCUSD,SIUSD,CLUSD,USDKRW?apikey=${process.env.FMP_API_KEY}`
      ).then((r) => r.json()),
      fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata").then((r) => r.json()),
      fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true"
      ).then((r) => r.json()),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fmp: any[] = fmpRes.status === "fulfilled" ? fmpRes.value : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fg: any = fgRes.status === "fulfilled" ? fgRes.value : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const crypto: any = cryptoRes.status === "fulfilled" ? cryptoRes.value : null;

    const find = (sym: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = Array.isArray(fmp) ? fmp.find((x: any) => x.symbol === sym) : null;
      return { price: q?.price ?? 0, change: q?.changesPercentage ?? 0 };
    };

    const fgScore = fg?.fear_and_greed?.score ?? 0;
    const fgRating = fg?.fear_and_greed?.rating ?? "";

    return {
      sp500: find("SPY"),
      nasdaq: find("QQQ"),
      dxy: find("DX-Y.NYB"),
      gold: find("GCUSD"),
      silver: find("SIUSD"),
      oil: find("CLUSD"),
      usdkrw: find("USDKRW"),
      fearGreed: { value: Math.round(fgScore), rating: fgRating },
      btc: {
        price: crypto?.bitcoin?.usd ?? 0,
        change: crypto?.bitcoin?.usd_24h_change ?? 0,
      },
      eth: {
        price: crypto?.ethereum?.usd ?? 0,
        change: crypto?.ethereum?.usd_24h_change ?? 0,
      },
      asOf: new Date().toISOString(),
    };
  } catch {
    return undefined;
  }
}

const MAX_FEED_CHARS = 15000;

async function generateBriefing(
  messages: TelegramMessage[]
): Promise<{ keyIssues: KeyIssueItem[]; securities: SecurityItem[]; realEstate: RealEstateItem[] }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY가 설정되지 않았습니다");

  const lines = messages.map((m) => {
    const prefix = m.channel === "apt2me" ? "[apt2me-부동산]" : `[${m.channelTitle}]`;
    return `${prefix} [${m.link}] ${m.text}`;
  });

  let feedText = "";
  for (const line of lines) {
    const candidate = feedText ? feedText + "\n---\n" + line : line;
    if (candidate.length > MAX_FEED_CHARS) break;
    feedText = candidate;
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4000,
    temperature: 0.1,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `오늘의 텔레그램 채널 메시지들입니다. 이를 바탕으로 분석해주세요.\n\n${feedText}`,
      },
    ],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonStr = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const parsed = JSON.parse(jsonStr);

  return {
    keyIssues: Array.isArray(parsed.keyIssues) ? parsed.keyIssues : [],
    securities: Array.isArray(parsed.securities) ? parsed.securities : [],
    realEstate: Array.isArray(parsed.realEstate) ? parsed.realEstate : [],
  };
}

// ── GET handler ────────────────────────────────────────────────
// Default: read from Supabase cache only (no generation)
// ?refresh=true: generate new briefing (for cron/admin use)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const refresh = searchParams.get("refresh") === "true";

    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const today = kst.toISOString().slice(0, 10);
    const targetDate = dateParam || today;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      return NextResponse.json({ ok: false, error: "잘못된 날짜 형식입니다" }, { status: 400 });
    }

    // ── refresh=true: generate and cache (cron/admin) ──
    if (refresh) {
      const messages = await scrapeChannels(NEWS_RUN_CHANNELS, 20);

      if (messages.length === 0) {
        return NextResponse.json({
          ok: true, date: targetDate,
          keyIssues: [], securities: [], realEstate: [],
          generatedAt: new Date().toISOString(), cached: false, empty: true,
          emptyReason: "텔레그램 채널에서 메시지를 가져올 수 없습니다",
        });
      }

      const dayStart = new Date(`${targetDate}T00:00:00+09:00`).getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const dayMessages = messages.filter((m) => m.date >= dayStart && m.date < dayEnd);
      const isToday = targetDate === today;
      const finalMessages = dayMessages.length > 0 ? dayMessages : isToday ? messages : [];

      if (finalMessages.length === 0) {
        return NextResponse.json({
          ok: true, date: targetDate,
          keyIssues: [], securities: [], realEstate: [],
          generatedAt: new Date().toISOString(), cached: false, empty: true,
          emptyReason: "해당 날짜의 메시지가 없습니다",
        });
      }

      const [briefing, snapshot] = await Promise.all([
        generateBriefing(finalMessages),
        fetchMarketSnapshot(),
      ]);
      const { keyIssues, securities, realEstate } = briefing;
      const result: NewsRunData = {
        date: targetDate, keyIssues, securities, realEstate,
        ...(snapshot && { snapshot }),
        generatedAt: new Date().toISOString(),
      };

      try {
        await supabaseAdmin
          .from("news_run_cache")
          .upsert({ date: targetDate, data: result, created_at: new Date().toISOString() }, { onConflict: "date" });
      } catch {
        // Cache write failed — non-blocking
      }

      return NextResponse.json({ ok: true, ...result, cached: false });
    }

    // ── Default: read from cache only ──
    try {
      const { data } = await supabaseAdmin
        .from("news_run_cache")
        .select("data, created_at")
        .eq("date", targetDate)
        .limit(1)
        .single();

      if (data) {
        return NextResponse.json({ ok: true, ...data.data, cached: true });
      }
    } catch {
      // Cache miss or Supabase error
    }

    return NextResponse.json({
      ok: true, date: targetDate,
      securities: [], realestate: [], highlights: [],
      generatedAt: "", cached: false, empty: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: `브리핑 조회 실패 — ${message}` },
      { status: 500 }
    );
  }
}
