import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const DART_KEY = process.env.DART_API_KEY || "";
const FMP_KEY = process.env.FMP_API_KEY || "";
const FINNHUB_KEY = process.env.FINNHUB_API_KEY || "";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
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

// ── Corp Code ZIP cache ─────────────────────────────────────

let corpCodeMap: Map<string, string> | null = null;
let corpCodeExpiry = 0;

async function loadCorpCodeMap(): Promise<Map<string, string>> {
  if (corpCodeMap && Date.now() < corpCodeExpiry) return corpCodeMap;

  const res = await fetch(
    `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${DART_KEY}`
  );
  const buf = await res.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("CORPCODE.xml")!.async("string");

  const map = new Map<string, string>();
  const entries = xml.split("<list>");
  for (const entry of entries) {
    const stockMatch = entry.match(/<stock_code>([^<]*)<\/stock_code>/);
    const corpMatch = entry.match(/<corp_code>([^<]+)<\/corp_code>/);
    if (stockMatch && corpMatch && stockMatch[1].trim()) {
      map.set(stockMatch[1].trim(), corpMatch[1].trim());
    }
  }

  corpCodeMap = map;
  corpCodeExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24h
  console.log(`[DART] Corp code map loaded: ${map.size} entries`);
  return map;
}

async function getCorpCode(stockCode: string): Promise<string> {
  const code = stockCode.replace(/\.(KS|KQ)$/i, "").slice(0, 6);
  const map = await loadCorpCodeMap();
  const corpCode = map.get(code);
  if (!corpCode) throw new Error(`Corp code not found for ${stockCode}`);
  return corpCode;
}

// ── DART fetch ──────────────────────────────────────────────

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

function dartPct(num: number | null, den: number | null): number | null {
  return num != null && den != null && den !== 0
    ? Math.round((num / den) * 10000) / 100 : null;
}

// ── Claude AI account classification ────────────────────────

type AccountMap = Record<string, Record<string, string>>; // { IS: { "매출액": "revenue", ... }, BS: {...}, CF: {...} }

// In-memory cache per corp_code
const accountMapCache = new Map<string, { map: AccountMap; expiry: number }>();

async function classifyAccounts(allItems: DartItem[]): Promise<AccountMap> {
  // Collect unique (sj_div, account_nm) pairs
  const byDiv: Record<string, string[]> = {};
  for (const item of allItems) {
    if (!item.sj_div || !item.account_nm) continue;
    if (!byDiv[item.sj_div]) byDiv[item.sj_div] = [];
    if (!byDiv[item.sj_div].includes(item.account_nm)) {
      byDiv[item.sj_div].push(item.account_nm);
    }
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `DART 재무제표 계정과목→표준키 매핑. JSON만 반환.

계정(sj_div별): ${JSON.stringify(byDiv)}

표준키:
IS: revenue,costOfRevenue,grossProfit,rdExpense,sgaExpense,operatingIncome,interestExpense,incomeTaxExpense,netIncome,eps
BS: totalCurrentAssets,cash,shortTermInvestments,accountsReceivable,inventory,totalNonCurrentAssets,ppeNet,longTermInvestments,goodwill,totalAssets,totalCurrentLiabilities,accountPayables,shortTermDebt,deferredRevenue,totalNonCurrentLiabilities,longTermDebt,totalLiabilities,commonStock,retainedEarnings,totalEquity
CF: operatingCF,investingCF,financingCF,capex,dividendsPaid,depreciation,amortization

형식: {"IS":{"계정명":"표준키",...},"BS":{...},"CF":{...}}
각 표준키당 가장 적합한 계정 1개만. 매핑불가 제외. 설명 없이 JSON만.`,
      }],
    }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;
  const text: string = data?.content?.[0]?.text?.trim() ?? "";
  const jsonStr = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
  console.log("[DART CLASSIFY] AI response parsed");
  return JSON.parse(jsonStr);
}

async function getAccountMap(corpCode: string, allItems: DartItem[]): Promise<AccountMap> {
  const cached = accountMapCache.get(corpCode);
  if (cached && Date.now() < cached.expiry) return cached.map;

  const map = await classifyAccounts(allItems);
  accountMapCache.set(corpCode, { map, expiry: Date.now() + 24 * 60 * 60 * 1000 });
  console.log(`[DART CLASSIFY] Cached for ${corpCode}`);
  return map;
}

// ── Extract value by standard key ───────────────────────────

