import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface CacheEntry {
  data: NewsItem[];
  cachedAt: number;
}

interface NewsItem {
  id: number;
  title: string;
  titleKr?: string;
  url: string;
  source: string;
  publishedAt: string;
  currencies: string[];
  votes: { positive: number; negative: number; important: number };
}

let cache: CacheEntry | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const translationCache = new Map<number, string>();

async function translateTitles(items: NewsItem[]): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  const target = items.slice(0, 5);

  for (const item of target) {
    // Skip if already cached
    if (translationCache.has(item.id)) {
      item.titleKr = translationCache.get(item.id);
      continue;
    }

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          messages: [{
            role: "user",
            content: `다음 영어 제목을 한국어로 번역해줘. 번역된 제목 텍스트만 출력하고 다른 내용은 출력하지 마:\n${item.title}`,
          }],
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const kr = (json.content?.[0]?.text ?? "").trim();
        if (kr) {
          translationCache.set(item.id, kr);
          item.titleKr = kr;
          console.log("Translated:", item.title, "->", item.titleKr);
        }
      }
    } catch {
      // Translation failed for this item, continue
    }
  }
}

export async function GET() {
  try {
    if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
      return NextResponse.json({ ok: true, news: cache.data });
    }

    const apiKey = process.env.CRYPTOPANIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: true, news: [] });
    }

    const url = `https://cryptopanic.com/api/developer/v2/posts/?auth_token=${apiKey}&public=true&kind=news&limit=50`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!res.ok) {
      if (cache) return NextResponse.json({ ok: true, news: cache.data, source: "stale" });
      return NextResponse.json({ ok: true, news: [] });
    }

    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = json.results ?? [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const news: NewsItem[] = results.map((item: any) => ({
      id: item.id,
      title: item.title ?? "",
      url: item.url ?? "",
      source: item.source?.title ?? item.domain ?? "",
      publishedAt: item.published_at ?? new Date().toISOString(),
      currencies: (item.currencies ?? []).map((c: { code: string }) => c.code),
      votes: {
        positive: item.votes?.positive ?? 0,
        negative: item.votes?.negative ?? 0,
        important: item.votes?.important ?? 0,
      },
    }));

    // Translate top 10 titles to Korean
    await translateTitles(news);

    cache = { data: news, cachedAt: Date.now() };

    return NextResponse.json({ ok: true, news }, {
      headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=1200" },
    });
  } catch {
    if (cache) return NextResponse.json({ ok: true, news: cache.data, source: "stale" });
    return NextResponse.json({ ok: true, news: [] });
  }
}
