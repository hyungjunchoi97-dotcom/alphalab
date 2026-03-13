import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";
import { calculateAMM, calculateBetReturn, validateBet } from "@/lib/amm";
import { ensureUserPoints } from "@/lib/predictionOdds";

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

// ── GET: check user's existing bet ────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: predictionId } = await params;
    const user = await getUser(req);
    if (!user) return NextResponse.json({ ok: true, bet: null });

    const { data: bet } = await supabaseAdmin
      .from("prediction_bets")
      .select("side, points_wagered, odds_at_bet, potential_payout, shares_received, probability_at_bet, status, created_at")
      .eq("prediction_id", predictionId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!bet) return NextResponse.json({ ok: true, bet: null });

    return NextResponse.json({
      ok: true,
      bet: {
        choice: bet.side,
        points: bet.points_wagered,
        oddsAtBet: bet.odds_at_bet,
        potentialPayout: bet.potential_payout,
        sharesReceived: bet.shares_received,
        status: bet.status,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown" }, { status: 500 });
  }
}

// ── POST: place a bet via AMM ─────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: predictionId } = await params;
    const user = await getUser(req);
    if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

    const body = await req.json();
    const { choice, points } = body;
    const side = choice as "yes" | "no";

    if (side !== "yes" && side !== "no") {
      return NextResponse.json({ ok: false, error: "choice must be 'yes' or 'no'" }, { status: 400 });
    }
    const betAmount = Math.floor(Number(points));
    if (!betAmount || betAmount < 10) {
      return NextResponse.json({ ok: false, error: "최소 베팅은 10 pts입니다" }, { status: 400 });
    }

    // Fetch prediction with AMM pools
    const { data: pred, error: predErr } = await supabaseAdmin
      .from("predictions")
      .select("id, status, closes_at, yes_pool, no_pool")
      .eq("id", predictionId)
      .single();

    if (predErr || !pred) return NextResponse.json({ ok: false, error: "Prediction not found" }, { status: 404 });
    if (pred.status !== "open") return NextResponse.json({ ok: false, error: "베팅 마감" }, { status: 400 });
    if (new Date(pred.closes_at) <= new Date()) return NextResponse.json({ ok: false, error: "베팅 마감" }, { status: 400 });

    const yesPool = Number(pred.yes_pool) || 100;
    const noPool = Number(pred.no_pool) || 100;

    // Validate bet (min/max/liquidity)
    const validErr = validateBet(yesPool, noPool, side, betAmount);
    if (validErr) return NextResponse.json({ ok: false, error: validErr }, { status: 400 });

    // Block opposite-side bet
    const { data: existingBet } = await supabaseAdmin
      .from("prediction_bets")
      .select("side")
      .eq("prediction_id", predictionId)
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (existingBet && existingBet.side !== side) {
      return NextResponse.json({ ok: false, error: "이미 반대 방향으로 베팅하셨습니다" }, { status: 409 });
    }

    // Ensure user has enough points
    const userPts = await ensureUserPoints(supabaseAdmin, user.id);
    if (userPts.balance < betAmount) {
      return NextResponse.json({ ok: false, error: `포인트 부족 (보유: ${Math.floor(userPts.balance)} pts)` }, { status: 400 });
    }

    // AMM calculation
    const amm = calculateBetReturn(yesPool, noPool, side, betAmount);
    const currentAmm = calculateAMM(yesPool, noPool);
    const probabilityAtBet = side === "yes" ? currentAmm.yesProbability : currentAmm.noProbability;

    // Insert bet
    const { error: betErr } = await supabaseAdmin.from("prediction_bets").insert({
      user_id: user.id,
      prediction_id: predictionId,
      side,
      points_wagered: betAmount,
      odds_at_bet: amm.effectiveOdds,
      potential_payout: amm.potentialPayout,
      shares_received: amm.sharesReceived,
      probability_at_bet: Math.round(probabilityAtBet * 10000) / 10000,
      status: "pending",
    });
    if (betErr) return NextResponse.json({ ok: false, error: betErr.message }, { status: 500 });

    // Deduct user balance
    await supabaseAdmin.from("user_points").update({
      balance: userPts.balance - betAmount,
      total_wagered: userPts.total_wagered + betAmount,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);

    // Update AMM pools
    await supabaseAdmin.from("predictions").update({
      yes_pool: amm.newYesPool,
      no_pool: amm.newNoPool,
      k_constant: amm.newYesPool * amm.newNoPool,
    }).eq("id", predictionId);

    const newAmm = calculateAMM(amm.newYesPool, amm.newNoPool);

    return NextResponse.json({
      ok: true,
      odds_locked: amm.effectiveOdds,
      potential_payout: amm.potentialPayout,
      shares_received: amm.sharesReceived,
      new_balance: Math.round((userPts.balance - betAmount) * 100) / 100,
      isNewUser: userPts.isNew,
      stats: {
        yesPool: amm.newYesPool,
        noPool: amm.newNoPool,
        totalPool: amm.newYesPool + amm.newNoPool,
        yesPct: Math.round(newAmm.yesProbability * 100),
        noPct: Math.round(newAmm.noProbability * 100),
        yesOdds: newAmm.yesOdds,
        noOdds: newAmm.noOdds,
        volume: Math.round(amm.newYesPool + amm.newNoPool - 200),
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown" }, { status: 500 });
  }
}
