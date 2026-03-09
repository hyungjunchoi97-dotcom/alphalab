"use client";

import { useState, useRef, useCallback, useEffect, Fragment } from "react";
import AppHeader from "@/components/AppHeader";
import { useRequireAuth } from "@/hooks/useRequireAuth";

// ── SEPA Screener types ────────────────────────────────────────
interface ScreenerResult {
  symbol: string;
  name: string;
  market: "KR" | "US";
  price: number;
  change_pct: number;
  score: number;
  stage: "STAGE_2";
  base_depth_pct: number;
  weeks_in_base: number;
  volume_ratio: number;
  dist_from_52w_high_pct: number;
  ma_alignment: boolean;
}

interface AnalysisResult {
  signal: "BUY" | "HOLD" | "SELL";
  stage: string | null;
  pattern: string;
  pattern_detail: string;
  volume_character: string | null;
  pivot: number | null;
  entry: number | null;
  target: number | null;
  stop: number | null;
  rr_ratio: number | null;
  interpretation: string;
  conviction: "HIGH" | "MEDIUM" | "LOW";
  minervini_score: number | null;
}

function convictionPercent(level: string): number {
  if (level === "HIGH") return 85;
  if (level === "MEDIUM") return 55;
  return 25;
}

function formatPrice(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString();
}

function stageBadgeColor(stage: string): string {
  if (stage === "STAGE_2") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  if (stage === "STAGE_4") return "bg-red-500/20 text-red-400 border-red-500/30";
  return "bg-[#222] text-[#888] border-[#333]";
}

function stageLabel(stage: string): string {
  return stage.replace("_", " ");
}

function volumeBadgeColor(vol: string): string {
  if (vol === "CONSTRUCTIVE") return "bg-green-500/20 text-green-400 border-green-500/30";
  if (vol === "BREAKOUT_VOLUME") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  if (vol === "CLIMACTIC") return "bg-red-500/20 text-red-400 border-red-500/30";
  return "bg-[#222] text-[#666] border-[#333]";
}

function volumeLabel(vol: string): string {
  return vol.replace("_", " ");
}

// Symbol counts for loading display
const KR_SYMBOLS_COUNT = 50;
const US_SYMBOLS_COUNT = 133;

