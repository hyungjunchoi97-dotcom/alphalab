import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from("posts")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ ok: false, error: "Post not found" }, { status: 404 });
    }

    // Get like & comment counts
    const { data: likes } = await supabaseAdmin
      .from("post_likes")
      .select("id")
      .eq("post_id", id);

    const { data: comments } = await supabaseAdmin
      .from("post_comments")
      .select("id")
      .eq("post_id", id);

    return NextResponse.json({
      ok: true,
      post: {
        ...data,
        likes: likes?.length || 0,
        commentCount: comments?.length || 0,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
