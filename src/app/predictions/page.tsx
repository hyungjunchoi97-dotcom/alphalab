"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLang } from "@/lib/LangContext";
import AppHeader from "@/components/AppHeader";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";
import type { MessageKey } from "@/lib/i18n";
import type { PredictionCategory } from "@/lib/predictionStore";
import { calculateBetReturn, validateBet, probabilityAfterBet } from "@/lib/amm";

// ── Constants ──────────────────────────────────────────────────

const CATEGORIES: ("all" | PredictionCategory)[] = [
  "all", "stocks", "politics", "economy", "entertainment", "crypto", "other",
];

const CAT_LABEL_KEY: Record<"all" | PredictionCategory, MessageKey> = {
  all: "catAll", stocks: "catStocks", politics: "catPolitics", economy: "catEconomy",
  entertainment: "catEntertainment", crypto: "catCrypto", other: "catOther",
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
  yesOdds: number;
  noOdds: number;
  yesPool: number;
  noPool: number;
  totalPool: number;
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
  oddsAtBet?: number;
  potentialPayout?: number;
}

interface MyBet {
  id: string;
  predictionId: string;
  predictionTitle: string;
  predictionStatus: string;
  resolvedOutcome: string | null;
  side: "yes" | "no";
  pointsWagered: number;
  oddsAtBet: number;
  potentialPayout: number;
  actualPayout: number | null;
  status: "pending" | "won" | "lost" | "refunded";
  createdAt: string;
}

interface UserPoints {
  balance: number;
  total_wagered: number;
  total_won: number;
}

interface Comment {
  id: string;
  userName: string;
  content: string;
  createdAt: string;
}

