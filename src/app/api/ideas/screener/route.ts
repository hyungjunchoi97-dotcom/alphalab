import { NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

export const runtime = "nodejs";

// ── Stock definitions ────────────────────────────────────────

interface StockDef {
  ticker: string;
  symbol: string;
  name: string;
  nameKr?: string;
  market: "KR" | "US";
}

const KR_STOCKS: StockDef[] = [
  // KOSPI large-cap
  { ticker: "005930", symbol: "005930.KS", name: "Samsung Elec", nameKr: "삼성전자", market: "KR" },
  { ticker: "000660", symbol: "000660.KS", name: "SK Hynix", nameKr: "SK하이닉스", market: "KR" },
  { ticker: "373220", symbol: "373220.KS", name: "LG Energy", nameKr: "LG에너지솔루션", market: "KR" },
  { ticker: "035420", symbol: "035420.KS", name: "NAVER", nameKr: "네이버", market: "KR" },
  { ticker: "051910", symbol: "051910.KS", name: "LG Chem", nameKr: "LG화학", market: "KR" },
  { ticker: "006400", symbol: "006400.KS", name: "Samsung SDI", nameKr: "삼성SDI", market: "KR" },
  { ticker: "068270", symbol: "068270.KS", name: "Celltrion", nameKr: "셀트리온", market: "KR" },
  { ticker: "035720", symbol: "035720.KS", name: "Kakao", nameKr: "카카오", market: "KR" },
  { ticker: "105560", symbol: "105560.KS", name: "KB Financial", nameKr: "KB금융", market: "KR" },
  { ticker: "055550", symbol: "055550.KS", name: "Shinhan FG", nameKr: "신한지주", market: "KR" },
  { ticker: "086790", symbol: "086790.KS", name: "Hana Financial", nameKr: "하나금융지주", market: "KR" },
  { ticker: "012330", symbol: "012330.KS", name: "Hyundai Mobis", nameKr: "현대모비스", market: "KR" },
  { ticker: "028260", symbol: "028260.KS", name: "Samsung C&T", nameKr: "삼성물산", market: "KR" },
  { ticker: "003670", symbol: "003670.KS", name: "Posco Future M", nameKr: "포스코퓨처엠", market: "KR" },
  { ticker: "066570", symbol: "066570.KS", name: "LG Electronics", nameKr: "LG전자", market: "KR" },
  { ticker: "096770", symbol: "096770.KS", name: "SK Innovation", nameKr: "SK이노베이션", market: "KR" },
  { ticker: "034020", symbol: "034020.KS", name: "Doosan Enerbility", nameKr: "두산에너빌리티", market: "KR" },
  { ticker: "009540", symbol: "009540.KS", name: "HD Korea Shipbldg", nameKr: "HD한국조선해양", market: "KR" },
  { ticker: "017670", symbol: "017670.KS", name: "SK Telecom", nameKr: "SK텔레콤", market: "KR" },
  { ticker: "036570", symbol: "036570.KS", name: "NCsoft", nameKr: "엔씨소프트", market: "KR" },
  { ticker: "247540", symbol: "247540.KS", name: "Ecopro BM", nameKr: "에코프로비엠", market: "KR" },
  { ticker: "003490", symbol: "003490.KS", name: "Korean Air", nameKr: "대한항공", market: "KR" },
  { ticker: "010130", symbol: "010130.KS", name: "Korea Zinc", nameKr: "고려아연", market: "KR" },
  { ticker: "034730", symbol: "034730.KS", name: "SK Inc", nameKr: "SK", market: "KR" },
  { ticker: "003550", symbol: "003550.KS", name: "LG", nameKr: "LG", market: "KR" },
  { ticker: "009150", symbol: "009150.KS", name: "Samsung Electro", nameKr: "삼성전기", market: "KR" },
  { ticker: "012450", symbol: "012450.KS", name: "Hanwha Aerospace", nameKr: "한화에어로스페이스", market: "KR" },
  { ticker: "000270", symbol: "000270.KS", name: "Kia", nameKr: "기아", market: "KR" },
  { ticker: "005380", symbol: "005380.KS", name: "Hyundai Motor", nameKr: "현대차", market: "KR" },
  { ticker: "000810", symbol: "000810.KS", name: "Samsung Fire", nameKr: "삼성화재", market: "KR" },
  { ticker: "032830", symbol: "032830.KS", name: "Samsung Life", nameKr: "삼성생명", market: "KR" },
  { ticker: "011200", symbol: "011200.KS", name: "HMM", nameKr: "HMM", market: "KR" },
  { ticker: "042700", symbol: "042700.KS", name: "Hanmi Semi", nameKr: "한미반도체", market: "KR" },
  { ticker: "005490", symbol: "005490.KS", name: "POSCO Holdings", nameKr: "포스코홀딩스", market: "KR" },
  { ticker: "018260", symbol: "018260.KS", name: "Samsung SDS", nameKr: "삼성SDS", market: "KR" },
  { ticker: "010950", symbol: "010950.KS", name: "S-Oil", nameKr: "S-Oil", market: "KR" },
  { ticker: "030200", symbol: "030200.KS", name: "KT", nameKr: "KT", market: "KR" },
  { ticker: "033780", symbol: "033780.KS", name: "KT&G", nameKr: "KT&G", market: "KR" },
  { ticker: "015760", symbol: "015760.KS", name: "Korea Elec Power", nameKr: "한국전력", market: "KR" },
  { ticker: "326030", symbol: "326030.KS", name: "SK Biopharm", nameKr: "SK바이오팜", market: "KR" },
  { ticker: "352820", symbol: "352820.KS", name: "Hive", nameKr: "하이브", market: "KR" },
  { ticker: "263750", symbol: "263750.KS", name: "Pearl Abyss", nameKr: "펄어비스", market: "KR" },
  { ticker: "259960", symbol: "259960.KS", name: "Krafton", nameKr: "크래프톤", market: "KR" },
  { ticker: "377300", symbol: "377300.KS", name: "Kakao Pay", nameKr: "카카오페이", market: "KR" },
  { ticker: "035900", symbol: "035900.KS", name: "JYP Ent", nameKr: "JYP Ent.", market: "KR" },
  // KOSPI mid-cap additions
  { ticker: "316140", symbol: "316140.KS", name: "Woori Financial", nameKr: "우리금융지주", market: "KR" },
  { ticker: "024110", symbol: "024110.KS", name: "Industrial Bank", nameKr: "기업은행", market: "KR" },
  { ticker: "009830", symbol: "009830.KS", name: "Hanwha Solutions", nameKr: "한화솔루션", market: "KR" },
  { ticker: "267250", symbol: "267250.KS", name: "HD Hyundai", nameKr: "HD현대", market: "KR" },
  { ticker: "329180", symbol: "329180.KS", name: "HD Hyundai Heavy", nameKr: "HD현대중공업", market: "KR" },
  { ticker: "010140", symbol: "010140.KS", name: "Samsung Heavy", nameKr: "삼성중공업", market: "KR" },
  { ticker: "000720", symbol: "000720.KS", name: "Hyundai E&C", nameKr: "현대건설", market: "KR" },
  { ticker: "047050", symbol: "047050.KS", name: "Posco Intl", nameKr: "포스코인터내셔널", market: "KR" },
  { ticker: "004020", symbol: "004020.KS", name: "Hyundai Steel", nameKr: "현대제철", market: "KR" },
  { ticker: "003410", symbol: "003410.KS", name: "Ssangyong C&E", nameKr: "쌍용C&E", market: "KR" },
  { ticker: "090430", symbol: "090430.KS", name: "Amorepacific", nameKr: "아모레퍼시픽", market: "KR" },
  { ticker: "097950", symbol: "097950.KS", name: "CJ CheilJedang", nameKr: "CJ제일제당", market: "KR" },
  { ticker: "004170", symbol: "004170.KS", name: "Shinsegae", nameKr: "신세계", market: "KR" },
  { ticker: "069960", symbol: "069960.KS", name: "Hyundai Dept Store", nameKr: "현대백화점", market: "KR" },
  { ticker: "271560", symbol: "271560.KS", name: "Orion", nameKr: "오리온", market: "KR" },
  { ticker: "302440", symbol: "302440.KS", name: "SK Bioscience", nameKr: "SK바이오사이언스", market: "KR" },
  { ticker: "207940", symbol: "207940.KS", name: "Samsung Biologics", nameKr: "삼성바이오로직스", market: "KR" },
  { ticker: "128940", symbol: "128940.KS", name: "Hanmi Pharma", nameKr: "한미약품", market: "KR" },
  { ticker: "180640", symbol: "180640.KS", name: "Hanmi Science", nameKr: "한미사이언스", market: "KR" },
  { ticker: "021240", symbol: "021240.KS", name: "Coway", nameKr: "코웨이", market: "KR" },
  { ticker: "011170", symbol: "011170.KS", name: "Lotte Chem", nameKr: "롯데케미칼", market: "KR" },
  { ticker: "016360", symbol: "016360.KS", name: "Samsung Securities", nameKr: "삼성증권", market: "KR" },
  { ticker: "071050", symbol: "071050.KS", name: "Korea Investment", nameKr: "한국금융지주", market: "KR" },
  { ticker: "034220", symbol: "034220.KS", name: "LG Display", nameKr: "LG디스플레이", market: "KR" },
  { ticker: "402340", symbol: "402340.KS", name: "SK Square", nameKr: "SK스퀘어", market: "KR" },
  // KOSPI additional
  { ticker: "138930", symbol: "138930.KS", name: "BNK Financial", nameKr: "BNK금융지주", market: "KR" },
  { ticker: "139480", symbol: "139480.KS", name: "E-Mart", nameKr: "이마트", market: "KR" },
  { ticker: "006260", symbol: "006260.KS", name: "LS", nameKr: "LS", market: "KR" },
  { ticker: "006280", symbol: "006280.KS", name: "Green Cross", nameKr: "녹십자", market: "KR" },
  { ticker: "000100", symbol: "000100.KS", name: "Yuhan Corp", nameKr: "유한양행", market: "KR" },
  { ticker: "078930", symbol: "078930.KS", name: "GS", nameKr: "GS", market: "KR" },
  { ticker: "001570", symbol: "001570.KS", name: "Kumyang", nameKr: "금양", market: "KR" },
  { ticker: "008770", symbol: "008770.KS", name: "Hotel Shilla", nameKr: "호텔신라", market: "KR" },
  { ticker: "006800", symbol: "006800.KS", name: "Mirae Asset Sec", nameKr: "미래에셋증권", market: "KR" },
  { ticker: "001040", symbol: "001040.KS", name: "CJ", nameKr: "CJ", market: "KR" },
  { ticker: "010620", symbol: "010620.KS", name: "Hyundai Mipo", nameKr: "현대미포조선", market: "KR" },
  { ticker: "003240", symbol: "003240.KS", name: "Taekwang Ind", nameKr: "태광산업", market: "KR" },
  { ticker: "161390", symbol: "161390.KS", name: "Hankook Tire", nameKr: "한국타이어앤테크놀로지", market: "KR" },
  { ticker: "008930", symbol: "008930.KS", name: "Hanmi Global", nameKr: "한미글로벌", market: "KR" },
  { ticker: "036460", symbol: "036460.KS", name: "Korea Gas", nameKr: "한국가스공사", market: "KR" },
  { ticker: "002790", symbol: "002790.KS", name: "Amorepacific G", nameKr: "아모레G", market: "KR" },
  { ticker: "005830", symbol: "005830.KS", name: "DB Insurance", nameKr: "DB손해보험", market: "KR" },
  { ticker: "088350", symbol: "088350.KS", name: "Hanwha Life", nameKr: "한화생명", market: "KR" },
  { ticker: "009240", symbol: "009240.KS", name: "Hansol Chem", nameKr: "한솔케미칼", market: "KR" },
  { ticker: "051900", symbol: "051900.KS", name: "LG H&H", nameKr: "LG생활건강", market: "KR" },
  // KOSDAQ
  { ticker: "041510", symbol: "041510.KQ", name: "SM Ent", nameKr: "SM", market: "KR" },
  { ticker: "086520", symbol: "086520.KQ", name: "Ecopro", nameKr: "에코프로", market: "KR" },
  { ticker: "403870", symbol: "403870.KQ", name: "HPSP", nameKr: "HPSP", market: "KR" },
  { ticker: "196170", symbol: "196170.KQ", name: "Alteogen", nameKr: "알테오젠", market: "KR" },
  { ticker: "293490", symbol: "293490.KQ", name: "Caway", nameKr: "카웨이", market: "KR" },
  { ticker: "145020", symbol: "145020.KQ", name: "Hugel", nameKr: "휴젤", market: "KR" },
  { ticker: "112040", symbol: "112040.KQ", name: "Wemade", nameKr: "위메이드", market: "KR" },
  { ticker: "357780", symbol: "357780.KQ", name: "Soulbrain", nameKr: "솔브레인", market: "KR" },
  { ticker: "058470", symbol: "058470.KQ", name: "Rino Industrial", nameKr: "리노공업", market: "KR" },
  { ticker: "039030", symbol: "039030.KQ", name: "Iotree", nameKr: "이오테크닉스", market: "KR" },
  { ticker: "348150", symbol: "348150.KQ", name: "Kaka Games", nameKr: "카카오게임즈", market: "KR" },
  { ticker: "240810", symbol: "240810.KQ", name: "Won Ik Material", nameKr: "원익IPS", market: "KR" },
  { ticker: "060310", symbol: "060310.KQ", name: "3S Korea", nameKr: "3S", market: "KR" },
  { ticker: "095340", symbol: "095340.KQ", name: "ISC", nameKr: "ISC", market: "KR" },
  { ticker: "200710", symbol: "200710.KQ", name: "Ato Solutions", nameKr: "에이토솔루션즈", market: "KR" },
  { ticker: "028300", symbol: "028300.KQ", name: "HLB", nameKr: "HLB", market: "KR" },
  { ticker: "078600", symbol: "078600.KQ", name: "Daejoo Elec", nameKr: "대주전자재료", market: "KR" },
  { ticker: "336260", symbol: "336260.KQ", name: "Doosan Fuel Cell", nameKr: "두산퓨얼셀", market: "KR" },
  { ticker: "443060", symbol: "443060.KQ", name: "LS Materials", nameKr: "LS머트리얼즈", market: "KR" },
  { ticker: "322510", symbol: "322510.KQ", name: "Jeil Pharma", nameKr: "제일약품", market: "KR" },
  { ticker: "036830", symbol: "036830.KQ", name: "Solbrain Holdings", nameKr: "솔브레인홀딩스", market: "KR" },
  { ticker: "005290", symbol: "005290.KQ", name: "Dong Jin Semi", nameKr: "동진쎄미켐", market: "KR" },
  { ticker: "383310", symbol: "383310.KQ", name: "Ecobat", nameKr: "에코배터리", market: "KR" },
  { ticker: "131970", symbol: "131970.KQ", name: "Doosan Tesna", nameKr: "두산테스나", market: "KR" },
  { ticker: "141080", symbol: "141080.KQ", name: "Regnase", nameKr: "레그넨바이오", market: "KR" },
  { ticker: "067310", symbol: "067310.KQ", name: "Hana Materials", nameKr: "하나머티리얼즈", market: "KR" },
  { ticker: "217190", symbol: "217190.KQ", name: "Cafe24", nameKr: "카페24", market: "KR" },
  { ticker: "060280", symbol: "060280.KQ", name: "Curo Holdings", nameKr: "큐로홀딩스", market: "KR" },
  { ticker: "033640", symbol: "033640.KQ", name: "Nepes", nameKr: "네패스", market: "KR" },
  { ticker: "314930", symbol: "314930.KQ", name: "Bati Semitec", nameKr: "바디텍메드", market: "KR" },
  { ticker: "079370", symbol: "079370.KQ", name: "Leeno Industrial", nameKr: "리노공업", market: "KR" },
  { ticker: "352480", symbol: "352480.KQ", name: "C&C Intl", nameKr: "씨앤씨인터내셔널", market: "KR" },
];

const US_STOCKS: StockDef[] = [
  // Mega-cap
  { ticker: "NVDA", symbol: "NVDA", name: "NVIDIA", market: "US" },
  { ticker: "AAPL", symbol: "AAPL", name: "Apple", market: "US" },
  { ticker: "MSFT", symbol: "MSFT", name: "Microsoft", market: "US" },
  { ticker: "GOOGL", symbol: "GOOGL", name: "Alphabet", market: "US" },
  { ticker: "AMZN", symbol: "AMZN", name: "Amazon", market: "US" },
  { ticker: "META", symbol: "META", name: "Meta Platforms", market: "US" },
  { ticker: "TSLA", symbol: "TSLA", name: "Tesla", market: "US" },
  { ticker: "AVGO", symbol: "AVGO", name: "Broadcom", market: "US" },
  { ticker: "LLY", symbol: "LLY", name: "Eli Lilly", market: "US" },
  { ticker: "JPM", symbol: "JPM", name: "JPMorgan Chase", market: "US" },
  { ticker: "V", symbol: "V", name: "Visa", market: "US" },
  { ticker: "UNH", symbol: "UNH", name: "UnitedHealth", market: "US" },
  { ticker: "COST", symbol: "COST", name: "Costco", market: "US" },
  { ticker: "NFLX", symbol: "NFLX", name: "Netflix", market: "US" },
  { ticker: "AMD", symbol: "AMD", name: "AMD", market: "US" },
  // Large-cap tech
  { ticker: "PLTR", symbol: "PLTR", name: "Palantir", market: "US" },
  { ticker: "ANET", symbol: "ANET", name: "Arista Networks", market: "US" },
  { ticker: "PANW", symbol: "PANW", name: "Palo Alto Networks", market: "US" },
  { ticker: "UBER", symbol: "UBER", name: "Uber", market: "US" },
  { ticker: "CRM", symbol: "CRM", name: "Salesforce", market: "US" },
  { ticker: "COIN", symbol: "COIN", name: "Coinbase", market: "US" },
  { ticker: "SNOW", symbol: "SNOW", name: "Snowflake", market: "US" },
  { ticker: "SHOP", symbol: "SHOP", name: "Shopify", market: "US" },
  { ticker: "SQ", symbol: "SQ", name: "Block", market: "US" },
  { ticker: "MRVL", symbol: "MRVL", name: "Marvell Tech", market: "US" },
  { ticker: "ARM", symbol: "ARM", name: "Arm Holdings", market: "US" },
  { ticker: "CRWD", symbol: "CRWD", name: "CrowdStrike", market: "US" },
  { ticker: "DDOG", symbol: "DDOG", name: "Datadog", market: "US" },
  { ticker: "ZS", symbol: "ZS", name: "Zscaler", market: "US" },
  { ticker: "NET", symbol: "NET", name: "Cloudflare", market: "US" },
  { ticker: "MDB", symbol: "MDB", name: "MongoDB", market: "US" },
  { ticker: "ABNB", symbol: "ABNB", name: "Airbnb", market: "US" },
  { ticker: "DASH", symbol: "DASH", name: "DoorDash", market: "US" },
  { ticker: "RBLX", symbol: "RBLX", name: "Roblox", market: "US" },
  { ticker: "TTD", symbol: "TTD", name: "Trade Desk", market: "US" },
  { ticker: "MSTR", symbol: "MSTR", name: "MicroStrategy", market: "US" },
  { ticker: "SMCI", symbol: "SMCI", name: "Super Micro", market: "US" },
  // Large-cap traditional
  { ticker: "GE", symbol: "GE", name: "GE Aerospace", market: "US" },
  { ticker: "BA", symbol: "BA", name: "Boeing", market: "US" },
  { ticker: "DIS", symbol: "DIS", name: "Disney", market: "US" },
  { ticker: "INTC", symbol: "INTC", name: "Intel", market: "US" },
  { ticker: "WMT", symbol: "WMT", name: "Walmart", market: "US" },
  { ticker: "HD", symbol: "HD", name: "Home Depot", market: "US" },
  { ticker: "PG", symbol: "PG", name: "Procter & Gamble", market: "US" },
  { ticker: "KO", symbol: "KO", name: "Coca-Cola", market: "US" },
  { ticker: "PEP", symbol: "PEP", name: "PepsiCo", market: "US" },
  { ticker: "MRK", symbol: "MRK", name: "Merck", market: "US" },
  { ticker: "ABBV", symbol: "ABBV", name: "AbbVie", market: "US" },
  { ticker: "TMO", symbol: "TMO", name: "Thermo Fisher", market: "US" },
  { ticker: "ABT", symbol: "ABT", name: "Abbott Labs", market: "US" },
  { ticker: "NKE", symbol: "NKE", name: "Nike", market: "US" },
  { ticker: "SBUX", symbol: "SBUX", name: "Starbucks", market: "US" },
  { ticker: "LOW", symbol: "LOW", name: "Lowe's", market: "US" },
  { ticker: "GS", symbol: "GS", name: "Goldman Sachs", market: "US" },
  { ticker: "MS", symbol: "MS", name: "Morgan Stanley", market: "US" },
  { ticker: "C", symbol: "C", name: "Citigroup", market: "US" },
  { ticker: "BLK", symbol: "BLK", name: "BlackRock", market: "US" },
  { ticker: "AXP", symbol: "AXP", name: "Amex", market: "US" },
  { ticker: "CAT", symbol: "CAT", name: "Caterpillar", market: "US" },
  { ticker: "DE", symbol: "DE", name: "Deere", market: "US" },
  { ticker: "RTX", symbol: "RTX", name: "RTX Corp", market: "US" },
  { ticker: "LMT", symbol: "LMT", name: "Lockheed Martin", market: "US" },
  { ticker: "NOC", symbol: "NOC", name: "Northrop Grumman", market: "US" },
  // Mid-cap growth
  { ticker: "IONQ", symbol: "IONQ", name: "IonQ", market: "US" },
  { ticker: "RIVN", symbol: "RIVN", name: "Rivian", market: "US" },
  { ticker: "LCID", symbol: "LCID", name: "Lucid Group", market: "US" },
  { ticker: "SOFI", symbol: "SOFI", name: "SoFi Tech", market: "US" },
  { ticker: "HOOD", symbol: "HOOD", name: "Robinhood", market: "US" },
  { ticker: "ROKU", symbol: "ROKU", name: "Roku", market: "US" },
  { ticker: "ENPH", symbol: "ENPH", name: "Enphase Energy", market: "US" },
  { ticker: "SEDG", symbol: "SEDG", name: "SolarEdge", market: "US" },
  { ticker: "U", symbol: "U", name: "Unity Software", market: "US" },
  { ticker: "DUOL", symbol: "DUOL", name: "Duolingo", market: "US" },
  { ticker: "APP", symbol: "APP", name: "AppLovin", market: "US" },
  { ticker: "CELH", symbol: "CELH", name: "Celsius Holdings", market: "US" },
  { ticker: "AXON", symbol: "AXON", name: "Axon Enterprise", market: "US" },
  { ticker: "HIMS", symbol: "HIMS", name: "Hims & Hers", market: "US" },
  { ticker: "OKTA", symbol: "OKTA", name: "Okta", market: "US" },
  // Energy & commodities
  { ticker: "XOM", symbol: "XOM", name: "ExxonMobil", market: "US" },
  { ticker: "CVX", symbol: "CVX", name: "Chevron", market: "US" },
  { ticker: "OXY", symbol: "OXY", name: "Occidental", market: "US" },
  { ticker: "FSLR", symbol: "FSLR", name: "First Solar", market: "US" },
  { ticker: "FCX", symbol: "FCX", name: "Freeport-McMoRan", market: "US" },
  { ticker: "NEM", symbol: "NEM", name: "Newmont", market: "US" },
];

// ── KR Yahoo symbol resolver (Naver API) ────────────────────

const yahooSymbolCache = new Map<string, string>();

async function getYahooSymbol(ticker: string, fallback: string): Promise<string> {
  const cached = yahooSymbolCache.get(ticker);
  if (cached) return cached;

  try {
    const res = await fetchWithTimeout(
      `https://m.stock.naver.com/api/stock/${ticker}/basic`,
      { headers: { "User-Agent": "Mozilla/5.0" } },
      3000,
    );
    if (res.ok) {
      const json = await res.json();
      const marketType: string = json.marketType || json.stockExchangeType?.name || "";
      const suffix = marketType.toUpperCase().includes("KOSPI") ? ".KS" : ".KQ";
      const symbol = `${ticker}${suffix}`;
      yahooSymbolCache.set(ticker, symbol);
      return symbol;
    }
  } catch { /* fallback */ }

  yahooSymbolCache.set(ticker, fallback);
  return fallback;
}

// ── Cache ────────────────────────────────────────────────────

const CACHE_TTL = 3 * 60 * 1000; // 3 minutes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cache: { data: any; cachedAt: number } | null = null;

// ── Yahoo Finance crumb management ──────────────────────────

let crumbData: { crumb: string; cookie: string; fetchedAt: number } | null = null;
const CRUMB_TTL = 30 * 60 * 1000; // 30 min

async function getYahooCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (crumbData && Date.now() - crumbData.fetchedAt < CRUMB_TTL) {
    return { crumb: crumbData.crumb, cookie: crumbData.cookie };
  }
  try {
    const cookieRes = await fetchWithTimeout("https://fc.yahoo.com", {
      headers: { "User-Agent": "Mozilla/5.0" },
      redirect: "manual",
    }, 5000);
    const setCookie = cookieRes.headers.get("set-cookie") || "";
    const cookie = setCookie.split(";")[0] || "";

    const crumbRes = await fetchWithTimeout(
      "https://query2.finance.yahoo.com/v1/test/getcrumb",
      { headers: { "User-Agent": "Mozilla/5.0", Cookie: cookie } },
      5000
    );
    if (!crumbRes.ok) return null;
    const crumb = await crumbRes.text();
    if (!crumb || crumb.length < 5) return null;

    crumbData = { crumb, cookie, fetchedAt: Date.now() };
    return { crumb, cookie };
  } catch {
    return null;
  }
}

