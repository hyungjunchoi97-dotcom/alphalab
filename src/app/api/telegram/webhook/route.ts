import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const CACHE_HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate" };

async function reply(chatId: string, text: string, replyMarkup?: object) {
  console.log("[reply] sending to chatId:", chatId, typeof chatId);
  console.log("[reply] BOT_TOKEN exists:", !!BOT_TOKEN, "length:", BOT_TOKEN.length);
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
    [{ text: "구독하기" }, { text: "구독 취소" }],
  ],
  resize_keyboard: true,
};

async function upsertSubscriber(
  chatId: string,
  username: string,
  updates: { alerts_stock?: boolean; alerts_macro?: boolean; alerts_crypto?: boolean; alerts_realestate?: boolean; is_active?: boolean }
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
        alerts_realestate: updates.alerts_realestate ?? true,
        is_active: updates.is_active ?? true,
      });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[telegram webhook] received:", JSON.stringify(body));

    const message = body?.message;
    const rawChatId = message?.chat?.id;
    console.log("[debug] rawChatId type:", typeof rawChatId, "value:", rawChatId);
    const chatId = String(rawChatId ?? "");
    console.log("[debug] chatId string:", chatId);
    if (!chatId) return NextResponse.json({ ok: true }, { headers: CACHE_HEADERS });

    const text = (message?.text ?? "").trim();
    const command = text.split(" ")[0].toLowerCase();
    const username = message?.from?.username ?? message?.from?.first_name ?? "";

    console.log("[telegram webhook] chatId:", chatId, "text:", text);

    if (!text) return NextResponse.json({ ok: true }, { headers: CACHE_HEADERS });

    const cmd = command;
    const full = text;

    if (cmd === "/start") {
      await upsertSubscriber(chatId, username, {
        alerts_stock: true, alerts_macro: true, alerts_crypto: true, alerts_realestate: true, is_active: true,
      });
      await reply(
        chatId,
        "AlphaLab 데일리 브리핑 봇입니다.\n\n전체 알림이 구독되었습니다.\n\n- 주식 알림 (평일 09:30)\n- 매크로 브리핑 (매일 08:00)\n- 크립토 브리핑 (매일 08:00)\n- 부동산 브리핑 (매일 08:00)\n\n구독을 취소하려면 '구독 취소' 버튼을 누르세요.",
        KEYBOARD
      );
    } else if (cmd === "/전체" || full === "전체 구독" || full === "구독하기") {
      await upsertSubscriber(chatId, username, {
        alerts_stock: true, alerts_macro: true, alerts_crypto: true, alerts_realestate: true, is_active: true,
      });
      await reply(chatId, "전체 알림을 구독했습니다.\n\n- 주식 알림 (평일 09:30)\n- 매크로 브리핑 (매일 08:00)\n- 크립토 브리핑 (매일 08:00)\n- 부동산 브리핑 (매일 08:00)", KEYBOARD);
    } else if (cmd === "/link") {
      const code = text.split(" ")[1]?.toUpperCase().trim();
      if (!code) {
        await reply(chatId, "사용법: /link XXXXXX\n\n코드는 AlphaLab 뉴스레터 페이지에서 발급받으세요.\nthealphalabs.net/newsletter", KEYBOARD);
      } else {
        const { data: linkCode } = await supabaseAdmin
          .from("telegram_link_codes")
          .select("*")
          .eq("code", code)
          .eq("used", false)
          .gt("expires_at", new Date().toISOString())
          .single();

        if (!linkCode) {
          await reply(chatId, "유효하지 않거나 만료된 코드입니다.\n\n새 코드를 발급받으세요: thealphalabs.net/newsletter", KEYBOARD);
        } else {
          await supabaseAdmin
            .from("telegram_link_codes")
            .update({ used: true })
            .eq("code", code);

          const { data: existing } = await supabaseAdmin
            .from("telegram_subscribers")
            .select("id")
            .eq("chat_id", chatId)
            .single();

          if (existing) {
            await supabaseAdmin
              .from("telegram_subscribers")
              .update({ user_id: linkCode.user_id, updated_at: new Date().toISOString() })
              .eq("chat_id", chatId);
          } else {
            await supabaseAdmin
              .from("telegram_subscribers")
              .insert({
                chat_id: chatId,
                user_id: linkCode.user_id,
                username,
                alerts_stock: true,
                alerts_macro: true,
                alerts_crypto: true,
                alerts_realestate: true,
                is_active: true,
              });
          }

          await reply(chatId, "AlphaLab 계정과 연결되었습니다!\n\n이제 뉴스레터를 받을 수 있어요.", KEYBOARD);
        }
      }
    } else if (cmd === "/구독취소" || full === "구독 취소") {
      await upsertSubscriber(chatId, username, { is_active: false });
      await reply(chatId, "모든 알림 구독이 취소되었습니다.\n다시 구독하려면 '구독하기' 버튼을 누르세요.", KEYBOARD);
    } else if (cmd === "/내구독") {
      const { data } = await supabaseAdmin
        .from("telegram_subscribers")
        .select("alerts_stock, alerts_macro, alerts_crypto, alerts_realestate, is_active, user_id")
        .eq("chat_id", chatId)
        .single();

      if (!data || !data.is_active) {
        await reply(chatId, "현재 구독 중인 알림이 없습니다.\n'구독하기' 버튼을 눌러 구독을 시작하세요.", KEYBOARD);
      } else {
        const lines = ["현재 구독 상태:"];
        lines.push(`- 주식 알림: ${data.alerts_stock ? "ON" : "OFF"}`);
        lines.push(`- 매크로 브리핑: ${data.alerts_macro ? "ON" : "OFF"}`);
        lines.push(`- 크립토 브리핑: ${data.alerts_crypto ? "ON" : "OFF"}`);
        lines.push(`- 부동산 브리핑: ${data.alerts_realestate ? "ON" : "OFF"}`);
        lines.push(`\n계정 연결: ${data.user_id ? "연결됨" : "미연결 (/link 코드로 연결)"}`);
        await reply(chatId, lines.join("\n"), KEYBOARD);
      }
    } else {
      await reply(chatId, "아래 버튼을 사용하거나 명령어를 입력해 주세요.\n\n/전체 /내구독 /구독취소 /link", KEYBOARD);
    }

    return NextResponse.json({ ok: true }, { headers: CACHE_HEADERS });
  } catch (e) {
    console.error("[telegram-webhook]", e);
    return NextResponse.json({ ok: true }, { headers: CACHE_HEADERS });
  }
}
