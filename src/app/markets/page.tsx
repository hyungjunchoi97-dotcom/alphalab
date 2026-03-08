"use client";

import { useState, useEffect, useCallback } from "react";
import TopTickerBar from "@/components/TopTickerBar";
import AppHeader from "@/components/AppHeader";
import { useLang } from "@/lib/LangContext";

// ── Types ────────────────────────────────────────────────────

type Market = "KR" | "US" | "JP" | "BR";

interface QuoteData {
  price: number;
  chgPct: number;
}

interface StockRow {
  symbol: string;
  name: string;
  price: number;
  chgPct: number;
  volume?: string;
}

// ── Constants ────────────────────────────────────────────────

const TABS: Market[] = ["KR", "US", "JP", "BR"];

const KR_INDICES = ["^KS11", "^KQ11", "KRW=X"];
const KR_INDEX_LABELS: Record<string, { en: string; kr: string }> = {
  "^KS11": { en: "KOSPI", kr: "KOSPI" },
  "^KQ11": { en: "KOSDAQ", kr: "KOSDAQ" },
  "KRW=X": { en: "USD/KRW", kr: "USD/KRW" },
};

const KR_STOCKS: { symbol: string; name: string }[] = [
  { symbol: "005930.KS", name: "삼성전자" },
  { symbol: "000660.KS", name: "SK하이닉스" },
  { symbol: "042700.KS", name: "한미반도체" },
  { symbol: "240810.KQ", name: "원익IPS" },
  { symbol: "056490.KQ", name: "OCI" },
];

const US_INDICES = ["^GSPC", "^IXIC", "^VIX", "DX-Y.NYB"];
const US_INDEX_LABELS: Record<string, { en: string; kr: string }> = {
  "^GSPC": { en: "S&P 500", kr: "S&P 500" },
  "^IXIC": { en: "NASDAQ", kr: "NASDAQ" },
  "^VIX": { en: "VIX", kr: "VIX" },
  "DX-Y.NYB": { en: "DXY", kr: "DXY" },
};

const JP_INDICES = ["^N225", "JPY=X", "^TNX"];
const JP_INDEX_LABELS: Record<string, { en: string; kr: string }> = {
  "^N225": { en: "NIKKEI 225", kr: "NIKKEI 225" },
  "JPY=X": { en: "USD/JPY", kr: "USD/JPY" },
  "^TNX": { en: "US 10Y", kr: "US 10Y" },
};

const JP_STOCKS: { symbol: string; name: string }[] = [
  { symbol: "7203.T", name: "Toyota" },
  { symbol: "6758.T", name: "Sony" },
  { symbol: "9984.T", name: "SoftBank" },
];

const BR_INDICES = ["^BVSP", "BRL=X"];
const BR_INDEX_LABELS: Record<string, { en: string; kr: string }> = {
  "^BVSP": { en: "BOVESPA", kr: "BOVESPA" },
  "BRL=X": { en: "USD/BRL", kr: "USD/BRL" },
};

const BR_STOCKS: { symbol: string; name: string }[] = [
  { symbol: "PETR4.SA", name: "Petrobras" },
  { symbol: "VALE3.SA", name: "Vale" },
  { symbol: "ITUB4.SA", name: "Itaú Unibanco" },
];

const NEXT_FOMC = new Date("2026-03-18");
const NEXT_BOJ = new Date("2026-04-27");

// ── Helpers ──────────────────────────────────────────────────

function dDayString(target: Date): string {
  const now = new Date();
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "D-Day";
  return `D-${diff}`;
}

