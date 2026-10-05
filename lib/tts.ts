import fs from "node:fs/promises";
import path from "node:path";
import { EdgeTTS } from "node-edge-tts";
import { WordCue } from "./schema";
import { AppLanguage } from "./i18n";

const ZH_VOICES = [
  "zh-CN-XiaoxiaoNeural",
  "zh-CN-YunxiNeural",
  "zh-CN-YunjianNeural",
  "zh-CN-XiaoyiNeural",
  "zh-CN-YunyangNeural",
];

const EN_VOICES = [
  "en-US-JennyNeural",
  "en-US-GuyNeural",
  "en-US-AriaNeural",
  "en-US-AndrewNeural",
  "en-US-EmmaNeural",
  "en-GB-SoniaNeural",
  "en-GB-RyanNeural",
];

function pick<T>(items: T[], exclude?: T): T {
  const pool = exclude ? items.filter((item) => item !== exclude) : items;
  const list = pool.length ? pool : items;
  return list[Math.floor(Math.random() * list.length)]!;
}

function langFor(voice: string, language: AppLanguage) {
  if (voice.startsWith("en-GB")) return "en-GB";
  if (voice.startsWith("en-")) return "en-US";
  return language === "en" ? "en-US" : "zh-CN";
}

function estimateSeconds(text: string, language: AppLanguage) {
  const chars = Array.from(text.replace(/\s+/g, "")).length;
  return language === "zh" ? chars / 5.2 : chars / 13;
}

function sanitizeSpeak(text: string) {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ").replace(/\s+/g, " ").trim();
}

async function readCues(audioPath: string): Promise<WordCue[]> {
  try {
    const raw = await fs.readFile(`${audioPath}.json`, "utf8");
    const cues = JSON.parse(raw) as WordCue[];
    return Array.isArray(cues) ? cues.filter((cue) => typeof cue.start === "number") : [];
  } catch {
    return [];
  }
}

async function durationFromSubtitles(audioPath: string, fallback: number) {
  const cues = await readCues(audioPath);
  const last = cues.at(-1)?.end;
  if (!last) return fallback;
  return Math.max(1, last / 1000 + 0.35);
}

async function speakToFile(text: string, file: string, voice: string, language: AppLanguage) {
  const tts = new EdgeTTS({
    voice,
    lang: langFor(voice, language),
    saveSubtitles: true,
    timeout: 20000,
  });
  try {
    await tts.ttsPromise(text, file);
  } catch (error) {
    await fs.unlink(file).catch(() => undefined);
    throw error instanceof Error ? error : new Error(String(error));
  }
  const stat = await fs.stat(file).catch(() => null);
  if (!stat || stat.size < 1000) {
    await fs.unlink(file).catch(() => undefined);
    throw new Error("配音失败，没有生成有效音频。");
  }
}

export async function generateVoiceover(text: string, id: string, language: AppLanguage) {
  const spoken = sanitizeSpeak(text);
  if (!spoken) throw new Error("没有可念的句子。");
  const dir = path.join(process.cwd(), "public", "generated");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${id}.mp3`);
  const voices = language === "zh" ? ZH_VOICES : EN_VOICES;
  let lastError = "配音失败。";
  let voice = pick(voices);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    voice = pick(voices, attempt ? voice : undefined);
    try {
      await speakToFile(spoken, file, voice, language);
      const estimatedSeconds = await durationFromSubtitles(file, estimateSeconds(spoken, language));
      const cues = await readCues(file);
      return {
        publicSrc: `generated/${id}.mp3`,
        filePath: file,
        estimatedSeconds,
        voice,
        cues,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "配音失败。";
    }
  }

  throw new Error(lastError === "Timed out" ? "配音超时。换一次再试。" : lastError);
}
