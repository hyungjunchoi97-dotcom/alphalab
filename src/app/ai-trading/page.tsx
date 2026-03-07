"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useLang } from "@/lib/LangContext";
import AppHeader from "@/components/AppHeader";
import { useRequireAuth } from "@/hooks/useRequireAuth";

const TIMEFRAMES = [
  { value: "1D", label: "일봉 (1D)" },
  { value: "1W", label: "주봉 (1W)" },
  { value: "1M", label: "월봉 (1M)" },
] as const;

interface PromptItem {
  id: string;
  title: string;
  description: string;
  content: string;
}

interface AnalysisResult {
  entry: string;
  stopLoss: string;
  target: string;
  thesis: string;
  confidence?: number;
  keyLevels?: { support: string; resistance: string };
  riskReward?: string;
}

export default function AiTradingPage() {
  const { t, lang } = useLang();
  const requireAuth = useRequireAuth();

  const [image, setImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileObjRef = useRef<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Inputs
  const [stockName, setStockName] = useState("");
  const [timeframe, setTimeframe] = useState("1D");
  const [userPrompt, setUserPrompt] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Prompt library modal
  const [showPromptLib, setShowPromptLib] = useState(false);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);

  const fetchPrompts = useCallback(async () => {
    setPromptsLoading(true);
    try {
      const res = await fetch("/api/prompts");
      const json = await res.json();
      if (json.ok) setPrompts(json.prompts || []);
    } catch { /* ignore */ }
    finally { setPromptsLoading(false); }
  }, []);

  useEffect(() => {
    if (showPromptLib && prompts.length === 0) fetchPrompts();
  }, [showPromptLib, prompts.length, fetchPrompts]);

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

  const canSubmit = !!image && !!fileObjRef.current;

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
      if (stockName.trim()) fd.append("stockName", stockName.trim());
      if (timeframe) fd.append("timeframe", timeframe);
      if (userPrompt.trim()) fd.append("prompt", userPrompt.trim());
      fd.append("lang", lang);

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

  return (
    <div className="min-h-screen bg-background" onPaste={onPaste}>
      <AppHeader active="aiTrading" />

      <main className="mx-auto max-w-[1400px] px-4 py-4">
        {/* Controls row */}
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            {/* Stock Name */}
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
                {lang === "kr" ? "종목명" : "Stock Name"}
              </label>
              <input
                type="text"
                placeholder={lang === "kr" ? "예: 삼성전자, Apple, NVIDIA" : "e.g. Samsung, Apple, NVIDIA"}
                value={stockName}
                onChange={(e) => setStockName(e.target.value)}
                className="w-48 rounded border border-card-border bg-card-bg px-2 py-1 text-xs outline-none focus:border-accent"
              />
            </div>

            {/* Timeframe */}
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
                Timeframe
              </label>
              <div className="flex gap-px rounded bg-card-border p-px">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.value}
                    onClick={() => setTimeframe(tf.value)}
                    className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
                      timeframe === tf.value
                        ? "bg-accent text-white"
                        : "bg-card-bg text-muted hover:text-foreground"
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Analyze button */}
            <button
              onClick={() => requireAuth(handleAnalyze)}
              disabled={!canSubmit || loading}
              className="rounded bg-accent px-4 py-2 sm:py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {loading ? (lang === "kr" ? "분석 중..." : "Analyzing...") : t("analyze")}
            </button>
          </div>

          {/* Analysis Prompt */}
          <div>
            <div className="mb-1 flex items-center gap-2">
              <label className="text-[10px] uppercase tracking-wider text-muted">
                {lang === "kr" ? "분석 프롬프트" : "Analysis Prompt"}
              </label>
              <button
                onClick={() => setShowPromptLib(true)}
                className="rounded bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent transition-colors hover:bg-accent/25"
              >
                {lang === "kr" ? "프롬프트 라이브러리" : "Prompt Library"}
              </button>
            </div>
            <textarea
              placeholder={lang === "kr" ? "AI가 차트를 분석할 방법을 설명하세요..." : "Describe how you want AI to analyze this chart..."}
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              rows={3}
              className="w-full rounded border border-card-border bg-card-bg px-2.5 py-1.5 text-xs outline-none focus:border-accent resize-y"
            />
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* Left: Image upload + preview */}
          <div className="rounded-[12px] border border-card-border bg-card-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {t("chartUpload")}
              </h2>
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
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 transition-colors ${
                  dragging
                    ? "border-accent bg-accent/5"
                    : "border-card-border hover:border-muted"
                }`}
              >
                <svg
                  className="mb-3 h-8 w-8 text-muted"
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
                <p className="text-xs text-muted">
                  {t("uploadHint")}
                </p>
                <p className="mt-1 text-[10px] text-muted/60">
                  PNG, JPG, WEBP supported
                </p>
              </div>
            ) : (
              <div>
                <div className="relative overflow-hidden rounded-lg border border-card-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image}
                    alt="Uploaded chart"
                    className="w-full object-contain"
                  />
                  {/* Scanning overlay */}
                  {loading && (
                    <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center">
                      <div className="chart-scan-line absolute left-0 right-0 h-[2px]" style={{
                        background: "linear-gradient(90deg, transparent 0%, #00ff88 20%, #00ffcc 50%, #00ff88 80%, transparent 100%)",
                        boxShadow: "0 0 12px 4px rgba(0,255,136,0.4), 0 0 30px 8px rgba(0,255,136,0.15)",
                      }} />
                      <div className="chart-scan-text z-10 rounded-lg bg-black/60 px-4 py-2.5 backdrop-blur-sm border border-[#00ff88]/30">
                        <p className="text-xs font-medium text-[#00ff88] tracking-wide">
                          {lang === "kr" ? "AI 분석 중" : "Scanning"}<span className="blink-cursor">|</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="truncate text-[10px] text-muted">
                    {fileName}
                  </span>
                  <button
                    onClick={() => {
                      setImage(null);
                      setFileName(null);
                      fileObjRef.current = null;
                    }}
                    className="text-[10px] text-loss hover:underline"
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
          </div>

          {/* Right: Analysis result */}
          <div className="rounded-[12px] border border-card-border bg-card-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {t("analysisResult")}
              </h2>
            </div>

            <div className="space-y-3">
              {/* Confidence bar */}
              {result?.confidence != null && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      {t("confidence")}
                    </h3>
                    <span className={`text-sm font-bold tabular-nums ${
                      result.confidence >= 70 ? "text-gain" : result.confidence >= 40 ? "text-yellow-400" : "text-loss"
                    }`}>
                      {result.confidence}/100
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-card-border">
                    <div
                      className={`h-full rounded-full transition-all ${
                        result.confidence >= 70 ? "bg-gain" : result.confidence >= 40 ? "bg-yellow-400" : "bg-loss"
                      }`}
                      style={{ width: `${result.confidence}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Entry + Stop + R:R */}
              <div className="grid grid-cols-2 gap-2">
                <ResultField label={t("entry")} value={result?.entry || "—"} />
                <ResultField label={t("stop")} value={result?.stopLoss || "—"} valueClass="text-loss" />
              </div>

              {/* Target (single) */}
              <ResultField label={lang === "kr" ? "목표가" : "Target"} value={result?.target || "—"} valueClass="text-gain" />

              {result?.riskReward && (
                <ResultField label="Risk / Reward" value={result.riskReward} valueClass="text-accent" />
              )}

              {/* Key Levels */}
              {result?.keyLevels && (
                <div className="grid grid-cols-2 gap-2">
                  <ResultField label="Support" value={result.keyLevels.support} valueClass="text-gain" />
                  <ResultField label="Resistance" value={result.keyLevels.resistance} valueClass="text-loss" />
                </div>
              )}

              {/* Thesis */}
              <div>
                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {t("thesis")}
                </h3>
                <div className="rounded border border-card-border/60 bg-background px-3 py-2 text-xs leading-relaxed text-muted">
                  {result?.thesis || t("analyzeHint")}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded border border-loss/30 bg-loss/10 px-3 py-2 text-[10px] text-loss">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Prompt Library Modal */}
        {showPromptLib && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowPromptLib(false)}
          >
            <div
              className="mx-4 w-full max-w-lg rounded-[12px] border border-card-border bg-card-bg p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {lang === "kr" ? "프롬프트 라이브러리" : "Prompt Library"}
                  </h2>
                </div>
                <button
                  onClick={() => setShowPromptLib(false)}
                  className="text-muted transition-colors hover:text-foreground"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {promptsLoading ? (
                <div className="py-8 text-center text-[10px] text-muted">Loading...</div>
              ) : prompts.length === 0 ? (
                <div className="py-8 text-center text-[10px] text-muted">
                  {lang === "kr" ? "프롬프트가 없습니다" : "No prompts available"}
                </div>
              ) : (
                <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
                  {prompts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setUserPrompt(p.content);
                        setShowPromptLib(false);
                      }}
                      className="w-full rounded-lg border border-card-border bg-background p-3 text-left transition-colors hover:border-accent/40"
                    >
                      <h3 className="text-xs font-medium">{p.title}</h3>
                      {p.description && (
                        <p className="mt-0.5 text-[10px] text-muted line-clamp-2">{p.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ResultField({
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded border border-card-border/60 bg-background px-2.5 py-2">
      <p className="text-[9px] uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-0.5 text-sm font-medium tabular-nums ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}
