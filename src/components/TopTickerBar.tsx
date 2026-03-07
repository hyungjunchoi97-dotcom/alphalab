"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface MarketItem {
  type: "INDEX" | "FX" | "COM";
  label: string;
  value: number | null;
  changePct: number | null;
}

interface NewsItem {
  type: "NEWS";
  label: string;
}

type TickerItem =
  | { type: "INDEX" | "FX" | "COM"; label: string; value: string; changePct: number | null }
  | { type: "NEWS"; label: string };

function formatValue(label: string, value: number): string {
  if (label === "Bitcoin") return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (label === "USD/KRW") return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (["Gold", "WTI Oil"].includes(label)) return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Indices
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TickerEntry({ item }: { item: TickerItem }) {
  const inner = (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`rounded px-1 py-px text-[9px] font-semibold uppercase ${
          item.type === "NEWS"
            ? "bg-accent/15 text-accent"
            : "bg-card-border/60 text-muted"
        }`}
      >
        {item.type}
      </span>
      <span className={`text-[11px] ${item.type === "NEWS" ? "text-accent" : "text-foreground"}`}>
        {item.label}
      </span>
      {"value" in item && item.value != null && (
        <span className="text-[11px] tabular-nums text-foreground">
          {item.value}
        </span>
      )}
      {"changePct" in item && item.changePct != null && (
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

  return inner;
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

      // Market data
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

      // News items
      if (json.news) {
        for (const n of json.news as NewsItem[]) {
          tickerItems.push({ type: "NEWS", label: n.label });
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

  // Show nothing until first load (avoids flash of empty bar)
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
