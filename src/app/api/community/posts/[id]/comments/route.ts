import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

// ── GET: list comments for a post ─────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sort = req.nextUrl.searchParams.get("sort") || "new";

    const orderCol = sort === "popular" ? "likes" : "created_at";
    const ascending = sort === "popular" ? false : true;

    const { data, error } = await supabaseAdmin
      .from("post_comments")
      .select("*")
      .eq("post_id", id)
      .order(orderCol, { ascending });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, comments: data || [] });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ── POST: add comment (auth required) ─────────────────────────
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

    const body = await req.json();
    const { content, parent_id } = body;

    if (!content?.trim()) {
      return NextResponse.json({ ok: false, error: "Content required" }, { status: 400 });
    }

    const insertData: Record<string, unknown> = {
      post_id: id,
      user_id: user.id,
      author_email: user.email,
      content: content.trim(),
    };
    if (parent_id) insertData.parent_id = parent_id;

    const { data, error } = await supabaseAdmin.from("post_comments").insert(insertData).select().single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, comment: data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
