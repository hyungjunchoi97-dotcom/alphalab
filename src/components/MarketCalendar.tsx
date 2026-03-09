"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useLang } from "@/lib/LangContext";

// ── Types ────────────────────────────────────────────────────
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

// ── Badge config ─────────────────────────────────────────────
const BADGE_COLORS: Record<string, string> = {
  cpi: "bg-amber-500/25 text-amber-400",
  fomc: "bg-red-500/25 text-red-400",
  gdp: "bg-green-500/25 text-green-400",
  nfp: "bg-blue-500/25 text-blue-400",
  bok: "bg-purple-500/25 text-purple-400",
  ppi: "bg-orange-500/25 text-orange-400",
  derivatives: "bg-purple-500/25 text-purple-400",
  political: "bg-red-500/25 text-red-400",
};

const BADGE_LABELS: Record<string, string> = {
  fomc: "FOMC",
  cpi: "CPI",
  bok: "BOK",
  gdp: "GDP",
  nfp: "NFP",
  ppi: "PPI",
  derivatives: "OPEX",
  political: "POL",
};

const HIGH_IMPACT_TYPES = new Set(["fomc", "cpi", "nfp", "gdp", "bok"]);

const IMPACT_LABEL: Record<string, { text: string; cls: string }> = {
  HIGH: { text: "HIGH", cls: "text-red-400" },
  MEDIUM: { text: "MEDIUM", cls: "text-amber-400" },
  LOW: { text: "LOW", cls: "text-[#555]" },
};

function getImpactLevel(ev: CalendarEvent): "HIGH" | "MEDIUM" | "LOW" {
  if (ev.importance >= 5) return "HIGH";
  if (ev.importance >= 3) return "MEDIUM";
  return "LOW";
}

// ── Helpers ──────────────────────────────────────────────────
function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toSeoulDateKey(iso: string): string {
  const d = new Date(iso);
  const seoul = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return toDateKey(seoul);
}

function getSeoulToday(): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

