"use client";

import { useState, useEffect, useCallback } from "react";
import { useLang } from "@/lib/LangContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import type { MessageKey } from "@/lib/i18n";

const CARD =
  "rounded-[12px] border border-card-border bg-card-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3)]";
const INPUT =
  "w-full rounded border border-card-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-accent focus:outline-none";

type PostCategory = "all" | "discussion" | "idea" | "question" | "news";

const CATEGORIES: PostCategory[] = ["all", "discussion", "idea", "question", "news"];
const CAT_LABEL: Record<PostCategory, MessageKey> = {
  all: "catAll",
  discussion: "catDiscussion",
  idea: "catIdea",
  question: "catQuestion",
  news: "catNews",
};

const CAT_BADGE_COLOR: Record<string, string> = {
  discussion: "bg-accent/20 text-accent",
  idea: "bg-yellow-500/20 text-yellow-400",
  question: "bg-purple-500/20 text-purple-400",
  news: "bg-gain/20 text-gain",
};

interface Post {
  id: string;
  user_id: string;
  author_email: string | null;
  title: string;
  content: string;
  category: string;
  symbol: string | null;
  likes: number;
  commentCount: number;
  created_at: string;
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  author_email: string | null;
  content: string;
  created_at: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function CommunityPage() {
  const { t } = useLang();
  const { session } = useAuth();
  const requireAuth = useRequireAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<PostCategory>("all");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Liked posts (local tracking)
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState<string>("discussion");
  const [formSymbol, setFormSymbol] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const url = category === "all"
        ? "/api/community/posts"
        : `/api/community/posts?category=${category}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.ok) {
        setPosts(json.posts);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const fetchComments = useCallback(async (postId: string) => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/community/posts/${postId}/comments`);
      const json = await res.json();
      if (json.ok) {
        setComments(json.comments);
      }
    } catch {
      /* ignore */
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  const openDetail = (post: Post) => {
    setSelectedPost(post);
    setComments([]);
    setCommentText("");
    fetchComments(post.id);
  };

  const goBack = () => {
    setSelectedPost(null);
    setShowCreate(false);
  };

  const handleLike = (postId: string) => {
    requireAuth(async () => {
      if (!session?.access_token) return;
      try {
        const res = await fetch(`/api/community/posts/${postId}/like`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (json.ok) {
          // Update local state
          setPosts((prev) =>
            prev.map((p) => (p.id === postId ? { ...p, likes: json.likes } : p))
          );
          if (selectedPost?.id === postId) {
            setSelectedPost((prev) => prev ? { ...prev, likes: json.likes } : prev);
          }
          setLikedPosts((prev) => {
            const next = new Set(prev);
            if (json.liked) next.add(postId);
            else next.delete(postId);
            return next;
          });
        }
      } catch {
        /* ignore */
      }
    });
  };

  const handleCommentSubmit = async () => {
    if (!commentText.trim() || !selectedPost || !session?.access_token) return;
    setCommentSubmitting(true);
    try {
      const res = await fetch(`/api/community/posts/${selectedPost.id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      const json = await res.json();
      if (json.ok) {
        setComments((prev) => [...prev, json.comment]);
        setCommentText("");
        // Update comment count
        setPosts((prev) =>
          prev.map((p) =>
            p.id === selectedPost.id ? { ...p, commentCount: p.commentCount + 1 } : p
          )
        );
        setSelectedPost((prev) =>
          prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev
        );
      }
    } catch {
      /* ignore */
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleCreateSubmit = () => {
    requireAuth(async () => {
      if (!formTitle.trim() || !session?.access_token) return;
      setSubmitting(true);
      try {
        const res = await fetch("/api/community/posts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            title: formTitle.trim(),
            content: formContent.trim(),
            category: formCategory,
            symbol: formSymbol.trim() || null,
          }),
        });
        const json = await res.json();
        if (json.ok) {
          setFormTitle("");
          setFormContent("");
          setFormSymbol("");
          setFormCategory("discussion");
          setShowCreate(false);
          fetchPosts();
        }
      } catch {
        /* ignore */
      } finally {
        setSubmitting(false);
      }
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="community" />

      <main className="mx-auto max-w-[1400px] px-4 py-4">
        {/* Header + controls */}
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              {t("communityBoard")}
            </h2>
          </div>

          {/* Category filter */}
          {!selectedPost && !showCreate && (
            <div className="flex gap-px rounded bg-card-border p-px w-fit">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    category === cat
                      ? "bg-accent text-white"
                      : "bg-card-bg text-muted hover:text-foreground"
                  }`}
                >
                  {t(CAT_LABEL[cat])}
                </button>
              ))}
            </div>
          )}

          {!selectedPost && !showCreate && (
            <button
              onClick={() => requireAuth(() => setShowCreate(true))}
              className="ml-auto rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
            >
              {t("newPost")}
            </button>
          )}

          {(selectedPost || showCreate) && (
            <button
              onClick={goBack}
              className="text-[11px] text-accent hover:underline"
            >
              &larr; {t("back")}
            </button>
          )}
        </div>

        {/* ── Create View ── */}
        {showCreate && (
          <div className={CARD}>
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {t("newPost")}
              </h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted">
                  {t("postTitle")}
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={t("postTitle")}
                  className={INPUT}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted">
                    {t("commCategory")}
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className={INPUT}
                  >
                    {(["discussion", "idea", "question", "news"] as const).map((c) => (
                      <option key={c} value={c}>
                        {t(CAT_LABEL[c])}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted">
                    {t("commSymbol")}
                  </label>
                  <input
                    type="text"
                    value={formSymbol}
                    onChange={(e) => setFormSymbol(e.target.value)}
                    placeholder="e.g. AAPL, 005930"
                    className={INPUT}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted">
                  {t("postContent")}
                </label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={6}
                  placeholder={t("postContent")}
                  className={`${INPUT} resize-y`}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCreateSubmit}
                  disabled={!formTitle.trim() || submitting}
                  className="rounded bg-accent px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {submitting ? "Posting..." : t("post")}
                </button>
                <button
                  onClick={goBack}
                  className="rounded border border-card-border px-4 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Detail View ── */}
        {selectedPost && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_340px]">
            {/* Post detail */}
            <div className={CARD}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold">{selectedPost.title}</h2>
                <span className={`shrink-0 rounded px-1.5 py-px text-[9px] font-medium ${CAT_BADGE_COLOR[selectedPost.category] || "bg-muted/20 text-muted"}`}>
                  {t(CAT_LABEL[selectedPost.category as PostCategory] || "catOther")}
                </span>
              </div>

              <div className="flex items-center gap-2 text-[9px] text-muted/70">
                <span>{t("by")} {selectedPost.author_email?.split("@")[0] || "anon"}</span>
                <span>&middot;</span>
                <span>{timeAgo(selectedPost.created_at)}</span>
                {selectedPost.symbol && (
                  <>
                    <span>&middot;</span>
                    <span className="rounded bg-accent/10 px-1.5 py-px text-[9px] font-medium text-accent">
                      {selectedPost.symbol}
                    </span>
                  </>
                )}
              </div>

              {selectedPost.content && (
                <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                  {selectedPost.content}
                </p>
              )}

              {/* Like button */}
              <div className="mt-4 flex items-center gap-3 border-t border-card-border pt-3">
                <button
                  onClick={() => handleLike(selectedPost.id)}
                  className={`flex items-center gap-1 rounded border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    likedPosts.has(selectedPost.id)
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-card-border text-muted hover:text-foreground"
                  }`}
                >
                  <svg className="h-3.5 w-3.5" fill={likedPosts.has(selectedPost.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {selectedPost.likes}
                </button>
                <span className="text-[10px] text-muted">
                  {selectedPost.commentCount} {t("commComments")}
                </span>
              </div>
            </div>

            {/* Comments panel */}
            <div className={CARD}>
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
                {t("commComments")} ({comments.length})
              </h3>

              {commentsLoading ? (
                <div className="py-4 text-center text-[10px] text-muted">Loading...</div>
              ) : comments.length === 0 ? (
                <p className="py-4 text-center text-[10px] text-muted">{t("commNoComments")}</p>
              ) : (
                <div className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
                  {comments.map((c) => (
                    <div key={c.id} className="rounded border border-card-border/40 bg-background p-2.5">
                      <div className="flex items-center gap-1.5 text-[9px] text-muted/70">
                        <span className="font-medium text-foreground/80">
                          {c.author_email?.split("@")[0] || "anon"}
                        </span>
                        <span>&middot;</span>
                        <span>{timeAgo(c.created_at)}</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-foreground/90">
                        {c.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add comment */}
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t("commAddComment")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      requireAuth(() => handleCommentSubmit());
                    }
                  }}
                  className={`${INPUT} flex-1`}
                />
                <button
                  onClick={() => requireAuth(() => handleCommentSubmit())}
                  disabled={!commentText.trim() || commentSubmitting}
                  className="shrink-0 rounded bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {t("commSend")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── List View ── */}
        {!selectedPost && !showCreate && (
          <>
            {loading ? (
              <div className="py-12 text-center text-[10px] text-muted">Loading...</div>
            ) : posts.length === 0 ? (
              <div className={CARD}>
                <div className="py-8 text-center">
                  <p className="text-xs text-muted">{t("noPosts")}</p>
                  <p className="mt-1 text-[10px] text-muted/60">{t("writeFirst")}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {posts.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => openDetail(post)}
                    className={`${CARD} w-full text-left transition-colors hover:border-accent/30`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`shrink-0 rounded px-1.5 py-px text-[9px] font-medium ${CAT_BADGE_COLOR[post.category] || "bg-muted/20 text-muted"}`}>
                            {t(CAT_LABEL[post.category as PostCategory] || "catOther")}
                          </span>
                          <h3 className="text-xs font-medium truncate">{post.title}</h3>
                        </div>
                        {post.content && (
                          <p className="mt-0.5 text-[10px] text-muted line-clamp-2">
                            {post.content}
                          </p>
                        )}
                        <div className="mt-1.5 flex items-center gap-2 text-[9px] text-muted/70">
                          <span>{post.author_email?.split("@")[0] || "anon"}</span>
                          <span>&middot;</span>
                          <span>{timeAgo(post.created_at)}</span>
                          {post.symbol && (
                            <>
                              <span>&middot;</span>
                              <span className="text-accent">{post.symbol}</span>
                            </>
                          )}
                          <span>&middot;</span>
                          <span>{post.likes} {t("commLike")}</span>
                          <span>&middot;</span>
                          <span>{post.commentCount} {t("commComment")}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
