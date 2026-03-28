"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLang } from "@/lib/LangContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import ShareButton from "@/components/ShareButton";
import type { MessageKey } from "@/lib/i18n";

const INPUT =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none";

const ADMIN_EMAIL = "hyungjunchoi97@gmail.com";

const CAT_BADGE_COLOR: Record<string, string> = {
  stock_discussion: "bg-blue-500/20 text-blue-400",
  macro: "bg-cyan-500/20 text-cyan-400",
  free: "bg-gray-500/20 text-gray-400",
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

const CAT_LABEL_MAP: Record<string, MessageKey> = {
  stock_discussion: "catStockDiscussion",
  macro: "catMacroNew",
  free: "catFreeNew",
  stock: "catStock",
  crypto: "catCryptoToken",
  overseas: "catOverseas",
  politics: "catPolitics",
  discussion: "catDiscussion",
  idea: "catIdea",
  question: "catQuestion",
  news: "catNews",
};

const SUB_LABEL_MAP: Record<string, MessageKey> = {
  domestic: "subDomestic",
  overseas: "subOverseas",
  crypto: "subCrypto",
  commodity: "subCommodity",
  bond: "subBond",
};

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

interface Reply {
  id: string;
  post_id: string;
  user_id: string;
  author_email: string | null;
  author_nickname: string | null;
  content: string;
  parent_id: string;
  likes?: number;
  created_at: string;
}

interface CommentWithReplies {
  id: string;
  post_id: string;
  user_id: string;
  author_email: string | null;
  author_nickname: string | null;
  content: string;
  parent_id: null;
  likes?: number;
  created_at: string;
  replies: Reply[];
}

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

type CommentSort = "new" | "popular";

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, lang } = useLang();
  const { session } = useAuth();
  const requireAuth = useRequireAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [liked, setLiked] = useState(false);
  const [commentSort, setCommentSort] = useState<CommentSort>("new");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [imageExpanded, setImageExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const fetchPost = useCallback(async () => {
    try {
      const res = await fetch(`/api/community/posts/${id}`);
      const json = await res.json();
      if (json.ok) setPost(json.post);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [id]);

  const fetchComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/community/posts/${id}/comments?sort=${commentSort}`);
      const json = await res.json();
      if (json.ok) setComments(json.comments);
    } catch { /* */ }
    finally { setCommentsLoading(false); }
  }, [id, commentSort]);

  useEffect(() => { fetchPost(); }, [fetchPost]);
  useEffect(() => { if (id) fetchComments(); }, [fetchComments, id]);

  const handleLike = () => {
    requireAuth(async () => {
      if (!session?.access_token) return;
      try {
        const res = await fetch(`/api/community/posts/${id}/like`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (json.ok) {
          setPost((prev) => prev ? { ...prev, likes: json.likes } : prev);
          setLiked(json.liked);
        }
      } catch { /* */ }
    });
  };

  const submitComment = async (parentId?: string) => {
    const text = parentId ? replyText : commentText;
    if (!text.trim() || !session?.access_token) return;
    setCommentSubmitting(true);
    try {
      const body: Record<string, string> = { content: text.trim() };
      if (parentId) body.parent_id = parentId;
      const res = await fetch(`/api/community/posts/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.ok) {
        if (parentId) {
          // Append reply to the parent comment
          setComments((prev) =>
            prev.map((c) =>
              c.id === parentId
                ? { ...c, replies: [...c.replies, json.comment] }
                : c
            )
          );
          setReplyText("");
          setReplyTo(null);
        } else {
          // Append new top-level comment
          setComments((prev) => [...prev, { ...json.comment, replies: [] }]);
          setCommentText("");
        }
        setPost((prev) => prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev);
      }
    } catch { /* */ }
    finally { setCommentSubmitting(false); }
  };

  const isAdmin = session?.user?.email === ADMIN_EMAIL;
  const canDelete = isAdmin || (session?.user?.email != null && session?.user?.email === post?.author_email);
  console.log("canDelete debug:", { userEmail: session?.user?.email, authorEmail: post?.author_email, isAdmin, canDelete });

  const handleDeletePost = async () => {
    if (!session || !post) return;
    if (!confirm("게시글을 삭제하시겠습니까?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/community/posts/${post.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.ok) router.push("/community");
      else alert(json.error || "삭제 실패");
    } catch { alert("오류가 발생했습니다"); }
    setDeleting(false);
  };

  const startEditing = () => {
    if (!post) return;
    setEditTitle(post.title);
    setEditContent(post.content || "");
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!session || !post) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/community/posts/${post.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      });
      const json = await res.json();
      if (json.ok) {
        setPost(prev => prev ? { ...prev, title: json.post.title, content: json.post.content } : prev);
        setEditing(false);
      } else {
        alert(json.error || "수정 실패");
      }
    } catch { alert("오류가 발생했습니다"); }
    setEditSaving(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!session) return;
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/community/comments/${commentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.ok) fetchComments();
      else alert(json.error || "삭제 실패");
    } catch { alert("오류가 발생했습니다"); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader active="community" />
        <main className="px-4 sm:px-6 py-8">
          <div className="py-16 text-center text-xs text-muted">Loading...</div>
        </main>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader active="community" />
        <main className="px-4 sm:px-6 py-8">
          <div className="py-16 text-center text-sm text-muted">
            {lang === "kr" ? "게시글을 찾을 수 없습니다" : "Post not found"}
          </div>
        </main>
      </div>
    );
  }

  const catLabel = CAT_LABEL_MAP[post.category];
  const subLabel = post.subcategory ? SUB_LABEL_MAP[post.subcategory] : null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="community" />

      <main className="px-4 sm:px-6 py-5 space-y-4">
        {/* Back */}
        <button
          onClick={() => router.push("/community")}
          className="flex items-center gap-1 text-xs text-accent hover:underline"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t("back")}
        </button>

        {/* Post */}
        <div className="rounded-xl border border-card-border bg-card-bg p-5">
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted mb-3">
            <span className={`rounded px-1.5 py-px text-[9px] font-semibold ${CAT_BADGE_COLOR[post.category] || "bg-muted/20 text-muted"}`}>
              {catLabel ? t(catLabel) : post.category}
            </span>
            {subLabel && (
              <span className={`rounded px-1.5 py-px text-[9px] font-medium ${SUB_BADGE_COLOR[post.subcategory!] || "bg-muted/10 text-muted"}`}>
                {t(subLabel)}
              </span>
            )}
            {post.symbol && (
              <span className="rounded bg-accent/10 px-1.5 py-px text-[9px] font-medium text-accent">
                {post.symbol}
              </span>
            )}
            <span>{t("by")} {post.author_nickname || post.author_email?.split("@")[0] || "anon"}</span>
            <span>&middot;</span>
            <span>{timeAgo(post.created_at)}</span>
          </div>

          {editing ? (
            <>
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                maxLength={200}
                style={{
                  width: "100%", fontSize: 16, fontWeight: 700, padding: "8px 12px",
                  background: "#0a0a0a", border: "1px solid #1f2937", borderRadius: 6,
                  color: "#e8e8e8", outline: "none",
                }}
                onFocus={e => e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)"}
                onBlur={e => e.currentTarget.style.borderColor = "#1f2937"}
              />
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                maxLength={50000}
                rows={10}
                style={{
                  width: "100%", fontSize: 14, padding: "8px 12px", marginTop: 8,
                  background: "#0a0a0a", border: "1px solid #1f2937", borderRadius: 6,
                  color: "#e8e8e8", outline: "none", resize: "vertical", lineHeight: 1.7,
                }}
                onFocus={e => e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)"}
                onBlur={e => e.currentTarget.style.borderColor = "#1f2937"}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  onClick={handleSaveEdit}
                  disabled={editSaving || !editTitle.trim()}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: "6px 16px", borderRadius: 4,
                    background: "#f59e0b", color: "#000", border: "none", cursor: "pointer",
                    opacity: editSaving || !editTitle.trim() ? 0.5 : 1,
                  }}
                >
                  {editSaving ? "저장 중..." : "저장"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  style={{
                    fontSize: 12, padding: "6px 16px", borderRadius: 4,
                    background: "transparent", color: "#9ca3af",
                    border: "1px solid #1f2937", cursor: "pointer",
                  }}
                >
                  취소
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-lg font-bold leading-snug">{post.title}</h1>
                {canDelete && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={startEditing}
                      style={{ fontSize: 11, color: "#f59e0b", background: "none", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
                    >
                      수정
                    </button>
                    <button
                      onClick={handleDeletePost}
                      disabled={deleting}
                      style={{ fontSize: 11, color: "#ef4444", background: "none", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
                    >
                      {deleting ? "삭제 중..." : "삭제"}
                    </button>
                  </div>
                )}
              </div>

              {post.content && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{post.content}</p>
              )}
            </>
          )}

          {post.image_url && (
            <div className="mt-4">
              <img
                src={post.image_url}
                alt=""
                onClick={() => setImageExpanded(!imageExpanded)}
                className={`cursor-zoom-in rounded-lg border border-card-border object-cover transition-all ${imageExpanded ? "max-h-none" : "max-h-[300px]"}`}
                style={{ maxWidth: "100%" }}
              />
            </div>
          )}

          <div className="mt-4 flex items-center justify-center gap-3 border-t border-card-border pt-4 pb-1">
            <button
              onClick={handleLike}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 20px", borderRadius: 4, fontSize: 13, fontWeight: 700,
                background: liked ? "rgba(245,158,11,0.15)" : "rgba(245,158,11,0.08)",
                border: liked ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(245,158,11,0.2)",
                color: "#f59e0b", cursor: "pointer", transition: "all 0.15s",
              }}
            >
              추천 {post.likes > 0 && <span style={{ fontVariantNumeric: "tabular-nums" }}>{post.likes}</span>}
            </button>
            <button
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 20px", borderRadius: 4, fontSize: 13, fontWeight: 700,
                background: "rgba(107,114,128,0.08)",
                border: "1px solid rgba(107,114,128,0.2)",
                color: "#6b7280", cursor: "pointer", transition: "all 0.15s",
              }}
            >
              비추천
            </button>
            <span style={{ marginLeft: 8, fontSize: 12, color: "#555" }}>
              {post.commentCount} {t("commComments")}
            </span>
          </div>
        </div>

        {/* Comment input */}
        <div className="rounded-xl border border-card-border bg-card-bg p-4">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={session ? t("commAddComment") : (lang === "kr" ? "로그인 후 댓글을 작성할 수 있습니다" : "Login to comment")}
            rows={3}
            disabled={!session}
            className={`${INPUT} resize-y ${!session ? "opacity-50 cursor-not-allowed" : ""}`}
          />
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => requireAuth(() => submitComment())}
              disabled={!commentText.trim() || commentSubmitting}
              className="rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {t("commSend")}
            </button>
          </div>
        </div>

        {/* Comment sort tabs */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted">
            {lang === "kr" ? "정렬" : "Sort"}:
          </span>
          <div className="flex gap-px rounded-lg bg-card-border p-0.5">
            {(["new", "popular"] as CommentSort[]).map((s) => (
              <button
                key={s}
                onClick={() => setCommentSort(s)}
                className={`rounded-md px-3 py-1 text-[11px] font-medium transition-colors ${
                  commentSort === s
                    ? "bg-card-bg text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {s === "new" ? (lang === "kr" ? "최신순" : "Newest") : (lang === "kr" ? "인기순" : "Popular")}
              </button>
            ))}
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
              <div key={c.id}>
                {/* Top-level comment */}
                <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#e0e0e0", fontWeight: 600 }}>{c.author_nickname || c.author_email?.split("@")[0] || "anon"}</span>
                    <span style={{ fontSize: 12, color: "#888", marginLeft: 6 }}>{timeAgo(c.created_at)}</span>
                  </div>
                  <p style={{ fontSize: 14, color: "#d1d5db", lineHeight: 1.7, marginTop: 6, marginBottom: 0 }}>{c.content}</p>
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center" }}>
                    <button
                      onClick={() => {
                        setReplyTo(replyTo === c.id ? null : c.id);
                        setReplyText("");
                      }}
                      style={{ fontSize: 11, color: "#f59e0b", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      {lang === "kr" ? "답글" : "Reply"}
                    </button>
                    {(session?.user?.email === c.author_email || session?.user?.email === ADMIN_EMAIL) && (
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", marginLeft: 10, padding: 0 }}
                      >
                        삭제
                      </button>
                    )}
                  </div>

                  {/* Reply input (inline under the comment) */}
                  {replyTo === c.id && (
                    <div className="mt-2 pl-4 border-l-2 border-accent/30">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={lang === "kr" ? "답글을 입력하세요..." : "Write a reply..."}
                        rows={2}
                        className={`${INPUT} resize-y text-[11px]`}
                        autoFocus
                      />
                      <div className="mt-1.5 flex justify-end gap-2">
                        <button onClick={() => { setReplyTo(null); setReplyText(""); }} className="text-[10px] text-muted hover:text-foreground">
                          {t("cancel")}
                        </button>
                        <button
                          onClick={() => requireAuth(() => submitComment(c.id))}
                          disabled={!replyText.trim() || commentSubmitting}
                          className="rounded bg-accent px-3 py-1 text-[10px] font-semibold text-white disabled:opacity-40"
                        >
                          {t("commSend")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Nested replies (indented, depth 1 only) */}
                {c.replies.length > 0 && (
                  <div style={{ paddingLeft: 32, marginTop: 6, borderLeft: "1px solid #1f2937" }}>
                    {c.replies.map((reply) => (
                      <div key={reply.id} style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 6, padding: "10px 14px", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "#ffffff", fontWeight: 600 }}>{reply.author_nickname || reply.author_email?.split("@")[0] || "anon"}</span>
                          <span style={{ fontSize: 11, color: "#888888", marginLeft: 6 }}>{timeAgo(reply.created_at)}</span>
                        </div>
                        <p style={{ fontSize: 13, color: "#e0e0e0", lineHeight: 1.7, marginTop: 4, marginBottom: 0 }}>{reply.content}</p>
                        {(session?.user?.email === reply.author_email || session?.user?.email === ADMIN_EMAIL) && (
                          <button
                            onClick={() => handleDeleteComment(reply.id)}
                            style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", marginTop: 4, padding: 0 }}
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </main>

      {/* Full-size image overlay */}
      {imageExpanded && post.image_url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setImageExpanded(false)}
        >
          <img
            src={post.image_url}
            alt=""
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          />
        </div>
      )}
      <ShareButton
        title={post.title}
        description={post.content?.slice(0, 80)}
        url={`https://thealphalabs.net/community/${post.id}`}
      />
    </div>
  );
}
