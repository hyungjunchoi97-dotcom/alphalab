"use client";
import { useState } from "react";

interface ShareButtonProps {
  title?: string;
  description?: string;
  url?: string;
}

export default function ShareButton({ url }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // fallback
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="fixed bottom-4 right-4 z-40 flex items-center justify-center w-9 h-9 rounded-full shadow-xl transition-all duration-200"
      style={{ background: copied ? "#22c55e" : "#f59e0b", color: "#000" }}
      aria-label="링크 복사"
    >
      {copied ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      )}
    </button>
  );
}