// ── Yahoo Finance chart fetcher ─────────────────────────────

interface StockData {
  ticker: string;
  name: string;
  nameKr?: string;
  market: "KR" | "US";
  price: number;
  chgPct: number;
  chg1d: number;
  chg5d: number;
  chg20d: number;
  volume: number;
  avgVolume20d: number;
  volumeRatio: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  distTo52wHigh: number;
  near52wHigh: boolean;
}

async function fetchStockData(stock: StockDef): Promise<StockData | null> {
  try {
    const symbol = stock.market === "KR"
      ? await getYahooSymbol(stock.ticker, stock.symbol)
      : stock.symbol;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d`;
    const res = await fetchWithTimeout(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    }, 8000);
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];
    if (!quote?.close || !quote?.volume) return null;

    const closes: number[] = [];
    const volumes: number[] = [];
    for (let i = 0; i < quote.close.length; i++) {
      if (quote.close[i] != null && quote.close[i] > 0) {
        closes.push(quote.close[i]);
        volumes.push(quote.volume[i] || 0);
      }
    }

    if (closes.length < 22) return null;

    const price = meta.regularMarketPrice ?? closes[closes.length - 1];
    const prevClose = meta.chartPreviousClose ?? closes[closes.length - 2];
    const chg1d = ((price - prevClose) / prevClose) * 100;
    const price5d = closes[Math.max(0, closes.length - 6)];
    const chg5d = ((price - price5d) / price5d) * 100;
    const price20d = closes[Math.max(0, closes.length - 21)];
    const chg20d = ((price - price20d) / price20d) * 100;

    const todayVol = volumes[volumes.length - 1];
    const last20Vol = volumes.slice(-21, -1);
    const avgVol20 = last20Vol.length > 0 ? last20Vol.reduce((a, b) => a + b, 0) / last20Vol.length : 1;
    const volumeRatio = avgVol20 > 0 ? todayVol / avgVol20 : 1;

    const fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh || Math.max(...closes);
    const fiftyTwoWeekLow = meta.fiftyTwoWeekLow || Math.min(...closes);
    const distTo52wHigh = fiftyTwoWeekHigh > 0 ? ((price / fiftyTwoWeekHigh) - 1) * 100 : 0;

    return {
      ticker: stock.ticker,
      name: stock.name,
      nameKr: stock.nameKr,
      market: stock.market,
      price: Math.round(price * 100) / 100,
      chgPct: Math.round(chg1d * 100) / 100,
      chg1d: Math.round(chg1d * 100) / 100,
      chg5d: Math.round(chg5d * 100) / 100,
      chg20d: Math.round(chg20d * 100) / 100,
      volume: todayVol,
      avgVolume20d: Math.round(avgVol20),
      volumeRatio: Math.round(volumeRatio * 100) / 100,
      fiftyTwoWeekHigh: Math.round(fiftyTwoWeekHigh * 100) / 100,
      fiftyTwoWeekLow: Math.round(fiftyTwoWeekLow * 100) / 100,
      distTo52wHigh: Math.round(distTo52wHigh * 100) / 100,
      near52wHigh: distTo52wHigh >= -2,
    };
  } catch {
    return null;
  }
}

// ── Yahoo Finance fundamentals via quoteSummary ─────────────

interface Fundamentals {
  per: number | null;
  pbr: number | null;
  roe: number | null;
  divYield: number | null;
}

async function fetchFundamentals(
  symbols: string[],
  auth: { crumb: string; cookie: string }
): Promise<Map<string, Fundamentals>> {
  const map = new Map<string, Fundamentals>();

  const results = await Promise.allSettled(
    symbols.map(async (sym) => {
      const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=summaryDetail,financialData,defaultKeyStatistics&crumb=${auth.crumb}`;
      const res = await fetchWithTimeout(url, {
        headers: { "User-Agent": "Mozilla/5.0", Cookie: auth.cookie },
      }, 6000);
      if (!res.ok) return null;
      const json = await res.json();
      const r = json.quoteSummary?.result?.[0];
      if (!r) return null;

      const sd = r.summaryDetail || {};
      const fd = r.financialData || {};
      const ks = r.defaultKeyStatistics || {};

      const per = sd.trailingPE?.raw ?? ks.trailingPE?.raw ?? ks.forwardPE?.raw ?? null;
      const pbr = sd.priceToBook?.raw ?? ks.priceToBook?.raw ?? null;
      const roe = fd.returnOnEquity?.raw ?? null;
      const divYield = sd.dividendYield?.raw ?? null;

      // Extract ticker from symbol (005930.KS -> 005930, AAPL -> AAPL)
      const ticker = sym.replace(/\.(KS|KQ)$/, "");
      return { ticker, per, pbr, roe, divYield };
    })
  );

  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      map.set(r.value.ticker, {
        per: r.value.per,
        pbr: r.value.pbr,
        roe: r.value.roe,
        divYield: r.value.divYield,
      });
    }
  }

  return map;
}

