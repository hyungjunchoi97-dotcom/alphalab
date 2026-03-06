import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { resolveKrxKey, getBusinessDate } from "../movers/route";

export const runtime = "nodejs";

// ── Types ─────────────────────────────────────────────────────

interface KrxIndexRow {
  BAS_DD: string;
  IDX_NM: string;
  CLSPRC_IDX: string;
  PRV_DD_CMPR: string; // 전일 대비 (포인트)
  FLUC_RT: string;     // 등락률 (%)
  OPNPRC_IDX: string;
  HGPRC_IDX: string;
  LWPRC_IDX: string;
  ACC_TRDVOL: string;
  ACC_TRDVAL: string;
}

interface IndexData {
  name: string;
  value: string;
  change: string;
  changePct: number;
}

// ── Cache (TTL = 10 min) ──────────────────────────────────────

interface CacheEntry {
  data: IndexData[];
  cachedAt: number;
  asOf: string;
}

const CACHE_TTL = 10 * 60 * 1000;
let cached: CacheEntry | null = null;

// ── KRX Index API endpoints ───────────────────────────────────

const INDEX_APIS = [
  { name: "KOSPI", endpoint: "kospi_dd_trd" },
  { name: "KOSDAQ", endpoint: "kosdaq_dd_trd" },
  { name: "KRX", endpoint: "krx_dd_trd" },
] as const;

function subtractDays(yyyymmdd: string, n: number): string {
  const y = parseInt(yyyymmdd.slice(0, 4));
  const m = parseInt(yyyymmdd.slice(4, 6)) - 1;
  const d = parseInt(yyyymmdd.slice(6, 8));
  const dt = new Date(Date.UTC(y, m, d));
  dt.setUTCDate(dt.getUTCDate() - n);
  const ry = dt.getUTCFullYear();
  const rm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const rd = String(dt.getUTCDate()).padStart(2, "0");
  return `${ry}${rm}${rd}`;
}

async function fetchIndex(
  apiKey: string,
  endpoint: string,
  basDd: string
): Promise<KrxIndexRow[] | null> {
  const url = `https://openapi.krx.co.kr/contents/OPP/APIS/idx/${endpoint}`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      auth_key: apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "alphalab/1.0",
    },
    body: JSON.stringify({ basDd }),
    redirect: "follow",
  });

  if (!res.ok) return null;

  const json = await res.json();
  const rows: KrxIndexRow[] = json.OutBlock_1;
  if (!rows || !Array.isArray(rows) || rows.length === 0) return null;
  return rows;
}

function parseIndex(name: string, rows: KrxIndexRow[]): IndexData | null {
  // Find the matching row by name — or just use the first row for single-index endpoints
  const row = rows.find((r) => r.IDX_NM === name) || rows[0];
  if (!row) return null;

  return {
    name: row.IDX_NM || name,
    value: row.CLSPRC_IDX,
    change: row.PRV_DD_CMPR,
    changePct: parseFloat(row.FLUC_RT) || 0,
  };
}

async function fetchAllIndices(): Promise<{ data: IndexData[]; asOf: string }> {
  const resolved = resolveKrxKey();
  if (!resolved) throw new Error("KRX API key missing");

  const apiKey = resolved.key;
  const startDate = getBusinessDate();

  // Try up to 5 dates for holidays
  for (let attempt = 0; attempt < 5; attempt++) {
    const basDd = attempt === 0 ? startDate : subtractDays(startDate, attempt);

    const results = await Promise.allSettled(
      INDEX_APIS.map(({ endpoint }) => fetchIndex(apiKey, endpoint, basDd))
    );

    const indices: IndexData[] = [];
    let hasData = false;

    results.forEach((result, i) => {
      if (result.status === "fulfilled" && result.value) {
        const parsed = parseIndex(INDEX_APIS[i].name, result.value);
        if (parsed) {
          indices.push(parsed);
          hasData = true;
        }
      }
    });

    if (hasData) {
      return { data: indices, asOf: basDd };
    }
  }

  throw new Error("No index data from KRX after 5 date retries");
}

// ── Route handler ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req);
  if (limited) return limited;

  try {
    // Return cache if fresh
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
      return NextResponse.json({
        ok: true,
        indices: cached.data,
        source: "live",
        asOf: cached.asOf,
      });
    }

    const resolved = resolveKrxKey();
    if (!resolved) {
      return NextResponse.json({
        ok: true,
        indices: [
          { name: "KOSPI", value: "2,687.45", change: "+21.89", changePct: 0.82 },
          { name: "KOSDAQ", value: "868.12", change: "-3.05", changePct: -0.35 },
          { name: "KRX", value: "4,521.30", change: "+15.20", changePct: 0.34 },
        ],
        source: "mock",
      });
    }

    const { data, asOf } = await fetchAllIndices();
    cached = { data, cachedAt: Date.now(), asOf };

    return NextResponse.json({
      ok: true,
      indices: data,
      source: "live",
      asOf,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (cached) {
      return NextResponse.json({
        ok: true,
        indices: cached.data,
        source: "stale-cache",
        asOf: cached.asOf,
        message,
      });
    }

    return NextResponse.json({
      ok: true,
      indices: [
        { name: "KOSPI", value: "—", change: "", changePct: 0 },
        { name: "KOSDAQ", value: "—", change: "", changePct: 0 },
        { name: "KRX", value: "—", change: "", changePct: 0 },
      ],
      source: "error",
      message,
    });
  }
}
