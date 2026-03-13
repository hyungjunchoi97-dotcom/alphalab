"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface QuoteResult {
  price: number;
  change: number;
  changePct: number;
}

interface MarketData {
  sp500: QuoteResult | null;
  nasdaq: QuoteResult | null;
  dow: QuoteResult | null;
  kospi: QuoteResult | null;
  kosdaq: QuoteResult | null;
  usdkrw: QuoteResult | null;
  dxy: QuoteResult | null;
  gold: QuoteResult | null;
  silver: QuoteResult | null;
  wti: QuoteResult | null;
  btc: QuoteResult | null;
  eth: QuoteResult | null;
  tenYear: QuoteResult | null;
  vix: QuoteResult | null;
  copper: QuoteResult | null;
  fearGreed: { score: number; rating: string };
  fgFetchedAt: string;
  asOf: string;
}

// Map /api/ticker label -> MarketData key
const LABEL_TO_KEY: Record<string, keyof MarketData> = {
  "S&P 500": "sp500",
  "NASDAQ": "nasdaq",
  "DOW": "dow",
  "KOSPI": "kospi",
  "KOSDAQ": "kosdaq",
  "USD/KRW": "usdkrw",
  "DXY": "dxy",
  "Gold": "gold",
  "Silver": "silver",
  "WTI Oil": "wti",
  "Copper": "copper",
  "Bitcoin": "btc",
  "Ethereum": "eth",
  "US 10Y": "tenYear",
  "VIX": "vix",
};

function tileBg(chg: number): string {
  if (chg > 0) return chg >= 2 ? "#0a4a0a" : chg >= 1 ? "#0d3d0d" : "#123312";
  if (chg < 0) return chg <= -2 ? "#4a0a0a" : chg <= -1 ? "#3d0d0d" : "#331212";
  return "#1a1a1a";
}

