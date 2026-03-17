"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from "react";
import { useLang } from "@/lib/LangContext";
import AppHeader from "@/components/AppHeader";
import GuruContent from "@/components/GuruContent";
import AiTradingContent from "@/components/AiTradingContent";

const CARD =
  "rounded-[12px] border border-card-border bg-card-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3)]";
const TH =
  "pb-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted";
const TD = "py-1.5";

// ── Types ────────────────────────────────────────────────────

interface FomoItem {
  ticker: string;
  name: string;
  nameKr?: string;
  price: number;
  chgPct: number;
  tag: string;
  volumeRatio: number;
  volume: number;
  metrics: { chg1d: number; chg5d: number; chg20d: number; near52wHigh: boolean; volumeSpike: boolean; tradingValue: number };
}

interface FomoUsItem {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  volume: number;
  avgVolume: number;
  volumeRatio: number;
  tradingValue: number;
}

interface AiResult {
  bullets: string[];
  risk: string;
  confidence: number;
}

interface UsProfile {
  description: string;
  sector: string;
  industry: string;
  ceo: string;
  fullTimeEmployees: number | null;
  website: string;
  country: string;
}

interface UsNewsItem {
  title: string;
  url: string;
  publishedDate: string;
}

type UsSector = "tech" | "financial" | "healthcare" | "energy" | "consumer";

const US_SECTORS: { key: UsSector; label: string; labelKr: string }[] = [
  { key: "tech", label: "TECH", labelKr: "테크" },
  { key: "financial", label: "FINANCIAL", labelKr: "금융" },
  { key: "healthcare", label: "HEALTHCARE", labelKr: "헬스케어" },
  { key: "energy", label: "ENERGY", labelKr: "에너지" },
  { key: "consumer", label: "CONSUMER", labelKr: "소비재" },
];

type SignalFilter = "ALL" | "VOLUME SPIKE" | "BREAKOUT" | "MOMO";

const SIGNAL_FILTERS: SignalFilter[] = ["ALL", "VOLUME SPIKE", "BREAKOUT", "MOMO"];

const SIGNAL_TOOLTIPS: Record<string, string> = {
  "VOLUME SPIKE": "평균 대비 3배 이상 거래량 급증. 기관/세력 개입 가능성",
  "BREAKOUT": "최근 20일 고점 돌파. 신규 상승 추세 시작 신호",
  "MOMO": "가격과 거래량 동반 상승. 추세 추종 매매 포착",
};

const SIGNAL_BORDER_COLOR: Record<string, string> = {
  "VOLUME SPIKE": "border-l-yellow-500",
  "BREAKOUT": "border-l-blue-500",
  "MOMO": "border-l-green-500",
};

const TAG_COLORS: Record<string, string> = {
  "52W HIGH": "bg-gain/20 text-gain",
  MOMO: "bg-accent/20 text-accent",
  "VOLUME SPIKE": "bg-yellow-500/20 text-yellow-400",
  PULLBACK: "bg-purple-500/20 text-purple-400",
  BREAKOUT: "bg-teal-500/20 text-teal-400",
  VALUE: "bg-blue-500/20 text-blue-400",
  "LOW PER": "bg-cyan-500/20 text-cyan-400",
  "HIGH DIV": "bg-amber-500/20 text-amber-400",
};

function ChgPct({ v }: { v: number }) {
  return (
    <span className={v >= 0 ? "text-gain" : "text-loss"}>
      {v >= 0 ? "+" : ""}
      {v.toFixed(2)}%
    </span>
  );
}

function formatVol(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(0) + "K";
  return v.toLocaleString();
}

// ── Tooltip icon ────────────────────────────────────────────

