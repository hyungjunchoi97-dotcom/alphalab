"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/LangContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import ShareButton from "@/components/ShareButton";
import type { MessageKey } from "@/lib/i18n";

// ── Constants ──────────────────────────────────────────────────

type MainCategory = "all" | "stock_discussion" | "realestate" | "news_run";
type Subcategory = "all" | "domestic" | "overseas" | "crypto";
type SortMode = "hot" | "new" | "top" | "rising";

const MAIN_CATEGORIES: MainCategory[] = ["all", "stock_discussion", "realestate", "news_run"];

const MAIN_CAT_LABEL: Record<MainCategory, MessageKey> = {
  all: "catAll",
  stock_discussion: "catStockDiscussion",
  realestate: "catRealestate",
  news_run: "catNewsRun",
};

const SUBCATEGORIES: Subcategory[] = ["all", "domestic", "overseas", "crypto"];

const SUB_LABEL: Record<Subcategory, MessageKey> = {
  all: "subAll",
  domestic: "subDomestic",
  overseas: "subOverseas",
  crypto: "subCrypto",
};

// Create categories for editor
const CREATE_CATEGORIES: MainCategory[] = ["stock_discussion", "realestate"];

const CAT_BADGE_COLOR: Record<string, string> = {
  stock_discussion: "bg-blue-500/20 text-blue-400",
  realestate: "bg-emerald-500/20 text-emerald-400",
  news_run: "bg-red-500/20 text-red-400",
  ai: "bg-amber-500/20 text-amber-400",
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
  news_run: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6m-6 4h.01",
  ai: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z",
};

const DRAFT_KEY = "community_write_draft";

// ── Types ──────────────────────────────────────────────────────

