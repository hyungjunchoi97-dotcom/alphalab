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
    // Top 20 by balance
    const { data: pts, error: ptsErr } = await supabaseAdmin
      .from("user_points")
      .select("user_id, balance, total_wagered, total_won")
      .order("balance", { ascending: false })
      .limit(20);

    if (ptsErr) {
      return NextResponse.json({ ok: false, error: ptsErr.message }, { status: 500 });
    }

    if (!pts || pts.length === 0) {
      return NextResponse.json({ ok: true, leaderboard: [] });
    }

    const userIds = pts.map((p) => p.user_id);

    // Win rates from prediction_bets
    const { data: bets } = await supabaseAdmin
      .from("prediction_bets")
      .select("user_id, status")
      .in("user_id", userIds)
      .in("status", ["won", "lost"]);

    const betStats: Record<string, { won: number; total: number }> = {};
    for (const b of bets || []) {
      if (!betStats[b.user_id]) betStats[b.user_id] = { won: 0, total: 0 };
      betStats[b.user_id].total++;
      if (b.status === "won") betStats[b.user_id].won++;
    }

    // Try to get masked emails from community_posts
    const { data: emailRows } = await supabaseAdmin
      .from("community_posts")
      .select("author_id, author_email")
      .in("author_id", userIds);

    const emailMap: Record<string, string> = {};
    for (const row of emailRows || []) {
      if (row.author_id && row.author_email) emailMap[row.author_id] = row.author_email;
    }

    const leaderboard = pts.map((p, i) => {
      const bs = betStats[p.user_id];
      const winRate = bs && bs.total > 0 ? Math.round((bs.won / bs.total) * 1000) / 10 : null;
      return {
        rank: i + 1,
        user_id: p.user_id,
        email: maskEmail(emailMap[p.user_id] || "user"),
        balance: Math.round(Number(p.balance)),
        totalWagered: Math.round(Number(p.total_wagered) || 0),
        totalWon: Math.round(Number(p.total_won) || 0),
        winRate,
        wonCount: bs?.won ?? 0,
        totalBets: bs?.total ?? 0,
      };
    });

    return NextResponse.json({ ok: true, leaderboard });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
