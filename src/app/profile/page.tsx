"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";

interface Profile {
  user_id: string;
  nickname: string;
  bio: string | null;
  updated_at: string;
}

interface PostSummary {
  id: string;
  title: string;
  category: string;
  subcategory: string | null;
  created_at: string;
}

const CAT_LABEL: Record<string, string> = {
  stock_discussion: "주식토론",
  macro: "매크로",
  free: "자유",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export default function ProfilePage() {
  const { user, session, loading, openAuthModal } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [likedCount, setLikedCount] = useState(0);
  const [fetching, setFetching] = useState(true);

  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      openAuthModal();
      return;
    }
    if (!session) return;

    (async () => {
      setFetching(true);
      try {
        const res = await fetch("/api/profile", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (json.ok) {
          setProfile(json.profile);
          setEmail(json.email || "");
          setPosts(json.posts || []);
          setLikedCount(json.likedCount || 0);
          if (json.profile) {
            setNickname(json.profile.nickname || "");
            setBio(json.profile.bio || "");
          } else {
            // Default nickname from email prefix
            setNickname(json.email?.split("@")[0] || "");
          }
        }
      } catch { /* */ }
      setFetching(false);
    })();
  }, [loading, user, session, openAuthModal]);

  const handleSave = async () => {
    if (!session) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ nickname, bio }),
      });
      const json = await res.json();
      if (json.ok) {
        setProfile(json.profile);
        setSaveOk(true);
        setEditing(false);
        setTimeout(() => setSaveOk(false), 3000);
      } else {
        setSaveError(json.error || "저장 실패");
      }
    } catch {
      setSaveError("네트워크 오류");
    }
    setSaving(false);
  };

  if (!loading && !user) {
    return null;
  }

  return (
    <div className="min-h-screen" style={{ background: "#080c12", color: "#e8e8e8" }}>
      <AppHeader active="community" />
      <main className="md:pl-56 pt-0">
        <div className="max-w-2xl mx-auto px-4 py-8">

          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-base font-semibold font-mono tracking-tight" style={{ color: "#e8e8e8" }}>
              MY PROFILE
            </h1>
            <button
              onClick={() => router.push("/community")}
              className="text-xs transition-colors"
              style={{ color: "#6b7280" }}
              onMouseEnter={(e) => e.currentTarget.style.color = "#e8e8e8"}
              onMouseLeave={(e) => e.currentTarget.style.color = "#6b7280"}
            >
              커뮤니티로
            </button>
          </div>

          {fetching ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: "#333", borderTopColor: "#f59e0b" }} />
            </div>
          ) : (
            <>
              {/* Profile card */}
              <div className="rounded-lg p-5 mb-4" style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-lg font-semibold font-mono" style={{ color: "#e8e8e8" }}>
                      {profile?.nickname || email.split("@")[0] || "-"}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "#6b7280" }}>{email}</div>
                  </div>
                  <button
                    onClick={() => { setEditing(!editing); setSaveError(null); }}
                    className="text-xs px-3 py-1.5 rounded transition-all"
                    style={{
                      background: editing ? "rgba(255,255,255,0.06)" : "transparent",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#9ca3af",
                    }}
                  >
                    {editing ? "취소" : "편집"}
                  </button>
                </div>

                {profile?.bio && !editing && (
                  <p className="text-sm mb-3" style={{ color: "#9ca3af" }}>{profile.bio}</p>
                )}

                {/* Stats row */}
                <div className="flex gap-6">
                  <div>
                    <div className="text-lg font-mono font-semibold" style={{ color: "#f59e0b" }}>{posts.length}</div>
                    <div className="text-[10px]" style={{ color: "#6b7280" }}>작성글</div>
                  </div>
                  <div>
                    <div className="text-lg font-mono font-semibold" style={{ color: "#6b7280" }}>{likedCount}</div>
                    <div className="text-[10px]" style={{ color: "#6b7280" }}>좋아요한 글</div>
                  </div>
                </div>
              </div>

              {/* Edit form */}
              {editing && (
                <div className="rounded-lg p-5 mb-4" style={{ background: "#0d1117", border: "1px solid rgba(245,158,11,0.2)" }}>
                  <div className="mb-3">
                    <label className="text-xs mb-1 block" style={{ color: "#9ca3af" }}>닉네임 <span style={{ color: "#6b7280" }}>(2~20자, 한글/영문/숫자/_- 허용)</span></label>
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      maxLength={20}
                      className="w-full px-3 py-2 rounded text-sm font-mono outline-none transition-colors"
                      style={{
                        background: "#080c12",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#e8e8e8",
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}
                    />
                  </div>
                  <div className="mb-4">
                    <label className="text-xs mb-1 block" style={{ color: "#9ca3af" }}>소개 <span style={{ color: "#6b7280" }}>(200자 이내, 선택)</span></label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={200}
                      rows={3}
                      className="w-full px-3 py-2 rounded text-sm outline-none resize-none transition-colors"
                      style={{
                        background: "#080c12",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#e8e8e8",
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = "rgba(245,158,11,0.4)"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"}
                    />
                    <div className="text-right text-[10px] mt-0.5" style={{ color: "#6b7280" }}>{bio.length}/200</div>
                  </div>

                  {saveError && (
                    <p className="text-xs mb-3" style={{ color: "#f87171" }}>{saveError}</p>
                  )}

                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded text-xs font-semibold transition-opacity"
                    style={{ background: "#f59e0b", color: "#000", opacity: saving ? 0.6 : 1 }}
                  >
                    {saving ? "저장 중..." : "저장"}
                  </button>
                </div>
              )}

              {saveOk && (
                <div className="mb-4 px-4 py-2 rounded text-xs" style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
                  프로필이 저장되었습니다.
                </div>
              )}

              {/* Post history */}
              <div>
                <h2 className="text-xs font-semibold mb-3 font-mono" style={{ color: "#6b7280" }}>
                  작성한 글 ({posts.length})
                </h2>
                {posts.length === 0 ? (
                  <p className="text-xs py-6 text-center" style={{ color: "#4b5563" }}>아직 작성한 글이 없습니다.</p>
                ) : (
                  <div className="space-y-0">
                    {posts.map((post) => (
                      <button
                        key={post.id}
                        onClick={() => router.push(`/community?post=${post.id}`)}
                        className="w-full text-left flex items-center justify-between py-3 transition-colors"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="shrink-0 text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa" }}
                          >
                            {CAT_LABEL[post.category] || post.category}
                          </span>
                          <span className="text-sm truncate" style={{ color: "#d1d5db" }}>{post.title}</span>
                        </div>
                        <span className="shrink-0 text-[10px] ml-3" style={{ color: "#4b5563" }}>{timeAgo(post.created_at)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
