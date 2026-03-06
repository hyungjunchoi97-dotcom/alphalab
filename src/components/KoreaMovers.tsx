"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Mover {
  rank: number;
  ticker: string;
  name: string;
  price: string;
  changePct: number;
  volume?: string;
}

interface ApiMoverItem {
  code: string;
  name: string;
  price: number;
  changeRate: number;
  volume: number;
  tradingValue: number;
}

interface ApiMeta {
  source: string;
  asOf: string;
  fetchedAtISO: string;
  message?: string;
}

function formatPrice(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatVolume(val: number): string {
  if (val >= 1_000_000_000_000) return `${(val / 1_000_000_000_000).toFixed(1)}T`;
  if (val >= 100_000_000) return `${(val / 100_000_000).toFixed(0)}억`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)}M`;
  return val.toLocaleString();
}

function toMover(item: ApiMoverItem, rank: number, showVol: boolean): Mover {
  return {
    rank,
    ticker: item.code,
    name: item.name,
    price: formatPrice(item.price),
    changePct: item.changeRate,
    volume: showVol ? formatVolume(item.tradingValue) : undefined,
  };
}

function formatAsOf(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

function MoverTable({
  title,
  data,
  showVolume = false,
}: {
  title: string;
  data: Mover[];
  showVolume?: boolean;
}) {
  return (
    <div>
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">{title}</h3>
      <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-card-border text-left text-[10px] uppercase tracking-wider text-muted">
            <th className="w-6 pb-1">#</th>
            <th className="pb-1">Name</th>
            <th className="pb-1 text-right">Price</th>
            <th className="pb-1 text-right">Chg%</th>
            {showVolume && <th className="pb-1 text-right">Vol</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((m) => (
            <tr key={m.rank} className="border-b border-card-border/30 hover:bg-card-border/20">
              <td className="py-1 font-mono text-muted">{m.rank}</td>
              <td className="py-1">
                <span>{m.name}</span>
                <span className="ml-1 text-[10px] text-muted">{m.ticker}</span>
              </td>
              <td className="py-1 text-right font-mono tabular-nums">{m.price}</td>
              <td
                className={`py-1 text-right tabular-nums font-medium ${
                  m.changePct >= 0 ? "text-gain" : "text-loss"
                }`}
              >
                {m.changePct >= 0 ? "+" : ""}
                {m.changePct.toFixed(1)}%
              </td>
              {showVolume && (
                <td className="py-1 text-right tabular-nums text-muted">
                  {m.volume}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

export default function KoreaMovers() {
  const [topValue, setTopValue] = useState<Mover[]>([]);
  const [topGainers, setTopGainers] = useState<Mover[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const warnedRef = useRef(false);

  const fetchMovers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/krx/movers");
      const json = await res.json();

      if (!json.ok) {
        throw new Error(json.error || "Failed to fetch movers");
      }

      const valueItems: ApiMoverItem[] = json.topValue || [];
      const gainerItems: ApiMoverItem[] = json.topGainers || [];

      setTopValue(valueItems.map((item, i) => toMover(item, i + 1, true)));
      setTopGainers(gainerItems.map((item, i) => toMover(item, i + 1, false)));
      setMeta({
        source: json.source || "unknown",
        asOf: json.asOf || "",
        fetchedAtISO: json.fetchedAtISO || "",
        message: json.message,
      });

      // One-time dev console warning if not live
      if (
        !warnedRef.current &&
        json.source === "mock" &&
        process.env.NODE_ENV === "development"
      ) {
        warnedRef.current = true;
        console.warn(
          "[KoreaMovers] Using mock data. To enable live KRX data:\n" +
            "  1. Set KRX_API_KEY in .env.local\n" +
            "  2. Restart dev server\n" +
            "  See docs/krx_setup.md for details."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMovers();
  }, [fetchMovers]);

  if (loading) {
    return (
      <div className="py-6 text-center text-[10px] text-muted">
        Loading...
      </div>
    );
  }

  if (error && topValue.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-[10px] text-loss">{error}</p>
        <button
          onClick={fetchMovers}
          className="mt-2 rounded border border-card-border px-3 py-1 text-[10px] text-muted transition-colors hover:text-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  const sourceColor =
    meta?.source === "live"
      ? "text-gain"
      : meta?.source === "mock"
        ? "text-yellow-400"
        : "text-muted";

  return (
    <div>
      {/* Status bar */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[9px] text-muted/60">
        <span>
          KRX: <span className={sourceColor}>{meta?.source || "—"}</span>
        </span>
        {meta?.asOf && (
          <span>asOf {formatAsOf(meta.asOf)}</span>
        )}
        {meta?.fetchedAtISO && (
          <span>updated {formatTime(meta.fetchedAtISO)}</span>
        )}
        {meta?.source && meta.source !== "live" && (
          <a
            href="/api/krx/health"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Check KRX Health
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MoverTable title="Top Trading Value" data={topValue} showVolume />
        <MoverTable title="Top Gainers" data={topGainers} />
      </div>
    </div>
  );
}
