import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 30;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const CACHE_KEY = "telegram_apt2me_feed";
const TTL_MS = 3 * 60 * 1000; // 3분
const TARGET_USERNAME = "apt2me";

export interface TelegramMessage {
  id: number;
  date: number; // Unix timestamp
  text: string;
  imageUrl: string | null;
  link: string;
}

interface CachedData {
  messages: TelegramMessage[];
  lastOffset: number;
}

async function getCache(): Promise<{ data: CachedData | null; fresh: boolean }> {
  try {
    const { data } = await supabaseAdmin
      .from("legend_screener_cache")
      .select("results, created_at")
      .eq("cache_key", CACHE_KEY)
      .single();
    if (!data) return { data: null, fresh: false };
    const age = Date.now() - new Date(data.created_at).getTime();
    return { data: data.results as CachedData, fresh: age < TTL_MS };
  } catch {
    return { data: null, fresh: false };
  }
}

async function saveCache(payload: CachedData) {
  try {
    await supabaseAdmin.from("legend_screener_cache").delete().eq("cache_key", CACHE_KEY);
    await supabaseAdmin.from("legend_screener_cache").insert({
      cache_key: CACHE_KEY,
      results: payload,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[TG] cache save error:", err);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseMessage(post: any): TelegramMessage | null {
  const text: string = post.text ?? post.caption ?? "";
  if (!text.trim()) return null;
  const id: number = post.message_id;
  const date: number = post.date;
  const chatUsername: string = (post.chat?.username ?? "").toLowerCase();

  // Accept if the channel username matches or if we can't determine it (accept all channel_posts)
  if (chatUsername && chatUsername !== TARGET_USERNAME) return null;

  const link = `https://t.me/${TARGET_USERNAME}/${id}`;
  return { id, date, text: text.trim(), imageUrl: null, link };
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  if (!BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: "BOT_TOKEN not configured" }, { status: 500 });
  }

  // ── DEBUG mode ──────────────────────────────────────────────
  if (sp.get("debug") === "true") {
    const debug: Record<string, unknown> = { botTokenConfigured: BOT_TOKEN.length > 0 };

    // Test 1: getUpdates (no filter)
    try {
      const r1 = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=50`,
        { signal: AbortSignal.timeout(10000) }
      );
      const j1 = await r1.json();
      debug.getUpdates = {
        ok: j1.ok,
        count: j1.result?.length ?? 0,
        description: j1.description ?? null,
        firstUpdate: j1.result?.[0] ?? null,
        updateTypes: [...new Set((j1.result ?? []).map((u: Record<string, unknown>) => Object.keys(u).filter((k) => k !== "update_id")))],
      };
    } catch (e) {
      debug.getUpdates = { error: String(e) };
    }

    // Test 2: getChat @apt2me
    try {
      const r2 = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=@apt2me`,
        { signal: AbortSignal.timeout(10000) }
      );
      debug.getChat = await r2.json();
    } catch (e) {
      debug.getChat = { error: String(e) };
    }

    // Test 3: getChatMemberCount
    try {
      const r3 = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getChatMemberCount?chat_id=@apt2me`,
        { signal: AbortSignal.timeout(10000) }
      );
      debug.getChatMemberCount = await r3.json();
    } catch (e) {
      debug.getChatMemberCount = { error: String(e) };
    }

    return NextResponse.json(debug);
  }

  // ── Normal mode ─────────────────────────────────────────────
  const { data: cached, fresh } = await getCache();
  if (fresh && cached) {
    return NextResponse.json({ ok: true, messages: cached.messages, cached: true });
  }

  const existingMessages: TelegramMessage[] = cached?.messages ?? [];
  const offset: number = cached?.lastOffset ?? 0;

  try {
    const params = new URLSearchParams({ limit: "100" });
    if (offset > 0) params.set("offset", String(offset));

    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?${params}`,
      { signal: AbortSignal.timeout(10000) }
    );
    const json = await res.json();

    if (!json.ok) {
      console.error("[TG] getUpdates error:", json.description);
      if (existingMessages.length > 0) {
        return NextResponse.json({ ok: true, messages: existingMessages, cached: true, stale: true });
      }
      return NextResponse.json({ ok: false, error: json.description }, { status: 502 });
    }

    const updates = json.result ?? [];
    let newOffset = offset;

    const newMessages: TelegramMessage[] = [];
    for (const update of updates) {
      newOffset = Math.max(newOffset, update.update_id + 1);
      const post = update.channel_post ?? update.message;
      if (!post) continue;
      const msg = parseMessage(post);
      if (msg) newMessages.push(msg);
    }

    console.log(`[TG] updates=${updates.length} newMessages=${newMessages.length}`);

    const existingIds = new Set(existingMessages.map((m) => m.id));
    const merged = [
      ...newMessages.filter((m) => !existingIds.has(m.id)),
      ...existingMessages,
    ]
      .sort((a, b) => b.date - a.date)
      .slice(0, 100);

    const payload: CachedData = { messages: merged, lastOffset: newOffset };
    await saveCache(payload);

    return NextResponse.json({ ok: true, messages: merged, cached: false });
  } catch (err) {
    console.error("[TG] fetch error:", err);
    if (existingMessages.length > 0) {
      return NextResponse.json({ ok: true, messages: existingMessages, cached: true, stale: true });
    }
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
