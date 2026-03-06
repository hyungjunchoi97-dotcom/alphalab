import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// ── Types ─────────────────────────────────────────────────────

interface TelegramMessage {
  id: number;
  channel: string;
  channelTitle: string;
  text: string;
  date: number;
  link: string;
}

interface CacheEntry {
  data: TelegramMessage[];
  cachedAt: number;
}

// ── Config ────────────────────────────────────────────────────

const CHANNELS = [
  { username: "bumgore", title: "범고래" },
  { username: "Yeouido_Lab", title: "여의도 랩" },
  { username: "YeouidoStory2", title: "여의도 스토리" },
  { username: "corevalue", title: "Core Value" },
  { username: "bzcftel", title: "BZCF" },
  { username: "slowstockT", title: "슬로우스탁" },
  { username: "pef_news", title: "PEF News" },
  { username: "decoded_narratives", title: "Decoded Narratives" },
];

const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

// ── HTML helpers ──────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// ── t.me/s/ scraper ───────────────────────────────────────────

async function scrapeChannel(
  username: string,
  title: string,
  limit: number
): Promise<TelegramMessage[]> {
  try {
    const res = await fetch(`https://t.me/s/${username}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      console.error(`[telegram] ${username} HTTP ${res.status}`);
      return [];
    }

    const html = await res.text();
    const messages: TelegramMessage[] = [];

    // Split by message widget blocks
    const blocks = html.split("tgme_widget_message_wrap");

    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];

      // Extract post ID: data-post="channel/123"
      const postMatch = block.match(/data-post="([^"]+)"/);
      if (!postMatch) continue;
      const postId = postMatch[1]; // e.g. "bumgore/4567"
      const msgNum = parseInt(postId.split("/")[1] || "0", 10);

      // Extract message text
      const textMatch = block.match(
        /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/
      );
      if (!textMatch) continue;
      const text = decodeEntities(textMatch[1]);
      if (!text || text.length < 3) continue;

      // Extract datetime
      const timeMatch = block.match(/<time[^>]*datetime="([^"]+)"/);
      const date = timeMatch ? new Date(timeMatch[1]).getTime() : 0;

      messages.push({
        id: msgNum,
        channel: username,
        channelTitle: title,
        text: text.slice(0, 800),
        date,
        link: `https://t.me/${postId}`,
      });
    }

    // Messages appear oldest-first in HTML, reverse for newest-first
    return messages.reverse().slice(0, limit);
  } catch (err) {
    console.error(
      `[telegram] Error scraping ${username}:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

// ── Route handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const channelParam = searchParams.get("channel");

    const cacheKey = channelParam || "all";
    const entry = cache.get(cacheKey);
    if (entry && Date.now() - entry.cachedAt < CACHE_TTL) {
      return NextResponse.json({
        ok: true,
        messages: entry.data,
        channels: CHANNELS,
      });
    }

    const targets = channelParam
      ? CHANNELS.filter((c) => c.username === channelParam)
      : CHANNELS;

    // Parallel fetch with allSettled (failed channels = empty)
    const results = await Promise.allSettled(
      targets.map((ch) => scrapeChannel(ch.username, ch.title, 15))
    );

    const allMessages = results
      .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      .sort((a, b) => b.date - a.date);

    cache.set(cacheKey, { data: allMessages, cachedAt: Date.now() });

    return NextResponse.json({
      ok: true,
      messages: allMessages,
      channels: CHANNELS,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
        messages: [],
        channels: CHANNELS,
      },
      { status: 500 }
    );
  }
}
