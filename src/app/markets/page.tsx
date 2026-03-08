"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import AppHeader from "@/components/AppHeader";

// ── Types ────────────────────────────────────────────────────

interface SectorDef {
  id: string;
  label: string;
  stocks: { symbol: string; name: string }[];
  metric: { label: string; value: string; color?: string };
}

// ── Sector Definitions ──────────────────────────────────────

const SECTORS: SectorDef[] = [
  {
    id: "semi",
    label: "AI SEMICONDUCTORS",
    stocks: [
      { symbol: "NVDA", name: "NVIDIA" },
      { symbol: "AMD", name: "AMD" },
      { symbol: "MU", name: "Micron" },
      { symbol: "TSM", name: "TSMC" },
      { symbol: "ASML", name: "ASML" },
      { symbol: "WDC", name: "Western Digital" },
      { symbol: "KRX:005930", name: "Samsung" },
      { symbol: "KRX:000660", name: "SK Hynix" },
      { symbol: "KRX:042700", name: "Hanmi Semi" },
    ],
    metric: { label: "HBM CYCLE POSITION", value: "EXPANSION", color: "#4ade80" },
  },
  {
    id: "tesla",
    label: "TESLA & MOBILITY",
    stocks: [
      { symbol: "TSLA", name: "Tesla" },
      { symbol: "RIVN", name: "Rivian" },
      { symbol: "TSLL", name: "TSLL 2x" },
      { symbol: "LCID", name: "Lucid" },
    ],
    metric: { label: "NEXT EARNINGS", value: "Q2 2025" },
  },
  {
    id: "mag7",
    label: "BIG TECH / MAG7",
    stocks: [
      { symbol: "AAPL", name: "Apple" },
      { symbol: "MSFT", name: "Microsoft" },
      { symbol: "GOOGL", name: "Alphabet" },
      { symbol: "META", name: "Meta" },
      { symbol: "AMZN", name: "Amazon" },
      { symbol: "QQQ", name: "QQQ ETF" },
      { symbol: "KRX:035420", name: "NAVER" },
      { symbol: "KRX:035720", name: "Kakao" },
    ],
    metric: { label: "AI CAPEX TRACKER", value: "$325B", color: "#f59e0b" },
  },
  {
    id: "aisw",
    label: "AI SOFTWARE",
    stocks: [
      { symbol: "PLTR", name: "Palantir" },
      { symbol: "IONQ", name: "IonQ" },
      { symbol: "SOUN", name: "SoundHound" },
      { symbol: "AI", name: "C3.ai" },
      { symbol: "PATH", name: "UiPath" },
    ],
    metric: { label: "CONTRACT MOMENTUM", value: "14 deals/30d", color: "#4ade80" },
  },
  {
    id: "optical",
    label: "OPTICAL & INFRA",
    stocks: [
      { symbol: "LITE", name: "Lumentum" },
      { symbol: "COHR", name: "Coherent" },
      { symbol: "SMCI", name: "Super Micro" },
      { symbol: "ARM", name: "Arm Holdings" },
      { symbol: "CIEN", name: "Ciena" },
    ],
    metric: { label: "DC POWER DEMAND", value: "+34% YoY", color: "#4ade80" },
  },
  {
    id: "quantum",
    label: "QUANTUM",
    stocks: [
      { symbol: "IONQ", name: "IonQ" },
      { symbol: "RGTI", name: "Rigetti" },
      { symbol: "QUBT", name: "Quantum Computing" },
      { symbol: "QCOM", name: "Qualcomm" },
      { symbol: "IBM", name: "IBM" },
    ],
    metric: { label: "NEXT MILESTONE", value: "2027" },
  },
  {
    id: "ship",
    label: "SHIPBUILDING",
    stocks: [
      { symbol: "KRX:329180", name: "HD Hyundai Heavy" },
      { symbol: "KRX:042660", name: "Hanwha Ocean" },
      { symbol: "KRX:010140", name: "Samsung Heavy" },
      { symbol: "KRX:009540", name: "HD Korea Shipbuilding" },
    ],
    metric: { label: "CLARKSONS INDEX", value: "188.4", color: "#4ade80" },
  },
  {
    id: "defense",
    label: "DEFENSE",
    stocks: [
      { symbol: "KRX:012450", name: "Hanwha Aerospace" },
      { symbol: "KRX:079550", name: "LIG Nex1" },
      { symbol: "KRX:064350", name: "Hyundai Rotem" },
      { symbol: "RTX", name: "RTX Corp" },
      { symbol: "LMT", name: "Lockheed Martin" },
      { symbol: "NOC", name: "Northrop Grumman" },
    ],
    metric: { label: "NATO 2% TARGET", value: "23/32", color: "#f59e0b" },
  },
];

// ── TradingView Mini Symbol Widget ──────────────────────────

