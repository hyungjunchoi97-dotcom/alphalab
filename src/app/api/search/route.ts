import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

// ── Hardcoded popular stocks fallback ─────────────────────────

interface StockEntry extends SearchResult {
  koreanName: string;
}

const POPULAR_STOCKS: StockEntry[] = [
  // KR
  { symbol: "005930.KS", name: "Samsung Electronics", koreanName: "삼성전자", exchange: "KRX", type: "Stock" },
  { symbol: "000660.KS", name: "SK Hynix", koreanName: "SK하이닉스", exchange: "KRX", type: "Stock" },
  { symbol: "035420.KS", name: "Naver", koreanName: "네이버", exchange: "KRX", type: "Stock" },
  { symbol: "035720.KS", name: "Kakao", koreanName: "카카오", exchange: "KRX", type: "Stock" },
  { symbol: "051910.KS", name: "LG Chem", koreanName: "LG화학", exchange: "KRX", type: "Stock" },
  { symbol: "006400.KS", name: "Samsung SDI", koreanName: "삼성SDI", exchange: "KRX", type: "Stock" },
  { symbol: "068270.KS", name: "Celltrion", koreanName: "셀트리온", exchange: "KRX", type: "Stock" },
  { symbol: "003670.KS", name: "Posco Holdings", koreanName: "포스코홀딩스", exchange: "KRX", type: "Stock" },
  { symbol: "105560.KS", name: "KB Financial Group", koreanName: "KB금융", exchange: "KRX", type: "Stock" },
  { symbol: "055550.KS", name: "Shinhan Financial Group", koreanName: "신한지주", exchange: "KRX", type: "Stock" },
  { symbol: "012330.KS", name: "Hyundai Mobis", koreanName: "현대모비스", exchange: "KRX", type: "Stock" },
  { symbol: "005380.KS", name: "Hyundai Motor", koreanName: "현대차", exchange: "KRX", type: "Stock" },
  { symbol: "066570.KS", name: "LG Electronics", koreanName: "LG전자", exchange: "KRX", type: "Stock" },
  { symbol: "003550.KS", name: "LG", koreanName: "LG", exchange: "KRX", type: "Stock" },
  { symbol: "034730.KS", name: "SK", koreanName: "SK", exchange: "KRX", type: "Stock" },
  // US
  { symbol: "AAPL", name: "Apple Inc", koreanName: "애플", exchange: "NASDAQ", type: "Stock" },
  { symbol: "MSFT", name: "Microsoft Corp", koreanName: "마이크로소프트", exchange: "NASDAQ", type: "Stock" },
  { symbol: "GOOGL", name: "Alphabet Inc", koreanName: "알파벳(구글)", exchange: "NASDAQ", type: "Stock" },
  { symbol: "AMZN", name: "Amazon.com Inc", koreanName: "아마존", exchange: "NASDAQ", type: "Stock" },
  { symbol: "NVDA", name: "NVIDIA Corp", koreanName: "엔비디아", exchange: "NASDAQ", type: "Stock" },
  { symbol: "META", name: "Meta Platforms Inc", koreanName: "메타(페이스북)", exchange: "NASDAQ", type: "Stock" },
  { symbol: "TSLA", name: "Tesla Inc", koreanName: "테슬라", exchange: "NASDAQ", type: "Stock" },
  { symbol: "BRK.B", name: "Berkshire Hathaway", koreanName: "버크셔해서웨이", exchange: "NYSE", type: "Stock" },
  { symbol: "JPM", name: "JPMorgan Chase & Co", koreanName: "JP모건", exchange: "NYSE", type: "Stock" },
  { symbol: "V", name: "Visa Inc", koreanName: "비자", exchange: "NYSE", type: "Stock" },
  { symbol: "UNH", name: "UnitedHealth Group", koreanName: "유나이티드헬스", exchange: "NYSE", type: "Stock" },
  { symbol: "MA", name: "Mastercard Inc", koreanName: "마스터카드", exchange: "NYSE", type: "Stock" },
  { symbol: "HD", name: "Home Depot Inc", koreanName: "홈디포", exchange: "NYSE", type: "Stock" },
  { symbol: "DIS", name: "Walt Disney Co", koreanName: "디즈니", exchange: "NYSE", type: "Stock" },
  { symbol: "AMD", name: "Advanced Micro Devices", koreanName: "AMD", exchange: "NASDAQ", type: "Stock" },
  { symbol: "NFLX", name: "Netflix Inc", koreanName: "넷플릭스", exchange: "NASDAQ", type: "Stock" },
  { symbol: "COST", name: "Costco Wholesale", koreanName: "코스트코", exchange: "NASDAQ", type: "Stock" },
  { symbol: "CRM", name: "Salesforce Inc", koreanName: "세일즈포스", exchange: "NYSE", type: "Stock" },
  { symbol: "AVGO", name: "Broadcom Inc", koreanName: "브로드컴", exchange: "NASDAQ", type: "Stock" },
  { symbol: "INTC", name: "Intel Corp", koreanName: "인텔", exchange: "NASDAQ", type: "Stock" },
  // JP
  { symbol: "7203.T", name: "Toyota Motor", koreanName: "토요타", exchange: "TSE", type: "Stock" },
  { symbol: "6758.T", name: "Sony Group", koreanName: "소니", exchange: "TSE", type: "Stock" },
  { symbol: "6861.T", name: "Keyence", koreanName: "키엔스", exchange: "TSE", type: "Stock" },
  { symbol: "9984.T", name: "SoftBank Group", koreanName: "소프트뱅크", exchange: "TSE", type: "Stock" },
  { symbol: "8306.T", name: "Mitsubishi UFJ Financial", koreanName: "미쓰비시UFJ", exchange: "TSE", type: "Stock" },
  // Commodities
  { symbol: "GC=F", name: "Gold Futures", koreanName: "금 선물", exchange: "CME", type: "Commodity" },
  { symbol: "CL=F", name: "Crude Oil Futures", koreanName: "원유 선물", exchange: "CME", type: "Commodity" },
  { symbol: "BTC-USD", name: "Bitcoin USD", koreanName: "비트코인", exchange: "CCC", type: "Crypto" },
  { symbol: "ETH-USD", name: "Ethereum USD", koreanName: "이더리움", exchange: "CCC", type: "Crypto" },
];

