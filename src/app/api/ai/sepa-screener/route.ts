import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── Types ──────────────────────────────────────────────────────
interface ScreenerResult {
  symbol: string;
  name: string;
  market: "KR" | "US";
  price: number;
  change_pct: number;
  score: number;
  stage: "STAGE_2";
  base_depth_pct: number;
  weeks_in_base: number;
  volume_ratio: number;
  dist_from_52w_high_pct: number;
  ma_alignment: boolean;
}

// ── In-memory cache ────────────────────────────────────────────
const cache: Record<string, { data: ScreenerResult[]; ts: number }> = {};
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

// ── KR Top 200 symbols (KOSPI + KOSDAQ major caps) ─────────────
const KR_SYMBOLS: [string, string][] = [
  ["005930.KS", "삼성전자"], ["000660.KS", "SK하이닉스"], ["373220.KS", "LG에너지솔루션"],
  ["207940.KS", "삼성바이오로직스"], ["005935.KS", "삼성전자우"], ["006400.KS", "삼성SDI"],
  ["051910.KS", "LG화학"], ["005380.KS", "현대차"], ["000270.KS", "기아"],
  ["035420.KS", "NAVER"], ["035720.KS", "카카오"], ["105560.KS", "KB금융"],
  ["055550.KS", "신한지주"], ["096770.KS", "SK이노베이션"], ["003670.KS", "포스코퓨처엠"],
  ["028260.KS", "삼성물산"], ["012330.KS", "현대모비스"], ["066570.KS", "LG전자"],
  ["003550.KS", "LG"], ["032830.KS", "삼성생명"], ["086790.KS", "하나금융지주"],
  ["034730.KS", "SK"], ["316140.KS", "우리금융지주"], ["015760.KS", "한국전력"],
  ["009150.KS", "삼성전기"], ["010130.KS", "고려아연"], ["033780.KS", "KT&G"],
  ["000810.KS", "삼성화재"], ["018260.KS", "삼성에스디에스"], ["017670.KS", "SK텔레콤"],
  ["030200.KS", "KT"], ["034020.KS", "두산에너빌리티"], ["003490.KS", "대한항공"],
  ["010950.KS", "S-Oil"], ["011200.KS", "HMM"], ["259960.KS", "크래프톤"],
  ["009540.KS", "한국조선해양"], ["036570.KS", "엔씨소프트"], ["010140.KS", "삼성중공업"],
  ["323410.KS", "카카오뱅크"], ["352820.KS", "하이브"], ["047050.KS", "포스코인터내셔널"],
  ["138040.KS", "메리츠금융지주"], ["329180.KS", "현대중공업"], ["267260.KS", "HD현대"],
  ["024110.KS", "기업은행"], ["377300.KS", "카카오페이"], ["090430.KS", "아모레퍼시픽"],
  ["051900.KS", "LG생활건강"], ["069500.KS", "KODEX 200"], ["000720.KS", "현대건설"],
  ["011170.KS", "롯데케미칼"], ["034220.KS", "LG디스플레이"], ["068270.KS", "셀트리온"],
  ["302440.KS", "SK바이오사이언스"], ["004020.KS", "현대제철"], ["009240.KS", "한샘"],
  ["180640.KS", "한진칼"], ["161390.KS", "한국타이어앤테크놀로지"], ["047810.KS", "한국항공우주"],
  ["010620.KS", "현대미포조선"], ["042700.KS", "한미반도체"], ["006800.KS", "미래에셋증권"],
  ["128940.KS", "한미약품"], ["000100.KS", "유한양행"], ["003410.KS", "쌍용C&E"],
  ["326030.KS", "SK바이오팜"], ["011790.KS", "SKC"], ["028050.KS", "삼성엔지니어링"],
  ["241560.KS", "두산밥캣"], ["007070.KS", "GS리테일"], ["006360.KS", "GS건설"],
  ["000990.KS", "DB하이텍"], ["402340.KS", "SK스퀘어"], ["361610.KS", "SK아이이테크놀로지"],
  ["271560.KS", "오리온"], ["088980.KS", "맥쿼리인프라"], ["035250.KS", "강원랜드"],
  ["016360.KS", "삼성증권"], ["139480.KS", "이마트"], ["078930.KS", "GS"],
  ["021240.KS", "코웨이"], ["097950.KS", "CJ제일제당"], ["307950.KS", "현대오토에버"],
  ["298020.KS", "효성티앤씨"], ["004170.KS", "신세계"], ["002790.KS", "아모레G"],
  ["272210.KS", "한화시스템"], ["042660.KS", "한화오션"], ["004990.KS", "롯데지주"],
  ["086280.KS", "현대글로비스"], ["005490.KS", "POSCO홀딩스"], ["006260.KS", "LS"],
  ["011070.KS", "LG이노텍"], ["001570.KS", "금양"], ["003230.KS", "삼양식품"],
  ["138930.KS", "BNK금융지주"], ["192820.KS", "코스모신소재"], ["003090.KS", "대웅제약"],
  ["247540.KS", "에코프로비엠"], ["383220.KS", "F&F"], ["112610.KS", "씨에스윈드"],
  // KOSDAQ majors
  ["247540.KQ", "에코프로비엠"], ["091990.KQ", "셀트리온헬스케어"], ["196170.KQ", "알테오젠"],
  ["068760.KQ", "셀트리온제약"], ["263750.KQ", "펄어비스"], ["293490.KQ", "카카오게임즈"],
  ["145020.KQ", "휴젤"], ["357780.KQ", "솔브레인"], ["086520.KQ", "에코프로"],
  ["041510.KQ", "에스엠"], ["035900.KQ", "JYP Ent."], ["235980.KQ", "메드팩토"],
  ["328130.KQ", "루닛"], ["039030.KQ", "이오테크닉스"], ["058470.KQ", "리노공업"],
  ["022100.KQ", "포스코DX"], ["060310.KQ", "3S"], ["095340.KQ", "ISC"],
  ["067630.KQ", "HLB생명과학"], ["028300.KQ", "HLB"], ["009520.KQ", "포스코엠텍"],
  ["141080.KQ", "레고켐바이오"], ["950160.KQ", "코오롱티슈진"], ["064760.KQ", "티씨케이"],
  ["340570.KQ", "티앤엘"], ["048410.KQ", "현대바이오"], ["078340.KQ", "컴투스"],
  ["222080.KQ", "씨아이에스"], ["140410.KQ", "메지온"], ["214150.KQ", "클래시스"],
  ["336260.KQ", "두산테스나"], ["299030.KQ", "하나마이크론"], ["403870.KQ", "HPSP"],
  ["166090.KQ", "사이맥스"], ["377480.KQ", "SKIET"], ["083310.KQ", "엘오티베큠"],
  ["043150.KQ", "바텍"], ["237690.KQ", "에스티팜"], ["131970.KQ", "테스나"],
  ["240810.KQ", "원익IPS"], ["290650.KQ", "엘앤씨바이오"], ["950170.KQ", "JTC"],
  ["394280.KQ", "오픈엣지테크놀로지"], ["226330.KQ", "신테카바이오"], ["052770.KQ", "아이톡시"],
];

