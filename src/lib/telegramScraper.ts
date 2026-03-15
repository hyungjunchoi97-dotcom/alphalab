// Shared Telegram channel scraper — used by both /api/telegram/feed and /api/news-run

// ── Types ─────────────────────────────────────────────────────

export interface TelegramMessage {
  id: number;
  channel: string;
  channelTitle: string;
  text: string;
  date: number;
  link: string;
  imageUrl?: string;
}

export interface ChannelConfig {
  username: string;
  title: string;
}

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

async function fetchTelegramHtml(username: string, before?: number): Promise<string | null> {
  const suffix = before ? `?before=${before}` : "";
  const urls = [
    `https://t.me/s/${username}${suffix}`,
    `https://t.me/s/${username.toLowerCase()}${suffix}`,
  ];
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    Accept: "text/html,application/xhtml+xml",
  };

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const html = await res.text();
        if (html.includes("tgme_widget_message_wrap")) return html;
        console.warn(`[telegram] ${username} from ${url}: no message blocks`);
      } else {
        console.warn(`[telegram] ${username} HTTP ${res.status} from ${url}`);
      }
    } catch (err) {
      console.warn(`[telegram] ${username} fetch error from ${url}:`, err instanceof Error ? err.message : err);
    }
  }
  return null;
}

export async function scrapeChannel(
  username: string,
  title: string,
  limit: number,
  before?: number
): Promise<TelegramMessage[]> {
  try {
    const html = await fetchTelegramHtml(username, before);
    if (!html) {
      console.error(`[telegram] ${username}: no accessible public feed`);
      return [];
    }
    const messages: TelegramMessage[] = [];

    const blocks = html.split("tgme_widget_message_wrap");

    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];

      const postMatch = block.match(/data-post="([^"]+)"/);
      if (!postMatch) continue;
      const postId = postMatch[1];
      const msgNum = parseInt(postId.split("/")[1] || "0", 10);

      const textMatch = block.match(
        /class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/
      );
      if (!textMatch) continue;
      const text = decodeEntities(textMatch[1]);
      if (!text || text.length < 3) continue;

      const timeMatch = block.match(/<time[^>]*datetime="([^"]+)"/);
      const date = timeMatch ? new Date(timeMatch[1]).getTime() : 0;

      let imageUrl: string | undefined;
      const bgImgMatch = block.match(
        /tgme_widget_message_photo_wrap[^>]*style="[^"]*background-image:\s*url\('([^']+)'\)/
      );
      if (bgImgMatch) {
        imageUrl = bgImgMatch[1];
      } else {
        const imgSrcMatch = block.match(
          /tgme_widget_message_photo[^>]*>\s*<img[^>]*src="([^"]+)"/
        );
        if (imgSrcMatch) {
          imageUrl = imgSrcMatch[1];
        }
      }
      if (!imageUrl) {
        const previewMatch = block.match(
          /link_preview_image[^>]*style="[^"]*background-image:\s*url\('([^']+)'\)/
        );
        if (previewMatch) {
          imageUrl = previewMatch[1];
        }
      }

      messages.push({
        id: msgNum,
        channel: username,
        channelTitle: title,
        text: text,
        date,
        link: `https://t.me/${postId}`,
        ...(imageUrl && { imageUrl }),
      });
    }

    return messages.reverse().slice(0, limit);
  } catch (err) {
    console.error(
      `[telegram] Error scraping ${username}:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export interface ScrapePageResult {
  messages: TelegramMessage[];
  oldestId: number | null;
}

/**
 * Scrape a single channel page with optional `before` cursor.
 * Returns messages + the oldest message ID for pagination.
 */
export async function scrapeChannelPage(
  username: string,
  title: string,
  limit: number,
  before?: number
): Promise<ScrapePageResult> {
  const messages = await scrapeChannel(username, title, limit, before);
  const oldestId = messages.length > 0
    ? Math.min(...messages.map((m) => m.id))
    : null;
  return { messages, oldestId };
}

/**
 * Scrape multiple channels in parallel.
 * Returns all messages sorted newest-first.
 */
export async function scrapeChannels(
  channels: ChannelConfig[],
  limitPerChannel = 15
): Promise<TelegramMessage[]> {
  const results = await Promise.allSettled(
    channels.map((ch) => scrapeChannel(ch.username, ch.title, limitPerChannel))
  );

  return results
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .sort((a, b) => b.date - a.date);
}
