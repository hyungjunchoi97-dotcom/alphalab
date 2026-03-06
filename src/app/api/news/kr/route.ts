import { NextResponse } from "next/server";

export const runtime = "nodejs";

// ── Types ─────────────────────────────────────────────────────

interface NewsItem {
  id: string;
  headline: string;
  source: string;
  url: string;
  datetime: number;
}

interface CacheEntry {
  data: NewsItem[];
  cachedAt: number;
}

// ── Cache (TTL = 15 min) ──────────────────────────────────────

const CACHE_TTL = 15 * 60 * 1000;
let cached: CacheEntry | null = null;

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
    .replace(/<[^>]+>/g, ""); // strip any HTML tags
}

function extractSource(title: string): { headline: string; source: string } {
  // Google News titles are formatted as "Headline - Source"
  const idx = title.lastIndexOf(" - ");
  if (idx > 0) {
    return {
      headline: title.slice(0, idx).trim(),
      source: title.slice(idx + 3).trim(),
    };
  }
  return { headline: title, source: "Google News" };
}

// ── Google News RSS fetch ─────────────────────────────────────

const GOOGLE_NEWS_FEEDS = [
  "https://news.google.com/rss/search?q=%EC%A3%BC%EC%8B%9D+%EC%A6%9D%EC%8B%9C&hl=ko&gl=KR&ceid=KR:ko",
  "https://news.google.com/rss/search?q=%ED%95%9C%EA%B5%AD+%EA%B2%BD%EC%A0%9C&hl=ko&gl=KR&ceid=KR:ko",
];

async function fetchGoogleNews(): Promise<NewsItem[]> {
  const allItems: NewsItem[] = [];

  for (const feedUrl of GOOGLE_NEWS_FEEDS) {
    try {
      const res = await fetch(feedUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; AlphaLab/1.0)" },
      });
      if (!res.ok) continue;
      const xml = await res.text();

      const parts = xml.split("<item>");
      for (let i = 1; i < parts.length && i <= 10; i++) {
        const chunk = parts[i].split("</item>")[0];
        const rawTitle = extractTag(chunk, "title");
        const link = extractTag(chunk, "link");
        const pubDate = extractTag(chunk, "pubDate");

        if (!rawTitle) continue;

        const title = decodeHtmlEntities(rawTitle);
        const { headline, source } = extractSource(title);

        allItems.push({
          id: `gn-kr-${i}-${pubDate}`,
          headline,
          source,
          url: link || "#",
          datetime: pubDate ? new Date(pubDate).getTime() : Date.now(),
        });
      }
    } catch {
      // skip failed feed
    }
  }

  // Deduplicate by headline similarity, sort by time
  const seen = new Set<string>();
  const unique = allItems.filter((item) => {
    const key = item.headline.slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.sort((a, b) => b.datetime - a.datetime).slice(0, 8);
}

// ── Mock fallback ─────────────────────────────────────────────

function mockKrNews(): NewsItem[] {
  const now = Date.now();
  return [
    { id: "mk1", headline: "삼성전자, AI 반도체 수출 호조…4분기 실적 기대감", source: "한국경제", url: "#", datetime: now - 1 * 3600000 },
    { id: "mk2", headline: "코스피, 외국인 매수세에 2700선 돌파", source: "매일경제", url: "#", datetime: now - 2 * 3600000 },
    { id: "mk3", headline: "한국은행 기준금리 동결…하반기 인하 가능성 시사", source: "연합뉴스", url: "#", datetime: now - 3 * 3600000 },
    { id: "mk4", headline: "현대차, 미국 전기차 공장 가동 본격화", source: "조선비즈", url: "#", datetime: now - 5 * 3600000 },
    { id: "mk5", headline: "네이버, AI 검색 서비스 '큐:' 월간 이용자 1천만 돌파", source: "디지털타임스", url: "#", datetime: now - 6 * 3600000 },
    { id: "mk6", headline: "원/달러 환율 1,350원대 안착…수출기업 수혜 전망", source: "서울경제", url: "#", datetime: now - 8 * 3600000 },
  ];
}

// ── Route handler ─────────────────────────────────────────────

export async function GET() {
  try {
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      return NextResponse.json({ ok: true, news: cached.data });
    }

    let news = await fetchGoogleNews();
    if (news.length === 0) news = mockKrNews();

    cached = { data: news, cachedAt: Date.now() };
    return NextResponse.json({ ok: true, news });
  } catch {
    return NextResponse.json({ ok: true, news: mockKrNews() });
  }
}
