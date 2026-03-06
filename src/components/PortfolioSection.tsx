"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ResponsiveContainer, PieChart, Pie, Tooltip } from "recharts";
import { useLang } from "@/lib/LangContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";
import { getPriceCache, fetchPrices, type PriceEntry } from "@/lib/priceStore";

type MarketType = "KR" | "US" | "JP" | "COM";

interface Holding {
  id: string;
  symbol: string;
  name: string;
  market: MarketType;
  quantity: number;
  avg_cost: number;
  currency: string;
}

const MARKET_CURRENCY: Record<MarketType, string> = {
  KR: "KRW",
  US: "USD",
  JP: "JPY",
  COM: "USD",
};

const MARKET_COLORS: Record<string, string> = {
  KR: "#0071e3",
  US: "#34c759",
  JP: "#ff9500",
  COM: "#af52de",
};

const emptyForm = {
  ticker: "",
  name: "",
  market: "KR" as MarketType,
  quantity: 0,
  avgPrice: 0,
  currency: "KRW",
};

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export default function PortfolioSection() {
  const { t } = useLang();
  const { session } = useAuth();
  const requireAuth = useRequireAuth();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Price state
  const [prices, setPrices] = useState<Record<string, PriceEntry>>({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesAsOf, setPricesAsOf] = useState<string | null>(null);

  const authHeaders = (): HeadersInit =>
    session?.access_token
      ? { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }
      : { "Content-Type": "application/json" };

  const fetchHoldings = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch("/api/portfolio", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.ok) setHoldings(data.holdings);
    } catch {
      /* ignore */
    }
  }, [session?.access_token]);

  useEffect(() => {
    setPrices(getPriceCache());
    fetchHoldings();
  }, [fetchHoldings]);

  const refreshPrices = useCallback(async () => {
    if (holdings.length === 0) return;
    const symbols = holdings.map((h) => h.symbol.toUpperCase());
    setPricesLoading(true);
    try {
      const updated = await fetchPrices(symbols);
      setPrices(updated);
      const times = Object.values(updated)
        .map((p) => p.asOfISO)
        .filter(Boolean)
        .sort();
      if (times.length > 0) setPricesAsOf(times[times.length - 1]);
    } finally {
      setPricesLoading(false);
    }
  }, [holdings]);

  // Fetch prices once after holdings load, then auto-refresh every 60s
  const fetchedOnce = useRef(false);
  useEffect(() => {
    if (holdings.length > 0 && !fetchedOnce.current) {
      fetchedOnce.current = true;
      refreshPrices();
    }
  }, [holdings, refreshPrices]);

  useEffect(() => {
    if (holdings.length === 0) return;
    const id = setInterval(refreshPrices, 60_000);
    return () => clearInterval(id);
  }, [holdings.length, refreshPrices]);

  const handleSearchInput = (q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((j) => {
          if (j.ok) {
            setSearchResults(j.results);
            setSearchOpen(j.results.length > 0);
          }
        })
        .catch(() => {});
    }, 300);
  };

  const handleSearchSelect = (result: SearchResult) => {
    // Auto-detect market from symbol suffix or exchange
    let market: MarketType = "US";
    if (/\.KS$|\.KQ$/i.test(result.symbol) || result.exchange === "KRX") market = "KR";
    else if (/\.T$/i.test(result.symbol) || result.exchange === "TSE") market = "JP";
    else if (/=F$|-USD$/i.test(result.symbol) || result.exchange === "CME" || result.exchange === "CCC") market = "COM";

    setForm((prev) => ({
      ...prev,
      ticker: result.symbol,
      name: result.name,
      market,
      currency: MARKET_CURRENCY[market],
    }));
    setSearchQuery("");
    setSearchResults([]);
    setSearchOpen(false);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setSaveError(null);
    setSearchQuery("");
    setSearchResults([]);
    setSearchOpen(false);
  };

  const handleSave = async () => {
    setSaveError(null);
    if (!form.ticker || !form.name) {
      setSaveError("Ticker and Name are required.");
      console.error("[PortfolioSection] handleSave: ticker or name empty", { ticker: form.ticker, name: form.name });
      return;
    }
    if (!session?.access_token) {
      setSaveError("Not logged in. Please sign in first.");
      console.error("[PortfolioSection] handleSave: no access_token");
      return;
    }
    try {
      const payload = {
        id: editingId || undefined,
        symbol: form.ticker,
        name: form.name,
        market: form.market,
        quantity: form.quantity,
        avg_cost: form.avgPrice,
        currency: form.currency,
      };
      console.log("[PortfolioSection] handleSave: sending", payload);
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      console.log("[PortfolioSection] handleSave: response", res.status, data);
      if (data.ok) {
        await fetchHoldings();
        resetForm();
      } else {
        setSaveError(data.error || `Server error (${res.status})`);
        console.error("[PortfolioSection] handleSave: API error", data.error);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setSaveError(msg);
      console.error("[PortfolioSection] handleSave: fetch error", err);
    }
  };

  const handleEdit = (id: string) => {
    const target = holdings.find((h) => h.id === id);
    if (!target) return;
    setForm({
      ticker: target.symbol,
      name: target.name,
      market: target.market,
      quantity: target.quantity,
      avgPrice: target.avg_cost,
      currency: target.currency,
    });
    setEditingId(id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/portfolio?id=${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.ok) {
        await fetchHoldings();
      }
    } catch {
      /* ignore */
    }
  };

  const handleMarketChange = (market: MarketType) => {
    setForm((prev) => ({
      ...prev,
      market,
      currency: MARKET_CURRENCY[market],
    }));
  };

  // Helper: get current price for a holding
  const getPrice = (h: Holding): number | null => {
    const key = h.symbol.toUpperCase();
    return prices[key]?.close ?? null;
  };

  // Donut chart data — use market value when prices available, else cost basis
  const allocationData = Object.entries(
    holdings.reduce<Record<string, number>>((acc, h) => {
      const cp = getPrice(h);
      const val = cp != null ? h.quantity * cp : h.quantity * h.avg_cost;
      acc[h.market] = (acc[h.market] || 0) + val;
      return acc;
    }, {})
  ).map(([market, value]) => ({
    name: market,
    value,
    fill: MARKET_COLORS[market] || "#8884d8",
  }));

  return (
    <div>
      {/* Actions row */}
      {!showForm && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => requireAuth(() => setShowForm(true))}
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            {t("addHolding")}
          </button>
          {holdings.length > 0 && (
            <button
              onClick={refreshPrices}
              disabled={pricesLoading}
              className="rounded border border-card-border px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground disabled:opacity-40"
            >
              {pricesLoading ? "Loading..." : "Refresh Prices"}
            </button>
          )}
          {pricesAsOf && (
            <span className="text-[9px] text-muted">
              Prices as of: {new Date(pricesAsOf).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="mb-3 rounded border border-card-border bg-background p-3">
          {/* Search bar */}
          <div className="relative mb-2">
            <input
              type="text"
              placeholder="Search stock (e.g. Samsung, AAPL, Toyota)..."
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              className="w-full rounded border border-card-border bg-card-bg px-2.5 py-1.5 text-xs outline-none focus:border-accent placeholder:text-muted"
            />
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-10 mt-0.5 max-h-48 overflow-y-auto rounded border border-card-border bg-card-bg shadow-lg">
                {searchResults.map((r, i) => (
                  <button
                    key={`${r.symbol}-${i}`}
                    onClick={() => handleSearchSelect(r)}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-card-border/30"
                  >
                    <span className="font-medium text-accent">{r.symbol}</span>
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    <span className="shrink-0 text-[9px] text-muted">{r.exchange}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            <input
              type="text"
              placeholder="Ticker"
              value={form.ticker}
              onChange={(e) =>
                setForm((p) => ({ ...p, ticker: e.target.value }))
              }
              className="rounded border border-card-border bg-card-bg px-2 py-1 text-xs outline-none focus:border-accent"
            />
            <input
              type="text"
              placeholder="Name"
              value={form.name}
              onChange={(e) =>
                setForm((p) => ({ ...p, name: e.target.value }))
              }
              className="rounded border border-card-border bg-card-bg px-2 py-1 text-xs outline-none focus:border-accent"
            />
            <select
              value={form.market}
              onChange={(e) =>
                handleMarketChange(e.target.value as MarketType)
              }
              className="rounded border border-card-border bg-card-bg px-2 py-1 text-xs outline-none focus:border-accent"
            >
              <option value="KR">KR</option>
              <option value="US">US</option>
              <option value="JP">JP</option>
              <option value="COM">COM</option>
            </select>
            <input
              type="number"
              placeholder="Quantity"
              value={form.quantity || ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, quantity: Number(e.target.value) }))
              }
              className="rounded border border-card-border bg-card-bg px-2 py-1 text-xs outline-none focus:border-accent"
            />
            <input
              type="number"
              placeholder="Avg Price"
              value={form.avgPrice || ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, avgPrice: Number(e.target.value) }))
              }
              className="rounded border border-card-border bg-card-bg px-2 py-1 text-xs outline-none focus:border-accent"
            />
            <div className="flex items-center text-xs text-muted">
              {form.currency}
            </div>
          </div>
          {saveError && (
            <p className="mt-1 text-[10px] text-loss">{saveError}</p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleSave}
              className="rounded bg-accent px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
            >
              {editingId ? "Update" : "Add"}
            </button>
            <button
              onClick={resetForm}
              className="rounded px-3 py-1 text-xs font-medium text-muted transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Layout: table + chart */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Holdings table */}
        <div className="lg:col-span-2 overflow-x-auto">
          {holdings.length === 0 ? (
            <p className="py-3 text-center text-[10px] text-muted">
              {t("noHoldings")}
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-card-border text-left text-[10px] font-medium uppercase tracking-wider text-muted">
                  <th className="pb-1.5">Ticker</th>
                  <th className="pb-1.5">Name</th>
                  <th className="pb-1.5">Mkt</th>
                  <th className="pb-1.5 text-right">Qty</th>
                  <th className="pb-1.5 text-right">Avg Price</th>
                  <th className="pb-1.5 text-right">Current</th>
                  <th className="pb-1.5 text-right">Mkt Value</th>
                  <th className="pb-1.5 text-right">PnL</th>
                  <th className="pb-1.5" />
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => (
                  <tr
                    key={h.id}
                    className="border-b border-card-border/40 hover:bg-card-border/20"
                  >
                    <td className="py-1.5 text-accent">{h.symbol}</td>
                    <td className="py-1.5">{h.name}</td>
                    <td className="py-1.5 text-muted">{h.market}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {h.quantity.toLocaleString()}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {h.avg_cost.toLocaleString()}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {(() => {
                        const cp = getPrice(h);
                        return cp != null ? cp.toLocaleString() : "—";
                      })()}
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-medium">
                      {(() => {
                        const cp = getPrice(h);
                        return cp != null
                          ? (h.quantity * cp).toLocaleString()
                          : (h.quantity * h.avg_cost).toLocaleString();
                      })()}
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-medium">
                      {(() => {
                        const cp = getPrice(h);
                        if (cp == null) return "—";
                        const pnl = h.quantity * (cp - h.avg_cost);
                        return (
                          <span className={pnl >= 0 ? "text-gain" : "text-loss"}>
                            {pnl >= 0 ? "+" : ""}{pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        onClick={() => requireAuth(() => handleEdit(h.id))}
                        className="mr-2 text-[10px] text-accent hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => requireAuth(() => handleDelete(h.id))}
                        className="text-[10px] text-loss hover:underline"
                      >
                        Del
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Donut chart */}
        <div>
          {allocationData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={allocationData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={2}
                  cornerRadius={2}
                  stroke="none"
                />
                <Tooltip
                  formatter={(value) =>
                    typeof value === "number" ? value.toLocaleString() : value
                  }
                  contentStyle={{
                    background: "#111820",
                    border: "1px solid #1f2a37",
                    borderRadius: 6,
                    fontSize: 11,
                    color: "#e5e7eb",
                  }}
                  itemStyle={{ color: "#9ca3af" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[120px] items-center justify-center text-[10px] text-muted">
              {t("noAllocation")}
            </div>
          )}
          {allocationData.length > 0 && (
            <div className="mt-1 flex flex-wrap justify-center gap-3 text-[10px] text-muted">
              {allocationData.map((d) => (
                <div key={d.name} className="flex items-center gap-1">
                  <span
                    className="inline-block h-2 w-2 rounded-sm"
                    style={{ backgroundColor: d.fill }}
                  />
                  {d.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
