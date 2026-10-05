"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { copy } from "../../../lib/i18n";
import { SiteChrome, AdSlot } from "../../components/SiteChrome";
import { useFactorySession } from "../../hooks/useFactorySession";

const names = {
  zh: { explain: "人话翻译", three_tips: "三条建议", compare: "XX vs XX" },
  en: { explain: "Plain talk", three_tips: "Three tips", compare: "X vs X" },
};

export function ResultClient({ id }: { id: string }) {
  const { language } = useFactorySession();
  const [status, setStatus] = useState("rendering");
  const [videoUrl, setVideoUrl] = useState("");
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState("");
  const [error, setError] = useState("");
  const [line, setLine] = useState(0);
  const [progress, setProgress] = useState(6);
  const [ahead, setAhead] = useState(0);
  const [estimatedSec, setEstimatedSec] = useState(90);
  const [phase, setPhase] = useState<"running" | "queued">("queued");
  const t = copy[language];
  const loadingLine = t.loading[line] ?? t.loading[0];
  const waitTime = estimatedSec > 0 && estimatedSec < 60 ? t.queueSoon : t.queueMinutes.replace("{n}", String(Math.max(1, Math.ceil(estimatedSec / 60))));
  const queueText =
    phase === "running" || ahead <= 0
      ? (phase === "running" ? t.queueNow : t.queueNext).replace("{time}", waitTime)
      : t.queueWait.replace("{count}", String(ahead)).replace("{time}", waitTime);

  useEffect(() => {
    if (!id) return;
    let stop = false;
    const load = async () => {
      const res = await fetch(`/api/jobs/${id}`);
      const data = await res.json();
      if (stop) return;
      if (data.title) setTitle(data.title);
      if (data.template) setTemplate(data.template);
      if (data.status === "completed" && data.videoUrl) {
        setStatus("completed");
        setVideoUrl(data.videoUrl);
        return true;
      }
      if (data.status === "failed") {
        setStatus("failed");
        setError(data.error || "渲染失败");
        return true;
      }
      if (res.status === 404 || data.status === "missing") {
        setStatus("failed");
        setVideoUrl("");
        setError(copy[language].videoGone);
        return true;
      }
      setStatus("rendering");
      setAhead(Number(data.ahead) || 0);
      setEstimatedSec(Number(data.estimatedSec) || 0);
      setPhase(data.phase === "running" ? "running" : "queued");
      return false;
    };
    load();
    let polls = 0;
    const poll = setInterval(async () => {
      polls += 1;
      const done = await load();
      if (done) clearInterval(poll);
      if (polls >= 240) {
        setStatus("failed");
        setError(copy[language].renderGaveUp);
        clearInterval(poll);
      }
    }, 2000);
    return () => {
      stop = true;
      clearInterval(poll);
    };
  }, [id, language]);

  useEffect(() => {
    if (status !== "completed" || !id) return;
    const timer = window.setInterval(async () => {
      const res = await fetch(`/api/jobs/${id}`);
      const data = await res.json().catch(() => ({}));
      if (data.status === "completed" && data.videoUrl) return;
      setVideoUrl("");
      setStatus("failed");
      setError(copy[language].videoGone);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [status, id, language]);

  useEffect(() => {
    if (status !== "rendering") return;
    let ticks = 0;
    const timer = window.setInterval(() => {
      ticks += 1;
      setProgress((n) => {
        if (n >= 94) return 94;
        if (n < 35) return n + 2.2;
        if (n < 70) return n + 0.9;
        return n + 0.25;
      });
      if (ticks % 4 !== 0) return;
      setLine((current) => {
        const count = copy[language].loading.length;
        if (count <= 1) return 0;
        let next = Math.floor(Math.random() * count);
        if (next === current) next = (next + 1) % count;
        return next;
      });
    }, 400);
    return () => window.clearInterval(timer);
  }, [status, language]);

  const templateName =
    template && (template === "explain" || template === "three_tips" || template === "compare")
      ? names[language][template]
      : "";

  return (
    <SiteChrome>
      <main className="home result-page">
        <h1>{title || t.waiting}</h1>
        {status === "rendering" && (
          <div className="make-progress">
            <p className="sub">{loadingLine}</p>
            <p className="queue-line">{queueText}</p>
            <div
              className="track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(Math.min(progress, 94))}
            >
              <i style={{ width: `${Math.min(progress, 94)}%` }} />
            </div>
          </div>
        )}
        {error && <p className="error">{error}</p>}
        {videoUrl && (
          <div className="player-block">
            <video src={videoUrl} controls playsInline autoPlay className="result-video" />
            <div className="result-actions">
              <a href={videoUrl} download={`silly-factory-${id}.mp4`}>
                {t.download}
              </a>
              <Link href="/">{t.again}</Link>
            </div>
            {templateName ? (
              <p className="meta">
                {t.thisVideo}：{templateName}
              </p>
            ) : null}
          </div>
        )}
        <AdSlot language={language} />
      </main>
    </SiteChrome>
  );
}
