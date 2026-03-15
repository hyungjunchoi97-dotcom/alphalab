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
  Tooltip, Legend, ResponsiveContainer, Cell,
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

type TabKey = "trades" | "tierlist" | "supply-demand" | "rate-regulation" | "move-in" | "reconstruction" | "jeonse-rate";

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

const RATE_TIMELINE = [
  { date: "2021.08", type: "rate", label: "기준금리 인상 시작", value: "0.75%", desc: "코로나 저금리 종료, 인상 사이클 시작", color: "#ef4444" },
  { date: "2021.11", type: "rate", label: "기준금리 인상", value: "1.00%", desc: "연속 인상, 부동산 과열 억제 신호", color: "#ef4444" },
  { date: "2022.01", type: "reg", label: "DSR 2단계 시행", value: "DSR 40%", desc: "총부채원리금상환비율 규제 강화, 대출 한도 축소", color: "#f59e0b" },
  { date: "2022.04", type: "rate", label: "기준금리 인상", value: "1.50%", desc: "인플레이션 대응 금리 인상 가속", color: "#ef4444" },
  { date: "2022.07", type: "rate", label: "빅스텝 단행", value: "2.25%", desc: "0.5%p 인상, 역대급 금리 인상", color: "#ef4444" },
  { date: "2022.10", type: "reg", label: "규제지역 해제", value: "일부 해제", desc: "지방 투기과열지구·조정대상지역 대거 해제", color: "#3b82f6" },
  { date: "2023.01", type: "reg", label: "서울 규제 완화", value: "LTV 70%", desc: "강남3구·용산 제외 규제지역 해제, 생애최초 LTV 80%", color: "#3b82f6" },
  { date: "2023.02", type: "rate", label: "금리 동결 시작", value: "3.50%", desc: "인상 사이클 종료, 동결 기조 전환", color: "#60a5fa" },
  { date: "2023.08", type: "reg", label: "스트레스 DSR 예고", value: "DSR 강화", desc: "스트레스 DSR 도입 예고, 시장 관망세", color: "#f59e0b" },
  { date: "2024.02", type: "reg", label: "스트레스 DSR 1단계", value: "가산금리 0.38%", desc: "수도권 주담대 스트레스 금리 적용", color: "#f59e0b" },
  { date: "2024.09", type: "reg", label: "스트레스 DSR 2단계", value: "가산금리 0.75%", desc: "규제 강화로 대출 한도 추가 축소", color: "#f59e0b" },
  { date: "2024.10", type: "rate", label: "기준금리 인하", value: "3.25%", desc: "인하 사이클 시작, 부동산 시장 기대감", color: "#22c55e" },
  { date: "2024.11", type: "rate", label: "기준금리 인하", value: "3.00%", desc: "연속 인하, 거래량 회복 기대", color: "#22c55e" },
  { date: "2025.02", type: "rate", label: "기준금리 인하", value: "2.75%", desc: "경기 부양 목적 추가 인하", color: "#22c55e" },
];

const MOVEIN_DATA = [
  { year: 2023, q: "Q1", gu: "강동구", name: "올림픽파크포레온(둔촌주공)", units: 12032, type: "재건축" },
  { year: 2024, q: "Q1", gu: "서초구", name: "래미안원펜타스", units: 641, type: "재건축" },
  { year: 2024, q: "Q2", gu: "강남구", name: "디에이치퍼스티어아이파크", units: 6702, type: "재건축" },
  { year: 2024, q: "Q2", gu: "서대문구", name: "e편한세상신촌", units: 1226, type: "일반" },
  { year: 2024, q: "Q3", gu: "성동구", name: "청계SK뷰", units: 1236, type: "일반" },
  { year: 2024, q: "Q4", gu: "광진구", name: "자양하늘채베르", units: 522, type: "일반" },
  { year: 2025, q: "Q1", gu: "강남구", name: "개포주공1단지(디에이치퍼스티어)", units: 1690, type: "재건축" },
  { year: 2025, q: "Q1", gu: "서초구", name: "반포주공1단지(래미안트리니원)", units: 2091, type: "재건축" },
  { year: 2025, q: "Q2", gu: "영등포구", name: "여의도한양(브라이튼여의도)", units: 1236, type: "재건축" },
  { year: 2025, q: "Q2", gu: "강동구", name: "둔촌주공2차", units: 890, type: "재건축" },
  { year: 2025, q: "Q3", gu: "동대문구", name: "이문아이파크자이", units: 4321, type: "재개발" },
  { year: 2025, q: "Q3", gu: "은평구", name: "불광미성아파트", units: 756, type: "재건축" },
  { year: 2025, q: "Q4", gu: "마포구", name: "마포더클래시", units: 1149, type: "일반" },
  { year: 2025, q: "Q4", gu: "노원구", name: "상계주공6단지", units: 1848, type: "재건축" },
  { year: 2026, q: "Q1", gu: "송파구", name: "잠실진주아파트", units: 2678, type: "재건축" },
  { year: 2026, q: "Q1", gu: "강남구", name: "압구정3구역", units: 2508, type: "재건축" },
  { year: 2026, q: "Q2", gu: "서초구", name: "신반포15차", units: 1078, type: "재건축" },
  { year: 2026, q: "Q2", gu: "성북구", name: "장위4구역", units: 2840, type: "재개발" },
  { year: 2026, q: "Q3", gu: "강동구", name: "고덕강일3단지", units: 1320, type: "일반" },
  { year: 2026, q: "Q4", gu: "동작구", name: "흑석9구역", units: 1536, type: "재개발" },
  { year: 2027, q: "Q1", gu: "강남구", name: "압구정2구역", units: 3400, type: "재건축" },
  { year: 2027, q: "Q2", gu: "서초구", name: "반포3주구", units: 2990, type: "재건축" },
  { year: 2027, q: "Q3", gu: "송파구", name: "잠실우성1~3차", units: 1590, type: "재건축" },
  { year: 2027, q: "Q4", gu: "영등포구", name: "신길음대단지", units: 2100, type: "재개발" },
];

