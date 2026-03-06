import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: reviews, error } = await supabaseAdmin
      .from("prompt_ratings")
      .select("*")
      .eq("prompt_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, reviews: reviews || [] });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: promptId } = await params;

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    }

    const body = await req.json();
    const { rating, comment } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ ok: false, error: "rating must be 1-5" }, { status: 400 });
    }

    // Insert rating (unique constraint prevents double rating)
    const { error: ratingError } = await supabaseAdmin
      .from("prompt_ratings")
      .insert({
        prompt_id: promptId,
        user_id: user.id,
        rating,
        comment: comment || "",
      });

    if (ratingError) {
      if (ratingError.code === "23505") {
        return NextResponse.json({ ok: false, error: "Already rated" }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: ratingError.message }, { status: 500 });
    }

    // Update prompt rating_sum and rating_count
    const { data: allRatings } = await supabaseAdmin
      .from("prompt_ratings")
      .select("rating")
      .eq("prompt_id", promptId);

    if (allRatings) {
      const sum = allRatings.reduce((s, r) => s + r.rating, 0);
      const count = allRatings.length;

      await supabaseAdmin
        .from("prompts")
        .update({ rating_sum: sum, rating_count: count })
        .eq("id", promptId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
