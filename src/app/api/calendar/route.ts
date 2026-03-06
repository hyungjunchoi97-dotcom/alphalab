import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface CalendarEvent {
  id: string;
  region: "US" | "KR" | "JP";
  category: "rate" | "inflation" | "employment" | "derivatives" | "political";
  title: string;
  datetimeISO: string;
  importance: number;
  forecast?: string;
  previous?: string;
  actual?: string;
}

interface CacheEntry {
  data: CalendarEvent[];
  cachedAt: number;
}

let cache: CacheEntry | null = null;

// ── Date helpers ────────────────────────────────────────────

function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  // Find nth occurrence of weekday (0=Sun..6=Sat) in month (0-indexed)
  const d = new Date(Date.UTC(year, month, 1));
  let count = 0;
  while (count < n) {
    if (d.getUTCDay() === weekday) count++;
    if (count < n) d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

function nthBusinessDay(year: number, month: number, n: number): Date {
  const d = new Date(Date.UTC(year, month, 1));
  let count = 0;
  while (count < n) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
    if (count < n) d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

function thirdFriday(year: number, month: number): Date {
  return nthWeekday(year, month, 5, 3);
}

function formatISO(d: Date, time: string): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}T${time}Z`;
}

// ── Generate events ─────────────────────────────────────────

function generateEvents(): CalendarEvent[] {
  const now = new Date();
  const events: CalendarEvent[] = [];

  // Generate for current month + next 6 months
  for (let offset = -1; offset <= 6; offset++) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + offset);
    const year = d.getFullYear();
    const month = d.getMonth(); // 0-indexed

    const monthStr = String(month + 1).padStart(2, "0");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mName = monthNames[month];

    // ── US EVENTS ──

    // NFP: First Friday of month (released at 8:30 ET = 13:30 UTC)
    const nfpDate = nthWeekday(year, month, 5, 1);
    events.push({
      id: `us-nfp-${year}${monthStr}`,
      region: "US", category: "employment",
      title: "Non-Farm Payrolls",
      datetimeISO: formatISO(nfpDate, "13:30:00"),
      importance: 5,
    });

    // US CPI: ~10th-13th, typically 2nd week Tuesday/Wednesday (8:30 ET = 12:30 UTC)
    // Approximation: 2nd or 3rd Wednesday
    const cpiDate = nthWeekday(year, month, 3, 2); // 2nd Wednesday
    if (cpiDate.getUTCDate() < 10) {
      cpiDate.setUTCDate(cpiDate.getUTCDate() + 7);
    }
    events.push({
      id: `us-cpi-${year}${monthStr}`,
      region: "US", category: "inflation",
      title: `US CPI (${mName})`,
      datetimeISO: formatISO(cpiDate, "12:30:00"),
      importance: 5,
    });

    // US PPI: day after CPI typically
    const ppiDate = new Date(cpiDate);
    ppiDate.setUTCDate(ppiDate.getUTCDate() + 1);
    events.push({
      id: `us-ppi-${year}${monthStr}`,
      region: "US", category: "inflation",
      title: `US PPI (${mName})`,
      datetimeISO: formatISO(ppiDate, "12:30:00"),
      importance: 3,
    });

    // Monthly OPEX: 3rd Friday
    const opexDate = thirdFriday(year, month);
    events.push({
      id: `us-opex-${year}${monthStr}`,
      region: "US", category: "derivatives",
      title: "Monthly Options Expiry",
      datetimeISO: formatISO(opexDate, "20:00:00"),
      importance: 3,
    });

    // ── KR EVENTS ──

    // KR CPI: 5th business day each month (~01:00 UTC = 10:00 KST)
    const krCpiDate = nthBusinessDay(year, month, 5);
    events.push({
      id: `kr-cpi-${year}${monthStr}`,
      region: "KR", category: "inflation",
      title: "KR CPI (YoY)",
      datetimeISO: formatISO(krCpiDate, "00:00:00"),
      importance: 4,
    });

    // KOSPI200 Options Expiry: 2nd Thursday each month
    const krOpexDate = nthWeekday(year, month, 4, 2);
    events.push({
      id: `kr-opex-${year}${monthStr}`,
      region: "KR", category: "derivatives",
      title: "KOSPI200 Options Expiry",
      datetimeISO: formatISO(krOpexDate, "06:00:00"),
      importance: 3,
    });

    // ── JP EVENTS ──

    // JP CPI: 3rd Friday each month (~23:30 UTC prev day = 08:30 JST)
    const jpCpiDate = thirdFriday(year, month);
    events.push({
      id: `jp-cpi-${year}${monthStr}`,
      region: "JP", category: "inflation",
      title: "JP CPI (YoY)",
      datetimeISO: formatISO(jpCpiDate, "23:30:00"),
      importance: 4,
    });
  }

  // ── FOMC Dates (8 meetings per year, predetermined) ──
  // 2026 FOMC dates (announced by Fed)
  const fomcDates2026 = [
    [1, 29], [3, 18], [5, 6], [6, 17], [7, 29], [9, 16], [10, 28], [12, 16],
  ];
  for (const [m, d] of fomcDates2026) {
    const dt = new Date(Date.UTC(2026, m - 1, d));
    events.push({
      id: `us-fomc-2026${String(m).padStart(2, "0")}`,
      region: "US", category: "rate",
      title: "FOMC Rate Decision",
      datetimeISO: formatISO(dt, "18:00:00"),
      importance: 5,
    });
  }

  // 2027 FOMC dates (estimated)
  const fomcDates2027 = [
    [1, 27], [3, 17], [5, 5], [6, 16], [7, 28], [9, 22], [11, 3], [12, 15],
  ];
  for (const [m, d] of fomcDates2027) {
    const dt = new Date(Date.UTC(2027, m - 1, d));
    events.push({
      id: `us-fomc-2027${String(m).padStart(2, "0")}`,
      region: "US", category: "rate",
      title: "FOMC Rate Decision",
      datetimeISO: formatISO(dt, "18:00:00"),
      importance: 5,
    });
  }

  // ── BOK Rate Decisions (approx every 6 weeks, 8 per year) ──
  const bokDates2026 = [
    [1, 16], [2, 27], [4, 9], [5, 29], [7, 10], [8, 28], [10, 16], [11, 27],
  ];
  for (const [m, d] of bokDates2026) {
    const dt = new Date(Date.UTC(2026, m - 1, d));
    events.push({
      id: `kr-bok-2026${String(m).padStart(2, "0")}`,
      region: "KR", category: "rate",
      title: "BOK Base Rate Decision",
      datetimeISO: formatISO(dt, "01:00:00"),
      importance: 5,
    });
  }

  // ── BOJ Rate Decisions (8 per year) ──
  const bojDates2026 = [
    [1, 24], [3, 14], [4, 28], [6, 16], [7, 31], [9, 19], [10, 30], [12, 18],
  ];
  for (const [m, d] of bojDates2026) {
    const dt = new Date(Date.UTC(2026, m - 1, d));
    events.push({
      id: `jp-boj-2026${String(m).padStart(2, "0")}`,
      region: "JP", category: "rate",
      title: "BOJ Rate Decision",
      datetimeISO: formatISO(dt, "03:00:00"),
      importance: 5,
    });
  }

  // ── Quad Witching (3rd Friday of Mar, Jun, Sep, Dec) ──
  for (let y = 2026; y <= 2027; y++) {
    for (const m of [2, 5, 8, 11]) {
      const qwDate = thirdFriday(y, m);
      events.push({
        id: `us-quad-${y}${String(m + 1).padStart(2, "0")}`,
        region: "US", category: "derivatives",
        title: "Quad Witching",
        datetimeISO: formatISO(qwDate, "20:00:00"),
        importance: 4,
      });
    }
  }

  // ── Political events ──
  events.push({
    id: "us-midterms-2026",
    region: "US", category: "political",
    title: "US Midterm Elections",
    datetimeISO: "2026-11-03T00:00:00Z",
    importance: 5,
  });

  // Filter: only future events + events from past 7 days
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const filtered = events.filter(e => new Date(e.datetimeISO) >= cutoff);

  // Sort by date
  filtered.sort((a, b) => new Date(a.datetimeISO).getTime() - new Date(b.datetimeISO).getTime());

  // Deduplicate by id (keep first occurrence)
  const seen = new Set<string>();
  const deduped = filtered.filter(e => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  return deduped;
}

// ── Route handler ───────────────────────────────────────────

export async function GET() {
  if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
    return NextResponse.json({ ok: true, events: cache.data });
  }

  const events = generateEvents();
  cache = { data: events, cachedAt: Date.now() };
  return NextResponse.json({ ok: true, events });
}
