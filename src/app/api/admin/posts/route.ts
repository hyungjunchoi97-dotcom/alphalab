import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "hyungjunchoi97@gmail.com").split(",");

function isAdmin(email: string | undefined) {
  return !!email && ADMIN_EMAILS.includes(email.trim());
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!isAdmin(user?.email)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

    const { postId } = await req.json();
    const { error } = await supabaseAdmin.from("posts").delete().eq("id", postId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    if (!isAdmin(user?.email)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

    const { postId, action } = await req.json();
    // action: "hide" | "pin" | "unpin" | "unhide"
    const updates: Record<string, boolean> = {};
    if (action === "hide") updates.is_hidden = true;
    if (action === "unhide") updates.is_hidden = false;
    if (action === "pin") updates.is_pinned = true;
    if (action === "unpin") updates.is_pinned = false;

    const { error } = await supabaseAdmin.from("posts").update(updates).eq("id", postId);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
