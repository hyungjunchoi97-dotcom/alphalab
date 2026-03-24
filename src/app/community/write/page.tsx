"use client";

import React, { useState, useEffect, useRef } from "react";
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
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#ffffff");
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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

  // Close popups on outside click
  useEffect(() => {
    const handleClick = () => {
      setShowColorPalette(false);
      setShowTableConfig(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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

  const insertImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const id = `img-${Date.now()}`;
      const html = `
        <div id="${id}" style="position:relative;display:inline-block;margin:8px 0;max-width:100%" class="img-wrapper" contenteditable="false">
          <img src="${src}" style="max-width:100%;height:auto;border-radius:4px;display:block" draggable="true" />
          <button onclick="document.getElementById('${id}').remove()" style="position:absolute;top:-8px;right:-8px;width:20px;height:20px;background:#ef4444;color:#fff;border:none;border-radius:50%;cursor:pointer;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;z-index:10">x</button>
        </div>
        <p><br></p>
      `;
      document.execCommand("insertHTML", false, html);
      editorRef.current?.focus();
    };
    reader.readAsDataURL(file);
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

        {/* Word-style Toolbar */}
        <div className="border-b border-[#2a2a2a] bg-[#1a1a1a] sticky top-[49px] z-10 select-none">
          {/* Row 1: Font/Size/Style */}
          <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5 border-b border-[#222]">
            {/* Font select */}
            <select
              onChange={(e) => { execCmd("fontName", e.target.value); e.target.value = ""; }}
              defaultValue=""
              className="bg-[#111] border border-[#333] rounded px-2 py-1 text-[11px] text-white outline-none cursor-pointer w-[100px]"
            >
              <option value="" disabled>{lang === "kr" ? "글꼴" : "Font"}</option>
              <option value="'Noto Sans KR', sans-serif">{lang === "kr" ? "기본" : "Default"}</option>
              <option value="Georgia, serif">{lang === "kr" ? "명조" : "Serif"}</option>
              <option value="ui-monospace, monospace">{lang === "kr" ? "고정폭" : "Mono"}</option>
            </select>

            <div className="w-px h-5 bg-[#333] mx-1" />

            {/* Font size */}
            <select
              onChange={(e) => { execCmd("fontSize", e.target.value); e.target.value = "3"; }}
              defaultValue="3"
              className="bg-[#111] border border-[#333] rounded px-2 py-1 text-[11px] text-white outline-none cursor-pointer w-[70px]"
            >
              <option value="1">10</option>
              <option value="2">12</option>
              <option value="3">14</option>
              <option value="4">18</option>
              <option value="5">24</option>
              <option value="6">32</option>
              <option value="7">48</option>
            </select>

            <div className="w-px h-5 bg-[#333] mx-1" />

            {/* B/I/U/S */}
            {[
              { label: "B", cmd: "bold", style: { fontWeight: "bold" } as React.CSSProperties },
              { label: "I", cmd: "italic", style: { fontStyle: "italic" } as React.CSSProperties },
              { label: "U", cmd: "underline", style: { textDecoration: "underline" } as React.CSSProperties },
              { label: "S", cmd: "strikeThrough", style: { textDecoration: "line-through" } as React.CSSProperties },
            ].map(btn => (
              <button
                key={btn.cmd}
                onMouseDown={(e) => { e.preventDefault(); execCmd(btn.cmd); }}
                className="w-7 h-7 text-[13px] text-[#ccc] hover:bg-[#333] hover:text-white rounded transition-colors flex items-center justify-center"
                style={btn.style}
              >
                {btn.label}
              </button>
            ))}

            <div className="w-px h-5 bg-[#333] mx-1" />

            {/* Font color */}
            <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
              <button
                onMouseDown={(e) => { e.preventDefault(); setShowColorPalette(v => !v); }}
                className="flex flex-col items-center justify-center w-7 h-7 rounded hover:bg-[#333] transition-colors gap-0.5"
              >
                <span className="text-[12px] font-bold text-white" style={{ lineHeight: 1 }}>A</span>
                <div className="w-5 h-1 rounded-sm" style={{ background: selectedColor }} />
              </button>
              {showColorPalette && (
                <div className="absolute top-8 left-0 z-30 bg-[#1a1a1a] border border-[#333] rounded-lg p-2 shadow-xl" style={{ minWidth: 160 }}>
                  <div className="text-[10px] text-[#666] mb-1.5 px-1">{lang === "kr" ? "글자 색상" : "Text color"}</div>
                  <div className="grid grid-cols-6 gap-1">
                    {[
                      "#ffffff", "#f59e0b", "#22c55e", "#ef4444", "#60a5fa", "#a78bfa",
                      "#fb923c", "#34d399", "#f472b6", "#facc15", "#94a3b8", "#ff6b6b",
                      "#e0e0e0", "#fbbf24", "#4ade80", "#f87171", "#93c5fd", "#c4b5fd",
                    ].map(color => (
                      <button
                        key={color}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          execCmd("foreColor", color);
                          setSelectedColor(color);
                          setShowColorPalette(false);
                        }}
                        className="w-6 h-6 rounded border border-white/10 hover:scale-110 transition-transform"
                        style={{ background: color }}
                        title={color}
                      />
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-[#333]">
                    <div className="text-[10px] text-[#666] mb-1.5 px-1">{lang === "kr" ? "형광펜" : "Highlight"}</div>
                    <div className="flex gap-1">
                      {["#f59e0b44", "#22c55e44", "#ef444444", "#60a5fa44", "#a78bfa44"].map(color => (
                        <button
                          key={color}
                          onMouseDown={(e) => { e.preventDefault(); execCmd("hiliteColor", color); setShowColorPalette(false); }}
                          className="w-6 h-6 rounded border border-white/10 hover:scale-110 transition-transform"
                          style={{ background: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-5 bg-[#333] mx-1" />

            {/* Alignment icons */}
            {[
              { cmd: "justifyLeft", icon: (
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <rect x="1" y="2" width="14" height="1.5" rx="0.5"/>
                  <rect x="1" y="5.5" width="10" height="1.5" rx="0.5"/>
                  <rect x="1" y="9" width="14" height="1.5" rx="0.5"/>
                  <rect x="1" y="12.5" width="8" height="1.5" rx="0.5"/>
                </svg>
              )},
              { cmd: "justifyCenter", icon: (
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <rect x="1" y="2" width="14" height="1.5" rx="0.5"/>
                  <rect x="3" y="5.5" width="10" height="1.5" rx="0.5"/>
                  <rect x="1" y="9" width="14" height="1.5" rx="0.5"/>
                  <rect x="4" y="12.5" width="8" height="1.5" rx="0.5"/>
                </svg>
              )},
              { cmd: "justifyRight", icon: (
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <rect x="1" y="2" width="14" height="1.5" rx="0.5"/>
                  <rect x="5" y="5.5" width="10" height="1.5" rx="0.5"/>
                  <rect x="1" y="9" width="14" height="1.5" rx="0.5"/>
                  <rect x="7" y="12.5" width="8" height="1.5" rx="0.5"/>
                </svg>
              )},
            ].map(btn => (
              <button
                key={btn.cmd}
                onMouseDown={(e) => { e.preventDefault(); execCmd(btn.cmd); }}
                className="w-7 h-7 text-[#ccc] hover:bg-[#333] hover:text-white rounded transition-colors flex items-center justify-center"
              >
                {btn.icon}
              </button>
            ))}
          </div>

          {/* Row 2: Headings/Lists/Insert */}
          <div className="flex flex-wrap items-center gap-0.5 px-3 py-1.5">
            {/* Heading styles */}
            {[
              { val: "h1", label: lang === "kr" ? "제목 1" : "H1" },
              { val: "h2", label: lang === "kr" ? "제목 2" : "H2" },
              { val: "h3", label: lang === "kr" ? "제목 3" : "H3" },
              { val: "p", label: lang === "kr" ? "본문" : "Body" },
            ].map(h => (
              <button
                key={h.val}
                onMouseDown={(e) => { e.preventDefault(); execCmd("formatBlock", h.val); }}
                className="px-2.5 h-7 text-[11px] text-[#aaa] hover:bg-[#333] hover:text-white rounded transition-colors"
              >
                {h.label}
              </button>
            ))}

            <div className="w-px h-5 bg-[#333] mx-1" />

            {/* Lists */}
            <button
              onMouseDown={(e) => { e.preventDefault(); execCmd("insertUnorderedList"); }}
              className="w-7 h-7 text-[#ccc] hover:bg-[#333] hover:text-white rounded transition-colors flex items-center justify-center"
              title={lang === "kr" ? "글머리 기호" : "Bullet list"}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <circle cx="2.5" cy="4" r="1.2"/>
                <rect x="5" y="3.2" width="10" height="1.5" rx="0.5"/>
                <circle cx="2.5" cy="8" r="1.2"/>
                <rect x="5" y="7.2" width="10" height="1.5" rx="0.5"/>
                <circle cx="2.5" cy="12" r="1.2"/>
                <rect x="5" y="11.2" width="10" height="1.5" rx="0.5"/>
              </svg>
            </button>
            <button
              onMouseDown={(e) => { e.preventDefault(); execCmd("insertOrderedList"); }}
              className="w-7 h-7 text-[#ccc] hover:bg-[#333] hover:text-white rounded transition-colors flex items-center justify-center"
              title={lang === "kr" ? "번호 매기기" : "Numbered list"}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <text x="0.5" y="5" fontSize="5" fontFamily="monospace">1.</text>
                <rect x="5" y="3.2" width="10" height="1.5" rx="0.5"/>
                <text x="0.5" y="9.5" fontSize="5" fontFamily="monospace">2.</text>
                <rect x="5" y="7.7" width="10" height="1.5" rx="0.5"/>
                <text x="0.5" y="14" fontSize="5" fontFamily="monospace">3.</text>
                <rect x="5" y="12.2" width="10" height="1.5" rx="0.5"/>
              </svg>
            </button>

            <div className="w-px h-5 bg-[#333] mx-1" />

            {/* Table insert */}
            <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
              <button
                onMouseDown={(e) => { e.preventDefault(); setShowTableConfig(v => !v); }}
                className="flex items-center gap-1 px-2.5 h-7 text-[11px] text-[#ccc] hover:bg-[#333] hover:text-white rounded transition-colors"
                title={lang === "kr" ? "표 삽입" : "Insert table"}
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <rect x="1" y="1" width="14" height="14" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2"/>
                  <line x1="1" y1="5" x2="15" y2="5" stroke="currentColor" strokeWidth="1"/>
                  <line x1="1" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="1"/>
                  <line x1="6" y1="1" x2="6" y2="15" stroke="currentColor" strokeWidth="1"/>
                  <line x1="11" y1="1" x2="11" y2="15" stroke="currentColor" strokeWidth="1"/>
                </svg>
                {lang === "kr" ? "표" : "Table"}
              </button>
              {showTableConfig && (
                <div className="absolute top-8 left-0 z-20 bg-[#1a1a1a] border border-[#333] rounded-lg p-3 shadow-xl min-w-[180px]">
                  <div className="text-[11px] text-white font-semibold mb-2">{lang === "kr" ? "표 설정" : "Table Config"}</div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] text-[#aaa] w-8">{lang === "kr" ? "행" : "Row"}</span>
                    <input type="number" min={1} max={20} value={tableRows} onChange={e => setTableRows(Number(e.target.value))}
                      className="w-16 bg-[#111] border border-[#333] text-white text-xs px-2 py-1 rounded outline-none" />
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] text-[#aaa] w-8">{lang === "kr" ? "열" : "Col"}</span>
                    <input type="number" min={1} max={10} value={tableCols} onChange={e => setTableCols(Number(e.target.value))}
                      className="w-16 bg-[#111] border border-[#333] text-white text-xs px-2 py-1 rounded outline-none" />
                  </div>
                  <button onClick={insertTable} className="w-full py-1.5 text-xs font-bold bg-accent text-black rounded hover:opacity-90">
                    {lang === "kr" ? "삽입" : "Insert"}
                  </button>
                </div>
              )}
            </div>

            {/* Image insert */}
            <button
              onMouseDown={(e) => { e.preventDefault(); imageInputRef.current?.click(); }}
              className="flex items-center gap-1 px-2.5 h-7 text-[11px] text-[#ccc] hover:bg-[#333] hover:text-white rounded transition-colors"
              title={lang === "kr" ? "이미지 삽입" : "Insert image"}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-3.5 h-3.5">
                <rect x="1" y="2" width="14" height="12" rx="1.5"/>
                <circle cx="5.5" cy="6" r="1.5"/>
                <path d="M1 11l4-4 3 3 2-2 5 5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {lang === "kr" ? "이미지" : "Image"}
            </button>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) insertImage(file); e.target.value = ""; }} />

            {/* Divider */}
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                document.execCommand("insertHTML", false, `<hr style="border:none;border-top:1px solid #333;margin:16px 0"><p><br></p>`);
                editorRef.current?.focus();
              }}
              className="flex items-center gap-1 px-2.5 h-7 text-[11px] text-[#ccc] hover:bg-[#333] hover:text-white rounded transition-colors"
              title={lang === "kr" ? "구분선" : "Divider"}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <rect x="0" y="7" width="16" height="2" rx="1"/>
                <rect x="0" y="3" width="5" height="1" rx="0.5" opacity="0.4"/>
                <rect x="0" y="12" width="5" height="1" rx="0.5" opacity="0.4"/>
              </svg>
              {lang === "kr" ? "구분선" : "Line"}
            </button>

            <div className="w-px h-5 bg-[#333] mx-1" />

            {/* Undo/Redo */}
            <button onMouseDown={(e) => { e.preventDefault(); execCmd("undo"); }}
              className="w-7 h-7 text-[#ccc] hover:bg-[#333] hover:text-white rounded transition-colors flex items-center justify-center" title={lang === "kr" ? "실행 취소" : "Undo"}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                <path d="M2 6h7a4 4 0 010 8H5" strokeLinecap="round"/>
                <path d="M2 6l3-3M2 6l3 3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button onMouseDown={(e) => { e.preventDefault(); execCmd("redo"); }}
              className="w-7 h-7 text-[#ccc] hover:bg-[#333] hover:text-white rounded transition-colors flex items-center justify-center" title={lang === "kr" ? "다시 실행" : "Redo"}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
                <path d="M14 6H7a4 4 0 000 8h4" strokeLinecap="round"/>
                <path d="M14 6l-3-3M14 6l-3 3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* contentEditable editor */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="min-h-[calc(100vh-320px)] bg-background px-3 sm:px-6 py-8 outline-none text-white leading-relaxed"
          style={{
            fontSize: "17px",
            lineHeight: "1.9",
            fontFamily: "'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
            caretColor: "#f59e0b",
            maxWidth: "100%",
          }}
          data-placeholder={lang === "kr" ? "내용을 입력하세요..." : "Write your content..."}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file && file.type.startsWith("image/")) insertImage(file);
          }}
          onDragOver={(e) => e.preventDefault()}
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
