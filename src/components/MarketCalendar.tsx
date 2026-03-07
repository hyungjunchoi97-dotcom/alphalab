"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useLang } from "@/lib/LangContext";

interface CalendarEvent {
  id: string;
  region: "US" | "KR" | "JP";
  category: string;
  title: string;
  titleKr: string;
  datetimeISO: string;
  importance: number;
  actual?: string;
  forecast?: string;
  previous?: string;
}

type RegionFilter = "ALL" | "KR" | "US" | "JP";
type CategoryFilter = "ALL" | "fomc" | "cpi" | "bok" | "gdp" | "nfp";

const CATEGORY_LABELS: Record<string, string> = {
  fomc: "FOMC",
  cpi: "CPI",
  bok: "BOK",
  gdp: "GDP",
  nfp: "NFP",
  ppi: "PPI",
  derivatives: "OPEX",
  political: "POL",
};

const CATEGORY_COLORS: Record<string, string> = {
  fomc: "bg-accent/20 text-accent",
  cpi: "bg-yellow-500/20 text-yellow-400",
  bok: "bg-blue-500/20 text-blue-400",
  gdp: "bg-gain/20 text-gain",
  nfp: "bg-purple-500/20 text-purple-400",
  ppi: "bg-orange-500/20 text-orange-400",
  derivatives: "bg-purple-500/20 text-purple-400",
  political: "bg-loss/20 text-loss",
};

