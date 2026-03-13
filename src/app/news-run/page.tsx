"use client";

import { useState, useEffect, useCallback } from "react";
import AppHeader from "@/components/AppHeader";

// ── Types ──────────────────────────────────────────────────────

interface KeyIssue {
  title: string;
  summary: string;
  source: string;
  url?: string;
}

interface Security {
  firm: string;
  ticker: string;
  action: string;
  priceTarget?: string;
  headline: string;
  summary: string;
}

interface RealEstate {
  title: string;
  summary: string;
}

interface SnapshotItem { price: number; change: number }

interface MarketSnapshot {
  sp500: SnapshotItem | null;
  nasdaq: SnapshotItem | null;
  dxy: SnapshotItem | null;
  gold: SnapshotItem | null;
  silver: SnapshotItem | null;
  oil: SnapshotItem | null;
  usdkrw: SnapshotItem | null;
  fearGreed: { value: number; rating: string };
  btc: SnapshotItem | null;
  eth: SnapshotItem | null;
  asOf: string;
}

interface LiveMarketItem { price: number; change: number; changePct: number }

interface LiveMarket {
  sp500: LiveMarketItem | null;
  nasdaq: LiveMarketItem | null;
  usdkrw: LiveMarketItem | null;
  dxy: LiveMarketItem | null;
  gold: LiveMarketItem | null;
  silver: LiveMarketItem | null;
  wti: LiveMarketItem | null;
  btc: LiveMarketItem | null;
  eth: LiveMarketItem | null;
  fearGreed: { score: number; rating: string };
  asOf: string;
}

interface Report {
  keyIssues?: KeyIssue[];
  securities?: Security[];
  realEstate?: RealEstate[];
  snapshot?: MarketSnapshot;
  generatedAt?: string;
}

// ── Helpers ────────────────────────────────────────────────────

function fmtLong(d: string) {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")}`;
}

function fmtDay(d: string) {
  const dt = new Date(d + "T00:00:00");
  return ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"][dt.getDay()];
}

