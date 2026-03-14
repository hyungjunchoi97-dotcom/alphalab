"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useLang } from "@/lib/LangContext";
import {
  AreaChart,
  Area,
  XAxis,
  ResponsiveContainer,
} from "recharts";

// ── Theme (Bloomberg monochrome) ─────────────────────────
const B = {
  bg: "#080c12",
  card: "#0a0e14",
  border: "rgba(255,255,255,0.08)",
  borderLight: "rgba(255,255,255,0.12)",
  divider: "rgba(255,255,255,0.06)",
  white: "#ffffff",
  text: "#e0e4ea",
  muted: "#6b7280",
  subtle: "#9ca3af",
  dim: "#4b5563",
  green: "#22c55e",
  red: "#ef4444",
  chartLine: "rgba(255,255,255,0.8)",
  chartFill: "rgba(255,255,255,0.05)",
  barTrack: "rgba(255,255,255,0.1)",
  barFill: "rgba(255,255,255,0.7)",
};

const INDICATOR_CHART_CONFIG: Record<string, { labelKr: string; labelEn: string }> = {
  WALCL:     { labelKr: "연준 대차대조표", labelEn: "Fed Balance Sheet" },
  RRPONTSYD: { labelKr: "역레포 RRP", labelEn: "Reverse Repo RRP" },
  WTREGEN:   { labelKr: "TGA 재무부계좌", labelEn: "TGA Balance" },
  WRESBAL:   { labelKr: "은행 지급준비금", labelEn: "Bank Reserves" },
};

const EXTENDED_CHART_CONFIG: Record<string, { labelKr: string; labelEn: string; subKr: string; subEn: string }> = {
  M2_YOY:       { labelKr: "M2 증가율", labelEn: "M2 Growth", subKr: "M2SL YoY", subEn: "M2SL YoY" },
  SOFR_SPREAD:  { labelKr: "SOFR 스프레드", labelEn: "SOFR Spread", subKr: "SOFR - Fed Funds", subEn: "SOFR - Fed Funds" },
  BAMLH0A0HYM2: { labelKr: "HY 신용 스프레드", labelEn: "HY Credit Spread", subKr: "ICE BofA HY OAS", subEn: "ICE BofA HY OAS" },
  DXY:          { labelKr: "DXY 달러", labelEn: "DXY Dollar", subKr: "달러인덱스", subEn: "Dollar Index" },
};

const EXPLAINER_CONTENT = [
  {
    id: "WALCL",
    headline: "연준이 시장에 풀어놓은 돈의 총량",
    headlineEn: "Total money the Fed has injected into markets",
    explanation: "연준이 국채·MBS를 사들이며 시장에 공급한 돈의 합계. 2020년 코로나 이후 $4조→$9조로 급등했다가 2022년부터 QT로 축소 중이다.",
    explanationEn: "Sum of bonds/MBS the Fed purchased to inject liquidity. Surged from $4T to $9T post-COVID, now shrinking via QT since 2022.",
    upLabel: "유동성 공급 확대 → 주식·원자재·코인 상승 압력",
    upLabelEn: "Expanding liquidity → upward pressure on stocks, commodities, crypto",
    downLabel: "유동성 회수 → 자산 가격 하락 압력",
    downLabelEn: "Liquidity withdrawal → downward pressure on asset prices",
  },
  {
    id: "RRPONTSYD",
    headline: "시장에 풀렸지만 아직 쓰이지 않은 대기 자금",
    headlineEn: "Idle cash parked at the Fed overnight",
    explanation: "MMF가 갈 곳 없는 돈을 연준에 하루짜리로 맡겨두는 계좌. 2022~2023년 $2.5조까지 쌓였다가 현재 거의 소진됐다.",
    explanationEn: "Money market funds park excess cash at the Fed overnight. Peaked at $2.5T in 2022-2023, now nearly depleted.",
    upLabel: "유동성 버퍼 축적, 아직 시장 미투입",
    upLabelEn: "Buffer building, not yet deployed to markets",
    downLabel: "버퍼 자금이 시장으로 이동 (긍정적) → 고갈 후엔 은행 지준 직접 감소",
    downLabelEn: "Buffer flowing to markets (positive) → after depletion, bank reserves shrink directly",
  },
  {
    id: "WTREGEN",
    headline: "미국 정부의 당좌통장 — 잔고가 늘면 시장 돈이 준다",
    headlineEn: "US Treasury's checking account — rising balance drains market liquidity",
    explanation: "미국 재무부가 연준에 가진 당좌예금. 국채 발행 시 TGA 증가(시중 흡수), 정부 지출 시 TGA 감소(시중 공급). 부채한도 협상마다 급변한다.",
    explanationEn: "Treasury's deposit at the Fed. Bond issuance increases TGA (drains cash), spending decreases TGA (injects cash). Swings wildly around debt ceiling deals.",
    upLabel: "국채 발행 증가 → 시중 유동성 흡수 (부정적)",
    upLabelEn: "More bond issuance → drains market liquidity (negative)",
    downLabel: "정부 지출 증가 → 시중에 돈 공급 (긍정적)",
    downLabelEn: "More government spending → injects cash into markets (positive)",
  },
  {
    id: "WRESBAL",
    headline: "최종 결과값 — 실제로 시장에 돌아다니는 돈",
    headlineEn: "The final result — actual money circulating in markets",
    explanation: "위 세 지표의 최종 합산. 공식: 지준 = Fed B/S - RRP - TGA. 이게 줄면 은행 대출이 조여지기 시작한다. 2019 repo 위기, 2023 SVB 사태 모두 지준 급감이 트리거였다.",
    explanationEn: "Net result of the three indicators above. Formula: Reserves = Fed B/S - RRP - TGA. When this shrinks, bank lending tightens. Both the 2019 repo crisis and 2023 SVB collapse were triggered by reserve depletion.",
    upLabel: "은행 대출 여력 확대 → 실물·자산시장 긍정적",
    upLabelEn: "More bank lending capacity → positive for real economy & assets",
    downLabel: "대출 축소, 유동성 경색 → $2.5조 이하 시 위험",
    downLabelEn: "Lending contraction, liquidity crunch → danger zone below $2.5T",
  },
];

