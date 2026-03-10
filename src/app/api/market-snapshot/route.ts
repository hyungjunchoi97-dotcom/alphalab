import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const apiKey = process.env.FMP_API_KEY;

    const [indexRes, fxRes, commodityRes, fgRes, cryptoRes] = await Promise.allSettled([
      // Indices
      fetch(
        `https://financialmodelingprep.com/api/v3/quote/SPY,QQQ,DX-Y.NYB?apikey=${apiKey}`
      ).then((r) => r.json()),
      // Forex
      fetch(
        `https://financialmodelingprep.com/api/v3/quote/USDKRW?apikey=${apiKey}`
      ).then((r) => r.json()),
      // Commodities (bulk endpoint)
      fetch(
        `https://financialmodelingprep.com/api/v3/quotes/commodity?apikey=${apiKey}`
      ).then((r) => r.json()),
      // Fear & Greed
      fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata").then((r) => r.json()),
      // Crypto
      fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true"
      ).then((r) => r.json()),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const indexData: any[] = indexRes.status === "fulfilled" && Array.isArray(indexRes.value) ? indexRes.value : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fxData: any[] = fxRes.status === "fulfilled" && Array.isArray(fxRes.value) ? fxRes.value : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const commodityData: any[] = commodityRes.status === "fulfilled" && Array.isArray(commodityRes.value) ? commodityRes.value : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allFmp = [...indexData, ...fxData];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fg: any = fgRes.status === "fulfilled" ? fgRes.value : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const crypto: any = cryptoRes.status === "fulfilled" ? cryptoRes.value : null;

    const find = (sym: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = allFmp.find((x: any) => x.symbol === sym);
      if (!q) return null;
      return { price: q.price ?? 0, change: q.changesPercentage ?? 0 };
    };

    const findCommodity = (sym: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = commodityData.find((x: any) => x.symbol === sym);
      if (!q) return null;
      return { price: q.price ?? 0, change: q.changesPercentage ?? 0 };
    };

    const fgScore = fg?.fear_and_greed?.score ?? 0;
    const fgRating = fg?.fear_and_greed?.rating ?? "";

    const snapshot = {
      sp500: find("SPY"),
      nasdaq: find("QQQ"),
      dxy: find("DX-Y.NYB"),
      gold: findCommodity("GCUSD"),
      silver: findCommodity("SIUSD"),
      oil: findCommodity("CLUSD"),
      usdkrw: find("USDKRW"),
      fearGreed: { value: Math.round(fgScore), rating: fgRating },
      btc: crypto?.bitcoin
        ? { price: crypto.bitcoin.usd ?? 0, change: crypto.bitcoin.usd_24h_change ?? 0 }
        : null,
      eth: crypto?.ethereum
        ? { price: crypto.ethereum.usd ?? 0, change: crypto.ethereum.usd_24h_change ?? 0 }
        : null,
      asOf: new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, snapshot }, {
      headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
