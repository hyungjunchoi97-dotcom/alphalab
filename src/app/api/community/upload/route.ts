import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

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

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ ok: false, error: "Invalid file type" }, { status: 400 });
    }

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "File too large (max 5MB)" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${user.id}/${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("community")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from("community")
      .getPublicUrl(fileName);

    return NextResponse.json({
      ok: true,
      url: publicUrlData.publicUrl,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
