import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const CACHE_HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate" };

async function reply(chatId: string, text: string, replyMarkup?: object) {
  if (!BOT_TOKEN) {
    console.log("[reply] no BOT_TOKEN");
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });
  const result = await res.json();
  console.log("[reply result]", JSON.stringify(result));
}

const KEYBOARD = {
  keyboard: [
    [{ text: "전체 구독" }, { text: "주식만" }],
    [{ text: "매크로만" }, { text: "크립토만" }],
    [{ text: "내 구독 확인" }, { text: "구독 취소" }],
  ],
  resize_keyboard: true,
};

async function upsertSubscriber(
  chatId: string,
  username: string,
  updates: { alerts_stock?: boolean; alerts_macro?: boolean; alerts_crypto?: boolean; is_active?: boolean }
) {
  const { data: existing } = await supabaseAdmin
    .from("telegram_subscribers")
    .select("id")
    .eq("chat_id", chatId)
    .single();

  if (existing) {
    await supabaseAdmin
      .from("telegram_subscribers")
      .update({ ...updates, username, updated_at: new Date().toISOString() })
      .eq("chat_id", chatId);
  } else {
    await supabaseAdmin
      .from("telegram_subscribers")
      .insert({
        chat_id: chatId,
        username,
        alerts_stock: updates.alerts_stock ?? true,
        alerts_macro: updates.alerts_macro ?? true,
        alerts_crypto: updates.alerts_crypto ?? true,
        is_active: updates.is_active ?? true,
      });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[telegram webhook] received:", JSON.stringify(body));

    const message = body?.message;
    // Keep chat_id as string to avoid JS number precision loss for large IDs
    const rawChatId = message?.chat?.id;
    const chatId = rawChatId != null ? String(rawChatId) : "";
    if (!chatId) return NextResponse.json({ ok: true }, { headers: CACHE_HEADERS });

    const text = (message?.text ?? "").trim();
    const command = text.split(" ")[0].toLowerCase();
    const username = message?.from?.username ?? message?.from?.first_name ?? "";

    console.log("[telegram webhook] chatId:", chatId, "text:", text);

    if (!text) return NextResponse.json({ ok: true }, { headers: CACHE_HEADERS });

    const cmd = command;
    const full = text;

    if (cmd === "/start") {
      await reply(
        chatId,
        "AlphaLab 데일리 브리핑 봇입니다.\n\n아래에서 받고 싶은 알림을 선택하세요.",
        KEYBOARD
      );
      await upsertSubscriber(chatId, username, {
        alerts_stock: true, alerts_macro: true, alerts_crypto: true, is_active: true,
      });
    } else if (cmd === "/전체" || full === "전체 구독") {
      await upsertSubscriber(chatId, username, {
        alerts_stock: true, alerts_macro: true, alerts_crypto: true, is_active: true,
      });
      await reply(chatId, "전체 알림을 구독했습니다.\n\n- 주식 알림 (평일 09:30)\n- 매크로 브리핑 (매일 08:00)\n- 크립토 브리핑 (매일 08:00)", KEYBOARD);
    } else if (cmd === "/주식" || full === "주식만") {
      await upsertSubscriber(chatId, username, {
        alerts_stock: true, alerts_macro: false, alerts_crypto: false, is_active: true,
      });
      await reply(chatId, "주식 알림만 구독했습니다.\n발송 시간: 평일 09:30", KEYBOARD);
    } else if (cmd === "/매크로" || full === "매크로만") {
      await upsertSubscriber(chatId, username, {
        alerts_stock: false, alerts_macro: true, alerts_crypto: false, is_active: true,
      });
      await reply(chatId, "매크로 브리핑만 구독했습니다.\n발송 시간: 매일 08:00", KEYBOARD);
    } else if (cmd === "/크립토" || full === "크립토만") {
      await upsertSubscriber(chatId, username, {
        alerts_stock: false, alerts_macro: false, alerts_crypto: true, is_active: true,
      });
      await reply(chatId, "크립토 브리핑만 구독했습니다.\n발송 시간: 매일 08:00", KEYBOARD);
    } else if (cmd === "/구독취소" || full === "구독 취소") {
      await upsertSubscriber(chatId, username, { is_active: false });
      await reply(chatId, "모든 알림 구독이 취소되었습니다.\n다시 구독하려면 /start 를 입력하세요.", KEYBOARD);
    } else if (cmd === "/내구독" || full === "내 구독 확인") {
      const { data } = await supabaseAdmin
        .from("telegram_subscribers")
        .select("alerts_stock, alerts_macro, alerts_crypto, is_active")
        .eq("chat_id", chatId)
        .single();

      if (!data || !data.is_active) {
        await reply(chatId, "현재 구독 중인 알림이 없습니다.\n/start 로 구독을 시작하세요.", KEYBOARD);
      } else {
        const lines = ["현재 구독 상태:"];
        lines.push(`- 주식 알림: ${data.alerts_stock ? "ON" : "OFF"}`);
        lines.push(`- 매크로 브리핑: ${data.alerts_macro ? "ON" : "OFF"}`);
        lines.push(`- 크립토 브리핑: ${data.alerts_crypto ? "ON" : "OFF"}`);
        await reply(chatId, lines.join("\n"), KEYBOARD);
      }
    } else {
      await reply(chatId, "아래 버튼을 사용하거나 명령어를 입력해 주세요.\n\n/전체 /주식 /매크로 /크립토 /내구독 /구독취소", KEYBOARD);
    }

    return NextResponse.json({ ok: true }, { headers: CACHE_HEADERS });
  } catch (e) {
    console.error("[telegram-webhook]", e);
    return NextResponse.json({ ok: true }, { headers: CACHE_HEADERS });
  }
}
