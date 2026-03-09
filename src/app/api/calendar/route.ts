import { NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/fetchWithTimeout";

export const runtime = "nodejs";

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface CalendarEvent {
  id: string;
  region: "US" | "KR" | "JP";
  category: "fomc" | "cpi" | "bok" | "gdp" | "nfp" | "ppi" | "derivatives" | "political";
  title: string;
  titleKr: string;
  datetimeISO: string;
  importance: number;
  forecast?: string;
  previous?: string;
  actual?: string;
}

interface CacheEntry {
  data: CalendarEvent[];
  cachedAt: number;
  fetchedAt: string;
}

let cache: CacheEntry | null = null;

// ── FRED release date fetcher ──────────────────────────────

interface FredReleaseDef {
  releaseId: number;
  region: "US";
  category: CalendarEvent["category"];
  title: string;
  titleKr: string;
  timeUTC: string; // HH:MM:SS — release time in UTC
  importance: number;
}

const FRED_RELEASES: FredReleaseDef[] = [
  { releaseId: 10, region: "US", category: "cpi", title: "US CPI", titleKr: "미국 소비자물가지수(CPI)", timeUTC: "12:30:00", importance: 5 },
  { releaseId: 50, region: "US", category: "nfp", title: "Non-Farm Payrolls", titleKr: "비농업 고용지표(NFP)", timeUTC: "12:30:00", importance: 5 },
  { releaseId: 53, region: "US", category: "gdp", title: "US GDP", titleKr: "미국 GDP", timeUTC: "12:30:00", importance: 5 },
  { releaseId: 46, region: "US", category: "ppi", title: "US PPI", titleKr: "미국 생산자물가지수(PPI)", timeUTC: "12:30:00", importance: 3 },
];

async function fetchFredReleaseDates(def: FredReleaseDef, apiKey: string): Promise<CalendarEvent[]> {
  const today = new Date().toISOString().split("T")[0];
  const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const url = `https://api.stlouisfed.org/fred/release/dates?release_id=${def.releaseId}&api_key=${apiKey}&file_type=json&include_release_dates_with_no_data=true&sort_order=asc&realtime_start=${today}&realtime_end=${endDate}&limit=15`;

  const res = await fetchWithTimeout(url, {}, 8000);
  if (!res.ok) return [];

  const json = await res.json();
  const dates: { date: string }[] = json.release_dates || [];

  return dates.map((d) => ({
    id: `fred-${def.releaseId}-${d.date}`,
    region: def.region,
    category: def.category,
    title: def.title,
    titleKr: def.titleKr,
    datetimeISO: `${d.date}T${def.timeUTC}Z`,
    importance: def.importance,
  }));
}

// ── Curated central bank meeting dates ──────────────────────

function formatISO(year: number, month: number, day: number, timeUTC: string): string {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}T${timeUTC}Z`;
}

function generateCuratedEvents(): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  // ── FOMC 2026 (Fed announces exact dates; statement at 14:00 ET = 18:00 UTC = 03:00+1 KST)
  const fomc2026: [number, number][] = [
    [3, 19], [5, 7], [6, 18], [7, 30], [9, 17], [11, 5], [12, 17],
  ];
  for (const [m, d] of fomc2026) {
    events.push({
      id: `fomc-2026-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      region: "US", category: "fomc",
      title: "FOMC Rate Decision",
      titleKr: "FOMC 금리 결정",
      datetimeISO: formatISO(2026, m, d, "18:00:00"),
      importance: 5,
    });
  }

  // FOMC 2027 (estimated)
  const fomc2027: [number, number][] = [
    [1, 27], [3, 17], [5, 5], [6, 16], [7, 28], [9, 22], [11, 3], [12, 15],
  ];
  for (const [m, d] of fomc2027) {
    events.push({
      id: `fomc-2027-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      region: "US", category: "fomc",
      title: "FOMC Rate Decision",
      titleKr: "FOMC 금리 결정",
      datetimeISO: formatISO(2027, m, d, "18:00:00"),
      importance: 5,
    });
  }

  // ── BOK 금통위 2026 (10:00 KST = 01:00 UTC)
  const bok2026: [number, number][] = [
    [2, 25], [4, 17], [5, 29], [7, 17], [8, 28], [10, 16], [11, 27],
  ];
  for (const [m, d] of bok2026) {
    events.push({
      id: `bok-2026-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      region: "KR", category: "bok",
      title: "BOK Base Rate Decision",
      titleKr: "한국은행 금통위 기준금리 결정",
      datetimeISO: formatISO(2026, m, d, "01:00:00"),
      importance: 5,
    });
  }

  // BOK 2027 (estimated)
  const bok2027: [number, number][] = [
    [1, 14], [2, 25], [4, 17], [5, 27], [7, 15], [8, 26], [10, 14], [11, 25],
  ];
  for (const [m, d] of bok2027) {
    events.push({
      id: `bok-2027-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      region: "KR", category: "bok",
      title: "BOK Base Rate Decision",
      titleKr: "한국은행 금통위 기준금리 결정",
      datetimeISO: formatISO(2027, m, d, "01:00:00"),
      importance: 5,
    });
  }

  // ── BOJ 2026 (12:00 JST = 03:00 UTC)
  const boj2026: [number, number][] = [
    [3, 19], [5, 1], [6, 17], [7, 31], [9, 19], [10, 30], [12, 19],
  ];
  for (const [m, d] of boj2026) {
    events.push({
      id: `boj-2026-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      region: "JP", category: "fomc", // grouped with rate decisions
      title: "BOJ Rate Decision",
      titleKr: "일본은행 금리 결정",
      datetimeISO: formatISO(2026, m, d, "03:00:00"),
      importance: 4,
    });
  }

  // ── Quad Witching (3rd Friday of Mar, Jun, Sep, Dec — 16:00 ET = 20:00 UTC)
  for (let y = 2026; y <= 2027; y++) {
    for (const m of [3, 6, 9, 12]) {
      const dt = new Date(Date.UTC(y, m - 1, 1));
      let count = 0;
      while (count < 3) {
        if (dt.getUTCDay() === 5) count++;
        if (count < 3) dt.setUTCDate(dt.getUTCDate() + 1);
      }
      events.push({
        id: `quad-${y}-${String(m).padStart(2, "0")}`,
        region: "US", category: "derivatives",
        title: "Quad Witching",
        titleKr: "쿼드러플 위칭 (선물·옵션 동시만기)",
        datetimeISO: `${y}-${String(m).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}T20:00:00Z`,
        importance: 4,
      });
    }
  }

  // ── KR CPI (5th business day, 08:00 KST = 23:00 UTC prev day)
  for (let offset = 0; offset <= 12; offset++) {
    const refDate = new Date();
    refDate.setMonth(refDate.getMonth() + offset);
    const y = refDate.getFullYear();
    const m = refDate.getMonth(); // 0-based
    const dt = new Date(Date.UTC(y, m, 1));
    let bizDays = 0;
    while (bizDays < 5) {
      const dow = dt.getUTCDay();
      if (dow !== 0 && dow !== 6) bizDays++;
      if (bizDays < 5) dt.setUTCDate(dt.getUTCDate() + 1);
    }
    const ms = String(m + 1).padStart(2, "0");
    const ds = String(dt.getUTCDate()).padStart(2, "0");
    events.push({
      id: `kr-cpi-${y}-${ms}`,
      region: "KR", category: "cpi",
      title: "KR CPI (YoY)",
      titleKr: "한국 소비자물가지수(CPI)",
      datetimeISO: `${y}-${ms}-${ds}T23:00:00Z`,
      importance: 4,
    });
  }

  // ── US Midterms 2026
  events.push({
    id: "us-midterms-2026",
    region: "US", category: "political",
    title: "US Midterm Elections",
    titleKr: "미국 중간선거",
    datetimeISO: "2026-11-03T00:00:00Z",
    importance: 5,
  });

  return events;
}

