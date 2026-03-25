import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600;

const NEXT_HALVING_BLOCK = 1050000;

const ETF_HOLDINGS = [
  { name: "BlackRock IBIT", holdings: 570000 },
  { name: "Fidelity FBTC", holdings: 213000 },
  { name: "Grayscale GBTC", holdings: 195000 },
  { name: "Bitwise BITB", holdings: 75000 },
  { name: "ARK 21Shares ARKB", holdings: 60000 },
  { name: "Grayscale Mini BTC", holdings: 45000 },
  { name: "ProShares BITO (선물)", holdings: 35000 },
  { name: "Purpose Bitcoin (CA)", holdings: 25000 },
  { name: "VanEck HODL", holdings: 18000 },
  { name: "Invesco BTCO", holdings: 12000 },
  { name: "Franklin EZBC", holdings: 9000 },
  { name: "21Shares CBTC (CA)", holdings: 8000 },
  { name: "WisdomTree BTCW", holdings: 4500 },
  { name: "Valkyrie BRRR", holdings: 4000 },
  { name: "Hashdex DEFI", holdings: 500 },
];

const EXCHANGE_HOLDINGS = [
  { name: "Coinbase", holdings: 1000000 },
  { name: "Binance", holdings: 570000 },
  { name: "OKX", holdings: 180000 },
  { name: "Bybit", holdings: 120000 },
  { name: "Kraken", holdings: 90000 },
  { name: "Bitfinex", holdings: 80000 },
  { name: "Gemini", holdings: 70000 },
  { name: "Bitstamp", holdings: 50000 },
  { name: "Huobi/HTX", holdings: 45000 },
  { name: "Gate.io", holdings: 35000 },
  { name: "KuCoin", holdings: 30000 },
  { name: "Crypto.com", holdings: 25000 },
  { name: "Upbit (KR)", holdings: 22000 },
  { name: "Bithumb (KR)", holdings: 18000 },
  { name: "Bitget", holdings: 15000 },
];

const SATOSHI_HOLDINGS = 1100000;
const LOST_BTC = 3700000;

export async function GET() {
  try {
    const [blockRes, statsRes, companiesRes, priceRes, globalRes] = await Promise.allSettled([
      fetch("https://blockchain.info/q/getblockcount", { signal: AbortSignal.timeout(10000) }).then(r => r.text()),
      fetch("https://blockchain.info/stats?format=json", { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
      fetch("https://api.coingecko.com/api/v3/companies/public_treasury/bitcoin", { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
      fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd", { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
      fetch("https://api.coingecko.com/api/v3/global", { signal: AbortSignal.timeout(10000) }).then(r => r.json()),
    ]);

    const currentBlock = blockRes.status === "fulfilled" ? parseInt(blockRes.value, 10) || 840000 : 840000;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stats = statsRes.status === "fulfilled" ? statsRes.value as Record<string, any> : {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const companiesData = companiesRes.status === "fulfilled" ? companiesRes.value as Record<string, any> : {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const priceData = priceRes.status === "fulfilled" ? priceRes.value as Record<string, any> : {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalData = globalRes.status === "fulfilled" ? (globalRes.value as Record<string, any>)?.data : {};

    const btcPrice = priceData?.bitcoin?.usd ?? 0;
    const totalMined = stats?.totalbc ? Math.round(stats.totalbc / 100000000) : 19800000;
    const btcDominance = globalData?.market_cap_percentage?.btc ?? 0;

    const blocksRemaining = Math.max(0, NEXT_HALVING_BLOCK - currentBlock);
    const estimatedDays = Math.round(blocksRemaining * 10 / 1440);
    const estimatedDate = new Date(Date.now() + estimatedDays * 86400000).toISOString();

    // Companies
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawCompanies = Array.isArray(companiesData?.companies) ? companiesData.companies : [];
    const corporateTotal = Math.round(companiesData?.total_holdings ?? 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const companies = rawCompanies.slice(0, 15).map((c: any) => ({
      name: c.name ?? "",
      holdings: c.total_holdings ?? 0,
      usdValue: (c.total_holdings ?? 0) * btcPrice,
      country: c.country ?? "",
    }));

    const etfTotal = ETF_HOLDINGS.reduce((s, e) => s + e.holdings, 0);
    const exchangeTotal = EXCHANGE_HOLDINGS.reduce((s, e) => s + e.holdings, 0);

    return NextResponse.json({
      ok: true,
      btcPrice,
      currentBlock,
      blocksRemaining,
      estimatedDays,
      estimatedDate,
      totalMined,
      totalSupply: 21000000,
      btcDominance,
      supply: {
        etfTotal,
        etfs: ETF_HOLDINGS.map(e => ({ ...e, usdValue: e.holdings * btcPrice })),
        corporateTotal,
        companies,
        exchangeTotal,
        exchanges: EXCHANGE_HOLDINGS.map(e => ({ ...e, usdValue: e.holdings * btcPrice })),
        satoshiHoldings: SATOSHI_HOLDINGS,
        lostBtc: LOST_BTC,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown" }, { status: 500 });
  }
}
