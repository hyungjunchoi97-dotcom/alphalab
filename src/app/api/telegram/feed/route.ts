import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// ── Types ─────────────────────────────────────────────────────

interface TelegramMessage {
  id: number;
  channel: string;
  channelTitle: string;
  text: string;
  date: number; // unix timestamp
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

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

// ── Telegram Bot API fetch ────────────────────────────────────

async function fetchChannelMessages(
  botToken: string,
  channelUsername: string,
  channelTitle: string,
  limit: number
): Promise<TelegramMessage[]> {
  try {
    // getUpdates doesn't work for channels; use getChat + channel forwarding
    // Instead, we use the undocumented but working approach via getChatHistory
    // Actually, Bot API doesn't support reading channel history directly.
    // We need to use the "getUpdates" approach or a workaround.
    // The most reliable approach: use the channel's public RSS/JSON feed via t.me/s/

    const res = await fetch(`https://t.me/s/${channelUsername}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) return [];

    const html = await res.text();

    // Parse messages from the public Telegram web page
    const messages: TelegramMessage[] = [];
    const msgRegex = /class="tgme_widget_message_wrap[^"]*"[^>]*data-post="([^"]+)"[\s\S]*?<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>)/g;

    let match;
    while ((match = msgRegex.exec(html)) !== null && messages.length < limit) {
      const postId = match[1]; // e.g. "bumgore/1234"
      const rawText = match[2];

      // Strip HTML tags, decode entities
      const text = rawText
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .trim();

      if (!text || text.length < 5) continue;

      const msgNum = postId.split("/")[1] || "0";
      messages.push({
        id: parseInt(msgNum, 10),
        channel: channelUsername,
        channelTitle,
        text: text.slice(0, 500), // limit text length
        date: 0, // will extract below
        link: `https://t.me/${postId}`,
      });
    }

    // Try to extract dates from the HTML
    const dateRegex = /data-post="([^"]+)"[\s\S]*?<time[^>]*datetime="([^"]+)"/g;
    const dateMap = new Map<string, number>();
    let dateMatch;
    while ((dateMatch = dateRegex.exec(html)) !== null) {
      dateMap.set(dateMatch[1], new Date(dateMatch[2]).getTime());
    }

    // Assign dates
    for (const msg of messages) {
      const postKey = `${channelUsername}/${msg.id}`;
      msg.date = dateMap.get(postKey) || Date.now();
    }

    return messages.reverse(); // newest first
  } catch (err) {
    console.error(`[telegram] Error fetching ${channelUsername}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

// ── Route handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const channelParam = searchParams.get("channel"); // optional filter

    const cacheKey = channelParam || "all";
    const cachedEntry = cache.get(cacheKey);
    if (cachedEntry && Date.now() - cachedEntry.cachedAt < CACHE_TTL) {
      return NextResponse.json({
        ok: true,
        messages: cachedEntry.data,
        channels: CHANNELS,
      });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN || "";

    const targetChannels = channelParam
      ? CHANNELS.filter((c) => c.username === channelParam)
      : CHANNELS;

    const results = await Promise.all(
      targetChannels.map((ch) =>
        fetchChannelMessages(botToken, ch.username, ch.title, 20)
      )
    );

    const allMessages = results
      .flat()
      .sort((a, b) => b.date - a.date)
      .slice(0, 100);

    cache.set(cacheKey, { data: allMessages, cachedAt: Date.now() });

    return NextResponse.json({
      ok: true,
      messages: allMessages,
      channels: CHANNELS,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error", messages: [], channels: CHANNELS },
      { status: 500 }
    );
  }
}
