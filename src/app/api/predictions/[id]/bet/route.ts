import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

// ── GET: check user's existing bet on this market ──────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: marketId } = await params;

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ ok: true, bet: null });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return NextResponse.json({ ok: true, bet: null });
    }

    const { data: bet } = await supabaseAdmin
      .from("predictions_bets")
      .select("choice, points, created_at")
      .eq("market_id", marketId)
      .eq("user_id", user.id)
      .single();

    return NextResponse.json({ ok: true, bet: bet || null });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ── POST: place a bet ──────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: marketId } = await params;

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    }

    const body = await req.json();
    const { choice, points } = body;

    if (choice !== "yes" && choice !== "no") {
      return NextResponse.json({ ok: false, error: "choice must be 'yes' or 'no'" }, { status: 400 });
    }
    if (!points || points < 10) {
      return NextResponse.json({ ok: false, error: "Minimum 10 points" }, { status: 400 });
    }

    // Check prediction exists and is open
    const { data: pred, error: predError } = await supabaseAdmin
      .from("predictions")
      .select("id, status, closes_at")
      .eq("id", marketId)
      .single();

    if (predError || !pred) {
      return NextResponse.json({ ok: false, error: "Market not found" }, { status: 404 });
    }
    if (pred.status !== "open") {
      return NextResponse.json({ ok: false, error: "Market is not open" }, { status: 400 });
    }
    if (new Date(pred.closes_at) <= new Date()) {
      return NextResponse.json({ ok: false, error: "Betting has ended" }, { status: 400 });
    }

    // Insert bet (unique constraint prevents double betting)
    const { error: betError } = await supabaseAdmin
      .from("predictions_bets")
      .insert({
        market_id: marketId,
        user_id: user.id,
        choice,
        points: Math.min(Math.floor(points), 10000),
      });

    if (betError) {
      if (betError.code === "23505") {
        return NextResponse.json({ ok: false, error: "Already bet on this market" }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: betError.message }, { status: 500 });
    }

    // Return updated stats
    const { data: bets } = await supabaseAdmin
      .from("predictions_bets")
      .select("choice, points")
      .eq("market_id", marketId);

    let yesPoints = 0, noPoints = 0, yesCount = 0, noCount = 0;
    if (bets) {
      for (const b of bets) {
        if (b.choice === "yes") { yesPoints += b.points; yesCount++; }
        else { noPoints += b.points; noCount++; }
      }
    }
    const totalPoints = yesPoints + noPoints;
    const participants = yesCount + noCount;

    return NextResponse.json({
      ok: true,
      stats: {
        yesCount,
        noCount,
        participants,
        yesPct: totalPoints > 0 ? Math.round((yesPoints / totalPoints) * 100) : 50,
        noPct: totalPoints > 0 ? Math.round((noPoints / totalPoints) * 100) : 50,
        volume: totalPoints,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
