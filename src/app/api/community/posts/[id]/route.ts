import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "hyungjunchoi97@gmail.com").split(",").map(e => e.trim()).filter(Boolean);

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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    const { id } = await params;

    const { data: post, error: postError } = await supabaseAdmin
      .from("posts")
      .select("id, author_email")
      .eq("id", id)
      .single();

    if (postError || !post) {
      return NextResponse.json({ ok: false, error: "Post not found" }, { status: 404 });
    }

    if (post.author_email !== user.email && !ADMIN_EMAILS.includes(user.email ?? "")) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // Delete related data
    await supabaseAdmin.from("post_comments").delete().eq("post_id", id);
    await supabaseAdmin.from("post_likes").delete().eq("post_id", id);
    await supabaseAdmin.from("posts").delete().eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