const LIQ_MAX = 7200;
const LIQ_MIN = 3200;

type TimeRange = "3M" | "6M" | "1Y" | "3Y" | "5Y";
const TIME_RANGES: TimeRange[] = ["3M", "6M", "1Y", "3Y", "5Y"];
const RANGE_MONTHS: Record<TimeRange, number> = { "3M": 3, "6M": 6, "1Y": 12, "3Y": 36, "5Y": 60 };

interface Indicator {
  id: string;
  label: string;
  labelKr: string;
  displayValue: string;
  trend: "up" | "down" | "flat";
  changePercent: number;
  status: string;
  statusLevel: "normal" | "warning" | "critical";
}

const i18n = {
  en: {
    title: "LIQUIDITY NAVIGATOR",
    subtitle: "Fed Liquidity → Asset Allocation Signal",
    fedDashboard: "FED LIQUIDITY DASHBOARD",
    loading: "Loading liquidity data...",
    live: "LIVE",
    asOf: "as of",
    liqScore: "Liquidity Score",
    upWhen: "When rising:",
    downWhen: "When falling:",
    globalLiq: "GLOBAL LIQUIDITY INDICATORS",
    explainerTitle: "Indicator Guide",
  },
  kr: {
    title: "LIQUIDITY NAVIGATOR",
    subtitle: "연준 유동성 → 자산배분 신호",
    fedDashboard: "연준 유동성 대시보드",
    loading: "유동성 데이터 로딩 중...",
    live: "LIVE",
    asOf: "기준",
    liqScore: "유동성 점수",
    upWhen: "↑ 증가 시:",
    downWhen: "↓ 감소 시:",
    globalLiq: "글로벌 유동성 지표",
    explainerTitle: "지표 설명",
  },
};
type LangKey = "en" | "kr";

// ── Liquidity Framework (collapsible) ─────────────────────