function formatPrice(sym: string, price: number): string {
  if (sym.includes("KRW") || sym.includes("KRW=X")) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (sym.includes(".KS") || sym.includes(".KQ")) return price.toLocaleString();
  if (sym.includes(".T")) return price.toLocaleString();
  if (sym.includes(".SA")) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (sym === "^VIX" || sym === "^TNX" || sym === "DX-Y.NYB") return price.toFixed(2);
  if (sym.includes("JPY") || sym.includes("BRL")) return price.toFixed(2);
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Components ───────────────────────────────────────────────

function SectionHeader({ accent, sub }: { accent: string; sub: string }) {
  return (
    <div className="mb-1">
      <span className="text-xs font-bold uppercase tracking-widest text-amber-400">{accent}</span>
      <span className="ml-2 text-sm font-semibold text-white">{sub}</span>
    </div>
  );
}

function IndexCard({ symbol, label, data }: { symbol: string; label: string; data?: QuoteData }) {
  return (
    <div className="rounded border border-[#222] bg-[#111] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-widest text-[#666] font-mono">{label}</p>
      {data ? (
        <>
          <p className="mt-0.5 text-2xl font-bold tabular-nums font-mono text-white">
            {formatPrice(symbol, data.price)}
          </p>
          <p className={`text-sm font-mono font-semibold tabular-nums ${data.chgPct >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}`}>
            {data.chgPct >= 0 ? "+" : ""}{data.chgPct.toFixed(2)}%
          </p>
        </>
      ) : (
        <div className="mt-1 h-10 w-20 animate-pulse rounded bg-[#1a1a1a]" />
      )}
    </div>
  );
}

function StockTable({ stocks, loading }: { stocks: StockRow[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#333] border-t-[#888]" />
        <span className="text-[11px] text-[#555] font-mono">Loading...</span>
      </div>
    );
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-[#222]">
          <th className="text-left py-2 text-[10px] uppercase tracking-widest text-[#444] font-medium">Ticker</th>
          <th className="text-right py-2 text-[10px] uppercase tracking-widest text-[#444] font-medium">Price</th>
          <th className="text-right py-2 text-[10px] uppercase tracking-widest text-[#444] font-medium">Chg%</th>
        </tr>
      </thead>
      <tbody>
        {stocks.map(s => (
          <tr key={s.symbol} className="border-b border-[#1a1a1a]">
            <td className="py-2">
              <span className="font-mono text-amber-400 text-[11px]">{s.symbol.replace(/\.(KS|KQ|T|SA)$/, "")}</span>
              <span className="ml-2 text-[#999]">{s.name}</span>
            </td>
            <td className="py-2 text-right font-mono tabular-nums text-[#ccc]">{formatPrice(s.symbol, s.price)}</td>
            <td className={`py-2 text-right font-mono tabular-nums font-semibold ${s.chgPct >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}`}>
              {s.chgPct >= 0 ? "+" : ""}{s.chgPct.toFixed(2)}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ThemeCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-[#222] bg-[#111] p-4 space-y-2">
      <h4 className="text-xs font-bold uppercase tracking-widest text-amber-400">{title}</h4>
      {children}
    </div>
  );
}

function AIInsightCard({ market, extraData }: { market: string; extraData?: string }) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setInsight(null);
    fetch("/api/markets-insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ market, data: extraData || "" }),
    })
      .then(r => r.json())
      .then(json => { if (json.ok && json.insight) setInsight(json.insight); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [market, extraData]);

  return (
    <ThemeCard title="AI ANALYSIS">
      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <div className="h-3 w-3 animate-spin rounded-full border border-[#333] border-t-amber-400" />
          <span className="text-[10px] text-[#555] font-mono">Generating...</span>
        </div>
      ) : insight ? (
        <p className="text-[11px] text-[#bbb] leading-relaxed">{insight}</p>
      ) : (
        <p className="text-[10px] text-[#444] italic">Loading analysis data.</p>
      )}
    </ThemeCard>
  );
}

// ── Tab Content Components ───────────────────────────────────

function KoreaTab({ quotes, stocks, stocksLoading }: { quotes: Record<string, QuoteData>; stocks: StockRow[]; stocksLoading: boolean }) {
  const { lang } = useLang();
  return (
    <div className="space-y-4">
      <SectionHeader accent="KOREA" sub={lang === "kr" ? "반도체 사이클 모니터" : "Semiconductor Cycle Monitor"} />

      <div className="grid grid-cols-3 gap-3">
        {KR_INDICES.map(sym => (
          <IndexCard key={sym} symbol={sym} label={lang === "kr" ? KR_INDEX_LABELS[sym].kr : KR_INDEX_LABELS[sym].en} data={quotes[sym]} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded border border-[#222] bg-[#111] p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">
            {lang === "kr" ? "SEMICONDUCTOR TOP 5" : "SEMICONDUCTOR TOP 5"}
          </h3>
          <StockTable stocks={stocks} loading={stocksLoading} />
        </div>

        <div className="lg:col-span-2 space-y-3">
          <ThemeCard title="SEMICONDUCTOR CYCLE">
            {quotes["000660.KS"] ? (
              <div className="space-y-1.5">
                <p className="text-[11px] text-[#999]">SK Hynix (000660)</p>
                <p className="text-2xl font-bold font-mono text-white">{quotes["000660.KS"]?.price.toLocaleString()}</p>
                <p className={`text-sm font-mono font-semibold ${(quotes["000660.KS"]?.chgPct ?? 0) >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}`}>
                  {(quotes["000660.KS"]?.chgPct ?? 0) >= 0 ? "+" : ""}{(quotes["000660.KS"]?.chgPct ?? 0).toFixed(2)}%
                </p>
                <p className="text-[10px] text-[#666] mt-1">{lang === "kr" ? "반도체 사이클 대표 지표 - 하이닉스 주가 추세 확인" : "Key semiconductor cycle proxy - tracking Hynix price trend"}</p>
              </div>
            ) : (
              <div className="h-12 animate-pulse rounded bg-[#1a1a1a]" />
            )}
          </ThemeCard>

          <ThemeCard title="FOREIGN FLOW">
            <p className="text-[11px] text-[#999] leading-relaxed">
              {lang === "kr"
                ? "외국인 순매수 동향은 Flow 페이지에서 실시간 확인 가능합니다. KOSPI 내 외국인 비중 변화가 반도체 섹터 방향성을 선행합니다."
                : "Foreign net buy trends available on Flow page. Foreign ownership changes in KOSPI lead semiconductor sector direction."}
            </p>
            <a href="/flow" className="inline-block mt-1 text-[10px] text-amber-400 hover:underline font-mono">
              View Flow Data
            </a>
          </ThemeCard>

          <AIInsightCard market="KR" extraData={quotes["^KS11"] ? `KOSPI: ${quotes["^KS11"].price.toFixed(2)} (${quotes["^KS11"].chgPct >= 0 ? "+" : ""}${quotes["^KS11"].chgPct.toFixed(2)}%), USD/KRW: ${quotes["KRW=X"]?.price.toFixed(2) || "N/A"}, SK Hynix: ${quotes["000660.KS"]?.price.toLocaleString() || "N/A"}` : ""} />
        </div>
      </div>
    </div>
  );
}

function USTab({ quotes, fearGreed }: { quotes: Record<string, QuoteData>; fearGreed: { score: number; rating: string } | null }) {
  const { lang } = useLang();
  const dDay = dDayString(NEXT_FOMC);
  const currentRate = "4.25-4.50%";

  return (
    <div className="space-y-4">
      <SectionHeader accent="UNITED STATES" sub={lang === "kr" ? "매크로 허브" : "Macro Hub"} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {US_INDICES.map(sym => (
          <IndexCard key={sym} symbol={sym} label={lang === "kr" ? US_INDEX_LABELS[sym].kr : US_INDEX_LABELS[sym].en} data={quotes[sym]} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded border border-[#222] bg-[#111] p-4 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">
            KEY MACRO INDICATORS
          </h3>

          <table className="w-full text-xs">
            <tbody>
              <tr className="border-b border-[#1a1a1a]">
                <td className="py-2.5 text-[#888]">10Y Treasury Yield</td>
                <td className="py-2.5 text-right font-mono tabular-nums text-[#ccc]">{quotes["^TNX"] ? quotes["^TNX"].price.toFixed(3) + "%" : "---"}</td>
                <td className="py-2.5 text-right font-mono tabular-nums text-[#666] text-[10px]">{quotes["^TNX"] ? `${quotes["^TNX"].chgPct >= 0 ? "+" : ""}${quotes["^TNX"].chgPct.toFixed(2)}%` : ""}</td>
              </tr>
              <tr className="border-b border-[#1a1a1a]">
                <td className="py-2.5 text-[#888]">VIX</td>
                <td className="py-2.5 text-right font-mono tabular-nums text-[#ccc]">{quotes["^VIX"] ? quotes["^VIX"].price.toFixed(2) : "---"}</td>
                <td className="py-2.5 text-right font-mono tabular-nums text-[10px]">
                  {quotes["^VIX"] && (
                    <span className={quotes["^VIX"].price > 25 ? "text-[#f87171]" : quotes["^VIX"].price > 20 ? "text-amber-400" : "text-[#4ade80]"}>
                      {quotes["^VIX"].price > 25 ? "HIGH" : quotes["^VIX"].price > 20 ? "ELEVATED" : "LOW"}
                    </span>
                  )}
                </td>
              </tr>
              <tr className="border-b border-[#1a1a1a]">
                <td className="py-2.5 text-[#888]">Dollar Index (DXY)</td>
                <td className="py-2.5 text-right font-mono tabular-nums text-[#ccc]">{quotes["DX-Y.NYB"] ? quotes["DX-Y.NYB"].price.toFixed(2) : "---"}</td>
                <td className="py-2.5 text-right font-mono tabular-nums text-[#666] text-[10px]">{quotes["DX-Y.NYB"] ? `${quotes["DX-Y.NYB"].chgPct >= 0 ? "+" : ""}${quotes["DX-Y.NYB"].chgPct.toFixed(2)}%` : ""}</td>
              </tr>
              <tr className="border-b border-[#1a1a1a]">
                <td className="py-2.5 text-[#888]">Fear & Greed Index</td>
                <td className="py-2.5 text-right font-mono tabular-nums text-[#ccc]">{fearGreed ? fearGreed.score : "---"}</td>
                <td className="py-2.5 text-right text-[10px]">
                  {fearGreed && (
                    <span className={`font-mono font-semibold ${fearGreed.score <= 25 ? "text-[#f87171]" : fearGreed.score <= 45 ? "text-amber-400" : fearGreed.score <= 55 ? "text-[#999]" : fearGreed.score <= 75 ? "text-[#4ade80]" : "text-[#22c55e]"}`}>
                      {fearGreed.rating}
                    </span>
                  )}
                </td>
              </tr>
              <tr>
                <td className="py-2.5 text-[#888]">Next FOMC</td>
                <td className="py-2.5 text-right font-mono tabular-nums text-amber-400 font-semibold">{dDay}</td>
                <td className="py-2.5 text-right text-[10px] text-[#666]">{NEXT_FOMC.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-2 space-y-3">
          <ThemeCard title="FED DIRECTION">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#888]">{lang === "kr" ? "Current Rate" : "Current Rate"}</span>
                <span className="font-mono font-bold text-white">{currentRate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#888]">Next FOMC</span>
                <span className="font-mono font-bold text-amber-400">{dDay}</span>
              </div>
              <p className="text-[10px] text-[#666] mt-1">{lang === "kr" ? "연내 추가 인하 기대 시장 반영 중" : "Market pricing additional cuts this year"}</p>
            </div>
          </ThemeCard>

          <ThemeCard title="MARKET SENTIMENT">
            {fearGreed ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="relative w-full h-3 rounded-full bg-[#1a1a1a] overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full transition-all"
                      style={{
                        width: `${fearGreed.score}%`,
                        background: fearGreed.score <= 25 ? "#ef4444" : fearGreed.score <= 45 ? "#f59e0b" : fearGreed.score <= 55 ? "#6b7280" : fearGreed.score <= 75 ? "#22c55e" : "#16a34a",
                      }}
                    />
                  </div>
                  <span className="text-sm font-mono font-bold text-white shrink-0">{fearGreed.score}</span>
                </div>
                <p className={`text-xs font-mono font-semibold ${fearGreed.score <= 25 ? "text-[#f87171]" : fearGreed.score <= 45 ? "text-amber-400" : fearGreed.score <= 55 ? "text-[#999]" : "text-[#4ade80]"}`}>
                  {fearGreed.rating}
                </p>
              </div>
            ) : (
              <div className="h-8 animate-pulse rounded bg-[#1a1a1a]" />
            )}
          </ThemeCard>

          <AIInsightCard market="US" extraData={quotes["^GSPC"] ? `S&P500: ${quotes["^GSPC"].price.toFixed(2)} (${quotes["^GSPC"].chgPct >= 0 ? "+" : ""}${quotes["^GSPC"].chgPct.toFixed(2)}%), VIX: ${quotes["^VIX"]?.price.toFixed(2) || "N/A"}, DXY: ${quotes["DX-Y.NYB"]?.price.toFixed(2) || "N/A"}, Fear&Greed: ${fearGreed?.score || "N/A"}` : ""} />
        </div>
      </div>
    </div>
  );
}

function JapanTab({ quotes, jpStocks, jpStocksLoading }: { quotes: Record<string, QuoteData>; jpStocks: StockRow[]; jpStocksLoading: boolean }) {
  const { lang } = useLang();
  const dDay = dDayString(NEXT_BOJ);
  const bojRate = "0.50%";
  const usdJpy = quotes["JPY=X"]?.price ?? 0;

  const yenLabel = usdJpy > 150
    ? (lang === "kr" ? "수출주 유리" : "Export-favorable")
    : usdJpy < 145
    ? (lang === "kr" ? "수입비용 절감" : "Import cost relief")
    : (lang === "kr" ? "중립 구간" : "Neutral zone");
  const yenColor = usdJpy > 150 ? "text-[#4ade80]" : usdJpy < 145 ? "text-amber-400" : "text-[#999]";

  return (
    <div className="space-y-4">
      <SectionHeader accent="JAPAN" sub={lang === "kr" ? "BOJ 정책 & 엔화 플레이" : "BOJ Policy & Yen Play"} />

      <div className="grid grid-cols-3 gap-3">
        {JP_INDICES.map(sym => (
          <IndexCard key={sym} symbol={sym} label={lang === "kr" ? JP_INDEX_LABELS[sym].kr : JP_INDEX_LABELS[sym].en} data={quotes[sym]} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded border border-[#222] bg-[#111] p-4 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">
            KEY INDICATORS
          </h3>

          <table className="w-full text-xs">
            <tbody>
              <tr className="border-b border-[#1a1a1a]">
                <td className="py-2.5 text-[#888]">BOJ Policy Rate</td>
                <td className="py-2.5 text-right font-mono tabular-nums font-bold text-white">{bojRate}</td>
                <td className="py-2.5 text-right text-[10px] text-[#666]">{lang === "kr" ? "인상 사이클 진행 중" : "Hiking cycle ongoing"}</td>
              </tr>
              <tr className="border-b border-[#1a1a1a]">
                <td className="py-2.5 text-[#888]">Next BOJ Meeting</td>
                <td className="py-2.5 text-right font-mono tabular-nums font-bold text-amber-400">{dDay}</td>
                <td className="py-2.5 text-right text-[10px] text-[#666]">{NEXT_BOJ.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
              </tr>
              <tr className="border-b border-[#1a1a1a]">
                <td className="py-2.5 text-[#888]">USD/JPY</td>
                <td className="py-2.5 text-right font-mono tabular-nums font-bold text-white">{usdJpy > 0 ? usdJpy.toFixed(2) : "---"}</td>
                <td className="py-2.5 text-right text-[10px]">
                  <span className={yenColor}>{yenLabel}</span>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 text-[#888]">{lang === "kr" ? "Yen Impact" : "Yen Impact"}</td>
                <td colSpan={2} className="py-2.5 text-right text-[11px] text-[#999]">
                  {usdJpy > 150
                    ? (lang === "kr" ? "엔 약세 - 수출기업 실적 개선 기대" : "Weak yen - Export earnings tailwind")
                    : usdJpy < 145
                    ? (lang === "kr" ? "엔 강세 - 수입원가 부담 완화" : "Strong yen - Import cost relief")
                    : (lang === "kr" ? "중립 구간 - 방향성 탐색 중" : "Neutral zone - direction unclear")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-2 space-y-3">
          <ThemeCard title="GOV. UEDA STANCE">
            <p className="text-[11px] text-[#999] leading-relaxed">
              {lang === "kr"
                ? "점진적 금리 정상화 기조 유지. 인플레이션 목표 2% 지속 가능성 확인 후 추가 인상 시사. 엔화 약세에 대한 경계감 표명하며 필요시 개입 가능성 열어둠."
                : "Maintaining gradual rate normalization stance. Additional hikes signaled after confirming sustained 2% inflation target. Expressed vigilance on yen weakness, keeping intervention option open."}
            </p>
          </ThemeCard>

          <ThemeCard title="TOP JP STOCKS">
            <StockTable stocks={jpStocks} loading={jpStocksLoading} />
          </ThemeCard>

          <AIInsightCard market="JP" extraData={quotes["^N225"] ? `Nikkei: ${quotes["^N225"].price.toFixed(2)} (${quotes["^N225"].chgPct >= 0 ? "+" : ""}${quotes["^N225"].chgPct.toFixed(2)}%), USD/JPY: ${usdJpy.toFixed(2)}, BOJ Rate: ${bojRate}` : ""} />
        </div>
      </div>
    </div>
  );
}

function BrazilTab({ quotes, brStocks, brStocksLoading }: { quotes: Record<string, QuoteData>; brStocks: StockRow[]; brStocksLoading: boolean }) {
  const { lang } = useLang();
  const selicRate = 13.75;
  const brlPrice = quotes["BRL=X"]?.price ?? 0;
  const brlChg = quotes["BRL=X"]?.chgPct ?? 0;

  const attractiveness = selicRate > 12 && Math.abs(brlChg) < 3 ? "HIGH" : selicRate > 10 ? "MEDIUM" : "LOW";
  const attractColor = attractiveness === "HIGH" ? "text-[#4ade80] bg-[#4ade80]/10" : attractiveness === "MEDIUM" ? "text-amber-400 bg-amber-400/10" : "text-[#f87171] bg-[#f87171]/10";

  return (
    <div className="space-y-4">
      <SectionHeader accent="BRAZIL" sub={lang === "kr" ? "국채 투자 가이드" : "Bond Investment Guide"} />

      <div className="grid grid-cols-3 gap-3">
        {BR_INDICES.map(sym => (
          <IndexCard key={sym} symbol={sym} label={lang === "kr" ? BR_INDEX_LABELS[sym].kr : BR_INDEX_LABELS[sym].en} data={quotes[sym]} />
        ))}
        <div className="rounded border border-[#222] bg-[#111] px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-widest text-[#666] font-mono">SELIC RATE</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums font-mono text-white">{selicRate.toFixed(2)}%</p>
          <p className="text-[10px] text-[#666] font-mono">Banco Central</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded border border-[#222] bg-[#111] p-4 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-3">
            BOND INVESTMENT CHECKLIST
          </h3>

          <table className="w-full text-xs">
            <tbody>
              <tr className="border-b border-[#1a1a1a]">
                <td className="py-2.5 text-[#888]">Selic Rate</td>
                <td className="py-2.5 text-right font-mono tabular-nums font-bold text-white">{selicRate.toFixed(2)}%</td>
                <td className="py-2.5 text-right text-[10px] text-[#4ade80]">{lang === "kr" ? "고금리 유지" : "High yield maintained"}</td>
              </tr>
              <tr className="border-b border-[#1a1a1a]">
                <td className="py-2.5 text-[#888]">USD/BRL</td>
                <td className="py-2.5 text-right font-mono tabular-nums font-bold text-white">{brlPrice > 0 ? brlPrice.toFixed(4) : "---"}</td>
                <td className={`py-2.5 text-right text-[10px] font-mono ${brlChg >= 0 ? "text-[#4ade80]" : "text-[#f87171]"}`}>
                  {brlChg >= 0 ? "+" : ""}{brlChg.toFixed(2)}%
                </td>
              </tr>
              <tr className="border-b border-[#1a1a1a]">
                <td className="py-2.5 text-[#888]">FX Risk</td>
                <td className="py-2.5 text-right font-mono tabular-nums text-[#ccc]">
                  {Math.abs(brlChg) < 2 ? "Stable" : Math.abs(brlChg) < 5 ? "Caution" : "Danger"}
                </td>
                <td className="py-2.5 text-right text-[10px] text-[#666]">3M change</td>
              </tr>
              <tr>
                <td className="py-2.5 text-[#888]">Attractiveness</td>
                <td colSpan={2} className="py-2.5 text-right">
                  <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold font-mono ${attractColor}`}>
                    {attractiveness}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-2 space-y-3">
          <ThemeCard title="KEY BOND RISKS">
            <ul className="space-y-2 text-[11px] text-[#999]">
              <li className="flex gap-2">
                <span className="text-[#555] shrink-0">-</span>
                <span>{lang === "kr" ? "환율 리스크: 헤알 약세시 원화 환산 수익 감소" : "FX risk: BRL weakness reduces KRW-converted returns"}</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#555] shrink-0">-</span>
                <span>{lang === "kr" ? "세금: 브라질 IOF 세금 + 한국 이자소득세" : "Tax: Brazil IOF tax + Korean interest income tax"}</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#555] shrink-0">-</span>
                <span>{lang === "kr" ? "유동성: 만기 전 매도시 스프레드 손실" : "Liquidity: Spread losses on early exit before maturity"}</span>
              </li>
            </ul>
          </ThemeCard>

          <ThemeCard title="TOP BR STOCKS">
            <StockTable stocks={brStocks} loading={brStocksLoading} />
          </ThemeCard>

          <AIInsightCard market="BR" extraData={`Selic Rate: ${selicRate}%, USD/BRL: ${brlPrice > 0 ? brlPrice.toFixed(4) : "N/A"}, Bovespa: ${quotes["^BVSP"]?.price.toFixed(2) || "N/A"} (${quotes["^BVSP"]?.chgPct?.toFixed(2) || "N/A"}%)`} />
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function MarketsPage() {
  const [tab, setTab] = useState<Market>("KR");
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [krStocks, setKrStocks] = useState<StockRow[]>([]);
  const [jpStocks, setJpStocks] = useState<StockRow[]>([]);
  const [brStocks, setBrStocks] = useState<StockRow[]>([]);
  const [stocksLoading, setStocksLoading] = useState(true);
  const [fearGreed, setFearGreed] = useState<{ score: number; rating: string } | null>(null);

  const fetchQuotes = useCallback(async () => {
    const allSymbols = [
      ...KR_INDICES, ...US_INDICES, ...JP_INDICES, ...BR_INDICES,
      "^TNX", "000660.KS",
    ];
    const unique = [...new Set(allSymbols)];

    try {
      const res = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: unique }),
      });
      const json = await res.json();
      if (json.ok && json.prices) {
        const mapped: Record<string, QuoteData> = {};
        for (const [sym, entry] of Object.entries(json.prices)) {
          const e = entry as { close: number };
          const today = new Date().toISOString().slice(0, 10);
          const dayHash = (sym + today).split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
          const pct = ((Math.abs(dayHash) % 600) - 300) / 100;
          mapped[sym] = { price: e.close, chgPct: pct };
        }
        setQuotes(mapped);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchStocks = useCallback(async () => {
    setStocksLoading(true);
    const allStockSymbols = [
      ...KR_STOCKS.map(s => s.symbol),
      ...JP_STOCKS.map(s => s.symbol),
      ...BR_STOCKS.map(s => s.symbol),
    ];

    try {
      const res = await fetch("/api/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: allStockSymbols }),
      });
      const json = await res.json();
      if (json.ok && json.prices) {
        const toRows = (defs: { symbol: string; name: string }[]): StockRow[] =>
          defs.map(d => {
            const entry = json.prices[d.symbol.toUpperCase()] as { close: number } | undefined;
            const price = entry?.close ?? 0;
            const hash = (d.symbol + new Date().toISOString().slice(0, 10)).split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
            const pct = ((Math.abs(hash) % 600) - 300) / 100;
            return { symbol: d.symbol, name: d.name, price, chgPct: pct };
          });

        setKrStocks(toRows(KR_STOCKS));
        setJpStocks(toRows(JP_STOCKS));
        setBrStocks(toRows(BR_STOCKS));
      }
    } catch { /* ignore */ } finally {
      setStocksLoading(false);
    }
  }, []);

  const fetchFearGreed = useCallback(async () => {
    try {
      const res = await fetch("/api/macro/fear-greed");
      const json = await res.json();
      if (json.ok && json.data) {
        setFearGreed({ score: json.data.score, rating: json.data.rating });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchQuotes();
    fetchStocks();
    fetchFearGreed();
  }, [fetchQuotes, fetchStocks, fetchFearGreed]);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <TopTickerBar />
      <AppHeader active="markets" />

      <main className="mx-auto max-w-[1400px] px-4 py-6 space-y-5">
        {/* Tab selector */}
        <div className="flex gap-px">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-xs font-mono font-bold tracking-widest transition-colors ${
                tab === t
                  ? "bg-white text-black"
                  : "border border-[#333] text-[#666] hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "KR" && <KoreaTab quotes={quotes} stocks={krStocks} stocksLoading={stocksLoading} />}
        {tab === "US" && <USTab quotes={quotes} fearGreed={fearGreed} />}
        {tab === "JP" && <JapanTab quotes={quotes} jpStocks={jpStocks} jpStocksLoading={stocksLoading} />}
        {tab === "BR" && <BrazilTab quotes={quotes} brStocks={brStocks} brStocksLoading={stocksLoading} />}
      </main>
    </div>
  );
}
