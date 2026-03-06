"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useLang } from "@/lib/LangContext";

// ── Types ────────────────────────────────────────────────────

interface Stock {
  ticker: string;
  name: string;
  nameKr?: string;
  cap: number;
  chg: number;
  price?: string;
}

interface Sector {
  name: string;
  nameKr: string;
  stocks: Stock[];
}

// ── Color helper ────────────────────────────────────────────

function changeToBg(chg: number): string {
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

// ── US Sector Data (static for now) ──────────────────────────

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
    ],
  },
];

// ── JP Sector Data (static for now) ──────────────────────────

const JP_SECTORS: Sector[] = [
  {
    name: "Technology", nameKr: "기술",
    stocks: [
      { ticker: "6758", name: "Sony", nameKr: "소니", cap: 150, chg: 1.3, price: "¥14,250" },
      { ticker: "6501", name: "Hitachi", nameKr: "히타치", cap: 60, chg: 0.8, price: "¥3,850" },
      { ticker: "6861", name: "Keyence", nameKr: "키엔스", cap: 130, chg: -0.5, price: "¥62,400" },
      { ticker: "6857", name: "Advantest", nameKr: "어드밴테스트", cap: 45, chg: 3.0, price: "¥5,420" },
    ],
  },
  {
    name: "Automotive", nameKr: "자동차",
    stocks: [
      { ticker: "7203", name: "Toyota", nameKr: "도요타", cap: 300, chg: 0.5, price: "¥2,780" },
      { ticker: "7267", name: "Honda", nameKr: "혼다", cap: 60, chg: -0.3, price: "¥1,520" },
      { ticker: "7974", name: "Nintendo", nameKr: "닌텐도", cap: 80, chg: 1.8, price: "¥8,250" },
      { ticker: "7201", name: "Nissan", nameKr: "닛산", cap: 15, chg: -2.5, price: "¥420" },
    ],
  },
  {
    name: "Finance", nameKr: "금융",
    stocks: [
      { ticker: "8306", name: "MUFG", nameKr: "미쓰비시UFJ", cap: 100, chg: 0.9, price: "¥1,820" },
      { ticker: "8316", name: "SMFG", nameKr: "미쓰이스미토모", cap: 60, chg: 0.4, price: "¥3,250" },
      { ticker: "8035", name: "Tokyo Electron", nameKr: "도쿄일렉트론", cap: 90, chg: 2.4, price: "¥24,800" },
    ],
  },
  {
    name: "Consumer", nameKr: "소비재",
    stocks: [
      { ticker: "9983", name: "Fast Retailing", nameKr: "패스트리테일링", cap: 100, chg: -0.4, price: "¥42,500" },
      { ticker: "2914", name: "JT", nameKr: "일본담배", cap: 40, chg: 0.6, price: "¥4,180" },
      { ticker: "9433", name: "KDDI", nameKr: "KDDI", cap: 45, chg: 0.2, price: "¥4,850" },
    ],
  },
  {
    name: "Industrial", nameKr: "산업재",
    stocks: [
      { ticker: "6367", name: "Daikin", nameKr: "다이킨", cap: 55, chg: 0.7, price: "¥22,600" },
      { ticker: "7011", name: "Mitsubishi HI", nameKr: "미쓰비시중공업", cap: 40, chg: 1.9, price: "¥2,180" },
      { ticker: "4568", name: "Daiichi Sankyo", nameKr: "다이이치산쿄", cap: 70, chg: 1.2, price: "¥4,680" },
    ],
  },
  {
    name: "Healthcare", nameKr: "헬스케어",
    stocks: [
      { ticker: "4519", name: "Chugai Pharma", nameKr: "추가이제약", cap: 50, chg: 1.4, price: "¥6,350" },
      { ticker: "4502", name: "Takeda", nameKr: "다케다", cap: 45, chg: 0.3, price: "¥4,120" },
    ],
  },
];

type Market = "KR" | "US" | "JP";

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

  // Live KR data
  const [krSectors, setKrSectors] = useState<Sector[]>([]);
  const [krLoading, setKrLoading] = useState(true);
  const [krAsOf, setKrAsOf] = useState<string>("");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fetch live KR heatmap data
  useEffect(() => {
    let cancelled = false;
    async function fetchKr() {
      try {
        const res = await fetch("/api/krx/heatmap");
        const json = await res.json();
        if (!cancelled && json.ok) {
          setKrSectors(json.sectors);
          setKrAsOf(json.asOf);
        }
      } catch { /* */ }
      finally { if (!cancelled) setKrLoading(false); }
    }
    fetchKr();
    const id = setInterval(fetchKr, 10 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const sectors = activeMarket === "KR"
    ? krSectors
    : activeMarket === "US"
      ? US_SECTORS
      : JP_SECTORS;

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

  const isLoading = activeMarket === "KR" && krLoading;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="inline-flex gap-px rounded bg-card-border p-px">
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
        {activeMarket === "KR" && krAsOf && (
          <span className="text-[9px] text-muted tabular-nums">
            {new Date(krAsOf).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        {activeMarket !== "KR" && (
          <span className="text-[9px] text-muted">(sample)</span>
        )}
      </div>

      <div ref={containerRef} className="relative select-none" style={{ height: 400 }}>
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-xs text-muted animate-pulse">Loading live data...</span>
          </div>
        ) : sectors.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-xs text-muted">No data available</span>
          </div>
        ) : (
          <SectorTreemap
            sectors={sectors}
            sectorCaps={sectorCaps}
            width={containerWidth}
            height={400}
            lang={lang}
            onHover={handleMouseMove}
            onLeave={handleMouseLeave}
          />
        )}

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

  const sectorRects = squarify(sectorCaps, { x: 0, y: 0, w: width, h: height });

  return (
    <svg width={width} height={height} className="block">
      {sectors.map((sector, si) => {
        const sr = sectorRects[si];
        if (!sr || sr.w < 2 || sr.h < 2) return null;

        const pad = 1;
        const innerRect = { x: sr.x + pad, y: sr.y + pad, w: sr.w - pad * 2, h: sr.h - pad * 2 };
        const labelH = innerRect.h > 24 ? 18 : 0;
        const stockRect = { x: innerRect.x, y: innerRect.y + labelH, w: innerRect.w, h: innerRect.h - labelH };

        const stockRects = squarify(
          sector.stocks.map((s) => ({ cap: s.cap })),
          stockRect
        );

        return (
          <g key={sector.name}>
            <rect x={sr.x} y={sr.y} width={sr.w} height={sr.h} fill="#1a1a1a" stroke="#0b0f14" strokeWidth={2} />

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