function localSearch(q: string): SearchResult[] {
  const lower = q.toLowerCase();
  return POPULAR_STOCKS.filter(
    (s) =>
      s.symbol.toLowerCase().includes(lower) ||
      s.name.toLowerCase().includes(lower) ||
      s.koreanName.toLowerCase().includes(lower)
  ).slice(0, 10);
}

// ── Finnhub search ────────────────────────────────────────────

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || "";

async function finnhubSearch(q: string): Promise<SearchResult[]> {
  if (!FINNHUB_KEY) return [];
  try {
    const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${FINNHUB_KEY}`;
    const res = await fetch(url, { headers: { "User-Agent": "project-stockmarket/1.0" } });
    if (!res.ok) return [];
    const json = await res.json();
    if (!json.result || !Array.isArray(json.result)) return [];
    return json.result.slice(0, 10).map((item: Record<string, unknown>) => ({
      symbol: String(item.symbol ?? ""),
      name: String(item.description ?? ""),
      exchange: String(item.displaySymbol ?? item.symbol ?? ""),
      type: String(item.type ?? "Stock"),
    }));
  } catch {
    return [];
  }
}

// ── Route handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (!q || q.length < 1) {
    return NextResponse.json({ ok: true, results: [] });
  }

  // Try Finnhub first, fall back to local
  let results = await finnhubSearch(q);
  if (results.length === 0) {
    results = localSearch(q);
  }

  return NextResponse.json({ ok: true, results }, {
    headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" },
  });
}
