"use client";
import { useState } from "react";

interface ShareButtonProps {
  title?: string;
  description?: string;
  url?: string;
}

export default function ShareButton({ title, description, url }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
  const shareTitle = title || "AlphaLab - 한국 투자 플랫폼";
  const shareDesc = description || "실시간 주식 히트맵, 서울 부동산, 매크로 지표를 한 곳에서";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setOpen(false);
  };

  const handleTwitter = () => {
    const text = encodeURIComponent(`${shareTitle}\n${shareDesc}\n${shareUrl}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
    setOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {open && (
        <div className="flex flex-col gap-2 mb-1">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold shadow-lg transition-all"
            style={{ background: "#1a1a1a", border: "1px solid #333", color: "#e8e8e8" }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {copied ? "복사됨!" : "링크 복사"}
          </button>

          <button
            onClick={handleTwitter}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold shadow-lg transition-all"
            style={{ background: "#000000", border: "1px solid #333", color: "#ffffff" }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            X(트위터) 공유
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold shadow-lg transition-all"
            style={{ background: "#FEE500", border: "1px solid #FEE500", color: "#000000" }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3C6.477 3 2 6.477 2 11c0 2.897 1.687 5.416 4.234 6.896L5.25 21l4.234-2.234A11.046 11.046 0 0012 19c5.523 0 10-3.477 10-8S17.523 3 12 3z"/>
            </svg>
            카카오톡 공유
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-center w-12 h-12 rounded-full shadow-xl transition-all duration-200"
        style={{
          background: open ? "#333" : "#f59e0b",
          color: open ? "#e8e8e8" : "#000",
        }}
        aria-label="공유하기"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        )}
      </button>
    </div>
  );
}
