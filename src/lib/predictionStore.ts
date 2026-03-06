// ── Types ──────────────────────────────────────────────────────

export type PredictionCategory = "stocks" | "politics" | "economy" | "entertainment" | "crypto" | "other";

export interface Prediction {
  id: string;
  title: { en: string; kr: string };
  description: { en: string; kr: string };
  category: PredictionCategory;
  status: "open" | "closed" | "resolved";
  closesAt: string; // ISO
  createdAt: string;
  resolvedOptionId: "yes" | "no" | null;
}

export interface Vote {
  predictionId: string;
  optionId: "yes" | "no";
  timestamp: string;
}

export interface PredictionStats {
  participants: number;
  yesCount: number;
  noCount: number;
  yesPct: number;
  noPct: number;
}

// ── Keys ───────────────────────────────────────────────────────

const PREDICTIONS_KEY = "pb_predictions";
const VOTES_KEY = "pb_prediction_votes";

// ── Helpers ────────────────────────────────────────────────────

function uid(): string {
  return `pred_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── CRUD: Predictions ──────────────────────────────────────────

export function getPredictions(): Prediction[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(PREDICTIONS_KEY);
  if (!raw) return [];
  const list = JSON.parse(raw) as Prediction[];
  // Backward compat: default missing category to "stocks"
  for (const p of list) {
    if (!p.category) p.category = "stocks";
  }
  return list;
}

export function savePredictions(list: Prediction[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREDICTIONS_KEY, JSON.stringify(list));
}

export function upsertPrediction(p: Partial<Prediction> & { id?: string }): Prediction {
  const list = getPredictions();
  const now = new Date().toISOString();

  if (p.id) {
    const idx = list.findIndex((x) => x.id === p.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...p } as Prediction;
      savePredictions(list);
      return list[idx];
    }
  }

  const newPred: Prediction = {
    id: uid(),
    title: p.title || { en: "Untitled", kr: "제목 없음" },
    description: p.description || { en: "", kr: "" },
    category: p.category || "stocks",
    status: p.status || "open",
    closesAt: p.closesAt || new Date(Date.now() + 7 * 86400000).toISOString(),
    createdAt: now,
    resolvedOptionId: p.resolvedOptionId || null,
  };
  list.push(newPred);
  savePredictions(list);
  return newPred;
}

export function deletePrediction(id: string): void {
  const list = getPredictions().filter((p) => p.id !== id);
  savePredictions(list);
  // Also remove votes for this prediction
  const votes = getVotes();
  delete votes[id];
  saveVotes(votes);
}

// ── CRUD: Votes ────────────────────────────────────────────────

export function getVotes(): Record<string, Vote> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(VOTES_KEY);
  return raw ? (JSON.parse(raw) as Record<string, Vote>) : {};
}

export function saveVotes(votes: Record<string, Vote>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
}

export function vote(predictionId: string, optionId: "yes" | "no"): boolean {
  const predictions = getPredictions();
  const pred = predictions.find((p) => p.id === predictionId);
  if (!pred) return false;
  if (pred.status !== "open") return false;
  if (new Date(pred.closesAt) <= new Date()) return false;

  const votes = getVotes();
  if (votes[predictionId]) return false; // already voted

  votes[predictionId] = {
    predictionId,
    optionId,
    timestamp: new Date().toISOString(),
  };
  saveVotes(votes);
  return true;
}

// ── Stats ──────────────────────────────────────────────────────

export function computeStats(
  _predictions: Prediction[],
  _votes: Record<string, Vote>
): Record<string, PredictionStats> {
  const result: Record<string, PredictionStats> = {};

  // For MVP with single-browser localStorage, each prediction has at most 1 vote.
  // We simulate multiple participants for seeded data by generating mock stats.
  for (const pred of _predictions) {
    const userVote = _votes[pred.id];
    // Base mock participants for demo feel
    const mockYes = hashSeed(pred.id + "yes") % 80 + 10;
    const mockNo = hashSeed(pred.id + "no") % 60 + 5;

    const yesCount = mockYes + (userVote?.optionId === "yes" ? 1 : 0);
    const noCount = mockNo + (userVote?.optionId === "no" ? 1 : 0);
    const total = yesCount + noCount;

    result[pred.id] = {
      participants: total,
      yesCount,
      noCount,
      yesPct: total > 0 ? Math.round((yesCount / total) * 100) : 50,
      noPct: total > 0 ? Math.round((noCount / total) * 100) : 50,
    };
  }

  return result;
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ── Seed ───────────────────────────────────────────────────────

export function seedPredictionsIfEmpty(): void {
  const existing = getPredictions();
  // Migrate: clear old format (string title or missing category)
  if (existing.length > 0) {
    const first = existing[0] as unknown as Record<string, unknown>;
    if (typeof first.title === "string" || !first.category) {
      localStorage.removeItem(PREDICTIONS_KEY);
    } else {
      return;
    }
  }

  const now = Date.now();
  const day = 86400000;

  const seeds: Prediction[] = [
    // ── Stocks ──
    {
      id: "seed-1",
      title: { en: "March: KOSPI 2,800 reached?", kr: "3월: 코스피 2,800 도달?" },
      description: {
        en: "Will KOSPI index close above 2,800 at any point during March 2026?",
        kr: "2026년 3월 중 코스피 지수가 2,800을 넘어 마감할까요?",
      },
      category: "stocks",
      status: "open",
      closesAt: new Date(now + 28 * day).toISOString(),
      createdAt: new Date(now - 2 * day).toISOString(),
      resolvedOptionId: null,
    },
    {
      id: "seed-2",
      title: { en: "Samsung Q1 earnings beat consensus?", kr: "삼성 1분기 실적 컨센서스 상회?" },
      description: {
        en: "Will Samsung Electronics report Q1 2026 operating profit above analyst consensus of ₩7.2T?",
        kr: "삼성전자 2026년 1분기 영업이익이 애널리스트 컨센서스 7.2조원을 상회할까요?",
      },
      category: "stocks",
      status: "open",
      closesAt: new Date(now + 45 * day).toISOString(),
      createdAt: new Date(now - 3 * day).toISOString(),
      resolvedOptionId: null,
    },
    {
      id: "seed-3",
      title: { en: "NVIDIA hits $200 before April?", kr: "4월 전 엔비디아 $200 도달?" },
      description: {
        en: "Will NVIDIA stock price reach $200 per share before April 1, 2026?",
        kr: "2026년 4월 1일 전에 엔비디아 주가가 주당 $200에 도달할까요?",
      },
      category: "stocks",
      status: "open",
      closesAt: new Date(now + 30 * day).toISOString(),
      createdAt: new Date(now - 4 * day).toISOString(),
      resolvedOptionId: null,
    },
    // ── Politics ──
    {
      id: "seed-4",
      title: { en: "Korea snap election called before July?", kr: "7월 전 한국 조기선거 실시?" },
      description: {
        en: "Will a snap presidential election be called in South Korea before July 2026?",
        kr: "2026년 7월 전에 한국에서 조기 대선이 실시될까요?",
      },
      category: "politics",
      status: "open",
      closesAt: new Date(now + 60 * day).toISOString(),
      createdAt: new Date(now - 3 * day).toISOString(),
      resolvedOptionId: null,
    },
    {
      id: "seed-5",
      title: { en: "Next FOMC: Rate cut?", kr: "다음 FOMC: 금리 인하?" },
      description: {
        en: "Will the Federal Reserve cut the federal funds rate at the next FOMC meeting?",
        kr: "다음 FOMC 회의에서 연준이 기준금리를 인하할까요?",
      },
      category: "politics",
      status: "open",
      closesAt: new Date(now + 40 * day).toISOString(),
      createdAt: new Date(now - 1 * day).toISOString(),
      resolvedOptionId: null,
    },
    // ── Economy ──
    {
      id: "seed-6",
      title: { en: "Seoul apartments +5% in H1 2026?", kr: "2026 상반기 서울 아파트 5%+ 상승?" },
      description: {
        en: "Will Seoul apartment price index rise more than 5% in the first half of 2026?",
        kr: "2026년 상반기에 서울 아파트 가격지수가 5% 이상 상승할까요?",
      },
      category: "economy",
      status: "open",
      closesAt: new Date(now + 120 * day).toISOString(),
      createdAt: new Date(now - 1 * day).toISOString(),
      resolvedOptionId: null,
    },
    {
      id: "seed-7",
      title: { en: "Jeonse index below 90 by June?", kr: "6월까지 전세지수 90 이하 하락?" },
      description: {
        en: "Will the national jeonse (lease deposit) price index fall below 90 by June 2026?",
        kr: "2026년 6월까지 전국 전세가격지수가 90 이하로 하락할까요?",
      },
      category: "economy",
      status: "open",
      closesAt: new Date(now + 90 * day).toISOString(),
      createdAt: new Date(now - 5 * day).toISOString(),
      resolvedOptionId: null,
    },
    // ── Entertainment ──
    {
      id: "seed-8",
      title: { en: "BTS full group comeback in 2026?", kr: "BTS 완전체 컴백 2026년 내?" },
      description: {
        en: "Will BTS have a full group comeback (all 7 members) before the end of 2026?",
        kr: "2026년 말까지 BTS 완전체(7명 전원) 컴백이 이루어질까요?",
      },
      category: "entertainment",
      status: "open",
      closesAt: new Date(now + 270 * day).toISOString(),
      createdAt: new Date(now - 2 * day).toISOString(),
      resolvedOptionId: null,
    },
    // ── Crypto ──
    {
      id: "seed-9",
      title: { en: "Bitcoin breaks $120k before May?", kr: "비트코인 $120k 돌파 5월 전?" },
      description: {
        en: "Will Bitcoin price break $120,000 USD before May 1, 2026?",
        kr: "2026년 5월 1일 전에 비트코인 가격이 $120,000를 돌파할까요?",
      },
      category: "crypto",
      status: "open",
      closesAt: new Date(now + 56 * day).toISOString(),
      createdAt: new Date(now - 1 * day).toISOString(),
      resolvedOptionId: null,
    },
    // ── Other ──
    {
      id: "seed-10",
      title: { en: "USD/KRW below 1,350 by end of March?", kr: "3월까지 달러/원 1,350 이하?" },
      description: {
        en: "Will the USD/KRW exchange rate trade below 1,350 before March 31, 2026?",
        kr: "2026년 3월 31일 전에 달러/원 환율이 1,350 아래로 거래될까요?",
      },
      category: "other",
      status: "open",
      closesAt: new Date(now + 25 * day).toISOString(),
      createdAt: new Date(now - 2 * day).toISOString(),
      resolvedOptionId: null,
    },
  ];

  savePredictions(seeds);
}
