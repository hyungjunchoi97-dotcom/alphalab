"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";

interface Post {
  id: string;
  title: string;
  author_email: string | null;
  category: string;
  created_at: string;
  is_hidden: boolean;
  is_pinned: boolean;
}

const CAT_LABEL: Record<string, string> = {
  stock_discussion: "종목토론",
  macro: "매크로",
  free: "자유",
};

const AUTH_KEY = "alphalab_admin_auth";

export default function AdminCommunityPage() {
  const { session } = useAuth();

  const [authed, setAuthed] = useState(false);
  const [storedPin, setStoredPin] = useState("");
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(AUTH_KEY);
    if (saved) {
      setStoredPin(saved);
      setAuthed(true);
    }
  }, []);

  const handleAuth = async () => {
    if (!pin.trim()) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const json = await res.json();
      if (json.ok) {
        localStorage.setItem(AUTH_KEY, pin);
        setStoredPin(pin);
        setAuthed(true);
        setPin("");
      } else {
        setAuthError(json.error || "인증 실패");
      }
    } catch {
      setAuthError("네트워크 오류");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    setAuthed(false);
    setStoredPin("");
    setPosts([]);
  };

  const fetchPosts = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.ok) setPosts(json.recentPosts || []);
    } catch { /* */ }
    setLoading(false);
  }, [session]);

  useEffect(() => {
    if (authed && session) fetchPosts();
  }, [authed, session, fetchPosts]);

  const handleDelete = async (postId: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    if (!session?.access_token) return;
    try {
      const res = await fetch("/api/admin/posts", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ postId, pin: storedPin }),
      });
      const json = await res.json();
      if (json.ok) setPosts(prev => prev.filter(p => p.id !== postId));
    } catch { /* */ }
  };

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, padding: 32, width: 320 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", marginBottom: 16, fontFamily: "monospace" }}>관리자 인증</div>
          <input type="password" placeholder="PIN 입력" value={pin} onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAuth()}
            style={{ width: "100%", background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 4, padding: "8px 12px", color: "#e0e0e0", fontSize: 13, outline: "none", marginBottom: 12 }} />
          {authError && <div style={{ fontSize: 11, color: "#ef4444", marginBottom: 8 }}>{authError}</div>}
          <button onClick={handleAuth} disabled={authLoading}
            style={{ width: "100%", background: "#f59e0b", color: "#000", border: "none", borderRadius: 4, padding: "8px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {authLoading ? "..." : "로그인"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e0e0e0" }}>
      <AppHeader active="community" />
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: "#f59e0b", fontFamily: "'IBM Plex Mono', monospace" }}>
              커뮤니티 관리
            </h1>
            <span style={{ fontSize: 11, color: "#6b7280", fontFamily: "monospace" }}>
              {posts.length}개 게시글
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={fetchPosts} disabled={loading}
              style={{ fontSize: 11, color: "#9ca3af", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 4, padding: "5px 12px", cursor: "pointer", fontFamily: "monospace", opacity: loading ? 0.5 : 1 }}>
              {loading ? "..." : "새로고침"}
            </button>
            <button onClick={handleLogout}
              style={{ fontSize: 11, color: "#ef4444", background: "transparent", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 4, padding: "5px 12px", cursor: "pointer", fontFamily: "monospace" }}>
              로그아웃
            </button>
          </div>
        </div>

        {/* Posts table */}
        <div style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 8, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1f2937" }}>
                {["제목", "작성자", "카테고리", "날짜", "상태", "액션"].map(h => (
                  <th key={h} style={{
                    padding: "10px 12px", textAlign: h === "액션" ? "right" : "left",
                    fontSize: 10, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "40px 12px", textAlign: "center", color: "#4b5563", fontSize: 11 }}>
                    {loading ? "로딩 중..." : "게시글이 없습니다"}
                  </td>
                </tr>
              ) : posts.map(post => (
                <tr key={post.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "10px 12px", color: "#d1d5db", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {post.title.length > 30 ? post.title.slice(0, 30) + "..." : post.title}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#9ca3af" }}>
                    {post.author_email?.split("@")[0] || "-"}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      fontSize: 10, padding: "2px 6px", borderRadius: 3,
                      background: "rgba(59,130,246,0.15)", color: "#60a5fa",
                    }}>
                      {CAT_LABEL[post.category] || post.category}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#6b7280", fontVariantNumeric: "tabular-nums" }}>
                    {new Date(post.created_at).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {post.is_hidden ? (
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: "rgba(239,68,68,0.15)", color: "#f87171" }}>숨김</span>
                    ) : post.is_pinned ? (
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>고정</span>
                    ) : (
                      <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: "rgba(34,197,94,0.15)", color: "#4ade80" }}>공개</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    <button onClick={() => handleDelete(post.id)}
                      style={{
                        fontSize: 10, color: "#ef4444", background: "transparent",
                        border: "1px solid rgba(239,68,68,0.3)", borderRadius: 3,
                        padding: "3px 8px", cursor: "pointer", fontFamily: "monospace",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.1)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