function fmtShort(d: string) {
  const dt = new Date(d + "T00:00:00");
  const day = ["일", "월", "화", "수", "목", "금", "토"][dt.getDay()];
  return `${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")} ${day}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(json: any): Report {
  let keyIssues = json.keyIssues;
  let securities = json.securities;
  let realEstate = json.realEstate;

  // Old field name migration
  if (!keyIssues && Array.isArray(json.highlights)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    keyIssues = json.highlights.map((h: any) => ({
      title: h.content ?? "", summary: h.reason ?? "", source: "",
    }));
  }
  if (!realEstate && Array.isArray(json.realestate)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    realEstate = json.realestate.map((r: any) => ({
      title: "", summary: r.content ?? "",
    }));
  }

  // String array → object array
  if (Array.isArray(keyIssues) && keyIssues.length > 0 && typeof keyIssues[0] === "string") {
    keyIssues = keyIssues.map((s: string) => ({ title: s, summary: "", source: "", url: "" }));
  }
  if (Array.isArray(realEstate) && realEstate.length > 0 && typeof realEstate[0] === "string") {
    realEstate = realEstate.map((s: string) => ({ title: s, summary: "" }));
  }

  // Old rationale → summary
  if (Array.isArray(securities) && securities.length > 0 && securities[0]?.rationale !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    securities = securities.map((s: any) => ({
      firm: s.firm ?? "", ticker: "", action: "", headline: s.headline ?? "", summary: s.rationale ?? "",
    }));
  }

  return {
    keyIssues: Array.isArray(keyIssues) ? keyIssues : [],
    securities: Array.isArray(securities) ? securities : [],
    realEstate: Array.isArray(realEstate) ? realEstate : [],
    snapshot: json.snapshot || undefined,
    generatedAt: json.generatedAt || "",
  };
}

// ── Skeleton ───────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-8">
      {[1, 2, 3].map((s) => (
        <div key={s}>
          <div className="mb-3 h-3 w-40 animate-pulse rounded bg-white/[0.06]" />
          <div className="mb-2 h-px bg-white/5" />
          <div className="space-y-4">
            {[1, 2].map((j) => (
              <div key={j} className="space-y-2">
                <div className="h-3 w-24 animate-pulse rounded bg-white/[0.04]" />
                <div className="h-3 animate-pulse rounded bg-white/[0.03]" style={{ width: `${55 + j * 15}%` }} />
                <div className="h-2.5 animate-pulse rounded bg-white/[0.02]" style={{ width: `${40 + j * 10}%` }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Snapshot helpers ──────────────────────────────────────────

function fmtPrice(v: number, digits = 2) {
  if (!v) return "—";
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fgColor(rating: string) {
  const r = rating.toLowerCase();
  if (r.includes("extreme fear")) return "text-red-500";
  if (r.includes("fear")) return "text-orange-400";
  if (r.includes("extreme greed")) return "text-green-300";
  if (r.includes("greed")) return "text-green-400";
  return "text-[#999]";
}


function SidebarMarketRow({ label, item, digits = 2 }: { label: string; item: LiveMarketItem | null; digits?: number }) {
  if (!item) return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-mono text-gray-600">—</span>
    </div>
  );
  const pos = item.changePct >= 0;
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-mono text-white">{fmtPrice(item.price, digits)}</span>
        <span className={`text-[10px] font-mono ${pos ? "text-green-400" : "text-red-400"}`}>
          {pos ? "+" : ""}{item.changePct.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

function LiveMarketSidebar({ data }: { data: LiveMarket }) {
  const fgScore = data.fearGreed.score;
  const fgRat = data.fearGreed.rating;
  const fgPositive = fgScore > 50;
  return (
    <div className="border-t border-white/10 pt-4 mt-4">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-semibold">Market</p>
      <div>
        <SidebarMarketRow label="S&P 500" item={data.sp500} />
        <SidebarMarketRow label="NASDAQ" item={data.nasdaq} />
        <SidebarMarketRow label="USD/KRW" item={data.usdkrw} />
        <SidebarMarketRow label="DXY" item={data.dxy} />
        <SidebarMarketRow label="GOLD" item={data.gold} />
        <SidebarMarketRow label="SILVER" item={data.silver} />
        <SidebarMarketRow label="WTI" item={data.wti} />
        <SidebarMarketRow label="BTC" item={data.btc} digits={0} />
        <SidebarMarketRow label="ETH" item={data.eth} digits={0} />
        {/* Fear & Greed */}
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-gray-400">Fear & Greed</span>
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-mono font-bold ${fgPositive ? "text-green-400" : "text-red-400"}`}>
              {fgScore || "—"}
            </span>
            {fgRat && (
              <span className={`rounded px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase ${
                fgPositive ? "bg-green-400/10 text-green-400" : "bg-red-400/10 text-red-400"
              }`}>
                {fgRat}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ── Component ──────────────────────────────────────────────────

// KST today string
function todayKST(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export default function NewsRunPage() {
  const [dates, setDates] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [liveMarket, setLiveMarket] = useState<LiveMarket | null>(null);
  const [generating, setGenerating] = useState(false);
  const [todayExists, setTodayExists] = useState(true);

  // Fetch dates on mount → default to today (KST)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/news-run/dates");
        const json = await res.json();
        const list: string[] = Array.isArray(json?.dates) ? json.dates : [];
        setDates(list);
        const today = todayKST();
        if (list.includes(today)) {
          setSelected(today);
          setTodayExists(true);
        } else {
          setTodayExists(false);
          // Select today anyway so the user can generate, or fall back to latest
          setSelected(today);
        }
      } catch {
        /* noop */
      }
    })();
  }, []);

  // Fetch live market (sidebar + top bar), auto-refresh every 5 min
  useEffect(() => {
    const fetchLive = async () => {
      try {
        const res = await fetch("/api/news-run/market");
        const json = await res.json();
        if (json?.ok && json.data) setLiveMarket(json.data);
      } catch {
        /* noop */
      }
    };
    fetchLive();
    const id = setInterval(fetchLive, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch report when date changes
  const fetchReport = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch(`/api/news-run?date=${date}`);
      const json = await res.json();
      if (json?.ok) {
        const normalized = normalize(json);
        setReport(normalized);
        // Check if this is an empty/placeholder response
        const today = todayKST();
        if (date === today) {
          const hasContent = (normalized.keyIssues?.length ?? 0) > 0 ||
            (normalized.securities?.length ?? 0) > 0 ||
            (normalized.realEstate?.length ?? 0) > 0;
          setTodayExists(hasContent);
        }
      } else {
        setError("브리핑을 불러올 수 없습니다");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) fetchReport(selected);
  }, [selected, fetchReport]);

  // Generate today's brief
  const handleGenerate = useCallback(async () => {
    const today = todayKST();
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/news-run?date=${today}&refresh=true`);
      const json = await res.json();
      if (json?.ok) {
        setReport(normalize(json));
        setTodayExists(true);
        setSelected(today);
        // Add today to dates list if not there
        setDates((prev) => prev.includes(today) ? prev : [today, ...prev]);
      } else {
        setError("브리핑 생성에 실패했습니다");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setGenerating(false);
    }
  }, []);

  const ki = report?.keyIssues ?? [];
  const sec = report?.securities ?? [];
  const re = report?.realEstate ?? [];
  const hasData = ki.length > 0 || sec.length > 0 || re.length > 0;

  // ── Date list (shared) ──
  const today = todayKST();
  const displayDates = dates.includes(today) ? dates : [today, ...dates];

  const dateList = (
    <div className="space-y-0.5">
      {displayDates.map((d) => {
        const isToday = d === today;
        const inArchive = dates.includes(d);
        return (
          <button
            key={d}
            onClick={() => { setSelected(d); setArchiveOpen(false); }}
            className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-xs font-mono transition-colors ${
              d === selected
                ? "border-l-2 border-[#f59e0b] bg-white/[0.03] pl-2.5 text-[#f59e0b] font-medium"
                : "text-[#666] hover:bg-white/[0.03] hover:text-white"
            }`}
          >
            <span>
              {fmtShort(d)}
              {isToday && <span className="ml-1.5 text-[8px] text-[#f59e0b]/60">TODAY</span>}
            </span>
            {!inArchive && isToday ? (
              <span className="text-[8px] text-[#555]">NEW</span>
            ) : (
              <svg className="h-3 w-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>
        );
      })}
      {displayDates.length === 0 && (
        <p className="px-3 py-4 text-[10px] font-mono text-[#444]">브리핑 없음</p>
      )}
    </div>
  );

  // ── Report content ──
  const content = (
    <>
      {loading && <Skeleton />}

      {!loading && error && (
        <div className="flex items-center justify-center py-20">
          <div className="rounded border border-white/[0.06] bg-white/[0.02] px-8 py-6 text-center max-w-md">
            <p className="text-sm text-[#888] font-mono leading-relaxed">
              오늘의 브리핑을 불러올 수 없습니다.
            </p>
            <p className="text-sm text-[#888] font-mono leading-relaxed">
              잠시 후 다시 시도해주세요.
            </p>
            <button
              onClick={() => { if (selected) fetchReport(selected); }}
              className="mt-4 rounded border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-xs font-mono text-[#888] hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              다시 시도
            </button>
          </div>
        </div>
      )}

      {!loading && !error && report && !hasData && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-sm text-[#555] font-mono">
            {selected === todayKST() ? "오늘의 브리핑이 아직 생성되지 않았습니다" : "해당 날짜의 브리핑이 없습니다"}
          </p>
          {selected === todayKST() && !todayExists && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-5 py-2.5 text-sm font-mono font-medium text-[#f59e0b] hover:bg-[#f59e0b]/20 transition-colors disabled:opacity-40"
            >
              {generating ? "생성 중..." : "브리프 생성"}
            </button>
          )}
        </div>
      )}

      {!loading && !error && !report && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-sm text-[#555] font-mono">
            {dates.length === 0 ? "아직 생성된 브리핑이 없습니다" : "브리핑을 불러올 수 없습니다"}
          </p>
          {selected === todayKST() && !todayExists && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-5 py-2.5 text-sm font-mono font-medium text-[#f59e0b] hover:bg-[#f59e0b]/20 transition-colors disabled:opacity-40"
            >
              {generating ? "생성 중..." : "브리프 생성"}
            </button>
          )}
        </div>
      )}

      {!loading && !error && hasData && selected && (
        <div className="space-y-12">
          {/* Header */}
          <div className="border-b border-white/[0.08] pb-6">
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#555]">
              Alphalab Daily Brief
            </p>
            <p className="mt-2 text-3xl font-mono font-bold text-white tracking-tight">
              {fmtLong(selected)}
            </p>
            <p className="mt-1 text-sm font-mono text-[#666]">{fmtDay(selected)}</p>
          </div>

          {/* Section 1: KEY ISSUES */}
          <section>
            <div className="mb-5 flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f59e0b]/15 text-[11px] font-bold text-[#f59e0b]">1</span>
              <h2 className="text-base font-semibold uppercase tracking-widest text-white">
                핵심 이슈
              </h2>
              <span className="text-[11px] font-mono text-[#444]">{ki.length}</span>
            </div>
            <div className="mb-6 h-px bg-white/[0.06]" />

            {ki.length === 0 ? (
              <p className="text-sm font-mono text-[#444]">해당 날짜 핵심 이슈 없음</p>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {ki.map((item, i) => (
                  <div key={i} className="py-5 first:pt-0 last:pb-0">
                    <div className="flex items-baseline gap-2.5 mb-2">
                      <span className="font-mono font-bold text-[#f59e0b] text-sm shrink-0">{i + 1}.</span>
                      <h3 className="text-base font-semibold text-white leading-relaxed">
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#f59e0b] transition-colors">{item.title}</a>
                        ) : item.title}
                      </h3>
                      {item.source && (
                        <span className="ml-auto text-[10px] font-mono text-[#555] shrink-0">{item.source}</span>
                      )}
                    </div>
                    {item.summary && (
                      <p className="text-sm text-[#999] leading-7 pl-6">{item.summary}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 2: FOREIGN BROKER RESEARCH */}
          <section>
            <div className="mb-5 flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f59e0b]/15 text-[11px] font-bold text-[#f59e0b]">2</span>
              <h2 className="text-base font-semibold uppercase tracking-widest text-white">
                외국계 증권사 리포트
              </h2>
              <span className="text-[11px] font-mono text-[#444]">{sec.length}</span>
            </div>
            <div className="mb-6 h-px bg-white/[0.06]" />

            {sec.length === 0 ? (
              <p className="text-sm font-mono text-[#444]">해당 날짜 외국계 리포트 없음</p>
            ) : (
              <div className="space-y-5">
                {sec.map((item, i) => (
                  <div key={i} className="border-l-2 border-[#f59e0b]/50 bg-white/[0.02] rounded-r pl-4 pr-5 py-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="inline-block rounded bg-[#f59e0b]/10 px-2 py-0.5 text-[11px] font-bold text-[#f59e0b] font-mono">
                        {item.firm}
                      </span>
                      {item.ticker && (
                        <span className="text-[11px] font-mono text-[#666]">{item.ticker}</span>
                      )}
                      {item.action && (
                        <span className="inline-block rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-mono font-medium text-[#ccc]">
                          {item.action}
                        </span>
                      )}
                      {item.priceTarget && (
                        <span className="inline-block rounded bg-[#f59e0b]/5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-[#f59e0b]/70">
                          {item.priceTarget}
                        </span>
                      )}
                    </div>
                    <p className="text-base font-medium text-white leading-relaxed">{item.headline}</p>
                    {item.summary && (
                      <p className="mt-2 text-sm text-[#999] leading-7">{item.summary}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 3: REAL ESTATE */}
          <section>
            <div className="mb-5 flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#10b981]/15 text-[11px] font-bold text-[#10b981]">3</span>
              <h2 className="text-base font-semibold uppercase tracking-widest text-white">
                부동산 동향
              </h2>
              <span className="text-[11px] font-mono text-[#444]">{re.length}</span>
            </div>
            <div className="mb-6 h-px bg-white/[0.06]" />

            {re.length === 0 ? (
              <p className="text-sm font-mono text-[#444]">해당 날짜 부동산 데이터 없음</p>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {re.map((item, i) => (
                  <div key={i} className="py-4 first:pt-0 last:pb-0">
                    {item.title && <h3 className="text-sm font-semibold text-white mb-1.5">{item.title}</h3>}
                    {item.summary && <p className="text-sm text-[#999] leading-7">{item.summary}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Footer */}
          <div className="border-t border-white/[0.05] pt-6 text-center">
            <p className="text-[10px] font-mono text-[#444]">
              Generated by AlphaLab AI
              {report?.generatedAt && (
                <span className="ml-1">
                  &middot; {new Date(report.generatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} KST
                </span>
              )}
            </p>
            <p className="mt-1 text-[9px] font-mono text-white/10">
              투자 판단의 참고자료이며 정확성을 보장하지 않습니다
            </p>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="newsRun" />

      <div className="mx-auto max-w-[1100px] px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar — desktop only */}
          <aside className="hidden lg:block w-48 shrink-0">
            <div className="sticky top-24">
              <p className="mb-3 px-3 text-[9px] font-mono uppercase tracking-widest text-[#555]">
                Archive
              </p>
              {dateList}
              {liveMarket && <LiveMarketSidebar data={liveMarket} />}
            </div>
          </aside>

          {/* Main */}
          <main className="min-w-0 flex-1 max-w-2xl">{content}</main>
        </div>

        {/* Mobile archive accordion */}
        <div className="mt-10 lg:hidden">
          <button
            onClick={() => setArchiveOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded border border-white/[0.06] bg-white/[0.02] px-4 py-3"
          >
            <span className="text-xs font-mono uppercase tracking-widest text-[#666]">Archive</span>
            <svg
              className={`h-4 w-4 text-[#555] transition-transform duration-200 ${archiveOpen ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {archiveOpen && (
            <div className="mt-1 rounded border border-white/[0.06] bg-white/[0.01] p-2">
              {dateList}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