const FRAMEWORK_INDICATORS = [
  {
    num: "\u2460",
    title: "연준 대차대조표 (WALCL)",
    titleEn: "Fed Balance Sheet (WALCL)",
    body: "연준이 보유한 자산의 총합. QE(양적완화) 시 국채\u00b7MBS를 매입해 시장에 본원통화를 직접 공급하며, QT(양적긴축) 시 만기 채권 미재투자로 자연 감소한다. 유동성의 최상위 원천(Source)으로, 모든 유동성 분석의 출발점이 된다.",
    bodyEn: "Total assets held by the Fed. Expands via QE (buying Treasuries/MBS) to inject base money directly, contracts during QT as maturing bonds are not reinvested. The ultimate source of liquidity and the starting point of all liquidity analysis.",
  },
  {
    num: "\u2461",
    title: "역레포 RRP (RRPONTSYD)",
    titleEn: "Reverse Repo RRP (RRPONTSYD)",
    body: "MMF 등 금융기관이 연준에 단기 예치하는 자금. 시중에 유동성이 넘칠 때 이 곳으로 흘러들어 \u201c잠기는\u201d 버퍼 역할을 한다. RRP 잔고 감소 = 잠긴 유동성이 시장으로 방출되는 신호. 반대로 RRP가 고갈되면 추가적인 유동성 완충재가 사라진다.",
    bodyEn: "Cash parked at the Fed by MMFs overnight. Acts as a buffer that \u201clocks up\u201d excess liquidity. RRP decline = locked liquidity released to markets. When RRP is depleted, no further liquidity buffer remains.",
  },
  {
    num: "\u2462",
    title: "TGA 재무부계좌 (WTREGEN)",
    titleEn: "Treasury General Account (WTREGEN)",
    body: "미 재무부가 연준에 보유한 당좌계좌. 세금 수입\u00b7국채 발행 시 잔고 증가 \u2192 시중 유동성 흡수. 재정 지출 시 잔고 감소 \u2192 시중 유동성 방출. 부채한도 협상 국면에서 TGA 급감 시 단기적 유동성 급증 효과가 발생한다.",
    bodyEn: "Treasury\u2019s checking account at the Fed. Increases with tax revenue/bond issuance (drains liquidity), decreases with spending (releases liquidity). During debt ceiling negotiations, TGA can plunge causing temporary liquidity surges.",
  },
  {
    num: "\u2463",
    title: "은행 지급준비금 (WRESBAL)",
    titleEn: "Bank Reserves (WRESBAL)",
    body: "유동성 순환의 최종 결과물. 연준 대차대조표에서 RRP와 TGA를 차감한 잔여분이 은행 시스템 내 지준으로 귀결된다: 지준 = WALCL - RRP - TGA. 지준이 과도하게 감소하면 단기 자금시장(레포) 경색이 발생할 수 있다.",
    bodyEn: "The final output of liquidity circulation. Reserves = WALCL - RRP - TGA. When reserves decline excessively, short-term funding markets (repo) can seize up, creating systemic stress.",
  },
  {
    num: "\u2464",
    title: "M2 증가율 (M2SL YoY)",
    titleEn: "M2 Growth Rate (M2SL YoY)",
    body: "시중에 존재하는 통화량(현금+예금+MMF)의 전년 대비 증가율. M2 증가 \u2192 자산 가격 상승 압력 / M2 감소 \u2192 자산 가격 조정 압력. 연준 대차대조표보다 시차를 두고 실물경제와 자산시장에 반영된다.",
    bodyEn: "Year-over-year growth of broad money supply (cash + deposits + MMFs). M2 up = asset price pressure up / M2 down = correction pressure. Affects the real economy and asset markets with a lag relative to the Fed\u2019s balance sheet.",
  },
  {
    num: "\u2465",
    title: "SOFR 스프레드 (SOFR - FEDFUNDS)",
    titleEn: "SOFR Spread (SOFR - FEDFUNDS)",
    body: "무담보 익일물 금리(SOFR)와 연준 기준금리의 차이. 정상 시장에서는 0~5bp 수준을 유지한다. 스프레드 급확대 = 단기 자금시장의 긴장\u00b7경색 신호로 해석한다.",
    bodyEn: "Spread between the overnight SOFR rate and the Fed Funds rate. Normal range is 0\u20135bp. A sharp widening signals stress or tightness in short-term funding markets.",
  },
  {
    num: "\u2466",
    title: "HY 신용 스프레드 (ICE BofA HY OAS)",
    titleEn: "HY Credit Spread (ICE BofA HY OAS)",
    body: "하이일드(투기등급) 채권과 국채 간의 금리 차이. 시장의 신용 위험 인식과 공포 수준을 나타내는 온도계. 스프레드 축소 = 위험선호 / 스프레드 확대 = 위험회피\u00b7경기침체 우려. 300bp 이하는 완화적, 500bp 이상은 위험 구간으로 본다.",
    bodyEn: "Yield spread between high-yield (speculative-grade) bonds and Treasuries. A thermometer for credit risk perception. Narrowing = risk-on / widening = risk-off, recession fears. Below 300bp is accommodative; above 500bp signals danger.",
  },
  {
    num: "\u2467",
    title: "DXY 달러인덱스",
    titleEn: "DXY Dollar Index",
    body: "주요 6개 통화 대비 달러의 상대적 강도. 달러 강세 = 글로벌 유동성 긴축 효과 (신흥국 부채 부담 증가, 원자재 하락). 달러 약세 = 글로벌 유동성 완화 효과 (위험자산 선호, 원자재 상승). 달러는 글로벌 유동성의 최종 전달 벨트 역할을 한다.",
    bodyEn: "Dollar\u2019s relative strength vs 6 major currencies. Strong dollar = global liquidity tightening (higher EM debt burden, commodity pressure). Weak dollar = global easing (risk-on, commodity rally). The dollar acts as the final transmission belt of global liquidity.",
  },
];

