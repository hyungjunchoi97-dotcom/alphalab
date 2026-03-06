import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: predictionId } = await params;

    // Auth check
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
    const optionId = body.optionId;
    if (optionId !== "yes" && optionId !== "no") {
      return NextResponse.json({ ok: false, error: "optionId must be 'yes' or 'no'" }, { status: 400 });
    }

    // Check prediction exists and is open
    const { data: pred, error: predError } = await supabaseAdmin
      .from("predictions")
      .select("id, status, closes_at")
      .eq("id", predictionId)
      .single();

    if (predError || !pred) {
      return NextResponse.json({ ok: false, error: "Prediction not found" }, { status: 404 });
    }
    if (pred.status !== "open") {
      return NextResponse.json({ ok: false, error: "Prediction is not open" }, { status: 400 });
    }
    if (new Date(pred.closes_at) <= new Date()) {
      return NextResponse.json({ ok: false, error: "Voting has ended" }, { status: 400 });
    }

    // Insert vote (unique constraint prevents double voting)
    const { error: voteError } = await supabaseAdmin
      .from("prediction_votes")
      .insert({
        prediction_id: predictionId,
        user_id: user.id,
        option_id: optionId,
      });

    if (voteError) {
      if (voteError.code === "23505") {
        return NextResponse.json({ ok: false, error: "Already voted" }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: voteError.message }, { status: 500 });
    }

    // Return updated counts
    const { data: votes } = await supabaseAdmin
      .from("prediction_votes")
      .select("option_id")
      .eq("prediction_id", predictionId);

    let yesCount = 0;
    let noCount = 0;
    if (votes) {
      for (const v of votes) {
        if (v.option_id === "yes") yesCount++;
        if (v.option_id === "no") noCount++;
      }
    }
    const total = yesCount + noCount;

    return NextResponse.json({
      ok: true,
      stats: {
        yesCount,
        noCount,
        participants: total,
        yesPct: total > 0 ? Math.round((yesCount / total) * 100) : 50,
        noPct: total > 0 ? Math.round((noCount / total) * 100) : 50,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
