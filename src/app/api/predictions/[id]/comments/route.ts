import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

// ── GET: fetch comments for a prediction ─────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: predictionId } = await params;

    const { data: comments, error } = await supabaseAdmin
      .from("prediction_comments")
      .select("id, user_id, content, created_at")
      .eq("prediction_id", predictionId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Fetch user emails for display names
    const userIds = [...new Set((comments || []).map((c) => c.user_id))];
    const userMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      if (users) {
        for (const u of users) {
          if (userIds.includes(u.id)) {
            const email = u.email || "";
            userMap[u.id] = email.split("@")[0] || "user";
          }
        }
      }
    }

    const result = (comments || []).map((c) => ({
      id: c.id,
      userName: userMap[c.user_id] || "user",
      content: c.content,
      createdAt: c.created_at,
    }));

    return NextResponse.json({ ok: true, comments: result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ── POST: add a comment (must have bet on this prediction) ───
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: predictionId } = await params;

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

    // Verify user has bet on this prediction
    const { data: bet } = await supabaseAdmin
      .from("predictions_bets")
      .select("id")
      .eq("market_id", predictionId)
      .eq("user_id", user.id)
      .single();

    if (!bet) {
      return NextResponse.json(
        { ok: false, error: "Must place a bet before commenting" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const content = (body.content || "").trim();

    if (!content) {
      return NextResponse.json({ ok: false, error: "Content required" }, { status: 400 });
    }
    if (content.length > 200) {
      return NextResponse.json({ ok: false, error: "Max 200 characters" }, { status: 400 });
    }

    const { data: comment, error: insertError } = await supabaseAdmin
      .from("prediction_comments")
      .insert({
        prediction_id: predictionId,
        user_id: user.id,
        content,
      })
      .select("id, content, created_at")
      .single();

    if (insertError) {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }

    const email = user.email || "";
    return NextResponse.json({
      ok: true,
      comment: {
        id: comment.id,
        userName: email.split("@")[0] || "user",
        content: comment.content,
        createdAt: comment.created_at,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
