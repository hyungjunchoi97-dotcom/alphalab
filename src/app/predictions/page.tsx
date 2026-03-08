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
  economy: { bg: "bg-amber-500/15", text: "text-amber-400" },
  entertainment: { bg: "bg-pink-500/15", text: "text-pink-400" },
  crypto: { bg: "bg-orange-500/15", text: "text-orange-400" },
  other: { bg: "bg-gray-500/15", text: "text-gray-400" },
};

const POINT_PRESETS = [10, 50, 100, 500, 1000];

// ── Types ──────────────────────────────────────────────────────

interface PredictionStats {
  participants: number;
  yesCount: number;
  noCount: number;
  yesPct: number;
  noPct: number;
  volume: number;
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

interface UserBet {
  choice: "yes" | "no";
  points: number;
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

// ── Page ───────────────────────────────────────────────────────

export default function PredictionsPage() {
  const { t, lang } = useLang();
  const { session } = useAuth();
  const [tab, setTab] = useState<"markets" | "leaderboard">("markets");
  const [category, setCategory] = useState<"all" | PredictionCategory>("all");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [userBets, setUserBets] = useState<Record<string, UserBet>>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);

  // Bet modal state
  const [betModal, setBetModal] = useState<{ predId: string; choice: "yes" | "no" } | null>(null);
  const [betPoints, setBetPoints] = useState(100);
  const [betSubmitting, setBetSubmitting] = useState(false);

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

  // Fetch user bets for all predictions
  useEffect(() => {
    if (!session?.access_token) return;
    const fetchBets = async () => {
      const betsMap: Record<string, UserBet> = {};
      for (const pred of predictions) {
        try {
          const res = await fetch(`/api/predictions/${pred.id}/bet`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const json = await res.json();
          if (json.ok && json.bet) {
            betsMap[pred.id] = { choice: json.bet.choice, points: json.bet.points };
          }
        } catch { /* */ }
      }
      setUserBets(betsMap);
    };
    if (predictions.length > 0) fetchBets();
  }, [session?.access_token, predictions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab !== "leaderboard") return;
    setLbLoading(true);
    fetch("/api/predictions/leaderboard")
      .then((r) => r.json())
      .then((json) => { if (json.ok) setLeaderboard(json.leaderboard); })
      .catch(() => {})
      .finally(() => setLbLoading(false));
  }, [tab]);

  const requireAuth = useRequireAuth();

  const openBetModal = (predId: string, choice: "yes" | "no") => {
    requireAuth(() => {
      setBetModal({ predId, choice });
      setBetPoints(100);
    });
  };