// ── Screening logic ──────────────────────────────────────────

interface FomoItem {
  ticker: string;
  name: string;
  nameKr?: string;
  price: number;
  chgPct: number;
  tag: string;
  volumeRatio: number;
  volume: number;
  metrics: { chg1d: number; chg5d: number; chg20d: number; near52wHigh: boolean; volumeSpike: boolean; tradingValue: number };
}

interface ValueItem {
  ticker: string;
  name: string;
  price: number;
  chgPct: number;
  tag: string;
  per: number | null;
  pbr: number | null;
  roe: number | null;
  divYield: number | null;
  metrics: { chg1d: number; chg5d: number; chg20d: number; near52wHigh: boolean; volumeSpike: boolean; tradingValue: number };
}

interface High52Item {
  ticker: string;
  name: string;
  price: number;
  chgPct: number;
  tag: string;
  fiftyTwoWeekHigh: number;
  distTo52wHigh: number;
  metrics: { chg1d: number; chg5d: number; chg20d: number; near52wHigh: boolean; volumeSpike: boolean; tradingValue: number };
}

function screenFomo(stocks: StockData[]): FomoItem[] {
  // Deduplicate by ticker (keep first occurrence)
  const seen = new Set<string>();
  const deduped = stocks.filter(s => {
    if (seen.has(s.ticker)) return false;
    seen.add(s.ticker);
    return true;
  });

  return [...deduped]
    .filter(s => s.volumeRatio > 0.5)
    .sort((a, b) => b.volumeRatio - a.volumeRatio)
    .slice(0, 100)
    .map(s => {
      let tag = "MOMO";
      if (s.volumeRatio >= 2.5) tag = "VOLUME SPIKE";
      else if (s.near52wHigh) tag = "52W HIGH";
      else if (s.chg5d > 5) tag = "BREAKOUT";
      return {
        ticker: s.ticker,
        name: s.name,
        nameKr: s.nameKr,
        price: s.price,
        chgPct: s.chgPct,
        tag,
        volumeRatio: s.volumeRatio,
        volume: s.volume,
        metrics: {
          chg1d: s.chg1d, chg5d: s.chg5d, chg20d: s.chg20d,
          near52wHigh: s.near52wHigh, volumeSpike: s.volumeRatio >= 2, tradingValue: 0,
        },
      };
    });
}

