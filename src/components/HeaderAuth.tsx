"use client";

import { useAuth } from "@/context/AuthContext";

export default function HeaderAuth() {
  const { user, loading, openAuthModal, logout } = useAuth();

  if (loading) return null;

  if (user) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted truncate max-w-[120px]">
          {user.email}
        </span>
        <button
          onClick={logout}
          className="rounded border border-card-border px-2 py-0.5 text-[10px] text-muted transition-colors hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={openAuthModal}
      className="rounded border border-card-border px-2 py-0.5 text-[10px] text-muted transition-colors hover:text-foreground"
    >
      Sign in
    </button>
  );
}
