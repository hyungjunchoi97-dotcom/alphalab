"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/LangContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import type { MessageKey } from "@/lib/i18n";

// ── Constants ──────────────────────────────────────────────────

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

const CREATE_CATEGORIES = ["stock", "crypto", "overseas", "macro", "politics", "discussion", "idea", "question", "news", "free"] as const;

const CAT_BADGE_COLOR: Record<string, string> = {
  stock: "bg-blue-500/20 text-blue-400",
  crypto: "bg-orange-500/20 text-orange-400",
  overseas: "bg-amber-500/20 text-amber-400",
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

const DRAFT_KEY = "community_write_draft";

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

// ── Editor Overlay ─────────────────────────────────────────────

function EditorOverlay({
  onClose,
  onPublished,
}: {
  onClose: () => void;
  onPublished: () => void;
}) {
  const { session } = useAuth();
  const requireAuth = useRequireAuth();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("stock");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveTime, setSaveTime] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const hasContentRef = useRef(false);

  // Track if editor has content for exit confirmation
  useEffect(() => {
    const check = () => {
      hasContentRef.current = !!(title.trim() || editorRef.current?.innerText?.trim());
    };
    check();
  }, [title]);

  // Restore draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.title) setTitle(draft.title);
        if (draft.category) setCategory(draft.category);
        if (draft.content && editorRef.current) {
          editorRef.current.innerHTML = draft.content;
        }
      }
    } catch { /* */ }
  }, []);

  // Clear error
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  // ESC key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleExit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const handleExit = () => {
    const content = editorRef.current?.innerText?.trim() || "";
    if (title.trim() || content) {
      if (!window.confirm("작성 중인 글이 있습니다. 나가시겠습니까?")) return;
    }
    onClose();
  };

  const handleSaveDraft = () => {
    const content = editorRef.current?.innerHTML || "";
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ title, content, category })
    );
    setSaveTime(
      new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    );
  };

  const handlePublish = () => {
    requireAuth(async () => {
      if (!title.trim() || !session?.access_token) return;
      setSubmitting(true);
      setError(null);

      const htmlContent = editorRef.current?.innerHTML || "";
      const textContent = editorRef.current?.innerText || "";

      try {
        const res = await fetch("/api/community/posts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            title: title.trim(),
            content: textContent.trim(),
            category,
            symbol: null,
            image_url: null,
          }),
        });
        const json = await res.json();
        if (json.ok) {
          localStorage.removeItem(DRAFT_KEY);
          onPublished();
        } else {
          setError(json.error || "게시 실패");
        }
      } catch {
        setError("네트워크 오류");
      } finally {
        setSubmitting(false);
      }
    });
  };

  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="flex flex-col rounded border border-[#1a1a1a] bg-[#050505] shadow-2xl overflow-hidden"
        style={{ width: "90vw", height: "85vh", maxWidth: "1000px" }}
      >
        {/* Error toast */}
        {error && (
          <div className="absolute top-4 right-4 z-10 rounded border border-[#f87171]/30 bg-[#1a0808] px-4 py-2 shadow-lg">
            <p className="text-[11px] font-mono text-[#f87171]">{error}</p>
          </div>
        )}

        {/* Top action bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a] shrink-0">
          <div className="flex items-center gap-3">
            {saveTime && (
              <span className="text-[10px] font-mono text-[#444]">
                임시저장됨 {saveTime}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExit}
              className="px-3 py-1.5 text-[11px] font-mono text-[#555] hover:text-white transition-colors"
            >
              나가기
            </button>
            <button
              onClick={handleSaveDraft}
              className="px-3 py-1.5 text-[11px] font-mono text-[#555] border border-[#1a1a1a] rounded hover:text-white hover:border-[#333] transition-colors"
            >
              임시저장
            </button>
            <button
              onClick={handlePublish}
              disabled={!title.trim() || submitting}
              className="px-5 py-1.5 text-[11px] font-mono font-bold bg-[#f59e0b] text-black rounded hover:opacity-90 transition-opacity disabled:opacity-30"
            >
              {submitting ? "..." : "게시"}
            </button>
          </div>
        </div>

        {/* Title input */}
        <div className="px-5 pt-4 pb-2 shrink-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            className="w-full bg-transparent text-2xl font-bold text-white placeholder-[#333] outline-none"
            autoFocus
          />
        </div>

        {/* Category select */}
        <div className="px-5 pb-3 shrink-0">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[11px] font-mono text-[#888] outline-none focus:border-[#333] appearance-none cursor-pointer"
          >
            {CREATE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORIES.includes(c as PostCategory)
                  ? c.charAt(0).toUpperCase() + c.slice(1)
                  : c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-px px-5 py-1.5 border-y border-[#1a1a1a] shrink-0">
          {/* Font size */}
          <select
            onChange={(e) => {
              execCmd("fontSize", e.target.value);
              e.target.value = "3";
            }}
            defaultValue="3"
            className="bg-[#0a0a0a] border border-[#1a1a1a] rounded px-1.5 py-1 text-[10px] font-mono text-[#666] outline-none cursor-pointer mr-1"
          >
            <option value="1">Small</option>
            <option value="3">Normal</option>
            <option value="5">Large</option>
            <option value="7">Title</option>
          </select>

          <TBBtn label="B" bold onClick={() => execCmd("bold")} />
          <TBBtn label="I" italic onClick={() => execCmd("italic")} />

          <div className="w-px h-5 bg-[#1a1a1a] mx-1.5" />

          {/* Font family */}
          <select
            onChange={(e) => {
              execCmd("fontName", e.target.value);
              e.target.value = "";
            }}
            defaultValue=""
            className="bg-[#0a0a0a] border border-[#1a1a1a] rounded px-1.5 py-1 text-[10px] font-mono text-[#666] outline-none cursor-pointer"
          >
            <option value="" disabled>Font</option>
            <option value="system-ui, -apple-system, sans-serif">Sans</option>
            <option value="Georgia, serif">Serif</option>
            <option value="ui-monospace, monospace">Mono</option>
          </select>
        </div>

        {/* contentEditable editor */}
        <div className="flex-1 overflow-auto bg-[#080808]">
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="min-h-full p-5 text-[14px] text-[#ccc] leading-relaxed outline-none"
            style={{ caretColor: "#f59e0b" }}
            data-placeholder="내용을 입력하세요..."
            onInput={() => {
              hasContentRef.current = !!(title.trim() || editorRef.current?.innerText?.trim());
            }}
          />
        </div>
      </div>

      {/* Placeholder style */}
      <style jsx global>{`
        [data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #333;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

function TBBtn({
  label,
  onClick,
  bold,
  italic,
}: {
  label: string;
  onClick: () => void;
  bold?: boolean;
  italic?: boolean;
}) {
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`px-2 py-1 text-[11px] font-mono rounded text-[#555] bg-[#0a0a0a] hover:text-[#f59e0b] hover:bg-[#111] transition-colors ${
        bold ? "font-bold" : ""
      } ${italic ? "italic" : ""}`}
    >
      {label}
    </button>
  );
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
  const [showEditor, setShowEditor] = useState(false);

  // Liked posts
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

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

  const openEditor = () => {
    requireAuth(() => setShowEditor(true));
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
                onClick={openEditor}
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
                onClick={openEditor}
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

      {/* Editor overlay */}
      {showEditor && (
        <EditorOverlay
          onClose={() => setShowEditor(false)}
          onPublished={() => {
            setShowEditor(false);
            fetchPosts();
          }}
        />
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
