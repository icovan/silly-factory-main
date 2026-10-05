import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Scene, SceneTiming, VideoContent } from "../../lib/schema";
import { ACCENT, INK, PAPER, PUNCH_SIZE, SAFE, VIDEO_WIDTH } from "../config";
import { chunkStartFrames, fitSize, splitPunch, textLength } from "../fit";
import { FONT } from "../font";
import { SpokenLine } from "./TypingText";
import { Highlight, Outro, SceneMeter, Stamp } from "./Primitives";

const FLASH_FRAMES = 15;
const STAGE_WIDTH = VIDEO_WIDTH - SAFE.left - SAFE.right;

function lineSize(text: string, cap: number) {
  const count = Math.max(textLength(text), 1);
  const fitted = Math.floor((STAGE_WIDTH * 0.96) / count);
  return Math.max(36, Math.min(cap, fitted));
}

function activeIndex(slots: SceneTiming[], frame: number) {
  let index = 0;
  for (let i = 0; i < slots.length; i += 1) {
    if (frame >= slots[i]!.from) index = i;
  }
  return index;
}

function timingOf(scenes: Scene[], slots: SceneTiming[], type: Scene["type"], nth = 0): SceneTiming {
  let seen = 0;
  for (let i = 0; i < scenes.length; i += 1) {
    if (scenes[i]!.type !== type) continue;
    if (seen === nth) return slots[i]!;
    seen += 1;
  }
  return { from: 0, durationInFrames: 30, cueStart: 0, cueEnd: 0 };
}

function flashWord(text: string) {
  const { punch } = splitPunch(text);
  const chars = Array.from(punch.replace(/[，。！？!?,.\s]/g, ""));
  if (!chars.length) return punch.trim() || text.trim();
  if (chars.length <= 6) return chars.join("");
  return chars.slice(-4).join("");
}

function SafeStage({
  children,
  background = PAPER,
  color = INK,
}: {
  children: React.ReactNode;
  background?: string;
  color?: string;
}) {
  return (
    <AbsoluteFill
      style={{
        background,
        color,
        paddingTop: SAFE.top,
        paddingRight: SAFE.right,
        paddingBottom: SAFE.bottom,
        paddingLeft: SAFE.left,
        fontFamily: FONT,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

function Strike({ children, progress }: { children: React.ReactNode; progress: number }) {
  const width = Math.max(0, Math.min(1, progress)) * 100;
  return (
    <div style={{ position: "relative", width: "fit-content", maxWidth: "100%" }}>
      <div style={{ opacity: progress > 0.05 ? 0.5 : 1 }}>{children}</div>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: "52%",
          height: 10,
          width: `${width}%`,
          background: ACCENT,
        }}
      />
    </div>
  );
}

function Said({
  text,
  cues,
  nowMs,
  done = false,
}: {
  text: string;
  cues: VideoContent["wordCues"];
  nowMs: number;
  done?: boolean;
}) {
  if (!cues?.length || done) return <span>{text}</span>;
  return <SpokenLine text={text} cues={cues} nowMs={nowMs} done={done} />;
}

function Receipt({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: `4px dashed ${INK}`,
        background: "#fff",
        boxShadow: `10px 10px 0 ${INK}`,
        padding: "32px 28px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: 12, background: INK }} />
        ))}
      </div>
      {children}
      <div style={{ marginTop: 22, borderTop: `4px solid ${INK}` }} />
    </div>
  );
}

