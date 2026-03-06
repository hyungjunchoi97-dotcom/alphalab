"use client";

import { useState, useEffect, useCallback } from "react";
import { useLang } from "@/lib/LangContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import type { MessageKey } from "@/lib/i18n";

// ── Constants ──────────────────────────────────────────────────

const INPUT =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none";

type PostCategory = "all" | "discussion" | "idea" | "question" | "news";
type SortMode = "hot" | "new" | "top" | "rising";

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

const CAT_SIDEBAR_ICON: Record<string, string> = {
  all: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  discussion: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  idea: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  question: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  news: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z",
};

// ── Types ──────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function sortPosts(posts: Post[], mode: SortMode): Post[] {
  const arr = [...posts];
  switch (mode) {
    case "new":
      return arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    case "top":
      return arr.sort((a, b) => b.likes - a.likes);
    case "rising":
      return arr.sort((a, b) => {
        const ageA = Math.max(1, (Date.now() - new Date(a.created_at).getTime()) / 3600000);
        const ageB = Math.max(1, (Date.now() - new Date(b.created_at).getTime()) / 3600000);
        return (b.likes / ageB) - (a.likes / ageA);
      });
    case "hot":
    default:
      return arr.sort((a, b) => {
        const scoreA = a.likes + a.commentCount * 2;
        const scoreB = b.likes + b.commentCount * 2;
        return scoreB - scoreA;
      });
  }
}

// ── Page ───────────────────────────────────────────────────────

