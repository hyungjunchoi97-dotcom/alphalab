"use client";

import { useState, useEffect, useCallback } from "react";
import { useLang } from "@/lib/LangContext";
import AppHeader from "@/components/AppHeader";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";
import type { MessageKey } from "@/lib/i18n";
import type { PredictionCategory } from "@/lib/predictionStore";

const CARD =
  "rounded-[12px] border border-card-border bg-card-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3)]";

const CATEGORIES: PredictionCategory[] = ["stocks", "realestate", "politics", "other"];
const CAT_LABEL_KEY: Record<PredictionCategory, MessageKey> = {
  stocks: "catStocks",
  realestate: "catRealestate",
  politics: "catPolitics",
  other: "catOther",
};

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

function formatKST(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeLeft(iso: string, leftLabel: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h ${leftLabel}`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${mins}m ${leftLabel}`;
}

export default function PredictionsPage() {
  const { t, lang } = useLang();
  const { session } = useAuth();
  const [tab, setTab] = useState<"open" | "closed" | "leaderboard">("open");
  const [category, setCategory] = useState<PredictionCategory>("stocks");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, UserVote>>({});

  // Leaderboard state
  interface LeaderboardEntry {
    rank: number;
    email: string;
    total: number;
    correct: number;
    accuracy: number;
  }
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);

  // Inline "new" form state (other category only)
  const [showNew, setShowNew] = useState(false);
  const [newTitleEn, setNewTitleEn] = useState("");
  const [newTitleKr, setNewTitleKr] = useState("");

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/predictions");
      const json = await res.json();
      if (json.ok) {
        setPredictions(json.predictions);
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Fetch leaderboard when tab changes to it
  useEffect(() => {
    if (tab !== "leaderboard") return;
    setLbLoading(true);
    fetch("/api/predictions/leaderboard")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setLeaderboard(json.leaderboard);
      })
      .catch(() => {})
      .finally(() => setLbLoading(false));
  }, [tab]);

  // Load user votes from localStorage (keyed by user id)
  useEffect(() => {
    if (!session?.user?.id) return;
    const key = `pb_votes_${session.user.id}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        setUserVotes(JSON.parse(raw));
      } catch { /* ignore */ }
    }
  }, [session?.user?.id]);

  const saveUserVote = (predId: string, optionId: "yes" | "no") => {
    const updated = { ...userVotes, [predId]: { predictionId: predId, optionId } };
    setUserVotes(updated);
    if (session?.user?.id) {
      localStorage.setItem(`pb_votes_${session.user.id}`, JSON.stringify(updated));
    }
  };

  const requireAuth = useRequireAuth();

  const handleVote = (predId: string, optionId: "yes" | "no") => {
    requireAuth(async () => {
      if (!session?.access_token) return;
      try {
        const res = await fetch(`/api/predictions/${predId}/vote`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ optionId }),
        });
        const json = await res.json();
        if (json.ok) {
          saveUserVote(predId, optionId);
          // Update stats in place
          setPredictions((prev) =>
            prev.map((p) => (p.id === predId ? { ...p, stats: json.stats } : p))
          );
        }
      } catch {
        // silently fail
      }
    });
  };

  const handleNewSubmit = () => {
    requireAuth(async () => {
      const titleEn = newTitleEn.trim();
      if (!titleEn || !session?.access_token) return;
      try {
        const res = await fetch("/api/predictions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            title_en: titleEn,
            title_kr: newTitleKr.trim() || titleEn,
            category: "other",
            closes_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          }),
        });
        const json = await res.json();
        if (json.ok) {
          setNewTitleEn("");
          setNewTitleKr("");
          setShowNew(false);
          reload();
        }
      } catch {
        // silently fail
      }
    });
  };

  // Filter: status → category
  const byStatus = predictions.filter((p) =>
    tab === "open" ? p.status === "open" : p.status === "closed" || p.status === "resolved"
  );
  const displayed = byStatus.filter((p) => p.category === category);

  // Counts
  const openCount = predictions.filter((p) => p.status === "open").length;
  const closedCount = predictions.filter((p) => p.status !== "open").length;

  // Trending: top 1 by participants within displayed, ties → newest
  let trending: Prediction | null = null;
  if (displayed.length > 0) {
    trending = displayed.reduce((best, cur) => {
      const bestP = best.stats?.participants ?? 0;
      const curP = cur.stats?.participants ?? 0;
      if (curP > bestP) return cur;
      if (curP === bestP && cur.createdAt > best.createdAt) return cur;
      return best;
    });
  }
  const gridItems = displayed.filter((p) => p.id !== trending?.id);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="predictions" />

      <main className="mx-auto max-w-[1400px] px-4 py-4 space-y-3">
        {/* Status tabs + Category tabs */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status */}
          <div className="flex gap-px rounded bg-card-border p-px w-fit">
            {(["open", "closed", "leaderboard"] as const).map((tv) => (
              <button
                key={tv}
                onClick={() => setTab(tv)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  tab === tv
                    ? "bg-accent text-white"
                    : "bg-card-bg text-muted hover:text-foreground"
                }`}
              >
                {tv === "open"
                  ? `${t("predOpen")} (${openCount})`
                  : tv === "closed"
                    ? `${t("predClosed")} (${closedCount})`
                    : `${t("leaderboard")}`}
              </button>
            ))}
          </div>

          {/* Category (hidden on leaderboard tab) */}
          {tab !== "leaderboard" && (
            <>
              <div className="flex gap-px rounded bg-card-border p-px w-fit">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setCategory(cat); setShowNew(false); }}
                    className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      category === cat
                        ? "bg-accent text-white"
                        : "bg-card-bg text-muted hover:text-foreground"
                    }`}
                  >
                    {t(CAT_LABEL_KEY[cat])}
                  </button>
                ))}
              </div>

              {/* + New button (other only) */}
              {category === "other" && (
                <button
                  onClick={() => setShowNew((v) => !v)}
                  className="rounded bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/25"
                >
                  {t("predNew")}
                </button>
              )}
            </>
          )}
        </div>

        {/* ── Leaderboard View ── */}
        {tab === "leaderboard" && (
          <div className={CARD}>
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {t("leaderboard")}
              </h2>
            </div>
            {lbLoading ? (
              <div className="py-8 text-center text-[10px] text-muted">Loading...</div>
            ) : leaderboard.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-muted">{t("lbEmpty")}</p>
                <p className="mt-1 text-[10px] text-muted/60">{t("lbMinNote")}</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-card-border text-left text-[10px] uppercase tracking-wider text-muted">
                        <th className="pb-1.5 pr-3">{t("lbRank")}</th>
                        <th className="pb-1.5">{t("lbUser")}</th>
                        <th className="pb-1.5 text-right">{t("lbPredictions")}</th>
                        <th className="pb-1.5 text-right">{t("lbCorrect")}</th>
                        <th className="pb-1.5 text-right">{t("lbAccuracy")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((entry) => (
                        <tr key={entry.rank} className="border-b border-card-border/30 hover:bg-card-border/20">
                          <td className="py-2 pr-3 font-mono">
                            {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank}
                          </td>
                          <td className="py-2 font-medium">{entry.email}</td>
                          <td className="py-2 text-right tabular-nums text-muted">{entry.total}</td>
                          <td className="py-2 text-right tabular-nums text-gain">{entry.correct}</td>
                          <td className="py-2 text-right tabular-nums font-medium">
                            <span className={entry.accuracy >= 60 ? "text-gain" : entry.accuracy >= 40 ? "text-yellow-400" : "text-loss"}>
                              {entry.accuracy}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[9px] text-muted/60">{t("lbMinNote")}</p>
              </>
            )}
          </div>
        )}

        {/* Inline new prediction form (other category) */}
        {tab !== "leaderboard" && showNew && category === "other" && (
          <div className={CARD}>
            <div className="space-y-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  value={newTitleEn}
                  onChange={(e) => setNewTitleEn(e.target.value)}
                  placeholder="Question (EN)"
                  className="w-full rounded border border-card-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-accent focus:outline-none"
                />
                <input
                  value={newTitleKr}
                  onChange={(e) => setNewTitleKr(e.target.value)}
                  placeholder="질문 (KR)"
                  className="w-full rounded border border-card-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-accent focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleNewSubmit}
                  disabled={!newTitleEn.trim()}
                  className="rounded bg-accent px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  onClick={() => { setShowNew(false); setNewTitleEn(""); setNewTitleKr(""); }}
                  className="rounded border border-card-border px-3 py-1 text-xs text-muted transition-colors hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Trending pinned card */}
        {tab !== "leaderboard" && trending && (
          <div className="relative">
            <span className="absolute -top-1 left-3 z-10 rounded bg-yellow-500/90 px-1.5 py-px text-[9px] font-bold uppercase text-black">
              {t("trending")}
            </span>
            <PredictionCard
              pred={trending}
              userVote={userVotes[trending.id]}
              lang={lang}
              t={t}
              onVote={handleVote}
              className={`${CARD} border-yellow-500/40`}
            />
          </div>
        )}

        {/* Prediction cards grid */}
        {tab !== "leaderboard" && <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {gridItems.map((pred) => (
            <PredictionCard
              key={pred.id}
              pred={pred}
              userVote={userVotes[pred.id]}
              lang={lang}
              t={t}
              onVote={handleVote}
              className={CARD}
            />
          ))}
          {displayed.length === 0 && (
            <p className="col-span-full py-8 text-center text-[10px] text-muted">
              {t("predNoPredictions")}
            </p>
          )}
        </div>}
      </main>
    </div>
  );
}

// ── Extracted card component ──────────────────────────────────────

function PredictionCard({
  pred,
  userVote,
  lang,
  t,
  onVote,
  className,
}: {
  pred: Prediction;
  userVote: UserVote | undefined;
  lang: "en" | "kr";
  t: (key: MessageKey) => string;
  onVote: (predId: string, optionId: "yes" | "no") => void;
  className?: string;
}) {
  const expired = new Date(pred.closesAt) <= new Date();
  const canVote = pred.status === "open" && !expired && !userVote;
  const s = pred.stats;

  return (
    <div className={className}>
      {/* Title + status */}
      <div className="mb-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-xs font-semibold leading-snug">{pred.title[lang]}</h3>
          <span
            className={`shrink-0 rounded px-1.5 py-px text-[9px] font-medium ${
              pred.status === "open"
                ? "bg-gain/20 text-gain"
                : pred.status === "resolved"
                  ? "bg-accent/20 text-accent"
                  : "bg-muted/20 text-muted"
            }`}
          >
            {pred.status === "open" ? t("predOpen") : pred.status === "resolved" ? t("predResult") : t("predClosed")}
          </span>
        </div>
        {pred.description[lang] && (
          <p className="mt-1 text-[10px] leading-relaxed text-muted">
            {pred.description[lang]}
          </p>
        )}
      </div>

      {/* Closes at / time left */}
      <div className="mb-3 flex items-center justify-between text-[10px] text-muted">
        <span>{t("predCloses")}: {formatKST(pred.closesAt)}</span>
        <span
          className={`font-medium ${
            pred.status === "open" && !expired ? "text-yellow-400" : "text-muted"
          }`}
        >
          {pred.status === "open" ? (timeLeft(pred.closesAt, t("predLeft")) || t("predEnded")) : t("predEnded")}
        </span>
      </div>

      {/* Probability bars */}
      {s && (
        <div className="mb-3 space-y-1.5">
          <div>
            <div className="mb-0.5 flex items-center justify-between text-[10px]">
              <span className="font-medium text-gain">{t("predYes")}</span>
              <span className="tabular-nums text-muted">{s.yesPct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-card-border">
              <div
                className="h-full rounded-full bg-gain transition-all"
                style={{ width: `${s.yesPct}%` }}
              />
            </div>
          </div>
          <div>
            <div className="mb-0.5 flex items-center justify-between text-[10px]">
              <span className="font-medium text-loss">{t("predNo")}</span>
              <span className="tabular-nums text-muted">{s.noPct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-card-border">
              <div
                className="h-full rounded-full bg-loss transition-all"
                style={{ width: `${s.noPct}%` }}
              />
            </div>
          </div>
          <p className="text-[9px] text-muted">
            {s.participants} {t("predParticipants")}
          </p>
        </div>
      )}

      {/* Vote buttons or result */}
      {canVote ? (
        <div className="flex gap-2">
          <button
            onClick={() => onVote(pred.id, "yes")}
            className="flex-1 rounded border border-gain/40 py-1.5 text-xs font-medium text-gain transition-colors hover:bg-gain/10"
          >
            {t("predYes")}
          </button>
          <button
            onClick={() => onVote(pred.id, "no")}
            className="flex-1 rounded border border-loss/40 py-1.5 text-xs font-medium text-loss transition-colors hover:bg-loss/10"
          >
            {t("predNo")}
          </button>
        </div>
      ) : userVote ? (
        <div className="rounded border border-card-border/60 bg-background px-3 py-2 text-center">
          <p className="text-[10px] text-muted">{t("predYourVote")}</p>
          <p
            className={`text-xs font-semibold ${
              userVote.optionId === "yes" ? "text-gain" : "text-loss"
            }`}
          >
            {userVote.optionId === "yes" ? t("predYes") : t("predNo")}
          </p>
        </div>
      ) : (
        <div className="rounded border border-card-border/60 bg-background px-3 py-2 text-center text-[10px] text-muted">
          {expired ? t("predVotingClosed") : t("predVotingUnavailable")}
        </div>
      )}

      {/* Resolved result */}
      {pred.status === "resolved" && pred.resolvedOptionId && (
        <div className="mt-2 rounded border border-accent/30 bg-accent/10 px-3 py-2 text-center">
          <p className="text-[9px] uppercase tracking-wider text-muted">{t("predResult")}</p>
          <p
            className={`text-sm font-bold ${
              pred.resolvedOptionId === "yes" ? "text-gain" : "text-loss"
            }`}
          >
            {pred.resolvedOptionId === "yes" ? t("predYes") : t("predNo")}
          </p>
        </div>
      )}
    </div>
  );
}
