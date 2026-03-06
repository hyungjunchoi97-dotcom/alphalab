"use client";

import { useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

/**
 * Returns a `requireAuth` wrapper.
 * If user is logged in → runs callback immediately.
 * If not → opens AuthModal and stashes callback to run after login.
 */
export function useRequireAuth() {
  const { user, openAuthModal, setPendingAction } = useAuth();

  const requireAuth = useCallback(
    (callback: () => void) => {
      if (user) {
        callback();
      } else {
        setPendingAction(callback);
        openAuthModal();
      }
    },
    [user, openAuthModal, setPendingAction]
  );

  return requireAuth;
}
