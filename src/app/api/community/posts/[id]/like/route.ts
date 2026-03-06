import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Check if already liked
    const { data: existing } = await supabaseAdmin
      .from("post_likes")
      .select("id")
      .eq("post_id", id)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      // Unlike: remove the like
      await supabaseAdmin
        .from("post_likes")
        .delete()
        .eq("post_id", id)
        .eq("user_id", user.id);
    } else {
      // Like: insert
      await supabaseAdmin
        .from("post_likes")
        .insert({ post_id: id, user_id: user.id });
    }

    // Get updated count
    const { data: allLikes } = await supabaseAdmin
      .from("post_likes")
      .select("id")
      .eq("post_id", id);

    const likeCount = allLikes?.length || 0;

    // Update denormalized count on posts table
    await supabaseAdmin
      .from("posts")
      .update({ likes: likeCount })
      .eq("id", id);

    return NextResponse.json({
      ok: true,
      liked: !existing,
      likes: likeCount,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
