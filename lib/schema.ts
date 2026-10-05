import { AppLanguage } from "./i18n";

export type TemplateId = "explain" | "three_tips" | "compare";

export type Scene =
  | { type: "title"; text: string }
  | { type: "statement"; text: string }
  | { type: "list"; items: string[] }
  | { type: "comparison"; left: { title: string; items: string[] }; right: { title: string; items: string[] } }
  | { type: "conclusion"; text: string }
  | { type: "outro" };

export type WordCue = {
  part: string;
  start: number;
  end: number;
};

export type SceneTiming = {
  from: number;
  durationInFrames: number;
  cueStart: number;
  cueEnd: number;
};

export type VideoContent = {
  template: TemplateId;
  language: AppLanguage;
  title: string;
  scenes: Scene[];
  voiceover: string;
  durationInFrames: number;
  wordCues?: WordCue[];
  sceneTimings?: SceneTiming[];
};

export const LIMITS = {
  zh: { title: 18, body: 32, tip: 12, compareItem: 8, compareTitle: 8, spoken: 120 },
  en: { title: 36, body: 56, tip: 24, compareItem: 16, compareTitle: 14, spoken: 220 },
};

export const MIN_DURATION_FRAMES = 90;
export const MAX_DURATION_FRAMES = 900;

export function limitsFor(language: AppLanguage = "zh") {
  return LIMITS[language];
}

function spokenCount(text: string) {
  return Array.from(text).filter((ch) => /[0-9A-Za-z\u4e00-\u9fff]/.test(ch)).length;
}

export function validateVideoContent(content: VideoContent): string[] {
  const errors: string[] = [];
  const max = limitsFor(content.language || "zh");
  if (!["explain", "three_tips", "compare"].includes(content.template)) errors.push("不支持的视频类型");
  if (!content.title?.trim()) errors.push("标题不能为空");
  if (Array.from(content.title).length > max.title) errors.push("标题太长。机器看不完。");
  if (!content.scenes.length) errors.push("至少需要一个场景");
  if (!content.voiceover?.trim()) errors.push("旁白不能为空");
  if (spokenCount(content.voiceover) > max.spoken) errors.push("旁白太长。机器念不完。");

  for (const scene of content.scenes) {
    if (scene.type === "list") {
      if (scene.items.length > 3) errors.push("三条建议最多 3 条");
      if (scene.items.length < 1) errors.push("清单不能为空");
      scene.items.forEach((x) => Array.from(x).length > max.tip && errors.push("列表项太长。机器看不完。"));
    }
    if (scene.type === "comparison") {
      if (!scene.left.items.length || !scene.right.items.length) errors.push("对比两侧不能为空");
      [...scene.left.items, ...scene.right.items].forEach(
        (x) => Array.from(x).length > max.compareItem && errors.push("对比项太长。机器看不完。"),
      );
    }
    if ((scene.type === "statement" || scene.type === "conclusion") && Array.from(scene.text).length > max.body) {
      errors.push("正文太长。机器看不完。");
    }
  }
  return [...new Set(errors)];
}

export function validateRenderedDuration(content: VideoContent): string[] {
  if (content.durationInFrames > MAX_DURATION_FRAMES) return ["这版太长。机器拒收。"];
  if (content.durationInFrames < MIN_DURATION_FRAMES) return ["这版太短。再试一次。"];
  return [];
}
