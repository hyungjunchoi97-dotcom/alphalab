import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const adminToken = process.env.PB_ADMIN_TOKEN;

    if (!adminToken || token !== adminToken) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { resolved_option_id } = body;

    if (!resolved_option_id || !["yes", "no"].includes(resolved_option_id)) {
      return NextResponse.json(
        { ok: false, error: "resolved_option_id must be 'yes' or 'no'" },
        { status: 400 }
      );
    }

    const { data: pred, error: fetchErr } = await supabaseAdmin
      .from("predictions")
      .select("id, status")
      .eq("id", id)
      .single();

    if (fetchErr || !pred) {
      return NextResponse.json({ ok: false, error: "Prediction not found" }, { status: 404 });
    }
    if (pred.status === "resolved") {
      return NextResponse.json({ ok: false, error: "Already resolved" }, { status: 400 });
    }

    // Mark prediction resolved
    const { error: updateErr } = await supabaseAdmin
      .from("predictions")
      .update({
        status: "resolved",
        resolved_option_id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) {
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
    }

    // Payout winners: actual_payout = betAmount + sharesReceived * (1 - 0.05)
    const { data: bets } = await supabaseAdmin
      .from("prediction_bets")
      .select("id, user_id, side, points_wagered, shares_received, potential_payout")
      .eq("prediction_id", id)
      .eq("status", "pending");

    let winnersCount = 0;
    let totalPaidOut = 0;

    for (const bet of bets ?? []) {
      if (bet.side === resolved_option_id) {
        // Use stored potential_payout (= betAmount + shares * 0.95, calculated at bet time)
        const payout = Math.round(Number(bet.potential_payout) * 100) / 100;

        await supabaseAdmin.from("prediction_bets").update({
          status: "won",
          actual_payout: payout,
        }).eq("id", bet.id);

        const { data: pts } = await supabaseAdmin
          .from("user_points")
          .select("balance, total_won")
          .eq("user_id", bet.user_id)
          .single();

        if (pts) {
          await supabaseAdmin.from("user_points").update({
            balance: Number(pts.balance) + payout,
            total_won: Number(pts.total_won) + payout,
            updated_at: new Date().toISOString(),
          }).eq("user_id", bet.user_id);
        }

        winnersCount++;
        totalPaidOut += payout;
      } else {
        await supabaseAdmin.from("prediction_bets").update({
          status: "lost",
          actual_payout: 0,
        }).eq("id", bet.id);
      }
    }

    return NextResponse.json({
      ok: true,
      resolved_option_id,
      bets: { winners_count: winnersCount, total_paid_out: Math.round(totalPaidOut) },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