interface Post {
  id: string;
  user_id: string;
  author_email: string | null;
  author_nickname: string | null;
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
                  : c === "realestate"
                  ? (lang === "kr" ? "부동산" : "Real Estate")
                  : c}
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
  const [viewTab, setViewTab] = useState<"all" | "popular">("all");
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category === "news_run") {
        params.set("category", "news_run");
        params.set("is_bot", "true");
      } else {
        if (category !== "all") {
          params.set("category", category);
        }
        params.set("is_bot", "false");
      }
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

  // Filter by view tab
  let filtered = sortPosts(posts, sortMode);
  if (viewTab === "popular") filtered = filtered.filter(p => p.likes >= 3);

  const isAdmin = session?.user?.email === "hyungjunchoi97@gmail.com";

  const handleDelete = (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm("이 글을 삭제하시겠습니까?")) return;
    fetch(`/api/community/posts/${postId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
      .then((r) => r.json())
      .then((json) => { if (json.ok) setPosts((prev) => prev.filter((p) => p.id !== postId)); });
  };

  const catLabel = (cat: string) => {
    const mapped = mapCategory(cat);
    if (mapped === "stock_discussion") return "종토";
    if (mapped === "realestate") return "부동산";
    if (mapped === "macro") return "매크로";
    if (mapped === "free") return "자유";
    return cat;
  };

  const catColor = (cat: string) => {
    const mapped = mapCategory(cat);
    if (mapped === "stock_discussion") return "#60a5fa";
    if (mapped === "realestate") return "#34d399";
    if (mapped === "macro") return "#22d3ee";
    if (mapped === "free") return "#9ca3af";
    return "#9ca3af";
  };

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0a", color: "#e0e0e0" }}>
      <style dangerouslySetInnerHTML={{ __html: `
  @media (max-width: 768px) {
    .dc-table-header .col-num,
    .dc-table-header .col-likes,
    .dc-table-row .col-num,
    .dc-table-row .col-likes { display: none !important; }
    .dc-table-header, .dc-table-row {
      grid-template-columns: 50px 1fr 60px 44px 36px !important;
    }
    .dc-table-header span, .dc-table-row span,
    .dc-table-header > div, .dc-table-row > div { font-size: 12px !important; }
    .dc-cat-tabs, .dc-sub-tabs, .dc-view-tabs { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
    .dc-cat-tabs::-webkit-scrollbar, .dc-sub-tabs::-webkit-scrollbar, .dc-view-tabs::-webkit-scrollbar { display: none; }
  }
` }} />
      <AppHeader active="community" />

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "16px 12px" }}>

        {/* Board header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: "#ffffff" }}>AlphaLab 커뮤니티</h1>
            <p style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
              투자자 커뮤니티 | 총 {posts.length}개 게시글
            </p>
          </div>
          <button
            onClick={openEditor}
            className="hidden sm:flex"
            style={{
              fontSize: 12, fontWeight: 600, padding: "6px 16px",
              background: "#f59e0b", color: "#000", border: "none",
              borderRadius: 4, cursor: "pointer",
            }}
          >
            글쓰기
          </button>
        </div>

        {/* Category tabs (horizontal) */}
        <div className="dc-cat-tabs" style={{ display: "flex", gap: 0, borderBottom: "1px solid #1f2937", marginBottom: 0, flexWrap: "nowrap" }}>
          {MAIN_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => { setCategory(cat); setSubcategory("all"); }}
              style={{
                fontSize: 12, fontWeight: category === cat ? 600 : 400,
                padding: "8px 14px", background: "transparent", border: "none",
                borderBottom: category === cat ? "2px solid #f59e0b" : "2px solid transparent",
                color: category === cat ? "#f59e0b" : "#6b7280",
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {t(MAIN_CAT_LABEL[cat])}
            </button>
          ))}
        </div>

        {/* Subcategory tabs */}
        {category === "stock_discussion" && (
          <div className="dc-sub-tabs" style={{ display: "flex", gap: 0, borderBottom: "1px solid #111", background: "#0d0d0d" }}>
            {SUBCATEGORIES.map((sub) => (
              <button
                key={sub}
                onClick={() => setSubcategory(sub)}
                style={{
                  fontSize: 11, padding: "6px 12px", background: "transparent", border: "none",
                  color: subcategory === sub ? "#60a5fa" : "#555",
                  fontWeight: subcategory === sub ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                {t(SUB_LABEL[sub])}
              </button>
            ))}
          </div>
        )}

        {/* View tabs + sort */}
        <div className="dc-view-tabs" style={{ display: "flex", alignItems: "center", gap: 0, borderBottom: "1px solid #1a1a1a", background: "#0d0d0d" }}>
          {([
            { key: "all" as const, label: "전체글" },
            { key: "popular" as const, label: "개념글" },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setViewTab(tab.key)}
              style={{
                fontSize: 11, fontWeight: viewTab === tab.key ? 600 : 400,
                padding: "7px 12px", background: "transparent", border: "none",
                color: viewTab === tab.key ? "#e0e0e0" : "#555",
                borderBottom: viewTab === tab.key ? "1px solid #e0e0e0" : "1px solid transparent",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 2, padding: "0 8px" }}>
            {(["new", "hot", "top"] as SortMode[]).map((s) => (
              <button
                key={s}
                onClick={() => setSortMode(s)}
                style={{
                  fontSize: 10, padding: "3px 8px", background: "transparent", border: "none",
                  color: sortMode === s ? "#f59e0b" : "#555", cursor: "pointer",
                  fontWeight: sortMode === s ? 600 : 400,
                }}
              >
                {s === "new" ? "최신" : s === "hot" ? "인기" : "추천"}
              </button>
            ))}
          </div>
        </div>

        {/* Table header */}
        <div className="dc-table-header" style={{
          display: "grid", gridTemplateColumns: "50px 60px 1fr 80px 60px 40px 40px",
          padding: "6px 4px", borderBottom: "1px solid #1f2937",
          fontSize: 10, color: "#555", fontWeight: 600,
        }}>
          <span className="col-num">번호</span>
          <span>말머리</span>
          <span>제목</span>
          <span>글쓴이</span>
          <span>작성일</span>
          <span className="col-likes" style={{ textAlign: "center" }}>추천</span>
          <span style={{ textAlign: "center" }}>댓글</span>
        </div>

        {/* Post rows */}
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="dc-table-row" style={{ display: "grid", gridTemplateColumns: "50px 60px 1fr 80px 60px 40px 40px", padding: "8px 4px", borderBottom: "1px solid #111" }}>
              <div style={{ height: 12, width: 24, background: "#111", borderRadius: 2 }} />
              <div style={{ height: 12, width: 36, background: "#111", borderRadius: 2 }} />
              <div style={{ height: 12, width: "70%", background: "#111", borderRadius: 2 }} />
              <div style={{ height: 12, width: 48, background: "#111", borderRadius: 2 }} />
              <div style={{ height: 12, width: 32, background: "#111", borderRadius: 2 }} />
              <div style={{ height: 12, width: 16, background: "#111", borderRadius: 2, margin: "0 auto" }} />
              <div style={{ height: 12, width: 16, background: "#111", borderRadius: 2, margin: "0 auto" }} />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", fontSize: 12, color: "#555" }}>
            {t("noPosts")}
          </div>
        ) : (
          filtered.map((post, idx) => (
            <div
              key={post.id}
              className="dc-table-row"
              onClick={() => router.push(`/community/${post.id}`)}
              style={{
                display: "grid", gridTemplateColumns: "50px 60px 1fr 80px 60px 40px 40px",
                padding: "8px 4px", borderBottom: "1px solid #111",
                cursor: "pointer", transition: "background 0.1s", alignItems: "center",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#111"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              {/* 번호 */}
              <span className="col-num" style={{ fontSize: 11, color: "#555", fontVariantNumeric: "tabular-nums" }}>
                {filtered.length - idx}
              </span>

              {/* 말머리 */}
              <span style={{ fontSize: 10, fontWeight: 600, color: catColor(post.category) }}>
                {catLabel(post.category)}
              </span>

              {/* 제목 + 댓글수 + 삭제 */}
              <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{
                  fontSize: 13, color: "#e0e0e0", overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {post.title}
                </span>
                {post.commentCount > 0 && (
                  <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600, flexShrink: 0 }}>
                    [{post.commentCount}]
                  </span>
                )}
                {isAdmin && (
                  <button
                    onClick={(e) => handleDelete(e, post.id)}
                    style={{
                      fontSize: 9, color: "#ef4444", background: "transparent",
                      border: "none", cursor: "pointer", marginLeft: 4, flexShrink: 0, padding: "0 2px",
                    }}
                  >
                    X
                  </button>
                )}
              </div>

              {/* 글쓴이 */}
              <span style={{ fontSize: 11, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {post.author_nickname || post.author_email?.split("@")[0] || "anon"}
              </span>

              {/* 작성일 */}
              <span style={{ fontSize: 11, color: "#555" }}>
                {timeAgo(post.created_at)}
              </span>

              {/* 추천 */}
              <span className="col-likes" style={{ fontSize: 11, color: post.likes > 0 ? "#f59e0b" : "#333", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                {post.likes}
              </span>

              {/* 댓글 */}
              <span style={{ fontSize: 11, color: post.commentCount > 0 ? "#60a5fa" : "#333", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
                {post.commentCount}
              </span>
            </div>
          ))
        )}
      </main>

      {/* Mobile write FAB */}
      <button
        onClick={openEditor}
        className="fixed bottom-5 right-5 z-30 flex items-center justify-center w-12 h-12 rounded-full shadow-lg sm:hidden"
        style={{ background: "#f59e0b" }}
        aria-label="글쓰기"
      >
        <svg className="h-5 w-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <ShareButton title="AlphaLab 커뮤니티" description="투자자 커뮤니티 - 종목토론, 매크로, 자유게시판" />

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

