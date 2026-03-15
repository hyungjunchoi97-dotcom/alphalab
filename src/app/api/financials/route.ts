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
  const n = Number(v.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeArr(data: any): any[] {
  return Array.isArray(data) ? data : [];
}

// ── DART (KR) ───────────────────────────────────────────────

async function resolveCorpCode(ticker: string): Promise<string | null> {
  const code = ticker.replace(/\.(KS|KQ)$/i, "").slice(0, 6);
  if (/^\d{6}$/.test(code)) {
    const json = await fetchJson(
      `${DART_BASE}/company.json?crtfc_key=${DART_KEY}&stock_code=${code}`
    );
    if (json?.status === "000" && json.corp_code) return json.corp_code;
  }
  const json = await fetchJson(
    `${DART_BASE}/company.json?crtfc_key=${DART_KEY}&corp_name=${encodeURIComponent(ticker)}`
  );
  if (json?.status === "000" && json.corp_code) return json.corp_code;
  return null;
}

interface DartItem {
  sj_div: string;
  account_nm: string;
  thstrm_amount?: string;
  [key: string]: unknown;
}

async function fetchDartFull(corpCode: string, year: number, reprtCode: string): Promise<DartItem[]> {
  const url = `${DART_BASE}/fnlttSinglAcntAll.json?crtfc_key=${DART_KEY}&corp_code=${corpCode}&bsns_year=${year}&reprt_code=${reprtCode}&fs_div=CFS`;
  const json = await fetchJson(url);
  if (!json || json.status !== "000") return [];
  return json.list || [];
}

function dartFind(items: DartItem[], sjDiv: string, ...names: string[]): number | null {
  for (const name of names) {
    const item = items.find(i => i.sj_div === sjDiv && i.account_nm === name);
    if (item?.thstrm_amount) {
      const v = parseDartAmount(item.thstrm_amount);
      if (v != null) return v;
    }
  }
  return null;
}

function dartPct(num: number | null, den: number | null): number | null {
  return num != null && den != null && den !== 0
    ? Math.round((num / den) * 10000) / 100 : null;
}

function extractFull(items: DartItem[]) {
  // ── P&L ──
  const revenue = dartFind(items, "IS", "매출액", "수익(매출액)", "영업수익");
  const costOfRevenue = dartFind(items, "IS", "매출원가");
  const grossProfit = dartFind(items, "IS", "매출총이익")
    ?? (revenue != null && costOfRevenue != null ? revenue - costOfRevenue : null);
  const sgaExpense = dartFind(items, "IS", "판매비와관리비");
  const operatingIncome = dartFind(items, "IS", "영업이익", "영업이익(손실)");
  const interestExpense = dartFind(items, "IS", "이자비용", "금융비용", "금융원가");
  const incomeTaxExpense = dartFind(items, "IS", "법인세비용");
  const netIncome = dartFind(items, "IS", "당기순이익", "당기순이익(손실)");
  const epsRaw = dartFind(items, "IS", "기본주당이익", "기본주당순이익");
  const depreciation = dartFind(items, "CF", "감가상각비");
  const amortization = dartFind(items, "CF", "무형자산상각비");
  const da = depreciation != null || amortization != null
    ? (depreciation ?? 0) + (amortization ?? 0) : null;
  const ebitda = operatingIncome != null && da != null ? operatingIncome + da : null;

  // ── B/S ──
  const totalCurrentAssets = dartFind(items, "BS", "유동자산");
  const cash = dartFind(items, "BS", "현금및현금성자산");
  const shortTermInvestments = dartFind(items, "BS", "단기금융상품", "단기투자자산");
  const accountsReceivable = dartFind(items, "BS", "매출채권", "매출채권 및 기타유동채권", "매출채권및기타채권");
  const inventory = dartFind(items, "BS", "재고자산");
  const totalNonCurrentAssets = dartFind(items, "BS", "비유동자산");
  const ppeNet = dartFind(items, "BS", "유형자산");
  const longTermInvestments = dartFind(items, "BS", "장기금융상품", "관계기업투자등", "기타비유동금융자산");
  const goodwill = dartFind(items, "BS", "영업권");
  const totalAssets = dartFind(items, "BS", "자산총계");
  const totalCurrentLiabilities = dartFind(items, "BS", "유동부채");
  const accountPayables = dartFind(items, "BS", "매입채무", "매입채무 및 기타유동채무", "매입채무및기타채무");
  const shortTermDebt = dartFind(items, "BS", "단기차입금", "유동금융부채");
  const deferredRevenue = dartFind(items, "BS", "선수금", "계약부채");
  const totalNonCurrentLiabilities = dartFind(items, "BS", "비유동부채");
  const longTermDebt = dartFind(items, "BS", "장기차입금", "비유동금융부채", "사채");
  const totalLiabilities = dartFind(items, "BS", "부채총계");
  const commonStock = dartFind(items, "BS", "자본금");
  const retainedEarnings = dartFind(items, "BS", "이익잉여금");
  const totalEquity = dartFind(items, "BS", "자본총계");

  // ── C/F ──
  const operatingCF = dartFind(items, "CF", "영업활동현금흐름", "영업활동으로인한현금흐름");
  const investingCF = dartFind(items, "CF", "투자활동현금흐름", "투자활동으로인한현금흐름");
  const financingCF = dartFind(items, "CF", "재무활동현금흐름", "재무활동으로인한현금흐름");
  const capex = dartFind(items, "CF", "유형자산의 취득", "유형자산취득");
  const dividendsPaid = dartFind(items, "CF", "배당금지급", "배당금의지급");

  // ── Derived ──
  const totalDebtVal = (shortTermDebt ?? 0) + (longTermDebt ?? 0);
  const hasDebt = shortTermDebt != null || longTermDebt != null;
  const fcf = operatingCF != null && capex != null ? operatingCF + capex : null;

  return {
    revenue, costOfRevenue, grossProfit,
    grossMargin: dartPct(grossProfit, revenue),
    rdExpense: null as number | null,
    sgaExpense, operatingIncome,
    operatingMargin: dartPct(operatingIncome, revenue),
    interestExpense, incomeTaxExpense, netIncome,
    netMargin: dartPct(netIncome, revenue),
    ebitda,
    eps: epsRaw != null ? Math.round(epsRaw * 100) / 100 : null,
    revenueGrowth: null as number | null,
    // BS
    totalCurrentAssets, cash, shortTermInvestments, accountsReceivable, inventory,
    otherCurrentAssets: totalCurrentAssets != null
      ? totalCurrentAssets - (cash ?? 0) - (shortTermInvestments ?? 0) - (accountsReceivable ?? 0) - (inventory ?? 0) : null,
    totalNonCurrentAssets, ppeNet, longTermInvestments, goodwill,
    otherNonCurrent: totalNonCurrentAssets != null
      ? totalNonCurrentAssets - (ppeNet ?? 0) - (longTermInvestments ?? 0) - (goodwill ?? 0) : null,
    totalAssets,
    totalCurrentLiabilities, accountPayables, shortTermDebt, deferredRevenue,
    otherCurrentLiabilities: totalCurrentLiabilities != null
      ? totalCurrentLiabilities - (accountPayables ?? 0) - (shortTermDebt ?? 0) - (deferredRevenue ?? 0) : null,
    totalNonCurrentLiabilities, longTermDebt,
    otherNonCurrentLiabilities: totalNonCurrentLiabilities != null && longTermDebt != null
      ? totalNonCurrentLiabilities - longTermDebt : null,
    totalLiabilities, commonStock, retainedEarnings, totalEquity,
    netDebt: hasDebt ? totalDebtVal - (cash ?? 0) : null,
    totalDebt: hasDebt ? totalDebtVal : null,
    debtToEquity: totalEquity != null && totalEquity !== 0 && hasDebt
      ? Math.round((totalDebtVal / totalEquity) * 10000) / 100 : null,
    currentRatio: totalCurrentAssets != null && totalCurrentLiabilities != null && totalCurrentLiabilities !== 0
      ? Math.round((totalCurrentAssets / totalCurrentLiabilities) * 100) / 100 : null,
    totalInvestments: (shortTermInvestments ?? 0) + (longTermInvestments ?? 0) || null,
    // CF
    operatingCF, sbc: null as number | null, changeInWorkingCapital: null as number | null,
    capex, fcf, investingCF, financingCF, dividendsPaid,
  };
}

// Flow fields (IS + CF) are cumulative in DART quarterly reports
const DART_FLOW_KEYS = [
  "revenue", "costOfRevenue", "grossProfit", "sgaExpense", "operatingIncome",
  "interestExpense", "incomeTaxExpense", "netIncome", "ebitda",
  "operatingCF", "investingCF", "financingCF", "capex", "dividendsPaid",
];

type FullRow = ReturnType<typeof extractFull>;

/** Subtract previous cumulative from current to get standalone quarter (IS/CF only; BS kept from current) */
function quarterStandalone(cumCur: FullRow, cumPrev: FullRow | null): FullRow {
  if (!cumPrev) return cumCur;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = { ...cumCur };
  for (const key of DART_FLOW_KEYS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cur = (cumCur as any)[key] as number | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prev = (cumPrev as any)[key] as number | null;
    if (cur != null && prev != null) result[key] = cur - prev;
  }
  // Recompute margins from standalone values
  result.grossMargin = dartPct(result.grossProfit, result.revenue);
  result.operatingMargin = dartPct(result.operatingIncome, result.revenue);
  result.netMargin = dartPct(result.netIncome, result.revenue);
  if (result.operatingCF != null && result.capex != null) result.fcf = result.operatingCF + result.capex;
  return result as FullRow;
}

function hasDartData(row: FullRow): boolean {
  return row.revenue != null || row.totalAssets != null;
}

async function fetchKR(ticker: string, period: string) {
  const code = ticker.replace(/\.(KS|KQ)$/i, "").slice(0, 6);
  const corpCode = await resolveCorpCode(code);
  if (!corpCode) throw new Error(`Corp code not found for ${ticker}`);

  const suffix = `${code}.KS`;

  if (period === "annual") {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - 5 + i); // oldest → newest

    const fetches = years.map(y => fetchDartFull(corpCode, y, "11011"));
    const [quoteJson, ...reports] = await Promise.all([
      fetchJson(`${FMP_BASE}/quote/${suffix}?apikey=${FMP_KEY}`),
      ...fetches,
    ]);

    const rows = reports.map((items, i) => ({
      label: `${years[i]}`,
      ...extractFull(items),
    }));

    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1].revenue;
      const cur = rows[i].revenue;
      if (prev != null && cur != null && prev !== 0) {
        rows[i].revenueGrowth = Math.round(((cur - prev) / Math.abs(prev)) * 10000) / 100;
      }
    }

    const quote = Array.isArray(quoteJson) ? quoteJson[0] : quoteJson;
    return {
      market: "KR" as const,
      ticker: code,
      marketCap: quote?.marketCap ? Math.round(quote.marketCap / 1e8) : null,
      price: quote?.price ?? null,
      quarterly: rows,
    };
  }

  // ── Quarterly: 2 years × 4 report types ──
  const currentYear = new Date().getFullYear();
  const targetYears = [currentYear - 2, currentYear - 1];
  const reportCodes = ["11013", "11012", "11014", "11011"]; // Q1, H1, 9M, FY

  const fetches = targetYears.flatMap(y => reportCodes.map(c => fetchDartFull(corpCode, y, c)));
  const [quoteJson, ...reports] = await Promise.all([
    fetchJson(`${FMP_BASE}/quote/${suffix}?apikey=${FMP_KEY}`),
    ...fetches,
  ]);

  // reports: [y0_q1, y0_h1, y0_9m, y0_fy, y1_q1, y1_h1, y1_9m, y1_fy]
  const quarters: (FullRow & { label: string })[] = [];

  for (let yi = 0; yi < targetYears.length; yi++) {
    const year = targetYears[yi];
    const base = yi * 4;
    const q1Cum = extractFull(reports[base]);
    const h1Cum = extractFull(reports[base + 1]);
    const m9Cum = extractFull(reports[base + 2]);
    const fyCum = extractFull(reports[base + 3]);

    if (hasDartData(q1Cum)) quarters.push({ label: `${year} Q1`, ...q1Cum });
    if (hasDartData(h1Cum)) quarters.push({ label: `${year} Q2`, ...quarterStandalone(h1Cum, hasDartData(q1Cum) ? q1Cum : null) });
    if (hasDartData(m9Cum)) quarters.push({ label: `${year} Q3`, ...quarterStandalone(m9Cum, hasDartData(h1Cum) ? h1Cum : null) });
    if (hasDartData(fyCum)) quarters.push({ label: `${year} Q4`, ...quarterStandalone(fyCum, hasDartData(m9Cum) ? m9Cum : null) });
  }

  for (let i = 1; i < quarters.length; i++) {
    const prev = quarters[i - 1].revenue;
    const cur = quarters[i].revenue;
    if (prev != null && cur != null && prev !== 0) {
      quarters[i].revenueGrowth = Math.round(((cur - prev) / Math.abs(prev)) * 10000) / 100;
    }
  }

  const quote = Array.isArray(quoteJson) ? quoteJson[0] : quoteJson;
  return {
    market: "KR" as const,
    ticker: code,
    marketCap: quote?.marketCap ? Math.round(quote.marketCap / 1e8) : null,
    price: quote?.price ?? null,
    quarterly: quarters,
  };
}

