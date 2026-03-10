import { NextResponse } from "next/server";

const RSS_FEEDS = [
  {
    url: "https://feeds.reuters.com/reuters/worldNews",
    source: "REUTERS" as const,
    color: "cyan" as const,
  },
  {
    url: "https://www.aljazeera.com/xml/rss/all.xml",
    source: "AL JAZEERA" as const,
    color: "green" as const,
  },
  {
    url: "https://www.defensenews.com/arc/outboundfeeds/rss/",
    source: "DEFENSE NEWS" as const,
    color: "red" as const,
  },
];

const REGION_KEYWORDS: Record<string, string[]> = {
  UKRAINE: ["ukraine", "russia", "kyiv", "moscow", "nato", "zelensky", "putin", "kremlin"],
  "MIDDLE EAST": ["iran", "israel", "gaza", "houthi", "yemen", "hormuz", "saudi", "hezbollah", "lebanon"],
  TAIWAN: ["taiwan", "tsmc", "pla", "strait", "taipei"],
  "ASIA-PACIFIC": ["china", "korea", "japan", "south china sea", "philippines", "beijing", "pyongyang"],
  ENERGY: ["oil", "gas", "lng", "opec", "crude", "pipeline", "sanctions", "energy"],
  ECONOMY: ["fed", "inflation", "tariff", "trade war", "gdp", "recession", "interest rate", "central bank"],
};

const REGION_TO_COUNTRY: Record<string, string> = {
  UKRAINE: "RU",
  "MIDDLE EAST": "IR",
  TAIWAN: "CN",
  "ASIA-PACIFIC": "CN",
};

export const maxDuration = 60;

export async function GET() {
  try {
    const allItems: Array<{
      source: string;
      color: string;
      title: string;
      pubDate: string;
      link: string;
      regions: string[];
      countryId: string | null;
      timestamp: number;
    }> = [];

    const feedPromises = RSS_FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          next: { revalidate: 300 },
          headers: { "User-Agent": "Mozilla/5.0 (compatible; NewsAggregator/1.0)" },
        });
        if (!res.ok) return [];
        const xml = await res.text();

        const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
          .slice(0, 15)
          .map((match) => {
            const content = match[1];
            const title =
              content.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] ||
              content.match(/<title>(.*?)<\/title>/)?.[1] ||
              "";
            const pubDate = content.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
            const link =
              content.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ||
              content.match(/<link\s[^>]*href="([^"]+)"/)?.[1] ||
              "";

            const titleLower = title.toLowerCase();
            const regions = Object.entries(REGION_KEYWORDS)
              .filter(([, keywords]) => keywords.some((kw) => titleLower.includes(kw)))
              .map(([region]) => region);

            return {
              source: feed.source,
              color: feed.color,
              title: title.trim(),
              pubDate,
              link,
              regions: regions.length > 0 ? regions : ["GLOBAL"],
              countryId: REGION_TO_COUNTRY[regions[0]] || null,
              timestamp: new Date(pubDate).getTime() || Date.now(),
            };
          })
          .filter((item) => item.title);

        return items;
      } catch {
        return [];
      }
    });

    const results = await Promise.all(feedPromises);
    for (const items of results) {
      allItems.push(...items);
    }

    allItems.sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({ ok: true, items: allItems.slice(0, 40) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
