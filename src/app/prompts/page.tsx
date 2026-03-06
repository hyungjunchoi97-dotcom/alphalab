"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/lib/LangContext";
import AppHeader from "@/components/AppHeader";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAuth } from "@/context/AuthContext";

interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  content: string;
  tags: string[];
  author_email: string;
  rating_sum: number;
  rating_count: number;
  use_count: number;
  created_at: string;
  updated_at: string;
}

interface Review {
  id: string;
  prompt_id: string;
  user_id: string;
  rating: number;
  comment: string;
  created_at: string;
}

const CARD =
  "rounded-[12px] border border-card-border bg-card-bg p-4 shadow-[0_1px_2px_rgba(0,0,0,0.3)]";

type SortMode = "topRated" | "mostUsed" | "newest";

function Stars({
  value,
  interactive,
  onChange,
}: {
  value: number;
  interactive?: boolean;
  onChange?: (v: number) => void;
}) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          onClick={() => interactive && onChange?.(s)}
          className={`text-xs ${interactive ? "cursor-pointer" : ""} ${
            s <= Math.round(value) ? "text-yellow-400" : "text-card-border"
          }`}
        >
          ★
        </span>
      ))}
    </span>
  );
}

export default function PromptsPage() {
  const { t } = useLang();
  const { session } = useAuth();
  const requireAuth = useRequireAuth();

  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selected, setSelected] = useState<PromptTemplate | null>(null);
  const [sort, setSort] = useState<SortMode>("topRated");
  const [search, setSearch] = useState("");

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editTags, setEditTags] = useState("");

  // Review form
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  const authHeaders = (): HeadersInit =>
    session?.access_token
      ? { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }
      : { "Content-Type": "application/json" };

  const fetchPrompts = async () => {
    try {
      const res = await fetch("/api/prompts");
      const data = await res.json();
      if (data.ok) setPrompts(data.prompts);
    } catch {
      /* ignore */
    }
  };

  const fetchReviews = async (promptId: string) => {
    try {
      const res = await fetch(`/api/prompts/${promptId}/review`);
      const data = await res.json();
      if (data.ok) setReviews(data.reviews);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  useEffect(() => {
    if (selected) fetchReviews(selected.id);
    else setReviews([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const ratingAvg = (p: PromptTemplate) =>
    p.rating_count > 0 ? p.rating_sum / p.rating_count : 0;

  // Sort & filter
  const sorted = [...prompts]
    .filter(
      (p) =>
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.tags.some((tg) => tg.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => {
      if (sort === "topRated") return ratingAvg(b) - ratingAvg(a) || b.rating_count - a.rating_count;
      if (sort === "mostUsed") return b.use_count - a.use_count;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const handleSelect = (p: PromptTemplate) => {
    setSelected(p);
    setEditing(false);
  };

  const handleNew = async () => {
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ title: "New Prompt", description: "", content: "", tags: [] }),
      });
      const data = await res.json();
      if (data.ok) {
        await fetchPrompts();
        setSelected(data.prompt);
        startEdit(data.prompt);
      }
    } catch {
      /* ignore */
    }
  };

  const startEdit = (p: PromptTemplate) => {
    setEditTitle(p.title);
    setEditDesc(p.description);
    setEditPrompt(p.content);
    setEditTags(p.tags.join(", "));
    setEditing(true);
  };

  const handleSave = async () => {
    if (!selected) return;
    try {
      const res = await fetch("/api/prompts", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          id: selected.id,
          title: editTitle,
          description: editDesc,
          content: editPrompt,
          tags: editTags
            .split(",")
            .map((tg) => tg.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        await fetchPrompts();
        setSelected(data.prompt);
        setEditing(false);
      }
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/prompts?id=${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.ok) {
        await fetchPrompts();
        if (selected?.id === id) setSelected(null);
      }
    } catch {
      /* ignore */
    }
  };

  const handleDuplicate = async (id: string) => {
    const original = prompts.find((p) => p.id === id);
    if (!original) return;
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          title: `${original.title} (Copy)`,
          description: original.description,
          content: original.content,
          tags: original.tags,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        await fetchPrompts();
        setSelected(data.prompt);
      }
    } catch {
      /* ignore */
    }
  };

  const handleAddReview = async () => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/prompts/${selected.id}/review`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ rating: reviewStars, comment: reviewComment }),
      });
      const data = await res.json();
      if (data.ok) {
        await fetchPrompts();
        await fetchReviews(selected.id);
        // Update selected with refreshed data
        setPrompts((prev) => {
          const updated = prev.find((p) => p.id === selected.id);
          if (updated) setSelected(updated);
          return prev;
        });
        setReviewComment("");
        setReviewStars(5);
      }
    } catch {
      /* ignore */
    }
  };

  // Increment use_count (fire-and-forget)
  const handleUse = (id: string) => {
    fetch(`/api/prompts/${id}/use`, { method: "POST" }).catch(() => {});
  };

  const selectedReviews = reviews
    .filter((r) => r.prompt_id === selected?.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="prompts" />

      <main className="mx-auto max-w-[1400px] px-4 py-4 space-y-3">
        {/* Toolbar: sort + search + new */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-px rounded bg-card-border p-px w-fit">
            {(["topRated", "mostUsed", "newest"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setSort(m)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  sort === m
                    ? "bg-accent text-white"
                    : "bg-card-bg text-muted hover:text-foreground"
                }`}
              >
                {m === "topRated" ? "Top Rated" : m === "mostUsed" ? "Most Used" : "Newest"}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search prompts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded border border-card-border bg-background px-2.5 py-1 text-xs text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <button
            onClick={() => requireAuth(handleNew)}
            className="ml-auto rounded bg-accent px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
          >
            + New Prompt
          </button>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          {/* Left: list */}
          <section className={`${CARD} lg:col-span-2 max-h-[calc(100vh-160px)] overflow-y-auto`}>
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Prompt Library
              </h2>
              <span className="ml-auto text-[10px] text-muted">{sorted.length} prompts</span>
            </div>
            <div className="space-y-1.5">
              {sorted.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleSelect(p)}
                  className={`cursor-pointer rounded-lg border px-3 py-2.5 transition-colors ${
                    selected?.id === p.id
                      ? "border-accent/40 bg-accent/10"
                      : "border-card-border/40 hover:bg-card-border/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{p.title}</p>
                      <p className="mt-0.5 text-[10px] text-muted truncate">{p.description || "No description"}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Stars value={ratingAvg(p)} />
                      <p className="mt-0.5 text-[9px] text-muted">
                        {p.use_count} uses · {p.rating_count} reviews
                      </p>
                    </div>
                  </div>
                  {p.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {p.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-accent/15 px-1.5 py-px text-[9px] font-medium text-accent"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {sorted.length === 0 && (
                <p className="py-8 text-center text-[10px] text-muted">
                  No prompts found
                </p>
              )}
            </div>
          </section>

          {/* Right: detail */}
          <section className={`${CARD} lg:col-span-3 max-h-[calc(100vh-160px)] overflow-y-auto`}>
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                Detail
              </h2>
            </div>

            {!selected ? (
              <p className="py-8 text-center text-[10px] text-muted">
                Select a prompt from the list
              </p>
            ) : editing ? (
              /* ── Edit Mode ── */
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted">
                    Title
                  </label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded border border-card-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted">
                    Description
                  </label>
                  <input
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full rounded border border-card-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted">
                    Prompt
                  </label>
                  <textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    rows={6}
                    className="w-full rounded border border-card-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-accent focus:outline-none resize-y"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted">
                    Tags (comma separated)
                  </label>
                  <input
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="scalp, momentum, breakout"
                    className="w-full rounded border border-card-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => requireAuth(handleSave)}
                    className="rounded bg-accent px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="rounded border border-card-border px-4 py-1.5 text-xs text-muted transition-colors hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* ── View Mode ── */
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold">{selected.title}</h3>
                    <p className="mt-0.5 text-[10px] text-muted">
                      by {selected.author_email} · {new Date(selected.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        handleUse(selected.id);
                        startEdit(selected);
                      }}
                      className="rounded border border-card-border px-2 py-0.5 text-[10px] text-muted transition-colors hover:text-foreground"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => requireAuth(() => handleDuplicate(selected.id))}
                      className="rounded border border-card-border px-2 py-0.5 text-[10px] text-muted transition-colors hover:text-foreground"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => requireAuth(() => handleDelete(selected.id))}
                      className="rounded border border-loss/30 px-2 py-0.5 text-[10px] text-loss transition-colors hover:bg-loss/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Description */}
                {selected.description && (
                  <p className="text-xs text-muted">{selected.description}</p>
                )}

                {/* Tags */}
                {selected.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selected.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-accent/15 px-1.5 py-px text-[9px] font-medium text-accent"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded border border-card-border/60 bg-background px-2.5 py-1.5">
                    <p className="text-[9px] uppercase tracking-wider text-muted">Rating</p>
                    <div className="mt-0.5 flex items-center gap-1">
                      <Stars value={ratingAvg(selected)} />
                      <span className="text-[10px] text-muted">
                        ({selected.rating_count})
                      </span>
                    </div>
                  </div>
                  <div className="rounded border border-card-border/60 bg-background px-2.5 py-1.5">
                    <p className="text-[9px] uppercase tracking-wider text-muted">Uses</p>
                    <p className="mt-0.5 text-xs font-medium tabular-nums">{selected.use_count}</p>
                  </div>
                  <div className="rounded border border-card-border/60 bg-background px-2.5 py-1.5">
                    <p className="text-[9px] uppercase tracking-wider text-muted">Updated</p>
                    <p className="mt-0.5 text-[10px] tabular-nums">
                      {new Date(selected.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Prompt text */}
                <div>
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-muted">
                    Prompt
                  </p>
                  <div className="rounded border border-card-border/60 bg-background px-3 py-2">
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                      {selected.content}
                    </p>
                  </div>
                </div>

                {/* Reviews section */}
                <div>
                  <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-muted">
                    Reviews ({selectedReviews.length})
                  </p>

                  {/* Add review form */}
                  <div className="mb-3 rounded border border-card-border/60 bg-background px-3 py-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted">Your rating:</span>
                      <Stars value={reviewStars} interactive onChange={setReviewStars} />
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1 rounded border border-card-border bg-card-bg px-2 py-1 text-xs text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
                      />
                      <button
                        onClick={() => requireAuth(handleAddReview)}
                        className="rounded bg-accent px-3 py-1 text-[10px] font-medium text-white transition-opacity hover:opacity-90"
                      >
                        Submit
                      </button>
                    </div>
                  </div>

                  {/* Review list */}
                  <div className="space-y-2">
                    {selectedReviews.map((r) => (
                      <div
                        key={r.id}
                        className="rounded border border-card-border/40 px-3 py-2"
                      >
                        <div className="flex items-center justify-between">
                          <Stars value={r.rating} />
                          <span className="text-[9px] text-muted">
                            {new Date(r.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {r.comment && (
                          <p className="mt-1 text-[10px] leading-relaxed text-foreground/80">
                            {r.comment}
                          </p>
                        )}
                      </div>
                    ))}
                    {selectedReviews.length === 0 && (
                      <p className="text-center text-[10px] text-muted py-2">
                        No reviews yet
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
