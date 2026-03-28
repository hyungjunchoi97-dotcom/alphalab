"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";

const S: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" };

interface EligibilityData {
  is_eligible: boolean;
  is_monthly_active: boolean;
  stats: {
    total_posts: number;
    total_comments: number;
    monthly_posts: number;
    monthly_comments: number;
    posts_needed: number;
    comments_needed: number;
  };
}

const CARD_ICONS: Record<string, (color: string) => React.ReactNode> = {
  stock: (c) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="2" x2="18" y2="6"/><line x1="18" y1="10" x2="18" y2="22"/>
      <line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="14"/>
      <rect x="8" y="6" width="8" height="8" rx="1"/><rect x="14" y="10" width="8" height="8" rx="1"/>
    </svg>
  ),
  macro: (c) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  crypto: (c) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9 9h4.5a1.5 1.5 0 010 3H9m4.5 0H9m4.5 0a1.5 1.5 0 010 3H9m1-9v10m3-10v10"/>
    </svg>
  ),
  realestate: (c) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
};

const ALERT_CARDS = [
  {
    icon: "stock",
    title: "주식 알림",
    time: "매일 오전 9:30 (평일)",
    items: ["전일 거래량 급증 TOP 3 종목", "VOLUME SPIKE / BREAKOUT / MOMO 시그널", "등락률, 거래량 배수"],
    color: "#3b82f6",
  },
  {
    icon: "macro",
    title: "매크로 브리핑",
    time: "매일 오전 8:00",
    items: ["Fear & Greed 지수", "나스닥, WTI 유가, 금, 원달러 환율", "전일 대비 등락 포함"],
    color: "#f59e0b",
  },
  {
    icon: "crypto",
    title: "크립토 브리핑",
    time: "매일 오전 8:00",
    items: ["비트코인 가격 + 등락률", "주요 뉴스 2개 (한국어 요약)"],
    color: "#8b5cf6",
  },
  {
    icon: "realestate",
    title: "부동산 브리핑",
    time: "매일 오전 8:00",
    items: ["서울 아파트 주요 거래", "구별 시세 변동", "부동산 관련 주요 뉴스"],
    color: "#10b981",
  },
];


