import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface FeedConfig {
  url: string;
  name: string;
}

const FEEDS: FeedConfig[] = [
  { url: "https://splash247.com/feed/", name: "Splash247" },
  { url: "https://www.hellenicshippingnews.com/feed/", name: "Hellenic Shipping News" },
  { url: "https://www.seatrade-maritime.com/rss.xml", name: "Seatrade Maritime" },
  { url: "https://www.tradewindsnews.com/rss", name: "TradeWinds" },
];

interface IndexKeywords {
  key: string;
  keywords: string[];
}

const INDEX_KEYWORDS: IndexKeywords[] = [
  { key: "SCFI", keywords: ["SCFI", "Shanghai Containerized", "container freight", "container rate", "box rate"] },
  { key: "BDI", keywords: ["BDI", "Baltic Dry", "dry bulk", "bulk carrier", "capesize", "panamax"] },
  { key: "BDTI", keywords: ["BDTI", "dirty tanker", "crude tanker", "VLCC", "crude freight"] },
  { key: "BCTI", keywords: ["BCTI", "clean tanker", "product tanker", "clean petroleum"] },
];

interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
}

function extractItems(xml: string, sourceName: string): { title: string; link: string; pubDate: string }[] {
  const items: { title: string; link: string; pubDate: string }[] = [];
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = block.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() ?? "";
    const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() ?? "";
    const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ?? "";
    if (title && link) {
      items.push({ title, link, pubDate });
    }
  }
  return items;
}

async function fetchFeed(feed: FeedConfig): Promise<{ title: string; link: string; pubDate: string; source: string }[]> {
  try {
    const res = await fetch(feed.url, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) {
      console.warn(`[shipping] Feed HTTP ${res.status} for ${feed.name}`);
      return [];
    }
    const xml = await res.text();
    return extractItems(xml, feed.name).map((item) => ({ ...item, source: feed.name }));
  } catch (err) {
    console.warn(`[shipping] Feed error for ${feed.name}:`, err);
    return [];
  }
}

export async function GET() {
  const allSettled = await Promise.allSettled(FEEDS.map(fetchFeed));
  const allItems = allSettled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  const byIndex: Record<string, NewsItem[]> = {};

  for (const idx of INDEX_KEYWORDS) {
    const matched = allItems.filter((item) => {
      const text = item.title.toLowerCase();
      return idx.keywords.some((kw) => text.includes(kw.toLowerCase()));
    });

    // Sort by date descending, take top 5
    matched.sort((a, b) => {
      const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return db - da;
    });

    byIndex[idx.key] = matched.slice(0, 5).map((item) => ({
      title: item.title,
      url: item.link,
      source: item.source,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString().slice(0, 10) : "",
    }));
  }

  return NextResponse.json({ ok: true, byIndex }, {
    headers: { "Cache-Control": "no-store" },
  });
}
