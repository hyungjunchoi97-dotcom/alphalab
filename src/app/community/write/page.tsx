"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";

// ── Constants ────────────────────────────────────────────────

const DRAFT_KEY = "community_write_draft";
const AUTOSAVE_INTERVAL = 30000;
const DEBOUNCE_MS = 2000;

const CATEGORIES = [
  { value: "stock", label: "주식" },
  { value: "crypto", label: "크립토" },
  { value: "overseas", label: "해외주식" },
  { value: "macro", label: "매크로" },
  { value: "politics", label: "정치/경제" },
  { value: "discussion", label: "토론" },
  { value: "idea", label: "아이디어" },
  { value: "question", label: "질문" },
  { value: "news", label: "뉴스" },
  { value: "free", label: "자유" },
] as const;

const SYMBOLS = [
  { label: "---", insert: "───────────" },
  { label: "\u2192", insert: "\u2192 " },
  { label: "\u2022", insert: "- " },
  { label: "\u25B2", insert: "\u25B2 " },
  { label: "\u25BC", insert: "\u25BC " },
  { label: "\u203B", insert: "\u203B " },
] as const;

// ── Types ────────────────────────────────────────────────────

interface Draft {
  title: string;
  content: string;
  category: string;
  tickers: string[];
  savedAt: string;
}

// ── Ticker badge regex ───────────────────────────────────────

const TICKER_REGEX = /\$([A-Z0-9]{1,10})/g;