interface LeaderboardEntry {
  rank: number;
  email: string;
  balance: number;
  totalWagered: number;
  totalWon: number;
  winRate: number | null;
  wonCount: number;
  totalBets: number;
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

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

// ── Page ───────────────────────────────────────────────────────

export default function PredictionsPage() {
  const { t, lang } = useLang();
  const { session } = useAuth();
  const [tab, setTab] = useState<"markets" | "myBets" | "leaderboard">("markets");
  const [category, setCategory] = useState<"all" | PredictionCategory>("all");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [userBets, setUserBets] = useState<Record<string, UserBet>>({});
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null);
  const [myBets, setMyBets] = useState<MyBet[]>([]);
  const [myBetsLoading, setMyBetsLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Bet modal state
  const [betModal, setBetModal] = useState<{ predId: string; choice: "yes" | "no" } | null>(null);
  const [betPoints, setBetPoints] = useState(100);
  const [betSubmitting, setBetSubmitting] = useState(false);

  // Detail panel state
  const [selectedPred, setSelectedPred] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const commentPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // New prediction form
  const [showNew, setShowNew] = useState(false);
  const [newTitleEn, setNewTitleEn] = useState("");
  const [newTitleKr, setNewTitleKr] = useState("");
  const [newCategory, setNewCategory] = useState<PredictionCategory>("other");

  // ── Fetch user points ──
  const fetchUserPoints = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch("/api/user/points", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.ok) {
        setUserPoints({ balance: json.balance, total_wagered: json.total_wagered, total_won: json.total_won });
        if (json.isNew) {
          setToast("환영합니다! 시작 포인트 1,000pts가 지급되었습니다");
          setTimeout(() => setToast(null), 5000);
        }
      }
    } catch { /* */ }
  }, [session?.access_token]);

  useEffect(() => { fetchUserPoints(); }, [fetchUserPoints]);

  // ── Comments ──
  const fetchComments = useCallback(async (predId: string) => {
    try {
      const res = await fetch(`/api/predictions/${predId}/comments`);
      const json = await res.json();
      if (json.ok) setComments(json.comments);
    } catch { /* */ }
  }, []);

  useEffect(() => {
    if (!selectedPred) {
      setComments([]);
      if (commentPollRef.current) clearInterval(commentPollRef.current);
      return;
    }
    fetchComments(selectedPred);
    commentPollRef.current = setInterval(() => fetchComments(selectedPred), 30000);
    return () => { if (commentPollRef.current) clearInterval(commentPollRef.current); };
  }, [selectedPred, fetchComments]);

  const submitComment = async () => {
    if (!selectedPred || !session?.access_token || !commentText.trim() || commentSubmitting) return;
    setCommentSubmitting(true);
    try {
      const res = await fetch(`/api/predictions/${selectedPred}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      const json = await res.json();
      if (json.ok) { setComments((prev) => [json.comment, ...prev]); setCommentText(""); }
    } catch { /* */ }
    finally { setCommentSubmitting(false); }
  };

  // ── Predictions ──
  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/predictions");
      const json = await res.json();
      if (json.ok) setPredictions(json.predictions);
    } catch { /* */ }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // ── User bets per prediction ──
  useEffect(() => {
    if (!session?.access_token || predictions.length === 0) return;
    const fetchBets = async () => {
      const betsMap: Record<string, UserBet> = {};
      for (const pred of predictions) {
        try {
          const res = await fetch(`/api/predictions/${pred.id}/bet`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          const json = await res.json();
          if (json.ok && json.bet) {
            betsMap[pred.id] = {
              choice: json.bet.choice,
              points: json.bet.points,
              oddsAtBet: json.bet.oddsAtBet,
              potentialPayout: json.bet.potentialPayout,
            };
          }
        } catch { /* */ }
      }
      setUserBets(betsMap);
    };
    fetchBets();
  }, [session?.access_token, predictions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Leaderboard ──
  useEffect(() => {
    if (tab !== "leaderboard") return;
    setLbLoading(true);
    fetch("/api/predictions/leaderboard")
      .then((r) => r.json())
      .then((json) => { if (json.ok) setLeaderboard(json.leaderboard); })
      .catch(() => {})
      .finally(() => setLbLoading(false));
  }, [tab]);

  // ── My Bets ──
  useEffect(() => {
    if (tab !== "myBets" || !session?.access_token) return;
    setMyBetsLoading(true);
    fetch("/api/predictions/my-bets", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((json) => { if (json.ok) setMyBets(json.bets); })
      .catch(() => {})
      .finally(() => setMyBetsLoading(false));
  }, [tab, session?.access_token]);

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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ choice: betModal.choice, points: betPoints }),
      });
      const json = await res.json();
      if (json.ok) {
        setUserBets((prev) => ({
          ...prev,
          [betModal.predId]: {
            choice: betModal.choice,
            points: betPoints,
            oddsAtBet: json.odds_locked,
            potentialPayout: json.potential_payout,
          },
        }));
        setPredictions((prev) =>
          prev.map((p) => (p.id === betModal.predId ? { ...p, stats: { ...p.stats, ...json.stats } } : p))
        );
        if (json.new_balance !== undefined) {
          setUserPoints((prev) => prev ? { ...prev, balance: json.new_balance } : null);
        }
        setBetModal(null);
        setToast(`베팅 완료! ${json.odds_locked}x · 예상 수령 ${Math.round(json.potential_payout).toLocaleString()} pts`);
        setTimeout(() => setToast(null), 4000);
      } else {
        setToast(json.error || "베팅 실패");
        setTimeout(() => setToast(null), 3000);
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

  const openPreds = predictions.filter((p) => p.status === "open");
  const displayed = category === "all" ? openPreds : openPreds.filter((p) => p.category === category);
  const sorted = [...displayed].sort(
    (a, b) => (b.stats?.volume ?? 0) - (a.stats?.volume ?? 0) || (b.stats?.participants ?? 0) - (a.stats?.participants ?? 0)
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="predictions" />

      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-[#1a1a1a] border border-amber-500/30 text-amber-400 text-xs font-mono px-5 py-3 rounded-lg shadow-xl max-w-sm text-center pointer-events-none">
          {toast}
        </div>
      )}

      <main className="mx-auto max-w-[1200px] px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{t("predictions")}</h1>
            <p className="text-xs text-muted mt-0.5">
              {lang === "kr" ? "예측 마켓에 참여하고 포인트를 획득하세요" : "Bet on outcomes, earn points for accuracy"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {userPoints !== null && (
              <div className="flex items-center gap-1.5 border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 rounded-lg">
                <span className="text-[10px] text-[#555] font-mono uppercase tracking-wider">BALANCE</span>
                <span className="text-sm font-bold font-mono text-amber-400">{Math.floor(userPoints.balance).toLocaleString()} pts</span>
              </div>
            )}
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
          {(["markets", "myBets", "leaderboard"] as const).map((tv) => (
            <button
              key={tv}
              onClick={() => setTab(tv)}
              className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
                tab === tv ? "bg-card-bg text-foreground shadow-sm" : "text-muted hover:text-foreground"
              }`}
            >
              {tv === "markets"
                ? (lang === "kr" ? "마켓" : "Markets")
                : tv === "myBets"
                ? (lang === "kr" ? "내 베팅" : "My Bets")
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
                const count = cat === "all" ? openPreds.length : openPreds.filter((p) => p.category === cat).length;
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
                  onSelect={(id) => setSelectedPred(id)}
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

        {/* ── My Bets View ── */}
        {tab === "myBets" && (
          <div className="rounded-xl border border-card-border bg-card-bg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">{lang === "kr" ? "내 베팅 내역" : "My Bets"}</h2>
              {userPoints && (
                <div className="text-xs font-mono text-muted">
                  보유 <span className="text-amber-400 font-bold">{Math.floor(userPoints.balance).toLocaleString()}</span> pts
                </div>
              )}
            </div>
            {!session ? (
              <p className="py-12 text-center text-sm text-muted">로그인이 필요합니다</p>
            ) : myBetsLoading ? (
              <div className="py-12 text-center text-xs text-muted">Loading...</div>
            ) : myBets.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted">아직 베팅 내역이 없습니다</p>
                <p className="mt-1 text-xs text-muted/60">마켓 탭에서 예측에 참여해보세요</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-card-border text-left text-[10px] uppercase tracking-wider text-muted">
                      <th className="pb-2 pr-3">예측</th>
                      <th className="pb-2 pr-3">선택</th>
                      <th className="pb-2 pr-3 text-right">베팅</th>
                      <th className="pb-2 pr-3 text-right">배당</th>
                      <th className="pb-2 pr-3 text-right">수익</th>
                      <th className="pb-2 text-right">결과</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myBets.map((bet) => {
                      const isWon = bet.status === "won";
                      const isLost = bet.status === "lost";
                      const isPending = bet.status === "pending";
                      return (
                        <tr key={bet.id} className="border-b border-card-border/30 hover:bg-card-border/20">
                          <td className="py-2.5 pr-3 max-w-[180px]">
                            <p className="truncate font-medium text-foreground">{bet.predictionTitle}</p>
                            <p className="text-[9px] text-muted mt-0.5">{relativeTime(bet.createdAt)}</p>
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className={`text-xs font-bold ${bet.side === "yes" ? "text-green-400" : "text-red-400"}`}>
                              {bet.side === "yes" ? "예" : "아니오"}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums font-mono">
                            {bet.pointsWagered.toLocaleString()}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums font-mono text-amber-400">
                            {bet.oddsAtBet}x
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums font-mono">
                            {isWon && bet.actualPayout !== null ? (
                              <span className="text-green-400">+{Math.round(bet.actualPayout).toLocaleString()}</span>
                            ) : isLost ? (
                              <span className="text-red-400">-{bet.pointsWagered.toLocaleString()}</span>
                            ) : (
                              <span className="text-[#555]">{Math.round(bet.potentialPayout).toLocaleString()}</span>
                            )}
                          </td>
                          <td className="py-2.5 text-right">
                            {isPending && (
                              <span className="text-[10px] font-mono text-[#555] border border-[#333] px-1.5 py-0.5 rounded">진행중</span>
                            )}
                            {isWon && (
                              <span className="text-[10px] font-bold text-green-400 border border-green-500/30 bg-green-500/10 px-1.5 py-0.5 rounded">적중</span>
                            )}
                            {isLost && (
                              <span className="text-[10px] font-bold text-red-400 border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 rounded">낙첨</span>
                            )}
                            {bet.status === "refunded" && (
                              <span className="text-[10px] font-bold text-amber-400 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded">환불</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-card-border text-left text-[10px] uppercase tracking-wider text-muted">
                      <th className="pb-2 pr-3">{t("lbRank")}</th>
                      <th className="pb-2 pr-3">{t("lbUser")}</th>
                      <th className="pb-2 pr-3 text-right">잔고</th>
                      <th className="pb-2 pr-3 text-right">승률</th>
                      <th className="pb-2 text-right">총 베팅</th>
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
                        <td className="py-2.5 pr-3 font-medium">{entry.email}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums font-mono font-bold text-amber-400">
                          {entry.balance.toLocaleString()} pts
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">
                          {entry.winRate !== null ? (
                            <span className={entry.winRate >= 60 ? "text-green-400" : entry.winRate >= 40 ? "text-yellow-400" : "text-red-400"}>
                              {entry.winRate}%
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right tabular-nums font-mono text-muted">
                          {entry.totalWagered.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Bet Modal ── */}
      {betModal && (() => {
        const pred = predictions.find((p) => p.id === betModal.predId);
        if (!pred) return null;
        const isYes = betModal.choice === "yes";
        const s = pred.stats;
        const yesPool = s.yesPool ?? 100;
        const noPool = s.noPool ?? 100;

        // Live AMM calculation
        const validErr = betPoints >= 10 ? validateBet(yesPool, noPool, betModal.choice, betPoints) : null;
        const ammResult = betPoints >= 10 && !validErr
          ? calculateBetReturn(yesPool, noPool, betModal.choice, betPoints)
          : null;
        const afterProb = betPoints >= 10 && !validErr
          ? probabilityAfterBet(yesPool, noPool, betModal.choice, betPoints)
          : null;

        const potentialPayout = ammResult ? Math.round(ammResult.potentialPayout) : 0;
        const profit = potentialPayout - betPoints;
        const effectiveOdds = ammResult?.effectiveOdds ?? (isYes ? s.yesOdds : s.noOdds);
        const insufficient = userPoints !== null && betPoints > userPoints.balance;
        const priceImpact = betPoints > 0 && Math.min(yesPool, noPool) > 0
          ? betPoints / Math.min(yesPool, noPool)
          : 0;
        const highImpact = priceImpact > 0.05;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setBetModal(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-card-border bg-card-bg p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold mb-1">{pred.title[lang]}</h3>

              {/* Current market odds (side by side) */}
              <div className="mb-4 flex gap-3">
                <div className={`flex-1 rounded-lg p-3 text-center border ${isYes ? "border-green-500/40 bg-green-500/5" : "border-[#1a1a1a] bg-[#111]"}`}>
                  <p className="text-[9px] uppercase tracking-wider text-muted mb-0.5">{t("predYes")}</p>
                  <p className="text-xl font-bold font-mono text-green-400">{s.yesPct}%</p>
                  <p className="text-[10px] font-mono text-amber-400">{s.yesOdds}x</p>
                </div>
                <div className={`flex-1 rounded-lg p-3 text-center border ${!isYes ? "border-red-500/40 bg-red-500/5" : "border-[#1a1a1a] bg-[#111]"}`}>
                  <p className="text-[9px] uppercase tracking-wider text-muted mb-0.5">{t("predNo")}</p>
                  <p className="text-xl font-bold font-mono text-red-400">{s.noPct}%</p>
                  <p className="text-[10px] font-mono text-amber-400">{s.noOdds}x</p>
                </div>
              </div>

              {/* Points input */}
              <div className="mb-3">
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {t("betPoints")}
                </label>
                <input
                  type="number"
                  min={10}
                  value={betPoints}
                  onChange={(e) => setBetPoints(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full rounded-lg border border-card-border bg-background px-3 py-2.5 text-center text-lg font-bold tabular-nums text-foreground focus:border-accent focus:outline-none"
                />
              </div>

              {/* Presets */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {POINT_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setBetPoints(p)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
                      betPoints === p ? "bg-accent text-white" : "bg-card-border/50 text-muted hover:text-foreground"
                    }`}
                  >
                    {p.toLocaleString()} pts
                  </button>
                ))}
              </div>

              {/* Live AMM preview */}
              {validErr ? (
                <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-center">
                  <p className="text-xs text-red-400">{validErr}</p>
                </div>
              ) : betPoints >= 10 && ammResult ? (
                <div className="mb-3 rounded-lg border border-card-border bg-background px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted">{lang === "kr" ? "예상 수령" : "Expected Payout"}</span>
                    <span className="text-sm font-bold font-mono text-foreground">
                      {potentialPayout.toLocaleString()} pts
                      <span className={`text-[10px] ml-1.5 ${profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                        ({profit >= 0 ? "+" : ""}{profit.toLocaleString()})
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted">{lang === "kr" ? "유효 배당" : "Effective Odds"}</span>
                    <span className="text-[10px] font-mono font-bold text-amber-400">{effectiveOdds}x</span>
                  </div>
                  {afterProb && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted">{lang === "kr" ? "베팅 후 확률" : "Prob after bet"}</span>
                      <span className="text-[10px] font-mono text-[#888]">
                        {isYes ? s.yesPct : s.noPct}% → <span className="text-white">{isYes ? afterProb.yesPct : afterProb.noPct}%</span>
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted">{lang === "kr" ? "총 풀" : "Total Pool"}</span>
                    <span className="text-[10px] font-mono text-[#888]">{Math.round(s.totalPool)} pts</span>
                  </div>
                </div>
              ) : null}

              {/* High price impact warning */}
              {highImpact && !validErr && (
                <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                  <p className="text-[10px] text-amber-400">⚠ {lang === "kr" ? "베팅 규모가 커서 배당이 크게 변동됩니다" : "Large bet — significant price impact"}</p>
                </div>
              )}

              {/* Balance + warning */}
              <div className="mb-4 flex items-center justify-between text-[10px] font-mono">
                {userPoints ? (
                  <span className={insufficient ? "text-red-400" : "text-muted"}>
                    보유: <span className={insufficient ? "text-red-400 font-bold" : "text-amber-400"}>{Math.floor(userPoints.balance).toLocaleString()} pts</span>
                    {insufficient && " (부족)"}
                  </span>
                ) : <span />}
                <span className="text-[#555]">베팅 후 취소 불가</span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={submitBet}
                  disabled={betPoints < 10 || betSubmitting || insufficient || !!validErr}
                  className={`flex-1 rounded-lg py-2.5 text-xs font-bold transition-all disabled:opacity-40 ${
                    isYes ? "bg-gain text-white hover:bg-gain/90" : "bg-loss text-white hover:bg-loss/90"
                  }`}
                >
                  {betSubmitting ? "..." : `베팅 확정 (${betPoints.toLocaleString()} pts)`}
                </button>
                <button
                  onClick={() => setBetModal(null)}
                  className="rounded-lg border border-card-border px-4 py-2.5 text-xs text-muted transition-colors hover:text-foreground"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Detail Modal ── */}
      {selectedPred && (() => {
        const pred = predictions.find((p) => p.id === selectedPred);
        if (!pred) return null;
        const s = pred.stats;
        const userBet = userBets[pred.id];
        const hasBet = !!userBet;

        return (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              onClick={() => setSelectedPred(null)}
            />
            <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[80vh] bg-[#0a0a0a] border border-[#1a1a1a] rounded-sm flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between p-5 border-b border-[#1a1a1a]">
                <div className="flex-1 mr-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold mb-2 ${(CAT_COLORS[pred.category] || CAT_COLORS.other).bg} ${(CAT_COLORS[pred.category] || CAT_COLORS.other).text}`}>
                    {t(CAT_LABEL_KEY[pred.category])}
                  </span>
                  <h2 className="text-sm font-medium text-foreground leading-snug">{pred.title[lang]}</h2>
                  {pred.description[lang] && (
                    <p className="text-[11px] text-[#666] mt-1 leading-relaxed">{pred.description[lang]}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedPred(null)}
                  className="text-[#555] hover:text-foreground transition-colors mt-0.5"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Odds + stats */}
              {s && (
                <div className="px-5 py-4 border-b border-[#1a1a1a]">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl font-bold font-mono text-green-400">{s.yesPct}%</span>
                      <span className="text-[10px] text-[#555]">{t("predYes")}</span>
                      {s.yesOdds && <span className="text-[10px] font-mono text-amber-400">{s.yesOdds}x</span>}
                    </div>
                    <div className="w-px h-6 bg-[#1a1a1a]" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl font-bold font-mono text-red-400">{s.noPct}%</span>
                      <span className="text-[10px] text-[#555]">{t("predNo")}</span>
                      {s.noOdds && <span className="text-[10px] font-mono text-amber-400">{s.noOdds}x</span>}
                    </div>
                  </div>
                  <div className="flex h-1.5 w-full overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: `${s.yesPct}%` }} />
                    <div className="h-full bg-red-500" style={{ width: `${s.noPct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#555] mt-2">
                    <span>{t("predParticipants")} {s.participants}</span>
                    <span>총 풀 {Math.round(s.totalPool ?? 200).toLocaleString()} pts</span>
                  </div>
                </div>
              )}

              {/* My position */}
              {hasBet && (
                <div className="px-5 py-3 border-b border-[#1a1a1a]">
                  <p className="text-[9px] uppercase tracking-widest text-[#555] font-semibold mb-1.5">
                    {lang === "kr" ? "내 포지션" : "My Position"}
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-xs font-bold ${userBet.choice === "yes" ? "text-green-400" : "text-red-400"}`}>
                      {userBet.choice === "yes" ? t("predYes") : t("predNo")}
                    </span>
                    <span className="text-[10px] font-mono text-amber-400">{userBet.points.toLocaleString()} pts</span>
                    {userBet.oddsAtBet && <span className="text-[10px] font-mono text-[#555]">@ {userBet.oddsAtBet}x</span>}
                    {userBet.potentialPayout && (
                      <span className="text-[10px] font-mono text-[#777]">
                        → {Math.round(userBet.potentialPayout).toLocaleString()} pts
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Comments */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="px-5 pt-4 pb-2">
                  <p className="text-[9px] uppercase tracking-widest text-[#555] font-semibold">
                    {lang === "kr" ? "댓글" : "Comments"} <span className="text-[#333]">({comments.length})</span>
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto px-5 space-y-3 pb-3">
                  {comments.length === 0 ? (
                    <p className="text-[11px] text-[#333] font-mono py-6 text-center">
                      {lang === "kr" ? "아직 댓글이 없습니다" : "No comments yet"}
                    </p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[11px] font-medium text-[#888] truncate max-w-[120px]">{c.userName}</span>
                          <span className="text-[9px] font-mono text-[#333]">{relativeTime(c.createdAt)}</span>
                        </div>
                        <p className="text-xs text-[#ccc] leading-relaxed">{c.content}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="border-t border-[#1a1a1a] p-4">
                  {hasBet ? (
                    <div>
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value.slice(0, 200))}
                        onKeyDown={(e) => {
                          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                            e.preventDefault();
                            submitComment();
                          }
                        }}
                        placeholder={lang === "kr" ? "댓글을 작성하세요..." : "Write a comment..."}
                        rows={2}
                        className="w-full bg-[#111] border border-[#1a1a1a] rounded px-3 py-2 text-xs text-foreground placeholder:text-[#333] focus:border-[#333] focus:outline-none resize-none font-mono"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[9px] font-mono text-[#333]">{commentText.length}/200</span>
                        <button
                          onClick={submitComment}
                          disabled={!commentText.trim() || commentSubmitting}
                          className="px-4 py-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold tracking-wider transition-colors hover:bg-amber-500/30 disabled:opacity-30"
                        >
                          {commentSubmitting ? "..." : lang === "kr" ? "댓글 작성" : "Comment"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 py-2">
                      <svg className="w-4 h-4 text-[#333] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <p className="text-[11px] text-[#555] font-mono">
                        {lang === "kr"
                          ? "예측에 참여한 사용자만 댓글을 작성할 수 있습니다"
                          : "Only users who have bet can comment"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

// ── MarketCard ─────────────────────────────────────────────────

function MarketCard({
  pred,
  userBet,
  lang,
  t,
  onBet,
  onSelect,
  isLoggedIn,
  requireAuth,
}: {
  pred: Prediction;
  userBet: UserBet | undefined;
  lang: "en" | "kr";
  t: (key: MessageKey) => string;
  onBet: (predId: string, choice: "yes" | "no") => void;
  onSelect: (predId: string) => void;
  isLoggedIn: boolean;
  requireAuth: (fn: () => void) => void;
}) {
  const s = pred.stats;
  const tl = timeLeft(pred.closesAt);
  const expired = !tl.text;
  const canBet = pred.status === "open" && !expired && !userBet;
  const catColor = CAT_COLORS[pred.category] || CAT_COLORS.other;

  return (
    <div
      className="group relative flex flex-col bg-[#0a0a0a] border border-[#1a1a1a] rounded-none p-4 transition-colors hover:border-[#2a2a2a] cursor-pointer"
      onClick={() => onSelect(pred.id)}
    >
      {/* Category + time */}
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

      {/* AMM probability + odds */}
      {s && (
        <div className="mb-3">
          <div className="flex items-center gap-3 mb-2">
            <div>
              <span className="text-xl font-bold font-mono text-green-400">{s.yesPct}%</span>
              <span className="text-[9px] text-[#555] ml-1">{t("predYes")}</span>
              <p className="text-[10px] font-mono text-amber-400/70">{s.yesOdds}x</p>
            </div>
            <div className="w-px h-8 bg-[#1a1a1a]" />
            <div>
              <span className="text-xl font-bold font-mono text-red-400">{s.noPct}%</span>
              <span className="text-[9px] text-[#555] ml-1">{t("predNo")}</span>
              <p className="text-[10px] font-mono text-amber-400/70">{s.noOdds}x</p>
            </div>
          </div>
          <div className="flex h-1.5 w-full overflow-hidden">
            <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${s.yesPct}%` }} />
            <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${s.noPct}%` }} />
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-between text-[10px] font-mono text-[#555] mb-3">
        <span>{t("predParticipants")} {s?.participants ?? 0}</span>
        <span>총 풀 {Math.round(s?.totalPool ?? 200).toLocaleString()} pts</span>
      </div>

      {/* Bet buttons */}
      {canBet ? (
        <div className="flex gap-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => { if (!isLoggedIn) { requireAuth(() => {}); return; } onBet(pred.id, "yes"); }}
            className="flex-1 h-9 bg-green-500/10 text-green-400 border border-green-500/20 text-xs font-bold tracking-wider transition-colors hover:bg-green-500/20"
          >
            {t("predYes")} {s?.yesPct ?? 50}%
          </button>
          <button
            onClick={() => { if (!isLoggedIn) { requireAuth(() => {}); return; } onBet(pred.id, "no"); }}
            className="flex-1 h-9 bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold tracking-wider transition-colors hover:bg-red-500/20"
          >
            {t("predNo")} {s?.noPct ?? 50}%
          </button>
        </div>
      ) : userBet ? (
        <div className="flex items-center justify-between border border-[#1a1a1a] bg-[#111] px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#555]">{t("betMyBet")}:</span>
            <span className={`text-xs font-bold ${userBet.choice === "yes" ? "text-green-400" : "text-red-400"}`}>
              {userBet.choice === "yes" ? t("predYes") : t("predNo")}
            </span>
            {userBet.oddsAtBet && <span className="text-[9px] font-mono text-amber-400">@ {userBet.oddsAtBet}x</span>}
          </div>
          <span className="text-[10px] font-bold font-mono text-amber-400">{userBet.points.toLocaleString()} pts</span>
        </div>
      ) : (
        <div className="border border-[#1a1a1a] bg-[#111] py-2 text-center text-[10px] font-mono text-[#555]">
          {pred.status !== "open" ? t("predVotingClosed") : t("predVotingUnavailable")}
        </div>
      )}

      {/* Resolved result banner */}
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
