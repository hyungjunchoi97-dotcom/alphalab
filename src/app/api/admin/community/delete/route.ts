import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const adminPin = process.env.ADMIN_PIN;
  if (!adminPin) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_PIN not configured" },
      { status: 500 }
    );
  }

  let body: { pin?: string; postId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.pin || body.pin !== adminPin) {
    return NextResponse.json(
      { ok: false, error: "Invalid PIN" },
      { status: 401 }
    );
  }

  if (!body.postId) {
    return NextResponse.json(
      { ok: false, error: "Missing postId" },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin
    .from("community_posts")
    .delete()
    .eq("id", body.postId);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
