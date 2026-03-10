import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const DART_KEY = process.env.DART_API_KEY || "";
const FMP_KEY = process.env.FMP_API_KEY || "";
const DART_BASE = "https://opendart.fss.or.kr/api";
const FMP_BASE = "https://financialmodelingprep.com/stable";

// ── helpers ─────────────────────────────────────────────────

async function fetchJson(url: string) {
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  return res.json();
}

function parseDartAmount(v?: string): number | null {
  if (!v || v === "-" || v === "") return null;
  return Number(v.replace(/,/g, "")) || null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeArr(data: any): any[] {
  return Array.isArray(data) ? data : [];
}

// ── DART (KR) ───────────────────────────────────────────────

async function resolveCorpCode(ticker: string): Promise<string | null> {
  const isCode = /^\d{6}$/.test(ticker);

  if (isCode) {
    const json = await fetchJson(
      `${DART_BASE}/company.json?crtfc_key=${DART_KEY}&stock_code=${ticker}`
    );
    console.log("[DART CORP SEARCH]", `stock_code=${ticker}`, JSON.stringify(json).slice(0, 200));
    if (json?.status === "000" && json.corp_code) return json.corp_code;
  }

  const json = await fetchJson(
    `${DART_BASE}/company.json?crtfc_key=${DART_KEY}&corp_name=${encodeURIComponent(ticker)}`
  );
  console.log("[DART CORP SEARCH]", `corp_name=${ticker}`, JSON.stringify(json).slice(0, 200));
  if (json?.status === "000" && json.corp_code) return json.corp_code;

  return null;
}

interface DartItem {
  sj_div: string;
  account_nm: string;
  thstrm_amount?: string;
  [key: string]: unknown;
}

async function fetchDartIS(corpCode: string, bsnsYear: number, reprtCode: string): Promise<DartItem[]> {
  const url = `${DART_BASE}/fnlttSinglAcnt.json?crtfc_key=${DART_KEY}&corp_code=${corpCode}&bsns_year=${bsnsYear}&reprt_code=${reprtCode}&fs_div=CFS`;
  const json = await fetchJson(url);
  console.log("[DART IS]", reprtCode, JSON.stringify(json).slice(0, 200));
  if (!json || json.status !== "000") return [];
  return (json.list || []).filter((i: DartItem) => i.sj_div === "IS");
}

function extractIS(items: DartItem[]) {
  let revenue: number | null = null;
  let operatingIncome: number | null = null;
  let netIncome: number | null = null;

  for (const item of items) {
    const nm = item.account_nm;
    if (nm === "매출액" || nm === "수익(매출액)") revenue = parseDartAmount(item.thstrm_amount);
    if (nm === "영업이익" || nm === "영업이익(손실)") operatingIncome = parseDartAmount(item.thstrm_amount);
    if (nm === "당기순이익" || nm === "당기순이익(손실)") netIncome = parseDartAmount(item.thstrm_amount);
  }

  return { revenue, operatingIncome, netIncome };
}

async function fetchKR(ticker: string, period: string) {
  const corpCode = await resolveCorpCode(ticker);
  if (!corpCode) throw new Error(`Corp code not found for ${ticker}`);

  const suffix = ticker.length === 6 ? `${ticker}.KS` : ticker;

  if (period === "annual") {
    // Annual: 사업보고서(11011) for last 5 years
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 - i).reverse();
    const [y1, y2, y3, y4, y5, profileJson] = await Promise.all([
      fetchDartIS(corpCode, years[0], "11011"),
      fetchDartIS(corpCode, years[1], "11011"),
      fetchDartIS(corpCode, years[2], "11011"),
      fetchDartIS(corpCode, years[3], "11011"),
      fetchDartIS(corpCode, years[4], "11011"),
      fetchJson(`${FMP_BASE}/quote/${suffix}?apikey=${FMP_KEY}`),
    ]);

    const results = [y1, y2, y3, y4, y5].map((items, i) => {
      const ex = extractIS(items);
      return { label: `${years[i]}`, ...ex };
    });

    const quote = Array.isArray(profileJson) ? profileJson[0] : profileJson;
    return {
      market: "KR" as const,
      ticker,
      marketCap: quote?.marketCap ? Math.round(quote.marketCap / 1e8) : null,
      price: quote?.price ?? null,
      quarterly: results,
    };
  }

  // Quarterly: 4 reports for 2024
  const quarters = [
    { year: 2024, code: "11013", label: "2024 1Q" },
    { year: 2024, code: "11012", label: "2024 2Q" },
    { year: 2024, code: "11014", label: "2024 3Q" },
    { year: 2024, code: "11011", label: "2024 4Q" },
  ];

  const [q1Items, q2Items, q3Items, q4Items, profileJson] = await Promise.all([
    fetchDartIS(corpCode, quarters[0].year, quarters[0].code),
    fetchDartIS(corpCode, quarters[1].year, quarters[1].code),
    fetchDartIS(corpCode, quarters[2].year, quarters[2].code),
    fetchDartIS(corpCode, quarters[3].year, quarters[3].code),
    fetchJson(`${FMP_BASE}/quote/${suffix}?apikey=${FMP_KEY}`),
  ]);

  const cum1 = extractIS(q1Items);
  const cum2 = extractIS(q2Items);
  const cum3 = extractIS(q3Items);
  const cum4 = extractIS(q4Items);

  const sub = (a: number | null, b: number | null) => (a != null && b != null) ? a - b : null;

  const quarterly = [
    { label: "2024 1Q", revenue: cum1.revenue, operatingIncome: cum1.operatingIncome, netIncome: cum1.netIncome },
    { label: "2024 2Q", revenue: sub(cum2.revenue, cum1.revenue), operatingIncome: sub(cum2.operatingIncome, cum1.operatingIncome), netIncome: sub(cum2.netIncome, cum1.netIncome) },
    { label: "2024 3Q", revenue: sub(cum3.revenue, cum2.revenue), operatingIncome: sub(cum3.operatingIncome, cum2.operatingIncome), netIncome: sub(cum3.netIncome, cum2.netIncome) },
    { label: "2024 4Q", revenue: sub(cum4.revenue, cum3.revenue), operatingIncome: sub(cum4.operatingIncome, cum3.operatingIncome), netIncome: sub(cum4.netIncome, cum3.netIncome) },
  ];

  const quote = Array.isArray(profileJson) ? profileJson[0] : profileJson;

  return {
    market: "KR" as const,
    ticker,
    marketCap: quote?.marketCap ? Math.round(quote.marketCap / 1e8) : null,
    price: quote?.price ?? null,
    quarterly,
  };
}

