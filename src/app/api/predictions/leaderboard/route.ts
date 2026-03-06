import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

export async function GET() {
  try {
    // Query resolved predictions + votes to compute stats
    const { data: votes, error: vErr } = await supabaseAdmin
      .from("prediction_votes")
      .select("user_id, option_id, prediction_id");

    if (vErr) {
      return NextResponse.json({ ok: false, error: vErr.message }, { status: 500 });
    }

    const { data: resolved, error: rErr } = await supabaseAdmin
      .from("predictions")
      .select("id, resolved_option_id")
      .eq("status", "resolved");

    if (rErr) {
      return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 });
    }

    // Build resolved map: prediction_id → resolved_option_id
    const resolvedMap: Record<string, string> = {};
    for (const r of resolved || []) {
      if (r.resolved_option_id) {
        resolvedMap[r.id] = r.resolved_option_id;
      }
    }

    // Aggregate per user (only count votes on resolved predictions)
    const userStats: Record<string, { total: number; correct: number }> = {};
    for (const v of votes || []) {
      const resolvedOption = resolvedMap[v.prediction_id];
      if (!resolvedOption) continue; // skip non-resolved
      if (!userStats[v.user_id]) userStats[v.user_id] = { total: 0, correct: 0 };
      userStats[v.user_id].total++;
      if (v.option_id === resolvedOption) userStats[v.user_id].correct++;
    }

    // Filter min 3 predictions, sort by accuracy desc then total desc
    const entries = Object.entries(userStats)
      .filter(([, s]) => s.total >= 3)
      .map(([userId, s]) => ({
        user_id: userId,
        total: s.total,
        correct: s.correct,
        accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.accuracy - a.accuracy || b.total - a.total)
      .slice(0, 20);

    // Fetch emails for these users
    const userIds = entries.map((e) => e.user_id);
    let emailMap: Record<string, string> = {};

    if (userIds.length > 0) {
      // Try auth.admin.listUsers or fallback to community_posts author_email
      const { data: postsData } = await supabaseAdmin
        .from("prediction_votes")
        .select("user_id")
        .in("user_id", userIds);

      // Try getting emails from community_posts or auth
      const { data: emailRows } = await supabaseAdmin
        .from("community_posts")
        .select("author_id, author_email")
        .in("author_id", userIds);

      if (emailRows) {
        for (const row of emailRows) {
          if (row.author_id && row.author_email) {
            emailMap[row.author_id] = row.author_email;
          }
        }
      }

      // suppress unused warning
      void postsData;
    }

    const leaderboard = entries.map((e, i) => ({
      rank: i + 1,
      user_id: e.user_id,
      email: maskEmail(emailMap[e.user_id] || "user"),
      total: e.total,
      correct: e.correct,
      accuracy: e.accuracy,
    }));

    return NextResponse.json({ ok: true, leaderboard });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
