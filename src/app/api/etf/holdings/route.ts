import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── ETF list ───────────────────────────────────────────────
const ETF_LIST = [
  { ticker: "IVV", name: "S&P 500",       id: "239726", file: "IVV" },
  { ticker: "IWM", name: "Russell 2000",  id: "239710", file: "IWM" },
  { ticker: "IYW", name: "Tech",          id: "239522", file: "IYW" },
  { ticker: "IYF", name: "Financials",    id: "239508", file: "IYF" },
  { ticker: "IYH", name: "Healthcare",    id: "239511", file: "IYH" },
  { ticker: "IYE", name: "Energy",        id: "239507", file: "IYE" },
  { ticker: "IYC", name: "Consumer Disc", id: "239506", file: "IYC" },
  { ticker: "IYJ", name: "Industrials",   id: "239514", file: "IYJ" },
];

// ── Types ──────────────────────────────────────────────────
interface Holding {
  ticker: string;
  name: string;
  sector: string;
  weight: number | null;
}

// ── CSV fetch & parse ──────────────────────────────────────
async function fetchHoldings(etfId: string, etfFile: string): Promise<Holding[]> {
  const url = `https://www.ishares.com/us/products/${etfId}/x/1467271812596.ajax?fileType=csv&fileName=${etfFile}_holdings&dataType=fund`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "text/csv,text/plain,*/*",
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${etfFile}`);
  const text = await res.text();
  return parseCSV(text);
}

function parseCSV(text: string): Holding[] {
  const lines = text.split("\n");
  // Find the header row with Ticker,Name columns
  let headerIdx = -1;
  let tickerCol = -1;
  let nameCol = -1;
  let sectorCol = -1;
  let assetClassCol = -1;
  let weightCol = -1;

  for (let i = 0; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    const lower = cols.map(c => c.toLowerCase().trim());
    const ti = lower.indexOf("ticker");
    if (ti >= 0) {
      headerIdx = i;
      tickerCol = ti;
      nameCol = lower.indexOf("name");
      sectorCol = lower.indexOf("sector");
      assetClassCol = lower.indexOf("asset class");
      weightCol = lower.indexOf("weight (%)");
      if (weightCol < 0) weightCol = lower.indexOf("weight");
      break;
    }
  }

  if (headerIdx < 0) return [];

  const holdings: Holding[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length <= tickerCol) continue;

    const ticker = cols[tickerCol]?.trim();
    if (!ticker || ticker === "-" || ticker === "") continue;

    // Only equity rows
    if (assetClassCol >= 0) {
      const ac = cols[assetClassCol]?.trim().toLowerCase() || "";
      if (ac && ac !== "equity") continue;
    }

    const name = nameCol >= 0 ? cols[nameCol]?.trim() || "" : "";
    const sector = sectorCol >= 0 ? cols[sectorCol]?.trim() || "" : "";
    const weightRaw = weightCol >= 0 ? cols[weightCol]?.trim() : "";
    const weight = weightRaw ? parseFloat(weightRaw) : null;

    holdings.push({ ticker, name, sector, weight: weight != null && !isNaN(weight) ? weight : null });
  }

  return holdings;
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Today string (UTC) ─────────────────────────────────────
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Action: snapshot ───────────────────────────────────────
async function handleSnapshot() {
  const today = todayStr();
  const results: { etf: string; added: number; removed: number; total: number; skipped?: boolean }[] = [];

  for (const etf of ETF_LIST) {
    // Check if already done today
    const { data: existing } = await supabaseAdmin
      .from("etf_holdings_snapshot")
      .select("id")
      .eq("etf_ticker", etf.ticker)
      .eq("snapshot_date", today)
      .limit(1)
      .single();

    if (existing) {
      results.push({ etf: etf.ticker, added: 0, removed: 0, total: 0, skipped: true });
      continue;
    }

    let holdings: Holding[];
    try {
      holdings = await fetchHoldings(etf.id, etf.file);
    } catch (err) {
      console.error(`[etf-holdings] Failed to fetch ${etf.ticker}:`, err);
      continue;
    }

    // Save snapshot — one row per holding
    const rows = holdings.map(h => ({
      etf_ticker: etf.ticker,
      snapshot_date: today,
      symbol: h.ticker,
      name: h.name,
      sector: h.sector,
      weight: h.weight ?? null,
    }));

    // 중복 symbol 제거 (같은 etf_ticker + snapshot_date + symbol)
    const uniqueRows = rows.filter((row, idx, arr) =>
      arr.findIndex(r => r.symbol === row.symbol) === idx
    );

    const { error: insertErr } = await supabaseAdmin
      .from("etf_holdings_snapshot")
      .upsert(uniqueRows, { onConflict: "etf_ticker,snapshot_date,symbol" });

    if (insertErr) console.error(`[etf-holdings] Insert error ${etf.ticker}:`, insertErr);

    // Get previous snapshot date
    const { data: prevDateRow } = await supabaseAdmin
      .from("etf_holdings_snapshot")
      .select("snapshot_date")
      .eq("etf_ticker", etf.ticker)
      .lt("snapshot_date", today)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single();

    let added = 0;
    let removed = 0;

    if (prevDateRow) {
      const prevDate = prevDateRow.snapshot_date;
      const { data: prevRows } = await supabaseAdmin
        .from("etf_holdings_snapshot")
        .select("symbol, name, sector")
        .eq("etf_ticker", etf.ticker)
        .eq("snapshot_date", prevDate);

      const prevHoldings = prevRows || [];
      const prevTickers = new Set(prevHoldings.map(h => h.symbol));
      const currTickers = new Set(holdings.map(h => h.ticker));

      // Find additions
      const addedHoldings = holdings.filter(h => !prevTickers.has(h.ticker));
      // Find removals
      const removedHoldings = prevHoldings.filter(h => !currTickers.has(h.symbol));

      if (addedHoldings.length > 0 || removedHoldings.length > 0) {
        const changes = [
          ...addedHoldings.map(h => ({
            etf_ticker: etf.ticker,
            symbol: h.ticker,
            name: h.name,
            sector: h.sector,
            change_type: "ADD" as const,
            detected_date: today,
          })),
          ...removedHoldings.map(h => ({
            etf_ticker: etf.ticker,
            symbol: h.symbol,
            name: h.name || "",
            sector: h.sector || "",
            change_type: "REMOVE" as const,
            detected_date: today,
          })),
        ];
        await supabaseAdmin.from("etf_changes").insert(changes);
      }

      added = addedHoldings.length;
      removed = removedHoldings.length;
    }

    results.push({ etf: etf.ticker, added, removed, total: holdings.length });

    // Small delay between ETFs
    await new Promise(r => setTimeout(r, 500));
  }

  return NextResponse.json({ ok: true, results });
}

// ── Action: changes ────────────────────────────────────────
async function handleChanges(etfTicker?: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  let query = supabaseAdmin
    .from("etf_changes")
    .select("etf_ticker, symbol, name, change_type, sector, detected_date")
    .gte("detected_date", thirtyDaysAgo)
    .order("detected_date", { ascending: false });

  if (etfTicker) {
    query = query.eq("etf_ticker", etfTicker);
  }

  const { data, error } = await query.limit(500);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, changes: data || [] });
}

// ── Action: latest ─────────────────────────────────────────
async function handleLatest() {
  const results: { etf_ticker: string; etf_name: string; snapshot_date: string | null; holding_count: number }[] = [];

  for (const etf of ETF_LIST) {
    // Get latest snapshot date
    const { data: dateRow } = await supabaseAdmin
      .from("etf_holdings_snapshot")
      .select("snapshot_date")
      .eq("etf_ticker", etf.ticker)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single();

    let holdingCount = 0;
    if (dateRow) {
      const { count } = await supabaseAdmin
        .from("etf_holdings_snapshot")
        .select("id", { count: "exact", head: true })
        .eq("etf_ticker", etf.ticker)
        .eq("snapshot_date", dateRow.snapshot_date);
      holdingCount = count || 0;
    }

    results.push({
      etf_ticker: etf.ticker,
      etf_name: etf.name,
      snapshot_date: dateRow?.snapshot_date || null,
      holding_count: holdingCount,
    });
  }

  return NextResponse.json({ ok: true, results });
}

// ── Action: holdings ──────────────────────────────────────
async function handleHoldings(etfTicker?: string) {
  if (!etfTicker) {
    return NextResponse.json({ ok: false, error: "etf parameter required" }, { status: 400 });
  }

  // Get latest snapshot date for this ETF
  const { data: dateRow } = await supabaseAdmin
    .from("etf_holdings_snapshot")
    .select("snapshot_date")
    .eq("etf_ticker", etfTicker)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .single();

  if (!dateRow) {
    return NextResponse.json({ ok: true, etf: etfTicker, date: null, holdings: [] });
  }

  const { data, error } = await supabaseAdmin
    .from("etf_holdings_snapshot")
    .select("symbol, name, sector, weight")
    .eq("etf_ticker", etfTicker)
    .eq("snapshot_date", dateRow.snapshot_date)
    .order("weight", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    etf: etfTicker,
    date: dateRow.snapshot_date,
    holdings: data || [],
  });
}

// ── GET handler ────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const action = sp.get("action") || "changes";

  try {
    switch (action) {
      case "snapshot":
        return await handleSnapshot();
      case "changes":
        return await handleChanges(sp.get("etf") || undefined);
      case "latest":
        return await handleLatest();
      case "holdings":
        return await handleHoldings(sp.get("etf") || undefined);
      default:
        return NextResponse.json(
          { ok: false, error: `Invalid action: ${action}. Valid: snapshot, changes, latest, holdings` },
          { status: 400 },
        );
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
