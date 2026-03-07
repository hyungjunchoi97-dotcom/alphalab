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

  // Live data for each market
  const [krSectors, setKrSectors] = useState<Sector[]>([]);
  const [krLoading, setKrLoading] = useState(true);
  const [krAsOf, setKrAsOf] = useState<string>("");

  const [usSectors, setUsSectors] = useState<Sector[]>([]);
  const [usLoading, setUsLoading] = useState(true);
  const [usAsOf, setUsAsOf] = useState<string>("");

  const [jpSectors, setJpSectors] = useState<Sector[]>([]);
  const [jpLoading, setJpLoading] = useState(true);
  const [jpAsOf, setJpAsOf] = useState<string>("");

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

  // Fetch live US heatmap data
  useEffect(() => {
    let cancelled = false;
    async function fetchUs() {
      try {
        const res = await fetch("/api/heatmap?market=us");
        const json = await res.json();
        if (!cancelled && json.ok) {
          setUsSectors(json.sectors);
          setUsAsOf(json.asOf);
        }
      } catch { /* */ }
      finally { if (!cancelled) setUsLoading(false); }
    }
    fetchUs();
    const id = setInterval(fetchUs, 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Fetch live JP heatmap data
  useEffect(() => {
    let cancelled = false;
    async function fetchJp() {
      try {
        const res = await fetch("/api/heatmap?market=jp");
        const json = await res.json();
        if (!cancelled && json.ok) {
          setJpSectors(json.sectors);
          setJpAsOf(json.asOf);
        }
      } catch { /* */ }
      finally { if (!cancelled) setJpLoading(false); }
    }
    fetchJp();
    const id = setInterval(fetchJp, 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const sectors = activeMarket === "KR" ? krSectors : activeMarket === "US" ? usSectors : jpSectors;
  const asOf = activeMarket === "KR" ? krAsOf : activeMarket === "US" ? usAsOf : jpAsOf;
  const isLoading = activeMarket === "KR" ? krLoading : activeMarket === "US" ? usLoading : jpLoading;

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
        {asOf && (
          <span className="text-[9px] text-muted tabular-nums">
            {new Date(asOf).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      <div ref={containerRef} className="relative select-none" style={{ height: 400 }}>
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="grid grid-cols-4 gap-1">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded"
                    style={{
                      width: 40 + Math.random() * 40,
                      height: 30 + Math.random() * 20,
                      backgroundColor: `hsl(0 0% ${15 + Math.random() * 10}%)`,
                      animationDelay: `${i * 0.05}s`,
                    }}
                  />
                ))}
              </div>
              <span className="text-xs text-muted animate-pulse">Loading live data...</span>
            </div>
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
