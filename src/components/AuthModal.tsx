"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function AuthModal() {
  const {
    authModalOpen,
    closeAuthModal,
    loginWithEmail,
    signUp,
    loginWithGoogle,
  } = useAuth();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  if (!authModalOpen) return null;

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);
    setSignupSuccess(false);

    const err =
      mode === "login"
        ? await loginWithEmail(email, password)
        : await signUp(email, password);

    setLoading(false);

    if (err) {
      setError(err);
    } else if (mode === "signup") {
      setSignupSuccess(true);
    } else {
      // login success — context will close modal via pendingAction
      reset();
      closeAuthModal();
    }
  };

  const handleGoogle = async () => {
    setError(null);
    const err = await loginWithGoogle();
    if (err) setError(err);
  };

  const reset = () => {
    setEmail("");
    setPassword("");
    setError(null);
    setSignupSuccess(false);
  };

  const handleClose = () => {
    reset();
    closeAuthModal();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-sm rounded-[12px] border border-card-border bg-card-bg p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold">
            {mode === "login" ? "Sign In" : "Create Account"}
          </h2>
          <button
            onClick={handleClose}
            className="text-muted transition-colors hover:text-foreground text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {signupSuccess ? (
          <div className="space-y-3">
            <div className="rounded border border-gain/30 bg-gain/10 px-3 py-2 text-xs text-gain">
              Account created! Check your email to confirm, then sign in.
            </div>
            <button
              onClick={() => {
                setMode("login");
                setSignupSuccess(false);
              }}
              className="w-full rounded bg-accent px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
            >
              Go to Sign In
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Email */}
            <div>
              <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="you@example.com"
                className="w-full rounded border border-card-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-muted">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="••••••••"
                className="w-full rounded border border-card-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded border border-loss/30 bg-loss/10 px-3 py-2 text-[10px] text-loss">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!email || !password || loading}
              className="w-full rounded bg-accent px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Sign In"
                  : "Sign Up"}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-card-border" />
              <span className="text-[9px] uppercase text-muted">or</span>
              <div className="h-px flex-1 bg-card-border" />
            </div>

            {/* Google */}
            <button
              onClick={handleGoogle}
              className="w-full rounded border border-card-border px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-card-border/30"
            >
              Continue with Google
            </button>

            {/* Toggle mode */}
            <p className="text-center text-[10px] text-muted">
              {mode === "login" ? (
                <>
                  No account?{" "}
                  <button
                    onClick={() => {
                      setMode("signup");
                      setError(null);
                    }}
                    className="text-accent hover:underline"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    onClick={() => {
                      setMode("login");
                      setError(null);
                    }}
                    className="text-accent hover:underline"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