function formatDateTime(iso: string, lang: "en" | "kr"): string {
  const d = new Date(iso);
  const month = d.toLocaleString(lang === "kr" ? "ko-KR" : "en-US", { timeZone: "Asia/Seoul", month: "2-digit" });
  const day = d.toLocaleString(lang === "kr" ? "ko-KR" : "en-US", { timeZone: "Asia/Seoul", day: "2-digit" });
  const time = d.toLocaleTimeString("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${month}/${day} ${time}`;
}

function formatDateKST(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" });
  const month = d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric" });
  const day = d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${month} ${day} (${weekday}) ${time}`;
}

function getSeoulToday(): Date {
  const now = new Date();
  const s = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  s.setHours(0, 0, 0, 0);
  return s;
}

function getSeoulWeekBounds(): [Date, Date] {
  const today = getSeoulToday();
  const day = today.getDay();
  const mon = new Date(today);
  mon.setDate(today.getDate() - ((day + 6) % 7));
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return [mon, sun];
}

function toSeoulDate(iso: string): Date {
  const d = new Date(iso);
  const seoul = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return seoul;
}

function ImportanceDots({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-px">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`inline-block h-1 w-1 rounded-full ${
            i < level ? "bg-foreground" : "bg-card-border"
          }`}
        />
      ))}
    </span>
  );
}

function EventRow({ event, lang }: { event: CalendarEvent; lang: "en" | "kr" }) {
  const hasAFP = event.actual || event.forecast || event.previous;
  const title = lang === "kr" && event.titleKr ? event.titleKr : event.title;

  return (
    <div className="flex items-start gap-3 border-b border-card-border/30 py-1.5 last:border-0">
      <span className="w-[105px] shrink-0 text-[10px] tabular-nums text-muted">
        {lang === "kr" ? formatDateKST(event.datetimeISO) : formatDateTime(event.datetimeISO, lang)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs">{title}</p>
        {hasAFP && (
          <p className="mt-0.5 text-[9px] tabular-nums text-muted">
            {event.actual != null && (
              <span>A:<span className="text-foreground">{event.actual}</span></span>
            )}
            {event.forecast != null && (
              <span className={event.actual != null ? "ml-2" : ""}>
                F:<span className="text-foreground">{event.forecast}</span>
              </span>
            )}
            {event.previous != null && (
              <span className="ml-2">P:<span className="text-foreground">{event.previous}</span></span>
            )}
          </p>
        )}
      </div>
      <span
        className={`shrink-0 rounded px-1 py-px text-[9px] font-medium ${
          CATEGORY_COLORS[event.category] || "bg-muted/20 text-muted"
        }`}
      >
        {CATEGORY_LABELS[event.category] || event.category.toUpperCase()}
      </span>
      <ImportanceDots level={event.importance} />
    </div>
  );
}

function GroupSection({ label, events, lang }: { label: string; events: CalendarEvent[]; lang: "en" | "kr" }) {
  if (events.length === 0) return null;
  return (
    <div className="mb-3 last:mb-0">
      <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </h3>
      <div>
        {events.map((e) => (
          <EventRow key={e.id} event={e} lang={lang} />
        ))}
      </div>
    </div>
  );
}

const CATEGORY_FILTERS: { value: CategoryFilter; label: string; labelKr: string }[] = [
  { value: "ALL", label: "All", labelKr: "전체" },
  { value: "fomc", label: "FOMC", labelKr: "FOMC" },
  { value: "cpi", label: "CPI", labelKr: "CPI" },
  { value: "bok", label: "BOK", labelKr: "금통위" },
  { value: "gdp", label: "GDP", labelKr: "GDP" },
  { value: "nfp", label: "NFP", labelKr: "NFP" },
];

export default function MarketCalendar() {
  const { t, lang } = useLang();
  const [region, setRegion] = useState<RegionFilter>("ALL");
  const [category, setCategory] = useState<CategoryFilter>("ALL");
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchCalendar = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar");
      const json = await res.json();
      if (json.ok && json.events) {
        setAllEvents(json.events);
        if (json.fetchedAt) setFetchedAt(json.fetchedAt);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const { today, thisWeek, upcoming } = useMemo(() => {
    let filtered = region === "ALL" ? allEvents : allEvents.filter((e) => e.region === region);
    if (category !== "ALL") {
      filtered = filtered.filter((e) => e.category === category);
    }

    const sorted = [...filtered].sort(
      (a, b) => new Date(a.datetimeISO).getTime() - new Date(b.datetimeISO).getTime()
    );

    const todayDate = getSeoulToday();
    const [weekStart, weekEnd] = getSeoulWeekBounds();

    const todayEvents: CalendarEvent[] = [];
    const weekEvents: CalendarEvent[] = [];
    const upcomingEvents: CalendarEvent[] = [];

    for (const ev of sorted) {
      const evSeoul = toSeoulDate(ev.datetimeISO);
      evSeoul.setHours(0, 0, 0, 0);

      if (evSeoul.getTime() === todayDate.getTime()) {
        todayEvents.push(ev);
      } else if (evSeoul >= weekStart && evSeoul <= weekEnd) {
        weekEvents.push(ev);
      } else if (evSeoul > weekEnd) {
        upcomingEvents.push(ev);
      }
    }

    return { today: todayEvents, thisWeek: weekEvents, upcoming: upcomingEvents };
  }, [region, category, allEvents]);

  const isEmpty = today.length === 0 && thisWeek.length === 0 && upcoming.length === 0;

  if (loading) {
    return (
      <div className="flex h-[150px] items-center justify-center">
        <span className="text-xs text-muted animate-pulse">Loading...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Region tabs */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-px rounded bg-card-border p-px">
          {(["ALL", "KR", "US", "JP"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                region === r
                  ? "bg-accent text-white"
                  : "bg-card-bg text-muted hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Category filters */}
        <div className="inline-flex gap-px rounded bg-card-border p-px">
          {CATEGORY_FILTERS.map((cf) => (
            <button
              key={cf.value}
              onClick={() => setCategory(cf.value)}
              className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                category === cf.value
                  ? "bg-accent text-white"
                  : "bg-card-bg text-muted hover:text-foreground"
              }`}
            >
              {lang === "kr" ? cf.labelKr : cf.label}
            </button>
          ))}
        </div>
      </div>

      {isEmpty ? (
        <p className="py-3 text-center text-[10px] text-muted">
          {t("noEvents")}
        </p>
      ) : (
        <div className="max-h-[500px] overflow-y-auto pr-1">
          <GroupSection label={t("today")} events={today} lang={lang} />
          <GroupSection label={t("thisWeek")} events={thisWeek} lang={lang} />
          <GroupSection label={t("upcoming")} events={upcoming} lang={lang} />
        </div>
      )}

      {fetchedAt && (
        <div className="mt-2 text-right text-[9px] text-muted/60 tabular-nums">
          {lang === "kr" ? "업데이트" : "Updated"}: {new Date(fetchedAt).toLocaleString(lang === "kr" ? "ko-KR" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </div>
  );
}
