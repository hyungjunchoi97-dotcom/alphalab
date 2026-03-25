import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";

export const runtime = "nodejs";
export const revalidate = 1800;

export async function GET() {
  try {
    const res = await fetch(
      "https://news.google.com/rss/search?q=bitcoin+cryptocurrency&hl=ko&gl=KR&ceid=KR:ko",
      { signal: AbortSignal.timeout(10000) }
    );
    const xml = await res.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml);

    const items = parsed?.rss?.channel?.item;
    const list = Array.isArray(items) ? items : items ? [items] : [];

    const news = list.slice(0, 10).map((item: { title?: string; link?: string; source?: string | { "#text"?: string }; pubDate?: string }) => {
      const src = typeof item.source === "string" ? item.source : (item.source?.["#text"] ?? "");
      return {
        title: String(item.title ?? "").replace(/ - .+$/, ""),
        url: String(item.link ?? ""),
        source: src,
        publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      };
    });

    return NextResponse.json({ ok: true, news });
  } catch {
    return NextResponse.json({ ok: true, news: [] });
  }
}