function screenValue(stocks: StockData[], fundMap: Map<string, Fundamentals>): ValueItem[] {
  // Stocks with low PE or positive dividend yield or recent pullback
  const candidates = [...stocks]
    .map(s => {
      const f = fundMap.get(s.ticker);
      return { ...s, f };
    })
    .filter(s => {
      // Has some fundamental data OR has pulled back significantly
      if (s.f && s.f.per !== null && s.f.per > 0 && s.f.per < 20) return true;
      if (s.f && s.f.divYield !== null && s.f.divYield > 0.02) return true;
      if (s.chg20d < -5) return true;
      return false;
    })
    .sort((a, b) => {
      // Sort: low PE first, then pullback
      const aPe = a.f?.per ?? 999;
      const bPe = b.f?.per ?? 999;
      return aPe - bPe;
    })
    .slice(0, 30);

  return candidates.map(s => {
    let tag = "VALUE";
    if (s.f?.divYield && s.f.divYield > 0.03) tag = "HIGH DIV";
    else if (s.chg20d < -10) tag = "PULLBACK";
    else if (s.f?.per && s.f.per < 8) tag = "LOW PER";
    return {
      ticker: s.ticker,
      name: s.name,
      price: s.price,
      chgPct: s.chgPct,
      tag,
      per: s.f?.per ?? null,
      pbr: s.f?.pbr ?? null,
      roe: s.f?.roe ? Math.round(s.f.roe * 10000) / 100 : null,
      divYield: s.f?.divYield ? Math.round(s.f.divYield * 10000) / 100 : null,
      metrics: {
        chg1d: s.chg1d, chg5d: s.chg5d, chg20d: s.chg20d,
        near52wHigh: s.near52wHigh, volumeSpike: s.volumeRatio >= 2, tradingValue: 0,
      },
    };
  });
}

