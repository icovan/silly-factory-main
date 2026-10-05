import React from "react";
import { useCurrentFrame } from "remotion";
import { WordCue } from "../../lib/schema";
import { revealedText } from "../../lib/speech";

export function TypingText({
  text,
  startFrame = 0,
  charsPerFrame = 0.09,
}: {
  text: string;
  startFrame?: number;
  charsPerFrame?: number;
}) {
  const frame = useCurrentFrame();
  const count = Math.min(
    text.length,
    Math.max(0, Math.floor((frame - startFrame) * charsPerFrame))
  );

  return (
    <span>
      {text.slice(0, count)}
      {count < text.length ? "▌" : ""}
    </span>
  );
}

export function SpokenLine({
  text,
  cues,
  nowMs,
  done,
}: {
  text: string;
  cues: WordCue[];
  nowMs: number;
  done?: boolean;
}) {
  const shown = done ? text : revealedText(text, cues, nowMs);
  const finished = done || shown === text;
  return (
    <span>
      {shown || ""}
      {finished ? "" : "▌"}
    </span>
  );
}
