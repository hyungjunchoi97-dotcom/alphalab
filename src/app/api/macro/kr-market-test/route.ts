import { NextResponse } from "next/server";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";

export async function GET() {
  const results: Record<string, string> = {};

  const endpoints = [
    ["investorTrend_KOSPI", "https://m.stock.naver.com/api/index/KOSPI/investorTrend"],
    ["investorTrend_005930", "https://m.stock.naver.com/api/stock/005930/investorTrend"],
    ["transactionTrend", "https://m.stock.naver.com/api/index/KOSPI/transactionTrend"],
    ["marketInvestors", "https://m.stock.naver.com/api/market/KRX/investors"],
    ["naver_sise_investors", "https://finance.naver.com/sise/investorDealTrendDay.naver?bizdate=&sosok=0"],
  ];

  for (const [name, url] of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          "Referer": "https://m.stock.naver.com",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(5000),
      });
      const text = await res.text();
      results[name] = `${res.status}: ${text.slice(0, 200)}`;
    } catch (e) {
      results[name] = `ERROR: ${e instanceof Error ? e.message : "unknown"}`;
    }
  }

  return NextResponse.json(results);
}