// ── FMP (US) ────────────────────────────────────────────────

async function fetchUS(ticker: string, period: string) {
  const fmpPeriod = period === "annual" ? "annual" : "quarter";
  const limit = period === "annual" ? 5 : 8;

  const [isData, bsData, cfData, profileData, ptData, kmData, ratioData, earningsData, insiderData, instData, gradesSummaryData, gradesData, earningsSurpriseData, priceHistData] = await Promise.all([
    fetchJson(`${FMP_BASE}/income-statement?symbol=${ticker}&period=${fmpPeriod}&limit=${limit}&apikey=${FMP_KEY}`),
    fetchJson(`${FMP_BASE}/balance-sheet-statement?symbol=${ticker}&period=${fmpPeriod}&limit=${limit}&apikey=${FMP_KEY}`),
    fetchJson(`${FMP_BASE}/cash-flow-statement?symbol=${ticker}&period=${fmpPeriod}&limit=${limit}&apikey=${FMP_KEY}`),
    fetchJson(`${FMP_BASE}/profile?symbol=${ticker}&apikey=${FMP_KEY}`),
    fetchJson(`${FMP_BASE}/price-target-consensus?symbol=${ticker}&apikey=${FMP_KEY}`),
    fetchJson(`${FMP_BASE}/key-metrics?symbol=${ticker}&period=annual&limit=10&apikey=${FMP_KEY}`),
    fetchJson(`${FMP_BASE}/ratios?symbol=${ticker}&period=annual&limit=10&apikey=${FMP_KEY}`),
    fetchJson(`${FMP_BASE}/earning-calendar-confirmed?symbol=${ticker}&apikey=${FMP_KEY}`),
    fetchJson(`${FMP_BASE}/insider-trading?symbol=${ticker}&limit=20&apikey=${FMP_KEY}`),
    fetchJson(`${FMP_BASE}/institutional-holder?symbol=${ticker}&apikey=${FMP_KEY}`),
    fetchJson(`${FMP_BASE}/grades-consensus?symbol=${ticker}&apikey=${FMP_KEY}`),
    fetchJson(`${FMP_BASE}/grades?symbol=${ticker}&limit=5&apikey=${FMP_KEY}`),
    fetchJson(`${FMP_BASE}/earnings-surprises?symbol=${ticker}&limit=8&apikey=${FMP_KEY}`),
    fetchJson(`${FMP_BASE}/historical-price-eod/full?symbol=${ticker}&limit=365&apikey=${FMP_KEY}`),
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
    roic: r2((k.returnOnInvestedCapital ?? k.roic) != null ? (k.returnOnInvestedCapital ?? k.roic) * 100 : null),
    roa: r2(k.returnOnAssets != null ? k.returnOnAssets * 100 : null),
    fcfYield: r2(k.freeCashFlowYield != null ? k.freeCashFlowYield * 100 : null),
    eps: r2(k.earningsYield != null ? k.earningsYield * 100 : null),
    revenuePerShare: r2(k.revenuePerShare),
    netIncomePerShare: r2(k.netIncomePerShare),
    interestCoverage: r2(k.interestCoverageRatio ?? k.interestCoverage),
    netDebtToEbitda: r2(k.netDebtToEBITDA),
  })).reverse();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kmMap = new Map(safeArr(kmData).map((k: any) => [`${k.fiscalYear ?? k.calendarYear}`, k]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const valuation = safeArr(ratioData).map((v: any) => {
    const year = `${v.fiscalYear ?? v.calendarYear}`;
    const km = kmMap.get(year) as any;
    return {
      label: year,
      pe: r2(v.priceToEarningsRatio ?? v.priceEarningsRatio ?? v.peRatio),
      pb: r2(v.priceToBookRatio),
      evEbitda: r2(v.enterpriseValueMultiple ?? km?.evToEBITDA ?? v.enterpriseValueOverEBITDA),
      ps: r2(v.priceToSalesRatio),
      evRevenue: r2(km?.evToSales ?? v.priceToSalesRatio),
      peg: r2(v.priceToEarningsGrowthRatio ?? v.priceEarningsToGrowthRatio ?? v.pegRatio),
      pOcf: r2(v.priceToOperatingCashFlowRatio ?? v.priceToOperatingCashFlowsRatio),
      pFcf: r2(v.priceToFreeCashFlowRatio ?? v.priceToFreeCashFlowsRatio),
      dividendYield: r2(v.dividendYieldPercentage ?? (v.dividendYield != null ? v.dividendYield * 100 : null)),
    };
  }).reverse();

  // Profile enrichment
  const profileInfo = profile ? {
    sector: profile.sector ?? null,
    industry: profile.industry ?? null,
    description: profile.description ?? null,
    ceo: profile.ceo ?? null,
    employees: profile.fullTimeEmployees ?? profile.employees ?? null,
    country: profile.country ?? null,
    ipoDate: profile.ipoDate ?? null,
    beta: profile.beta != null ? Math.round(profile.beta * 100) / 100 : null,
  } : null;

  // Next earnings
  const earningsArr = safeArr(earningsData);
  const now = new Date();
  const nextEarnings = earningsArr.find((e: Record<string, unknown>) => new Date(e.date as string) >= now);

  // Insider trading
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insider = safeArr(insiderData).slice(0, 20).map((t: any) => ({
    date: t.filingDate ?? t.transactionDate ?? null,
    name: t.reportingName ?? t.insider ?? null,
    title: t.typeOfOwner ?? null,
    type: t.transactionType ?? null,
    shares: t.securitiesTransacted ?? t.sharesTraded ?? null,
    value: t.price != null && t.securitiesTransacted != null
      ? Math.round(t.price * t.securitiesTransacted) : null,
  }));

  // Institutional holders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const institutional = safeArr(instData).slice(0, 10).map((h: any) => ({
    holder: h.holder ?? h.investorName ?? null,
    shares: h.shares ?? null,
    pct: h.weightPercent != null ? Math.round(h.weightPercent * 10000) / 100
      : h.ownershipPercent != null ? Math.round(h.ownershipPercent * 100) / 100 : null,
    value: h.value ?? null,
    change: h.change ?? h.sharesChange ?? null,
  }));

  // Grades summary
  const gradesSummary = (() => {
    const raw = Array.isArray(gradesSummaryData) ? gradesSummaryData[0] : gradesSummaryData;
    if (!raw) return null;
    return {
      strongBuy: raw.strongBuy ?? 0,
      buy: raw.buy ?? 0,
      hold: raw.hold ?? 0,
      sell: raw.sell ?? 0,
      strongSell: raw.strongSell ?? 0,
    };
  })();

  // Recent grade changes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentGrades = safeArr(gradesData).slice(0, 5).map((g: any) => ({
    date: g.date ?? null,
    firm: g.gradingCompany ?? null,
    fromGrade: g.previousGrade ?? null,
    toGrade: g.newGrade ?? null,
    action: g.action ?? null,
  }));

  // Earnings surprises
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const earningsSurprises = safeArr(earningsSurpriseData).slice(0, 8).map((e: any) => ({
    date: e.date ?? null,
    actual: e.actualEarningResult ?? null,
    estimated: e.estimatedEarning ?? null,
  })).reverse();

  // Price history (newest first from FMP → reverse to oldest first)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawHist = Array.isArray(priceHistData) ? priceHistData : (priceHistData as any)?.historical ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceHistory = safeArr(rawHist).slice(0, 365).map((d: any) => ({
    date: d.date ?? null,
    close: d.close ?? d.adjClose ?? null,
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
    profile: profileInfo,
    nextEarnings: nextEarnings ? {
      date: nextEarnings.date ?? null,
      epsEstimate: nextEarnings.epsEstimate ?? null,
    } : null,
    insider,
    institutional,
    gradesSummary,
    recentGrades,
    earningsSurprises,
    priceHistory,
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
