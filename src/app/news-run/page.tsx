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

function chgColor(v: number) {
  if (v > 0) return "text-green-400";
  if (v < 0) return "text-red-400";
  return "text-[#666]";
}

function fgColor(rating: string) {
  const r = rating.toLowerCase();
  if (r.includes("extreme fear")) return "text-red-500";
  if (r.includes("fear")) return "text-orange-400";
  if (r.includes("extreme greed")) return "text-green-300";
  if (r.includes("greed")) return "text-green-400";
  return "text-[#999]";
}

function SnapshotRow({ label, item, digits = 2 }: { label: string; item: SnapshotItem | null; digits?: number }) {
  if (!item) return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[9px] text-[#555]">{label}</span>
      <span className="text-[10px] font-mono text-[#444]">—</span>
    </div>
  );
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[9px] text-[#555]">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] font-mono text-white">{fmtPrice(item.price, digits)}</span>
        <span className={`text-[10px] font-mono ${chgColor(item.change)}`}>
          {item.change > 0 ? "+" : ""}{item.change.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

function SnapshotSidebar({ snapshot }: { snapshot: MarketSnapshot }) {
  return (
    <div className="border-t border-white/10 pt-4 mt-4">
      <p className="text-[9px] font-mono uppercase tracking-widest text-[#555] mb-2">Market</p>
      <div>
        <SnapshotRow label="S&P 500" item={snapshot.sp500} />
        <SnapshotRow label="NASDAQ" item={snapshot.nasdaq} />
        <SnapshotRow label="USD/KRW" item={snapshot.usdkrw} />
        <SnapshotRow label="DXY" item={snapshot.dxy} />
        <SnapshotRow label="GOLD" item={snapshot.gold} />
        <SnapshotRow label="SILVER" item={snapshot.silver} />
        <SnapshotRow label="WTI" item={snapshot.oil} />
        <SnapshotRow label="BTC" item={snapshot.btc} digits={0} />
        <SnapshotRow label="ETH" item={snapshot.eth} digits={0} />
        {/* Fear & Greed */}
        <div className="flex items-center justify-between py-1 mt-1 border-t border-white/[0.06] pt-2">
          <span className="text-[9px] text-[#555]">Fear & Greed</span>
          <span className={`text-[11px] font-mono font-bold ${fgColor(snapshot.fearGreed.rating)}`}>
            {snapshot.fearGreed.value || "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Live Market Bar ──────────────────────────────────────────

function LiveMarketTicker({ label, item }: { label: string; item: LiveMarketItem | null }) {
  if (!item) return null;
  const pos = item.changePct >= 0;
  return (
    <div className="flex items-baseline gap-1.5 shrink-0">
      <span className="text-[9px] text-[#555] uppercase">{label}</span>
      <span className="text-[11px] font-mono text-white">{item.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
      <span className={`text-[10px] font-mono ${pos ? "text-emerald-400" : "text-red-400"}`}>
        {pos ? "+" : ""}{item.changePct.toFixed(2)}%
      </span>
    </div>
  );
}

function LiveMarketBar({ data }: { data: LiveMarket }) {
  return (
    <div className="mb-6 rounded border border-white/[0.08] bg-white/[0.015] px-4 py-2.5 overflow-x-auto">
      <div className="flex items-center gap-5 min-w-max">
        <LiveMarketTicker label="S&P 500" item={data.sp500} />
        <LiveMarketTicker label="NASDAQ" item={data.nasdaq} />
        <LiveMarketTicker label="USD/KRW" item={data.usdkrw} />
        <LiveMarketTicker label="DXY" item={data.dxy} />
        <LiveMarketTicker label="GOLD" item={data.gold} />
        <LiveMarketTicker label="SILVER" item={data.silver} />
        <LiveMarketTicker label="WTI" item={data.wti} />
        <LiveMarketTicker label="BTC" item={data.btc} />
        <LiveMarketTicker label="ETH" item={data.eth} />
        {data.fearGreed.score > 0 && (
          <div className="flex items-baseline gap-1.5 shrink-0 border-l border-white/[0.08] pl-5">
            <span className="text-[9px] text-[#555] uppercase">F&G</span>
            <span className={`text-[11px] font-mono font-bold ${fgColor(data.fearGreed.rating)}`}>
              {data.fearGreed.score}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────

export default function NewsRunPage() {
  const [dates, setDates] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [liveMarket, setLiveMarket] = useState<LiveMarket | null>(null);

  // Fetch dates on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/news-run/dates");
        const json = await res.json();
        const list: string[] = Array.isArray(json?.dates) ? json.dates : [];
        setDates(list);
        if (list.length > 0) setSelected(list[0]);
      } catch {
        /* noop */
      }
    })();
  }, []);

  // Fetch live market snapshot on mount (sidebar)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/market-snapshot");
        const json = await res.json();
        if (json?.ok && json.snapshot) setSnapshot(json.snapshot);
      } catch {
        /* noop */
      }
    })();
  }, []);

  // Fetch live market bar (auto-refresh every 5 min)
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
    try {
      const res = await fetch(`/api/news-run?date=${date}`);
      const json = await res.json();
      if (json?.ok) {
        setReport(normalize(json));
      } else {
        setError(json?.error || "브리핑을 불러올 수 없습니다");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selected) fetchReport(selected);
  }, [selected, fetchReport]);

  const ki = report?.keyIssues ?? [];
  const sec = report?.securities ?? [];
  const re = report?.realEstate ?? [];
  const hasData = ki.length > 0 || sec.length > 0 || re.length > 0;

  // ── Date list (shared) ──
  const dateList = (
    <div className="space-y-0.5">
      {dates.map((d) => (
        <button
          key={d}
          onClick={() => { setSelected(d); setArchiveOpen(false); }}
          className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-xs font-mono transition-colors ${
            d === selected
              ? "border-l-2 border-[#f59e0b] bg-white/[0.03] pl-2.5 text-[#f59e0b] font-medium"
              : "text-[#666] hover:bg-white/[0.03] hover:text-white"
          }`}
        >
          <span>{fmtShort(d)}</span>
          <svg className="h-3 w-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ))}
      {dates.length === 0 && (
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
          <p className="text-xs text-red-400/80 font-mono">{error}</p>
        </div>
      )}

      {!loading && !error && report && !hasData && (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-[#555] font-mono">오늘의 브리핑을 준비 중입니다</p>
        </div>
      )}

      {!loading && !error && !report && dates.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-[#555] font-mono">아직 생성된 브리핑이 없습니다</p>
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
        {liveMarket && <LiveMarketBar data={liveMarket} />}
        <div className="flex gap-8">
          {/* Sidebar — desktop only */}
          <aside className="hidden lg:block w-48 shrink-0">
            <div className="sticky top-24">
              <p className="mb-3 px-3 text-[9px] font-mono uppercase tracking-widest text-[#555]">
                Archive
              </p>
              {dateList}
              {snapshot && <SnapshotSidebar snapshot={snapshot} />}
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
