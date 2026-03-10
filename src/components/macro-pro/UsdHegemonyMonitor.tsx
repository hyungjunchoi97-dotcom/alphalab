"use client";

import { useState, useEffect } from "react";

// ── Colors ───────────────────────────────────────────────
const C = {
  cyan: "#00d4ff",
  amber: "#f59e0b",
  red: "#ef4444",
  green: "#22c55e",
};

// ── Types ────────────────────────────────────────────────
interface CriticalWatch {
  trigger: string;
  triggerEN: string;
  threshold: string;
}

interface UsdHegemonyData {
  stressLevel: "LOW" | "ELEVATED" | "CRITICAL";
  analysis: string;
  analysisEN: string;
  criticalWatch: CriticalWatch[];
  drukView: string;
  drukViewEN: string;
  zeihanView: string;
  zeihanViewEN: string;
}

// ── i18n ─────────────────────────────────────────────────
const i18n = {
  en: {
    title: "USD HEGEMONY MONITOR",
    criticalWatch: "CRITICAL WATCH",
    drukView: "DRUK VIEW",
    zeihanView: "ZEIHAN VIEW",
    loading: "Loading hegemony data...",
    error: "Monitor unavailable",
    retry: "Retry",
  },
  kr: {
    title: "USD 패권 모니터",
    criticalWatch: "핵심 감시 항목",
    drukView: "DRUK VIEW",
    zeihanView: "ZEIHAN VIEW",
    loading: "패권 데이터 로딩 중...",
    error: "모니터 사용 불가",
    retry: "재시도",
  },
};
type LangKey = "en" | "kr";

const stressColor = (s: string) => (s === "CRITICAL" ? C.red : s === "ELEVATED" ? C.amber : C.green);

// ── Component ────────────────────────────────────────────
export default function UsdHegemonyMonitor({ lang }: { lang: string }) {
  const currentLang: LangKey = lang === "kr" ? "kr" : "en";
  const tx = i18n[currentLang];
  const t = (kr: string, en: string) => (currentLang === "kr" ? kr : en);

  const [data, setData] = useState<UsdHegemonyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(false);
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 55000);
      const res = await fetch("/api/usd-hegemony", { signal: ac.signal });
      clearTimeout(timer);
      const json = await res.json();
      if (json.ok) {
        setData(json.data);
      } else {
        console.error("[UsdHegemony] API error:", json.error);
        setError(true);
      }
    } catch (err) {
      console.error("[UsdHegemony] fetch failed:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ── Loading ────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ border: "1px solid #1a1a1a", background: "#0a0a0a", padding: 12, borderRadius: 2 }}>
        <span className="text-[14px] uppercase tracking-widest opacity-50 font-[family-name:var(--font-jetbrains)]">
          {tx.title}
        </span>
        <div className="mt-2 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-3 rounded" style={{ background: "#111", width: `${90 - i * 15}%`, animation: "threatPulse 1.5s infinite" }} />
          ))}
        </div>
        <p className="text-[13px] opacity-30 mt-2 font-[family-name:var(--font-jetbrains)]">{tx.loading}</p>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────
  if (error || !data) {
    return (
      <div style={{ border: "1px solid #1a1a1a", background: "#0a0a0a", padding: 12, borderRadius: 2 }}>
        <span className="text-[14px] uppercase tracking-widest opacity-50 font-[family-name:var(--font-jetbrains)]">
          {tx.title}
        </span>
        <p className="text-[14px] mt-2 font-[family-name:var(--font-jetbrains)]" style={{ color: C.red }}>{tx.error}</p>
        <button
          onClick={fetchData}
          className="mt-1 text-[13px] font-bold font-[family-name:var(--font-jetbrains)] uppercase tracking-wider"
          style={{ color: C.cyan }}
        >
          {tx.retry}
        </button>
      </div>
    );
  }

  const sc = stressColor(data.stressLevel);

  return (
    <div style={{ border: "1px solid #1a1a1a", background: "#0a0a0a", padding: 12, borderRadius: 2 }}>
      {/* Header + Stress Badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[14px] uppercase tracking-widest opacity-50 font-[family-name:var(--font-jetbrains)]">
          {tx.title}
        </span>
        <span
          className="text-[13px] font-bold px-2 py-0.5 rounded font-[family-name:var(--font-jetbrains)] uppercase"
          style={{ color: sc, border: `1px solid ${sc}40`, background: `${sc}10` }}
        >
          {data.stressLevel}
        </span>
      </div>

      {/* Analysis prose */}
      <p className="text-[14px] leading-relaxed opacity-75 font-[family-name:var(--font-jetbrains)] mb-3">
        {t(data.analysis, data.analysisEN)}
      </p>

      {/* Critical Watch */}
      <div className="mb-3">
        <span className="text-[13px] uppercase tracking-widest font-[family-name:var(--font-jetbrains)]" style={{ color: C.amber }}>
          {tx.criticalWatch}
        </span>
        <div className="mt-1.5 space-y-1.5">
          {data.criticalWatch.map((w, i) => (
            <div key={i} className="flex items-start gap-2 font-[family-name:var(--font-jetbrains)]">
              <span className="text-[14px] font-bold shrink-0" style={{ color: C.amber }}>
                {w.threshold}
              </span>
              <span className="text-[14px] opacity-70 leading-relaxed">
                {t(w.trigger, w.triggerEN)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Druk View */}
      <div className="mb-2">
        <span className="text-[13px] uppercase tracking-widest opacity-40 font-[family-name:var(--font-jetbrains)]">
          {tx.drukView}
        </span>
        <p className="text-[14px] leading-relaxed opacity-60 mt-0.5 font-[family-name:var(--font-jetbrains)]">
          {t(data.drukView, data.drukViewEN)}
        </p>
      </div>

      {/* Zeihan View */}
      <div>
        <span className="text-[13px] uppercase tracking-widest opacity-40 font-[family-name:var(--font-jetbrains)]">
          {tx.zeihanView}
        </span>
        <p className="text-[14px] leading-relaxed opacity-60 mt-0.5 font-[family-name:var(--font-jetbrains)]">
          {t(data.zeihanView, data.zeihanViewEN)}
        </p>
      </div>
    </div>
  );
}