const FLOW_STEPS = [
  { label: "연준 QE/QT 결정", labelEn: "Fed QE/QT Decision", desc: "유동성 공급·회수의 최상위 정책 결정", descEn: "Top-level policy decision on liquidity supply/withdrawal" },
  { label: "WALCL", labelEn: "WALCL", desc: "유동성의 원천 공급량 결정", descEn: "Determines source liquidity supply" },
  { label: "RRP \u00b7 TGA", labelEn: "RRP \u00b7 TGA", desc: "실질 유동성 흡수 또는 방출", descEn: "Absorbs or releases effective liquidity" },
  { label: "은행 지준", labelEn: "Bank Reserves", desc: "금융시스템 내 최종 유동성", descEn: "Final liquidity in the financial system" },
  { label: "M2 증가율", labelEn: "M2 Growth", desc: "실물경제\u00b7자산시장 파급", descEn: "Transmission to real economy & asset markets" },
  { label: "SOFR 스프레드", labelEn: "SOFR Spread", desc: "단기자금 긴장도 반영", descEn: "Reflects short-term funding stress" },
  { label: "HY 스프레드", labelEn: "HY Spread", desc: "신용시장 리스크 반영", descEn: "Reflects credit market risk" },
  { label: "DXY", labelEn: "DXY", desc: "글로벌 유동성 전파", descEn: "Global liquidity transmission" },
];