function fmtPrice(price: number, key: string): string {
  if (key === "btc" || key === "eth") return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (key === "usdkrw") return price.toFixed(1);
  if (key === "tenYear" || key === "vix") return price.toFixed(2);
  if (key === "kospi" || key === "kosdaq") return price.toFixed(2);
  if (key === "dow") return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface TileConfig { key: string; label: string }

const ROW1: TileConfig[] = [
  { key: "sp500", label: "S&P500" },
  { key: "nasdaq", label: "나스닥" },
  { key: "dow", label: "DOW" },
  { key: "kospi", label: "KOSPI" },
  { key: "kosdaq", label: "KOSDAQ" },
  { key: "usdkrw", label: "원/달러" },
  { key: "dxy", label: "DXY" },
];

const ROW2: TileConfig[] = [
  { key: "tenYear", label: "US10Y" },
  { key: "vix", label: "VIX" },
  { key: "gold", label: "금" },
  { key: "silver", label: "은" },
  { key: "wti", label: "WTI" },
  { key: "copper", label: "구리" },
  { key: "btc", label: "BTC" },
  { key: "eth", label: "ETH" },
];

export { type MarketData };

export default function MarketOverview({ onData }: { onData?: (d: MarketData) => void }) {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onDataRef = useRef(onData);
  onDataRef.current = onData;

  const fetchTicker = useCallback(async () => {
    try {
      const res = await fetch("/api/ticker");
      const json = await res.json();
      if (!json.ok && !json.market) throw new Error();

      const quotes: Record<string, QuoteResult | null> = {};
      for (const m of json.market ?? []) {
        const key = LABEL_TO_KEY[m.label];
        if (key) {
          quotes[key as string] = {
            price: m.value ?? 0,
            change: 0,
            changePct: m.changePct ?? 0,
          };
        }
      }

      setData(prev => {
        const next: MarketData = {
          sp500: (quotes.sp500 as QuoteResult) ?? null,
          nasdaq: (quotes.nasdaq as QuoteResult) ?? null,
          dow: (quotes.dow as QuoteResult) ?? null,
          kospi: (quotes.kospi as QuoteResult) ?? null,
          kosdaq: (quotes.kosdaq as QuoteResult) ?? null,
          usdkrw: (quotes.usdkrw as QuoteResult) ?? null,
          dxy: (quotes.dxy as QuoteResult) ?? null,
          gold: (quotes.gold as QuoteResult) ?? null,
          silver: (quotes.silver as QuoteResult) ?? null,
          wti: (quotes.wti as QuoteResult) ?? null,
          btc: (quotes.btc as QuoteResult) ?? null,
          eth: (quotes.eth as QuoteResult) ?? null,
          tenYear: (quotes.tenYear as QuoteResult) ?? null,
          vix: (quotes.vix as QuoteResult) ?? null,
          copper: (quotes.copper as QuoteResult) ?? null,
          fearGreed: prev?.fearGreed ?? { score: 0, rating: "" },
          fgFetchedAt: prev?.fgFetchedAt ?? "",
          asOf: json.asOf ?? new Date().toISOString(),
        };
        onDataRef.current?.(next);
        return next;
      });
      setFetchError(false);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFearGreed = useCallback(async () => {
    try {
      const res = await fetch("/api/macro/fear-greed");
      const json = await res.json();
      if (json.ok && json.data) {
        setData(prev => {
          if (!prev) return prev;
          const next = {
            ...prev,
            fearGreed: { score: json.data.score, rating: json.data.rating ?? "" },
            fgFetchedAt: new Date().toISOString(),
          };
          onDataRef.current?.(next);
          return next;
        });
      }
    } catch { /* keep existing */ }
  }, []);

  useEffect(() => {
    fetchTicker();
    fetchFearGreed();
    intervalRef.current = setInterval(fetchTicker, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchTicker, fetchFearGreed]);

  if (loading) {
    return (
      <div className="space-y-1">
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded bg-[#1a1a1a] h-[52px]" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-[10px] text-[#555] text-center py-4 font-mono">—</div>;

  const asOfTime = data.asOf
    ? new Date(data.asOf).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    : null;

  const renderRow = (tiles: TileConfig[]) => (
    <div className={`grid gap-1`} style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
      {tiles.map((tile) => {
        const quote = data[tile.key as keyof MarketData] as QuoteResult | null;
        if (!quote) {
          return (
            <div key={tile.key} className="h-[52px] rounded bg-[#111] flex flex-col items-center justify-center">
              <span className="text-[9px] text-[#444]">{tile.label}</span>
              <span className="text-[9px] text-[#333]">—</span>
            </div>
          );
        }
        const chg = quote.changePct;
        return (
          <div
            key={tile.key}
            className="h-[52px] rounded flex flex-col items-center justify-center"
            style={{ background: tileBg(chg) }}
          >
            <span className="text-[9px] text-gray-400 leading-none">{tile.label}</span>
            <span className="text-xs font-bold tabular-nums font-mono text-white mt-0.5 leading-none">
              {fmtPrice(quote.price, tile.key)}
            </span>
            <span className={`text-[10px] font-medium tabular-nums font-mono mt-0.5 leading-none ${chg >= 0 ? "text-green-400" : "text-red-400"}`}>
              {chg >= 0 ? "+" : ""}{chg.toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-1">
      {renderRow(ROW1)}
      {renderRow(ROW2)}
      {/* Timestamp + error + disclaimer */}
      <div className="flex items-center justify-between pt-0.5">
        <span className="text-[9px]" style={{ color: "#444" }}>
          Yahoo Finance 기준 · 최대 15분 지연
        </span>
        <div className="flex items-center gap-2">
          {fetchError && (
            <span className="text-[9px] font-medium" style={{ color: "#f87171" }}>⚠ 업데이트 실패</span>
          )}
          {asOfTime && (
            <span className="text-[9px] tabular-nums font-mono" style={{ color: fetchError ? "#555" : "#666" }}>
              {asOfTime} 기준
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
