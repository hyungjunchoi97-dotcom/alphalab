import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "hyungjunchoi97@gmail.com").split(",").map(e => e.trim()).filter(Boolean);

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const [postsRes, commentsRes, usersRes] = await Promise.all([
      supabaseAdmin.from("posts").select("id, title, created_at, category, author_email, is_hidden, is_pinned").order("created_at", { ascending: false }).limit(20),
      supabaseAdmin.from("comments").select("id, created_at").order("created_at", { ascending: false }).limit(5),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 10 }),
    ]);

    return NextResponse.json({
      ok: true,
      recentPosts: postsRes.data || [],
      totalPosts: postsRes.data?.length || 0,
      recentComments: commentsRes.data || [],
      recentUsers: usersRes.data?.users?.slice(0, 10) || [],
      totalUsers: usersRes.data?.users?.length || 0,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