function getByKey(items: DartItem[], accountMap: AccountMap, sjDiv: string, stdKey: string): number | null {
  const divMap = accountMap[sjDiv];
  if (!divMap) return null;
  const accountNm = Object.entries(divMap).find(([, v]) => v === stdKey)?.[0];
  if (!accountNm) return null;
  const item = items.find(i => i.sj_div === sjDiv && i.account_nm === accountNm);
  if (!item?.thstrm_amount) return null;
  return parseDartAmount(item.thstrm_amount);
}

// ── Extract all fields ──────────────────────────────────────

function extractFull(items: DartItem[], accountMap: AccountMap) {
  const f = (sjDiv: string, key: string) => getByKey(items, accountMap, sjDiv, key);

  // P&L
  const revenue = f("IS", "revenue");
  const costOfRevenue = f("IS", "costOfRevenue");
  const grossProfit = f("IS", "grossProfit")
    ?? (revenue != null && costOfRevenue != null ? revenue - costOfRevenue : null);
  const rdExpense = f("IS", "rdExpense");
  const sgaExpense = f("IS", "sgaExpense");
  const operatingIncome = f("IS", "operatingIncome");
  const interestExpense = f("IS", "interestExpense");
  const incomeTaxExpense = f("IS", "incomeTaxExpense");
  const netIncome = f("IS", "netIncome");
  const epsRaw = f("IS", "eps");
  const depreciation = f("CF", "depreciation");
  const amortization = f("CF", "amortization");
  const da = depreciation != null || amortization != null
    ? (depreciation ?? 0) + (amortization ?? 0) : null;
  const ebitda = operatingIncome != null && da != null ? operatingIncome + da : null;

  // B/S
  const totalCurrentAssets = f("BS", "totalCurrentAssets");
  const cash = f("BS", "cash");
  const shortTermInvestments = f("BS", "shortTermInvestments");
  const accountsReceivable = f("BS", "accountsReceivable");
  const inventory = f("BS", "inventory");
  const totalNonCurrentAssets = f("BS", "totalNonCurrentAssets");
  const ppeNet = f("BS", "ppeNet");
  const longTermInvestments = f("BS", "longTermInvestments");
  const goodwill = f("BS", "goodwill");
  const totalAssets = f("BS", "totalAssets");
  const totalCurrentLiabilities = f("BS", "totalCurrentLiabilities");
  const accountPayables = f("BS", "accountPayables");
  const shortTermDebt = f("BS", "shortTermDebt");
  const deferredRevenue = f("BS", "deferredRevenue");
  const totalNonCurrentLiabilities = f("BS", "totalNonCurrentLiabilities");
  const longTermDebt = f("BS", "longTermDebt");
  const totalLiabilities = f("BS", "totalLiabilities");
  const commonStock = f("BS", "commonStock");
  const retainedEarnings = f("BS", "retainedEarnings");
  const totalEquity = f("BS", "totalEquity");

  // C/F
  const operatingCF = f("CF", "operatingCF");
  const investingCF = f("CF", "investingCF");
  const financingCF = f("CF", "financingCF");
  const capex = f("CF", "capex");
  const dividendsPaid = f("CF", "dividendsPaid");

  // Derived
  const totalDebtVal = (shortTermDebt ?? 0) + (longTermDebt ?? 0);
  const hasDebt = shortTermDebt != null || longTermDebt != null;
  const fcf = operatingCF != null && capex != null ? operatingCF + capex : null;

  return {
    revenue, costOfRevenue, grossProfit,
    grossMargin: dartPct(grossProfit, revenue),
    rdExpense,
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

// ── Quarterly cumulative → standalone ───────────────────────

const FLOW_KEYS = [
  "revenue", "costOfRevenue", "grossProfit", "sgaExpense", "operatingIncome",
  "interestExpense", "incomeTaxExpense", "netIncome", "ebitda",
  "operatingCF", "investingCF", "financingCF", "capex", "dividendsPaid",
];

type FullRow = ReturnType<typeof extractFull>;

function quarterStandalone(cumCur: FullRow, cumPrev: FullRow | null): FullRow {
  if (!cumPrev) return cumCur;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = { ...cumCur };
  for (const key of FLOW_KEYS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cur = (cumCur as any)[key] as number | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prev = (cumPrev as any)[key] as number | null;
    if (cur != null && prev != null) result[key] = cur - prev;
  }
  result.grossMargin = dartPct(result.grossProfit, result.revenue);
  result.operatingMargin = dartPct(result.operatingIncome, result.revenue);
  result.netMargin = dartPct(result.netIncome, result.revenue);
  if (result.operatingCF != null && result.capex != null) result.fcf = result.operatingCF + result.capex;
  return result as FullRow;
}

function hasDartData(row: FullRow): boolean {
  return row.revenue != null || row.totalAssets != null;
}

// ── Key Metrics & Valuation from DART ───────────────────────

function r2(v: number | null): number | null {
  return v != null ? Math.round(v * 100) / 100 : null;
}

function computeKeyMetrics(annualRows: (FullRow & { label: string })[]) {
  return annualRows.map(row => ({
    label: row.label,
    roe: r2(dartPct(row.netIncome, row.totalEquity)),
    roic: null as number | null,
    roa: r2(dartPct(row.netIncome, row.totalAssets)),
    fcfYield: null as number | null,
    eps: null as number | null,
    revenuePerShare: null as number | null,
    netIncomePerShare: row.eps,
    interestCoverage: r2(
      row.operatingIncome != null && row.interestExpense != null && row.interestExpense !== 0
        ? row.operatingIncome / Math.abs(row.interestExpense) : null
    ),
    netDebtToEbitda: r2(
      row.netDebt != null && row.ebitda != null && row.ebitda !== 0
        ? row.netDebt / row.ebitda : null
    ),
  }));
}

function computeValuation(
  annualRows: (FullRow & { label: string })[],
  marketCapWon: number | null,
) {
  return annualRows.map((row, i) => {
    const isLatest = i === annualRows.length - 1;
    // Historical valuation needs historical market cap — only compute latest
    if (!isLatest || marketCapWon == null) {
      return {
        label: row.label,
        pe: null as number | null,
        pb: null as number | null,
        evEbitda: null as number | null,
        ps: null as number | null,
        evRevenue: null as number | null,
        peg: null as number | null,
        dividendYield: null as number | null,
      };
    }
    const ev = marketCapWon + (row.netDebt ?? 0);
    return {
      label: row.label,
      pe: r2(row.netIncome != null && row.netIncome !== 0 ? marketCapWon / row.netIncome : null),
      pb: r2(row.totalEquity != null && row.totalEquity !== 0 ? marketCapWon / row.totalEquity : null),
      evEbitda: r2(row.ebitda != null && row.ebitda !== 0 ? ev / row.ebitda : null),
      ps: r2(row.revenue != null && row.revenue !== 0 ? marketCapWon / row.revenue : null),
      evRevenue: r2(row.revenue != null && row.revenue !== 0 ? ev / row.revenue : null),
      peg: null as number | null,
      dividendYield: null as number | null,
    };
  });
}

// ── GET handler ─────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export async function GET(req: NextRequest) {
  try {
    const rawSymbol = req.nextUrl.searchParams.get("symbol") || "";
    const symbol = rawSymbol.replace(/\.(KS|KQ)$/i, "").slice(0, 6);
    const period = req.nextUrl.searchParams.get("period") === "annual" ? "annual" : "quarterly";

    if (!symbol || !/^\d{6}$/.test(symbol)) {
      return NextResponse.json({ ok: false, error: "Valid 6-digit symbol required" }, { status: 400 });
    }

    // ── Check Supabase cache ──
    const cacheKey = `${symbol}_${period}`;
    const { data: cached } = await supabaseAdmin
      .from("dart_cache")
      .select("data, created_at")
      .eq("symbol", symbol)
      .eq("period", period)
      .single();

    if (cached) {
      const age = Date.now() - new Date(cached.created_at).getTime();
      if (age < CACHE_TTL_MS) {
        console.log(`[DART CACHE HIT] ${cacheKey} (age: ${Math.round(age / 60000)}m)`);
        return NextResponse.json({ ok: true, data: cached.data, fromCache: true });
      }
    }

    const corpCode = await getCorpCode(symbol);
    const suffix = `${symbol}.KS`;
    const currentYear = new Date().getFullYear();
    const annualYears = Array.from({ length: 5 }, (_, i) => currentYear - 5 + i);

    // Always fetch: Finnhub quote + profile2, 5 annual reports (for keyMetrics)
    const baseFetches: Promise<unknown>[] = [
      fetchJson(`https://finnhub.io/api/v1/quote?symbol=${suffix}&token=${FINNHUB_KEY}`),
      fetchJson(`https://finnhub.io/api/v1/stock/profile2?symbol=${suffix}&token=${FINNHUB_KEY}`),
      fetchJson(`${FMP_BASE}/quote/${suffix}?apikey=${FMP_KEY}`),
      ...annualYears.map(y => fetchDartFull(corpCode, y, "11011")),
    ];

    // For quarterly, also fetch 2 years × 4 report types
    let qFetches: Promise<DartItem[]>[] = [];
    if (period === "quarterly") {
      const targetYears = [currentYear - 2, currentYear - 1];
      const reportCodes = ["11013", "11012", "11014", "11011"];
      qFetches = targetYears.flatMap(y => reportCodes.map(c => fetchDartFull(corpCode, y, c)));
    }

    const allResults = await Promise.all([...baseFetches, ...qFetches]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finnQuote = allResults[0] as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finnProfile = allResults[1] as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fmpQuote = allResults[2] as any;
    const annualReports = allResults.slice(3, 3 + 5) as DartItem[][];

    // Price & market cap: Finnhub primary, FMP fallback
    const price = finnQuote?.c ?? (Array.isArray(fmpQuote) ? fmpQuote[0]?.price : fmpQuote?.price) ?? null;
    const finnMktCap = finnProfile?.marketCapitalization
      ? finnProfile.marketCapitalization * 1e6 // Finnhub returns millions
      : null;
    const fmpMktCapRaw = Array.isArray(fmpQuote) ? fmpQuote[0]?.marketCap : fmpQuote?.marketCap;
    const marketCapWon: number | null = finnMktCap ?? fmpMktCapRaw ?? null;
    const marketCapOku = marketCapWon ? Math.round(marketCapWon / 1e8) : null;

    // ── Classify accounts via Claude AI ──
    const allDartItems = [
      ...annualReports.flat(),
      ...(period === "quarterly" ? (allResults.slice(3 + 5) as DartItem[][]).flat() : []),
    ];
    const accountMap = await getAccountMap(corpCode, allDartItems);

    // Build annual rows for keyMetrics
    const annualRows = annualReports.map((items, i) => ({
      label: `${annualYears[i]}`,
      ...extractFull(items, accountMap),
    }));
    for (let i = 1; i < annualRows.length; i++) {
      const prev = annualRows[i - 1].revenue;
      const cur = annualRows[i].revenue;
      if (prev != null && cur != null && prev !== 0) {
        annualRows[i].revenueGrowth = Math.round(((cur - prev) / Math.abs(prev)) * 10000) / 100;
      }
    }

    const keyMetrics = computeKeyMetrics(annualRows);
    const valuation = computeValuation(annualRows, marketCapWon);

    if (period === "annual") {
      const responseData = {
        market: "KR",
        ticker: symbol,
        marketCap: marketCapOku,
        price,
        quarterly: annualRows,
        keyMetrics,
        valuation,
      };
      // Store in cache (fire and forget)
      supabaseAdmin.from("dart_cache").upsert(
        { symbol, period, data: responseData, created_at: new Date().toISOString() },
        { onConflict: "symbol,period" }
      ).then(({ error }) => { if (error) console.error("[DART CACHE WRITE]", error); });
      return NextResponse.json({ ok: true, data: responseData, fromCache: false });
    }

    // ── Quarterly: build from cumulative reports ──
    const qReports = allResults.slice(3 + 5) as DartItem[][];
    const targetYears = [currentYear - 2, currentYear - 1];
    const quarters: (FullRow & { label: string })[] = [];

    for (let yi = 0; yi < targetYears.length; yi++) {
      const year = targetYears[yi];
      const base = yi * 4;
      const q1Cum = extractFull(qReports[base], accountMap);
      const h1Cum = extractFull(qReports[base + 1], accountMap);
      const m9Cum = extractFull(qReports[base + 2], accountMap);
      const fyCum = extractFull(qReports[base + 3], accountMap);

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

    const responseData = {
      market: "KR",
      ticker: symbol,
      marketCap: marketCapOku,
      price,
      quarterly: quarters,
      keyMetrics,
      valuation,
    };
    // Store in cache (fire and forget)
    supabaseAdmin.from("dart_cache").upsert(
      { symbol, period, data: responseData, created_at: new Date().toISOString() },
      { onConflict: "symbol,period" }
    ).then(({ error }) => { if (error) console.error("[DART CACHE WRITE]", error); });
    return NextResponse.json({ ok: true, data: responseData, fromCache: false });
  } catch (err) {
    console.error("[FINANCIALS KR ERROR]", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