function LiquidityFramework({ lang }: { lang: LangKey }) {
  const [isOpen, setIsOpen] = useState(false);
  const kr = lang === "kr";

  return (
    <div
      className="rounded-lg font-[family-name:var(--font-jetbrains)]"
      style={{ background: B.card, border: `1px solid ${B.border}` }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 cursor-pointer transition-colors hover:bg-white/[0.02]"
      >
        <div className="text-left">
          <p className="text-[13px] font-bold uppercase tracking-[0.15em]" style={{ color: B.white }}>
            LIQUIDITY FRAMEWORK
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: B.muted }}>
            {kr ? "8개 핵심 지표의 메커니즘과 상호 연결 구조" : "Mechanisms & interconnections of 8 core indicators"}
          </p>
        </div>
        <span className="text-[11px] shrink-0 ml-4" style={{ color: B.subtle }}>
          {isOpen ? (kr ? "\u25b2 접기" : "\u25b2 Collapse") : (kr ? "\u25bc 펼치기" : "\u25bc Expand")}
        </span>
      </button>

      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: isOpen ? 5000 : 0, opacity: isOpen ? 1 : 0 }}
      >
        <div className="px-5 pb-5 space-y-6" style={{ borderTop: `1px solid ${B.divider}` }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4">
            {FRAMEWORK_INDICATORS.map((ind) => (
              <div
                key={ind.num}
                className="rounded px-4 py-3"
                style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${B.divider}` }}
              >
                <p className="text-[12px] font-bold mb-1.5" style={{ color: B.white }}>
                  <span style={{ color: "#f59e0b" }}>{ind.num}</span>{" "}
                  {kr ? ind.title : ind.titleEn}
                </p>
                <p className="text-[11px] leading-[1.7]" style={{ color: B.subtle }}>
                  {kr ? ind.body : ind.bodyEn}
                </p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
              {kr ? "유동성 전달 경로" : "LIQUIDITY TRANSMISSION PATH"}
            </p>
            <div className="rounded overflow-hidden" style={{ border: `1px solid ${B.divider}` }}>
              {FLOW_STEPS.map((step, i) => (
                <div key={i}>
                  <div
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ background: "rgba(255,255,255,0.03)", borderBottom: i < FLOW_STEPS.length - 1 ? `1px solid rgba(255,255,255,0.08)` : "none" }}
                  >
                    <span className="shrink-0 w-[140px] text-[12px] font-mono font-bold" style={{ color: "#f59e0b" }}>
                      {kr ? step.label : step.labelEn}
                    </span>
                    <span className="text-[11px] shrink-0" style={{ color: "rgba(255,255,255,0.25)" }}>
                      {"\u2192"}
                    </span>
                    <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.7)" }}>
                      {kr ? step.desc : step.descEn}
                    </span>
                  </div>
                  {i < FLOW_STEPS.length - 1 && i < 4 && (
                    <div className="flex justify-start pl-[72px]">
                      <span className="text-[11px] leading-none" style={{ color: "rgba(255,255,255,0.2)" }}>
                        {"\u2193"}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div
            className="rounded px-4 py-4"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.2)" }}
          >
            <p className="text-[10px] uppercase tracking-[0.15em] mb-2 font-bold" style={{ color: "#f59e0b" }}>
              {kr ? "핵심 인사이트" : "KEY INSIGHT"}
            </p>
            <p className="text-[12px] leading-[1.9]" style={{ color: "rgba(255,255,255,0.75)" }}>
              {kr
                ? "연준의 대차대조표가 유동성의 원천을 결정하고, RRP와 TGA는 그 유동성이 시장에 얼마나 흘러드는지를 조절하는 밸브다. 은행 지준은 이 모든 흐름의 최종 결과물이며, M2\u00b7SOFR\u00b7HY스프레드\u00b7달러는 유동성이 실물경제와 글로벌 시장으로 전파되는 과정을 실시간으로 반영한다. 8개 지표를 함께 보면 지금 시장이 유동성 팽창 국면인지, 수축 국면인지를 판단할 수 있다."
                : "The Fed\u2019s balance sheet determines the source of liquidity, while RRP and TGA act as valves controlling how much flows into markets. Bank reserves are the final output of this entire flow. M2, SOFR spread, HY spread, and the dollar reflect in real time how liquidity transmits to the real economy and global markets. Viewing all 8 indicators together reveals whether markets are in a liquidity expansion or contraction phase."
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Explainer Modal ──────────────────────────────────────────

function ExplainerModal({ open, onClose, indicators, lang }: {
  open: boolean;
  onClose: () => void;
  indicators: Indicator[];
  lang: LangKey;
}) {
  const kr = lang === "kr";
  const tx = i18n[lang];
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="relative max-w-[800px] w-full max-h-[80vh] overflow-y-auto rounded-lg p-6 font-[family-name:var(--font-jetbrains)]"
        style={{ background: B.bg, border: `1px solid rgba(255,255,255,0.15)`, scrollbarWidth: "thin", scrollbarColor: "#333 transparent" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-sm transition-colors"
          style={{ color: "rgba(255,255,255,0.5)", border: `1px solid ${B.border}` }}
        >
          ✕
        </button>

        <h3 className="text-sm font-bold mb-5" style={{ color: B.white }}>
          {tx.explainerTitle}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EXPLAINER_CONTENT.map((card) => {
            const cfg = INDICATOR_CHART_CONFIG[card.id];
            const ind = indicators.find((i) => i.id === card.id);
            if (!cfg) return null;
            return (
              <div
                key={card.id}
                className="rounded-lg px-4 py-4"
                style={{ background: B.card, border: `1px solid ${B.border}`, borderLeft: `2px solid rgba(255,255,255,0.3)` }}
              >
                <p className="text-[12px] font-bold uppercase tracking-wider mb-2" style={{ color: B.subtle }}>
                  {kr ? cfg.labelKr : cfg.labelEn}
                </p>
                <p className="text-[13px] font-semibold mb-2 leading-snug" style={{ color: B.white }}>
                  {kr ? card.headline : card.headlineEn}
                </p>
                <p className="text-[11px] leading-5 mb-2" style={{ color: B.subtle }}>
                  {kr ? card.explanation : card.explanationEn}
                </p>
                <div style={{ borderTop: `1px solid ${B.divider}`, margin: "0 0 8px 0" }} />
                <div className="space-y-1">
                  <p className="text-[11px] leading-5" style={{ color: B.subtle }}>
                    <span style={{ color: B.muted }}>{tx.upWhen}</span> {kr ? card.upLabel : card.upLabelEn}
                  </p>
                  <p className="text-[11px] leading-5" style={{ color: B.subtle }}>
                    <span style={{ color: B.muted }}>{tx.downWhen}</span> {kr ? card.downLabel : card.downLabelEn}
                  </p>
                </div>
                {ind && (
                  <>
                    <div style={{ borderTop: `1px solid ${B.divider}`, margin: "8px 0" }} />
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] tabular-nums" style={{ color: B.white }}>
                        {kr ? "현재" : "Current"}: {ind.displayValue}
                      </span>
                      <span className="text-[10px] uppercase" style={{ color: B.subtle }}>{ind.status}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Shared chart card ────────────────────────────────────────

function ChartCard({
  labelKr, labelEn, sub, status, displayValue, changeStr, trendColor,
  chartPoints, chartId, selectedRange, lang, delay,
}: {
  labelKr: string; labelEn: string; sub?: string; status: string;
  displayValue: string; changeStr: string; trendColor: string;
  chartPoints: { date: string; value: number }[];
  chartId: string; selectedRange: TimeRange; lang: LangKey; delay: number;
}) {
  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay, duration: 0.3 }}
      className="rounded-lg overflow-hidden"
      style={{ background: B.card, border: `1px solid ${B.border}` }}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <div>
          <p className="text-[13px] font-bold font-[family-name:var(--font-jetbrains)]" style={{ color: B.white }}>
            {lang === "kr" ? labelKr : labelEn}
          </p>
          <p className="text-[10px] font-[family-name:var(--font-jetbrains)] uppercase tracking-wider" style={{ color: B.muted }}>
            {sub || chartId}
          </p>
        </div>
        <span className="text-[10px] font-bold font-[family-name:var(--font-jetbrains)] uppercase tracking-wider" style={{ color: B.subtle }}>
          {status}
        </span>
      </div>

      <div style={{ height: 140 }}>
        {chartPoints.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartPoints} margin={{ top: 5, right: 8, left: 8, bottom: 16 }}>
              <defs>
                <linearGradient id={`grad-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={B.white} stopOpacity={0.05} />
                  <stop offset="100%" stopColor={B.white} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: B.dim, fontSize: 9, fontFamily: "var(--font-jetbrains)" }}
                tickFormatter={(v: string) => {
                  if (selectedRange === "3M" || selectedRange === "6M") return v.slice(5).replace("-", ".");
                  if (selectedRange === "5Y") return v.slice(0, 4);
                  return v.slice(2, 7).replace("-", ".");
                }}
                interval="preserveStartEnd"
                minTickGap={40}
                axisLine={false}
                tickLine={false}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={B.chartLine}
                strokeWidth={1.5}
                fill={`url(#grad-${chartId})`}
                dot={false}
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-[11px] font-[family-name:var(--font-jetbrains)]" style={{ color: B.dim }}>Loading...</span>
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between px-4 pb-3 pt-1">
        <span className="text-[20px] font-bold tabular-nums font-[family-name:var(--font-jetbrains)]" style={{ color: B.white }}>
          {displayValue}
        </span>
        <span className="text-[11px] font-bold tabular-nums font-[family-name:var(--font-jetbrains)]" style={{ color: trendColor }}>
          {changeStr}
        </span>
      </div>
    </motion.div>
  );
}

