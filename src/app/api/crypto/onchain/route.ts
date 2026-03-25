import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 600;

async function fetchJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  return res.json();
}
async function fetchText(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  return res.text();
}

export async function GET() {
  try {
    const [diffRes, heightRes, feesRes, hashrateRes, coinRes, chartRes] = await Promise.allSettled([
      fetchJson("https://mempool.space/api/v1/difficulty-adjustment"),
      fetchText("https://mempool.space/api/blocks/tip/height"),
      fetchJson("https://mempool.space/api/v1/fees/recommended"),
      fetchJson("https://mempool.space/api/v1/mining/hashrate/3m"),
      fetchJson("https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false"),
      fetchJson("https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365"),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const diff = diffRes.status === "fulfilled" ? diffRes.value as any : {};
    const height = heightRes.status === "fulfilled" ? parseInt(heightRes.value, 10) : 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fees = feesRes.status === "fulfilled" ? feesRes.value as any : {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hrData = hashrateRes.status === "fulfilled" ? hashrateRes.value as any : {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coin = coinRes.status === "fulfilled" ? coinRes.value as any : {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chart = chartRes.status === "fulfilled" ? chartRes.value as any : {};

    // Hashrate: take last 12 points
    const rawHashrates = Array.isArray(hrData?.hashrates) ? hrData.hashrates : [];
    const step = Math.max(1, Math.floor(rawHashrates.length / 12));
    const hashrates = rawHashrates
      .filter((_: unknown, i: number) => i % step === 0)
      .slice(-12)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((h: any) => ({ timestamp: h.timestamp, avgHashrate: h.avgHashrate }));

    const currentHashrate = hashrates.length > 0 ? hashrates[hashrates.length - 1].avgHashrate : (hrData?.currentHashrate ?? 0);
    const currentDifficulty = hrData?.currentDifficulty ?? diff?.currentDifficulty ?? 0;

    // Market data
    const md = coin?.market_data;
    const ath = md?.ath?.usd ?? 0;
    const athDate = md?.ath_date?.usd ?? "";
    const athChangePct = md?.ath_change_percentage?.usd ?? 0;
    const circSupply = md?.circulating_supply ?? 0;
    const maxSupply = md?.max_supply ?? 21000000;

    // Price history: weekly (every 7th from daily data)
    const rawPrices: number[][] = Array.isArray(chart?.prices) ? chart.prices : [];
    const priceHistory: { date: string; price: number }[] = [];
    for (let i = 0; i < rawPrices.length; i += 7) {
      const [ts, price] = rawPrices[i];
      const d = new Date(ts);
      priceHistory.push({
        date: `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`,
        price: Math.round(price),
      });
    }

    return NextResponse.json({
      ok: true,
      difficulty: {
        progressPercent: diff?.progressPercent ?? 0,
        difficultyChange: diff?.difficultyChange ?? 0,
        remainingBlocks: diff?.remainingBlocks ?? 0,
        estimatedRetargetDate: diff?.estimatedRetargetDate ?? 0,
        previousRetarget: diff?.previousRetarget ?? 0,
        currentDifficulty,
        currentHashrate,
        hashrates,
      },
      fees: {
        fastestFee: fees?.fastestFee ?? 0,
        halfHourFee: fees?.halfHourFee ?? 0,
        hourFee: fees?.hourFee ?? 0,
        economyFee: fees?.economyFee ?? 0,
      },
      market: {
        ath,
        athDate,
        athChangePercent: Math.round(athChangePct * 100) / 100,
        circulatingSupply: Math.round(circSupply),
        maxSupply,
        priceHistory: priceHistory.slice(-52),
      },
      blockHeight: height,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown" }, { status: 500 });
  }
}