// ── FMP (US) ────────────────────────────────────────────────

async function fetchUS(ticker: string, period: string) {
  const fmpPeriod = period === "annual" ? "annual" : "quarter";
  const limit = period === "annual" ? 5 : 8;

  const [isData, bsData, cfData, profileData, ptData, kmData, ratioData] = await Promise.all([
    fetchJson(`${FMP_BASE}/income-statement?symbol=${ticker}&period=${fmpPeriod}&limit=${limit}&apikey=${FMP_KEY}`),
    fetchJson(`${FMP_BASE}/balance-sheet-statement?symbol=${ticker}&period=${fmpPeriod}&limit=${limit}&apikey=${FMP_KEY}`),
    fetchJson(`${FMP_BASE}/cash-flow-statement?symbol=${ticker}&period=${fmpPeriod}&limit=${limit}&apikey=${FMP_KEY}`),
    fetchJson(`${FMP_BASE}/profile?symbol=${ticker}&apikey=${FMP_KEY}`),
    fetchJson(`${FMP_BASE}/price-target-consensus?symbol=${ticker}&apikey=${FMP_KEY}`),
    fetchJson(`${FMP_BASE}/key-metrics?symbol=${ticker}&period=annual&limit=10&apikey=${FMP_KEY}`),
    fetchJson(`${FMP_BASE}/ratios?symbol=${ticker}&period=annual&limit=10&apikey=${FMP_KEY}`),
  ]);

  console.log('[FMP IS RAW]', JSON.stringify(isData).slice(0, 500));
  console.log('[FMP BS RAW]', JSON.stringify(bsData).slice(0, 300));
  console.log('[FMP CF RAW]', JSON.stringify(cfData).slice(0, 300));
  console.log('[FMP PROFILE RAW]', JSON.stringify(profileData).slice(0, 500));

  const isArr = safeArr(isData);
  const bsArr = safeArr(bsData);
  const cfArr = safeArr(cfData);
  const profile = Array.isArray(profileData) ? profileData[0] : profileData;

  const m = (v: number | undefined | null) => (v != null ? Math.round(v / 1e6) : null);
  const pct = (num: number | null, den: number | null) =>
    num != null && den != null && den !== 0 ? Math.round((num / den) * 10000) / 100 : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = isArr.map((s: any, idx: number) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bs: any = bsArr[idx] || {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cf: any = cfArr[idx] || {};

    const revenue = m(s.revenue);
    const grossProfit = m(s.grossProfit);
    const operatingIncome = m(s.operatingIncome);
    const netIncome = m(s.netIncome);
    const ebitda = m(s.ebitda);
    const eps = s.epsDiluted ?? s.eps ?? null;
    const totalEquityVal = m(bs.totalStockholdersEquity ?? bs.totalEquity);
    const totalDebtVal = m(bs.totalDebt);

    return {
      label: period === "annual"
        ? `${s.fiscalYear ?? s.calendarYear}`
        : `${s.fiscalYear ?? s.calendarYear} ${s.period}`,
      // P&L
      revenue,
      costOfRevenue: m(s.costOfRevenue),
      grossProfit,
      grossMargin: pct(grossProfit, revenue),
      rdExpense: m(s.researchAndDevelopmentExpenses),
      sgaExpense: m(s.sellingGeneralAndAdministrativeExpenses),
      operatingIncome,
      operatingMargin: pct(operatingIncome, revenue),
      interestExpense: m(s.interestExpense),
      incomeTaxExpense: m(s.incomeTaxExpense),
      netIncome,
      netMargin: pct(netIncome, revenue),
      ebitda,
      eps: eps != null ? Math.round(eps * 100) / 100 : null,
      revenueGrowth: null as number | null, // computed after reverse
      // B/S
      totalCurrentAssets: m(bs.totalCurrentAssets),
      cash: m(bs.cashAndCashEquivalents),
      shortTermInvestments: m(bs.shortTermInvestments),
      accountsReceivable: m(bs.netReceivables ?? bs.accountsReceivables),
      inventory: m(bs.inventory),
      otherCurrentAssets: (() => {
        const tca = m(bs.totalCurrentAssets);
        const sub = [bs.cashAndCashEquivalents, bs.shortTermInvestments, bs.netReceivables ?? bs.accountsReceivables, bs.inventory]
          .reduce((acc: number, v: number | undefined) => acc + (v ? Math.round(v / 1e6) : 0), 0);
        return tca != null ? tca - sub : null;
      })(),
      totalNonCurrentAssets: m(bs.totalNonCurrentAssets),
      ppeNet: m(bs.propertyPlantEquipmentNet),
      longTermInvestments: m(bs.longTermInvestments),
      goodwill: m(bs.goodwill),
      otherNonCurrent: (() => {
        const tnca = m(bs.totalNonCurrentAssets);
        const sub = [bs.propertyPlantEquipmentNet, bs.longTermInvestments, bs.goodwill]
          .reduce((acc: number, v: number | undefined) => acc + (v ? Math.round(v / 1e6) : 0), 0);
        return tnca != null ? tnca - sub : null;
      })(),
      totalAssets: m(bs.totalAssets),
      totalCurrentLiabilities: m(bs.totalCurrentLiabilities),
      accountPayables: m(bs.accountPayables),
      shortTermDebt: m(bs.shortTermDebt),
      deferredRevenue: m(bs.deferredRevenue),
      otherCurrentLiabilities: (() => {
        const tcl = m(bs.totalCurrentLiabilities);
        const sub = [bs.accountPayables, bs.shortTermDebt, bs.deferredRevenue]
          .reduce((acc: number, v: number | undefined) => acc + (v ? Math.round(v / 1e6) : 0), 0);
        return tcl != null ? tcl - sub : null;
      })(),
      totalNonCurrentLiabilities: (() => {
        const tl = m(bs.totalLiabilities);
        const tcl = m(bs.totalCurrentLiabilities);
        return tl != null && tcl != null ? tl - tcl : null;
      })(),
      longTermDebt: m(bs.longTermDebt),
      otherNonCurrentLiabilities: (() => {
        const tl = m(bs.totalLiabilities);
        const tcl = m(bs.totalCurrentLiabilities);
        const ltd = m(bs.longTermDebt);
        const tncl = tl != null && tcl != null ? tl - tcl : null;
        return tncl != null && ltd != null ? tncl - ltd : null;
      })(),
      totalLiabilities: m(bs.totalLiabilities),
      commonStock: m(bs.commonStock),
      retainedEarnings: m(bs.retainedEarnings),
      totalEquity: totalEquityVal,
      netDebt: m(bs.netDebt),
      totalDebt: totalDebtVal,
      debtToEquity: totalEquityVal && totalDebtVal != null && totalEquityVal !== 0
        ? Math.round((totalDebtVal / totalEquityVal) * 10000) / 100 : null,
      currentRatio: bs.totalCurrentAssets && bs.totalCurrentLiabilities && bs.totalCurrentLiabilities !== 0
        ? Math.round((bs.totalCurrentAssets / bs.totalCurrentLiabilities) * 100) / 100 : null,
      totalInvestments: (() => {
        const si = m(bs.shortTermInvestments);
        const li = m(bs.longTermInvestments);
        if (si == null && li == null) return null;
        return (si ?? 0) + (li ?? 0);
      })(),
      // C/F
      operatingCF: m(cf.operatingCashFlow),
      sbc: m(cf.stockBasedCompensation),
      changeInWorkingCapital: m(cf.changeInWorkingCapital),
      capex: m(cf.capitalExpenditure),
      fcf: m(cf.freeCashFlow),
      investingCF: m(cf.netCashUsedForInvestingActivities),
      financingCF: m(cf.netCashUsedProvidedByFinancingActivities),
      dividendsPaid: m(cf.dividendsPaid ?? cf.commonDividendsPaid),
    };
  }).reverse(); // oldest first

  // Compute revenue growth (QoQ or YoY)
  for (let i = 0; i < rows.length; i++) {
    if (i === 0) continue;
    const prev = rows[i - 1].revenue;
    const cur = rows[i].revenue;
    if (prev != null && cur != null && prev !== 0) {
      rows[i].revenueGrowth = Math.round(((cur - prev) / Math.abs(prev)) * 10000) / 100;
    }
  }

  const rawMktCap = profile?.marketCap ?? profile?.mktCap;
  const marketCap = rawMktCap ? Math.round(rawMktCap / 1e6) : null;
  const price = profile?.price ?? null;

  const pt = Array.isArray(ptData) ? ptData[0] : ptData;
  const priceTarget = pt ? {
    consensus: pt.targetConsensus ?? null,
    high: pt.targetHigh ?? null,
    low: pt.targetLow ?? null,
    median: pt.targetMedian ?? null,
  } : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r2 = (v: any) => v != null ? Math.round(v * 100) / 100 : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const keyMetrics = safeArr(kmData).map((k: any) => ({
    label: `${k.fiscalYear ?? k.calendarYear}`,
    roe: r2(k.returnOnEquity != null ? k.returnOnEquity * 100 : null),
    roic: r2(k.roic != null ? k.roic * 100 : null),
    roa: r2(k.returnOnAssets != null ? k.returnOnAssets * 100 : null),
    fcfYield: r2(k.freeCashFlowYield != null ? k.freeCashFlowYield * 100 : null),
    eps: r2(k.earningsYield != null ? k.earningsYield * 100 : null),
    revenuePerShare: r2(k.revenuePerShare),
    netIncomePerShare: r2(k.netIncomePerShare),
    interestCoverage: r2(k.interestCoverage),
    netDebtToEbitda: r2(k.netDebtToEBITDA),
  })).reverse();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const valuation = safeArr(ratioData).map((v: any) => ({
    label: `${v.fiscalYear ?? v.calendarYear}`,
    pe: r2(v.priceEarningsRatio),
    pb: r2(v.priceToBookRatio),
    evEbitda: r2(v.enterpriseValueOverEBITDA),
    ps: r2(v.priceToSalesRatio),
    evRevenue: r2(v.enterpriseValueMultiple ?? v.evToRevenue),
    peg: r2(v.priceEarningsToGrowthRatio),
    dividendYield: r2(v.dividendYield != null ? v.dividendYield * 100 : null),
  })).reverse();

  return {
    market: "US" as const,
    ticker,
    marketCap,
    price,
    priceTarget,
    quarterly: rows,
    keyMetrics,
    valuation,
  };
}

// ── GET handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const rawTicker = req.nextUrl.searchParams.get("ticker") || "";
    const ticker = rawTicker.replace(/\.(KS|KQ)$/i, "");
    const market = (req.nextUrl.searchParams.get("market") || "US").toUpperCase();
    const period = req.nextUrl.searchParams.get("period") === "annual" ? "annual" : "quarterly";

    if (!ticker) {
      return NextResponse.json({ ok: false, error: "ticker required" }, { status: 400 });
    }

    const data = market === "KR" ? await fetchKR(ticker, period) : await fetchUS(ticker, period);

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[FINANCIALS ERROR]", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
