"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppLanguage } from "../../lib/i18n";
import { defaultLlm, llmFingerprint, llmStatus, LlmState, parseLlm } from "../../lib/llm/state";

const LLM_KEY = "silly-factory-llm";
const LANG_KEY = "silly-factory-lang";

let memoryLlm: LlmState | null = null;
let memoryLang: AppLanguage | null = null;
let memoryOk = "";

function testedPrintOf(parsed: Record<string, unknown>, llm: LlmState) {
  if (typeof parsed.testedPrint === "string") return parsed.testedPrint;
  if (parsed.tested === true && llm.apiKey.trim()) return llmFingerprint(llm);
  return "";
}

function livePrint(llm: LlmState) {
  return memoryOk && memoryOk === llmFingerprint(llm) ? memoryOk : "";
}

function readStoredLlm(): { llm: LlmState; ok: string } {
  if (typeof window === "undefined") return { llm: defaultLlm(), ok: "" };
  try {
    const raw = localStorage.getItem(LLM_KEY);
    if (!raw) return { llm: memoryLlm || defaultLlm(), ok: livePrint(memoryLlm || defaultLlm()) };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const llm = parseLlm(parsed);
    memoryLlm = llm;
    memoryOk = testedPrintOf(parsed, llm);
    return { llm, ok: livePrint(llm) };
  } catch {
    return { llm: memoryLlm || defaultLlm(), ok: livePrint(memoryLlm || defaultLlm()) };
  }
}

function writeStoredLlm(llm: LlmState) {
  memoryLlm = llm;
  if (typeof window === "undefined") return;
  localStorage.setItem(
    LLM_KEY,
    JSON.stringify({
      vendor: llm.vendor,
      model: llm.model,
      apiKey: llm.apiKey,
      baseUrl: llm.baseUrl,
      testedPrint: memoryOk,
      tested: Boolean(livePrint(llm)),
    }),
  );
}

function readLang(): AppLanguage {
  if (memoryLang === "en" || memoryLang === "zh") return memoryLang;
  if (typeof window === "undefined") return "zh";
  const lang = localStorage.getItem(LANG_KEY);
  memoryLang = lang === "en" ? "en" : "zh";
  return memoryLang;
}

type Session = {
  language: AppLanguage;
  setLanguage: (next: AppLanguage) => void;
  llm: LlmState;
  setLlm: (next: LlmState) => void;
  ready: boolean;
  okPrint: string;
  markLive: () => void;
  clearLive: () => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const initialLlm = memoryLlm || defaultLlm();
  const [language, setLanguageState] = useState<AppLanguage>(memoryLang || "zh");
  const [llm, setLlmState] = useState<LlmState>(initialLlm);
  const [okPrint, setOkPrint] = useState(() => livePrint(initialLlm));
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const stored = readStoredLlm();
    const nextLang = readLang();
    setLlmState(stored.llm);
    setOkPrint(stored.ok);
    setLanguageState(nextLang);
    setReady(true);
  }, []);

  const setLlm = useCallback((next: LlmState) => {
    writeStoredLlm(next);
    setLlmState(next);
    setOkPrint(livePrint(next));
  }, []);

  const setLanguage = useCallback((next: AppLanguage) => {
    memoryLang = next;
    setLanguageState(next);
    localStorage.setItem(LANG_KEY, next);
  }, []);

  const markLive = useCallback(() => {
    const current = memoryLlm || llm;
    memoryOk = llmFingerprint(current);
    writeStoredLlm(current);
    setOkPrint(memoryOk);
  }, [llm]);

  const clearLive = useCallback(() => {
    const current = memoryLlm || llm;
    memoryOk = "";
    writeStoredLlm(current);
    setOkPrint("");
  }, [llm]);

  const value = useMemo(
    () => ({ language, setLanguage, llm, setLlm, ready, okPrint, markLive, clearLive, menuOpen, setMenuOpen }),
    [language, setLanguage, llm, setLlm, ready, okPrint, markLive, clearLive, menuOpen],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useFactorySession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("SessionProvider missing");
  return ctx;
}

export function useLlmLamp() {
  const { llm, language, okPrint } = useFactorySession();
  return llmStatus(llm, language, okPrint);
}
