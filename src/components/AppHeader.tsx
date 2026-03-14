"use client";

import { useState } from "react";
import { useLang, LangToggle } from "@/lib/LangContext";
import { useAuth } from "@/context/AuthContext";
import TopTickerBar from "@/components/TopTickerBar";
import type { MessageKey } from "@/lib/i18n";

const NAV_ITEMS: { href: string; key: MessageKey; icon: string }[] = [
  { href: "/", key: "dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/macro", key: "macro", icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/macro-pro", key: "macroPro", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { href: "/ideas", key: "ideas", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { href: "/realestate", key: "realestate", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { href: "/financials", key: "financials", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
  { href: "/ai-trading", key: "aiTrading", icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { href: "/community", key: "community", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
  { href: "/telegram", key: "telegram", icon: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8" },
  { href: "/gurus", key: "gurus", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
];

export default function AppHeader({
  active,
}: {
  active: string;
}) {
  const { t } = useLang();
  const { user, loading, openAuthModal, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLink = (item: typeof NAV_ITEMS[number], isMobile?: boolean) => {
    const isActive = item.key === active;
    const baseClass = isMobile
      ? "flex items-center gap-3 rounded-md px-3 py-2.5 text-xs transition-colors"
      : "flex items-center gap-3 rounded-md px-3 py-2 text-[11px] transition-colors";

    return (
      <a
        key={item.key}
        href={item.href}
        className={baseClass}
        style={{
          background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
          color: isActive ? "#e8e8e8" : "#9ca3af",
        }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = "#e8e8e8"; }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = "#9ca3af"; }}
      >
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
        </svg>
        <span>{t(item.key)}</span>
      </a>
    );
  };

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className="fixed left-0 top-0 z-40 hidden h-screen w-56 flex-col md:flex"
        style={{ background: "#0d1117", borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Logo */}
        <div className="px-4 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <a href="/" className="block">
            <h1 className="text-sm font-bold tracking-tight font-mono">
              <span style={{ color: "#f59e0b" }}>α</span>
              <span style={{ color: "#e8e8e8" }}>lpha</span>
              <span style={{ color: "#6b7280" }}>lab</span>
            </h1>
          </a>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => navLink(item))}
        </nav>

        {/* Bottom: lang toggle + auth */}
        <div className="px-3 py-3 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <LangToggle />
          {loading ? null : user ? (
            <div className="space-y-1">
              <p className="text-[10px] truncate" style={{ color: "#6b7280" }}>{user.email}</p>
              <button
                onClick={logout}
                className="text-[10px] transition-colors"
                style={{ color: "#9ca3af" }}
                onMouseEnter={(e) => e.currentTarget.style.color = "#e8e8e8"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#9ca3af"}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={openAuthModal}
              className="text-[10px] transition-colors"
              style={{ color: "#9ca3af" }}
              onMouseEnter={(e) => e.currentTarget.style.color = "#e8e8e8"}
              onMouseLeave={(e) => e.currentTarget.style.color = "#9ca3af"}
            >
              Sign in
            </button>
          )}
        </div>
      </aside>

      {/* ── Desktop: ticker bar ── */}
      <div className="hidden md:block sticky top-0 z-30">
        <TopTickerBar />
      </div>

      {/* ── Mobile header ── */}
      <div className="md:hidden sticky top-0 z-50">
        <TopTickerBar />
        <header style={{ background: "#0d1117", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between px-4 py-2.5">
            <a href="/">
              <h1 className="text-sm font-bold tracking-tight font-mono">
                <span style={{ color: "#f59e0b" }}>α</span>
                <span style={{ color: "#e8e8e8" }}>lpha</span>
                <span style={{ color: "#6b7280" }}>lab</span>
              </h1>
            </a>
            <div className="flex items-center gap-2">
              <LangToggle />
              <button
                onClick={() => setMobileOpen((v) => !v)}
                className="rounded p-2 transition-colors"
                style={{ color: "#9ca3af" }}
                aria-label="Toggle menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {mobileOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {mobileOpen && (
            <nav className="px-3 py-2 space-y-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              {NAV_ITEMS.map((item) => navLink(item, true))}
              <div className="pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {loading ? null : user ? (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-[10px] truncate" style={{ color: "#6b7280" }}>{user.email}</span>
                    <button onClick={logout} className="text-[10px]" style={{ color: "#9ca3af" }}>Sign out</button>
                  </div>
                ) : (
                  <button onClick={openAuthModal} className="px-3 py-2 text-[10px]" style={{ color: "#9ca3af" }}>
                    Sign in
                  </button>
                )}
              </div>
            </nav>
          )}
        </header>
      </div>
    </>
  );
}
