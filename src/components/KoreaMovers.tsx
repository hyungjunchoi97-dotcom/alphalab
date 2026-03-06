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
                  <span className="truncate">{m.name}</span>
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

  const fetchMovers = useCallback(async () => {
    try {
      const res = await fetch("/api/krx/movers");
      const json = await res.json();
      if (json.ok || json.topGainers) {
        // topGainers = sorted by gain %, topValue = sorted by trading value
        const allGainers: MoverItem[] = json.topGainers || [];
        // For losers, we need the API to also return them
        // The current API returns topValue and topGainers
        // Let's use topGainers for gainers and derive losers from topValue
        // Actually topGainers only has positive. Let's fetch losers from topValue sorted by changeRate asc
        const topValue: MoverItem[] = json.topValue || [];

        setGainers(allGainers.slice(0, 5));
        // Find losers from topValue (those with negative changeRate)
        const negatives = topValue.filter(m => m.changeRate < 0).sort((a, b) => a.changeRate - b.changeRate);
        if (negatives.length >= 5) {
          setLosers(negatives.slice(0, 5));
        } else {
          // If not enough losers in topValue, show bottom of the value list
          const sorted = [...topValue].sort((a, b) => a.changeRate - b.changeRate);
          setLosers(sorted.slice(0, 5));
        }

        if (json.asOf) {
          const y = json.asOf.slice(0, 4);
          const m = json.asOf.slice(4, 6);
          const d = json.asOf.slice(6, 8);
          setAsOf(`${y}.${m}.${d}`);
        }
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

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MoverTable
          title={lang === "kr" ? "상승 TOP 5" : "Top 5 Gainers"}
          data={gainers}
          lang={lang}
        />
        <MoverTable
          title={lang === "kr" ? "하락 TOP 5" : "Top 5 Losers"}
          data={losers}
          lang={lang}
        />
      </div>
      {asOf && (
        <div className="mt-2 text-right text-[10px] text-muted">
          {lang === "kr" ? `데이터 기준: ${asOf} 장 마감` : `As of: ${asOf} market close`}
          {source === "mock" && (
            <span className="ml-1 text-yellow-500">(sample data)</span>
          )}
        </div>
      )}
    </div>
  );
}