function RedHit({ word, local }: { word: string; local: number }) {
  const scale = interpolate(local, [0, 5], [1.22, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const size = textLength(word) <= 2 ? 188 : textLength(word) <= 4 ? 148 : 112;
  return (
    <AbsoluteFill
      style={{
        background: ACCENT,
        color: "#fff",
        paddingTop: SAFE.top,
        paddingRight: SAFE.right,
        paddingBottom: SAFE.bottom,
        paddingLeft: SAFE.left,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: size, lineHeight: 1.05, textAlign: "center", transform: `scale(${scale})`, wordBreak: "break-word" }}>
        {word}
      </div>
    </AbsoluteFill>
  );
}

function useSpeech(content: VideoContent, slots: SceneTiming[]) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cues = content.wordCues || [];
  const nowMs = (frame / fps) * 1000;
  const index = activeIndex(slots, frame);
  const scene = content.scenes[index];
  const timing = slots[index];
  return { frame, fps, cues, nowMs, index, scene, timing };
}

export function ExplainBoard({ content, slots }: { content: VideoContent; slots: SceneTiming[] }) {
  const { frame, cues, nowMs, scene, timing } = useSpeech(content, slots);
  if (!scene || !timing) return null;
  if (scene.type === "outro") return <Outro language={content.language} />;

  const title = content.scenes.find((item) => item.type === "title");
  const statements = content.scenes.filter((item) => item.type === "statement");
  const conclusion = content.scenes.find((item) => item.type === "conclusion");
  const titleText = title && title.type === "title" ? title.text : content.title;
  const slap = statements[0]?.type === "statement" ? statements[0].text : "";
  const nail = statements[1]?.type === "statement" ? statements[1].text : "";
  const slapAt = timingOf(content.scenes, slots, "statement", 0);
  const endAt = timingOf(content.scenes, slots, "conclusion", 0);
  const verdict = conclusion && conclusion.type === "conclusion" ? conclusion.text : "";
  const { lead, punch } = splitPunch(verdict);
  const flash = scene.type === "conclusion" && endAt.durationInFrames >= 28 && frame < endAt.from + FLASH_FRAMES;
  const struck = interpolate(frame, [slapAt.from, slapAt.from + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (flash) return <RedHit word={flashWord(verdict)} local={frame - endAt.from} />;

  const sceneCues = cues.slice(timing.cueStart, timing.cueEnd);
  const spoken = (text: string) => <Said text={text} cues={sceneCues} nowMs={nowMs} />;

  let body: React.ReactNode;
  if (scene.type === "title") {
    body = (
      <div style={{ marginTop: 72, transform: "rotate(-2.4deg)", transformOrigin: "left center" }}>
        <div style={{ fontWeight: 900, fontSize: fitSize(titleText, "display"), lineHeight: 1.12, wordBreak: "break-word" }}>
          {titleText}
        </div>
      </div>
    );
  } else if (scene.type === "statement" && scene === statements[0]) {
    body = (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, gap: 48 }}>
        <Strike progress={struck}>
          <div style={{ fontWeight: 900, fontSize: 46, lineHeight: 1.25, wordBreak: "break-word" }}>{titleText}</div>
        </Strike>
        <div style={{ fontWeight: 900, fontSize: lineSize(slap, fitSize(slap, "display")), lineHeight: 1.16, wordBreak: "break-word" }}>
          {spoken(slap)}
        </div>
      </div>
    );
  } else if (scene.type === "statement") {
    body = (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, gap: 28 }}>
        <Strike progress={1}>
          <div style={{ fontWeight: 900, fontSize: 34, lineHeight: 1.25, wordBreak: "break-word" }}>{titleText}</div>
        </Strike>
        <div style={{ fontWeight: 900, fontSize: 36, lineHeight: 1.3, opacity: 0.72, wordBreak: "break-word" }}>{slap}</div>
        <Receipt>
          <div style={{ fontWeight: 900, fontSize: fitSize(nail || scene.text, "body"), lineHeight: 1.3, wordBreak: "break-word" }}>
            {spoken(nail || scene.text)}
          </div>
        </Receipt>
      </div>
    );
  } else {
    body = (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, gap: 22 }}>
        <Strike progress={1}>
          <div style={{ fontWeight: 900, fontSize: 32, lineHeight: 1.25, wordBreak: "break-word" }}>{titleText}</div>
        </Strike>
        <div style={{ fontWeight: 900, fontSize: 32, lineHeight: 1.3, opacity: 0.62, wordBreak: "break-word" }}>{slap}</div>
        {lead.trim() ? (
          <div style={{ fontWeight: 900, fontSize: 42, lineHeight: 1.3, wordBreak: "break-word" }}>{lead}</div>
        ) : null}
        <Receipt>
          <div style={{ position: "relative", minHeight: PUNCH_SIZE + 28, display: "flex", alignItems: "center" }}>
            <div style={{ width: "100%", textAlign: "center", fontWeight: 900, fontSize: 40, lineHeight: 1.35, opacity: 0.28, wordBreak: "break-word" }}>{nail}</div>
            <div style={{ position: "absolute", left: 0, right: 0, textAlign: "center" }}>
              <Stamp delay={endAt.from + (endAt.durationInFrames >= 28 ? FLASH_FRAMES : 0)}>
                <span style={{ fontWeight: 900, fontSize: PUNCH_SIZE, lineHeight: 1.35 }}>
                  <Highlight>{punch.trim() || verdict}</Highlight>
                </span>
              </Stamp>
            </div>
          </div>
        </Receipt>
      </div>
    );
  }

  return (
    <SafeStage>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>{body}</div>
      <SceneMeter duration={timing.durationInFrames} frame={frame - timing.from} />
    </SafeStage>
  );
}

