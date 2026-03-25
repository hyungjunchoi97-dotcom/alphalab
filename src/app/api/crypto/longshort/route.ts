import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 300;

interface RatioPoint { time: string; ratio: number }

async function fetchRatio(ccy: string): Promise<{ current: number; history: RatioPoint[] }> {
  try {
    const res = await fetch(
      `https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=${ccy}&period=1H`,
      { signal: AbortSignal.timeout(10000) }
    );
    const json = await res.json();
    if (json.code !== "0" || !Array.isArray(json.data)) {
      return { current: 1, history: [] };
    }
    const history: RatioPoint[] = json.data
      .slice(0, 24)
      .map((d: string[]) => {
        const ts = Number(d[0]);
        const date = new Date(ts);
        return {
          time: `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`,
          ratio: parseFloat(d[1]) || 1,
        };
      })
      .reverse();
    const current = history[history.length - 1]?.ratio ?? 1;
    return { current, history };
  } catch {
    return { current: 1, history: [] };
  }
}

export async function GET() {
  const [btc, eth] = await Promise.all([fetchRatio("BTC"), fetchRatio("ETH")]);
  return NextResponse.json({ ok: true, btc, eth });
}
