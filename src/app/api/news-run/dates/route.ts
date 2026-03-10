import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("news_run_cache")
      .select("date")
      .order("date", { ascending: false })
      .limit(90);

    if (error) {
      return NextResponse.json({ ok: true, dates: [] });
    }

    const dates: string[] = (data || []).map((r: { date: string }) => r.date);

    return NextResponse.json({ ok: true, dates });
  } catch {
    return NextResponse.json({ ok: true, dates: [] });
  }
}
