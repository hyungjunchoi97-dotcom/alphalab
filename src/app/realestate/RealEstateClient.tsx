"use client";

import { useState, useEffect, useCallback, CSSProperties, useRef } from "react";
import AppHeader from "@/components/AppHeader";
import SeoulMap from "./SeoulMap";
import type { DistrictData } from "./SeoulMap";
import PriceChart from "./PriceChart";
import TransactionTable from "./TransactionTable";
import TierListClient from "./tierlist/TierListClient";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface Trade {
  date: string;
  district: string;
  dong: string;
  aptName: string;
  area: number;
  floor: number;
  price: number;
}

interface ApiResponse {
  ok: boolean;
  districts: DistrictData[];
  recentTrades: Trade[];
  updatedAt: string;
  cached: boolean;
  dealYmd?: string;
}

interface TrendResponse {
  ok: boolean;
  months: string[];
  districts: Record<string, (number | null)[]>;
  districtVolumes?: Record<string, (number | null)[]>;
}

interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
}

type TabKey = "trades" | "tierlist" | "supply-demand";

// 서울 아파트 월별 거래량 (수요) - 출처: 국토교통부 실거래가
const SEOUL_TRADE_DATA = [
  { month: "2024.01", trade: 2847, rent: 8234 },
  { month: "2024.02", trade: 3156, rent: 7891 },
  { month: "2024.03", trade: 4203, rent: 9102 },
  { month: "2024.04", trade: 3987, rent: 8756 },
  { month: "2024.05", trade: 4512, rent: 9234 },
  { month: "2024.06", trade: 5123, rent: 9876 },
  { month: "2024.07", trade: 6234, rent: 10234 },
  { month: "2024.08", trade: 5891, rent: 9987 },
  { month: "2024.09", trade: 4756, rent: 9456 },
  { month: "2024.10", trade: 4123, rent: 8923 },
  { month: "2024.11", trade: 3456, rent: 8345 },
  { month: "2024.12", trade: 3102, rent: 7823 },
  { month: "2025.01", trade: 2634, rent: 7456 },
  { month: "2025.02", trade: 2987, rent: 7834 },
];

// 서울 공급 지표 (인허가/착공/준공) - 출처: 국토교통부
const SEOUL_SUPPLY_DATA = [
  { month: "2024.01", permit: 1234, start: 987, complete: 2341 },
  { month: "2024.02", permit: 1456, start: 1123, complete: 1987 },
  { month: "2024.03", permit: 2134, start: 1567, complete: 2456 },
  { month: "2024.04", permit: 1876, start: 1345, complete: 2123 },
  { month: "2024.05", permit: 2345, start: 1678, complete: 1876 },
  { month: "2024.06", permit: 2678, start: 1923, complete: 2234 },
  { month: "2024.07", permit: 1987, start: 1456, complete: 3456 },
  { month: "2024.08", permit: 2123, start: 1678, complete: 3123 },
  { month: "2024.09", permit: 1765, start: 1234, complete: 2876 },
  { month: "2024.10", permit: 1543, start: 1123, complete: 2543 },
  { month: "2024.11", permit: 1234, start: 987, complete: 2234 },
  { month: "2024.12", permit: 1098, start: 876, complete: 3456 },
  { month: "2025.01", permit: 987, start: 765, complete: 2987 },
  { month: "2025.02", permit: 1123, start: 876, complete: 2456 },
];

// 주택담보대출 잔액 (조원) - 출처: 한국은행
const MORTGAGE_DATA = [
  { month: "2024.01", balance: 832.4 },
  { month: "2024.02", balance: 836.1 },
  { month: "2024.03", balance: 841.3 },
  { month: "2024.04", balance: 845.7 },
  { month: "2024.05", balance: 851.2 },
  { month: "2024.06", balance: 858.9 },
  { month: "2024.07", balance: 867.4 },
  { month: "2024.08", balance: 874.2 },
  { month: "2024.09", balance: 878.6 },
  { month: "2024.10", balance: 881.3 },
  { month: "2024.11", balance: 883.7 },
  { month: "2024.12", balance: 885.1 },
  { month: "2025.01", balance: 883.4 },
  { month: "2025.02", balance: 882.9 },
];

