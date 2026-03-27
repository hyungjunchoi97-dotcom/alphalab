"use client";

import AppHeader from "@/components/AppHeader";

const S: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" };

const ALERT_CARDS = [
  {
    title: "주식 알림",
    time: "매일 오전 9:30 (평일)",
    items: [
      "전일 거래량 급증 TOP 3 종목",
      "VOLUME SPIKE / BREAKOUT / MOMO 시그널",
      "등락률, 거래량 배수",
    ],
    color: "#3b82f6",
  },
  {
    title: "매크로 브리핑",
    time: "매일 오전 8:00",
    items: [
      "Fear & Greed 지수",
      "나스닥, WTI 유가, 금, 원달러 환율",
      "전일 대비 등락 포함",
    ],
    color: "#f59e0b",
  },
  {
    title: "크립토 브리핑",
    time: "매일 오전 8:00",
    items: [
      "비트코인 가격 + 등락률",
      "주요 뉴스 2개 (한국어 요약)",
    ],
    color: "#8b5cf6",
  },
];

const PREVIEW_MESSAGES = [
  {
    title: "주식 알림 예시",
    text: `AlphaLab 주식 알림 - 2026.03.27

거래량 급증 종목 TOP 3

1. 삼성전자 (005930)
   거래량: 평균 대비 4.2배
   등락률: +3.8%
   시그널: VOLUME SPIKE

2. SK하이닉스 (000660)
   거래량: 평균 대비 3.1배
   등락률: +2.5%
   시그널: BREAKOUT

3. NAVER (035420)
   거래량: 평균 대비 2.8배
   등락률: -1.2%
   시그널: MOMO

thealphalabs.net/ideas`,
  },
  {
    title: "매크로 브리핑 예시",
    text: `AlphaLab 매크로 브리핑 - 2026.03.27

Fear & Greed: 42 (Fear)
나스닥: 18,245 (+0.8%)
WTI 유가: $71.2 (-1.3%)
금: $3,052 (+0.5%)
원달러 환율: 1,432원 (-0.2%)

thealphalabs.net/macro`,
  },
  {
    title: "크립토 브리핑 예시",
    text: `AlphaLab 크립토 브리핑 - 2026.03.27

비트코인: $87,450 (+2.1%)

주요 뉴스

1. 미 SEC, 이더리움 현물 ETF 승인 최종 결정 임박
2. 마이크로스트래티지, 비트코인 1만개 추가 매입

thealphalabs.net/crypto`,
  },
];

const STEPS = [
  { num: "01", text: "아래 버튼을 눌러 텔레그램 봇을 시작하세요" },
  { num: "02", text: "받고 싶은 알림을 선택하세요 (/전체, /주식, /매크로, /크립토)" },
  { num: "03", text: "매일 아침 설정한 알림을 받아보세요" },
];

function CtaButton() {
  return (
    <a
      href="https://t.me/AlphaLabForUserBot"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        ...S, display: "inline-flex", alignItems: "center", gap: 8,
        padding: "12px 28px", borderRadius: 8, fontWeight: 700, fontSize: 14,
        background: "#f59e0b", color: "#000", textDecoration: "none",
        transition: "opacity 0.15s",
      }}
      onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
      onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
      텔레그램으로 구독하기
    </a>
  );
}

export default function NewsletterPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e0e0e0" }}>
      <AppHeader active="newsletter" />
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 16px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h1 style={{ ...S, fontSize: 24, fontWeight: 700, color: "#ffffff", marginBottom: 8 }}>
            AlphaLab 데일리 브리핑
          </h1>
          <p style={{ ...S, fontSize: 13, color: "#9ca3af", marginBottom: 24, lineHeight: 1.6 }}>
            매일 아침 시장 핵심 데이터를 텔레그램으로 받아보세요.
          </p>
          <CtaButton />
        </div>

        {/* Alert cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 48 }}>
          {ALERT_CARDS.map((card) => (
            <div
              key={card.title}
              style={{
                background: "#111", border: "1px solid #1f2937", borderRadius: 8,
                borderTop: `3px solid ${card.color}`, padding: "20px 16px",
              }}
            >
              <h3 style={{ ...S, fontSize: 14, fontWeight: 700, color: "#ffffff", marginBottom: 4 }}>
                {card.title}
              </h3>
              <p style={{ ...S, fontSize: 10, color: card.color, marginBottom: 12 }}>
                {card.time}
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {card.items.map((item, i) => (
                  <li key={i} style={{ ...S, fontSize: 12, color: "#9ca3af", lineHeight: 1.8, paddingLeft: 12, position: "relative" }}>
                    <span style={{ position: "absolute", left: 0, color: "#4b5563" }}>-</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Preview */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ ...S, fontSize: 15, fontWeight: 700, color: "#ffffff", marginBottom: 16, textAlign: "center" }}>
            실제 알림 예시
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {PREVIEW_MESSAGES.map((msg) => (
              <div
                key={msg.title}
                style={{
                  background: "#0d1117", border: "1px solid #1f2937", borderRadius: 8,
                  padding: 16, overflow: "hidden",
                }}
              >
                <p style={{ ...S, fontSize: 10, color: "#6b7280", marginBottom: 8 }}>{msg.title}</p>
                <pre style={{
                  ...S, fontSize: 11, color: "#c8cdd6", lineHeight: 1.6,
                  whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
                }}>
                  {msg.text}
                </pre>
              </div>
            ))}
          </div>
        </div>

        {/* How to use */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ ...S, fontSize: 15, fontWeight: 700, color: "#ffffff", marginBottom: 20, textAlign: "center" }}>
            이용 방법
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480, margin: "0 auto" }}>
            {STEPS.map((step) => (
              <div
                key={step.num}
                style={{ display: "flex", gap: 14, alignItems: "flex-start" }}
              >
                <span style={{
                  ...S, fontSize: 13, fontWeight: 700, color: "#f59e0b",
                  background: "rgba(245,158,11,0.1)", padding: "4px 10px", borderRadius: 6,
                  flexShrink: 0,
                }}>
                  {step.num}
                </span>
                <p style={{ ...S, fontSize: 13, color: "#c8cdd6", lineHeight: 1.6, margin: 0 }}>
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div style={{ textAlign: "center", paddingBottom: 32 }}>
          <CtaButton />
        </div>
      </main>
    </div>
  );
}
