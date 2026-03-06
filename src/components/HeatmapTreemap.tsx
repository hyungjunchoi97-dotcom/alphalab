"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useLang } from "@/lib/LangContext";

// ── Types ────────────────────────────────────────────────────

interface Stock {
  ticker: string;
  name: string;
  nameKr?: string;
  cap: number; // market cap weight
  chg: number; // change %
  price?: string;
}

interface Sector {
  name: string;
  nameKr: string;
  stocks: Stock[];
}

// ── Color helper ────────────────────────────────────────────

function changeToBg(chg: number): string {
  const abs = Math.abs(chg);
  if (chg >= 3) return "#006400";
  if (chg >= 2) return "#0a7a0a";
  if (chg >= 1) return "#1a8c1a";
  if (chg >= 0.5) return "#2d7a2d";
  if (chg > 0) return "#3a6b3a";
  if (chg === 0) return "#3a3a3a";
  if (chg > -0.5) return "#6b3a3a";
  if (chg > -1) return "#7a2d2d";
  if (chg > -2) return "#8c1a1a";
  if (chg > -3) return "#a00a0a";
  return "#b40000";
}

// ── KR Sector Data (50 stocks) ──────────────────────────────

export const KR_SECTORS: Sector[] = [
  {
    name: "Semiconductors", nameKr: "반도체",
    stocks: [
      { ticker: "005930", name: "Samsung", nameKr: "삼성전자", cap: 350, chg: 1.2, price: "72,400" },
      { ticker: "000660", name: "SK Hynix", nameKr: "SK하이닉스", cap: 120, chg: -0.8, price: "178,500" },
      { ticker: "042700", name: "Hanmi Semi", nameKr: "한미반도체", cap: 15, chg: 2.3, price: "62,300" },
      { ticker: "403870", name: "HPSP", nameKr: "HPSP", cap: 12, chg: -1.5, price: "33,200" },
      { ticker: "058470", name: "Leeno", nameKr: "리노공업", cap: 8, chg: 0.7, price: "142,500" },
      { ticker: "340360", name: "DB HiTek", nameKr: "다비아이텍", cap: 7, chg: -0.3, price: "45,600" },
    ],
  },
  {
    name: "Finance", nameKr: "금융",
    stocks: [
      { ticker: "055550", name: "Shinhan FG", nameKr: "신한지주", cap: 25, chg: 0.5, price: "52,800" },
      { ticker: "105560", name: "KB Financial", nameKr: "KB금융", cap: 28, chg: 1.1, price: "78,400" },
      { ticker: "086790", name: "Hana FG", nameKr: "하나금융", cap: 18, chg: -0.2, price: "56,700" },
      { ticker: "316140", name: "Woori FG", nameKr: "우리금융", cap: 12, chg: 0.8, price: "15,200" },
      { ticker: "024110", name: "Industrial BK", nameKr: "기업은행", cap: 10, chg: -0.4, price: "14,800" },
      { ticker: "034730", name: "SK Inc", nameKr: "SK", cap: 15, chg: -1.2, price: "168,000" },
    ],
  },
  {
    name: "Automotive", nameKr: "자동차",
    stocks: [
      { ticker: "005380", name: "Hyundai Motor", nameKr: "현대차", cap: 55, chg: -1.3, price: "218,000" },
      { ticker: "000270", name: "Kia", nameKr: "기아", cap: 40, chg: -0.9, price: "95,600" },
      { ticker: "012330", name: "HMG", nameKr: "현대모비스", cap: 20, chg: 0.4, price: "235,000" },
      { ticker: "161390", name: "Hankook Tire", nameKr: "한국타이어", cap: 8, chg: 1.5, price: "42,100" },
    ],
  },
  {
    name: "Chemicals", nameKr: "화학",
    stocks: [
      { ticker: "051910", name: "LG Chem", nameKr: "LG화학", cap: 30, chg: 0.3, price: "342,000" },
      { ticker: "373220", name: "LG Energy", nameKr: "LG에너지", cap: 85, chg: 2.1, price: "378,000" },
      { ticker: "006400", name: "Samsung SDI", nameKr: "삼성SDI", cap: 25, chg: -2.0, price: "285,000" },
      { ticker: "096770", name: "SK Innovation", nameKr: "SK이노", cap: 12, chg: -0.6, price: "118,500" },
      { ticker: "011170", name: "Lotte Chemical", nameKr: "롯데케미칼", cap: 6, chg: -3.2, price: "82,300" },
    ],
  },
  {
    name: "IT/Internet", nameKr: "IT",
    stocks: [
      { ticker: "035420", name: "Naver", nameKr: "네이버", cap: 45, chg: -1.5, price: "198,000" },
      { ticker: "035720", name: "Kakao", nameKr: "카카오", cap: 25, chg: 0.9, price: "42,300" },
      { ticker: "036570", name: "NC Soft", nameKr: "엔씨소프트", cap: 10, chg: -2.8, price: "168,500" },
      { ticker: "259960", name: "Krafton", nameKr: "크래프톤", cap: 18, chg: 1.4, price: "265,000" },
      { ticker: "263750", name: "Pearl Abyss", nameKr: "펄어비스", cap: 5, chg: 3.5, price: "38,200" },
    ],
  },
  {
    name: "Bio/Pharma", nameKr: "바이오",
    stocks: [
      { ticker: "068270", name: "Celltrion", nameKr: "셀트리온", cap: 35, chg: 1.8, price: "185,000" },
      { ticker: "207940", name: "Samsung Bio", nameKr: "삼성바이오", cap: 50, chg: 0.6, price: "812,000" },
      { ticker: "326030", name: "SK Biopharm", nameKr: "SK바이오팜", cap: 10, chg: -1.1, price: "78,400" },
      { ticker: "145020", name: "Hugel", nameKr: "휴젤", cap: 8, chg: 2.5, price: "165,000" },
      { ticker: "141080", name: "Regen Biotech", nameKr: "레고켐바이오", cap: 6, chg: -0.8, price: "52,600" },
    ],
  },
  {
    name: "Steel/Shipbuilding", nameKr: "철강/조선",
    stocks: [
      { ticker: "005490", name: "POSCO", nameKr: "포스코홀딩스", cap: 30, chg: -0.7, price: "315,000" },
      { ticker: "009540", name: "HD Hyundai", nameKr: "HD현대", cap: 15, chg: 1.9, price: "72,800" },
      { ticker: "329180", name: "HD Korea Shipbuilding", nameKr: "HD한국조선해양", cap: 12, chg: 2.8, price: "165,500" },
      { ticker: "010140", name: "Samsung Heavy", nameKr: "삼성중공업", cap: 8, chg: 1.2, price: "11,850" },
    ],
  },
  {
    name: "Consumer/Retail", nameKr: "소비재",
    stocks: [
      { ticker: "051900", name: "LG H&H", nameKr: "LG생활건강", cap: 12, chg: -1.8, price: "358,000" },
      { ticker: "090430", name: "Amore Pacific", nameKr: "아모레퍼시픽", cap: 8, chg: -2.3, price: "98,700" },
      { ticker: "004990", name: "Lotte", nameKr: "롯데지주", cap: 5, chg: 0.4, price: "28,500" },
      { ticker: "030200", name: "KT", nameKr: "KT", cap: 10, chg: 0.2, price: "38,400" },
      { ticker: "017670", name: "SK Telecom", nameKr: "SK텔레콤", cap: 14, chg: 0.6, price: "53,200" },
      { ticker: "032830", name: "Samsung Life", nameKr: "삼성생명", cap: 12, chg: -0.5, price: "82,300" },
    ],
  },
];

