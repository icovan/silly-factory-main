"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { copy } from "../lib/i18n";
import { SiteChrome } from "./components/SiteChrome";
import { useFactorySession, useLlmLamp } from "./hooks/useFactorySession";

const directions = ["explain", "three_tips", "compare"] as const;

export default function Home() {
  const router = useRouter();
  const { language, llm, setMenuOpen } = useFactorySession();
  const lamp = useLlmLamp();
  const [template, setTemplate] = useState<(typeof directions)[number]>("explain");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadTick, setLoadTick] = useState(0);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const t = copy[language];
  const loadingLine = t.loading[loadTick] ?? t.loading[0];

  useEffect(() => {
    const draft = sessionStorage.getItem("silly-factory-draft");
    if (draft) setInput(draft);
  }, []);

  useEffect(() => {
    if (!busy) {
      setProgress(0);
      return;
    }
    setLoadTick(0);
    setProgress(8);
    const timer = setInterval(() => {
      setLoadTick((current) => {
        const count = copy[language].loading.length;
        if (count <= 1) return 0;
        let next = Math.floor(Math.random() * count);
        if (next === current) next = (next + 1) % count;
        return next;
      });
    }, 1600);
    const bar = setInterval(() => {
      setProgress((n) => (n >= 90 ? n : n < 40 ? n + 3 : n + 1.2));
    }, 400);
    return () => {
      clearInterval(timer);
      clearInterval(bar);
    };
  }, [busy, language]);

  async function generate() {
    if (!input.trim()) return;
    if (!lamp.live) {
      setMenuOpen(true);
      setError(t.needKey);
      return;
    }
    setBusy(true);
    setError("");
    sessionStorage.setItem("silly-factory-draft", input);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          template,
          input,
          language,
          llm: {
            vendor: llm.vendor,
            model: llm.model,
            apiKey: llm.apiKey,
            baseUrl: llm.vendor === "custom" ? llm.baseUrl : undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "生成失败");
      const id = data.jobId;
      if (!id && data.videoUrl) {
        const match = String(data.videoUrl).match(/generated\/([^/.]+)/);
        if (match) {
          router.push(`/r/${match[1]}`);
          return;
        }
      }
      if (!id) throw new Error("没有任务编号");
      router.push(`/r/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
      setBusy(false);
    }
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "智障工厂 Silly Factory",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    inLanguage: ["zh-CN", "en"],
    description: t.howBody,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: t.faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <SiteChrome>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <main className="home">
        <h1>
          {t.headline.split("\n").map((line, i) => (
            <span key={i}>
              {i ? <br /> : null}
              {line}
            </span>
          ))}
        </h1>
        <p className="sub">{t.sub}</p>

        <section className="factory">
          <div className="label">{t.step1}</div>
          <div className="directions">
            {directions.map((id) => (
              <button
                key={id}
                className={template === id ? "direction active" : "direction"}
                onClick={() => setTemplate(id)}
              >
                <strong>{t.directions[id].label}</strong>
                <span>{t.directions[id].desc}</span>
              </button>
            ))}
          </div>
          <div className="label">{t.step2}</div>
          <div className="topic">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 100))}
              placeholder={t.placeholder}
            />
            <span className="count">{input.length}/100</span>
          </div>
          <button className={busy ? "generate busy" : "generate"} onClick={generate} disabled={busy || !input.trim()}>
            <span className="generate-copy">{busy ? loadingLine : t.generate}</span>
            {busy ? (
              <span className="generate-bar" aria-hidden>
                <i style={{ width: `${progress}%` }} />
              </span>
            ) : null}
          </button>
          <p className={lamp.live ? "room-line on" : "room-line"}>{lamp.live ? t.roomHint : t.needKey}</p>
          {error && <p className="error">{error}</p>}
        </section>

        <section className="prose">
          <h2>{t.howTitle}</h2>
          <p>{t.howBody}</p>
          <h2>{t.faqTitle}</h2>
          <dl className="faq">
            {t.faq.map((item) => (
              <div key={item.q}>
                <dt>{item.q}</dt>
                <dd>{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </SiteChrome>
  );
}