function TooltipIcon({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative ml-1 inline-flex cursor-help"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-card-border text-[8px] text-muted">?</span>
      {show && (
        <span className="absolute bottom-full left-1/2 z-50 mb-1.5 w-48 -translate-x-1/2 rounded border border-card-border bg-card-bg px-2.5 py-1.5 text-[10px] leading-relaxed text-muted shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}

// ── Per-tab tables ──────────────────────────────────────────

function FomoTable({ items, selected, onSelect, lang }: { items: FomoItem[]; selected: string | null; onSelect: (item: FomoItem) => void; lang: "en" | "kr" }) {
  return (
    <table className="w-full text-xs min-w-[400px]">
      <thead>
        <tr className="border-b border-card-border">
          <th className={TH}>Ticker</th>
          <th className={TH}>Name</th>
          <th className={`${TH} text-right`}>Price</th>
          <th className={`${TH} text-right`}>Chg%</th>
          <th className={`${TH} text-right`}>{lang === "kr" ? "거래량비" : "Vol Ratio"}</th>
          <th className={TH}>Tag</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const borderClass = SIGNAL_BORDER_COLOR[item.tag] || "border-l-transparent";
          return (
            <tr
              key={item.ticker}
              onClick={() => onSelect(item)}
              className={`cursor-pointer border-b border-card-border/40 border-l-2 transition-colors ${borderClass} ${
                selected === item.ticker ? "bg-accent/10" : "hover:bg-card-border/20"
              }`}
            >
              <td className={`${TD} pl-2 text-accent`}>{item.ticker}</td>
              <td className={TD}>{lang === "kr" && item.nameKr ? item.nameKr : item.name}</td>
              <td className={`${TD} text-right tabular-nums`}>{item.price.toLocaleString()}</td>
              <td className={`${TD} text-right tabular-nums`}><ChgPct v={item.chgPct} /></td>
              <td className={`${TD} text-right tabular-nums font-medium ${item.volumeRatio >= 2 ? "text-yellow-400" : "text-muted"}`}>
                {item.volumeRatio.toFixed(1)}x
              </td>
              <td className={TD}>
                <span className={`inline-block rounded px-1.5 py-px text-[9px] font-medium ${TAG_COLORS[item.tag] || "bg-muted/20 text-muted"}`}>
                  {item.tag}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Market hours helper ───────────────────────────────────────

function isKrMarketOpen(): boolean {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const day = kst.getDay();
  if (day === 0 || day === 6) return false;
  const hhmm = kst.getHours() * 100 + kst.getMinutes();
  return hhmm >= 900 && hhmm <= 1530;
}

// ── Main page ────────────────────────────────────────────────


export default function IdeasPage() {
  const { t, lang } = useLang();
  const [tab, setTab] = useState<"fomo" | "etf" | "kr-etf" | "dividend-etf" | "dividend-screener" | "dividend-guide" | "consensus" | "gurus" | "ai-trading">("fomo");
  const [selected, setSelected] = useState<FomoItem | null>(null);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Financials for detail panel
  const [detailFin, setDetailFin] = useState<{
    market: string;
    ticker: string;
    marketCap: number | null;
    price: number | null;
    quarterly: { label: string; revenue: number | null; operatingIncome: number | null; netIncome: number | null }[];
  } | null>(null);
  const [detailFinLoading, setDetailFinLoading] = useState(false);
  const [detailFinError, setDetailFinError] = useState(false);
  const [showCount, setShowCount] = useState(20);

  // Signal filter
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("ALL");

  // FOMO market toggle
  const [fomoMarket, setFomoMarket] = useState<"KR" | "US">("KR");
  const [usSector, setUsSector] = useState<UsSector>("tech");

  // US FOMO data
  const [fomoUs, setFomoUs] = useState<FomoUsItem[]>([]);
  const [usLoading, setUsLoading] = useState(false);
  const [usError, setUsError] = useState<string | null>(null);
  const [usUpdatedAt, setUsUpdatedAt] = useState<string | null>(null);
  const [usCached, setUsCached] = useState(false);
  const [usSelected, setUsSelected] = useState<FomoUsItem | null>(null);
  const [usProfile, setUsProfile] = useState<UsProfile | null>(null);
  const [usProfileLoading, setUsProfileLoading] = useState(false);
  const [usNews, setUsNews] = useState<UsNewsItem[]>([]);
  const [usDescExpanded, setUsDescExpanded] = useState(false);

  // Translation state
  const [descLang, setDescLang] = useState<"en" | "ko">("en");
  const [descKo, setDescKo] = useState<string | null>(null);
  const [descTranslating, setDescTranslating] = useState(false);
  const [newsLang, setNewsLang] = useState<"en" | "ko">("en");
  const [newsKo, setNewsKo] = useState<Record<number, string>>({});
  const [newsTranslating, setNewsTranslating] = useState(false);

  // Analyst ratings
  const [analystData, setAnalystData] = useState<{
    consensus: string; targetConsensus: number; targetHigh: number; targetLow: number;
    analystCount: number; buyCount: number; holdCount: number; sellCount: number;
  } | null>(null);
  const [analystLoading, setAnalystLoading] = useState(false);

  // KR company info
  const [krProfile, setKrProfile] = useState<UsProfile | null>(null);
  const [krProfileLoading, setKrProfileLoading] = useState(false);
  const [krNews, setKrNews] = useState<UsNewsItem[]>([]);
  const [krDescExpanded, setKrDescExpanded] = useState(false);
  const [krDescLang, setKrDescLang] = useState<"en" | "ko">("en");
  const [krDescKo, setKrDescKo] = useState<string | null>(null);
  const [krDescTranslating, setKrDescTranslating] = useState(false);

  // ETF holdings
  const [etfFilter, setEtfFilter] = useState<string>("IVV");
  const [etfHoldings, setEtfHoldings] = useState<{ symbol: string; name: string; sector: string; weight: number | null }[]>([]);
  const [etfHoldingsDate, setEtfHoldingsDate] = useState<string | null>(null);
  const [etfHoldingsLoading, setEtfHoldingsLoading] = useState(false);
  const [etfHoldingsError, setEtfHoldingsError] = useState<string | null>(null);

  // Wall St Consensus
  interface ConsensusItem { symbol: string; name: string; sector: string; price: number | null; targetConsensus: number | null; targetHigh: number | null; targetLow: number | null; upside: number | null; analystCount: number; rating: string; }
  const [consensusItems, setConsensusItems] = useState<ConsensusItem[]>([]);
  const [consensusLoading, setConsensusLoading] = useState(false);
  const [consensusError, setConsensusError] = useState<string | null>(null);
  const [consensusUpdatedAt, setConsensusUpdatedAt] = useState<string | null>(null);
  const [consensusSectorFilter, setConsensusSectorFilter] = useState("ALL");
  const [consensusRatingFilter, setConsensusRatingFilter] = useState("ALL");
  const [consensusUpsideFilter, setConsensusUpsideFilter] = useState("ALL");
  const [consensusAnalystFilter, setConsensusAnalystFilter] = useState("ALL");
  const [consensusFetched, setConsensusFetched] = useState(false);

  // KR ETF
  const [krEtfs, setKrEtfs] = useState<{ code: string; name: string; holdings: { rank: number; code: string; name: string; weight: number }[] }[]>([]);
  const [krEtfLoading, setKrEtfLoading] = useState(false);
  const [krEtfSelected, setKrEtfSelected] = useState<string | null>(null);
  const [krEtfFetched, setKrEtfFetched] = useState(false);
  const [krEtfCollapsed, setKrEtfCollapsed] = useState<Set<string>>(new Set());
  const [krEtfCommonOpen, setKrEtfCommonOpen] = useState(true);

  // Dividend ETF
  const [divEtfs, setDivEtfs] = useState<{ code: string; name: string; holdings: { rank: number; code: string; name: string; weight: number }[] }[]>([]);
  const [divEtfLoading, setDivEtfLoading] = useState(false);
  const [divEtfSelected, setDivEtfSelected] = useState<string | null>(null);
  const [divEtfFetched, setDivEtfFetched] = useState(false);
  const [divEtfCollapsed, setDivEtfCollapsed] = useState<Set<string>>(new Set());
  const [divEtfCommonOpen, setDivEtfCommonOpen] = useState(true);

  // Dividend Screener
  const [divStocks, setDivStocks] = useState<{ code: string; name: string; price: number; dividendRate: number; dividend: number; exchange: "KOSPI" | "KOSDAQ"; marketCap?: string; marketCapValue?: number; dividend1: number; dividend2: number; dividend3: number; consecutiveYears: number; dividendGrowth: boolean }[]>([]);
  const [divStocksLoading, setDivStocksLoading] = useState(false);
  const [divStocksFetched, setDivStocksFetched] = useState(false);
  const [divMinRate, setDivMinRate] = useState(3);
  const [divMaxRate, setDivMaxRate] = useState(10);
  const [divGrowthOnly, setDivGrowthOnly] = useState(false);
  const [divNewsMap, setDivNewsMap] = useState<Record<string, { items: { title: string; officeName: string; datetime: string; url: string }[]; stockInfo: { marketCap: string; per: string; pbr: string; eps: string; dividendPerShare: string; payoutRatio: string } | null }>>({});
  const [divNewsLoading, setDivNewsLoading] = useState<string | null>(null);
  const [divExpandedCode, setDivExpandedCode] = useState<string | null>(null);
  const [simAmount, setSimAmount] = useState(1);        // 억단위
  const [simDivRate, setSimDivRate] = useState(4);       // 배당수익률 %
  const [simDivGrowth, setSimDivGrowth] = useState(7);   // 연배당성장률 %
  const [simPriceGrowth, setSimPriceGrowth] = useState(5); // 주가성장률 %

  // Data
  const [fomoKr, setFomoKr] = useState<FomoItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [totalStocks, setTotalStocks] = useState(0);

  const fetchScreener = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      const res = await fetch("/api/ideas/screener");
      const json = await res.json();
      if (json.ok) {
        setFomoKr(json.fomoKr || json.fomo || []);
        if (json.asOf) setAsOf(json.asOf);
        setTotalStocks(json.totalStocks || 0);
      } else {
        setDataError(json.error || "Failed to load screener data");
      }
    } catch (err) {
      setDataError(err instanceof Error ? err.message : "Network error");
    } finally {
      setDataLoading(false);
    }
  }, []);

  const fetchConsensus = useCallback(async (refresh = false) => {
    setConsensusLoading(true);
    setConsensusError(null);
    try {
      const url = refresh ? "/api/wall-st-consensus?refresh=true" : "/api/wall-st-consensus";
      const res = await fetch(url);
      const json = await res.json();
      if (json.ok) {
        setConsensusItems(json.items ?? []);
        setConsensusUpdatedAt(json.updatedAt ?? null);
        setConsensusFetched(true);
      } else {
        setConsensusError(json.error || "Failed to load consensus data");
      }
    } catch (err) {
      setConsensusError(err instanceof Error ? err.message : "Network error");
    } finally {
      setConsensusLoading(false);
    }
  }, []);

  const fetchFomoUs = useCallback(async (sector: UsSector, refresh = false) => {
    setUsLoading(true);
    setUsError(null);
    setUsSelected(null);
    try {
      const params = new URLSearchParams({ sector });
      if (refresh) params.set("refresh", "true");
      const res = await fetch(`/api/fomo/us?${params.toString()}`);
      const json = await res.json();
      if (json.ok) {
        setFomoUs(json.results || []);
        setUsUpdatedAt(json.updated_at);
        setUsCached(json.cached ?? false);
      } else {
        setUsError(json.error || "Failed to fetch US FOMO");
      }
    } catch (err) {
      setUsError(err instanceof Error ? err.message : "Network error");
    } finally {
      setUsLoading(false);
    }
  }, []);

  const fetchUsProfile = useCallback(async (symbol: string) => {
    const cacheKey = `company_${symbol}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      setUsProfile(parsed.profile);
      setUsNews(parsed.news);
      return;
    }
    setUsProfileLoading(true);
    setUsProfile(null);
    setUsNews([]);
    setUsDescExpanded(false);
    try {
      const res = await fetch(`/api/company-info?symbol=${encodeURIComponent(symbol)}`);
      const json = await res.json();
      if (json.ok) {
        if (json.profile) setUsProfile(json.profile);
        setUsNews(json.news || []);
        sessionStorage.setItem(cacheKey, JSON.stringify({ profile: json.profile, news: json.news || [] }));
      } else {
        console.warn("company-info error:", json.error);
      }
    } catch (err) {
      console.warn("company-info fetch failed:", err);
    } finally {
      setUsProfileLoading(false);
    }
  }, []);

  const fetchKrProfile = useCallback(async (ticker: string) => {
    const cacheKey = `company_kr_${ticker}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      setKrProfile(parsed.profile);
      setKrNews(parsed.news);
      return;
    }
    setKrProfileLoading(true);
    setKrProfile(null);
    setKrNews([]);
    setKrDescExpanded(false);
    try {
      const res = await fetch(`/api/company-info?symbol=${encodeURIComponent(ticker)}&market=kr`);
      const json = await res.json();
      if (json.ok) {
        if (json.profile) setKrProfile(json.profile);
        setKrNews(json.news || []);
        sessionStorage.setItem(cacheKey, JSON.stringify({ profile: json.profile, news: json.news || [] }));
      }
    } catch { /* noop */ }
    finally { setKrProfileLoading(false); }
  }, []);

  const fetchAnalystRatings = useCallback(async (symbol: string) => {
    const cacheKey = `analyst_${symbol}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed._ts < 24 * 60 * 60 * 1000) {
        setAnalystData(parsed.data);
        return;
      }
    }
    setAnalystLoading(true);
    setAnalystData(null);
    try {
      const res = await fetch(`/api/analyst-ratings?symbol=${encodeURIComponent(symbol)}`);
      const json = await res.json();
      if (json.ok && json.data) {
        setAnalystData(json.data);
        sessionStorage.setItem(cacheKey, JSON.stringify({ data: json.data, _ts: Date.now() }));
      }
    } catch { /* noop */ }
    finally { setAnalystLoading(false); }
  }, []);

  const translateText = useCallback(async (text: string): Promise<string | null> => {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    const cacheKey = `translate_${hash}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return cached;
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (json.ok && json.translated) {
        sessionStorage.setItem(cacheKey, json.translated);
        return json.translated;
      }
    } catch { /* noop */ }
    return null;
  }, []);

  const handleKrDescTranslate = useCallback(async () => {
    if (krDescLang === "ko") { setKrDescLang("en"); return; }
    if (krDescKo) { setKrDescLang("ko"); return; }
    if (!krProfile?.description) return;
    setKrDescTranslating(true);
    const result = await translateText(krProfile.description);
    if (result) { setKrDescKo(result); setKrDescLang("ko"); }
    setKrDescTranslating(false);
  }, [krDescLang, krDescKo, krProfile, translateText]);

  const handleDescTranslate = useCallback(async () => {
    if (descLang === "ko") { setDescLang("en"); return; }
    if (descKo) { setDescLang("ko"); return; }
    if (!usProfile?.description) return;
    setDescTranslating(true);
    const result = await translateText(usProfile.description);
    if (result) { setDescKo(result); setDescLang("ko"); }
    setDescTranslating(false);
  }, [descLang, descKo, usProfile, translateText]);

  const handleNewsTranslate = useCallback(async () => {
    if (newsLang === "ko") { setNewsLang("en"); return; }
    if (Object.keys(newsKo).length > 0) { setNewsLang("ko"); return; }
    if (usNews.length === 0) return;
    setNewsTranslating(true);
    const combined = usNews.map((n) => n.title).join("\n---\n");
    const result = await translateText(combined);
    if (result) {
      const parts = result.split(/\n---\n|\n-{3,}\n/);
      const map: Record<number, string> = {};
      usNews.forEach((_, i) => { map[i] = parts[i]?.trim() || usNews[i].title; });
      setNewsKo(map);
      setNewsLang("ko");
    }
    setNewsTranslating(false);
  }, [newsLang, newsKo, usNews, translateText]);

  const fetchEtfHoldings = useCallback(async (etf: string) => {
    setEtfHoldingsLoading(true);
    setEtfHoldingsError(null);
    try {
      const res = await fetch(`/api/etf/holdings?action=holdings&etf=${encodeURIComponent(etf)}`);
      const json = await res.json();
      if (json.ok) {
        setEtfHoldings(json.holdings || []);
        setEtfHoldingsDate(json.date || null);
      } else {
        setEtfHoldingsError(json.error || "Failed to fetch holdings");
      }
    } catch (err) {
      setEtfHoldingsError(err instanceof Error ? err.message : "Network error");
    } finally {
      setEtfHoldingsLoading(false);
    }
  }, []);


  const [marketOpen, setMarketOpen] = useState(isKrMarketOpen);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchScreener();
  }, [fetchScreener]);

  // Auto-refresh every 60s during KR market hours
  useEffect(() => {
    function tick() {
      const open = isKrMarketOpen();
      setMarketOpen(open);
      if (open && tab === "fomo" && fomoMarket === "KR") {
        fetchScreener();
      }
    }
    refreshTimerRef.current = setInterval(tick, 60_000);
    return () => { if (refreshTimerRef.current) clearInterval(refreshTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, fomoMarket, fetchScreener]);

  // Auto-fetch ETF data when tab/filter changes
  useEffect(() => {
    if (tab === "etf") {
      fetchEtfHoldings(etfFilter);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, etfFilter]);

  // Auto-fetch consensus when tab selected (once)
  useEffect(() => {
    if (tab === "consensus" && !consensusFetched) {
      fetchConsensus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Auto-fetch KR ETF when tab selected (once)
  useEffect(() => {
    if (tab === "kr-etf" && !krEtfFetched) {
      setKrEtfLoading(true);
      fetch("/api/etf/kr-holdings")
        .then(r => r.json())
        .then(j => {
          if (j.ok) { setKrEtfs(j.etfs ?? []); setKrEtfFetched(true); }
        })
        .catch(() => {})
        .finally(() => setKrEtfLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Auto-fetch Dividend ETF when tab selected (once)
  useEffect(() => {
    if (tab === "dividend-etf" && !divEtfFetched) {
      setDivEtfLoading(true);
      fetch("/api/etf/dividend-etf")
        .then(r => r.json())
        .then(j => { if (j.ok) { setDivEtfs(j.etfs ?? []); setDivEtfFetched(true); } })
        .catch(() => {})
        .finally(() => setDivEtfLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Auto-fetch Dividend Screener when tab selected (once)
  useEffect(() => {
    if (tab === "dividend-screener" && !divStocksFetched) {
      setDivStocksLoading(true);
      fetch(`/api/dividend-screener?min=3&max=10`)
        .then(r => r.json())
        .then(j => { if (j.ok) { setDivStocks(j.stocks ?? []); setDivStocksFetched(true); } })
        .catch(() => {})
        .finally(() => setDivStocksLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Auto-fetch US FOMO when sector changes
  useEffect(() => {
    if (tab === "fomo" && fomoMarket === "US") {
      fetchFomoUs(usSector);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usSector, fomoMarket, tab]);

  // Fetch US profile + news + analyst when stock selected
  useEffect(() => {
    if (usSelected) {
      fetchUsProfile(usSelected.symbol);
      fetchAnalystRatings(usSelected.symbol);
    } else {
      setUsProfile(null);
      setUsNews([]);
      setUsDescExpanded(false);
      setAnalystData(null);
    }
    // Reset translations on stock change
    setDescLang("en");
    setDescKo(null);
    setNewsLang("en");
    setNewsKo({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usSelected]);

  // Reset show count when switching tabs
  useEffect(() => {
    setShowCount(20);
  }, [tab]);

  // Filtered items
  const fomoItems = fomoKr;

  const filteredFomo = useMemo(() => {
    let items = fomoItems;
    if (signalFilter !== "ALL") {
      items = items.filter((i) => i.tag === signalFilter);
    }
    return [...items].sort((a, b) => b.volumeRatio - a.volumeRatio);
  }, [fomoItems, signalFilter]);

  // Signal counts for badges
  const signalCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of SIGNAL_FILTERS) {
      if (f === "ALL") {
        counts[f] = fomoItems.length;
      } else {
        counts[f] = fomoItems.filter((i) => i.tag === f).length;
      }
    }
    return counts;
  }, [fomoItems]);

  // Dynamic section header
  const sectionHeader = useMemo(() => {
    const count = filteredFomo.length;
    if (lang === "kr") {
      switch (signalFilter) {
        case "VOLUME SPIKE": return `거래량 폭증 — ${count}개 종목`;
        case "BREAKOUT": return `돌파 매수 신호 — ${count}개 종목`;
        case "MOMO": return `모멘텀 상승 — ${count}개 종목`;
        default: return `FOMO 스크리너 — KR ${count}개 종목`;
      }
    }
    switch (signalFilter) {
      case "VOLUME SPIKE": return `Volume Spike — KR ${count} stocks`;
      case "BREAKOUT": return `Breakout Signal — KR ${count} stocks`;
      case "MOMO": return `Momentum Rising — KR ${count} stocks`;
      default: return `FOMO Screener — KR ${count} stocks`;
    }
  }, [signalFilter, filteredFomo.length, lang]);

  const handleSelect = (item: FomoItem) => {
    setSelected(item);
    setAiResult(null);
    setError(null);
    setAnalystData(null);
    // Reset KR company info translation state
    setKrDescLang("en");
    setKrDescKo(null);
    setKrDescExpanded(false);
    // Auto-fetch financials
    setDetailFin(null);
    setDetailFinError(false);
    setDetailFinLoading(true);
    fetch(`/api/financials?ticker=${encodeURIComponent(item.ticker)}&market=KR`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setDetailFin(json.data);
        else setDetailFinError(true);
      })
      .catch(() => setDetailFinError(true))
      .finally(() => setDetailFinLoading(false));
    // Auto-fetch company info + analyst
    fetchKrProfile(item.ticker);
    fetchAnalystRatings(item.ticker);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="ideas" />

      <main className="mx-auto max-w-[1400px] px-2 sm:px-4 py-3 sm:py-4 space-y-3">
        {/* Tab pills + sub-tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex gap-px rounded bg-card-border p-px w-max sm:w-fit">
            {(["fomo", "etf", "kr-etf", "dividend-etf", "dividend-screener", "dividend-guide", "consensus", "gurus", "ai-trading"] as const).map((tv) => (
              <button
                key={tv}
                onClick={() => {
                  setTab(tv);
                  setSelected(null);
                  setAiResult(null);
                  setError(null);
                }}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  tab === tv
                    ? "bg-accent text-white"
                    : "bg-card-bg text-muted hover:text-foreground"
                }`}
              >
                {tv === "fomo" ? "FOMO"
                  : tv === "etf" ? (lang === "kr" ? "ETF 변동" : "ETF Changes")
                  : tv === "kr-etf" ? (lang === "kr" ? "국내 ETF" : "KR ETF")
                  : tv === "dividend-etf" ? (lang === "kr" ? "배당 ETF" : "Dividend ETF")
                  : tv === "dividend-screener" ? (lang === "kr" ? "배당주" : "Dividend")
                  : tv === "dividend-guide" ? (lang === "kr" ? "배당 가이드" : "Div Guide")
                  : tv === "consensus" ? (lang === "kr" ? "월가 컨센서스" : "Wall St Consensus")
                  : tv === "gurus" ? (lang === "kr" ? "구루" : "Gurus")
                  : (lang === "kr" ? "AI 트레이딩" : "AI Trading")}
              </button>
            ))}
            </div>
          </div>

          {/* Last updated + market status */}
          <div className="flex sm:ml-auto items-center gap-2 text-[10px]">
            {fomoMarket === "KR" && (
              <span className={`flex items-center gap-1 text-[9px] font-medium ${marketOpen ? "text-gain" : "text-muted/50"}`}>
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${marketOpen ? "bg-gain animate-pulse" : "bg-muted/30"}`} />
                {marketOpen ? (lang === "kr" ? "장 중" : "LIVE") : (lang === "kr" ? "장 마감" : "CLOSED")}
                {marketOpen && <span className="text-muted/40 ml-0.5">60s</span>}
              </span>
            )}
            {asOf && (
              <span className="text-[9px] text-muted/60 tabular-nums">
                {lang === "kr" ? "업데이트" : "Updated"}: {new Date(asOf).toLocaleString(lang === "kr" ? "ko-KR" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                {totalStocks > 0 && <span className="ml-1">({totalStocks})</span>}
              </span>
            )}
          </div>
        </div>


        {/* Two-column layout (FOMO only) */}
        {tab === "fomo" && (
          <div className="space-y-3">
            {/* KR / US toggle */}
            <div className="flex items-center gap-3">
              <div className="flex gap-px rounded bg-card-border p-px w-fit">
                {(["KR", "US"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setFomoMarket(m);
                      setSelected(null);
                      setUsSelected(null);
                    }}
                    className={`px-3 py-1 text-[10px] font-mono font-bold tracking-wider transition-colors ${
                      fomoMarket === m
                        ? "bg-accent text-white"
                        : "bg-transparent text-muted hover:text-foreground"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* US sector sub-tabs */}
              {fomoMarket === "US" && (
                <div className="flex flex-wrap gap-1">
                  {US_SECTORS.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => { setUsSector(s.key); setUsSelected(null); }}
                      className={`rounded px-2.5 py-1 text-[10px] font-medium transition-colors ${
                        usSector === s.key
                          ? "bg-accent text-white"
                          : "bg-card-border/50 text-muted hover:text-foreground"
                      }`}
                    >
                      {lang === "kr" ? s.labelKr : s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* KR FOMO */}
            {fomoMarket === "KR" && (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                <section className={`${CARD} lg:col-span-3 overflow-x-auto`}>
                  {/* Signal filter tabs */}
                  <div className="mb-3 flex flex-wrap items-center gap-1.5">
                    {SIGNAL_FILTERS.map((sf) => (
                      <button
                        key={sf}
                        onClick={() => {
                          setSignalFilter(sf);
                          setSelected(null);
                          setAiResult(null);
                        }}
                        className={`flex items-center gap-1 rounded px-2.5 py-1 text-[10px] font-medium transition-colors ${
                          signalFilter === sf
                            ? "bg-accent text-white"
                            : "bg-card-border/50 text-muted hover:text-foreground"
                        }`}
                      >
                        {sf}
                        <span className={`rounded px-1 py-px text-[8px] tabular-nums ${
                          signalFilter === sf ? "bg-white/20" : "bg-card-border"
                        }`}>
                          {signalCounts[sf] || 0}
                        </span>
                        {sf !== "ALL" && SIGNAL_TOOLTIPS[sf] && (
                          <TooltipIcon text={SIGNAL_TOOLTIPS[sf]} />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="mb-3 flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                      {sectionHeader}
                    </h2>
                  </div>

                  {dataLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                      <span className="ml-2 text-xs text-muted">
                        {lang === "kr" ? "데이터 로딩 중..." : "Loading screener data..."}
                      </span>
                    </div>
                  ) : dataError ? (
                    <div className="py-8 text-center">
                      <p className="text-[10px] text-loss">{dataError}</p>
                      <button
                        onClick={fetchScreener}
                        className="mt-2 rounded bg-accent/20 px-3 py-1 text-[10px] text-accent hover:bg-accent/30"
                      >
                        {lang === "kr" ? "다시 시도" : "Retry"}
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      {filteredFomo.length === 0 ? (
                        <p className="py-8 text-center text-[10px] text-muted">{lang === "kr" ? "해당 종목 없음" : "No stocks match"}</p>
                      ) : (
                        <FomoTable items={filteredFomo} selected={selected?.ticker ?? null} onSelect={handleSelect} lang={lang} />
                      )}
                    </div>
                  )}
                </section>

                {/* KR Detail panel */}
                <section className={`${CARD} lg:col-span-2`}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Detail</h2>
                  </div>
                  {!selected ? (
                    <p className="py-8 text-center text-[10px] text-muted">
                      {lang === "kr" ? "목록에서 종목을 선택하세요" : "Select a ticker from the list"}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-bold text-accent">{selected.ticker}</span>
                          <span className="ml-2 text-xs text-muted">{lang === "kr" && selected.nameKr ? selected.nameKr : selected.name}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium tabular-nums">{selected.price.toLocaleString()}</p>
                          <p className="text-[10px] tabular-nums"><ChgPct v={selected.chgPct} /></p>
                        </div>
                      </div>
                      {/* Analyst Consensus (KR) */}
                      {analystLoading && (
                        <div className="border-b border-[#1e1e1e] pb-3">
                          <p className="text-[11px] text-[#555] animate-pulse">Loading analyst data...</p>
                        </div>
                      )}
                      {analystData && !analystLoading && analystData.analystCount > 0 && (() => {
                        const a = analystData;
                        const currentPrice = selected.price;
                        const fmtTarget = (v: number) => v >= 1000 ? v.toLocaleString() : v.toFixed(0);
                        const upsidePct = (target: number) => currentPrice > 0 && target > 0
                          ? ((target - currentPrice) / currentPrice * 100) : null;
                        const consensusUpside = upsidePct(a.targetConsensus);
                        const highUpside = upsidePct(a.targetHigh);
                        const lowUpside = upsidePct(a.targetLow);
                        const total = a.buyCount + a.holdCount + a.sellCount;
                        const buyPct = total > 0 ? Math.round(a.buyCount / total * 100) : 0;
                        const holdPct = total > 0 ? Math.round(a.holdCount / total * 100) : 0;
                        const sellPct = total > 0 ? 100 - buyPct - holdPct : 0;
                        const consensusBg = a.consensus === "Buy" ? "bg-green-500/20 text-green-400" : a.consensus === "Sell" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400";
                        const consensusKr = a.consensus === "Buy" ? "매수" : a.consensus === "Sell" ? "매도" : "중립";
                        return (
                          <div className="border-b border-[#1e1e1e] pb-3">
                            {/* Header */}
                            <p className="text-xs font-semibold uppercase tracking-widest text-[#555] mb-2.5">
                              {lang === "kr" ? "월가 목표주가" : "WALL STREET TARGET"}
                            </p>
                            {/* Row 1: Consensus badge + target + upside */}
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${consensusBg}`}>
                                {lang === "kr" ? consensusKr : a.consensus.toUpperCase()}
                              </span>
                              {a.targetConsensus > 0 && (
                                <span className="text-sm text-white font-mono font-semibold">
                                  {lang === "kr" ? "목표주가" : "Target"} {fmtTarget(a.targetConsensus)}
                                </span>
                              )}
                              {consensusUpside !== null && (
                                <span className={`text-xs font-mono font-semibold ${consensusUpside >= 0 ? "text-green-400" : "text-red-400"}`}>
                                  {consensusUpside >= 0 ? "+" : ""}{consensusUpside.toFixed(1)}%
                                  {lang === "kr" ? (consensusUpside >= 0 ? " 상승여력" : " 하락여력") : (consensusUpside >= 0 ? " upside" : " downside")}
                                </span>
                              )}
                            </div>
                            {/* Row 2: Three target columns */}
                            {(a.targetHigh > 0 || a.targetLow > 0) && (
                              <div className="grid grid-cols-3 gap-2 mb-3">
                                {[
                                  { label: "High", val: a.targetHigh, upside: highUpside, color: "text-green-400" },
                                  { label: lang === "kr" ? "평균" : "Median", val: a.targetConsensus, upside: consensusUpside, color: "text-yellow-400" },
                                  { label: "Low", val: a.targetLow, upside: lowUpside, color: "text-red-400" },
                                ].map(({ label, val, upside, color }) => (
                                  <div key={label} className="rounded bg-[#0f0f0f] px-2.5 py-2 text-center">
                                    <p className="text-[9px] text-[#555] uppercase tracking-wider mb-1">{label}</p>
                                    <p className="text-xs font-mono font-semibold text-white">{val > 0 ? fmtTarget(val) : "—"}</p>
                                    {upside !== null && val > 0 && (
                                      <p className={`text-[10px] font-mono font-medium mt-0.5 ${color}`}>
                                        {upside >= 0 ? "+" : ""}{upside.toFixed(1)}%
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Analyst count */}
                            {a.analystCount > 0 && (
                              <p className="text-[10px] text-[#555] mb-2">
                                {lang === "kr" ? `애널리스트 ${a.analystCount}명` : `${a.analystCount} analysts`}
                              </p>
                            )}
                            {/* Row 3: Buy/Hold/Sell bar */}
                            {total > 0 && (
                              <div>
                                <div className="flex h-2 w-full overflow-hidden rounded-sm">
                                  {buyPct > 0 && <div className="bg-green-500" style={{ width: `${buyPct}%` }} />}
                                  {holdPct > 0 && <div className="bg-yellow-500" style={{ width: `${holdPct}%` }} />}
                                  {sellPct > 0 && <div className="bg-red-500" style={{ width: `${sellPct}%` }} />}
                                </div>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="text-[9px] text-green-400">{lang === "kr" ? "매수" : "Buy"} {buyPct}%</span>
                                  <span className="text-[9px] text-yellow-400">{lang === "kr" ? "중립" : "Hold"} {holdPct}%</span>
                                  <span className="text-[9px] text-red-400">{lang === "kr" ? "매도" : "Sell"} {sellPct}%</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {"volumeRatio" in selected && (() => {
                        const fomo = selected as FomoItem;
                        const volRatio = fomo.volumeRatio;
                        const barPct = Math.min(volRatio / 10 * 100, 100);
                        const avgVol = volRatio > 0 ? fomo.volume / volRatio : 0;
                        const signalTag = fomo.tag;
                        const signalExplanations: Record<string, { kr: string; en: string }> = {
                          "VOLUME SPIKE": { kr: `평균 대비 ${volRatio.toFixed(0)}배 이상 거래량. 기관/세력 개입 가능성`, en: `Volume surged ${volRatio.toFixed(0)}x above average. Possible institutional activity` },
                          "BREAKOUT": { kr: "최근 20일 고점 돌파. 신규 상승 추세 시작 신호", en: "Broke above 20-day high. New uptrend initiation signal" },
                          "MOMO": { kr: "가격과 거래량 모두 상승. 추세 추종 매매 포착", en: "Price and volume both rising. Trend-following signal detected" },
                          "52W HIGH": { kr: "52주 최고가 경신. 강한 상승 추세 확인", en: "52-week high reached. Strong uptrend confirmed" },
                          "PULLBACK": { kr: "단기 조정 후 반등 시도. 저점 매수 기회 탐색", en: "Rebound attempt after pullback. Potential dip-buy opportunity" },
                        };
                        const explanation = signalExplanations[signalTag] || { kr: "복합 시그널 감지", en: "Composite signal detected" };
                        return (
                          <div className="space-y-0">
                            <div className="border-b border-[#1e1e1e] py-3">
                              <p className="text-xs font-semibold uppercase tracking-widest text-[#555] mb-2.5">WHY THIS IS A FOMO SIGNAL</p>
                              <p className="text-sm text-[#aaa] leading-relaxed">
                                {lang === "kr"
                                  ? volRatio >= 5
                                    ? <>평소 대비 <span className="font-mono font-bold text-white">{volRatio.toFixed(1)}배</span> 거래량 폭증 — 기관/세력 대량 개입 가능성</>
                                    : volRatio >= 3
                                    ? <>20일 평균 대비 <span className="font-mono font-bold text-white">{volRatio.toFixed(1)}배</span> 거래량 급증 — 단기 강한 수급 유입</>
                                    : volRatio >= 2
                                    ? <>20일 평균 대비 <span className="font-mono font-bold text-white">{volRatio.toFixed(1)}배</span> 거래량 증가 — 평소보다 {volRatio.toFixed(1)}배 많은 거래 발생</>
                                    : <>20일 평균 대비 <span className="font-mono font-bold text-white">{volRatio.toFixed(1)}배</span> 수준 — 거래량 소폭 증가</>
                                  : volRatio >= 5
                                    ? <>Volume surged <span className="font-mono font-bold text-white">{volRatio.toFixed(1)}x</span> above average — possible institutional activity</>
                                    : volRatio >= 3
                                    ? <>Volume spiked <span className="font-mono font-bold text-white">{volRatio.toFixed(1)}x</span> vs 20D avg — strong inflow detected</>
                                    : volRatio >= 2
                                    ? <>Volume rose <span className="font-mono font-bold text-white">{volRatio.toFixed(1)}x</span> vs 20D avg — trading {volRatio.toFixed(1)}x more than usual</>
                                    : <>Volume at <span className="font-mono font-bold text-white">{volRatio.toFixed(1)}x</span> vs 20D avg — slight increase</>
                                }
                              </p>
                              <div className="relative h-2 w-full overflow-hidden rounded-sm bg-[#1e1e1e] mt-2.5">
                                <div
                                  className={`absolute inset-y-0 left-0 rounded-sm ${volRatio >= 5 ? "bg-yellow-400" : volRatio >= 3 ? "bg-gain" : "bg-accent"}`}
                                  style={{ width: `${barPct}%` }}
                                />
                              </div>
                              <p className="mt-2 text-[10px] text-[#666]">
                                {lang === "kr"
                                  ? <>오늘 <span className="font-mono text-white">{formatVol(fomo.volume)}</span>주 거래 / 20일 평균 <span className="font-mono text-[#888]">{formatVol(avgVol)}</span>주</>
                                  : <>Today <span className="font-mono text-white">{formatVol(fomo.volume)}</span> / 20D avg <span className="font-mono text-[#888]">{formatVol(avgVol)}</span></>
                                }
                              </p>
                            </div>
                            <div className="border-b border-[#1e1e1e] py-3">
                              <p className="text-xs font-semibold uppercase tracking-widest text-[#555] mb-2.5">PRICE MOMENTUM</p>
                              <div className="space-y-1.5">
                                {([["1D", selected.metrics.chg1d], ["5D", selected.metrics.chg5d], ["20D", selected.metrics.chg20d]] as const).map(([label, val]) => (
                                  <div key={label} className="flex items-center justify-between">
                                    <span className="w-8 text-[10px] font-mono text-[#666]">{label}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`text-[10px] ${val >= 0 ? "text-gain" : "text-loss"}`}>{val >= 0 ? "\u25B2" : "\u25BC"}</span>
                                      <span className={`font-mono text-[11px] font-medium tabular-nums ${val >= 0 ? "text-gain" : "text-loss"}`}>
                                        {val >= 0 ? "+" : ""}{val.toFixed(2)}%
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="py-3">
                              <p className="text-xs font-semibold uppercase tracking-widest text-[#555] mb-2.5">SIGNAL TYPE</p>
                              <div className="flex items-start gap-2.5">
                                <span className={`shrink-0 rounded px-2 py-0.5 text-[9px] font-bold ${TAG_COLORS[signalTag] || "bg-muted/20 text-muted"}`}>{signalTag}</span>
                                <p className="text-[10px] leading-relaxed text-[#888]">{lang === "kr" ? explanation.kr : explanation.en}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      {detailFinLoading && (
                        <div className="border-t border-white/10 pt-4 mt-4">
                          <p className="text-xs animate-pulse" style={{ color: "#555" }}>Loading...</p>
                        </div>
                      )}
                      {detailFin && !detailFinLoading && (() => {
                        const isKR = detailFin.market === "KR";
                        const unit = isKR ? (lang === "kr" ? "억원" : "KRW 100M") : "$M";
                        const q = detailFin.quarterly || [];
                        const mcap = detailFin.marketCap;
                        let mcapStr = "—";
                        if (mcap != null) {
                          if (isKR) {
                            const jo = Math.floor(mcap / 10000);
                            const eok = mcap % 10000;
                            mcapStr = jo > 0 ? `${jo}조 ${eok.toLocaleString()}억원` : `${eok.toLocaleString()}억원`;
                          } else {
                            mcapStr = mcap >= 1000 ? `$${(mcap / 1000).toFixed(1)}B` : `$${mcap.toLocaleString()}M`;
                          }
                        }
                        const fmtVal = (v: number | null) => {
                          if (v == null) return "—";
                          const val = isKR ? v / 1e8 : v;
                          const abs = Math.abs(val);
                          const f = abs.toLocaleString(undefined, { maximumFractionDigits: 0 });
                          return val < 0 ? `(${f})` : f;
                        };
                        return (
                          <div className="border-t border-white/10 pt-4 mt-4 space-y-3">
                            <div>
                              <span className="text-[10px]" style={{ color: "#6b7280" }}>{lang === "kr" ? "시가총액" : "Market Cap"}</span>
                              <p className="text-sm font-mono" style={{ color: "#e8e8e8" }}>{mcapStr}</p>
                            </div>
                            {q.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#6b7280" }}>
                                  {lang === "kr" ? "FINANCIALS · 최근 4분기" : "FINANCIALS · Last 4Q"}
                                </p>
                                <div className="overflow-x-auto rounded" style={{ border: "1px solid #222" }}>
                                  <table className="w-full font-mono text-xs" style={{ background: "#080c12" }}>
                                    <thead>
                                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                                        <th className="py-1.5 pl-2 pr-3 text-left text-[9px] font-medium uppercase tracking-wider" style={{ color: "#6b7280" }}>&nbsp;</th>
                                        {q.map((qi, i) => (
                                          <th key={i} className="py-1.5 px-2 text-right text-[9px] font-medium uppercase tracking-wider" style={{ color: "#6b7280" }}>{qi.label}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.03)" }}>
                                        <td className="py-1 pl-2 pr-3 text-[10px] font-medium" style={{ color: "#e8e8e8" }}>{lang === "kr" ? "매출액" : "Revenue"}</td>
                                        {q.map((qi, i) => (
                                          <td key={i} className="py-1 px-2 text-right tabular-nums" style={{ color: qi.revenue != null && qi.revenue < 0 ? "#f87171" : "#e8e8e8" }}>{fmtVal(qi.revenue)}</td>
                                        ))}
                                      </tr>
                                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                        <td className="py-1 pl-2 pr-3 text-[10px]" style={{ color: "#9ca3af" }}>{lang === "kr" ? "영업이익" : "Operating Income"}</td>
                                        {q.map((qi, i) => (
                                          <td key={i} className="py-1 px-2 text-right tabular-nums" style={{ color: qi.operatingIncome != null && qi.operatingIncome < 0 ? "#f87171" : "#9ca3af" }}>{fmtVal(qi.operatingIncome)}</td>
                                        ))}
                                      </tr>
                                      <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                                        <td className="py-1 pl-2 pr-3 text-[10px] font-medium" style={{ color: "#e8e8e8" }}>{lang === "kr" ? "당기순이익" : "Net Income"}</td>
                                        {q.map((qi, i) => (
                                          <td key={i} className="py-1 px-2 text-right tabular-nums" style={{ color: qi.netIncome != null && qi.netIncome < 0 ? "#f87171" : "#e8e8e8" }}>{fmtVal(qi.netIncome)}</td>
                                        ))}
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                                <p className="mt-1 text-[9px] text-right" style={{ color: "#555" }}>{unit}</p>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* KR Company Info */}
                      {krProfileLoading && (
                        <div className="pt-3">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 animate-spin rounded-full border border-[#555] border-t-transparent" />
                            <p className="text-[11px] text-[#555]">Loading profile...</p>
                          </div>
                        </div>
                      )}
                      {krProfile && !krProfileLoading && (
                        <div className="border-t border-[#1e1e1e] pt-4 mt-1">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold uppercase tracking-widest text-[#666]">COMPANY INFO</p>
                            {krProfile.description && (
                              <button
                                onClick={handleKrDescTranslate}
                                disabled={krDescTranslating}
                                className={`flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-mono font-bold transition-colors ${
                                  krDescLang === "ko"
                                    ? "bg-accent/20 text-accent"
                                    : "bg-[#1e1e1e] text-[#666] hover:text-[#aaa]"
                                } disabled:opacity-40`}
                              >
                                {krDescTranslating && <span className="inline-block h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />}
                                {krDescLang === "ko" ? "EN" : "KO"}
                              </button>
                            )}
                          </div>
                          {krProfile.description && (
                            <div className="mb-3">
                              <p className={`text-sm leading-relaxed text-gray-300 ${krDescExpanded ? "" : "line-clamp-3"}`}>
                                {krDescLang === "ko" && krDescKo ? krDescKo : krProfile.description}
                              </p>
                              <button
                                onClick={() => setKrDescExpanded(!krDescExpanded)}
                                className="mt-1.5 text-[10px] text-accent hover:underline"
                              >
                                {krDescExpanded ? "less" : "more"}
                              </button>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            {(krProfile.sector || krProfile.industry) && (
                              <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Sector</p>
                                <p className="text-sm text-gray-200 mt-0.5 truncate">{[krProfile.sector, krProfile.industry].filter(Boolean).join(" / ")}</p>
                              </div>
                            )}
                            {krProfile.ceo && (
                              <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wide">CEO</p>
                                <p className="text-sm text-gray-200 mt-0.5 truncate">{krProfile.ceo}</p>
                              </div>
                            )}
                            {krProfile.fullTimeEmployees != null && (
                              <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wide">{lang === "kr" ? "임직원 수" : "Employees"}</p>
                                <p className="text-sm text-gray-200 mt-0.5 font-mono">{krProfile.fullTimeEmployees.toLocaleString()}</p>
                              </div>
                            )}
                            {krProfile.website && (
                              <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Website</p>
                                <a href={krProfile.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-yellow-400 hover:underline mt-0.5 truncate">
                                  {krProfile.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                                  <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* KR Latest News */}
                      {!krProfileLoading && krNews.length > 0 && (
                        <div className="border-t border-[#1e1e1e] pt-4 mt-1">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold uppercase tracking-widest text-[#666]">
                              {lang === "kr" ? "최신 뉴스" : "LATEST NEWS"}
                            </p>
                          </div>
                          <div>
                            {krNews.map((n, i) => (
                              <a
                                key={i}
                                href={n.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block border-b border-[#1a1a1a] py-2.5 last:border-b-0 hover:bg-white/[0.02] -mx-1 px-1 rounded transition-colors"
                              >
                                <p className="text-sm font-medium leading-snug text-[#ddd] line-clamp-2">
                                  {n.title}
                                </p>
                                {n.publishedDate && (
                                  <p className="mt-1 text-xs text-[#555]">
                                    {new Date(n.publishedDate).toLocaleDateString(lang === "kr" ? "ko-KR" : undefined, { month: "short", day: "numeric", year: "numeric" })}
                                  </p>
                                )}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* US FOMO */}
            {fomoMarket === "US" && (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                <section className={`${CARD} lg:col-span-3 overflow-x-auto`}>
                  {/* Header */}
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                        US {US_SECTORS.find(s => s.key === usSector)?.label} — {fomoUs.length} {lang === "kr" ? "종목" : "stocks"}
                      </h2>
                    </div>
                    <button
                      onClick={() => fetchFomoUs(usSector, true)}
                      disabled={usLoading}
                      className="px-3 py-1 text-[10px] font-mono text-muted border border-card-border hover:text-foreground transition-colors disabled:opacity-30"
                    >
                      {usLoading ? "LOADING..." : "REFRESH"}
                    </button>
                  </div>

                  {/* Loading */}
                  {usLoading && (
                    <div className="space-y-0">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 py-2.5 border-b border-card-border/20">
                          <div className="h-3 w-14 rounded bg-card-border/30 animate-pulse" />
                          <div className="h-3 w-24 rounded bg-card-border/20 animate-pulse" />
                          <div className="ml-auto h-3 w-16 rounded bg-card-border/20 animate-pulse" />
                          <div className="h-3 w-12 rounded bg-card-border/20 animate-pulse" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Error */}
                  {usError && !usLoading && (
                    <div className="py-8 text-center">
                      <p className="text-[10px] text-loss">{usError}</p>
                      <button
                        onClick={() => fetchFomoUs(usSector, true)}
                        className="mt-2 rounded bg-accent/20 px-3 py-1 text-[10px] text-accent hover:bg-accent/30"
                      >
                        {lang === "kr" ? "다시 시도" : "Retry"}
                      </button>
                    </div>
                  )}

                  {/* Table */}
                  {!usLoading && !usError && fomoUs.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs min-w-[400px]">
                        <thead>
                          <tr className="border-b border-card-border">
                            <th className={TH}>Symbol</th>
                            <th className={TH}>Name</th>
                            <th className={`${TH} text-right`}>Price</th>
                            <th className={`${TH} text-right`}>Chg%</th>
                            <th className={`${TH} text-right`}>{lang === "kr" ? "거래대금" : "Value"}</th>
                            <th className={`${TH} text-right`}>{lang === "kr" ? "거래량" : "Volume"}</th>
                            <th className={`${TH} text-right`}>Vol Ratio</th>
                            <th className={`${TH} w-16`}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {fomoUs.map((r) => {
                            const volColor = r.volumeRatio >= 2 ? "text-red-400" : r.volumeRatio >= 1.5 ? "text-yellow-400" : "text-muted";
                            const barW = Math.min(r.volumeRatio / 5 * 100, 100);
                            const barColor = r.volumeRatio >= 2 ? "bg-red-400" : r.volumeRatio >= 1.5 ? "bg-yellow-400" : "bg-card-border";
                            return (
                              <tr
                                key={r.symbol}
                                onClick={() => setUsSelected(usSelected?.symbol === r.symbol ? null : r)}
                                className={`cursor-pointer border-b border-card-border/40 transition-colors ${
                                  usSelected?.symbol === r.symbol ? "bg-accent/10" : "hover:bg-card-border/20"
                                }`}
                              >
                                <td className={`${TD} pl-2 text-accent font-medium`}>{r.symbol}</td>
                                <td className={`${TD} text-muted truncate max-w-[120px]`}>{r.name}</td>
                                <td className={`${TD} text-right tabular-nums`}>${r.price.toFixed(2)}</td>
                                <td className={`${TD} text-right tabular-nums`}><ChgPct v={r.changePct} /></td>
                                <td className={`${TD} text-right tabular-nums text-muted`}>
                                  {r.tradingValue >= 1e9
                                    ? `$${(r.tradingValue / 1e9).toFixed(1)}B`
                                    : `$${(r.tradingValue / 1e6).toFixed(0)}M`}
                                </td>
                                <td className={`${TD} text-right tabular-nums text-muted`}>{formatVol(r.volume)}</td>
                                <td className={`${TD} text-right tabular-nums font-medium ${volColor}`}>{r.volumeRatio.toFixed(1)}x</td>
                                <td className={TD}>
                                  <div className="relative h-1.5 w-full overflow-hidden rounded-sm bg-[#1e1e1e]">
                                    <div className={`absolute inset-y-0 left-0 rounded-sm ${barColor}`} style={{ width: `${barW}%` }} />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Empty */}
                  {!usLoading && !usError && fomoUs.length === 0 && (
                    <p className="py-8 text-center text-[10px] text-muted">
                      {lang === "kr" ? "데이터 없음" : "No data available"}
                    </p>
                  )}

                  {/* Footer */}
                  {usUpdatedAt && !usLoading && (
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-card-border/40">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-muted/50">
                          {fomoUs.length} stocks
                        </span>
                        {usCached && (
                          <span className="text-[9px] font-mono text-amber-500/50">CACHED</span>
                        )}
                      </div>
                      <span className="text-[9px] font-mono text-muted/50">
                        Updated {new Date(usUpdatedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </section>

                {/* US Detail panel */}
                <section className={`${CARD} lg:col-span-2`}>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Detail</h2>
                  </div>
                  {!usSelected ? (
                    <p className="py-8 text-center text-[10px] text-muted">
                      {lang === "kr" ? "목록에서 종목을 선택하세요" : "Select a stock from the list"}
                    </p>
                  ) : (() => {
                    const s = usSelected;
                    const volBarPct = Math.min(s.volumeRatio / 10 * 100, 100);
                    const volColor = s.volumeRatio >= 2 ? "bg-red-400" : s.volumeRatio >= 1.5 ? "bg-yellow-400" : "bg-accent";
                    return (
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-bold text-accent">{s.symbol}</span>
                            <span className="ml-2 text-xs text-muted">{s.name}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium tabular-nums">${s.price.toFixed(2)}</p>
                            <p className="text-[10px] tabular-nums"><ChgPct v={s.changePct} /></p>
                          </div>
                        </div>

                        {/* Analyst Consensus */}
                        {analystLoading && (
                          <div className="border-b border-[#1e1e1e] pb-3">
                            <p className="text-[11px] text-[#555] animate-pulse">Loading analyst data...</p>
                          </div>
                        )}
                        {analystData && !analystLoading && analystData.analystCount > 0 && (() => {
                          const a = analystData;
                          const fmtTarget = (v: number) => `$${v.toFixed(2)}`;
                          const upsidePct = (target: number) => s.price > 0 && target > 0
                            ? ((target - s.price) / s.price * 100) : null;
                          const consensusUpside = upsidePct(a.targetConsensus);
                          const highUpside = upsidePct(a.targetHigh);
                          const lowUpside = upsidePct(a.targetLow);
                          const total = a.buyCount + a.holdCount + a.sellCount;
                          const buyPct = total > 0 ? Math.round(a.buyCount / total * 100) : 0;
                          const holdPct = total > 0 ? Math.round(a.holdCount / total * 100) : 0;
                          const sellPct = total > 0 ? 100 - buyPct - holdPct : 0;
                          const consensusBg = a.consensus === "Buy" ? "bg-green-500/20 text-green-400" : a.consensus === "Sell" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400";
                          const consensusKr = a.consensus === "Buy" ? "매수" : a.consensus === "Sell" ? "매도" : "중립";
                          return (
                            <div className="border-b border-[#1e1e1e] pb-3">
                              {/* Header */}
                              <p className="text-xs font-semibold uppercase tracking-widest text-[#555] mb-2.5">
                                {lang === "kr" ? "월가 목표주가" : "WALL STREET TARGET"}
                              </p>
                              {/* Row 1: Consensus badge + target + upside */}
                              <div className="flex items-center gap-2 mb-3 flex-wrap">
                                <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${consensusBg}`}>
                                  {lang === "kr" ? consensusKr : a.consensus.toUpperCase()}
                                </span>
                                {a.targetConsensus > 0 && (
                                  <span className="text-sm text-white font-mono font-semibold">
                                    {lang === "kr" ? "목표주가" : "Target"} {fmtTarget(a.targetConsensus)}
                                  </span>
                                )}
                                {consensusUpside !== null && (
                                  <span className={`text-xs font-mono font-semibold ${consensusUpside >= 0 ? "text-green-400" : "text-red-400"}`}>
                                    {consensusUpside >= 0 ? "+" : ""}{consensusUpside.toFixed(1)}%
                                    {lang === "kr" ? (consensusUpside >= 0 ? " 상승여력" : " 하락여력") : (consensusUpside >= 0 ? " upside" : " downside")}
                                  </span>
                                )}
                              </div>
                              {/* Row 2: Three target columns */}
                              {(a.targetHigh > 0 || a.targetLow > 0) && (
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                  {[
                                    { label: "High", val: a.targetHigh, upside: highUpside, color: "text-green-400" },
                                    { label: lang === "kr" ? "평균" : "Median", val: a.targetConsensus, upside: consensusUpside, color: "text-yellow-400" },
                                    { label: "Low", val: a.targetLow, upside: lowUpside, color: "text-red-400" },
                                  ].map(({ label, val, upside, color }) => (
                                    <div key={label} className="rounded bg-[#0f0f0f] px-2.5 py-2 text-center">
                                      <p className="text-[9px] text-[#555] uppercase tracking-wider mb-1">{label}</p>
                                      <p className="text-xs font-mono font-semibold text-white">{val > 0 ? fmtTarget(val) : "—"}</p>
                                      {upside !== null && val > 0 && (
                                        <p className={`text-[10px] font-mono font-medium mt-0.5 ${color}`}>
                                          {upside >= 0 ? "+" : ""}{upside.toFixed(1)}%
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {/* Analyst count */}
                              {a.analystCount > 0 && (
                                <p className="text-[10px] text-[#555] mb-2">
                                  {lang === "kr" ? `애널리스트 ${a.analystCount}명` : `${a.analystCount} analysts`}
                                </p>
                              )}
                              {/* Row 3: Buy/Hold/Sell bar */}
                              {total > 0 && (
                                <div>
                                  <div className="flex h-2 w-full overflow-hidden rounded-sm">
                                    {buyPct > 0 && <div className="bg-green-500" style={{ width: `${buyPct}%` }} />}
                                    {holdPct > 0 && <div className="bg-yellow-500" style={{ width: `${holdPct}%` }} />}
                                    {sellPct > 0 && <div className="bg-red-500" style={{ width: `${sellPct}%` }} />}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1.5">
                                    <span className="text-[9px] text-green-400">{lang === "kr" ? "매수" : "Buy"} {buyPct}%</span>
                                    <span className="text-[9px] text-yellow-400">{lang === "kr" ? "중립" : "Hold"} {holdPct}%</span>
                                    <span className="text-[9px] text-red-400">{lang === "kr" ? "매도" : "Sell"} {sellPct}%</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Volume Analysis */}
                        <div className="border-b border-[#1e1e1e] pb-3">
                          <p className="text-xs font-semibold uppercase tracking-widest text-[#555] mb-2.5">
                            VOLUME ANALYSIS
                          </p>
                          <p className="text-sm text-[#aaa] leading-relaxed mb-2">
                            {lang === "kr"
                              ? <>20일 평균 대비 <span className="font-mono font-bold text-white">{s.volumeRatio.toFixed(1)}배</span> 거래량 {s.volumeRatio >= 2 ? "급증" : s.volumeRatio >= 1.5 ? "증가" : "수준"}</>
                              : <>Volume at <span className="font-mono font-bold text-white">{s.volumeRatio.toFixed(1)}x</span> vs 20D avg {s.volumeRatio >= 2 ? "— significant spike" : s.volumeRatio >= 1.5 ? "— above average" : ""}</>
                            }
                          </p>
                          <div className="relative h-2 w-full overflow-hidden rounded-sm bg-[#1e1e1e]">
                            <div className={`absolute inset-y-0 left-0 rounded-sm ${volColor}`} style={{ width: `${volBarPct}%` }} />
                          </div>
                          <p className="mt-2 text-[10px] text-[#666]">
                            {lang === "kr"
                              ? <>오늘 <span className="font-mono text-white">{formatVol(s.volume)}</span> / 20일 평균 <span className="font-mono text-[#888]">{formatVol(s.avgVolume)}</span></>
                              : <>Today <span className="font-mono text-white">{formatVol(s.volume)}</span> / 20D avg <span className="font-mono text-[#888]">{formatVol(s.avgVolume)}</span></>
                            }
                          </p>
                        </div>

                        {/* Key Metrics */}
                        <div className="border-b border-[#1e1e1e] pb-3">
                          <p className="text-xs font-semibold uppercase tracking-widest text-[#555] mb-2.5">KEY METRICS</p>
                          <div className="space-y-2">
                            {([
                              [lang === "kr" ? "거래대금" : "Trading Value", s.tradingValue >= 1e9 ? `$${(s.tradingValue / 1e9).toFixed(2)}B` : `$${(s.tradingValue / 1e6).toFixed(0)}M`],
                              [lang === "kr" ? "거래량" : "Volume", formatVol(s.volume)],
                              [lang === "kr" ? "20일 평균 거래량" : "Avg Volume (20D)", formatVol(s.avgVolume)],
                              ["Vol Ratio", `${s.volumeRatio.toFixed(2)}x`],
                              [lang === "kr" ? "등락률" : "Change", `${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(2)}%`],
                            ] as const).map(([label, val]) => (
                              <div key={label} className="flex items-center justify-between">
                                <span className="text-[11px] text-[#888]">{label}</span>
                                <span className="text-[11px] font-mono text-foreground">{val}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Company Info */}
                        {usProfileLoading && (
                          <div className="pt-3">
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-3 animate-spin rounded-full border border-[#555] border-t-transparent" />
                              <p className="text-[11px] text-[#555]">Loading profile...</p>
                            </div>
                          </div>
                        )}
                        {usProfile && !usProfileLoading && (
                          <div className="border-t border-[#1e1e1e] pt-4 mt-1">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold uppercase tracking-widest text-[#666]">COMPANY INFO</p>
                              {usProfile.description && (
                                <button
                                  onClick={handleDescTranslate}
                                  disabled={descTranslating}
                                  className={`flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-mono font-bold transition-colors ${
                                    descLang === "ko"
                                      ? "bg-accent/20 text-accent"
                                      : "bg-[#1e1e1e] text-[#666] hover:text-[#aaa]"
                                  } disabled:opacity-40`}
                                >
                                  {descTranslating && <span className="inline-block h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />}
                                  {descLang === "ko" ? "EN" : "KO"}
                                </button>
                              )}
                            </div>
                            {usProfile.description && (
                              <div className="mb-3">
                                <p className={`text-sm leading-relaxed text-gray-300 ${usDescExpanded ? "" : "line-clamp-3"}`}>
                                  {descLang === "ko" && descKo ? descKo : usProfile.description}
                                </p>
                                <button
                                  onClick={() => setUsDescExpanded(!usDescExpanded)}
                                  className="mt-1.5 text-[10px] text-accent hover:underline"
                                >
                                  {usDescExpanded ? "less" : "more"}
                                </button>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-3 mt-3">
                              {(usProfile.sector || usProfile.industry) && (
                                <div>
                                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Sector</p>
                                  <p className="text-sm text-gray-200 mt-0.5 truncate">{[usProfile.sector, usProfile.industry].filter(Boolean).join(" / ")}</p>
                                </div>
                              )}
                              {usProfile.ceo && (
                                <div>
                                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">CEO</p>
                                  <p className="text-sm text-gray-200 mt-0.5 truncate">{usProfile.ceo}</p>
                                </div>
                              )}
                              {usProfile.fullTimeEmployees != null && (
                                <div>
                                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Employees</p>
                                  <p className="text-sm text-gray-200 mt-0.5 font-mono">{usProfile.fullTimeEmployees.toLocaleString()}</p>
                                </div>
                              )}
                              {usProfile.website && (
                                <div>
                                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Website</p>
                                  <a href={usProfile.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-yellow-400 hover:underline mt-0.5 truncate">
                                    {usProfile.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                                    <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Latest News */}
                        {!usProfileLoading && usNews.length > 0 && (
                          <div className="border-t border-[#1e1e1e] pt-4 mt-1">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold uppercase tracking-widest text-[#666]">LATEST NEWS</p>
                              <button
                                onClick={handleNewsTranslate}
                                disabled={newsTranslating}
                                className={`flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-mono font-bold transition-colors ${
                                  newsLang === "ko"
                                    ? "bg-accent/20 text-accent"
                                    : "bg-[#1e1e1e] text-[#666] hover:text-[#aaa]"
                                } disabled:opacity-40`}
                              >
                                {newsTranslating && <span className="inline-block h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />}
                                {newsLang === "ko" ? "EN" : "KO"}
                              </button>
                            </div>
                            <div>
                              {usNews.map((n, i) => (
                                <a
                                  key={i}
                                  href={n.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block border-b border-[#1a1a1a] py-2.5 last:border-b-0 hover:bg-white/[0.02] -mx-1 px-1 rounded transition-colors"
                                >
                                  <p className="text-sm font-medium leading-snug text-[#ddd] line-clamp-2">
                                    {newsLang === "ko" && newsKo[i] ? newsKo[i] : n.title}
                                  </p>
                                  {n.publishedDate && (
                                    <p className="mt-1 text-xs text-[#555]">
                                      {new Date(n.publishedDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                                    </p>
                                  )}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </section>
              </div>
            )}
          </div>
        )}
        {/* ETF tab */}
        {tab === "etf" && (
          <div className="space-y-4">
            {/* ETF filter tabs */}
            {(() => {
              const ETF_DESC: Record<string, string> = {
                IVV: "S&P 500 대형주 500개",
                IWM: "Russell 2000 중소형주 2000개",
                IYW: "미국 테크 섹터",
                IYF: "미국 금융 섹터",
                IYH: "미국 헬스케어 섹터",
                IYE: "미국 에너지 섹터",
                IYC: "미국 소비재 섹터",
                IYJ: "미국 산업재 섹터",
              };
              return (
                <div>
                  <div className="flex flex-wrap gap-1">
                    {["IVV", "IWM", "IYW", "IYF", "IYH", "IYE", "IYC", "IYJ"].map((e) => (
                      <button
                        key={e}
                        onClick={() => setEtfFilter(e)}
                        className={`rounded px-2.5 py-1 text-[10px] font-medium transition-colors ${
                          etfFilter === e
                            ? "bg-accent text-white"
                            : "bg-card-border/50 text-muted hover:text-foreground"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-300 font-mono">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                    iShares {etfFilter} — {ETF_DESC[etfFilter] || ""}
                  </p>
                </div>
              );
            })()}

            {/* Section 1: Holdings Table */}
            <section className={CARD}>
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {etfFilter} {lang === "kr" ? "보유 종목" : "Holdings"} — {etfHoldings.length}{lang === "kr" ? "개" : " stocks"}
                </h2>
                {etfHoldingsDate && (
                  <span className="ml-auto text-[9px] text-muted/50 tabular-nums">
                    Snapshot: {etfHoldingsDate}
                  </span>
                )}
              </div>

              {etfHoldingsLoading && (
                <div className="space-y-0">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5 border-b border-card-border/20">
                      <div className="h-3 w-14 rounded bg-card-border/30 animate-pulse" />
                      <div className="h-3 w-28 rounded bg-card-border/20 animate-pulse" />
                      <div className="ml-auto h-3 w-16 rounded bg-card-border/20 animate-pulse" />
                    </div>
                  ))}
                </div>
              )}

              {etfHoldingsError && !etfHoldingsLoading && (
                <div className="py-8 text-center">
                  <p className="text-[10px] text-loss">{etfHoldingsError}</p>
                  <button
                    onClick={() => fetchEtfHoldings(etfFilter)}
                    className="mt-2 rounded bg-accent/20 px-3 py-1 text-[10px] text-accent hover:bg-accent/30"
                  >
                    {lang === "kr" ? "다시 시도" : "Retry"}
                  </button>
                </div>
              )}

              {!etfHoldingsLoading && !etfHoldingsError && etfHoldings.length === 0 && (
                <p className="py-8 text-center text-[10px] text-muted">
                  {lang === "kr" ? "스냅샷 데이터 없음" : "No snapshot data available"}
                </p>
              )}

              {!etfHoldingsLoading && !etfHoldingsError && etfHoldings.length > 0 && (
                <div className="overflow-x-auto max-h-[480px] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#374151_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <table className="w-full text-xs min-w-[500px]">
                    <thead className="sticky top-0 bg-card-bg z-10">
                      <tr className="border-b border-card-border">
                        <th className={`${TH} w-8 text-right`}>#</th>
                        <th className={`${TH} w-20`}>Symbol</th>
                        <th className={TH}>Name</th>
                        <th className={`${TH} w-40`}>Sector</th>
                        <th className={`${TH} text-right w-24`}>Weight(%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {etfHoldings.map((h, i) => (
                        <tr
                          key={h.symbol}
                          onClick={() => { if (h.symbol) window.location.href = `/financials?ticker=${encodeURIComponent(h.symbol)}`; }}
                          className="border-b border-card-border/40 hover:bg-[#1a1a1a] cursor-pointer transition-colors group"
                        >
                          <td className={`${TD} text-right text-muted/50 tabular-nums text-[10px] w-8`}>{i + 1}</td>
                          <td className={`${TD} pl-2 text-accent font-medium group-hover:text-yellow-400 transition-colors w-20 font-mono`}>{h.symbol}</td>
                          <td className={`${TD} text-gray-200 truncate max-w-[200px]`}>{h.name}</td>
                          <td className={TD}>
                            {h.sector ? (() => {
                              const SECTOR_COLOR: Record<string, string> = {
                                "Information Technology": "bg-blue-500/15 text-blue-300",
                                "Technology": "bg-blue-500/15 text-blue-300",
                                "Health Care": "bg-green-500/15 text-green-300",
                                "Financials": "bg-yellow-500/15 text-yellow-300",
                                "Industrials": "bg-orange-500/15 text-orange-300",
                                "Energy": "bg-red-500/15 text-red-300",
                                "Materials": "bg-purple-500/15 text-purple-300",
                                "Communication": "bg-cyan-500/15 text-cyan-300",
                                "Communication Services": "bg-cyan-500/15 text-cyan-300",
                                "Consumer Discretionary": "bg-pink-500/15 text-pink-300",
                                "Consumer Staples": "bg-pink-500/15 text-pink-300",
                                "Real Estate": "bg-amber-500/15 text-amber-300",
                                "Utilities": "bg-teal-500/15 text-teal-300",
                              };
                              const color = SECTOR_COLOR[h.sector] || "bg-gray-500/15 text-gray-300";
                              return (
                                <span className={`inline-block rounded px-1.5 py-px text-[9px] font-medium ${color}`}>
                                  {h.sector}
                                </span>
                              );
                            })() : <span className="text-gray-600">—</span>}
                          </td>
                          <td className={`${TD} text-right tabular-nums font-mono`}>
                            {h.weight != null ? h.weight.toFixed(2) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

          </div>
        )}

        {/* KR ETF tab */}
        {tab === "kr-etf" && (
          <div className="space-y-4">
            {/* Common holdings section */}
            {!krEtfLoading && krEtfs.length > 0 && (() => {
              const stockMap = new Map<string, { name: string; code: string; etfs: string[]; weights: number[] }>();
              for (const etf of krEtfs) {
                for (const h of etf.holdings) {
                  const key = h.name;
                  if (!stockMap.has(key)) stockMap.set(key, { name: h.name, code: h.code, etfs: [], weights: [] });
                  const entry = stockMap.get(key)!;
                  entry.etfs.push(etf.name);
                  entry.weights.push(h.weight);
                }
              }
              const common = [...stockMap.values()]
                .filter(s => s.etfs.length >= 2)
                .sort((a, b) => b.etfs.length - a.etfs.length || (b.weights.reduce((s, w) => s + w, 0) / b.weights.length) - (a.weights.reduce((s, w) => s + w, 0) / a.weights.length))
                .slice(0, 20);
              if (common.length === 0) return null;
              return (
                <div className={`${CARD} bg-[#0c0f15]`}>
                  <button
                    onClick={() => setKrEtfCommonOpen(v => !v)}
                    className="w-full flex items-center justify-between"
                  >
                    <span className="text-xs font-semibold text-foreground tracking-wide">액티브 ETF 공통 보유 종목</span>
                    <span className="text-[10px] text-muted">{krEtfCommonOpen ? "▼" : "▶"}</span>
                  </button>
                  {krEtfCommonOpen && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-xs min-w-[500px]">
                        <thead>
                          <tr className="border-b border-card-border">
                            <th className={`${TH} w-8 text-center`}>#</th>
                            <th className={TH}>종목명</th>
                            <th className={`${TH} text-right`}>코드</th>
                            <th className={`${TH} text-center`}>담은 ETF</th>
                            <th className={`${TH} text-right`}>평균 비중</th>
                            <th className={TH}>ETF 목록</th>
                          </tr>
                        </thead>
                        <tbody>
                          {common.map((s, i) => (
                            <tr key={s.name} className="border-b border-card-border/50 hover:bg-white/[0.02]">
                              <td className={`${TD} text-center text-muted/60`}>{i + 1}</td>
                              <td className={`${TD} font-medium text-foreground`}>{s.name}</td>
                              <td className={`${TD} text-right text-muted/60 tabular-nums`}>{s.code}</td>
                              <td className={`${TD} text-center font-medium text-amber-300`}>{s.etfs.length}개</td>
                              <td className={`${TD} text-right tabular-nums text-amber-300`}>{(s.weights.reduce((a, b) => a + b, 0) / s.weights.length).toFixed(2)}%</td>
                              <td className={TD}>
                                <div className="flex flex-wrap gap-1">
                                  {s.etfs.map((name, j) => (
                                    <span key={j} className="inline-block rounded px-1.5 py-px text-[9px] bg-amber-400/10 text-amber-400/80">{name}</span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

          <div className="flex gap-4" style={{ minHeight: 500 }}>
            {/* Left: ETF list grouped by asset manager */}
            <div className="flex flex-col gap-1 overflow-y-auto" style={{ width: 300, flexShrink: 0, maxHeight: "80vh" }}>
              {krEtfLoading ? (
                <div className="flex items-center justify-center py-20">
                  <svg className="animate-spin" style={{ width: 28, height: 28, color: "#f59e0b" }} viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M12 2a10 10 0 019.8 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              ) : (() => {
                const MANAGER_MAP: [string, string][] = [
                  ["KODEX", "삼성자산운용 KODEX"],
                  ["TIGER", "미래에셋 TIGER"],
                  ["KoAct", "삼성액티브 KoAct"],
                  ["TIME", "타임폴리오 TIME"],
                  ["RISE", "KB자산운용 RISE"],
                  ["PLUS", "한화자산운용 PLUS"],
                ];
                const groups: { key: string; label: string; etfs: typeof krEtfs }[] = [];
                const used = new Set<string>();
                for (const [prefix, label] of MANAGER_MAP) {
                  const matched = krEtfs.filter(e => e.name.startsWith(prefix));
                  if (matched.length > 0) {
                    groups.push({ key: prefix, label, etfs: matched });
                    matched.forEach(e => used.add(e.code));
                  }
                }
                const others = krEtfs.filter(e => !used.has(e.code));
                if (others.length > 0) groups.push({ key: "_etc", label: "기타", etfs: others });

                return groups.map(g => {
                  const collapsed = krEtfCollapsed.has(g.key);
                  return (
                    <div key={g.key}>
                      <button
                        onClick={() => setKrEtfCollapsed(prev => {
                          const next = new Set(prev);
                          if (next.has(g.key)) next.delete(g.key); else next.add(g.key);
                          return next;
                        })}
                        className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-muted/80 hover:text-foreground transition-colors"
                      >
                        <span>{g.label} ({g.etfs.length})</span>
                        <span className="text-[9px]">{collapsed ? "▶" : "▼"}</span>
                      </button>
                      {!collapsed && g.etfs.map(etf => (
                        <button
                          key={etf.code}
                          onClick={() => setKrEtfSelected(etf.code === krEtfSelected ? null : etf.code)}
                          className={`w-full text-left px-3 py-2 rounded text-xs transition-colors border mb-0.5 ${
                            krEtfSelected === etf.code
                              ? "bg-amber-400/10 border-amber-400/40 text-amber-300"
                              : "bg-card-bg border-card-border text-muted hover:text-foreground hover:border-white/20"
                          }`}
                        >
                          <div className="font-medium leading-tight">{etf.name}</div>
                          <div className="text-[9px] text-muted/60 mt-0.5">{etf.code} · {etf.holdings.length}종목</div>
                        </button>
                      ))}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Right: Holdings table */}
            <div className="flex-1 min-w-0">
              {(() => {
                const sel = krEtfs.find(e => e.code === krEtfSelected);
                if (!sel) return (
                  <div className={`${CARD} flex items-center justify-center text-muted text-sm`} style={{ height: 400 }}>
                    {lang === "kr" ? "ETF를 선택하면 구성종목을 확인할 수 있습니다" : "Select an ETF to view holdings"}
                  </div>
                );
                const maxWeight = Math.max(...sel.holdings.map(h => h.weight), 1);
                return (
                  <div className={CARD}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-semibold text-foreground">{sel.name}</span>
                      <span className="text-[10px] text-muted">{sel.code}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs min-w-[500px]">
                        <thead>
                          <tr className="border-b border-card-border">
                            <th className={`${TH} w-8 text-center`}>#</th>
                            <th className={TH}>종목명</th>
                            <th className={`${TH} text-right`}>코드</th>
                            <th className={`${TH} text-right`}>비중%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sel.holdings.map((h) => (
                            <tr key={h.code} className="border-b border-card-border/50 hover:bg-white/[0.02]">
                              <td className={`${TD} text-center text-muted/60`}>{h.rank}</td>
                              <td className={TD}>
                                <div className="relative">
                                  <div
                                    className="absolute inset-y-0 left-0 bg-amber-400/10 rounded-sm"
                                    style={{ width: `${(h.weight / maxWeight) * 100}%` }}
                                  />
                                  <span className="relative font-medium text-foreground">{h.name}</span>
                                </div>
                              </td>
                              <td className={`${TD} text-right text-muted/60 tabular-nums`}>{h.code}</td>
                              <td className={`${TD} text-right font-medium text-amber-300 tabular-nums`}>{h.weight.toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
          </div>
        )}

        {/* Dividend ETF tab */}
        {tab === "dividend-etf" && (
          <div className="space-y-4">
            {/* Common holdings section */}
            {!divEtfLoading && divEtfs.length > 0 && (() => {
              const stockMap = new Map<string, { name: string; code: string; etfs: string[]; weights: number[] }>();
              for (const etf of divEtfs) {
                for (const h of etf.holdings) {
                  const key = h.name;
                  if (!stockMap.has(key)) stockMap.set(key, { name: h.name, code: h.code, etfs: [], weights: [] });
                  const entry = stockMap.get(key)!;
                  entry.etfs.push(etf.name);
                  entry.weights.push(h.weight);
                }
              }
              const common = [...stockMap.values()]
                .filter(s => s.etfs.length >= 2)
                .sort((a, b) => b.etfs.length - a.etfs.length || (b.weights.reduce((s, w) => s + w, 0) / b.weights.length) - (a.weights.reduce((s, w) => s + w, 0) / a.weights.length))
                .slice(0, 20);
              if (common.length === 0) return null;
              return (
                <div className={`${CARD} bg-[#0c0f15]`}>
                  <button
                    onClick={() => setDivEtfCommonOpen(v => !v)}
                    className="w-full flex items-center justify-between"
                  >
                    <span className="text-xs font-semibold text-foreground tracking-wide">배당 ETF 공통 보유 종목</span>
                    <span className="text-[10px] text-muted">{divEtfCommonOpen ? "▼" : "▶"}</span>
                  </button>
                  {divEtfCommonOpen && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-xs min-w-[500px]">
                        <thead>
                          <tr className="border-b border-card-border">
                            <th className={`${TH} w-8 text-center`}>#</th>
                            <th className={TH}>종목명</th>
                            <th className={`${TH} text-right`}>코드</th>
                            <th className={`${TH} text-center`}>담은 ETF</th>
                            <th className={`${TH} text-right`}>평균 비중</th>
                            <th className={TH}>ETF 목록</th>
                          </tr>
                        </thead>
                        <tbody>
                          {common.map((s, i) => (
                            <tr key={s.name} className="border-b border-card-border/50 hover:bg-white/[0.02]">
                              <td className={`${TD} text-center text-muted/60`}>{i + 1}</td>
                              <td className={`${TD} font-medium text-foreground`}>{s.name}</td>
                              <td className={`${TD} text-right text-muted/60 tabular-nums`}>{s.code}</td>
                              <td className={`${TD} text-center font-medium text-amber-300`}>{s.etfs.length}개</td>
                              <td className={`${TD} text-right tabular-nums text-amber-300`}>{(s.weights.reduce((a, b) => a + b, 0) / s.weights.length).toFixed(2)}%</td>
                              <td className={TD}>
                                <div className="flex flex-wrap gap-1">
                                  {s.etfs.map((name, j) => (
                                    <span key={j} className="inline-block rounded px-1.5 py-px text-[9px] bg-amber-400/10 text-amber-400/80">{name}</span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

          <div className="flex gap-4" style={{ minHeight: 500 }}>
            {/* Left: ETF list grouped by asset manager */}
            <div className="flex flex-col gap-1 overflow-y-auto" style={{ width: 300, flexShrink: 0, maxHeight: "80vh" }}>
              {divEtfLoading ? (
                <div className="flex items-center justify-center py-20">
                  <svg className="animate-spin" style={{ width: 28, height: 28, color: "#f59e0b" }} viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M12 2a10 10 0 019.8 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              ) : (() => {
                const MANAGER_MAP: [string, string][] = [
                  ["KODEX", "삼성자산운용 KODEX"],
                  ["TIGER", "미래에셋 TIGER"],
                  ["KoAct", "삼성액티브 KoAct"],
                  ["TIME", "타임폴리오 TIME"],
                  ["RISE", "KB자산운용 RISE"],
                  ["PLUS", "한화자산운용 PLUS"],
                ];
                const groups: { key: string; label: string; etfs: typeof divEtfs }[] = [];
                const used = new Set<string>();
                for (const [prefix, label] of MANAGER_MAP) {
                  const matched = divEtfs.filter(e => e.name.startsWith(prefix));
                  if (matched.length > 0) {
                    groups.push({ key: prefix, label, etfs: matched });
                    matched.forEach(e => used.add(e.code));
                  }
                }
                const others = divEtfs.filter(e => !used.has(e.code));
                if (others.length > 0) groups.push({ key: "_etc", label: "기타", etfs: others });

                return groups.map(g => {
                  const collapsed = divEtfCollapsed.has(g.key);
                  return (
                    <div key={g.key}>
                      <button
                        onClick={() => setDivEtfCollapsed(prev => {
                          const next = new Set(prev);
                          if (next.has(g.key)) next.delete(g.key); else next.add(g.key);
                          return next;
                        })}
                        className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-muted/80 hover:text-foreground transition-colors"
                      >
                        <span>{g.label} ({g.etfs.length})</span>
                        <span className="text-[9px]">{collapsed ? "▶" : "▼"}</span>
                      </button>
                      {!collapsed && g.etfs.map(etf => (
                        <button
                          key={etf.code}
                          onClick={() => setDivEtfSelected(etf.code === divEtfSelected ? null : etf.code)}
                          className={`w-full text-left px-3 py-2 rounded text-xs transition-colors border mb-0.5 ${
                            divEtfSelected === etf.code
                              ? "bg-amber-400/10 border-amber-400/40 text-amber-300"
                              : "bg-card-bg border-card-border text-muted hover:text-foreground hover:border-white/20"
                          }`}
                        >
                          <div className="font-medium leading-tight">{etf.name}</div>
                          <div className="text-[9px] text-muted/60 mt-0.5">{etf.code} · {etf.holdings.length}종목</div>
                        </button>
                      ))}
                    </div>
                  );
                });
              })()}
            </div>

            {/* Right: Holdings table */}
            <div className="flex-1 min-w-0">
              {(() => {
                const sel = divEtfs.find(e => e.code === divEtfSelected);
                if (!sel) return (
                  <div className={`${CARD} flex items-center justify-center text-muted text-sm`} style={{ height: 400 }}>
                    {lang === "kr" ? "ETF를 선택하면 구성종목을 확인할 수 있습니다" : "Select an ETF to view holdings"}
                  </div>
                );
                const maxWeight = Math.max(...sel.holdings.map(h => h.weight), 1);
                return (
                  <div className={CARD}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-semibold text-foreground">{sel.name}</span>
                      <span className="text-[10px] text-muted">{sel.code}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs min-w-[500px]">
                        <thead>
                          <tr className="border-b border-card-border">
                            <th className={`${TH} w-8 text-center`}>#</th>
                            <th className={TH}>종목명</th>
                            <th className={`${TH} text-right`}>코드</th>
                            <th className={`${TH} text-right`}>비중%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sel.holdings.map((h) => (
                            <tr key={h.code} className="border-b border-card-border/50 hover:bg-white/[0.02]">
                              <td className={`${TD} text-center text-muted/60`}>{h.rank}</td>
                              <td className={TD}>
                                <div className="relative">
                                  <div
                                    className="absolute inset-y-0 left-0 bg-amber-400/10 rounded-sm"
                                    style={{ width: `${(h.weight / maxWeight) * 100}%` }}
                                  />
                                  <span className="relative font-medium text-foreground">{h.name}</span>
                                </div>
                              </td>
                              <td className={`${TD} text-right text-muted/60 tabular-nums`}>{h.code}</td>
                              <td className={`${TD} text-right font-medium text-amber-300 tabular-nums`}>{h.weight.toFixed(2)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
          </div>
        )}

        {/* Dividend Screener tab */}
        {tab === "dividend-screener" && (
          <div className="space-y-4">
            {/* 필터 */}
            <div className={`${CARD} flex items-center gap-6`}>
              <span className="text-xs font-medium text-foreground">배당수익률 범위</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted">최소</span>
                <select
                  value={divMinRate}
                  onChange={e => setDivMinRate(Number(e.target.value))}
                  className="bg-card-bg border border-card-border text-xs text-foreground rounded px-2 py-1"
                >
                  {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}%</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted">최대</span>
                <select
                  value={divMaxRate}
                  onChange={e => setDivMaxRate(Number(e.target.value))}
                  className="bg-card-bg border border-card-border text-xs text-foreground rounded px-2 py-1"
                >
                  {[5,6,7,8,9,10,15,20,30].map(n => <option key={n} value={n}>{n}%</option>)}
                </select>
              </div>
              <button
                onClick={() => {
                  setDivStocksLoading(true);
                  fetch(`/api/dividend-screener?min=${divMinRate}&max=${divMaxRate}`)
                    .then(r => r.json())
                    .then(j => { if (j.ok) setDivStocks(j.stocks ?? []); })
                    .catch(() => {})
                    .finally(() => setDivStocksLoading(false));
                }}
                className="px-3 py-1 text-xs bg-accent text-white rounded hover:bg-accent/80 transition-colors"
              >
                검색
              </button>
              <button
                onClick={() => setDivGrowthOnly(v => !v)}
                className={`px-3 py-1 text-xs rounded border transition-colors ${
                  divGrowthOnly
                    ? "bg-green-500/20 border-green-500/40 text-green-400"
                    : "bg-card-bg border-card-border text-muted hover:text-foreground"
                }`}
              >
                연속증가만 보기
              </button>
              {!divStocksLoading && divStocks.length > 0 && (
                <span className="text-[11px] text-muted ml-auto">{divStocks.filter(s => !divGrowthOnly || s.dividendGrowth).length}개 종목</span>
              )}
            </div>

            {/* 테이블 */}
            {divStocksLoading ? (
              <div className={`${CARD} flex items-center justify-center text-muted text-sm`} style={{ height: 300 }}>
                <span className="animate-pulse">배당주 데이터 로딩 중…</span>
              </div>
            ) : (
              <div className={CARD}>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[600px]">
                    <thead>
                      <tr className="border-b border-card-border">
                        <th className={TH}>종목코드</th>
                        <th className={TH}>종목명</th>
                        <th className={`${TH} text-right`}>현재가</th>
                        <th className={`${TH} text-right`}>배당금</th>
                        <th className={`${TH} text-right`}>배당수익률</th>
                        <th className={TH}>시장</th>
                        <th className={`${TH} text-center`}>연속배당</th>
                        <th className={`${TH} text-center`}>배당성장</th>
                      </tr>
                    </thead>
                    <tbody>
                      {divStocks.filter(s => !divGrowthOnly || s.dividendGrowth).map((s) => (
                        <Fragment key={s.code}>
                        <tr
                          className="border-b border-card-border/40 hover:bg-card-border/20 transition-colors cursor-pointer"
                          onClick={() => {
                            if (divExpandedCode === s.code) {
                              setDivExpandedCode(null);
                              return;
                            }
                            setDivExpandedCode(s.code);
                            if (!divNewsMap[s.code]) {
                              setDivNewsLoading(s.code);
                              fetch(`/api/stock-news?code=${s.code}`)
                                .then(r => r.json())
                                .then(j => {
                                  if (j.ok) setDivNewsMap(prev => ({ ...prev, [s.code]: { items: j.items, stockInfo: j.stockInfo } }));
                                })
                                .catch(() => {})
                                .finally(() => setDivNewsLoading(null));
                            }
                          }}
                        >
                          <td className={`${TD} text-accent`}>{s.code}</td>
                          <td className={TD}>{s.name}</td>
                          <td className={`${TD} text-right tabular-nums`}>{s.price.toLocaleString()}원</td>
                          <td className={`${TD} text-right tabular-nums`}>{s.dividend.toLocaleString()}원</td>
                          <td className={`${TD} text-right tabular-nums font-medium text-amber-400`}>{s.dividendRate.toFixed(2)}%</td>
                          <td className={TD}>
                            <span className={`inline-block rounded px-1.5 py-px text-[9px] font-medium ${s.exchange === "KOSPI" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"}`}>
                              {s.exchange}
                            </span>
                          </td>
                          <td className={`${TD} text-center tabular-nums`}>
                            <span className={`text-[11px] font-medium ${
                              s.consecutiveYears === 4 ? "text-amber-400" :
                              s.consecutiveYears >= 2 ? "text-foreground" : "text-muted"
                            }`}>{s.consecutiveYears}년</span>
                          </td>
                          <td className={`${TD} text-center`}>
                            {s.dividendGrowth
                              ? <span className="text-green-400 text-[10px] font-medium">연속증가</span>
                              : <span className="text-muted/40 text-[10px]">-</span>
                            }
                          </td>
                        </tr>
                        {divExpandedCode === s.code && (
                          <tr className="bg-white/[0.02]">
                            <td colSpan={8} className="px-4 py-3">
                              {divNewsLoading === s.code ? (
                                <div className="text-[11px] text-muted animate-pulse">불러오는 중...</div>
                              ) : (
                                <div className="space-y-3">
                                  {/* Stock Info Badges */}
                                  {divNewsMap[s.code]?.stockInfo && (
                                    <div className="flex flex-wrap gap-2">
                                      {[
                                        { label: "시총", value: divNewsMap[s.code].stockInfo!.marketCap },
                                        { label: "PER", value: divNewsMap[s.code].stockInfo!.per },
                                        { label: "PBR", value: divNewsMap[s.code].stockInfo!.pbr },
                                        { label: "EPS", value: divNewsMap[s.code].stockInfo!.eps },
                                        { label: "주당배당금", value: divNewsMap[s.code].stockInfo!.dividendPerShare },
                                        { label: "배당성향", value: divNewsMap[s.code].stockInfo!.payoutRatio },
                                      ].map(({ label, value }) => (
                                        <span key={label} className="inline-flex items-center gap-1.5 rounded bg-card-border/30 px-2 py-1">
                                          <span className="text-[10px] text-muted">{label}</span>
                                          <span className={`text-[11px] font-medium tabular-nums ${
                                            label === "배당성향"
                                              ? value !== "-" && parseFloat(value) <= 60
                                                ? "text-green-400"
                                                : value !== "-" && parseFloat(value) > 80
                                                  ? "text-red-400"
                                                  : "text-foreground"
                                              : label === "PER"
                                                ? value !== "-" && parseFloat(String(value).replace(/,/g, "")) < 10
                                                  ? "text-green-400"
                                                  : "text-foreground"
                                                : "text-foreground"
                                          }`}>{value}</span>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {/* News */}
                                  {(divNewsMap[s.code]?.items ?? []).length === 0 ? (
                                    <div className="text-[11px] text-muted">관련 뉴스가 없습니다.</div>
                                  ) : (
                                    <div className="space-y-2">
                                      {(divNewsMap[s.code]?.items ?? []).map((news, ni) => (
                                        <a
                                          key={ni}
                                          href={news.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={e => e.stopPropagation()}
                                          className="flex items-start gap-3 group"
                                        >
                                          <span className="text-[10px] text-muted/50 tabular-nums shrink-0 mt-0.5">
                                            {`${news.datetime.slice(0,4)}.${news.datetime.slice(4,6)}.${news.datetime.slice(6,8)}`}
                                          </span>
                                          <span className="text-[11px] text-muted group-hover:text-foreground transition-colors leading-snug">
                                            {news.title}
                                          </span>
                                          <span className="text-[9px] text-muted/40 shrink-0 mt-0.5">{news.officeName}</span>
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      ))}
                      {divStocks.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-muted text-sm">
                            조건에 맞는 종목이 없습니다
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "dividend-guide" && (
          <div className="space-y-4">

            {/* 핵심 원칙 3개 카드 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  title: "배당 성장주",
                  desc: "배당수익률보다 배당 성장률이 중요합니다. 연 7~10% 성장하는 종목이 10년 후 실질 수익률을 극대화합니다.",
                  stat: "연평균 +8~12%",
                  statLabel: "장기 기대 수익률 (배당 재투자 포함)",
                  color: "text-amber-400",
                  border: "border-amber-400/20",
                },
                {
                  title: "섹터 분산",
                  desc: "금융 30% · 통신 20% · 필수소비재 20% · 유틸리티 15% · 리츠 15% 구성이 하락장 방어에 유리합니다.",
                  stat: "낙폭 -30~40%↓",
                  statLabel: "고배당 섹터의 하락장 방어 효과",
                  color: "text-blue-400",
                  border: "border-blue-400/20",
                },
                {
                  title: "배당성향 기준",
                  desc: "배당성향 40~70% 사이 종목이 이상적입니다. 80% 초과는 지속 불가, 20% 미만은 주주환원 의지 부족.",
                  stat: "40~70%",
                  statLabel: "지속 가능한 배당성향 구간",
                  color: "text-green-400",
                  border: "border-green-400/20",
                },
              ].map((card) => (
                <div key={card.title} className={`${CARD} border ${card.border} space-y-2`}>
                  <div className="text-sm font-semibold text-foreground">{card.title}</div>
                  <div className="text-xs text-muted leading-relaxed">{card.desc}</div>
                  <div className="pt-1 border-t border-card-border">
                    <div className={`text-base font-bold ${card.color}`}>{card.stat}</div>
                    <div className="text-[10px] text-muted/60 mt-0.5">{card.statLabel}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 한국 vs 미국 비교 */}
            <div className={`${CARD} space-y-3`}>
              <div className="text-sm font-semibold text-foreground">한국 vs 미국 배당주 분산 투자</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-blue-400">한국 배당주</div>
                  <div className="space-y-1.5 text-xs text-muted">
                    <div className="flex gap-2"><span className="text-green-400">+</span><span>배당소득세 15.4% 단일 과세</span></div>
                    <div className="flex gap-2"><span className="text-green-400">+</span><span>환율 리스크 없음</span></div>
                    <div className="flex gap-2"><span className="text-green-400">+</span><span>ISA/연금계좌 세제 혜택</span></div>
                    <div className="flex gap-2"><span className="text-red-400">-</span><span>배당 성장 역사 짧음 (10~15년)</span></div>
                    <div className="flex gap-2"><span className="text-red-400">-</span><span>배당 삭감 리스크 상대적으로 높음</span></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-amber-400">미국 배당주</div>
                  <div className="space-y-1.5 text-xs text-muted">
                    <div className="flex gap-2"><span className="text-green-400">+</span><span>배당귀족 25년+ 연속 증가 종목 다수</span></div>
                    <div className="flex gap-2"><span className="text-green-400">+</span><span>원화 약세 시 환차익 (2020~2024: +27%)</span></div>
                    <div className="flex gap-2"><span className="text-green-400">+</span><span>달러 자산으로 인플레 헤지</span></div>
                    <div className="flex gap-2"><span className="text-red-400">-</span><span>미국 15% + 국내 0.4% 원천징수</span></div>
                    <div className="flex gap-2"><span className="text-red-400">-</span><span>미국 현지 계좌 보유 시 유산세 리스크 ($60K 초과분 최고 40%)</span></div>
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-muted/50 pt-1 border-t border-card-border">
                * 본 내용은 참고용이며 실제 세무·법률은 전문가 상담을 권장합니다.
              </div>
            </div>

            {/* 배당 수익 시뮬레이터 */}
            <div className={`${CARD} space-y-4`}>
              <div className="text-xs font-semibold text-foreground">배당 수익 시뮬레이터</div>

              {/* 슬라이더 4개 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: "원금", value: simAmount, setter: setSimAmount, unit: "억", min: 0.1, max: 50, step: 0.1 },
                  { label: "배당수익률", value: simDivRate, setter: setSimDivRate, unit: "%", min: 0.5, max: 15, step: 0.5 },
                  { label: "연 배당성장률", value: simDivGrowth, setter: setSimDivGrowth, unit: "%", min: 0, max: 20, step: 1 },
                  { label: "주가 성장률", value: simPriceGrowth, setter: setSimPriceGrowth, unit: "%", min: 0, max: 20, step: 1 },
                ].map((item) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-[11px] text-muted">{item.label}</span>
                      <span className="text-[11px] font-medium text-foreground tabular-nums">
                        {item.value}{item.unit}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={item.min}
                      max={item.max}
                      step={item.step}
                      value={item.value}
                      onChange={e => item.setter(Number(e.target.value))}
                      className="w-full h-1 accent-amber-400"
                    />
                  </div>
                ))}
              </div>

              {/* 결과 계산 */}
              {(() => {
                const principal = simAmount * 100000000;
                const annualDivBefore = principal * (simDivRate / 100);
                const monthlyDivBefore = annualDivBefore / 12;
                const taxRate = 0.154;
                const annualDivAfter = annualDivBefore * (1 - taxRate);
                const monthlyDivAfter = annualDivAfter / 12;

                const years = 10;
                const finalValue = principal * Math.pow(1 + simPriceGrowth / 100, years);
                const capitalGain = finalValue - principal;

                let totalDivBefore = 0;
                let currentRate = simDivRate / 100;
                for (let y = 0; y < years; y++) {
                  totalDivBefore += principal * currentRate;
                  currentRate *= (1 + simDivGrowth / 100);
                }
                const totalDivAfter = totalDivBefore * (1 - taxRate);
                const totalReturnBefore = ((capitalGain + totalDivBefore) / principal) * 100;
                const totalReturnAfter = ((capitalGain + totalDivAfter) / principal) * 100;

                const fmt억 = (v: number) => `${(v / 100000000).toFixed(2)}억`;
                const fmt만 = (v: number) => `${Math.round(v / 10000).toLocaleString()}만원`;

                return (
                  <div className="border-t border-card-border pt-4 space-y-4">
                    <div>
                      <div className="text-[10px] text-muted uppercase tracking-wider mb-2">현재 연간 배당</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: "월 세전", value: fmt만(monthlyDivBefore), color: "text-foreground" },
                          { label: "연 세전", value: fmt억(annualDivBefore), color: "text-foreground" },
                          { label: "월 세후", value: fmt만(monthlyDivAfter), color: "text-amber-400" },
                          { label: "연 세후", value: fmt억(annualDivAfter), color: "text-amber-400" },
                        ].map(item => (
                          <div key={item.label} className="bg-card-border/30 rounded-lg p-3 space-y-1">
                            <div className="text-[10px] text-muted">{item.label}</div>
                            <div className={`text-sm font-bold tabular-nums ${item.color}`}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-muted uppercase tracking-wider mb-2">10년 후 총 수익</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: "누적 배당 세전", value: fmt억(totalDivBefore), color: "text-foreground" },
                          { label: "누적 배당 세후", value: fmt억(totalDivAfter), color: "text-amber-400" },
                          { label: "총 수익률 세전", value: `+${totalReturnBefore.toFixed(1)}%`, color: "text-green-400" },
                          { label: "총 수익률 세후", value: `+${totalReturnAfter.toFixed(1)}%`, color: "text-green-400" },
                        ].map(item => (
                          <div key={item.label} className="bg-card-border/30 rounded-lg p-3 space-y-1">
                            <div className="text-[10px] text-muted">{item.label}</div>
                            <div className={`text-sm font-bold tabular-nums ${item.color}`}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted/50">
                      * 배당소득세 15.4% 적용 · 10년 복리 계산 · 실제 수익은 세금/수수료에 따라 다를 수 있음
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 함정 배당 경고 */}
            <div className={`${CARD} border border-red-400/20 space-y-2`}>
              <div className="text-sm font-semibold text-red-400">함정 배당 체크리스트</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { flag: "배당수익률 10% 초과", desc: "주가 급락으로 인한 착시일 수 있음. 실적 확인 필수." },
                  { flag: "배당성향 80% 초과", desc: "이익 대부분을 배당으로 지급 → 투자 여력 없음, 삭감 위험." },
                  { flag: "최근 2년 EPS 마이너스", desc: "적자 기업의 배당은 원금 훼손. 배당 지속 불가능." },
                ].map((item) => (
                  <div key={item.flag} className="space-y-1">
                    <div className="text-xs font-medium text-red-400">{item.flag}</div>
                    <div className="text-[11px] text-muted">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Wall St Consensus tab */}
        {tab === "consensus" && (() => {
          const RATING_COLORS: Record<string, string> = {
            "Strong Buy": "bg-green-500/20 text-green-400",
            "Buy": "bg-emerald-500/20 text-emerald-400",
            "Hold": "bg-yellow-500/20 text-yellow-400",
            "Sell": "bg-red-500/20 text-red-400",
            "Strong Sell": "bg-red-700/20 text-red-500",
            "N/A": "bg-card-border text-muted",
          };

          const RATINGS = ["ALL", "Strong Buy", "Buy", "Hold"];
          const UPSIDES = ["ALL", "10%+", "20%+", "30%+", "50%+"];
          const ANALYSTS = ["ALL", "5명+", "10명+", "20명+"];

          const filtered = consensusItems.filter((item) => {
            if (consensusSectorFilter !== "ALL" && !item.sector.toLowerCase().includes(consensusSectorFilter.toLowerCase())) return false;
            if (consensusRatingFilter !== "ALL" && item.rating !== consensusRatingFilter) return false;
            if (consensusUpsideFilter !== "ALL") {
              const threshold = parseInt(consensusUpsideFilter);
              if (item.upside == null || item.upside < threshold) return false;
            }
            if (consensusAnalystFilter !== "ALL") {
              const threshold = parseInt(consensusAnalystFilter);
              if (item.analystCount < threshold) return false;
            }
            return true;
          });

          function upsideGradient(upside: number | null): string {
            if (upside == null) return "text-muted";
            if (upside >= 50) return "text-green-300 font-bold";
            if (upside >= 30) return "text-green-400 font-semibold";
            if (upside >= 20) return "text-green-500";
            if (upside >= 10) return "text-emerald-500";
            if (upside >= 0) return "text-emerald-600";
            return "text-red-400";
          }

          return (
            <div className="space-y-3">
              {/* Filters */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
                {/* Sector */}
                <div className="flex flex-wrap gap-px">
                  {["ALL", "Technology", "Healthcare", "Financials", "Energy", "Consumer"].map((s) => (
                    <button key={s}
                      onClick={() => setConsensusSectorFilter(s === "Consumer" ? "Consumer" : s)}
                      className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                        (s === "Consumer" ? consensusSectorFilter === "Consumer" : consensusSectorFilter === s)
                          ? "bg-accent text-white" : "bg-card-border/50 text-muted hover:text-foreground"
                      }`}
                    >{s}</button>
                  ))}
                </div>
                {/* Rating */}
                <div className="flex gap-px">
                  {RATINGS.map((r) => (
                    <button key={r} onClick={() => setConsensusRatingFilter(r)}
                      className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                        consensusRatingFilter === r ? "bg-accent text-white" : "bg-card-border/50 text-muted hover:text-foreground"
                      }`}
                    >{r === "Strong Buy" ? "강력매수" : r === "Buy" ? "매수" : r === "Hold" ? "중립" : r}</button>
                  ))}
                </div>
                {/* Upside */}
                <div className="flex gap-px">
                  {UPSIDES.map((u) => (
                    <button key={u} onClick={() => setConsensusUpsideFilter(u)}
                      className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                        consensusUpsideFilter === u ? "bg-accent text-white" : "bg-card-border/50 text-muted hover:text-foreground"
                      }`}
                    >{u}</button>
                  ))}
                </div>
                {/* Analysts */}
                <div className="flex gap-px">
                  {ANALYSTS.map((a) => (
                    <button key={a} onClick={() => setConsensusAnalystFilter(a)}
                      className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                        consensusAnalystFilter === a ? "bg-accent text-white" : "bg-card-border/50 text-muted hover:text-foreground"
                      }`}
                    >{a}</button>
                  ))}
                </div>
                {/* Refresh + meta */}
                <div className="ml-auto flex items-center gap-3">
                  {consensusUpdatedAt && (
                    <span className="text-[9px] text-muted/60 tabular-nums font-mono">
                      {new Date(consensusUpdatedAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} 기준
                    </span>
                  )}
                  <button
                    onClick={() => fetchConsensus(true)}
                    disabled={consensusLoading}
                    className="rounded bg-card-border/50 px-2 py-0.5 text-[10px] text-muted hover:text-foreground disabled:opacity-40 transition-colors"
                  >↻ 새로고침</button>
                </div>
              </div>

              {/* Table / Loading / Error */}
              {consensusLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  <span className="text-xs text-muted font-mono">
                    월가 목표주가 분석 중...
                  </span>
                  <span className="text-[10px] text-muted/50 font-mono">첫 로딩 1~2분 소요 · 이후 24시간 캐시</span>
                </div>
              ) : consensusError ? (
                <div className="py-8 text-center space-y-2">
                  <p className="text-[10px] text-loss">{consensusError}</p>
                  <button onClick={() => fetchConsensus()} className="rounded bg-accent/20 px-3 py-1 text-[10px] text-accent hover:bg-accent/30">
                    다시 시도
                  </button>
                </div>
              ) : consensusFetched && consensusItems.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <p className="text-[10px] text-muted">데이터를 불러오지 못했습니다. FMP API 응답을 확인해주세요.</p>
                  <button onClick={() => fetchConsensus(true)} className="rounded bg-accent/20 px-3 py-1 text-[10px] text-accent hover:bg-accent/30">
                    다시 시도
                  </button>
                </div>
              ) : (
                <div className={`${CARD} overflow-x-auto`}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                      월가 목표주가 컨센서스
                    </h2>
                    <span className="text-[10px] text-muted/60 font-mono">
                      {filtered.length}개 표시 / {consensusItems.length}개 종목
                    </span>
                  </div>
                  {filtered.length === 0 && consensusItems.length > 0 ? (
                    <div className="py-8 text-center space-y-2">
                      <p className="text-[10px] text-muted">조건에 맞는 종목 없음</p>
                      <button
                        onClick={() => {
                          setConsensusSectorFilter("ALL");
                          setConsensusRatingFilter("ALL");
                          setConsensusUpsideFilter("ALL");
                          setConsensusAnalystFilter("ALL");
                        }}
                        className="rounded bg-card-border/50 px-3 py-1 text-[10px] text-muted hover:text-foreground"
                      >필터 초기화</button>
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-card-border">
                          <th className={`${TH} w-6`}>#</th>
                          <th className={TH}>SYMBOL</th>
                          <th className={TH}>NAME</th>
                          <th className={TH}>SECTOR</th>
                          <th className={`${TH} text-right`}>현재가</th>
                          <th className={`${TH} text-right`}>목표주가</th>
                          <th className={`${TH} text-right`}>상승여력%</th>
                          <th className={`${TH} text-right`}>애널리스트</th>
                          <th className={TH}>컨센서스</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((item, i) => (
                          <tr
                            key={item.symbol}
                            onClick={() => { window.location.href = `/financials?ticker=${item.symbol}`; }}
                            className="cursor-pointer border-b border-card-border/40 hover:bg-card-border/20 transition-colors"
                          >
                            <td className={`${TD} text-muted/40 tabular-nums`}>{i + 1}</td>
                            <td className={`${TD} text-accent font-mono font-semibold`}>{item.symbol}</td>
                            <td className={`${TD} max-w-[160px] truncate text-foreground/80`}>{item.name}</td>
                            <td className={`${TD} max-w-[120px] truncate text-muted/70 text-[10px]`}>{item.sector || "—"}</td>
                            <td className={`${TD} text-right tabular-nums font-mono`}>
                              {item.price != null ? `$${item.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                            </td>
                            <td className={`${TD} text-right tabular-nums font-mono font-medium`}>
                              {item.targetConsensus != null ? `$${item.targetConsensus.toFixed(2)}` : "—"}
                            </td>
                            <td className={`${TD} text-right tabular-nums font-mono font-bold`}>
                              <span className={upsideGradient(item.upside)}>
                                {item.upside != null ? `${item.upside > 0 ? "+" : ""}${item.upside.toFixed(1)}%` : "—"}
                              </span>
                            </td>
                            <td className={`${TD} text-right tabular-nums font-mono`}>
                              {item.analystCount > 0 ? item.analystCount : "—"}
                            </td>
                            <td className={TD}>
                              <span className={`inline-block rounded px-1.5 py-px text-[9px] font-medium ${RATING_COLORS[item.rating] ?? RATING_COLORS["N/A"]}`}>
                                {item.rating === "Strong Buy" ? "강력매수"
                                  : item.rating === "Buy" ? "매수"
                                  : item.rating === "Hold" ? "중립"
                                  : item.rating === "Sell" ? "매도"
                                  : item.rating === "Strong Sell" ? "강력매도"
                                  : item.rating}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {tab === "gurus" && <GuruContent />}

        {tab === "ai-trading" && <AiTradingContent />}
      </main>
    </div>
  );
}
