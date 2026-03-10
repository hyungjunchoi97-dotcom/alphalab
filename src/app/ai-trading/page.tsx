"use client";

import { useState, useRef, useCallback } from "react";
import AppHeader from "@/components/AppHeader";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export default function AiTradingPage() {
  const requireAuth = useRequireAuth();

  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileObjRef = useRef<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
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
      setError("차트 이미지를 먼저 업로드하세요");
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
        setResult(json.data);
      } else {
        setError(json.error || "분석에 실패했습니다");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !!image && !!fileObjRef.current;

  // Parse STEP headers for amber highlighting
  function renderAnalysis(text: string) {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      const trimmed = line.trim();

      // STEP headers (## STEP 1: ... or **STEP 1: ...**)
      if (/^#{1,3}\s*STEP\s*\d/i.test(trimmed) || /^\*{1,2}STEP\s*\d/i.test(trimmed)) {
        const clean = trimmed.replace(/^#+\s*/, "").replace(/\*+/g, "").trim();
        return (
          <p key={i} className="text-[13px] font-bold tracking-wide mt-5 mb-2" style={{ color: "#f59e0b" }}>
            {clean}
          </p>
        );
      }

      // Sub-headers (## or **bold**)
      if (/^#{1,3}\s/.test(trimmed)) {
        const clean = trimmed.replace(/^#+\s*/, "");
        return (
          <p key={i} className="text-[12px] font-bold text-white/90 mt-4 mb-1.5">
            {clean}
          </p>
        );
      }

      // Bullet points
      if (/^[-·•]/.test(trimmed)) {
        const clean = trimmed.replace(/^[-·•]\s*/, "");
        return (
          <p key={i} className="text-[11px] font-mono text-[#aaa] leading-[1.8] pl-3">
            <span className="text-[#555] mr-1.5">·</span>
            {renderInlineMarkdown(clean)}
          </p>
        );
      }

      // Empty line
      if (trimmed === "") {
        return <div key={i} className="h-1.5" />;
      }

      // Regular text
      return (
        <p key={i} className="text-[11px] font-mono text-[#999] leading-[1.8]">
          {renderInlineMarkdown(trimmed)}
        </p>
      );
    });
  }

  // Inline bold (**text**) rendering
  function renderInlineMarkdown(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) {
        return (
          <span key={i} className="font-bold text-white">
            {part.replace(/\*\*/g, "")}
          </span>
        );
      }
      return part;
    });
  }

  return (
    <div className="min-h-screen bg-background" onPaste={onPaste}>
      <AppHeader active="aiTrading" />

      <main className="mx-auto max-w-[1400px] px-4 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            AI 추세추종 분석
          </h1>
          <p className="mt-1 text-sm text-[#888]">
            차트 이미지를 업로드하면 추세·거래량 기반으로 분석합니다
          </p>
        </div>

        {/* Analysis Guide Dropdown */}
        <div className="mb-6 rounded border border-white/10 bg-[#0d0d0d]">
          <button
            onClick={() => setInfoOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left cursor-pointer transition-colors hover:bg-white/[0.03]"
          >
            <span className="text-xs font-medium text-[#888]">
              분석 기준 안내
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-[#555]">
              {infoOpen ? "접기" : "펼치기"}
              <svg
                className={`h-3.5 w-3.5 text-amber-500 transition-transform duration-300 ${infoOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </button>

          <div
            className="overflow-hidden transition-all duration-300"
            style={{ maxHeight: infoOpen ? "600px" : "0", opacity: infoOpen ? 1 : 0 }}
          >
            <div className="border-t border-white/10 px-4 py-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  {
                    step: "STEP 1",
                    title: "추세 구조 파악",
                    desc: "고점·저점이 높아지는 HH/HL 구조인지, 이동평균선(20·50·200MA) 배열 확인. 추세 방향과 강도를 판단합니다.",
                  },
                  {
                    step: "STEP 2",
                    title: "거래량 분석",
                    desc: "상승 시 거래량 증가, 하락 시 거래량 감소 여부로 추세의 진짜 힘을 검증합니다. 거래량 없는 상승은 신뢰도가 낮습니다.",
                  },
                  {
                    step: "STEP 3",
                    title: "지지·저항 파악",
                    desc: "현재 가격 위아래의 핵심 지지선과 저항선을 파악해 리스크·리워드 구조를 계산합니다.",
                  },
                  {
                    step: "STEP 4",
                    title: "진입 판단",
                    desc: "추세추종 관점에서 지금 진입 가능한지, 손절 기준과 1차 목표가를 제시합니다. YES/NO/WAIT로 명확히 판단합니다.",
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="rounded border border-white/[0.08] bg-white/[0.02] p-4"
                  >
                    <p className="text-xs font-mono text-amber-400 mb-1">{item.step}</p>
                    <p className="text-sm font-medium text-white mb-2">{item.title}</p>
                    <p className="text-xs text-gray-400 leading-6">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Hint text */}
        <p className="mb-6 text-xs text-gray-500 text-center">
          일봉·주봉 차트 이미지를 업로드하면 위 4단계 기준으로 분석합니다.
          이동평균선·거래량이 표시된 차트일수록 분석 정확도가 높아집니다.
        </p>

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
                    "시간봉 설정: 일봉(Daily) 또는 주봉(Weekly) 차트 사용",
                    "기간 설정: 최소 6개월 이상 차트 포함 권장",
                    "이동평균선: 20일선, 50일선, 200일선 표시 권장",
                    "거래량: 차트 하단 거래량 바 반드시 포함",
                    "캡처 범위: 현재가 기준 좌측으로 충분한 히스토리 포함",
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
                <p className="text-sm text-[#888]">차트 이미지를 드래그하세요</p>
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
                <p className="text-sm text-[#333] font-mono">분석 대기 중...</p>
              </div>
            ) : error ? (
              <div className="flex h-full items-center justify-center">
                <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
                  {error}
                </div>
              </div>
            ) : result ? (
              <div className="rounded border border-[#1a1a1a] bg-[#0a0a0a] p-5">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#1a1a1a]">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <p className="text-[10px] font-mono uppercase tracking-widest text-[#555]">
                    AI TREND ANALYSIS
                  </p>
                </div>
                <div>{renderAnalysis(result)}</div>
                <div className="mt-6 pt-4 border-t border-[#1a1a1a]">
                  <p className="text-[10px] font-mono text-white/20">
                    추세추종 분석 기반 기술적 참고자료 — 투자 판단의 최종 책임은 투자자 본인에게 있습니다
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
