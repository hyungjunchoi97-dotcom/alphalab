"use client";

import { useState } from "react";

interface AiAnalysis {
  summary: string;
  profitability: { rating: string; analysis: string };
  growth: { rating: string; analysis: string };
  financial_health: { rating: string; analysis: string };
  cashflow: { rating: string; analysis: string };
  risks: string[];
  investment_view: { stance: string; rationale: string };
}

function ratingColor(rating: string) {
  const r = rating.toLowerCase();
  if (["strong", "accelerating", "solid", "positive"].includes(r))
    return { text: "#4ade80", border: "rgba(74,222,128,0.3)", bg: "rgba(74,222,128,0.1)" };
  if (["moderate", "stable", "adequate", "neutral"].includes(r))
    return { text: "#fbbf24", border: "rgba(251,191,36,0.3)", bg: "rgba(251,191,36,0.1)" };
  return { text: "#f87171", border: "rgba(248,113,113,0.3)", bg: "rgba(248,113,113,0.1)" };
}

function RatingBadge({ rating }: { rating: string }) {
  const c = ratingColor(rating);
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ color: c.text, border: `1px solid ${c.border}`, background: c.bg }}
    >
      {rating}
    </span>
  );
}

const METRICS: { key: keyof Pick<AiAnalysis, "profitability" | "growth" | "financial_health" | "cashflow">; label: string; labelKr: string }[] = [
  { key: "profitability", label: "PROFITABILITY", labelKr: "수익성" },
  { key: "growth", label: "GROWTH", labelKr: "성장성" },
  { key: "financial_health", label: "FINANCIAL HEALTH", labelKr: "재무건전성" },
  { key: "cashflow", label: "CASH FLOW", labelKr: "현금흐름" },
];

export default function AiAnalysisPanel({
  ticker,
  market,
  financialData,
  lang = "en",
}: {
  ticker: string;
  market: "KR" | "US";
  financialData: unknown;
  lang?: string;
}) {
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchAnalysis = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/financials-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, market, financialData }),
      });
      const json = await res.json();
      if (json.ok) setAnalysis(json.analysis);
      else setError(json.error || "Analysis failed");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  if (!analysis && !loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <button
          onClick={fetchAnalysis}
          className="rounded-lg px-5 py-2.5 text-xs font-semibold tracking-wide transition-all hover:opacity-80"
          style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)" }}
        >
          {lang === "kr" ? "AI 재무분석 실행" : "Run AI Analysis"}
        </button>
        {error && <p className="text-[11px]" style={{ color: "#f87171" }}>{error}</p>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[11px] animate-pulse" style={{ color: "#555" }}>
          {lang === "kr" ? "AI 분석 중..." : "Analyzing financials..."}
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const isKr = lang === "kr";

  return (
    <div className="space-y-6">
      {/* Summary */}
      <p className="text-sm leading-relaxed" style={{ color: "#d1d5db" }}>
        {analysis.summary}
      </p>

      {/* 4 Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {METRICS.map(({ key, label, labelKr }) => {
          const item = analysis[key];
          return (
            <div
              key={key}
              className="rounded-lg p-4"
              style={{ background: "#111", border: "1px solid #222" }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#6b7280" }}>
                  {isKr ? labelKr : label}
                </span>
                <RatingBadge rating={item.rating} />
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "#9ca3af" }}>
                {item.analysis}
              </p>
            </div>
          );
        })}
      </div>

      {/* Risks */}
      <div>
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#6b7280" }}>
          {isKr ? "핵심 리스크" : "KEY RISKS"}
        </span>
        <ul className="mt-2">
          {analysis.risks.map((risk, i) => (
            <li
              key={i}
              className="py-2 text-xs"
              style={{ color: "#9ca3af", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              {risk}
            </li>
          ))}
        </ul>
      </div>

      {/* Investment View */}
      <div className="rounded-lg p-4" style={{ background: "#111", border: "1px solid #222" }}>
        <div className="mb-2 flex items-center gap-3">
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#6b7280" }}>
            {isKr ? "투자 의견" : "INVESTMENT VIEW"}
          </span>
          <RatingBadge rating={analysis.investment_view.stance} />
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "#d1d5db" }}>
          {analysis.investment_view.rationale}
        </p>
      </div>
    </div>
  );
}
