import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const start = Date.now();
  const symbol = "AAPL";
  const now = Math.floor(Date.now() / 1000);
  const sixMonthsAgo = now - 180 * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${sixMonthsAgo}&period2=${now}&interval=1d`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    clearTimeout(timeout);

    const elapsed = Date.now() - start;
    const status = res.status;

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json({
        ok: false,
        symbol,
        status,
        elapsed_ms: elapsed,
        error: `HTTP ${status}`,
        body_preview: text.slice(0, 500),
      });
    }

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const barCount = result?.timestamp?.length ?? 0;
    const lastClose = result?.indicators?.quote?.[0]?.close?.slice(-1)?.[0] ?? null;

    return NextResponse.json({
      ok: true,
      symbol,
      status,
      elapsed_ms: elapsed,
      bars: barCount,
      last_close: lastClose,
      has_data: barCount > 0,
    });
  } catch (err) {
    const elapsed = Date.now() - start;
    return NextResponse.json({
      ok: false,
      symbol,
      elapsed_ms: elapsed,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