function TVMiniSymbol({
  symbol,
  name,
  onClick,
}: {
  symbol: string;
  name: string;
  onClick: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetLoaded = useRef(false);

  useEffect(() => {
    if (!containerRef.current || widgetLoaded.current) return;
    widgetLoaded.current = true;

    const container = containerRef.current;
    container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    wrapper.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.async = true;
    script.type = "text/javascript";
    script.textContent = JSON.stringify({
      symbol,
      width: "100%",
      height: "100%",
      locale: "en",
      dateRange: "1M",
      colorTheme: "dark",
      isTransparent: true,
      autosize: true,
      largeChartUrl: "",
      noTimeScale: false,
      chartOnly: false,
    });
    wrapper.appendChild(script);
    container.appendChild(wrapper);

    return () => {
      if (container) container.innerHTML = "";
      widgetLoaded.current = false;
    };
  }, [symbol]);

  return (
    <button
      onClick={onClick}
      className="group relative w-full h-[180px] rounded border border-[#1a1a1a] bg-[#080808] overflow-hidden transition-colors hover:border-[#333] cursor-pointer text-left"
    >
      <div className="absolute top-0 left-0 right-0 z-10 px-2.5 pt-2 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono font-bold tracking-widest text-amber-400 uppercase">
            {symbol.replace("KRX:", "")}
          </span>
          <span className="ml-1.5 text-[10px] text-[#555]">{name}</span>
        </div>
      </div>
      <div ref={containerRef} className="w-full h-full" />
    </button>
  );
}

// ── TradingView Advanced Chart Modal ────────────────────────

function ChartModal({
  symbol,
  name,
  onClose,
}: {
  symbol: string;
  name: string;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container";
    wrapper.style.height = "100%";
    wrapper.style.width = "100%";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "calc(100% - 32px)";
    widgetDiv.style.width = "100%";
    wrapper.appendChild(widgetDiv);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.textContent = JSON.stringify({
      autosize: true,
      symbol,
      interval: "D",
      timezone: "Asia/Seoul",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "#050505",
      gridColor: "#111111",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });
    wrapper.appendChild(script);
    container.appendChild(wrapper);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-[95vw] h-[85vh] max-w-[1400px] rounded border border-[#1a1a1a] bg-[#050505] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold tracking-widest text-amber-400">
              {symbol.replace("KRX:", "")}
            </span>
            <span className="text-xs text-[#666]">{name}</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#555] hover:text-white text-sm font-mono px-2 py-1 transition-colors"
          >
            ESC
          </button>
        </div>
        {/* Chart */}
        <div ref={containerRef} className="w-full" style={{ height: "calc(100% - 44px)" }} />
      </div>
    </div>
  );
}

// ── Metric Card ─────────────────────────────────────────────

function MetricCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded border border-[#1a1a1a] bg-[#080808] px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#555]">
          {label}
        </span>
      </div>
      <p
        className="text-xl font-mono font-bold tracking-tight"
        style={{ color: color || "#e5e7eb" }}
      >
        {value}
      </p>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────

export default function MarketsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [chartModal, setChartModal] = useState<{
    symbol: string;
    name: string;
  } | null>(null);

  const sector = SECTORS[activeTab];

  const openChart = useCallback(
    (symbol: string, name: string) => {
      setChartModal({ symbol, name });
    },
    []
  );

  const closeChart = useCallback(() => {
    setChartModal(null);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505]">
      <AppHeader active="markets" />

      <main className="mx-auto max-w-[1400px] px-4 py-5 space-y-4">
        {/* Sector tabs - scrollable */}
        <div className="flex gap-px overflow-x-auto pb-1 scrollbar-hide">
          {SECTORS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActiveTab(i)}
              className={`shrink-0 px-3 py-2 text-[10px] font-mono font-bold tracking-widest transition-colors whitespace-nowrap ${
                activeTab === i
                  ? "bg-white text-black"
                  : "border border-[#1a1a1a] text-[#555] hover:text-white hover:border-[#333]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Section header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-white">
              {sector.label}
            </h2>
            <span className="text-[10px] text-[#444] font-mono">
              {sector.stocks.length} INSTRUMENTS
            </span>
          </div>
        </div>

        {/* Key metric */}
        <MetricCard
          label={sector.metric.label}
          value={sector.metric.value}
          color={sector.metric.color}
        />

        {/* Stock grid with TradingView widgets */}
        <SectorGrid
          key={sector.id}
          stocks={sector.stocks}
          onStockClick={openChart}
        />
      </main>

      {/* Chart modal */}
      {chartModal && (
        <ChartModal
          symbol={chartModal.symbol}
          name={chartModal.name}
          onClose={closeChart}
        />
      )}
    </div>
  );
}

// ── Sector Grid (memoized to prevent re-render on tab switch) ─

function SectorGrid({
  stocks,
  onStockClick,
}: {
  stocks: { symbol: string; name: string }[];
  onStockClick: (symbol: string, name: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {stocks.map((s) => (
        <TVMiniSymbol
          key={s.symbol}
          symbol={s.symbol}
          name={s.name}
          onClick={() => onStockClick(s.symbol, s.name)}
        />
      ))}
    </div>
  );
}
