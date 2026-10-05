import { Scene, SceneTiming, VideoContent, WordCue } from "./schema";
import { AppLanguage } from "./i18n";

export function normalizeSpeak(text: string) {
  return Array.from(text).filter((ch) => /[0-9A-Za-z\u4e00-\u9fff]/.test(ch)).join("");
}

export function sceneSpeech(scene: Scene): string {
  if (scene.type === "title" || scene.type === "statement" || scene.type === "conclusion") {
    return scene.text.replace(/\n+/g, "，");
  }
  if (scene.type === "list") return scene.items.join("。");
  if (scene.type === "comparison") {
    return [
      scene.left.title,
      ...scene.left.items,
      "VS",
      scene.right.title,
      ...scene.right.items,
    ].join("。");
  }
  return "";
}

export function buildVoiceover(scenes: Scene[], language: AppLanguage = "zh") {
  const join = language === "en" ? ". " : "。";
  const spoken = scenes
    .map(sceneSpeech)
    .map((line) => line.replace(/[。！？.!?]+$/g, "").trim())
    .filter(Boolean)
    .join(join);
  if (!spoken) return "";
  return language === "en" ? `${spoken}.` : `${spoken}。`;
}

function skipPunct(cues: WordCue[], index: number) {
  while (index < cues.length && !normalizeSpeak(cues[index]!.part)) index += 1;
  return index;
}

export function consumeCues(cues: WordCue[], startIndex: number, text: string) {
  let index = skipPunct(cues, startIndex);
  const target = normalizeSpeak(text);
  if (!target) {
    return { startIndex: index, endIndex: index, startMs: cues[index]?.start ?? 0, endMs: cues[index]?.start ?? 0 };
  }
  const begin = index;
  let acc = "";
  let endMs = cues[index]?.end ?? 0;
  while (index < cues.length && acc.length < target.length) {
    const part = normalizeSpeak(cues[index]!.part);
    if (part) {
      acc += part;
      endMs = cues[index]!.end;
    }
    index += 1;
  }
  const startMs = cues[begin]?.start ?? 0;
  return { startIndex: begin, endIndex: index, startMs, endMs };
}

export function alignScenesToCues(scenes: Scene[], cues: WordCue[], fps: number) {
  const timings: SceneTiming[] = [];
  let cueIndex = 0;
  let lastEndFrame = 0;

  for (const scene of scenes) {
    if (scene.type === "outro") {
      const from = lastEndFrame + 4;
      timings.push({ from, durationInFrames: 48, cueStart: cueIndex, cueEnd: cueIndex });
      lastEndFrame = from + 48;
      continue;
    }
    const spoken = sceneSpeech(scene);
    if (!cues.length || cueIndex >= cues.length) {
      const from = lastEndFrame;
      const durationInFrames = Math.max(36, Math.round((Math.max(Array.from(spoken).length, 8) / 6) * fps));
      timings.push({ from, durationInFrames, cueStart: cueIndex, cueEnd: cueIndex });
      lastEndFrame = from + durationInFrames;
      continue;
    }
    const used = consumeCues(cues, cueIndex, spoken);
    cueIndex = skipPunct(cues, used.endIndex);
    const from = Math.round((used.startMs / 1000) * fps);
    const durationInFrames = Math.max(18, Math.round(((used.endMs - used.startMs) / 1000) * fps) + 4);
    timings.push({
      from,
      durationInFrames,
      cueStart: used.startIndex,
      cueEnd: used.endIndex,
    });
    lastEndFrame = from + durationInFrames;
  }

  const durationInFrames = Math.max(lastEndFrame, Math.round(((cues.at(-1)?.end ?? 0) / 1000) * fps) + 52);
  return { timings, durationInFrames };
}

export function revealedText(text: string, cues: WordCue[], nowMs: number) {
  const spoken = cues
    .filter((cue) => cue.start <= nowMs + 50)
    .map((cue) => normalizeSpeak(cue.part))
    .join("");
  if (!spoken) return "";
  let count = 0;
  let shown = "";
  for (const ch of Array.from(text)) {
    if (!normalizeSpeak(ch)) {
      shown += ch;
      continue;
    }
    if (count >= spoken.length) break;
    shown += ch;
    count += 1;
  }
  return shown;
}

export function visibleChunkCount(chunks: string[], cues: WordCue[], nowMs: number) {
  let index = 0;
  let visible = 0;
  for (const chunk of chunks) {
    const used = consumeCues(cues, index, chunk);
    index = used.endIndex;
    if (nowMs + 50 >= used.startMs) visible += 1;
    else break;
  }
  return visible;
}

export function withSyncedSpeech(content: VideoContent, cues: WordCue[], fps: number): VideoContent {
  const voiceover = buildVoiceover(content.scenes, content.language);
  const { timings, durationInFrames } = alignScenesToCues(content.scenes, cues, fps);
  return {
    ...content,
    voiceover,
    wordCues: cues,
    sceneTimings: timings,
    durationInFrames,
  };
}
