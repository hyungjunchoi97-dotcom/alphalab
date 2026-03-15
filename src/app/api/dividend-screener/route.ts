import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

interface DividendStock {
  code: string;
  name: string;
  price: number;
  dividendRate: number;
  dividend: number;
  exchange: "KOSPI" | "KOSDAQ";
}

async function fetchPage(page: number, pageSize: number): Promise<{ items: DividendStock[]; totalCount: number }> {
  const url = `https://m.stock.naver.com/api/stocks/dividend?page=${page}&pageSize=${pageSize}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AlphaLab/1.0)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return { items: [], totalCount: 0 };
  const data = await res.json();
  const items: DividendStock[] = (data.dividends ?? [])
    .filter((d: Record<string, unknown>) => d.dividendRate && d.closePrice)
    .map((d: Record<string, unknown>) => ({
      code: d.itemCode as string,
      name: d.stockName as string,
      price: parseInt(String(d.closePrice).replace(/,/g, ""), 10),
      dividendRate: parseFloat(String(d.dividendRate)),
      dividend: parseInt(String(d.dividend ?? "0").replace(/,/g, ""), 10),
      exchange: (d.stockExchangeType as Record<string, string>)?.code === "KS" ? "KOSPI" : "KOSDAQ",
    }));
  return { items, totalCount: data.totalCount ?? 0 };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const minRate = parseFloat(searchParams.get("min") ?? "3");
  const maxRate = parseFloat(searchParams.get("max") ?? "10");

  try {
    const first = await fetchPage(1, 100);
    const totalPages = Math.ceil(first.totalCount / 100);
    let allItems = [...first.items];

    if (totalPages > 1) {
      const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
      const results = await Promise.all(pages.map(p => fetchPage(p, 100)));
      for (const r of results) allItems = allItems.concat(r.items);
    }

    const filtered = allItems
      .filter(s => s.dividendRate >= minRate && s.dividendRate <= maxRate)
      .sort((a, b) => b.dividendRate - a.dividendRate);

    return NextResponse.json(
      { ok: true, stocks: filtered, total: filtered.length },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[dividend-screener]", err);
    return NextResponse.json({ ok: false, error: "Failed" }, { status: 500 });
  }
}