// ── Route handler ───────────────────────────────────────────

export async function GET() {
  if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
    return NextResponse.json({ ok: true, events: cache.data, fetchedAt: cache.fetchedAt, source: "cache" });
  }

  const fredKey = process.env.FRED_API_KEY?.trim();
  const curated = generateCuratedEvents();

  // Fetch FRED release dates in parallel
  let fredEvents: CalendarEvent[] = [];
  if (fredKey) {
    const results = await Promise.allSettled(
      FRED_RELEASES.map((def) => fetchFredReleaseDates(def, fredKey))
    );
    for (const r of results) {
      if (r.status === "fulfilled") fredEvents.push(...r.value);
    }
  }

  // Merge and deduplicate
  const all = [...curated, ...fredEvents];

  // Filter: from 7 days ago to +12 months
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const futureLimit = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const filtered = all.filter((e) => {
    const d = new Date(e.datetimeISO);
    return d >= cutoff && d <= futureLimit;
  });

  // Sort by date
  filtered.sort((a, b) => new Date(a.datetimeISO).getTime() - new Date(b.datetimeISO).getTime());

  // Deduplicate by id
  const seen = new Set<string>();
  const deduped = filtered.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  const fetchedAt = new Date().toISOString();
  cache = { data: deduped, cachedAt: Date.now(), fetchedAt };
  return NextResponse.json({ ok: true, events: deduped, fetchedAt, source: fredKey ? "fred+curated" : "curated" }, {
    headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600" },
  });
}