function screenHigh52(stocks: StockData[]): High52Item[] {
  return [...stocks]
    .filter(s => s.distTo52wHigh >= -2)
    .sort((a, b) => b.distTo52wHigh - a.distTo52wHigh)
    .map(s => ({
      ticker: s.ticker,
      name: s.name,
      price: s.price,
      chgPct: s.chgPct,
      tag: "52W HIGH",
      fiftyTwoWeekHigh: s.fiftyTwoWeekHigh,
      distTo52wHigh: s.distTo52wHigh,
      metrics: {
        chg1d: s.chg1d, chg5d: s.chg5d, chg20d: s.chg20d,
        near52wHigh: true, volumeSpike: s.volumeRatio >= 2, tradingValue: 0,
      },
    }));
}

// ── Route handler ────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
      return NextResponse.json({ ...cache.data, source: "cache" });
    }

    // Fetch chart data for all stocks in parallel
    const allStocks = [...KR_STOCKS, ...US_STOCKS];
    const results = await Promise.allSettled(
      allStocks.map(s => fetchStockData(s))
    );

    const stocks: StockData[] = results
      .filter((r): r is PromiseFulfilledResult<StockData | null> => r.status === "fulfilled")
      .map(r => r.value)
      .filter((s): s is StockData => s !== null);

    // Fetch fundamentals for VALUE screener candidates
    const auth = await getYahooCrumb();
    let fundMap = new Map<string, Fundamentals>();
    if (auth) {
      // Fetch fundamentals for all stocks (we need them for VALUE screener)
      const symbolsToFetch = stocks.map(s => {
        // Use resolved symbol from cache (populated during fetchStockData)
        return yahooSymbolCache.get(s.ticker) || allStocks.find(d => d.ticker === s.ticker)?.symbol || s.ticker;
      });
      // Batch in groups of 30 to avoid overwhelming
      const batches: string[][] = [];
      for (let i = 0; i < symbolsToFetch.length; i += 30) {
        batches.push(symbolsToFetch.slice(i, i + 30));
      }
      const batchResults = await Promise.allSettled(
        batches.map(batch => fetchFundamentals(batch, auth))
      );
      for (const r of batchResults) {
        if (r.status === "fulfilled") {
          for (const [k, v] of r.value) fundMap.set(k, v);
        }
      }
    }

    const krStocks = stocks.filter(s => s.market === "KR");
    const usStocks = stocks.filter(s => s.market === "US");

    const responseData = {
      ok: true,
      fomo: screenFomo(stocks),
      fomoKr: screenFomo(krStocks),
      fomoUs: screenFomo(usStocks),
      value: screenValue(stocks, fundMap),
      high52kr: screenHigh52(krStocks),
      high52us: screenHigh52(usStocks),
      totalStocks: stocks.length,
      asOf: new Date().toISOString(),
    };

    cache = { data: responseData, cachedAt: Date.now() };
    return NextResponse.json({ ...responseData, source: "live" }, {
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
