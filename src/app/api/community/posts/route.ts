import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

// ── GET: list posts (optional ?category=) ────────────────────
export async function GET(req: NextRequest) {
  try {
    const category = req.nextUrl.searchParams.get("category");

    let query = supabaseAdmin
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Get like counts per post
    const postIds = (data || []).map((p: { id: string }) => p.id);
    let likeCounts: Record<string, number> = {};
    let commentCounts: Record<string, number> = {};

    if (postIds.length > 0) {
      const { data: likes } = await supabaseAdmin
        .from("post_likes")
        .select("post_id")
        .in("post_id", postIds);

      if (likes) {
        for (const l of likes) {
          likeCounts[l.post_id] = (likeCounts[l.post_id] || 0) + 1;
        }
      }

      const { data: comments } = await supabaseAdmin
        .from("post_comments")
        .select("post_id")
        .in("post_id", postIds);

      if (comments) {
        for (const c of comments) {
          commentCounts[c.post_id] = (commentCounts[c.post_id] || 0) + 1;
        }
      }
    }

    interface PostRow {
      id: string;
      user_id: string;
      author_email: string | null;
      title: string;
      content: string;
      category: string;
      symbol: string | null;
      created_at: string;
    }

    const posts = (data as PostRow[] || []).map((p) => ({
      ...p,
      likes: likeCounts[p.id] || 0,
      commentCount: commentCounts[p.id] || 0,
    }));

    return NextResponse.json({ ok: true, posts });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ── POST: create post (auth required) ────────────────────────
export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const { title, content, category, symbol } = body;

    if (!title?.trim()) {
      return NextResponse.json({ ok: false, error: "Title required" }, { status: 400 });
    }

    const validCategories = ["stock", "crypto", "overseas", "macro", "politics", "discussion", "idea", "question", "news", "free"];
    const cat = validCategories.includes(category) ? category : "discussion";

    const { data, error } = await supabaseAdmin.from("posts").insert({
      user_id: user.id,
      author_email: user.email,
      title: title.trim(),
      content: (content || "").trim(),
      category: cat,
      symbol: symbol?.trim() || null,
      image_url: body.image_url || null,
    }).select().single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, post: data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
