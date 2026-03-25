import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);

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

    const { data: comment, error: commentError } = await supabaseAdmin
      .from("post_comments")
      .select("id, author_email")
      .eq("id", id)
      .single();

    if (commentError || !comment) {
      return NextResponse.json({ ok: false, error: "Comment not found" }, { status: 404 });
    }

    if (comment.author_email !== user.email && !ADMIN_EMAILS.includes(user.email ?? "")) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // Delete replies to this comment
    await supabaseAdmin.from("post_comments").delete().eq("parent_id", id);
    // Delete the comment itself
    await supabaseAdmin.from("post_comments").delete().eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
