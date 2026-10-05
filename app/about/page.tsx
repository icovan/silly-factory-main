"use client";

import { copy } from "../../lib/i18n";
import { SiteChrome, AdSlot } from "../components/SiteChrome";
import { useFactorySession } from "../hooks/useFactorySession";

export default function AboutPage() {
  const { language } = useFactorySession();
  const t = copy[language];

  return (
    <SiteChrome>
      <main className="home prose">
        <h1>{t.about}</h1>
        <p>{t.howBody}</p>
        <p>{t.aboutExtra}</p>
        <AdSlot language={language} />
      </main>
    </SiteChrome>
  );
}
