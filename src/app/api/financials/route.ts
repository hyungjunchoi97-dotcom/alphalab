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

async function fetchKR(ticker: string) {
  const corpCode = await resolveCorpCode(ticker);
  if (!corpCode) throw new Error(`Corp code not found for ${ticker}`);

  // Quarterly: 4 reports for 2024
  const quarters = [
    { year: 2024, code: "11013", label: "2024 1Q" },
    { year: 2024, code: "11012", label: "2024 2Q" }, // 반기 (cumulative H1)
    { year: 2024, code: "11014", label: "2024 3Q" }, // 3Q cumulative
    { year: 2024, code: "11011", label: "2024 4Q" }, // 사업보고서 (full year)
  ];

  // Parallel: DART IS for each quarter + FMP quote for market data
  const suffix = ticker.length === 6 ? `${ticker}.KS` : ticker;
  const [q1Items, q2Items, q3Items, q4Items, profileJson] = await Promise.all([
    fetchDartIS(corpCode, quarters[0].year, quarters[0].code),
    fetchDartIS(corpCode, quarters[1].year, quarters[1].code),
    fetchDartIS(corpCode, quarters[2].year, quarters[2].code),
    fetchDartIS(corpCode, quarters[3].year, quarters[3].code),
    fetchJson(`${FMP_BASE}/quote/${suffix}?apikey=${FMP_KEY}`),
  ]);

  // Extract cumulative IS data
  const cum1 = extractIS(q1Items); // Q1
  const cum2 = extractIS(q2Items); // H1 (Q1+Q2)
  const cum3 = extractIS(q3Items); // Q1+Q2+Q3
  const cum4 = extractIS(q4Items); // Full year

  // Derive standalone quarterly by subtraction
  const sub = (a: number | null, b: number | null) => (a != null && b != null) ? a - b : null;

  const quarterly = [
    { label: "2024 1Q", revenue: cum1.revenue, operatingIncome: cum1.operatingIncome, netIncome: cum1.netIncome },
    { label: "2024 2Q", revenue: sub(cum2.revenue, cum1.revenue), operatingIncome: sub(cum2.operatingIncome, cum1.operatingIncome), netIncome: sub(cum2.netIncome, cum1.netIncome) },
    { label: "2024 3Q", revenue: sub(cum3.revenue, cum2.revenue), operatingIncome: sub(cum3.operatingIncome, cum2.operatingIncome), netIncome: sub(cum3.netIncome, cum2.netIncome) },
    { label: "2024 4Q", revenue: sub(cum4.revenue, cum3.revenue), operatingIncome: sub(cum4.operatingIncome, cum3.operatingIncome), netIncome: sub(cum4.netIncome, cum3.netIncome) },
  ];

  // Market data from FMP
  const quote = Array.isArray(profileJson) ? profileJson[0] : profileJson;
  const marketCap = quote?.marketCap ? Math.round(quote.marketCap / 1e8) : null; // 억원
  const price = quote?.price ?? null;

  return {
    market: "KR" as const,
    ticker,
    marketCap,
    price,
    quarterly,
  };
}

// ── FMP (US) ────────────────────────────────────────────────

async function fetchUS(ticker: string) {
  const [isData, profileData] = await Promise.all([
    fetchJson(`${FMP_BASE}/income-statement?symbol=${ticker}&period=quarter&limit=4&apikey=${FMP_KEY}`),
    fetchJson(`${FMP_BASE}/profile?symbol=${ticker}&apikey=${FMP_KEY}`),
  ]);

  console.log('[FMP IS RAW]', JSON.stringify(isData).slice(0, 500));
  console.log('[FMP PROFILE RAW]', JSON.stringify(profileData).slice(0, 500));

  const statements = Array.isArray(isData) ? isData : [];
  const profile = Array.isArray(profileData) ? profileData[0] : profileData;

  const quarterly = statements.map((s: {
    period: string;
    calendarYear: string;
    fiscalYear?: string;
    revenue: number;
    operatingIncome: number;
    netIncome: number;
  }) => ({
    label: `${s.fiscalYear ?? s.calendarYear} ${s.period}`,
    revenue: s.revenue ? Math.round(s.revenue / 1e6) : null,
    operatingIncome: s.operatingIncome ? Math.round(s.operatingIncome / 1e6) : null,
    netIncome: s.netIncome ? Math.round(s.netIncome / 1e6) : null,
  })).reverse(); // oldest first

  const rawMktCap = profile?.marketCap ?? profile?.mktCap;
  const marketCap = rawMktCap ? Math.round(rawMktCap / 1e6) : null; // $M
  const price = profile?.price ?? null;

  return {
    market: "US" as const,
    ticker,
    marketCap,
    price,
    quarterly,
  };
}

// ── GET handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const rawTicker = req.nextUrl.searchParams.get("ticker") || "";
    const ticker = rawTicker.replace(/\.(KS|KQ)$/i, "");
    const market = (req.nextUrl.searchParams.get("market") || "US").toUpperCase();

    if (!ticker) {
      return NextResponse.json({ ok: false, error: "ticker required" }, { status: 400 });
    }

    const data = market === "KR" ? await fetchKR(ticker) : await fetchUS(ticker);

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[FINANCIALS ERROR]", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
