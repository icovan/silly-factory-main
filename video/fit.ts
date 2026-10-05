import { consumeCues } from "../lib/speech";
import { WordCue } from "../lib/schema";

export function textLength(text: string) {
  return Array.from(text.replace(/\s/g, "")).length;
}

export function fitSize(text: string, mode: "poster" | "display" | "body") {
  const n = textLength(text) || 1;
  if (mode === "display") {
    if (n <= 4) return 156;
    if (n <= 6) return 128;
    if (n <= 8) return 104;
    if (n <= 10) return 84;
    return 68;
  }
  if (mode === "poster") {
    if (n <= 6) return 120;
    if (n <= 12) return 84;
    return 64;
  }
  if (n <= 18) return 64;
  if (n <= 28) return 52;
  return 44;
}

export function splitPunch(text: string) {
  const parts = text.split(/(?<=[，。！？!?\n])/).filter((part) => part.length > 0);
  if (parts.length < 2) return { lead: "", punch: text };
  const punch = parts[parts.length - 1] ?? text;
  if (!punch.trim()) return { lead: "", punch: text };
  return { lead: parts.slice(0, -1).join(""), punch };
}

export function chunkStartFrames(chunks: string[], cues: WordCue[], fps: number, sceneFrom: number) {
  let index = 0;
  return chunks.map((chunk, i) => {
    if (!cues.length) return i * 10;
    const used = consumeCues(cues, index, chunk);
    index = used.endIndex;
    return Math.max(0, Math.round((used.startMs / 1000) * fps) - sceneFrom);
  });
}
