"use client";

import { copy } from "../../lib/i18n";
import { SiteChrome } from "../components/SiteChrome";
import { useFactorySession } from "../hooks/useFactorySession";

export default function PrivacyPage() {
  const { language } = useFactorySession();
  const t = copy[language];

  return (
    <SiteChrome>
      <main className="home prose">
        <h1>{t.privacy}</h1>
        {t.privacyBody.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </main>
    </SiteChrome>
  );
}
