import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 30;

const CACHE_KEY = "shiller_cape";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CapeEntry {
  date: string;
  cape: number;
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

async function scrapeMultplCape(): Promise<CapeEntry[]> {
  const res = await fetch("https://multpl.com/shiller-pe/table/by-month", {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const tableMatch = html.match(/<table[^>]*id="datatable"[^>]*>([\s\S]*?)<\/table>/);
  if (!tableMatch) throw new Error("datatable not found");

  const rows: CapeEntry[] = [];
  for (const rowMatch of tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)];
    if (cells.length < 2) continue;

    const dateRaw = cells[0][1].replace(/<[^>]+>/g, "").trim();
    const valRaw = cells[1][1].replace(/<[^>]+>/g, " ").trim();
    const nums = valRaw.match(/\d+\.?\d*/g);

    const date = parseMultplDate(dateRaw);
    const cape = nums ? parseFloat(nums[nums.length - 1]) : NaN;

    if (date && !isNaN(cape) && cape > 0) {
      rows.push({ date, cape: Math.round(cape * 100) / 100 });
    }
  }

  if (rows.length === 0) throw new Error("No data parsed from multpl.com");
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export async function GET() {
  // Supabase cache check
  try {
    const { data } = await supabaseAdmin
      .from("legend_screener_cache")
      .select("results, created_at")
      .eq("cache_key", CACHE_KEY)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      const age = Date.now() - new Date(data.created_at).getTime();
      if (age < CACHE_TTL_MS) {
        const rows = data.results as CapeEntry[];
        const current = rows[rows.length - 1]?.cape ?? null;
        const average = rows.length > 0
          ? Math.round((rows.reduce((s, r) => s + r.cape, 0) / rows.length) * 10) / 10
          : null;
        return NextResponse.json({ ok: true, data: rows, current, average, cached: true, updatedAt: data.created_at });
      }
    }
  } catch { /* cache miss */ }

  try {
    const rows = await scrapeMultplCape();
    const current = rows[rows.length - 1].cape;
    const average = Math.round((rows.reduce((s, r) => s + r.cape, 0) / rows.length) * 10) / 10;

    try {
      await supabaseAdmin.from("legend_screener_cache").delete().eq("cache_key", CACHE_KEY);
      await supabaseAdmin.from("legend_screener_cache").insert({
        cache_key: CACHE_KEY,
        results: rows,
        created_at: new Date().toISOString(),
      });
    } catch { /* non-fatal */ }

    return NextResponse.json({ ok: true, data: rows, current, average, cached: false, updatedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 502 }
    );
  }
}