// ── US S&P500 + NASDAQ100 top symbols ──────────────────────────
const US_SYMBOLS: [string, string][] = [
  ["AAPL", "Apple"], ["MSFT", "Microsoft"], ["GOOGL", "Alphabet"], ["AMZN", "Amazon"],
  ["NVDA", "NVIDIA"], ["META", "Meta Platforms"], ["TSLA", "Tesla"], ["BRK-B", "Berkshire Hathaway"],
  ["UNH", "UnitedHealth"], ["JNJ", "Johnson & Johnson"], ["XOM", "Exxon Mobil"],
  ["JPM", "JPMorgan Chase"], ["V", "Visa"], ["PG", "Procter & Gamble"], ["MA", "Mastercard"],
  ["AVGO", "Broadcom"], ["HD", "Home Depot"], ["CVX", "Chevron"], ["MRK", "Merck"],
  ["ABBV", "AbbVie"], ["LLY", "Eli Lilly"], ["PEP", "PepsiCo"], ["KO", "Coca-Cola"],
  ["COST", "Costco"], ["ADBE", "Adobe"], ["WMT", "Walmart"], ["MCD", "McDonald's"],
  ["CSCO", "Cisco"], ["CRM", "Salesforce"], ["ACN", "Accenture"], ["ABT", "Abbott"],
  ["TMO", "Thermo Fisher"], ["DHR", "Danaher"], ["LIN", "Linde"], ["NFLX", "Netflix"],
  ["AMD", "AMD"], ["ORCL", "Oracle"], ["TXN", "Texas Instruments"], ["PM", "Philip Morris"],
  ["INTC", "Intel"], ["QCOM", "Qualcomm"], ["UPS", "UPS"], ["INTU", "Intuit"],
  ["LOW", "Lowe's"], ["AMGN", "Amgen"], ["SPGI", "S&P Global"], ["BA", "Boeing"],
  ["CAT", "Caterpillar"], ["GS", "Goldman Sachs"], ["BLK", "BlackRock"], ["AXP", "American Express"],
  ["DE", "Deere"], ["RTX", "RTX Corp"], ["ISRG", "Intuitive Surgical"], ["GILD", "Gilead"],
  ["MDLZ", "Mondelez"], ["SYK", "Stryker"], ["BKNG", "Booking Holdings"], ["ADI", "Analog Devices"],
  ["VRTX", "Vertex Pharma"], ["REGN", "Regeneron"], ["LRCX", "Lam Research"], ["AMAT", "Applied Materials"],
  ["PANW", "Palo Alto Networks"], ["KLAC", "KLA Corp"], ["SNPS", "Synopsys"], ["CDNS", "Cadence"],
  ["MRVL", "Marvell Tech"], ["FTNT", "Fortinet"], ["ABNB", "Airbnb"], ["CRWD", "CrowdStrike"],
  ["DDOG", "Datadog"], ["ZS", "Zscaler"], ["SNOW", "Snowflake"], ["NET", "Cloudflare"],
  ["WDAY", "Workday"], ["TEAM", "Atlassian"], ["MNST", "Monster Beverage"], ["ODFL", "Old Dominion"],
  ["CPRT", "Copart"], ["PCAR", "PACCAR"], ["FANG", "Diamondback Energy"], ["MCHP", "Microchip"],
  ["ON", "ON Semi"], ["GEV", "GE Vernova"], ["SMCI", "Super Micro"], ["ARM", "Arm Holdings"],
  ["PLTR", "Palantir"], ["COIN", "Coinbase"], ["MELI", "MercadoLibre"], ["SQ", "Block"],
  ["SHOP", "Shopify"], ["UBER", "Uber"], ["DASH", "DoorDash"], ["RBLX", "Roblox"],
  ["TTD", "Trade Desk"], ["ENPH", "Enphase"], ["SEDG", "SolarEdge"], ["RIVN", "Rivian"],
  ["LCID", "Lucid"], ["NIO", "NIO"], ["XPEV", "XPeng"], ["LI", "Li Auto"],
  ["SOFI", "SoFi"], ["HOOD", "Robinhood"], ["U", "Unity"], ["ROKU", "Roku"],
  ["PATH", "UiPath"], ["MDB", "MongoDB"], ["BILL", "BILL Holdings"], ["HUBS", "HubSpot"],
  ["VEEV", "Veeva Systems"], ["ANSS", "ANSYS"], ["SPLK", "Splunk"], ["FICO", "Fair Isaac"],
  ["NOW", "ServiceNow"], ["LULU", "Lululemon"], ["NKE", "Nike"], ["SBUX", "Starbucks"],
  ["CMG", "Chipotle"], ["YUM", "Yum Brands"], ["DPZ", "Domino's"], ["EL", "Estee Lauder"],
  ["GM", "General Motors"], ["F", "Ford"], ["LMT", "Lockheed Martin"], ["NOC", "Northrop Grumman"],
  ["GD", "General Dynamics"], ["WM", "Waste Management"], ["RSG", "Republic Services"],
  ["PLD", "Prologis"], ["AMT", "American Tower"], ["CCI", "Crown Castle"],
  ["EQIX", "Equinix"], ["PSA", "Public Storage"], ["O", "Realty Income"],
  ["DLR", "Digital Realty"], ["WELL", "Welltower"], ["SPG", "Simon Property"],
  ["NEE", "NextEra Energy"], ["SO", "Southern Co"], ["DUK", "Duke Energy"],
  ["AEP", "American Electric"], ["D", "Dominion Energy"], ["SRE", "Sempra"],
  ["ICE", "Intercontinental Exchange"], ["CME", "CME Group"], ["SCHW", "Charles Schwab"],
  ["MS", "Morgan Stanley"], ["C", "Citigroup"], ["BAC", "Bank of America"],
  ["WFC", "Wells Fargo"], ["USB", "U.S. Bancorp"], ["PNC", "PNC Financial"],
  ["TFC", "Truist Financial"], ["PYPL", "PayPal"], ["FIS", "Fidelity NIS"],
  ["ADP", "ADP"], ["PAYX", "Paychex"], ["MSCI", "MSCI"], ["MCO", "Moody's"],
  ["APD", "Air Products"], ["ECL", "Ecolab"], ["SHW", "Sherwin-Williams"],
  ["DD", "DuPont"], ["DOW", "Dow"], ["FCX", "Freeport-McMoRan"],
  ["NEM", "Newmont"], ["GOLD", "Barrick Gold"],
  ["MMM", "3M"], ["HON", "Honeywell"], ["EMR", "Emerson"], ["ITW", "Illinois Tool Works"],
  ["ETN", "Eaton"], ["PH", "Parker Hannifin"], ["ROK", "Rockwell"], ["AME", "AMETEK"],
  ["GE", "GE Aerospace"], ["CARR", "Carrier Global"], ["OTIS", "Otis Worldwide"],
  ["CTAS", "Cintas"], ["FAST", "Fastenal"], ["AZO", "AutoZone"], ["ORLY", "O'Reilly Auto"],
  ["GWW", "Grainger"], ["EW", "Edwards Lifesciences"], ["BSX", "Boston Scientific"],
  ["MDT", "Medtronic"], ["ZBH", "Zimmer Biomet"], ["DXCM", "Dexcom"],
  ["IDXX", "IDEXX"], ["IQV", "IQVIA"], ["A", "Agilent"], ["WAT", "Waters"],
  ["BIO", "Bio-Rad"], ["TER", "Teradyne"], ["MPWR", "Monolithic Power"],
  ["SWKS", "Skyworks"], ["NXPI", "NXP Semi"], ["MU", "Micron"],
  ["WDC", "Western Digital"], ["STX", "Seagate"], ["HPE", "Hewlett Packard Enterprise"],
  ["HPQ", "HP Inc"], ["DELL", "Dell"], ["ANET", "Arista Networks"],
];

