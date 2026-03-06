"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { messages, type Lang, type MessageKey } from "./i18n";

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: MessageKey) => string;
}

const LangContext = createContext<LangContextValue>({
  lang: "en",
  setLang: () => {},
  t: (key) => messages.en[key],
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("pb_lang");
      if (saved === "en" || saved === "kr") setLangState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("pb_lang", l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: MessageKey) => messages[lang][key],
    [lang]
  );

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="inline-flex gap-px rounded bg-card-border p-px text-[10px]">
      <button
        onClick={() => setLang("en")}
        className={`rounded-sm px-1.5 py-0.5 font-medium transition-colors ${
          lang === "en"
            ? "bg-accent text-white"
            : "bg-card-bg text-muted hover:text-foreground"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLang("kr")}
        className={`rounded-sm px-1.5 py-0.5 font-medium transition-colors ${
          lang === "kr"
            ? "bg-accent text-white"
            : "bg-card-bg text-muted hover:text-foreground"
        }`}
      >
        KR
      </button>
    </div>
  );
}