// ── US Sector Data (50 stocks) ──────────────────────────────

const US_SECTORS: Sector[] = [
  {
    name: "Technology", nameKr: "기술",
    stocks: [
      { ticker: "AAPL", name: "Apple", cap: 300, chg: 0.8, price: "$228.50" },
      { ticker: "MSFT", name: "Microsoft", cap: 280, chg: 1.5, price: "$425.80" },
      { ticker: "NVDA", name: "NVIDIA", cap: 250, chg: 3.2, price: "$138.50" },
      { ticker: "AVGO", name: "Broadcom", cap: 80, chg: 1.8, price: "$178.20" },
      { ticker: "ORCL", name: "Oracle", cap: 50, chg: -0.5, price: "$168.40" },
      { ticker: "CRM", name: "Salesforce", cap: 35, chg: -1.2, price: "$268.30" },
      { ticker: "AMD", name: "AMD", cap: 30, chg: 2.5, price: "$118.90" },
      { ticker: "INTC", name: "Intel", cap: 18, chg: -3.1, price: "$22.40" },
    ],
  },
  {
    name: "Communication", nameKr: "커뮤니케이션",
    stocks: [
      { ticker: "GOOGL", name: "Alphabet", cap: 200, chg: -0.3, price: "$178.50" },
      { ticker: "META", name: "Meta", cap: 150, chg: 2.0, price: "$598.20" },
      { ticker: "NFLX", name: "Netflix", cap: 40, chg: 1.2, price: "$925.60" },
      { ticker: "DIS", name: "Disney", cap: 25, chg: -0.8, price: "$112.30" },
      { ticker: "CMCSA", name: "Comcast", cap: 18, chg: 0.3, price: "$38.50" },
    ],
  },
  {
    name: "Consumer", nameKr: "소비재",
    stocks: [
      { ticker: "AMZN", name: "Amazon", cap: 200, chg: -1.1, price: "$198.50" },
      { ticker: "TSLA", name: "Tesla", cap: 85, chg: -2.5, price: "$285.40" },
      { ticker: "HD", name: "Home Depot", cap: 40, chg: 0.7, price: "$392.10" },
      { ticker: "MCD", name: "McDonald's", cap: 30, chg: 0.4, price: "$298.60" },
      { ticker: "NKE", name: "Nike", cap: 18, chg: -1.8, price: "$72.30" },
      { ticker: "SBUX", name: "Starbucks", cap: 15, chg: -0.6, price: "$98.40" },
      { ticker: "COST", name: "Costco", cap: 38, chg: 0.9, price: "$925.80" },
    ],
  },
  {
    name: "Financial", nameKr: "금융",
    stocks: [
      { ticker: "BRK.B", name: "Berkshire", cap: 90, chg: 0.4, price: "$468.20" },
      { ticker: "JPM", name: "JP Morgan", cap: 70, chg: 1.1, price: "$245.80" },
      { ticker: "V", name: "Visa", cap: 55, chg: 0.6, price: "$312.40" },
      { ticker: "MA", name: "Mastercard", cap: 45, chg: 0.8, price: "$528.60" },
      { ticker: "BAC", name: "BofA", cap: 30, chg: -0.3, price: "$42.10" },
      { ticker: "GS", name: "Goldman", cap: 20, chg: 1.5, price: "$585.30" },
    ],
  },
  {
    name: "Healthcare", nameKr: "헬스케어",
    stocks: [
      { ticker: "LLY", name: "Eli Lilly", cap: 80, chg: 1.9, price: "$812.50" },
      { ticker: "UNH", name: "UnitedHealth", cap: 60, chg: -0.5, price: "$528.40" },
      { ticker: "JNJ", name: "J&J", cap: 45, chg: 0.3, price: "$158.90" },
      { ticker: "ABBV", name: "AbbVie", cap: 35, chg: -1.2, price: "$192.30" },
      { ticker: "PFE", name: "Pfizer", cap: 20, chg: -2.1, price: "$25.80" },
      { ticker: "MRK", name: "Merck", cap: 30, chg: 0.7, price: "$98.60" },
    ],
  },
  {
    name: "Energy", nameKr: "에너지",
    stocks: [
      { ticker: "XOM", name: "Exxon", cap: 50, chg: -0.9, price: "$108.50" },
      { ticker: "CVX", name: "Chevron", cap: 35, chg: -0.6, price: "$152.30" },
      { ticker: "COP", name: "ConocoPhillips", cap: 18, chg: -1.4, price: "$98.20" },
      { ticker: "SLB", name: "SLB", cap: 10, chg: 0.5, price: "$42.80" },
    ],
  },
  {
    name: "Industrial", nameKr: "산업재",
    stocks: [
      { ticker: "GE", name: "GE Aero", cap: 30, chg: 1.3, price: "$198.40" },
      { ticker: "CAT", name: "Caterpillar", cap: 25, chg: 0.6, price: "$362.10" },
      { ticker: "RTX", name: "RTX", cap: 20, chg: -0.4, price: "$128.50" },
      { ticker: "BA", name: "Boeing", cap: 15, chg: -2.8, price: "$172.30" },
      { ticker: "HON", name: "Honeywell", cap: 18, chg: 0.2, price: "$212.40" },
      { ticker: "UPS", name: "UPS", cap: 12, chg: -1.5, price: "$128.60" },
    ],
  },
];

