import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "hyungjunchoi97@gmail.com").split(",").map(e => e.trim()).filter(Boolean);

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });

    // Admin bypass
    if (user.email && ADMIN_EMAILS.includes(user.email)) {
      return NextResponse.json({
        ok: true,
        user_id: user.id,
        is_eligible: true,
        is_admin: true,
        is_monthly_active: true,
        stats: { total_posts: 999, total_comments: 999, monthly_posts: 999, monthly_comments: 999, posts_needed: 0, comments_needed: 0 },
      });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [postsRes, commentsRes, monthlyPostsRes, monthlyCommentsRes] = await Promise.all([
      supabaseAdmin
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .neq("is_bot", true),
      supabaseAdmin
        .from("post_comments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabaseAdmin
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .neq("is_bot", true)
        .gte("created_at", monthStart),
      supabaseAdmin
        .from("post_comments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", monthStart),
    ]);

    const totalPosts = postsRes.count ?? 0;
    const totalComments = commentsRes.count ?? 0;
    const monthlyPosts = monthlyPostsRes.count ?? 0;
    const monthlyComments = monthlyCommentsRes.count ?? 0;

    return NextResponse.json({
      ok: true,
      user_id: user.id,
      is_eligible: totalPosts >= 2 && totalComments >= 5,
      is_monthly_active: monthlyPosts >= 1 && monthlyComments >= 1,
      stats: {
        total_posts: totalPosts,
        total_comments: totalComments,
        monthly_posts: monthlyPosts,
        monthly_comments: monthlyComments,
        posts_needed: Math.max(0, 2 - totalPosts),
        comments_needed: Math.max(0, 5 - totalComments),
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown" }, { status: 500 });
  }
}
