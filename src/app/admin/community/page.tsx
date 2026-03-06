"use client";

import { useState, useEffect, useCallback } from "react";
import { useLang, LangToggle } from "@/lib/LangContext";
import { supabase } from "@/lib/supabaseClient";
import HeaderAuth from "@/components/HeaderAuth";

const CARD =
  "rounded-[12px] border border-card-border bg-card-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3)]";
const INPUT =
  "w-full rounded border border-card-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-accent focus:outline-none";

const SESSION_KEY = "pb_admin_session";

interface AdminSession {
  token: string;
  expiresAt: string;
}

interface Post {
  id: string;
  author_id: string | null;
  author_email: string | null;
  title: string;
  content: string;
  image_urls: string[];
  hidden: boolean;
  created_at: string;
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

export default function AdminCommunityPage() {
  const { t } = useLang();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSession(getSession());
  }, []);

  const fetchAllPosts = useCallback(async () => {
    setLoading(true);
    try {
      // Admin sees ALL posts (including hidden) via service role or direct query
      // Since we're client-side, we use the anon key which only sees hidden=false.
      // For full admin view, we'll fetch all and also request hidden ones.
      // Workaround: fetch both hidden and non-hidden separately
      const { data: visible } = await supabase
        .from("community_posts")
        .select("*")
        .eq("hidden", false)
        .order("created_at", { ascending: false })
        .limit(100);

      const { data: hiddenPosts } = await supabase
        .from("community_posts")
        .select("*")
        .eq("hidden", true)
        .order("created_at", { ascending: false })
        .limit(100);

      const all = [
        ...((hiddenPosts as Post[]) || []),
        ...((visible as Post[]) || []),
      ].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setPosts(all);
    } catch {
      /* supabase not configured */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) {
      fetchAllPosts();
    }
  }, [session, fetchAllPosts]);

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
        const s: AdminSession = {
          token: json.token,
          expiresAt: json.expiresAt,
        };
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

  const handleToggleHide = async (post: Post) => {
    try {
      const { error } = await supabase
        .from("community_posts")
        .update({ hidden: !post.hidden })
        .eq("id", post.id);

      if (!error) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id ? { ...p, hidden: !post.hidden } : p
          )
        );
      }
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (postId: string) => {
    // Use the admin delete API route (verifies PIN server-side)
    const storedPin = prompt("Enter admin PIN to confirm deletion:");
    if (!storedPin) return;

    try {
      const res = await fetch("/api/admin/community/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: storedPin, postId }),
      });
      const json = await res.json();
      if (json.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-card-border bg-card-bg">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-sm font-bold tracking-tight">
                Alphalab
              </h1>
              <p className="text-[10px] text-muted">{t("subtitle")}</p>
            </div>
            <nav className="flex items-center gap-1">
              <a
                href="/"
                className="rounded px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-card-border/30 hover:text-foreground"
              >
                {t("dashboard")}
              </a>
              <a
                href="/portfolio"
                className="rounded px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-card-border/30 hover:text-foreground"
              >
                {t("portfolio")}
              </a>
              <a
                href="/flow"
                className="rounded px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-card-border/30 hover:text-foreground"
              >
                {t("flow")}
              </a>
              <a
                href="/ideas"
                className="rounded px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-card-border/30 hover:text-foreground"
              >
                {t("ideas")}
              </a>
              <a
                href="/ai-trading"
                className="rounded px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-card-border/30 hover:text-foreground"
              >
                {t("aiTrading")}
              </a>
              <a
                href="/prompts"
                className="rounded px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-card-border/30 hover:text-foreground"
              >
                {t("prompts")}
              </a>
              <a
                href="/predictions"
                className="rounded px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-card-border/30 hover:text-foreground"
              >
                {t("predictions")}
              </a>
              <a
                href="/community"
                className="rounded px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-card-border/30 hover:text-foreground"
              >
                {t("community")}
              </a>
              <a
                href="/admin"
                className="rounded px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-card-border/30 hover:text-foreground"
              >
                Admin
              </a>
              <span className="rounded bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                {t("adminCommunity")}
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
                <span className="text-[10px] text-gain font-medium">
                  Authenticated
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchAllPosts}
                  disabled={loading}
                  className="rounded border border-card-border px-3 py-1 text-xs text-muted transition-colors hover:text-foreground disabled:opacity-40"
                >
                  {loading ? "Loading..." : "Refresh"}
                </button>
                <button
                  onClick={handleLogout}
                  className="rounded border border-card-border px-3 py-1 text-xs text-muted transition-colors hover:text-foreground"
                >
                  Logout
                </button>
              </div>
            </div>

            {/* Posts table */}
            <div className={CARD}>
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {t("adminCommunity")} ({posts.length})
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-card-border">
                      <th className="pb-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted">
                        {t("postTitle")}
                      </th>
                      <th className="pb-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted">
                        Author
                      </th>
                      <th className="pb-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted">
                        Status
                      </th>
                      <th className="pb-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted">
                        Date
                      </th>
                      <th className="pb-1.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((post) => (
                      <tr
                        key={post.id}
                        className={`border-b border-card-border/40 hover:bg-card-border/20 ${
                          post.hidden ? "opacity-50" : ""
                        }`}
                      >
                        <td className="py-1.5 max-w-[250px] truncate">
                          {post.title}
                        </td>
                        <td className="py-1.5 text-muted">
                          {post.author_email?.split("@")[0] || "anon"}
                        </td>
                        <td className="py-1.5">
                          {post.hidden ? (
                            <span className="rounded bg-loss/20 px-1.5 py-px text-[9px] font-medium text-loss">
                              {t("hidden")}
                            </span>
                          ) : (
                            <span className="rounded bg-gain/20 px-1.5 py-px text-[9px] font-medium text-gain">
                              Visible
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 text-muted tabular-nums">
                          {new Date(post.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-1.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleToggleHide(post)}
                              className="rounded border border-card-border px-2 py-0.5 text-[10px] text-muted transition-colors hover:text-foreground"
                            >
                              {post.hidden ? t("unhide") : t("hide")}
                            </button>
                            <button
                              onClick={() => handleDelete(post.id)}
                              className="rounded border border-loss/30 px-2 py-0.5 text-[10px] text-loss transition-colors hover:bg-loss/10"
                            >
                              {t("delete")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {posts.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-8 text-center text-[10px] text-muted"
                        >
                          {t("noPosts")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
