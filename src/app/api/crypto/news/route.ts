import { NextRequest, NextResponse } from "next/server";

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
}

let cache: CacheEntry | null = null;
const CACHE_TTL = 10 * 60 * 1000;

async function translateTop5(items: NewsItem[]): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  for (let i = 0; i < 5 && i < items.length; i++) {
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
          max_tokens: 100,
          messages: [{
            role: "user",
            content: `이 영어 제목을 한국어로 번역해줘. 번역문만 출력:\n${items[i].title}`,
          }],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const kr = (data.content?.[0]?.text ?? "").trim();
        if (kr && kr !== items[i].title && kr.length > 0) {
          items[i].titleKr = kr;
        }
      }
    } catch {
      // skip this item
    }

    await new Promise(r => setTimeout(r, 300));
  }
}

export async function GET(req: NextRequest) {
  try {
    const offset = Math.max(0, parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10) || 20));

    // Fetch full dataset if cache is stale
    if (!cache || Date.now() - cache.cachedAt >= CACHE_TTL) {
      const apiKey = process.env.CRYPTOPANIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ ok: true, news: [], hasMore: false });
      }

      const url = `https://cryptopanic.com/api/developer/v2/posts/?auth_token=${apiKey}&public=true&kind=news&limit=50`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

      if (!res.ok) {
        if (cache) {
          const slice = cache.data.slice(offset, offset + limit);
          return NextResponse.json({ ok: true, news: slice, hasMore: offset + limit < cache.data.length, source: "stale" });
        }
        return NextResponse.json({ ok: true, news: [], hasMore: false });
      }

      const json = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results: any[] = json.results ?? [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allNews: NewsItem[] = results.map((item: any) => ({
        id: item.id,
        title: item.title ?? "",
        url: item.url ?? "",
        source: item.source?.title ?? item.domain ?? "",
        publishedAt: item.published_at ?? new Date().toISOString(),
        currencies: (item.currencies ?? []).map((c: { code: string }) => c.code),
      }));

      // Translate top 5 only (no caching - fresh each time)
      await translateTop5(allNews);

      cache = { data: allNews, cachedAt: Date.now() };
    }

    const slice = cache.data.slice(offset, offset + limit);
    const hasMore = offset + limit < cache.data.length;

    return NextResponse.json({ ok: true, news: slice, hasMore }, {
      headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=1200" },
    });
  } catch {
    if (cache) {
      return NextResponse.json({ ok: true, news: cache.data.slice(0, 20), hasMore: false, source: "stale" });
    }
    return NextResponse.json({ ok: true, news: [], hasMore: false });
  }
}
