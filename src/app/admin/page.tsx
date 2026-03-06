"use client";

import { useState, useEffect } from "react";
import { useLang, LangToggle } from "@/lib/LangContext";
import HeaderAuth from "@/components/HeaderAuth";
import {
  getPredictions,
  savePredictions,
  upsertPrediction,
  deletePrediction,
  type Prediction,
  type PredictionCategory,
} from "@/lib/predictionStore";

const CARD =
  "rounded-[12px] border border-card-border bg-card-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3)]";
const INPUT =
  "w-full rounded border border-card-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-accent focus:outline-none";

const SESSION_KEY = "pb_admin_session";

interface AdminSession {
  token: string;
  expiresAt: string;
}

function getSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  const session = JSON.parse(raw) as AdminSession;
  if (new Date(session.expiresAt) <= new Date()) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
  return session;
}

export default function AdminPage() {
  const { t } = useLang();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // CRUD state
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [editing, setEditing] = useState<Prediction | null>(null);
  const [formTitleEn, setFormTitleEn] = useState("");
  const [formTitleKr, setFormTitleKr] = useState("");
  const [formDescEn, setFormDescEn] = useState("");
  const [formDescKr, setFormDescKr] = useState("");
  const [formCategory, setFormCategory] = useState<PredictionCategory>("stocks");
  const [formStatus, setFormStatus] = useState<Prediction["status"]>("open");
  const [formClosesAt, setFormClosesAt] = useState("");
  const [formResolved, setFormResolved] = useState<"yes" | "no" | "">("");

  useEffect(() => {
    setSession(getSession());
  }, []);

  useEffect(() => {
    if (session) {
      setPredictions(getPredictions());
    }
  }, [session]);

  const handleLogin = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const json = await res.json();
      if (json.ok) {
        const s: AdminSession = { token: json.token, expiresAt: json.expiresAt };
        localStorage.setItem(SESSION_KEY, JSON.stringify(s));
        setSession(s);
        setPin("");
      } else {
        setAuthError(json.error || "Authentication failed");
      }
    } catch {
      setAuthError("Network error");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  const reload = () => setPredictions(getPredictions());

  const startNew = () => {
    setEditing(null);
    setFormTitleEn("");
    setFormTitleKr("");
    setFormDescEn("");
    setFormDescKr("");
    setFormCategory("stocks");
    setFormStatus("open");
    setFormClosesAt(toLocalDatetime(new Date(Date.now() + 7 * 86400000).toISOString()));
    setFormResolved("");
  };

  const startEdit = (p: Prediction) => {
    setEditing(p);
    setFormTitleEn(p.title.en);
    setFormTitleKr(p.title.kr);
    setFormDescEn(p.description.en);
    setFormDescKr(p.description.kr);
    setFormCategory(p.category);
    setFormStatus(p.status);
    setFormClosesAt(toLocalDatetime(p.closesAt));
    setFormResolved(p.resolvedOptionId || "");
  };

  const handleSave = () => {
    upsertPrediction({
      id: editing?.id,
      title: { en: formTitleEn, kr: formTitleKr },
      description: { en: formDescEn, kr: formDescKr },
      category: formCategory,
      status: formStatus,
      closesAt: new Date(formClosesAt).toISOString(),
      resolvedOptionId: formResolved === "yes" || formResolved === "no" ? formResolved : null,
    });
    reload();
    setEditing(null);
    setFormTitleEn("");
    setFormTitleKr("");
    setFormDescEn("");
    setFormDescKr("");
  };

  const handleDelete = (id: string) => {
    deletePrediction(id);
    reload();
    if (editing?.id === id) setEditing(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-card-border bg-card-bg">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-sm font-bold tracking-tight">Alphalab</h1>
              <p className="text-[10px] text-muted">{t("subtitle")}</p>
            </div>
            <nav className="flex items-center gap-1">
              <a href="/" className="rounded px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-card-border/30 hover:text-foreground">
                {t("dashboard")}
              </a>
              <a href="/portfolio" className="rounded px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-card-border/30 hover:text-foreground">
                {t("portfolio")}
              </a>
              <a href="/flow" className="rounded px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-card-border/30 hover:text-foreground">
                {t("flow")}
              </a>
              <a href="/ideas" className="rounded px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-card-border/30 hover:text-foreground">
                {t("ideas")}
              </a>
              <a href="/ai-trading" className="rounded px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-card-border/30 hover:text-foreground">
                {t("aiTrading")}
              </a>
              <a href="/prompts" className="rounded px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-card-border/30 hover:text-foreground">
                {t("prompts")}
              </a>
              <a href="/predictions" className="rounded px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-card-border/30 hover:text-foreground">
                {t("predictions")}
              </a>
              <a href="/community" className="rounded px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-card-border/30 hover:text-foreground">
                {t("community")}
              </a>
              <span className="rounded bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                Admin
              </span>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <LangToggle />
            <HeaderAuth />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[900px] px-4 py-4 space-y-3">
        {!session ? (
          /* ── PIN Login Gate ── */
          <div className={`${CARD} mx-auto max-w-sm`}>
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Admin Login
              </h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted">
                  PIN
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  placeholder="Enter admin PIN"
                  className={INPUT}
                />
              </div>
              {authError && (
                <div className="rounded border border-loss/30 bg-loss/10 px-3 py-2 text-[10px] text-loss">
                  {authError}
                </div>
              )}
              <button
                onClick={handleLogin}
                disabled={!pin || authLoading}
                className="w-full rounded bg-accent px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {authLoading ? "Verifying..." : "Login"}
              </button>
            </div>
          </div>
        ) : (
          /* ── Admin Dashboard ── */
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-gain" />
                <span className="text-[10px] text-gain font-medium">Authenticated</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={startNew}
                  className="rounded bg-accent px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
                >
                  + New Prediction
                </button>
                <button
                  onClick={handleLogout}
                  className="rounded border border-card-border px-3 py-1 text-xs text-muted transition-colors hover:text-foreground"
                >
                  Logout
                </button>
              </div>
            </div>

            {/* Edit form (shown when creating or editing) */}
            {(formTitleEn !== "" || editing !== null || formDescEn !== "") && (
              <div className={CARD}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {editing ? "Edit Prediction" : "New Prediction"}
                  </h2>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted">
                        Title (EN)
                      </label>
                      <input
                        value={formTitleEn}
                        onChange={(e) => setFormTitleEn(e.target.value)}
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted">
                        Title (KR)
                      </label>
                      <input
                        value={formTitleKr}
                        onChange={(e) => setFormTitleKr(e.target.value)}
                        className={INPUT}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted">
                        Description (EN)
                      </label>
                      <textarea
                        value={formDescEn}
                        onChange={(e) => setFormDescEn(e.target.value)}
                        rows={2}
                        className={`${INPUT} resize-y`}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted">
                        Description (KR)
                      </label>
                      <textarea
                        value={formDescKr}
                        onChange={(e) => setFormDescKr(e.target.value)}
                        rows={2}
                        className={`${INPUT} resize-y`}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted">
                        Category
                      </label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value as PredictionCategory)}
                        className={INPUT}
                      >
                        <option value="stocks">Stocks</option>
                        <option value="realestate">Real Estate</option>
                        <option value="politics">Politics</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted">
                        Status
                      </label>
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as Prediction["status"])}
                        className={INPUT}
                      >
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted">
                        Closes At
                      </label>
                      <input
                        type="datetime-local"
                        value={formClosesAt}
                        onChange={(e) => setFormClosesAt(e.target.value)}
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted">
                        Result
                      </label>
                      <select
                        value={formResolved}
                        onChange={(e) => setFormResolved(e.target.value as "yes" | "no" | "")}
                        className={INPUT}
                        disabled={formStatus !== "resolved"}
                      >
                        <option value="">None</option>
                        <option value="yes">YES</option>
                        <option value="no">NO</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={!formTitleEn}
                      className="rounded bg-accent px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditing(null);
                        setFormTitleEn("");
                        setFormTitleKr("");
                        setFormDescEn("");
                        setFormDescKr("");
                      }}
                      className="rounded border border-card-border px-4 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Predictions list */}
            <div className={CARD}>
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  All Predictions ({predictions.length})
                </h2>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className="pb-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted">
                      Title
                    </th>
                    <th className="pb-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted">
                      Cat
                    </th>
                    <th className="pb-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted">
                      Status
                    </th>
                    <th className="pb-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted">
                      Closes
                    </th>
                    <th className="pb-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-card-border/40 hover:bg-card-border/20"
                    >
                      <td className="py-1.5 max-w-[250px] truncate">{p.title.en}</td>
                      <td className="py-1.5 text-[10px] text-muted">{p.category}</td>
                      <td className="py-1.5">
                        <span
                          className={`rounded px-1.5 py-px text-[9px] font-medium ${
                            p.status === "open"
                              ? "bg-gain/20 text-gain"
                              : p.status === "resolved"
                                ? "bg-accent/20 text-accent"
                                : "bg-muted/20 text-muted"
                          }`}
                        >
                          {p.status}
                          {p.resolvedOptionId ? `: ${p.resolvedOptionId.toUpperCase()}` : ""}
                        </span>
                      </td>
                      <td className="py-1.5 text-muted tabular-nums">
                        {new Date(p.closesAt).toLocaleDateString()}
                      </td>
                      <td className="py-1.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => startEdit(p)}
                            className="rounded border border-card-border px-2 py-0.5 text-[10px] text-muted transition-colors hover:text-foreground"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            className="rounded border border-loss/30 px-2 py-0.5 text-[10px] text-loss transition-colors hover:bg-loss/10"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {predictions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[10px] text-muted">
                        No predictions yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
