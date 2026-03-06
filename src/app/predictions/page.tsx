"use client";

import { useState, useEffect, useCallback } from "react";
import { useLang } from "@/lib/LangContext";
import AppHeader from "@/components/AppHeader";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";
import type { MessageKey } from "@/lib/i18n";
import type { PredictionCategory } from "@/lib/predictionStore";

// ── Constants ──────────────────────────────────────────────────

const CATEGORIES: ("all" | PredictionCategory)[] = [
  "all",
  "stocks",
  "politics",
  "economy",
  "entertainment",
  "crypto",
  "other",
];

const CAT_LABEL_KEY: Record<"all" | PredictionCategory, MessageKey> = {
  all: "catAll",
  stocks: "catStocks",
  politics: "catPolitics",
  economy: "catEconomy",
  entertainment: "catEntertainment",
  crypto: "catCrypto",
  other: "catOther",
};

const CAT_COLORS: Record<PredictionCategory, { bg: string; text: string }> = {
  stocks: { bg: "bg-blue-500/15", text: "text-blue-400" },
  politics: { bg: "bg-purple-500/15", text: "text-purple-400" },
  economy: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  entertainment: { bg: "bg-pink-500/15", text: "text-pink-400" },
  crypto: { bg: "bg-orange-500/15", text: "text-orange-400" },
  other: { bg: "bg-gray-500/15", text: "text-gray-400" },
};

// ── Types ──────────────────────────────────────────────────────

interface PredictionStats {
  participants: number;
  yesCount: number;
  noCount: number;
  yesPct: number;
  noPct: number;
}

interface Prediction {
  id: string;
  title: { en: string; kr: string };
  description: { en: string; kr: string };
  category: PredictionCategory;
  status: "open" | "closed" | "resolved";
  closesAt: string;
  createdAt: string;
  resolvedOptionId: string | null;
  stats: PredictionStats;
}

interface UserVote {
  predictionId: string;
  optionId: "yes" | "no";
}

interface LeaderboardEntry {
  rank: number;
  email: string;
  total: number;
  correct: number;
  accuracy: number;
}

// ── Helpers ────────────────────────────────────────────────────

function timeLeft(iso: string): { text: string; urgent: boolean } {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return { text: "", urgent: false };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);

  if (days > 7) return { text: `${days}d`, urgent: false };
  if (days > 0) return { text: `${days}d ${hours}h`, urgent: days <= 3 };
  if (hours > 0) return { text: `${hours}h ${mins}m`, urgent: true };
  return { text: `${mins}m`, urgent: true };
}

function mockVolume(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 9000) + 1000;
}

// ── Page ───────────────────────────────────────────────────────

