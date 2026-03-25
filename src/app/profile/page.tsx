"use client";

import { useState, useEffect, useRef } from "react";
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

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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

  const handleAvatarChange = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarUrl(e.target?.result as string);
      setAvatarChanged(true);
      setTimeout(() => setAvatarChanged(false), 2000);
    };
    reader.readAsDataURL(file);
  };

  const ADMIN_EMAIL = "hyungjunchoi97@gmail.com";
  const isAdmin = user?.email === ADMIN_EMAIL;

  const displayName = profile?.nickname || email.split("@")[0] || "-";
  const initial = displayName.charAt(0).toUpperCase();

  if (!loading && !user) {
    return null;
  }

  return (
    <div className="min-h-screen" style={{ background: "#080c12", color: "#e8e8e8" }}>
      <AppHeader active="community" />
      <main className="pt-0">
        <div className="max-w-2xl mx-auto px-4 py-8">

          {/* Header */}
          <div className="mb-6 relative" style={{ textAlign: "center" }}>
            <h1 className="text-base font-semibold font-mono tracking-tight" style={{ color: "#e8e8e8" }}>
              MY PROFILE
            </h1>
            <button
              onClick={() => router.push("/community")}
              className="text-xs transition-colors absolute right-0 top-0"
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
              <div className="rounded-lg p-5 mb-4 relative" style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)" }}>
                {/* Edit button - top right */}
                <button
                  onClick={() => { setEditing(!editing); setSaveError(null); }}
                  className="text-xs px-3 py-1.5 rounded transition-all absolute top-4 right-4"
                  style={{
                    background: editing ? "rgba(255,255,255,0.06)" : "transparent",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "#9ca3af",
                  }}
                >
                  {editing ? "취소" : "편집"}
                </button>

                {/* Avatar - centered */}
                <div className="flex flex-col items-center mb-4">
                  <div
                    onClick={() => avatarInputRef.current?.click()}
                    style={{ cursor: "pointer", position: "relative" }}
                    onMouseEnter={(e) => { (e.currentTarget.firstElementChild as HTMLElement).style.filter = "brightness(0.8)"; }}
                    onMouseLeave={(e) => { (e.currentTarget.firstElementChild as HTMLElement).style.filter = "brightness(1)"; }}
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt=""
                        style={{
                          width: 80, height: 80, borderRadius: "50%", objectFit: "cover",
                          border: "2px solid rgba(255,255,255,0.1)", transition: "filter 0.15s",
                        }}
                      />
                    ) : (
                      <div style={{
                        width: 80, height: 80, borderRadius: "50%", background: "#1f2937",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 28, color: "#f59e0b", fontWeight: 700, fontFamily: "monospace",
                        border: "2px solid rgba(255,255,255,0.1)", transition: "filter 0.15s",
                      }}>
                        {initial}
                      </div>
                    )}
                  </div>
                  <div className="text-center mt-1.5">
                    {avatarChanged ? (
                      <span style={{ fontSize: 10, color: "#34d399" }}>변경됨</span>
                    ) : (
                      <span style={{ fontSize: 10, color: "#555" }}>클릭하여 변경</span>
                    )}
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAvatarChange(file);
                      e.target.value = "";
                    }}
                  />
                </div>

                {/* Name & email - centered */}
                <div className="text-center mb-4">
                  <div className="text-lg font-semibold font-mono" style={{ color: "#e8e8e8" }}>
                    {displayName}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "#6b7280" }}>{email}</div>
                </div>

                {profile?.bio && !editing && (
                  <p className="text-sm mb-3 text-center" style={{ color: "#9ca3af" }}>{profile.bio}</p>
                )}

                {/* Stats row */}
                <div className="flex justify-center gap-6">
                  <div className="text-center">
                    <div className="text-lg font-mono font-semibold" style={{ color: "#f59e0b" }}>{posts.length}</div>
                    <div className="text-[10px]" style={{ color: "#6b7280" }}>작성글</div>
                  </div>
                  <div className="text-center">
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

              {isAdmin && (
                <div style={{ marginTop: 24 }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    marginBottom: 12,
                  }}>
                    <h2 style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      관리자
                    </h2>
                    <span style={{ fontSize: 10, color: "#374151", fontFamily: "monospace" }}>
                      {ADMIN_EMAIL}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {[
                      {
                        href: "/admin",
                        title: "관리자 대시보드",
                        desc: "게시글 관리, 유저 통계, 캐시 초기화",
                        icon: (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                            <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                          </svg>
                        )
                      },
                      {
                        href: "/admin/community",
                        title: "커뮤니티 관리",
                        desc: "게시글 숨기기, 고정, 삭제",
                        icon: (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                          </svg>
                        )
                      },
                    ].map((item) => (
                      <button
                        key={item.href}
                        onClick={() => router.push(item.href)}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "12px 0", background: "transparent", border: "none",
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          cursor: "pointer", textAlign: "left", width: "100%",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: 6,
                          background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#f59e0b", flexShrink: 0,
                        }}>
                          {item.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0", marginBottom: 2 }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>{item.desc}</div>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                          <path d="M9 18l6-6-6-6"/>
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
