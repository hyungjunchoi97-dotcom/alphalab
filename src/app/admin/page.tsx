"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";

const ADMIN_EMAILS = ["hyungjunchoi97@gmail.com"];

interface Post {
  id: string;
  title: string;
  category: string;
  author_email: string;
  created_at: string;
  is_hidden?: boolean;
  is_pinned?: boolean;
}

export default function AdminPage() {
  const { user, session } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ totalPosts: number; totalUsers: number } | null>(null);
  const [activeTab, setActiveTab] = useState<"posts" | "users" | "cache">("posts");

  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);

  useEffect(() => {
    if (!loading && !isAdmin) router.push("/");
  }, [user, loading, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin || !session?.access_token) return;
    fetch("/api/admin/stats", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setPosts(d.recentPosts || []);
          setStats({ totalPosts: d.totalPosts, totalUsers: d.totalUsers });
        }
        setLoading(false);
      });
  }, [isAdmin, session]);

  const handleDeletePost = async (postId: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const res = await fetch("/api/admin/posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ postId }),
    });
    if ((await res.json()).ok) setPosts((p) => p.filter((x) => x.id !== postId));
  };

  const handleToggleHide = async (postId: string, isHidden: boolean) => {
    const res = await fetch("/api/admin/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ postId, action: isHidden ? "unhide" : "hide" }),
    });
    if ((await res.json()).ok) setPosts((p) => p.map((x) => (x.id === postId ? { ...x, is_hidden: !isHidden } : x)));
  };

  const handleClearCache = async (cacheType: string) => {
    let url = "/api/realestate/seoul?refresh=true";
    if (cacheType === "telegram") url = "/api/telegram/feed";
    const res = await fetch(url);
    alert(res.ok ? "캐시 갱신 완료!" : "실패");
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="community" />
      <main className="w-full px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">관리자 대시보드</h1>
          <span className="text-xs text-muted">{user?.email}</span>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "총 게시글", value: stats?.totalPosts ?? "-" },
            { label: "총 유저", value: stats?.totalUsers ?? "-" },
            { label: "오늘 신규", value: posts.filter((p) => new Date(p.created_at).toDateString() === new Date().toDateString()).length },
            { label: "관리자", value: ADMIN_EMAILS.length },
          ].map((s) => (
            <div key={s.label} className="bg-card-bg border border-card-border rounded-lg p-4">
              <div className="text-[11px] text-muted mb-1">{s.label}</div>
              <div className="text-2xl font-bold text-foreground">{s.value}</div>
            </div>
          ))}
        </div>

        {/* 탭 */}
        <div className="flex gap-1 mb-4 border-b border-card-border">
          {(["posts", "users", "cache"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 text-xs font-semibold transition-colors ${activeTab === t ? "text-accent border-b-2 border-accent" : "text-muted"}`}
            >
              {t === "posts" ? "게시글 관리" : t === "users" ? "유저 관리" : "캐시 관리"}
            </button>
          ))}
        </div>

        {/* 게시글 관리 */}
        {activeTab === "posts" && (
          <div className="space-y-2">
            <div className="text-xs text-muted mb-3">최근 게시글 20개</div>
            {posts.map((post) => (
              <div key={post.id} className="flex items-center justify-between bg-card-bg border border-card-border rounded-lg px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {post.is_hidden && <span className="text-[10px] bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded">숨김</span>}
                    {post.is_pinned && <span className="text-[10px] bg-amber-900/30 text-amber-400 px-1.5 py-0.5 rounded">고정</span>}
                    <span className="text-sm text-foreground truncate">{post.title}</span>
                  </div>
                  <div className="text-[11px] text-muted mt-0.5">
                    {post.author_email} · {post.category} · {new Date(post.created_at).toLocaleDateString("ko-KR")}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <button
                    onClick={() => handleToggleHide(post.id, !!post.is_hidden)}
                    className="px-2 py-1 text-[11px] border border-card-border text-muted rounded hover:text-foreground transition-colors"
                  >
                    {post.is_hidden ? "숨김해제" : "숨김"}
                  </button>
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="px-2 py-1 text-[11px] border border-red-800/50 text-red-400 rounded hover:bg-red-900/20 transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 캐시 관리 */}
        {activeTab === "cache" && (
          <div className="space-y-3">
            <div className="text-xs text-muted mb-3">API 캐시를 강제 갱신합니다</div>
            {[
              { label: "서울 부동산 실거래가", key: "seoul" },
              { label: "원자재 데이터", key: "commodities" },
              { label: "텔레그램 피드", key: "telegram" },
            ].map((c) => (
              <div key={c.key} className="flex items-center justify-between bg-card-bg border border-card-border rounded-lg px-4 py-3">
                <span className="text-sm text-foreground">{c.label}</span>
                <button
                  onClick={() => handleClearCache(c.key)}
                  className="px-3 py-1.5 text-xs bg-accent text-white rounded hover:opacity-90 transition-opacity"
                >
                  캐시 갱신
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
