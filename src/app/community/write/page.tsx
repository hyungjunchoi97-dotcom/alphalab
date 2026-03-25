"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/LangContext";
import { useAuth } from "@/context/AuthContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";

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

  const [showColorPalette, setShowColorPalette] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#ffffff");
  const [showTableConfig, setShowTableConfig] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [showHrMenu, setShowHrMenu] = useState(false);
  const [showBulletMenu, setShowBulletMenu] = useState(false);
  const [showQuoteMenu, setShowQuoteMenu] = useState(false);
  const [drafts, setDrafts] = useState<{ key: string; title: string; savedAt: string; content: string; category: string; subcategory: string }[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

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
    try {
      const saved = localStorage.getItem("community_drafts");
      if (saved) setDrafts(JSON.parse(saved));
    } catch { /* */ }
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  // Close popups on outside click
  useEffect(() => {
    const h = () => { setShowColorPalette(false); setShowTableConfig(false); setShowHrMenu(false); setShowDrafts(false); setShowBulletMenu(false); setShowQuoteMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  const handleSaveDraft = () => {
    const content = editorRef.current?.innerHTML || "";
    // Save single auto-restore draft
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, content, category, subcategory }));
    // Save to drafts list
    const newDraft = {
      key: Date.now().toString(),
      title: title.trim() || "제목 없음",
      content,
      category,
      subcategory,
      savedAt: new Date().toISOString(),
    };
    const updated = [newDraft, ...drafts].slice(0, 10);
    setDrafts(updated);
    localStorage.setItem("community_drafts", JSON.stringify(updated));
    setSaveTime(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }));
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
    setShowDrafts(true);
  };

  const handleLoadDraft = (draft: typeof drafts[0]) => {
    if (draft.title !== "제목 없음") setTitle(draft.title);
    if (editorRef.current) editorRef.current.innerHTML = draft.content;
    if (CREATE_CATEGORIES.includes(draft.category as MainCategory)) setCategory(draft.category as MainCategory);
    if (draft.subcategory) setSubcategory(draft.subcategory as Subcategory);
    setShowDrafts(false);
    editorRef.current?.focus();
  };

  const handleDeleteDraft = (key: string) => {
    const updated = drafts.filter(d => d.key !== key);
    setDrafts(updated);
    localStorage.setItem("community_drafts", JSON.stringify(updated));
  };

  const draftTimeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "방금";
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    return `${Math.floor(hours / 24)}일 전`;
  };

  const handleExit = () => {
    const content = editorRef.current?.innerText?.trim() || "";
    if (title.trim() || content) {
      if (!window.confirm(lang === "kr" ? "작성 중인 글이 있습니다. 나가시겠습니까?" : "Discard changes?")) return;
    }
    router.push("/community");
  };

  const handlePublish = () => {
    requireAuth(async () => {
      if (!title.trim() || !session?.access_token) return;
      if (category === "stock_discussion" && subcategory === "all") {
        setError(lang === "kr" ? "하위 카테고리를 선택해주세요" : "Subcategory required");
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/community/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            title: title.trim(),
            content: (editorRef.current?.innerText || "").trim(),
            htmlContent: (editorRef.current?.innerHTML || "").trim(),
            category,
            subcategory: category === "stock_discussion" ? subcategory : null,
            symbol: null,
            image_url: null,
          }),
        });
        const json = await res.json();
        if (json.ok) { localStorage.removeItem(DRAFT_KEY); router.push("/community"); }
        else setError(json.error || "게시 실패");
      } catch { setError("네트워크 오류"); }
      finally { setSubmitting(false); }
    });
  };

  const insertTable = () => {
    if (!editorRef.current) return;

    const tableId = `tbl-${Date.now()}`;
    const hCells = Array(tableCols).fill(0).map((_, i) =>
      `<th style="border:1px solid #374151;padding:8px 12px;background:#1f2937;color:#f59e0b;text-align:left;font-weight:600;min-width:80px">${i === 0 ? "항목" : `열 ${i+1}`}</th>`
    ).join("");
    const bRows = Array(tableRows).fill(0).map(() => {
      const cells = Array(tableCols).fill(0).map(() =>
        `<td style="border:1px solid #374151;padding:8px 12px;color:#e0e0e0;min-width:80px">&nbsp;</td>`
      ).join("");
      return `<tr>${cells}</tr>`;
    }).join("");

    const html = `<div id="${tableId}" style="position:relative;margin:16px 0;overflow-x:auto" contenteditable="false">
      <button onclick="document.getElementById('${tableId}').remove()" style="position:absolute;top:-8px;right:-8px;width:20px;height:20px;background:#ef4444;color:#fff;border:none;border-radius:50%;cursor:pointer;font-size:11px;z-index:10;display:flex;align-items:center;justify-content:center;line-height:1">x</button>
      <table id="${tableId}-table" style="width:100%;border-collapse:collapse;table-layout:auto">
        <thead><tr>${hCells}</tr></thead>
        <tbody contenteditable="true">${bRows}</tbody>
      </table>
    </div><p><br></p>`;

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const div = document.createElement("div");
      div.innerHTML = html;
      range.deleteContents();
      const frag = document.createDocumentFragment();
      let node;
      while ((node = div.firstChild)) frag.appendChild(node);
      range.insertNode(frag);
    } else {
      editorRef.current.insertAdjacentHTML("beforeend", html);
    }

    setShowTableConfig(false);
    editorRef.current.focus();
  };

  const insertImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const id = `img-${Date.now()}`;
      document.execCommand("insertHTML", false, `<div id="${id}" style="position:relative;display:inline-block;margin:8px 0;max-width:100%" contenteditable="false"><img src="${src}" style="max-width:100%;height:auto;border-radius:6px;display:block" /><button onclick="document.getElementById('${id}').remove()" style="position:absolute;top:-8px;right:-8px;width:20px;height:20px;background:#ef4444;color:#fff;border:none;border-radius:50%;cursor:pointer;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;z-index:10">x</button></div><p><br></p>`);
      editorRef.current?.focus();
    };
    reader.readAsDataURL(file);
  };

  const insertHr = (style: string) => {
    document.execCommand("insertHTML", false, `<hr style="${style}"><p><br></p>`);
    setShowHrMenu(false);
    editorRef.current?.focus();
  };

  // Toolbar button helper
  const TB = ({ children, onClick, title: t, active }: { children: React.ReactNode; onClick: () => void; title?: string; active?: boolean }) => (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={t}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 32, height: 32, borderRadius: 4, border: "none",
        background: active ? "#2a2a2a" : "transparent", color: "#ccc",
        cursor: "pointer", fontSize: 13, fontFamily: "'IBM Plex Mono', monospace",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#1a1a1a"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
  );

  const Sep = () => <div style={{ width: 1, height: 20, background: "#2a2a2a", margin: "0 3px", flexShrink: 0 }} />;

  const selStyle: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 4,
    padding: "4px 8px", fontSize: 11, color: "#ccc", outline: "none", cursor: "pointer",
    fontFamily: "'IBM Plex Mono', monospace",
  };

  const charCount = editorRef.current?.innerText?.length ?? 0;

  return (
    <div className="md:-ml-56" style={{ width: "100vw", height: "100vh", background: "#0a0a0a", display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div style={{
        height: 48, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", background: "#111", borderBottom: "1px solid #1f2937",
      }}>
        <button onClick={handleExit} style={{ fontSize: 13, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "#fff"}
          onMouseLeave={(e) => e.currentTarget.style.color = "#9ca3af"}
        >
          ← {lang === "kr" ? "뒤로" : "Back"}
        </button>
        <div />
        <div style={{ display: "flex", gap: 8, alignItems: "center", position: "relative" }} onMouseDown={(e) => e.stopPropagation()}>
          <button onClick={handleSaveDraft} style={{ fontSize: 12, color: draftSaved ? "#4ade80" : "#6b7280", background: "none", border: "none", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", transition: "color 0.2s" }}>
            {draftSaved ? (lang === "kr" ? "저장 완료" : "Saved") : (lang === "kr" ? "임시저장" : "Draft")}
          </button>
          <button onClick={handlePublish} disabled={!title.trim() || submitting}
            style={{ fontSize: 13, fontWeight: 700, color: "#000", background: "#f59e0b", border: "none", borderRadius: 4, padding: "6px 16px", cursor: "pointer", opacity: (!title.trim() || submitting) ? 0.4 : 1, fontFamily: "'IBM Plex Mono', monospace" }}>
            {submitting ? "..." : (lang === "kr" ? "게시" : "Publish")}
          </button>

          {/* Drafts panel */}
          {showDrafts && (
            <div style={{
              position: "absolute", top: 40, right: 0, zIndex: 50,
              background: "#111", border: "1px solid #1f2937", borderRadius: 6,
              minWidth: 320, maxHeight: 400, overflowY: "auto",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              fontFamily: "'IBM Plex Mono', monospace",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid #1f2937" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#e0e0e0" }}>임시저장 목록</span>
                <button onClick={() => setShowDrafts(false)} style={{ fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer" }}>X</button>
              </div>
              {drafts.length === 0 ? (
                <div style={{ padding: "24px 14px", textAlign: "center", fontSize: 11, color: "#6b7280" }}>
                  저장된 임시글이 없습니다
                </div>
              ) : (
                drafts.map(draft => (
                  <div key={draft.key} style={{ padding: "10px 14px", borderBottom: "1px solid #1f2937" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#e0e0e0", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {draft.title}
                    </div>
                    <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 6 }}>{draftTimeAgo(draft.savedAt)}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => handleLoadDraft(draft)}
                        style={{ fontSize: 10, color: "#f59e0b", background: "none", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 3, padding: "2px 8px", cursor: "pointer" }}
                      >
                        불러오기
                      </button>
                      <button
                        onClick={() => handleDeleteDraft(draft.key)}
                        style={{ fontSize: 10, color: "#ef4444", background: "none", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 3, padding: "2px 8px", cursor: "pointer" }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Category bar ──────────────────────────────────────── */}
      <div style={{
        height: 40, flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
        padding: "0 16px", background: "#111", borderBottom: "1px solid #1f2937",
      }}>
        <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "'IBM Plex Mono', monospace" }}>{lang === "kr" ? "게시 위치:" : "Post in:"}</span>
        <select value={category} onChange={(e) => { const v = e.target.value as MainCategory; setCategory(v); if (v !== "stock_discussion") setSubcategory("all"); else setSubcategory("domestic"); }} style={selStyle}>
          {CREATE_CATEGORIES.map(c => (
            <option key={c} value={c}>{c === "stock_discussion" ? (lang === "kr" ? "종목토론" : "Stock") : c === "macro" ? (lang === "kr" ? "매크로" : "Macro") : (lang === "kr" ? "자유" : "Free")}</option>
          ))}
        </select>
        {category === "stock_discussion" && (
          <select value={subcategory} onChange={(e) => setSubcategory(e.target.value as Subcategory)} style={selStyle}>
            {SUBCATEGORIES.filter(s => s !== "all").map(s => (
              <option key={s} value={s}>{s === "domestic" ? (lang === "kr" ? "국내" : "KR") : s === "overseas" ? (lang === "kr" ? "해외" : "US") : s === "crypto" ? (lang === "kr" ? "크립토" : "Crypto") : s === "commodity" ? (lang === "kr" ? "원자재" : "Commodity") : (lang === "kr" ? "채권" : "Bond")}</option>
            ))}
          </select>
        )}
        {saveTime && <span style={{ fontSize: 10, color: "#4b5563", fontFamily: "'IBM Plex Mono', monospace", marginLeft: "auto" }}>저장 {saveTime}</span>}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "6px 16px", background: "#1a0808", borderBottom: "1px solid rgba(248,113,113,0.3)" }}>
          <span style={{ fontSize: 11, color: "#f87171", fontFamily: "'IBM Plex Mono', monospace" }}>{error}</span>
        </div>
      )}

      {/* ── Main content area ─────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", background: "#0a0a0a", padding: "24px 16px", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
        <div style={{ width: "100%", maxWidth: 900 }}>

          {/* Writing card */}
          <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 6, overflow: "hidden" }}>

            {/* Title area */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #1f2937" }}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={lang === "kr" ? "제목" : "Title"}
                style={{
                  width: "100%", background: "transparent", border: "none", outline: "none",
                  fontSize: 18, fontWeight: 700, color: "#f0f0f0", padding: 0,
                  fontFamily: "'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
                }}
                autoFocus
              />
            </div>

            {/* Toolbar */}
            <div style={{
              display: "flex", alignItems: "center", gap: 2,
              padding: "6px 8px", background: "#161616", borderBottom: "1px solid #1f2937",
              overflowX: "auto", overflowY: "hidden",
            }}>
              <select onChange={(e) => { exec("fontName", e.target.value); e.target.value = ""; }} defaultValue="" style={{ ...selStyle, width: 80 }}>
                <option value="" disabled>글꼴</option>
                <option value="'Noto Sans KR', sans-serif">나눔고딕</option>
                <option value="'Malgun Gothic', sans-serif">맑은고딕</option>
                <option value="'IBM Plex Mono', monospace">IBM Plex</option>
                <option value="Georgia, serif">명조</option>
              </select>
              <select onChange={(e) => { exec("fontSize", e.target.value); e.target.value = "4"; }} defaultValue="4" style={{ ...selStyle, width: 62 }}>
                <option value="1">10</option><option value="2">12</option><option value="3">14</option>
                <option value="4">18</option><option value="5">24</option><option value="6">32</option>
              </select>
              <Sep />
              <TB onClick={() => exec("bold")}><b>B</b></TB>
              <TB onClick={() => exec("italic")}><i>I</i></TB>
              <TB onClick={() => exec("underline")}><u>U</u></TB>
              <TB onClick={() => exec("strikeThrough")}><s>S</s></TB>
              <Sep />
              <div style={{ position: "relative" }} onMouseDown={(e) => e.stopPropagation()}>
                <TB onClick={() => setShowColorPalette(v => !v)}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1 }}>A</span>
                    <div style={{ width: 16, height: 3, borderRadius: 1, background: selectedColor }} />
                  </div>
                </TB>
                {showColorPalette && (
                  <div style={{ position: "absolute", top: 36, left: 0, zIndex: 50, background: "#1a1a1a", border: "1px solid #555", borderRadius: 8, padding: 10, minWidth: 150, boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>
                    <div style={{ fontSize: 10, color: "#888", marginBottom: 6 }}>글자색</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 3 }}>
                      {["#ffffff", "#e0e0e0", "#fbbf24", "#4ade80", "#f87171", "#93c5fd", "#c4b5fd", "#f97316"].map(c => (
                        <button key={c} onMouseDown={(e) => { e.preventDefault(); exec("foreColor", c); setSelectedColor(c); setShowColorPalette(false); }}
                          style={{ width: 18, height: 18, borderRadius: 3, background: c, border: "1px solid #333", cursor: "pointer" }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: "#888", marginTop: 8, marginBottom: 4 }}>형광펜</div>
                    <div style={{ display: "flex", gap: 3 }}>
                      {["rgba(245,158,11,0.3)", "rgba(74,222,128,0.3)", "rgba(248,113,113,0.3)", "rgba(96,165,250,0.3)", "rgba(167,139,250,0.3)"].map(c => (
                        <button key={c} onMouseDown={(e) => { e.preventDefault(); exec("hiliteColor", c); setShowColorPalette(false); }}
                          style={{ width: 18, height: 18, borderRadius: 3, background: c, border: "1px solid #333", cursor: "pointer" }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Sep />
              <TB onClick={() => exec("justifyLeft")}>
                <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><rect x="1" y="2" width="14" height="1.5" rx=".5"/><rect x="1" y="6" width="10" height="1.5" rx=".5"/><rect x="1" y="10" width="14" height="1.5" rx=".5"/><rect x="1" y="14" width="8" height="1.5" rx=".5"/></svg>
              </TB>
              <TB onClick={() => exec("justifyCenter")}>
                <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><rect x="1" y="2" width="14" height="1.5" rx=".5"/><rect x="3" y="6" width="10" height="1.5" rx=".5"/><rect x="1" y="10" width="14" height="1.5" rx=".5"/><rect x="4" y="14" width="8" height="1.5" rx=".5"/></svg>
              </TB>
              <TB onClick={() => exec("justifyRight")}>
                <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><rect x="1" y="2" width="14" height="1.5" rx=".5"/><rect x="5" y="6" width="10" height="1.5" rx=".5"/><rect x="1" y="10" width="14" height="1.5" rx=".5"/><rect x="7" y="14" width="8" height="1.5" rx=".5"/></svg>
              </TB>
              <Sep />
              {(["h1", "h2", "h3", "p"] as const).map(tag => (
                <TB key={tag} onClick={() => exec("formatBlock", tag)}>
                  <span style={{ fontSize: tag === "p" ? 11 : 12, fontWeight: tag === "p" ? 400 : 700 }}>{tag === "p" ? "P" : tag.toUpperCase()}</span>
                </TB>
              ))}
              <Sep />
              <div style={{ position: "relative" }} onMouseDown={(e) => e.stopPropagation()}>
                <TB onClick={() => setShowBulletMenu(v => !v)} title="목록">
                  <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                    <circle cx="2.5" cy="4" r="1.2"/>
                    <rect x="5" y="3.2" width="10" height="1.5" rx=".5"/>
                    <circle cx="2.5" cy="8" r="1.2"/>
                    <rect x="5" y="7.2" width="10" height="1.5" rx=".5"/>
                    <circle cx="2.5" cy="12" r="1.2"/>
                    <rect x="5" y="11.2" width="10" height="1.5" rx=".5"/>
                  </svg>
                </TB>
                {showBulletMenu && (
                  <div style={{ position: "absolute", top: 36, left: 0, zIndex: 50, background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: 8, minWidth: 160 }}>
                    <div style={{ fontSize: 10, color: "#888", marginBottom: 6, padding: "0 4px" }}>목록 스타일</div>
                    {[
                      { label: "● 채워진 원", style: "disc" },
                      { label: "○ 빈 원", style: "circle" },
                      { label: "■ 채워진 사각형", style: "square" },
                      { label: "→ 화살표", html: `<ul style="list-style:none;padding-left:20px"><li style="padding:2px 0">→ &nbsp;</li></ul>` },
                      { label: "✦ 다이아몬드", html: `<ul style="list-style:none;padding-left:20px"><li style="padding:2px 0">◆ &nbsp;</li></ul>` },
                    ].map((item) => (
                      <button
                        key={item.label}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (item.html) {
                            document.execCommand("insertHTML", false, item.html);
                          } else {
                            document.execCommand("insertUnorderedList");
                            const sel = window.getSelection();
                            if (sel && sel.rangeCount > 0) {
                              const range = sel.getRangeAt(0);
                              const li = range.startContainer.parentElement?.closest("ul");
                              if (li) (li as HTMLElement).style.listStyleType = item.style!;
                            }
                          }
                          setShowBulletMenu(false);
                          editorRef.current?.focus();
                        }}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "5px 8px", background: "transparent", border: "none", color: "#ccc", fontSize: 12, cursor: "pointer", borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#2a2a2a"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Sep />
              <div style={{ position: "relative" }} onMouseDown={(e) => e.stopPropagation()}>
                <TB onClick={() => setShowTableConfig(v => !v)}>
                  <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><rect x="1" y="1" width="14" height="14" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2"/><line x1="1" y1="5" x2="15" y2="5" stroke="currentColor" strokeWidth="1"/><line x1="1" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="1"/><line x1="6" y1="1" x2="6" y2="15" stroke="currentColor" strokeWidth="1"/><line x1="11" y1="1" x2="11" y2="15" stroke="currentColor" strokeWidth="1"/></svg>
                </TB>
                {showTableConfig && (
                  <div style={{ position: "absolute", top: 36, left: 0, zIndex: 20, background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: 12, minWidth: 160 }}>
                    <div style={{ fontSize: 11, color: "#ccc", fontWeight: 600, marginBottom: 8 }}>표 설정</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: "#888", width: 24 }}>행</span>
                      <input type="number" min={1} max={20} value={tableRows} onChange={e => setTableRows(Number(e.target.value))}
                        style={{ width: 50, background: "#111", border: "1px solid #333", color: "#ccc", fontSize: 12, padding: "2px 6px", borderRadius: 4, outline: "none" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: "#888", width: 24 }}>열</span>
                      <input type="number" min={1} max={10} value={tableCols} onChange={e => setTableCols(Number(e.target.value))}
                        style={{ width: 50, background: "#111", border: "1px solid #333", color: "#ccc", fontSize: 12, padding: "2px 6px", borderRadius: 4, outline: "none" }} />
                    </div>
                    <button onClick={insertTable} style={{ width: "100%", padding: "5px 0", fontSize: 12, fontWeight: 700, background: "#f59e0b", color: "#000", border: "none", borderRadius: 4, cursor: "pointer" }}>삽입</button>
                  </div>
                )}
              </div>
              <div style={{ position: "relative" }} onMouseDown={(e) => e.stopPropagation()}>
                <TB onClick={() => setShowQuoteMenu(v => !v)} title="인용구"><span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>&ldquo;</span></TB>
                {showQuoteMenu && (
                  <div style={{ position: "absolute", top: 36, left: 0, zIndex: 50, background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: 8, minWidth: 200 }}>
                    <div style={{ fontSize: 10, color: "#888", marginBottom: 6, padding: "0 4px" }}>인용구 스타일</div>
                    {[
                      {
                        label: "기본 (주황 라인)",
                        html: `<blockquote style="border-left:3px solid #f59e0b;padding:10px 16px;margin:16px 0;background:#161616;color:#bbb;border-radius:0 6px 6px 0"><p><br></p></blockquote><p><br></p>`
                      },
                      {
                        label: "파란 라인",
                        html: `<blockquote style="border-left:3px solid #3b82f6;padding:10px 16px;margin:16px 0;background:#0f172a;color:#93c5fd;border-radius:0 6px 6px 0"><p><br></p></blockquote><p><br></p>`
                      },
                      {
                        label: "초록 (정보)",
                        html: `<blockquote style="border-left:3px solid #22c55e;padding:10px 16px;margin:16px 0;background:#052e16;color:#86efac;border-radius:0 6px 6px 0"><p><br></p></blockquote><p><br></p>`
                      },
                      {
                        label: "빨간 (경고)",
                        html: `<blockquote style="border-left:3px solid #ef4444;padding:10px 16px;margin:16px 0;background:#1c0a0a;color:#fca5a5;border-radius:0 6px 6px 0"><p><br></p></blockquote><p><br></p>`
                      },
                      {
                        label: "박스형",
                        html: `<div style="border:1px solid #374151;border-radius:8px;padding:14px 16px;margin:16px 0;background:#111;color:#e0e0e0"><p><br></p></div><p><br></p>`
                      },
                    ].map((item) => (
                      <button
                        key={item.label}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          document.execCommand("insertHTML", false, item.html);
                          setShowQuoteMenu(false);
                          editorRef.current?.focus();
                        }}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "5px 8px", background: "transparent", border: "none", color: "#ccc", fontSize: 12, cursor: "pointer", borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#2a2a2a"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ position: "relative" }} onMouseDown={(e) => e.stopPropagation()}>
                <TB onClick={() => setShowHrMenu(v => !v)}><span style={{ fontSize: 14, fontWeight: 700 }}>&mdash;</span></TB>
                {showHrMenu && (
                  <div style={{ position: "absolute", top: 36, left: 0, zIndex: 20, background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: 8, minWidth: 140 }}>
                    {[
                      { label: "실선", style: "border:none;border-top:1px solid #333;margin:16px 0" },
                      { label: "점선", style: "border:none;border-top:1px dashed #555;margin:16px 0" },
                      { label: "강조선", style: "border:none;border-top:3px solid #f59e0b;margin:16px 0" },
                    ].map(hr => (
                      <button key={hr.label} onMouseDown={(e) => { e.preventDefault(); insertHr(hr.style); }}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", fontSize: 11, color: "#ccc", background: "none", border: "none", cursor: "pointer", borderRadius: 4 }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#222"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        {hr.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Sep />
              <TB onClick={() => exec("undo")}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14"><path d="M2 6h7a4 4 0 010 8H5" strokeLinecap="round"/><path d="M2 6l3-3M2 6l3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </TB>
              <TB onClick={() => exec("redo")}>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14"><path d="M14 6H7a4 4 0 000 8h4" strokeLinecap="round"/><path d="M14 6l-3-3M14 6l-3 3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </TB>
            </div>

            {/* Editor */}
            <div style={{ padding: "12px 16px" }}>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                style={{
                  minHeight: 500, outline: "none",
                  fontSize: 18, lineHeight: 1.8, color: "#e0e0e0",
                  fontFamily: "'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
                  caretColor: "#f59e0b",
                }}
                data-placeholder={lang === "kr" ? "내용을 입력하세요..." : "Write here..."}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith("image/")) insertImage(f); }}
                onDragOver={(e) => e.preventDefault()}
              />
            </div>

            {/* Bottom bar */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 16px", borderTop: "1px solid #1f2937", background: "#161616",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => imageInputRef.current?.click()}
                  style={{ fontSize: 12, color: "#9ca3af", background: "none", border: "1px solid #2a2a2a", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {lang === "kr" ? "사진 추가" : "Add image"}
                </button>
                <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) insertImage(f); e.target.value = ""; }} />
                <span style={{ fontSize: 10, color: "#4b5563", fontFamily: "'IBM Plex Mono', monospace" }}>{charCount}자</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={handleSaveDraft} style={{ fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {lang === "kr" ? "임시저장" : "Draft"}
                </button>
                <button onClick={handlePublish} disabled={!title.trim() || submitting}
                  style={{ fontSize: 12, fontWeight: 700, color: "#000", background: "#f59e0b", border: "none", borderRadius: 4, padding: "5px 14px", cursor: "pointer", opacity: (!title.trim() || submitting) ? 0.4 : 1, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {submitting ? "..." : (lang === "kr" ? "게시" : "Publish")}
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder); color: #4b5563; pointer-events: none;
          font-size: 15px; font-family: 'Pretendard', sans-serif;
        }
        [contenteditable] h1 { font-size: 24px; font-weight: 700; color: #f0f0f0; margin: 20px 0 10px; line-height: 1.4; }
        [contenteditable] h2 { font-size: 20px; font-weight: 700; color: #e0e0e0; margin: 18px 0 8px; line-height: 1.4; }
        [contenteditable] h3 { font-size: 17px; font-weight: 600; color: #d0d0d0; margin: 14px 0 6px; line-height: 1.4; }
        [contenteditable] p { margin: 8px 0; }
        [contenteditable] blockquote { border-left: 3px solid #f59e0b; padding: 10px 20px; margin: 16px 0; background: #161616; color: #9ca3af; font-style: italic; border-radius: 0 4px 4px 0; }
        [contenteditable] table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        [contenteditable] td, [contenteditable] th { border: 1px solid #2a2a2a; padding: 8px 12px; color: #e0e0e0; }
        [contenteditable] hr { border: none; margin: 20px 0; }
        [contenteditable] ul { list-style: disc; padding-left: 28px; margin: 8px 0; }
        [contenteditable] ol { list-style: decimal; padding-left: 28px; margin: 8px 0; }
        [contenteditable] li { margin: 4px 0; }
        [contenteditable] a { color: #60a5fa; text-decoration: underline; }
        [contenteditable] img { max-width: 100%; border-radius: 6px; margin: 8px 0; }
      `}</style>
    </div>
  );
}
