import { NextRequest, NextResponse } from "next/server";
import { scrapeChannelPage } from "@/lib/telegramScraper";
import { CHANNELS } from "@/app/api/telegram/feed/route";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const channel = req.nextUrl.searchParams.get("channel") ?? "";
  const beforeParam = req.nextUrl.searchParams.get("before");
  const before = beforeParam ? parseInt(beforeParam, 10) : undefined;

  if (!channel) {
    return NextResponse.json({ ok: false, error: "channel required" }, { status: 400 });
  }

  const ch = CHANNELS.find(c => c.username === channel);
  const title = ch?.title || channel;
  const { messages, oldestId } = await scrapeChannelPage(channel, title, 20, before);

  return NextResponse.json({
    ok: true,
    messages,
    oldestId,
    hasMore: messages.length >= 20,
  });
}