function formatTimeKST(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function getMonthDays(year: number, month: number): { date: Date; key: string; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const startDay = first.getDay(); // 0=Sun
  const lastDate = new Date(year, month + 1, 0).getDate();

  const days: { date: Date; key: string; inMonth: boolean }[] = [];

  // Fill leading days from prev month
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, key: toDateKey(d), inMonth: false });
  }

  // Current month days
  for (let d = 1; d <= lastDate; d++) {
    const dt = new Date(year, month, d);
    days.push({ date: dt, key: toDateKey(dt), inMonth: true });
  }

  // Fill trailing days to complete grid (6 rows max)
  while (days.length % 7 !== 0) {
    const last = days[days.length - 1].date;
    const d = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    days.push({ date: d, key: toDateKey(d), inMonth: false });
  }

  return days;
}

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ── Component ────────────────────────────────────────────────
export default function MarketCalendar() {
  const { lang } = useLang();
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<string>("");

  const now = getSeoulToday();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // TODO: replace with API fetch for future automation
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

  // Group events by date key
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of allEvents) {
      const key = toSeoulDateKey(ev.datetimeISO);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    // Sort each day's events by time
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(a.datetimeISO).getTime() - new Date(b.datetimeISO).getTime());
    }
    return map;
  }, [allEvents]);

  const todayKey = toDateKey(now);
  const days = useMemo(() => getMonthDays(viewYear, viewMonth), [viewYear, viewMonth]);
  const selectedEvents = selectedDay ? (eventsByDate[selectedDay] || []) : [];

  // Navigation
  const goPrev = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
    setSelectedDay(null);
  };

  const goNext = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
    setSelectedDay(null);
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-3">
          <div className="h-5 w-32 rounded bg-card-border/30 animate-pulse" />
          <div className="flex gap-2">
            <div className="h-5 w-12 rounded bg-card-border/20 animate-pulse" />
            <div className="h-5 w-12 rounded bg-card-border/20 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-px">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-16 rounded bg-card-border/10 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-mono text-sm font-bold text-foreground tracking-wide">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </h3>
        <div className="flex gap-0">
          <button
            onClick={goPrev}
            className="px-3 py-1 text-[10px] font-mono font-bold text-[#555] border border-[#1a1a1a] hover:text-[#888] hover:border-[#333] transition-colors"
          >
            &lt; PREV
          </button>
          <button
            onClick={goNext}
            className="px-3 py-1 text-[10px] font-mono font-bold text-[#555] border border-[#1a1a1a] border-l-0 hover:text-[#888] hover:border-[#333] transition-colors"
          >
            NEXT &gt;
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-px mb-px">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="py-1 text-center text-[9px] font-mono font-bold tracking-widest text-[#444]">
            {wd}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px">
        {days.map(({ date, key, inMonth }) => {
          const dayEvents = eventsByDate[key] || [];
          const isToday = key === todayKey;
          const isSelected = key === selectedDay;
          const highImpactCount = dayEvents.filter((e) => HIGH_IMPACT_TYPES.has(e.category) && e.importance >= 5).length;

          let cellBg = "bg-[#0a0a0a]";
          let cellBorder = "border-transparent";
          if (highImpactCount >= 2) {
            cellBg = "bg-red-950";
            cellBorder = "border-red-800";
          } else if (dayEvents.length > 0) {
            cellBg = "bg-amber-950/30";
          }
          if (isSelected) {
            cellBg = "bg-amber-500/15";
            cellBorder = "border-amber-500/50";
          }
          if (isToday && !isSelected) {
            cellBorder = "border-amber-500";
          }

          const visibleBadges = dayEvents.slice(0, 2);
          const extraCount = dayEvents.length - 2;

          return (
            <div
              key={key}
              onClick={() => {
                if (dayEvents.length > 0) setSelectedDay(isSelected ? null : key);
              }}
              className={`relative min-h-[60px] md:min-h-[72px] p-1 border ${cellBorder} ${cellBg} transition-colors ${
                inMonth ? "" : "opacity-30"
              } ${dayEvents.length > 0 ? "cursor-pointer hover:bg-[#161616]" : ""}`}
            >
              {/* Day number */}
              <span
                className={`block text-[10px] font-mono mb-0.5 ${
                  isToday ? "text-amber-400 font-bold" : "text-[#555]"
                } ${date.getDay() === 0 ? "text-red-400/60" : ""} ${date.getDay() === 6 ? "text-blue-400/60" : ""}`}
              >
                {date.getDate()}
              </span>

              {/* Event badges */}
              <div className="flex flex-wrap gap-0.5">
                {visibleBadges.map((ev) => (
                  <span
                    key={ev.id}
                    className={`inline-block px-1 py-px text-[8px] font-mono font-bold leading-tight ${
                      BADGE_COLORS[ev.category] || "bg-[#222] text-[#666]"
                    }`}
                  >
                    {BADGE_LABELS[ev.category] || ev.category.toUpperCase().slice(0, 4)}
                  </span>
                ))}
                {extraCount > 0 && (
                  <span className="text-[8px] font-mono text-[#555]">+{extraCount}</span>
                )}
              </div>

              {/* Tooltip on hover */}
              {dayEvents.length > 0 && (
                <div className="absolute left-0 bottom-full mb-1 z-50 hidden group-hover:block pointer-events-none" />
              )}
            </div>
          );
        })}
      </div>

      {/* Selected day detail panel */}
      {selectedDay && selectedEvents.length > 0 && (
        <div className="mt-2 border border-[#1a1a1a] bg-[#0a0a0a]">
          <div className="px-3 py-2 border-b border-[#1a1a1a] flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-amber-400 tracking-wider">
              {selectedDay}
            </span>
            <button
              onClick={() => setSelectedDay(null)}
              className="text-[#555] hover:text-foreground transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="divide-y divide-[#1a1a1a]">
            {selectedEvents.map((ev) => {
              const impact = getImpactLevel(ev);
              const impactInfo = IMPACT_LABEL[impact];
              const title = lang === "kr" && ev.titleKr ? ev.titleKr : ev.title;
              return (
                <div key={ev.id} className="px-3 py-2 flex items-center gap-3">
                  {/* Time */}
                  <span className="text-[10px] font-mono text-[#555] w-12 shrink-0">
                    {formatTimeKST(ev.datetimeISO)}
                  </span>
                  {/* Badge */}
                  <span
                    className={`shrink-0 px-1.5 py-px text-[9px] font-mono font-bold ${
                      BADGE_COLORS[ev.category] || "bg-[#222] text-[#666]"
                    }`}
                  >
                    {BADGE_LABELS[ev.category] || ev.category.toUpperCase()}
                  </span>
                  {/* Title */}
                  <span className="flex-1 text-xs font-mono text-[#ccc] truncate">
                    {title}
                  </span>
                  {/* A/F/P */}
                  {(ev.actual || ev.forecast || ev.previous) && (
                    <span className="text-[9px] font-mono text-[#555] tabular-nums shrink-0">
                      {ev.actual != null && <span>A:<span className="text-foreground">{ev.actual}</span></span>}
                      {ev.forecast != null && <span className="ml-1">F:<span className="text-foreground">{ev.forecast}</span></span>}
                      {ev.previous != null && <span className="ml-1">P:<span className="text-foreground">{ev.previous}</span></span>}
                    </span>
                  )}
                  {/* Impact */}
                  <span className={`text-[9px] font-mono font-bold shrink-0 ${impactInfo.cls}`}>
                    {impactInfo.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      {fetchedAt && (
        <div className="mt-2 text-right text-[9px] font-mono text-[#333] tabular-nums">
          {lang === "kr" ? "업데이트" : "Updated"}: {new Date(fetchedAt).toLocaleString(lang === "kr" ? "ko-KR" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </div>
  );
}