export function TipsBoard({ content, slots }: { content: VideoContent; slots: SceneTiming[] }) {
  const { frame, fps, cues, nowMs, scene, timing } = useSpeech(content, slots);
  if (!scene || !timing) return null;
  if (scene.type === "outro") return <Outro language={content.language} />;

  const title = content.scenes.find((item) => item.type === "title");
  const statement = content.scenes.find((item) => item.type === "statement");
  const list = content.scenes.find((item) => item.type === "list");
  const conclusion = content.scenes.find((item) => item.type === "conclusion");
  const titleText = title && title.type === "title" ? title.text : content.title;
  const setup = statement && statement.type === "statement" ? statement.text : "";
  const items = list && list.type === "list" ? list.items : [];
  const verdict = conclusion && conclusion.type === "conclusion" ? conclusion.text : "";
  const endAt = timingOf(content.scenes, slots, "conclusion", 0);
  const listAt = timingOf(content.scenes, slots, "list", 0);
  const flash = scene.type === "conclusion" && endAt.durationInFrames >= 28 && frame < endAt.from + FLASH_FRAMES;

  if (flash) return <RedHit word={flashWord(verdict)} local={frame - endAt.from} />;

  const sceneCues = cues.slice(timing.cueStart, timing.cueEnd);

  if (scene.type === "list" && items.length) {
    const starts = sceneCues.length
      ? chunkStartFrames(items, sceneCues, fps, listAt.from)
      : items.map((_, i) => Math.floor((i * listAt.durationInFrames) / items.length));
    let item = 0;
    for (let i = 0; i < items.length; i += 1) {
      if (frame >= listAt.from + (starts[i] ?? 0)) item = i;
    }
    const line = items[item] ?? "";
    return (
      <SafeStage>
        <div style={{ fontWeight: 900, fontSize: 30, letterSpacing: 0 }}>{titleText}</div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 220, lineHeight: 0.82, color: ACCENT }}>
            {String(item + 1).padStart(2, "0")}
          </div>
          <div style={{ marginTop: 18, fontWeight: 900, fontSize: lineSize(line, fitSize(line, "display")), lineHeight: 1.15, wordBreak: "break-word" }}>
            {line}
          </div>
        </div>
        <SceneMeter duration={timing.durationInFrames} frame={frame - timing.from} />
      </SafeStage>
    );
  }

  if (scene.type === "conclusion") {
    return (
      <SafeStage>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 18, alignItems: "baseline" }}>
              <div style={{ fontWeight: 900, fontSize: 42, color: ACCENT }}>{String(i + 1).padStart(2, "0")}</div>
              <div style={{ fontWeight: 900, fontSize: 36, lineHeight: 1.25, wordBreak: "break-word" }}>{item}</div>
            </div>
          ))}
          <Stamp delay={endAt.from + (endAt.durationInFrames >= 28 ? FLASH_FRAMES : 0)}>
            <div style={{ marginTop: 28, textAlign: "center", fontWeight: 900, fontSize: fitSize(verdict, "body"), lineHeight: 1.35 }}>
              <Highlight>{verdict}</Highlight>
            </div>
          </Stamp>
        </div>
        <SceneMeter duration={timing.durationInFrames} frame={frame - timing.from} />
      </SafeStage>
    );
  }

  if (scene.type === "statement") {
    return (
      <SafeStage>
        <div style={{ fontWeight: 900, fontSize: 32, opacity: 0.55 }}>{titleText}</div>
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <div style={{ fontWeight: 900, fontSize: fitSize(setup, "display"), lineHeight: 1.16, wordBreak: "break-word" }}>
            <Said text={setup} cues={sceneCues} nowMs={nowMs} />
          </div>
        </div>
        <SceneMeter duration={timing.durationInFrames} frame={frame - timing.from} />
      </SafeStage>
    );
  }

  return (
    <SafeStage>
      <div style={{ width: 96, height: 16, background: ACCENT, marginTop: 48 }} />
      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
        <div style={{ fontWeight: 900, fontSize: fitSize(titleText, "display"), lineHeight: 1.12, wordBreak: "break-word" }}>
          {titleText}
        </div>
      </div>
      <SceneMeter duration={timing.durationInFrames} frame={frame - timing.from} />
    </SafeStage>
  );
}

function splitVersus(title: string) {
  const parts = title.split(/\s+vs\s+/i);
  if (parts.length >= 2 && parts[0]?.trim() && parts[1]?.trim()) {
    return { left: parts[0].trim(), right: parts[1].trim() };
  }
  return { left: title.trim(), right: "" };
}

