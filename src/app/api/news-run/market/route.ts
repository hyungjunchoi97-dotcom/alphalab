import { NextResponse } from "next/server";

export const runtime = "nodejs";

const FMP_KEY = process.env.FMP_API_KEY || "";
const FMP_BASE = "https://financialmodelingprep.com/stable";

export async function GET() {
  try {
    const symbols = [
      "%5EGSPC", "%5EIXIC", "USDKRW", "DX-Y.NYB",
      "GCUSD", "SIUSD", "WTICOUSD", "BTCUSD", "ETHUSD",
    ].join(",");

    const [quoteRes, fgRes] = await Promise.allSettled([
      fetch(`${FMP_BASE}/quote?symbol=${symbols}&apikey=${FMP_KEY}`).then((r) => r.json()),
      fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata").then((r) => r.json()),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quotes: any[] =
      quoteRes.status === "fulfilled" && Array.isArray(quoteRes.value) ? quoteRes.value : [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const find = (sym: string): { price: number; change: number; changePct: number } | null => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = quotes.find((x: any) => x.symbol === sym);
      if (!q) return null;
      return {
        price: q.price ?? 0,
        change: q.change ?? 0,
        changePct: q.changesPercentage ?? 0,
      };
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fg: any = fgRes.status === "fulfilled" ? fgRes.value : null;
    const fgScore = fg?.fear_and_greed?.score ?? 0;
    const fgRating = fg?.fear_and_greed?.rating ?? "";

    const data = {
      sp500: find("^GSPC"),
      nasdaq: find("^IXIC"),
      usdkrw: find("USDKRW"),
      dxy: find("DX-Y.NYB"),
      gold: find("GCUSD"),
      silver: find("SIUSD"),
      wti: find("WTICOUSD"),
      btc: find("BTCUSD"),
      eth: find("ETHUSD"),
      fearGreed: { score: Math.round(fgScore), rating: fgRating },
      asOf: new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, data }, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
