import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { XMLParser } from "fast-xml-parser";

export const runtime = "nodejs";
export const maxDuration = 20;

const TTL_MS = 30 * 60 * 1000; // 30분

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
}

const xmlParser = new XMLParser({ ignoreAttributes: false, parseAttributeValue: true, parseTagValue: true });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseItems(parsed: any): NewsItem[] {
  const items = parsed?.rss?.channel?.item;
  if (!items) return [];
  const arr = Array.isArray(items) ? items : [items];
  return arr.slice(0, 5).map((item) => {
    // title may be "Headline - Source Name"
    const rawTitle: string = String(item.title ?? "").replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    const lastDash = rawTitle.lastIndexOf(" - ");
    const title = lastDash > 0 ? rawTitle.slice(0, lastDash).trim() : rawTitle;

    const source =
      lastDash > 0
        ? rawTitle.slice(lastDash + 3).trim()
        : String(item.source?.["#text"] ?? item.source ?? "").trim();

    const url = String(item.link ?? "").trim();
    const pubDate = String(item.pubDate ?? "").trim();
    const publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();

    return { title, url, source, publishedAt };
  });
}

export async function GET(request: NextRequest) {
  const district = request.nextUrl.searchParams.get("district") ?? "";
  if (!district) {
    return NextResponse.json({ ok: false, error: "district param required" }, { status: 400 });
  }

  const cacheKey = `realestate_news_${district}`;

  // Cache check
  try {
    const { data: cached } = await supabaseAdmin
      .from("legend_screener_cache")
      .select("results, created_at")
      .eq("cache_key", cacheKey)
      .single();
    if (cached) {
      const age = Date.now() - new Date(cached.created_at).getTime();
      if (age < TTL_MS) {
        return NextResponse.json({ ok: true, ...(cached.results as object), cached: true });
      }
    }
  } catch {
    // cache miss
  }

  // Fetch Google News RSS
  const query = encodeURIComponent(`${district} 아파트 부동산`);
  const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=ko&gl=KR&ceid=KR:ko`;

  let news: NewsItem[] = [];
  try {
    const res = await fetch(rssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AlphaLab/1.0; +https://thealphalabs.net)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    const parsed = xmlParser.parse(text);
    news = parseItems(parsed);
  } catch (err) {
    console.error("[뉴스API]", err);
  }

  const payload = { news };

  // Save cache
  try {
    await supabaseAdmin.from("legend_screener_cache").delete().eq("cache_key", cacheKey);
    await supabaseAdmin.from("legend_screener_cache").insert({
      cache_key: cacheKey,
      results: payload,
      created_at: new Date().toISOString(),
    });
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true, ...payload, cached: false });
}
