import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || "";
console.log("[FINNHUB KEY CHECK]", FINNHUB_KEY ? FINNHUB_KEY.slice(0, 8) : "MISSING");

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q")?.trim();
    if (!q) return NextResponse.json({ ok: false, error: "q required" }, { status: 400 });
    if (!FINNHUB_KEY) return NextResponse.json({ ok: false, error: "FINNHUB_API_KEY not set" }, { status: 500 });

    const res = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${FINNHUB_KEY}`);
    const data = await res.json();
    console.log("[SEARCH FINNHUB]", q, JSON.stringify(data).slice(0, 500));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = (data.result ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((item: any) => item.type === "Common Stock")
      .slice(0, 10)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => ({
        ticker: item.symbol as string,
        name: item.description as string,
        market: (item.symbol?.endsWith(".KS") || item.symbol?.endsWith(".KQ")) ? "KR" : "US",
        exchange: item.symbol?.endsWith(".KS") ? "KOSPI" : item.symbol?.endsWith(".KQ") ? "KOSDAQ" : "",
      }));

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("[SEARCH ERROR]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