// ── JP Sector Data (40+ stocks) ──────────────────────────────

const JP_SECTORS: Sector[] = [
  {
    name: "Technology", nameKr: "기술",
    stocks: [
      { ticker: "6758", name: "Sony", nameKr: "소니", cap: 150, chg: 1.3, price: "¥14,250" },
      { ticker: "6501", name: "Hitachi", nameKr: "히타치", cap: 60, chg: 0.8, price: "¥3,850" },
      { ticker: "6861", name: "Keyence", nameKr: "키엔스", cap: 130, chg: -0.5, price: "¥62,400" },
      { ticker: "6723", name: "Renesas", nameKr: "르네사스", cap: 40, chg: 2.1, price: "¥2,680" },
      { ticker: "6920", name: "Lasertec", nameKr: "레이저텍", cap: 35, chg: -1.8, price: "¥18,900" },
      { ticker: "6857", name: "Advantest", nameKr: "어드밴테스트", cap: 45, chg: 3.0, price: "¥5,420" },
    ],
  },
  {
    name: "Automotive", nameKr: "자동차",
    stocks: [
      { ticker: "7203", name: "Toyota", nameKr: "도요타", cap: 300, chg: 0.5, price: "¥2,780" },
      { ticker: "7267", name: "Honda", nameKr: "혼다", cap: 60, chg: -0.3, price: "¥1,520" },
      { ticker: "7974", name: "Nintendo", nameKr: "닌텐도", cap: 80, chg: 1.8, price: "¥8,250" },
      { ticker: "7269", name: "Suzuki", nameKr: "스즈키", cap: 25, chg: -0.7, price: "¥1,680" },
      { ticker: "7201", name: "Nissan", nameKr: "닛산", cap: 15, chg: -2.5, price: "¥420" },
    ],
  },
  {
    name: "Finance", nameKr: "금융",
    stocks: [
      { ticker: "8306", name: "MUFG", nameKr: "미쓰비시UFJ", cap: 100, chg: 0.9, price: "¥1,820" },
      { ticker: "8316", name: "SMFG", nameKr: "미쓰이스미토모", cap: 60, chg: 0.4, price: "¥3,250" },
      { ticker: "8411", name: "Mizuho", nameKr: "미즈호", cap: 45, chg: -0.2, price: "¥3,180" },
      { ticker: "8766", name: "Tokio Marine", nameKr: "도쿄해상", cap: 50, chg: 1.5, price: "¥5,620" },
      { ticker: "8035", name: "Tokyo Electron", nameKr: "도쿄일렉트론", cap: 90, chg: 2.4, price: "¥24,800" },
    ],
  },
  {
    name: "Consumer", nameKr: "소비재",
    stocks: [
      { ticker: "9983", name: "Fast Retailing", nameKr: "패스트리테일링", cap: 100, chg: -0.4, price: "¥42,500" },
      { ticker: "4452", name: "Kao", nameKr: "가오", cap: 25, chg: 0.3, price: "¥6,280" },
      { ticker: "4911", name: "Shiseido", nameKr: "시세이도", cap: 20, chg: -1.2, price: "¥3,450" },
      { ticker: "2914", name: "JT", nameKr: "일본담배", cap: 40, chg: 0.6, price: "¥4,180" },
      { ticker: "9433", name: "KDDI", nameKr: "KDDI", cap: 45, chg: 0.2, price: "¥4,850" },
    ],
  },
  {
    name: "Industrial", nameKr: "산업재",
    stocks: [
      { ticker: "6301", name: "Komatsu", nameKr: "고마쓰", cap: 35, chg: -0.8, price: "¥4,520" },
      { ticker: "6367", name: "Daikin", nameKr: "다이킨", cap: 55, chg: 0.7, price: "¥22,600" },
      { ticker: "7011", name: "Mitsubishi HI", nameKr: "미쓰비시중공업", cap: 40, chg: 1.9, price: "¥2,180" },
      { ticker: "7751", name: "Canon", nameKr: "캐논", cap: 30, chg: -0.5, price: "¥5,120" },
      { ticker: "4568", name: "Daiichi Sankyo", nameKr: "다이이치산쿄", cap: 70, chg: 1.2, price: "¥4,680" },
    ],
  },
  {
    name: "Healthcare", nameKr: "헬스케어",
    stocks: [
      { ticker: "4523", name: "Eisai", nameKr: "에자이", cap: 25, chg: -2.1, price: "¥5,820" },
      { ticker: "4519", name: "Chugai Pharma", nameKr: "추가이제약", cap: 50, chg: 1.4, price: "¥6,350" },
      { ticker: "4502", name: "Takeda", nameKr: "다케다", cap: 45, chg: 0.3, price: "¥4,120" },
      { ticker: "4578", name: "Otsuka", nameKr: "오츠카", cap: 30, chg: -0.6, price: "¥7,450" },
    ],
  },
];

