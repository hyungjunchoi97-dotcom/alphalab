"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/LangContext";
import { useAuth } from "@/context/AuthContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import AppHeader from "@/components/AppHeader";

type MainCategory = "stock_discussion" | "macro" | "free";
type Subcategory = "all" | "domestic" | "overseas" | "crypto" | "commodity" | "bond";

const CREATE_CATEGORIES: MainCategory[] = ["stock_discussion", "macro", "free"];
const SUBCATEGORIES: Subcategory[] = ["all", "domestic", "overseas", "crypto", "commodity", "bond"];
const DRAFT_KEY = "community_write_draft";

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

export default function CommunityWritePage() {
  const router = useRouter();
  const { lang } = useLang();
  const { session } = useAuth();
  const requireAuth = useRequireAuth();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<MainCategory>("stock_discussion");
  const [subcategory, setSubcategory] = useState<Subcategory>("domestic");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveTime, setSaveTime] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Draft restore
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.title) setTitle(draft.title);
        if (draft.category && CREATE_CATEGORIES.includes(draft.category)) setCategory(draft.category);
        if (draft.subcategory) setSubcategory(draft.subcategory);
        if (draft.content && editorRef.current) editorRef.current.innerHTML = draft.content;
      }
    } catch { /* */ }
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  const handleSaveDraft = () => {
    const content = editorRef.current?.innerHTML || "";
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, content, category, subcategory }));
    setSaveTime(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
  };

  const handleExit = () => {
    const content = editorRef.current?.innerText?.trim() || "";
    if (title.trim() || content) {
      if (!window.confirm(lang === "kr" ? "작성 중인 글이 있습니다. 나가시겠습니까?" : "You have unsaved changes. Leave?")) return;
    }
    router.push("/community");
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
      const htmlContent = editorRef.current?.innerHTML || "";

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
            htmlContent: htmlContent.trim(),
            category,
            subcategory: category === "stock_discussion" ? subcategory : null,
            symbol: null,
            image_url: null,
          }),
        });
        const json = await res.json();
        if (json.ok) {
          localStorage.removeItem(DRAFT_KEY);
          router.push("/community");
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

  const insertTable = () => {
    const tableHtml = `
      <table style="width:100%;border-collapse:collapse;margin:12px 0">
        <thead>
          <tr>
            <th style="border:1px solid #333;padding:8px;background:#1a1a1a;color:#f59e0b;text-align:left">항목</th>
            <th style="border:1px solid #333;padding:8px;background:#1a1a1a;color:#f59e0b;text-align:right">값</th>
            <th style="border:1px solid #333;padding:8px;background:#1a1a1a;color:#f59e0b;text-align:right">비고</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #333;padding:8px;color:#e8e8e8">-</td>
            <td style="border:1px solid #333;padding:8px;color:#e8e8e8;text-align:right">-</td>
            <td style="border:1px solid #333;padding:8px;color:#888;text-align:right">-</td>
          </tr>
          <tr>
            <td style="border:1px solid #333;padding:8px;color:#e8e8e8">-</td>
            <td style="border:1px solid #333;padding:8px;color:#e8e8e8;text-align:right">-</td>
            <td style="border:1px solid #333;padding:8px;color:#888;text-align:right">-</td>
          </tr>
        </tbody>
      </table>
      <p><br></p>
    `;
    document.execCommand("insertHTML", false, tableHtml);
    editorRef.current?.focus();
  };

  const insertTicker = () => {
    const ticker = window.prompt(lang === "kr" ? "종목코드 또는 티커 입력 (예: 005930, AAPL)" : "Enter ticker (e.g. 005930, AAPL)");
    if (!ticker) return;
    const html = `<span style="background:#f59e0b22;color:#f59e0b;border:1px solid #f59e0b44;border-radius:4px;padding:1px 6px;font-family:monospace;font-size:13px">$${ticker.toUpperCase()}</span>&nbsp;`;
    document.execCommand("insertHTML", false, html);
    editorRef.current?.focus();
  };

  const insertDivider = () => {
    document.execCommand("insertHTML", false, '<hr style="border:none;border-top:1px solid #333;margin:16px 0" /><p><br></p>');
    editorRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="community" />

      <main className="mx-auto max-w-[860px] px-2 sm:px-4 py-3 sm:py-6">
        {/* Error banner */}
        {error && (
          <div className="mb-3 rounded border border-[#f87171]/30 bg-[#1a0808] px-4 py-2">
            <p className="text-[11px] font-mono text-[#f87171]">{error}</p>
          </div>
        )}

        {/* Top action bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleExit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-[#555] hover:text-white transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              {lang === "kr" ? "돌아가기" : "Back"}
            </button>
            {saveTime && (
              <span className="text-[10px] font-mono text-[#444]">
                {lang === "kr" ? `임시저장됨 ${saveTime}` : `Draft saved ${saveTime}`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
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

        {/* Editor card */}
        <div className="rounded-lg border border-[#1a1a1a] bg-[#050505] overflow-hidden">
          {/* Title input */}
          <div className="px-5 pt-5 pb-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={lang === "kr" ? "제목을 입력하세요" : "Enter title"}
              className="w-full bg-transparent text-2xl font-bold text-white placeholder-[#333] outline-none"
              autoFocus
            />
          </div>

          {/* Category + subcategory selects */}
          <div className="px-5 pb-3 flex flex-wrap items-center gap-2">
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
          <div className="flex items-center gap-px px-3 sm:px-5 py-1.5 border-y border-[#1a1a1a] overflow-x-auto">
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

            <div className="w-px h-5 bg-[#1a1a1a] mx-1.5" />

            <TBBtn label="UL" onClick={() => execCmd("insertUnorderedList")} />
            <TBBtn label="OL" onClick={() => execCmd("insertOrderedList")} />

            <div className="w-px h-5 bg-[#1a1a1a] mx-1.5" />

            <TBBtn label="Table" onClick={insertTable} />
            <TBBtn label="$TICK" onClick={insertTicker} />
            <TBBtn label="—" onClick={insertDivider} />
          </div>

          {/* contentEditable editor */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="min-h-[400px] p-5 text-[14px] text-[#ccc] leading-relaxed outline-none"
            style={{ caretColor: "#f59e0b" }}
            data-placeholder={lang === "kr" ? "내용을 입력하세요..." : "Write your content..."}
          />
        </div>
      </main>

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
