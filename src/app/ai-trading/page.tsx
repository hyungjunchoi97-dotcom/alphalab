"use client";

import { useState, useRef, useCallback } from "react";
import AppHeader from "@/components/AppHeader";
import { useRequireAuth } from "@/hooks/useRequireAuth";

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

export default function AiTradingPage() {
  const requireAuth = useRequireAuth();

  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileObjRef = useRef<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

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
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            AI Technical Analysis
          </h1>
          <p className="mt-1 text-sm text-[#888]">
            Minervini SEPA / O&apos;Neil CAN SLIM / Weinstein Stage Analysis
          </p>
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
                  {result.signal === "HOLD" && result.entry == null && result.target == null && result.stop == null ? (
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
      </main>
    </div>
  );
}
