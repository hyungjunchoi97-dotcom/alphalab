import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { error } = await supabaseAdmin.rpc("increment_use_count", {
      prompt_id: id,
    });

    // Fallback: if RPC doesn't exist, do manual increment
    if (error) {
      const { data: existing } = await supabaseAdmin
        .from("prompts")
        .select("use_count")
        .eq("id", id)
        .single();

      if (!existing) {
        return NextResponse.json({ ok: false, error: "Prompt not found" }, { status: 404 });
      }

      const { error: updateErr } = await supabaseAdmin
        .from("prompts")
        .update({ use_count: (existing.use_count || 0) + 1 })
        .eq("id", id);

      if (updateErr) {
        return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
