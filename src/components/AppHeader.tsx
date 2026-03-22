"use client";

import { useState } from "react";
import { useLang, LangToggle } from "@/lib/LangContext";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/lib/ThemeContext";
import TopTickerBar from "@/components/TopTickerBar";
import type { MessageKey } from "@/lib/i18n";

const NAV_ITEMS: { href: string; key: MessageKey; icon: string }[] = [
  { href: "/", key: "dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/macro", key: "macro", icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/ideas", key: "ideas", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { href: "/realestate", key: "realestate", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { href: "/financials", key: "financials", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
  { href: "/community", key: "community", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
  { href: "/telegram", key: "telegram", icon: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8" },
];

export default function AppHeader({
  active,
}: {
  active: string;
}) {
  const { t } = useLang();
  const { user, loading, openAuthModal, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
          <div className="flex items-center gap-1">
            <LangToggle />
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center w-7 h-7 rounded transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#6b7280" }}
              title={theme === "dark" ? "라이트 모드" : "다크 모드"}
              onMouseEnter={(e) => e.currentTarget.style.color = "#e8e8e8"}
              onMouseLeave={(e) => e.currentTarget.style.color = "#6b7280"}
            >
              {theme === "dark" ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 100 10A5 5 0 0012 7z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
          {loading ? null : user ? (
            <div className="space-y-1">
              <a
                href="/profile"
                className="block text-[10px] truncate transition-colors"
                style={{ color: "#6b7280" }}
                onMouseEnter={(e) => e.currentTarget.style.color = "#f59e0b"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#6b7280"}
              >
                {user.email}
              </a>
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
