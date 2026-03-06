// ── Types ─────────────────────────────────────────────────────

export interface PriceEntry {
  close: number;
  asOfISO: string;
  fetchedAtISO: string;
}

// ── localStorage cache ────────────────────────────────────────

const CACHE_KEY = "pb_prices_cache";

export function getPriceCache(): Record<string, PriceEntry> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(CACHE_KEY);
  return raw ? (JSON.parse(raw) as Record<string, PriceEntry>) : {};
}

export function setPriceCache(cache: Record<string, PriceEntry>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

// ── Fetch from API ────────────────────────────────────────────

export async function fetchPrices(
  symbols: string[]
): Promise<Record<string, PriceEntry>> {
  if (symbols.length === 0) return {};

  const res = await fetch("/api/prices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbols }),
  });

  const json = await res.json();
  if (!json.ok || !json.prices) return {};

  const now = new Date().toISOString();
  const existing = getPriceCache();

  const entries: Record<string, PriceEntry> = {};
  for (const [sym, data] of Object.entries(json.prices as Record<string, { close: number; asOfISO: string }>)) {
    entries[sym] = {
      close: data.close,
      asOfISO: data.asOfISO,
      fetchedAtISO: now,
    };
  }

  const merged = { ...existing, ...entries };
  setPriceCache(merged);
  return merged;
}