export default function CommunityPage() {
  const { t, lang } = useLang();
  const { session } = useAuth();
  const requireAuth = useRequireAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<PostCategory>("all");
  const [sortMode, setSortMode] = useState<SortMode>("hot");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Liked posts
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  // Create modal
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
      if (json.ok) setPosts(json.posts);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [category]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const fetchComments = useCallback(async (postId: string) => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/community/posts/${postId}/comments`);
      const json = await res.json();
      if (json.ok) setComments(json.comments);
    } catch { /* */ }
    finally { setCommentsLoading(false); }
  }, []);

  const openDetail = (post: Post) => {
    setSelectedPost(post);
    setComments([]);
    setCommentText("");
    fetchComments(post.id);
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
          setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes: json.likes } : p)));
          if (selectedPost?.id === postId) setSelectedPost((prev) => prev ? { ...prev, likes: json.likes } : prev);
          setLikedPosts((prev) => {
            const next = new Set(prev);
            if (json.liked) next.add(postId); else next.delete(postId);
            return next;
          });
        }
      } catch { /* */ }
    });
  };

  const handleCommentSubmit = async () => {
    if (!commentText.trim() || !selectedPost || !session?.access_token) return;
    setCommentSubmitting(true);
    try {
      const res = await fetch(`/api/community/posts/${selectedPost.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      const json = await res.json();
      if (json.ok) {
        setComments((prev) => [...prev, json.comment]);
        setCommentText("");
        setPosts((prev) => prev.map((p) => p.id === selectedPost.id ? { ...p, commentCount: p.commentCount + 1 } : p));
        setSelectedPost((prev) => prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev);
      }
    } catch { /* */ }
    finally { setCommentSubmitting(false); }
  };

  const handleCreateSubmit = () => {
    requireAuth(async () => {
      if (!formTitle.trim() || !session?.access_token) return;
      setSubmitting(true);
      try {
        const res = await fetch("/api/community/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ title: formTitle.trim(), content: formContent.trim(), category: formCategory, symbol: formSymbol.trim() || null }),
        });
        const json = await res.json();
        if (json.ok) { setFormTitle(""); setFormContent(""); setFormSymbol(""); setFormCategory("discussion"); setShowCreate(false); fetchPosts(); }
      } catch { /* */ }
      finally { setSubmitting(false); }
    });
  };

  const sorted = sortPosts(posts, sortMode);

  // Top posts for sidebar widget
  const topPosts = [...posts].sort((a, b) => b.likes - a.likes).slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="community" />

      <main className="mx-auto max-w-[1200px] px-4 py-5">
        {/* Detail view */}
        {selectedPost ? (
          <DetailView
            post={selectedPost}
            comments={comments}
            commentsLoading={commentsLoading}
            commentText={commentText}
            setCommentText={setCommentText}
            commentSubmitting={commentSubmitting}
            likedPosts={likedPosts}
            onLike={handleLike}
            onCommentSubmit={() => requireAuth(() => handleCommentSubmit())}
            onBack={() => setSelectedPost(null)}
            t={t}
            lang={lang}
          />
        ) : (
          /* Main 3-column layout */
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[200px_1fr_260px]">
            {/* Left sidebar: categories */}
            <aside className="hidden lg:block space-y-1">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted px-2">
                {lang === "kr" ? "카테고리" : "Categories"}
              </h3>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors ${
                    category === cat
                      ? "bg-accent/10 text-accent font-medium"
                      : "text-muted hover:bg-card-border/30 hover:text-foreground"
                  }`}
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={CAT_SIDEBAR_ICON[cat] || CAT_SIDEBAR_ICON.all} />
                  </svg>
                  {t(CAT_LABEL[cat])}
                </button>
              ))}

              <div className="mt-4 border-t border-card-border pt-3">
                <button
                  onClick={() => requireAuth(() => setShowCreate(true))}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  {t("newPost")}
                </button>
              </div>
            </aside>

            {/* Center: feed */}
            <div className="space-y-3">
              {/* Mobile category + new post */}
              <div className="flex flex-wrap items-center gap-2 lg:hidden">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                      category === cat
                        ? "bg-accent text-white"
                        : "bg-card-bg border border-card-border text-muted"
                    }`}
                  >
                    {t(CAT_LABEL[cat])}
                  </button>
                ))}
                <button
                  onClick={() => requireAuth(() => setShowCreate(true))}
                  className="ml-auto rounded-lg bg-accent px-3 py-1 text-[11px] font-semibold text-white"
                >
                  {t("newPost")}
                </button>
              </div>

              {/* Sort tabs */}
              <div className="flex gap-px rounded-lg bg-card-border p-0.5 w-fit">
                {(["hot", "new", "top", "rising"] as SortMode[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSortMode(s)}
                    className={`rounded-md px-3 py-1.5 text-[11px] font-medium capitalize transition-colors ${
                      sortMode === s
                        ? "bg-card-bg text-foreground shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Posts */}
              {loading ? (
                <div className="py-12 text-center text-xs text-muted">Loading...</div>
              ) : sorted.length === 0 ? (
                <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center">
                  <p className="text-sm text-muted">{t("noPosts")}</p>
                  <p className="mt-1 text-[10px] text-muted/60">{t("writeFirst")}</p>
                </div>
              ) : (
                sorted.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    liked={likedPosts.has(post.id)}
                    onLike={handleLike}
                    onOpen={openDetail}
                    t={t}
                  />
                ))
              )}
            </div>

            {/* Right sidebar: popular + rules */}
            <aside className="hidden lg:block space-y-4">
              {/* Popular posts */}
              <div className="rounded-xl border border-card-border bg-card-bg p-3">
                <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {lang === "kr" ? "인기 포스트" : "Popular Posts"}
                </h3>
                <div className="space-y-2">
                  {topPosts.map((post, i) => (
                    <button
                      key={post.id}
                      onClick={() => openDetail(post)}
                      className="flex w-full items-start gap-2 rounded-lg p-1.5 text-left transition-colors hover:bg-card-border/30"
                    >
                      <span className="shrink-0 text-[10px] font-bold tabular-nums text-muted mt-0.5">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium leading-snug line-clamp-2">{post.title}</p>
                        <p className="mt-0.5 text-[9px] text-muted">
                          {post.likes} likes &middot; {post.commentCount} comments
                        </p>
                      </div>
                    </button>
                  ))}
                  {topPosts.length === 0 && (
                    <p className="text-[10px] text-muted py-2 text-center">{t("noPosts")}</p>
                  )}
                </div>
              </div>

              {/* Community rules */}
              <div className="rounded-xl border border-card-border bg-card-bg p-3">
                <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {lang === "kr" ? "커뮤니티 규칙" : "Community Rules"}
                </h3>
                <ol className="space-y-1.5 text-[10px] text-muted leading-relaxed list-decimal list-inside">
                  <li>{lang === "kr" ? "서로 존중하는 대화" : "Be respectful to others"}</li>
                  <li>{lang === "kr" ? "투자 조언이 아닌 정보 공유" : "Share information, not financial advice"}</li>
                  <li>{lang === "kr" ? "스팸 및 홍보 금지" : "No spam or self-promotion"}</li>
                  <li>{lang === "kr" ? "출처가 있는 뉴스 공유" : "Share news with sources"}</li>
                  <li>{lang === "kr" ? "개인정보 보호" : "Protect personal information"}</li>
                </ol>
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* Create post modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowCreate(false)}>
          <div
            className="w-full max-w-lg rounded-xl border border-card-border bg-card-bg p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t("newPost")}</h2>
              <button onClick={() => setShowCreate(false)} className="text-muted hover:text-foreground">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={t("postTitle")}
                className={INPUT}
              />

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className={INPUT}
                >
                  {(["discussion", "idea", "question", "news"] as const).map((c) => (
                    <option key={c} value={c}>{t(CAT_LABEL[c])}</option>
                  ))}
                </select>
                <input
                  value={formSymbol}
                  onChange={(e) => setFormSymbol(e.target.value)}
                  placeholder={t("commSymbol")}
                  className={INPUT}
                />
              </div>

              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={6}
                placeholder={t("postContent")}
                className={`${INPUT} resize-y`}
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-card-border px-4 py-2 text-xs text-muted transition-colors hover:text-foreground"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleCreateSubmit}
                  disabled={!formTitle.trim() || submitting}
                  className="rounded-lg bg-accent px-5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {submitting ? "..." : t("post")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Post Card (Reddit-style) ──────────────────────────────────

function PostCard({
  post,
  liked,
  onLike,
  onOpen,
  t,
}: {
  post: Post;
  liked: boolean;
  onLike: (id: string) => void;
  onOpen: (post: Post) => void;
  t: (key: MessageKey) => string;
}) {
  return (
    <div className="flex rounded-xl border border-card-border bg-card-bg transition-colors hover:border-foreground/15">
      {/* Vote column */}
      <div className="flex flex-col items-center gap-0.5 px-2 py-3 border-r border-card-border/50">
        <button
          onClick={(e) => { e.stopPropagation(); onLike(post.id); }}
          className={`rounded p-1 transition-colors ${liked ? "text-accent" : "text-muted hover:text-accent"}`}
        >
          <svg className="h-5 w-5" fill={liked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <span className={`text-xs font-bold tabular-nums ${liked ? "text-accent" : "text-muted"}`}>
          {post.likes}
        </span>
        <button className="rounded p-1 text-muted hover:text-loss transition-colors">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <button
        onClick={() => onOpen(post)}
        className="flex-1 p-3 text-left min-w-0"
      >
        {/* Meta */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
          <span className={`rounded px-1.5 py-px text-[9px] font-semibold ${CAT_BADGE_COLOR[post.category] || "bg-muted/20 text-muted"}`}>
            {t(CAT_LABEL[post.category as PostCategory] || "catOther")}
          </span>
          {post.symbol && (
            <span className="rounded bg-accent/10 px-1.5 py-px text-[9px] font-medium text-accent">
              {post.symbol}
            </span>
          )}
          <span>{post.author_email?.split("@")[0] || "anon"}</span>
          <span>&middot;</span>
          <span>{timeAgo(post.created_at)}</span>
        </div>

        {/* Title */}
        <h3 className="mt-1.5 text-[13px] font-semibold leading-snug">{post.title}</h3>

        {/* Preview */}
        {post.content && (
          <p className="mt-1 text-[11px] text-muted line-clamp-2 leading-relaxed">{post.content}</p>
        )}

        {/* Actions */}
        <div className="mt-2 flex items-center gap-3 text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {post.commentCount} {t("commComment")}
          </span>
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </span>
        </div>
      </button>
    </div>
  );
}

// ── Detail View ───────────────────────────────────────────────

function DetailView({
  post,
  comments,
  commentsLoading,
  commentText,
  setCommentText,
  commentSubmitting,
  likedPosts,
  onLike,
  onCommentSubmit,
  onBack,
  t,
}: {
  post: Post;
  comments: Comment[];
  commentsLoading: boolean;
  commentText: string;
  setCommentText: (v: string) => void;
  commentSubmitting: boolean;
  likedPosts: Set<string>;
  onLike: (id: string) => void;
  onCommentSubmit: () => void;
  onBack: () => void;
  t: (key: MessageKey) => string;
  lang: string;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-accent hover:underline">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {t("back")}
      </button>

      {/* Post */}
      <div className="rounded-xl border border-card-border bg-card-bg p-5">
        <div className="flex items-center gap-2 text-[10px] text-muted mb-2">
          <span className={`rounded px-1.5 py-px text-[9px] font-semibold ${CAT_BADGE_COLOR[post.category] || "bg-muted/20 text-muted"}`}>
            {t(CAT_LABEL[post.category as PostCategory] || "catOther")}
          </span>
          {post.symbol && (
            <span className="rounded bg-accent/10 px-1.5 py-px text-[9px] font-medium text-accent">
              {post.symbol}
            </span>
          )}
          <span>{t("by")} {post.author_email?.split("@")[0] || "anon"}</span>
          <span>&middot;</span>
          <span>{timeAgo(post.created_at)}</span>
        </div>

        <h1 className="text-lg font-bold leading-snug">{post.title}</h1>

        {post.content && (
          <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">{post.content}</p>
        )}

        <div className="mt-4 flex items-center gap-3 border-t border-card-border pt-3">
          <button
            onClick={() => onLike(post.id)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              likedPosts.has(post.id)
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-card-border text-muted hover:text-foreground"
            }`}
          >
            <svg className="h-4 w-4" fill={likedPosts.has(post.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
            {post.likes}
          </button>
          <span className="text-xs text-muted">
            {post.commentCount} {t("commComments")}
          </span>
        </div>
      </div>

      {/* Comment input */}
      <div className="rounded-xl border border-card-border bg-card-bg p-4">
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder={t("commAddComment")}
          rows={3}
          className={`${INPUT} resize-y`}
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={onCommentSubmit}
            disabled={!commentText.trim() || commentSubmitting}
            className="rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {t("commSend")}
          </button>
        </div>
      </div>

      {/* Comments */}
      <div className="space-y-2">
        {commentsLoading ? (
          <div className="py-8 text-center text-xs text-muted">Loading...</div>
        ) : comments.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted">{t("commNoComments")}</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rounded-xl border border-card-border bg-card-bg p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-muted">
                <span className="font-medium text-foreground/80">{c.author_email?.split("@")[0] || "anon"}</span>
                <span>&middot;</span>
                <span>{timeAgo(c.created_at)}</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-foreground/90">{c.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
