import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { sendMessage, buildStockAlert, buildMacroAlert, buildCryptoAlert, buildRealestateAlert } from "@/lib/telegramAlert";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const type = req.nextUrl.searchParams.get("type");
  if (!type || !["stock", "macro_crypto"].includes(type)) {
    return NextResponse.json({ ok: false, error: "Invalid type param" }, { status: 400 });
  }

  const results: { type: string; sent: number; failed: number; error?: string }[] = [];

  try {
    if (type === "stock") {
      const msg = await buildStockAlert();
      if (!msg) {
        return NextResponse.json({ ok: true, message: "No stock data to send", results });
      }

      const { data: subs } = await supabaseAdmin
        .from("telegram_subscribers")
        .select("chat_id")
        .eq("is_active", true)
        .eq("alerts_stock", true);

      let sent = 0, failed = 0;
      for (const sub of subs ?? []) {
        const ok = await sendMessage(sub.chat_id, msg, "HTML");
        if (ok) sent++; else failed++;
      }
      results.push({ type: "stock", sent, failed });
    }

    if (type === "macro_crypto") {
      // Macro
      const macroMsg = await buildMacroAlert();
      if (macroMsg) {
        const { data: macroSubs } = await supabaseAdmin
          .from("telegram_subscribers")
          .select("chat_id")
          .eq("is_active", true)
          .eq("alerts_macro", true);

        let sent = 0, failed = 0;
        for (const sub of macroSubs ?? []) {
          const ok = await sendMessage(sub.chat_id, macroMsg, "HTML");
          if (ok) sent++; else failed++;
        }
        results.push({ type: "macro", sent, failed });
      } else {
        results.push({ type: "macro", sent: 0, failed: 0, error: "No macro data" });
      }

      // Crypto
      const cryptoMsg = await buildCryptoAlert();
      if (cryptoMsg) {
        const { data: cryptoSubs } = await supabaseAdmin
          .from("telegram_subscribers")
          .select("chat_id")
          .eq("is_active", true)
          .eq("alerts_crypto", true);

        let sent = 0, failed = 0;
        for (const sub of cryptoSubs ?? []) {
          const ok = await sendMessage(sub.chat_id, cryptoMsg, "HTML");
          if (ok) sent++; else failed++;
        }
        results.push({ type: "crypto", sent, failed });
      } else {
        results.push({ type: "crypto", sent: 0, failed: 0, error: "No crypto data" });
      }

      // Realestate - per user district preference
      const { data: realestateSubs } = await supabaseAdmin
        .from("telegram_realestate_watch")
        .select("chat_id, district")
        .not("chat_id", "is", null)
        .not("district", "is", null);

      const districtCache: Record<string, string> = {};
      let reSent = 0, reFailed = 0;
      for (const sub of realestateSubs ?? []) {
        const district = sub.district;
        if (!districtCache[district]) {
          districtCache[district] = await buildRealestateAlert(district);
        }
        const msg = districtCache[district];
        if (!msg) continue;
        const ok = await sendMessage(String(sub.chat_id), msg, "HTML");
        if (ok) reSent++; else reFailed++;
      }
      if (reSent > 0 || reFailed > 0) {
        results.push({ type: "realestate", sent: reSent, failed: reFailed });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    return NextResponse.json({
      ok: false, error: err instanceof Error ? err.message : "Unknown", results,
    }, { status: 500 });
  }
}
