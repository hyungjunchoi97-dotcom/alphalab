import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

// ── GET: fetch profile + post history ────────────────────────
export async function GET(req: NextRequest) {
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

    // Fetch profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Fetch post history
    const { data: posts } = await supabaseAdmin
      .from("posts")
      .select("id, title, category, subcategory, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Fetch like count (posts liked by user)
    const { count: likedCount } = await supabaseAdmin
      .from("post_likes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    return NextResponse.json({
      ok: true,
      profile: profile || null,
      email: user.email,
      posts: posts || [],
      likedCount: likedCount || 0,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// ── POST: upsert profile (nickname, bio) ─────────────────────
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
    const { nickname, bio } = body;

    if (!nickname?.trim()) {
      return NextResponse.json({ ok: false, error: "닉네임을 입력해주세요" }, { status: 400 });
    }
    if (nickname.trim().length < 2 || nickname.trim().length > 20) {
      return NextResponse.json({ ok: false, error: "닉네임은 2~20자여야 합니다" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9가-힣_\-]+$/.test(nickname.trim())) {
      return NextResponse.json({ ok: false, error: "닉네임은 한글, 영문, 숫자, _, - 만 사용 가능합니다" }, { status: 400 });
    }

    // Check nickname uniqueness (exclude current user)
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("nickname", nickname.trim())
      .neq("user_id", user.id)
      .single();

    if (existing) {
      return NextResponse.json({ ok: false, error: "이미 사용 중인 닉네임입니다" }, { status: 409 });
    }

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .upsert({
        user_id: user.id,
        email: user.email,
        nickname: nickname.trim(),
        bio: (bio || "").trim().slice(0, 200),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ ok: false, error: "이미 사용 중인 닉네임입니다" }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, profile: data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
