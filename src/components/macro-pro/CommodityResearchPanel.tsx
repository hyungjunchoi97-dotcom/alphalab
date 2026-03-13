"use client";

import { useState } from "react";
import { COMMODITY_RESEARCH } from "@/data/commodityResearch";

type CommodityKey = "OIL" | "GAS" | "GOLD" | "COPPER" | "LITHIUM" | "NICKEL" | "SILVER" | "COAL" | "URANIUM" | "ALUMINUM" | "WHEAT";

// ── i18n ─────────────────────────────────────────────────
const i18n = {
  en: {
    structuralAnalysis: "STRUCTURAL ANALYSIS",
    marketStructure: "MARKET STRUCTURE",
    supplyFundamentals: "SUPPLY FUNDAMENTALS",
    demandStructure: "DEMAND STRUCTURE",
    geopoliticalOverlay: "GEOPOLITICAL OVERLAY",
    historicalContext: "HISTORICAL CONTEXT",
    koreanStockImplications: "KOREAN STOCK IMPLICATIONS",
    collapse: "COLLAPSE",
    expand: "EXPAND",
  },
  kr: {
    structuralAnalysis: "구조적 분석",
    marketStructure: "시장 구조",
    supplyFundamentals: "공급 펀더멘털",
    demandStructure: "수요 구조",
    geopoliticalOverlay: "지정학적 오버레이",
    historicalContext: "역사적 맥락",
    koreanStockImplications: "한국 주식 시사점",
    collapse: "접기",
    expand: "펼치기",
  },
};
type LangKey = "en" | "kr";

const COLLAPSE_KEY_PREFIX = "commodity-research-collapse-";

// ── Component ────────────────────────────────────────────
export default function CommodityResearchPanel({
  commodity,
  lang,
}: {
  commodity: CommodityKey;
  lang: string;
}) {
  const currentLang: LangKey = lang === "kr" ? "kr" : "en";
  const tx = i18n[currentLang];
  const research = COMMODITY_RESEARCH[commodity];

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`${COLLAPSE_KEY_PREFIX}${commodity}`) === "true";
  });

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(`${COLLAPSE_KEY_PREFIX}${commodity}`, String(next));
      return next;
    });
  };

  if (!research) return null;

  const commodityName = currentLang === "kr" ? research.nameKr : research.name;

  const sections = [
    { label: tx.marketStructure, text: research.marketStructure },
    { label: tx.demandStructure, text: research.demandStructure },
    { label: tx.supplyFundamentals, text: research.supplyFundamentals },
    { label: tx.geopoliticalOverlay, text: research.geopoliticalOverlay },
    { label: tx.historicalContext, text: research.historicalContext },
    { label: tx.koreanStockImplications, text: research.koreanStockImplications },
  ];

  return (
    <div>
      {/* ── Header ───────────────────────────────────────── */}
      <div
        className="flex items-center justify-between py-3 cursor-pointer"
        onClick={toggleCollapse}
        style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}
      >
        <h3 className="text-base font-semibold text-white border-l-2 border-yellow-500 pl-2">
          {tx.structuralAnalysis}
        </h3>
        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: "#4b5563" }}>
          {collapsed ? tx.expand : tx.collapse}
        </span>
      </div>

      {/* ── Body ─────────────────────────────────────────── */}
      {!collapsed && (
        <div>
          {sections.map((s, i) => (
            <div
              key={i}
              className="grid grid-cols-[140px_1fr] gap-4 items-start py-3"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className="text-sm font-semibold text-yellow-400">
                {s.label}
              </span>
              <p className="text-sm text-gray-100 leading-relaxed">
                {s.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
