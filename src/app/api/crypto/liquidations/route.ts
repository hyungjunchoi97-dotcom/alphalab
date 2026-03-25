import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 60;

interface LiqItem { time: string; side: "long" | "short"; price: number; size: number }
interface CoinLiq { totalLongLiq: number; totalShortLiq: number; items: LiqItem[] }

async function fetchLiq(instFamily: string): Promise<CoinLiq> {
  try {
    const res = await fetch(
      `https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&mgnMode=cross&instFamily=${instFamily}&state=filled`,
      { signal: AbortSignal.timeout(10000) }
    );
    const json = await res.json();
    if (json.code !== "0" || !Array.isArray(json.data)) {
      return { totalLongLiq: 0, totalShortLiq: 0, items: [] };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allDetails: any[] = [];
    for (const entry of json.data) {
      if (Array.isArray(entry.details)) {
        allDetails.push(...entry.details);
      }
    }

    let totalLongLiq = 0;
    let totalShortLiq = 0;
    const items: LiqItem[] = [];

    for (const d of allDetails) {
      const sz = parseFloat(d.sz) || 0;
      const price = parseFloat(d.bkPx) || 0;
      const ts = Number(d.ts || d.time || 0);
      const date = ts > 0 ? new Date(ts) : new Date();
      const timeStr = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;

      // side="buy" + posSide="short" = short was liquidated
      // side="sell" + posSide="long" = long was liquidated
      let liqSide: "long" | "short";
      if (d.side === "buy" && d.posSide === "short") {
        liqSide = "short";
        totalShortLiq += sz;
      } else {
        liqSide = "long";
        totalLongLiq += sz;
      }

      items.push({ time: timeStr, side: liqSide, price, size: sz });
    }

    items.sort((a, b) => b.time.localeCompare(a.time));

    return {
      totalLongLiq: Math.round(totalLongLiq * 100) / 100,
      totalShortLiq: Math.round(totalShortLiq * 100) / 100,
      items: items.slice(0, 20),
    };
  } catch {
    return { totalLongLiq: 0, totalShortLiq: 0, items: [] };
  }
}

export async function GET() {
  const [btc, eth] = await Promise.all([fetchLiq("BTC-USDT"), fetchLiq("ETH-USDT")]);
  return NextResponse.json({ ok: true, btc, eth });
}
