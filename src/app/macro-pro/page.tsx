"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Graticule,
  Sphere,
} from "react-simple-maps";
import { motion, AnimatePresence } from "framer-motion";
import AppHeader from "@/components/AppHeader";
import UsdHegemonyMonitor from "@/components/macro-pro/UsdHegemonyMonitor";
import CommodityResearchPanel from "@/components/macro-pro/CommodityResearchPanel";
import { useLang } from "@/lib/LangContext";
import { COUNTRY_INTEL } from "@/data/countryIntel";

// ── i18n translations ──────────────────────────────────────
const i18n = {
  en: {
    threatLevel: "Threat Level",
    globalRiskIndex: "GLOBAL RISK INDEX",
    countryIntelligence: "Country Intelligence",
    selectCountry: "Select a country marker on the map to view intelligence briefing.",
    activeMonitors: "Active Monitors",
    centralBank: "Central Bank",
    treasury: "Treasury / Finance",
    usdHegemony: "USD Hegemony Monitor",
    commodityExposure: "Commodity Exposure",
    assetImpact: "Asset Impact",
    keyEvent: "Key Event",
    updated: "Updated",
    dAgo: "d ago",
    intelligenceNote: "Intelligence Note",
    commodityLayer: "Commodity Layer",
    topProducers: "Top Producers",
    topConsumers: "Top Consumers",
    supplyRisk: "Supply Risk",
    supplyRisks: "Supply Risks",
    currentPrice: "Current Price",
    threatLabels: { CRITICAL: "CRITICAL", HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW" } as Record<string, string>,
    stanceLabels: { HAWKISH: "HAWKISH", DOVISH: "DOVISH", NEUTRAL: "NEUTRAL", EXPANSIVE: "EXPANSIVE", RESTRICTIVE: "RESTRICTIVE" } as Record<string, string>,
    politicalStance: "POLITICAL STANCE",
    economicCondition: "ECONOMIC CONDITION",
    commodityPosition: "COMMODITY POSITION",
    geopoliticalRisk: "GEOPOLITICAL RISK",
    keyCommodityExposure: "KEY COMMODITY EXPOSURE",
    directionLabels: { EXPORTER: "EXPORTER", "IMPORT RISK": "IMPORT RISK", PRODUCER: "PRODUCER", PROCESSOR: "PROCESSOR", STRANDED: "STRANDED", TRANSIT: "TRANSIT", "TRADING HUB": "TRADING HUB" } as Record<string, string>,
  },
  kr: {
    threatLevel: "위협 수준",
    globalRiskIndex: "글로벌 리스크 지수",
    countryIntelligence: "국가 인텔리전스",
    selectCountry: "지도에서 국가 마커를 클릭하면 인텔리전스 브리핑을 볼 수 있습니다.",
    activeMonitors: "모니터링 국가",
    centralBank: "중앙은행",
    treasury: "재무부 / 재정",
    usdHegemony: "USD 패권 모니터",
    commodityExposure: "원자재 익스포저",
    assetImpact: "자산 영향",
    keyEvent: "주요 이벤트",
    updated: "업데이트",
    dAgo: "일 전",
    intelligenceNote: "인텔리전스 노트",
    commodityLayer: "원자재 레이어",
    topProducers: "주요 생산국",
    topConsumers: "주요 소비국",
    supplyRisk: "공급 리스크",
    supplyRisks: "공급 리스크",
    currentPrice: "현재 가격",
    threatLabels: { CRITICAL: "심각", HIGH: "높음", MEDIUM: "보통", LOW: "낮음" } as Record<string, string>,
    stanceLabels: { HAWKISH: "매파", DOVISH: "비둘기파", NEUTRAL: "중립", EXPANSIVE: "확장적", RESTRICTIVE: "긴축적" } as Record<string, string>,
    politicalStance: "정치 기조",
    economicCondition: "경제 상황",
    commodityPosition: "원자재 포지션",
    geopoliticalRisk: "지정학 리스크",
    keyCommodityExposure: "핵심 원자재 익스포저",
    directionLabels: { EXPORTER: "수출국", "IMPORT RISK": "수입 리스크", PRODUCER: "생산국", PROCESSOR: "가공국", STRANDED: "좌초자산", TRANSIT: "통과국", "TRADING HUB": "트레이딩 허브" } as Record<string, string>,
  },
};
type LangKey = "en" | "kr";

// ── Theme constants (Bloomberg monochrome) ──────────────────
const C = {
  bg: "#080c12",
  ocean: "#020b18",
  land: "#0f1520",
  border: "#1a2030",
  white: "#ffffff",
  text: "#e0e4ea",
  muted: "#6b7280",
  subtle: "#9ca3af",
  dim: "#4b5563",
  red: "#ef4444",
  green: "#22c55e",
  amber: "#f59e0b",
  panelBorder: "rgba(255,255,255,0.08)",
  panelBg: "rgba(8,12,18,0.95)",
  sectionBg: "rgba(255,255,255,0.02)",
} as const;

// ── Types ───────────────────────────────────────────────────
type ThreatLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type Stance = "HAWKISH" | "DOVISH" | "NEUTRAL" | "EXPANSIVE" | "RESTRICTIVE";

interface CentralBank {
  person: string;
  stance: Stance;
  quote: string;
  daysAgo: number;
}

interface Treasury {
  person: string;
  stance: Stance;
  quote: string;
  daysAgo: number;
}

interface CountryData {
  name: string;
  nameKr: string;
  threat: ThreatLevel;
  coordinates: [number, number];
  centralBank?: CentralBank;
  treasury?: Treasury;
  risks: Record<string, number>;
  assetImpact: Record<string, string>;
  keyEvent?: string;
}

// ── Mock data ───────────────────────────────────────────────
const GEO_DATA: Record<string, CountryData> = {
  US: {
    name: "United States",
    nameKr: "미국",

    threat: "MEDIUM",
    coordinates: [-98, 38],
    centralBank: {
      person: "Powell",
      stance: "HAWKISH",
      quote: "Rate cut unlikely before 2H 2026. Inflation remains persistent above target.",
      daysAgo: 2,
    },
    treasury: {
      person: "Bessent",
      stance: "EXPANSIVE",
      quote: "Tariff revenue funds domestic expansion. Strong dollar policy maintained.",
      daysAgo: 1,
    },
    risks: { "Trade War": 80, "Middle East": 95, NATO: 40, "Debt Ceiling": 60 },
    assetImpact: { USD: "+2", Bonds: "-1", Gold: "+1", EM: "-2" },
    keyEvent: "Tariff escalation with China — 60% on all imports effective Q2",
  },
  CN: {
    name: "China",
    nameKr: "중국",
    threat: "HIGH",
    coordinates: [104, 35],
    centralBank: {
      person: "Pan Gongsheng",
      stance: "DOVISH",
      quote: "Further easing to support growth. RRR cut expected in coming weeks.",
      daysAgo: 3,
    },
    treasury: {
      person: "Lan Fo'an",
      stance: "EXPANSIVE",
      quote: "Special bonds issuance expanded to 4.5T yuan for infrastructure.",
      daysAgo: 5,
    },
    risks: { "Trade War": 90, "Taiwan Strait": 85, "Property Crisis": 75, "Capital Flight": 65 },
    assetImpact: { CNY: "-2", "A-Shares": "-1", Copper: "-1", Gold: "+1" },
    keyEvent: "Retaliatory tariffs on US agricultural products — 45%",
  },
  EU: {
    name: "European Union",
    nameKr: "유럽연합",
    threat: "MEDIUM",
    coordinates: [10, 50],
    centralBank: {
      person: "Lagarde",
      stance: "NEUTRAL",
      quote: "Data-dependent approach. Growth outlook weakened but inflation moderating.",
      daysAgo: 4,
    },
    risks: { "Energy Security": 55, "Ukraine War": 70, "Trade War": 50, "Banking Risk": 35 },
    assetImpact: { EUR: "0", DAX: "+1", Bunds: "+1", Gold: "+1" },
    keyEvent: "EU defense spending package — €150B collective procurement",
  },
  JP: {
    name: "Japan",
    nameKr: "일본",
    threat: "LOW",
    coordinates: [138, 36],
    centralBank: {
      person: "Ueda",
      stance: "HAWKISH",
      quote: "Gradual normalization continues. Next rate hike data-dependent.",
      daysAgo: 7,
    },
    risks: { "Yen Volatility": 60, "BOJ Policy": 50, "Demographics": 40 },
    assetImpact: { JPY: "+1", Nikkei: "-1", "JGB 10Y": "-1" },
    keyEvent: "BOJ rate at 0.75% — highest since 2008",
  },
  KR: {
    name: "South Korea",
    nameKr: "대한민국",
    threat: "MEDIUM",
    coordinates: [127.5, 36],
    centralBank: {
      person: "Rhee Chang-yong",
      stance: "NEUTRAL",
      quote: "Monitoring household debt and exchange rate closely before any cut.",
      daysAgo: 6,
    },
    risks: { "North Korea": 45, "Trade War Spillover": 65, "Household Debt": 55, "Chipwar": 50 },
    assetImpact: { KRW: "-1", KOSPI: "0", "KR 10Y": "+1", Samsung: "+1" },
    keyEvent: "Semiconductor export controls affecting chip equipment supply chain",
  },
  RU: {
    name: "Russia",
    nameKr: "러시아",
    threat: "CRITICAL",
    coordinates: [60, 60],
    centralBank: {
      person: "Nabiullina",
      stance: "HAWKISH",
      quote: "Key rate at 21%. Inflation driven by war spending and sanctions.",
      daysAgo: 10,
    },
    risks: { "Ukraine War": 100, Sanctions: 90, "Energy Revenue": 70, "Ruble Stability": 80 },
    assetImpact: { Oil: "+2", Gas: "+2", Wheat: "+1", Gold: "+1" },
    keyEvent: "Escalation in offensive — NATO intelligence sharing expanded",
  },
  IR: {
    name: "Iran",
    nameKr: "이란",
    threat: "CRITICAL",
    coordinates: [53, 32],
    risks: { "Nuclear Program": 95, "Proxy Wars": 90, "US Tensions": 85, "Oil Sanctions": 80 },
    assetImpact: { Oil: "+3", Gold: "+2", "Safe Haven": "+2" },
    keyEvent: "IAEA reports enrichment at 83.7% — near weapons-grade",
  },
  SA: {
    name: "Saudi Arabia",
    nameKr: "사우디아라비아",
    threat: "LOW",
    coordinates: [45, 24],
    risks: { "Oil Price": 50, "OPEC+ Cuts": 45, "Geopolitical": 40 },
    assetImpact: { Oil: "+1", USD: "+1" },
    keyEvent: "OPEC+ production cut extended through Q3 2026",
  },
  IN: {
    name: "India",
    nameKr: "인도",
    threat: "LOW",
    coordinates: [78, 22],
    centralBank: {
      person: "Malhotra",
      stance: "NEUTRAL",
      quote: "Rate pause to assess monsoon impact on food prices and growth trajectory.",
      daysAgo: 8,
    },
    risks: { "Capital Flows": 35, "Inflation": 40, "Geopolitical": 30 },
    assetImpact: { INR: "+1", Nifty: "+2", "FDI Inflow": "+2" },
    keyEvent: "Surpassed China in FDI inflows for third consecutive quarter",
  },
  // ── AMERICAS ──
  CA: {
    name: "Canada", nameKr: "캐나다", threat: "LOW", coordinates: [-106, 56],
    risks: { "Trade War": 45, "Housing Bubble": 50, "Energy Transition": 35 },
    assetImpact: { CAD: "0", TSX: "+1", Oil: "+1" },
  },
  VE: {
    name: "Venezuela", nameKr: "베네수엘라", threat: "HIGH", coordinates: [-66, 7],
    risks: { Sanctions: 80, "Oil Output": 60, "Political Crisis": 90 },
    assetImpact: { Oil: "+1" },
  },
  CL: {
    name: "Chile", nameKr: "칠레", threat: "LOW", coordinates: [-71, -30],
    risks: { "Copper Nationalism": 40, "Lithium Policy": 50 },
    assetImpact: { Copper: "+1", Lithium: "+1" },
  },
  AR: {
    name: "Argentina", nameKr: "아르헨티나", threat: "MEDIUM", coordinates: [-64, -34],
    risks: { "Peso Crisis": 65, "IMF Debt": 55, "Lithium Reserves": 30 },
    assetImpact: { Lithium: "+1" },
  },
  BR: {
    name: "Brazil", nameKr: "브라질", threat: "MEDIUM", coordinates: [-51, -14],
    risks: { Deforestation: 40, "Capital Flows": 45, "Commodity Cycle": 50 },
    assetImpact: { BRL: "-1", Iron: "+1" },
  },
  MX: {
    name: "Mexico", nameKr: "멕시코", threat: "MEDIUM", coordinates: [-102, 24],
    risks: { "Nearshoring Risk": 35, "US Tariffs": 55, "Energy Reform": 45 },
    assetImpact: { MXN: "-1", Silver: "+1" },
  },
  PE: {
    name: "Peru", nameKr: "페루", threat: "LOW", coordinates: [-76, -10],
    risks: { "Political Instability": 45, "Mining Policy": 40 },
    assetImpact: { Copper: "+1", Silver: "+1" },
  },
  // ── EUROPE ──
  DE: {
    name: "Germany", nameKr: "독일", threat: "LOW", coordinates: [10, 51],
    risks: { "Energy Costs": 50, "Industrial Recession": 45, "China Dependence": 40 },
    assetImpact: { EUR: "0", DAX: "+1" },
  },
  FR: {
    name: "France", nameKr: "프랑스", threat: "LOW", coordinates: [2, 47],
    risks: { "Fiscal Deficit": 45, "Political Fragmentation": 40 },
    assetImpact: { EUR: "0", CAC: "+1" },
  },
  GB: {
    name: "United Kingdom", nameKr: "영국", threat: "LOW", coordinates: [-2, 54],
    risks: { "Post-Brexit Friction": 35, "Stagflation": 40 },
    assetImpact: { GBP: "0", FTSE: "+1" },
  },
  PL: {
    name: "Poland", nameKr: "폴란드", threat: "MEDIUM", coordinates: [20, 52],
    risks: { "NATO Frontline": 55, "Ukraine Spillover": 50, "Defense Spend": 40 },
    assetImpact: { PLN: "-1" },
  },
  NO: {
    name: "Norway", nameKr: "노르웨이", threat: "LOW", coordinates: [10, 62],
    risks: { "Oil Revenue Dependence": 35, "Sovereign Fund": 20 },
    assetImpact: { NOK: "+1", Gas: "+1" },
  },
  TR: {
    name: "Turkey", nameKr: "튀르키예", threat: "MEDIUM", coordinates: [35, 39],
    risks: { "Lira Crisis": 70, "Inflation": 65, "NATO Tensions": 45 },
    assetImpact: { TRY: "-2", Gold: "+1" },
  },
  // ── MIDDLE EAST ──
  QA: {
    name: "Qatar", nameKr: "카타르", threat: "LOW", coordinates: [51, 25],
    risks: { "LNG Contracts": 25, "Regional Diplomacy": 30 },
    assetImpact: { LNG: "+1" },
  },
  AE: {
    name: "UAE", nameKr: "아랍에미리트", threat: "LOW", coordinates: [54, 24],
    risks: { "Oil Diversification": 30, "Regional Stability": 25 },
    assetImpact: { Oil: "+1" },
  },
  KW: {
    name: "Kuwait", nameKr: "쿠웨이트", threat: "LOW", coordinates: [48, 29],
    risks: { "OPEC+ Quota": 30, "Oil Dependence": 45 },
    assetImpact: { Oil: "+1" },
  },
  IQ: {
    name: "Iraq", nameKr: "이라크", threat: "HIGH", coordinates: [44, 33],
    risks: { "Sectarian Conflict": 70, "Oil Infrastructure": 60, "Iran Influence": 65 },
    assetImpact: { Oil: "+2" },
  },
  YE: {
    name: "Yemen", nameKr: "예멘", threat: "CRITICAL", coordinates: [48, 15],
    risks: { "Houthi Attacks": 95, "Bab el-Mandeb": 90, "Shipping Disruption": 85 },
    assetImpact: { Oil: "+2", Container: "+2" },
  },
  // ── AFRICA ──
  NG: {
    name: "Nigeria", nameKr: "나이지리아", threat: "MEDIUM", coordinates: [8, 10],
    risks: { "Oil Theft": 55, "FX Crisis": 60, "Security": 50 },
    assetImpact: { Oil: "+1" },
  },
  ZA: {
    name: "South Africa", nameKr: "남아프리카공화국", threat: "LOW", coordinates: [25, -29],
    risks: { "Load Shedding": 45, "Mining Policy": 40, "Rand Volatility": 35 },
    assetImpact: { Gold: "+1", Platinum: "+1" },
  },
  CD: {
    name: "DR Congo", nameKr: "콩고민주공화국", threat: "HIGH", coordinates: [24, -4],
    risks: { "Conflict Minerals": 80, "Cobalt Supply": 75, "Political Instability": 70 },
    assetImpact: { Copper: "+2", Cobalt: "+2" },
  },
  // ── ASIA PACIFIC ──
  TW: {
    name: "Taiwan", nameKr: "대만", threat: "HIGH", coordinates: [121, 24],
    risks: { "PLA Activity": 80, "Semiconductor Supply": 85, "US-China Proxy": 75 },
    assetImpact: { TSMC: "+2", SOX: "+2", Gold: "+1" },
  },
  PK: {
    name: "Pakistan", nameKr: "파키스탄", threat: "MEDIUM", coordinates: [70, 30],
    risks: { "IMF Program": 55, "Security": 50, "FX Pressure": 60 },
    assetImpact: { PKR: "-1" },
  },
  KZ: {
    name: "Kazakhstan", nameKr: "카자흐스탄", threat: "LOW", coordinates: [67, 48],
    risks: { "Russia Dependence": 40, "Uranium Supply": 35 },
    assetImpact: { Uranium: "+1", Oil: "+1" },
  },
  MN: {
    name: "Mongolia", nameKr: "몽골", threat: "LOW", coordinates: [104, 47],
    risks: { "China Dependence": 50, "Mining Revenue": 40 },
    assetImpact: { Copper: "+1", Coal: "+1" },
  },
  AU: {
    name: "Australia", nameKr: "호주", threat: "LOW", coordinates: [134, -25],
    risks: { "China Trade": 45, "Iron Ore Dependence": 40, "Housing Bubble": 35 },
    assetImpact: { AUD: "+1", Iron: "+1", Gold: "+1", Lithium: "+1" },
  },
  ID: {
    name: "Indonesia", nameKr: "인도네시아", threat: "MEDIUM", coordinates: [118, -2],
    risks: { "Nickel Export Ban": 65, "SCS Disputes": 50, "Deforestation": 40 },
    assetImpact: { Nickel: "+2", Coal: "+1" },
  },
  PH: {
    name: "Philippines", nameKr: "필리핀", threat: "MEDIUM", coordinates: [122, 12],
    risks: { "SCS Standoff": 70, "China Friction": 60, "Nickel Output": 40 },
    assetImpact: { Nickel: "+1" },
  },
  TH: {
    name: "Thailand", nameKr: "태국", threat: "LOW", coordinates: [101, 14],
    risks: { "Tourism Dependence": 30, "Political Stability": 35 },
    assetImpact: { Gold: "+1" },
  },
  NA: {
    name: "Namibia", nameKr: "나미비아", threat: "LOW", coordinates: [17, -22],
    risks: { "Uranium Dependence": 40, "Chinese Investment": 30 },
    assetImpact: { Uranium: "+1" },
  },
  UZ: {
    name: "Uzbekistan", nameKr: "우즈베키스탄", threat: "LOW", coordinates: [64, 41],
    risks: { "Russia Dependence": 35, "Uranium Output": 30 },
    assetImpact: { Uranium: "+1", Gold: "+1" },
  },
  EG: {
    name: "Egypt", nameKr: "이집트", threat: "MEDIUM", coordinates: [30, 27],
    risks: { "Suez Revenue": 60, "Food Import Dependence": 70, "Currency Crisis": 55 },
    assetImpact: { Wheat: "+2", Suez: "+1" },
  },
};


// ── Commodity layer data (2024) ──────────────────────────────
type CommodityKey = "OIL" | "GAS" | "GOLD" | "COPPER" | "LITHIUM" | "NICKEL" | "SILVER" | "COAL" | "URANIUM" | "ALUMINUM" | "WHEAT";
const COMMODITY_TABS: ("ALL" | CommodityKey)[] = ["ALL", "OIL", "GAS", "GOLD", "COPPER", "LITHIUM", "NICKEL", "SILVER", "COAL", "URANIUM", "ALUMINUM", "WHEAT"];
const COMMODITY_TAB_LABELS: Record<string, string> = {
  ALL: "ALL", OIL: "OIL", GAS: "GAS/LNG", GOLD: "GOLD", COPPER: "COPPER",
  LITHIUM: "LITHIUM", NICKEL: "NICKEL", SILVER: "SILVER", COAL: "COAL",
  URANIUM: "URANIUM", ALUMINUM: "ALUMINUM", WHEAT: "WHEAT",
};

interface CommodityProducer {
  id: string;
  rank: number;
  share: string;
}

interface CommodityConsumer {
  id: string;
  rank: number;
  share: string;
}

interface CommodityLayerData {
  label: string;
  ticker: string;
  producers: CommodityProducer[];
  consumers: CommodityConsumer[];
  supplyRisk: number;
  riskNote: string;
}

const COMMODITY_LAYERS: Record<CommodityKey, CommodityLayerData> = {
  OIL: {
    label: "CRUDE OIL", ticker: "WTI",
    producers: [
      { id: "US", rank: 1, share: "22%" },
      { id: "SA", rank: 2, share: "11%" },
      { id: "RU", rank: 3, share: "11%" },
      { id: "CA", rank: 4, share: "6%" },
      { id: "IQ", rank: 5, share: "5%" },
    ],
    consumers: [
      { id: "US", rank: 1, share: "20%" },
      { id: "CN", rank: 2, share: "16%" },
      { id: "IN", rank: 3, share: "5%" },
      { id: "JP", rank: 4, share: "4%" },
      { id: "SA", rank: 5, share: "3%" },
    ],
    supplyRisk: 72,
    riskNote: "OPEC+ controls 60% of reserves. Hormuz closure = price spike $120-150/bbl",
  },
  GAS: {
    label: "NATURAL GAS / LNG", ticker: "NATGAS",
    producers: [
      { id: "US", rank: 1, share: "24%" },
      { id: "RU", rank: 2, share: "16%" },
      { id: "IR", rank: 3, share: "7%" },
      { id: "CN", rank: 4, share: "6%" },
      { id: "CA", rank: 5, share: "5%" },
    ],
    consumers: [
      { id: "US", rank: 1, share: "22%" },
      { id: "RU", rank: 2, share: "12%" },
      { id: "CN", rank: 3, share: "10%" },
      { id: "IR", rank: 4, share: "6%" },
      { id: "CA", rank: 5, share: "3%" },
    ],
    supplyRisk: 65,
    riskNote: "Russia-EU gas war ongoing. US LNG exports at record high 2024",
  },
  GOLD: {
    label: "GOLD", ticker: "GOLD",
    producers: [
      { id: "CN", rank: 1, share: "10%" },
      { id: "RU", rank: 2, share: "9%" },
      { id: "AU", rank: 3, share: "8%" },
      { id: "CA", rank: 4, share: "6%" },
      { id: "US", rank: 5, share: "5%" },
    ],
    consumers: [
      { id: "CN", rank: 1, share: "25%" },
      { id: "IN", rank: 2, share: "23%" },
      { id: "US", rank: 3, share: "8%" },
      { id: "DE", rank: 4, share: "4%" },
      { id: "TH", rank: 5, share: "3%" },
    ],
    supplyRisk: 35,
    riskNote: "Diversified supply. Central bank buying at record high 2024-2025",
  },
  COPPER: {
    label: "COPPER", ticker: "COPPER",
    producers: [
      { id: "CL", rank: 1, share: "27%" },
      { id: "CD", rank: 2, share: "13%" },
      { id: "PE", rank: 3, share: "11%" },
      { id: "CN", rank: 4, share: "8%" },
      { id: "AU", rank: 5, share: "4%" },
    ],
    consumers: [
      { id: "CN", rank: 1, share: "55%" },
      { id: "US", rank: 2, share: "8%" },
      { id: "DE", rank: 3, share: "4%" },
      { id: "JP", rank: 4, share: "4%" },
      { id: "KR", rank: 5, share: "3%" },
    ],
    supplyRisk: 68,
    riskNote: "Chile+DRC = 40% of supply. DRC = Chinese-controlled mines. Critical for EVs",
  },
  LITHIUM: {
    label: "LITHIUM", ticker: "--",
    producers: [
      { id: "AU", rank: 1, share: "47%" },
      { id: "CL", rank: 2, share: "26%" },
      { id: "CN", rank: 3, share: "13%" },
      { id: "AR", rank: 4, share: "8%" },
      { id: "BR", rank: 5, share: "2%" },
    ],
    consumers: [
      { id: "CN", rank: 1, share: "60%" },
      { id: "US", rank: 2, share: "14%" },
      { id: "DE", rank: 3, share: "7%" },
      { id: "JP", rank: 4, share: "5%" },
      { id: "KR", rank: 5, share: "4%" },
    ],
    supplyRisk: 78,
    riskNote: "'Lithium Triangle' (Chile+Argentina+Bolivia) = 58% of reserves. China controls refining",
  },
  NICKEL: {
    label: "NICKEL", ticker: "--",
    producers: [
      { id: "ID", rank: 1, share: "52%" },
      { id: "PH", rank: 2, share: "10%" },
      { id: "RU", rank: 3, share: "7%" },
      { id: "CN", rank: 4, share: "5%" },
      { id: "AU", rank: 5, share: "4%" },
    ],
    consumers: [
      { id: "CN", rank: 1, share: "60%" },
      { id: "IN", rank: 2, share: "7%" },
      { id: "JP", rank: 3, share: "6%" },
      { id: "US", rank: 4, share: "5%" },
      { id: "KR", rank: 5, share: "4%" },
    ],
    supplyRisk: 82,
    riskNote: "Indonesia = dominant. Export ban policy. Critical for EV batteries",
  },
  SILVER: {
    label: "SILVER", ticker: "SILVER",
    producers: [
      { id: "MX", rank: 1, share: "23%" },
      { id: "PE", rank: 2, share: "14%" },
      { id: "CN", rank: 3, share: "13%" },
      { id: "RU", rank: 4, share: "7%" },
      { id: "CL", rank: 5, share: "6%" },
    ],
    consumers: [
      { id: "CN", rank: 1, share: "18%" },
      { id: "IN", rank: 2, share: "12%" },
      { id: "US", rank: 3, share: "11%" },
      { id: "JP", rank: 4, share: "8%" },
      { id: "DE", rank: 5, share: "5%" },
    ],
    supplyRisk: 45,
    riskNote: "Industrial demand rising (solar panels, EVs). Supply relatively diversified",
  },
  COAL: {
    label: "COAL", ticker: "--",
    producers: [
      { id: "CN", rank: 1, share: "51%" },
      { id: "IN", rank: 2, share: "11%" },
      { id: "ID", rank: 3, share: "8%" },
      { id: "AU", rank: 4, share: "7%" },
      { id: "US", rank: 5, share: "6%" },
    ],
    consumers: [
      { id: "CN", rank: 1, share: "53%" },
      { id: "IN", rank: 2, share: "14%" },
      { id: "US", rank: 3, share: "6%" },
      { id: "JP", rank: 4, share: "4%" },
      { id: "KR", rank: 5, share: "3%" },
    ],
    supplyRisk: 55,
    riskNote: "China = majority producer AND consumer. Indonesia ban risk. Phase-out pressure growing",
  },
  URANIUM: {
    label: "URANIUM", ticker: "--",
    producers: [
      { id: "KZ", rank: 1, share: "43%" },
      { id: "CA", rank: 2, share: "15%" },
      { id: "NA", rank: 3, share: "11%" },
      { id: "AU", rank: 4, share: "9%" },
      { id: "UZ", rank: 5, share: "7%" },
    ],
    consumers: [
      { id: "US", rank: 1, share: "30%" },
      { id: "FR", rank: 2, share: "17%" },
      { id: "CN", rank: 3, share: "12%" },
      { id: "KR", rank: 4, share: "6%" },
      { id: "JP", rank: 5, share: "5%" },
    ],
    supplyRisk: 85,
    riskNote: "Kazakhstan = 43% supply, Russian influence. Enrichment bottleneck (Russia 44%). Nuclear renaissance demand surge",
  },
  ALUMINUM: {
    label: "ALUMINUM", ticker: "--",
    producers: [
      { id: "CN", rank: 1, share: "57%" },
      { id: "IN", rank: 2, share: "6%" },
      { id: "RU", rank: 3, share: "5%" },
      { id: "CA", rank: 4, share: "4%" },
      { id: "AE", rank: 5, share: "4%" },
    ],
    consumers: [
      { id: "CN", rank: 1, share: "60%" },
      { id: "US", rank: 2, share: "10%" },
      { id: "DE", rank: 3, share: "5%" },
      { id: "JP", rank: 4, share: "4%" },
      { id: "IN", rank: 5, share: "4%" },
    ],
    supplyRisk: 70,
    riskNote: "China = 57% production with smelting cap policy. Rusal sanctions. CBAM impact on trade flows",
  },
  WHEAT: {
    label: "WHEAT", ticker: "--",
    producers: [
      { id: "CN", rank: 1, share: "18%" },
      { id: "IN", rank: 2, share: "13%" },
      { id: "RU", rank: 3, share: "11%" },
      { id: "US", rank: 4, share: "9%" },
      { id: "FR", rank: 5, share: "6%" },
    ],
    consumers: [
      { id: "CN", rank: 1, share: "18%" },
      { id: "IN", rank: 2, share: "14%" },
      { id: "EG", rank: 3, share: "5%" },
      { id: "RU", rank: 4, share: "5%" },
      { id: "US", rank: 5, share: "4%" },
    ],
    supplyRisk: 75,
    riskNote: "Black Sea = 30% of global wheat exports. Russia-Ukraine war structural supply risk. India export bans",
  },
};

// ── Continent groups for left panel ──────────────────────────
const CONTINENT_GROUPS: { key: string; label: string; labelKr: string; codes: string[] }[] = [
  { key: "AMERICAS", label: "AMERICAS", labelKr: "아메리카", codes: ["US", "CA", "MX", "BR", "AR", "CL", "PE", "VE"] },
  { key: "EUROPE", label: "EUROPE", labelKr: "유럽", codes: ["EU", "GB", "DE", "FR", "NO", "PL", "TR", "RU"] },
  { key: "MIDDLE_EAST", label: "MIDDLE EAST", labelKr: "중동", codes: ["SA", "IR", "AE", "QA", "KW", "IQ", "YE", "EG"] },
  { key: "AFRICA", label: "AFRICA", labelKr: "아프리카", codes: ["NG", "ZA", "CD", "NA"] },
  { key: "ASIA_PACIFIC", label: "ASIA PACIFIC", labelKr: "아시아 태평양", codes: ["CN", "JP", "KR", "IN", "TW", "AU", "ID", "PH", "TH", "PK", "KZ", "MN", "UZ"] },
];

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ── Helpers ─────────────────────────────────────────────────
function threatColor(t: ThreatLevel): string {
  switch (t) {
    case "CRITICAL": return C.red;
    case "HIGH": return C.amber;
    case "MEDIUM": return C.subtle;
    case "LOW": return C.dim;
  }
}

function stanceColor(s: Stance): string {
  switch (s) {
    case "HAWKISH": return C.red;
    case "DOVISH": return C.green;
    case "NEUTRAL": return C.subtle;
    case "EXPANSIVE": return C.amber;
    case "RESTRICTIVE": return C.red;
  }
}

function stanceArrow(s: Stance): string {
  switch (s) {
    case "HAWKISH": return "\u25B2";
    case "DOVISH": return "\u25BC";
    case "EXPANSIVE": return "\u25B2";
    case "RESTRICTIVE": return "\u25BC";
    default: return "\u25C6";
  }
}

// ── Country panel component ─────────────────────────────────
function CountryPanel({ code, data, onClose, lang }: { code: string; data: CountryData; onClose: () => void; lang: LangKey }) {
  const tx = i18n[lang];
  const sectionStyle = { border: `1px solid ${C.panelBorder}`, background: C.sectionBg, padding: 12, borderRadius: 2 };
  const labelStyle = { color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" };
  return (
    <motion.div
      initial={{ x: 8, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 8, opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="h-full overflow-y-auto"
      style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold font-[family-name:var(--font-jetbrains)]" style={{ color: C.white }}>{code}</span>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider font-[family-name:var(--font-jetbrains)]" style={{ color: C.white }}>
              {lang === "kr" ? data.nameKr : data.name}
            </h2>
            <span className="text-[12px]" style={{ color: C.dim }}>{lang === "kr" ? data.name : data.nameKr}</span>
          </div>
        </div>
        <button onClick={onClose} className="text-sm opacity-40 hover:opacity-100 transition-opacity px-2 py-1">&times;</button>
      </div>

      {/* Threat Level */}
      <div className="mb-2 panel-section" style={sectionStyle}>
        <span className="text-[10px] uppercase tracking-widest font-[family-name:var(--font-jetbrains)]" style={labelStyle}>{tx.threatLevel}</span>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-sm font-bold font-[family-name:var(--font-jetbrains)] tracking-wider" style={{ color: threatColor(data.threat) }}>{tx.threatLabels[data.threat]}</span>
        </div>
      </div>

      {/* Central Bank */}
      {data.centralBank && (
        <div className="mb-2 panel-section" style={sectionStyle}>
          <span className="text-[10px] uppercase tracking-widest font-[family-name:var(--font-jetbrains)]" style={labelStyle}>{tx.centralBank}</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[13px] font-bold font-[family-name:var(--font-jetbrains)]" style={{ color: C.white }}>{data.centralBank.person}</span>
            <span className="text-[13px]" style={{ color: C.dim }}>/</span>
            <span className="text-[13px] font-bold font-[family-name:var(--font-jetbrains)]" style={{ color: stanceColor(data.centralBank.stance) }}>
              {tx.stanceLabels[data.centralBank.stance]} {stanceArrow(data.centralBank.stance)}
            </span>
          </div>
          <p className="text-[12px] mt-1 leading-6 italic" style={{ color: "rgba(255,255,255,0.5)" }}>&ldquo;{data.centralBank.quote}&rdquo;</p>
          <p className="text-[11px] mt-1" style={{ color: C.dim }}>{tx.updated}: {data.centralBank.daysAgo}{tx.dAgo}</p>
        </div>
      )}

      {/* Treasury */}
      {data.treasury && (
        <div className="mb-2 panel-section" style={sectionStyle}>
          <span className="text-[10px] uppercase tracking-widest font-[family-name:var(--font-jetbrains)]" style={labelStyle}>{tx.treasury}</span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[13px] font-bold font-[family-name:var(--font-jetbrains)]" style={{ color: C.white }}>{data.treasury.person}</span>
            <span className="text-[13px]" style={{ color: C.dim }}>/</span>
            <span className="text-[13px] font-bold font-[family-name:var(--font-jetbrains)]" style={{ color: stanceColor(data.treasury.stance) }}>
              {tx.stanceLabels[data.treasury.stance]} {stanceArrow(data.treasury.stance)}
            </span>
          </div>
          <p className="text-[12px] mt-1 leading-6 italic" style={{ color: "rgba(255,255,255,0.5)" }}>&ldquo;{data.treasury.quote}&rdquo;</p>
          <p className="text-[11px] mt-1" style={{ color: C.dim }}>{tx.updated}: {data.treasury.daysAgo}{tx.dAgo}</p>
        </div>
      )}

      {/* Country Intelligence Briefing */}
      {(() => {
        const intel = COUNTRY_INTEL[code];
        if (!intel) return null;
        const IntelSection = ({ label, text }: { label: string; text: string }) => (
          <div className="mb-2 panel-section" style={sectionStyle}>
            <span className="text-[10px] uppercase tracking-widest font-bold font-[family-name:var(--font-jetbrains)]" style={labelStyle}>
              {label}
            </span>
            <p className="text-[12px] leading-6 mt-1.5 font-[family-name:var(--font-jetbrains)]" style={{ color: "rgba(255,255,255,0.6)" }}>
              {text}
            </p>
          </div>
        );
        return (
          <>
            <IntelSection label={tx.politicalStance} text={intel.political} />
            <IntelSection label={tx.economicCondition} text={intel.economic} />
            <IntelSection label={tx.commodityPosition} text={intel.commodity} />
            <IntelSection label={tx.geopoliticalRisk} text={intel.geopolitical} />

            {/* KEY COMMODITY EXPOSURE */}
            {intel.commodityExposure && intel.commodityExposure.length > 0 && (
              <div className="mb-2 panel-section" style={sectionStyle}>
                <span className="text-[10px] uppercase tracking-widest font-bold font-[family-name:var(--font-jetbrains)]" style={labelStyle}>
                  {tx.keyCommodityExposure}
                </span>
                <div className="space-y-2 mt-2">
                  {intel.commodityExposure.map((exp, i) => {
                    const isExporter = exp.direction === "EXPORTER" || exp.direction === "PRODUCER";
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <span
                          className="text-[11px] font-bold font-[family-name:var(--font-jetbrains)] shrink-0 rounded"
                          style={{ padding: "2px 6px", border: `1px solid rgba(255,255,255,0.2)`, color: "rgba(255,255,255,0.7)" }}
                        >
                          {exp.commodity}
                        </span>
                        <span
                          className="text-[11px] font-bold font-[family-name:var(--font-jetbrains)] shrink-0 rounded"
                          style={{ padding: "2px 6px", border: `1px solid ${isExporter ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.15)"}`, color: isExporter ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.5)" }}
                        >
                          {tx.directionLabels[exp.direction] || exp.direction}
                        </span>
                        <span className="text-[11px] font-[family-name:var(--font-jetbrains)] leading-relaxed" style={{ color: C.subtle }}>
                          {exp.reason}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* USD Hegemony Monitor — US only */}
      {code === "US" && (
        <div className="mb-2">
          <UsdHegemonyMonitor lang={lang} />
        </div>
      )}

      {/* Key Event */}
      {data.keyEvent && (
        <div style={{ border: `1px solid ${C.panelBorder}`, background: C.sectionBg, padding: 12, borderRadius: 2 }}>
          <span className="text-[10px] uppercase tracking-widest font-[family-name:var(--font-jetbrains)]" style={labelStyle}>{tx.keyEvent}</span>
          <p className="text-[12px] mt-1 leading-6" style={{ color: "rgba(255,255,255,0.6)" }}>{data.keyEvent}</p>
        </div>
      )}
    </motion.div>
  );
}

// ── Static price fallbacks for commodities not in Yahoo API ──
const STATIC_PRICES: Record<string, { price: string; unit: string }> = {
  LITHIUM: { price: "~$12,000", unit: "/t (SMM)" },
  COAL: { price: "$220", unit: "/t HCC" },
  URANIUM: { price: "$95", unit: "/lb" },
};

// ── Unit labels per commodity ──
const COMMODITY_UNITS: Record<CommodityKey, string> = {
  OIL: "/bbl", GAS: "/MMBtu", GOLD: "/oz", COPPER: "/lb",
  LITHIUM: "/t", NICKEL: "/t", SILVER: "/oz", COAL: "/t",
  URANIUM: "/lb", ALUMINUM: "/ton", WHEAT: "/bu",
};

interface PriceHistoryEntry { price: number | null; change: number | null }

// ── Commodity intel panel ─────────────────────────────────────
function CommodityIntelPanel({ commodity, lang }: { commodity: CommodityKey; lang: LangKey }) {
  const tx = i18n[lang];
  const data = COMMODITY_LAYERS[commodity];
  const riskColor = data.supplyRisk >= 66 ? C.red : data.supplyRisk >= 41 ? C.amber : C.green;

  const [priceData, setPriceData] = useState<{
    currentPrice: number;
    changePercent: number;
    unit: string;
    history: Record<string, PriceHistoryEntry>;
    updatedAt: string;
  } | null>(null);
  const [priceLoading, setPriceLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setPriceLoading(true);
    fetch(`/api/commodity-price-history?commodity=${commodity}`, { signal: AbortSignal.timeout(15000) })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.ok) setPriceData(json);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPriceLoading(false); });
    return () => { cancelled = true; };
  }, [commodity]);

  const staticPrice = STATIC_PRICES[commodity];
  const hasLivePrice = priceData && priceData.currentPrice > 0;
  const updatedTime = priceData?.updatedAt
    ? new Date(priceData.updatedAt).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }) + " KST"
    : "";

  const periodLabels = lang === "kr"
    ? { "1m": "1개월 전", "3m": "3개월 전", "6m": "6개월 전", "1y": "1년 전" }
    : { "1m": "1M ago", "3m": "3M ago", "6m": "6M ago", "1y": "1Y ago" };
  const collecting = lang === "kr" ? "데이터 수집 중" : "Collecting...";

  return (
    <motion.div
      initial={{ x: 8, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 8, opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="h-full overflow-y-auto"
      style={{ scrollbarWidth: "thin", scrollbarColor: `rgba(255,255,255,0.15) transparent` }}
    >
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-base font-bold uppercase tracking-wider font-[family-name:var(--font-rajdhani)]" style={{ color: C.white }}>
          {data.label}
        </h2>
        <span className="text-[10px] uppercase tracking-widest font-[family-name:var(--font-jetbrains)]" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>{tx.commodityLayer}</span>
      </div>

      {/* Current Price */}
      <div className="mb-2 panel-section" style={{ border: `1px solid ${C.panelBorder}`, background: C.sectionBg, padding: 12, borderRadius: 2 }}>
        <span className="text-[10px] uppercase tracking-widest font-[family-name:var(--font-jetbrains)]" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>{tx.currentPrice}</span>
        {priceLoading ? (
          <div className="mt-2 h-6 w-32 rounded" style={{ background: "rgba(255,255,255,0.05)", animation: "threatPulse 1.5s infinite" }} />
        ) : hasLivePrice ? (
          <>
            <p className="text-[22px] font-bold font-[family-name:var(--font-jetbrains)] mt-1" style={{ color: C.white }}>
              ${priceData.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-[13px] ml-1" style={{ color: C.muted }}>{COMMODITY_UNITS[commodity]}</span>
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="text-[13px] font-bold font-[family-name:var(--font-jetbrains)]"
                style={{ color: priceData.changePercent >= 0 ? C.green : C.red }}
              >
                {priceData.changePercent >= 0 ? "+" : ""}{priceData.changePercent.toFixed(2)}%
              </span>
              <span className="text-[11px] font-[family-name:var(--font-jetbrains)]" style={{ color: C.dim }}>
                {updatedTime} 기준
              </span>
            </div>
          </>
        ) : staticPrice ? (
          <p className="text-[22px] font-bold font-[family-name:var(--font-jetbrains)] mt-1" style={{ color: C.white }}>
            {staticPrice.price}<span className="text-[13px] ml-1" style={{ color: C.muted }}>{staticPrice.unit}</span>
          </p>
        ) : (
          <p className="text-[14px] font-bold font-[family-name:var(--font-jetbrains)] mt-1" style={{ color: C.muted }}>--</p>
        )}
      </div>

      {/* Price History Comparison */}
      {hasLivePrice && priceData.history && (
        <div className="mb-2 panel-section" style={{ border: `1px solid ${C.panelBorder}`, background: C.sectionBg, padding: 12, borderRadius: 2 }}>
          <span className="text-[10px] uppercase tracking-widest font-[family-name:var(--font-jetbrains)]" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>
            {lang === "kr" ? "가격 비교" : "PRICE COMPARISON"}
          </span>
          <div className="mt-2 space-y-1.5">
            {(["1m", "3m", "6m", "1y"] as const).map((key) => {
              const h = priceData.history[key];
              const hasData = h && h.price !== null && h.change !== null;
              return (
                <div key={key} className="flex items-center gap-2 font-[family-name:var(--font-jetbrains)]">
                  <span className="text-[12px] opacity-40 w-[72px] shrink-0">{periodLabels[key]}</span>
                  {hasData ? (
                    <>
                      <span className="text-[13px] opacity-60 tabular-nums flex-1">
                        ${h.price!.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span
                        className="text-[13px] font-bold tabular-nums"
                        style={{ color: h.change! >= 0 ? C.green : C.red }}
                      >
                        {h.change! >= 0 ? "+" : ""}{h.change!.toFixed(1)}%
                      </span>
                      <span className="text-[12px]" style={{ color: h.change! >= 0 ? C.green : C.red }}>
                        {h.change! >= 0 ? "▲" : "▼"}
                      </span>
                    </>
                  ) : (
                    <span className="text-[12px] opacity-30 italic">{collecting}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Producers */}
      <div className="mb-2 panel-section" style={{ border: `1px solid ${C.panelBorder}`, background: C.sectionBg, padding: 12, borderRadius: 2 }}>
        <span className="text-[10px] uppercase tracking-widest font-[family-name:var(--font-jetbrains)]" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>{tx.topProducers}</span>
        <div className="mt-2 space-y-1.5">
          {data.producers.map((p) => {
            const rColor = p.rank === 1 ? C.white : p.rank === 2 ? C.subtle : p.rank === 3 ? C.muted : C.dim;
            return (
              <div key={p.id} className="flex items-center gap-2 font-[family-name:var(--font-jetbrains)]">
                <span className="text-[12px] font-bold w-5 text-right" style={{ color: rColor }}>#{p.rank}</span>
                <span className="text-[12px] font-bold" style={{ color: C.white }}>{p.id}</span>
                <span className="text-[12px] flex-1" style={{ color: "rgba(255,255,255,0.6)" }}>{GEO_DATA[p.id]?.name || p.id}</span>
                <span className="text-[12px] tabular-nums" style={{ color: C.muted }}>{p.share}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Consumers */}
      <div className="mb-2 panel-section" style={{ border: `1px solid ${C.panelBorder}`, background: C.sectionBg, padding: 12, borderRadius: 2 }}>
        <span className="text-[10px] uppercase tracking-widest font-[family-name:var(--font-jetbrains)]" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>{tx.topConsumers}</span>
        <div className="mt-2 space-y-1.5">
          {data.consumers.map((c) => {
            const rColor = c.rank === 1 ? C.white : c.rank === 2 ? C.subtle : c.rank === 3 ? C.muted : C.dim;
            return (
              <div key={c.id} className="flex items-center gap-2 font-[family-name:var(--font-jetbrains)]">
                <span className="text-[12px] font-bold w-5 text-right" style={{ color: rColor }}>#{c.rank}</span>
                <span className="text-[12px] font-bold" style={{ color: C.white }}>{c.id}</span>
                <span className="text-[12px] flex-1" style={{ color: "rgba(255,255,255,0.6)" }}>{GEO_DATA[c.id]?.name || c.id}</span>
                <span className="text-[12px] tabular-nums" style={{ color: C.muted }}>{c.share}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Supply Risk Bar */}
      <div className="mb-2 panel-section" style={{ border: `1px solid ${C.panelBorder}`, background: C.sectionBg, padding: 12, borderRadius: 2 }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] uppercase tracking-widest font-mono" style={{ color: C.dim }}>{tx.supplyRisk}</span>
          <span className="text-[14px] font-bold tabular-nums font-mono" style={{ color: riskColor }}>
            {data.supplyRisk}
          </span>
        </div>
        <div className="relative w-full h-[2px] rounded-full overflow-hidden" style={{ background: "linear-gradient(to right, #22c55e, #f59e0b, #ef4444)" }}>
          <motion.div
            className="absolute top-0 right-0 h-full"
            style={{ background: C.bg }}
            initial={{ width: "100%" }}
            animate={{ width: `${100 - data.supplyRisk}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Intelligence Note */}
      <div className="border-l-2 pl-4" style={{ borderColor: "rgba(245,158,11,0.5)" }}>
        <span className="text-[9px] uppercase tracking-widest font-mono mb-1 block" style={{ color: C.amber }}>{tx.intelligenceNote}</span>
        <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{data.riskNote}</p>
      </div>
    </motion.div>
  );
}

// ── Main Page ───────────────────────────────────────────────
export default function MacroProPage() {
  const { lang } = useLang();
  const currentLang = (lang === "kr" ? "kr" : "en") as LangKey;
  const tx = i18n[currentLang];

  const [selected, setSelected] = useState<string | null>(null);
  const [commodityTab, setCommodityTab] = useState<"ALL" | CommodityKey>("ALL");

  // Map controls (Globe only)
  const [globeScale, setGlobeScale] = useState(180);
  const [rotation, setRotation] = useState<[number, number, number]>([-30, -30, 0]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; rot: [number, number, number] } | null>(null);

  // Continent collapse state (all collapsed by default)
  const [expandedContinents, setExpandedContinents] = useState<Set<string>>(new Set());

  // Measure AppHeader + intel bar height for sticky tab positioning
  const pageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const measure = () => {
      // The sticky AppHeader is the first child; the intel bar is the second
      const page = pageRef.current;
      if (!page) return;
      const header = page.querySelector(":scope > .sticky");
      const intelBar = page.querySelector(":scope > .border-b");
      let h = 0;
      if (header) h += header.getBoundingClientRect().height;
      if (intelBar) h += intelBar.getBoundingClientRect().height;
      page.style.setProperty("--header-h", `${h}px`);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);


  // Scroll zoom
  const scaleRef = useRef(globeScale);
  const rafRef = useRef<number | null>(null);
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 15 : -15;
    scaleRef.current = Math.min(400, Math.max(150, scaleRef.current + delta));
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        setGlobeScale(scaleRef.current);
        rafRef.current = null;
      });
    }
  }, []);

  // Globe drag rotation
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY, rot: rotation });
  }, [rotation]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setRotation([
      dragStart.rot[0] + dx * 0.3,
      Math.max(-90, Math.min(90, dragStart.rot[1] - dy * 0.3)),
      0,
    ]);
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
  }, []);

  const selectedData = useMemo(() => (selected ? GEO_DATA[selected] : null), [selected]);

  // Commodity layer helpers
  const activeCommodity = commodityTab !== "ALL" ? COMMODITY_LAYERS[commodityTab] : null;
  const visibleCountryIds = useMemo(() => {
    if (!activeCommodity) return null;
    const ids = new Set<string>();
    activeCommodity.producers.forEach((p) => ids.add(p.id));
    activeCommodity.consumers.forEach((c) => ids.add(c.id));
    return ids;
  }, [activeCommodity]);


  // Projection config (Globe only)
  const projectionConfig = useMemo(() => {
    return { scale: globeScale, rotate: rotation as [number, number, number] };
  }, [rotation, globeScale]);

  return (
    <div ref={pageRef} className="min-h-screen flex flex-col gotham-page" style={{ background: C.bg, color: "#e0e8f0" }}>
      <AppHeader active="macroPro" />

      {/* ── Top Intelligence Bar ──────────────────────────── */}
      {/* ── Commodity Tab Bar (sticky below nav) ──────────── */}
      <div
        className="sticky z-40 w-full"
        style={{ top: "var(--header-h, 0px)", background: C.panelBg, backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.panelBorder}` }}
      >
        <div
          className="mx-auto max-w-[1800px] w-full flex items-center gap-0 overflow-x-auto shrink-0"
          style={{ height: 36 }}
        >
          {COMMODITY_TABS.map((tab) => {
            const isActive = commodityTab === tab;
            return (
              <button
                key={tab}
                onClick={() => {
                  setCommodityTab(tab);
                  setSelected(null);
                }}
                className="px-4 py-2.5 text-[11px] uppercase tracking-widest font-mono transition-all whitespace-nowrap shrink-0"
                style={{
                  color: isActive ? C.white : C.dim,
                  borderBottom: isActive ? `2px solid ${C.amber}` : "2px solid transparent",
                  background: "transparent",
                }}
              >
                {COMMODITY_TAB_LABELS[tab]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────── */}
      <div className="mx-auto max-w-[1800px] w-full flex flex-col lg:flex-row flex-1 min-h-0">
        {/* Left: World Map */}
        <div className="flex-1 relative p-2 lg:p-4 min-w-0 min-h-0">
          {/* Star field background */}
          <div className="absolute inset-0 pointer-events-none star-field" />
          {/* Radial glow behind globe */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 0%, transparent 60%)`,
          }} />
          <div
            className="relative h-full globe-container"
            style={{
              border: `1px solid ${C.panelBorder}`,
              borderRadius: 4,
              overflow: "hidden",
              cursor: isDragging ? "grabbing" : "grab",
              boxShadow: `0 0 40px rgba(255,255,255,0.03), inset 0 0 60px rgba(255,255,255,0.01)`,
            }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <ComposableMap
              projection="geoOrthographic"
              projectionConfig={projectionConfig}
              width={800}
              height={400}
              style={{ width: "100%", height: "100%", background: C.ocean }}
            >
              <defs>
                <pattern id="topo-pattern" patternUnits="userSpaceOnUse" width="4" height="4">
                  <path d="M0 2h4" stroke="rgba(255,255,255,0.5)" strokeWidth="0.15" strokeOpacity="0.08" />
                </pattern>
                <radialGradient id="globe-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="85%" stopColor="transparent" />
                  <stop offset="100%" stopColor="rgba(255,255,255,1)" stopOpacity="0.04" />
                </radialGradient>
                <clipPath id="globe-clip">
                  <circle cx={400} cy={200} r={projectionConfig.scale} />
                </clipPath>
              </defs>
              <Sphere id="globe-sphere" fill={C.ocean} stroke="rgba(255,255,255,0.2)" strokeWidth={0.4} strokeOpacity={0.3} />
              <circle cx={400} cy={200} r={projectionConfig.scale} fill="url(#globe-glow)" />
              <Graticule stroke="rgba(255,255,255,0.3)" strokeWidth={0.25} strokeOpacity={0.08} />

              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={C.land}
                      stroke={C.border}
                      strokeWidth={0.35}
                      style={{
                        default: { outline: "none" },
                        hover: { fill: "#1a2030", outline: "none", stroke: "rgba(255,255,255,0.3)", strokeWidth: 0.6 },
                        pressed: { outline: "none" },
                      }}
                    />
                  ))
                }
              </Geographies>
              {/* Topographic texture overlay */}
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={`topo-${geo.rsmKey}`}
                      geography={geo}
                      fill="url(#topo-pattern)"
                      stroke="none"
                      style={{ default: { outline: "none" }, hover: { outline: "none" }, pressed: { outline: "none" } }}
                    />
                  ))
                }
              </Geographies>

              {/* Clip all markers to globe circle */}
              <g clipPath="url(#globe-clip)">
              {/* Country markers — hollow ring + center dot */}
              {Object.entries(GEO_DATA).map(([code, country]) => {
                const visible = visibleCountryIds === null || visibleCountryIds.has(code);
                if (!visible) return null;
                const producerRank = activeCommodity?.producers.find((p) => p.id === code)?.rank;
                const isSelected = selected === code;
                const markerColor = isSelected ? C.amber : "rgba(255,255,255,0.7)";
                return (
                  <Marker
                    key={code}
                    coordinates={country.coordinates}
                    onClick={() => setSelected(code)}
                  >
                    {/* Outer ring */}
                    <circle
                      r={isSelected ? 6 : 4}
                      fill="none"
                      stroke={markerColor}
                      strokeWidth={isSelected ? 1.5 : 0.8}
                      strokeOpacity={isSelected ? 1 : 0.6}
                      className={isSelected ? "marker-selected-pulse" : "country-dot"}
                    />
                    {/* Center dot */}
                    <circle
                      r={isSelected ? 2 : 1.2}
                      fill={markerColor}
                      fillOpacity={0.9}
                      className="country-dot"
                    />
                    {/* Selected outer glow ring */}
                    {isSelected && (
                      <circle
                        r={10}
                        fill="none"
                        stroke={C.amber}
                        strokeWidth={0.5}
                        strokeOpacity={0.3}
                        className="marker-selected-pulse"
                      />
                    )}
                    <text
                      y={-12}
                      textAnchor="middle"
                      style={{
                        fontFamily: "var(--font-jetbrains), monospace",
                        fontSize: 11,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase" as const,
                        fill: isSelected ? C.amber : "#94a3b8",
                        fillOpacity: isSelected ? 1 : 0.7,
                        pointerEvents: "none",
                      }}
                    >
                      {code}
                    </text>
                    {producerRank && (
                      <text
                        y={-20}
                        textAnchor="middle"
                        style={{
                          fontFamily: "var(--font-jetbrains), monospace",
                          fontSize: 10,
                          fill: C.white,
                          fontWeight: 700,
                          pointerEvents: "none",
                        }}
                      >
                        #{producerRank}
                      </text>
                    )}
                  </Marker>
                );
              })}

              </g>
            </ComposableMap>

          </div>
        </div>

        {/* Right: Intelligence Panel */}
        <div
          className="w-full lg:w-[380px] shrink-0 p-3 lg:p-4 border-l overflow-hidden"
          style={{
            borderColor: C.panelBorder,
            background: C.panelBg,
            backdropFilter: "blur(12px)",
          }}
        >
          <AnimatePresence mode="wait">
            {selectedData ? (
              <CountryPanel key={selected} code={selected!} data={selectedData} onClose={() => setSelected(null)} lang={currentLang} />
            ) : commodityTab !== "ALL" ? (
              <CommodityIntelPanel key={`commodity-${commodityTab}`} commodity={commodityTab} lang={currentLang} />
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full flex flex-col"
              >
                <h3 className="text-sm uppercase tracking-[0.15em] mb-4 font-mono font-bold" style={{ color: C.white, letterSpacing: "0.15em" }}>
                  {tx.countryIntelligence}
                </h3>
                <p className="text-[12px] mb-6" style={{ color: C.dim, letterSpacing: "0.05em" }}>{tx.selectCountry}</p>

                {/* Continent dropdowns */}
                <div className="space-y-1 mb-6">
                  <span className="text-[10px] uppercase tracking-widest font-[family-name:var(--font-jetbrains)]" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em" }}>{tx.activeMonitors}</span>
                  {CONTINENT_GROUPS.map((continent) => {
                    const isExpanded = expandedContinents.has(continent.key);
                    return (
                      <div key={continent.key}>
                        <button
                          onClick={() => setExpandedContinents((prev) => {
                            const next = new Set(prev);
                            if (next.has(continent.key)) next.delete(continent.key);
                            else next.add(continent.key);
                            return next;
                          })}
                          className="w-full flex items-center justify-between px-2 py-1.5 rounded text-left transition-all continent-header"
                          style={{
                            background: isExpanded ? "rgba(255,255,255,0.04)" : "transparent",
                            borderTop: isExpanded ? `1px solid ${C.panelBorder}` : "1px solid transparent",
                          }}
                        >
                          <span className="text-[12px] font-bold uppercase tracking-widest font-[family-name:var(--font-jetbrains)]" style={{ color: isExpanded ? C.white : C.dim, letterSpacing: "0.15em" }}>
                            {currentLang === "kr" ? continent.labelKr : continent.label}
                          </span>
                          <span className="text-[12px] font-[family-name:var(--font-jetbrains)]" style={{ color: isExpanded ? C.subtle : C.dim }}>
                            {isExpanded ? "\u25B2" : "\u25BC"}
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="space-y-0.5 pl-1 mt-0.5">
                            {continent.codes.filter((c) => GEO_DATA[c]).map((code) => {
                              const data = GEO_DATA[code];
                              const isItemSelected = selected === code;
                              return (
                                <button
                                  key={code}
                                  onClick={() => setSelected(code)}
                                  className="w-full flex items-center gap-2 px-2 py-1 rounded text-left transition-all country-item"
                                  style={{
                                    border: isItemSelected ? `1px solid rgba(255,255,255,0.15)` : `1px solid transparent`,
                                    borderLeft: isItemSelected ? `2px solid ${C.white}` : "2px solid transparent",
                                    background: isItemSelected ? "rgba(255,255,255,0.06)" : "transparent",
                                  }}
                                >
                                  <span className="text-[12px] font-bold font-[family-name:var(--font-jetbrains)] w-6" style={{ color: isItemSelected ? C.white : C.muted, letterSpacing: "0.1em" }}>{code}</span>
                                  <span className="text-[12px] flex-1 font-mono tracking-wide" style={{ color: isItemSelected ? C.text : "rgba(255,255,255,0.6)" }}>{currentLang === "kr" ? data.nameKr : data.name}</span>
                                  <span
                                    className="text-[13px] font-bold px-1 py-0.5 rounded font-[family-name:var(--font-jetbrains)]"
                                    style={{ color: threatColor(data.threat), background: `${threatColor(data.threat)}15` }}
                                  >
                                    {tx.threatLabels[data.threat]}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Commodity Research Panel ──────────────────────── */}
      {commodityTab !== "ALL" && (
        <div className="mx-auto max-w-[1800px] w-full p-2 lg:p-4">
          <CommodityResearchPanel commodity={commodityTab} lang={currentLang} />
        </div>
      )}

      {/* ── Animations CSS ────────────────────────────────── */}
      <style jsx global>{`
        /* ── Globe entrance animation ── */
        .globe-container {
          animation: globeEntrance 1.2s ease-out both;
        }
        @keyframes globeEntrance {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }

        /* ── Star field ── */
        .star-field {
          background-image:
            radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.3) 0%, transparent 100%),
            radial-gradient(1px 1px at 30% 60%, rgba(255,255,255,0.2) 0%, transparent 100%),
            radial-gradient(1px 1px at 50% 10%, rgba(255,255,255,0.25) 0%, transparent 100%),
            radial-gradient(1px 1px at 70% 40%, rgba(255,255,255,0.15) 0%, transparent 100%),
            radial-gradient(1px 1px at 90% 80%, rgba(255,255,255,0.2) 0%, transparent 100%),
            radial-gradient(1px 1px at 15% 85%, rgba(255,255,255,0.25) 0%, transparent 100%),
            radial-gradient(1px 1px at 40% 35%, rgba(255,255,255,0.15) 0%, transparent 100%),
            radial-gradient(1px 1px at 65% 70%, rgba(255,255,255,0.2) 0%, transparent 100%),
            radial-gradient(1px 1px at 85% 15%, rgba(255,255,255,0.3) 0%, transparent 100%),
            radial-gradient(1px 1px at 25% 50%, rgba(255,255,255,0.15) 0%, transparent 100%),
            radial-gradient(1px 1px at 55% 90%, rgba(255,255,255,0.2) 0%, transparent 100%),
            radial-gradient(1px 1px at 80% 55%, rgba(255,255,255,0.25) 0%, transparent 100%),
            radial-gradient(1px 1px at 5% 45%, rgba(255,255,255,0.15) 0%, transparent 100%),
            radial-gradient(1px 1px at 45% 75%, rgba(255,255,255,0.2) 0%, transparent 100%),
            radial-gradient(1px 1px at 95% 30%, rgba(255,255,255,0.25) 0%, transparent 100%);
        }

        /* ── Pulse animations ── */
        @keyframes threatPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes criticalPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(2); }
        }
        /* ── Country marker animations ── */
        .country-dot {
          transition: all 0.2s ease;
        }
        .country-dot:hover {
          transform: scale(1.6);
          filter: drop-shadow(0 0 6px rgba(255,255,255,0.5));
        }
        @keyframes markerPulse {
          0%, 100% { opacity: 1; r: 6; }
          50% { opacity: 0.5; r: 10; }
        }
        .marker-selected-pulse {
          animation: selectedPulse 2s ease-in-out infinite;
        }
        @keyframes selectedPulse {
          0%, 100% { opacity: 1; stroke-width: 1.5; }
          50% { opacity: 0.4; stroke-width: 0.5; }
        }

        /* ── Country list item hover ── */
        .country-item:hover {
          border-left-color: rgba(255,255,255,0.5) !important;
          border-left-width: 2px !important;
          background: rgba(255,255,255,0.04) !important;
        }


        /* ── Panel section borders ── */
        .panel-section {
          border-top: 1px solid rgba(255,255,255,0.08) !important;
        }

        /* ── Gotham monospace typography ── */
        .gotham-page .font-\\[family-name\\:var\\(--font-jetbrains\\)\\] {
          letter-spacing: 0.05em;
        }
      `}</style>
    </div>
  );
}
