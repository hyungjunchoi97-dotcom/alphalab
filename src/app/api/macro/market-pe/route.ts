import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 30;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const SP500_CACHE_KEY = "market_pe_sp500";

interface PeEntry {
  date: string;
  pe: number;
}

const MONTH_MAP: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04",
  May: "05", Jun: "06", Jul: "07", Aug: "08",
  Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function parseMultplDate(raw: string): string | null {
  const m = raw.trim().match(/^(\w{3})\s+(\d{1,2}),\s+(\d{4})$/);
  if (!m) return null;
  const month = MONTH_MAP[m[1]];
  if (!month) return null;
  return `${m[3]}-${month}-${m[2].padStart(2, "0")}`;
}

async function scrapeMultplPE(url: string): Promise<PeEntry[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const tableMatch = html.match(/<table[^>]*id="datatable"[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) throw new Error("datatable not found");

  const rows: PeEntry[] = [];
  for (const rowMatch of tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    if (cells.length < 2) continue;

    const dateRaw = cells[0][1].replace(/<[^>]+>/g, "").trim();
    const valRaw = cells[1][1].replace(/<[^>]+>/g, " ").trim();
    const nums = valRaw.match(/\d+\.?\d*/g);

    const date = parseMultplDate(dateRaw);
    const pe = nums ? parseFloat(nums[nums.length - 1]) : NaN;

    if (date && !isNaN(pe) && pe > 0) {
      rows.push({ date, pe: Math.round(pe * 100) / 100 });
    }
  }

  if (rows.length === 0) throw new Error("No data parsed");
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export async function GET() {
  // Try Supabase cache
  try {
    const { data } = await supabaseAdmin
      .from("legend_screener_cache")
      .select("results, created_at")
      .eq("cache_key", SP500_CACHE_KEY)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      const age = Date.now() - new Date(data.created_at).getTime();
      if (age < CACHE_TTL_MS) {
        return NextResponse.json({
          ok: true,
          sp500: data.results as PeEntry[],
          nasdaq: [],
          cached: true,
          updatedAt: data.created_at,
        });
      }
    }
  } catch { /* cache miss */ }

  try {
    const sp500 = await scrapeMultplPE("https://multpl.com/s-p-500-pe-ratio/table/by-month");

    try {
      await supabaseAdmin.from("legend_screener_cache").delete().eq("cache_key", SP500_CACHE_KEY);
      await supabaseAdmin.from("legend_screener_cache").insert({
        cache_key: SP500_CACHE_KEY,
        results: sp500,
        created_at: new Date().toISOString(),
      });
    } catch { /* non-fatal */ }

    return NextResponse.json({
      ok: true,
      sp500,
      nasdaq: [],
      cached: false,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
