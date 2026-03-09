import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// ── Types ─────────────────────────────────────────────────────

interface NewsItem {
  id: string;
  headline: string;
  source: string;
  url: string;
  datetime: number;
  category: string;
}

interface CacheEntry {
  data: NewsItem[];
  cachedAt: number;
}

// ── Cache (TTL = 15 min) ──────────────────────────────────────

const CACHE_TTL = 15 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

// ── Category feeds ────────────────────────────────────────────

const CATEGORY_FEEDS: Record<string, string> = {
  breaking: "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko",
  stocks: "https://news.google.com/rss/search?q=%EC%A3%BC%EC%8B%9D+%EC%BD%94%EC%8A%A4%ED%94%BC&hl=ko&gl=KR&ceid=KR:ko",
  economy: "https://news.google.com/rss/search?q=%EA%B8%88%EB%A6%AC+%ED%99%98%EC%9C%A8+%EA%B2%BD%EC%A0%9C&hl=ko&gl=KR&ceid=KR:ko",
  politics: "https://news.google.com/rss/search?q=%EC%A0%95%EC%B9%98+%EC%84%A0%EA%B1%B0&hl=ko&gl=KR&ceid=KR:ko",
};

// ── XML helpers ───────────────────────────────────────────────

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(
    `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`
  );
  const m = xml.match(re);
  if (!m) return "";
  return (m[1] ?? m[2] ?? "").trim();
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, "");
}

function extractSource(title: string): { headline: string; source: string } {
  const idx = title.lastIndexOf(" - ");
  if (idx > 0) {
    return {
      headline: title.slice(0, idx).trim(),
      source: title.slice(idx + 3).trim(),
    };
  }
  return { headline: title, source: "Google News" };
}

// ── Fetch a single category ───────────────────────────────────

async function fetchCategory(category: string, feedUrl: string): Promise<NewsItem[]> {
  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AlphaLab/1.0)" },
    });
    if (!res.ok) return [];
    const xml = await res.text();

    const items: NewsItem[] = [];
    const parts = xml.split("<item>");
    for (let i = 1; i < parts.length && items.length < 12; i++) {
      const chunk = parts[i].split("</item>")[0];
      const rawTitle = extractTag(chunk, "title");
      const link = extractTag(chunk, "link");
      const pubDate = extractTag(chunk, "pubDate");

      if (!rawTitle) continue;

      const title = decodeHtmlEntities(rawTitle);
      const { headline, source } = extractSource(title);

      items.push({
        id: `gn-${category}-${i}-${Date.now()}`,
        headline,
        source,
        url: link || "#",
        datetime: pubDate ? new Date(pubDate).getTime() : Date.now(),
        category,
      });
    }

    // Deduplicate
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.headline.slice(0, 30);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return [];
  }
}

// ── Mock fallback ─────────────────────────────────────────────

function mockNews(category: string): NewsItem[] {
  const now = Date.now();
  const mocks: Record<string, NewsItem[]> = {
    breaking: [
      { id: "mb1", headline: "삼성전자, AI 반도체 수출 호조로 4분기 실적 기대감 상승", source: "한국경제", url: "#", datetime: now - 1 * 3600000, category: "breaking" },
      { id: "mb2", headline: "코스피, 외국인 매수세에 2700선 돌파", source: "매일경제", url: "#", datetime: now - 2 * 3600000, category: "breaking" },
      { id: "mb3", headline: "한국은행 기준금리 동결, 하반기 인하 가능성 시사", source: "연합뉴스", url: "#", datetime: now - 3 * 3600000, category: "breaking" },
      { id: "mb4", headline: "현대차, 미국 전기차 공장 가동 본격화", source: "조선비즈", url: "#", datetime: now - 5 * 3600000, category: "breaking" },
      { id: "mb5", headline: "네이버 AI 검색 서비스 월간 이용자 1천만 돌파", source: "디지털타임스", url: "#", datetime: now - 6 * 3600000, category: "breaking" },
    ],
    stocks: [
      { id: "ms1", headline: "코스피 장중 2700 돌파, 반도체주 강세", source: "한국경제", url: "#", datetime: now - 1 * 3600000, category: "stocks" },
      { id: "ms2", headline: "SK하이닉스, HBM4 수주 기대감에 신고가", source: "매일경제", url: "#", datetime: now - 2 * 3600000, category: "stocks" },
      { id: "ms3", headline: "나스닥 사상 최고치 경신, AI주 랠리 지속", source: "연합뉴스", url: "#", datetime: now - 3 * 3600000, category: "stocks" },
      { id: "ms4", headline: "삼성전자 자사주 매입 발표, 주가 상승 견인", source: "조선비즈", url: "#", datetime: now - 4 * 3600000, category: "stocks" },
    ],
    economy: [
      { id: "me1", headline: "원/달러 환율 1,350원대 안착, 수출기업 수혜 전망", source: "서울경제", url: "#", datetime: now - 1 * 3600000, category: "economy" },
      { id: "me2", headline: "한국은행 기준금리 동결, 인하 시점 주목", source: "연합뉴스", url: "#", datetime: now - 3 * 3600000, category: "economy" },
      { id: "me3", headline: "소비자물가 2%대 안정, 인플레이션 우려 완화", source: "한국경제", url: "#", datetime: now - 5 * 3600000, category: "economy" },
      { id: "me4", headline: "GDP 성장률 전망 상향, 수출 호조 영향", source: "매일경제", url: "#", datetime: now - 7 * 3600000, category: "economy" },
    ],
    politics: [
      { id: "mp1", headline: "국회 본회의, 주요 경제 법안 처리 논의", source: "연합뉴스", url: "#", datetime: now - 2 * 3600000, category: "politics" },
      { id: "mp2", headline: "트럼프 관세 정책 재검토, 한국 수출 영향 분석", source: "조선비즈", url: "#", datetime: now - 4 * 3600000, category: "politics" },
      { id: "mp3", headline: "정부, 반도체 산업 지원 정책 패키지 발표", source: "한국경제", url: "#", datetime: now - 6 * 3600000, category: "politics" },
    ],
  };
  return mocks[category] || mocks.breaking || [];
}

// ── Route handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "breaking";

    const cacheKey = `kr-${category}`;
    const entry = cache.get(cacheKey);
    if (entry && Date.now() - entry.cachedAt < CACHE_TTL) {
      return NextResponse.json({ ok: true, news: entry.data, category });
    }

    const feedUrl = CATEGORY_FEEDS[category];
    if (!feedUrl) {
      return NextResponse.json({ ok: true, news: mockNews(category), category });
    }

    let news = await fetchCategory(category, feedUrl);
    if (news.length === 0) news = mockNews(category);

    cache.set(cacheKey, { data: news, cachedAt: Date.now() });
    return NextResponse.json({ ok: true, news, category }, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
    });
  } catch {
    const category = "breaking";
    return NextResponse.json({ ok: true, news: mockNews(category), category });
  }
}
