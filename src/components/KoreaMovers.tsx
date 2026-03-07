"use client";

import { useState, useEffect, useCallback } from "react";
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
            <tr className="border-b border-card-border text-left text-[10px] uppercase tracking-wider text-muted">
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
  const [fetchedAt, setFetchedAt] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [totalGainers, setTotalGainers] = useState(0);
  const [totalLosers, setTotalLosers] = useState(0);
  const [showCount, setShowCount] = useState(5);

  const fetchMovers = useCallback(async () => {
    try {
      const res = await fetch("/api/krx/movers");
      const json = await res.json();
      if (json.ok || json.topGainers) {
        setGainers(json.topGainers || []);
        setLosers(json.topLosers || []);
        setTotalGainers(json.totalGainers || 0);
        setTotalLosers(json.totalLosers || 0);

        if (json.asOf) {
          const y = json.asOf.slice(0, 4);
          const m = json.asOf.slice(4, 6);
          const d = json.asOf.slice(6, 8);
          setAsOf(`${y}.${m}.${d}`);
        }
        if (json.fetchedAtISO) setFetchedAt(json.fetchedAtISO);
        setSource(json.source || "");
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMovers();
  }, [fetchMovers]);

  if (loading) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <span className="text-xs text-muted animate-pulse">Loading...</span>
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
        <MoverTable
          title={lang === "kr" ? `상승 TOP ${displayGainers.length}` : `Top ${displayGainers.length} Gainers`}
          data={displayGainers}
          lang={lang}
        />
        <MoverTable
          title={lang === "kr" ? `하락 TOP ${displayLosers.length}` : `Top ${displayLosers.length} Losers`}
          data={displayLosers}
          lang={lang}
        />
      </div>

      {/* Load more button */}
      {hasMore && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={() => setShowCount((prev) => prev + 20)}
            className="rounded-md border border-card-border bg-card-bg px-4 py-1.5 text-[11px] text-muted transition-colors hover:text-foreground hover:border-accent/50"
          >
            {lang === "kr" ? "더 보기 ▼" : "Show More ▼"}
          </button>
        </div>
      )}

      <div className="mt-2 flex items-center justify-end gap-2 text-[10px] text-muted">
        {asOf && (
          <span>
            {lang === "kr" ? `기준: ${asOf}` : `As of: ${asOf}`}
          </span>
        )}
        {fetchedAt && (
          <span className="tabular-nums">
            {lang === "kr" ? "업데이트" : "Updated"}: {new Date(fetchedAt).toLocaleString(lang === "kr" ? "ko-KR" : "en-US", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        {source === "mock" && (
          <span className="text-yellow-500">(sample data)</span>
        )}
      </div>
    </div>
  );
}