const MOVEIN_BY_YEAR = [2023, 2024, 2025, 2026, 2027].map(year => ({
  year: String(year),
  total: MOVEIN_DATA.filter(d => d.year === year).reduce((s, d) => s + d.units, 0),
  재건축: MOVEIN_DATA.filter(d => d.year === year && d.type === "재건축").reduce((s, d) => s + d.units, 0),
  재개발: MOVEIN_DATA.filter(d => d.year === year && d.type === "재개발").reduce((s, d) => s + d.units, 0),
  일반: MOVEIN_DATA.filter(d => d.year === year && d.type === "일반").reduce((s, d) => s + d.units, 0),
}));

const RECON_STAGES = ["안전진단", "정비구역지정", "추진위설립", "조합설립", "사업시행인가", "관리처분인가", "착공", "준공"] as const;
type ReconStage = typeof RECON_STAGES[number];

interface ReconProject {
  name: string;
  gu: string;
  type: "재건축" | "재개발";
  stage: ReconStage;
  units: number;
  estimatedYear: string;
  note: string;
}

const RECON_DATA: ReconProject[] = [
  { name: "압구정2구역", gu: "강남구", type: "재건축", stage: "사업시행인가", units: 3400, estimatedYear: "2027", note: "현대1~6차 통합" },
  { name: "압구정3구역", gu: "강남구", type: "재건축", stage: "관리처분인가", units: 2508, estimatedYear: "2026", note: "현대7~14차" },
  { name: "압구정4구역", gu: "강남구", type: "재건축", stage: "조합설립", units: 1800, estimatedYear: "2028", note: "미성1·2차" },
  { name: "은마아파트", gu: "강남구", type: "재건축", stage: "안전진단", units: 4424, estimatedYear: "2030+", note: "안전진단 재추진 중" },
  { name: "대치쌍용1차", gu: "강남구", type: "재건축", stage: "조합설립", units: 1260, estimatedYear: "2029", note: "대치동 재건축" },
  { name: "잠실진주", gu: "송파구", type: "재건축", stage: "착공", units: 2678, estimatedYear: "2026", note: "착공 완료" },
  { name: "잠실우성1~3차", gu: "송파구", type: "재건축", stage: "관리처분인가", units: 1590, estimatedYear: "2027", note: "잠실권역 정비" },
  { name: "반포3주구", gu: "서초구", type: "재건축", stage: "착공", units: 2990, estimatedYear: "2027", note: "래미안 브랜드" },
  { name: "신반포15차", gu: "서초구", type: "재건축", stage: "관리처분인가", units: 1078, estimatedYear: "2026", note: "아크로리버파크 인근" },
  { name: "방배13구역", gu: "서초구", type: "재건축", stage: "사업시행인가", units: 1470, estimatedYear: "2028", note: "방배동 재건축" },
  { name: "여의도한양", gu: "영등포구", type: "재건축", stage: "착공", units: 1236, estimatedYear: "2025", note: "브라이튼여의도" },
  { name: "여의도시범", gu: "영등포구", type: "재건축", stage: "조합설립", units: 3150, estimatedYear: "2029", note: "여의도 최대 단지" },
  { name: "이문1구역", gu: "동대문구", type: "재개발", stage: "착공", units: 4321, estimatedYear: "2025", note: "이문아이파크자이" },
  { name: "장위4구역", gu: "성북구", type: "재개발", stage: "관리처분인가", units: 2840, estimatedYear: "2026", note: "장위동 재개발" },
  { name: "흑석9구역", gu: "동작구", type: "재개발", stage: "착공", units: 1536, estimatedYear: "2026", note: "흑석동 한강변" },
  { name: "신길음1구역", gu: "영등포구", type: "재개발", stage: "사업시행인가", units: 2100, estimatedYear: "2027", note: "신길동 재개발" },
  { name: "수색증산4구역", gu: "은평구", type: "재개발", stage: "관리처분인가", units: 1890, estimatedYear: "2027", note: "DMC 인근" },
  { name: "돈의문1구역", gu: "종로구", type: "재개발", stage: "조합설립", units: 890, estimatedYear: "2029", note: "도심 재개발" },
];