// ── Yahoo Finance data fetcher ─────────────────────────────────
interface DailyBar {
  date: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

async function fetchChart(symbol: string): Promise<DailyBar[]> {
  const now = Math.floor(Date.now() / 1000);
  const sixMonthsAgo = now - 180 * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${sixMonthsAgo}&period2=${now}&interval=1d`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    clearTimeout(timeout);

    if (!res.ok) return [];
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return [];

    const timestamps = result.timestamp || [];
    const q = result.indicators?.quote?.[0];
    if (!q) return [];

    const bars: DailyBar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (q.close?.[i] != null && q.volume?.[i] != null) {
        bars.push({
          date: timestamps[i],
          open: q.open?.[i] ?? q.close[i],
          high: q.high?.[i] ?? q.close[i],
          low: q.low?.[i] ?? q.close[i],
          close: q.close[i],
          volume: q.volume[i],
        });
      }
    }
    return bars;
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

// ── Screening logic ────────────────────────────────────────────
function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function screenStock(
  symbol: string,
  name: string,
  market: "KR" | "US",
  bars: DailyBar[],
  indexBars: DailyBar[]
): ScreenerResult | null {
  if (bars.length < 150) return null;

  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const n = closes.length;
  const price = closes[n - 1];

  // ── FILTER 1: Stage 2 (Weinstein) ──
  const ma150 = avg(closes.slice(-150));
  if (price <= ma150) return null;
  // 150-day MA slope positive
  const ma150_20ago = avg(closes.slice(-170, -20));
  if (ma150 <= ma150_20ago) return null;

  // ── FILTER 2: 52-week position ──
  const lookback = Math.min(n, 252);
  const high52w = Math.max(...highs.slice(-lookback));
  const low52w = Math.min(...lows.slice(-lookback));
  const distFromHigh = (high52w - price) / high52w;
  const distFromLow = (price - low52w) / low52w;
  if (distFromHigh > 0.25) return null; // within 25% of high
  if (distFromLow < 0.30) return null; // at least 30% above low

  // ── FILTER 3: Base formation ──
  const baseDays = 50; // ~10 weeks
  const baseSlice = closes.slice(-baseDays);
  const baseHigh = Math.max(...baseSlice);
  const baseLow = Math.min(...baseSlice);
  const baseDepth = (baseHigh - baseLow) / baseHigh;
  if (baseDepth > 0.20) return null; // tight base < 20%
  // Not making new highs in last 15 trading days (still basing)
  const recentHigh = Math.max(...highs.slice(-15));
  if (recentHigh >= high52w) return null;

  // ── FILTER 4: Volume contraction ──
  const vol10 = avg(volumes.slice(-10));
  const vol50 = avg(volumes.slice(-50));
  const volRatio = vol50 > 0 ? vol10 / vol50 : 1;
  if (volRatio >= 1.0) return null; // volume should be drying up

  // ── FILTER 5: MA alignment ──
  const ma50 = avg(closes.slice(-50));
  const ma200 = n >= 200 ? avg(closes.slice(-200)) : ma150;
  if (!(ma50 > ma150 && ma150 > ma200)) return null;

  // ── SCORING (0-10) ──
  let score = 0;
  // +2: within 10% of 52w high
  if (distFromHigh <= 0.10) score += 2;
  // +2: base tighter than 10%
  if (baseDepth < 0.10) score += 2;
  // +2: volume contraction > 0.7 (very dry)
  if (volRatio < 0.7) score += 2;
  // +2: all MAs rising
  const ma50_20ago = avg(closes.slice(-70, -20));
  const ma200_20ago = n >= 220 ? avg(closes.slice(-220, -20)) : ma150_20ago;
  if (ma50 > ma50_20ago && ma150 > ma150_20ago && ma200 > ma200_20ago) score += 2;
  // +1: RS positive (stock outperforming index over 3 months)
  if (indexBars.length >= 63 && bars.length >= 63) {
    const stockReturn = (closes[n - 1] - closes[n - 63]) / closes[n - 63];
    const idxCloses = indexBars.map((b) => b.close);
    const idxN = idxCloses.length;
    const idxReturn = (idxCloses[idxN - 1] - idxCloses[idxN - 63]) / idxCloses[idxN - 63];
    if (stockReturn > idxReturn) score += 1;
  }
  // +1: price above 50-day MA with MA rising
  if (price > ma50 && ma50 > ma50_20ago) score += 1;

  // Calculate weeks in base
  let weeksInBase = 0;
  for (let i = n - 1; i >= Math.max(0, n - 100); i--) {
    const rangeHigh = Math.max(...closes.slice(i, n));
    const rangeLow = Math.min(...closes.slice(i, n));
    if ((rangeHigh - rangeLow) / rangeHigh <= 0.20) {
      weeksInBase = Math.round((n - i) / 5);
    } else {
      break;
    }
  }

  const change_pct = n >= 2 ? ((price - closes[n - 2]) / closes[n - 2]) * 100 : 0;

  return {
    symbol: symbol.replace(".KS", "").replace(".KQ", ""),
    name,
    market,
    price: Math.round(price * 100) / 100,
    change_pct: Math.round(change_pct * 100) / 100,
    score,
    stage: "STAGE_2",
    base_depth_pct: Math.round(baseDepth * 1000) / 10,
    weeks_in_base: Math.max(weeksInBase, 1),
    volume_ratio: Math.round(volRatio * 100) / 100,
    dist_from_52w_high_pct: Math.round(distFromHigh * 1000) / 10,
    ma_alignment: true,
  };
}

// ── Process batch with concurrency control ─────────────────────
async function processBatch(
  symbols: [string, string][],
  market: "KR" | "US",
  indexBars: DailyBar[],
  concurrency: number = 5
): Promise<ScreenerResult[]> {
  const results: ScreenerResult[] = [];
  let idx = 0;

  async function worker() {
    while (idx < symbols.length) {
      const i = idx++;
      const [sym, name] = symbols[i];
      try {
        const bars = await fetchChart(sym);
        if (bars.length > 0) {
          const result = screenStock(sym, name, market, bars, indexBars);
          if (result) results.push(result);
        }
      } catch {
        // skip on error
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

// ── GET handler ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const market = (searchParams.get("market") || "ALL").toUpperCase();
    const refresh = searchParams.get("refresh") === "true";

    const cacheKey = market;
    if (!refresh && cache[cacheKey] && Date.now() - cache[cacheKey].ts < CACHE_TTL) {
      return NextResponse.json({
        ok: true,
        results: cache[cacheKey].data,
        cached: true,
        updated_at: new Date(cache[cacheKey].ts).toISOString(),
      });
    }

    // Fetch index data for RS calculation
    const [kospiIndex, spyIndex] = await Promise.all([
      market !== "US" ? fetchChart("^KS11") : Promise.resolve([]),
      market !== "KR" ? fetchChart("^GSPC") : Promise.resolve([]),
    ]);

    // Process KR and US in parallel
    const [krResults, usResults] = await Promise.all([
      market !== "US" ? processBatch(KR_SYMBOLS, "KR", kospiIndex, 5) : Promise.resolve([]),
      market !== "KR" ? processBatch(US_SYMBOLS, "US", spyIndex, 5) : Promise.resolve([]),
    ]);

    const all = [...krResults, ...usResults]
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    const now = Date.now();
    cache[cacheKey] = { data: all, ts: now };

    return NextResponse.json({
      ok: true,
      results: all,
      cached: false,
      updated_at: new Date(now).toISOString(),
      stats: {
        kr_scanned: market !== "US" ? KR_SYMBOLS.length : 0,
        us_scanned: market !== "KR" ? US_SYMBOLS.length : 0,
        passed: all.length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
