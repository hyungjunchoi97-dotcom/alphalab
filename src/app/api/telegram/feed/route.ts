import { NextRequest, NextResponse } from "next/server";
import { scrapeChannels, scrapeChannelPage, type TelegramMessage, type ChannelConfig } from "@/lib/telegramScraper";

export const runtime = "nodejs";

// ── Config ────────────────────────────────────────────────────

export const CHANNELS: ChannelConfig[] = [
  { username: "bumgore", title: "범고래" },
  { username: "Yeouido_Lab", title: "여의도 랩" },
  { username: "YeouidoStory2", title: "여의도 스토리" },
  { username: "corevalue", title: "Core Value" },
  { username: "slowstockT", title: "슬로우스탁" },
  { username: "pef_news", title: "PEF News" },
  { username: "decoded_narratives", title: "Decoded Narratives" },
  { username: "bzcftel", title: "BZCF" },
  { username: "NittanyLionLand", title: "NittanyLionLand" },
  { username: "hedgehara", title: "Hedgehara" },
  { username: "aetherjapanresearch", title: "Aether Japan Research" },
  { username: "daegurr", title: "Daegurr" },
  // 추가 채널
  { username: "bornlupin", title: "bornlupin" },
  { username: "Macrojunglemicrolens", title: "Macrojunglemicrolens" },
  { username: "easobi", title: "easobi" },
  { username: "apt2me", title: "apt2me" },
  { username: "itcenstorwa", title: "itcenstorwa" },
  { username: "dntjd0903", title: "dntjd0903" },
  { username: "dancoininvestor", title: "Dan Coin Investor" },
  { username: "survival_DoPB", title: "Survival DoPB" },
  { username: "yieldnspread", title: "Yield N Spread" },
  { username: "Barbarian_Global_Tech", title: "Barbarian Global Tech" },
];

interface CacheEntry {
  data: TelegramMessage[];
  cachedAt: number;
}

const CACHE_TTL = 3 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

// ── Route handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const channelParam = searchParams.get("channel");
    const beforeParam = searchParams.get("before");
    const before = beforeParam ? parseInt(beforeParam, 10) : undefined;

    // Pagination request — single channel, no cache
    if (channelParam && before) {
      const ch = CHANNELS.find((c) => c.username === channelParam);
      const title = ch?.title || channelParam;
      const result = await scrapeChannelPage(channelParam, title, 15, before);
      return NextResponse.json({
        ok: true,
        messages: result.messages,
        oldestId: result.oldestId,
        channels: CHANNELS,
      });
    }

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

    const allMessages = await scrapeChannels(targets, 15);

    cache.set(cacheKey, { data: allMessages, cachedAt: Date.now() });

    return NextResponse.json({
      ok: true,
      messages: allMessages,
      channels: CHANNELS,
    }, {
      headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=300" },
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