const JEONSE_RATE_BY_GU = [
  { gu: "도봉구", rate: 68.2, avgPrice: 4.1, avgJeonse: 2.8, gap: 1.3 },
  { gu: "노원구", rate: 67.4, avgPrice: 4.8, avgJeonse: 3.2, gap: 1.6 },
  { gu: "강북구", rate: 66.9, avgPrice: 3.9, avgJeonse: 2.6, gap: 1.3 },
  { gu: "중랑구", rate: 65.8, avgPrice: 4.2, avgJeonse: 2.8, gap: 1.4 },
  { gu: "금천구", rate: 65.1, avgPrice: 4.4, avgJeonse: 2.9, gap: 1.5 },
  { gu: "구로구", rate: 64.3, avgPrice: 4.9, avgJeonse: 3.1, gap: 1.8 },
  { gu: "은평구", rate: 63.7, avgPrice: 5.2, avgJeonse: 3.3, gap: 1.9 },
  { gu: "동대문구", rate: 63.2, avgPrice: 5.6, avgJeonse: 3.5, gap: 2.1 },
  { gu: "성북구", rate: 62.8, avgPrice: 5.4, avgJeonse: 3.4, gap: 2.0 },
  { gu: "관악구", rate: 62.1, avgPrice: 5.8, avgJeonse: 3.6, gap: 2.2 },
  { gu: "서대문구", rate: 61.4, avgPrice: 6.1, avgJeonse: 3.7, gap: 2.4 },
  { gu: "중구", rate: 60.8, avgPrice: 7.2, avgJeonse: 4.4, gap: 2.8 },
  { gu: "동작구", rate: 59.6, avgPrice: 7.8, avgJeonse: 4.6, gap: 3.2 },
  { gu: "강서구", rate: 59.1, avgPrice: 6.4, avgJeonse: 3.8, gap: 2.6 },
  { gu: "영등포구", rate: 58.4, avgPrice: 8.2, avgJeonse: 4.8, gap: 3.4 },
  { gu: "양천구", rate: 57.9, avgPrice: 7.6, avgJeonse: 4.4, gap: 3.2 },
  { gu: "광진구", rate: 57.2, avgPrice: 8.9, avgJeonse: 5.1, gap: 3.8 },
  { gu: "성동구", rate: 54.8, avgPrice: 11.2, avgJeonse: 6.1, gap: 5.1 },
  { gu: "마포구", rate: 53.6, avgPrice: 10.8, avgJeonse: 5.8, gap: 5.0 },
  { gu: "종로구", rate: 52.9, avgPrice: 9.4, avgJeonse: 5.0, gap: 4.4 },
  { gu: "강동구", rate: 51.4, avgPrice: 10.2, avgJeonse: 5.2, gap: 5.0 },
  { gu: "송파구", rate: 48.7, avgPrice: 14.6, avgJeonse: 7.1, gap: 7.5 },
  { gu: "용산구", rate: 46.2, avgPrice: 16.8, avgJeonse: 7.8, gap: 9.0 },
  { gu: "서초구", rate: 44.8, avgPrice: 18.4, avgJeonse: 8.2, gap: 10.2 },
  { gu: "강남구", rate: 43.1, avgPrice: 21.2, avgJeonse: 9.1, gap: 12.1 },
].sort((a, b) => b.rate - a.rate);

