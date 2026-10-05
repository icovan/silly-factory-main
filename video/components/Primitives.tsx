import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { AppLanguage, copy } from "../../lib/i18n";
import { WordCue } from "../../lib/schema";
import { visibleChunkCount } from "../../lib/speech";
import { ACCENT, INK, PAPER, SAFE } from "../config";
import { chunkStartFrames } from "../fit";
import { FONT } from "../font";

export function SmallText({ children, size = 40 }: { children: React.ReactNode; size?: number }) {
  return (
    <div style={{ fontFamily: FONT, fontSize: size, fontWeight: 900, lineHeight: 1.25, letterSpacing: 0 }}>
      {children}
    </div>
  );
}

export function NumberMark({ n, size = 72 }: { n: number; size?: number }) {
  return (
    <div style={{ fontFamily: FONT, fontSize: size, fontWeight: 900, color: ACCENT, letterSpacing: 0 }}>
      {String(n).padStart(2, "0")}
    </div>
  );
}

export function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        background: ACCENT,
        color: "#fff",
        padding: "4px 12px",
        lineHeight: 1.45,
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
      }}
    >
      {children}
    </span>
  );
}

export function Stamp({
  children,
  delay = 0,
  inline = false,
}: {
  children: React.ReactNode;
  delay?: number;
  inline?: boolean;
}) {
  const frame = useCurrentFrame();
  if (frame < delay) return null;
  const t = frame - delay;
  const scale = interpolate(t, [0, 6], [1.14, 1], { extrapolateRight: "clamp" });
  const Tag = inline ? "span" : "div";
  return (
    <Tag
      style={{
        display: inline ? "inline-block" : "block",
        width: inline ? undefined : "100%",
        textAlign: inline ? undefined : "center",
        transform: `scale(${scale})`,
        transformOrigin: inline ? "left center" : "center center",
      }}
    >
      {children}
    </Tag>
  );
}

export function SceneMeter({
  duration,
  frame: frameProp,
  tone = "ink",
}: {
  duration: number;
  frame?: number;
  tone?: "ink" | "paper";
}) {
  const current = useCurrentFrame();
  const frame = frameProp ?? current;
  const width = interpolate(frame, [0, Math.max(duration - 1, 1)], [0, 100], { extrapolateRight: "clamp" });
  const color = tone === "paper" ? PAPER : INK;
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.left,
        right: SAFE.right,
        bottom: SAFE.bottom,
        height: 8,
        background: tone === "paper" ? "#ffffff33" : "#11111122",
      }}
    >
      <div style={{ width: `${width}%`, height: "100%", background: color }} />
    </div>
  );
}

export function Slam({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const frame = useCurrentFrame();
  const t = Math.max(0, frame - delay);
  const opacity = interpolate(t, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  const y = interpolate(t, [0, 7], [22, 0], { extrapolateRight: "clamp" });
  return <div style={{ opacity, transform: `translateY(${y}px)` }}>{children}</div>;
}

export function List({
  items,
  cues,
  nowMs,
  from = 0,
  fps = 30,
  slam = true,
  compact = false,
}: {
  items: string[];
  cues?: WordCue[];
  nowMs?: number;
  from?: number;
  fps?: number;
  slam?: boolean;
  compact?: boolean;
}) {
  const visible = cues && nowMs != null ? visibleChunkCount(items, cues, nowMs) : items.length;
  const starts = chunkStartFrames(items, cues ?? [], fps, from);
  return (
    <div style={{ display: "grid", gap: compact ? 16 : 28 }}>
      {items.slice(0, visible).map((item, i) => {
        const row = (
          <div style={{ display: "flex", gap: 22, alignItems: "baseline" }}>
            <NumberMark n={i + 1} size={compact ? 48 : 72} />
            <SmallText size={compact ? 32 : 42}>{item}</SmallText>
          </div>
        );
        if (!slam) return <div key={i}>{row}</div>;
        return (
          <Slam key={i} delay={starts[i] ?? 0}>
            {row}
          </Slam>
        );
      })}
    </div>
  );
}

function SideBox({ children, invert = false }: { children: React.ReactNode; invert?: boolean }) {
  return (
    <div
      style={{
        border: `5px solid ${INK}`,
        background: invert ? INK : "transparent",
        color: invert ? PAPER : INK,
        padding: 28,
        fontFamily: FONT,
        fontWeight: 900,
        letterSpacing: 0,
      }}
    >
      {children}
    </div>
  );
}

export function Comparison({
  left,
  right,
  cues,
  nowMs,
  from = 0,
  fps = 30,
}: {
  left: { title: string; items: string[] };
  right: { title: string; items: string[] };
  cues?: WordCue[];
  nowMs?: number;
  from?: number;
  fps?: number;
}) {
  const chunks = [left.title, ...left.items, "VS", right.title, ...right.items];
  const visible = cues && nowMs != null ? visibleChunkCount(chunks, cues, nowMs) : chunks.length;
  const starts = chunkStartFrames(chunks, cues ?? [], fps, from);
  const leftShown = Math.max(0, Math.min(left.items.length, visible - 1));
  const showVs = visible >= 1 + left.items.length + 1;
  const showRight = visible >= 1 + left.items.length + 2;
  const rightShown = showRight ? Math.max(0, visible - (1 + left.items.length + 2)) : 0;
  const rightAt = starts[left.items.length + 2] ?? 0;

  return (
    <div style={{ display: "grid", gap: 18, fontFamily: FONT }}>
      {visible >= 1 ? (
        <Slam delay={starts[0] ?? 0}>
          <SideBox>
            <div style={{ fontSize: 34, marginBottom: 12 }}>{left.title}</div>
            <List items={left.items.slice(0, leftShown)} slam={false} compact />
          </SideBox>
        </Slam>
      ) : null}
      {showVs ? (
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1, height: 4, background: INK }} />
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0 }}>VS</div>
          <div style={{ flex: 1, height: 4, background: INK }} />
        </div>
      ) : null}
      {showRight ? (
        <Slam delay={rightAt}>
          <SideBox invert>
            <div style={{ fontSize: 34, marginBottom: 12 }}>{right.title}</div>
            <List items={right.items.slice(0, rightShown)} slam={false} compact />
          </SideBox>
        </Slam>
      ) : null}
    </div>
  );
}

export function Outro({ language = "zh" }: { language?: AppLanguage }) {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 8], [1.08, 1], { extrapolateRight: "clamp" });
  const text = copy[language];
  return (
    <AbsoluteFill
      style={{
        background: INK,
        color: PAPER,
        paddingTop: SAFE.top,
        paddingRight: SAFE.right,
        paddingBottom: SAFE.bottom,
        paddingLeft: SAFE.left,
        justifyContent: "center",
        fontFamily: FONT,
      }}
    >
      <div style={{ transform: `scale(${scale})` }}>
        <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: 0 }}>{text.brand}</div>
        <div style={{ fontSize: 28, marginTop: 26, lineHeight: 1.5, whiteSpace: "pre-line", letterSpacing: 0 }}>
          {text.outroLine}
        </div>
      </div>
    </AbsoluteFill>
  );
}
