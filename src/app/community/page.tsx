"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/LangContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import type { MessageKey } from "@/lib/i18n";

// ── Constants ──────────────────────────────────────────────────

const INPUT =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none";

type PostCategory = "all" | "stock" | "crypto" | "overseas" | "macro" | "politics" | "question" | "free";
type SortMode = "hot" | "new" | "top" | "rising";

const CATEGORIES: PostCategory[] = ["all", "stock", "crypto", "overseas", "macro", "politics", "question", "free"];

const CAT_LABEL: Record<PostCategory, MessageKey> = {
  all: "catAll",
  stock: "catStock",
  crypto: "catCryptoToken",
  overseas: "catOverseas",
  macro: "catMacro",
  politics: "catPolitics",
  question: "catQuestion",
  free: "catFree",
};

// For create modal - all writable categories
const CREATE_CATEGORIES = ["stock", "crypto", "overseas", "macro", "politics", "discussion", "idea", "question", "news", "free"] as const;
const CREATE_CAT_LABEL: Record<string, MessageKey> = {
  stock: "catStock",
  crypto: "catCryptoToken",
  overseas: "catOverseas",
  macro: "catMacro",
  politics: "catPolitics",
  discussion: "catDiscussion",
  idea: "catIdea",
  question: "catQuestion",
  news: "catNews",
  free: "catFree",
};

const CAT_BADGE_COLOR: Record<string, string> = {
  stock: "bg-blue-500/20 text-blue-400",
  crypto: "bg-orange-500/20 text-orange-400",
  overseas: "bg-emerald-500/20 text-emerald-400",
  macro: "bg-cyan-500/20 text-cyan-400",
  politics: "bg-rose-500/20 text-rose-400",
  discussion: "bg-accent/20 text-accent",
  idea: "bg-yellow-500/20 text-yellow-400",
  question: "bg-purple-500/20 text-purple-400",
  news: "bg-gain/20 text-gain",
  free: "bg-gray-500/20 text-gray-400",
};

const CAT_SIDEBAR_ICON: Record<string, string> = {
  all: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  stock: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  crypto: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  overseas: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  macro: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  politics: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  question: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  free: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
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
  image_url?: string;
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

function getCatLabel(cat: string): MessageKey {
  return (CREATE_CAT_LABEL[cat] || CAT_LABEL[cat as PostCategory] || "catOther") as MessageKey;
}

// ── Page ───────────────────────────────────────────────────────

export default function CommunityPage() {
  const { t, lang } = useLang();
  const { session } = useAuth();
  const requireAuth = useRequireAuth();
  const router = useRouter();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<PostCategory>("all");
  const [sortMode, setSortMode] = useState<SortMode>("hot");

  // Liked posts
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState<string>("stock");
  const [formSymbol, setFormSymbol] = useState("");
  const [formImageUrl, setFormImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleLike = (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    e.preventDefault();
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
          setLikedPosts((prev) => {
            const next = new Set(prev);
            if (json.liked) next.add(postId); else next.delete(postId);
            return next;
          });
        }
      } catch { /* */ }
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.access_token) return;
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/community/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const json = await res.json();
      if (json.ok) {
        setFormImageUrl(json.url);
      }
    } catch { /* */ }
    finally { setImageUploading(false); }
  };

  const handleCreateSubmit = () => {
    requireAuth(async () => {
      if (!formTitle.trim() || !session?.access_token) return;
      setSubmitting(true);
      try {
        const res = await fetch("/api/community/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            title: formTitle.trim(),
            content: formContent.trim(),
            category: formCategory,
            symbol: formSymbol.trim() || null,
            image_url: formImageUrl,
          }),
        });
        const json = await res.json();
        if (json.ok) {
          setFormTitle(""); setFormContent(""); setFormSymbol(""); setFormCategory("stock");
          setFormImageUrl(null); setShowCreate(false); fetchPosts();
        }
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
        {/* Main 3-column layout */}
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
                  onClick={() => router.push(`/community/${post.id}`)}
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
                    onClick={() => router.push(`/community/${post.id}`)}
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
                  {CREATE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{t(CREATE_CAT_LABEL[c])}</option>
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

              {/* Image upload */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {formImageUrl ? (
                  <div className="relative">
                    <img src={formImageUrl} alt="" className="max-h-[150px] rounded-lg border border-card-border object-cover" />
                    <button
                      onClick={() => setFormImageUrl(null)}
                      className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={imageUploading}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-card-border px-3 py-2 text-[11px] text-muted transition-colors hover:border-accent/50 hover:text-foreground"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                    </svg>
                    {imageUploading ? "Uploading..." : t("uploadImages")}
                  </button>
                )}
              </div>

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

// ── Post Card ──────────────────────────────────────────────────

function PostCard({
  post,
  liked,
  onLike,
  onClick,
  t,
}: {
  post: Post;
  liked: boolean;
  onLike: (e: React.MouseEvent, id: string) => void;
  onClick: () => void;
  t: (key: MessageKey) => string;
}) {
  const catLabel = getCatLabel(post.category);

  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer rounded-xl border border-card-border bg-card-bg transition-colors hover:border-foreground/15"
    >
      {/* Vote column */}
      <div className="flex flex-col items-center gap-0.5 px-2 py-3 border-r border-card-border/50">
        <button
          onClick={(e) => onLike(e, post.id)}
          className={`rounded p-1 transition-colors ${liked ? "text-accent" : "text-muted hover:text-accent"}`}
        >
          <svg className="h-5 w-5" fill={liked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <span className={`text-xs font-bold tabular-nums ${liked ? "text-accent" : "text-muted"}`}>
          {post.likes}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 p-3 min-w-0">
        {/* Meta */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
          <span className={`rounded px-1.5 py-px text-[9px] font-semibold ${CAT_BADGE_COLOR[post.category] || "bg-muted/20 text-muted"}`}>
            {t(catLabel)}
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

        {/* Preview text */}
        {post.content && (
          <p className="mt-1 text-[11px] text-muted line-clamp-2 leading-relaxed">
            {post.content.length > 150 ? post.content.slice(0, 150) + "..." : post.content}
          </p>
        )}

        {/* Image thumbnail */}
        {post.image_url && (
          <div className="mt-2">
            <img
              src={post.image_url}
              alt=""
              className="max-h-[120px] rounded-lg border border-card-border object-cover"
            />
          </div>
        )}

        {/* Actions */}
        <div className="mt-2 flex items-center gap-3 text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {post.commentCount} {t("commComment")}
          </span>
        </div>
      </div>
    </div>
  );
}
