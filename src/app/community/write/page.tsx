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

const FONT_COLORS = [
  { color: "#ffffff", label: "흰색" },
  { color: "#e8e8e8", label: "기본" },
  { color: "#f59e0b", label: "황금" },
  { color: "#22c55e", label: "초록" },
  { color: "#ef4444", label: "빨강" },
  { color: "#60a5fa", label: "파랑" },
  { color: "#a78bfa", label: "보라" },
  { color: "#fb923c", label: "주황" },
  { color: "#888888", label: "회색" },
];

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
      className={`px-2 h-7 text-[12px] rounded text-white hover:bg-white/10 transition-colors ${
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
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [showTableConfig, setShowTableConfig] = useState(false);
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

  const enableTableResize = () => {
    if (!editorRef.current) return;
    const tables = editorRef.current.querySelectorAll("table");
    tables.forEach((table) => {
      const cols = table.querySelectorAll("th, td");
      cols.forEach((col) => {
        if (col.querySelector(".resize-handle")) return;
        const handle = document.createElement("div");
        handle.className = "resize-handle";
        handle.style.cssText =
          "position:absolute;right:0;top:0;width:4px;height:100%;cursor:col-resize;background:transparent;z-index:5";
        (col as HTMLElement).style.position = "relative";
        col.appendChild(handle);

        let startX = 0;
        let startWidth = 0;

        handle.addEventListener("mousedown", (e: MouseEvent) => {
          e.preventDefault();
          startX = e.pageX;
          startWidth = (col as HTMLElement).offsetWidth;

          const onMouseMove = (e: MouseEvent) => {
            const diff = e.pageX - startX;
            (col as HTMLElement).style.width = `${startWidth + diff}px`;
          };
          const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
          };
          document.addEventListener("mousemove", onMouseMove);
          document.addEventListener("mouseup", onMouseUp);
        });
      });
    });
  };

  const insertTable = () => {
    const headerCells = Array(tableCols)
      .fill(0)
      .map(
        (_, i) =>
          `<th style="border:1px solid #333;padding:8px 12px;background:#1a1a1a;color:#f59e0b;text-align:left;font-weight:600">${
            i === 0 ? "항목" : i === 1 ? "값" : "비고"
          }</th>`
      )
      .join("");

    const bodyRows = Array(tableRows)
      .fill(0)
      .map(() => {
        const cells = Array(tableCols)
          .fill(0)
          .map(
            (_, ci) =>
              `<td style="border:1px solid #333;padding:8px 12px;color:#e8e8e8;text-align:${
                ci === 0 ? "left" : "right"
              }">&nbsp;</td>`
          )
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");

    const tableHtml = `
      <div style="position:relative;margin:16px 0" class="table-wrapper">
        <button onclick="this.parentElement.remove()" style="position:absolute;top:-10px;right:-10px;width:20px;height:20px;background:#ef4444;color:#fff;border:none;border-radius:50%;cursor:pointer;font-size:12px;line-height:20px;text-align:center;z-index:10">x</button>
        <table style="width:100%;border-collapse:collapse;table-layout:fixed">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
      <p><br></p>
    `;
    document.execCommand("insertHTML", false, tableHtml);
    setShowTableConfig(false);
    editorRef.current?.focus();
    setTimeout(enableTableResize, 100);
  };

  const insertDivider = () => {
    document.execCommand(
      "insertHTML",
      false,
      '<hr style="border:none;border-top:1px solid #333;margin:16px 0" /><p><br></p>'
    );
    editorRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="community" />

      <main className="w-full px-0">
        {/* Error banner */}
        {error && (
          <div className="mx-6 mt-2 mb-0 rounded border border-[#f87171]/30 bg-[#1a0808] px-4 py-2">
            <p className="text-[11px] font-mono text-[#f87171]">{error}</p>
          </div>
        )}

        {/* Top action bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-card-border bg-background sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={handleExit}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#aaa] hover:text-white transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              {lang === "kr" ? "돌아가기" : "Back"}
            </button>
            {saveTime && (
              <span className="text-[10px] text-[#555]">
                {lang === "kr" ? `임시저장됨 ${saveTime}` : `Draft saved ${saveTime}`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDraft}
              className="px-3 py-1.5 text-xs text-[#aaa] border border-card-border rounded hover:text-white hover:border-[#444] transition-colors"
            >
              {lang === "kr" ? "임시저장" : "Save Draft"}
            </button>
            <button
              onClick={handlePublish}
              disabled={!title.trim() || submitting}
              className="px-5 py-1.5 text-xs font-bold bg-accent text-black rounded hover:opacity-90 transition-opacity disabled:opacity-30"
            >
              {submitting ? "..." : lang === "kr" ? "게시" : "Publish"}
            </button>
          </div>
        </div>

        {/* Title input */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={lang === "kr" ? "제목을 입력하세요" : "Enter title"}
          className="w-full bg-transparent border-b-2 border-card-border text-2xl font-bold text-white placeholder-white/20 outline-none pb-4 mb-0 px-6 pt-4"
          style={{ fontFamily: "'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif" }}
          autoFocus
        />

        {/* Category + subcategory selects */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-card-border">
          <select
            value={category}
            onChange={(e) => {
              const val = e.target.value as MainCategory;
              setCategory(val);
              if (val !== "stock_discussion") setSubcategory("all");
              else setSubcategory("domestic");
            }}
            className="bg-[#1a1a1a] border border-[#333] text-white text-xs px-3 py-1.5 rounded outline-none cursor-pointer"
          >
            {CREATE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c === "stock_discussion"
                  ? lang === "kr" ? "종목 토론방" : "Stock Discussion"
                  : c === "macro"
                  ? lang === "kr" ? "매크로" : "Macro"
                  : lang === "kr" ? "자유" : "Free"}
              </option>
            ))}
          </select>

          {category === "stock_discussion" && (
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value as Subcategory)}
              className="bg-[#1a1a1a] border border-[#333] text-white text-xs px-3 py-1.5 rounded outline-none cursor-pointer"
            >
              {SUBCATEGORIES.filter((s) => s !== "all").map((s) => (
                <option key={s} value={s}>
                  {s === "domestic" ? lang === "kr" ? "국내주식" : "Domestic"
                    : s === "overseas" ? lang === "kr" ? "해외주식" : "Overseas"
                    : s === "crypto" ? lang === "kr" ? "크립토" : "Crypto"
                    : s === "commodity" ? lang === "kr" ? "원자재" : "Commodity"
                    : lang === "kr" ? "채권" : "Bond"}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Toolbar */}
        <div className="border-b border-card-border bg-[#111] px-4 py-2 flex flex-wrap items-center gap-1 sticky top-[49px] z-10">
          <select
            onChange={(e) => {
              execCmd("fontSize", e.target.value);
              e.target.value = "3";
            }}
            defaultValue="3"
            className="bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-[11px] text-white outline-none cursor-pointer mr-1"
          >
            <option value="1">Small</option>
            <option value="3">Normal</option>
            <option value="5">Large</option>
            <option value="7">Title</option>
          </select>

          <TBBtn label="B" bold onClick={() => execCmd("bold")} />
          <TBBtn label="I" italic onClick={() => execCmd("italic")} />

          <div className="w-px h-5 bg-[#333] mx-1" />

          <select
            onChange={(e) => {
              execCmd("fontName", e.target.value);
              e.target.value = "";
            }}
            defaultValue=""
            className="bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-[11px] text-white outline-none cursor-pointer"
          >
            <option value="" disabled>Font</option>
            <option value="system-ui, -apple-system, sans-serif">Sans</option>
            <option value="Georgia, serif">Serif</option>
            <option value="ui-monospace, monospace">Mono</option>
          </select>

          <div className="w-px h-5 bg-[#333] mx-1" />

          <TBBtn label="UL" onClick={() => execCmd("insertUnorderedList")} />
          <TBBtn label="OL" onClick={() => execCmd("insertOrderedList")} />

          {/* Font color palette */}
          <div className="flex items-center gap-0.5 border-l border-white/10 pl-1 ml-1">
            {FONT_COLORS.map((c) => (
              <button
                key={c.color}
                onMouseDown={(e) => {
                  e.preventDefault();
                  execCmd("foreColor", c.color);
                }}
                title={c.label}
                className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition-transform"
                style={{ background: c.color }}
              />
            ))}
          </div>

          <div className="w-px h-5 bg-[#333] mx-1" />

          {/* Table with config popup */}
          <div className="relative">
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                setShowTableConfig((v) => !v);
              }}
              className="px-2 h-7 text-[12px] text-white hover:bg-white/10 rounded transition-colors"
            >
              {lang === "kr" ? "표 삽입" : "Table"}
            </button>
            {showTableConfig && (
              <div className="absolute top-8 left-0 z-20 bg-[#1a1a1a] border border-card-border rounded-lg p-3 shadow-xl min-w-[180px]">
                <div className="text-[11px] text-white font-semibold mb-2">{lang === "kr" ? "표 설정" : "Table Config"}</div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] text-[#aaa] w-8">{lang === "kr" ? "행" : "Row"}</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={tableRows}
                    onChange={(e) => setTableRows(Number(e.target.value))}
                    className="w-16 bg-[#111] border border-card-border text-white text-xs px-2 py-1 rounded outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] text-[#aaa] w-8">{lang === "kr" ? "열" : "Col"}</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={tableCols}
                    onChange={(e) => setTableCols(Number(e.target.value))}
                    className="w-16 bg-[#111] border border-card-border text-white text-xs px-2 py-1 rounded outline-none"
                  />
                </div>
                <button
                  onClick={insertTable}
                  className="w-full py-1.5 text-xs font-bold bg-accent text-white rounded hover:opacity-90"
                >
                  {lang === "kr" ? "삽입" : "Insert"}
                </button>
              </div>
            )}
          </div>

          <TBBtn label="—" onClick={insertDivider} />
        </div>

        {/* contentEditable editor */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="min-h-[calc(100vh-280px)] bg-background px-8 sm:px-16 md:px-24 py-8 outline-none text-white leading-relaxed"
          style={{
            fontSize: "17px",
            lineHeight: "1.9",
            fontFamily: "'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
            caretColor: "#f59e0b",
            maxWidth: "100%",
          }}
          data-placeholder={lang === "kr" ? "내용을 입력하세요..." : "Write your content..."}
        />
      </main>

      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #555;
          pointer-events: none;
          white-space: pre-line;
          font-size: 16px;
          font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
        }
        [contenteditable] { font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; }
        [contenteditable] h1 { font-size: 26px; font-weight: 700; color: #ffffff; margin: 20px 0 10px; line-height: 1.4; }
        [contenteditable] h2 { font-size: 22px; font-weight: 700; color: #f0f0f0; margin: 18px 0 8px; line-height: 1.4; }
        [contenteditable] h3 { font-size: 18px; font-weight: 600; color: #e8e8e8; margin: 14px 0 6px; line-height: 1.4; }
        [contenteditable] p { margin: 8px 0; }
        [contenteditable] blockquote { border-left: 3px solid #f59e0b; padding: 8px 16px; margin: 16px 0; background: #111; color: #aaa; font-style: italic; border-radius: 0 4px 4px 0; }
        [contenteditable] table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        [contenteditable] td, [contenteditable] th { border: 1px solid #333; padding: 8px 12px; }
        [contenteditable] hr { border: none; border-top: 1px solid #333; margin: 24px 0; }
        [contenteditable] ul { list-style: disc; padding-left: 28px; margin: 8px 0; }
        [contenteditable] ol { list-style: decimal; padding-left: 28px; margin: 8px 0; }
        [contenteditable] li { margin: 4px 0; }
        [contenteditable] a { color: #60a5fa; text-decoration: underline; }
      `}</style>
    </div>
  );
}