export function VersusBoard({ content, slots }: { content: VideoContent; slots: SceneTiming[] }) {
  const { frame, fps, cues, scene, timing } = useSpeech(content, slots);
  if (!scene || !timing) return null;
  if (scene.type === "outro") return <Outro language={content.language} />;

  const title = content.scenes.find((item) => item.type === "title");
  const comparison = content.scenes.find((item) => item.type === "comparison");
  const conclusion = content.scenes.find((item) => item.type === "conclusion");
  const titleText = title && title.type === "title" ? title.text : content.title;
  const split = splitVersus(titleText);
  const fighting = scene.type === "comparison" || scene.type === "conclusion";
  const verdict = conclusion && conclusion.type === "conclusion" ? conclusion.text : "";
  const endAt = timingOf(content.scenes, slots, "conclusion", 0);
  const compAt = timingOf(content.scenes, slots, "comparison", 0);
  const left = comparison && comparison.type === "comparison" ? comparison.left : { title: split.left, items: [] as string[] };
  const right = comparison && comparison.type === "comparison" ? comparison.right : { title: split.right, items: [] as string[] };
  const leftTitle = fighting ? left.title : split.left;
  const rightTitle = fighting ? right.title : split.right;

  const compCues = cues.slice(compAt.cueStart, compAt.cueEnd);
  const chunks = [left.title, ...left.items, "VS", right.title, ...right.items];
  const starts = compCues.length
    ? chunkStartFrames(chunks, compCues, fps, compAt.from)
    : chunks.map((_, i) => Math.floor((i * Math.max(compAt.durationInFrames, 1)) / chunks.length));
  let visible = 0;
  if (fighting) {
    for (let i = 0; i < chunks.length; i += 1) {
      if (frame >= compAt.from + (starts[i] ?? 0)) visible = i + 1;
    }
  }
  const n = left.items.length;
  const leftShown = fighting ? Math.max(0, Math.min(n, visible - 1)) : 0;
  const rightShown = fighting ? Math.max(0, visible - (n + 3)) : 0;

  const row = (text: string, at: number, struck: boolean, light: boolean) => {
    if (frame < at) return null;
    const age = frame - at;
    const y = interpolate(age, [0, 5], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <div style={{ marginTop: 16, transform: `translateY(${y}px)` }}>
        <div style={{ position: "relative", width: "fit-content", maxWidth: "100%" }}>
          <div style={{ fontWeight: 900, fontSize: 40, lineHeight: 1.25, opacity: struck ? 0.4 : 1, wordBreak: "break-word", color: light ? PAPER : INK }}>
            {text}
          </div>
          {struck ? (
            <div style={{ position: "absolute", left: 0, right: 0, top: "52%", height: 8, background: ACCENT }} />
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "50%",
          background: PAPER,
          color: INK,
          paddingTop: SAFE.top,
          paddingLeft: SAFE.left,
          paddingRight: SAFE.right,
          paddingBottom: 28,
          overflow: "hidden",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 58, lineHeight: 1.1, wordBreak: "break-word" }}>{leftTitle}</div>
        {left.items.slice(0, leftShown).map((item, i) => (
          <div key={i}>{row(item, compAt.from + (starts[i + 1] ?? 0), rightShown > i, false)}</div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          bottom: 0,
          background: INK,
          color: PAPER,
          paddingTop: scene.type === "conclusion" ? 132 : 32,
          paddingLeft: SAFE.left,
          paddingRight: SAFE.right,
          paddingBottom: SAFE.bottom,
          overflow: "hidden",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 58, lineHeight: 1.1, wordBreak: "break-word" }}>{rightTitle || "VS"}</div>
        {right.items.slice(0, rightShown).map((item, i) => (
          <div key={i}>{row(item, compAt.from + (starts[n + 3 + i] ?? 0), false, true)}</div>
        ))}
      </div>
      {scene.type === "conclusion" ? (
        <div
          style={{
            position: "absolute",
            left: SAFE.left,
            right: SAFE.right,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 2,
          }}
        >
          <Stamp delay={endAt.from}>
            <div
              style={{
                background: ACCENT,
                color: "#fff",
                padding: "28px 24px",
                textAlign: "center",
                fontWeight: 900,
                fontSize: fitSize(verdict, "body"),
                lineHeight: 1.35,
                wordBreak: "break-word",
              }}
            >
              {verdict}
            </div>
          </Stamp>
        </div>
      ) : null}
      <SceneMeter duration={timing.durationInFrames} frame={frame - timing.from} tone="paper" />
    </AbsoluteFill>
  );
}