  const submitBet = async () => {
    if (!betModal || !session?.access_token || betPoints < 10) return;
    setBetSubmitting(true);
    try {
      const res = await fetch(`/api/predictions/${betModal.predId}/bet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ choice: betModal.choice, points: betPoints }),
      });
      const json = await res.json();
      if (json.ok) {
        setUserBets((prev) => ({
          ...prev,
          [betModal.predId]: { choice: betModal.choice, points: betPoints },
        }));
        setPredictions((prev) =>
          prev.map((p) => (p.id === betModal.predId ? { ...p, stats: json.stats } : p))
        );
        setBetModal(null);
      }
    } catch { /* */ }
    finally { setBetSubmitting(false); }
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

  // Sort by volume desc, then participants
  const sorted = [...displayed].sort(
    (a, b) => (b.stats?.volume ?? 0) - (a.stats?.volume ?? 0) || (b.stats?.participants ?? 0) - (a.stats?.participants ?? 0)
  );

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
                  userBet={userBets[pred.id]}
                  lang={lang}
                  t={t}
                  onBet={openBetModal}
                  isLoggedIn={!!session}
                  requireAuth={requireAuth}
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

      {/* ── Bet Modal Overlay ── */}
      {betModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setBetModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-card-border bg-card-bg p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const pred = predictions.find((p) => p.id === betModal.predId);
              if (!pred) return null;
              const isYes = betModal.choice === "yes";
              return (
                <>
                  <h3 className="text-sm font-semibold mb-1">{pred.title[lang]}</h3>
                  <p className="text-[10px] text-muted mb-4">{pred.description[lang]}</p>

                  {/* Choice badge */}
                  <div className="mb-4 flex items-center gap-2">
                    <span className="text-xs text-muted">{lang === "kr" ? "선택:" : "Choice:"}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                      isYes ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss"
                    }`}>
                      {isYes ? t("predYes") : t("predNo")}
                    </span>
                  </div>

                  {/* Points input */}
                  <div className="mb-3">
                    <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted">
                      {t("betPoints")}
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={10000}
                      value={betPoints}
                      onChange={(e) => setBetPoints(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full rounded-lg border border-card-border bg-background px-3 py-2.5 text-center text-lg font-bold tabular-nums text-foreground focus:border-accent focus:outline-none"
                    />
                  </div>

                  {/* Preset buttons */}
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {POINT_PRESETS.map((p) => (
                      <button
                        key={p}
                        onClick={() => setBetPoints(p)}
                        className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
                          betPoints === p
                            ? "bg-accent text-white"
                            : "bg-card-border/50 text-muted hover:text-foreground"
                        }`}
                      >
                        {p.toLocaleString()} pts
                      </button>
                    ))}
                  </div>

                  <p className="mb-4 text-[9px] text-muted">{t("betMin")}</p>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={submitBet}
                      disabled={betPoints < 10 || betSubmitting}
                      className={`flex-1 rounded-lg py-2.5 text-xs font-bold transition-all disabled:opacity-40 ${
                        isYes
                          ? "bg-gain text-white hover:bg-gain/90"
                          : "bg-loss text-white hover:bg-loss/90"
                      }`}
                    >
                      {betSubmitting
                        ? "..."
                        : `${t("betConfirm")} (${betPoints.toLocaleString()} pts)`}
                    </button>
                    <button
                      onClick={() => setBetModal(null)}
                      className="rounded-lg border border-card-border px-4 py-2.5 text-xs text-muted transition-colors hover:text-foreground"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Polymarket-style Card ─────────────────────────────────────

function MarketCard({
  pred,
  userBet,
  lang,
  t,
  onBet,
  isLoggedIn,
  requireAuth,
}: {
  pred: Prediction;
  userBet: UserBet | undefined;
  lang: "en" | "kr";
  t: (key: MessageKey) => string;
  onBet: (predId: string, choice: "yes" | "no") => void;
  isLoggedIn: boolean;
  requireAuth: (fn: () => void) => void;
}) {
  const s = pred.stats;
  const tl = timeLeft(pred.closesAt);
  const expired = !tl.text;
  const canBet = pred.status === "open" && !expired && !userBet;
  const catColor = CAT_COLORS[pred.category] || CAT_COLORS.other;

  return (
    <div className="group relative flex flex-col bg-[#0a0a0a] border border-[#1a1a1a] rounded-none p-4 transition-colors hover:border-[#2a2a2a]">
      {/* Category badge + days remaining */}
      <div className="flex items-center justify-between">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${catColor.bg} ${catColor.text}`}>
          {t(CAT_LABEL_KEY[pred.category])}
        </span>
        {tl.text ? (
          <span className={`text-[10px] font-mono ${tl.urgent ? "text-red-400" : "text-[#555]"}`}>
            {tl.text} {t("predLeft")}
          </span>
        ) : (
          <span className="text-[10px] font-mono text-[#555]">{t("predEnded")}</span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium text-foreground mt-2 mb-3 line-clamp-2 flex-1">{pred.title[lang]}</h3>

      {/* Probability display */}
      {s && (
        <div className="mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold font-mono text-green-400">{s.yesPct}%</span>
              <span className="text-[10px] text-[#555]">{t("predYes")}</span>
            </div>
            <div className="w-px h-5 bg-[#1a1a1a]" />
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold font-mono text-red-400">{s.noPct}%</span>
              <span className="text-[10px] text-[#555]">{t("predNo")}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex h-1.5 w-full overflow-hidden mt-2">
            <div
              className="h-full bg-green-500 transition-all duration-500"
              style={{ width: `${s.yesPct}%` }}
            />
            <div
              className="h-full bg-red-500 transition-all duration-500"
              style={{ width: `${s.noPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-between text-[10px] font-mono text-[#555] mb-3">
        <span>{t("predParticipants")} {s?.participants ?? 0}</span>
        <span>{(s?.volume ?? 0).toLocaleString()} pts</span>
      </div>

      {/* Bet buttons */}
      {canBet ? (
        <div className="flex gap-0">
          <button
            onClick={() => {
              if (!isLoggedIn) { requireAuth(() => {}); return; }
              onBet(pred.id, "yes");
            }}
            className="flex-1 h-9 bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-bold tracking-wider transition-colors hover:bg-green-500/20"
          >
            {t("predYes")} {s?.yesPct}%
          </button>
          <button
            onClick={() => {
              if (!isLoggedIn) { requireAuth(() => {}); return; }
              onBet(pred.id, "no");
            }}
            className="flex-1 h-9 bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold tracking-wider transition-colors hover:bg-red-500/20"
          >
            {t("predNo")} {s?.noPct}%
          </button>
        </div>
      ) : userBet ? (
        <div className="flex items-center justify-between border border-[#1a1a1a] bg-[#111] px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#555]">{t("betMyBet")}:</span>
            <span className={`text-xs font-bold ${userBet.choice === "yes" ? "text-green-400" : "text-red-400"}`}>
              {userBet.choice === "yes" ? t("predYes") : t("predNo")}
            </span>
          </div>
          <span className="text-[10px] font-bold font-mono text-amber-400">
            {userBet.points.toLocaleString()} pts
          </span>
        </div>
      ) : (
        <div className="border border-[#1a1a1a] bg-[#111] py-2 text-center text-[10px] font-mono text-[#555]">
          {expired ? t("predVotingClosed") : t("predVotingUnavailable")}
        </div>
      )}

      {/* Resolved result overlay */}
      {pred.status === "resolved" && pred.resolvedOptionId && (
        <div className="mt-2 border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center">
          <p className="text-[9px] uppercase tracking-wider text-[#555]">{t("predResult")}</p>
          <p className={`text-lg font-bold ${pred.resolvedOptionId === "yes" ? "text-green-400" : "text-red-400"}`}>
            {pred.resolvedOptionId === "yes" ? t("predYes") : t("predNo")}
          </p>
        </div>
      )}
    </div>
  );
}
