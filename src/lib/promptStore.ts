// ── Types ──────────────────────────────────────────────────────

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  prompt: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  author: string;
  usageCount: number;
  ratingAvg: number;
  ratingCount: number;
}

export interface Review {
  id: string;
  promptId: string;
  stars: number; // 1–5
  comment: string;
  timestamp: string;
  author: string;
}

// ── Keys ───────────────────────────────────────────────────────

const PROMPTS_KEY = "pb_prompts";
const REVIEWS_KEY = "pb_reviews";
const SELECTED_KEY = "pb_selected_prompt";

// ── Seed data ──────────────────────────────────────────────────

const SEED_PROMPTS: PromptTemplate[] = [
  {
    id: "builtin-scalp",
    title: "Scalp Strategy",
    description: "Short-term scalp analysis focusing on 1–5 min chart patterns, order flow, and momentum.",
    prompt:
      "You are a professional scalp trader. Analyze the uploaded chart image for a 1–5 minute timeframe trade. Identify entry, stop-loss, and 2 take-profit levels. Focus on order flow signals, VWAP, and short-term momentum. Be concise.",
    tags: ["scalp", "short-term"],
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    author: "System",
    usageCount: 0,
    ratingAvg: 0,
    ratingCount: 0,
  },
  {
    id: "builtin-swing",
    title: "Swing Strategy",
    description: "Multi-day swing analysis using daily/4H charts, trend structure, and key S/R levels.",
    prompt:
      "You are a professional swing trader. Analyze the uploaded chart for a multi-day swing trade (1–4 week hold). Identify the primary trend, key support/resistance zones, entry trigger, stop-loss, and 3 target levels. Include invalidation criteria and scenario analysis.",
    tags: ["swing", "multi-day"],
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    author: "System",
    usageCount: 0,
    ratingAvg: 0,
    ratingCount: 0,
  },
  {
    id: "builtin-macro",
    title: "Macro Overview",
    description: "High-level macro analysis for weekly/monthly charts, sector rotation, and risk assessment.",
    prompt:
      "You are a macro analyst. Analyze the uploaded chart from a macro perspective. Identify the long-term trend phase (accumulation, markup, distribution, markdown), major structural levels, and potential catalysts. Provide a risk assessment and confidence level.",
    tags: ["macro", "long-term"],
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    author: "System",
    usageCount: 0,
    ratingAvg: 0,
    ratingCount: 0,
  },
];

// ── Helpers ────────────────────────────────────────────────────

function uid(): string {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── CRUD: Prompts ──────────────────────────────────────────────

export function getPrompts(): PromptTemplate[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(PROMPTS_KEY);
  if (!raw) {
    savePrompts(SEED_PROMPTS);
    return SEED_PROMPTS;
  }
  return JSON.parse(raw) as PromptTemplate[];
}

export function savePrompts(list: PromptTemplate[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROMPTS_KEY, JSON.stringify(list));
}

export function upsertPrompt(prompt: Partial<PromptTemplate> & { id?: string }): PromptTemplate {
  const list = getPrompts();
  const now = new Date().toISOString();

  if (prompt.id) {
    const idx = list.findIndex((p) => p.id === prompt.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...prompt, updatedAt: now };
      savePrompts(list);
      return list[idx];
    }
  }

  const newPrompt: PromptTemplate = {
    id: uid(),
    title: prompt.title || "Untitled",
    description: prompt.description || "",
    prompt: prompt.prompt || "",
    tags: prompt.tags || [],
    createdAt: now,
    updatedAt: now,
    author: prompt.author || "User",
    usageCount: 0,
    ratingAvg: 0,
    ratingCount: 0,
  };
  list.push(newPrompt);
  savePrompts(list);
  return newPrompt;
}

export function deletePrompt(id: string): void {
  const list = getPrompts().filter((p) => p.id !== id);
  savePrompts(list);
  // Also remove reviews for this prompt
  const reviews = getReviews().filter((r) => r.promptId !== id);
  saveReviews(reviews);
  // Clear selection if deleted
  if (getSelectedPromptId() === id) {
    setSelectedPromptId(null);
  }
}

export function duplicatePrompt(id: string): PromptTemplate | null {
  const list = getPrompts();
  const original = list.find((p) => p.id === id);
  if (!original) return null;

  const now = new Date().toISOString();
  const copy: PromptTemplate = {
    ...original,
    id: uid(),
    title: `${original.title} (Copy)`,
    createdAt: now,
    updatedAt: now,
    author: "User",
    usageCount: 0,
    ratingAvg: 0,
    ratingCount: 0,
  };
  list.push(copy);
  savePrompts(list);
  return copy;
}

export function incrementUsage(id: string): void {
  const list = getPrompts();
  const idx = list.findIndex((p) => p.id === id);
  if (idx >= 0) {
    list[idx].usageCount += 1;
    savePrompts(list);
  }
}

// ── CRUD: Reviews ──────────────────────────────────────────────

export function getReviews(): Review[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(REVIEWS_KEY);
  return raw ? (JSON.parse(raw) as Review[]) : [];
}

export function saveReviews(list: Review[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(list));
}

export function addReview(promptId: string, stars: number, comment: string): void {
  const reviews = getReviews();
  reviews.push({
    id: uid(),
    promptId,
    stars,
    comment,
    timestamp: new Date().toISOString(),
    author: "User",
  });
  saveReviews(reviews);

  // Update ratingAvg / ratingCount on the prompt
  const promptReviews = reviews.filter((r) => r.promptId === promptId);
  const avg = promptReviews.reduce((s, r) => s + r.stars, 0) / promptReviews.length;

  const prompts = getPrompts();
  const idx = prompts.findIndex((p) => p.id === promptId);
  if (idx >= 0) {
    prompts[idx].ratingAvg = avg;
    prompts[idx].ratingCount = promptReviews.length;
    savePrompts(prompts);
  }
}

// ── Selection ──────────────────────────────────────────────────

export function getSelectedPromptId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SELECTED_KEY);
}

export function setSelectedPromptId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) {
    localStorage.setItem(SELECTED_KEY, id);
  } else {
    localStorage.removeItem(SELECTED_KEY);
  }
}
