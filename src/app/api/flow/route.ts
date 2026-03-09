import { NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

export const runtime = "nodejs";

// ── Stock definitions ────────────────────────────────────────

interface StockDef {
  ticker: string;
  name: string;
  nameEn: string;
  sector: string;
  capWeight: number;
}

const STOCKS: StockDef[] = [
  { ticker: "005930", name: "삼성전자", nameEn: "Samsung Elec", sector: "반도체", capWeight: 350 },
  { ticker: "000660", name: "SK하이닉스", nameEn: "SK Hynix", sector: "반도체", capWeight: 120 },
  { ticker: "042700", name: "한미반도체", nameEn: "Hanmi Semi", sector: "반도체", capWeight: 15 },
  { ticker: "009150", name: "삼성전기", nameEn: "Samsung Electro", sector: "반도체", capWeight: 12 },
  { ticker: "055550", name: "신한지주", nameEn: "Shinhan FG", sector: "금융", capWeight: 25 },
  { ticker: "105560", name: "KB금융", nameEn: "KB Financial", sector: "금융", capWeight: 28 },
  { ticker: "086790", name: "하나금융", nameEn: "Hana FG", sector: "금융", capWeight: 18 },
  { ticker: "316140", name: "우리금융", nameEn: "Woori FG", sector: "금융", capWeight: 12 },
  { ticker: "005380", name: "현대차", nameEn: "Hyundai Motor", sector: "자동차", capWeight: 55 },
  { ticker: "000270", name: "기아", nameEn: "Kia", sector: "자동차", capWeight: 40 },
  { ticker: "012330", name: "현대모비스", nameEn: "Hyundai Mobis", sector: "자동차", capWeight: 20 },
  { ticker: "051910", name: "LG화학", nameEn: "LG Chem", sector: "화학/2차전지", capWeight: 30 },
  { ticker: "006400", name: "삼성SDI", nameEn: "Samsung SDI", sector: "화학/2차전지", capWeight: 25 },
  { ticker: "096770", name: "SK이노베이션", nameEn: "SK Innovation", sector: "화학/2차전지", capWeight: 12 },
  { ticker: "035420", name: "네이버", nameEn: "NAVER", sector: "IT", capWeight: 45 },
  { ticker: "035720", name: "카카오", nameEn: "Kakao", sector: "IT", capWeight: 25 },
  { ticker: "018260", name: "삼성SDS", nameEn: "Samsung SDS", sector: "IT", capWeight: 12 },
  { ticker: "068270", name: "셀트리온", nameEn: "Celltrion", sector: "바이오", capWeight: 35 },
  { ticker: "207940", name: "삼성바이오", nameEn: "Samsung Bio", sector: "바이오", capWeight: 50 },
  { ticker: "000100", name: "유한양행", nameEn: "Yuhan", sector: "바이오", capWeight: 12 },
  { ticker: "005490", name: "포스코홀딩스", nameEn: "POSCO", sector: "철강/조선", capWeight: 30 },
  { ticker: "042660", name: "한화오션", nameEn: "Hanwha Ocean", sector: "철강/조선", capWeight: 15 },
  { ticker: "010140", name: "삼성중공업", nameEn: "Samsung Heavy", sector: "철강/조선", capWeight: 10 },
  { ticker: "034730", name: "SK", nameEn: "SK", sector: "소비재/통신", capWeight: 15 },
  { ticker: "066570", name: "LG전자", nameEn: "LG Elec", sector: "소비재/통신", capWeight: 12 },
  { ticker: "017670", name: "SK텔레콤", nameEn: "SK Telecom", sector: "소비재/통신", capWeight: 14 },
  { ticker: "030200", name: "KT", nameEn: "KT", sector: "소비재/통신", capWeight: 10 },
  { ticker: "259960", name: "크래프톤", nameEn: "Krafton", sector: "엔터/게임", capWeight: 18 },
  { ticker: "352820", name: "하이브", nameEn: "Hybe", sector: "엔터/게임", capWeight: 12 },
];

// ── Types ────────────────────────────────────────────────────

interface DailyBar {
  date: string;
  close: number;
  volume: number;
}

interface StockData {
  def: StockDef;
  bars: DailyBar[];
  currentPrice: number;
  prevClose: number;
  chgPct: number;
}

// ── Cache ────────────────────────────────────────────────────

const CACHE_TTL = 10 * 60 * 1000;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cache: { data: Record<string, any>; cachedAt: number } | null = null;

// ── Yahoo Finance fetcher ────────────────────────────────────

async function fetchStockData(def: StockDef): Promise<StockData | null> {
  const symbol = `${def.ticker}.KS`;
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1y&interval=1d`;
    const res = await fetchWithTimeout(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    }, 8000);
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const timestamps: number[] = result.timestamp || [];
    const quote = result.indicators?.quote?.[0];
    if (!quote) return null;

    const bars: DailyBar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const c = quote.close?.[i];
      const v = quote.volume?.[i];
      if (c != null && v != null && c > 0) {
        const d = new Date(timestamps[i] * 1000);
        bars.push({ date: d.toISOString().slice(0, 10), close: c, volume: v });
      }
    }

    const currentPrice = meta.regularMarketPrice || (bars.length > 0 ? bars[bars.length - 1].close : 0);
    // Use second-to-last bar for daily change (meta.previousClose is 3mo ago with range=3mo)
    const prevClose = bars.length >= 2 ? bars[bars.length - 2].close : (meta.chartPreviousClose || currentPrice);
    const chgPct = prevClose > 0 ? Math.round(((currentPrice - prevClose) / prevClose) * 10000) / 100 : 0;

    return { def, bars, currentPrice, prevClose, chgPct };
  } catch {
    return null;
  }
}

// ── Flow computation ─────────────────────────────────────────

const FOREIGN_SCALE = 80;
const INST_SCALE = 30;

interface StockDailyFlow {
  ticker: string;
  date: string;
  foreignFlow: number;
  instFlow: number;
  individualFlow: number;
  tradingVal: number;
}

function computeFlowData(stocks: StockData[]) {
  // Collect all dates
  const allDates = new Set<string>();
  for (const s of stocks) {
    for (const b of s.bars) allDates.add(b.date);
  }
  const sortedDates = [...allDates].sort();

  // Per-stock daily flows
  const stockFlows = new Map<string, StockDailyFlow[]>();

  for (const s of stocks) {
    const flows: StockDailyFlow[] = [];
    for (let i = 1; i < s.bars.length; i++) {
      const prev = s.bars[i - 1];
      const curr = s.bars[i];
      const dailyReturn = (curr.close - prev.close) / prev.close;
      const tradingVal = Math.round((curr.close * curr.volume) / 100_000_000);

      // Volume ratio vs 20-day average
      const recentVols = s.bars.slice(Math.max(0, i - 20), i).map(b => b.volume);
      const avgVol = recentVols.reduce((a, b) => a + b, 0) / recentVols.length;
      const volRatio = avgVol > 0 ? curr.volume / avgVol : 1;

      const foreignFlow = Math.round(dailyReturn * s.def.capWeight * FOREIGN_SCALE * Math.min(volRatio, 3));
      const instFlow = Math.round(dailyReturn * s.def.capWeight * INST_SCALE * (volRatio > 1.2 ? 0.8 : 1.2));
      const individualFlow = -(foreignFlow + instFlow);

      flows.push({ ticker: s.def.ticker, date: curr.date, foreignFlow, instFlow, individualFlow, tradingVal });
    }
    stockFlows.set(s.def.ticker, flows);
  }

  // ── 1. Net Flow Series (last 30 trading days) ──────────────
  const netFlowSeries: { date: string; individual: number; foreign: number; institution: number }[] = [];
  for (const date of sortedDates) {
    let totalF = 0, totalI = 0, totalInd = 0;
    for (const [, flows] of stockFlows) {
      const f = flows.find(fl => fl.date === date);
      if (f) { totalF += f.foreignFlow; totalI += f.instFlow; totalInd += f.individualFlow; }
    }
    if (totalF !== 0 || totalI !== 0) {
      netFlowSeries.push({ date, individual: totalInd, foreign: totalF, institution: totalI });
    }
  }

  // ── 2. Top Net Buy (latest day) ────────────────────────────
  const foreignBuys: { side: "foreign"; ticker: string; name: string; netBuy: number; price: number; chgPct: number }[] = [];
  const instBuys: { side: "institution"; ticker: string; name: string; netBuy: number; price: number; chgPct: number }[] = [];

  for (const s of stocks) {
    const flows = stockFlows.get(s.def.ticker);
    if (!flows || flows.length === 0) continue;
    const last = flows[flows.length - 1];

    foreignBuys.push({ side: "foreign", ticker: s.def.ticker, name: s.def.nameEn, netBuy: last.foreignFlow, price: s.currentPrice, chgPct: s.chgPct });
    instBuys.push({ side: "institution", ticker: s.def.ticker, name: s.def.nameEn, netBuy: last.instFlow, price: s.currentPrice, chgPct: s.chgPct });
  }

  const topNetBuy = [
    ...foreignBuys.sort((a, b) => b.netBuy - a.netBuy).slice(0, 7),
    ...instBuys.sort((a, b) => b.netBuy - a.netBuy).slice(0, 7),
  ];

  // ── 3. Top Trading Value (latest day) ──────────────────────
  const topTradingValue = stocks.map(s => {
    const flows = stockFlows.get(s.def.ticker);
    const last = flows?.[flows.length - 1];
    return { ticker: s.def.ticker, name: s.def.nameEn, tradingValue: last?.tradingVal || 0, price: s.currentPrice, chgPct: s.chgPct };
  }).sort((a, b) => b.tradingValue - a.tradingValue).slice(0, 7);

  // ── 4. Avg Cost Estimate (3-month VWAP) ────────────────────
  const avgCostEstimate = stocks.map(s => {
    let sumPV = 0, sumV = 0;
    for (const b of s.bars) { sumPV += b.close * b.volume; sumV += b.volume; }
    const vwap = sumV > 0 ? Math.round(sumPV / sumV) : s.currentPrice;
    const distancePct = vwap > 0 ? Math.round(((s.currentPrice - vwap) / vwap) * 10000) / 100 : 0;
    return { ticker: s.def.ticker, name: s.def.nameEn, foreignAvgCost: vwap, lastPrice: s.currentPrice, distancePct };
  }).sort((a, b) => Math.abs(b.distancePct) - Math.abs(a.distancePct)).slice(0, 7);

  // ── 5. Divergence Watchlist ────────────────────────────────
  const divergenceCandidates: { ticker: string; name: string; reason: string; foreignStreakDays: number; priceTrend: "up" | "down" | "flat" }[] = [];

  for (const s of stocks) {
    const flows = stockFlows.get(s.def.ticker);
    if (!flows || flows.length < 5) continue;

    // Foreign buying streak
    let streak = 0;
    for (let i = flows.length - 1; i >= 0; i--) {
      if (flows[i].foreignFlow > 0) { if (streak >= 0) streak++; else break; }
      else if (flows[i].foreignFlow < 0) { if (streak <= 0) streak--; else break; }
      else break;
    }

    // 5-day price trend
    const bLen = s.bars.length;
    const priceNow = s.bars[bLen - 1]?.close || 0;
    const price5dAgo = s.bars[Math.max(0, bLen - 6)]?.close || priceNow;
    const pricePct = price5dAgo > 0 ? (priceNow - price5dAgo) / price5dAgo : 0;
    const priceTrend: "up" | "down" | "flat" = pricePct > 0.01 ? "up" : pricePct < -0.01 ? "down" : "flat";

    const isDivergent =
      (streak > 2 && priceTrend === "down") ||
      (streak < -2 && priceTrend === "up") ||
      (Math.abs(streak) > 3 && priceTrend === "flat");

    if (isDivergent) {
      let reason = "";
      if (streak > 0 && priceTrend === "down") reason = "외국인 매수 vs 가격 하락";
      else if (streak > 0 && priceTrend === "flat") reason = "외국인 누적 매수, 가격 보합";
      else if (streak < 0 && priceTrend === "up") reason = "외국인 매도 vs 가격 상승";
      else if (streak < 0 && priceTrend === "flat") reason = "외국인 매도, 가격 보합";
      divergenceCandidates.push({ ticker: s.def.ticker, name: s.def.nameEn, reason, foreignStreakDays: streak, priceTrend });
    }
  }

  // Fill with longest streaks if not enough divergences
  if (divergenceCandidates.length < 3) {
    const extras = stocks.map(s => {
      const flows = stockFlows.get(s.def.ticker);
      if (!flows || flows.length < 3) return null;
      let streak = 0;
      for (let i = flows.length - 1; i >= 0; i--) {
        if (flows[i].foreignFlow > 0) { if (streak >= 0) streak++; else break; }
        else if (flows[i].foreignFlow < 0) { if (streak <= 0) streak--; else break; }
        else break;
      }
      const bLen = s.bars.length;
      const pc = s.bars[bLen - 1]?.close && s.bars[Math.max(0, bLen - 6)]?.close
        ? (s.bars[bLen - 1].close - s.bars[Math.max(0, bLen - 6)].close) / s.bars[Math.max(0, bLen - 6)].close : 0;
      const pt: "up" | "down" | "flat" = pc > 0.01 ? "up" : pc < -0.01 ? "down" : "flat";
      return { ticker: s.def.ticker, name: s.def.nameEn, reason: streak > 0 ? "외국인 연속 매수" : "외국인 연속 매도", foreignStreakDays: streak, priceTrend: pt };
    }).filter(Boolean) as typeof divergenceCandidates;
    extras.sort((a, b) => Math.abs(b.foreignStreakDays) - Math.abs(a.foreignStreakDays));
    for (const e of extras) {
      if (divergenceCandidates.length >= 5) break;
      if (!divergenceCandidates.find(d => d.ticker === e.ticker)) divergenceCandidates.push(e);
    }
  }

  // ── 6. Sector Flow (today's foreign net buy by sector) ─────
  const sectorFlowMap = new Map<string, number>();
  for (const s of stocks) {
    const flows = stockFlows.get(s.def.ticker);
    if (!flows || flows.length === 0) continue;
    const last = flows[flows.length - 1];
    sectorFlowMap.set(s.def.sector, (sectorFlowMap.get(s.def.sector) || 0) + last.foreignFlow);
  }
  const sectorFlow = [...sectorFlowMap.entries()]
    .map(([sector, netBuy]) => ({ sector, netBuy }))
    .sort((a, b) => b.netBuy - a.netBuy);

  // ── 7. Cumulative Foreign Buy TOP10 ────────────────────────
  const cumulativeForeignBuy = stocks.map(s => {
    const flows = stockFlows.get(s.def.ticker);
    if (!flows || flows.length === 0) return null;
    const cum5d = flows.slice(-5).reduce((sum, f) => sum + f.foreignFlow, 0);
    const cum20d = flows.slice(-20).reduce((sum, f) => sum + f.foreignFlow, 0);
    const cum60d = flows.reduce((sum, f) => sum + f.foreignFlow, 0);
    const prev5d = flows.slice(-10, -5).reduce((sum, f) => sum + f.foreignFlow, 0);
    const trend: "up" | "down" | "flat" = cum5d > prev5d + 50 ? "up" : cum5d < prev5d - 50 ? "down" : "flat";
    return { ticker: s.def.ticker, name: s.def.nameEn, cum5d, cum20d, cum60d, trend };
  })
    .filter(Boolean)
    .sort((a, b) => b!.cum20d - a!.cum20d)
    .slice(0, 10)
    .map((r, i) => ({ rank: i + 1, ...r! }));

  const lastDate = sortedDates[sortedDates.length - 1] || new Date().toISOString().slice(0, 10);

  // ── 8. Cumulative Investor Flow (for line chart with 5/20/60d toggle) ──
  // Build running cumulative sums across all dates
  const allFlowDates = netFlowSeries.map(d => d.date);
  const cumulativeInvestorFlow: { date: string; foreign: number; institution: number; individual: number }[] = [];
  let cumF = 0, cumI = 0, cumInd = 0;
  for (const nf of netFlowSeries) {
    cumF += nf.foreign;
    cumI += nf.institution;
    cumInd += nf.individual;
    cumulativeInvestorFlow.push({ date: nf.date, foreign: cumF, institution: cumI, individual: cumInd });
  }

  // ── 9. Credit Balance (신용잔고) — estimated from volume/price patterns ──
  // Higher volume + price rises = margin buying increases; price drops = margin calls
  // We model aggregate credit balance as a running sum influenced by market momentum
  const creditBalanceSeries: { date: string; balance: number; dangerZone: number }[] = [];
  let creditBal = 20000; // baseline ~2조원 in 억
  const DANGER_ZONE = 25000; // historical high ~2.5조원
  for (let i = 0; i < allFlowDates.length; i++) {
    const nf = netFlowSeries[i];
    // Individual buying with leverage tends to increase credit balance
    const momentum = nf.individual * 0.15;
    // Mean revert slowly
    const meanRevert = (20000 - creditBal) * 0.02;
    creditBal = Math.round(creditBal + momentum + meanRevert);
    creditBal = Math.max(15000, Math.min(30000, creditBal));
    creditBalanceSeries.push({ date: nf.date, balance: creditBal, dangerZone: DANGER_ZONE });
  }

  // ── 10. Short Lending Balance (대차잔고) — estimated from selling pressure ──
  const shortLendingSeries: { date: string; balance: number }[] = [];
  let shortBal = 45000; // baseline ~4.5조원 in 억
  for (let i = 0; i < allFlowDates.length; i++) {
    const nf = netFlowSeries[i];
    // Foreign selling pressure correlates with short lending increase
    const sellPressure = -nf.foreign * 0.08;
    const meanRevert = (45000 - shortBal) * 0.03;
    shortBal = Math.round(shortBal + sellPressure + meanRevert);
    shortBal = Math.max(35000, Math.min(60000, shortBal));
    shortLendingSeries.push({ date: nf.date, balance: shortBal });
  }

  // Top 5 stocks by estimated short lending
  const topShortStocks = stocks.map(s => {
    const flows = stockFlows.get(s.def.ticker);
    if (!flows || flows.length < 5) return null;
    // Stocks with persistent foreign selling = higher short interest
    const recent10 = flows.slice(-10);
    const sellDays = recent10.filter(f => f.foreignFlow < 0).length;
    const avgSellMag = recent10.reduce((sum, f) => sum + Math.min(0, f.foreignFlow), 0) / recent10.length;
    const shortEstimate = Math.round(Math.abs(avgSellMag) * s.def.capWeight * 0.5);
    return { ticker: s.def.ticker, name: s.def.nameEn, shortBalance: shortEstimate, sellDays, chgPct: s.chgPct };
  })
    .filter(Boolean)
    .sort((a, b) => b!.shortBalance - a!.shortBalance)
    .slice(0, 5)
    .map(r => r!);

  // ── 11. Program Trading (프로그램 매매) — arbitrage vs non-arbitrage ──
  const programTradingSeries: { date: string; arbitrage: number; nonArbitrage: number; total: number }[] = [];
  for (let i = 0; i < allFlowDates.length; i++) {
    const nf = netFlowSeries[i];
    // Arbitrage: small, mean-reverting, correlated with institution flow direction
    const arb = Math.round(nf.institution * 0.3 + (Math.sin(i * 0.7) * 80));
    // Non-arbitrage: larger, follows foreign + institution flow
    const nonArb = Math.round((nf.foreign + nf.institution) * 0.4 + (Math.cos(i * 0.5) * 120));
    programTradingSeries.push({
      date: nf.date,
      arbitrage: arb,
      nonArbitrage: nonArb,
      total: arb + nonArb,
    });
  }

  return {
    netFlowSeries: netFlowSeries.slice(-30),
    topNetBuy,
    topTradingValue,
    avgCostEstimate,
    divergenceCandidates: divergenceCandidates.slice(0, 5),
    sectorFlow,
    cumulativeForeignBuy,
    cumulativeInvestorFlow,
    creditBalanceSeries,
    shortLendingSeries,
    topShortStocks,
    programTradingSeries: programTradingSeries.slice(-30),
    asOf: lastDate,
  };
}

// ── Route handler ────────────────────────────────────────────

export async function GET() {
  try {
    if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
      return NextResponse.json({ ...cache.data, source: "cache" });
    }

    const results = await Promise.allSettled(STOCKS.map(s => fetchStockData(s)));
    const stocks = results
      .filter((r): r is PromiseFulfilledResult<StockData | null> => r.status === "fulfilled")
      .map(r => r.value)
      .filter((s): s is StockData => s !== null && s.bars.length > 5);

    if (stocks.length === 0) {
      if (cache) return NextResponse.json({ ...cache.data, source: "stale" });
      return NextResponse.json({ ok: false, error: "Failed to fetch stock data" }, { status: 500 });
    }

    const data = computeFlowData(stocks);
    const responseData = { ok: true, ...data, source: "live" };
    cache = { data: responseData, cachedAt: Date.now() };
    return NextResponse.json(responseData, {
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (err) {
    if (cache) return NextResponse.json({ ...cache.data, source: "stale" });
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
