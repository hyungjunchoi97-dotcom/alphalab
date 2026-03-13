import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

async function getUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (error || !user) return null;
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    const { data: bets, error } = await supabaseAdmin
      .from("prediction_bets")
      .select("id, prediction_id, side, points_wagered, odds_at_bet, potential_payout, actual_payout, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!bets || bets.length === 0) return NextResponse.json({ ok: true, bets: [] });

    // Fetch prediction titles
    const predIds = [...new Set(bets.map((b) => b.prediction_id))];
    const { data: preds } = await supabaseAdmin
      .from("predictions")
      .select("id, title_kr, title_en, status, resolved_option_id")
      .in("id", predIds);

    const predMap: Record<string, { title_kr: string; title_en: string; status: string; resolved_option_id: string | null }> = {};
    for (const p of preds || []) predMap[p.id] = p;

    const result = bets.map((b) => ({
      id: b.id,
      predictionId: b.prediction_id,
      predictionTitle: predMap[b.prediction_id]?.title_kr || predMap[b.prediction_id]?.title_en || "Unknown",
      predictionStatus: predMap[b.prediction_id]?.status || "open",
      resolvedOutcome: predMap[b.prediction_id]?.resolved_option_id || null,
      side: b.side,
      pointsWagered: b.points_wagered,
      oddsAtBet: b.odds_at_bet,
      potentialPayout: b.potential_payout,
      actualPayout: b.actual_payout,
      status: b.status,
      createdAt: b.created_at,
    }));

    return NextResponse.json({ ok: true, bets: result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown" }, { status: 500 });
  }
}
