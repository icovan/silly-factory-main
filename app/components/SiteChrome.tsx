"use client";

import { useEffect } from "react";
import Link from "next/link";
import { copy, AppLanguage } from "../../lib/i18n";
import { LlmMenu } from "./LlmMenu";
import { useFactorySession } from "../hooks/useFactorySession";

export function AdSlot({ language }: { language: AppLanguage }) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT;
  useEffect(() => {
    if (!client || !slot) return;
    try {
      const w = window as Window & { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
    } catch {
      /* ignore */
    }
  }, [client, slot]);
  return (
    <aside className="ad-slot" aria-label={copy[language].adLabel}>
      <div className="ad-label">{copy[language].adLabel}</div>
      {client && slot ? (
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={client}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : (
        <p className="ad-placeholder">{copy[language].adPlaceholder}</p>
      )}
    </aside>
  );
}

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const { language, setLanguage } = useFactorySession();
  const t = copy[language];
  useEffect(() => {
    document.documentElement.lang = language === "en" ? "en" : "zh-CN";
  }, [language]);
  return (
    <>
      <LlmMenu />
      <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          {t.brand}
        </Link>
        <div className="top-actions">
          <div className="lang">
            <button className={language === "zh" ? "active" : ""} onClick={() => setLanguage("zh")}>
              中文
            </button>
            <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>
              EN
            </button>
          </div>
        </div>
      </header>
      {children}
      <footer className="site-footer">
        <Link href="/about">{t.about}</Link>
        <Link href="/privacy">{t.privacy}</Link>
        <span>{t.brand}</span>
      </footer>
    </div>
    </>
  );
}