export default function PredictionsPage() {
  const { t, lang } = useLang();
  const { session } = useAuth();
  const [tab, setTab] = useState<"markets" | "leaderboard">("markets");
  const [category, setCategory] = useState<"all" | PredictionCategory>("all");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, UserVote>>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);

  // New form
  const [showNew, setShowNew] = useState(false);
  const [newTitleEn, setNewTitleEn] = useState("");
  const [newTitleKr, setNewTitleKr] = useState("");
  const [newCategory, setNewCategory] = useState<PredictionCategory>("other");

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/predictions");
      const json = await res.json();
      if (json.ok) setPredictions(json.predictions);
    } catch { /* */ }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (tab !== "leaderboard") return;
    setLbLoading(true);
    fetch("/api/predictions/leaderboard")
      .then((r) => r.json())
      .then((json) => { if (json.ok) setLeaderboard(json.leaderboard); })
      .catch(() => {})
      .finally(() => setLbLoading(false));
  }, [tab]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const raw = localStorage.getItem(`pb_votes_${session.user.id}`);
    if (raw) try { setUserVotes(JSON.parse(raw)); } catch { /* */ }
  }, [session?.user?.id]);

  const saveUserVote = (predId: string, optionId: "yes" | "no") => {
    const updated = { ...userVotes, [predId]: { predictionId: predId, optionId } };
    setUserVotes(updated);
    if (session?.user?.id) localStorage.setItem(`pb_votes_${session.user.id}`, JSON.stringify(updated));
  };

  const requireAuth = useRequireAuth();

  const handleVote = (predId: string, optionId: "yes" | "no") => {
    requireAuth(async () => {
      if (!session?.access_token) return;
      try {
        const res = await fetch(`/api/predictions/${predId}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ optionId }),
        });
        const json = await res.json();
        if (json.ok) {
          saveUserVote(predId, optionId);
          setPredictions((prev) => prev.map((p) => (p.id === predId ? { ...p, stats: json.stats } : p)));
        }
      } catch { /* */ }
    });
  };

  const handleNewSubmit = () => {
    requireAuth(async () => {
      const titleEn = newTitleEn.trim();
      if (!titleEn || !session?.access_token) return;
      try {
        const res = await fetch("/api/predictions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            title_en: titleEn,
            title_kr: newTitleKr.trim() || titleEn,
            category: newCategory,
            closes_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          }),
        });
        const json = await res.json();
        if (json.ok) { setNewTitleEn(""); setNewTitleKr(""); setShowNew(false); reload(); }
      } catch { /* */ }
    });
  };

  // Filters
  const openPreds = predictions.filter((p) => p.status === "open");
  const displayed = category === "all" ? openPreds : openPreds.filter((p) => p.category === category);

  // Sort by participants desc
  const sorted = [...displayed].sort((a, b) => (b.stats?.participants ?? 0) - (a.stats?.participants ?? 0));

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="predictions" />

      <main className="mx-auto max-w-[1200px] px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{t("predictions")}</h1>
            <p className="text-xs text-muted mt-0.5">
              {lang === "kr" ? "예측 마켓에 참여하고 포인트를 획득하세요" : "Bet on outcomes, earn points for accuracy"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowNew((v) => !v)}
              className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              {t("predNew")}
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-px rounded-lg bg-card-border p-0.5 w-fit">
          {(["markets", "leaderboard"] as const).map((tv) => (
            <button
              key={tv}
              onClick={() => setTab(tv)}
              className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
                tab === tv
                  ? "bg-card-bg text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {tv === "markets"
                ? lang === "kr" ? "마켓" : "Markets"
                : t("leaderboard")}
            </button>
          ))}
        </div>

        {/* ── Markets View ── */}
        {tab === "markets" && (
          <>
            {/* Category pills */}
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const count = cat === "all"
                  ? openPreds.length
                  : openPreds.filter((p) => p.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                      category === cat
                        ? "bg-accent text-white shadow-sm"
                        : "bg-card-bg border border-card-border text-muted hover:text-foreground hover:border-foreground/20"
                    }`}
                  >
                    {t(CAT_LABEL_KEY[cat])}
                    <span className="ml-1 opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* New prediction form */}
            {showNew && (
              <div className="rounded-xl border border-card-border bg-card-bg p-4 space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    value={newTitleEn}
                    onChange={(e) => setNewTitleEn(e.target.value)}
                    placeholder="Question (EN)"
                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none"
                  />
                  <input
                    value={newTitleKr}
                    onChange={(e) => setNewTitleKr(e.target.value)}
                    placeholder="질문 (KR)"
                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as PredictionCategory)}
                    className="rounded-lg border border-card-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-accent focus:outline-none"
                  >
                    {(["stocks", "politics", "economy", "entertainment", "crypto", "other"] as PredictionCategory[]).map((c) => (
                      <option key={c} value={c}>{t(CAT_LABEL_KEY[c])}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleNewSubmit}
                    disabled={!newTitleEn.trim()}
                    className="rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {lang === "kr" ? "생성" : "Create"}
                  </button>
                  <button
                    onClick={() => { setShowNew(false); setNewTitleEn(""); setNewTitleKr(""); }}
                    className="rounded-lg border border-card-border px-3 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
                  >
                    {t("cancel")}
                  </button>
                </div>
              </div>
            )}

            {/* Market cards grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((pred) => (
                <MarketCard
                  key={pred.id}
                  pred={pred}
                  userVote={userVotes[pred.id]}
                  lang={lang}
                  t={t}
                  onVote={handleVote}
                />
              ))}
              {sorted.length === 0 && (
                <p className="col-span-full py-16 text-center text-sm text-muted">
                  {t("predNoPredictions")}
                </p>
              )}
            </div>
          </>
        )}

        {/* ── Leaderboard View ── */}
        {tab === "leaderboard" && (
          <div className="rounded-xl border border-card-border bg-card-bg p-5">
            <h2 className="mb-4 text-sm font-semibold">{t("leaderboard")}</h2>
            {lbLoading ? (
              <div className="py-12 text-center text-xs text-muted">Loading...</div>
            ) : leaderboard.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted">{t("lbEmpty")}</p>
                <p className="mt-1 text-[10px] text-muted/60">{t("lbMinNote")}</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-card-border text-left text-[10px] uppercase tracking-wider text-muted">
                        <th className="pb-2 pr-3">{t("lbRank")}</th>
                        <th className="pb-2">{t("lbUser")}</th>
                        <th className="pb-2 text-right">{t("lbPredictions")}</th>
                        <th className="pb-2 text-right">{t("lbCorrect")}</th>
                        <th className="pb-2 text-right">{t("lbAccuracy")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((entry) => (
                        <tr key={entry.rank} className="border-b border-card-border/30 hover:bg-card-border/20">
                          <td className="py-2.5 pr-3 font-mono">
                            {entry.rank <= 3
                              ? ["", "\u{1F947}", "\u{1F948}", "\u{1F949}"][entry.rank]
                              : entry.rank}
                          </td>
                          <td className="py-2.5 font-medium">{entry.email}</td>
                          <td className="py-2.5 text-right tabular-nums text-muted">{entry.total}</td>
                          <td className="py-2.5 text-right tabular-nums text-gain">{entry.correct}</td>
                          <td className="py-2.5 text-right tabular-nums font-medium">
                            <span className={entry.accuracy >= 60 ? "text-gain" : entry.accuracy >= 40 ? "text-yellow-400" : "text-loss"}>
                              {entry.accuracy}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-[9px] text-muted/60">{t("lbMinNote")}</p>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Polymarket-style Card ─────────────────────────────────────

function MarketCard({
  pred,
  userVote,
  lang,
  t,
  onVote,
}: {
  pred: Prediction;
  userVote: UserVote | undefined;
  lang: "en" | "kr";
  t: (key: MessageKey) => string;
  onVote: (predId: string, optionId: "yes" | "no") => void;
}) {
  const s = pred.stats;
  const tl = timeLeft(pred.closesAt);
  const expired = !tl.text;
  const canVote = pred.status === "open" && !expired && !userVote;
  const catColor = CAT_COLORS[pred.category] || CAT_COLORS.other;
  const volume = mockVolume(pred.id);

  return (
    <div className="group relative flex flex-col rounded-xl border border-card-border bg-card-bg p-4 transition-all hover:border-foreground/15 hover:shadow-md">
      {/* Category badge + deadline */}
      <div className="mb-3 flex items-center justify-between">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${catColor.bg} ${catColor.text}`}>
          {t(CAT_LABEL_KEY[pred.category])}
        </span>
        {tl.text ? (
          <span className={`text-[10px] font-medium tabular-nums ${tl.urgent ? "text-loss" : "text-muted"}`}>
            {tl.text} {t("predLeft")}
          </span>
        ) : (
          <span className="text-[10px] text-muted">{t("predEnded")}</span>
        )}
      </div>

      {/* Title */}
      <h3 className="mb-3 text-[13px] font-semibold leading-snug flex-1">{pred.title[lang]}</h3>

      {/* Big probability display */}
      {s && (
        <div className="mb-3">
          {/* Probability bar */}
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-card-border">
            <div
              className="h-full rounded-l-full bg-gain transition-all duration-500"
              style={{ width: `${s.yesPct}%` }}
            />
            <div
              className="h-full rounded-r-full bg-loss transition-all duration-500"
              style={{ width: `${s.noPct}%` }}
            />
          </div>

          {/* YES / NO labels with percentage */}
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-gain" />
              <span className="text-[11px] text-muted">{t("predYes")}</span>
              <span className="text-sm font-bold tabular-nums text-gain">{s.yesPct}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tabular-nums text-loss">{s.noPct}%</span>
              <span className="text-[11px] text-muted">{t("predNo")}</span>
              <div className="h-2.5 w-2.5 rounded-full bg-loss" />
            </div>
          </div>
        </div>
      )}

      {/* Stats row: participants + volume */}
      <div className="mb-3 flex items-center gap-3 text-[10px] text-muted">
        <span className="flex items-center gap-1">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {s?.participants ?? 0} {t("predParticipants")}
        </span>
        <span className="flex items-center gap-1">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          {volume.toLocaleString()} pts
        </span>
      </div>

      {/* Vote buttons */}
      {canVote ? (
        <div className="flex gap-2">
          <button
            onClick={() => onVote(pred.id, "yes")}
            className="flex-1 rounded-lg border border-gain/30 bg-gain/5 py-2 text-xs font-bold text-gain transition-all hover:bg-gain/15 hover:border-gain/50"
          >
            {t("predYes")} {s?.yesPct}%
          </button>
          <button
            onClick={() => onVote(pred.id, "no")}
            className="flex-1 rounded-lg border border-loss/30 bg-loss/5 py-2 text-xs font-bold text-loss transition-all hover:bg-loss/15 hover:border-loss/50"
          >
            {t("predNo")} {s?.noPct}%
          </button>
        </div>
      ) : userVote ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-card-border bg-background py-2">
          <span className="text-[10px] text-muted">{t("predYourVote")}:</span>
          <span className={`text-xs font-bold ${userVote.optionId === "yes" ? "text-gain" : "text-loss"}`}>
            {userVote.optionId === "yes" ? t("predYes") : t("predNo")}
          </span>
        </div>
      ) : (
        <div className="rounded-lg border border-card-border bg-background py-2 text-center text-[10px] text-muted">
          {expired ? t("predVotingClosed") : t("predVotingUnavailable")}
        </div>
      )}

      {/* Resolved result overlay */}
      {pred.status === "resolved" && pred.resolvedOptionId && (
        <div className="mt-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-center">
          <p className="text-[9px] uppercase tracking-wider text-muted">{t("predResult")}</p>
          <p className={`text-lg font-bold ${pred.resolvedOptionId === "yes" ? "text-gain" : "text-loss"}`}>
            {pred.resolvedOptionId === "yes" ? t("predYes") : t("predNo")}
          </p>
        </div>
      )}
    </div>
  );
}
