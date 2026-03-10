"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLang } from "@/lib/LangContext";

interface MoverItem {
  code: string;
  name: string;
  price: number;
  changeRate: number;
  volume: number;
  tradingValue: number;
}

function formatPrice(price: number): string {
  return price.toLocaleString("ko-KR");
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(1) + "M";
  if (vol >= 1_000) return (vol / 1_000).toFixed(0) + "K";
  return vol.toLocaleString();
}

function MoverTable({
  title,
  data,
  lang,
}: {
  title: string;
  data: MoverItem[];
  lang: "en" | "kr";
}) {
  return (
    <div>
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="sticky top-0 border-b border-card-border bg-card-bg text-left text-[10px] uppercase tracking-wider text-muted">
              <th className="w-6 pb-1">#</th>
              <th className="pb-1">{lang === "kr" ? "종목" : "Name"}</th>
              <th className="pb-1 text-right">{lang === "kr" ? "가격" : "Price"}</th>
              <th className="pb-1 text-right">{lang === "kr" ? "등락" : "Chg%"}</th>
              <th className="pb-1 text-right">{lang === "kr" ? "거래량" : "Volume"}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((m, i) => (
              <tr
                key={m.code}
                className="border-b border-card-border/30 hover:bg-card-border/20"
              >
                <td className="py-1 font-mono text-muted">{i + 1}</td>
                <td className="py-1">
                  <div className="flex flex-col">
                    <span className="truncate">{m.name}</span>
                    <span className="text-[9px] text-muted">{m.code}</span>
                  </div>
                </td>
                <td className="py-1 text-right font-mono tabular-nums">
                  {formatPrice(m.price)}
                </td>
                <td
                  className={`py-1 text-right tabular-nums font-medium ${
                    m.changeRate >= 0 ? "text-gain" : "text-loss"
                  }`}
                >
                  {m.changeRate >= 0 ? "+" : ""}
                  {m.changeRate.toFixed(2)}%
                </td>
                <td className="py-1 text-right tabular-nums text-muted">
                  {formatVolume(m.volume)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function KoreaMovers() {
  const { lang } = useLang();
  const [gainers, setGainers] = useState<MoverItem[]>([]);
  const [losers, setLosers] = useState<MoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [asOf, setAsOf] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [totalGainers, setTotalGainers] = useState(0);
  const [totalLosers, setTotalLosers] = useState(0);
  const [showCount, setShowCount] = useState(60);

  const [stale, setStale] = useState(false);
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  const hasDataRef = useRef(false);

  const fetchMovers = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await fetch("/api/krx/movers");
      const json = await res.json();
      console.log("[KoreaMovers] API response:", { ok: json.ok, source: json.source, asOf: json.asOf, gainers: json.topGainers?.length, losers: json.topLosers?.length });
      if (json.ok || json.topGainers) {
        setGainers(json.topGainers || []);
        setLosers(json.topLosers || []);
        setTotalGainers(json.totalGainers || 0);
        setTotalLosers(json.totalLosers || 0);
        hasDataRef.current = (json.topGainers?.length || 0) > 0;

        if (json.asOf) {
          const y = json.asOf.slice(0, 4);
          const m = json.asOf.slice(4, 6);
          const d = json.asOf.slice(6, 8);
          setAsOf(`${y}.${m}.${d}`);
        }
        setSource(json.source || "");
        setStale(json.source === "stale-cache");
        setIsMarketOpen(!!json.isMarketOpen);
      } else {
        if (hasDataRef.current) setStale(true);
      }
    } catch {
      if (hasDataRef.current) setStale(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMovers();
  }, [fetchMovers]);

  // Auto-refresh: every 60s during market hours, every 10min after close
  useEffect(() => {
    const interval = isMarketOpen ? 60_000 : 10 * 60_000;
    const id = setInterval(() => fetchMovers(true), interval);
    return () => clearInterval(id);
  }, [fetchMovers, isMarketOpen]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1].map((col) => (
          <div key={col} className="space-y-2">
            <div className="h-4 w-24 rounded bg-card-border/30 animate-pulse" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <div className="h-3 w-4 rounded bg-card-border/20 animate-pulse" />
                <div className="h-3 flex-1 rounded bg-card-border/20 animate-pulse" />
                <div className="h-3 w-16 rounded bg-card-border/20 animate-pulse" />
                <div className="h-3 w-12 rounded bg-card-border/20 animate-pulse" />
                <div className="h-3 w-12 rounded bg-card-border/20 animate-pulse" />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  const displayGainers = gainers.slice(0, showCount);
  const displayLosers = losers.slice(0, showCount);
  const hasMore = showCount < gainers.length || showCount < losers.length;

  return (
    <div>
      {/* Count summary */}
      {(totalGainers > 0 || totalLosers > 0) && (
        <div className="mb-3 flex items-center gap-2 text-[11px]">
          <span className="text-gain font-medium">
            {lang === "kr" ? `상승 ${totalGainers}종목` : `${totalGainers} Gainers`}
          </span>
          <span className="text-muted">/</span>
          <span className="text-loss font-medium">
            {lang === "kr" ? `하락 ${totalLosers}종목` : `${totalLosers} Losers`}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="max-h-[600px] overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
          <MoverTable
            title={lang === "kr" ? `상승 TOP ${displayGainers.length}` : `Top ${displayGainers.length} Gainers`}
            data={displayGainers}
            lang={lang}
          />
        </div>
        <div className="max-h-[600px] overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}>
          <MoverTable
            title={lang === "kr" ? `하락 TOP ${displayLosers.length}` : `Top ${displayLosers.length} Losers`}
            data={displayLosers}
            lang={lang}
          />
        </div>
      </div>

      {/* Load more button */}
      {hasMore && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={() => setShowCount((prev) => prev + 30)}
            className="rounded-md border border-card-border bg-card-bg px-4 py-1.5 text-[11px] text-muted transition-colors hover:text-foreground hover:border-accent/50"
          >
            {lang === "kr" ? "더 보기 ▼" : "Show More ▼"}
          </button>
        </div>
      )}

      <div className="mt-2 flex items-center justify-end gap-2 text-[10px] text-muted">
        {asOf && (
          <span>
            {lang === "kr"
              ? isMarketOpen
                ? "기준: 실시간 (15분 지연)"
                : `기준: ${asOf} 종가`
              : isMarketOpen
                ? "Real-time (15min delay)"
                : `As of: ${asOf} closing`}
          </span>
        )}
        {source === "mock" && (
          <span className="text-yellow-500">(sample data)</span>
        )}
        {stale && (
          <span className="text-yellow-500">{lang === "kr" ? "(캐시)" : "(cached)"}</span>
        )}
      </div>
    </div>
  );
}