type Market = "KR" | "US" | "JP";

const MARKET_SECTORS: Record<Market, Sector[]> = {
  KR: KR_SECTORS,
  US: US_SECTORS,
  JP: JP_SECTORS,
};

// ── Tooltip state ──────────────────────────────────────────

interface TooltipData {
  name: string;
  nameKr?: string;
  ticker: string;
  chg: number;
  price?: string;
  x: number;
  y: number;
}

// ── Treemap layout (squarified) ────────────────────────────

interface Rect { x: number; y: number; w: number; h: number; }
interface LayoutItem extends Stock { rect: Rect; }

function squarify(items: { cap: number }[], container: Rect): Rect[] {
  const total = items.reduce((s, i) => s + i.cap, 0);
  if (total === 0 || items.length === 0) return items.map(() => ({ x: 0, y: 0, w: 0, h: 0 }));

  const rects: Rect[] = new Array(items.length);
  const indices = items.map((_, i) => i).sort((a, b) => items[b].cap - items[a].cap);

  let cx = container.x, cy = container.y, cw = container.w, ch = container.h;
  let remaining = total;
  let i = 0;

  while (i < indices.length) {
    const isWide = cw >= ch;
    const side = isWide ? ch : cw;
    const areaScale = (cw * ch) / remaining;

    // Find best row
    let rowArea = 0;
    let bestWorst = Infinity;
    let rowEnd = i;

    for (let j = i; j < indices.length; j++) {
      const newArea = rowArea + items[indices[j]].cap * areaScale;
      const rowLen = newArea / side;
      const minItem = items[indices[j]].cap * areaScale;
      const maxItem = items[indices[i]].cap * areaScale;
      const worst = Math.max(
        (side * side * maxItem) / (newArea * newArea),
        (newArea * newArea) / (side * side * minItem)
      );
      if (worst <= bestWorst) {
        bestWorst = worst;
        rowArea = newArea;
        rowEnd = j + 1;
      } else break;
    }

    // Lay out row
    const rowLen = rowArea / side;
    let offset = 0;
    for (let j = i; j < rowEnd; j++) {
      const itemArea = items[indices[j]].cap * areaScale;
      const itemLen = itemArea / rowLen;
      if (isWide) {
        rects[indices[j]] = { x: cx, y: cy + offset, w: rowLen, h: itemLen };
      } else {
        rects[indices[j]] = { x: cx + offset, y: cy, w: itemLen, h: rowLen };
      }
      offset += itemLen;
    }

    remaining -= rowArea / areaScale;
    if (isWide) { cx += rowLen; cw -= rowLen; }
    else { cy += rowLen; ch -= rowLen; }
    i = rowEnd;
  }

  return rects;
}

