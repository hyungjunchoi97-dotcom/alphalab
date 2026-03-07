"use client";

import { useState, useRef, useCallback } from "react";
import AppHeader from "@/components/AppHeader";
import { useRequireAuth } from "@/hooks/useRequireAuth";

interface AnalysisResult {
  signal: "BUY" | "HOLD" | "SELL";
  pattern: {
    english: string;
    korean: string;
  };
  interpretation: string;
  entry: {
    price: number | null;
    target: number | null;
    targetPct: number | null;
    stopLoss: number | null;
    stopLossPct: number | null;
  };
  conviction: "HIGH" | "MEDIUM" | "LOW";
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

function formatPct(v: number | null): string {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
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
            Upload a chart to receive an institutional-grade technical assessment
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* LEFT: Upload zone */}
          <div className="flex flex-col gap-4">
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
                {/* 1. TECHNICAL ASSESSMENT */}
                <div className="py-5 border-b border-[#222]">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-3">
                    Technical Assessment
                  </h3>
                  <div className="flex gap-2">
                    {(["BUY", "HOLD", "SELL"] as const).map((label) => (
                      <span
                        key={label}
                        className={`px-4 py-1.5 text-xs font-bold tracking-wider ${
                          result.signal === label
                            ? "bg-white text-black"
                            : "border border-[#333] text-[#333]"
                        }`}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 2. PATTERN IDENTIFIED */}
                <div className="py-5 border-b border-[#222]">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-3">
                    Pattern Identified
                  </h3>
                  <p className="text-sm font-medium text-foreground">
                    {result.pattern.english}{" "}
                    <span className="text-[#888]">· {result.pattern.korean}</span>
                  </p>
                  <p className="mt-1 text-xs text-[#888]">
                    {result.interpretation}
                  </p>
                </div>

                {/* 3. ENTRY GUIDANCE */}
                <div className="py-5 border-b border-[#222]">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-3">
                    Entry Guidance
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-[#555] mb-1">진입가</p>
                      <p className="font-mono text-sm text-foreground">{formatPrice(result.entry.price)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-[#555] mb-1">목표가</p>
                      <p className="font-mono text-sm text-foreground">{formatPrice(result.entry.target)}</p>
                      <p className="font-mono text-[10px] text-green-400">{formatPct(result.entry.targetPct)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-[#555] mb-1">손절가</p>
                      <p className="font-mono text-sm text-foreground">{formatPrice(result.entry.stopLoss)}</p>
                      <p className="font-mono text-[10px] text-red-400">{formatPct(result.entry.stopLossPct)}</p>
                    </div>
                  </div>
                </div>

                {/* 4. CONVICTION */}
                <div className="py-5 border-b border-[#222]">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-3">
                    Conviction
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#222]">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all"
                        style={{ width: `${convictionPercent(result.conviction)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold tracking-wider text-foreground">
                      {result.conviction}
                    </span>
                  </div>
                </div>

                {/* 5. DISCLAIMER */}
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