const JEONSE_TREND = [
  { month: "2023.01", rate: 57.2 },
  { month: "2023.03", rate: 56.4 },
  { month: "2023.05", rate: 55.8 },
  { month: "2023.07", rate: 54.9 },
  { month: "2023.09", rate: 54.1 },
  { month: "2023.11", rate: 53.6 },
  { month: "2024.01", rate: 53.2 },
  { month: "2024.03", rate: 53.8 },
  { month: "2024.05", rate: 54.2 },
  { month: "2024.07", rate: 55.1 },
  { month: "2024.09", rate: 55.8 },
  { month: "2024.11", rate: 56.2 },
  { month: "2025.01", rate: 56.8 },
  { month: "2025.02", rate: 57.1 },
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
              { key: "rate-regulation" as TabKey, label: "금리/규제" },
              { key: "move-in" as TabKey, label: "입주물량" },
              { key: "reconstruction" as TabKey, label: "재건축/재개발" },
              { key: "jeonse-rate" as TabKey, label: "전세가율" },
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

                {/* 차트 해석 가이드 */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    {[
                      {
                        title: "거래량 — 시장 온도",
                        color: "#3b82f6",
                        desc: "매매 거래량은 시장 수요의 선행지표입니다. 거래량 급증은 가격 상승 신호, 급감은 관망세 진입을 의미합니다. 전월세 거래량이 매매보다 높으면 매매 전환 대기 수요가 쌓이는 구간입니다."
                      },
                      {
                        title: "인허가 → 착공 → 준공 사이클",
                        color: "#f59e0b",
                        desc: "인허가 후 착공까지 6~12개월, 준공까지 2~3년 소요됩니다. 인허가·착공 감소는 2~3년 후 공급 부족을 예고합니다. 준공 급증 구간은 단기 공급 과잉으로 가격 하방 압력이 발생합니다."
                      },
                      {
                        title: "주담대 — 유동성 지표",
                        color: "#ef4444",
                        desc: "주담대 잔액 증가는 레버리지 수요 확대를 의미하며 가격 상승과 동행합니다. 잔액이 감소하거나 증가세 둔화 시 수요 위축 신호입니다. 금리 인상기에는 주담대 증가세 둔화가 거래량 감소로 이어집니다."
                      }
                    ].map(card => (
                      <div key={card.title} style={{
                        background: "#111", border: "1px solid #222",
                        borderLeft: `3px solid ${card.color}`,
                        borderRadius: 10, padding: "14px 16px"
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#ffffff", marginBottom: 8 }}>{card.title}</div>
                        <div style={{ fontSize: 12, color: "#aaaaaa", lineHeight: 1.75 }}>{card.desc}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{
                    background: "#111", border: "1px solid #222", borderRadius: 10,
                    padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 10
                  }}>
                    <div style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700, whiteSpace: "nowrap", marginTop: 1 }}>종합 해석</div>
                    <div style={{ fontSize: 12, color: "#aaaaaa", lineHeight: 1.8 }}>
                      <b style={{ color: "#ffffff" }}>매수 신호:</b> 거래량 증가 + 인허가·착공 감소 + 주담대 증가 동시 발생 시 공급 부족 국면 진입 가능성 높음.&nbsp;
                      <b style={{ color: "#ffffff" }}>매도/관망 신호:</b> 거래량 감소 + 준공 급증 + 주담대 둔화 시 단기 조정 구간 가능성. 세 지표를 함께 보며 시장 사이클 위치를 판단하세요.
                    </div>
                  </div>
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
                        formatter={(value: number | undefined) => [`${value ?? 0}조원`, "잔액"]}
                      />
                      <Line type="monotone" dataKey="balance" name="잔액 (조원)" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : activeTab === "rate-regulation" ? (
              <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 20 }}>

                {/* 상단 요약 카드 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  {[
                    { label: "현재 기준금리", value: "2.75%", sub: "2025.02 인하", color: "#22c55e" },
                    { label: "스트레스 DSR", value: "2단계", sub: "가산금리 0.75%", color: "#f59e0b" },
                    { label: "서울 규제지역", value: "강남3구+용산", sub: "투기과열지구", color: "#ef4444" },
                  ].map(card => (
                    <div key={card.label} style={{
                      background: "#111", border: "1px solid #222",
                      borderLeft: `3px solid ${card.color}`,
                      borderRadius: 10, padding: "14px 16px"
                    }}>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{card.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: card.color, marginBottom: 2 }}>{card.value}</div>
                      <div style={{ fontSize: 11, color: "#666" }}>{card.sub}</div>
                    </div>
                  ))}
                </div>

                {/* 타임라인 */}
                <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "16px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 16 }}>금리 · 규제 타임라인</div>
                  <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                    {[
                      { type: "rate", label: "금리 인상", color: "#ef4444" },
                      { type: "rate-down", label: "금리 인하", color: "#22c55e" },
                      { type: "rate-hold", label: "금리 동결", color: "#60a5fa" },
                      { type: "reg", label: "규제 변화", color: "#f59e0b" },
                    ].map(l => (
                      <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                        <span style={{ fontSize: 10, color: "#888" }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ position: "relative", paddingLeft: 16 }}>
                    <div style={{ position: "absolute", left: 16, top: 0, bottom: 0, width: 1, background: "#333" }} />
                    {RATE_TIMELINE.map((item, i) => (
                      <div key={i} style={{ display: "flex", gap: 16, marginBottom: 16, position: "relative" }}>
                        <div style={{
                          position: "absolute", left: -20, top: 4,
                          width: 8, height: 8, borderRadius: "50%",
                          background: item.color, flexShrink: 0
                        }} />
                        <div style={{ minWidth: 60, fontSize: 11, color: "#666", paddingTop: 2 }}>{item.date}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#e8e8e8" }}>{item.label}</span>
                            <span style={{
                              fontSize: 10, fontWeight: 600, color: item.color,
                              background: `${item.color}22`, padding: "1px 6px", borderRadius: 4
                            }}>{item.value}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "#888", lineHeight: 1.5 }}>{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 투자 시사점 */}
                <div style={{
                  background: "#111", border: "1px solid #222", borderRadius: 10,
                  padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 10
                }}>
                  <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, whiteSpace: "nowrap", marginTop: 1 }}>투자 시사점</div>
                  <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.8 }}>
                    <b style={{ color: "#fff" }}>금리 인하 사이클:</b> 현재 인하 기조 진행 중으로 대출 이자 부담 감소 → 매수 심리 회복 기대.
                    <b style={{ color: "#fff" }}> 스트레스 DSR:</b> 금리 인하에도 불구 DSR 규제로 실질 대출 한도는 제한적.
                    <b style={{ color: "#fff" }}> 핵심 관전 포인트:</b> 2025년 추가 금리 인하 여부 + 스트레스 DSR 3단계 시행 시기가 시장 방향성 결정.
                  </div>
                </div>

              </div>
            ) : activeTab === "move-in" ? (
              <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 20 }}>

                {/* 상단 안내 */}
                <div style={{ fontSize: 11, color: "#555" }}>
                  마지막 업데이트: 2025년 3월 (출처: 부동산114, 각 조합)　*예정 물량은 변동될 수 있습니다.
                </div>

                {/* 연도별 요약 카드 */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                  {MOVEIN_BY_YEAR.map(d => {
                    const isCurrent = d.year === "2025";
                    return (
                      <div key={d.year} style={{
                        background: "#111", border: `1px solid ${isCurrent ? "#f59e0b44" : "#222"}`,
                        borderLeft: `3px solid ${isCurrent ? "#f59e0b" : "#333"}`,
                        borderRadius: 10, padding: "12px 14px"
                      }}>
                        <div style={{ fontSize: 11, color: isCurrent ? "#f59e0b" : "#888", fontWeight: 700, marginBottom: 6 }}>
                          {d.year}{isCurrent ? " (현재)" : ""}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#e8e8e8", marginBottom: 4 }}>
                          {d.total.toLocaleString()}세대
                        </div>
                        <div style={{ fontSize: 10, color: "#666" }}>재건축 {d.재건축.toLocaleString()}</div>
                        <div style={{ fontSize: 10, color: "#666" }}>재개발 {d.재개발.toLocaleString()}</div>
                        <div style={{ fontSize: 10, color: "#666" }}>일반 {d.일반.toLocaleString()}</div>
                      </div>
                    );
                  })}
                </div>

                {/* 연도별 입주 물량 바 차트 */}
                <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "16px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 16 }}>연도별 입주 물량 (서울)</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={MOVEIN_BY_YEAR} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <XAxis dataKey="year" tick={{ fill: "#888", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#888", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}천`} />
                      <Tooltip
                        contentStyle={{ background: "#1a1a1a", border: "1px solid #333", fontSize: 11 }}
                        labelStyle={{ color: "#e8e8e8" }}
                        formatter={(value: number, name: string) => [`${value.toLocaleString()}세대`, name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#888" }} />
                      <Bar dataKey="재건축" stackId="a" fill="#f59e0b" />
                      <Bar dataKey="재개발" stackId="a" fill="#3b82f6" />
                      <Bar dataKey="일반" stackId="a" fill="#6b7280" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 분기별 상세 테이블 */}
                <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "16px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 12 }}>분기별 입주 단지 상세</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #333" }}>
                          {["연도", "분기", "자치구", "단지명", "세대수", "유형"].map(h => (
                            <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#666", fontSize: 11, fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {MOVEIN_DATA.map((d, i) => {
                          const isCurrent = d.year === 2025;
                          const isPast = d.year < 2025;
                          return (
                            <tr key={i} style={{ borderBottom: "1px solid #1e1e1e", opacity: isPast ? 0.5 : 1 }}>
                              <td style={{ padding: "8px 12px", color: isCurrent ? "#f59e0b" : "#888" }}>{d.year}</td>
                              <td style={{ padding: "8px 12px", color: "#888" }}>{d.q}</td>
                              <td style={{ padding: "8px 12px", color: "#ccc" }}>{d.gu}</td>
                              <td style={{ padding: "8px 12px", color: "#e8e8e8" }}>{d.name}</td>
                              <td style={{ padding: "8px 12px", color: "#e8e8e8", fontWeight: 600 }}>{d.units.toLocaleString()}</td>
                              <td style={{ padding: "8px 12px" }}>
                                <span style={{
                                  fontSize: 10, padding: "2px 6px", borderRadius: 4,
                                  background: d.type === "재건축" ? "#f59e0b22" : d.type === "재개발" ? "#3b82f622" : "#6b728022",
                                  color: d.type === "재건축" ? "#f59e0b" : d.type === "재개발" ? "#3b82f6" : "#9ca3af"
                                }}>{d.type}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 투자 시사점 */}
                <div style={{
                  background: "#111", border: "1px solid #222", borderRadius: 10,
                  padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 10
                }}>
                  <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, whiteSpace: "nowrap", marginTop: 1 }}>투자 시사점</div>
                  <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.8 }}>
                    <b style={{ color: "#fff" }}>2025~2026년 공급 집중:</b> 압구정·반포·잠실 재건축 대단지 입주로 강남권 일시적 공급 과잉 가능성.&nbsp;
                    <b style={{ color: "#fff" }}>이문·장위 재개발:</b> 동북권 대규모 입주로 해당 권역 전세가 하방 압력.&nbsp;
                    <b style={{ color: "#fff" }}>관심 구역:</b> 입주 물량 적은 마포·용산·성동구는 상대적으로 공급 부족 지속 예상.
                  </div>
                </div>

              </div>
            ) : activeTab === "reconstruction" ? (
              <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 20 }}>

                {/* 상단 안내 */}
                <div style={{ fontSize: 11, color: "#555" }}>
                  마지막 업데이트: 2025년 3월 (출처: 서울시 정비사업 정보몽땅, 각 조합)　*단계 및 예정연도는 변동될 수 있습니다.
                </div>

                {/* 단계 범례 + 요약 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {/* 단계 설명 */}
                  <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 10 }}>사업 진행 단계</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {RECON_STAGES.map((stage, i) => {
                        const colors = ["#555","#666","#777","#888","#f59e0b","#fb923c","#22c55e","#3b82f6"];
                        return (
                          <div key={stage} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 20, height: 20, borderRadius: 4, background: colors[i], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 700, flexShrink: 0 }}>{i+1}</div>
                            <span style={{ fontSize: 11, color: i >= 4 ? "#e8e8e8" : "#888" }}>{stage}</span>
                            {i >= 6 && <span style={{ fontSize: 9, color: colors[i], marginLeft: "auto" }}>진행중</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* 요약 통계 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { label: "전체 프로젝트", value: `${RECON_DATA.length}개`, color: "#e8e8e8" },
                      { label: "총 예정 세대수", value: `${RECON_DATA.reduce((s,d) => s+d.units, 0).toLocaleString()}세대`, color: "#f59e0b" },
                      { label: "착공 이상 단계", value: `${RECON_DATA.filter(d => ["착공","준공"].includes(d.stage)).length}개`, color: "#22c55e" },
                      { label: "관리처분 이상 단계", value: `${RECON_DATA.filter(d => ["관리처분인가","착공","준공"].includes(d.stage)).length}개`, color: "#fb923c" },
                    ].map(s => (
                      <div key={s.label} style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "#888" }}>{s.label}</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 프로젝트 테이블 */}
                <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "16px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 12 }}>주요 정비사업 현황</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #333" }}>
                          {["구역명", "자치구", "유형", "현재단계", "예정세대", "준공예정", "비고"].map(h => (
                            <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#666", fontSize: 11, fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...RECON_DATA].sort((a, b) => RECON_STAGES.indexOf(b.stage) - RECON_STAGES.indexOf(a.stage)).map((d, i) => {
                          const stageIdx = RECON_STAGES.indexOf(d.stage);
                          const stageColors = ["#555","#666","#777","#888","#f59e0b","#fb923c","#22c55e","#3b82f6"];
                          const stageColor = stageColors[stageIdx];
                          return (
                            <tr key={i} style={{ borderBottom: "1px solid #1e1e1e" }}>
                              <td style={{ padding: "9px 12px", color: "#e8e8e8", fontWeight: 600 }}>{d.name}</td>
                              <td style={{ padding: "9px 12px", color: "#aaa" }}>{d.gu}</td>
                              <td style={{ padding: "9px 12px" }}>
                                <span style={{
                                  fontSize: 10, padding: "2px 6px", borderRadius: 4,
                                  background: d.type === "재건축" ? "#f59e0b22" : "#3b82f622",
                                  color: d.type === "재건축" ? "#f59e0b" : "#3b82f6"
                                }}>{d.type}</span>
                              </td>
                              <td style={{ padding: "9px 12px" }}>
                                <span style={{
                                  fontSize: 10, padding: "2px 8px", borderRadius: 4,
                                  background: `${stageColor}22`, color: stageColor, fontWeight: 600
                                }}>{d.stage}</span>
                              </td>
                              <td style={{ padding: "9px 12px", color: "#e8e8e8", fontWeight: 600 }}>{d.units.toLocaleString()}</td>
                              <td style={{ padding: "9px 12px", color: d.estimatedYear.includes("+") ? "#666" : "#aaa" }}>{d.estimatedYear}</td>
                              <td style={{ padding: "9px 12px", color: "#666", fontSize: 11 }}>{d.note}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 투자 시사점 */}
                <div style={{
                  background: "#111", border: "1px solid #222", borderRadius: 10,
                  padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 10
                }}>
                  <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, whiteSpace: "nowrap", marginTop: 1 }}>투자 시사점</div>
                  <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.8 }}>
                    <b style={{ color: "#fff" }}>착공 단계 주목:</b> 착공 이상 단계 진입 단지는 이주 수요 발생으로 인근 전세가 상승 가능.&nbsp;
                    <b style={{ color: "#fff" }}>압구정·여의도 라인:</b> 관리처분~착공 구간 진입으로 2026~2027년 강남·여의도 이주 수요 집중 예상.&nbsp;
                    <b style={{ color: "#fff" }}>은마·여의도시범:</b> 초기 단계로 장기 투자 관점에서 접근, 사업 지연 리스크 고려 필요.
                  </div>
                </div>

              </div>
            ) : activeTab === "jeonse-rate" ? (
              <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: 20 }}>

                {/* 상단 안내 */}
                <div style={{ fontSize: 11, color: "#555" }}>
                  마지막 업데이트: 2025년 2월 (출처: 한국부동산원 R-ONE)　*평균 매매가/전세가는 3.3㎡당 기준
                </div>

                {/* 요약 카드 3개 */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  {[
                    { label: "서울 평균 전세가율", value: "57.1%", sub: "2025.02 기준", color: "#f59e0b" },
                    { label: "전세가율 70% 이상", value: `${JEONSE_RATE_BY_GU.filter(d => d.rate >= 70).length}개구`, sub: "갭투자 주의 구역", color: "#ef4444" },
                    { label: "전세가율 50% 미만", value: `${JEONSE_RATE_BY_GU.filter(d => d.rate < 50).length}개구`, sub: "강남권 안전 구역", color: "#22c55e" },
                  ].map(card => (
                    <div key={card.label} style={{
                      background: "#111", border: "1px solid #222",
                      borderLeft: `3px solid ${card.color}`,
                      borderRadius: 10, padding: "14px 16px"
                    }}>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{card.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: card.color, marginBottom: 2 }}>{card.value}</div>
                      <div style={{ fontSize: 11, color: "#666" }}>{card.sub}</div>
                    </div>
                  ))}
                </div>

                {/* 전세가율 추이 차트 */}
                <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "16px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>서울 평균 전세가율 추이</div>
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 16 }}>전세가율 상승 = 매매가 하락 or 전세가 상승 신호</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={JEONSE_TREND} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                      <XAxis dataKey="month" tick={{ fill: "#888", fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                      <YAxis domain={[50, 62]} tick={{ fill: "#888", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                      <Tooltip
                        contentStyle={{ background: "#1a1a1a", border: "1px solid #333", fontSize: 11 }}
                        labelStyle={{ color: "#e8e8e8" }}
                        formatter={(value: number) => [`${value}%`, "전세가율"]}
                      />
                      <Line type="monotone" dataKey="rate" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: "#f59e0b" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* 구별 전세가율 바 차트 */}
                <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "16px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>자치구별 전세가율</div>
                  <div style={{ fontSize: 11, color: "#666", marginBottom: 16 }}>높을수록 갭 리스크 높음 / 낮을수록 매매가 대비 전세 저평가</div>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={JEONSE_RATE_BY_GU} layout="vertical" margin={{ top: 0, right: 40, left: 60, bottom: 0 }}>
                      <XAxis type="number" domain={[40, 75]} tick={{ fill: "#888", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                      <YAxis type="category" dataKey="gu" tick={{ fill: "#aaa", fontSize: 10 }} axisLine={false} tickLine={false} width={55} />
                      <Tooltip
                        contentStyle={{ background: "#1a1a1a", border: "1px solid #333", fontSize: 11 }}
                        formatter={(value: number) => [`${value}%`, "전세가율"]}
                      />
                      <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                        {JEONSE_RATE_BY_GU.map((entry) => (
                          <Cell
                            key={entry.gu}
                            fill={entry.rate >= 65 ? "#ef4444" : entry.rate >= 58 ? "#f59e0b" : entry.rate >= 50 ? "#60a5fa" : "#22c55e"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                    {[
                      { color: "#ef4444", label: "65% 이상 (갭 위험)" },
                      { color: "#f59e0b", label: "58~65% (주의)" },
                      { color: "#60a5fa", label: "50~58% (보통)" },
                      { color: "#22c55e", label: "50% 미만 (안전)" },
                    ].map(l => (
                      <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                        <span style={{ fontSize: 10, color: "#888" }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 구별 상세 테이블 */}
                <div style={{ background: "#111", border: "1px solid #222", borderRadius: 10, padding: "16px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 12 }}>구별 전세가율 상세 (전세가율 높은 순)</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #333" }}>
                          {["자치구", "전세가율", "평균 매매가", "평균 전세가", "갭 (억)", "갭 리스크"].map(h => (
                            <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#666", fontSize: 11, fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {JEONSE_RATE_BY_GU.map((d, i) => {
                          const riskColor = d.rate >= 65 ? "#ef4444" : d.rate >= 58 ? "#f59e0b" : d.rate >= 50 ? "#60a5fa" : "#22c55e";
                          const riskLabel = d.rate >= 65 ? "위험" : d.rate >= 58 ? "주의" : d.rate >= 50 ? "보통" : "안전";
                          return (
                            <tr key={i} style={{ borderBottom: "1px solid #1e1e1e" }}>
                              <td style={{ padding: "8px 12px", color: "#e8e8e8", fontWeight: 600 }}>{d.gu}</td>
                              <td style={{ padding: "8px 12px", color: riskColor, fontWeight: 700 }}>{d.rate}%</td>
                              <td style={{ padding: "8px 12px", color: "#aaa" }}>{d.avgPrice}억</td>
                              <td style={{ padding: "8px 12px", color: "#aaa" }}>{d.avgJeonse}억</td>
                              <td style={{ padding: "8px 12px", color: "#e8e8e8", fontWeight: 600 }}>{d.gap}억</td>
                              <td style={{ padding: "8px 12px" }}>
                                <span style={{
                                  fontSize: 10, padding: "2px 8px", borderRadius: 4,
                                  background: `${riskColor}22`, color: riskColor, fontWeight: 600
                                }}>{riskLabel}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 투자 시사점 */}
                <div style={{
                  background: "#111", border: "1px solid #222", borderRadius: 10,
                  padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 10
                }}>
                  <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, whiteSpace: "nowrap", marginTop: 1 }}>투자 시사점</div>
                  <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.8 }}>
                    <b style={{ color: "#fff" }}>전세가율 상승 구간 주목:</b> 도봉·노원·강북 등 전세가율 65% 이상 구역은 갭투자 리스크 높으나 매매 전환 대기 수요 풍부.&nbsp;
                    <b style={{ color: "#fff" }}>강남권 저전세가율:</b> 강남·서초·용산은 전세가율 50% 미만으로 실수요 중심 안정적 시장. 갭 크지만 가격 하방 압력 낮음.&nbsp;
                    <b style={{ color: "#fff" }}>전세가율 반등 신호:</b> 2024년 하반기부터 서울 평균 전세가율 상승 전환 — 전세 수요 증가 또는 매매가 조정 진행 중.
                  </div>
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