// ── Component ──────────────────────────────────────────────

export default function HeatmapTreemap() {
  const [activeMarket, setActiveMarket] = useState<Market>("KR");
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { lang } = useLang();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sectors = MARKET_SECTORS[activeMarket];

  // Calculate total cap for sector-level layout
  const sectorCaps = sectors.map((s) => ({
    cap: s.stocks.reduce((sum, st) => sum + st.cap, 0),
  }));

  const handleMouseMove = useCallback((e: React.MouseEvent, data: TooltipData) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setTooltip({
      ...data,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <div>
      <div className="mb-3 inline-flex gap-px rounded bg-card-border p-px">
        {(["KR", "US", "JP"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setActiveMarket(m); setTooltip(null); }}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              activeMarket === m
                ? "bg-accent text-white"
                : "bg-card-bg text-muted hover:text-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div ref={containerRef} className="relative select-none" style={{ height: 400 }}>
        <SectorTreemap
          sectors={sectors}
          sectorCaps={sectorCaps}
          width={containerWidth}
          height={400}
          lang={lang}
          onHover={handleMouseMove}
          onLeave={handleMouseLeave}
        />

        {/* Tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-50 rounded-lg border border-card-border bg-card-bg px-3 py-2 shadow-xl"
            style={{
              left: Math.min(tooltip.x + 12, (containerRef.current?.clientWidth || 800) - 180),
              top: Math.max(tooltip.y - 60, 0),
            }}
          >
            <div className="text-[11px] font-semibold">
              {lang === "kr" && tooltip.nameKr ? tooltip.nameKr : tooltip.name}
            </div>
            <div className="text-[10px] text-muted">{tooltip.ticker}</div>
            {tooltip.price && (
              <div className="mt-0.5 text-[10px] tabular-nums text-foreground/80">{tooltip.price}</div>
            )}
            <div className={`mt-0.5 text-[11px] font-bold tabular-nums ${tooltip.chg >= 0 ? "text-gain" : "text-loss"}`}>
              {tooltip.chg >= 0 ? "+" : ""}{tooltip.chg.toFixed(2)}%
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 flex justify-end">
        <div className="flex items-center gap-1.5 text-[9px] text-muted">
          <span>-3%</span>
          <div className="flex items-center gap-px">
            {[-3, -2, -1, 0, 1, 2, 3].map((v) => (
              <div
                key={v}
                className="h-2.5 w-5 first:rounded-l last:rounded-r"
                style={{ backgroundColor: changeToBg(v) }}
              />
            ))}
          </div>
          <span>+3%</span>
        </div>
      </div>
    </div>
  );
}

// ── Sector Treemap renderer ────────────────────────────────

function SectorTreemap({
  sectors,
  sectorCaps,
  width,
  height,
  lang,
  onHover,
  onLeave,
}: {
  sectors: Sector[];
  sectorCaps: { cap: number }[];
  width: number;
  height: number;
  lang: "en" | "kr";
  onHover: (e: React.MouseEvent, data: TooltipData) => void;
  onLeave: () => void;
}) {
  if (width <= 0) return null;

  // Layout sectors
  const sectorRects = squarify(sectorCaps, { x: 0, y: 0, w: width, h: height });

  return (
    <svg width={width} height={height} className="block">
      {sectors.map((sector, si) => {
        const sr = sectorRects[si];
        if (!sr || sr.w < 2 || sr.h < 2) return null;

        // Inset for sector border
        const pad = 1;
        const innerRect = { x: sr.x + pad, y: sr.y + pad, w: sr.w - pad * 2, h: sr.h - pad * 2 };

        // Sector label height
        const labelH = innerRect.h > 24 ? 18 : 0;
        const stockRect = { x: innerRect.x, y: innerRect.y + labelH, w: innerRect.w, h: innerRect.h - labelH };

        // Layout stocks within sector
        const stockRects = squarify(
          sector.stocks.map((s) => ({ cap: s.cap })),
          stockRect
        );

        return (
          <g key={sector.name}>
            {/* Sector background */}
            <rect x={sr.x} y={sr.y} width={sr.w} height={sr.h} fill="#1a1a1a" stroke="#0b0f14" strokeWidth={2} />

            {/* Sector label */}
            {labelH > 0 && innerRect.w > 30 && (
              <text
                x={innerRect.x + 5}
                y={innerRect.y + 13}
                fill="#aaa"
                fontSize={12}
                fontWeight={700}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                {lang === "kr" ? sector.nameKr : sector.name}
              </text>
            )}

            {/* Stock cells */}
            {sector.stocks.map((stock, idx) => {
              const r = stockRects[idx];
              if (!r || r.w < 1 || r.h < 1) return null;

              const showName = r.w > 30 && r.h > 18;
              const showChg = r.w > 30 && r.h > 30;
              const displayName = lang === "kr" && stock.nameKr ? stock.nameKr : stock.name;

              return (
                <g
                  key={stock.ticker}
                  onMouseMove={(e) => onHover(e, {
                    name: stock.name,
                    nameKr: stock.nameKr,
                    ticker: stock.ticker,
                    chg: stock.chg,
                    price: stock.price,
                    x: 0, y: 0,
                  })}
                  onMouseLeave={onLeave}
                  className="cursor-pointer"
                >
                  <rect
                    x={r.x}
                    y={r.y}
                    width={r.w}
                    height={r.h}
                    fill={changeToBg(stock.chg)}
                    stroke="#0b0f14"
                    strokeWidth={1}
                  />
                  {showName && (
                    <text
                      x={r.x + r.w / 2}
                      y={r.y + r.h / 2 + (showChg ? -4 : 4)}
                      textAnchor="middle"
                      fill="#fff"
                      fontSize={r.w > 70 ? 10 : 8}
                      fontWeight={700}
                      fontFamily="ui-sans-serif, system-ui, sans-serif"
                    >
                      {displayName}
                    </text>
                  )}
                  {showChg && (
                    <text
                      x={r.x + r.w / 2}
                      y={r.y + r.h / 2 + (showName ? 8 : 4)}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.9)"
                      fontSize={r.w > 60 ? 10 : 8}
                      fontWeight={600}
                      fontFamily="ui-monospace, monospace"
                    >
                      {stock.chg >= 0 ? "+" : ""}{stock.chg.toFixed(1)}%
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
