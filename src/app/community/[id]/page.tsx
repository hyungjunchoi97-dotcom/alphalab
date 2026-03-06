"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLang } from "@/lib/LangContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import type { MessageKey } from "@/lib/i18n";

const INPUT =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-xs text-foreground focus:border-accent focus:outline-none";

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

const CAT_LABEL_MAP: Record<string, MessageKey> = {
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

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  author_email: string | null;
  content: string;
  parent_id: string | null;
  likes?: number;
  created_at: string;
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
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [liked, setLiked] = useState(false);
  const [commentSort, setCommentSort] = useState<CommentSort>("new");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [imageExpanded, setImageExpanded] = useState(false);

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
        setComments((prev) => [...prev, json.comment]);
        if (parentId) { setReplyText(""); setReplyTo(null); }
        else { setCommentText(""); }
        setPost((prev) => prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev);
      }
    } catch { /* */ }
    finally { setCommentSubmitting(false); }
  };

  // Organize comments into top-level and replies
  const topComments = comments.filter((c) => !c.parent_id);
  const replies = comments.filter((c) => c.parent_id);
  const repliesByParent = new Map<string, Comment[]>();
  for (const r of replies) {
    const arr = repliesByParent.get(r.parent_id!) || [];
    arr.push(r);
    repliesByParent.set(r.parent_id!, arr);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader active="community" />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <div className="py-16 text-center text-xs text-muted">Loading...</div>
        </main>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader active="community" />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <div className="py-16 text-center text-sm text-muted">
            {lang === "kr" ? "게시글을 찾을 수 없습니다" : "Post not found"}
          </div>
        </main>
      </div>
    );
  }

  const catLabel = CAT_LABEL_MAP[post.category];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="community" />

      <main className="mx-auto max-w-3xl px-4 py-5 space-y-4">
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
            {post.symbol && (
              <span className="rounded bg-accent/10 px-1.5 py-px text-[9px] font-medium text-accent">
                {post.symbol}
              </span>
            )}
            <span>{t("by")} {post.author_email?.split("@")[0] || "anon"}</span>
            <span>&middot;</span>
            <span>{timeAgo(post.created_at)}</span>
          </div>

          <h1 className="text-lg font-bold leading-snug">{post.title}</h1>

          {post.content && (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{post.content}</p>
          )}

          {/* Image */}
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

          <div className="mt-4 flex items-center gap-3 border-t border-card-border pt-3">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                liked
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-card-border text-muted hover:text-foreground"
              }`}
            >
              <svg className="h-4 w-4" fill={liked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
              {post.likes}
            </button>
            <span className="text-xs text-muted">
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
          ) : topComments.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted">{t("commNoComments")}</p>
          ) : (
            topComments.map((c) => (
              <div key={c.id}>
                {/* Top-level comment */}
                <div className="rounded-xl border border-card-border bg-card-bg p-3">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted">
                    <span className="font-medium text-foreground/80">{c.author_email?.split("@")[0] || "anon"}</span>
                    <span>&middot;</span>
                    <span>{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-foreground/90">{c.content}</p>
                  <button
                    onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                    className="mt-2 text-[10px] text-accent hover:underline"
                  >
                    {lang === "kr" ? "답글" : "Reply"}
                  </button>

                  {/* Reply input */}
                  {replyTo === c.id && (
                    <div className="mt-2 pl-4 border-l-2 border-accent/30">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={lang === "kr" ? "답글을 입력하세요..." : "Write a reply..."}
                        rows={2}
                        className={`${INPUT} resize-y text-[11px]`}
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

                {/* Nested replies */}
                {repliesByParent.get(c.id)?.map((reply) => (
                  <div key={reply.id} className="ml-6 mt-1.5 rounded-xl border border-card-border/60 bg-card-bg/60 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted">
                      <span className="font-medium text-foreground/70">{reply.author_email?.split("@")[0] || "anon"}</span>
                      <span>&middot;</span>
                      <span>{timeAgo(reply.created_at)}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-foreground/80">{reply.content}</p>
                  </div>
                ))}
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
    </div>
  );
}