export default function NewsletterPage() {
  const { user, session, loading: authLoading, openAuthModal } = useAuth();

  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);
  const [eligLoading, setEligLoading] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    if (!session?.access_token) return;
    setEligLoading(true);
    fetch("/api/newsletter/eligibility", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(j => { if (j.ok) setEligibility(j); })
      .catch(() => {})
      .finally(() => setEligLoading(false));
  }, [session]);

  const handleGenerateCode = async () => {
    if (!session?.access_token) return;
    setCodeLoading(true);
    try {
      const res = await fetch("/api/newsletter/link-code", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.ok) setLinkCode(json.code);
    } catch { /* */ }
    setCodeLoading(false);
  };

  const handleCopyCode = () => {
    if (!linkCode) return;
    navigator.clipboard.writeText(`/link ${linkCode}`);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e0e0e0" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 640px) {
          .nl-main { padding: 24px 16px !important; }
          .nl-hero h1 { font-size: 28px !important; }
          .nl-cards-grid { grid-template-columns: 1fr !important; }
          .nl-code { font-size: 22px !important; letter-spacing: 0.12em !important; }
          .nl-cta-btn { width: 100%; justify-content: center; }
        }
      ` }} />
      <AppHeader active="newsletter" />

      <main className="nl-main" style={{ maxWidth: "min(800px, 100%)", margin: "0 auto", padding: "48px 24px" }}>

        {/* ── Hero Section ─────────────────────────────────── */}
        <div className="nl-hero" style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            ...S, display: "inline-block", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em",
            color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)",
            padding: "4px 12px", borderRadius: 4, marginBottom: 16, textTransform: "uppercase" as const,
          }}>
            ALPHALAB NEWSLETTER
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: "#ffffff", marginBottom: 12, letterSpacing: "-0.02em" }}>
            데일리 브리핑
          </h1>
          <p style={{ ...S, fontSize: 14, color: "#9ca3af", lineHeight: 1.6 }}>
            매일 아침 시장 핵심 데이터를 텔레그램으로 받아보세요
          </p>
          <div style={{ width: 48, height: 2, background: "#f59e0b", margin: "20px auto 0", borderRadius: 1 }} />
        </div>

        {/* ── Auth / Eligibility Card ────────────────────── */}
        <div style={{ maxWidth: 480, margin: "0 auto 56px" }}>
          {authLoading ? (
            <div style={{ ...S, textAlign: "center", padding: "40px 0", fontSize: 12, color: "#6b7280" }}>
              로딩 중...
            </div>
          ) : !user ? (
            <div style={{
              background: "#111", border: "1px solid #1f2937", borderRadius: 16,
              padding: "40px 32px", textAlign: "center",
            }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>🔒</div>
              <p style={{ ...S, fontSize: 15, color: "#e0e0e0", marginBottom: 8, fontWeight: 600 }}>
                뉴스레터를 이용하려면 로그인이 필요합니다
              </p>
              <p style={{ ...S, fontSize: 12, color: "#6b7280", marginBottom: 24, lineHeight: 1.6 }}>
                AlphaLab 계정으로 로그인한 후 텔레그램과 연결하세요.
              </p>
              <button
                onClick={() => openAuthModal()}
                style={{
                  ...S, fontSize: 14, fontWeight: 700, padding: "12px 32px",
                  borderRadius: 8, border: "none", cursor: "pointer",
                  background: "#f59e0b", color: "#000", transition: "opacity 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
              >
                로그인 / 회원가입
              </button>
            </div>
          ) : eligLoading ? (
            <div style={{ ...S, textAlign: "center", padding: "40px 0", fontSize: 12, color: "#6b7280" }}>
              자격 확인 중...
            </div>
          ) : eligibility && !eligibility.is_eligible ? (
            <div style={{
              background: "#111", border: "1px solid #1f2937", borderRadius: 16,
              padding: "32px",
            }}>
              <h3 style={{ ...S, fontSize: 15, fontWeight: 700, color: "#ffffff", marginBottom: 16 }}>
                뉴스레터 이용 조건
              </h3>
              <p style={{ ...S, fontSize: 12, color: "#9ca3af", marginBottom: 24, lineHeight: 1.7 }}>
                커뮤니티에서 게시글 5개, 댓글 3개를 작성하면 뉴스레터를 이용할 수 있어요.
              </p>

              {/* Posts progress */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ ...S, fontSize: 11, color: "#9ca3af" }}>게시글</span>
                  <span style={{ ...S, fontSize: 11, color: "#9ca3af" }}>
                    {eligibility.stats.total_posts} / 5
                  </span>
                </div>
                <div style={{ height: 6, background: "#1f2937", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 3,
                    background: eligibility.stats.total_posts >= 5 ? "#22c55e" : "#f59e0b",
                    width: `${Math.min(100, (eligibility.stats.total_posts / 5) * 100)}%`,
                    transition: "width 0.3s",
                  }} />
                </div>
              </div>

              {/* Comments progress */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ ...S, fontSize: 11, color: "#9ca3af" }}>댓글</span>
                  <span style={{ ...S, fontSize: 11, color: "#9ca3af" }}>
                    {eligibility.stats.total_comments} / 3
                  </span>
                </div>
                <div style={{ height: 6, background: "#1f2937", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 3,
                    background: eligibility.stats.total_comments >= 3 ? "#22c55e" : "#f59e0b",
                    width: `${Math.min(100, (eligibility.stats.total_comments / 3) * 100)}%`,
                    transition: "width 0.3s",
                  }} />
                </div>
              </div>

              <a
                href="/community"
                style={{
                  ...S, display: "inline-block", fontSize: 13, fontWeight: 600,
                  padding: "10px 24px", borderRadius: 8,
                  background: "rgba(245,158,11,0.1)", color: "#f59e0b",
                  border: "1px solid rgba(245,158,11,0.2)", textDecoration: "none",
                  transition: "background 0.15s",
                }}
              >
                커뮤니티로 이동
              </a>
            </div>
          ) : eligibility && eligibility.is_eligible ? (
            <div style={{
              background: "#111", border: "1px solid #1f2937", borderRadius: 16,
              padding: "32px", textAlign: "center",
            }}>
              <div style={{
                display: "inline-block", padding: "5px 14px", borderRadius: 6,
                background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", marginBottom: 16,
              }}>
                <span style={{ ...S, fontSize: 11, fontWeight: 600, color: "#22c55e" }}>이용 가능</span>
              </div>

              <h3 style={{ ...S, fontSize: 15, fontWeight: 700, color: "#ffffff", marginBottom: 8 }}>
                텔레그램 계정 연결
              </h3>
              <p style={{ ...S, fontSize: 12, color: "#9ca3af", marginBottom: 24, lineHeight: 1.7 }}>
                아래 코드를 발급받아 텔레그램 봇에 입력하세요.
              </p>

              {!linkCode ? (
                <button
                  onClick={handleGenerateCode}
                  disabled={codeLoading}
                  style={{
                    ...S, fontSize: 14, fontWeight: 700, padding: "12px 32px",
                    borderRadius: 8, border: "none", cursor: "pointer",
                    background: "#f59e0b", color: "#000",
                    opacity: codeLoading ? 0.5 : 1,
                  }}
                >
                  {codeLoading ? "발급 중..." : "연결 코드 발급받기"}
                </button>
              ) : (
                <div>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 12,
                    background: "#0d1117", border: "1px solid #1f2937", borderRadius: 12,
                    padding: "20px 28px", marginBottom: 20,
                  }}>
                    <span className="nl-code" style={{ ...S, fontSize: 32, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.2em" }}>
                      {linkCode}
                    </span>
                    <button
                      onClick={handleCopyCode}
                      style={{
                        ...S, fontSize: 11, padding: "6px 14px", borderRadius: 6,
                        background: codeCopied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: codeCopied ? "#22c55e" : "#9ca3af",
                        cursor: "pointer", fontWeight: 600,
                      }}
                    >
                      {codeCopied ? "복사됨" : "복사"}
                    </button>
                  </div>

                  <div style={{ ...S, fontSize: 12, color: "#9ca3af", lineHeight: 2, marginBottom: 16 }}>
                    <p>1. 텔레그램에서 <a href="https://t.me/AlphaLabForUserBot" target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", textDecoration: "underline" }}>@AlphaLabForUserBot</a> 을 열고</p>
                    <p>2. <span style={{ color: "#f59e0b", fontWeight: 600 }}>/link {linkCode}</span> 를 입력하세요</p>
                  </div>

                  <p style={{ ...S, fontSize: 10, color: "#4b5563" }}>
                    코드는 10분간 유효합니다. 만료 시 새로 발급받으세요.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* ── Briefing Cards ─────────────────────────────── */}
        <div style={{ marginBottom: 56 }}>
          <h2 style={{ ...S, fontSize: 13, fontWeight: 700, color: "#6b7280", marginBottom: 20, letterSpacing: "0.05em", textTransform: "uppercase" as const }}>
            구독 채널
          </h2>
          <div className="nl-cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {ALERT_CARDS.map((card) => (
              <div
                key={card.title}
                style={{
                  background: "#111", border: "1px solid #1f2937", borderRadius: 16,
                  borderLeft: `4px solid ${card.color}`, padding: "24px 20px",
                  transition: "border-color 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = card.color}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#1f2937"; e.currentTarget.style.borderLeftColor = card.color; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                    background: `${card.color}26`, flexShrink: 0,
                  }}>
                    {CARD_ICONS[card.icon]?.(card.color)}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", margin: 0 }}>
                      {card.title}
                    </h3>
                    <span style={{
                      ...S, fontSize: 10, fontWeight: 600, color: card.color,
                      background: `${card.color}15`, padding: "2px 8px", borderRadius: 3,
                      display: "inline-block", marginTop: 4,
                    }}>
                      {card.time}
                    </span>
                  </div>
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {card.items.map((item, i) => (
                    <li key={i} style={{ ...S, fontSize: 12, color: "#d1d5db", lineHeight: 2, paddingLeft: 16, position: "relative" }}>
                      <span style={{ position: "absolute", left: 0, color: "#4b5563" }}>•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>


        {/* ── Bottom CTA ─────────────────────────────────── */}
        <div style={{ textAlign: "center", paddingBottom: 48 }}>
          <a
            href="https://t.me/AlphaLabForUserBot"
            target="_blank"
            rel="noopener noreferrer"
            className="nl-cta-btn"
            style={{
              ...S, display: "inline-flex", alignItems: "center", gap: 10,
              padding: "14px 36px", borderRadius: 12, fontWeight: 700, fontSize: 15,
              background: "#f59e0b", color: "#000", textDecoration: "none",
              transition: "opacity 0.15s, transform 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
            텔레그램으로 구독하기
          </a>
          <p style={{ ...S, fontSize: 11, color: "#4b5563", marginTop: 12 }}>
            @AlphaLabForUserBot · 무료
          </p>
        </div>
      </main>
    </div>
  );
}
