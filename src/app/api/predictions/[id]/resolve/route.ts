import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Admin auth via PB_ADMIN_TOKEN
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

    // Verify prediction exists and is not already resolved
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

    // Resolve the prediction
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

    // Count correct/incorrect votes
    const { data: votes } = await supabaseAdmin
      .from("prediction_votes")
      .select("option_id")
      .eq("prediction_id", id);

    let correct = 0;
    let incorrect = 0;
    for (const v of votes || []) {
      if (v.option_id === resolved_option_id) correct++;
      else incorrect++;
    }

    return NextResponse.json({
      ok: true,
      resolved_option_id,
      votes: { correct, incorrect, total: correct + incorrect },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
