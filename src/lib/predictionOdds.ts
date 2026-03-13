const MIN_ODDS = 1.05;
const MAX_ODDS = 50;

export function calculateOdds(
  totalYes: number,
  totalNo: number,
  side: "yes" | "no",
  feeRate = 0.05
): number {
  const pool = totalYes + totalNo;
  let odds: number;
  if (pool === 0) {
    odds = 2.0;
  } else {
    const sideBets = side === "yes" ? totalYes : totalNo;
    if (sideBets === 0) {
      odds = pool * (1 - feeRate);
    } else {
      odds = (pool / sideBets) * (1 - feeRate);
    }
  }
  return Math.min(MAX_ODDS, Math.max(MIN_ODDS, Math.round(odds * 100) / 100));
}

export function calcPotentialPayout(points: number, odds: number): number {
  return Math.round(points * odds * 100) / 100;
}

// Ensure user_points row exists; returns balance. Server-side only.
export async function ensureUserPoints(
  supabaseAdmin: import("@supabase/supabase-js").SupabaseClient,
  userId: string
): Promise<{ balance: number; total_wagered: number; total_won: number; isNew: boolean }> {
  const { data } = await supabaseAdmin
    .from("user_points")
    .select("balance, total_wagered, total_won")
    .eq("user_id", userId)
    .single();

  if (data) return { ...data, isNew: false };

  // Create with 1000 starting balance
  await supabaseAdmin.from("user_points").insert({
    user_id: userId,
    balance: 1000,
    total_wagered: 0,
    total_won: 0,
  });

  return { balance: 1000, total_wagered: 0, total_won: 0, isNew: true };
}
