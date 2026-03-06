// Money Flow mock data — values in billion KRW (순매수 억원)

export interface NetFlowDay {
  date: string;
  individual: number;
  foreign: number;
  institution: number;
}

export interface NetBuyRow {
  side: "foreign" | "institution";
  ticker: string;
  name: string;
  netBuy: number; // billion KRW
  price: number;
  chgPct: number;
}

export interface TradingValueRow {
  ticker: string;
  name: string;
  tradingValue: number; // billion KRW
  price: number;
  chgPct: number;
}

export interface AvgCostRow {
  ticker: string;
  name: string;
  foreignAvgCost: number;
  lastPrice: number;
  distancePct: number;
}

export interface DivergenceRow {
  ticker: string;
  name: string;
  reason: string;
  foreignStreakDays: number;
  priceTrend: "flat" | "down" | "up";
}

// --- 30 trading days of net flow (Feb 2026) ---
function d(m: number, day: number) {
  return `2026-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export const NET_FLOW_SERIES: NetFlowDay[] = [
  { date: d(1, 16), individual: 1820, foreign: -920, institution: -900 },
  { date: d(1, 17), individual: -340, foreign: 580, institution: -240 },
  { date: d(1, 20), individual: 1120, foreign: -1450, institution: 330 },
  { date: d(1, 21), individual: -680, foreign: 1200, institution: -520 },
  { date: d(1, 22), individual: 450, foreign: -280, institution: -170 },
  { date: d(1, 23), individual: -1530, foreign: 2100, institution: -570 },
  { date: d(1, 24), individual: 920, foreign: -630, institution: -290 },
  { date: d(1, 27), individual: -210, foreign: 870, institution: -660 },
  { date: d(1, 28), individual: 1340, foreign: -1100, institution: -240 },
  { date: d(1, 29), individual: -760, foreign: 1500, institution: -740 },
  { date: d(1, 30), individual: 380, foreign: -120, institution: -260 },
  { date: d(1, 31), individual: -1100, foreign: 1800, institution: -700 },
  { date: d(2, 3), individual: 670, foreign: -350, institution: -320 },
  { date: d(2, 4), individual: -920, foreign: 1320, institution: -400 },
  { date: d(2, 5), individual: 1450, foreign: -1800, institution: 350 },
  { date: d(2, 6), individual: -560, foreign: 920, institution: -360 },
  { date: d(2, 7), individual: 310, foreign: -180, institution: -130 },
  { date: d(2, 10), individual: -1280, foreign: 1600, institution: -320 },
  { date: d(2, 11), individual: 890, foreign: -520, institution: -370 },
  { date: d(2, 12), individual: -430, foreign: 780, institution: -350 },
  { date: d(2, 13), individual: 1560, foreign: -2100, institution: 540 },
  { date: d(2, 14), individual: -720, foreign: 1050, institution: -330 },
  { date: d(2, 17), individual: 260, foreign: -90, institution: -170 },
  { date: d(2, 18), individual: -1680, foreign: 2300, institution: -620 },
  { date: d(2, 19), individual: 940, foreign: -670, institution: -270 },
  { date: d(2, 20), individual: -380, foreign: 610, institution: -230 },
  { date: d(2, 21), individual: 1210, foreign: -1550, institution: 340 },
  { date: d(2, 24), individual: -530, foreign: 890, institution: -360 },
  { date: d(2, 25), individual: 170, foreign: 60, institution: -230 },
  { date: d(2, 26), individual: -1350, foreign: 1900, institution: -550 },
];

export const TOP_NET_BUY: NetBuyRow[] = [
  { side: "foreign", ticker: "005930", name: "Samsung Elec", netBuy: 3820, price: 78200, chgPct: 1.42 },
  { side: "foreign", ticker: "000660", name: "SK Hynix", netBuy: 2910, price: 218000, chgPct: 2.84 },
  { side: "foreign", ticker: "035420", name: "NAVER", netBuy: 1540, price: 224500, chgPct: 0.67 },
  { side: "foreign", ticker: "006400", name: "Samsung SDI", netBuy: 1120, price: 412000, chgPct: -0.48 },
  { side: "foreign", ticker: "051910", name: "LG Chem", netBuy: 980, price: 368000, chgPct: 1.09 },
  { side: "foreign", ticker: "055550", name: "Shinhan FG", netBuy: 870, price: 52400, chgPct: 0.38 },
  { side: "foreign", ticker: "068270", name: "Celltrion", netBuy: 650, price: 192500, chgPct: -1.28 },
  { side: "institution", ticker: "005930", name: "Samsung Elec", netBuy: 2150, price: 78200, chgPct: 1.42 },
  { side: "institution", ticker: "000660", name: "SK Hynix", netBuy: 1780, price: 218000, chgPct: 2.84 },
  { side: "institution", ticker: "035720", name: "Kakao", netBuy: 1230, price: 48750, chgPct: 1.87 },
  { side: "institution", ticker: "105560", name: "KB Financial", netBuy: 940, price: 78500, chgPct: 0.51 },
  { side: "institution", ticker: "003550", name: "LG", netBuy: 720, price: 82300, chgPct: -0.36 },
  { side: "institution", ticker: "028260", name: "Samsung C&T", netBuy: 610, price: 138000, chgPct: 0.73 },
  { side: "institution", ticker: "036570", name: "NCsoft", netBuy: 480, price: 198500, chgPct: 3.12 },
];

export const TOP_TRADING_VALUE: TradingValueRow[] = [
  { ticker: "005930", name: "Samsung Elec", tradingValue: 12400, price: 78200, chgPct: 1.42 },
  { ticker: "000660", name: "SK Hynix", tradingValue: 8930, price: 218000, chgPct: 2.84 },
  { ticker: "035420", name: "NAVER", tradingValue: 4210, price: 224500, chgPct: 0.67 },
  { ticker: "035720", name: "Kakao", tradingValue: 3870, price: 48750, chgPct: 1.87 },
  { ticker: "051910", name: "LG Chem", tradingValue: 3120, price: 368000, chgPct: 1.09 },
  { ticker: "006400", name: "Samsung SDI", tradingValue: 2840, price: 412000, chgPct: -0.48 },
  { ticker: "068270", name: "Celltrion", tradingValue: 2560, price: 192500, chgPct: -1.28 },
];

export const AVG_COST_ESTIMATE: AvgCostRow[] = [
  { ticker: "005930", name: "Samsung Elec", foreignAvgCost: 72400, lastPrice: 78200, distancePct: 8.01 },
  { ticker: "000660", name: "SK Hynix", foreignAvgCost: 198500, lastPrice: 218000, distancePct: 9.82 },
  { ticker: "035420", name: "NAVER", foreignAvgCost: 231000, lastPrice: 224500, distancePct: -2.81 },
  { ticker: "006400", name: "Samsung SDI", foreignAvgCost: 425000, lastPrice: 412000, distancePct: -3.06 },
  { ticker: "051910", name: "LG Chem", foreignAvgCost: 355000, lastPrice: 368000, distancePct: 3.66 },
  { ticker: "068270", name: "Celltrion", foreignAvgCost: 185000, lastPrice: 192500, distancePct: 4.05 },
];

export const DIVERGENCE_CANDIDATES: DivergenceRow[] = [
  { ticker: "035420", name: "NAVER", reason: "Foreign buying vs price decline", foreignStreakDays: 12, priceTrend: "down" },
  { ticker: "006400", name: "Samsung SDI", reason: "Foreign accumulation, flat price", foreignStreakDays: 8, priceTrend: "flat" },
  { ticker: "068270", name: "Celltrion", reason: "Foreign selling vs price rise", foreignStreakDays: -6, priceTrend: "up" },
  { ticker: "003670", name: "Posco Future M", reason: "Institution buying, price stalling", foreignStreakDays: 5, priceTrend: "flat" },
  { ticker: "036570", name: "NCsoft", reason: "Foreign + institution buying, dip", foreignStreakDays: 9, priceTrend: "down" },
];