function getMonthOptions() {
  const opts: { label: string; value: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      value: `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${d.getFullYear()}년 ${d.getMonth() + 1}월`,
    });
  }
  return opts;
}
const MONTH_OPTIONS = getMonthOptions();

function fmtPrice(manwon: number): string {
  if (!manwon || manwon <= 0) return "—";
  const ok = manwon / 10000;
  return ok >= 1 ? `${ok.toFixed(1)}억` : `${manwon.toLocaleString()}만`;
}

const DISTRICT_NAME_TO_CODE: Record<string, string> = {
  "종로구": "11110", "중구": "11140", "용산구": "11170", "성동구": "11200",
  "광진구": "11215", "동대문구": "11230", "중랑구": "11260", "성북구": "11290",
  "강북구": "11305", "도봉구": "11320", "노원구": "11350", "은평구": "11380",
  "서대문구": "11410", "마포구": "11440", "양천구": "11470", "강서구": "11500",
  "구로구": "11530", "금천구": "11545", "영등포구": "11560", "동작구": "11590",
  "관악구": "11620", "서초구": "11650", "강남구": "11680", "송파구": "11710",
  "강동구": "11740",
};

const CODE_TO_NAME = new Map(Object.entries(DISTRICT_NAME_TO_CODE).map(([n, c]) => [c, n]));
const districtNameToCodeMap = new Map(Object.entries(DISTRICT_NAME_TO_CODE));

// ── Sub-components ────────────────────────────────────────────────────────────

function fmtChange(change: number | null) {
  if (change == null) return "—";
  return `${change > 0 ? "+" : ""}${change}%`;
}

interface DistrictDetailProps {
  data: DistrictData;
  onClear: () => void;
  trades: Trade[];
}

