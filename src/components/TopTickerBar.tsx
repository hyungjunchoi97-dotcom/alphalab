"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface MarketItem {
  type: "INDEX" | "FX" | "COM" | "CRYPTO" | "BOND";
  label: string;
  value: number | null;
  changePct: number | null;
}

interface TickerItem {
  type: "INDEX" | "FX" | "COM" | "CRYPTO" | "BOND";
  label: string;
  value: string;
  changePct: number | null;
}

function formatValue(label: string, value: number): string {
  // Crypto — no decimals for BTC, 2 for ETH
  if (label === "Bitcoin") return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (label === "Ethereum") return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // FX
  if (label === "USD/KRW") return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (label === "USD/JPY") return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (["EUR/USD", "GBP/USD"].includes(label)) return value.toFixed(4);
  // Bonds — yield
  if (label === "US 10Y" || label === "KR 10Y") return value.toFixed(3) + "%";
  // Commodities
  if (["Gold", "Silver", "WTI Oil", "Brent Oil", "Natural Gas", "Copper"].includes(label))
    return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Indices
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TAG_COLORS: Record<string, string> = {
  INDEX: "bg-[#f59e0b] text-black",
  FX: "bg-[#3b82f6] text-white",
  COM: "bg-yellow-500/20 text-yellow-400",
  CRYPTO: "bg-[#8b5cf6] text-white",
  BOND: "bg-cyan-500/20 text-cyan-400",
};

function TickerEntry({ item }: { item: TickerItem }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`rounded px-1 py-px text-[9px] font-semibold uppercase ${TAG_COLORS[item.type] ?? "bg-card-border/60 text-muted"}`}
      >
        {item.type}
      </span>
      <span className="text-[11px] text-foreground">
        {item.label}
      </span>
      {item.value != null && (
        <span className="text-[11px] tabular-nums text-foreground">
          {item.value}
        </span>
      )}
      {item.changePct != null && (
        <span
          className={`text-[11px] tabular-nums font-medium ${
            item.changePct >= 0 ? "text-gain" : "text-loss"
          }`}
        >
          {item.changePct >= 0 ? "+" : ""}
          {item.changePct.toFixed(2)}%
        </span>
      )}
    </span>
  );
}

export default function TopTickerBar() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTicker = useCallback(async () => {
    try {
      const res = await fetch("/api/ticker");
      const json = await res.json();
      if (!json.ok && !json.market) return;

      const tickerItems: TickerItem[] = [];

      if (json.market) {
        for (const m of json.market as MarketItem[]) {
          tickerItems.push({
            type: m.type,
            label: m.label,
            value: m.value != null ? formatValue(m.label, m.value) : "—",
            changePct: m.changePct,
          });
        }
      }

      if (tickerItems.length > 0) {
        setItems(tickerItems);
        setLoaded(true);
      }
    } catch {
      // Keep existing items on error
    }
  }, []);

  useEffect(() => {
    fetchTicker();
    intervalRef.current = setInterval(fetchTicker, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchTicker]);

  if (!loaded && items.length === 0) {
    return (
      <div className="relative overflow-hidden border-b border-card-border/60 bg-background">
        <div className="flex items-center gap-6 px-4 py-1.5">
          <span className="text-[11px] text-muted animate-pulse">Loading market data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden border-b border-card-border/60 bg-background">
      <div className="ticker-scroll flex w-max items-center gap-6 whitespace-nowrap px-4 py-1.5 group-hover:[animation-play-state:paused]">
        {/* Duplicate items for seamless loop */}
        {[...items, ...items].map((item, i) => (
          <TickerEntry key={i} item={item} />
        ))}
      </div>
    </div>
  );
}
