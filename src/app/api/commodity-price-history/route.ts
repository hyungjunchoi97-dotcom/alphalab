import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

// Map commodity tab keys to /api/macro/commodities IDs
const COMMODITY_API_MAP: Record<string, string> = {
  OIL: "WTI",
  GAS: "NATGAS",
  GOLD: "GOLD",
  COPPER: "COPPER",
  LITHIUM: "LITHIUM",
  NICKEL: "NICKEL",       // Note: NICKEL not in commodities API — will be static
  SILVER: "SILVER",
  COAL: "COAL",           // Note: COAL not in commodities API — will be static
  URANIUM: "URANIUM",
  ALUMINUM: "ALUMINUM",
  WHEAT: "WHEAT",         // Note: WHEAT not in commodities API — will be static
};

// GET: Fetch current price + historical comparison data
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const commodity = searchParams.get("commodity")?.toUpperCase() || "";

  if (!COMMODITY_API_MAP[commodity]) {
    return NextResponse.json({ ok: false, error: "Invalid commodity" }, { status: 400 });
  }

  const apiId = COMMODITY_API_MAP[commodity];

  // 1. Fetch current price from /api/macro/commodities
  let currentPrice = 0;
  let changePercent = 0;
  let unit = "";
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const res = await fetch(`${baseUrl}/api/macro/commodities`, {
      signal: AbortSignal.timeout(10000),
    });
    const json = await res.json();
    if (json.ok) {
      const item = json.data?.find((d: { id: string }) => d.id === apiId);
      if (item) {
        currentPrice = item.current;
        changePercent = item.changePercent;
        unit = item.unit;
      }
    }
  } catch {
    /* continue without price */
  }

  // 2. Record today's price snapshot (idempotent per commodity per day)
  if (currentPrice > 0) {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    try {
      // Check if already recorded today
      const { data: existing } = await supabaseAdmin
        .from("commodity_price_history")
        .select("id")
        .eq("commodity", commodity)
        .gte("recorded_at", `${today}T00:00:00Z`)
        .lte("recorded_at", `${today}T23:59:59Z`)
        .limit(1)
        .maybeSingle();

      if (!existing) {
        await supabaseAdmin.from("commodity_price_history").insert({
          commodity,
          price: currentPrice,
          recorded_at: new Date().toISOString(),
        });
      }
    } catch {
      // Table may not exist yet
    }
  }

  // 3. Fetch historical prices (1m, 3m, 6m, 1y ago)
  const now = new Date();
  const periods = [
    { key: "1m", date: new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()) },
    { key: "3m", date: new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()) },
    { key: "6m", date: new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()) },
    { key: "1y", date: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()) },
  ];

  const history: Record<string, { price: number | null; change: number | null }> = {};

  for (const p of periods) {
    try {
      // Find closest price within ±7 days of target date
      const targetDate = p.date.toISOString().slice(0, 10);
      const rangeStart = new Date(p.date.getTime() - 7 * 86400000).toISOString();
      const rangeEnd = new Date(p.date.getTime() + 7 * 86400000).toISOString();

      const { data: row } = await supabaseAdmin
        .from("commodity_price_history")
        .select("price, recorded_at")
        .eq("commodity", commodity)
        .gte("recorded_at", rangeStart)
        .lte("recorded_at", rangeEnd)
        .order("recorded_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (row && row.price > 0 && currentPrice > 0) {
        const changePct = ((currentPrice - row.price) / row.price) * 100;
        history[p.key] = {
          price: Math.round(row.price * 100) / 100,
          change: Math.round(changePct * 100) / 100,
        };
      } else {
        history[p.key] = { price: null, change: null };
      }
    } catch {
      history[p.key] = { price: null, change: null };
    }
  }

  return NextResponse.json({
    ok: true,
    commodity,
    currentPrice,
    changePercent,
    unit,
    history,
    updatedAt: new Date().toISOString(),
  });
}
