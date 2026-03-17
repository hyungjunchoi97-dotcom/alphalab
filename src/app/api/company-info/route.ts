import { NextRequest, NextResponse } from "next/server";
import dartMapping from "@/data/dart-corp-mapping.json";

export const runtime = "nodejs";

const FMP_KEY = process.env.FMP_API_KEY || "";
const DART_KEY = process.env.DART_API_KEY || "";

const dartMap = dartMapping as Record<string, { corp_code: string; corp_name: string }>;

interface NaverNewsItem {
  articleId?: string;
  officeId?: string;
  title?: string;
  datetime?: string;
  wpdatetime?: string;
}

interface DartCompany {
  status: string;
  corp_name?: string;
  induty_code?: string;
  ceo_nm?: string;
  est_dt?: string;
  listing_dt?: string;
  hm_url?: string;
  adres?: string;
}

async function fetchDartProfile(stockCode: string) {
  const entry = dartMap[stockCode];
  if (!entry || !DART_KEY) return null;

  try {
    const url = `https://opendart.fss.or.kr/api/company.json?crtfc_key=${DART_KEY}&corp_code=${entry.corp_code}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data: DartCompany = await res.json();
    if (data.status !== "000" || !data.corp_name) return null;

    return {
      companyName: data.corp_name || "",
      industry: data.induty_code || "",
      ceo: data.ceo_nm || "",
      foundedDate: data.est_dt || "",
      ipoDate: data.listing_dt || "",
      website: data.hm_url || "",
      address: data.adres || "",
    };
  } catch {
    return null;
  }
}

async function fetchKR(symbol: string) {
  const fmpSymbol = `${symbol}.KS`;

  // Fetch DART profile, FMP profile (fallback), and Naver news in parallel
  const [dartRes, fmpRes, newsRes] = await Promise.allSettled([
    fetchDartProfile(symbol),
    fetch(
      `https://financialmodelingprep.com/stable/profile?symbol=${encodeURIComponent(fmpSymbol)}&apikey=${FMP_KEY}`,
      { signal: AbortSignal.timeout(8000) },
    ).then((r) => r.json()),
    fetch(
      `https://m.stock.naver.com/api/news/stock/${encodeURIComponent(symbol)}?pageSize=10`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(8000),
      },
    ).then((r) => r.json()),
  ]);

  // Profile from DART (primary) or FMP (fallback)
  const dartProfile = dartRes.status === "fulfilled" ? dartRes.value : null;

  let profile;
  if (dartProfile) {
    profile = {
      companyName: dartProfile.companyName,
      industry: dartProfile.industry,
      ceo: dartProfile.ceo,
      foundedDate: dartProfile.foundedDate,
      ipoDate: dartProfile.ipoDate,
      website: dartProfile.website,
      address: dartProfile.address,
    };
  } else {
    // Fallback to FMP
    const profileJson = fmpRes.status === "fulfilled" ? fmpRes.value : null;
    const p = Array.isArray(profileJson) ? profileJson[0] : null;
    profile = p
      ? {
          description: p.description || "",
          sector: p.sector || "",
          industry: p.industry || "",
          ceo: p.ceo || "",
          fullTimeEmployees: p.fullTimeEmployees ?? null,
          website: p.website || "",
          country: p.country || "",
        }
      : null;
  }

  // News from Naver
  let news: { title: string; url: string; publishedDate: string }[] = [];
  if (newsRes.status === "fulfilled") {
    const naverData = newsRes.value;
    // Naver returns [{total, items: [...]}, ...] — flatten all items
    let allItems: NaverNewsItem[] = [];
    if (Array.isArray(naverData)) {
      for (const group of naverData) {
        if (group?.items && Array.isArray(group.items)) {
          allItems.push(...group.items);
        } else if (group?.articleId) {
          allItems.push(group);
        }
      }
    }
    if (allItems.length === 0 && naverData?.items) {
      allItems = naverData.items;
    }
    news = allItems.slice(0, 10).map((n) => {
      const dt = n.datetime || n.wpdatetime || "";
      // wpdatetime format: yyyyMMddHHmmss → ISO
      let publishedDate = "";
      if (dt.length >= 8) {
        publishedDate = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
        if (dt.length >= 12) {
          publishedDate += `T${dt.slice(8, 10)}:${dt.slice(10, 12)}`;
          if (dt.length >= 14) publishedDate += `:${dt.slice(12, 14)}`;
        }
      }
      const url =
        n.officeId && n.articleId
          ? `https://n.news.naver.com/article/${n.officeId}/${n.articleId}`
          : "";
      return {
        title: n.title || "",
        url,
        publishedDate,
      };
    }).filter((n) => n.title);
  }

  return { profile, news };
}

async function fetchUS(symbol: string) {
  const [profileRes, newsRes] = await Promise.all([
    fetch(
      `https://financialmodelingprep.com/stable/profile?symbol=${encodeURIComponent(symbol)}&apikey=${FMP_KEY}`,
      { signal: AbortSignal.timeout(8000) },
    ),
    fetch(
      `https://financialmodelingprep.com/stable/news/stock?symbols=${encodeURIComponent(symbol)}&limit=10&apikey=${FMP_KEY}`,
      { signal: AbortSignal.timeout(8000) },
    ),
  ]);

  const [profileJson, newsJson] = await Promise.all([profileRes.json(), newsRes.json()]);

  const p = Array.isArray(profileJson) ? profileJson[0] : null;
  const profile = p
    ? {
        description: p.description || "",
        sector: p.sector || "",
        industry: p.industry || "",
        ceo: p.ceo || "",
        fullTimeEmployees: p.fullTimeEmployees ?? null,
        website: p.website || "",
        country: p.country || "",
      }
    : null;

  const news = (Array.isArray(newsJson) ? newsJson : []).slice(0, 10).map(
    (n: { title?: string; url?: string; publishedDate?: string }) => ({
      title: n.title || "",
      url: n.url || "",
      publishedDate: n.publishedDate || "",
    }),
  );

  return { profile, news };
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  const market = req.nextUrl.searchParams.get("market") || "us";

  if (!symbol) {
    return NextResponse.json({ ok: false, error: "symbol required" }, { status: 400 });
  }

  try {
    const result = market === "kr" ? await fetchKR(symbol) : await fetchUS(symbol);

    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
