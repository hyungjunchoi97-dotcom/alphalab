import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

const SEED_PROMPTS = [
  {
    title: "Scalp Strategy",
    description:
      "Short-term scalp analysis focusing on 1-5 min chart patterns, order flow, and momentum.",
    content:
      "You are a professional scalp trader. Analyze the uploaded chart image for a 1-5 minute timeframe trade. Identify entry, stop-loss, and 2 take-profit levels. Focus on order flow signals, VWAP, and short-term momentum. Be concise.",
    tags: ["scalp", "short-term"],
    author_email: "System",
  },
  {
    title: "Swing Strategy",
    description:
      "Multi-day swing analysis using daily/4H charts, trend structure, and key S/R levels.",
    content:
      "You are a professional swing trader. Analyze the uploaded chart for a multi-day swing trade (1-4 week hold). Identify the primary trend, key support/resistance zones, entry trigger, stop-loss, and 3 target levels. Include invalidation criteria and scenario analysis.",
    tags: ["swing", "multi-day"],
    author_email: "System",
  },
  {
    title: "Macro Overview",
    description:
      "High-level macro analysis for weekly/monthly charts, sector rotation, and risk assessment.",
    content:
      "You are a macro analyst. Analyze the uploaded chart from a macro perspective. Identify the long-term trend phase (accumulation, markup, distribution, markdown), major structural levels, and potential catalysts. Provide a risk assessment and confidence level.",
    tags: ["macro", "long-term"],
    author_email: "System",
  },
];

export async function GET() {
  try {
    const { data: prompts, error } = await supabaseAdmin
      .from("prompts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    // Seed if empty
    if (!prompts || prompts.length === 0) {
      const { data: seeded, error: seedErr } = await supabaseAdmin
        .from("prompts")
        .insert(SEED_PROMPTS)
        .select("*");

      if (seedErr) {
        return NextResponse.json({ ok: false, error: seedErr.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, prompts: seeded || [] });
    }

    return NextResponse.json({ ok: true, prompts });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, content, tags } = body;

    if (!title) {
      return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
    }

    const { data: prompt, error } = await supabaseAdmin
      .from("prompts")
      .insert({
        title,
        description: description || "",
        content: content || "",
        tags: tags || [],
        author_id: user.id,
        author_email: user.email || "User",
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, prompt });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, description, content, tags } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
    }

    const { data: prompt, error } = await supabaseAdmin
      .from("prompts")
      .update({
        title,
        description: description || "",
        content: content || "",
        tags: tags || [],
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, prompt });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("prompts").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
