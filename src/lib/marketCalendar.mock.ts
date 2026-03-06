export interface CalendarEvent {
  id: string;
  region: "US" | "KR" | "JP";
  category: "rate" | "inflation" | "employment" | "derivatives" | "political";
  title: string;
  datetimeISO: string;
  importance: 1 | 2 | 3 | 4 | 5;
  actual?: string;
  forecast?: string;
  previous?: string;
}

export const MOCK_EVENTS: CalendarEvent[] = [
  // ── US ──
  {
    id: "us-fomc-mar",
    region: "US",
    category: "rate",
    title: "FOMC Rate Decision",
    datetimeISO: "2026-03-18T18:00:00Z",
    importance: 5,
    forecast: "4.25%",
    previous: "4.50%",
  },
  {
    id: "us-cpi-mar",
    region: "US",
    category: "inflation",
    title: "US CPI (MoM)",
    datetimeISO: "2026-03-12T12:30:00Z",
    importance: 5,
    forecast: "0.3%",
    previous: "0.4%",
  },
  {
    id: "us-nfp-mar",
    region: "US",
    category: "employment",
    title: "Non-Farm Payrolls",
    datetimeISO: "2026-03-06T13:30:00Z",
    importance: 5,
    forecast: "198K",
    previous: "143K",
  },
  {
    id: "us-opex-mar",
    region: "US",
    category: "derivatives",
    title: "Monthly OPEX (US Options Expiry)",
    datetimeISO: "2026-03-20T20:00:00Z",
    importance: 3,
  },
  {
    id: "us-ppi-mar",
    region: "US",
    category: "inflation",
    title: "US PPI (MoM)",
    datetimeISO: "2026-03-13T12:30:00Z",
    importance: 3,
    forecast: "0.2%",
    previous: "0.3%",
  },
  {
    id: "us-fomc-jun",
    region: "US",
    category: "rate",
    title: "FOMC Rate Decision",
    datetimeISO: "2026-06-17T18:00:00Z",
    importance: 5,
  },
  {
    id: "us-quad-jun",
    region: "US",
    category: "derivatives",
    title: "Quad Witching",
    datetimeISO: "2026-06-19T20:00:00Z",
    importance: 4,
  },
  {
    id: "us-cpi-apr",
    region: "US",
    category: "inflation",
    title: "US CPI (MoM)",
    datetimeISO: "2026-04-10T12:30:00Z",
    importance: 5,
  },
  {
    id: "us-nfp-apr",
    region: "US",
    category: "employment",
    title: "Non-Farm Payrolls",
    datetimeISO: "2026-04-03T12:30:00Z",
    importance: 5,
  },
  {
    id: "us-midterms",
    region: "US",
    category: "political",
    title: "US Midterm Elections",
    datetimeISO: "2026-11-03T00:00:00Z",
    importance: 5,
  },

  // ── KR ──
  {
    id: "kr-bok-mar",
    region: "KR",
    category: "rate",
    title: "BOK Base Rate Decision",
    datetimeISO: "2026-03-02T01:00:00Z",
    importance: 5,
    actual: "2.75%",
    forecast: "2.75%",
    previous: "3.00%",
  },
  {
    id: "kr-cpi-mar",
    region: "KR",
    category: "inflation",
    title: "KR CPI (YoY)",
    datetimeISO: "2026-03-03T00:00:00Z",
    importance: 4,
    forecast: "2.0%",
    previous: "2.2%",
  },
  {
    id: "kr-opex-mar",
    region: "KR",
    category: "derivatives",
    title: "KOSPI200 Options Expiry",
    datetimeISO: "2026-03-12T06:00:00Z",
    importance: 3,
  },
  {
    id: "kr-bok-apr",
    region: "KR",
    category: "rate",
    title: "BOK Base Rate Decision",
    datetimeISO: "2026-04-09T01:00:00Z",
    importance: 5,
  },
  {
    id: "kr-cpi-apr",
    region: "KR",
    category: "inflation",
    title: "KR CPI (YoY)",
    datetimeISO: "2026-04-02T00:00:00Z",
    importance: 4,
  },
  {
    id: "kr-election",
    region: "KR",
    category: "political",
    title: "KR General Election",
    datetimeISO: "2028-04-12T00:00:00Z",
    importance: 5,
  },

  // ── JP ──
  {
    id: "jp-boj-mar",
    region: "JP",
    category: "rate",
    title: "BOJ Rate Decision",
    datetimeISO: "2026-03-13T03:00:00Z",
    importance: 5,
    forecast: "0.50%",
    previous: "0.50%",
  },
  {
    id: "jp-cpi-mar",
    region: "JP",
    category: "inflation",
    title: "JP CPI (YoY)",
    datetimeISO: "2026-03-20T23:30:00Z",
    importance: 4,
    forecast: "3.4%",
    previous: "3.6%",
  },
  {
    id: "jp-boj-apr",
    region: "JP",
    category: "rate",
    title: "BOJ Rate Decision",
    datetimeISO: "2026-04-28T03:00:00Z",
    importance: 5,
  },
  {
    id: "jp-cpi-apr",
    region: "JP",
    category: "inflation",
    title: "JP CPI (YoY)",
    datetimeISO: "2026-04-17T23:30:00Z",
    importance: 4,
  },
  {
    id: "jp-election",
    region: "JP",
    category: "political",
    title: "JP House of Councillors Election",
    datetimeISO: "2028-07-25T00:00:00Z",
    importance: 5,
  },
];
