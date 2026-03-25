import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600;

const ETF_NAMES: Record<string, string> = {
  IBIT: "iShares Bitcoin",
  FBTC: "Fidelity Bitcoin",
  BITB: "Bitwise Bitcoin",
  ARKB: "ARK 21Shares",
  GBTC: "Grayscale Bitcoin",
};

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker") ?? "IBIT";
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=30d`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Yahoo returned ${res.status}` }, { status: 502 });
    }
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const timestamps: number[] = result?.timestamp ?? [];
    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
    const sparkline: { date: string; close: number }[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] != null) {
        sparkline.push({
          date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
          close: closes[i] as number,
        });
      }
    }
    const currentPrice = sparkline[sparkline.length - 1]?.close ?? 0;
    const prev1d = sparkline.length >= 2 ? sparkline[sparkline.length - 2].close : currentPrice;
    const change1d = prev1d ? ((currentPrice - prev1d) / prev1d) * 100 : 0;

    return NextResponse.json({
      ok: true,
      ticker,
      name: ETF_NAMES[ticker] ?? ticker,
      currentPrice,
      change1d,
      sparkline,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown" }, { status: 500 });
  }
}
