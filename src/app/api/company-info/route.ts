import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const FMP_KEY = process.env.FMP_API_KEY || "";

interface NaverNewsItem {
  articleId?: string;
  officeId?: string;
  title?: string;
  datetime?: string;
  wpdatetime?: string;
}

async function fetchKR(symbol: string) {
  const fmpSymbol = `${symbol}.KS`;

  const [profileRes, newsRes] = await Promise.allSettled([
    fetch(
      `https://financialmodelingprep.com/stable/profile?symbol=${encodeURIComponent(fmpSymbol)}&apikey=${FMP_KEY}`,
      { signal: AbortSignal.timeout(8000) },
    ).then((r) => r.json()),
    fetch(
      `https://m.stock.naver.com/api/news/stock/${encodeURIComponent(symbol)}?pageSize=5`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(8000),
      },
    ).then((r) => r.json()),
  ]);

  // Profile from FMP
  const profileJson = profileRes.status === "fulfilled" ? profileRes.value : null;
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
    news = allItems.slice(0, 5).map((n) => {
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
      `https://financialmodelingprep.com/stable/news/stock?symbols=${encodeURIComponent(symbol)}&limit=5&apikey=${FMP_KEY}`,
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

  const news = (Array.isArray(newsJson) ? newsJson : []).slice(0, 5).map(
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
