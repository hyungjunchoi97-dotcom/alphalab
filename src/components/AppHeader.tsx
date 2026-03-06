"use client";

import { useState } from "react";
import { useLang, LangToggle } from "@/lib/LangContext";
import HeaderAuth from "@/components/HeaderAuth";
import type { MessageKey } from "@/lib/i18n";

const NAV_ITEMS: { href: string; key: MessageKey }[] = [
  { href: "/", key: "dashboard" },
  { href: "/portfolio", key: "portfolio" },
  { href: "/flow", key: "flow" },
  { href: "/ideas", key: "ideas" },
  { href: "/ai-trading", key: "aiTrading" },
  { href: "/prompts", key: "prompts" },
  { href: "/predictions", key: "predictions" },
  { href: "/community", key: "community" },
];

export default function AppHeader({
  active,
  children,
}: {
  active: string;
  children?: React.ReactNode;
}) {
  const { t } = useLang();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="border-b border-card-border bg-card-bg">
      <div className="mx-auto max-w-[1400px] px-4 py-2.5">
        <div className="flex items-center justify-between">
          {/* Left: logo + desktop nav */}
          <div className="flex items-center gap-4 min-w-0">
            <a href="/" className="shrink-0">
              <h1 className="text-sm font-bold tracking-tight">Alphalab</h1>
              <p className="text-[10px] text-muted">{t("subtitle")}</p>
            </a>

            {/* Desktop nav — .desktop-nav: hidden on mobile, flex on md+ */}
            <nav className="desktop-nav items-center gap-1">
              {NAV_ITEMS.map((item) =>
                item.key === active ? (
                  <span
                    key={item.key}
                    className="rounded bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent"
                  >
                    {t(item.key)}
                  </span>
                ) : (
                  <a
                    key={item.key}
                    href={item.href}
                    className="rounded px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-card-border/30 hover:text-foreground"
                  >
                    {t(item.key)}
                  </a>
                ),
              )}
            </nav>
          </div>

          {/* Right: badges + lang + auth + hamburger */}
          <div className="flex items-center gap-2 shrink-0">
            {children && (
              <div className="desktop-nav items-center gap-2">{children}</div>
            )}
            <LangToggle />
            <HeaderAuth />

            {/* Hamburger — .mobile-hamburger: flex on mobile, hidden on md+ */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="mobile-hamburger ml-1 rounded p-2 text-muted transition-colors hover:bg-card-border/30 items-center justify-center"
              aria-label="Toggle menu"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                {mobileOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown — .mobile-dropdown: block on mobile, hidden on md+ */}
      {mobileOpen && (
        <nav className="mobile-dropdown border-t border-card-border px-4 py-2 space-y-0.5">
          {NAV_ITEMS.map((item) =>
            item.key === active ? (
              <span
                key={item.key}
                className="block rounded bg-accent/15 px-3 py-2.5 text-xs font-medium text-accent"
              >
                {t(item.key)}
              </span>
            ) : (
              <a
                key={item.key}
                href={item.href}
                className="block rounded px-3 py-2.5 text-xs text-muted transition-colors hover:bg-card-border/30 hover:text-foreground"
              >
                {t(item.key)}
              </a>
            ),
          )}
        </nav>
      )}
    </header>
  );
}