export default function AiTradingPage() {
  const requireAuth = useRequireAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<"chart" | "screener">("chart");

  // Chart analysis state
  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileObjRef = useRef<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  // Screener state
  const [screenerMarket, setScreenerMarket] = useState<"ALL" | "KR" | "US">("ALL");
  const [screenerResults, setScreenerResults] = useState<ScreenerResult[]>([]);
  const [screenerLoading, setScreenerLoading] = useState(false);
  const [screenerError, setScreenerError] = useState<string | null>(null);
  const [screenerUpdatedAt, setScreenerUpdatedAt] = useState<string | null>(null);
  const [screenerCached, setScreenerCached] = useState(false);
  const [screenerStats, setScreenerStats] = useState<{ kr_scanned: number; us_scanned: number; total_scanned: number; passed: number } | null>(null);
  const [screenerPrompt, setScreenerPrompt] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const fetchScreener = useCallback(async (market: string, refresh = false) => {
    setScreenerLoading(true);
    setScreenerError(null);
    try {
      const res = await fetch(`/api/ai/sepa-screener?market=${market}${refresh ? "&refresh=true" : ""}`);
      const json = await res.json();
      if (json.ok) {
        setScreenerResults(json.results);
        setScreenerUpdatedAt(json.updated_at);
        setScreenerCached(json.cached ?? false);
        setScreenerStats(json.stats ?? null);
      } else {
        setScreenerError(json.error || "Failed to fetch screener data");
      }
    } catch (err) {
      setScreenerError(err instanceof Error ? err.message : "Network error");
    } finally {
      setScreenerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "screener" && screenerResults.length === 0 && !screenerLoading) {
      fetchScreener(screenerMarket);
    }
  }, [activeTab, screenerResults.length, screenerLoading, screenerMarket, fetchScreener]);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    fileObjRef.current = file;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setImage(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    },
    [handleFile]
  );

  const handleAnalyze = async () => {
    if (!fileObjRef.current) {
      setError("Please upload a chart image first");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("image", fileObjRef.current);

      const res = await fetch("/api/ai/analyze-chart", {
        method: "POST",
        body: fd,
      });

      const json = await res.json();
      if (json.ok && json.data) {
        console.log("[AI Analysis Result]", json.data);
        setResult(json.data);
      } else {
        setError(json.error || json.raw || "Failed to parse AI response");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !!image && !!fileObjRef.current;

  return (
    <div className="min-h-screen bg-background" onPaste={onPaste}>
      <AppHeader active="aiTrading" />

      <main className="mx-auto max-w-[1400px] px-4 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            AI Technical Analysis
          </h1>
          <p className="mt-1 text-sm text-[#888]">
            Minervini SEPA / O&apos;Neil CAN SLIM / Weinstein Stage Analysis
          </p>
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-0 mb-8 border-b border-[#1a1a1a]">
          {([
            { key: "chart" as const, label: "CHART ANALYSIS" },
            { key: "screener" as const, label: "SEPA SCREENER" },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-3 text-xs font-bold tracking-widest transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? "text-amber-400 border-amber-500"
                  : "text-[#555] border-transparent hover:text-[#888]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "chart" && (
        <>
        {/* Screener prompt banner */}
        {screenerPrompt && (
          <div className="mb-4 flex items-center justify-between border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <p className="text-xs font-mono text-amber-400">{screenerPrompt}</p>
            <button
              onClick={() => setScreenerPrompt(null)}
              className="text-[#555] hover:text-foreground transition-colors ml-3"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {/* ── ANALYSIS METHODOLOGY ── */}
        <div className="mb-8 space-y-4">
          {/* Three-step pipeline */}
          <div className="flex flex-col md:flex-row items-stretch gap-0">
            {/* STEP 01 */}
            <div className="flex-1 border border-[#1a1a1a] bg-[#0a0a0a] p-4">
              <p className="text-[9px] font-mono uppercase tracking-widest text-[#555] mb-1">STEP 01 / STAGE FILTER</p>
              <p className="text-xs font-bold text-foreground tracking-wide mb-1.5">WEINSTEIN STAGE ANALYSIS</p>
              <p className="text-[10px] font-mono text-[#777] leading-relaxed mb-2">30주 이동평균선 기준 현재 사이클 위치 판별</p>
              <p className="text-[10px] font-mono text-amber-500">Stage 2 미충족 시 → 즉시 HOLD 판정</p>
            </div>
            {/* Arrow */}
            <div className="flex items-center justify-center py-1 md:py-0 md:px-0">
              <span className="text-amber-500 font-mono text-sm md:rotate-0 rotate-90 select-none">→</span>
            </div>
            {/* STEP 02 */}
            <div className="flex-1 border border-[#1a1a1a] bg-[#0a0a0a] p-4">
              <p className="text-[9px] font-mono uppercase tracking-widest text-[#555] mb-1">STEP 02 / PATTERN VALIDATION</p>
              <p className="text-xs font-bold text-foreground tracking-wide mb-1.5">O&apos;NEIL CAN SLIM</p>
              <p className="text-[10px] font-mono text-[#777] leading-relaxed mb-2">베이스 패턴 유효성 · 피벗 포인트 · 돌파 거래량 검증</p>
              <p className="text-[10px] font-mono text-amber-500">거래량 미동반 돌파 → 무효 시그널</p>
            </div>
            {/* Arrow */}
            <div className="flex items-center justify-center py-1 md:py-0 md:px-0">
              <span className="text-amber-500 font-mono text-sm md:rotate-0 rotate-90 select-none">→</span>
            </div>
            {/* STEP 03 */}
            <div className="flex-1 border border-[#1a1a1a] bg-[#0a0a0a] p-4">
              <p className="text-[9px] font-mono uppercase tracking-widest text-[#555] mb-1">STEP 03 / ENTRY PRECISION</p>
              <p className="text-xs font-bold text-foreground tracking-wide mb-1.5">MINERVINI SEPA / VCP</p>
              <p className="text-[10px] font-mono text-[#777] leading-relaxed mb-2">변동성 수축 구간 확인 · R/R 2.5:1 이상 · 손절 7-8% 이내</p>
              <p className="text-[10px] font-mono text-amber-500">R/R 1.5:1 미만 → 자동 HOLD</p>
            </div>
          </div>

          {/* Gate summary */}
          <div className="border-t border-amber-500/30 pt-3 text-center">
            <p className="text-xs font-mono text-white/30">세 조건이 모두 충족될 때만 BUY 시그널 발령</p>
          </div>

          {/* Analysis output grid */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#555]">ANALYSIS OUTPUT</p>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-px bg-[#1a1a1a]">
              {[
                { label: "SIGNAL", value: "BUY / HOLD / SELL" },
                { label: "STAGE", value: "1 / 2 / 3 / 4" },
                { label: "PATTERN", value: "VCP · Flat Base" },
                { label: "VOLUME", value: "Constructive" },
                { label: "PIVOT", value: "52,400" },
                { label: "ENTRY→TGT→STP", value: "52.4→61.3→48.7" },
                { label: "R/R RATIO", value: "2.5 : 1" },
                { label: "SEPA SCORE", value: "8 / 10" },
              ].map((f) => (
                <div key={f.label} className="bg-[#0a0a0a] px-3 py-2.5">
                  <p className="text-[9px] font-mono uppercase text-white/40 mb-0.5">{f.label}</p>
                  <p className="text-[11px] font-mono text-white truncate">{f.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Methodology disclaimer */}
          <div className="border-t border-[#1a1a1a] pt-3">
            <p className="text-[10px] font-mono text-white/20">
              Minervini SEPA · O&apos;Neil CAN SLIM · Weinstein Stage Analysis 방법론 기반 기술적 참고자료 — 투자 판단의 최종 책임은 투자자 본인에게 있습니다
            </p>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* LEFT: Upload zone */}
          <div className="flex flex-col gap-4">
            {/* Chart setup guide */}
            <div className="rounded border border-[#1a1a1a] bg-[#0d0d0d]">
              <button
                onClick={() => setGuideOpen((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-xs font-medium text-[#888]">
                  최적 분석을 위한 차트 설정
                </span>
                <svg
                  className={`h-4 w-4 text-amber-500 transition-transform ${guideOpen ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {guideOpen && (
                <div className="border-t border-[#1a1a1a] px-4 py-3 space-y-1.5">
                  {[
                    "시간봉 설정: 일봉(Daily) 또는 주봉(Weekly) 차트 사용 — 분봉 차트는 분석 정확도 저하",
                    "기간 설정: 최소 6개월 이상 차트 포함 (베이스 패턴 식별을 위해 1년 권장)",
                    "이동평균선: 10주선 + 30주선 표시 필수 (Stage 판단 기준)",
                    "거래량: 차트 하단 거래량 바 반드시 포함",
                    "캡처 범위: 현재가 기준 좌측으로 충분한 가격 히스토리 포함",
                    "권장 출처: TradingView, 키움 HTS, 미래에셋 HTS 차트 캡처",
                    "해상도: 고해상도 캡처 권장 (차트 글씨 판독 가능해야 함)",
                  ].map((text, i) => (
                    <p key={i} className="text-[11px] font-mono text-[#666] leading-relaxed">
                      · {text}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {!image ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed py-24 transition-colors ${
                  dragging
                    ? "border-white/40 bg-white/5"
                    : "border-[#333] hover:border-[#555]"
                }`}
              >
                <svg
                  className="mb-4 h-10 w-10 text-[#555]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                <p className="text-sm text-[#888]">Drop chart image here</p>
                <p className="mt-1 text-xs text-[#555]">PNG · JPG · WEBP</p>
              </div>
            ) : (
              <div>
                <div className="relative overflow-hidden rounded border border-[#333]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image}
                    alt="Uploaded chart"
                    className="w-full object-contain"
                  />
                  {loading && (
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center">
                      <div className="chart-scan-line absolute left-0 right-0 h-[2px]" style={{
                        background: "linear-gradient(90deg, transparent 0%, #00ff88 20%, #00ffcc 50%, #00ff88 80%, transparent 100%)",
                        boxShadow: "0 0 12px 4px rgba(0,255,136,0.4), 0 0 30px 8px rgba(0,255,136,0.15)",
                      }} />
                      <div className="z-10 rounded bg-black/60 px-4 py-2.5 backdrop-blur-sm border border-[#00ff88]/30">
                        <p className="text-xs font-medium text-[#00ff88] tracking-wide">
                          AI 분석 중<span className="blink-cursor">|</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="truncate text-[10px] text-[#666]">
                    {fileName}
                  </span>
                  <button
                    onClick={() => {
                      setImage(null);
                      setFileName(null);
                      fileObjRef.current = null;
                      setResult(null);
                      setError(null);
                    }}
                    className="text-[10px] text-[#888] hover:text-white transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />

            <button
              onClick={() => requireAuth(handleAnalyze)}
              disabled={!canSubmit || loading}
              className="w-full py-3 bg-white text-black font-bold text-sm tracking-widest transition-opacity hover:opacity-90 disabled:opacity-30"
            >
              {loading ? "ANALYZING..." : "ANALYZE"}
            </button>
          </div>

          {/* RIGHT: Results panel */}
          <div className="min-h-[400px]">
            {!result && !error ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-[#333]">Awaiting analysis...</p>
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center">
                <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
                  {error}
                </div>
              </div>
            ) : result ? (
              <div className="space-y-0">
                {/* 1. TECHNICAL ASSESSMENT + STAGE */}
                <div className="py-5 border-b border-[#222]">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-3">
                    Technical Assessment
                  </h3>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex gap-2">
                      {(["BUY", "HOLD", "SELL"] as const).map((label) => {
                        const isActive = result.signal === label;
                        const activeColors = {
                          BUY: "bg-green-500/20 text-green-400 border border-green-500/40",
                          HOLD: "bg-amber-500/20 text-amber-400 border border-amber-500/40",
                          SELL: "bg-red-500/20 text-red-400 border border-red-500/40",
                        };
                        return (
                          <span
                            key={label}
                            className={`px-6 py-2 text-sm font-bold tracking-widest ${
                              isActive
                                ? activeColors[label]
                                : "border border-[#1a1a1a] text-[#333]"
                            }`}
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>
                    <span className={`px-3 py-1 text-[10px] font-bold tracking-wider border rounded ${result.stage ? stageBadgeColor(result.stage) : "bg-[#222] text-[#666] border-[#333]"}`}>
                      {result.stage ? stageLabel(result.stage) : "N/A"}
                    </span>
                    <span className={`px-3 py-1 text-[10px] font-medium tracking-wider border rounded ${result.volume_character ? volumeBadgeColor(result.volume_character) : "bg-[#222] text-[#666] border-[#333]"}`}>
                      {result.volume_character ? volumeLabel(result.volume_character) : "N/A"}
                    </span>
                  </div>
                </div>

                {/* 2. PATTERN IDENTIFIED */}
                <div className="py-5 border-b border-[#222]">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-3">
                    Pattern Identified
                  </h3>
                  <p className="text-sm font-medium text-foreground">
                    {result.pattern}
                  </p>
                  {result.pattern_detail && (
                    <p className="mt-1 text-[11px] font-mono text-[#666]">
                      {result.pattern_detail}
                    </p>
                  )}
                </div>

                {/* 3. ENTRY GUIDANCE */}
                <div className="py-5 border-b border-[#222]">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-3">
                    Entry Guidance
                  </h3>
                  {result.signal === "HOLD" ? (
                    <div>
                      {result.pivot != null && (
                        <div className="mb-3">
                          <p className="text-[9px] uppercase tracking-wider text-[#555] mb-1">주요 피벗</p>
                          <p className="font-mono text-sm text-foreground">{formatPrice(result.pivot)}</p>
                        </div>
                      )}
                      <p className="text-xs text-amber-400/90 leading-relaxed font-mono">
                        현재 명확한 진입 시점 아님 — {result.pattern || "패턴"}이 완성되면{result.pivot != null ? ` ${result.pivot.toLocaleString()}원 돌파 시` : ""} 진입 고려
                      </p>
                    </div>
                  ) : (
                  <div className="space-y-0">
                    {result.pivot != null && (
                      <div className="flex items-center gap-3 py-2 border-b border-[#1a1a1a]">
                        <div className="w-0.5 h-5 rounded-full bg-[#555]" />
                        <p className="text-[9px] uppercase tracking-wider text-[#555] w-12">피벗</p>
                        <p className="font-mono text-sm text-foreground">{formatPrice(result.pivot)}</p>
                      </div>
                    )}
                    {(result.signal === "SELL"
                      ? [
                          { label: "손절가", price: result.stop, color: "red" as const },
                          { label: "진입가", price: result.entry, color: "amber" as const },
                          { label: "목표가", price: result.target, color: "green" as const },
                        ]
                      : [
                          { label: "목표가", price: result.target, color: "green" as const },
                          { label: "진입가", price: result.entry, color: "amber" as const },
                          { label: "손절가", price: result.stop, color: "red" as const },
                        ]
                    ).map((row) => {
                      const stripColor = {
                        green: "bg-green-500",
                        amber: "bg-amber-500",
                        red: "bg-red-500",
                      }[row.color];
                      const textColor = {
                        green: "text-green-400",
                        amber: "text-foreground font-bold",
                        red: "text-red-400",
                      }[row.color];

                      let pctEl: React.ReactNode = null;
                      if (result.entry != null && row.price != null && row.color !== "amber") {
                        const pct = ((row.price - result.entry) / result.entry * 100).toFixed(1);
                        const pctColor = row.color === "green"
                          ? (result.signal === "SELL"
                              ? (result.target! < result.entry ? "text-green-400" : "text-red-400")
                              : (result.target! > result.entry ? "text-green-400" : "text-red-400"))
                          : (result.signal === "SELL"
                              ? (result.stop! > result.entry ? "text-red-400" : "text-green-400")
                              : (result.stop! < result.entry ? "text-red-400" : "text-green-400"));
                        pctEl = <span className={`font-mono text-[10px] ${pctColor}`}>{pct}%</span>;
                      }

                      return (
                        <div key={row.label} className="flex items-center gap-3 py-2.5 border-b border-[#1a1a1a] last:border-b-0">
                          <div className={`w-0.5 h-5 rounded-full ${stripColor}`} />
                          <p className="text-[9px] uppercase tracking-wider text-[#555] w-12">{row.label}</p>
                          <p className={`font-mono text-sm flex-1 ${textColor}`}>{formatPrice(row.price)}</p>
                          {pctEl}
                        </div>
                      );
                    })}
                  </div>
                  )}
                </div>

                {/* 4. INTERPRETATION */}
                <div className="py-5 border-b border-[#222]">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-3">
                    Interpretation
                  </h3>
                  <p className="text-xs text-[#aaa] leading-relaxed font-mono">
                    {result.interpretation}
                  </p>
                </div>

                {/* 5. CONVICTION + R/R + SEPA SCORE */}
                <div className="py-5 border-b border-[#222]">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-4">
                    Conviction
                  </h3>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="rounded border border-[#1a1a1a] px-3 py-2.5 text-center">
                      <p className="text-[9px] uppercase tracking-wider text-[#555] mb-1">R/R Ratio</p>
                      <p className="font-mono text-sm font-bold text-foreground">
                        {result.rr_ratio != null ? `${result.rr_ratio.toFixed(1)}:1` : "N/A"}
                      </p>
                    </div>
                    <div className="rounded border border-[#1a1a1a] px-3 py-2.5 text-center">
                      <p className="text-[9px] uppercase tracking-wider text-[#555] mb-1">SEPA Score</p>
                      <p className="font-mono text-sm font-bold text-foreground">
                        {result.minervini_score != null ? `${result.minervini_score}/10` : "N/A"}
                      </p>
                    </div>
                    <div className="rounded border border-[#1a1a1a] px-3 py-2.5 text-center">
                      <p className="text-[9px] uppercase tracking-wider text-[#555] mb-1">Conviction</p>
                      <p className="font-mono text-sm font-bold text-foreground">
                        {result.conviction}
                      </p>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#222]">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all"
                      style={{ width: `${convictionPercent(result.conviction)}%` }}
                    />
                  </div>
                </div>

                {/* 6. DISCLAIMER */}
                <div className="pt-5">
                  <p className="text-xs text-[#444] leading-relaxed">
                    본 분석은 AlphaLab AI Technical Model에 의해 생성되었으며, 투자 판단의 참고자료로만 활용하시기 바랍니다. 투자 결과에 대한 책임은 투자자 본인에게 있습니다.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        </>
        )}

        {activeTab === "screener" && (
          <div>
            {/* Screener header */}
            <div className="mb-6">
              <p className="text-xs font-mono text-[#888] mb-1">
                SEPA SCREENER — Weinstein Stage 2 · O&apos;Neil Base · Minervini VCP 조건 충족 종목 자동 필터링
              </p>
              <p className="text-[10px] font-mono text-[#444]">
                상위 20개 종목 표시 · 4시간 캐시 · 차트 업로드 후 AI 정밀 분석 권장
              </p>
            </div>

            {/* Market filter + refresh */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-0">
                {(["ALL", "KR", "US"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setScreenerMarket(m);
                      setScreenerResults([]);
                      fetchScreener(m);
                    }}
                    className={`px-5 py-2 text-[10px] font-bold tracking-widest border transition-colors ${
                      screenerMarket === m
                        ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        : "bg-transparent text-[#555] border-[#1a1a1a] hover:text-[#888]"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <button
                onClick={() => fetchScreener(screenerMarket, true)}
                disabled={screenerLoading}
                className="px-4 py-2 text-[10px] font-mono text-[#555] border border-[#1a1a1a] hover:text-[#888] hover:border-[#333] transition-colors disabled:opacity-30"
              >
                {screenerLoading ? "SCANNING..." : "REFRESH"}
              </button>
            </div>

            {/* Loading state */}
            {screenerLoading && (
              <div className="flex items-center justify-center py-24">
                <div className="text-center space-y-4">
                  {/* Animated arrow */}
                  <div className="flex justify-center">
                    <svg className="w-6 h-6 text-amber-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                  <p className="text-sm font-mono text-foreground">
                    SEPA 스크리너 실행 중<span className="animate-pulse">...</span>
                  </p>
                  <p className="text-xs font-mono text-amber-400">
                    Scanning {screenerMarket === "ALL" ? (KR_SYMBOLS_COUNT + US_SYMBOLS_COUNT) : screenerMarket === "KR" ? KR_SYMBOLS_COUNT : US_SYMBOLS_COUNT} symbols...
                  </p>
                  <p className="text-xs font-mono text-white/40">
                    {(screenerMarket === "ALL" ? KR_SYMBOLS_COUNT + US_SYMBOLS_COUNT : screenerMarket === "KR" ? KR_SYMBOLS_COUNT : US_SYMBOLS_COUNT)}개 종목 데이터 수집 및 필터링 중 — 최초 실행 시 30-60초 소요됩니다
                  </p>
                  <p className="text-xs font-mono text-white/20">
                    Weinstein Stage 2 · O&apos;Neil Base · Minervini VCP 조건 순차 적용 중
                  </p>
                  <p className="text-[10px] font-mono text-white/20 pt-2">
                    캐시 저장 후 재조회 시 즉시 로딩
                  </p>
                </div>
              </div>
            )}

            {/* Error state */}
            {screenerError && !screenerLoading && (
              <div className="flex items-center justify-center py-20">
                <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400 font-mono">
                  {screenerError}
                </div>
              </div>
            )}

            {/* Results table */}
            {!screenerLoading && !screenerError && screenerResults.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#1a1a1a]">
                      {["SYMBOL", "NAME", "MKT", "PRICE", "CHG%", "SEPA SCORE", "BASE", "VOL CONTRACTION", "52W HIGH", ""].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-[9px] font-mono uppercase tracking-widest text-[#444] whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {screenerResults.map((r) => {
                      const rowKey = `${r.market}-${r.symbol}`;
                      const dimmed = r.score < 6;
                      const highlight = r.score >= 8;
                      const isExpanded = selectedSymbol === rowKey;
                      return (
                        <Fragment key={rowKey}>
                        <tr
                          onClick={() => setSelectedSymbol(isExpanded ? null : rowKey)}
                          className={`border-b border-[#111] cursor-pointer hover:bg-[#0d0d0d] transition-colors ${dimmed ? "opacity-40" : ""} ${highlight ? "border-l-2 border-l-amber-500/50" : ""}`}
                        >
                          <td className="px-3 py-2.5 text-xs font-mono font-bold text-foreground whitespace-nowrap">
                            {r.symbol}
                          </td>
                          <td className="px-3 py-2.5 text-[11px] font-mono text-[#888] truncate max-w-[160px]">
                            {r.name}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 ${r.market === "KR" ? "bg-blue-500/15 text-blue-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                              {r.market}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs font-mono text-foreground whitespace-nowrap">
                            {r.market === "KR" ? r.price.toLocaleString() : r.price.toFixed(2)}
                          </td>
                          <td className={`px-3 py-2.5 text-xs font-mono whitespace-nowrap ${r.change_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {r.change_pct >= 0 ? "+" : ""}{r.change_pct.toFixed(2)}%
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-amber-400 w-5">{r.score}</span>
                              <div className="h-1.5 w-16 bg-[#1a1a1a] overflow-hidden">
                                <div
                                  className="h-full bg-amber-500 transition-all"
                                  style={{ width: `${(r.score / 10) * 100}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-[10px] font-mono text-[#777] whitespace-nowrap">
                            {r.base_depth_pct}% / {r.weeks_in_base}w
                          </td>
                          <td className="px-3 py-2.5 text-[10px] font-mono text-[#777] whitespace-nowrap">
                            {r.volume_ratio.toFixed(2)}x
                          </td>
                          <td className="px-3 py-2.5 text-[10px] font-mono text-[#777] whitespace-nowrap">
                            -{r.dist_from_52w_high_pct}%
                          </td>
                          <td className="px-3 py-2.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setScreenerPrompt(`이 종목을 분석하려면 차트를 업로드하세요: ${r.symbol}`);
                                setActiveTab("chart");
                              }}
                              className="px-3 py-1 text-[9px] font-bold tracking-wider text-amber-400 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition-colors whitespace-nowrap"
                            >
                              차트 분석
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={10} className="bg-[#0d0d0d] border-t border-[#1a1a1a] px-6 py-4">
                              <div className="space-y-3">
                                <p className="text-xs font-mono font-bold text-amber-400 tracking-wider">WHY THIS STOCK</p>
                                <div className="space-y-1.5">
                                  <p className="text-xs font-mono text-gray-400">
                                    <span className="text-amber-500 mr-2">·</span>
                                    Stage 2: Current price {r.market === "KR" ? r.price.toLocaleString() : r.price.toFixed(2)} &gt; 150-day MA — Uptrend confirmed
                                  </p>
                                  <p className="text-xs font-mono text-gray-400">
                                    <span className="text-amber-500 mr-2">·</span>
                                    Base: Base depth {r.base_depth_pct}% / {r.weeks_in_base} weeks — Volatility contraction in progress
                                  </p>
                                  <p className="text-xs font-mono text-gray-400">
                                    <span className="text-amber-500 mr-2">·</span>
                                    52W: {r.dist_from_52w_high_pct}% below 52-week high — Near highs zone
                                  </p>
                                  <p className="text-xs font-mono text-gray-400">
                                    <span className="text-amber-500 mr-2">·</span>
                                    Volume: Volume contraction {r.volume_ratio.toFixed(2)}x — Selling pressure diminishing within base
                                  </p>
                                  <p className="text-xs font-mono text-gray-400">
                                    <span className="text-amber-500 mr-2">·</span>
                                    MA Alignment: MA50 &gt; MA150 &gt; MA200 — Full uptrend alignment confirmed
                                  </p>
                                </div>
                                <div className="pt-2">
                                  <p className="text-xs font-mono font-bold text-amber-400 tracking-wider mb-2">NEXT STEP</p>
                                  <p className="text-xs font-mono text-gray-400 mb-3">
                                    Capture {r.symbol} weekly chart on TradingView and run AI analysis
                                  </p>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setScreenerPrompt(`이 종목을 분석하려면 차트를 업로드하세요: ${r.symbol}`);
                                      setActiveTab("chart");
                                    }}
                                    className="border border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-black px-3 py-1 text-xs font-mono transition-colors"
                                  >
                                    Analyze Chart →
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Empty state */}
            {!screenerLoading && !screenerError && screenerResults.length === 0 && (
              <div className="flex items-center justify-center py-20">
                <p className="text-xs font-mono text-[#333]">No results</p>
              </div>
            )}

            {/* Footer: updated at + stats */}
            {screenerUpdatedAt && !screenerLoading && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#1a1a1a]">
                <div className="flex items-center gap-3">
                  {screenerStats && (
                    <span className="text-[9px] font-mono text-[#333]">
                      Scanned {(screenerStats.total_scanned || screenerStats.kr_scanned + screenerStats.us_scanned).toLocaleString()} symbols · {screenerStats.passed} passed
                    </span>
                  )}
                  {screenerCached && (
                    <span className="text-[9px] font-mono text-amber-500/50">CACHED</span>
                  )}
                </div>
                <span className="text-[9px] font-mono text-[#333]">
                  Updated {new Date(screenerUpdatedAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
