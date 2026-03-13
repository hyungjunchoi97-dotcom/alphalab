import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const cacheMap = new Map<string, { insight: string; cachedAt: number }>();

// ── Market-specific Yahoo Finance symbols & context ─────────

const MARKET_CONFIG: Record<
  string,
  { symbols: string[]; labels: string[]; context: string }
> = {
  KR: {
    symbols: ["^KS11", "^KQ11", "USDKRW=X", "005930.KS", "000660.KS"],
    labels: ["KOSPI", "KOSDAQ", "USD/KRW", "삼성전자", "SK하이닉스"],
    context:
      "한국 반도체 사이클, KOSPI/KOSDAQ 동향, 외국인 수급, 원달러 환율 영향을 중심으로 한국 시장 현황을 분석하세요.",
  },
  US: {
    symbols: ["^GSPC", "^IXIC", "^VIX", "DX-Y.NYB"],
    labels: ["S&P 500", "NASDAQ", "VIX", "Dollar Index"],
    context:
      "미국 연준 금리 정책, 인플레이션 동향, S&P500/NASDAQ 밸류에이션, VIX 수준, 달러 인덱스를 중심으로 미국 시장 현황을 분석하세요.",
  },
  JP: {
    symbols: ["^N225", "USDJPY=X", "7203.T", "6758.T"],
    labels: ["Nikkei 225", "USD/JPY", "Toyota", "Sony"],
    context:
      "일본은행(BOJ) 금리 정책, 엔화 방향성, 닛케이225 동향, 일본 수출기업 실적 전망을 중심으로 일본 시장 현황을 분석하세요.",
  },
  BR: {
    symbols: ["^BVSP", "USDBRL=X", "PETR4.SA", "VALE3.SA"],
    labels: ["Bovespa", "USD/BRL", "Petrobras", "Vale"],
    context:
      "브라질 셀릭 금리, 헤알화 환율, 국채 투자 매력도, Bovespa 동향, 한국 투자자 관점의 브라질 국채 투자 리스크/리턴을 분석하세요.",
  },
};

// ── Fetch real-time prices from Yahoo Finance ───────────────

interface YahooQuote {
  symbol: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
}

async function fetchYahooQuotes(symbols: string[]): Promise<YahooQuote[]> {
  const results: YahooQuote[] = [];

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
        const res = await fetch(url, {
          headers: { "User-Agent": "project-stockmarket/1.0" },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          results.push({ symbol, price: null, change: null, changePct: null });
          return;
        }
        const json = await res.json();
        const meta = json?.chart?.result?.[0]?.meta;
        const price = meta?.regularMarketPrice;
        const prevClose = meta?.chartPreviousClose ?? meta?.regularMarketPreviousClose ?? meta?.previousClose;

        if (typeof price === "number" && isFinite(price)) {
          const chg = typeof prevClose === "number" ? price - prevClose : null;
          const chgPct = meta?.regularMarketChangePercent != null
            ? meta.regularMarketChangePercent
            : (chg !== null && prevClose > 0 ? (chg / prevClose) * 100 : null);
          results.push({
            symbol,
            price: Math.round(price * 100) / 100,
            change: chg !== null ? Math.round(chg * 100) / 100 : null,
            changePct: chgPct !== null ? Math.round(chgPct * 100) / 100 : null,
          });
        } else {
          results.push({ symbol, price: null, change: null, changePct: null });
        }
      } catch {
        results.push({ symbol, price: null, change: null, changePct: null });
      }
    })
  );

  return results;
}

// ── Route handler ───────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior market strategist at Goldman Sachs Seoul. Write a concise market insight in Korean for the specified market. Institutional tone, data-driven, no emojis. Max 4 sentences. End with one actionable takeaway. Style: Goldman Sachs morning note.

Rules:
- 4 sentences max
- Use terms like '확인', '시사', '전망', '주목', '포착'
- No emojis, no markdown
- Plain text only
- Reference the specific price data provided
- End with a clear actionable takeaway for Korean institutional investors`;

export async function GET(req: NextRequest) {
  const market = (req.nextUrl.searchParams.get("market") || "KR").toUpperCase();

  // Check cache
  const cached = cacheMap.get(market);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return NextResponse.json({ ok: true, insight: cached.insight, source: "cache" });
  }

  const config = MARKET_CONFIG[market];
  if (!config) {
    return NextResponse.json({ ok: false, error: `Unknown market: ${market}` }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  // Fetch real-time data
  const quotes = await fetchYahooQuotes(config.symbols);
  const dataLines = quotes
    .map((q, i) => {
      const label = config.labels[i] || q.symbol;
      if (q.price === null) return `${label}: data unavailable`;
      const chgStr =
        q.changePct !== null
          ? ` (${q.changePct >= 0 ? "+" : ""}${q.changePct}%)`
          : "";
      return `${label}: ${q.price.toLocaleString()}${chgStr}`;
    })
    .join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const message = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Market: ${market}\n\nCurrent data:\n${dataLines}\n\n${config.context}\n\nWrite the market insight now.`,
          },
        ],
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const insight = message.content[0].type === "text" ? message.content[0].text : "";
    cacheMap.set(market, { insight, cachedAt: Date.now() });

    return NextResponse.json({ ok: true, insight, source: "live" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[markets-insight] ${market} error:`, msg);

    const stale = cacheMap.get(market);
    if (stale) {
      return NextResponse.json({ ok: true, insight: stale.insight, source: "stale" });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// Keep POST for backward compatibility
export async function POST(req: Request) {
  let body: { market?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const market = (body.market || "KR").toUpperCase();

  // Redirect to GET logic by constructing a NextRequest-like call
  const url = new URL(`/api/markets-insight?market=${market}`, req.url);
  const getReq = new NextRequest(url);
  return GET(getReq);
}