function renderContentPreview(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(TICKER_REGEX.source, "g");
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    parts.push(
      <span
        key={match.index}
        className="inline-block rounded bg-amber-400/15 px-1.5 py-0.5 text-[11px] font-mono font-bold text-amber-400 mx-0.5"
      >
        ${match[1]}
      </span>
    );
    lastIdx = re.lastIndex;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

// ── Page Component ───────────────────────────────────────────

export default function CommunityWritePage() {
  const router = useRouter();
  const { session } = useAuth();
  const requireAuth = useRequireAuth();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("stock");
  const [tickerInput, setTickerInput] = useState("");
  const [tickers, setTickers] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSaveTime, setAutoSaveTime] = useState<string | null>(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const [draftData, setDraftData] = useState<Draft | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showTickerInput, setShowTickerInput] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragCounterRef = useRef(0);

  // ── Draft restore on mount ──────────────────────────────────

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft: Draft = JSON.parse(raw);
        if (draft.title || draft.content) {
          setDraftData(draft);
          setShowDraftBanner(true);
        }
      }
    } catch { /* */ }
  }, []);

  const restoreDraft = useCallback(() => {
    if (!draftData) return;
    setTitle(draftData.title);
    setContent(draftData.content);
    setCategory(draftData.category);
    setTickers(draftData.tickers || []);
    setShowDraftBanner(false);
  }, [draftData]);

  const dismissDraft = useCallback(() => {
    setShowDraftBanner(false);
    localStorage.removeItem(DRAFT_KEY);
  }, []);

  // ── Autosave ────────────────────────────────────────────────

  const saveDraft = useCallback(() => {
    if (!title && !content) return;
    const draft: Draft = {
      title,
      content,
      category,
      tickers,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setAutoSaveTime(
      new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    );
  }, [title, content, category, tickers]);

  // Periodic autosave
  useEffect(() => {
    const interval = setInterval(saveDraft, AUTOSAVE_INTERVAL);
    return () => clearInterval(interval);
  }, [saveDraft]);

  // Debounced autosave on keystroke
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(saveDraft, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [title, content, saveDraft]);

  // ── Insert at cursor ───────────────────────────────────────

  const insertAtCursor = useCallback((text: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setContent((prev) => prev + text);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const newContent = before + text + after;
    setContent(newContent);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + text.length;
    });
  }, [content]);

  // ── Format buttons ─────────────────────────────────────────

  const wrapSelection = useCallback(
    (prefix: string, suffix: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = content.slice(start, end);
      const wrapped = prefix + (selected || "text") + suffix;
      const before = content.slice(0, start);
      const after = content.slice(end);
      setContent(before + wrapped + after);
      requestAnimationFrame(() => {
        ta.focus();
        ta.selectionStart = start + prefix.length;
        ta.selectionEnd = start + prefix.length + (selected || "text").length;
      });
    },
    [content]
  );

  // ── Ticker handling ─────────────────────────────────────────

  const addTicker = useCallback(
    (ticker: string) => {
      const t = ticker.replace(/^\$/, "").toUpperCase().trim();
      if (!t) return;
      if (!tickers.includes(t)) {
        setTickers((prev) => [...prev, t]);
      }
      // Insert badge in content
      insertAtCursor(`$${t} `);
      setShowTickerInput(false);
      setTickerInput("");
    },
    [tickers, insertAtCursor]
  );

  const removeTicker = useCallback((ticker: string) => {
    setTickers((prev) => prev.filter((t) => t !== ticker));
  }, []);

  // Auto-detect tickers from content
  useEffect(() => {
    const found = new Set<string>();
    let m: RegExpExecArray | null;
    const re = new RegExp(TICKER_REGEX.source, "g");
    while ((m = re.exec(content)) !== null) {
      found.add(m[1]);
    }
    setTickers((prev) => {
      const merged = new Set([...prev, ...found]);
      return [...merged];
    });
  }, [content]);

  // ── Image upload ────────────────────────────────────────────

  const uploadFile = useCallback(
    async (file: File) => {
      if (!session?.access_token) return;
      if (!file.type.startsWith("image/")) return;
      if (file.size > 5 * 1024 * 1024) {
        setError("Image must be under 5MB");
        return;
      }

      setUploading(true);
      setUploadProgress("Uploading...");

      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/community/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        });
        const json = await res.json();
        if (json.ok && json.url) {
          setImageUrls((prev) => [...prev, json.url]);
          insertAtCursor(`\n![image](${json.url})\n`);
          setUploadProgress(null);
        } else {
          setError(json.error || "Upload failed");
          setUploadProgress(null);
        }
      } catch {
        setError("Upload failed");
        setUploadProgress(null);
      } finally {
        setUploading(false);
      }
    },
    [session, insertAtCursor]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
      e.target.value = "";
    },
    [uploadFile]
  );

  // ── Drag & Drop ─────────────────────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      dragCounterRef.current = 0;
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) {
        uploadFile(file);
      }
    },
    [uploadFile]
  );

  // ── Publish ─────────────────────────────────────────────────

  const handlePublish = useCallback(() => {
    requireAuth(async () => {
      if (!title.trim() || !session?.access_token) return;
      setSubmitting(true);
      setError(null);

      try {
        const res = await fetch("/api/community/posts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            title: title.trim(),
            content: content.trim(),
            category,
            symbol: tickers[0] || null,
            image_url: imageUrls[0] || null,
          }),
        });
        const json = await res.json();
        if (json.ok) {
          localStorage.removeItem(DRAFT_KEY);
          router.push("/community");
        } else {
          setError(json.error || "Failed to publish");
        }
      } catch {
        setError("Network error");
      } finally {
        setSubmitting(false);
      }
    });
  }, [title, content, category, tickers, imageUrls, session, router, requireAuth]);

  // ── Clear error after 4s ────────────────────────────────────

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  // ── Render ──────────────────────────────────────────────────

  const charCount = content.length;

  return (
    <div
      className="min-h-screen bg-[#050505] flex flex-col"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050505]/90 border-2 border-dashed border-amber-400/40 pointer-events-none">
          <div className="text-center">
            <p className="text-sm font-mono text-amber-400 tracking-widest">DROP IMAGE</p>
            <p className="text-[10px] text-[#555] font-mono mt-1">JPG, PNG, GIF, WEBP (max 5MB)</p>
          </div>
        </div>
      )}

      {/* Draft restore banner */}
      {showDraftBanner && (
        <div className="bg-[#111] border-b border-[#1a1a1a] px-4 py-2.5 flex items-center justify-between">
          <span className="text-[11px] text-[#888] font-mono">
            임시저장된 글이 있습니다
            {draftData?.savedAt && (
              <span className="text-[#555] ml-2">
                {new Date(draftData.savedAt).toLocaleString("ko-KR", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </span>
          <div className="flex gap-2">
            <button
              onClick={restoreDraft}
              className="px-3 py-1 text-[10px] font-mono font-bold text-amber-400 bg-amber-400/10 rounded hover:bg-amber-400/20 transition-colors"
            >
              복원
            </button>
            <button
              onClick={dismissDraft}
              className="px-3 py-1 text-[10px] font-mono text-[#555] hover:text-[#888] transition-colors"
            >
              무시
            </button>
          </div>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="fixed top-4 right-4 z-50 rounded border border-[#f87171]/30 bg-[#1a0808] px-4 py-2.5 shadow-lg">
          <p className="text-[11px] font-mono text-[#f87171]">{error}</p>
        </div>
      )}

      {/* Top bar */}
      <div className="border-b border-[#1a1a1a] px-4 py-3 flex items-center gap-4">
        <button
          onClick={() => router.push("/community")}
          className="flex items-center gap-1.5 text-[11px] font-mono text-[#555] hover:text-white transition-colors shrink-0"
        >
          <span className="text-sm">&larr;</span>
          커뮤니티
        </button>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력하세요"
          className="flex-1 bg-transparent text-xl font-bold text-white placeholder-[#333] outline-none font-mono"
          autoFocus
        />

        <button
          onClick={handlePublish}
          disabled={!title.trim() || submitting}
          className="shrink-0 rounded bg-amber-400 px-5 py-1.5 text-xs font-mono font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-30"
        >
          {submitting ? "..." : "게시"}
        </button>
      </div>

      {/* Category + ticker row */}
      <div className="border-b border-[#1a1a1a] px-4 py-2 flex items-center gap-3 flex-wrap">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2 py-1 text-[11px] font-mono text-[#888] outline-none focus:border-[#333] appearance-none cursor-pointer"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        {/* Ticker badges */}
        {tickers.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded bg-amber-400/15 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-400"
          >
            ${t}
            <button
              onClick={() => removeTicker(t)}
              className="text-amber-400/50 hover:text-amber-400 ml-0.5"
            >
              x
            </button>
          </span>
        ))}

        <span className="text-[10px] text-[#333] font-mono">
          본문에 $TICKER 입력시 자동 태그
        </span>
      </div>

      {/* Toolbar */}
      <div className="border-b border-[#1a1a1a] px-4 py-1.5 flex items-center gap-px flex-wrap">
        {/* Format group */}
        <ToolbarBtn label="B" title="Bold" onClick={() => wrapSelection("**", "**")} bold />
        <ToolbarBtn label="I" title="Italic" onClick={() => wrapSelection("*", "*")} italic />
        <ToolbarBtn label="&quot;" title="Blockquote" onClick={() => insertAtCursor("\n> ")} />
        <ToolbarBtn label="{}" title="Code" onClick={() => wrapSelection("`", "`")} />

        <div className="w-px h-5 bg-[#1a1a1a] mx-1" />

        {/* Symbols group */}
        {SYMBOLS.map((s) => (
          <ToolbarBtn
            key={s.label}
            label={s.label}
            title={s.label}
            onClick={() => insertAtCursor(s.insert)}
          />
        ))}

        <div className="w-px h-5 bg-[#1a1a1a] mx-1" />

        {/* Special group */}
        <ToolbarBtn
          label="$T"
          title="Ticker tag"
          onClick={() => setShowTickerInput((v) => !v)}
          active={showTickerInput}
        />
        <ToolbarBtn
          label="IMG"
          title="Image"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="w-px h-5 bg-[#1a1a1a] mx-1" />

        {/* Preview toggle */}
        <ToolbarBtn
          label="PRV"
          title="Preview"
          onClick={() => setPreviewMode((v) => !v)}
          active={previewMode}
        />

        {/* Inline ticker input */}
        {showTickerInput && (
          <div className="ml-2 flex items-center gap-1">
            <input
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter" && tickerInput.trim()) {
                  addTicker(tickerInput);
                }
                if (e.key === "Escape") {
                  setShowTickerInput(false);
                  setTickerInput("");
                }
              }}
              placeholder="종목코드 입력"
              className="bg-[#0a0a0a] border border-[#1a1a1a] rounded px-2 py-0.5 text-[10px] font-mono text-amber-400 placeholder-[#333] outline-none w-24 focus:border-amber-400/30"
              autoFocus
            />
            <button
              onClick={() => {
                if (tickerInput.trim()) addTicker(tickerInput);
              }}
              className="text-[10px] font-mono text-[#555] hover:text-amber-400 transition-colors"
            >
              +
            </button>
          </div>
        )}

        {/* Upload progress */}
        {uploadProgress && (
          <span className="ml-2 text-[10px] font-mono text-amber-400 animate-pulse">
            {uploadProgress}
          </span>
        )}
      </div>

      {/* Editor area */}
      <div className="flex-1 relative">
        {previewMode ? (
          <div className="h-full min-h-[400px] p-4 bg-[#080808] text-[13px] text-[#ccc] font-mono leading-relaxed whitespace-pre-wrap overflow-auto">
            {renderContentPreview(content)}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력하세요..."
            className="w-full h-full min-h-[400px] resize-none bg-[#080808] p-4 text-[13px] text-[#ccc] font-mono leading-relaxed outline-none placeholder-[#222]"
            style={{ minHeight: "calc(100vh - 240px)" }}
          />
        )}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[#1a1a1a] px-4 py-2 flex items-center justify-between bg-[#050505]">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono text-[#333] tabular-nums">
            {charCount.toLocaleString()} chars
          </span>
          {imageUrls.length > 0 && (
            <span className="text-[10px] font-mono text-[#333]">
              {imageUrls.length} image{imageUrls.length > 1 ? "s" : ""}
            </span>
          )}
          {tickers.length > 0 && (
            <span className="text-[10px] font-mono text-[#333]">
              {tickers.length} ticker{tickers.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {autoSaveTime && (
            <span className="text-[10px] font-mono text-[#333]">
              자동저장됨 {autoSaveTime}
            </span>
          )}
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              autoSaveTime ? "bg-[#4ade80]/40" : "bg-[#333]"
            }`}
          />
        </div>
      </div>
    </div>
  );
}

// ── Toolbar Button ───────────────────────────────────────────

function ToolbarBtn({
  label,
  title,
  onClick,
  bold,
  italic,
  active,
  disabled,
}: {
  label: string;
  title: string;
  onClick: () => void;
  bold?: boolean;
  italic?: boolean;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`px-2 py-1 text-[11px] font-mono rounded transition-colors ${
        active
          ? "bg-amber-400/15 text-amber-400"
          : "text-[#555] bg-[#0a0a0a] hover:text-amber-400 hover:bg-[#111]"
      } ${bold ? "font-bold" : ""} ${italic ? "italic" : ""} ${
        disabled ? "opacity-30 cursor-not-allowed" : ""
      }`}
    >
      {label}
    </button>
  );
}