// ── Main Component ──────────────────────────────────────────────
export default function LiquidityDashboard() {
  const { lang } = useLang();
  const currentLang: LangKey = lang === "kr" ? "kr" : "en";
  const tx = i18n[currentLang];

  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [extIndicators, setExtIndicators] = useState<Indicator[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [explainerOpen, setExplainerOpen] = useState(false);

  const [fredSeriesFull, setFredSeriesFull] = useState<Record<string, { date: string; value: number }[]>>({});
  const [selectedRange, setSelectedRange] = useState<TimeRange>("1Y");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/liquidity", { signal: AbortSignal.timeout(40000) });
      const json = await res.json();
      if (json.ok) {
        setIndicators(json.indicators);
        if (json.extendedIndicators) setExtIndicators(json.extendedIndicators);
        setUpdatedAt(json.updatedAt);
        setStale(!!json.stale);
      }
    } catch {
      setStale(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFredChartData = useCallback(async () => {
    try {
      const res = await fetch("/api/macro/fred", { signal: AbortSignal.timeout(30000) });
      const json = await res.json();
      if (json.ok && json.series) {
        const chartSeries: Record<string, { date: string; value: number }[]> = {};
        const ids = ["WALCL", "RRPONTSYD", "WTREGEN", "WRESBAL", "M2_YOY", "SOFR_SPREAD", "BAMLH0A0HYM2", "DXY"];
        for (const id of ids) {
          const s = json.series[id];
          if (s?.observations) {
            chartSeries[id] = s.observations as { date: string; value: number }[];
          }
        }
        setFredSeriesFull(chartSeries);
      }
    } catch { /* ok */ }
  }, []);

  useEffect(() => {
    fetchAll();
    fetchFredChartData();
  }, [fetchAll, fetchFredChartData]);

  const updatedTimeStr = updatedAt
    ? new Date(updatedAt).toLocaleString("ko-KR", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul",
      }) + " KST"
    : "";

  const fredSeries = useMemo(() => {
    const months = RANGE_MONTHS[selectedRange];
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const filtered: Record<string, { date: string; value: number }[]> = {};
    for (const [id, obs] of Object.entries(fredSeriesFull)) {
      filtered[id] = obs.filter((p) => p.date >= cutoffStr);
    }
    return filtered;
  }, [fredSeriesFull, selectedRange]);

  const liqScore = useMemo(() => {
    if (indicators.length === 0) return null;
    const parseVal = (id: string): number => {
      const ind = indicators.find((i) => i.id === id);
      if (!ind) return 0;
      const v = ind.displayValue.replace(/[^0-9.]/g, "");
      const num = parseFloat(v) || 0;
      if (ind.displayValue.includes("T")) return num * 1000;
      if (ind.displayValue.includes("B")) return num;
      return num;
    };
    const walcl = parseVal("WALCL");
    const rrp = parseVal("RRPONTSYD");
    const tga = parseVal("WTREGEN");
    const effective = walcl - rrp - tga;
    const score = Math.round(Math.min(100, Math.max(0, ((effective - LIQ_MIN) / (LIQ_MAX - LIQ_MIN)) * 100)));
    const label = score > 70 ? "LIQUIDITY RICH" : score > 50 ? "NEUTRAL" : score > 30 ? "TIGHTENING" : "LIQUIDITY CRISIS";
    return { score, label };
  }, [indicators]);

  return (
    <div className="space-y-8">
      {/* ── Page Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1
            className="text-2xl font-bold uppercase tracking-[0.2em] font-[family-name:var(--font-rajdhani)]"
            style={{ color: B.white }}
          >
            {tx.title}
          </h1>
          <p className="text-[14px] mt-1 font-[family-name:var(--font-jetbrains)]" style={{ color: B.muted, letterSpacing: "0.05em" }}>
            {tx.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {updatedTimeStr && (
            <span className="text-[12px] font-[family-name:var(--font-jetbrains)]" style={{ color: B.dim }}>
              {updatedTimeStr} {tx.asOf}
            </span>
          )}
          {stale ? (
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded font-[family-name:var(--font-jetbrains)] uppercase flex items-center gap-1.5"
              style={{ color: B.subtle, border: `1px solid ${B.border}` }}
            >
              {currentLang === "kr" ? "연결 중" : "CONNECTING"}
            </span>
          ) : (
            <span
              className="text-[11px] font-bold px-2 py-0.5 rounded font-[family-name:var(--font-jetbrains)] uppercase flex items-center gap-1.5"
              style={{ color: B.subtle, border: `1px solid ${B.border}` }}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: B.green }} />
              {tx.live}
            </span>
          )}
        </div>
      </div>

      <LiquidityFramework lang={currentLang} />

      {loading && (
        <div className="py-12 text-center">
          <div className="inline-block w-8 h-8 rounded-full border-2 border-t-transparent mb-4" style={{ borderColor: `${B.muted} transparent ${B.muted} ${B.muted}`, animation: "spin 1s linear infinite" }} />
          <p className="text-[14px] font-[family-name:var(--font-jetbrains)]" style={{ color: B.muted }}>{tx.loading}</p>
        </div>
      )}

      {!loading && (
        <>
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2
                className="text-[13px] uppercase tracking-[0.15em] font-bold font-[family-name:var(--font-jetbrains)]"
                style={{ color: B.muted }}
              >
                {tx.fedDashboard}
              </h2>
              <button
                onClick={() => setExplainerOpen(true)}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-colors hover:text-white/70 hover:border-white/40"
                style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.2)" }}
                title={currentLang === "kr" ? "지표 설명" : "Indicator guide"}
              >
                ?
              </button>
            </div>

            <div className="flex gap-1 mb-4">
              {TIME_RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedRange(r)}
                  className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider font-[family-name:var(--font-jetbrains)] rounded transition-colors"
                  style={{
                    color: selectedRange === r ? B.white : B.muted,
                    borderBottom: selectedRange === r ? `2px solid ${B.white}` : "2px solid transparent",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>

            {liqScore && (
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0, duration: 0.3 }}
                className="mb-4 rounded-lg px-5 py-3 flex items-center gap-4 font-[family-name:var(--font-jetbrains)]"
                style={{ background: B.card, border: `1px solid ${B.border}` }}
              >
                <span className="text-[10px] uppercase tracking-[0.15em] shrink-0" style={{ color: B.muted }}>
                  {tx.liqScore}
                </span>
                <span className="text-lg font-bold tabular-nums" style={{ color: B.white }}>
                  {liqScore.score}
                </span>
                <span className="text-sm tabular-nums" style={{ color: "rgba(255,255,255,0.3)" }}>
                  /100
                </span>
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: B.subtle }}>
                  {liqScore.label}
                </span>
                <div className="relative flex-1 min-w-[80px]">
                  <div className="h-[3px] rounded-full" style={{ background: B.barTrack }}>
                    <div className="h-full rounded-full" style={{ width: `${liqScore.score}%`, background: B.barFill }} />
                  </div>
                  <div
                    className="absolute top-1/2 w-2.5 h-2.5 rounded-full border-2"
                    style={{
                      left: `${liqScore.score}%`,
                      transform: "translate(-50%, -50%)",
                      background: B.white,
                      borderColor: B.card,
                    }}
                  />
                </div>
              </motion.div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {indicators.map((ind, i) => {
                const cfg = INDICATOR_CHART_CONFIG[ind.id];
                if (!cfg) return null;
                const chartPoints = fredSeries[ind.id] || [];
                const changeStr = `${ind.trend === "up" ? "+" : ind.trend === "down" ? "" : ""}${ind.changePercent.toFixed(1)}% 1W`;
                return (
                  <ChartCard
                    key={ind.id}
                    labelKr={cfg.labelKr}
                    labelEn={cfg.labelEn}
                    sub={ind.id}
                    status={ind.status}
                    displayValue={ind.displayValue}
                    changeStr={changeStr}
                    trendColor={ind.trend === "up" ? B.green : ind.trend === "down" ? B.red : B.muted}
                    chartPoints={chartPoints}
                    chartId={ind.id}
                    selectedRange={selectedRange}
                    lang={currentLang}
                    delay={i * 0.08}
                  />
                );
              })}
            </div>

            <h2
              className="text-[10px] uppercase tracking-[0.2em] font-bold mt-8 mb-4 font-[family-name:var(--font-jetbrains)]"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              {tx.globalLiq}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(["M2_YOY", "SOFR_SPREAD", "BAMLH0A0HYM2", "DXY"] as const).map((extId, i) => {
                const cfg = EXTENDED_CHART_CONFIG[extId];
                if (!cfg) return null;

                const extKey = extId === "BAMLH0A0HYM2" ? "HY_SPREAD" : extId;
                const ind = extIndicators.find((e) => e.id === extKey);

                const chartPoints = fredSeries[extId] || [];

                const displayValue = ind?.displayValue || "—";
                const status = ind?.status || "—";
                const trend = ind?.trend || "flat";
                const changePct = ind?.changePercent ?? 0;
                const changeStr = `${trend === "up" ? "+" : trend === "down" ? "" : ""}${changePct.toFixed(1)}% 1W`;

                return (
                  <ChartCard
                    key={extId}
                    labelKr={cfg.labelKr}
                    labelEn={cfg.labelEn}
                    sub={currentLang === "kr" ? cfg.subKr : cfg.subEn}
                    status={status}
                    displayValue={displayValue}
                    changeStr={changeStr}
                    trendColor={trend === "up" ? B.green : trend === "down" ? B.red : B.muted}
                    chartPoints={chartPoints}
                    chartId={extId}
                    selectedRange={selectedRange}
                    lang={currentLang}
                    delay={0.35 + i * 0.08}
                  />
                );
              })}
            </div>
          </section>
        </>
      )}

      <ExplainerModal
        open={explainerOpen}
        onClose={() => setExplainerOpen(false)}
        indicators={indicators}
        lang={currentLang}
      />

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
