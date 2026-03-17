"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/LangContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import type { MessageKey } from "@/lib/i18n";

// ── Constants ──────────────────────────────────────────────────

type MainCategory = "all" | "stock_discussion" | "macro" | "free";
type Subcategory = "all" | "domestic" | "overseas" | "crypto" | "commodity" | "bond";
type SortMode = "hot" | "new" | "top" | "rising";

const MAIN_CATEGORIES: MainCategory[] = ["all", "stock_discussion", "macro", "free"];

const MAIN_CAT_LABEL: Record<MainCategory, MessageKey> = {
  all: "catAll",
  stock_discussion: "catStockDiscussion",
  macro: "catMacroNew",
  free: "catFreeNew",
};

const SUBCATEGORIES: Subcategory[] = ["all", "domestic", "overseas", "crypto", "commodity", "bond"];

const SUB_LABEL: Record<Subcategory, MessageKey> = {
  all: "subAll",
  domestic: "subDomestic",
  overseas: "subOverseas",
  crypto: "subCrypto",
  commodity: "subCommodity",
  bond: "subBond",
};

// Create categories for editor: stock_discussion, macro, free
const CREATE_CATEGORIES: MainCategory[] = ["stock_discussion", "macro", "free"];

const CAT_BADGE_COLOR: Record<string, string> = {
  stock_discussion: "bg-blue-500/20 text-blue-400",
  macro: "bg-cyan-500/20 text-cyan-400",
  free: "bg-gray-500/20 text-gray-400",
  // legacy
  stock: "bg-blue-500/20 text-blue-400",
  crypto: "bg-orange-500/20 text-orange-400",
  overseas: "bg-amber-500/20 text-amber-400",
  politics: "bg-rose-500/20 text-rose-400",
  discussion: "bg-accent/20 text-accent",
  idea: "bg-yellow-500/20 text-yellow-400",
  question: "bg-purple-500/20 text-purple-400",
  news: "bg-gain/20 text-gain",
};

const SUB_BADGE_COLOR: Record<string, string> = {
  domestic: "bg-emerald-500/20 text-emerald-400",
  overseas: "bg-amber-500/20 text-amber-400",
  crypto: "bg-orange-500/20 text-orange-400",
  commodity: "bg-yellow-500/20 text-yellow-400",
  bond: "bg-violet-500/20 text-violet-400",
};