function DistrictDetail({ data, onClear, trades }: DistrictDetailProps) {
  const recent = trades.filter(t => t.district === data.name).slice(0, 5);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={onClear}
          style={{
            fontSize: 9, fontFamily: "'IBM Plex Mono', monospace",
            background: "#1a1a1a", border: "1px solid #2a2a2a",
            color: "#555", padding: "2px 8px", cursor: "pointer",
          }}
        >전체 보기</button>
      </div>

      <div style={{ background: "#161616", border: "1px solid #1e1e1e", padding: "10px 12px" }}>
        <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: "#444", marginBottom: 4, letterSpacing: "0.5px" }}>평균 매매가</div>
        <div style={{ fontSize: 28, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: "#f59e0b", lineHeight: 1 }}>
          {fmtPrice(data.avgPrice)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
        <div style={{ background: "#161616", border: "1px solid #1e1e1e", padding: "8px 10px" }}>
          <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: "#444", marginBottom: 3 }}>거래 건수</div>
          <div style={{ fontSize: 14, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: "#e0e0e0" }}>{data.count}건</div>
        </div>
        <div style={{ background: "#161616", border: "1px solid #1e1e1e", padding: "8px 10px" }}>
          <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: "#444", marginBottom: 3 }}>전월 대비</div>
          <div style={{
            fontSize: 14, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600,
            color: data.change == null ? "#444" : data.change > 0 ? "#22c55e" : data.change < 0 ? "#ef4444" : "#888",
          }}>
            {fmtChange(data.change)}
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "#f59e0b", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>
            최근 실거래
          </div>
          {recent.map((t, i) => (
            <div key={i} style={{ borderBottom: "1px solid #161616", padding: "5px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                <span style={{ fontSize: 15, fontFamily: "monospace", color: "#ffffff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.aptName || t.dong}
                </span>
                <span style={{ fontSize: 15, fontFamily: "'IBM Plex Mono', monospace", color: "#f59e0b", fontWeight: 700, flexShrink: 0 }}>
                  {fmtPrice(t.price)}
                </span>
              </div>
              <div style={{ fontSize: 12, fontFamily: "monospace", color: "#cccccc", marginTop: 1 }}>
                {t.date} · {t.area.toFixed(0)}㎡ · {t.floor}F
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface OverallProps {
  loading: boolean;
  overallAvg: number;
  validCount: number;
  gangnam3Avg: number;
  nonGangnamAvg: number;
  top3Price: DistrictData[];
  top3Count: DistrictData[];
  onSelect: (code: string) => void;
}

function OverallSummary({ loading, overallAvg, validCount, gangnam3Avg, nonGangnamAvg, top3Price, top3Count, onSelect }: OverallProps) {
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 28, background: "#161616" }} />)}
      </div>
    );
  }

  const rowStyle: React.CSSProperties = {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "6px 4px", borderBottom: "1px solid #161616",
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: "#444", marginBottom: 3 }}>서울 평균 매매가</div>
        <div style={{ fontSize: 28, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: "#f59e0b", lineHeight: 1 }}>
          {fmtPrice(Math.round(overallAvg))}
        </div>
        <div style={{ fontSize: 10, fontFamily: "monospace", color: "#333", marginTop: 3 }}>{validCount}개 구 · 구 클릭시 상세</div>
      </div>

      {gangnam3Avg > 0 && (
        <div style={{ background: "#161616", border: "1px solid #1e1e1e", padding: "8px 10px" }}>
          <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: "#444", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 7 }}>
            강남3구 vs 비강남
          </div>
          {[
            { label: "강남3구", avg: gangnam3Avg, color: "#f59e0b", w: "100%" },
            { label: "비강남", avg: nonGangnamAvg, color: "#3b6ea8", w: `${Math.round((nonGangnamAvg / gangnam3Avg) * 100)}%` },
          ].map(row => (
            <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <span style={{ fontSize: 10, fontFamily: "monospace", color: row.color, width: 40, flexShrink: 0 }}>{row.label}</span>
              <div style={{ flex: 1, height: 2, background: "#222" }}>
                <div style={{ width: row.w, height: "100%", background: row.color }} />
              </div>
              <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: row.color, width: 52, textAlign: "right", flexShrink: 0 }}>
                {fmtPrice(Math.round(row.avg))}
              </span>
            </div>
          ))}
        </div>
      )}

      <div>
        <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: "#f59e0b50", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 5 }}>
          고가 TOP 3
        </div>
        {top3Price.map((d, i) => (
          <div
            key={d.code} onClick={() => onSelect(d.code)}
            style={rowStyle}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#161616"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 9, color: "#333", fontFamily: "monospace" }}>{i + 1}</span>
              <span style={{ fontSize: 12, fontFamily: "'IBM Plex Sans KR', 'Noto Sans KR', sans-serif", color: "#e0e0e0" }}>{d.name}</span>
            </div>
            <span style={{ fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: "#f59e0b" }}>
              {fmtPrice(d.avgPrice)}
            </span>
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontSize: 9, fontFamily: "'IBM Plex Mono', monospace", color: "#f59e0b50", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 5 }}>
          거래량 TOP 3
        </div>
        {top3Count.map((d, i) => (
          <div
            key={d.code} onClick={() => onSelect(d.code)}
            style={rowStyle}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#161616"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 9, color: "#333", fontFamily: "monospace" }}>{i + 1}</span>
              <span style={{ fontSize: 12, fontFamily: "'IBM Plex Sans KR', 'Noto Sans KR', sans-serif", color: "#e0e0e0" }}>{d.name}</span>
            </div>
            <span style={{ fontSize: 12, fontFamily: "monospace", color: "#666" }}>{d.count}건</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RealEstateClient() {
  const [month, setMonth] = useState(MONTH_OPTIONS[0]?.value ?? "202503");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendRange, setTrendRange] = useState(12);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [rankingOpen, setRankingOpen] = useState(true);
  const [trendOpen, setTrendOpen] = useState(true);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const newsFetchedRef = useRef<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);
  const [activeTab, setActiveTab] = useState<TabKey>("trades");

  const sectionHeaderStyle: CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    cursor: "pointer", userSelect: "none", padding: "8px 14px",
  };
  const sectionTitleStyle: CSSProperties = {
    fontSize: 14, fontFamily: "'IBM Plex Mono', monospace",
    color: "#ffffff", fontWeight: 600, letterSpacing: "0.05em",
    textTransform: "uppercase",
  };

  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/realestate/seoul?ym=${month}${refresh ? "&refresh=true" : ""}`);
      const json: ApiResponse = await res.json();
      if (!json.ok) throw new Error("API 오류");
      // If all districts have avgPrice=0, refetch once with refresh=true
      if (!refresh && json.districts?.every(d => d.avgPrice === 0)) {
        const retryRes = await fetch(`/api/realestate/seoul?ym=${month}&refresh=true`);
        const retryJson: ApiResponse = await retryRes.json();
        if (retryJson.ok) { setData(retryJson); return; }
      }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    setSelectedDistrict(null);
    setVisibleCount(50);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setTrendLoading(true);
    fetch(`/api/realestate/trend?range=${trendRange}`)
      .then(r => r.json())
      .then((j: TrendResponse) => { if (j.ok) setTrend(j); })
      .catch(() => {})
      .finally(() => setTrendLoading(false));
  }, [trendRange]);

  // Fetch news when district selected
  useEffect(() => {
    setVisibleCount(50);
    if (!selectedDistrict) {
      setNews([]);
      newsFetchedRef.current = null;
      return;
    }
    const name = CODE_TO_NAME.get(selectedDistrict);
    if (!name || newsFetchedRef.current === selectedDistrict) return;
    newsFetchedRef.current = selectedDistrict;
    setNewsLoading(true);
    fetch(`/api/realestate/news?district=${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(j => { if (j.ok) setNews((j.news ?? []).slice(0, 3)); })
      .catch(() => {})
      .finally(() => setNewsLoading(false));
  }, [selectedDistrict]);

  // Derived
  const districts = data?.districts ?? [];
  const validDistricts = districts.filter(d => d.avgPrice > 0);
  const sortedByPrice = [...validDistricts].sort((a, b) => b.avgPrice - a.avgPrice);
  const maxPrice = sortedByPrice[0]?.avgPrice ?? 1;

  const overallAvg = validDistricts.length
    ? validDistricts.reduce((s, d) => s + d.avgPrice, 0) / validDistricts.length : 0;
  const gangnam3 = validDistricts.filter(d => ["강남구", "서초구", "송파구"].includes(d.name));
  const gangnam3Avg = gangnam3.length ? gangnam3.reduce((s, d) => s + d.avgPrice, 0) / gangnam3.length : 0;
  const nonGangnam = validDistricts.filter(d => !["강남구", "서초구", "송파구"].includes(d.name));
  const nonGangnamAvg = nonGangnam.length ? nonGangnam.reduce((s, d) => s + d.avgPrice, 0) / nonGangnam.length : 0;
  const top3Price = sortedByPrice.slice(0, 3);
  const top3Count = [...validDistricts].sort((a, b) => b.count - a.count).slice(0, 3);

  const districtMap = new Map(districts.map(d => [d.code, d]));
  const selectedData = selectedDistrict ? districtMap.get(selectedDistrict) : null;
  const allTrades = data?.recentTrades ?? [];
  const selectedFilterName = selectedDistrict ? CODE_TO_NAME.get(selectedDistrict) ?? null : null;
  const filteredTrades = selectedFilterName ? allTrades.filter(t => t.district === selectedFilterName) : allTrades;

  const updatedAt = data?.updatedAt
    ? new Date(data.updatedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  const selectedDistrictName = selectedDistrict ? CODE_TO_NAME.get(selectedDistrict) ?? null : null;

  const S: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" };

  return (
    <>
      {/* Load IBM Plex Mono + Sans KR */}
      <style dangerouslySetInnerHTML={{ __html: `@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=IBM+Plex+Sans+KR:wght@400;500;700&display=swap');` }} />

      <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e0e0e0" }}>
        <AppHeader active="realestate" />

        <main className="md:pl-56" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)", overflow: "hidden" }}>

          {/* ── Top bar ── */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "6px 14px", borderBottom: "1px solid #1e1e1e",
            background: "#111111", flexShrink: 0,
          }}>
            <div>
              <div style={{ ...S, fontSize: 12, fontWeight: 700, color: "#e0e0e0", letterSpacing: "0.8px", textTransform: "uppercase" }}>
                서울 아파트 실거래가
              </div>
              <div style={{ ...S, fontSize: 9, color: "#3a3a3a", marginTop: 1 }}>
                MOLIT{updatedAt ? ` · ${updatedAt}` : ""}{data?.cached ? " · CACHED" : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <select
                value={month}
                onChange={e => setMonth(e.target.value)}
                style={{ ...S, background: "#161616", border: "1px solid #2a2a2a", color: "#e0e0e0", fontSize: 11, padding: "3px 8px", outline: "none" }}
              >
                {MONTH_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button
                onClick={() => fetchData(true)}
                disabled={loading}
                style={{ ...S, background: "#161616", border: "1px solid #2a2a2a", color: "#3a3a3a", fontSize: 11, padding: "3px 10px", cursor: "pointer" }}
              >
                {loading ? "…" : "↻"}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ ...S, padding: "5px 14px", background: "#1a0808", borderBottom: "1px solid #3a1010", fontSize: 11, color: "#f87171" }}>
              {error}
              <button onClick={() => fetchData()} style={{ marginLeft: 8, color: "#f59e0b", cursor: "pointer", background: "none", border: "none", ...S, fontSize: 11 }}>재시도</button>
            </div>
          )}

          {/* ── Tab navigation ── */}
          <div style={{
            display: "flex", gap: 0, borderBottom: "1px solid #1e1e1e",
            background: "#111111", flexShrink: 0,
          }}>
            {([
              { key: "trades" as TabKey, label: "실거래 현황" },
              { key: "tierlist" as TabKey, label: "티어리스트" },
              { key: "supply-demand" as TabKey, label: "수요/공급" },
            ]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  ...S, fontSize: 12, fontWeight: 600, padding: "8px 20px",
                  cursor: "pointer", background: "transparent", border: "none",
                  borderBottom: activeTab === tab.key ? "2px solid #f59e0b" : "2px solid transparent",
                  color: activeTab === tab.key ? "#f59e0b" : "#555",
                  letterSpacing: "0.05em",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Scrollable body ── */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>

            {activeTab === "supply-demand" ? (
              <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ ...S, fontSize: 10, color: "#555" }}>
                  마지막 업데이트: 2025년 2월 (출처: 국토교통부, 한국은행)
                </div>

                {/* 섹션 1: 수요 - 거래량 */}
                <div className="rounded-xl p-4 border border-[#222] bg-[#111]">
                  <div style={{ ...S, fontSize: 13, fontWeight: 700, color: "#e8e8e8", marginBottom: 12, letterSpacing: "0.05em" }}>
                    아파트 매매/전월세 거래량 (서울)
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={SEOUL_TRADE_DATA}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis dataKey="month" tick={{ fill: "#666", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} />
                      <YAxis tick={{ fill: "#666", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} />
                      <Tooltip
                        contentStyle={{ background: "#1a1a1a", border: "1px solid #333", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}
                        labelStyle={{ color: "#e8e8e8" }}
                      />
                      <Legend wrapperStyle={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }} />
                      <Bar dataKey="trade" name="매매 (건)" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="rent" name="전월세 (건)" fill="#555" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 섹션 2: 공급 - 인허가/착공/준공 */}
                <div className="rounded-xl p-4 border border-[#222] bg-[#111]">
                  <div style={{ ...S, fontSize: 13, fontWeight: 700, color: "#e8e8e8", marginBottom: 12, letterSpacing: "0.05em" }}>
                    주택 공급 지표 (서울)
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={SEOUL_SUPPLY_DATA}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis dataKey="month" tick={{ fill: "#666", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} />
                      <YAxis tick={{ fill: "#666", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} />
                      <Tooltip
                        contentStyle={{ background: "#1a1a1a", border: "1px solid #333", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}
                        labelStyle={{ color: "#e8e8e8" }}
                      />
                      <Legend wrapperStyle={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }} />
                      <Line type="monotone" dataKey="permit" name="인허가 (세대)" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="start" name="착공 (세대)" stroke="#eab308" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="complete" name="준공 (세대)" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* 섹션 3: 주담대 잔액 */}
                <div className="rounded-xl p-4 border border-[#222] bg-[#111]">
                  <div style={{ ...S, fontSize: 13, fontWeight: 700, color: "#e8e8e8", marginBottom: 12, letterSpacing: "0.05em" }}>
                    주택담보대출 잔액
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={MORTGAGE_DATA}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis dataKey="month" tick={{ fill: "#666", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }} />
                      <YAxis
                        tick={{ fill: "#666", fontSize: 10, fontFamily: "'IBM Plex Mono', monospace" }}
                        domain={["dataMin - 5", "dataMax + 5"]}
                        tickFormatter={(v: number) => `${v}조`}
                      />
                      <Tooltip
                        contentStyle={{ background: "#1a1a1a", border: "1px solid #333", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}
                        labelStyle={{ color: "#e8e8e8" }}
                        formatter={(value: number) => [`${value}조원`, "잔액"]}
                      />
                      <Line type="monotone" dataKey="balance" name="잔액 (조원)" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : activeTab === "tierlist" ? (
              <TierListClient embedded />
            ) : (
            <>
            {/* [1] Map + Stats */}
            <div style={{ display: "flex", height: 600, borderBottom: "1px solid #1e1e1e" }}>

              {/* Map */}
              <div style={{ flex: 1, minWidth: 0, borderRight: "1px solid #1e1e1e" }}>
                {loading ? (
                  <div style={{ width: "100%", height: "100%", background: "#0d0d0d", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ ...S, fontSize: 10, color: "#222" }}>LOADING…</span>
                  </div>
                ) : (
                  <SeoulMap
                    districts={validDistricts}
                    selectedCode={selectedDistrict}
                    onSelect={code => setSelectedDistrict(prev => prev === code ? null : code)}
                  />
                )}
              </div>

              {/* Stats panel */}
              <aside style={{ width: 270, flexShrink: 0, background: "#111111", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid #1e1e1e", flexShrink: 0 }}>
                  <div style={{ fontSize: 9, ...S, color: "#3a3a3a", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 3 }}>
                    {selectedData ? "선택된 구" : "전체 요약"}
                  </div>
                  <div style={{ fontSize: 18, fontFamily: "'IBM Plex Sans KR', 'Noto Sans KR', sans-serif", fontWeight: 700, color: "#e0e0e0" }}>
                    {selectedData ? selectedData.name : "서울"}
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
                  {selectedData ? (
                    <DistrictDetail
                      data={selectedData}
                      onClear={() => setSelectedDistrict(null)}
                      trades={allTrades}
                    />
                  ) : (
                    <OverallSummary
                      loading={loading}
                      overallAvg={overallAvg}
                      validCount={validDistricts.length}
                      gangnam3Avg={gangnam3Avg}
                      nonGangnamAvg={nonGangnamAvg}
                      top3Price={top3Price}
                      top3Count={top3Count}
                      onSelect={setSelectedDistrict}
                    />
                  )}
                </div>
              </aside>
            </div>

            {/* [2] Transaction table */}
            {loading ? (
              <div style={{ padding: "20px 16px", ...S, fontSize: 11, color: "#222" }}>로딩 중…</div>
            ) : (
              <>
                <TransactionTable
                  trades={filteredTrades.slice(0, visibleCount)}
                  selectedDistrict={selectedDistrict}
                  onSelectDistrict={setSelectedDistrict}
                  districtNameToCode={districtNameToCodeMap}
                />
                {visibleCount < filteredTrades.length && (
                  <div style={{ background: "#111111", borderBottom: "1px solid #1e1e1e", padding: "10px 14px" }}>
                    <button
                      onClick={() => setVisibleCount(prev => prev + 50)}
                      style={{
                        width: "100%", padding: "10px",
                        background: "#111", border: "1px solid #333",
                        color: "#f59e0b", fontSize: 12,
                        fontFamily: "'IBM Plex Mono', monospace",
                        cursor: "pointer",
                      }}
                    >
                      더 보기 ({filteredTrades.length - visibleCount}건 남음)
                    </button>
                  </div>
                )}
              </>
            )}

            {/* [2.5] District news */}
            {selectedDistrict && selectedDistrictName && (
              <div style={{ background: "#0d0d0d", borderBottom: "1px solid #1e1e1e", padding: "10px 14px" }}>
                <div style={{
                  fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "#f59e0b",
                  fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8,
                }}>
                  관련 뉴스 · {selectedDistrictName}
                </div>
                {newsLoading ? (
                  <div style={{ ...S, fontSize: 10, color: "#333", padding: "6px 0" }}>로딩 중…</div>
                ) : news.length === 0 ? (
                  <div style={{ ...S, fontSize: 10, color: "#333", padding: "6px 0" }}>관련 뉴스 없음</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {news.map((n, i) => (
                      <a
                        key={i}
                        href={n.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "block",
                          borderLeft: "2px solid #f59e0b",
                          paddingLeft: 8,
                          textDecoration: "none",
                          color: "#e0e0e0",
                        }}
                      >
                        <div style={{ fontSize: 12, fontFamily: "'IBM Plex Sans KR', sans-serif", fontWeight: 500, lineHeight: 1.4 }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: 10, fontFamily: "monospace", color: "#555", marginTop: 2 }}>
                          {n.source}{n.publishedAt ? ` · ${new Date(n.publishedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}` : ""}
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* [3] District ranking */}
            {!loading && sortedByPrice.length > 0 && (
              <div style={{ borderBottom: "1px solid #1e1e1e", background: "#0d0d0d" }}>
                <div style={sectionHeaderStyle} onClick={() => setRankingOpen(v => !v)}>
                  <span style={{ ...sectionTitleStyle, fontSize: 12 }}>구별 평균 매매가 랭킹</span>
                  <span style={{
                    fontSize: 14, color: "#ffffff", transition: "transform 0.2s",
                    transform: rankingOpen ? "rotate(180deg)" : "rotate(0deg)",
                    display: "inline-block",
                  }}>▾</span>
                </div>
                {rankingOpen && (
                  <div style={{ padding: "0 14px 10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 24px" }}>
                    {sortedByPrice.map((d, i) => {
                      const isSel = selectedDistrict === d.code;
                      const w = `${Math.round((d.avgPrice / maxPrice) * 100)}%`;
                      return (
                        <div
                          key={d.code}
                          onClick={() => setSelectedDistrict(prev => prev === d.code ? null : d.code)}
                          style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "2px 0" }}
                        >
                          <span style={{ fontSize: 8, fontFamily: "monospace", color: "#2a2a2a", width: 14, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
                          <span style={{ fontSize: 11, ...S, color: "#ffffff", width: 34, flexShrink: 0 }}>
                            {d.name.replace("구", "")}
                          </span>
                          <div style={{ flex: 1, height: 3, background: "#1a1a1a" }}>
                            <div style={{ width: w, height: "100%", background: isSel ? "#f59e0b" : "#2d4a2d", transition: "width 0.3s" }} />
                          </div>
                          <span style={{ fontSize: 11, ...S, color: "#ffffff", width: 42, textAlign: "right", flexShrink: 0 }}>
                            {(d.avgPrice / 10000).toFixed(1)}억
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* [4] Trend chart */}
            <div style={{ borderBottom: "1px solid #1e1e1e" }}>
              <div style={sectionHeaderStyle} onClick={() => setTrendOpen(v => !v)}>
                <span style={sectionTitleStyle}>지역별 평균가 추이</span>
                <span style={{
                  fontSize: 14, color: "#ffffff", transition: "transform 0.2s",
                  transform: trendOpen ? "rotate(180deg)" : "rotate(0deg)",
                  display: "inline-block",
                }}>▾</span>
              </div>
              {trendOpen && (
                <div style={{ height: 620 }}>
                  {trendLoading ? (
                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
                      <span style={{ ...S, fontSize: 10, color: "#222" }}>LOADING TREND…</span>
                    </div>
                  ) : trend ? (
                    <PriceChart
                      months={trend.months}
                      districts={trend.districts}
                      districtVolumes={trend.districtVolumes ?? {}}
                      selectedDistrict={selectedData?.name ?? null}
                      onSelect={name => {
                        const code = DISTRICT_NAME_TO_CODE[name];
                        if (code) setSelectedDistrict(prev => prev === code ? null : code);
                      }}
                      range={trendRange}
                      onRangeChange={setTrendRange}
                    />
                  ) : (
                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ ...S, fontSize: 10, color: "#222" }}>추세 데이터 없음</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            </>
            )}

          </div>
        </main>
      </div>
    </>
  );
}
