"use client";

import { useState, useMemo } from "react";
import { MOCK_EVENTS, type CalendarEvent } from "@/lib/marketCalendar.mock";
import { useLang } from "@/lib/LangContext";

type RegionFilter = "ALL" | "KR" | "US" | "JP";

const CATEGORY_LABELS: Record<CalendarEvent["category"], string> = {
  rate: "RATE",
  inflation: "CPI",
  employment: "JOBS",
  derivatives: "OPEX",
  political: "POL",
};

const CATEGORY_COLORS: Record<CalendarEvent["category"], string> = {
  rate: "bg-accent/20 text-accent",
  inflation: "bg-yellow-500/20 text-yellow-400",
  employment: "bg-gain/20 text-gain",
  derivatives: "bg-purple-500/20 text-purple-400",
  political: "bg-loss/20 text-loss",
};

function toSeoulDate(iso: string): Date {
  // Convert to Asia/Seoul display
  const d = new Date(iso);
  const seoul = new Date(
    d.toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
  return seoul;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
  });
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

function EventRow({
  event,
  showDate,
}: {
  event: CalendarEvent;
  showDate: boolean;
}) {
  const hasAFP = event.actual || event.forecast || event.previous;

  return (
    <div className="flex items-start gap-3 border-b border-card-border/30 py-1.5 last:border-0">
      <span className="w-11 shrink-0 text-[10px] tabular-nums text-muted">
        {showDate ? formatShortDate(event.datetimeISO) : formatTime(event.datetimeISO)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs">{event.title}</p>
        {hasAFP && (
          <p className="mt-0.5 text-[9px] tabular-nums text-muted">
            {event.actual != null && (
              <span>
                A:<span className="text-foreground">{event.actual}</span>
              </span>
            )}
            {event.forecast != null && (
              <span className={event.actual != null ? "ml-2" : ""}>
                F:<span className="text-foreground">{event.forecast}</span>
              </span>
            )}
            {event.previous != null && (
              <span className="ml-2">
                P:<span className="text-foreground">{event.previous}</span>
              </span>
            )}
          </p>
        )}
      </div>
      <span
        className={`shrink-0 rounded px-1 py-px text-[9px] font-medium ${
          CATEGORY_COLORS[event.category]
        }`}
      >
        {CATEGORY_LABELS[event.category]}
      </span>
      <ImportanceDots level={event.importance} />
    </div>
  );
}

function GroupSection({
  label,
  events,
  showDate,
}: {
  label: string;
  events: CalendarEvent[];
  showDate: boolean;
}) {
  if (events.length === 0) return null;
  return (
    <div className="mb-3 last:mb-0">
      <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </h3>
      <div>
        {events.map((e) => (
          <EventRow key={e.id} event={e} showDate={showDate} />
        ))}
      </div>
    </div>
  );
}

export default function MarketCalendar() {
  const { t } = useLang();
  const [region, setRegion] = useState<RegionFilter>("ALL");

  const { today, thisWeek, upcoming } = useMemo(() => {
    const filtered =
      region === "ALL"
        ? MOCK_EVENTS
        : MOCK_EVENTS.filter((e) => e.region === region);

    const sorted = [...filtered].sort(
      (a, b) =>
        new Date(a.datetimeISO).getTime() - new Date(b.datetimeISO).getTime()
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
        if (upcomingEvents.length < 10) {
          upcomingEvents.push(ev);
        }
      }
    }

    return { today: todayEvents, thisWeek: weekEvents, upcoming: upcomingEvents };
  }, [region]);

  const isEmpty =
    today.length === 0 && thisWeek.length === 0 && upcoming.length === 0;

  return (
    <div>
      {/* Region tabs */}
      <div className="mb-3 inline-flex gap-px rounded bg-card-border p-px">
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

      {isEmpty ? (
        <p className="py-3 text-center text-[10px] text-muted">
          {t("noEvents")}
        </p>
      ) : (
        <>
          <GroupSection label={t("today")} events={today} showDate={false} />
          <GroupSection label={t("thisWeek")} events={thisWeek} showDate={false} />
          <GroupSection label={t("upcoming")} events={upcoming} showDate={true} />
        </>
      )}
    </div>
  );
}