const CAT_SIDEBAR_ICON: Record<string, string> = {
  all: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  stock_discussion: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  macro: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
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
  subcategory: string | null;
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

// Map legacy categories to new ones for display
function mapCategory(cat: string): string {
  if (["stock", "crypto", "overseas"].includes(cat)) return "stock_discussion";
  if (["politics", "discussion", "idea", "question", "news"].includes(cat)) return "free";
  return cat;
}

function getCatDisplayLabel(cat: string, t: (k: MessageKey) => string): string {
  const mapped = mapCategory(cat);
  const label = MAIN_CAT_LABEL[mapped as MainCategory];
  return label ? t(label) : cat;
}

function getSubDisplayLabel(sub: string | null, t: (k: MessageKey) => string): string | null {
  if (!sub) return null;
  const label = SUB_LABEL[sub as Subcategory];
  return label ? t(label) : sub;
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
  const { lang } = useLang();
  const requireAuth = useRequireAuth();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<MainCategory>("stock_discussion");
  const [subcategory, setSubcategory] = useState<Subcategory>("domestic");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveTime, setSaveTime] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const hasContentRef = useRef(false);

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
        if (draft.category && CREATE_CATEGORIES.includes(draft.category)) setCategory(draft.category);
        if (draft.subcategory) setSubcategory(draft.subcategory);
        if (draft.content && editorRef.current) {
          editorRef.current.innerHTML = draft.content;
        }
      }
    } catch { /* */ }
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

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
      if (!window.confirm(lang === "kr" ? "작성 중인 글이 있습니다. 나가시겠습니까?" : "You have unsaved changes. Leave?")) return;
    }
    onClose();
  };

  const handleSaveDraft = () => {
    const content = editorRef.current?.innerHTML || "";
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ title, content, category, subcategory })
    );
    setSaveTime(
      new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    );
  };

  const handlePublish = () => {
    requireAuth(async () => {
      if (!title.trim() || !session?.access_token) return;

      if (category === "stock_discussion" && subcategory === "all") {
        setError(lang === "kr" ? "종목토론방은 하위 카테고리를 선택해야 합니다" : "Subcategory required for Stock Discussion");
        return;
      }

      setSubmitting(true);
      setError(null);

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
            subcategory: category === "stock_discussion" ? subcategory : null,
            symbol: null,
            image_url: null,
          }),
        });
        const json = await res.json();
        if (json.ok) {
          localStorage.removeItem(DRAFT_KEY);
          onPublished();
        } else {
          setError(json.error || (lang === "kr" ? "게시 실패" : "Failed to publish"));
        }
      } catch {
        setError(lang === "kr" ? "네트워크 오류" : "Network error");
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
        style={{ width: "min(860px, 98vw)", height: "min(640px, 95vh)" }}
      >
        {error && (
          <div className="absolute top-4 right-4 z-10 rounded border border-[#f87171]/30 bg-[#1a0808] px-4 py-2 shadow-lg">
            <p className="text-[11px] font-mono text-[#f87171]">{error}</p>
          </div>
        )}

        {/* Top action bar */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-3 border-b border-[#1a1a1a] shrink-0">
          <div className="flex items-center gap-3">
            {saveTime && (
              <span className="text-[10px] font-mono text-[#444]">
                {lang === "kr" ? `임시저장됨 ${saveTime}` : `Draft saved ${saveTime}`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExit}
              className="px-3 py-1.5 text-[11px] font-mono text-[#555] hover:text-white transition-colors"
            >
              {lang === "kr" ? "나가기" : "Close"}
            </button>
            <button
              onClick={handleSaveDraft}
              className="px-3 py-1.5 text-[11px] font-mono text-[#555] border border-[#1a1a1a] rounded hover:text-white hover:border-[#333] transition-colors"
            >
              {lang === "kr" ? "임시저장" : "Save Draft"}
            </button>
            <button
              onClick={handlePublish}
              disabled={!title.trim() || submitting}
              className="px-5 py-1.5 text-[11px] font-mono font-bold bg-[#f59e0b] text-black rounded hover:opacity-90 transition-opacity disabled:opacity-30"
            >
              {submitting ? "..." : (lang === "kr" ? "게시" : "Publish")}
            </button>
          </div>
        </div>

        {/* Title input */}
        <div className="px-5 pt-4 pb-2 shrink-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={lang === "kr" ? "제목을 입력하세요" : "Enter title"}
            className="w-full bg-transparent text-2xl font-bold text-white placeholder-[#333] outline-none"
            autoFocus
          />
        </div>

        {/* Category + subcategory selects */}
        <div className="px-3 sm:px-5 pb-2 sm:pb-3 shrink-0 flex flex-wrap items-center gap-2">
          <select
            value={category}
            onChange={(e) => {
              const val = e.target.value as MainCategory;
              setCategory(val);
              if (val !== "stock_discussion") setSubcategory("all");
              else setSubcategory("domestic");
            }}
            className="bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[11px] font-mono text-[#888] outline-none focus:border-[#333] appearance-none cursor-pointer"
          >
            {CREATE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c === "stock_discussion"
                  ? (lang === "kr" ? "종목 토론방" : "Stock Discussion")
                  : c === "macro"
                  ? (lang === "kr" ? "매크로" : "Macro")
                  : (lang === "kr" ? "자유" : "Free")}
              </option>
            ))}
          </select>

          {category === "stock_discussion" && (
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value as Subcategory)}
              className="bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2.5 py-1.5 text-[11px] font-mono text-[#888] outline-none focus:border-[#333] appearance-none cursor-pointer"
            >
              {SUBCATEGORIES.filter((s) => s !== "all").map((s) => (
                <option key={s} value={s}>
                  {s === "domestic" ? (lang === "kr" ? "국내주식" : "Domestic")
                    : s === "overseas" ? (lang === "kr" ? "해외주식" : "Overseas")
                    : s === "crypto" ? (lang === "kr" ? "크립토" : "Crypto")
                    : s === "commodity" ? (lang === "kr" ? "원자재" : "Commodity")
                    : (lang === "kr" ? "채권" : "Bond")}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-px px-2 sm:px-5 py-1.5 border-y border-[#1a1a1a] shrink-0 overflow-x-auto">
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
            data-placeholder={lang === "kr" ? "내용을 입력하세요..." : "Write your content..."}
            onInput={() => {
              hasContentRef.current = !!(title.trim() || editorRef.current?.innerText?.trim());
            }}
          />
        </div>
      </div>

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
  const [category, setCategory] = useState<MainCategory>("all");
  const [subcategory, setSubcategory] = useState<Subcategory>("all");
  const [sortMode, setSortMode] = useState<SortMode>("hot");
  const [showEditor, setShowEditor] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (category === "stock_discussion" && subcategory !== "all") {
        params.set("subcategory", subcategory);
      }
      const qs = params.toString();
      const url = `/api/community/posts${qs ? `?${qs}` : ""}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.ok) setPosts(json.posts);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [category, subcategory]);

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
    requireAuth(() => router.push("/community/write"));
  };

  const sorted = sortPosts(posts, sortMode);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="community" />

      <main className="w-full px-2 sm:px-4 py-3 sm:py-5">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[auto_1fr]">
          {/* Left sidebar: categories */}
          <aside className={`hidden lg:flex flex-col transition-all duration-200 ${sidebarOpen ? "w-[200px]" : "w-[32px]"} shrink-0`}>
            {/* 토글 버튼 */}
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="flex items-center justify-center w-7 h-7 rounded hover:bg-card-border/50 text-muted hover:text-foreground transition-colors mb-2 ml-auto"
              title={sidebarOpen ? "접기" : "펼치기"}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={sidebarOpen ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
              </svg>
            </button>

            {/* 카테고리 내용 - 펼쳐졌을 때만 표시 */}
            {sidebarOpen && (
              <div className="space-y-1">
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted px-2">
                  {lang === "kr" ? "카테고리" : "Categories"}
                </h3>
                {MAIN_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setCategory(cat);
                      setSubcategory("all");
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition-colors ${
                      category === cat
                        ? "bg-accent/10 text-accent font-medium"
                        : "text-muted hover:text-foreground hover:bg-card-border/30"
                    }`}
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={CAT_SIDEBAR_ICON[cat] || CAT_SIDEBAR_ICON.all} />
                    </svg>
                    {t(MAIN_CAT_LABEL[cat])}
                  </button>
                ))}

                {category === "stock_discussion" && (
                  <div className="ml-6 mt-1 space-y-0.5 border-l border-card-border pl-2">
                    {SUBCATEGORIES.map((sub) => (
                      <button
                        key={sub}
                        onClick={() => setSubcategory(sub)}
                        className={`block w-full rounded px-2 py-1.5 text-left text-[11px] transition-colors ${
                          subcategory === sub
                            ? "text-accent font-medium"
                            : "text-muted hover:text-foreground"
                        }`}
                      >
                        {t(SUB_LABEL[sub])}
                      </button>
                    ))}
                  </div>
                )}

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
              </div>
            )}

            {/* 접혔을 때 아이콘만 표시 */}
            {!sidebarOpen && (
              <div className="flex flex-col items-center gap-3 mt-1">
                {MAIN_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setCategory(cat); setSubcategory("all"); setSidebarOpen(true); }}
                    className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
                      category === cat ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"
                    }`}
                    title={t(MAIN_CAT_LABEL[cat])}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={CAT_SIDEBAR_ICON[cat] || CAT_SIDEBAR_ICON.all} />
                    </svg>
                  </button>
                ))}
                <button
                  onClick={() => { openEditor(); setSidebarOpen(true); }}
                  className="flex items-center justify-center w-7 h-7 rounded-lg bg-accent/10 text-accent hover:opacity-90 transition-colors mt-2"
                  title={t("newPost")}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            )}
          </aside>

          {/* Center: feed */}
          <div className="space-y-3">
            {/* Mobile category + new post */}
            <div className="flex flex-wrap items-center gap-2 lg:hidden">
              {MAIN_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setCategory(cat);
                    setSubcategory("all");
                  }}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                    category === cat
                      ? "bg-accent text-white"
                      : "bg-card-bg border border-card-border text-muted"
                  }`}
                >
                  {t(MAIN_CAT_LABEL[cat])}
                </button>
              ))}
              <button
                onClick={openEditor}
                className="ml-auto rounded-lg bg-accent px-3 py-1 text-[11px] font-semibold text-white"
              >
                {t("newPost")}
              </button>
            </div>

            {/* Mobile subcategory tabs */}
            {category === "stock_discussion" && (
              <div className="flex gap-1 overflow-x-auto pb-1 lg:hidden">
                {SUBCATEGORIES.map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setSubcategory(sub)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${
                      subcategory === sub
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-card-bg border border-card-border text-muted"
                    }`}
                  >
                    {t(SUB_LABEL[sub])}
                  </button>
                ))}
              </div>
            )}

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

        </div>

        <button
          onClick={openEditor}
          className="fixed bottom-5 right-5 z-30 flex items-center justify-center w-12 h-12 rounded-full bg-accent shadow-lg lg:hidden"
          aria-label="새 글 작성"
        >
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </main>

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
      <div className="flex-1 px-2 sm:px-3 py-2 sm:py-3 min-w-0">
        {/* Meta */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
          <span className={`rounded px-1.5 py-px text-[9px] font-semibold ${CAT_BADGE_COLOR[post.category] || CAT_BADGE_COLOR[mapCategory(post.category)] || "bg-muted/20 text-muted"}`}>
            {getCatDisplayLabel(post.category, t)}
          </span>
          {post.subcategory && (
            <span className={`rounded px-1.5 py-px text-[9px] font-medium ${SUB_BADGE_COLOR[post.subcategory] || "bg-muted/10 text-muted"}`}>
              {getSubDisplayLabel(post.subcategory, t)}
            </span>
          )}
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
        <h3 className="mt-1.5 text-xs sm:text-[13px] font-semibold leading-snug">{post.title}</h3>

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
